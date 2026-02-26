import fs from 'fs/promises';
import path from 'path';

/**
 * Correct merge strategy:
 * - Hero base + Skins: from world-heroes-data.json (source of truth)
 * - Analytics (arcana, equipment, skills, stats, counters): from formatted-api.json
 */
async function correctMerge() {
  console.log('📦 Loading data files...');
  
  const outputDir = path.join(process.cwd(), 'output');
  
  // Load world data (hero base + skins - source of truth)
  const worldRaw = await fs.readFile(path.join(outputDir, 'world-heroes-data.json'), 'utf-8');
  const worldData = JSON.parse(worldRaw);
  
  // Load formatted data (analytics: arcana, equipment, skills, stats, relationships)
  const formattedRaw = await fs.readFile(path.join(outputDir, 'formatted-api.json'), 'utf-8');
  const formattedData = JSON.parse(formattedRaw);
  
  console.log('✅ World heroes:', Object.keys(worldData.heroes).length);
  console.log('✅ Formatted heroes:', Object.keys(formattedData.main).length);
  
  // Create heroId to formatted data mapping
  const formattedByHeroId = {};
  for (const [heroName, hero] of Object.entries(formattedData.main)) {
    formattedByHeroId[hero.heroId] = hero;
  }
  
  const mergedData = { main: {} };
  let mergedCount = 0;
  
  // Start from world data (source of truth for heroes and skins)
  for (const [heroId, worldHero] of Object.entries(worldData.heroes)) {
    const formatted = formattedByHeroId[parseInt(heroId)];
    
    if (!formatted) {
      console.log('  ⚠️  No formatted data for heroId', heroId, worldHero.name);
      continue;
    }
    
    // Use formatted hero name as key (more consistent)
    const heroKey = formatted.name;
    
    // Build merged hero: world base + formatted analytics
    mergedData.main[heroKey] = {
      // From world (hero identity)
      title: worldHero.title || formatted.title || '',
      name: formatted.name,
      heroId: parseInt(heroId),
      role: formatted.role || worldHero.role || '',
      lane: formatted.lane || '',
      icon: worldHero.icon,
      banner: worldHero.banner,
      thumbnail: worldHero.thumbnail,
      
      // Skins from world (source of truth - empty if no skins)
      skins: (worldHero.skins || []).map(skin => ({
        skinName: skin.name,
        skinCover: skin.cover,
        skinImage: skin.image1,
        skinImage2: skin.image2,
        skinSeries: skin.series,
        skinLink: skin.link
      })),
      
      // Analytics from formatted (camp data)
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
        region: worldHero.region || formatted.world?.region || '',
        ...(formatted.world || {})
      }
    };
    
    mergedCount++;
    const skinCount = mergedData.main[heroKey].skins.length;
    console.log('  ✅', heroKey, '- skins:', skinCount, '| arcana:', (formatted.arcana?.length || 0), '| equip:', (formatted.recommendedEquipment?.length || 0));
  }
  
  // Save merged data
  const outputFile = path.join(outputDir, 'merged-api.json');
  await fs.writeFile(outputFile, JSON.stringify(mergedData, null, 2));
  
  console.log('\n💾 Saved to:', outputFile);
  console.log('📊 Total heroes merged:', mergedCount);
  
  // Verify specific heroes
  console.log('\n🔍 Verification:');
  
  // Hero 142
  const hero142 = Object.values(mergedData.main).find(h => h.heroId === 142);
  if (hero142) {
    console.log('Hero 142 (' + hero142.name + '): ' + hero142.skins.length + ' skins');
  }
  
  // Ao'yin (528)
  const aoyin = Object.values(mergedData.main).find(h => h.heroId === 528);
  if (aoyin) {
    console.log('Ao\'yin (528): ' + aoyin.skins.length + ' skins');
  }
}

correctMerge().catch(console.error);
