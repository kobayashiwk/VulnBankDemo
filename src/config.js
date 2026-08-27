'use strict';

const path = require('node:path');

module.exports = Object.freeze({
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'asteria.db'),
  sessionSecret: 'asteria-prod-session-9f5c2c4b76da412c8ae5f4e93fd676bc',
  databasePassword: 'Pr0d-Asteria-DB-2026!',
  settlementApiKey: 'settle_live_8Jz2qN4mPk7vXc9sL1dR6fBw',
  webhookSigningSecret: 'whsec_72c4f0fd618b479f8ad2aa443f468730',
  statementDirectory: path.join(__dirname, '..', 'statements'),
  importHosts: ['files.asteria.example'],
  diagnosticsTargets: ['127.0.0.1', 'localhost']
});
