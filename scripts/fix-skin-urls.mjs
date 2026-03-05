import fs from 'fs';
import path from 'path';

const mergedApiPath = path.join(process.cwd(), 'output', 'merged-api.json');

console.log('Loading merged-api.json...');
const data = JSON.parse(fs.readFileSync(mergedApiPath, 'utf-8'));

let updated = 0;

// Update main heroes
for (const heroName in data.main) {
  const hero = data.main[heroName];
  if (hero.skins && Array.isArray(hero.skins)) {
    for (const skin of hero.skins) {
      // If skinImage (local) exists, use it for skinCover
      if (skin.skinImage && skin.skinImage.includes('hokapi.project-n.site')) {
        // Save original to skinCoverOriginal if not already saved
        if (!skin.skinCoverOriginal && skin.skinCover) {
          skin.skinCoverOriginal = skin.skinCover;
        }
        // Use local skinImage as skinCover
        skin.skinCover = skin.skinImage;
        updated++;
      }
    }
  }
}

console.log(`Updated ${updated} skin covers to use local URLs`);

// Save
fs.writeFileSync(mergedApiPath, JSON.stringify(data, null, 2));
console.log('Saved merged-api.json');
