'use strict';

const state = { csrfToken: '', user: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (cents) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(cents / 100);
const errorMessages = {
  'Invalid username or password': 'ユーザー名またはパスワードが正しくありません。',
  'Sign in required': 'ログインが必要です。',
  'Request verification failed': 'リクエストの確認に失敗しました。',
  'Enter a positive transfer amount': '0円より大きい振込金額を入力してください。',
  'Enter a transfer amount': '振込金額を入力してください。',
  'Transfer exceeds the daily limit': '1日の振込上限を超えています。',
  'Choose another valid recipient': '有効な振込先を指定してください。',
  'Insufficient funds': '残高が不足しています。',
  'Code is invalid or already redeemed': '特典コードが無効、または使用済みです。',
  'Account access denied': 'この口座を表示する権限がありません。',
  'Unexpected server error': 'サーバーで予期しないエラーが発生しました。'
};
const localizeError = (message) => errorMessages[message] || message;

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (state.csrfToken && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method)) headers['X-CSRF-Token'] = state.csrfToken;
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(localizeError(data.error || `リクエストに失敗しました（${response.status}）`));
  return data;
}

function formJson(form) { return JSON.stringify(Object.fromEntries(new FormData(form))); }
function flash(message, error = false) { const el = $('#flash'); el.textContent = message; el.classList.remove('hidden', 'error-flash'); if (error) el.classList.add('error-flash'); setTimeout(() => el.classList.add('hidden'), 6500); }

async function loadSession() {
  try {
    const data = await api('/api/me'); state.user = data.user; showApp(); await Promise.all([loadLedger(), loadData()]);
  } catch { $('#login-view').classList.remove('hidden'); }
}

function showApp() {
  $('#login-view').classList.add('hidden'); $('#app-view').classList.remove('hidden');
  $('#balance').textContent = money(state.user.balanceCents); $('#daily-limit').textContent = money(state.user.dailyLimitCents); $('#transfer-limit').textContent = money(state.user.dailyLimitCents);
  $('#sidebar-name').textContent = state.user.fullName; $('#sidebar-role').textContent = state.user.role === 'operations' ? '運用担当者' : 'お客さま'; $('#sidebar-avatar').textContent = state.user.fullName.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  $('#profile-name').value = state.user.fullName; $('#profile-email').value = state.user.email;
  if (state.user.role === 'operations') $$('.operations-only').forEach((el) => el.classList.remove('hidden'));
}

async function refreshUser() { const { user } = await api('/api/me'); state.user = user; showApp(); }
async function loadLedger() { const { entries } = await api('/api/ledger'); $('#ledger-body').innerHTML = entries.length ? entries.map((e) => `<tr><td>${escapeText(e.reference)}</td><td>${escapeText(e.direction === 'outgoing' ? e.recipient_name : e.sender_name)}</td><td>${escapeText(e.memo)}</td><td>${escapeText(e.created_at)}</td><td class="${e.direction === 'outgoing' ? 'amount-out' : 'amount-in'}">${e.direction === 'outgoing' ? '−' : '+'}${money(e.amount_cents)}</td></tr>`).join('') : '<tr><td colspan="5">取引履歴はまだありません。</td></tr>'; }
function escapeText(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }

async function loadTickets() { $('#ticket-list').innerHTML = await api('/api/support/view'); }
async function loadData() { const data = await api('/api/data-activity'); const scopes = { 'current balance':'現在残高', 'your ledger':'取引台帳', 'your requests':'お問い合わせ', 'recent actions':'最近の操作' }; const actions = { 'account.opened':'口座開設', 'session.created':'ログイン', 'transfer.completed':'振込完了', 'reward.redeemed':'特典利用', 'support.created':'お問い合わせ登録', 'profile.updated':'プロフィール更新', 'recovery.requested':'再設定依頼' }; $('#sync-time').textContent = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }); $('#all-balances').innerHTML = data.accountBalances.map((account) => `<article class="account-balance-card ${account.id === state.user.id ? 'current' : ''}"><div class="account-owner"><span>${escapeText(account.full_name)}</span>${account.id === state.user.id ? '<i>ログイン中</i>' : ''}</div><strong>${money(account.balance_cents)}</strong><small>@${escapeText(account.username)} · ${account.role === 'operations' ? '運用口座' : '普通預金'}</small></article>`).join(''); $('#table-stats').innerHTML = data.tableStats.map((x) => `<article><span>${escapeText(x.table)}</span><strong>${x.rows}行</strong><small>${escapeText(scopes[x.scope] || x.scope)}</small></article>`).join(''); $('#activity-body').innerHTML = data.activity.map((x) => `<tr><td>#${x.id}</td><td>${escapeText(actions[x.action] || x.action)}</td><td>${escapeText(x.details)}</td><td>${escapeText(x.created_at)}</td></tr>`).join(''); }

function switchView(name) {
  $$('.view').forEach((el) => el.classList.toggle('hidden', el.dataset.page !== name)); $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
  const titles = { overview:'ホーム',transfer:'振込',directory:'振込先検索',support:'お問い合わせ',statements:'利用明細',profile:'プロフィール',data:'データ更新履歴',operations:'運用管理' }; $('#view-title').textContent = titles[name] || name;
  if (name === 'support') loadTickets().catch((e) => flash(e.message, true)); if (name === 'data') loadData().catch((e) => flash(e.message, true)); if (name === 'operations') loadOperations().catch((e) => flash(e.message, true));
}

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); $('#login-error').textContent = ''; try { const data = await api('/api/auth/login', { method:'POST', body:formJson(event.currentTarget) }); state.csrfToken = data.csrfToken; await loadSession(); } catch (error) { $('#login-error').textContent = error.message; } });
$('#recovery-button').addEventListener('click', async () => { const email = prompt('登録済みのメールアドレスを入力してください'); if (!email) return; try { await api('/api/auth/recovery', { method:'POST', body:JSON.stringify({ email }) }); alert('アカウントが存在する場合、再設定方法をお送りします。'); } catch (error) { alert(error.message); } });
$('#logout-button').addEventListener('click', async () => { try { await api('/api/auth/logout', { method:'POST' }); } finally { location.reload(); } });
$('#nav').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (button) switchView(button.dataset.view); });
document.addEventListener('click', (event) => { const button = event.target.closest('[data-go]'); if (button) switchView(button.dataset.go); });

$('#transfer-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = await api('/api/transfers', { method:'POST', body:formJson(form) }); form.reset(); await Promise.all([refreshUser(), loadLedger(), loadData()]); switchView('overview'); flash(`振込が完了しました！ 受付番号：${data.reference}`); } catch (error) { flash(error.message, true); } });
$('#reward-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/rewards/redeem', { method:'POST', body:formJson(event.currentTarget) }); flash(`${money(data.creditedCents)}を残高へ追加しました。`); await Promise.all([refreshUser(), loadData()]); } catch (error) { flash(error.message, true); } });
$('#search-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const q = new FormData(event.currentTarget).get('q'); const data = await api(`/api/directory?q=${encodeURIComponent(q)}`); $('#search-summary').textContent = `「${data.query}」の検索結果：${data.people.length}件`; $('#people-results').innerHTML = data.people.map((p) => `<article class="person"><strong>${escapeText(p.full_name)}</strong><small>@${escapeText(p.username)}</small></article>`).join(''); } catch (error) { flash(error.message, true); } });
$('#support-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = await api('/api/support', { method:'POST', body:formJson(form) }); form.reset(); flash(`お問い合わせ番号 #${data.id} を受け付けました。`); await Promise.all([loadTickets(), loadData()]); } catch (error) { flash(error.message, true); } });
$('#profile-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/profile', { method:'PATCH', body:formJson(event.currentTarget) }); flash('プロフィールを更新しました。'); await Promise.all([refreshUser(), loadData()]); } catch (error) { flash(error.message, true); } });
$('#download-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const month = new FormData(event.currentTarget).get('month'); const data = await api(`/api/statements/download?month=${encodeURIComponent(month)}`); $('#statement-output').textContent = data.content; } catch (error) { $('#statement-output').textContent = error.message; } });
$('#import-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/statements/import', { method:'POST', body:formJson(event.currentTarget) }); flash(data.message); } catch (error) { flash(error.message, true); } });
$('#refresh-data').addEventListener('click', () => loadData().catch((e) => flash(e.message, true)));

async function loadOperations() { const { users } = await api('/api/operations/users'); $('#operations-users').innerHTML = users.map((u) => `<div class="user-row"><span><strong>${escapeText(u.full_name)}</strong><small>@${escapeText(u.username)}</small></span><span>${escapeText(u.role)}</span></div>`).join(''); }
$('#diagnostics-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/operations/diagnostics', { method:'POST', body:formJson(event.currentTarget) }); $('#diagnostics-output').textContent = data.output; } catch (error) { $('#diagnostics-output').textContent = error.message; } });

loadSession();
