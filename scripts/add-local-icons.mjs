import fs from "fs";

const API_PATH = "/root/HonorOfKingsApi/output/merged-api.json";
const API_BASE = "https://hokapi.project-n.site";

const data = JSON.parse(fs.readFileSync(API_PATH, "utf8"));

let updated = 0;
for (const [name, hero] of Object.entries(data.main)) {
  if (hero.heroId) {
    // Add local icon URL (original icon becomes fallback)
    hero.iconOriginal = hero.icon;
    hero.icon = `${API_BASE}/images/heroes/icons/${hero.heroId}.webp`;
    updated++;
  }
}

fs.writeFileSync(API_PATH, JSON.stringify(data, null, 2));
console.log(`Updated ${updated} heroes with local icon URLs`);
