# Honor of Kings Global API

Scraper and API for Honor of Kings Global hero data from official camp.honorofkings.com website.

## Features

- 🦸 Scrapes data for all 111 heroes
- 📊 Extracts complete hero information:
  - Basic info (name, role, lane)
  - Statistics (win rate, pick rate, ban rate)
  - Skills with descriptions
  - Recommended equipment
  - Skins
  - Relationships (counters, synergies)
- 🔄 Intercepts official API calls
- 💾 Outputs clean JSON data

## Installation

```bash
npm install
```

## Usage

### Scrape All Heroes

```bash
npm run scrape
```

This will scrape all 111 heroes and save the data to `output/all-heroes-complete.json`.

### Get Hero List Only

```bash
node src/get-all-heroes.js
```

## API Endpoints Discovered

The scraper intercepts the following official Honor of Kings Global API endpoints:

- `POST https://api-camp.honorofkings.com/api/herowiki/getherodataall` - Complete hero data
- `POST https://api-camp.honorofkings.com/api/herowiki/herohomepage` - Hero homepage/adjustments
- `POST https://api-camp.honorofkings.com/api/game/hero/getinformationcard` - Hero information cards
- `POST https://api-camp.honorofkings.com/api/game/getbutton` - UI buttons and navigation

## Output Structure

### all-heroes-complete.json

```json
[
  {
    "heroId": 106,
    "heroName": "Xiao Qiao",
    "icon": "https://camp.honorofkings.com/.../paTVVlNq.png",
    "mainJob": 4,
    "mainJobName": "Mage",
    "recommendRoad": 3,
    "recommendRoadName": "Mid Lane",
    "displayData": {
      "heroCover": "...",
      "heroWorldIcon": "..."
    },
    "stats": {
      "hot": "A",
      "winRate": "48.93%",
      "matchRate": "1.99%",
      "banRate": "0.15%"
    },
    "skills": [...],
    "skins": [...],
    "equipment": [...],
    "relationships": {...}
  }
]
```

### heroes-summary.json

```json
{
  "totalHeroes": 111,
  "scrapedAt": "2026-02-20T...",
  "heroes": [
    {
      "heroId": 106,
      "heroName": "Xiao Qiao",
      "mainJob": "Mage",
      "lane": "Mid Lane"
    }
  ]
}
```

## How It Works

1. Uses Puppeteer to launch a headless browser
2. Navigates to hero detail pages
3. Intercepts network requests to official API
4. Captures JSON responses containing hero data
5. Processes and saves to structured JSON files

## Notes

- Scraping all 111 heroes takes approximately 5-10 minutes
- Includes rate limiting to avoid overwhelming the server
- Data is sourced from official Honor of Kings Global website

## License

MIT
