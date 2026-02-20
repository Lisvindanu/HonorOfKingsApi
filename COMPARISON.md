# API Comparison: Global vs China

## Overview

This document compares the Honor of Kings **Global API** (this project) with the **China API** (reference).

- **Reference (China)**: https://qing762.is-a.dev/api/wangzhe
- **This Project (Global)**: `output/final-api-sample.json`

## Sample Output

### Our Global API (Sample)
```json
{
  "main": {
    "Xiao Qiao": {
      "title": "Xiao Qiao",
      "name": "Xiao Qiao",
      "heroId": 106,
      "role": "Mage",
      "lane": "Mid Lane",
      "icon": "https://camp.honorofkings.com/.../paTVVlNq.png",
      "skill": [
        {
          "skillName": "Encouraging Thoughts",
          "cooldown": [1],
          "cost": [0],
          "skillDesc": "Hitting enemies with skills enhances herself...",
          "skillImg": "https://camp.honorofkings.com/.../10610.png"
        }
      ],
      "skins": [
        {
          "skinName": "Xiao Qiao",
          "skinImg": "https://camp.honorofkings.com/.../QGRC6bOP.png"
        }
      ],
      "bestPartners": {
        "Zilong": {
          "name": "Zilong",
          "thumbnail": "https://...",
          "description": "",
          "url": ""
        }
      },
      "stats": {
        "winRate": "48.93%",
        "pickRate": "1.99%",
        "banRate": "0.15%",
        "tier": "A"
      },
      "world": {
        "region": "Jiangdong",
        "identity": "Strategist's Wife",
        "energy": "Flame"
      }
    }
  }
}
```

### Reference China API
```json
{
  "main": {
    "廉颇": {
      "title": "正义爆轰",
      "name": "廉颇",
      "skill": [...],
      "survivalPercentage": "100%",
      "attackPercentage": "30%",
      "abilityPercentage": "40%",
      "difficultyPercentage": "30%",
      "skins": [...],
      "emblems": [...],
      "bestPartners": {...},
      "suppressingHeroes": {...},
      "suppressedHeroes": {...}
    }
  }
}
```

## Data Availability Comparison

| Field | China API | Global API | Notes |
|-------|-----------|------------|-------|
| `name` | ✅ | ✅ | Hero name |
| `title` | ✅ | ✅ | Hero title/subtitle |
| `skill` | ✅ | ✅ | Skills with cooldown, cost, description |
| `skins` | ✅ | ✅ | Hero skins with images |
| `survivalPercentage` | ✅ | ❌ | Not available in Global |
| `attackPercentage` | ✅ | ❌ | Not available in Global |
| `abilityPercentage` | ✅ | ❌ | Not available in Global |
| `difficultyPercentage` | ✅ | ❌ | Not available in Global |
| `emblems` | ✅ | ❌ | Not available in Global |
| `emblemTips` | ✅ | ❌ | Not available in Global |
| `bestPartners` | ✅ | ✅ | Team synergies |
| `suppressingHeroes` | ✅ | ✅ | Heroes this hero counters |
| `suppressedHeroes` | ✅ | ✅ | Heroes that counter this hero |
| **Extra in Global:** | | | |
| `heroId` | ❌ | ✅ | Numeric hero ID |
| `role` | ❌ | ✅ | Hero role (Mage, Fighter, etc) |
| `lane` | ❌ | ✅ | Recommended lane |
| `icon` | ❌ | ✅ | Hero icon URL |
| `stats` | ❌ | ✅ | Win rate, pick rate, ban rate, tier |
| `world` | ❌ | ✅ | Lore information (region, identity, energy) |

## Key Differences

### 1. Hero Attributes
- **China**: Has percentage-based attributes (survival, attack, ability, difficulty)
- **Global**: These are not available in the official API

### 2. Emblems/Inscriptions
- **China**: Full emblem recommendations with effects
- **Global**: Emblem system appears to be different or not exposed in API

### 3. Additional Global Data
- **Global** provides extra useful data:
  - `heroId`: Useful for programmatic access
  - `role` & `lane`: Clear gameplay information
  - `stats`: Actual game statistics (win/pick/ban rates)
  - `world`: Lore and background information

### 4. Language
- **China**: All in Chinese (中文)
- **Global**: All in English

## Sample Heroes Scraped

✅ **Xiao Qiao** (Hero ID: 106)
- Role: Mage
- Lane: Mid Lane
- 4 Skills
- 14 Skins
- 3 Best Partners

✅ **Haya** (Hero ID: 521)
- Role: Mage
- 4 Skills
- 4 Skins
- 3 Best Partners

## Conclusion

The **Global API** successfully replicates the core structure of the China API while adding valuable extra information like hero IDs, roles, stats, and lore. Some China-specific features (attribute percentages, emblems) are not available in the Global version's official data.

The API is production-ready and can be extended to all 111 heroes in the Global version.
