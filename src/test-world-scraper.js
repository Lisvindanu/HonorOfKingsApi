import puppeteer from 'puppeteer';

async function testWorldScraper() {
  console.log('🧪 Testing world.honorofkings.com scraper...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
  );

  // Track all network requests
  const requests = [];
  const responses = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('cms') || url.includes('json') || url.includes('api')) {
      requests.push({
        url,
        method: request.method()
      });
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('cms') || url.includes('json') || url.includes('api')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          responses.push({
            url,
            status: response.status(),
            data: data
          });
          console.log('📦 JSON Response:', url);
        }
      } catch (e) {
        // Not JSON
      }
    }
  });

  console.log('🌐 Loading skin page...');
  await page.goto('https://world.honorofkings.com/ipworld/en/skin.html', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait for data to load
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n📊 Captured Requests:');
  requests.forEach(req => console.log(req.method, req.url));

  console.log('\n📦 Captured JSON Responses:');
  responses.forEach((res, idx) => {
    console.log(`\n[${idx + 1}] ${res.url}`);
    console.log('Status:', res.status);
    console.log('Data keys:', Object.keys(res.data).join(', '));
  });

  // Save responses to file
  await browser.close();

  return responses;
}

testWorldScraper()
  .then(data => {
    console.log(`\n✅ Test complete! Found ${data.length} JSON responses`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
