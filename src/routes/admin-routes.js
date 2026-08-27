'use strict';

const { exec } = require('node:child_process');
const { promisify } = require('node:util');
const config = require('../config');
const { readJson, sendJson } = require('../http');
const { requireRole } = require('../auth');
const { requireCsrf } = require('../security');
const { db } = require('../db');

const execAsync = promisify(exec);

async function handleAdminRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/operations/users') {
    const auth = requireRole(req, res, 'operations');
    if (!auth) return true;
    const users = db.prepare('SELECT id, username, full_name, email, role, is_verified FROM users ORDER BY id').all();
    return sendJson(res, 200, { users }), true;
  }

  if (req.method === 'POST' && url.pathname === '/api/operations/diagnostics') {
    const auth = requireRole(req, res, 'operations');
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const { target = '' } = await readJson(req);
    const command = process.platform === 'win32' ? `ping -n 1 ${target}` : `ping -c 1 ${target}`;
    try {
      const { stdout } = await execAsync(command, { timeout: 3000, windowsHide: true });
      return sendJson(res, 200, { output: stdout.slice(0, 2000) }), true;
    } catch {
      return sendJson(res, 502, { error: 'Diagnostics did not complete' }), true;
    }
  }
  return false;
}

module.exports = { handleAdminRoutes };

