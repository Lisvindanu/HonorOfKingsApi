import fs from 'fs/promises';
import path from 'path';

// Inline tier data to avoid import issues
const SKIN_TIERS = {
  NO_TAG: { name: 'No Tag', color: '#9CA3AF' },
  RARE: { name: 'Rare', color: '#3B82F6' },
  EPIC: { name: 'Epic', color: '#8B5CF6' },
  LEGEND: { name: 'Legend', color: '#F59E0B' },
  PRECIOUS: { name: 'Precious', color: '#EC4899' },
  MYTHIC: { name: 'Mythic', color: '#EF4444' },
  FLAWLESS: { name: 'Flawless', color: '#F472B6' }
};

const COLLAB_TAGS = {
  DETECTIVE_CONAN: { name: 'Detective Conan', color: '#1E90FF' },
  SAILOR_MOON: { name: 'Sailor Moon', color: '#FF69B4' },
  SNK: { name: 'SNK', color: '#8B0000' },
  SANRIO: { name: 'Sanrio', color: '#FF6B6B' },
  JUJUTSU_KAISEN: { name: 'Jujutsu Kaisen', color: '#1E3A5F' },
  BLEACH: { name: 'Bleach', color: '#FF4500' },
  FROZEN: { name: 'Frozen', color: '#87CEEB' }
};

const SERIES_MAPPING = {
  'DETECTIVE CONAN': { tier: 'EPIC', collab: 'DETECTIVE_CONAN' },
  'PRETTY GUARDIAN SAILOR MOON COSMOS THE MOVIE COLLAB': { tier: 'EPIC', collab: 'SAILOR_MOON' },
  'FUTURE ERA': { tier: 'EPIC' },
  'DOOMSDAY MECHA': { tier: 'EPIC' },
  'COSMIC SONG': { tier: 'EPIC' },
  'SPACE ODYSSEY': { tier: 'EPIC' },
  'INTERSTELLAR': { tier: 'EPIC' },
  'HELLFIRE': { tier: 'LEGEND' },
  'MAGIC': { tier: 'EPIC' },
  'MAGIC - MAGIC ACADEMY': { tier: 'EPIC' },
  'JOURNEY TO THE WEST': { tier: 'EPIC' },
  'GAMER': { tier: 'EPIC' },
  'MANGA CROSSOVER': { tier: 'EPIC' },
  'SIRIUS SQUAD': { tier: 'EPIC' },
  'LIMBO': { tier: 'LEGEND' },
  'FIVE HONORS': { tier: 'LEGEND' },
  'FIVE TIGER GENERALS': { tier: 'LEGEND' },
  'FIVE MOUNTAINS': { tier: 'LEGEND' },
  'DRAGON HUNTER': { tier: 'EPIC' },
  'YEAR OF THE DRAGON': { tier: 'EPIC' },
  'NUTCRACKER MONARCH': { tier: 'EPIC' },
  'CHRISTMAS CAROL': { tier: 'EPIC' },
  'ODE TO WINTER': { tier: 'EPIC' },
  'BEACH VACATION': { tier: 'EPIC' },
  'HOME SWEET HOME': { tier: 'EPIC' },
  'CAMPUS DIARIES': { tier: 'RARE' },
  'FLOWER WHISPER': { tier: 'EPIC' },
  'COLORS OF THE SOUL': { tier: 'EPIC' },
  'TALES OLD AND NEW': { tier: 'EPIC' },
  'STRANGE TALES': { tier: 'EPIC' },
  'DUNHUANG ENCOUNTER': { tier: 'LEGEND' },
  "SHI YI'S TALE": { tier: 'LEGEND' },
  'MASK SPIRITS': { tier: 'EPIC' },
  'DAWNVILLE': { tier: 'EPIC' },
  'RAIN PLAY': { tier: 'EPIC' },
  'ENDLESS LOVE': { tier: 'EPIC' },
  'WORLD CUP': { tier: 'EPIC', tag: 'LIMITED' },
  'EWC': { tier: 'LEGEND', tag: 'KIC' },
  'AMPED UP': { tier: 'EPIC' },
  'AMPED UP: TRUE HERTZ': { tier: 'LEGEND' },
  'AMBER ERA': { tier: 'EPIC' },
  'Ascension': { tier: 'EPIC', tag: 'WORLDLY' }
};

// Special skins with known tiers
const SPECIAL_SKINS = {
  'Eternal Night': 'FLAWLESS',
  'Nine-Tailed Fox': 'FLAWLESS',
  'Swan Princess': 'FLAWLESS',
  'Drunken Swordsman': 'FLAWLESS',
  'Frostfire Dragon': 'MYTHIC',
  'Time Keeper': 'MYTHIC',
  'Blazing Stars': 'MYTHIC',
  'Astral Magic': 'LEGEND'
};

function getSkinTierInfo(skinName, skinSeries) {
  // Check special skins first
  if (SPECIAL_SKINS[skinName]) {
    const tierKey = SPECIAL_SKINS[skinName];
    return {
      tier: tierKey,
      tierName: SKIN_TIERS[tierKey]?.name || tierKey,
      tierColor: SKIN_TIERS[tierKey]?.color || '#8B5CF6'
    };
  }
  
  // Check series mapping
  if (skinSeries && SERIES_MAPPING[skinSeries]) {
    const mapping = SERIES_MAPPING[skinSeries];
    const tierKey = mapping.tier || 'EPIC';
    return {
      tier: tierKey,
      tierName: SKIN_TIERS[tierKey]?.name || tierKey,
      tierColor: SKIN_TIERS[tierKey]?.color || '#8B5CF6',
      collab: mapping.collab ? COLLAB_TAGS[mapping.collab] : null,
      tag: mapping.tag
    };
  }
  
  // Default: if has series = EPIC, else = RARE
  const tierKey = skinSeries ? 'EPIC' : 'RARE';
  return {
    tier: tierKey,
    tierName: SKIN_TIERS[tierKey]?.name || tierKey,
    tierColor: SKIN_TIERS[tierKey]?.color || '#3B82F6'
  };
}

async function mergeWithTiers() {
  console.log('📦 Loading data files...');
  
  const outputDir = path.join(process.cwd(), 'output');
  
  const worldRaw = await fs.readFile(path.join(outputDir, 'world-heroes-data.json'), 'utf-8');
  const worldData = JSON.parse(worldRaw);
  
  const formattedRaw = await fs.readFile(path.join(outputDir, 'formatted-api.json'), 'utf-8');
  const formattedData = JSON.parse(formattedRaw);
  
  const skinsRaw = await fs.readFile(path.join(outputDir, 'hok-skins-data.json'), 'utf-8');
  const skinsData = JSON.parse(skinsRaw);
  
  console.log('✅ World heroes:', Object.keys(worldData.heroes).length);
  console.log('✅ Formatted heroes:', Object.keys(formattedData.main).length);
  console.log('✅ Skins in backup:', skinsData.length);
  
  // Group skins by heroId with tier info
  const skinsByHeroId = {};
  for (const skin of skinsData) {
    const heroId = skin.hero?.heroId;
    if (heroId) {
      if (!skinsByHeroId[heroId]) skinsByHeroId[heroId] = [];
      
      const tierInfo = getSkinTierInfo(skin.skinName, skin.skinSeries);
      
      skinsByHeroId[heroId].push({
        skinName: skin.skinName,
        skinCover: skin.skinCover,
        skinImage: skin.skinImage,
        skinSeries: skin.skinSeries || '',
        ...tierInfo
      });
    }
  }
  
  const mergedData = { main: {} };
  let mergedCount = 0;
  
  for (const [heroId, worldHero] of Object.entries(worldData.heroes)) {
    const hId = parseInt(heroId);
    
    let formatted = null;
    for (const [name, hero] of Object.entries(formattedData.main)) {
      if (hero.heroId === hId) {
        formatted = hero;
        break;
      }
    }
    
    if (!formatted) continue;
    
    const heroKey = formatted.name;
    const heroSkins = skinsByHeroId[hId] || [];
    
    mergedData.main[heroKey] = {
      title: worldHero.title || formatted.title || '',
      name: formatted.name,
      heroId: hId,
      role: formatted.role || worldHero.role || '',
      lane: formatted.lane || '',
      icon: worldHero.icon,
      banner: worldHero.banner,
      thumbnail: worldHero.thumbnail,
      skins: heroSkins,
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
      world: {
        region: worldHero.region || '',
        ...(formatted.world || {})
      }
    };
    
    mergedCount++;
    
    // Count tiers
    const tierCounts = {};
    heroSkins.forEach(s => {
      tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    });
    const tierSummary = Object.entries(tierCounts).map(([t, c]) => t + ':' + c).join(' ');
    
    console.log('  ✅', heroKey, '- skins:', heroSkins.length, tierSummary ? '(' + tierSummary + ')' : '');
  }
  
  // Save
  const outputFile = path.join(outputDir, 'merged-api.json');
  await fs.writeFile(outputFile, JSON.stringify(mergedData, null, 2));
  
  console.log('\n💾 Saved to:', outputFile);
  console.log('📊 Total heroes:', mergedCount);
  
  // Verify
  console.log('\n🔍 Sample skin with tier:');
  const sample = mergedData.main['Angela']?.skins?.[0];
  if (sample) {
    console.log(JSON.stringify(sample, null, 2));
  }
}

mergeWithTiers().catch(console.error);
