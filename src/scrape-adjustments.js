import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

async function scrapeAdjustments() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.setRequestInterception(true);

  const adjustmentData = [];

  page.on('request', (request) => {
    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('api-camp.honorofkings.com')) {
      try {
        const contentType = response.headers()['content-type'];

        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          console.log('✅ API:', url.split('.com')[1]?.substring(0, 60));

          // Save adjustment related data
          if (url.includes('adjust') || url.includes('hero') || url.includes('season')) {
            adjustmentData.push({
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
    // Visit adjustment detail pages
    const urls = [
      'https://camp.honorofkings.com/h5/app/index.html#/hero-homepage',
      'https://camp.honorofkings.com/h5/app/index.html#/adjustment-detail',
      'https://camp.honorofkings.com/h5/app/index.html#/adjustment-detail?heroId=120',
    ];

    for (const url of urls) {
      console.log();
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      console.log('⏳ Waiting for data to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log();

    // Save data
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'adjustment-data.json');
    await fs.writeFile(outputFile, JSON.stringify(adjustmentData, null, 2));

    console.log('✅ Data saved to:', outputFile);

    // Print summary
    for (const call of adjustmentData) {
      console.log();
      if (call.data?.data) {
        console.log();
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n👋 Done!');
  }
}

scrapeAdjustments().catch(console.error);
