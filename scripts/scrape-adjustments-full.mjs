import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../output');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function scrapeAdjustmentsFull() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // ── Load existing hero detail cache (incremental scraping) ────────────────
  const HERO_CACHE_FILE = path.join(OUTPUT_DIR, 'hero-detail-cache.json');
  let heroDetailMap = {}; // heroId -> { heroInfo, adjustInfo[] }
  try {
    const cache = JSON.parse(await fs.readFile(HERO_CACHE_FILE, 'utf-8'));
    heroDetailMap = cache;
    console.log(`  📦 Loaded cache: ${Object.keys(heroDetailMap).length} heroes already captured`);
  } catch {
    console.log('  📦 No cache found, starting fresh');
  }

  let currentSeasonList = null; // from adjustforseason
  let heroList = [];           // from getallherobriefinfo

  await page.setRequestInterception(true);
  page.on('request', req => req.continue());

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('api-camp.honorofkings.com')) return;
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('application/json')) return;
      const json = await response.json();
      if (!json || json.code !== 0) return;
      const d = json.data;

      // adjustforseason → current season hero list
      if (url.includes('adjustforseason') && d?.adjustList) {
        currentSeasonList = d;
        console.log(`  📡 adjustforseason: S${d.seasonId} (${d.seasonName}), ${d.adjustList.length} heroes`);
      }

      // getallherobriefinfo → all heroes
      if (url.includes('getallherobriefinfo') && Array.isArray(d?.heroList)) {
        heroList = d.heroList;
        console.log(`  📡 heroList: ${heroList.length} heroes`);
      }

      // adjustheroinfo → per-hero multi-season data
      if (url.includes('adjustheroinfo') && d?.heroInfo) {
        const heroId = d.heroInfo.heroId;
        heroDetailMap[heroId] = {
          heroInfo: d.heroInfo,
          adjustInfo: d.adjustInfo || [],
        };
        const seasons = (d.adjustInfo || []).map(a => a.seasonName).join(', ');
        process.stdout.write(`  ✅ ${d.heroInfo.heroName} [${seasons}]\n`);
      }
    } catch {}
  });

  // ── Step 1: Load page ─────────────────────────────────────────────────────
  console.log('\n📋 Step 1: Loading adjustment page...');
  await page.goto('https://camp.honorofkings.com/h5/app/index.html#/adjustment-detail', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  await sleep(5000);

  if (!currentSeasonList) {
    console.log('  ❌ Could not get adjustforseason data. Exiting.');
    await browser.close();
    return;
  }

  const currentSeasonId = String(currentSeasonList.seasonId);
  const currentSeasonName = currentSeasonList.seasonName;
  console.log(`  ✅ Current season: ${currentSeasonName} (${currentSeasonId})`);
  console.log(`  ✅ Heroes in current season: ${currentSeasonList.adjustList.length}`);

  // ── Step 2: Click each hero card to get adjustheroinfo ────────────────────
  console.log('\n📋 Step 2: Getting hero details (clicking each card)...');

  // Query all cards ONCE (don't re-query in loop to avoid stale references)
  const allCards = await page.$$('.hero-card');
  const totalCards = allCards.length;
  console.log(`  Found ${totalCards} hero cards`);

  // Build a set of cached hero names for skip check
  const cachedNames = new Set(Object.values(heroDetailMap).map(d => d.heroInfo?.heroName));
  let newCaptures = 0;
  let skipped = 0;

  for (let i = 0; i < totalCards; i++) {
    try {
      const card = allCards[i];
      const heroName = await card.$eval('.title', el => el.textContent?.trim()).catch(() => `hero-${i}`);

      // Skip if already cached
      if (cachedNames.has(heroName)) {
        skipped++;
        process.stdout.write(`  [${i + 1}/${totalCards}] ⏭ ${heroName} (cached)\r`);
        continue;
      }

      // Scroll card into view within its container
      await page.evaluate((el) => el.scrollIntoView({ block: 'nearest', inline: 'center' }), card);
      await sleep(200);

      // Count responses before this click
      const countBefore = Object.keys(heroDetailMap).length;
      await card.click();
      await sleep(3000); // wait for API response
      const countAfter = Object.keys(heroDetailMap).length;

      if (countAfter > countBefore) {
        newCaptures++;
        const newHero = Object.values(heroDetailMap).find(d => !cachedNames.has(d.heroInfo?.heroName));
        const newName = Object.values(heroDetailMap)
          .map(d => d.heroInfo?.heroName)
          .find(n => !cachedNames.has(n)) || heroName;
        cachedNames.add(newName);
        process.stdout.write(`\n  [${i + 1}/${totalCards}] ✅ ${heroName}`);
      } else {
        process.stdout.write(`  [${i + 1}/${totalCards}] ${heroName}\r`);
      }
    } catch (e) {
      process.stdout.write(`  [${i + 1}] err: ${e.message?.substring(0, 30)}\n`);
    }
  }

  // Save cache for next run
  await fs.writeFile(HERO_CACHE_FILE, JSON.stringify(heroDetailMap, null, 2));
  console.log(`\n  ✅ New captures: ${newCaptures} | Skipped (cached): ${skipped} | Total: ${Object.keys(heroDetailMap).length} heroes`);

  // ── Step 3: Build season data ─────────────────────────────────────────────
  console.log('\n📋 Step 3: Building multi-season dataset...');

  // seasonMap: seasonId -> { seasonName, heroMap: { heroId -> hero } }
  const seasonMap = {};

  function buildHeroEntry(heroInfo, content, adj) {
    const tag = content.contentTag || {};
    const attributes = content.attribute || [];
    const skillChanges = attributes
      .filter(a => a.heroSkillInfo || a.title)
      .map(a => ({
        skillName: a.heroSkillInfo?.skillName || a.title || '',
        skillIcon: a.heroSkillInfo?.skillIcon || '',
        skillIndex: a.type,
        title: a.title || a.heroSkillInfo?.skillName || '',
        description: a.attributeDesc || '',
      }));
    return {
      heroId: heroInfo.heroId,
      heroName: heroInfo.heroName,
      heroIcon: heroInfo.icon,
      shortDesc: content.shortDesc || '',
      type: tag.text || 'Changes',
      tagEnum: tag.tagEnum,
      tagColor: tag.fontColorH5 || '#888',
      tagBgColor: tag.bgColorH5 || 'rgba(136,136,136,0.15)',
      isCurrent: adj?.isCurrent || false,
      versionName: adj?.versionName || '',
      versionPublishTime: adj?.versionPublishTime || '',
      stats: {
        winRate: heroInfo.winningProbability,
        pickRate: heroInfo.appearanceRate,
        banRate: heroInfo.banRote,
      },
      skillChanges,
    };
  }

  // 3a. Seed current season from adjustforseason adjustList (basic data, no skill details)
  const csId = currentSeasonId;
  const csName = currentSeasonName;
  seasonMap[csId] = { seasonId: csId, seasonName: csName, heroMap: {} };

  for (const item of currentSeasonList.adjustList) {
    const heroInfo = item.heroInfo || {};
    if (!heroInfo.heroId) continue;
    const content = {
      shortDesc: item.shortDesc || item.desc || '',
      contentTag: item.contentTag || {},
      attribute: [],
    };
    seasonMap[csId].heroMap[heroInfo.heroId] = buildHeroEntry(heroInfo, content, null);
  }
  console.log(`  Seeded S${csId} with ${Object.keys(seasonMap[csId].heroMap).length} heroes from adjustforseason`);

  // 3b. Enrich from heroDetailMap (adjustheroinfo - has skill details + historical seasons)
  for (const [heroId, detail] of Object.entries(heroDetailMap)) {
    const { heroInfo, adjustInfo } = detail;

    for (const adj of adjustInfo) {
      const sId = String(adj.seasonId);
      const sName = adj.seasonName;

      if (!seasonMap[sId]) {
        seasonMap[sId] = { seasonId: sId, seasonName: sName, heroMap: {} };
      }

      const content = adj.adjustContent || {};
      const entry = buildHeroEntry(heroInfo, content, adj);

      // For current season: override basic entry with detailed one (has skillChanges)
      // For other seasons: add new entry
      const existing = seasonMap[sId].heroMap[heroInfo.heroId];
      if (!existing || entry.skillChanges.length > 0) {
        seasonMap[sId].heroMap[heroInfo.heroId] = entry;
      }
    }
  }

  // 3c. Extract current season version info from any captured hero
  let currentVersionName = '';
  let currentVersionPublishTime = '';
  for (const detail of Object.values(heroDetailMap)) {
    const csAdj = detail.adjustInfo.find(a => String(a.seasonId) === csId && a.isCurrent);
    if (csAdj?.versionName) {
      currentVersionName = csAdj.versionName;
      currentVersionPublishTime = csAdj.versionPublishTime || '';
      break;
    }
  }
  console.log(`  Current version: ${currentVersionName}`);

  // 3d. Fix fallback heroes: set isCurrent=true, fill version info
  if (seasonMap[csId]) {
    for (const heroId of Object.keys(seasonMap[csId].heroMap)) {
      const hero = seasonMap[csId].heroMap[heroId];
      if (!hero.isCurrent) {
        hero.isCurrent = true;
        hero.versionName = currentVersionName;
        hero.versionPublishTime = currentVersionPublishTime;
      }
    }
  }

  // 3e. Convert heroMaps to sorted arrays
  const sortedSeasonIds = Object.keys(seasonMap).sort((a, b) => Number(b) - Number(a));
  const finalSeasonMap = {};
  for (const sId of sortedSeasonIds) {
    const heroes = Object.values(seasonMap[sId].heroMap)
      .sort((a, b) => a.heroName.localeCompare(b.heroName));
    finalSeasonMap[sId] = { seasonId: sId, seasonName: seasonMap[sId].seasonName, heroes };
  }

  // ── Step 4: Output ────────────────────────────────────────────────────────
  console.log('\n📋 Step 4: Saving output...');

  // Latest season = current
  const latestSeason = finalSeasonMap[currentSeasonId] || finalSeasonMap[sortedSeasonIds[0]];

  // API-compatible format (matches existing adjustments.json schema)
  const adjustmentsOutput = {
    scrapedAt: new Date().toISOString(),
    season: {
      id: latestSeason?.seasonId || currentSeasonId,
      name: latestSeason?.seasonName || currentSeasonName,
    },
    adjustments: latestSeason?.heroes || [],
    heroList,
  };

  // Full multi-season format
  const adjustmentsFullOutput = {
    scrapedAt: new Date().toISOString(),
    currentSeason: {
      id: currentSeasonId,
      name: currentSeasonName,
    },
    season: adjustmentsOutput.season,
    adjustments: adjustmentsOutput.adjustments,
    heroList,
    allSeasons: sortedSeasonIds.reduce((acc, sId) => {
      acc[sId] = {
        season: { id: sId, name: finalSeasonMap[sId].seasonName },
        adjustments: finalSeasonMap[sId].heroes,
        heroCount: finalSeasonMap[sId].heroes.length,
      };
      return acc;
    }, {}),
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'adjustments.json'),
    JSON.stringify(adjustmentsOutput, null, 2)
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'adjustments-full.json'),
    JSON.stringify(adjustmentsFullOutput, null, 2)
  );

  console.log('\n✅ Saved:');
  console.log('  output/adjustments.json       (current season, API-compatible)');
  console.log('  output/adjustments-full.json  (all seasons)');
  console.log('\n📊 Season summary:');
  for (const sId of sortedSeasonIds) {
    const marker = sId === currentSeasonId ? ' ← current' : '';
    console.log(`  ${finalSeasonMap[sId].seasonName}: ${finalSeasonMap[sId].heroes.length} hero adjustments${marker}`);
  }

  await browser.close();
  console.log('\n👋 Done!');
}

scrapeAdjustmentsFull().catch(console.error);
