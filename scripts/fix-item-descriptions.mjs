import { readFileSync, writeFileSync } from 'fs';

// Effect type to stat name mapping
const EFFECT_NAMES = {
  1: 'Physical Attack',
  2: 'Magic Power',
  3: 'Physical Defense',
  4: 'Magic Defense',
  5: 'Max HP',
  6: 'Critical Rate',
  7: 'Critical Damage',
  8: 'Armor Penetration',
  9: 'Physical Lifesteal',
  10: 'Magic Lifesteal',
  11: 'Cooldown Reduction',
  12: 'Mana',
  13: 'Mana Regen',
  14: 'HP Regen',
  15: 'Movement Speed',
  16: 'Magic Penetration',
  17: 'Shield',
  18: 'Attack Speed',
  19: 'Tenacity',
  20: 'Heal Effect',
};

// Format effect value
function formatEffect(effect) {
  const name = EFFECT_NAMES[effect.effectType] || `Stat ${effect.effectType}`;
  
  if (effect.valueType === 2) {
    // Percentage value (value / 10000 = %)
    const percent = effect.value / 10000;
    return `${name} +${percent}%`;
  } else {
    // Flat value
    return `${name} +${effect.value}`;
  }
}

// Read items
const items = JSON.parse(readFileSync('/root/HonorOfKingsApi/output/items.json', 'utf8'));

let updated = 0;
items.forEach(item => {
  if (item.effects && item.effects.length > 0) {
    const newDesc = item.effects.map(formatEffect).join('\n');
    if (newDesc !== item.description) {
      item.description = newDesc;
      updated++;
    }
  }
});

writeFileSync('/root/HonorOfKingsApi/output/items.json', JSON.stringify(items, null, 2));
console.log('Updated', updated, 'item descriptions');

// Show sample
const samples = items.slice(0, 5);
samples.forEach(item => {
  console.log(`\n${item.name}:`);
  console.log(item.description);
});
