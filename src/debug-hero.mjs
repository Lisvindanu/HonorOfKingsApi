import puppeteer from 'puppeteer';

const heroId = process.argv[2] || 582;

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  
  page.on('request', r => r.continue());
  page.on('response', async (response) => {
    if (response.url().includes('/api/herowiki/getherodataall')) {
      try {
        const data = await response.json();
        console.log('\n=== API Response Structure ===');
        console.log(JSON.stringify(data, null, 2).slice(0, 3000));
      } catch (e) {}
    }
  });
  
  await page.goto(`https://camp.honorofkings.com/h5/app/index.html#/hero-detail?heroId=${heroId}`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

main();
