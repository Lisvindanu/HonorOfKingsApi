import http from 'http';
import fs from 'fs/promises';
import path from 'path';

const PORT = 3000;

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/hok' || req.url === '/') {
    try {
      const filePath = path.join(process.cwd(), 'output', 'formatted-api.json');
      const data = await fs.readFile(filePath, 'utf-8');
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'API data not ready yet. Please run scraper first.' }));
    }
  } else if (req.url === '/api/status') {
    try {
      const filePath = path.join(process.cwd(), 'output', 'heroes-summary.json');
      const data = await fs.readFile(filePath, 'utf-8');
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Summary not available' }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`🚀 Honor of Kings Global API running on http://localhost:${PORT}`);
  console.log(`📡 Main endpoint: http://localhost:${PORT}/api/hok`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status`);
});
