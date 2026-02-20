import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

async function getAllHeroes() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
  );

  await page.setRequestInterception(true);

  const apiCalls = [];

  page.on('request', (request) => {
    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('api-camp.honorofkings.com') ||
        url.includes('/api/')) {
      try {
        const contentType = response.headers()['content-type'];

        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();

          console.log('✅ API:', response.request().method(), url.split('/api/')[1]);

          // Save API calls that might contain hero lists
          if (url.includes('hero') || url.includes('list')) {
            apiCalls.push({
              url,
              method: response.request().method(),
              status: response.status(),
              data
            });
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  });

  try {
    // Try different potential hero list pages
    const urls = [
      'https://camp.honorofkings.com/h5/app/index.html#/hero-detail',
      'https://camp.honorofkings.com/h5/app/index.html#/hero-hot-list',
    ];

    for (const url of urls) {
      console.log(`\n🌐 Visiting: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      console.log('⏳ Waiting for data to load...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Try to scroll to trigger lazy loading
      console.log('📜 Scrolling to load more content...');
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n📊 Total API calls captured: ${apiCalls.length}`);

    // Save all API calls
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'all-heroes-api.json');
    await fs.writeFile(outputFile, JSON.stringify(apiCalls, null, 2));

    console.log('✅ Data saved to:', outputFile);

    // Try to find hero list in responses
    for (const call of apiCalls) {
      if (call.data && call.data.data) {
        const dataKeys = Object.keys(call.data.data);
        console.log(`\n📋 Endpoint: ${call.url.split('/api/')[1]}`);
        console.log(`   Keys: ${dataKeys.join(', ')}`);

        // Check if it contains hero array
        if (call.data.data.heroList || call.data.data.list) {
          const heroList = call.data.data.heroList || call.data.data.list;
          if (Array.isArray(heroList)) {
            console.log(`   ⭐ Found ${heroList.length} items in array!`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n👋 Done!');
  }
}

getAllHeroes().catch(console.error);
