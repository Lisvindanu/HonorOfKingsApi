import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://world.honorofkings.com';

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

async function scrapeWorldSkins() {
  console.log('🌍 Scraping skins from world.honorofkings.com...\n');

  try {
    // 1. Fetch hero list
    console.log('📥 Fetching hero list...');
    const heroListUrl = `${BASE_URL}/zlkdatasys/yuzhouzhan/list/heroList-en.json`;
    const heroList = await fetchJSON(heroListUrl);
    const heroes = heroList.yzzyxl_5891;
    console.log(`  ✅ Found ${heroes.length} heroes\n`);

    // 2. Fetch skin list from pfjs.json
    console.log('📥 Fetching skin database from pfjs.json...');
    const skinsUrl = `${BASE_URL}/zlkdatasys/yuzhouzhan/en/pfjs.json`;
    const skinsData = await fetchJSON(skinsUrl);
    const allSkins = skinsData.pflbzt_5151;
    console.log(`  ✅ Found ${allSkins.length} skins\n`);

    // 3. Build hero data with skins
    console.log('🔨 Building hero data structure...');
    const output = { main: {} };
    let totalSkins = 0;
    let skinsWithSeries = 0;

    for (const hero of heroes) {
      const heroId = parseInt(hero.id_6123);
      const heroName = (hero.yxmc_1926 || hero.bt_3883 || 'Unknown').toUpperCase();

      // Find all skins for this hero
      const heroSkins = allSkins
        .filter(skin => {
          const skinHeroIds = (skin.pfjsgy_4147 || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          return skinHeroIds.includes(heroId);
        })
        .map(skin => {
          const skinSeries = (skin.pftxmc_8315 || '').trim();
          if (skinSeries) skinsWithSeries++;

          // Build proper image URL
          let skinCover = skin.pftpdz_2619 || '';
          if (skinCover) {
            skinCover = skinCover.replace('//', '/');
            if (skinCover.startsWith('/')) {
              skinCover = BASE_URL + skinCover;
            }
          }

          let skinImage = skin.pfzmxx_4874 || skinCover;
          if (skinImage) {
            skinImage = skinImage.replace('//', '/');
            if (skinImage.startsWith('/')) {
              skinImage = BASE_URL + skinImage;
            }
          }

          return {
            skinName: skin.btpfjs_7484 || 'Unknown',
            skinSeries: skinSeries || '',
            skinCover: skinCover,
            skinImage: skinImage
          };
        });

      totalSkins += heroSkins.length;

      // Build hero data
      const banner = hero.yxtpyy_3086 || hero.yxhdzy_9903 || '';
      const icon = hero.yxtpyy_3086 || hero.yxhdzy_9903 || '';

      output.main[heroName] = {
        title: hero.bt_3883 || '',
        name: heroName,
        heroId: heroId,
        role: hero.jsmc_6327 || 'Unknown',
        region: hero.dymc_4992 || '',
        icon: icon.startsWith('/') ? BASE_URL + icon : icon,
        banner: banner.startsWith('/') ? BASE_URL + banner : banner,
        thumbnail: icon.startsWith('/') ? BASE_URL + icon : icon,
        skins: heroSkins
      };
    }

    console.log(`  ✅ Processed ${heroes.length} heroes`);
    console.log(`  🎨 Total skins: ${totalSkins}`);
    console.log(`  📋 Skins with series: ${skinsWithSeries}\n`);

    // 4. Save output
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'world-skins-only.json');
    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

    console.log(`💾 Saved to: ${outputFile}\n`);
    console.log('✅ Scraping complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

scrapeWorldSkins()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
