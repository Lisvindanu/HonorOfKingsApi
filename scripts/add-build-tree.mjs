import { readFileSync, writeFileSync } from 'fs';

// Read current items
const items = JSON.parse(readFileSync('/root/HonorOfKingsApi/output/items.json', 'utf8'));

// Create lookup map
const itemMap = new Map(items.map(item => [item.id, item]));

// Add buildsFrom and upgradesTo arrays
items.forEach(item => {
  // buildsFrom: look up preEquipIds and get item details
  item.buildsFrom = (item.preEquipIds || []).map(id => {
    const prereq = itemMap.get(id);
    if (prereq) {
      return {
        id: prereq.id,
        name: prereq.name,
        icon: prereq.icon,
        price: prereq.price
      };
    }
    return null;
  }).filter(Boolean);
  
  // Initialize upgradesTo
  item.upgradesTo = [];
});

// Calculate upgradesTo (inverse relationship)
items.forEach(item => {
  (item.preEquipIds || []).forEach(preId => {
    const prereqItem = itemMap.get(preId);
    if (prereqItem) {
      prereqItem.upgradesTo.push({
        id: item.id,
        name: item.name,
        icon: item.icon,
        price: item.price
      });
    }
  });
});

// Save updated items
writeFileSync('/root/HonorOfKingsApi/output/items.json', JSON.stringify(items, null, 2));

console.log('Added buildsFrom and upgradesTo to', items.length, 'items');

// Show sample with build paths
const itemsWithBuilds = items.filter(i => i.buildsFrom.length > 0);
console.log('Items with build requirements:', itemsWithBuilds.length);
console.log('Sample:', itemsWithBuilds[0]?.name, '- buildsFrom:', itemsWithBuilds[0]?.buildsFrom.map(b => b.name).join(', '));
