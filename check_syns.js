const fs = require('fs');
const html = fs.readFileSync('/sessions/compassionate-quirky-hypatia/mnt/youbuddy-challenge-claude/5th/index.html', 'utf8');
const m = html.match(/const SYNONYM_GLOSSARY = \{[\s\S]*?^function synonymNuance\(word, syn\) \{[\s\S]*?\n\}/m);
if (!m) {
  console.error('block not found');
  process.exit(1);
}
const block = m[0];
try {
  const fn = new Function(block + '; return { SYNONYM_GLOSSARY, SYNONYM_NUANCE, synonymMeaning, synonymNuance };');
  const { SYNONYM_GLOSSARY, SYNONYM_NUANCE, synonymMeaning, synonymNuance } = fn();
  console.log('glossary entries:', Object.keys(SYNONYM_GLOSSARY).length);
  console.log('nuance entries:  ', Object.keys(SYNONYM_NUANCE).length);
  // sanity
  console.log('sample meaning:', synonymMeaning('Plan B'));
  console.log('sample nuance :', synonymNuance({en:'Set the stage'}, 'Pave the way'));
  console.log('apostrophe key:', SYNONYM_GLOSSARY["take one's word for it"]);
  console.log('apostrophe nuance:', synonymNuance({en:'Get in the zone'}, "Find one's flow"));
} catch (e) {
  console.error('syntax error:', e.message);
  process.exit(1);
}
