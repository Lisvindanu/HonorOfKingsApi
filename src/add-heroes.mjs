import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const heroIds = process.argv.slice(2).map(Number);

if (heroIds.length === 0) {
  console.log('Usage: node src/add-heroes.mjs <heroId1> <heroId2> ...');
  process.exit(1);
}

async function scrapeHero(browser, heroId) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  
  let heroData = null;
  let resolver = null;
  
  page.on('request', r => r.continue());
  page.on('response', async (response) => {
    if (response.url().includes('/api/herowiki/getherodataall')) {
      try {
        const data = await response.json();
        if (data.code === 0 && data.data) {
          heroData = data.data;
          if (resolver) resolver();
        }
      } catch (e) {}
    }
  });
  
  await page.goto(
    `https://camp.honorofkings.com/h5/app/index.html#/hero-detail?heroId=${heroId}`,
    { waitUntil: 'networkidle2', timeout: 30000 }
  );
  
  await Promise.race([
    new Promise(r => { resolver = r; }),
    new Promise(r => setTimeout(r, 10000))
  ]);
  
  await page.close();
  return heroData;
}

function transformHero(data) {
  const info = data.baseInfo?.heroInfo || {};
  const display = data.baseInfo?.displayData || {};
  const heroData = data.heroData?.baseData || {};
  const skills = data.strategyData?.skill?.[0]?.skillList || [];
  const arcana = data.strategyData?.recommendRune?.runeDetail || [];
  const equip = data.strategyData?.recommendEquipment?.equipList || [];
  
  return {
    title: info.heroName,
    name: info.heroName,
    heroId: info.heroId,
    role: info.mainJobName || 'Unknown',
    lane: info.recommendRoadName || 'Unknown',
    icon: info.icon,
    banner: display.heroCover || info.icon,
    thumbnail: display.heroCoverHz || info.icon,
    skins: [],
    skill: skills.map(s => ({
      skillName: s.skillName,
      cooldown: [s.skillCd ? s.skillCd / 1000 : 0],
      cost: [s.skillCostList?.skillCost || 0],
      skillDesc: s.skillDesc?.replace(/<[^>]+>/g, ''),
      skillImg: s.skillIcon
    })),
    arcana: arcana.map(r => ({
      id: r.runeId,
      name: r.runeName,
      icon: r.runeIcon,
      description: r.runeDesc
    })),
    recommendedEquipment: equip.map(e => ({
      id: e.equipId,
      name: e.equipName,
      icon: e.equipIcon,
      description: e.equipDesc
    })),
    buildTitle: 'Recommended',
    survivalPercentage: '0%',
    attackPercentage: '0%',
    abilityPercentage: '0%',
    difficultyPercentage: '0%',
    bestPartners: {},
    suppressingHeroes: {},
    suppressedHeroes: {},
    stats: {
      winRate: heroData.winRate || '0%',
      pickRate: heroData.matchRate || '0%',
      banRate: heroData.banRate || '0%',
      tier: heroData.hot || 'C'
    },
    world: { region: 'Unknown', identity: '', energy: '' }
  };
}

async function main() {
  console.log(`Adding ${heroIds.length} hero(es): ${heroIds.join(', ')}\n`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const outputPath = path.join(process.cwd(), 'output', 'merged-api.json');
  let existingData = { main: {} };
  
  try {
    existingData = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    console.log(`Loaded: ${Object.keys(existingData.main).length} heroes`);
  } catch (e) {
    console.log('Starting fresh');
  }
  
  // Remove undefined entries
  delete existingData.main['undefined'];
  
  for (const heroId of heroIds) {
    console.log(`Fetching hero ${heroId}...`);
    const data = await scrapeHero(browser, heroId);
    
    if (data && data.baseInfo?.heroInfo?.heroName) {
      const hero = transformHero(data);
      existingData.main[hero.name] = hero;
      console.log(`  ✅ ${hero.name}`);
    } else {
      console.log(`  ❌ Hero ${heroId} not found`);
    }
  }
  
  await browser.close();
  await fs.writeFile(outputPath, JSON.stringify(existingData, null, 2));
  console.log(`\n✅ Saved! Total: ${Object.keys(existingData.main).length} heroes`);
}

main().catch(console.error);
