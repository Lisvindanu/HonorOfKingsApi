import fs from 'fs/promises';
import path from 'path';

async function formatSimpleAPI() {
  console.log('📦 Loading hero data...');

  const inputFile = path.join(process.cwd(), 'output', 'all-heroes-complete.json');
  const rawData = await fs.readFile(inputFile, 'utf-8');
  const heroesData = JSON.parse(rawData);

  console.log(`✅ Loaded ${heroesData.length} heroes`);

  const formattedData = {};

  for (const hero of heroesData) {
    if (!hero.heroName) continue;

    const heroKey = hero.heroName;

    // Extract skins from world.libraryList
    const skins = [];
    if (hero.world?.libraryList) {
      for (const item of hero.world.libraryList) {
        if (item.materialType === 1 && item.image) {
          skins.push({
            skinName: item.image.title1 || hero.heroName,
            skinImg: item.image.oriPicUrl || ''
          });
        }
      }
    }

    formattedData[heroKey] = {
      title: hero.heroName,
      name: hero.heroName,
      heroId: hero.heroId,
      role: hero.mainJobName || '',
      lane: hero.recommendRoadName || '',
      icon: hero.icon || '',
      skill: [], // Skills not available in current scrape
      skins: skins,
      stats: {
        winRate: hero.stats?.winRate || '',
        pickRate: hero.stats?.matchRate || '',
        banRate: hero.stats?.banRate || '',
        tier: hero.stats?.hot || ''
      },
      world: {
        region: hero.world?.world?.region || '',
        identity: hero.world?.world?.identity || '',
        energy: hero.world?.world?.energy || '',
        height: hero.world?.world?.height || ''
      },
      cover: hero.displayData?.heroCover || ''
    };

    console.log(`  ✅ ${heroKey} - ${skins.length} skins`);
  }

  const outputFile = path.join(process.cwd(), 'output', 'formatted-api.json');
  await fs.writeFile(outputFile, JSON.stringify({ main: formattedData }, null, 2));

  console.log(`\n💾 Saved to: ${outputFile}`);
  console.log(`📊 Total heroes: ${Object.keys(formattedData).length}`);
}

formatSimpleAPI().catch(console.error);
