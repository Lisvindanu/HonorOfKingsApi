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
      const { name, email } = await parseBody(req);

      if (!name || name.trim().length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Name is required' }));
        return true;
      }

      const result = await db.createContributor({ name: name.trim(), email });

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
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to register contributor' }));
      return true;
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email } = await parseBody(req);

      if (!email) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Email is required' }));
        return true;
      }

      const contributor = await db.getContributorByEmail(email);

      if (!contributor) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Contributor not found' }));
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

  // Route not handled
  return false;
}
