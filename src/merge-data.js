import fs from 'fs/promises';
import path from 'path';

async function mergeData() {
  console.log('🔄 Merging data from both sources...\n');

  const outputDir = path.join(process.cwd(), 'output');

  // Load world data (462 clean skins with 79 series)
  console.log('📥 Loading world.honorofkings.com data...');
  const worldData = JSON.parse(
    await fs.readFile(path.join(outputDir, 'world-complete-api.json'), 'utf-8')
  );
  console.log(`  ✅ ${Object.keys(worldData.main).length} heroes from world\n`);

  // Load camp data (stats, abilities, relationships)
  console.log('📥 Loading camp.honorofkings.com data...');
  const campData = JSON.parse(
    await fs.readFile(path.join(outputDir, 'formatted-api.json'), 'utf-8')
  );
  console.log(`  ✅ ${Object.keys(campData.main).length} heroes from camp\n`);

  // Create merged data
  const mergedData = { main: {} };
  let matchCount = 0;
  let worldOnlyCount = 0;
  let campOnlyCount = 0;

  // Start with world data (clean skins)
  for (const [heroName, worldHero] of Object.entries(worldData.main)) {
    const heroId = worldHero.heroId;

    // Find matching hero in camp data by ID
    let campHero = null;
    for (const [campName, campHeroData] of Object.entries(campData.main)) {
      if (campHeroData.heroId === heroId) {
        campHero = campHeroData;
        break;
      }
    }

    if (campHero) {
      // Merge data - world for images/skins, camp for stats
      mergedData.main[heroName] = {
        // Basic info from world
        title: worldHero.title,
        name: worldHero.name,
        heroId: worldHero.heroId,
        role: campHero.role || worldHero.role,
        lane: campHero.lane,

        // Images from world (HD)
        icon: worldHero.icon,
        banner: worldHero.banner,
        thumbnail: worldHero.thumbnail,

        // Skins from world (clean, 462 total)
        skins: worldHero.skins,

        // Stats from camp
        stats: campHero.stats || {
          winRate: 'N/A',
          pickRate: 'N/A',
          banRate: 'N/A',
          tier: 'N/A'
        },

        // Attributes from camp
        survivalPercentage: campHero.survivalPercentage || '0%',
        attackPercentage: campHero.attackPercentage || '0%',
        abilityPercentage: campHero.abilityPercentage || '0%',
        difficultyPercentage: campHero.difficultyPercentage || '0%',

        // Relationships from camp
        bestPartners: campHero.bestPartners || {},
        suppressingHeroes: campHero.suppressingHeroes || {},
        suppressedHeroes: campHero.suppressedHeroes || {},

        // Lore from world + camp
        world: {
          region: worldHero.region,
          ...(campHero.world || {})
        },

        // Skills from camp
        skill: campHero.skill || [],

        // Emblems from camp
        emblems: campHero.emblems || [],
        emblemTips: campHero.emblemTips || ''
      };
      matchCount++;
    } else {
      // World only (no camp data)
      mergedData.main[heroName] = {
        ...worldHero,
        lane: 'Unknown',
        stats: {
          winRate: 'N/A',
          pickRate: 'N/A',
          banRate: 'N/A',
          tier: 'N/A'
        },
        survivalPercentage: '0%',
        attackPercentage: '0%',
        abilityPercentage: '0%',
        difficultyPercentage: '0%',
        skill: [],
        bestPartners: {},
        suppressingHeroes: {},
        suppressedHeroes: {},
        world: { region: worldHero.region },
        emblems: [],
        emblemTips: ''
      };
      worldOnlyCount++;
    }
  }

  // Add camp-only heroes (missing in world)
  for (const [campName, campHero] of Object.entries(campData.main)) {
    const heroId = campHero.heroId;
    const existsInWorld = Object.values(mergedData.main).some(h => h.heroId === heroId);

    if (!existsInWorld) {
      mergedData.main[campName] = {
        ...campHero,
        // Keep camp skins for these heroes (no world data available)
      };
      campOnlyCount++;
    }
  }

  console.log('📊 Merge Summary:');
  console.log(`  ✅ Matched heroes: ${matchCount}`);
  console.log(`  🌍 World only: ${worldOnlyCount}`);
  console.log(`  🏕️ Camp only: ${campOnlyCount}`);
  console.log(`  📦 Total heroes: ${Object.keys(mergedData.main).length}\n`);

  // Calculate total skins
  const totalSkins = Object.values(mergedData.main).reduce((sum, hero) => sum + hero.skins.length, 0);
  const skinsWithSeries = Object.values(mergedData.main).reduce((sum, hero) => {
    return sum + hero.skins.filter(s => s.skinSeries && s.skinSeries.trim()).length;
  }, 0);

  console.log(`  🎨 Total skins: ${totalSkins}`);
  console.log(`  📋 Skins with series: ${skinsWithSeries}`);
  console.log(`  ⚪ Skins without series: ${totalSkins - skinsWithSeries}\n`);

  // Save merged data
  const mergedFile = path.join(outputDir, 'merged-api.json');
  await fs.writeFile(mergedFile, JSON.stringify(mergedData, null, 2));
  console.log(`💾 Merged data saved to: ${mergedFile}\n`);

  console.log('✅ Merge complete!');
}

mergeData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
