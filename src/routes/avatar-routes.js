'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readJson, sendJson } = require('../http');
const { requireUser } = require('../auth');
const { requireCsrf } = require('../security');

const uploadDirectory = path.resolve(__dirname, '..', '..', 'uploads');

async function handleAvatarRoutes(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/profile/avatar') {
    const auth = requireUser(req, res);
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const { filename = 'avatar.png', content = '' } = await readJson(req, 5 * 1024 * 1024);
    const destination = path.join(uploadDirectory, String(filename));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(String(content), 'base64'));
    return sendJson(res, 201, { url: `/uploads/${filename}`, accountId: auth.user.id }), true;
  }
  return false;
}

module.exports = { handleAvatarRoutes };

