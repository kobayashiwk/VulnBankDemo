'use strict';

const { db } = require('../db');
const { sendJson } = require('../http');
const { requireUser } = require('../auth');

async function handleDataRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/data-activity') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const balance = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(auth.user.id);
    const activity = db.prepare(`SELECT id, action, details, created_at FROM audit_log
      WHERE actor_user_id = ? ORDER BY id DESC LIMIT 12`).all(auth.user.id);
    const tableStats = [
      { table: 'users', rows: db.prepare('SELECT COUNT(*) AS count FROM users').get().count, scope: 'current balance' },
      { table: 'transactions', rows: db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE from_user_id = ? OR to_user_id = ?').get(auth.user.id, auth.user.id).count, scope: 'your ledger' },
      { table: 'support_tickets', rows: db.prepare('SELECT COUNT(*) AS count FROM support_tickets WHERE user_id = ?').get(auth.user.id).count, scope: 'your requests' },
      { table: 'audit_log', rows: activity.length, scope: 'recent actions' }
    ];
    return sendJson(res, 200, { balanceCents: balance.balance_cents, activity, tableStats }), true;
  }
  return false;
}

module.exports = { handleDataRoutes };

