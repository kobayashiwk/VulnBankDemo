'use strict';

const { db, logActivity } = require('../db');
const { readJson, sendJson } = require('../http');
const { requireUser } = require('../auth');
const { requireCsrf } = require('../security');

async function handleProfileRoutes(req, res, url) {
  if (req.method === 'PATCH' && url.pathname === '/api/profile') {
    const auth = requireUser(req, res);
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const body = await readJson(req);
    const fullName = String(body.fullName ?? auth.user.full_name).trim().slice(0, 80);
    const email = String(body.email ?? auth.user.email).trim().toLowerCase().slice(0, 120);
    if (!fullName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJson(res, 400, { error: 'Enter a valid name and email address' }), true;
    try {
      db.prepare('UPDATE users SET full_name = ?, email = ? WHERE id = ?').run(fullName, email, auth.user.id);
    } catch {
      return sendJson(res, 409, { error: 'That email address is already registered' }), true;
    }
    logActivity(auth.user.id, 'profile.updated', 'Contact details changed');
    return sendJson(res, 200, { fullName, email }), true;
  }
  return false;
}

module.exports = { handleProfileRoutes };

