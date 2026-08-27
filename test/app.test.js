'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../src/server');
const { resetDatabase, db } = require('../src/db');

let origin;

before(async () => {
  resetDatabase();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function signIn(username = 'alice', password = 'Spring2026!') {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrfToken: body.csrfToken };
}

test('serves the banking application and applies browser protections', async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Asteria Bank/);
  assert.match(html, /3ユーザーの現在残高/);
  assert.match(html, /新規振込/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  const script = await (await fetch(`${origin}/app.js`)).text();
  assert.doesNotMatch(script, /event\.currentTarget\.reset/);
  assert.match(script, /振込が完了しました/);
});

test('rejects invalid credentials without disclosing account state', async () => {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'alice', password: 'wrong' })
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid username or password' });
});

test('requires a valid CSRF token for balance-changing operations', async () => {
  const auth = await signIn();
  const response = await fetch(`${origin}/api/transfers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: auth.cookie }, body: JSON.stringify({ recipient: 'bob', amount: 10 })
  });
  assert.equal(response.status, 403);
});

test('commits a transfer atomically and exposes the database movement', async () => {
  const auth = await signIn();
  const aliceBefore = db.prepare("SELECT balance_cents FROM users WHERE username = 'alice'").get().balance_cents;
  const bobBefore = db.prepare("SELECT balance_cents FROM users WHERE username = 'bob'").get().balance_cents;
  const response = await fetch(`${origin}/api/transfers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken },
    body: JSON.stringify({ recipient: 'bob', amount: 1000, memo: 'Test payment' })
  });
  assert.equal(response.status, 201);
  assert.equal(db.prepare("SELECT balance_cents FROM users WHERE username = 'alice'").get().balance_cents, aliceBefore - 100000);
  assert.equal(db.prepare("SELECT balance_cents FROM users WHERE username = 'bob'").get().balance_cents, bobBefore + 100000);
  const activity = await fetch(`${origin}/api/data-activity`, { headers: { Cookie: auth.cookie } });
  const activityBody = await activity.json();
  assert.match(JSON.stringify(activityBody), /transfer\.completed/);
  assert.equal(activityBody.accountBalances.length, 3);
  assert.deepEqual(activityBody.accountBalances.map((account) => account.username), ['alice', 'bob', 'ops']);
});

test('prevents customers from reading another account', async () => {
  const auth = await signIn();
  const response = await fetch(`${origin}/api/accounts/2`, { headers: { Cookie: auth.cookie } });
  assert.equal(response.status, 403);
});
