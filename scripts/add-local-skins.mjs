import fs from 'fs';
import path from 'path';

const API_BASE = 'https://hokapi.project-n.site';
const DATA_PATH = '/root/HonorOfKingsApi/output/merged-api.json';
const SKINS_DIR = '/root/HonorOfKingsApi/public/images/skins';

// Read current data
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

let updated = 0;
let skipped = 0;

// Iterate through heroes in data.main
for (const heroName in data.main) {
  const hero = data.main[heroName];
  if (!hero.skins) continue;
  
  for (let i = 0; i < hero.skins.length; i++) {
    const skin = hero.skins[i];
    const filename = hero.heroId + '_' + i + '.webp';
    const localPath = path.join(SKINS_DIR, filename);
    
    // Check if local file exists
    if (fs.existsSync(localPath)) {
      // Save original URL as fallback
      if (!skin.skinImageOriginal && skin.skinImage) {
        skin.skinImageOriginal = skin.skinImage;
      }
      // Update to local URL
      skin.skinImage = API_BASE + '/images/skins/' + filename;
      updated++;
    } else {
      skipped++;
    }
  }
}

// Save updated data
fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log('Updated:', updated, 'skins');
console.log('Skipped (no local file):', skipped);
