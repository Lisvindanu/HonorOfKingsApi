import puppeteer from 'puppeteer';

const urls = [
  'https://camp.honorofkings.com/',
  'https://world.honorofkings.com/',
  'https://world.honorofkings.com/herodetail/142',
];

async function findAPIs() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const apiCalls = new Set();

  for (const url of urls) {
    console.log(`\n=== Checking: ${url} ===`);
    const page = await browser.newPage();

    // Intercept network requests
    page.on('request', request => {
      const reqUrl = request.url();
      if (reqUrl.includes('api') || reqUrl.includes('equip') || reqUrl.includes('arcana') || reqUrl.includes('rune') || reqUrl.includes('item')) {
        apiCalls.add(reqUrl);
        console.log('📡 API:', reqUrl.substring(0, 150));
      }
    });

    page.on('response', async response => {
      const respUrl = response.url();
      if (respUrl.includes('.json') || response.headers()['content-type']?.includes('application/json')) {
        if (!respUrl.includes('gtag') && !respUrl.includes('analytics')) {
          console.log('📥 JSON:', respUrl.substring(0, 150));
        }
      }
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('Error:', e.message);
    }

    await page.close();
  }

  console.log('\n=== All API calls found ===');
  apiCalls.forEach(api => console.log(api));

  await browser.close();
}

findAPIs().catch(console.error);
