import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
let url = '', serviceKey = '';
env.split('\n').forEach(l => {
  if (l.startsWith('VITE_SUPABASE_URL=')) url = l.split('=')[1].trim();
  if (l.startsWith('SUPABASE_SERVICE_KEY=')) serviceKey = l.split('=')[1].trim();
});

const supabase = createClient(url, serviceKey);

async function main() {
  // 1. Basculer les dernières connexions JARRETIERE vers INTERNE
  const { data: jarretiereRows, error: selErr } = await supabase
    .from('cables_fibre')
    .select('id, cable_reference, type_lien')
    .eq('type_lien', 'JARRETIERE');
  if (selErr) throw selErr;
  console.log(`Étape 1 : ${jarretiereRows.length} ligne(s) JARRETIERE à convertir en INTERNE.`);
  for (const row of jarretiereRows) {
    const { error } = await supabase.from('cables_fibre').update({ type_lien: 'INTERNE' }).eq('id', row.id);
    if (error) throw error;
    console.log(`  ${row.cable_reference} : JARRETIERE -> INTERNE`);
  }

  // 2. Renommer le préfixe JAR- en INT- pour toutes les références restantes
  const { data: jarRefRows, error: selErr2 } = await supabase
    .from('cables_fibre')
    .select('id, cable_reference')
    .like('cable_reference', 'JAR-%');
  if (selErr2) throw selErr2;
  console.log(`Étape 2 : ${jarRefRows.length} référence(s) JAR- à renommer en INT-.`);
  for (const row of jarRefRows) {
    const newRef = row.cable_reference.replace(/^JAR-/, 'INT-');
    const { error } = await supabase.from('cables_fibre').update({ cable_reference: newRef }).eq('id', row.id);
    if (error) throw error;
    console.log(`  ${row.cable_reference} -> ${newRef}`);
  }

  // Vérification finale
  const { data: check } = await supabase
    .from('cables_fibre')
    .select('type_lien')
  const counts = {};
  (check || []).forEach(r => counts[r.type_lien] = (counts[r.type_lien]||0)+1);
  console.log('\nRécapitulatif type_lien :', counts);

  const { count: remainingJar } = await supabase
    .from('cables_fibre')
    .select('id', { count: 'exact', head: true })
    .like('cable_reference', 'JAR-%');
  console.log('Références JAR- restantes :', remainingJar);
}

main().catch(e => { console.error('ERREUR:', e.message); process.exit(1); });
