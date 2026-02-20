import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import emailService from './email-service.js';
import { handleCommunityRoutes } from "./community-routes.js";

const execPromise = promisify(exec);
const PORT = process.env.PORT || 8090;

// Simple auth token (in production, use proper auth)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-token-2024';

async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  // Main API endpoints
  if (req.url === '/api/hok' || req.url === '/' || req.url === '/api') {
    try {
      const filePath = path.join(process.cwd(), 'output', 'merged-api.json');
      const data = await fs.readFile(filePath, 'utf-8');
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'API data not ready yet. Please run scraper first.' }));
    }
  }

  // Submit contribution
  else if (req.url === '/api/contribute' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const contribution = JSON.parse(body);

        // Validate
        if (!contribution.type || !contribution.data) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing required fields: type and data' }));
          return;
        }

        if (!['skin', 'hero', 'series'].includes(contribution.type)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid type. Must be: skin, hero, or series' }));
          return;
        }

        // Save to pending
        const contributionsDir = path.join(process.cwd(), 'contributions', 'pending');
        await fs.mkdir(contributionsDir, { recursive: true });

        const timestamp = Date.now();
        const id = `${contribution.type}-${timestamp}`;
        const filename = `${id}.json`;
        const filepath = path.join(contributionsDir, filename);

        const contributionData = {
          ...contribution,
          submittedAt: new Date().toISOString(),
          status: 'pending',
          id
        };

        await fs.writeFile(filepath, JSON.stringify(contributionData, null, 2));

        console.log(`✅ New contribution: ${filename}`);

        // Send notification
        await emailService.notifyContributionReceived(contributionData).catch(err =>
          console.error('Email notification failed:', err)
        );

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: 'Contribution submitted successfully',
          id
        }));

      } catch (error) {
        console.error('Error processing contribution:', error);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON or processing error' }));
      }
    });
  }

  // List pending contributions
  else if (req.url === '/api/contributions/pending' && req.method === 'GET') {
    try {
      const contributionsDir = path.join(process.cwd(), 'contributions', 'pending');
      await fs.mkdir(contributionsDir, { recursive: true });

      const files = await fs.readdir(contributionsDir);
      const contributions = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(contributionsDir, file), 'utf-8');
          contributions.push(JSON.parse(content));
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        count: contributions.length,
        contributions: contributions.sort((a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )
      }));
    } catch (error) {
      console.error('Error listing contributions:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to list contributions' }));
    }
  }

  // Approve contribution
  else if (req.url.startsWith('/api/contributions/approve/') && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const contributionId = req.url.split('/').pop();

    try {
      // Run merge script
      const { stdout, stderr } = await execPromise(
        `node src/merge-contribution.js ${contributionId} approve`
      );

      console.log(stdout);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Contribution approved and merged',
        contributionId
      }));
    } catch (error) {
      console.error('Merge error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to merge contribution', details: error.message }));
    }
  }

  // Reject contribution
  else if (req.url.startsWith('/api/contributions/reject/') && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const contributionId = req.url.split('/').pop();

    try {
      // Run merge script with reject action
      const { stdout, stderr } = await execPromise(
        `node src/merge-contribution.js ${contributionId} reject`
      );

      console.log(stdout);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Contribution rejected',
        contributionId
      }));
    } catch (error) {
      console.error('Reject error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to reject contribution', details: error.message }));
    }
  }

  // Get contribution history
  else if (req.url === '/api/contributions/history' && req.method === 'GET') {
    try {
      const historyFile = path.join(process.cwd(), 'contributions', 'history', 'history.json');

      try {
        const history = await fs.readFile(historyFile, 'utf-8');
        res.writeHead(200);
        res.end(history);
      } catch (error) {
        // No history yet
        res.writeHead(200);
        res.end(JSON.stringify([]));
      }
    } catch (error) {
      console.error('Error reading history:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to read history' }));
    }
  }

  // Login endpoint (simple token-based)
  else if (req.url === '/api/admin/login' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { password } = JSON.parse(body);

        // Simple check (in production, use proper auth)
        if (password === 'admin123') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            token: ADMIN_TOKEN
          }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid password' }));
        }
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  // Health check
  else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  // Try community routes
  else if (await handleCommunityRoutes(req, res)) {
    return;
  }

  // Not found
  else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not found',
      endpoints: [        'GET / - Main API',        'GET /api/hok - Main API',        'POST /api/contribute - Submit contribution',        'GET /api/contributions/pending - List pending',        'POST /api/contributions/approve/:id - Approve (requires auth)',        'POST /api/contributions/reject/:id - Reject (requires auth)',        'GET /api/contributions/history - View history',        'POST /api/admin/login - Admin login',        'POST /api/auth/register - Register contributor',        'POST /api/auth/login - Login contributor',        'GET /api/tier-lists - Get tier lists',        'POST /api/tier-lists - Create tier list',        'POST /api/tier-lists/:id/vote - Vote tier list',        'GET /api/contributors - Get contributors leaderboard',        'GET /health - Health check'      ]
    }));
  }
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log('🚀 Honor of Kings Global API running on port ' + PORT);
  console.log('📡 Endpoints:');
  console.log('   - GET  /api/hok - Main API');
  console.log('   - POST /api/contribute - Submit contribution');
  console.log('   - GET  /api/contributions/pending - List pending');
  console.log('   - POST /api/contributions/approve/:id - Approve contribution');
  console.log('   - POST /api/contributions/reject/:id - Reject contribution');
  console.log('   - GET  /api/contributions/history - View history');
  console.log('   - POST /api/admin/login - Admin login');
  console.log('   - GET  /health - Health check');
  console.log('\n🔐 Admin password: admin123');
  console.log('🔑 Admin token: ' + ADMIN_TOKEN);
});
