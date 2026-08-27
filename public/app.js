'use strict';

const state = { csrfToken: '', user: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (cents) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(cents / 100);

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (state.csrfToken && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method)) headers['X-CSRF-Token'] = state.csrfToken;
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function formJson(form) { return JSON.stringify(Object.fromEntries(new FormData(form))); }
function flash(message, error = false) { const el = $('#flash'); el.textContent = message; el.classList.remove('hidden', 'error-flash'); if (error) el.classList.add('error-flash'); setTimeout(() => el.classList.add('hidden'), 4500); }

async function loadSession() {
  try {
    const data = await api('/api/me'); state.user = data.user; showApp(); await Promise.all([loadLedger(), loadData()]);
  } catch { $('#login-view').classList.remove('hidden'); }
}

function showApp() {
  $('#login-view').classList.add('hidden'); $('#app-view').classList.remove('hidden');
  $('#balance').textContent = money(state.user.balanceCents); $('#daily-limit').textContent = money(state.user.dailyLimitCents); $('#transfer-limit').textContent = money(state.user.dailyLimitCents);
  $('#sidebar-name').textContent = state.user.fullName; $('#sidebar-role').textContent = state.user.role; $('#sidebar-avatar').textContent = state.user.fullName.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  $('#profile-name').value = state.user.fullName; $('#profile-email').value = state.user.email;
  if (state.user.role === 'operations') $$('.operations-only').forEach((el) => el.classList.remove('hidden'));
}

async function refreshUser() { const { user } = await api('/api/me'); state.user = user; showApp(); }
async function loadLedger() { const { entries } = await api('/api/ledger'); $('#ledger-body').innerHTML = entries.length ? entries.map((e) => `<tr><td>${escapeText(e.reference)}</td><td>${escapeText(e.direction === 'outgoing' ? e.recipient_name : e.sender_name)}</td><td>${escapeText(e.memo)}</td><td>${escapeText(e.created_at)}</td><td class="${e.direction === 'outgoing' ? 'amount-out' : 'amount-in'}">${e.direction === 'outgoing' ? '−' : '+'}${money(e.amount_cents)}</td></tr>`).join('') : '<tr><td colspan="5">No movements yet.</td></tr>'; }
function escapeText(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }

async function loadTickets() { $('#ticket-list').innerHTML = await api('/api/support/view'); }
async function loadData() { const data = await api('/api/data-activity'); $('#sync-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); $('#table-stats').innerHTML = data.tableStats.map((x) => `<article><span>${escapeText(x.table)}</span><strong>${x.rows} rows</strong><small>${escapeText(x.scope)}</small></article>`).join(''); $('#activity-body').innerHTML = data.activity.map((x) => `<tr><td>#${x.id}</td><td>${escapeText(x.action)}</td><td>${escapeText(x.details)}</td><td>${escapeText(x.created_at)}</td></tr>`).join(''); }

function switchView(name) {
  $$('.view').forEach((el) => el.classList.toggle('hidden', el.dataset.page !== name)); $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
  const titles = { overview:'Overview',transfer:'Move money',directory:'Recipient directory',support:'Support',statements:'Statements',profile:'Profile',data:'Data activity',operations:'Operations' }; $('#view-title').textContent = titles[name] || name;
  if (name === 'support') loadTickets().catch((e) => flash(e.message, true)); if (name === 'data') loadData().catch((e) => flash(e.message, true)); if (name === 'operations') loadOperations().catch((e) => flash(e.message, true));
}

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); $('#login-error').textContent = ''; try { const data = await api('/api/auth/login', { method:'POST', body:formJson(event.currentTarget) }); state.csrfToken = data.csrfToken; await loadSession(); } catch (error) { $('#login-error').textContent = error.message; } });
$('#recovery-button').addEventListener('click', async () => { const email = prompt('Enter your registered email address'); if (!email) return; try { const data = await api('/api/auth/recovery', { method:'POST', body:JSON.stringify({ email }) }); alert(data.message); } catch (error) { alert(error.message); } });
$('#logout-button').addEventListener('click', async () => { try { await api('/api/auth/logout', { method:'POST' }); } finally { location.reload(); } });
$('#nav').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (button) switchView(button.dataset.view); });
document.addEventListener('click', (event) => { const button = event.target.closest('[data-go]'); if (button) switchView(button.dataset.go); });

$('#transfer-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/transfers', { method:'POST', body:formJson(event.currentTarget) }); event.currentTarget.reset(); flash(`Transfer ${data.reference} completed.`); await Promise.all([refreshUser(), loadLedger(), loadData()]); switchView('overview'); } catch (error) { flash(error.message, true); } });
$('#reward-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/rewards/redeem', { method:'POST', body:formJson(event.currentTarget) }); flash(`${money(data.creditedCents)} credited.`); await Promise.all([refreshUser(), loadData()]); } catch (error) { flash(error.message, true); } });
$('#search-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const q = new FormData(event.currentTarget).get('q'); const data = await api(`/api/directory?q=${encodeURIComponent(q)}`); $('#search-summary').textContent = `${data.people.length} result(s) for “${data.query}”`; $('#people-results').innerHTML = data.people.map((p) => `<article class="person"><strong>${escapeText(p.full_name)}</strong><small>@${escapeText(p.username)}</small></article>`).join(''); } catch (error) { flash(error.message, true); } });
$('#support-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/support', { method:'POST', body:formJson(event.currentTarget) }); event.currentTarget.reset(); flash(`Support request #${data.id} created.`); await Promise.all([loadTickets(), loadData()]); } catch (error) { flash(error.message, true); } });
$('#profile-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/profile', { method:'PATCH', body:formJson(event.currentTarget) }); flash('Profile updated.'); await Promise.all([refreshUser(), loadData()]); } catch (error) { flash(error.message, true); } });
$('#download-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const month = new FormData(event.currentTarget).get('month'); const data = await api(`/api/statements/download?month=${encodeURIComponent(month)}`); $('#statement-output').textContent = data.content; } catch (error) { $('#statement-output').textContent = error.message; } });
$('#import-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/statements/import', { method:'POST', body:formJson(event.currentTarget) }); flash(data.message); } catch (error) { flash(error.message, true); } });
$('#refresh-data').addEventListener('click', () => loadData().catch((e) => flash(e.message, true)));

async function loadOperations() { const { users } = await api('/api/operations/users'); $('#operations-users').innerHTML = users.map((u) => `<div class="user-row"><span><strong>${escapeText(u.full_name)}</strong><small>@${escapeText(u.username)}</small></span><span>${escapeText(u.role)}</span></div>`).join(''); }
$('#diagnostics-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/operations/diagnostics', { method:'POST', body:formJson(event.currentTarget) }); $('#diagnostics-output').textContent = data.output; } catch (error) { $('#diagnostics-output').textContent = error.message; } });

loadSession();

