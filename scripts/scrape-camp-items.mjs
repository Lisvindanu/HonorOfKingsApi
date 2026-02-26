import puppeteer from 'puppeteer';
import fs from 'fs';

// Connect to existing Chrome with remote debugging
// Run Chrome with: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

async function scrapeItems() {
  console.log('Connecting to Chrome...');

  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('camp.honorofkings.com'));

  if (!page) {
    console.log('Opening camp page...');
    page = await browser.newPage();
    await page.goto('https://camp.honorofkings.com/studio#/contribute/suit-edit?heroId=564&heroName=Mayene&index=0', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
  }

  console.log('Current URL:', page.url());
  await page.waitForTimeout(3000);

  // Equipment categories
  const equipCategories = ['Attack', 'Magical', 'Defense', 'Boots', 'Jungling', 'Roaming'];
  const allItems = {};

  // Make sure Equipment tab is selected
  await page.click('text=Equipment').catch(() => {});
  await page.waitForTimeout(1000);

  for (const category of equipCategories) {
    console.log(`\nScraping ${category} items...`);

    // Click category
    const categoryBtn = await page.$(`text=${category}`);
    if (categoryBtn) {
      await categoryBtn.click();
      await page.waitForTimeout(1500);
    }

    // Get items
    const items = await page.evaluate(() => {
      const itemElements = document.querySelectorAll('.item-card, .equip-item, [class*="item"]');
      const results = [];

      itemElements.forEach(el => {
        const name = el.querySelector('.name, .item-name, [class*="name"]')?.textContent?.trim();
        const desc = el.querySelector('.desc, .description, [class*="desc"]')?.textContent?.trim();
        const icon = el.querySelector('img')?.src;

        if (name) {
          results.push({ name, desc, icon });
        }
      });

      return results;
    });

    allItems[category] = items;
    console.log(`Found ${items.length} items in ${category}`);
  }

  // Scrape Arcana
  console.log('\n\nScraping Arcana...');
  await page.click('text=Arcana').catch(() => {});
  await page.waitForTimeout(2000);

  const arcana = await page.evaluate(() => {
    const results = [];
    const arcanaElements = document.querySelectorAll('.arcana-item, .rune-item, [class*="arcana"], [class*="rune"]');

    arcanaElements.forEach(el => {
      const name = el.querySelector('.name, [class*="name"]')?.textContent?.trim();
      const desc = el.querySelector('.desc, [class*="desc"]')?.textContent?.trim();
      const icon = el.querySelector('img')?.src;
      const level = el.querySelector('.level, [class*="level"]')?.textContent?.trim();

      if (name) {
        results.push({ name, desc, icon, level });
      }
    });

    return results;
  });

  console.log(`Found ${arcana.length} arcana`);

  // Save data
  const data = {
    equipment: allItems,
    arcana: arcana,
    scrapedAt: new Date().toISOString()
  };

  fs.writeFileSync('output/camp-items-arcana.json', JSON.stringify(data, null, 2));
  console.log('\n✅ Saved to output/camp-items-arcana.json');

  // Don't close browser since we connected to existing
  browser.disconnect();
}

scrapeItems().catch(err => {
  console.error('Error:', err.message);
  console.log('\nMake sure Chrome is running with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
});
