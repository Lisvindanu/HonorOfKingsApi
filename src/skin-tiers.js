/**
 * Skin Tier Classification System for Honor of Kings Global
 * Based on official tier system updated for 2026
 */

// Main Tiers
export const SKIN_TIERS = {
  NO_TAG: { name: 'No Tag', color: '#9CA3AF', features: ['Appearance'] },
  RARE: { name: 'Rare', color: '#3B82F6', features: ['Appearance', 'Skill Effect'] },
  EPIC: { name: 'Epic', color: '#8B5CF6', features: ['Appearance', 'Skill Effect', 'Entrance', 'Background', 'Voice Lines', 'Sound Effect'] },
  LEGEND: { name: 'Legend', color: '#F59E0B', features: ['Appearance', 'Skill Effect', 'Entrance', 'Background', 'Voice Lines', 'Sound Effect', 'Recall', 'Idle Animation', 'Spawn', 'Gift', 'Animated Art'] },
  PRECIOUS: { name: 'Precious', color: '#EC4899', features: ['Appearance', 'Skill Effect', 'Entrance', 'Background', 'Voice Lines', 'Sound Effect', 'Recall', 'Idle Animation', 'Spawn', 'Gift', 'Animated Art', 'Exclusive VFX'] },
  MYTHIC: { name: 'Mythic', color: '#EF4444', features: ['Appearance', 'Skill Effect', 'Entrance', 'Background', 'Voice Lines', 'Sound Effect', 'Recall', 'Idle Animation', 'Spawn', 'Gift', 'Animated Art', 'Easter Egg', 'Death Animation', 'Special Animation'] },
  FLAWLESS: { name: 'Flawless', color: '#F472B6', features: ['Appearance', 'Skill Effect', 'Entrance', 'Background', 'Voice Lines', 'Sound Effect', 'Recall', 'Idle Animation', 'Spawn', 'Gift', 'Animated Art', 'Tower Finisher', 'Trail Animation', 'Kill Animation', 'Second Splash Art'] }
};

// Special Tags
export const SPECIAL_TAGS = {
  BLESSED: { name: 'Blessed', color: '#A855F7', description: 'Gacha event exclusive' },
  NOBILITY: { name: 'Nobility', color: '#FBBF24', description: 'Nobility system reward' },
  EVENT: { name: 'Event', color: '#10B981', description: 'Free limited event' },
  LIMITED: { name: 'Limited', color: '#F97316', description: 'Limited time purchase' },
  HONOR_PASS: { name: 'Honor Pass', color: '#6366F1', description: 'Honor Pass reward' },
  WORLDLY: { name: 'Worldly', color: '#14B8A6', description: 'Cultural representation' },
  SEASON: { name: 'Season', color: '#64748B', description: 'Ranked season reward' },
  CHARMED: { name: 'Charmed', color: '#D946EF', description: 'Limited time Epic' },
  KIC: { name: 'KIC', color: '#DC2626', description: 'Tournament exclusive' },
  GRANDMASTER: { name: 'Grandmaster', color: '#B91C1C', description: 'Grandmaster rank reward' },
  KINGS_DEED: { name: "King's Deed", color: '#7C3AED', description: 'Annual ranked reward' },
  REPUTATION: { name: 'Reputation', color: '#0EA5E9', description: 'Reputation system reward' }
};

// Collaboration Tags
export const COLLAB_TAGS = {
  SAINT_SEIYA: { name: 'Saint Seiya', color: '#FFD700' },
  SAILOR_MOON: { name: 'Sailor Moon', color: '#FF69B4' },
  SANRIO: { name: 'Sanrio Characters', color: '#FF6B6B' },
  JUJUTSU_KAISEN: { name: 'Jujutsu Kaisen', color: '#1E3A5F' },
  BLEACH: { name: 'Bleach: TYBW', color: '#FF4500' },
  DETECTIVE_CONAN: { name: 'Detective Conan', color: '#1E90FF' },
  FROZEN: { name: "Disney's Frozen", color: '#87CEEB' },
  SNK: { name: 'SNK', color: '#8B0000' },
  LORD_MYSTERIES: { name: 'Lord of the Mysteries', color: '#4B0082' }
};

// Series to Tier/Tag Mapping
export const SERIES_MAPPING = {
  // Collaboration series
  'DETECTIVE CONAN': { tier: 'EPIC', collab: 'DETECTIVE_CONAN' },
  'PRETTY GUARDIAN SAILOR MOON COSMOS THE MOVIE COLLAB': { tier: 'EPIC', collab: 'SAILOR_MOON' },
  'SNK': { tier: 'EPIC', collab: 'SNK' },
  
  // Event/Theme series - typically EPIC
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
  'SHI YI\'S TALE': { tier: 'LEGEND' },
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

// Known Mythic/Flawless skins by name
export const SPECIAL_SKINS = {
  // Flawless skins (gacha exclusive)
  'Eternal Night': { tier: 'FLAWLESS', hero: 'Yaria' },
  'Nine-Tailed Fox': { tier: 'FLAWLESS', hero: 'Daji' },
  'Swan Princess': { tier: 'FLAWLESS', hero: 'Xiao Qiao' },
  'Drunken Swordsman': { tier: 'FLAWLESS', hero: 'Li Bai' },
  
  // Mythic skins (Honor Crystal)
  'Frostfire Dragon': { tier: 'MYTHIC' },
  'Time Keeper': { tier: 'MYTHIC' },
  
  // Precious skins (Treasure Legend)
  // Add more as needed
};

/**
 * Determine skin tier based on available data
 */
export function getSkinTier(skinName, skinSeries) {
  // Check special skins first
  if (SPECIAL_SKINS[skinName]) {
    return SPECIAL_SKINS[skinName].tier;
  }
  
  // Check series mapping
  if (skinSeries && SERIES_MAPPING[skinSeries]) {
    return SERIES_MAPPING[skinSeries].tier;
  }
  
  // Default to EPIC for named skins, RARE for basic
  return skinSeries ? 'EPIC' : 'RARE';
}

/**
 * Get skin tags (collab, special, etc.)
 */
export function getSkinTags(skinName, skinSeries) {
  const tags = [];
  
  if (skinSeries && SERIES_MAPPING[skinSeries]) {
    const mapping = SERIES_MAPPING[skinSeries];
    if (mapping.collab) tags.push({ type: 'collab', value: mapping.collab });
    if (mapping.tag) tags.push({ type: 'special', value: mapping.tag });
  }
  
  return tags;
}

export default {
  SKIN_TIERS,
  SPECIAL_TAGS,
  COLLAB_TAGS,
  SERIES_MAPPING,
  SPECIAL_SKINS,
  getSkinTier,
  getSkinTags
};
