import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env file
const env = fs.readFileSync('.env', 'utf-8');
let url = '', serviceKey = '';
env.split('\n').forEach(l => {
  if (l.startsWith('VITE_SUPABASE_URL=')) url = l.split('=')[1].trim();
  if (l.startsWith('SUPABASE_SERVICE_KEY=')) serviceKey = l.split('=')[1].trim();
});

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const getBaseRef = (ref) => {
  if (!ref) return "";
  const match = ref.match(/(.*)-S\d+$/);
  return match ? match[1] : ref;
};

async function main() {
  console.log("Fetching all cables...");
  const { data: cables, error } = await supabase
    .from('cables_fibre')
    .select('id, cable_reference, nom');

  if (error) {
    console.error("Error fetching cables:", error);
    process.exit(1);
  }

  console.log(`Found ${cables.length} cables. Analyzing grouping...`);

  // Group by base reference
  const groups = {};
  cables.forEach(c => {
    const base = getBaseRef(c.cable_reference);
    if (base && c.cable_reference.includes('-S')) {
      if (!groups[base]) groups[base] = [];
      groups[base].push(c);
    }
  });

  let updateCount = 0;

  for (const [base, list] of Object.entries(groups)) {
    // If a group has multiple cables sharing the same base ref (e.g. S01, S02...)
    // we consider it an ODF-level connection.
    if (list.length >= 2) {
      console.log(`Group "${base}" has ${list.length} cables. Prepending [ODF] to their names...`);
      for (const cable of list) {
        if (cable.nom && !cable.nom.startsWith('[ODF]')) {
          const newNom = `[ODF] ${cable.nom}`;
          const { error: updateErr } = await supabase
            .from('cables_fibre')
            .update({ nom: newNom })
            .eq('id', cable.id);

          if (updateErr) {
            console.error(`Failed to update cable ${cable.id}:`, updateErr);
          } else {
            console.log(`Updated cable ${cable.id}: "${cable.nom}" -> "${newNom}"`);
            updateCount++;
          }
        }
      }
    }
  }

  console.log(`Done! Updated ${updateCount} cables.`);
}

main();
