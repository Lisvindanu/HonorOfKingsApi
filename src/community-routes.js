import { generateToken, optionalAuth } from './auth-middleware.js';
import * as db from './community-db.js';

// Helper to parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleCommunityRoutes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // AUTH ROUTES
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const { name, email, password } = await parseBody(req);

      if (!name || name.trim().length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Name is required' }));
        return true;
      }

      if (!email || email.trim().length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Email is required' }));
        return true;
      }

      if (!password || password.length < 6) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Password must be at least 6 characters' }));
        return true;
      }

      const result = await db.createContributor({
        name: name.trim(),
        email: email.trim(),
        password
      });

      if (result.error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }

      const token = generateToken(result.id, result.name);

      res.writeHead(201);
      res.end(JSON.stringify({
        contributor: result,
        token,
      }));
      return true;
    } catch (error) {
      console.error('Register error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to register contributor' }));
      return true;
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await parseBody(req);

      if (!email || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Email and password are required' }));
        return true;
      }

      const contributor = await db.verifyContributorPassword(email.trim(), password);

      if (!contributor) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid email or password' }));
        return true;
      }

      const token = generateToken(contributor.id, contributor.name);

      res.writeHead(200);
      res.end(JSON.stringify({
        contributor,
        token,
      }));
      return true;
    } catch (error) {
      console.error('Login error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to login' }));
      return true;
    }
  }

  // TIER LISTS ROUTES
  if (pathname === '/api/tier-lists' && req.method === 'GET') {
    try {
      const tierLists = await db.getAllTierLists();
      // Sort by newest first
      tierLists.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.writeHead(200);
      res.end(JSON.stringify({ tierLists }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch tier lists' }));
      return true;
    }
  }

  if (pathname === '/api/tier-lists' && req.method === 'POST') {
    try {
      // Parse optional auth
      let user = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { verifyToken } = await import('./auth-middleware.js');
        user = verifyToken(token);
      }

      const { title, creatorName, tiers } = await parseBody(req);

      if (!title || !creatorName || !tiers) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Title, creatorName, and tiers are required' }));
        return true;
      }

      const tierListData = {
        title: title.trim(),
        creatorName: creatorName.trim(),
        creatorId: user ? user.userId : null,
        tiers,
      };

      const tierList = await db.createTierList(tierListData);

      // Update contributor stats if logged in
      if (user && user.userId) {
        await db.incrementContributorTierLists(user.userId);
      }

      res.writeHead(201);
      res.end(JSON.stringify({ tierList }));
      return true;
    } catch (error) {
      console.error('Error creating tier list:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to create tier list' }));
      return true;
    }
  }


  // PUT /api/tier-lists/:id - edit tier list (creator only)
  const tierListEditMatch = pathname.match(/^\/api\/tier-lists\/([^\/]+)$/) ;
  if (tierListEditMatch && req.method === 'PUT') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return true;
      }
      const token = authHeader.split(' ')[1];
      const { verifyToken } = await import('./auth-middleware.js');
      const user = verifyToken(token);
      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return true;
      }

      const id = tierListEditMatch[1];
      const { title, tiers } = await parseBody(req);

      if (!title && !tiers) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Nothing to update' }));
        return true;
      }

      const result = await db.updateTierList(id, { title, tiers }, user);
      if (result.error) {
        const statusCode = result.error === 'Tier list not found' ? 404 : result.error === 'Forbidden' ? 403 : 400;
        res.writeHead(statusCode);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ tierList: result }));
      return true;
    } catch (error) {
      console.error('Error updating tier list:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to update tier list' }));
      return true;
    }
  }

  // VOTE TIER LIST
  if (pathname.match(/^\/api\/tier-lists\/[^\/]+\/vote$/) && req.method === 'POST') {
    try {
      const id = pathname.split('/')[3];

      // Parse optional auth
      let voterId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { verifyToken } = await import('./auth-middleware.js');
        const user = verifyToken(token);
        if (user) voterId = user.userId;
      }

      const result = await db.voteTierList(id, voterId);

      if (result.error) {
        const statusCode = result.error === 'Tier list not found' ? 404 : 400;
        res.writeHead(statusCode);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }

      // Update tier list creator's votes count
      if (result.creatorId) {
        await db.incrementContributorVotes(result.creatorId);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ tierList: result }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to vote' }));
      return true;
    }
  }

  // CONTRIBUTORS ROUTES
  if (pathname === '/api/contributors' && req.method === 'GET') {
    try {
      const contributors = await db.getAllContributors();
      
      // Calculate score and sort
      contributors.forEach(c => {
        c.score = (c.totalContributions || 0) * 5 + (c.totalTierLists || 0) * 10 + (c.totalVotes || 0);
      });
      
      contributors.sort((a, b) => b.score - a.score);

      res.writeHead(200);
      res.end(JSON.stringify({ contributors }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch contributors' }));
      return true;
    }
  }

  // Get contributions for a specific contributor (public endpoint)
  const contributorMatch = pathname.match(/^\/api\/contributors\/(\d+)\/contributions$/);
  if (contributorMatch && req.method === 'GET') {
    try {
      const contributorId = contributorMatch[1];
      const contributions = await db.getContributionsByContributorId(contributorId);
      const contributor = await db.getContributorById(contributorId);
      
      if (!contributor) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Contributor not found' }));
        return true;
      }

      // Also get tier lists for this contributor
      const tierLists = await db.getTierListsByCreatorId(contributorId);

      res.writeHead(200);
      res.end(JSON.stringify({ 
        contributor: {
          id: contributor.id,
          name: contributor.name,
          totalContributions: contributor.totalContributions,
          totalTierLists: contributor.totalTierLists,
          totalVotes: contributor.totalVotes,
          createdAt: contributor.createdAt
        },
        contributions,
        tierLists: tierLists || []
      }));
      return true;
    } catch (error) {
      console.error('Failed to fetch contributor contributions:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch contributions' }));
      return true;
    }
  }

  // USER PROFILE ROUTES (Protected)
  // Get current user profile
  if (pathname === '/api/user/profile' && req.method === 'GET') {
    try {
      const { verifyToken } = await import('./auth-middleware.js');
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return true;
      }

      const contributor = await db.getContributorById(decoded.userId);

      if (!contributor) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'User not found' }));
        return true;
      }

      // Don't send password hash
      const { passwordHash, ...userData } = contributor;

      res.writeHead(200);
      res.end(JSON.stringify(userData));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch profile' }));
      return true;
    }
  }

  // Update user profile
  if (pathname === '/api/user/profile' && req.method === 'PUT') {
    try {
      const { verifyToken } = await import('./auth-middleware.js');
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return true;
      }

      const { name, email } = await parseBody(req);

      const result = await db.updateContributorProfile(decoded.userId, { name, email });

      if (result.error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify(result));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to update profile' }));
      return true;
    }
  }

  // Change password
  if (pathname === '/api/user/password' && req.method === 'PUT') {
    try {
      const { verifyToken } = await import('./auth-middleware.js');
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return true;
      }

      const { currentPassword, newPassword } = await parseBody(req);

      if (!currentPassword || !newPassword) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Current and new password required' }));
        return true;
      }

      if (newPassword.length < 6) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'New password must be at least 6 characters' }));
        return true;
      }

      const result = await db.updateContributorPassword(decoded.userId, currentPassword, newPassword);

      if (result.error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ message: 'Password updated successfully' }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to update password' }));
      return true;
    }
  }

  // Get user contributions
  if (pathname === '/api/user/contributions' && req.method === 'GET') {
    try {
      const { verifyToken } = await import('./auth-middleware.js');
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return true;
      }

      const contributions = await db.getContributionsByContributorId(decoded.userId);

      res.writeHead(200);
      res.end(JSON.stringify({ contributions }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch contributions' }));
      return true;
    }
  }

  // Get user tier lists
  if (pathname === '/api/user/tier-lists' && req.method === 'GET') {
    try {
      const { verifyToken } = await import('./auth-middleware.js');
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return true;
      }

      const tierLists = await db.getTierListsByContributor(decoded.name);

      res.writeHead(200);
      res.end(JSON.stringify({ tierLists }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch tier lists' }));
      return true;
    }
  }


  // COMMENTS ROUTES
  // GET /api/tier-lists/:id/comments
  const commentsGetMatch = pathname.match(/^\/api\/tier-lists\/([^\/]+)\/comments$/);
  if (commentsGetMatch && req.method === 'GET') {
    try {
      const tierListId = commentsGetMatch[1];
      const comments = await db.getCommentsByTierListId(tierListId);
      res.writeHead(200);
      res.end(JSON.stringify({ comments }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch comments' }));
      return true;
    }
  }

  // POST /api/tier-lists/:id/comments
  const commentsPostMatch = pathname.match(/^\/api\/tier-lists\/([^\/]+)\/comments$/);
  if (commentsPostMatch && req.method === 'POST') {
    try {
      const tierListId = commentsPostMatch[1];

      let contributorId = null;
      let verifiedName = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { verifyToken } = await import('./auth-middleware.js');
        const user = verifyToken(token);
        if (user) {
          contributorId = user.userId;
          verifiedName = user.name;
        }
      }

      const body = await parseBody(req);
      const content = (body.content || '').trim();
      const authorName = verifiedName || (body.authorName || '').trim();
      const parentId = body.parentId || null;

      if (!content) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Comment content is required' }));
        return true;
      }
      if (!authorName) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Author name is required' }));
        return true;
      }
      if (content.length > 1000) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Comment too long (max 1000 chars)' }));
        return true;
      }

      const comment = await db.createComment({ tierListId, parentId, contributorId, authorName, content });
      if (!comment) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to create comment' }));
        return true;
      }

      res.writeHead(201);
      res.end(JSON.stringify({ comment }));
      return true;
    } catch (error) {
      console.error('Comment post error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to post comment' }));
      return true;
    }
  }

  // DELETE /api/comments/:id
  const commentDeleteMatch = pathname.match(/^\/api\/comments\/(\d+)$/);
  if (commentDeleteMatch && req.method === 'DELETE') {
    try {
      const commentId = commentDeleteMatch[1];

      const authHeader = req.headers.authorization;
      let requesterId = null;
      let isAdmin = false;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Check if admin token
        const { ADMIN_TOKEN } = await import('./serve-api.js').catch(() => ({}));
        if (token === (process.env.ADMIN_TOKEN || 'admin-secret-token-2024')) {
          isAdmin = true;
        } else {
          const { verifyToken } = await import('./auth-middleware.js');
          const user = verifyToken(token);
          if (user) requesterId = user.userId;
        }
      }

      if (!requesterId && !isAdmin) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      const result = await db.deleteComment(commentId, requesterId, isAdmin);
      if (result.error) {
        const status = result.error === 'Comment not found' ? 404 : result.error === 'Unauthorized' ? 403 : 500;
        res.writeHead(status);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to delete comment' }));
      return true;
    }
  }


  
  // POST /api/feedback - public
  if (pathname === '/api/feedback' && req.method === 'POST') {
    try {
      const { name, category, message } = await parseBody(req);
      if (!message || message.trim().length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Message is required' }));
        return true;
      }
      if (message.length > 2000) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Message too long (max 2000 chars)' }));
        return true;
      }
      const validCategories = ['bug', 'feature', 'suggestion', 'criticism', 'compliment', 'other'];
      if (category && !validCategories.includes(category)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid category' }));
        return true;
      }
      const feedback = await db.submitFeedback({
        name: name ? name.trim() : null,
        category: category || 'other',
        message: message.trim(),
        userAgent: req.headers['user-agent']
      });
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, feedback }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to submit feedback' }));
      return true;
    }
  }

  // GET /api/feedback - admin only
  if (pathname === '/api/feedback' && req.method === 'GET') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }
      const token = authHeader.split(' ')[1];
      if (token !== (process.env.ADMIN_TOKEN || 'admin-secret-token-2024')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return true;
      }
      const feedbacks = await db.getFeedbacks();
      res.writeHead(200);
      res.end(JSON.stringify({ feedbacks }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch feedbacks' }));
      return true;
    }
  }

  // PATCH /api/feedback/:id/read - admin only
  const feedbackReadMatch = pathname.match(/^\/api\/feedback\/(\d+)\/read$/);
  if (feedbackReadMatch && req.method === 'PATCH') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }
      const token = authHeader.split(' ')[1];
      if (token !== (process.env.ADMIN_TOKEN || 'admin-secret-token-2024')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return true;
      }
      await db.markFeedbackRead(feedbackReadMatch[1]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to mark as read' }));
      return true;
    }
  }


  // GET /api/votes - get vote counts + optional voter choice
  if (pathname === '/api/votes' && req.method === 'GET') {
    try {
      const voterId = url.searchParams.get('voterId');
      const counts = await db.getFeatureVoteCounts();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      let myVote = null;
      if (voterId) {
        myVote = await db.getVoterChoice(voterId);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ counts, total, myVote }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch votes' }));
      return true;
    }
  }

  // POST /api/votes - cast or change vote
  if (pathname === '/api/votes' && req.method === 'POST') {
    try {
      const { voterId, feature } = await parseBody(req);
      if (!voterId || !feature) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'voterId and feature required' }));
        return true;
      }
      const result = await db.upsertFeatureVote(voterId, feature);
      if (result.error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: result.error }));
        return true;
      }
      const counts = await db.getFeatureVoteCounts();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, counts, total, myVote: feature }));
      return true;
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to cast vote' }));
      return true;
    }
  }

  // Route not handled
  return false;
}