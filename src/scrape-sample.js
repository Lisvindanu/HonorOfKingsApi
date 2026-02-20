import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

// Sample 2 heroes only for testing
const SAMPLE_HERO_IDS = [106, 521]; // Xiao Qiao and Haya

async function scrapeSampleHeroes() {
  console.log(`🦸 Scraping ${SAMPLE_HERO_IDS.length} sample heroes...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const heroesData = [];

  try {
    let count = 0;

    for (const heroId of SAMPLE_HERO_IDS) {
      count++;

      console.log(`[${count}/${SAMPLE_HERO_IDS.length}] Scraping hero ${heroId}...`);

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
          const heroInfo = {
            heroId,
            ...currentHeroData.baseInfo?.heroInfo,
            displayData: currentHeroData.baseInfo?.displayData,
            stats: currentHeroData.heroData?.baseData,
            skills: currentHeroData.heroData?.skillData,
            relationships: currentHeroData.heroData?.relationData,
            skins: currentHeroData.heroData?.skinData,
            equipment: currentHeroData.strategyData?.equipData,
            world: currentHeroData.worldData,
            rawData: currentHeroData // Keep raw data for analysis
          };

          heroesData.push(heroInfo);
          console.log(`  ✅ ${heroInfo.heroName || 'Unknown'} - ${heroInfo.mainJobName || 'N/A'}`);
        } else {
          console.log(`  ⚠️  No data received for hero ${heroId}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } finally {
        await page.close();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save data
    console.log('\n💾 Saving sample data...');

    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'sample-heroes.json');
    await fs.writeFile(outputFile, JSON.stringify(heroesData, null, 2));

    console.log(`✅ Sample saved! ${heroesData.length} heroes to: ${outputFile}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('\n👋 Done!');
  }
}

scrapeSampleHeroes().catch(console.error);
