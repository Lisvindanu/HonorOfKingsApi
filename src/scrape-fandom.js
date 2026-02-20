import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const FANDOM_BASE = 'https://honor-of-kings.fandom.com';
const WORLD_API = 'https://world.honorofkings.com/zlkdatasys/yuzhouzhan/list/heroList-en.json';

async function getWorldHeroes() {
  console.log('📥 Fetching hero list from world API...');
  const response = await fetch(WORLD_API);
  const data = await response.json();
  const heroes = data.yzzyxl_5891;

  console.log(`  ✅ Found ${heroes.length} heroes\n`);

  return heroes
    .filter(h => h.yxpy_5883 || h.mz_6951) // Filter out undefined names
    .map(h => {
      const name = h.yxpy_5883 || h.mz_6951;
      return {
        heroId: parseInt(h.id_6123),
        name: name,
        nameUpper: name.toUpperCase()
      };
    });
}

async function scrapeHeroSkins(page, heroName) {
  try {
    // Convert hero name for URL (title case, spaces to underscores)
    const heroUrl = heroName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('_');
    const fullUrl = `${FANDOM_BASE}/wiki/${heroUrl}`;

    console.log(`  Scraping ${heroName} (URL: ${heroUrl})...`);

    await page.goto(fullUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await page.evaluate(() => {
      const skinData = [];
      const debug = {
        figcaptionCount: 0,
        sampleCaptions: [],
        imageCount: 0,
        sampleAlts: [],
        hasSkinsSection: false
      };

      // Check if Skins section exists
      const skinsSection = document.querySelector('#Skins');
      debug.hasSkinsSection = !!skinsSection;

      // Find all images
      const allImages = document.querySelectorAll('img');
      debug.imageCount = allImages.length;

      // Sample image alt texts
      allImages.forEach((img, idx) => {
        if (idx < 5) {
          debug.sampleAlts.push(img.alt || 'no-alt');
        }
      });

      // Find all figcaption elements (skin names)
      const captions = document.querySelectorAll('figcaption');
      debug.figcaptionCount = captions.length;

      captions.forEach((caption, idx) => {
        const skinName = caption.textContent.trim();

        if (idx < 3) {
          debug.sampleCaptions.push(skinName);
        }

        // Try multiple methods to find the associated image
        // Method 1: sibling image
        let img = caption.previousElementSibling;
        if (img && img.tagName !== 'IMG') {
          img = caption.parentElement?.querySelector('img');
        }

        // Method 2: parent figure/div -> img
        if (!img) {
          const parent = caption.parentElement;
          img = parent?.querySelector('img');
        }

        // Method 3: closest link -> img
        if (!img) {
          const link = caption.closest('a') || caption.parentElement?.querySelector('a');
          img = link?.querySelector('img');
        }

        if (img && skinName) {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || '';

          // Get highest quality image
          let imageUrl = src;
          if (imageUrl.includes('/scale-to-width-down/')) {
            imageUrl = imageUrl.replace(/\/scale-to-width-down\/\d+/, '');
          }
          if (imageUrl.includes('/revision/')) {
            imageUrl = imageUrl.split('/revision/')[0];
          }

          skinData.push({
            skinName: skinName,
            skinCover: imageUrl,
            skinImage: imageUrl,
            skinSeries: '',
            skinTier: ''
          });
        }
      });

      // Deduplicate by name
      const unique = [];
      const seen = new Set();
      skinData.forEach(skin => {
        if (!seen.has(skin.skinName)) {
          seen.add(skin.skinName);
          unique.push(skin);
        }
      });

      return { skins: unique, debug };
    });

    console.log(`    DEBUG:`);
    console.log(`      - Skins section exists: ${result.debug.hasSkinsSection}`);
    console.log(`      - Total images: ${result.debug.imageCount}`);
    console.log(`      - Sample alts: ${result.debug.sampleAlts.join(', ')}`);
    console.log(`      - Figcaptions: ${result.debug.figcaptionCount}`);
    console.log(`    ✅ Found ${result.skins.length} skins`);
    return result.skins;

  } catch (error) {
    console.error(`    ❌ Error scraping ${heroName}: ${error.message}`);
    return [];
  }
}

async function scrapeFandom() {
  console.log('🎮 Starting Fandom wiki scraper (using World API hero list)...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();

    // Set realistic user agent and headers
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    // Get heroes from world API
    const heroes = await getWorldHeroes();

    // Test with Marco Polo first
    console.log(`📝 Testing with Marco Polo:\n`);

    const marcoPolo = heroes.find(h => h.name.toUpperCase().includes('MARCO'));
    if (marcoPolo) {
      console.log(`  Found hero: ${marcoPolo.name} (ID: ${marcoPolo.heroId})\n`);
      const skins = await scrapeHeroSkins(page, marcoPolo.name);
      console.log(`\n  Skins found for Marco Polo:`);
      skins.forEach((s, i) => console.log(`    ${i + 1}. ${s.skinName}`));
    } else {
      console.log(`  Marco Polo not found in heroes list!`);
      console.log(`  Sample heroes: ${heroes.slice(0, 5).map(h => h.name).join(', ')}`);
    }

    console.log(`\n✅ Test complete!`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

scrapeFandom()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
