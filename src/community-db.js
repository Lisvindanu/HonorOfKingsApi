import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import bcrypt from 'bcrypt';
const { Pool } = pg;

const SALT_ROUNDS = 10;

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hokhub',
  password: 'password',
  port: 5432,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('PostgreSQL connection error:', err);
  } else {
    console.log('PostgreSQL connected successfully');
  }
});

// JSON storage for tier lists
const DB_DIR = path.join(process.cwd(), 'community-data');
const TIER_LISTS_FILE = path.join(DB_DIR, 'tier-lists.json');

// Ensure tier lists directory exists
async function ensureTierListsExists() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });

    try {
      await fs.access(TIER_LISTS_FILE);
    } catch {
      await fs.writeFile(TIER_LISTS_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Failed to initialize tier lists storage:', error);
  }
}

// Generic read/write for tier lists
async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return [];
  }
}

async function writeJSON(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);
    return false;
  }
}

// ============ TIER LISTS (JSON) ============
export async function getAllTierLists() {
  await ensureTierListsExists();
  return await readJSON(TIER_LISTS_FILE);
}

export async function getTierListById(id) {
  const tierLists = await getAllTierLists();
  return tierLists.find(t => t.id === id);
}

export async function createTierList(tierListData) {
  await ensureTierListsExists();
  const tierLists = await getAllTierLists();

  const newTierList = {
    id: Date.now().toString(),
    ...tierListData,
    votes: 0,
    votedBy: [],
    createdAt: new Date().toISOString(),
  };

  tierLists.push(newTierList);
  await writeJSON(TIER_LISTS_FILE, tierLists);

  return newTierList;
}

export async function voteTierList(id, voterId) {
  await ensureTierListsExists();
  const tierLists = await getAllTierLists();
  const tierList = tierLists.find(t => t.id === id);

  if (!tierList) {
    return { error: 'Tier list not found' };
  }

  const voterKey = voterId || 'anonymous';
  if (tierList.votedBy.includes(voterKey)) {
    return { error: 'Already voted' };
  }

  tierList.votes++;
  tierList.votedBy.push(voterKey);

  await writeJSON(TIER_LISTS_FILE, tierLists);

  return tierList;
}


export async function updateTierList(id, updates, requesterId) {
  await ensureTierListsExists();
  const tierLists = await getAllTierLists();
  const idx = tierLists.findIndex(t => t.id === id);

  if (idx === -1) return { error: 'Tier list not found' };

  const tierList = tierLists[idx];

  // Ownership check: match by creatorId or creatorName
  const isOwner =
    (tierList.creatorId && tierList.creatorId === requesterId.userId) ||
    (tierList.creatorName && tierList.creatorName === requesterId.name);

  if (!isOwner) return { error: 'Forbidden' };

  if (updates.title) tierList.title = updates.title.trim();
  if (updates.tiers) tierList.tiers = updates.tiers;
  tierList.updatedAt = new Date().toISOString();

  await writeJSON(TIER_LISTS_FILE, tierLists);
  return tierList;
}

// ============ CONTRIBUTORS (PostgreSQL) ============
export async function getAllContributors() {
  try {
    const result = await pool.query(
      'SELECT id, name, email, total_contributions, total_tier_lists, total_votes, created_at FROM contributors ORDER BY (total_contributions * 5 + total_tier_lists * 10 + total_votes) DESC'
    );
    return result.rows.map(row => ({
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Failed to get contributors:', error);
    return [];
  }
}

export async function getContributorById(id) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, total_contributions, total_tier_lists, total_votes, created_at FROM contributors WHERE id = $1',
      [parseInt(id)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to get contributor by id:', error);
    return null;
  }
}

export async function getContributorByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM contributors WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to get contributor by email:', error);
    return null;
  }
}

export async function createContributor(contributorData) {
  try {
    // Check if email already exists
    if (!contributorData.email) {
      return { error: 'Email is required' };
    }

    if (!contributorData.password) {
      return { error: 'Password is required' };
    }

    const existing = await getContributorByEmail(contributorData.email);
    if (existing) {
      return { error: 'Email already registered' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(contributorData.password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO contributors (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [contributorData.name, contributorData.email, passwordHash]
    );

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to create contributor:', error);
    return { error: 'Failed to create contributor' };
  }
}

export async function verifyContributorPassword(email, password) {
  try {
    const contributor = await getContributorByEmail(email);
    if (!contributor || !contributor.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, contributor.passwordHash);
    if (!isValid) {
      return null;
    }

    // Return contributor without password hash
    return {
      id: contributor.id,
      name: contributor.name,
      email: contributor.email,
      totalContributions: contributor.totalContributions,
      totalTierLists: contributor.totalTierLists,
      totalVotes: contributor.totalVotes,
      createdAt: contributor.createdAt,
    };
  } catch (error) {
    console.error('Failed to verify password:', error);
    return null;
  }
}

export async function updateContributorStats(id, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.totalTierLists !== undefined) {
      fields.push(`total_tier_lists = $${paramCount++}`);
      values.push(updates.totalTierLists);
    }
    if (updates.totalVotes !== undefined) {
      fields.push(`total_votes = $${paramCount++}`);
      values.push(updates.totalVotes);
    }
    if (updates.totalContributions !== undefined) {
      fields.push(`total_contributions = $${paramCount++}`);
      values.push(updates.totalContributions);
    }

    if (fields.length === 0) return null;

    values.push(parseInt(id));

    const result = await pool.query(
      `UPDATE contributors SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to update contributor stats:', error);
    return null;
  }
}

export async function incrementContributorTierLists(id) {
  try {
    const result = await pool.query(
      'UPDATE contributors SET total_tier_lists = total_tier_lists + 1 WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to increment tier lists:', error);
    return null;
  }
}

export async function incrementContributorVotes(id) {
  try {
    const result = await pool.query(
      'UPDATE contributors SET total_votes = total_votes + 1 WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to increment votes:', error);
    return null;
  }
}

export async function incrementContributorContributions(id) {
  try {
    const result = await pool.query(
      'UPDATE contributors SET total_contributions = total_contributions + 1 WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions,
      totalTierLists: row.total_tier_lists,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to increment contributions:', error);
    return null;
  }
}

// ============ CONTRIBUTIONS (PostgreSQL) ============
export async function createContribution(contributionData) {
  try {
    const result = await pool.query(
      'INSERT INTO contributions (contributor_id, type, data, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [
        contributionData.contributorId ? parseInt(contributionData.contributorId) : null,
        contributionData.type,
        JSON.stringify(contributionData.data),
        contributionData.status || 'pending'
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      contributorId: row.contributor_id?.toString(),
      type: row.type,
      data: row.data,
      status: row.status,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to create contribution:', error);
    return { error: 'Failed to create contribution' };
  }
}

export async function getPendingContributions() {
  try {
    const result = await pool.query(
      'SELECT * FROM contributions WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      contributorId: row.contributor_id?.toString(),
      type: row.type,
      data: row.data,
      status: row.status,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Failed to get pending contributions:', error);
    return [];
  }
}

export async function approveContribution(id) {
  try {
    const result = await pool.query(
      'UPDATE contributions SET status = $1 WHERE id = $2 RETURNING *',
      ['approved', parseInt(id)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      contributorId: row.contributor_id?.toString(),
      type: row.type,
      data: row.data,
      status: row.status,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to approve contribution:', error);
    return null;
  }
}

export async function rejectContribution(id) {
  try {
    const result = await pool.query(
      'UPDATE contributions SET status = $1 WHERE id = $2 RETURNING *',
      ['rejected', parseInt(id)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      contributorId: row.contributor_id?.toString(),
      type: row.type,
      data: row.data,
      status: row.status,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to reject contribution:', error);
    return null;
  }
}

// Initialize tier lists storage
ensureTierListsExists();
// Update contributor profile (name, email)
export async function updateContributorProfile(id, updates) {
  try {
    const { name, email } = updates;
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      fields.push(`name = \$${paramCount++}`);
      values.push(name);
    }

    if (email !== undefined) {
      // Check if email already exists for another user
      const existing = await getContributorByEmail(email);
      if (existing && existing.id !== id) {
        return { error: 'Email already in use' };
      }
      fields.push(`email = \$${paramCount++}`);
      values.push(email);
    }

    if (fields.length === 0) {
      return { error: 'No fields to update' };
    }

    values.push(parseInt(id));
    const query = `UPDATE contributors SET ${fields.join(', ')} WHERE id = \$${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return { error: 'Contributor not found' };
    }

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      totalContributions: row.total_contributions || 0,
      totalTierLists: row.total_tier_lists || 0,
      totalVotes: row.total_votes || 0,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Failed to update contributor profile:', error);
    return { error: 'Database error' };
  }
}

// Update contributor password
export async function updateContributorPassword(id, currentPassword, newPassword) {
  try {
    const contributor = await getContributorById(id);
    if (!contributor) {
      return { error: 'Contributor not found' };
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, contributor.passwordHash);
    if (!isValid) {
      return { error: 'Current password is incorrect' };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await pool.query(
      'UPDATE contributors SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, parseInt(id)]
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to update password:', error);
    return { error: 'Database error' };
  }
}

// Get contributions by contributor ID
export async function getContributionsByContributorId(contributorId) {
  try {
    const result = await pool.query(
      'SELECT * FROM contributions WHERE contributor_id = $1 ORDER BY created_at DESC',
      [parseInt(contributorId)]
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      contributorId: row.contributor_id?.toString(),
      type: row.type,
      data: row.data,
      status: row.status,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Failed to get contributions by contributor:', error);
    return [];
  }
}

// Get tier lists by contributor name
export async function getTierListsByContributor(contributorName) {
  await ensureTierListsExists();
  const tierLists = await getAllTierLists();
  return tierLists.filter(t => t.creatorName === contributorName);
}

// Get tier lists by creator ID
export async function getTierListsByCreatorId(creatorId) {
  try {
    const result = await pool.query(
      'SELECT * FROM tier_lists WHERE creator_id = $1 ORDER BY created_at DESC',
      [parseInt(creatorId)]
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      title: row.title,
      creatorName: row.creator_name,
      tiers: row.tiers,
      votes: row.votes || 0,
      votedBy: row.voted_by || [],
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Failed to get tier lists by creator:', error);
    return [];
  }
}

// Update contribution status by matching data
export async function updateContributionStatusByData(contributorId, contributionData, newStatus) {
  try {
    // For counter type, match by heroName and targetHeroName
    if (contributionData.heroName && contributionData.targetHeroName) {
      const result = await pool.query(
        `UPDATE contributions 
         SET status = $1 
         WHERE contributor_id = $2 
         AND data->>'heroName' = $3 
         AND data->>'targetHeroName' = $4
         AND status = 'pending'
         RETURNING *`,
        [newStatus, parseInt(contributorId), contributionData.heroName, contributionData.targetHeroName]
      );
      
      if (result.rows.length > 0) {
        console.log(`Updated contribution status to ${newStatus} for heroName=${contributionData.heroName}, targetHeroName=${contributionData.targetHeroName}`);
        return result.rows[0];
      }
    }
    
    // For skin-edit type, match by heroName and skinName
    if (contributionData.heroName && contributionData.skinName) {
      const skinResult = await pool.query(
        `UPDATE contributions 
         SET status = $1 
         WHERE id = (
           SELECT id FROM contributions
           WHERE contributor_id = $2
           AND data->>'heroName' = $3
           AND data->>'skinName' = $4
           AND status = 'pending'
           ORDER BY created_at DESC
           LIMIT 1
         )
         RETURNING *`,
        [newStatus, parseInt(contributorId), contributionData.heroName, contributionData.skinName]
      );
      if (skinResult.rows.length > 0) {
        return skinResult.rows[0];
      }
    }

    // Generic fallback: match most recent pending contribution
    const result = await pool.query(
      `UPDATE contributions 
       SET status = $1 
       WHERE id = (
         SELECT id FROM contributions
         WHERE contributor_id = $2
         AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING *`,
      [newStatus, parseInt(contributorId)]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Failed to update contribution status:', error);
    return null;
  }
}

// ============ COMMENTS (PostgreSQL) ============

export async function getCommentsByTierListId(tierListId) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.tier_list_id, c.parent_id, c.contributor_id, c.author_name, c.content, c.created_at,
              contrib.name AS contributor_display_name
       FROM comments c
       LEFT JOIN contributors contrib ON c.contributor_id = contrib.id
       WHERE c.tier_list_id = $1
       ORDER BY c.created_at ASC`,
      [tierListId]
    );
    return result.rows.map(row => ({
      id: row.id,
      tierListId: row.tier_list_id,
      parentId: row.parent_id,
      contributorId: row.contributor_id,
      authorName: row.contributor_display_name || row.author_name,
      content: row.content,
      createdAt: row.created_at,
      isVerified: !!row.contributor_id,
    }));
  } catch (error) {
    console.error('Failed to get comments:', error);
    return [];
  }
}

export async function createComment({ tierListId, parentId, contributorId, authorName, content }) {
  try {
    const result = await pool.query(
      `INSERT INTO comments (tier_list_id, parent_id, contributor_id, author_name, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tierListId, parentId || null, contributorId || null, authorName, content]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      tierListId: row.tier_list_id,
      parentId: row.parent_id,
      contributorId: row.contributor_id,
      authorName: row.author_name,
      content: row.content,
      createdAt: row.created_at,
      isVerified: !!row.contributor_id,
    };
  } catch (error) {
    console.error('Failed to create comment:', error);
    return null;
  }
}

export async function deleteComment(id, requesterId, isAdmin) {
  try {
    const existing = await pool.query(`SELECT * FROM comments WHERE id = $1`, [parseInt(id)]);
    if (existing.rows.length === 0) return { error: 'Comment not found' };
    const comment = existing.rows[0];
    if (!isAdmin && comment.contributor_id !== parseInt(requesterId)) {
      return { error: 'Unauthorized' };
    }
    await pool.query(`DELETE FROM comments WHERE id = $1`, [parseInt(id)]);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete comment:', error);
    return { error: 'Database error' };
  }
}

// FEEDBACK
export async function submitFeedback({ name, category, message, userAgent }) {
  try {
    const result = await pool.query(
      'INSERT INTO feedback (name, category, message, user_agent) VALUES ($1, $2, $3, $4) RETURNING *',
      [name || 'Anonymous', category || 'other', message, userAgent || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('submitFeedback error:', error);
    return null;
  }
}

export async function getFeedbacks(limit = 200) {
  try {
    const result = await pool.query(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('getFeedbacks error:', error);
    return [];
  }
}

export async function markFeedbackRead(id) {
  try {
    await pool.query('UPDATE feedback SET is_read = TRUE WHERE id = $1', [id]);
    return true;
  } catch (error) {
    return false;
  }
}

// FEATURE VOTES
export async function getFeatureVoteCounts() {
  try {
    const result = await pool.query(
      'SELECT feature, COUNT(*) as count FROM feature_votes GROUP BY feature'
    );
    const counts = { playground: 0, 'item-synergy': 0, 'dev-talk': 0 };
    for (const row of result.rows) {
      counts[row.feature] = parseInt(row.count);
    }
    return counts;
  } catch (error) {
    console.error('getFeatureVoteCounts error:', error);
    return { playground: 0, 'item-synergy': 0, 'dev-talk': 0 };
  }
}

export async function upsertFeatureVote(voterId, feature) {
  try {
    const valid = ['playground', 'item-synergy', 'dev-talk'];
    if (!valid.includes(feature)) return { error: 'Invalid feature' };
    await pool.query(
      'INSERT INTO feature_votes (voter_id, feature) VALUES ($1, $2) ON CONFLICT (voter_id) DO UPDATE SET feature = $2, updated_at = NOW()',
      [voterId, feature]
    );
    return { success: true };
  } catch (error) {
    console.error('upsertFeatureVote error:', error);
    return { error: 'Database error' };
  }
}

export async function getVoterChoice(voterId) {
  try {
    const result = await pool.query(
      'SELECT feature FROM feature_votes WHERE voter_id = $1',
      [voterId]
    );
    return result.rows[0]?.feature || null;
  } catch (error) {
    return null;
  }
}
