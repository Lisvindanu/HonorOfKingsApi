// Quick script to add specific heroes without full rescrape
import https from 'https';
import fs from 'fs';
import path from 'path';

const heroIds = process.argv.slice(2).map(Number);

if (heroIds.length === 0) {
  console.log('Usage: node add-hero.mjs <heroId1> <heroId2> ...');
  process.exit(1);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function scrapeHero(heroId) {
  console.log(`Fetching hero ${heroId}...`);
  
  const baseUrl = 'https://api-hok.honorofkings.com/web';
  
  // Fetch hero info
  const infoUrl = `${baseUrl}/herodetail/info?hero_id=${heroId}`;
  const info = await fetchJson(infoUrl);
  
  if (!info.data || info.data.length === 0) {
    console.log(`  ❌ Hero ${heroId} not found`);
    return null;
  }
  
  const heroData = info.data[0];
  
  // Fetch hero stats
  const statsUrl = `${baseUrl}/herostats/one?hero_id=${heroId}`;
  let stats = { winRate: '0%', pickRate: '0%', banRate: '0%', tier: 'C' };
  try {
    const statsRes = await fetchJson(statsUrl);
    if (statsRes.data) {
      stats = {
        winRate: (statsRes.data.win_rate * 100).toFixed(2) + '%',
        pickRate: (statsRes.data.appear_rate * 100).toFixed(2) + '%',
        banRate: (statsRes.data.ban_rate * 100).toFixed(2) + '%',
        tier: statsRes.data.strength_label || 'C'
      };
    }
  } catch (e) {}
  
  // Fetch skills
  const skillUrl = `${baseUrl}/herodetail/skill?hero_id=${heroId}`;
  let skills = [];
  try {
    const skillRes = await fetchJson(skillUrl);
    if (skillRes.data) {
      skills = skillRes.data.map(s => ({
        skillName: s.skill_name,
        cooldown: s.skill_cd ? s.skill_cd.split('/').map(Number) : [0],
        cost: s.skill_consume ? s.skill_consume.split('/').map(Number) : [0],
        skillDesc: s.skill_desc,
        skillImg: s.skill_icon
      }));
    }
  } catch (e) {}
  
  // Fetch recommended equipment
  const equipUrl = `${baseUrl}/herodetail/equip?hero_id=${heroId}`;
  let equipment = [];
  try {
    const equipRes = await fetchJson(equipUrl);
    if (equipRes.data && equipRes.data.equip_list) {
      equipment = equipRes.data.equip_list.map(e => ({
        id: e.equip_id,
        name: e.equip_name,
        icon: e.equip_icon,
        description: e.equip_desc,
        price: e.equip_price || 0,
        isCore: e.is_core === 1
      }));
    }
  } catch (e) {}
  
  // Fetch arcana
  const arcanaUrl = `${baseUrl}/herodetail/rune?hero_id=${heroId}`;
  let arcana = [];
  try {
    const arcanaRes = await fetchJson(arcanaUrl);
    if (arcanaRes.data) {
      arcana = arcanaRes.data.map(a => ({
        id: a.rune_id,
        name: a.rune_name,
        icon: a.rune_icon,
        description: a.rune_desc
      }));
    }
  } catch (e) {}
  
  const hero = {
    title: heroData.hero_name,
    name: heroData.hero_name,
    heroId: heroData.hero_id,
    role: heroData.hero_type_name || 'Unknown',
    lane: heroData.hero_lane_name || 'Unknown',
    icon: heroData.hero_icon,
    banner: heroData.hero_banner || heroData.hero_icon,
    thumbnail: heroData.hero_head || heroData.hero_icon,
    skins: [],
    skill: skills,
    arcana: arcana,
    recommendedEquipment: equipment,
    buildTitle: 'Recommended',
    survivalPercentage: '0%',
    attackPercentage: '0%',
    abilityPercentage: '0%',
    difficultyPercentage: '0%',
    bestPartners: {},
    suppressingHeroes: {},
    suppressedHeroes: {},
    stats: stats,
    world: {
      region: heroData.hero_region || 'Unknown',
      identity: heroData.hero_identity || '',
      energy: heroData.hero_energy || ''
    }
  };
  
  console.log(`  ✅ ${hero.name} scraped`);
  return hero;
}

async function main() {
  const outputPath = path.join(process.cwd(), 'output', 'merged-api.json');
  
  // Load existing data
  let existingData = { main: {} };
  try {
    existingData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  } catch (e) {
    console.log('No existing data found, creating new...');
  }
  
  // Scrape requested heroes
  for (const heroId of heroIds) {
    const hero = await scrapeHero(heroId);
    if (hero) {
      existingData.main[hero.name] = hero;
    }
  }
  
  // Save
  fs.writeFileSync(outputPath, JSON.stringify(existingData, null, 2));
  console.log(`\n✅ Saved to ${outputPath}`);
  console.log(`Total heroes: ${Object.keys(existingData.main).length}`);
}

main().catch(console.error);
