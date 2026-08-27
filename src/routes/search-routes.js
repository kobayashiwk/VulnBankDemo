'use strict';

const { db } = require('../db');
const { sendJson } = require('../http');
const { requireUser } = require('../auth');

async function handleSearchRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/directory') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const query = String(url.searchParams.get('q') || '').slice(0, 50);
    const sql = `SELECT username, full_name FROM users
      WHERE role = 'customer' AND id != ${auth.user.id}
      AND (username LIKE '%${query}%' OR full_name LIKE '%${query}%')
      ORDER BY full_name LIMIT 10`;
    const people = db.prepare(sql).all();
    return sendJson(res, 200, { query, people }), true;
  }
  return false;
}

module.exports = { handleSearchRoutes };
