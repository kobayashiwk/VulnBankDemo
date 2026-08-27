'use strict';

const crypto = require('node:crypto');
const { db } = require('./db');
const { parseCookies, sendJson } = require('./http');
const { hashPassword, verifyPassword } = require('./password');

const sessions = new Map();

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { userId, createdAt: Date.now(), csrfToken: null });
  return { token, session: sessions.get(token) };
}

function destroySession(req) {
  const token = parseCookies(req).asteria_session;
  if (token) sessions.delete(token);
}

function getSession(req) {
  const token = parseCookies(req).asteria_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || Date.now() - session.createdAt > 60 * 60 * 1000) {
    if (token) sessions.delete(token);
    return null;
  }
  return session;
}

function requireUser(req, res) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required' });
    return null;
  }
  const user = db.prepare('SELECT id, username, full_name, email, role, is_verified, balance_cents, daily_limit_cents FROM users WHERE id = ?').get(session.userId);
  if (!user) {
    sendJson(res, 401, { error: 'Session is no longer valid' });
    return null;
  }
  return { session, user };
}

function requireRole(req, res, role) {
  const auth = requireUser(req, res);
  if (!auth) return null;
  if (auth.user.role !== role) {
    sendJson(res, 403, { error: 'Insufficient permissions' });
    return null;
  }
  return auth;
}

module.exports = { sessions, hashPassword, verifyPassword, createSession, destroySession, getSession, requireUser, requireRole };
