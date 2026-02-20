import fs from 'fs/promises';
import path from 'path';
import emailService from './email-service.js';

async function mergeContribution(contributionId, action = 'approve') {
  console.log(`\n🔄 Processing contribution: ${contributionId}`);
  console.log(`   Action: ${action.toUpperCase()}\n`);

  const contributionsDir = path.join(process.cwd(), 'contributions');
  const pendingDir = path.join(contributionsDir, 'pending');
  const approvedDir = path.join(contributionsDir, 'approved');
  const rejectedDir = path.join(contributionsDir, 'rejected');

  // Ensure directories exist
  await fs.mkdir(approvedDir, { recursive: true });
  await fs.mkdir(rejectedDir, { recursive: true });

  // Find contribution file
  const files = await fs.readdir(pendingDir);
  const contributionFile = files.find(f => f.includes(contributionId));

  if (!contributionFile) {
    throw new Error(`Contribution ${contributionId} not found`);
  }

  const contributionPath = path.join(pendingDir, contributionFile);
  const contribution = JSON.parse(await fs.readFile(contributionPath, 'utf-8'));

  if (action === 'reject') {
    // Move to rejected folder
    const rejectedPath = path.join(rejectedDir, contributionFile);
    contribution.status = 'rejected';
    contribution.reviewedAt = new Date().toISOString();

    await fs.writeFile(rejectedPath, JSON.stringify(contribution, null, 2));
    await fs.unlink(contributionPath);

    console.log(`❌ Contribution rejected and moved to rejected folder\n`);

    // Log to history
    await logHistory(contribution, 'rejected');

    // Send notification
    await emailService.notifyContributionRejected(contribution);

    return { success: true, action: 'rejected' };
  }

  // APPROVE - Merge into main API
  console.log(`📥 Loading main API data...`);
  const outputDir = path.join(process.cwd(), 'output');
  const apiPath = path.join(outputDir, 'merged-api.json');
  const apiData = JSON.parse(await fs.readFile(apiPath, 'utf-8'));

  let merged = false;

  switch (contribution.type) {
    case 'skin':
      merged = await mergeSkin(apiData, contribution.data);
      break;
    case 'hero':
      merged = await mergeHero(apiData, contribution.data);
      break;
    case 'series':
      merged = await mergeSeries(apiData, contribution.data);
      break;
  }

  if (merged) {
    // Save updated API data
    await fs.writeFile(apiPath, JSON.stringify(apiData, null, 2));
    console.log(`💾 Main API updated successfully\n`);

    // Move contribution to approved folder
    const approvedPath = path.join(approvedDir, contributionFile);
    contribution.status = 'approved';
    contribution.reviewedAt = new Date().toISOString();

    await fs.writeFile(approvedPath, JSON.stringify(contribution, null, 2));
    await fs.unlink(contributionPath);

    console.log(`✅ Contribution approved and merged!\n`);

    // Log to history
    await logHistory(contribution, 'approved');

    // Send notification
    await emailService.notifyContributionApproved(contribution);

    return { success: true, action: 'approved', merged: true };
  } else {
    console.log(`⚠️ Merge failed - no changes made\n`);
    return { success: false, error: 'Merge failed' };
  }
}

async function mergeSkin(apiData, skinData) {
  console.log(`🎨 Merging skin: ${skinData.skin.skinName} for hero ID ${skinData.heroId}`);

  // Find hero by ID
  let targetHero = null;
  for (const [heroName, hero] of Object.entries(apiData.main)) {
    if (hero.heroId === skinData.heroId) {
      targetHero = hero;
      console.log(`   Found hero: ${heroName}`);
      break;
    }
  }

  if (!targetHero) {
    console.log(`   ❌ Hero not found with ID ${skinData.heroId}`);
    return false;
  }

  // Check if skin already exists
  const existingSkin = targetHero.skins.find(s =>
    s.skinName.toLowerCase() === skinData.skin.skinName.toLowerCase()
  );

  if (existingSkin) {
    // Update existing skin
    console.log(`   Updating existing skin...`);
    Object.assign(existingSkin, skinData.skin);
  } else {
    // Add new skin
    console.log(`   Adding new skin...`);
    targetHero.skins.push(skinData.skin);
  }

  console.log(`   ✅ Skin merged successfully`);
  return true;
}

async function mergeHero(apiData, heroData) {
  console.log(`👤 Merging hero: ${heroData.name}`);

  // Check if hero exists
  const existingHero = apiData.main[heroData.name.toUpperCase()];

  if (existingHero) {
    console.log(`   Hero already exists, updating data...`);
    Object.assign(existingHero, heroData);
  } else {
    console.log(`   Adding new hero...`);
    apiData.main[heroData.name.toUpperCase()] = {
      ...heroData,
      skins: heroData.skins || []
    };
  }

  console.log(`   ✅ Hero merged successfully`);
  return true;
}

async function mergeSeries(apiData, seriesData) {
  console.log(`📋 Merging series: ${seriesData.seriesName}`);

  // Update all skins in the series
  let updatedCount = 0;

  for (const skinInfo of seriesData.skins) {
    for (const [heroName, hero] of Object.entries(apiData.main)) {
      if (hero.heroId === skinInfo.heroId) {
        const skin = hero.skins.find(s =>
          s.skinName.toLowerCase() === skinInfo.skinName.toLowerCase()
        );

        if (skin) {
          skin.skinSeries = seriesData.seriesName;
          updatedCount++;
          console.log(`   Updated: ${skinInfo.skinName} (${heroName})`);
        }
      }
    }
  }

  console.log(`   ✅ Series merged: ${updatedCount} skins updated`);
  return updatedCount > 0;
}

async function logHistory(contribution, action) {
  const historyDir = path.join(process.cwd(), 'contributions', 'history');
  await fs.mkdir(historyDir, { recursive: true });

  const historyFile = path.join(historyDir, 'history.json');
  let history = [];

  try {
    const existingHistory = await fs.readFile(historyFile, 'utf-8');
    history = JSON.parse(existingHistory);
  } catch (error) {
    // File doesn't exist yet
  }

  history.unshift({
    id: contribution.id,
    type: contribution.type,
    action,
    submittedAt: contribution.submittedAt,
    reviewedAt: new Date().toISOString(),
    data: contribution.data
  });

  // Keep only last 1000 entries
  if (history.length > 1000) {
    history = history.slice(0, 1000);
  }

  await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
}

// CLI usage
const contributionId = process.argv[2];
const action = process.argv[3] || 'approve';

if (!contributionId) {
  console.log('Usage: node merge-contribution.js <contribution-id> [approve|reject]');
  console.log('Example: node merge-contribution.js skin-1771604157105 approve');
  process.exit(1);
}

mergeContribution(contributionId, action)
  .then(result => {
    console.log('✨ Done!', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
