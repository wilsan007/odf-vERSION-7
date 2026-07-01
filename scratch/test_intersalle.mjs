import { findIntersalleCables, findBestIntersalleTransit } from '../src/components/services/routingEngine.js';

// Données réelles fournies par l'utilisateur (câbles internes du site Alpha)
const cablesInternes = [
  { id: '838a91f3-2916-495a-a9c7-861b7c5bb136', cable_reference: 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3-S01', port_source_id: 'ALP-S1-R1-ODF3_S01P01', port_dest_id: 'ALP-S2-R1-ODF3_S01P01' },
  { id: '0d70f4b7-94a6-443a-81fb-28a8553654dd', cable_reference: 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3-S02', port_source_id: 'ALP-S1-R1-ODF3_S02P01', port_dest_id: 'ALP-S2-R1-ODF3_S02P01' },
  { id: '81fe6139-cbb2-4376-baf4-5a24218bb936', cable_reference: 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3-S03', port_source_id: 'ALP-S1-R1-ODF3_S03P01', port_dest_id: 'ALP-S2-R1-ODF3_S03P01' },
  { id: '201145ef-f43e-4f3a-b9b6-9748014a5ad7', cable_reference: 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3-S04', port_source_id: 'ALP-S1-R1-ODF3_S04P01', port_dest_id: 'ALP-S2-R1-ODF3_S04P01' },
  { id: '188cd23a-7800-4902-a6f8-bf98c69dd1fb', cable_reference: 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3-S05', port_source_id: 'ALP-S1-R1-ODF3_S05P01', port_dest_id: 'ALP-S2-R1-ODF3_S05P01' },
  { id: '95a3416b-ca4a-4313-a1fa-d6d082ed44e5', cable_reference: 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3-S06', port_source_id: 'ALP-S1-R1-ODF3_S06P01', port_dest_id: 'ALP-S2-R1-ODF3_S06P01' },
];

// Ports simulés (internes et externes) avec leurs salles
// Les ports entrant/sortant sont des ODF externes (EXTERNE) sur Alpha S1/S2
const internalPorts = [
  { id: 'ALP-S1-R1-ODF3_S01P01', salle_id: 'ALP-S1' },
  { id: 'ALP-S2-R1-ODF3_S01P01', salle_id: 'ALP-S2' },
  { id: 'ALP-S1-R1-ODF3_S05P01', salle_id: 'ALP-S1' },
  { id: 'ALP-S2-R1-ODF3_S05P01', salle_id: 'ALP-S2' },
];

const externalPorts = [
  { id: 'ALP-S1-R1-ODF1_S05P01', salle_id: 'ALP-S1' },
  { id: 'ALP-S2-R1-ODF1_S01P02', salle_id: 'ALP-S2' },
];

console.log('=== Test findIntersalleCables ===');
const intersalleCables = findIntersalleCables({
  internalPorts,
  externalPorts,
  cablesInternes,
  salleIn: 'ALP-S1',
  salleOut: 'ALP-S2'
});
console.log('Found:', intersalleCables.length);

console.log('\n=== Test findBestIntersalleTransit ===');
const candidates = findBestIntersalleTransit({
  portTransitIn: 'ALP-S1-R1-ODF1_S05P01',
  portEntreeB: 'ALP-S2-R1-ODF1_S01P02',
  internalPorts,
  externalPorts,
  cablesInternes,
  salleIn: 'ALP-S1',
  salleOut: 'ALP-S2'
});
console.log('Candidates:', JSON.stringify(candidates, null, 2));
