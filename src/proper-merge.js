import fs from 'fs/promises';
import path from 'path';

/**
 * Properly merge world data (icons, skins) with formatted data (arcana, equipment, skills)
 */
async function properMerge() {
  console.log('📦 Loading data files...');
  
  const outputDir = path.join(process.cwd(), 'output');
  
  // Load formatted-api.json (has arcana, equipment, skills, stats, relationships)
  const formattedRaw = await fs.readFile(path.join(outputDir, 'formatted-api.json'), 'utf-8');
  const formattedData = JSON.parse(formattedRaw);
  
  // Load world-heroes-data.json (has high-quality icons and skins)
  const worldRaw = await fs.readFile(path.join(outputDir, 'world-heroes-data.json'), 'utf-8');
  const worldData = JSON.parse(worldRaw);
  
  console.log('✅ Formatted heroes:', Object.keys(formattedData.main).length);
  console.log('✅ World heroes:', Object.keys(worldData.heroes).length);
  
  // Create heroId to world data mapping
  const worldByHeroId = {};
  for (const [heroId, hero] of Object.entries(worldData.heroes)) {
    worldByHeroId[parseInt(heroId)] = hero;
  }
  
  let mergedCount = 0;
  let skippedCount = 0;
  
  // Merge: use formatted data as base, replace icon and skins from world
  for (const [heroName, hero] of Object.entries(formattedData.main)) {
    const worldHero = worldByHeroId[hero.heroId];
    
    if (worldHero) {
      // Replace icon with high-quality world icon
      hero.icon = worldHero.icon;
      
      // Add world-specific fields
      if (worldHero.banner) hero.banner = worldHero.banner;
      if (worldHero.thumbnail) hero.thumbnail = worldHero.thumbnail;
      
      // Replace skins with world format (high quality)
      if (worldHero.skins && worldHero.skins.length > 0) {
        hero.skins = worldHero.skins.map(skin => ({
          skinName: skin.name,
          skinCover: skin.cover,
          skinImage: skin.image1,
          skinImage2: skin.image2,
          skinSeries: skin.series,
          skinLink: skin.link
        }));
      }
      
      // Add world info if available
      if (!hero.world) {
        hero.world = {};
      }
      if (worldHero.region) hero.world.region = worldHero.region;
      if (worldHero.title) hero.title = worldHero.title;
      
      mergedCount++;
      console.log(`  ✅ ${heroName}: merged with world data (${hero.skins?.length || 0} skins)`);
    } else {
      skippedCount++;
      console.log(`  ⚠️  ${heroName} (ID: ${hero.heroId}): no world data found`);
    }
  }
  
  // Save merged data
  const outputFile = path.join(outputDir, 'merged-api.json');
  await fs.writeFile(outputFile, JSON.stringify(formattedData, null, 2));
  
  console.log(`\n💾 Saved to: ${outputFile}`);
  console.log(`📊 Summary: ${mergedCount} merged, ${skippedCount} skipped`);
  
  // Verify a sample
  const sampleHero = Object.values(formattedData.main)[0];
  console.log(`\n🔍 Sample verification (${sampleHero.name}):`);
  console.log(`   Icon: ${sampleHero.icon?.substring(0, 50)}...`);
  console.log(`   Skins: ${sampleHero.skins?.length || 0}`);
  console.log(`   Arcana: ${sampleHero.arcana?.length || 0}`);
  console.log(`   Equipment: ${sampleHero.recommendedEquipment?.length || 0}`);
  console.log(`   Skills: ${sampleHero.skill?.length || 0}`);
}

properMerge().catch(console.error);
