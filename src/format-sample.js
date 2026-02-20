import fs from 'fs/promises';
import path from 'path';

/**
 * Transform scraped sample hero data to match reference API format
 * Reference: https://qing762.is-a.dev/api/wangzhe
 */

async function formatSampleData() {
  console.log('📦 Loading sample hero data...');

  const inputFile = path.join(process.cwd(), 'output', 'sample-heroes.json');
  const rawData = await fs.readFile(inputFile, 'utf-8');
  const heroesData = JSON.parse(rawData);

  console.log(`✅ Loaded ${heroesData.length} sample heroes`);

  const formattedData = {};

  for (const hero of heroesData) {
    if (!hero.heroName) {
      console.log(`⚠️  Skipping hero ${hero.heroId} - no name`);
      continue;
    }

    const heroKey = hero.heroName;
    const raw = hero.rawData;

    // Format skills from strategyData.skill
    const skills = [];
    if (raw.strategyData?.skill) {
      for (const skillGroup of raw.strategyData.skill) {
        if (skillGroup.skillList) {
          for (const skill of skillGroup.skillList) {
            skills.push({
              skillName: skill.skillName || '',
              cooldown: skill.skillCd ? [skill.skillCd / 1000] : [0], // Convert ms to seconds
              cost: [skill.skillCostList?.skillCost || 0],
              skillDesc: skill.skillDesc ? skill.skillDesc.replace(/<[^>]*>/g, '') : '', // Remove HTML tags
              skillImg: skill.skillIcon || ''
            });
          }
        }
      }
    }

    // Format skins from worldData.libraryList (images)
    const skins = [];
    if (raw.worldData?.libraryList) {
      for (const item of raw.worldData.libraryList) {
        if (item.materialType === 1 && item.image) { // materialType 1 = images
          const img = item.image;
          skins.push({
            skinName: img.title2 || img.title1 || '',
            skinImg: img.oriPicUrl || img.image || ''
          });
        }
      }
    }

    // Format best partners from strategyData.combination
    const bestPartners = {};
    if (raw.strategyData?.combination) {
      for (const combo of raw.strategyData.combination) {
        if (combo.combinationType === 2 && combo.heroCombination) { // Type 2 = team composition
          for (const partner of combo.heroCombination) {
            if (partner.heroId !== hero.heroId) { // Don't include self
              bestPartners[partner.heroName] = {
                name: partner.heroName,
                thumbnail: partner.heroIcon || '',
                description: combo.combinationDesc || '',
                url: ''
              };
            }
          }
        }
      }
    }

    // Format suppressing heroes (heroes this hero is good against)
    const suppressingHeroes = {};
    if (raw.strategyData?.combination) {
      for (const combo of raw.strategyData.combination) {
        if (combo.combinationType === 1 && combo.heroCombination) { // Type 1 = counter picks
          for (const target of combo.heroCombination) {
            if (target.heroId !== hero.heroId) {
              suppressingHeroes[target.heroName] = {
                name: target.heroName,
                thumbnail: target.heroIcon || '',
                description: combo.combinationDesc || '',
                url: ''
              };
            }
          }
        }
      }
    }

    // Format suppressed by heroes (heroes that counter this hero)
    const suppressedHeroes = {};
    if (raw.strategyData?.combination) {
      for (const combo of raw.strategyData.combination) {
        if (combo.combinationType === 3 && combo.heroCombination) { // Type 3 = countered by
          for (const counter of combo.heroCombination) {
            if (counter.heroId !== hero.heroId) {
              suppressedHeroes[counter.heroName] = {
                name: counter.heroName,
                thumbnail: counter.heroIcon || '',
                description: combo.combinationDesc || '',
                url: ''
              };
            }
          }
        }
      }
    }

    // Format equipment/emblems - Not available in Global version data
    const emblems = [];

    // Get stats
    const stats = raw.heroData?.baseData || {};

    formattedData[heroKey] = {
      title: hero.cover || hero.heroName,
      name: hero.heroName,
      heroId: hero.heroId,
      role: hero.mainJobName || '',
      lane: hero.recommendRoadName || '',
      icon: hero.icon || '',
      skill: skills,
      survivalPercentage: '0%', // Not available in Global data
      attackPercentage: '0%', // Not available in Global data
      abilityPercentage: '0%', // Not available in Global data
      difficultyPercentage: '0%', // Not available in Global data
      skins: skins,
      emblems: emblems,
      emblemTips: '',
      bestPartners: bestPartners,
      suppressingHeroes: suppressingHeroes,
      suppressedHeroes: suppressedHeroes,
      stats: {
        winRate: stats.winRate || '',
        pickRate: stats.matchRate || '',
        banRate: stats.banRate || '',
        tier: stats.hot || ''
      },
      world: {
        region: raw.worldData?.world?.region || '',
        identity: raw.worldData?.world?.identity || '',
        energy: raw.worldData?.world?.energy || ''
      }
    };

    console.log(`  ✅ Formatted: ${heroKey}`);
    console.log(`     - ${skills.length} skills`);
    console.log(`     - ${skins.length} skins`);
    console.log(`     - ${Object.keys(bestPartners).length} best partners`);
  }

  // Save formatted data
  const outputFile = path.join(process.cwd(), 'output', 'formatted-sample.json');
  await fs.writeFile(outputFile, JSON.stringify({ main: formattedData }, null, 2));

  console.log(`\n💾 Saved formatted sample to: ${outputFile}`);
  console.log(`📊 Total heroes formatted: ${Object.keys(formattedData).length}`);

  // Pretty print one hero as example
  console.log('\n📄 Sample output:');
  const firstHero = Object.values(formattedData)[0];
  console.log(JSON.stringify({ [Object.keys(formattedData)[0]]: firstHero }, null, 2).substring(0, 1000) + '...');
}

formatSampleData().catch(console.error);
