'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { readJson, sendJson } = require('../http');
const { requireUser } = require('../auth');
const { requireCsrf } = require('../security');

async function handleImportRoutes(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/statements/import') {
    const auth = requireUser(req, res);
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const { sourceUrl = '' } = await readJson(req);
    let remote;
    try { remote = new URL(String(sourceUrl)); } catch { return sendJson(res, 400, { error: 'Enter a valid HTTPS URL' }), true; }
    if (remote.protocol !== 'https:' || !config.importHosts.includes(remote.hostname)) return sendJson(res, 400, { error: 'This statement provider is not approved' }), true;
    return sendJson(res, 202, { message: 'Statement import queued', provider: remote.hostname }), true;
  }

  if (req.method === 'GET' && url.pathname === '/api/statements/download') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const month = String(url.searchParams.get('month') || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return sendJson(res, 400, { error: 'Month must use YYYY-MM format' }), true;
    const filename = `${auth.user.id}-${month}.txt`;
    const resolved = path.resolve(config.statementDirectory, filename);
    if (path.dirname(resolved) !== path.resolve(config.statementDirectory)) return sendJson(res, 400, { error: 'Invalid statement path' }), true;
    if (!fs.existsSync(resolved)) return sendJson(res, 404, { error: 'Statement is not available' }), true;
    const content = fs.readFileSync(resolved, 'utf8');
    return sendJson(res, 200, { filename, content }), true;
  }
  return false;
}

module.exports = { handleImportRoutes };

