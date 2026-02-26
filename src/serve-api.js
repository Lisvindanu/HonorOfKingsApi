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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  // Serve static images
  if (req.url.startsWith("/images/")) {
    const imagePath = path.join(process.cwd(), "public", req.url);
    try {
      const stat = await fs.stat(imagePath);
      if (stat.isFile()) {
        const ext = path.extname(imagePath).toLowerCase();
        const mimeTypes = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
        const contentType = mimeTypes[ext] || "application/octet-stream";
        const data = await fs.readFile(imagePath);
        res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" });
        res.end(data);
        return;
      }
    } catch (err) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Image not found" }));
      return;
    }
  }

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

  // Adjustments API endpoint
  else if (req.url.startsWith("/api/adjustments") && !req.url.startsWith("/api/adjustments/") && req.method === "GET") {
    try {
      const urlObj = new URL(req.url, "http://localhost");
      const seasonParam = urlObj.searchParams.get("season");

      if (seasonParam) {
        // Return specific season from full dataset
        const fullPath = path.join(process.cwd(), "output", "adjustments-full.json");
        const fullData = JSON.parse(await fs.readFile(fullPath, "utf-8"));
        const seasonData = fullData.allSeasons?.[seasonParam];
        if (!seasonData) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Season ${seasonParam} not found` }));
        } else {
          const result = {
            scrapedAt: fullData.scrapedAt,
            season: seasonData.season,
            adjustments: seasonData.adjustments,
            heroList: fullData.heroList,
          };
          res.writeHead(200);
          res.end(JSON.stringify(result));
        }
      } else {
        // Return current season (try new format first, fallback to old)
        let filePath = path.join(process.cwd(), "output", "adjustments.json");
        try {
          await fs.access(filePath);
        } catch {
          filePath = path.join(process.cwd(), "output", "adjustments-data.json");
        }
        const data = await fs.readFile(filePath, "utf-8");
        res.writeHead(200);
        res.end(data);
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Adjustments data not available" }));
    }
  }

  // Adjustments full (all seasons) endpoint
  else if (req.url === "/api/adjustments/full" && req.method === "GET") {
    try {
      const filePath = path.join(process.cwd(), "output", "adjustments-full.json");
      const data = await fs.readFile(filePath, "utf-8");
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Full adjustments data not available" }));
    }
  }

  // Items API endpoint
  else if (req.url === "/api/items" && req.method === "GET") {
    try {
      const filePath = path.join(process.cwd(), "output", "items.json");
      const data = await fs.readFile(filePath, "utf-8");
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Items data not available" }));
    }
  }

  // Arcana API endpoint
  else if (req.url === "/api/arcana" && req.method === "GET") {
    try {
      const filePath = path.join(process.cwd(), "output", "arcana.json");
      const data = await fs.readFile(filePath, "utf-8");
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Arcana data not available" }));
    }
  }

  // Image proxy endpoint for CORS bypass
  else if (req.url.startsWith("/proxy-image/") && req.method === "GET") {
    const imagePath = req.url.replace("/proxy-image/", "");
    const imageUrl = "https://world.honorofkings.com/" + imagePath;
    
    try {
      const https = await import("https");
      
      https.default.get(imageUrl, (imgRes) => {
        const contentType = imgRes.headers["content-type"] || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        res.writeHead(imgRes.statusCode);
        imgRes.pipe(res);
      }).on("error", (err) => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Failed to fetch image" }));
      });
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Image proxy error" }));
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

        if (!['skin', 'hero', 'series', 'counter', 'skin-edit'].includes(contribution.type)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid type. Must be: skin, hero, series, counter, or skin-edit' }));
          return;
        }

        // Check for authenticated user
        let contributorId = null;
        let contributorName = contribution.contributorName || 'Anonymous';
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const { verifyToken } = await import('./auth-middleware.js');
            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
              contributorId = decoded.userId;
              contributorName = decoded.name || contributorName;
            }
          } catch (e) {
            // Token verification failed, continue as anonymous
          }
        }

        // Save to pending files
        const contributionsDir = path.join(process.cwd(), 'contributions', 'pending');
        await fs.mkdir(contributionsDir, { recursive: true });

        const timestamp = Date.now();
        const id = `${contribution.type}-${timestamp}`;
        const filename = `${id}.json`;
        const filepath = path.join(contributionsDir, filename);

        const contributionData = {
          ...contribution,
          contributorId,
          contributorName,
          submittedAt: new Date().toISOString(),
          status: 'pending',
          id
        };

        await fs.writeFile(filepath, JSON.stringify(contributionData, null, 2));

        // Also save to database if user is authenticated
        if (contributorId) {
          const communityDb = await import('./community-db.js');
          await communityDb.createContribution({
            contributorId,
            type: contribution.type,
            data: contribution.data,
            status: 'pending'
          });
          // Increment contribution count for the user
          await communityDb.incrementContributorContributions(contributorId);
        }

        console.log(`✅ New contribution: ${filename}` + (contributorId ? ` (by user ${contributorId})` : ' (anonymous)'));

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
          try {
            const content = await fs.readFile(path.join(contributionsDir, file), 'utf-8');
            contributions.push(JSON.parse(content));
          } catch (parseErr) {
            console.error('Skipping corrupt pending file:', file, parseErr.message);
          }
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


  // Bulk approve contributions (sequential — safe for merged-api.json writes)
  else if (req.url === '/api/contributions/approve-bulk' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk.toString());
        req.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
        req.on('error', reject);
      });

      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ids array is required' }));
        return;
      }

      const results = [];
      // Sequential processing — MUST NOT use Promise.all (race condition on merged-api.json)
      for (const id of ids) {
        try {
          const { stdout } = await execPromise(
            `node src/merge-contribution.js ${id} approve`,
            { cwd: process.cwd() }
          );
          console.log(`Approved ${id}:`, stdout.trim());
          results.push({ id, success: true, action: 'approved' });
        } catch (err) {
          console.error(`Failed to approve ${id}:`, err.message);
          results.push({ id, success: false, error: err.message });
        }
      }

      const approved = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.writeHead(200);
      res.end(JSON.stringify({ results, summary: { approved, failed, total: ids.length } }));
    } catch (error) {
      console.error('Bulk approve error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Bulk approve failed', details: error.message }));
    }
  }

  // Bulk reject contributions
  else if (req.url === '/api/contributions/reject-bulk' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk.toString());
        req.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
        req.on('error', reject);
      });

      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ids array is required' }));
        return;
      }

      const results = [];
      for (const id of ids) {
        try {
          const { stdout } = await execPromise(
            `node src/merge-contribution.js ${id} reject`,
            { cwd: process.cwd() }
          );
          results.push({ id, success: true, action: 'rejected' });
        } catch (err) {
          results.push({ id, success: false, error: err.message });
        }
      }

      const rejected = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.writeHead(200);
      res.end(JSON.stringify({ results, summary: { rejected, failed, total: ids.length } }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Bulk reject failed', details: error.message }));
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
        if (password === 'hokhub2026') {
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
  console.log('\n🔐 Admin password: hokhub2026');
  console.log('🔑 Admin token: ' + ADMIN_TOKEN);
});
