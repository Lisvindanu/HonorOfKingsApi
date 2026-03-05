import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('/root/HonorOfKingsApi/output/items.json', 'utf8'));

// Manual fixes for items with empty effects
const manualFixes = {
  'Lightfoot Shoes': {
    description: 'Movement Speed +60',
    effects: [{ effectType: 15, valueType: 1, value: 60 }]
  },
  'Mystic Page': {
    description: 'Magic Lifesteal +8%',
    effects: [{ effectType: 10, valueType: 2, value: 80000 }]
  }
};

let fixed = 0;
items.forEach(item => {
  if (manualFixes[item.name]) {
    const fix = manualFixes[item.name];
    item.description = fix.description;
    item.effects = fix.effects;
    fixed++;
    console.log('Fixed:', item.name, '->', item.description);
  }
});

writeFileSync('/root/HonorOfKingsApi/output/items.json', JSON.stringify(items, null, 2));
console.log('\nFixed', fixed, 'items');
