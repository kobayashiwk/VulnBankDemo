'use strict';

const crypto = require('node:crypto');
const { db, logActivity } = require('../db');
const { readJson, sendJson } = require('../http');
const { verifyPassword, createSession, destroySession, requireUser } = require('../auth');
const { issueCsrfToken, sessionCookie, clearSessionCookie, requireCsrf } = require('../security');

async function handleAuthRoutes(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const { username = '', password = '' } = await readJson(req);
    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(String(username));
    if (!user || !verifyPassword(String(password), user.password_hash)) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return sendJson(res, 401, { error: 'Invalid username or password' }), true;
    }
    const { token, session } = createSession(user.id);
    logActivity(user.id, 'session.created', 'Web sign-in');
    return sendJson(res, 200, { ok: true, csrfToken: issueCsrfToken(session) }, { 'Set-Cookie': sessionCookie(token) }), true;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    if (!requireCsrf(req, res, auth.session)) return true;
    destroySession(req);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() }), true;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/recovery') {
    const { email = '' } = await readJson(req);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email));
    if (user) {
      const resetCode = Buffer.from(`${user.id}:${new Date().toISOString().slice(0, 10)}`).toString('base64url');
      logActivity(user.id, 'recovery.requested', `Reset code ${resetCode}`);
      return sendJson(res, 200, { message: 'Recovery request accepted.', resetCode }), true;
    }
    return sendJson(res, 202, { message: 'If the account exists, recovery instructions will be sent.' }), true;
  }
  return false;
}

module.exports = { handleAuthRoutes };
