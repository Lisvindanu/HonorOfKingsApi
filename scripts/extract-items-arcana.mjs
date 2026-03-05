import fs from 'fs';
import path from 'path';

const mergedApiPath = path.join(process.cwd(), 'output', 'merged-api.json');
console.log('Loading merged-api.json...');
const data = JSON.parse(fs.readFileSync(mergedApiPath, 'utf-8'));

const itemsMap = new Map();
const arcanaMap = new Map();

// Extract from all heroes
for (const heroName in data.main) {
  const hero = data.main[heroName];
  
  // Extract items
  if (hero.recommendedEquipment && Array.isArray(hero.recommendedEquipment)) {
    for (const item of hero.recommendedEquipment) {
      if (item.id && !itemsMap.has(item.id)) {
        itemsMap.set(item.id, {
          ...item,
          usedByHeroes: [hero.name]
        });
      } else if (item.id) {
        const existing = itemsMap.get(item.id);
        if (!existing.usedByHeroes.includes(hero.name)) {
          existing.usedByHeroes.push(hero.name);
        }
      }
    }
  }
  
  // Extract arcana
  if (hero.arcana && Array.isArray(hero.arcana)) {
    for (const arc of hero.arcana) {
      if (arc.id && !arcanaMap.has(arc.id)) {
        arcanaMap.set(arc.id, {
          ...arc,
          usedByHeroes: [hero.name]
        });
      } else if (arc.id) {
        const existing = arcanaMap.get(arc.id);
        if (!existing.usedByHeroes.includes(hero.name)) {
          existing.usedByHeroes.push(hero.name);
        }
      }
    }
  }
}

const items = Array.from(itemsMap.values()).sort((a, b) => a.id - b.id);
const arcana = Array.from(arcanaMap.values()).sort((a, b) => a.id - b.id);

console.log(`Found ${items.length} unique items`);
console.log(`Found ${arcana.length} unique arcana`);

// Save to files
fs.writeFileSync(
  path.join(process.cwd(), 'output', 'items.json'),
  JSON.stringify(items, null, 2)
);
fs.writeFileSync(
  path.join(process.cwd(), 'output', 'arcana.json'),
  JSON.stringify(arcana, null, 2)
);

console.log('Saved items.json and arcana.json');
