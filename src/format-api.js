import fs from 'fs/promises';
import path from 'path';

/**
 * Transform scraped hero data to match reference API format
 * Reference: https://qing762.is-a.dev/api/wangzhe
 */

async function formatHeroData() {
  console.log('📦 Loading scraped hero data...');

  const inputFile = path.join(process.cwd(), 'output', 'all-heroes-complete.json');
  const rawData = await fs.readFile(inputFile, 'utf-8');
  const heroesData = JSON.parse(rawData);

  console.log(`✅ Loaded ${heroesData.length} heroes`);

  const formattedData = {};

  for (const hero of heroesData) {
    if (!hero.heroName) {
      console.log(`⚠️  Skipping hero ${hero.heroId} - no name`);
      continue;
    }

    const heroKey = hero.heroName;

    // Format skills
    const skills = [];
    if (hero.skills && Array.isArray(hero.skills)) {
      for (const skill of hero.skills) {
        skills.push({
          skillName: skill.skillName || '',
          cooldown: skill.cd || skill.cooldown || [0],
          cost: skill.consume || skill.cost || [0],
          skillDesc: skill.description || skill.skillDesc || '',
          skillImg: skill.iconUrl || skill.skillIcon || skill.skillImg || ''
        });
      }
    }

    // Format skins
    const skins = [];
    if (hero.skins && Array.isArray(hero.skins)) {
      for (const skin of hero.skins) {
        skins.push({
          skinName: skin.skinName || skin.name || '',
          skinImg: skin.mainImg || skin.skinImg || skin.image || ''
        });
      }
    }

    // Format relationships - best partners
    const bestPartners = {};
    if (hero.relationships && hero.relationships.bestPartner) {
      for (const partner of hero.relationships.bestPartner) {
        const partnerName = partner.heroName || partner.name;
        if (partnerName) {
          bestPartners[partnerName] = {
            name: partnerName,
            thumbnail: partner.icon || partner.heroIcon || '',
            description: partner.tips || partner.description || '',
            url: ''
          };
        }
      }
    }

    // Format relationships - suppressing heroes (yang kita kalahkan)
    const suppressingHeroes = {};
    if (hero.relationships && hero.relationships.winOddsHero) {
      for (const suppressed of hero.relationships.winOddsHero) {
        const suppressedName = suppressed.heroName || suppressed.name;
        if (suppressedName) {
          suppressingHeroes[suppressedName] = {
            name: suppressedName,
            thumbnail: suppressed.icon || suppressed.heroIcon || '',
            description: suppressed.tips || suppressed.description || '',
            url: ''
          };
        }
      }
    }

    // Format relationships - suppressed by heroes (yang mengalahkan kita)
    const suppressedHeroes = {};
    if (hero.relationships && hero.relationships.weakOddsHero) {
      for (const suppressor of hero.relationships.weakOddsHero) {
        const suppressorName = suppressor.heroName || suppressor.name;
        if (suppressorName) {
          suppressedHeroes[suppressorName] = {
            name: suppressorName,
            thumbnail: suppressor.icon || suppressor.heroIcon || '',
            description: suppressor.tips || suppressor.description || '',
            url: ''
          };
        }
      }
    }

    // Format equipment/emblems
    const emblems = [];
    if (hero.equipment && hero.equipment.inscriptionData) {
      for (const emblem of hero.equipment.inscriptionData) {
        emblems.push({
          emblemName: emblem.inscriptionName || emblem.name || '',
          emblemDescription: emblem.inscriptionEffect || emblem.description || '',
          emblemImg: emblem.inscriptionIcon || emblem.icon || ''
        });
      }
    }

    formattedData[heroKey] = {
      title: hero.cover || '',
      name: hero.heroName,
      heroId: hero.heroId,
      role: hero.mainJobName || '',
      lane: hero.recommendRoadName || '',
      icon: hero.icon || '',
      skill: skills,
      survivalPercentage: formatPercentage(hero.survivalAbility),
      attackPercentage: formatPercentage(hero.attackDamage),
      abilityPercentage: formatPercentage(hero.skillEffect),
      difficultyPercentage: formatPercentage(hero.difficulty),
      skins: skins,
      emblems: emblems,
      emblemTips: hero.equipment?.inscriptionTips || '',
      bestPartners: bestPartners,
      suppressingHeroes: suppressingHeroes,
      suppressedHeroes: suppressedHeroes,
      stats: {
        winRate: hero.stats?.winRate || '',
        pickRate: hero.stats?.matchRate || '',
        banRate: hero.stats?.banRate || '',
        tier: hero.stats?.hot || ''
      }
    };

    console.log(`  ✅ Formatted: ${heroKey}`);
  }

  // Save formatted data
  const outputFile = path.join(process.cwd(), 'output', 'formatted-api.json');
  await fs.writeFile(outputFile, JSON.stringify({ main: formattedData }, null, 2));

  console.log(`\n💾 Saved formatted data to: ${outputFile}`);
  console.log(`📊 Total heroes formatted: ${Object.keys(formattedData).length}`);
}

function formatPercentage(value) {
  if (!value) return '0%';
  if (typeof value === 'string' && value.includes('%')) return value;
  if (typeof value === 'number') return `${Math.round(value * 100)}%`;
  return '0%';
}

formatHeroData().catch(console.error);
