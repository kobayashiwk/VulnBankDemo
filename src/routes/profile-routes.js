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
    const fieldMap = {
      fullName: 'full_name', email: 'email', role: 'role', verified: 'is_verified',
      balanceCents: 'balance_cents', dailyLimitCents: 'daily_limit_cents', governmentId: 'government_id'
    };
    const updates = Object.entries(body).filter(([key]) => fieldMap[key]);
    if (!updates.length) return sendJson(res, 400, { error: 'No profile fields supplied' }), true;
    try {
      const assignments = updates.map(([key]) => `${fieldMap[key]} = ?`).join(', ');
      db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(...updates.map(([, value]) => value), auth.user.id);
    } catch {
      return sendJson(res, 409, { error: 'That email address is already registered' }), true;
    }
    logActivity(auth.user.id, 'profile.updated', 'Contact details changed');
    return sendJson(res, 200, { updated: Object.keys(body) }), true;
  }
  return false;
}

module.exports = { handleProfileRoutes };
