import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://world.honorofkings.com';
const HERO_LIST_URL = `${BASE_URL}/zlkdatasys/yuzhouzhan/list/heroList-en.json`;
const SKIN_LIST_URL = `${BASE_URL}/zlkdatasys/yuzhouzhan/en/pfjs.json`;

async function fetchJSON(url) {
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function scrapeWorldHoK() {
  console.log('🌍 Starting world.honorofkings.com scraper...\n');

  // Fetch hero list
  console.log('📥 Fetching hero list...');
  const heroListData = await fetchJSON(HERO_LIST_URL);
  const heroes = heroListData.yzzyxl_5891;
  console.log(`✅ Found ${heroes.length} heroes\n`);

  // Fetch skin list
  console.log('📥 Fetching skin list...');
  const skinListData = await fetchJSON(SKIN_LIST_URL);
  const skins = skinListData.pflbzt_5151;
  console.log(`✅ Found ${skins.length} skin series\n`);

  // Create hero lookup map
  const heroMap = {};
  heroes.forEach(hero => {
    heroMap[hero.id_6123] = {
      id: hero.id_6123,
      name: hero.mz_6951,
      nameEN: hero.yxpy_5883,
      role: hero.zy_2816,
      title: hero.ch_1965,
      region: hero.yxqy_2536,
      icon: BASE_URL + hero.yxlbfm_8417,
      banner: BASE_URL + hero.yxlbfm_8938,
      thumbnail: BASE_URL + hero.yxlbfm_2561,
      skins: []
    };
  });

  // Map skins to heroes
  skins.forEach(skin => {
    const heroIds = skin.pfjsgy_4147.split(',');
    
    heroIds.forEach(heroId => {
      if (heroMap[heroId]) {
        heroMap[heroId].skins.push({
          name: skin.btpfjs_7484,
          heroName: skin.pfjstc_2455,
          series: skin.pftxmc_8315 || '',
          cover: BASE_URL + skin.pfjspc_4348,
          image1: skin.pfjsyd_1886 ? BASE_URL + skin.pfjsyd_1886 : '',
          image2: skin.yddsbf_5441 ? BASE_URL + skin.yddsbf_5441 : '',
          link: skin.ljpfjs_1879
        });
      }
    });
  });

  // Calculate total skins
  const totalSkins = Object.values(heroMap).reduce((sum, hero) => sum + hero.skins.length, 0);
  
  console.log('📊 Summary:');
  console.log(`  - Total Heroes: ${Object.keys(heroMap).length}`);
  console.log(`  - Total Skins: ${totalSkins}`);
  console.log(`  - Avg Skins per Hero: ${(totalSkins / Object.keys(heroMap).length).toFixed(1)}\n`);

  // Save to file
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, 'world-heroes-data.json');
  await fs.writeFile(outputFile, JSON.stringify({ heroes: heroMap }, null, 2));
  console.log(`💾 Saved to: ${outputFile}`);

  // Create formatted API response
  const formattedData = {
    main: {}
  };

  Object.values(heroMap).forEach(hero => {
    formattedData.main[hero.name] = {
      title: hero.title,
      name: hero.name,
      heroId: parseInt(hero.id),
      role: hero.role,
      region: hero.region,
      icon: hero.icon,
      banner: hero.banner,
      thumbnail: hero.thumbnail,
      skins: hero.skins.map(skin => ({
        skinName: skin.name,
        skinCover: skin.cover,
        skinImage: skin.image1,
        skinImage2: skin.image2,
        skinSeries: skin.series,
        skinLink: skin.link
      }))
    };
  });

  const apiFile = path.join(outputDir, 'world-api.json');
  await fs.writeFile(apiFile, JSON.stringify(formattedData, null, 2));
  console.log(`💾 API format saved to: ${apiFile}`);

  console.log('\n✅ Scraping complete!');
  return formattedData;
}

scrapeWorldHoK()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
