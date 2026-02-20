import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const HERO_IDS = [
  105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
  120, 121, 123, 124, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 137,
  139, 140, 141, 142, 146, 148, 149, 150, 152, 153, 154, 155, 156, 157, 159,
  162, 163, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178,
  179, 180, 182, 183, 184, 187, 189, 190, 191, 192, 193, 195, 196, 197, 198,
  199, 501, 502, 503, 504, 505, 506, 507, 508, 510, 513, 514, 517, 519, 521,
  522, 523, 524, 528, 531, 533, 534, 536, 538, 542, 545, 547, 556, 558, 563,
  564, 577, 581, 582, 584, 646
];

async function scrapeAllHeroes() {
  console.log(`🦸 Starting scraper for ${HERO_IDS.length} heroes...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const heroesData = [];

  try {
    let count = 0;

    for (const heroId of HERO_IDS) {
      count++;

      console.log(`[${count}/${HERO_IDS.length}] Scraping hero ${heroId}...`);

      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
      );

      await page.setRequestInterception(true);

      let currentHeroData = null;
      let responseResolver = null;

      page.on('request', (request) => {
        request.continue();
      });

      page.on('response', async (response) => {
        const url = response.url();

        if (url.includes('/api/herowiki/getherodataall')) {
          try {
            const data = await response.json();

            if (data.code === 0 && data.data) {
              currentHeroData = data.data;
              if (responseResolver) {
                responseResolver();
                responseResolver = null;
              }
            }
          } catch (error) {
            // Ignore preflight errors
          }
        }
      });

      const url = `https://camp.honorofkings.com/h5/app/index.html#/hero-detail?heroId=${heroId}`;

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for API response with timeout
        await Promise.race([
          new Promise(resolve => {
            responseResolver = resolve;
          }),
          new Promise(resolve => setTimeout(resolve, 10000))
        ]);

        if (currentHeroData) {
          // Save complete raw data
          const heroInfo = {
            heroId,
            heroName: currentHeroData.baseInfo?.heroInfo?.heroName,
            rawData: currentHeroData
          };

          heroesData.push(heroInfo);
          console.log(`  ✅ ${heroInfo.heroName || 'Unknown'}`);
        } else {
          console.log(`  ⚠️  No data received for hero ${heroId}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } finally {
        await page.close();
      }

      if (count % 10 === 0) {
        console.log(`  💤 Pausing for 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Save data
    console.log('\n💾 Saving data...');

    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'all-heroes-raw.json');
    await fs.writeFile(outputFile, JSON.stringify(heroesData, null, 2));

    console.log(`✅ Complete! Saved ${heroesData.length} heroes to: ${outputFile}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('\n👋 Done!');
  }
}

scrapeAllHeroes().catch(console.error);
