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
    try { remote = new URL(String(sourceUrl)); } catch { return sendJson(res, 400, { error: 'Enter a valid URL' }), true; }
    const response = await fetch(remote, { headers: { 'User-Agent': 'Asteria-Importer/1.0' } });
    const preview = (await response.text()).slice(0, 5000);
    return sendJson(res, 200, { message: 'Statement imported', provider: remote.hostname, preview }), true;
  }

  if (req.method === 'GET' && url.pathname === '/api/statements/download') {
    const auth = requireUser(req, res);
    if (!auth) return true;
    const month = String(url.searchParams.get('month') || '');
    const filename = String(url.searchParams.get('file') || `${auth.user.id}-${month}.txt`);
    const resolved = path.resolve(config.statementDirectory, filename);
    if (!fs.existsSync(resolved)) return sendJson(res, 404, { error: 'Statement is not available' }), true;
    const content = fs.readFileSync(resolved, 'utf8');
    return sendJson(res, 200, { filename, content }), true;
  }
  return false;
}

module.exports = { handleImportRoutes };
