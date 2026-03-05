import { verifyToken } from './auth-middleware.js';
import * as db from './posts-db.js';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const COMMUNITY_IMG_DIR = path.join(process.cwd(), 'public', 'images', 'community');
const MAX_BASE64_BYTES = 8 * 1024 * 1024;   // 8 MB base64 (~6 MB actual)
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-token-2024';

function isAdmin(req) {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') && h.split(' ')[1] === ADMIN_TOKEN;
}

if (!existsSync(COMMUNITY_IMG_DIR)) {
  mkdirSync(COMMUNITY_IMG_DIR, { recursive: true });
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BASE64_BYTES + 1024) {
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function getUser(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    return verifyToken(h.split(' ')[1]);
  }
  return null;
}

function getVoterId(req) {
  const user = getUser(req);
  if (user?.userId) return String(user.userId);
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'anon';
}

// ─── Image upload ─────────────────────────────────────────────────────────────

async function handleImageUpload(req, res) {
  const user = getUser(req);
  if (!user && !isAdmin(req)) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return true;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message || 'Invalid request' }));
    return true;
  }

  const { imageData, mimeType } = body;

  // Validate mime type whitelist
  if (!imageData || typeof imageData !== 'string') {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'imageData is required' }));
    return true;
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Unsupported image type' }));
    return true;
  }

  // Strip data URL prefix if present
  const base64 = imageData.replace(/^data:[^;]+;base64,/, '');
  const rawBuffer = Buffer.from(base64, 'base64');

  // Check actual size (max 6 MB after decode)
  if (rawBuffer.length > 6 * 1024 * 1024) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Image too large (max 6 MB)' }));
    return true;
  }

  const filename = randomUUID() + '.webp';
  const outPath = path.join(COMMUNITY_IMG_DIR, filename);

  try {
    // sharp will throw if buffer is not a valid image — automatic security
    await sharp(rawBuffer)
      .rotate()                    // auto-orient from EXIF
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);

    const url = `/images/community/${filename}`;
    res.writeHead(200);
    res.end(JSON.stringify({ url }));
  } catch (err) {
    console.error('Image processing error:', err.message);
    // Clean up partial file if it exists
    unlink(outPath).catch(() => {});
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid or unsupported image file' }));
  }
  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function handlePostsRoutes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // POST /api/posts/upload-image
  if (pathname === '/api/posts/upload-image' && req.method === 'POST') {
    return handleImageUpload(req, res);
  }

  // GET /api/posts
  if (pathname === '/api/posts' && req.method === 'GET') {
    try {
      const type   = url.searchParams.get('type') || 'all';
      const limit  = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const posts  = await db.getAllPosts({ type, limit, offset });
      const voterId = getVoterId(req);
      const likedIds = new Set(await db.getLikedPosts(voterId));
      const result = posts.map(p => ({ ...p, liked: likedIds.has(p.id) }));
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return true;
    } catch (e) {
      console.error('GET /api/posts error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch posts' }));
      return true;
    }
  }

  // GET /api/posts/:id
  const singleMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
  if (singleMatch && req.method === 'GET') {
    try {
      const post = await db.getPostById(parseInt(singleMatch[1]));
      if (!post) { res.writeHead(404); res.end(JSON.stringify({ error: 'Post not found' })); return true; }
      const voterId = getVoterId(req);
      const likedIds = new Set(await db.getLikedPosts(voterId));
      res.writeHead(200);
      res.end(JSON.stringify({ ...post, liked: likedIds.has(post.id) }));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch post' }));
      return true;
    }
  }

  // POST /api/posts (requires auth)
  if (pathname === '/api/posts' && req.method === 'POST') {
    const user = getUser(req);
    if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const body = await parseBody(req);
      const { type, title, content, tags, image_url } = body;
      if (!title?.trim() || !content?.trim()) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'title and content are required' })); return true;
      }
      const validTypes = ['build', 'strategy', 'discussion', 'dev'];
      const postType = validTypes.includes(type) ? type : 'discussion';
      const is_dev = postType === 'dev';
      // Validate image_url if provided (must be our own path)
      const safeImageUrl = (typeof image_url === 'string' && image_url.startsWith('/images/community/') && /^[a-f0-9\-]+\.webp$/.test(path.basename(image_url)))
        ? image_url
        : null;
      const post = await db.createPost({
        author_id: user.userId,
        type: postType,
        title: title.trim(),
        content: content.trim(),
        tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
        is_dev,
        image_url: safeImageUrl,
      });
      res.writeHead(201);
      res.end(JSON.stringify(post));
      return true;
    } catch (e) {
      console.error('POST /api/posts error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to create post' }));
      return true;
    }
  }

  // PATCH /api/posts/:id (requires auth, own post)
  if (singleMatch && req.method === 'PATCH') {
    const user = getUser(req);
    if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const id = parseInt(singleMatch[1]);
      const existing = await db.getPostById(id);
      if (!existing) { res.writeHead(404); res.end(JSON.stringify({ error: 'Post not found' })); return true; }
      if (Number(existing.author_id) !== Number(user.userId)) {
        res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' })); return true;
      }
      const body = await parseBody(req);
      const updated = await db.updatePost(id, body);
      res.writeHead(200);
      res.end(JSON.stringify(updated));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to update post' }));
      return true;
    }
  }

  // DELETE /api/posts/:id (requires auth, own post)
  if (singleMatch && req.method === 'DELETE') {
    const user = getUser(req);
    if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const id = parseInt(singleMatch[1]);
      const existing = await db.getPostById(id);
      if (!existing) { res.writeHead(404); res.end(JSON.stringify({ error: 'Post not found' })); return true; }
      if (Number(existing.author_id) !== Number(user.userId)) {
        res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' })); return true;
      }
      await db.deletePost(id);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to delete post' }));
      return true;
    }
  }

  // POST /api/posts/:id/like (no auth required)
  const likeMatch = pathname.match(/^\/api\/posts\/(\d+)\/like$/);
  if (likeMatch && req.method === 'POST') {
    try {
      const id = parseInt(likeMatch[1]);
      const voterId = getVoterId(req);
      const result = await db.toggleLike(id, voterId);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to toggle like' }));
      return true;
    }
  }


  // GET /api/admin/posts (admin only — list dev posts)
  if (pathname === '/api/admin/posts' && req.method === 'GET') {
    if (!isAdmin(req)) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const posts = await db.getAllPosts({ type: 'dev', limit: 100, offset: 0 });
      res.writeHead(200);
      res.end(JSON.stringify(posts));
      return true;
    } catch (e) {
      console.error('GET /api/admin/posts error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch dev posts' }));
      return true;
    }
  }

  // POST /api/admin/posts (admin only — create dev update)
  if (pathname === '/api/admin/posts' && req.method === 'POST') {
    if (!isAdmin(req)) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const body = await parseBody(req);
      const { title, content, tags, image_url } = body;
      if (!title?.trim() || !content?.trim()) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'title and content are required' })); return true;
      }
      const safeImageUrl = (typeof image_url === 'string' && image_url.startsWith('/images/community/') && /^[a-f0-9\-]+\.webp$/.test(path.basename(image_url)))
        ? image_url : null;
      const post = await db.createPost({
        author_id: null,
        type: 'dev',
        title: title.trim(),
        content: content.trim(),
        tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
        is_dev: true,
        image_url: safeImageUrl,
      });
      res.writeHead(201);
      res.end(JSON.stringify(post));
      return true;
    } catch (e) {
      console.error('POST /api/admin/posts error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to create dev post' }));
      return true;
    }
  }

  // DELETE /api/admin/posts/:id (admin only — delete any post)
  const adminDeleteMatch = pathname.match(/^\/api\/admin\/posts\/(\d+)$/);
  if (adminDeleteMatch && req.method === 'DELETE') {
    if (!isAdmin(req)) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const id = parseInt(adminDeleteMatch[1]);
      const existing = await db.getPostById(id);
      if (!existing) { res.writeHead(404); res.end(JSON.stringify({ error: 'Post not found' })); return true; }
      await db.deletePost(id);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to delete post' }));
      return true;
    }
  }


  // GET /api/posts/:id/replies
  const repliesMatch = pathname.match(/^\/api\/posts\/(\d+)\/replies$/);
  if (repliesMatch && req.method === 'GET') {
    try {
      const replies = await db.getReplies(parseInt(repliesMatch[1]));
      res.writeHead(200);
      res.end(JSON.stringify(replies));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch replies' }));
      return true;
    }
  }

  // POST /api/posts/:id/replies (requires auth)
  if (repliesMatch && req.method === 'POST') {
    const user = getUser(req);
    if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const body = await parseBody(req);
      const { content } = body;
      if (!content?.trim() || content.trim().length > 500) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'content required (max 500 chars)' })); return true;
      }
      const postExists = await db.getPostById(parseInt(repliesMatch[1]));
      if (!postExists) { res.writeHead(404); res.end(JSON.stringify({ error: 'Post not found' })); return true; }
      const reply = await db.createReply({
        post_id: parseInt(repliesMatch[1]),
        author_id: user.userId,
        content: content.trim(),
      });
      res.writeHead(201);
      res.end(JSON.stringify(reply));
      return true;
    } catch (e) {
      console.error('POST replies error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to create reply' }));
      return true;
    }
  }

  // DELETE /api/posts/:id/replies/:replyId (requires auth, own reply)
  const replyDeleteMatch = pathname.match(/^\/api\/posts\/(\d+)\/replies\/(\d+)$/);
  if (replyDeleteMatch && req.method === 'DELETE') {
    const user = getUser(req);
    if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const deleted = await db.deleteReply(parseInt(replyDeleteMatch[2]), user.userId);
      if (!deleted) { res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' })); return true; }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to delete reply' }));
      return true;
    }
  }


  // PATCH /api/posts/:id/replies/:replyId (requires auth, own reply)
  if (replyDeleteMatch && req.method === 'PATCH') {
    const user = getUser(req);
    if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
    try {
      const body = await parseBody(req);
      const { content } = body;
      if (!content?.trim() || content.trim().length > 500) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'content required (max 500 chars)' })); return true;
      }
      const updated = await db.updateReply(parseInt(replyDeleteMatch[2]), user.userId, content.trim());
      if (!updated) { res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden or not found' })); return true; }
      res.writeHead(200);
      res.end(JSON.stringify(updated));
      return true;
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to update reply' }));
      return true;
    }
  }

  return false;
}
