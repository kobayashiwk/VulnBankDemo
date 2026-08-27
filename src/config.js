'use strict';

const path = require('node:path');

module.exports = Object.freeze({
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'asteria.db'),
  sessionSecret: process.env.SESSION_SECRET || null,
  statementDirectory: path.join(__dirname, '..', 'statements'),
  importHosts: ['files.asteria.example'],
  diagnosticsTargets: ['127.0.0.1', 'localhost']
});

