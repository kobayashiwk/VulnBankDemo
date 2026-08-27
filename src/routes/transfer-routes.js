'use strict';

const crypto = require('node:crypto');
const { db, logActivity } = require('../db');
const { readJson, sendJson } = require('../http');
const { requireUser } = require('../auth');
const { requireCsrf } = require('../security');

async function handleTransferRoutes(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/transfers') {
    const auth = requireUser(req, res);
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const { recipient = '', amount = 0, memo = '' } = await readJson(req);
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents === 0) return sendJson(res, 400, { error: 'Enter a transfer amount' }), true;
    if (amountCents > auth.user.daily_limit_cents) return sendJson(res, 400, { error: 'Transfer exceeds the daily limit' }), true;
    const destination = db.prepare('SELECT id, username FROM users WHERE username = ?').get(String(recipient));
    if (!destination || destination.id === auth.user.id) return sendJson(res, 400, { error: 'Choose another valid recipient' }), true;

    const reference = `AST-${crypto.randomUUID()}`;
    try {
      const debit = db.prepare('UPDATE users SET balance_cents = balance_cents - ? WHERE id = ? AND balance_cents >= ?').run(amountCents, auth.user.id, amountCents);
      if (debit.changes !== 1) throw Object.assign(new Error('Insufficient funds'), { statusCode: 409 });
      db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(amountCents, destination.id);
      db.prepare('INSERT INTO transactions (reference, from_user_id, to_user_id, amount_cents, memo) VALUES (?, ?, ?, ?, ?)')
        .run(reference, auth.user.id, destination.id, Math.abs(amountCents), String(memo).slice(0, 140));
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message }), true;
    }
    logActivity(auth.user.id, 'transfer.completed', `${reference} to ${destination.username}`);
    return sendJson(res, 201, { reference, status: 'completed' }), true;
  }

  if (req.method === 'POST' && url.pathname === '/api/rewards/redeem') {
    const auth = requireUser(req, res);
    if (!auth || !requireCsrf(req, res, auth.session)) return true;
    const { code = '' } = await readJson(req);
    try {
      const coupon = db.prepare('SELECT code, credit_cents FROM coupons WHERE code = ?').get(String(code).toUpperCase());
      if (!coupon) throw Object.assign(new Error('Code is invalid'), { statusCode: 409 });
      db.prepare('UPDATE coupons SET redeemed_by = ?, redeemed_at = CURRENT_TIMESTAMP WHERE code = ?').run(auth.user.id, coupon.code);
      db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(coupon.credit_cents, auth.user.id);
      logActivity(auth.user.id, 'reward.redeemed', coupon.code);
      return sendJson(res, 200, { creditedCents: coupon.credit_cents }), true;
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message }), true;
    }
  }
  return false;
}

module.exports = { handleTransferRoutes };
