import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hokhub',
  password: 'password',
  port: 5432,
});

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getAllPosts({ type, limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = '';
  if (type && type !== 'all') {
    params.push(type);
    where = `WHERE p.type = $${params.length}`;
  }
  params.push(limit, offset);
  const res = await pool.query(
    `SELECT p.*, c.name AS author_name,
       (SELECT COUNT(*) FROM post_replies r WHERE r.post_id = p.id)::int AS reply_count
     FROM posts p LEFT JOIN contributors c ON p.author_id = c.id
     ${where}
     ORDER BY p.is_pinned DESC, p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return res.rows;
}

export async function getPostById(id) {
  const res = await pool.query(
    `SELECT p.*, c.name AS author_name,
       (SELECT COUNT(*) FROM post_replies r WHERE r.post_id = p.id)::int AS reply_count
     FROM posts p LEFT JOIN contributors c ON p.author_id = c.id WHERE p.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function createPost({ author_id, type, title, content, tags = [], is_dev = false, image_url = null }) {
  const res = await pool.query(
    `INSERT INTO posts (author_id, type, title, content, tags, is_dev, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [author_id, type, title, content, tags, is_dev, image_url]
  );
  return res.rows[0];
}

export async function updatePost(id, { title, content, tags, is_pinned, is_dev, image_url }) {
  const fields = [];
  const params = [];
  if (title !== undefined)     { params.push(title);     fields.push(`title = $${params.length}`); }
  if (content !== undefined)   { params.push(content);   fields.push(`content = $${params.length}`); }
  if (tags !== undefined)      { params.push(tags);      fields.push(`tags = $${params.length}`); }
  if (is_pinned !== undefined) { params.push(is_pinned); fields.push(`is_pinned = $${params.length}`); }
  if (is_dev !== undefined)    { params.push(is_dev);    fields.push(`is_dev = $${params.length}`); }
  if (image_url !== undefined) { params.push(image_url); fields.push(`image_url = $${params.length}`); }
  if (fields.length === 0) return null;
  fields.push(`updated_at = NOW()`);
  params.push(id);
  const res = await pool.query(
    `UPDATE posts SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return res.rows[0] || null;
}

export async function deletePost(id) {
  await pool.query('DELETE FROM posts WHERE id = $1', [id]);
}

// ─── Likes ────────────────────────────────────────────────────────────────────

export async function toggleLike(postId, voterId) {
  const existing = await pool.query(
    'SELECT 1 FROM post_likes WHERE post_id = $1 AND voter_id = $2',
    [postId, voterId]
  );
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND voter_id = $2', [postId, voterId]);
    await pool.query('UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1', [postId]);
    return { liked: false };
  } else {
    await pool.query('INSERT INTO post_likes (post_id, voter_id) VALUES ($1, $2)', [postId, voterId]);
    await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [postId]);
    return { liked: true };
  }
}

export async function getLikedPosts(voterId) {
  const res = await pool.query(
    'SELECT post_id FROM post_likes WHERE voter_id = $1',
    [voterId]
  );
  return res.rows.map(r => r.post_id);
}

// ─── Replies ──────────────────────────────────────────────────────────────────

export async function getReplies(postId) {
  const res = await pool.query(
    `SELECT r.*, c.name AS author_name
     FROM post_replies r LEFT JOIN contributors c ON r.author_id = c.id
     WHERE r.post_id = $1 ORDER BY r.created_at ASC`,
    [postId]
  );
  return res.rows;
}

export async function createReply({ post_id, author_id, content }) {
  const res = await pool.query(
    `INSERT INTO post_replies (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [post_id, author_id, content]
  );
  const row = res.rows[0];
  if (author_id) {
    const u = await pool.query('SELECT name FROM contributors WHERE id = $1', [author_id]);
    row.author_name = u.rows[0]?.name || null;
  } else {
    row.author_name = null;
  }
  return row;
}

export async function deleteReply(id, authorId) {
  const existing = await pool.query('SELECT * FROM post_replies WHERE id = $1', [id]);
  if (!existing.rows[0]) return false;
  if (Number(existing.rows[0].author_id) !== Number(authorId)) return false;
  await pool.query('DELETE FROM post_replies WHERE id = $1', [id]);
  return true;
}

export async function updateReply(id, authorId, content) {
  const existing = await pool.query('SELECT * FROM post_replies WHERE id = $1', [id]);
  if (!existing.rows[0]) return null;
  if (Number(existing.rows[0].author_id) !== Number(authorId)) return null;
  const res = await pool.query(
    'UPDATE post_replies SET content = $1 WHERE id = $2 RETURNING *',
    [content, id]
  );
  const row = res.rows[0];
  const u = await pool.query('SELECT name FROM contributors WHERE id = $1', [authorId]);
  row.author_name = u.rows[0]?.name || null;
  return row;
}
