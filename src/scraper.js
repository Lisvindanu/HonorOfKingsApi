import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

class HeroScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.apiCalls = [];
    this.heroData = null;
  }

  async init() {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();

    // Set user agent to mimic real browser
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
    );

    // Enable request interception
    await this.page.setRequestInterception(true);

    // Intercept and log all API requests
    this.page.on('request', (request) => {
      const url = request.url();

      // Log API calls
      if (url.includes('api-camp.honorofkings.com') ||
          url.includes('/api/')) {
        console.log('📡 API Request:', request.method(), url);
      }

      request.continue();
    });

    // Intercept and capture API responses
    this.page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      // Capture API responses
      if (url.includes('api-camp.honorofkings.com') ||
          (url.includes('/api/') && url.includes('hero'))) {
        try {
          const contentType = response.headers()['content-type'];

          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            console.log('✅ API Response:', status, url);
            console.log('📦 Data preview:', JSON.stringify(data).substring(0, 200) + '...');

            this.apiCalls.push({
              url,
              method: response.request().method(),
              status,
              data
            });
          }
        } catch (error) {
          console.log('⚠️  Failed to parse response:', url, error.message);
        }
      }
    });
  }

  async scrapeHeroList() {
    console.log('\n📋 Scraping hero list from homepage...');

    const url = 'https://camp.honorofkings.com/h5/app/index.html#/hero-homepage';
    console.log('🌐 Navigating to:', url);

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('⏳ Waiting for content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to extract hero data from the page
    const heroesFromDOM = await this.page.evaluate(() => {
      const heroes = [];

      // Try to find hero elements in the DOM
      const heroElements = document.querySelectorAll('[class*="hero"]');

      heroElements.forEach(el => {
        const heroId = el.getAttribute('data-hero-id') ||
                      el.getAttribute('heroId') ||
                      el.querySelector('[data-hero-id]')?.getAttribute('data-hero-id');

        const heroName = el.querySelector('[class*="name"]')?.textContent?.trim() ||
                        el.querySelector('[class*="hero-name"]')?.textContent?.trim();

        if (heroId || heroName) {
          heroes.push({ heroId, heroName, element: el.className });
        }
      });

      return heroes;
    });

    if (heroesFromDOM.length > 0) {
      console.log(`✅ Found ${heroesFromDOM.length} heroes in DOM`);
      console.log('Sample:', heroesFromDOM.slice(0, 3));
    }

    return heroesFromDOM;
  }

  async scrapeHeroDetail(heroId) {
    console.log(`\n🦸 Scraping hero detail for ID: ${heroId}...`);

    const url = `https://camp.honorofkings.com/h5/app/index.html#/hero-detail?heroId=${heroId}`;
    console.log('🌐 Navigating to:', url);

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('⏳ Waiting for content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract hero details from page
    const heroDetail = await this.page.evaluate(() => {
      const data = {
        name: document.querySelector('[class*="hero-name"]')?.textContent?.trim(),
        title: document.querySelector('[class*="hero-title"]')?.textContent?.trim(),
        role: document.querySelector('[class*="role"]')?.textContent?.trim(),
        skills: [],
        stats: {}
      };

      // Try to find skills
      const skillElements = document.querySelectorAll('[class*="skill"]');
      skillElements.forEach(skill => {
        const skillName = skill.querySelector('[class*="name"]')?.textContent?.trim();
        const skillDesc = skill.querySelector('[class*="desc"]')?.textContent?.trim();

        if (skillName || skillDesc) {
          data.skills.push({ name: skillName, description: skillDesc });
        }
      });

      return data;
    });

    return heroDetail;
  }

  async saveData() {
    console.log('\n💾 Saving scraped data...');

    const outputDir = path.join(process.cwd(), 'output');

    // Create output directory if it doesn't exist
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    // Save API calls log
    const apiCallsFile = path.join(outputDir, 'api-calls.json');
    await fs.writeFile(apiCallsFile, JSON.stringify(this.apiCalls, null, 2));
    console.log('✅ API calls saved to:', apiCallsFile);

    // Save hero data if available
    if (this.heroData) {
      const heroDataFile = path.join(outputDir, 'heroes.json');
      await fs.writeFile(heroDataFile, JSON.stringify(this.heroData, null, 2));
      console.log('✅ Hero data saved to:', heroDataFile);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('\n👋 Browser closed');
    }
  }

  async run() {
    try {
      await this.init();

      // Scrape hero list
      const heroes = await this.scrapeHeroList();
      this.heroData = { heroes };

      // If we found heroes in API calls, use that data
      const heroListAPI = this.apiCalls.find(call =>
        call.url.includes('hero') && call.data
      );

      if (heroListAPI) {
        console.log('\n🎯 Found hero data in API calls!');
        this.heroData = heroListAPI.data;
      }

      // Optionally scrape a specific hero detail as example
      if (heroes.length > 0 && heroes[0].heroId) {
        const heroDetail = await this.scrapeHeroDetail(heroes[0].heroId);
        console.log('\n📝 Sample hero detail:', heroDetail);
      }

      await this.saveData();

      console.log('\n✨ Scraping complete!');
      console.log(`📊 Total API calls intercepted: ${this.apiCalls.length}`);

    } catch (error) {
      console.error('❌ Error during scraping:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Run the scraper
const scraper = new HeroScraper();
scraper.run().catch(console.error);
