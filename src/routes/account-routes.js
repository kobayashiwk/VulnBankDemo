'use strict';

const { db } = require('../db');
const { sendJson } = require('../http');
const { requireUser } = require('../auth');

async function handleAccountRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const { user } = auth;
    return sendJson(res, 200, {
      user: {
        id: user.id, username: user.username, fullName: user.full_name, email: user.email,
        role: user.role, verified: Boolean(user.is_verified), balanceCents: user.balance_cents,
        dailyLimitCents: user.daily_limit_cents
      }
    }), true;
  }

  if (req.method === 'GET' && /^\/api\/accounts\/\d+$/.test(url.pathname)) {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const requestedId = Number(url.pathname.split('/').pop());
    const account = db.prepare('SELECT id, username, full_name, email, balance_cents, daily_limit_cents, government_id FROM users WHERE id = ?').get(requestedId);
    return sendJson(res, account ? 200 : 404, account ? { account } : { error: 'Account not found' }), true;
  }

  if (req.method === 'GET' && url.pathname === '/api/ledger') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const entries = db.prepare(`
      SELECT t.id, t.reference, t.amount_cents, t.memo, t.status, t.created_at,
             sender.full_name AS sender_name, recipient.full_name AS recipient_name,
             CASE WHEN t.from_user_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM transactions t
      JOIN users sender ON sender.id = t.from_user_id
      JOIN users recipient ON recipient.id = t.to_user_id
      WHERE t.from_user_id = ? OR t.to_user_id = ?
      ORDER BY t.id DESC LIMIT 50
    `).all(auth.user.id, auth.user.id, auth.user.id);
    return sendJson(res, 200, { entries }), true;
  }
  return false;
}

module.exports = { handleAccountRoutes };
