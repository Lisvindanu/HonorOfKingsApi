import puppeteer from 'puppeteer';
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

async function scrapeHeroSkins(browser, heroId, heroName, skinSeriesMap) {
  const page = await browser.newPage();
  try {
    const url = `${BASE_URL}/zlkdatasys/ip/hero/en/${heroId}.html`;
    console.log(`  Scraping ${heroName} (${heroId})...`);

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Extract skin names and images from the page
    const skins = await page.evaluate((baseUrl) => {
      const skins = [];

      // Find all skin text elements (format: "Skin Name — HERONAME")
      const skinTexts = document.querySelectorAll('.dskin-center-text.font-title-cn');

      skinTexts.forEach((textEl) => {
        const fullText = textEl.textContent.trim();
        // Extract skin name (remove "— HERONAME" suffix)
        const skinName = fullText.replace(/\s*—\s*[A-Z\s]+$/, '').trim();

        // Navigate DOM to find image: text -> parent (dskin-text) -> parent (dskin-poster-inner) -> find img
        const textParent = textEl.parentElement; // div.dskin-text
        const container = textParent ? textParent.parentElement : null; // div.dskin-poster-inner
        let imageSrc = '';

        if (container) {
          const imgEl = container.querySelector('img');
          if (imgEl) {
            // Get data-src for lazyload images
            imageSrc = imgEl.getAttribute('data-src') || imgEl.src || '';
            // Fix relative URLs - remove double slashes and prepend base URL
            if (imageSrc.startsWith('/')) {
              imageSrc = imageSrc.replace('//', '/');
              imageSrc = baseUrl + imageSrc;
            }
          }
        }

        if (skinName) {
          skins.push({
            skinName: skinName,
            skinCover: imageSrc,
            skinImage: imageSrc
          });
        }
      });

      return skins;
    }, BASE_URL);

    await page.close();

    // Add series info to skins
    const skinsWithSeries = skins.map(skin => {
      const key = `${heroId}-${skin.skinName}`;
      const series = skinSeriesMap[key] || '';
      return {
        ...skin,
        skinSeries: series
      };
    });

    return skinsWithSeries;
  } catch (error) {
    console.error(`    Error scraping ${heroName}: ${error.message}`);
    await page.close();
    return [];
  }
}

async function scrapeWorldComplete() {
  console.log('🌍 Starting complete world.honorofkings.com scraper with Puppeteer...\n');

  // Fetch hero list
  console.log('📥 Fetching hero list...');
  const heroListData = await fetchJSON(HERO_LIST_URL);
  const heroes = heroListData.yzzyxl_5891;
  console.log(`✅ Found ${heroes.length} heroes\n`);

  // Fetch skin list for series info
  console.log('📥 Fetching skin series data...');
  const skinListData = await fetchJSON(SKIN_LIST_URL);
  const skinSeriesData = skinListData.pflbzt_5151;

  // Create skin name to series lookup map
  const skinSeriesMap = {};
  skinSeriesData.forEach(skin => {
    const skinName = skin.btpfjs_7484;
    const series = skin.pftxmc_8315 || '';
    const heroIds = skin.pfjsgy_4147.split(',');

    heroIds.forEach(heroId => {
      const key = `${heroId}-${skinName}`;
      skinSeriesMap[key] = series;
    });
  });
  console.log(`✅ Loaded ${Object.keys(skinSeriesMap).length} skin-series mappings\n`);

  // Launch browser
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  console.log('📥 Scraping individual hero pages for skins...\n');

  const heroData = {};
  let processedCount = 0;

  // Process heroes in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < heroes.length; i += batchSize) {
    const batch = heroes.slice(i, i + batchSize);
    const batchPromises = batch.map(async (hero) => {
      const heroId = hero.id_6123;
      const heroName = hero.yxpy_5883;

      const skins = await scrapeHeroSkins(browser, heroId, heroName, skinSeriesMap);

      heroData[heroName] = {
        title: hero.ch_1965,
        name: heroName,
        heroId: parseInt(heroId),
        role: hero.zy_2816,
        region: hero.yxqy_2536,
        icon: BASE_URL + hero.yxlbfm_8417,
        banner: BASE_URL + hero.yxlbfm_8938,
        thumbnail: BASE_URL + hero.yxlbfm_2561,
        skins: skins
      };

      processedCount++;
      console.log(`  Progress: ${processedCount}/${heroes.length} heroes`);
    });

    await Promise.all(batchPromises);
  }

  await browser.close();
  console.log('\n✅ Browser closed');

  // Calculate total skins
  const totalSkins = Object.values(heroData).reduce((sum, hero) => sum + hero.skins.length, 0);

  console.log('\n📊 Summary:');
  console.log(`  - Total Heroes: ${Object.keys(heroData).length}`);
  console.log(`  - Total Skins: ${totalSkins}`);
  console.log(`  - Avg Skins per Hero: ${(totalSkins / Object.keys(heroData).length).toFixed(1)}\n`);

  // Save to file
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });

  const formattedData = { main: heroData };
  const apiFile = path.join(outputDir, 'world-complete-api.json');
  await fs.writeFile(apiFile, JSON.stringify(formattedData, null, 2));
  console.log(`💾 Saved to: ${apiFile}`);

  console.log('\n✅ Scraping complete!');
  return formattedData;
}

scrapeWorldComplete()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
