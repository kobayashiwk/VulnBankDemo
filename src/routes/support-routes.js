'use strict';

const { db, logActivity } = require('../db');
const { readJson, sendJson, sendHtml, escapeHtml } = require('../http');
const { requireUser } = require('../auth');
const { requireCsrf } = require('../security');

async function handleSupportRoutes(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/support') {
    const auth = requireUser(req, res);
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const { subject = '', message = '' } = await readJson(req);
    if (!String(subject).trim() || !String(message).trim()) return sendJson(res, 400, { error: 'Subject and message are required' }), true;
    const result = db.prepare('INSERT INTO support_tickets (user_id, subject, message) VALUES (?, ?, ?)')
      .run(auth.user.id, String(subject).slice(0, 100), String(message).slice(0, 2000));
    logActivity(auth.user.id, 'support.created', `Ticket ${result.lastInsertRowid}`);
    return sendJson(res, 201, { id: Number(result.lastInsertRowid) }), true;
  }

  if (req.method === 'GET' && url.pathname === '/api/support/view') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const tickets = db.prepare('SELECT id, subject, message, status, created_at FROM support_tickets WHERE user_id = ? ORDER BY id DESC').all(auth.user.id);
    const cards = tickets.map((ticket) => `<article class="ticket"><div><strong>#${ticket.id} ${ticket.subject}</strong><span>${ticket.status}</span></div><p>${ticket.message}</p><small>${ticket.created_at}</small></article>`).join('');
    return sendHtml(res, 200, cards || '<p class="empty">No support requests yet.</p>'), true;
  }
  return false;
}

module.exports = { handleSupportRoutes };
