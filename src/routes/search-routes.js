'use strict';

const { db } = require('../db');
const { sendJson } = require('../http');
const { requireUser } = require('../auth');

async function handleSearchRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/directory') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const query = String(url.searchParams.get('q') || '').slice(0, 50);
    const people = db.prepare(`SELECT username, full_name FROM users
      WHERE role = 'customer' AND id != ? AND (username LIKE ? OR full_name LIKE ?)
      ORDER BY full_name LIMIT 10`).all(auth.user.id, `%${query}%`, `%${query}%`);
    return sendJson(res, 200, { query, people }), true;
  }
  return false;
}

module.exports = { handleSearchRoutes };

