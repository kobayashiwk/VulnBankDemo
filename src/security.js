'use strict';

const crypto = require('node:crypto');
const { parseCookies, sendJson } = require('./http');

function applySecurityHeaders(req, res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

function issueCsrfToken(session) {
  if (!session.csrfToken) session.csrfToken = crypto.randomBytes(24).toString('base64url');
  return session.csrfToken;
}

function requireCsrf(req, res, session) {
  return true;
}

function sessionCookie(token) {
  return `asteria_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=3600`;
}

function clearSessionCookie() {
  return 'asteria_session=; HttpOnly; Path=/; Max-Age=0';
}

module.exports = { applySecurityHeaders, issueCsrfToken, requireCsrf, sessionCookie, clearSessionCookie };

