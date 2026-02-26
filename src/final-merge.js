import fs from 'fs/promises';
import path from 'path';

/**
 * Final merge:
 * - Icons: from world-heroes-data.json (high quality)
 * - Skins: from hok-skins-data.json (user backup - more complete)
 * - Analytics: from formatted-api.json (arcana, equipment, skills, stats)
 */
async function finalMerge() {
  console.log('📦 Loading data files...');
  
  const outputDir = path.join(process.cwd(), 'output');
  
  // Load all data sources
  const worldRaw = await fs.readFile(path.join(outputDir, 'world-heroes-data.json'), 'utf-8');
  const worldData = JSON.parse(worldRaw);
  
  const formattedRaw = await fs.readFile(path.join(outputDir, 'formatted-api.json'), 'utf-8');
  const formattedData = JSON.parse(formattedRaw);
  
  const skinsRaw = await fs.readFile(path.join(outputDir, 'hok-skins-data.json'), 'utf-8');
  const skinsData = JSON.parse(skinsRaw);
  
  console.log('✅ World heroes:', Object.keys(worldData.heroes).length);
  console.log('✅ Formatted heroes:', Object.keys(formattedData.main).length);
  console.log('✅ Skins in backup:', skinsData.length);
  
  // Group skins by heroId
  const skinsByHeroId = {};
  for (const skin of skinsData) {
    const heroId = skin.hero?.heroId;
    if (heroId) {
      if (!skinsByHeroId[heroId]) skinsByHeroId[heroId] = [];
      skinsByHeroId[heroId].push({
        skinName: skin.skinName,
        skinCover: skin.skinCover,
        skinImage: skin.skinImage,
        skinSeries: skin.skinSeries || ''
      });
    }
  }
  
  const mergedData = { main: {} };
  let mergedCount = 0;
  
  // Start from world data (for icons)
  for (const [heroId, worldHero] of Object.entries(worldData.heroes)) {
    const hId = parseInt(heroId);
    
    // Find matching formatted hero
    let formatted = null;
    for (const [name, hero] of Object.entries(formattedData.main)) {
      if (hero.heroId === hId) {
        formatted = hero;
        break;
      }
    }
    
    if (!formatted) {
      console.log('  ⚠️  No formatted data for heroId', heroId, worldHero.name);
      continue;
    }
    
    const heroKey = formatted.name;
    const heroSkins = skinsByHeroId[hId] || [];
    
    mergedData.main[heroKey] = {
      // Identity from world + formatted
      title: worldHero.title || formatted.title || '',
      name: formatted.name,
      heroId: hId,
      role: formatted.role || worldHero.role || '',
      lane: formatted.lane || '',
      
      // Icons from world (high quality)
      icon: worldHero.icon,
      banner: worldHero.banner,
      thumbnail: worldHero.thumbnail,
      
      // Skins from backup (more complete)
      skins: heroSkins,
      
      // Analytics from formatted
      skill: formatted.skill || [],
      arcana: formatted.arcana || [],
      recommendedEquipment: formatted.recommendedEquipment || [],
      buildTitle: formatted.buildTitle || '',
      survivalPercentage: formatted.survivalPercentage || '0%',
      attackPercentage: formatted.attackPercentage || '0%',
      abilityPercentage: formatted.abilityPercentage || '0%',
      difficultyPercentage: formatted.difficultyPercentage || '0%',
      bestPartners: formatted.bestPartners || {},
      suppressingHeroes: formatted.suppressingHeroes || {},
      suppressedHeroes: formatted.suppressedHeroes || {},
      stats: formatted.stats || {},
      
      // World info
      world: {
        region: worldHero.region || '',
        ...(formatted.world || {})
      }
    };
    
    mergedCount++;
    console.log('  ✅', heroKey, '- skins:', heroSkins.length, '| arcana:', (formatted.arcana?.length || 0));
  }
  
  // Save
  const outputFile = path.join(outputDir, 'merged-api.json');
  await fs.writeFile(outputFile, JSON.stringify(mergedData, null, 2));
  
  console.log('\n💾 Saved to:', outputFile);
  console.log('📊 Total heroes:', mergedCount);
  
  // Verify
  console.log('\n🔍 Verification:');
  const angela = mergedData.main['Angela'];
  console.log('Angela (142):', angela?.skins?.length || 0, 'skins');
  angela?.skins?.forEach(s => console.log('  -', s.skinName));
  
  const aoyin = mergedData.main["Ao'yin"];
  console.log("Ao'yin (519):", aoyin?.skins?.length || 0, 'skins');
}

finalMerge().catch(console.error);
