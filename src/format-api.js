import fs from 'fs/promises';
import path from 'path';

/**
 * Transform scraped hero data to match reference API format
 */

async function formatSampleData() {
  console.log('📦 Loading hero data...');

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

    // Format skills from strategy.skill (new location)
    const skills = [];
    if (hero.strategy?.skill) {
      for (const skillGroup of hero.strategy.skill) {
        if (skillGroup.skillList) {
          for (const skill of skillGroup.skillList) {
            skills.push({
              skillName: skill.skillName || '',
              cooldown: skill.skillCd ? [skill.skillCd / 1000] : [0],
              cost: [skill.skillCostList?.skillCost || 0],
              skillDesc: skill.skillDesc ? skill.skillDesc.replace(/<[^>]*>/g, '') : '',
              skillImg: skill.skillIcon || ''
            });
          }
        }
      }
    }

    // Format skins from world.libraryList
    const skins = [];
    if (hero.world?.libraryList) {
      for (const item of hero.world.libraryList) {
        if (item.materialType === 1 && item.image) {
          const img = item.image;
          skins.push({
            skinName: img.title2 || img.title1 || '',
            skinImg: img.oriPicUrl || img.image || ''
          });
        }
      }
    }

    // Format best partners from strategy.combination (type 2)
    const bestPartners = {};
    if (hero.strategy?.combination) {
      for (const combo of hero.strategy.combination) {
        if (combo.combinationType === 2 && combo.heroCombination) {
          for (const partner of combo.heroCombination) {
            if (partner.heroId !== hero.heroId) {
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

    // Format suppressing heroes (type 1 - heroes this hero is good against)
    const suppressingHeroes = {};
    if (hero.strategy?.combination) {
      for (const combo of hero.strategy.combination) {
        if (combo.combinationType === 1 && combo.heroCombination) {
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

    // Format suppressed by heroes (type 3 - heroes that counter this hero)
    const suppressedHeroes = {};
    if (hero.strategy?.combination) {
      for (const combo of hero.strategy.combination) {
        if (combo.combinationType === 3 && combo.heroCombination) {
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

    const emblems = [];
    const stats = hero.stats || {};

    formattedData[heroKey] = {
      title: hero.cover || hero.heroName,
      name: hero.heroName,
      heroId: hero.heroId,
      role: hero.mainJobName || '',
      lane: hero.recommendRoadName || '',
      icon: hero.icon || '',
      skill: skills,
      survivalPercentage: '0%',
      attackPercentage: '0%',
      abilityPercentage: '0%',
      difficultyPercentage: '0%',
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
        region: hero.world?.world?.region || '',
        identity: hero.world?.world?.identity || '',
        energy: hero.world?.world?.energy || ''
      }
    };

    const partnerCount = Object.keys(bestPartners).length;
    const strongCount = Object.keys(suppressingHeroes).length;
    const weakCount = Object.keys(suppressedHeroes).length;
    
    console.log(`  ✅ ${heroKey}: ${partnerCount} partners, ${strongCount} strong against, ${weakCount} weak against`);
  }

  const outputFile = path.join(process.cwd(), 'output', 'formatted-api.json');
  await fs.writeFile(outputFile, JSON.stringify({ main: formattedData }, null, 2));

  console.log(`\n💾 Saved formatted data to: ${outputFile}`);
  console.log(`📊 Total heroes: ${Object.keys(formattedData).length}`);
}

formatSampleData().catch(console.error);
