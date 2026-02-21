import fs from 'fs/promises';
import path from 'path';
import emailService from './email-service.js';
import * as communityDb from './community-db.js';

async function mergeContribution(contributionId, action = 'approve') {
  const contributionsDir = path.join(process.cwd(), 'contributions');
  const pendingDir = path.join(contributionsDir, 'pending');
  const approvedDir = path.join(contributionsDir, 'approved');
  const rejectedDir = path.join(contributionsDir, 'rejected');

  await fs.mkdir(approvedDir, { recursive: true });
  await fs.mkdir(rejectedDir, { recursive: true });

  const files = await fs.readdir(pendingDir);
  const contributionFile = files.find(f => f.includes(contributionId));
  if (!contributionFile) throw new Error('Contribution not found');

  const contributionPath = path.join(pendingDir, contributionFile);
  const contribution = JSON.parse(await fs.readFile(contributionPath, 'utf-8'));

  if (action === 'reject') {
    contribution.status = 'rejected';
    contribution.reviewedAt = new Date().toISOString();
    await fs.writeFile(path.join(rejectedDir, contributionFile), JSON.stringify(contribution, null, 2));
    await fs.unlink(contributionPath);
    await logHistory(contribution, 'rejected');
    await emailService.notifyContributionRejected(contribution);
    // Update database status if contribution has contributorId
    if (contribution.contributorId) {
      await communityDb.updateContributionStatusByData(contribution.contributorId, contribution.data, 'rejected');
    }
    return { success: true, action: 'rejected' };
  }

  const apiPath = path.join(process.cwd(), 'output', 'merged-api.json');
  const apiData = JSON.parse(await fs.readFile(apiPath, 'utf-8'));

  let merged = false;
  switch (contribution.type) {
    case 'skin': merged = await mergeSkin(apiData, contribution.data); break;
    case 'hero': merged = await mergeHero(apiData, contribution.data); break;
    case 'series': merged = await mergeSeries(apiData, contribution.data); break;
    case 'counter': merged = await mergeCounter(apiData, contribution.data); break;
  }

  if (merged) {
    await fs.writeFile(apiPath, JSON.stringify(apiData, null, 2));
    contribution.status = 'approved';
    contribution.reviewedAt = new Date().toISOString();
    await fs.writeFile(path.join(approvedDir, contributionFile), JSON.stringify(contribution, null, 2));
    await fs.unlink(contributionPath);
    await logHistory(contribution, 'approved');
    await emailService.notifyContributionApproved(contribution);
    // Update database status if contribution has contributorId
    if (contribution.contributorId) {
      await communityDb.updateContributionStatusByData(contribution.contributorId, contribution.data, 'approved');
    }
    return { success: true, action: 'approved', merged: true };
  }
  return { success: false, error: 'Merge failed' };
}

async function mergeSkin(apiData, skinData) {
  let targetHero = null;
  for (const [, hero] of Object.entries(apiData.main)) {
    if (hero.heroId === skinData.heroId) { targetHero = hero; break; }
  }
  if (!targetHero) return false;
  const existingSkin = targetHero.skins.find(s => s.skinName.toLowerCase() === skinData.skin.skinName.toLowerCase());
  if (existingSkin) Object.assign(existingSkin, skinData.skin);
  else targetHero.skins.push(skinData.skin);
  return true;
}

async function mergeHero(apiData, heroData) {
  const key = heroData.name.toUpperCase();
  if (apiData.main[key]) Object.assign(apiData.main[key], heroData);
  else apiData.main[key] = { ...heroData, skins: heroData.skins || [] };
  return true;
}

async function mergeSeries(apiData, seriesData) {
  let count = 0;
  for (const skinInfo of seriesData.skins) {
    for (const [, hero] of Object.entries(apiData.main)) {
      if (hero.heroId === skinInfo.heroId) {
        const skin = hero.skins.find(s => s.skinName.toLowerCase() === skinInfo.skinName.toLowerCase());
        if (skin) { skin.skinSeries = seriesData.seriesName; count++; }
      }
    }
  }
  return count > 0;
}

async function mergeCounter(apiData, counterData) {
  // Find the primary hero
  let primaryHero = null;
  let primaryHeroKey = null;
  for (const [key, hero] of Object.entries(apiData.main)) {
    if (key.toLowerCase() === counterData.heroName.toLowerCase()) {
      primaryHero = hero;
      primaryHeroKey = key;
      break;
    }
  }
  if (!primaryHero) return false;

  const { action, relationshipType, targetHeroName, targetHeroIcon, applyInverse, heroIcon } = counterData;
  
  // Ensure hero objects have required properties
  if (!primaryHero.suppressingHeroes) primaryHero.suppressingHeroes = {};
  if (!primaryHero.suppressedHeroes) primaryHero.suppressedHeroes = {};
  if (!primaryHero.bestPartners) primaryHero.bestPartners = {};

  const data = { name: targetHeroName, thumbnail: targetHeroIcon || '', description: counterData.description || '', url: '' };

  // Apply primary relationship
  if (action === 'add') {
    if (relationshipType === 'strongAgainst') primaryHero.suppressingHeroes[targetHeroName] = data;
    else if (relationshipType === 'weakAgainst') primaryHero.suppressedHeroes[targetHeroName] = data;
    else if (relationshipType === 'bestPartner') primaryHero.bestPartners[targetHeroName] = data;
  } else if (action === 'remove') {
    if (relationshipType === 'strongAgainst') delete primaryHero.suppressingHeroes[targetHeroName];
    else if (relationshipType === 'weakAgainst') delete primaryHero.suppressedHeroes[targetHeroName];
    else if (relationshipType === 'bestPartner') delete primaryHero.bestPartners[targetHeroName];
  }

  // Apply inverse relationship if requested
  if (applyInverse) {
    let inverseHero = null;
    for (const [key, hero] of Object.entries(apiData.main)) {
      if (key.toLowerCase() === targetHeroName.toLowerCase()) {
        inverseHero = hero;
        break;
      }
    }
    
    if (inverseHero) {
      if (!inverseHero.suppressingHeroes) inverseHero.suppressingHeroes = {};
      if (!inverseHero.suppressedHeroes) inverseHero.suppressedHeroes = {};
      
      const inverseData = { 
        name: counterData.heroName, 
        thumbnail: heroIcon || '', 
        description: counterData.description || '', 
        url: '' 
      };

      if (!inverseHero.bestPartners) inverseHero.bestPartners = {};
      
      if (action === 'add') {
        // weakAgainst -> inverse is strongAgainst
        // strongAgainst -> inverse is weakAgainst
        // bestPartner -> inverse is bestPartner
        if (relationshipType === 'weakAgainst') {
          inverseHero.suppressingHeroes[counterData.heroName] = inverseData;
          console.log(`  ↔ Also added ${counterData.heroName} to ${targetHeroName}'s Strong Against`);
        } else if (relationshipType === 'strongAgainst') {
          inverseHero.suppressedHeroes[counterData.heroName] = inverseData;
          console.log(`  ↔ Also added ${counterData.heroName} to ${targetHeroName}'s Weak Against`);
        } else if (relationshipType === 'bestPartner') {
          inverseHero.bestPartners[counterData.heroName] = inverseData;
          console.log(`  ↔ Also added ${counterData.heroName} to ${targetHeroName}'s Best Partner`);
        }
      } else if (action === 'remove') {
        if (relationshipType === 'weakAgainst') {
          delete inverseHero.suppressingHeroes[counterData.heroName];
          console.log(`  ↔ Also removed ${counterData.heroName} from ${targetHeroName}'s Strong Against`);
        } else if (relationshipType === 'strongAgainst') {
          delete inverseHero.suppressedHeroes[counterData.heroName];
          console.log(`  ↔ Also removed ${counterData.heroName} from ${targetHeroName}'s Weak Against`);
        } else if (relationshipType === 'bestPartner') {
          delete inverseHero.bestPartners[counterData.heroName];
          console.log(`  ↔ Also removed ${counterData.heroName} from ${targetHeroName}'s Best Partner`);
        }
      }
    }
  }

  return true;
}

async function logHistory(contribution, action) {
  const historyFile = path.join(process.cwd(), 'contributions', 'history', 'history.json');
  await fs.mkdir(path.dirname(historyFile), { recursive: true });
  let history = [];
  try { history = JSON.parse(await fs.readFile(historyFile, 'utf-8')); } catch {}
  history.unshift({ id: contribution.id, type: contribution.type, action, submittedAt: contribution.submittedAt, reviewedAt: new Date().toISOString(), data: contribution.data });
  if (history.length > 1000) history = history.slice(0, 1000);
  await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
}

const [,, contributionId, action = 'approve'] = process.argv;
if (!contributionId) { console.log('Usage: node merge-contribution.js <id> [approve|reject]'); process.exit(1); }
mergeContribution(contributionId, action).then(r => { console.log('Done!', r); process.exit(0); }).catch(e => { console.error('Error:', e.message); process.exit(1); });
