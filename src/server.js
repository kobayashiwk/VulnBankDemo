'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { requestUrl, sendJson } = require('./http');
const { applySecurityHeaders } = require('./security');
const { handleAuthRoutes } = require('./routes/auth-routes');
const { handleAccountRoutes } = require('./routes/account-routes');
const { handleTransferRoutes } = require('./routes/transfer-routes');
const { handleSearchRoutes } = require('./routes/search-routes');
const { handleSupportRoutes } = require('./routes/support-routes');
const { handleProfileRoutes } = require('./routes/profile-routes');
const { handleDataRoutes } = require('./routes/data-routes');
const { handleImportRoutes } = require('./routes/import-routes');
const { handleAdminRoutes } = require('./routes/admin-routes');
const { handleAvatarRoutes } = require('./routes/avatar-routes');

const publicRoot = path.resolve(__dirname, '..', 'public');
const handlers = [handleAuthRoutes, handleAccountRoutes, handleTransferRoutes, handleSearchRoutes, handleSupportRoutes, handleProfileRoutes, handleAvatarRoutes, handleDataRoutes, handleImportRoutes, handleAdminRoutes];

const server = http.createServer(async (req, res) => {
  const url = requestUrl(req);
  applySecurityHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token' });
    return res.end();
  }
  try {
    for (const handler of handlers) {
      if (await handler(req, res, url)) return;
    }
    if (req.method === 'GET' && serveStatic(url.pathname, res)) return;
    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unexpected server error' });
  }
});

function serveStatic(pathname, res) {
  const files = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css' };
  let relative = files[pathname];
  let root = publicRoot;
  if (!relative && pathname.startsWith('/uploads/')) {
    relative = pathname.slice('/uploads/'.length);
    root = path.resolve(__dirname, '..', 'uploads');
  }
  if (!relative) return false;
  const filePath = path.join(root, relative);
  const type = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(filePath)] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length, 'Cache-Control': 'no-store' });
  res.end(content);
  return true;
}

if (require.main === module) {
  server.listen(config.port, config.host, () => console.log(`Asteria Bank is available at http://${config.host}:${config.port}`));
}

module.exports = { server };
