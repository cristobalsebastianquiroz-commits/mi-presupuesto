// ═══════════════════════════════════════════════════════════════
// BOLSILLO · ui.js — almacenamiento local, componentes y pantallas
// La lógica financiera vive en core.js; aquí solo se presenta.
// Todo texto ingresado por el usuario pasa por esc() antes de ir al DOM.
// ═══════════════════════════════════════════════════════════════
'use strict';
const C = Core, { esc, fmt } = Core;
const APP_VERSION = '5.3.0';
const KEY = 'bolsillo_v1', OWNER_KEY = 'bolsillo_owner', SESS_KEY = 'bolsillo_sess', THEME_KEY = 'bolsillo_theme';
const $ = id => document.getElementById(id);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// ── Estado de interfaz (no se sincroniza: es propio de cada dispositivo) ──
const UI = { tab: 'home', month: C.nowMk(), plan: 'budget', f: { q: '', type: 'all', cat: '', pago: '', all: false }, limit: 150, user: null, sync: 'off' };
let UF = parseFloat(ls.get('uf_v')) || 0, USD = parseFloat(ls.get('usd_v')) || 0;
const UF_FALLBACK = 38500; // solo para estimar mantención si nunca hubo conexión
const uf = () => UF || UF_FALLBACK;

// ── Datos ──────────────────────────────────────────────────────
let DB = null;
function getData() {
  if (DB) return DB;
  let raw = ls.get(KEY), d = {};
  try { d = JSON.parse(raw || '{}') || {}; } catch (e) { d = {}; }
  // Copia de seguridad única antes de migrar el formato anterior.
  if (raw && raw.length > 2 && (d.schema || 1) < C.SCHEMA && !ls.get(KEY + '_backup_v4')) ls.set(KEY + '_backup_v4', raw);
  const changed = C.normalize(d);
  DB = d;
  UI.bytes = raw ? new TextEncoder().encode(raw).length : 0;
  if (changed) persist();
  refreshUsdAssets();
  return DB;
}
function refreshUsdAssets() { if (USD > 0) DB.assets.forEach(a => { if (a.currency === 'USD' && a.amountUSD) a.value = Math.round(a.amountUSD * USD); }); }
function persist() {
  const str = JSON.stringify(DB);
  UI.bytes = new TextEncoder().encode(str).length;
  const ok = ls.set(KEY, str);
  if (!ok) toast('No se pudo guardar en este dispositivo (almacenamiento lleno o bloqueado).', { err: true });
  return ok;
}
// Confirmar una modificación del usuario: marca de tiempo, foto mensual del
// patrimonio, guardado local y sincronización diferida.
function commit() {
  DB.updatedAt = Date.now();
  try { DB.netWorthHist[C.nowMk()] = C.netWorth(DB, uf()).net; } catch (e) {}
  persist();
  if (window.Sync) Sync.schedule();
}
const touch = o => { o.u = Date.now(); return o; };
function removeFrom(col, id) { DB[col] = DB[col].filter(x => x.id !== id); DB.deleted[id] = Date.now(); }
// Interfaz que usa sync.js
window.App = {
  getDoc: () => JSON.parse(JSON.stringify(getData())),
  replaceDoc(d) { C.normalize(d); DB = d; refreshUsdAssets(); persist(); refresh(); },
  setSync(s) { UI.sync = s; paintSyncDot(); const el = $('sync-state'); if (el) el.textContent = syncLabel(); },
  onUser(u) { UI.user = u; if (u) { showApp(); } else { showLogin(); } },
  afterFirstSync() { autoTasks(); },
  resetLocal() { DB = null; ls.del(KEY); },
  dropCache() { DB = null; },
  toastErr(m) { toast(m, { err: true, ms: 8000 }); },
};

// ── Íconos (trazo, 24×24) ──────────────────────────────────────
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  plus: 'M12 5v14M5 12h14',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16.5 14h.01',
  more: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2M16 4v4M8 10v4M16 16v4',
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6', x: 'M18 6 6 18M6 6l12 12',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M20 6 9 17l-5-5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  card: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM2 10h20',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  cal: 'M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 10h18M8 3v4M16 3v4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};
const ico = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`;

// ── Componentes ────────────────────────────────────────────────
const safeColor = c => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#8A8478');
// Acciones declarativas: data-sheet / data-fn + data-arg (nunca se interpola
// texto del usuario dentro de código JavaScript).
const sh = (name, id) => ` data-sheet="${esc(name)}" data-id="${esc(id == null ? '' : id)}"`;
const fn = (name, arg) => ` data-fn="${esc(name)}" data-arg="${esc(arg == null ? '' : arg)}"`;
const catIcon = c => `<div class="ic" style="background:${safeColor(c.color)}22">${esc(c.icon || '•')}</div>`;
const pg = (p, tone = '', cls = '') => `<div class="pg ${tone} ${cls}" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${C.clamp(p, 0, 100)}%"></i></div>`;
const tag = (t, tone = '') => `<span class="tag ${tone}">${esc(t)}</span>`;
const empty = (icon, text, cta = '') => `<div class="empty"><div class="ei">${icon}</div><p>${text}</p>${cta}</div>`;
const card = (title, body, action = '') => `<section class="card">${title ? `<div class="card-h"><h2>${title}</h2>${action}</div>` : ''}${body}</section>`;
function row({ icon, title, sub, right, rsub, attr, chev }) {
  const tagName = attr ? 'button' : 'div';
  return `<${tagName} class="row"${attr || ''}>${icon || ''}<div class="b"><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>
    ${right != null || rsub ? `<div class="r">${right != null ? `<div class="a num">${right}</div>` : ''}${rsub ? `<div class="s">${rsub}</div>` : ''}</div>` : ''}${chev ? `<span class="chev">${ico('chevR')}</span>` : ''}</${tagName}>`;
}
const BAN_ICON = { bad: 'alert', warn: 'alert', info: 'info', good: 'check' };
const banner = i => `<button class="ban ${i.level}"${fn('insightGo', i.action.join('|'))}><span class="bi">${ico(BAN_ICON[i.level])}</span><span><div class="bt">${esc(i.title)}</div><div class="bx">${esc(i.text)}</div></span></button>`;
const PAGO = { cash: 'Efectivo', debit: 'Débito', credit: 'Crédito' };
const whenTxt = days => (days < 0 ? `venció hace ${-days} d` : days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`);

function toast(msg, { err = false, undo = null, ms = 4000 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (undo) { const b = document.createElement('button'); b.textContent = 'Deshacer'; b.onclick = () => { el.remove(); undo(); }; el.appendChild(b); }
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), undo ? 6000 : ms);
}

// ── Tema ───────────────────────────────────────────────────────
function applyTheme(t) {
  if (t) ls.set(THEME_KEY, t); else t = ls.get(THEME_KEY) || (ls.get('dk') === '1' ? 'dark' : 'auto');
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
  const m = $('mc'); if (m) m.setAttribute('content', dark ? '#0E1210' : '#F2EFE8');
  return t;
}

// ── Navegación ─────────────────────────────────────────────────
const TABS = [['home', 'Inicio', 'home'], ['moves', 'Movimientos', 'list'], ['plan', 'Planificar', 'target'], ['wealth', 'Patrimonio', 'wallet']];
const TITLES = { home: 'Inicio', moves: 'Movimientos', plan: 'Planificar', wealth: 'Patrimonio' };
function go(tab, opts = {}) {
  if (!TITLES[tab]) tab = 'home';
  UI.tab = tab;
  if (opts.plan) UI.plan = opts.plan;
  if (location.hash !== '#/' + tab) { try { history.replaceState(null, '', '#/' + tab); } catch (e) {} }
  refresh(true);
}
function syncLabel() { return { ok: 'Sincronizado', syncing: 'Sincronizando…', pending: 'Cambios por sincronizar', offline: 'Sin conexión: los cambios se guardan en este dispositivo', error: 'No se pudo sincronizar', off: 'Sin sincronización' }[UI.sync] || ''; }
function paintSyncDot() { const d = $('syncdot'); if (d) d.className = 'dot ' + (UI.sync === 'ok' || UI.sync === 'syncing' ? 'off' : UI.sync); }
function monthNav() {
  const cur = UI.month === C.nowMk();
  return `<div class="mnav" role="group" aria-label="Mes">
    <button aria-label="Mes anterior"${fn('shiftMonth', -1)}>${ico('chevL')}</button>
    <button class="lbl" aria-label="Elegir mes, ${esc(C.mlabel(UI.month))}"${sh('months')}><span class="full">${esc(C.mlabel(UI.month))}</span><span class="short">${C.MS[parseInt(UI.month.slice(5)) - 1]} ${UI.month.slice(0, 4)}</span></button>
    <button aria-label="Mes siguiente"${fn('shiftMonth', 1)}>${ico('chevR')}</button>
  </div>${cur ? '' : `<button class="chip"${fn('shiftMonth', 0)}>Hoy</button>`}`;
}
function paintChrome() {
  const withMonth = UI.tab !== 'wealth';
  $('top').innerHTML = `<h1>${TITLES[UI.tab]}</h1>${withMonth ? monthNav() : ''}
    <button class="iconbtn" aria-label="Más opciones y ajustes"${sh('more')}>${ico('more')}<span id="syncdot" class="dot off"></span></button>`;
  const btn = ([id, label, ic]) => `<button class="nb${UI.tab === id ? ' on' : ''}"${fn('go', id)} ${UI.tab === id ? 'aria-current="page"' : ''}>${ico(ic)}<span>${label}</span></button>`;
  $('nav').innerHTML = btn(TABS[0]) + btn(TABS[1]) + `<button class="nb-add" aria-label="Registrar movimiento"${sh('tx')}><span>${ico('plus')}</span></button>` + btn(TABS[2]) + btn(TABS[3]);
  $('side').innerHTML = `<div class="brand"><img src="icon.png" alt="">Bolsillo</div>
    <button class="btn pri"${sh('tx')}>${ico('plus')} Registrar</button>
    ${TABS.map(([id, label, ic]) => `<button class="sb${UI.tab === id ? ' on' : ''}"${fn('go', id)}>${ico(ic)}${label}</button>`).join('')}
    <div class="sp"></div><button class="sb"${sh('more')}>${ico('more')}Más y ajustes</button>`;
  paintSyncDot();
}
function paintMain(resetScroll) {
  if ($('app').hidden) return;
  paintChrome();
  const con = $('con');
  const y = con.scrollTop;
  con.innerHTML = `<div class="wrap">${({ home: renderHome, moves: renderMoves, plan: renderPlan, wealth: renderWealth })[UI.tab]()}</div>`;
  con.scrollTop = resetScroll ? 0 : y;
}
// Repinta la pantalla y, si hay una hoja de consulta abierta, también la hoja.
// Las hojas con formulario no se repintan solas: se perdería lo que se escribe.
function refresh(resetScroll) {
  paintMain(resetScroll);
  const top = STACK[STACK.length - 1];
  if (top && SHEETS[top.name].live) renderSheet(true);
}

// ── INICIO ─────────────────────────────────────────────────────
function renderHome() {
  const d = getData(), mk = UI.month, now = new Date(), isCur = mk === C.nowMk(now);
  const txs = C.mTxs(d, mk), t = C.totals(txs);
  if (!d.txs.length && !d.cards.length && !d.metas.length && !Object.keys(d.budgets).length) {
    return card('', empty('👋', `<strong>Bienvenido a Bolsillo.</strong><br>Registra tu primer ingreso o gasto y esta pantalla te mostrará cuánto tienes disponible, en qué se va tu plata y qué viene.`,
      `<button class="btn pri"${sh('tx')}>${ico('plus')} Registrar primer movimiento</button>`));
  }
  // Héroe: disponible del mes y, si es el mes en curso, cuánto queda por día.
  const dim = C.daysInMonth(mk), daysLeft = isCur ? dim - now.getDate() + 1 : 0;
  let sub = '';
  if (!txs.length) sub = 'Sin movimientos en este mes.';
  else if (isCur && t.net > 0 && daysLeft > 0) sub = `Quedan ${daysLeft} día${daysLeft !== 1 ? 's' : ''}: unos <strong class="num">${fmt(t.net / daysLeft)}</strong> por día.`;
  else if (t.net < 0) sub = 'Has gastado más de lo que ingresó este mes.';
  // Comparación justa con el mes anterior: mismo tramo de días.
  const prev = C.shiftMk(mk, -1), day = isCur ? now.getDate() : 31;
  const prevSpend = C.totals(C.mTxs(d, prev).filter(x => parseInt(String(x.date || '').slice(8, 10) || '1') <= day)).spend;
  const curSpend = t.spend;
  let cmp = '';
  if (prevSpend > 0 && curSpend > 0) {
    const diff = curSpend - prevSpend, p = Math.round(Math.abs(diff) / prevSpend * 100);
    if (p >= 1) cmp = `<button class="link"${sh('compare')}><span class="${diff > 0 ? 'neg' : 'pos'}">${diff > 0 ? '▲' : '▼'} ${p}% ${diff > 0 ? 'más' : 'menos'}</span> <span class="muted" style="font-weight:500">de gasto que ${esc(C.mlabel(prev).split(' ')[0].toLowerCase())}${isCur ? ' a esta fecha' : ''}</span></button>`;
  }
  const hero = `<section class="card hero">
    <div class="lbl">Disponible en ${esc(C.mlabel(mk).split(' ')[0].toLowerCase())}</div>
    <div class="big num ${t.net < 0 ? 'neg' : ''}" id="hero-net">${fmt(t.net)}</div>
    <div class="sub">${sub}</div>${cmp}
    <div class="stats">
      <div class="stat"><div class="k">Ingresos</div><div class="v num pos" id="st-inc">${fmt(t.inc)}</div></div>
      <div class="stat"><div class="k">Gastos</div><div class="v num" id="st-exp">${fmt(t.spend)}</div></div>
      <div class="stat"><div class="k">Ahorro</div><div class="v num" id="st-sav">${fmt(t.saved)}</div></div>
    </div>
    ${t.credit > 0 ? `<div class="hint" style="margin-top:10px">De tus gastos, <strong class="num">${fmt(t.credit)}</strong> fueron con tarjeta de crédito: se pagan en el estado de cuenta.</div>` : ''}
  </section>`;

  const ins = C.insights(d, mk, uf(), now);
  const cu = C.cloudUsage(UI.bytes || 0);
  if (UI.user && cu.level !== 'ok') ins.unshift({ level: cu.level, key: 'cloud', title: `Tus datos usan el ${cu.pct}% del espacio en la nube`, text: 'Al llegar al 100% dejarán de sincronizarse. Descarga un respaldo desde Más.', action: ['more', ''] });
  const insCard = ins.length ? card('Para revisar', ins.slice(0, 3).map(banner).join(''), ins.length > 3 ? `<button class="link"${sh('insights')}>Ver las ${ins.length}</button>` : '') : '';

  const up = isCur ? C.upcoming(d, uf(), now, 30) : [];
  const upCard = up.length ? card('Próximos 30 días', `<div class="rows">${up.slice(0, 4).map(upRow).join('')}</div>`, up.length > 4 ? `<button class="link"${sh('upcoming')}>Ver todo</button>` : '') : '';

  const bs = C.budgetSummary(d, mk);
  let budCard;
  if (bs.hasBudget) {
    const tone = bs.spentB > bs.totalB ? 'over' : C.pct(bs.spentB, bs.totalB) >= 85 ? 'warn' : 'ok';
    budCard = card('Presupuesto', `<div class="bud" style="border:none;padding-top:0"><div class="top"><span class="nm num">${fmt(bs.spentB)} <span class="muted" style="font-weight:500">de ${fmt(bs.totalB)}</span></span><span class="rt num ${bs.leftB < 0 ? 'neg' : 'muted'}">${bs.leftB < 0 ? fmt(-bs.leftB) + ' excedido' : fmt(bs.leftB) + ' libre'}</span></div>${pg(C.pct(bs.spentB, bs.totalB), tone)}</div>
      <div class="rows" style="margin-top:8px">${bs.rows.filter(r => r.status !== 'ok').concat(bs.rows.filter(r => r.status === 'ok' && r.left > 0)).slice(0, 4).map(budRow).join('')}</div>`, `<button class="link"${fn('goPlan', 'budget')}>Ver todo</button>`);
  } else {
    budCard = card('Presupuesto', `<p class="muted" style="margin-bottom:12px">Define un límite por categoría para saber cuánto puedes gastar sin pasarte.</p><button class="btn sec2"${fn('goPlan', 'budget')}>Crear presupuesto</button>`);
  }

  const cb = C.categoryBreakdown(d, mk);
  const catCard = cb.rows.length ? card('En qué se fue', `<div class="rows">${cb.rows.slice(0, 5).map(r => `<button class="bud"${sh('cat', r.c.id)}><div class="top"><span class="nm">${esc(r.c.icon)} ${esc(r.c.name)}</span><span class="rt num"><strong>${fmt(r.spent)}</strong> <span class="muted">· ${C.pct(r.spent, cb.total)}%</span></span></div>${pg(C.pct(r.spent, cb.rows[0].spent), '', 'sm')}</button>`).join('')}</div>`,
    cb.rows.length > 5 ? `<button class="link"${sh('cats-month')}>Ver las ${cb.rows.length}</button>` : '') : '';

  const goals = d.metas.filter(m => !m.done);
  const goalCard = goals.length ? card('Metas', `<div class="rows">${goals.slice(0, 3).map(m => { const p = C.goalProjection(d, m, now); return `<button class="bud"${sh('goal', m.id)}><div class="top"><span class="nm">${esc(m.emoji || '🎯')} ${esc(m.name)}</span><span class="rt num"><strong>${p.pct}%</strong></span></div>${pg(p.pct, '', 'sm')}<div class="ft"><span class="num">${fmt(p.saved)} de ${fmt(m.target)}</span></div></button>`; }).join('')}</div>`, `<button class="link"${fn('goPlan', 'goals')}>Ver todo</button>`) : '';

  const nw = C.netWorth(d, uf(), now), tr = C.netWorthTrend(d, nw.net, now);
  const nwCard = (nw.totalAssets || nw.totalDebt) ? `<button class="card" style="width:100%"${fn('go', 'wealth')}><div class="card-h" style="margin-bottom:4px"><h2>Patrimonio neto</h2><span class="chev muted">${ico('chevR')}</span></div>
    <div class="num ${nw.net < 0 ? 'neg' : ''}" style="font-size:20px;font-weight:700">${fmt(nw.net)}</div>
    ${tr.diff != null ? `<div class="hint num"><span class="${tr.diff >= 0 ? 'pos' : 'neg'}">${tr.diff >= 0 ? '▲' : '▼'} ${fmt(Math.abs(tr.diff))}</span> desde ${esc(C.mlabel(tr.lastKey).toLowerCase())}</div>` : ''}</button>` : '';

  return `<div class="cols"><div class="col">${hero}${insCard}${upCard}</div><div class="col">${budCard}${catCard}${goalCard}${nwCard}</div></div>`;
}
const UP_ICON = { card: 'card', recur: 'repeat', debt: 'user', loan: 'user' };
function upRow(u) {
  return row({ icon: `<div class="ic">${ico(UP_ICON[u.kind])}</div>`, title: esc(u.title), sub: `${esc(C.shortDate(u.date))} · ${whenTxt(u.days)}${u.estimate ? ' · estimado' : ''}`,
    right: `<span class="${u.income ? 'pos' : ''}">${u.income ? '+' : ''}${fmt(u.amount)}</span>`, attr: fn('insightGo', u.kind + '|' + u.id) });
}
function budRow(r) {
  return `<button class="bud"${sh('cat', r.c.id)}><div class="top"><span class="nm">${esc(r.c.icon)} ${esc(r.c.name)}</span><span class="rt num ${r.left < 0 ? 'neg' : 'muted'}">${r.left < 0 ? fmt(-r.left) + ' excedido' : 'quedan ' + fmt(r.left)}</span></div>${pg(r.pct, r.status, 'sm')}<div class="ft"><span class="num">${fmt(r.spent)} de ${fmt(r.b)}</span><span class="num">${r.pct}%</span></div></button>`;
}

// ── MOVIMIENTOS ────────────────────────────────────────────────
function filteredTxs() {
  const d = getData(), f = UI.f, q = f.q.trim().toLowerCase();
  let txs = f.all ? d.txs.slice() : C.mTxs(d, UI.month);
  if (f.type !== 'all') txs = txs.filter(t => t.type === f.type);
  if (f.cat) txs = txs.filter(t => t.cat === f.cat && t.type !== 'tr');
  if (f.pago) txs = txs.filter(t => t.pago === f.pago);
  if (q) txs = txs.filter(t => (t.desc || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q) || C.getCat(d, t.cat).name.toLowerCase().includes(q) || String(t.amount).includes(q.replace(/\D/g, '') || '§'));
  const idx = new Map(d.txs.map((t, i) => [t.id, i]));
  return txs.sort((a, b) => (String(b.date || '') > String(a.date || '') ? 1 : String(b.date || '') < String(a.date || '') ? -1 : idx.get(b.id) - idx.get(a.id)));
}
function txRow(t) {
  const d = getData();
  if (t.type === 'tr') {
    const from = (d.accounts.find(a => a.id === t.acc) || {}).name || 'Cuenta', toC = d.cards.find(c => c.id === t.toCard);
    const to = toC ? (toC.alias || toC.tipo) : (d.accounts.find(a => a.id === t.toAcc) || {}).name || 'Cuenta';
    if (t.owe) {
      const [k, oid] = t.owe.split('|'), o = (d[k] || []).find(x => x.id === oid), acc = d.accounts.find(a => a.id === (t.acc || t.toAcc));
      return row({ icon: `<div class="ic">${ico('user')}</div>`, title: esc(t.desc || 'Abono'), sub: `${k === 'deudas' ? 'Pago de deuda' : 'Cobro de préstamo'}${acc ? ' · ' + esc(acc.name) : ''}`, right: `<span class="${k === 'cobros' ? 'pos' : ''}">${k === 'cobros' ? '+' : '−'}${fmt(t.amount)}</span>`, attr: o ? sh('owe', t.owe) : '' });
    }
    return row({ icon: `<div class="ic">${ico('swap')}</div>`, title: esc(t.desc || (toC ? 'Pago de tarjeta' : 'Transferencia')), sub: `${esc(from)} → ${esc(to)}`, right: fmt(t.amount), attr: sh('transfer', t.id) });
  }
  const c = C.getCat(d, t.cat), acc = t.acc && d.accounts.find(a => a.id === t.acc);
  const bits = [esc(c.name)];
  if (t.pago) bits.push(PAGO[t.pago] || '');
  if (acc) bits.push(esc(acc.name));
  if (t.note) bits.push(esc(t.note));
  return row({ icon: catIcon(c), title: `${esc(t.desc || c.name)}${t.isRecur ? ' <span class="muted" title="Recurrente">↻</span>' : ''}`, sub: bits.filter(Boolean).join(' · '),
    right: `<span class="${t.type === 'inc' ? 'pos' : ''}">${t.type === 'inc' ? '+' : '−'}${fmt(t.amount).replace('-', '')}</span>`, attr: sh('tx', t.id) });
}
function movesList() {
  const txs = filteredTxs(), f = UI.f;
  if (!txs.length) {
    const filtered = f.q || f.type !== 'all' || f.cat || f.pago;
    return card('', filtered ? empty('🔍', 'Ningún movimiento coincide con el filtro.', `<button class="btn sec2 sm"${fn('clearFilters')}>Quitar filtros</button>`)
      : empty('🧾', `Aún no hay movimientos en ${esc(C.mlabel(UI.month).toLowerCase())}.`, `<button class="btn pri"${sh('tx')}>${ico('plus')} Registrar movimiento</button>`));
  }
  const t = C.totals(txs);
  let h = `<div class="hint num" id="moves-sum" style="margin:10px 4px 0">${txs.length} movimiento${txs.length !== 1 ? 's' : ''} · Ingresos ${fmt(t.inc)} · Gastos ${fmt(t.exp)}</div>`;
  const shown = txs.slice(0, UI.limit), groups = [];
  shown.forEach(x => { const k = x.date || ''; const g = groups[groups.length - 1]; if (g && g.k === k) g.items.push(x); else groups.push({ k, items: [x] }); });
  groups.forEach(g => {
    const gt = C.totals(g.items);
    h += `<div class="day"><span>${g.k ? esc(C.dateLabel(g.k)) : 'Sin fecha'}</span><span class="num">${gt.net >= 0 ? '+' : '−'}${fmt(Math.abs(gt.net))}</span></div><section class="card"><div class="rows">${g.items.map(txRow).join('')}</div></section>`;
  });
  if (txs.length > shown.length) h += `<button class="btn sec2" style="margin-top:12px"${fn('showMore')}>Mostrar más (${txs.length - shown.length})</button>`;
  return h;
}
function renderMoves() {
  const d = getData(), f = UI.f;
  const chip = (v, l) => `<button class="chip${f.type === v ? ' on' : ''}"${fn('setType', v)}>${l}</button>`;
  return `<div class="narrow"><div class="search">${ico('search')}<input type="search" id="q" placeholder="Buscar movimientos" value="${esc(f.q)}" aria-label="Buscar movimientos" autocomplete="off"></div>
  <div class="chips" style="margin-top:10px">
    ${chip('all', 'Todos')}${chip('exp', 'Gastos')}${chip('inc', 'Ingresos')}${d.accounts.length ? chip('tr', 'Transferencias') : ''}
    <select class="chip${f.cat ? ' on' : ''}" id="f-cat" aria-label="Filtrar por categoría"><option value="">Categoría</option>${C.allCats(d).map(c => `<option value="${esc(c.id)}"${f.cat === c.id ? ' selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select>
    <select class="chip${f.pago ? ' on' : ''}" id="f-pago" aria-label="Filtrar por medio de pago"><option value="">Medio de pago</option>${Object.keys(PAGO).map(k => `<option value="${k}"${f.pago === k ? ' selected' : ''}>${PAGO[k]}</option>`).join('')}</select>
    <button class="chip${f.all ? ' on' : ''}"${fn('toggleAll')} aria-pressed="${f.all}">Todo el historial</button>
  </div>
  <div id="moves-list">${movesList()}</div></div>`;
}

// ── PLANIFICAR ─────────────────────────────────────────────────
function renderPlan() {
  const seg = `<div class="seg" role="tablist" style="margin-bottom:12px">${[['budget', 'Presupuesto'], ['goals', 'Metas'], ['recur', 'Recurrentes']].map(([k, l]) => `<button role="tab" aria-selected="${UI.plan === k}" class="${UI.plan === k ? 'on' : ''}"${fn('goPlan', k)}>${l}</button>`).join('')}</div>`;
  return `<div class="narrow">${seg}${({ budget: planBudget, goals: planGoals, recur: planRecur })[UI.plan]()}</div>`;
}
function planBudget() {
  const d = getData(), mk = UI.month, bs = C.budgetSummary(d, mk), t = C.totals(C.mTxs(d, mk));
  if (!bs.hasBudget) {
    const sug = C.suggestBudget(d, mk), prev = d.budgets[C.shiftMk(mk, -1)], hasPrev = prev && Object.values(prev).some(v => v > 0);
    return card('', empty('🎯', `No hay presupuesto para ${esc(C.mlabel(mk).toLowerCase())}. Un límite por categoría te dice cuánto puedes gastar sin pasarte.`,
      `<div class="btns">${sug.months ? `<button class="btn pri"${fn('budgetSuggest')}>Proponer según mi promedio (${sug.months} mes${sug.months > 1 ? 'es' : ''})</button>` : ''}
       ${hasPrev ? `<button class="btn sec2"${fn('budgetCopy')}>Copiar el de ${esc(C.mlabel(C.shiftMk(mk, -1)).toLowerCase())}</button>` : ''}
       <button class="btn ${sug.months ? 'sec2' : 'pri'}"${sh('budget-add')}>Definir manualmente</button></div>`));
  }
  const tone = bs.spentB > bs.totalB ? 'over' : C.pct(bs.spentB, bs.totalB) >= 85 ? 'warn' : 'ok';
  let h = `<section class="card hero"><div class="lbl">${bs.leftB < 0 ? 'Excedido del presupuesto' : 'Libre del presupuesto'}</div>
    <div class="big num ${bs.leftB < 0 ? 'neg' : ''}">${fmt(Math.abs(bs.leftB))}</div>
    ${pg(C.pct(bs.spentB, bs.totalB), tone)}
    <div class="stats"><div class="stat"><div class="k">Presupuestado</div><div class="v num">${fmt(bs.totalB)}</div></div><div class="stat"><div class="k">Gastado</div><div class="v num">${fmt(bs.spentB)}</div></div><div class="stat"><div class="k">Ingreso del mes</div><div class="v num">${fmt(t.inc)}</div></div></div></section>`;
  if (t.inc > 0 && bs.totalB > t.inc) h += `<div class="ban warn" style="margin-top:12px"><span class="bi">${ico('alert')}</span><span><div class="bt">El plan supera tu ingreso</div><div class="bx">Presupuestaste ${fmt(bs.totalB - t.inc)} más de lo que registras como ingreso este mes.</div></span></div>`;
  h += `<div class="sec"><span>Categorías con límite</span><button class="link"${sh('budget-add')}>+ Agregar</button></div><section class="card"><div class="rows">${bs.rows.map(r => budRow(r).replace(sh('cat', r.c.id), sh('budget-cat', r.c.id))).join('')}</div></section>`;
  if (bs.unbudgeted.length) h += `<div class="sec"><span>Gasto sin presupuesto · ${fmt(bs.outside)}</span></div><section class="card"><div class="rows">${bs.unbudgeted.map(r => row({ icon: catIcon(r.c), title: esc(r.c.name), sub: 'Toca para ponerle un límite', right: fmt(r.spent), attr: sh('budget-cat', r.c.id) })).join('')}</div></section>`;
  return h;
}
function goalCard(m) {
  const d = getData(), p = C.goalProjection(d, m), lc = m.linkedCat ? C.getCat(d, m.linkedCat) : null;
  let line;
  if (p.reached || m.done) line = `<span class="pos">Meta alcanzada</span>`;
  else if (p.needPerMonth != null) line = `Necesitas <strong class="num">${fmt(p.needPerMonth)}</strong>/mes para ${esc(C.mlabel(m.deadline).toLowerCase())} ${p.onTrack === true ? tag('En camino', 'g') : p.onTrack === false ? tag('Vas atrasado', 'y') : ''}`;
  else if (p.etaMk) line = `A tu ritmo (<span class="num">${fmt(p.avg)}</span>/mes) la alcanzas en ${esc(C.mlabel(p.etaMk).toLowerCase())}`;
  else line = 'Aún sin aportes recientes para proyectar';
  return `<button class="card" style="width:100%;margin-bottom:12px"${sh('goal', m.id)}>
    <div class="bud" style="border:none;padding:0"><div class="top"><span class="nm" style="font-size:16px">${esc(m.emoji || '🎯')} ${esc(m.name)}</span><span class="rt num" style="font-size:16px"><strong>${p.pct}%</strong></span></div>
    ${pg(p.pct, p.reached ? 'ok' : '')}
    <div class="ft"><span class="num">${fmt(p.saved)} de ${fmt(m.target)}</span><span class="num">${p.left > 0 ? 'faltan ' + fmt(p.left) : ''}</span></div>
    <div class="hint">${line}</div>${lc ? `<div class="hint">Los gastos en ${esc(lc.icon)} ${esc(lc.name)} abonan a esta meta</div>` : ''}</div></button>`;
}
function planGoals() {
  const d = getData(), act = d.metas.filter(m => !m.done), done = d.metas.filter(m => m.done);
  if (!d.metas.length) return card('', empty('🎯', 'Una meta le da propósito a tu ahorro: fondo de emergencia, un viaje, el pie de un depto.', `<button class="btn pri"${sh('goal-form')}>${ico('plus')} Crear meta</button>`));
  const month = C.sum(C.mTxs(d, UI.month).filter(t => t.metaId), t => t.amount);
  return `${month > 0 ? `<div class="note">Aportaste <strong class="num">${fmt(month)}</strong> a tus metas en ${esc(C.mlabel(UI.month).toLowerCase())}.</div>` : ''}
    ${act.map(goalCard).join('')}${done.length ? `<div class="sec"><span>Completadas</span></div>${done.map(goalCard).join('')}` : ''}
    <button class="btn sec2"${sh('goal-form')}>${ico('plus')} Nueva meta</button>`;
}
function planRecur() {
  const d = getData(), cur = C.nowMk();
  const inc = C.sum(d.recur.filter(r => r.type === 'inc' && !r.paused), r => r.amount), exp = C.sum(d.recur.filter(r => r.type === 'exp' && !r.paused), r => r.amount);
  const sug = C.detectRecurring(d);
  let h = '';
  if (!d.recur.length) h += card('', empty('🔁', 'Los movimientos recurrentes (sueldo, arriendo, suscripciones) se registran solos cada mes en el día que indiques.', `<button class="btn pri"${sh('recur-form')}>${ico('plus')} Agregar recurrente</button>`));
  else {
    h += `<section class="card"><div class="stats" style="border:none;margin:0;padding:0;grid-template-columns:1fr 1fr 1fr"><div class="stat"><div class="k">Ingresos fijos</div><div class="v num pos">${fmt(inc)}</div></div><div class="stat"><div class="k">Gastos fijos</div><div class="v num">${fmt(exp)}</div></div><div class="stat"><div class="k">${inc ? 'Queda libre' : 'Movimientos'}</div><div class="v num ${inc && inc - exp < 0 ? 'neg' : ''}">${inc ? fmt(inc - exp) : d.recur.length}</div></div></div></section>
    <div class="sec"><span>Cada mes</span><button class="link"${sh('recur-form')}>+ Agregar</button></div><section class="card"><div class="rows">${d.recur.map(r => {
      const c = C.getCat(d, r.cat), done = d.recurApplied[r.id + '|' + cur];
      return row({ icon: catIcon(c), title: esc(r.desc || c.name), sub: `Día ${C.recurDay(r, cur)} · ${r.type === 'inc' ? 'Ingreso' : PAGO[r.pago] || 'Gasto'}${r.paused ? ' · En pausa' : done ? ' · Registrado este mes' : ''}`, right: `<span class="${r.type === 'inc' ? 'pos' : ''}">${r.type === 'inc' ? '+' : '−'}${fmt(r.amount)}</span>`, attr: sh('recur-form', r.id) });
    }).join('')}</div></section>`;
  }
  if (sug.length) h += `<div class="sec"><span>Detectados en tu historial</span></div><section class="card"><div class="rows">${sug.slice(0, 5).map((r, i) => row({ icon: catIcon(C.getCat(d, r.cat)), title: esc(r.desc), sub: 'Registrado 3 meses seguidos', right: fmt(r.amount), rsub: `<button class="link"${fn('recurFromSuggestion', i)}>Automatizar</button>` })).join('')}</div></section>`;
  return h;
}

// ── PATRIMONIO ─────────────────────────────────────────────────
function sparkline(series) {
  if (series.length < 2) return '';
  const vs = series.map(s => s.v), min = Math.min(...vs), max = Math.max(...vs), W = 300, H = 48, span = max - min || 1;
  const pts = vs.map((v, i) => `${(i / (vs.length - 1) * W).toFixed(1)},${(H - 4 - (v - min) / span * (H - 8)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolución del patrimonio en ${series.length} meses"><polyline points="${pts}" fill="none" stroke="var(--ac)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function oweRow(kind, c) {
  const left = C.owedLeft(c);
  return row({ icon: `<div class="ic">${esc((String(c.name || '?')[0] || '?').toUpperCase())}</div>`, title: esc(c.name), sub: `${esc(c.desc || (kind === 'deudas' ? 'Deuda' : 'Préstamo'))}${c.due ? ' · vence ' + esc(C.dateLabel(c.due)) : ''}${c.paid > 0 && !c.done ? ' · abonado ' + fmt(c.paid) : ''}`,
    right: c.done ? tag(kind === 'deudas' ? 'Pagada' : 'Cobrado', 'g') : fmt(left), attr: sh('owe', kind + '|' + c.id) });
}
function renderWealth() {
  const d = getData(), now = new Date(), nw = C.netWorth(d, uf(), now), tr = C.netWorthTrend(d, nw.net, now);
  const head = `<section class="card hero"><div class="lbl">Patrimonio neto</div><div class="big num ${nw.net < 0 ? 'neg' : ''}" id="nw-net">${fmt(nw.net)}</div>
    <div class="sub num">${tr.diff != null ? `<span class="${tr.diff >= 0 ? 'pos' : 'neg'}">${tr.diff >= 0 ? '▲' : '▼'} ${fmt(Math.abs(tr.diff))}</span> desde ${esc(C.mlabel(tr.lastKey).toLowerCase())}` : 'Lo que tienes menos lo que debes.'}</div>
    ${sparkline(tr.series)}
    <div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><div class="k">Tienes</div><div class="v num pos" id="nw-assets">${fmt(nw.totalAssets)}</div></div><div class="stat"><div class="k">Debes</div><div class="v num ${nw.totalDebt ? 'neg' : ''}" id="nw-debt">${fmt(nw.totalDebt)}</div></div></div></section>
    <button class="card" style="width:100%"${sh('kpis')}><div class="row" style="border:none;padding:0;min-height:0"><div class="ic">${ico('chart')}</div><div class="b"><div class="t">Salud financiera</div><div class="s">Ahorro, deuda, fondo de emergencia y costo de vida</div></div><span class="chev">${ico('chevR')}</span></div></button>`;
  const sect = (title, add, body) => `<section class="card"><div class="card-h"><h2>${title}</h2>${add}</div>${body}</section>`;
  const accs = sect('Cuentas y efectivo', `<button class="link"${sh('account-form')}>+ Agregar</button>`, d.accounts.length
    ? `<div class="rows">${d.accounts.map(a => row({ icon: `<div class="ic">${esc(a.icon || '🏦')}</div>`, title: esc(a.name), sub: { bank: 'Cuenta bancaria', cash: 'Efectivo', savings: 'Ahorro' }[a.kind] || 'Cuenta', right: `<span class="${C.accountBalance(d, a) < 0 ? 'neg' : ''}">${fmt(C.accountBalance(d, a))}</span>`, attr: sh('account-form', a.id) })).join('')}</div>${d.accounts.length ? `<button class="btn sec2" style="margin-top:12px"${sh('transfer')}>${ico('swap')} Transferir o pagar tarjeta</button>` : ''}`
    : `<p class="muted">Opcional: agrega tu cuenta con su saldo de hoy y Bolsillo lo mantendrá al día con cada ingreso, gasto y pago de tarjeta.</p>`);
  const cards = sect('Tarjetas de crédito', `<button class="link"${sh('card-new')}>+ Agregar</button>`, d.cards.length
    ? `<div class="rows">${d.cards.map(c => { const s = C.cardStatus(c, uf(), now); return row({ icon: `<div class="ic">${ico('card')}</div>`, title: esc(c.alias || c.tipo), sub: `${s.next.closed ? 'Pagar' : 'Próximo pago'} ${esc(C.shortDate(s.next.due))} · ${fmt(s.next.total)}${s.next.closed ? '' : ' est.'}`, right: `<span class="${s.bal ? 'neg' : ''}">${fmt(s.bal)}</span>`, rsub: 'en cuotas', attr: sh('card', c.id) }); }).join('')}</div>`
    : `<p class="muted">Controla tus cuotas, el próximo pago y cuánto de tu cupo está comprometido.</p>`);
  const debts = sect('Debo', `<button class="link"${sh('owe-form', 'deudas')}>+ Agregar</button>`, d.deudas.length ? `<div class="rows">${d.deudas.filter(x => !x.done).concat(d.deudas.filter(x => x.done)).map(x => oweRow('deudas', x)).join('')}</div>` : `<p class="muted">Préstamos o plata que le debes a alguien.</p>`);
  const loans = sect('Me deben', `<button class="link"${sh('owe-form', 'cobros')}>+ Agregar</button>`, d.cobros.length ? `<div class="rows">${d.cobros.filter(x => !x.done).concat(d.cobros.filter(x => x.done)).map(x => oweRow('cobros', x)).join('')}</div>` : `<p class="muted">Plata que prestaste y esperas recuperar.</p>`);
  const assets = sect('Bienes e inversiones', `<button class="link"${sh('asset-form')}>+ Agregar</button>`, d.assets.length
    ? `<div class="rows">${d.assets.map(a => row({ icon: `<div class="ic">${esc(a.icon || '💰')}</div>`, title: esc(a.name), sub: a.currency === 'USD' ? `US$${C.group(a.amountUSD)}${USD ? ' · dólar a ' + fmt(USD) : ''}` : '', right: fmt(a.value), attr: sh('asset-form', a.id) })).join('')}</div>`
    : `<p class="muted">Propiedades, vehículos, inversiones u otros ahorros.</p>`);
  const goals = nw.goals ? `<button class="card" style="width:100%"${fn('goPlan', 'goals')}><div class="row" style="border:none;padding:0;min-height:0"><div class="ic">${ico('target')}</div><div class="b"><div class="t">Ahorrado en metas</div><div class="s">${d.metas.length} meta${d.metas.length !== 1 ? 's' : ''}</div></div><div class="r"><div class="a num">${fmt(nw.goals)}</div></div></div></button>` : '';
  return `<div class="cols"><div class="col">${head}${accs}${goals}${assets}</div><div class="col">${cards}${debts}${loans}</div></div>`;
}

// ── Hoja inferior (pila con "volver") ──────────────────────────
const SHEETS = {};
let STACK = [];
function openSheet(name, data) {
  if (!SHEETS[name]) return;
  STACK.push({ name, data, state: {} });
  renderSheet();
  $('ov').classList.add('on'); $('sh').classList.add('on');
  document.body.dataset.sheet = '1';
}
function renderSheet(keepScroll) {
  const top = STACK[STACK.length - 1]; if (!top) return;
  const def = SHEETS[top.name], body = $('shb'), y = body.scrollTop;
  const html = def.body(top.data, top.state);
  if (html == null) { sheetBack(); return; }
  $('sht').textContent = typeof def.title === 'function' ? def.title(top.data, top.state) : def.title;
  $('shback').innerHTML = STACK.length > 1 ? ico('chevL') : ''; $('shback').style.visibility = STACK.length > 1 ? 'visible' : 'hidden';
  $('shclose').innerHTML = ico('x');
  body.innerHTML = html;
  body.scrollTop = keepScroll ? y : 0;
  if (def.after) def.after(top.data, top.state);
  if (!keepScroll && def.focus) setTimeout(() => { const el = $(def.focus); if (el && STACK.length) el.focus(); }, 300);
}
function sheetBack() { STACK.pop(); if (!STACK.length) closeSheet(); else renderSheet(); }
function closeSheet() {
  STACK = []; $('ov').classList.remove('on'); $('sh').classList.remove('on'); delete document.body.dataset.sheet;
  setTimeout(() => { if (!STACK.length) $('shb').innerHTML = ''; }, 320); // no dejar formularios ocultos en el DOM
}
// Tras guardar: vuelve a la hoja anterior si la hay; si no, cierra.
function doneSheet(msg, opts) { STACK.pop(); if (!STACK.length) closeSheet(); else renderSheet(); paintMain(); if (msg) toast(msg, opts); }
const rerender = () => renderSheet(true);

// ── Acciones de navegación / filtros ───────────────────────────
const ACTIONS = {
  go: t => go(t),
  goPlan: k => { closeSheet(); go('plan', { plan: k }); },
  shiftMonth: n => { n = parseInt(n); UI.month = n === 0 ? C.nowMk() : C.shiftMk(UI.month, n); UI.limit = 150; refresh(true); },
  pickMonth: mk => { if (C.isMk(mk)) UI.month = mk; closeSheet(); refresh(true); },
  setType: v => { UI.f.type = v; refresh(); },
  toggleAll: () => { UI.f.all = !UI.f.all; refresh(); },
  clearFilters: () => { UI.f = { q: '', type: 'all', cat: '', pago: '', all: UI.f.all }; refresh(); },
  showMore: () => { UI.limit += 150; refresh(); },
  insightGo: a => {
    const [k, id] = String(a).split('|');
    if (k === 'tab') { closeSheet(); go(id); }
    else if (k === 'cat') openSheet('cat', id);
    else if (k === 'card') openSheet('card', id);
    else if (k === 'debt') openSheet('owe', 'deudas|' + id);
    else if (k === 'loan') openSheet('owe', 'cobros|' + id);
    else if (k === 'compare') openSheet('compare');
    else if (k === 'more') openSheet('more');
    else { closeSheet(); go('plan', { plan: 'recur' }); }
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-sheet],[data-fn]');
  if (!el || el.disabled) return;
  if (el.dataset.sheet) { openSheet(el.dataset.sheet, el.dataset.id || null); return; }
  const f = ACTIONS[el.dataset.fn];
  if (f) f(el.dataset.arg, el);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { UI.f.q = t.value; UI.limit = 150; $('moves-list').innerHTML = movesList(); }
  else if (t.dataset.money != null) onMoneyInput(t);
  if (t.classList.contains('err')) clearErr(t);
  bindField(t);
});
// Enlace campo → estado de la hoja (data-k), para que un repintado parcial
// del formulario nunca pierda lo que el usuario ya escribió.
function bindField(t) {
  const top = STACK[STACK.length - 1], def = top && SHEETS[top.name];
  if (!def || !$('sh').contains(t)) return;
  if (t.dataset.k) top.state[t.dataset.k] = t.value;
  if (def.input) def.input(t, top.data, top.state);
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'f-cat') { UI.f.cat = t.value; refresh(); }
  else if (t.id === 'f-pago') { UI.f.pago = t.value; refresh(); }
  else if (t.tagName === 'SELECT' || t.type === 'date' || t.type === 'month' || t.type === 'file') bindField(t);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && STACK.length) closeSheet();
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && $('sh').contains(e.target)) { const b = $('shb').querySelector('.btn.pri'); if (b) { e.preventDefault(); b.click(); } }
});
window.addEventListener('hashchange', () => { const t = location.hash.replace('#/', ''); if (TITLES[t] && t !== UI.tab) go(t); });

// ── Campos de dinero y validación ──────────────────────────────
function onMoneyInput(el) {
  const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const fromEnd = el.value.length - (el.selectionStart || 0);
  el.value = digits ? C.group(parseInt(digits.slice(0, 13), 10)) : '';
  const pos = Math.max(el.value.length - fromEnd, 0);
  try { el.setSelectionRange(pos, pos); } catch (e) {}
}
const moneyVal = id => C.parseMoney(($(id) || {}).value);
const val = id => (($(id) || {}).value || '').trim();
const moneyInput = (id, v, ph = '0') => `<div class="money"><input class="inp num" type="text" inputmode="numeric" autocomplete="off" data-money id="${id}" placeholder="${ph}" value="${v ? C.group(v) : ''}"></div>`;
function setErr(id, msg) {
  const el = $(id); if (!el) return false;
  el.classList.add('err'); el.setAttribute('aria-invalid', 'true');
  const host = el.closest('.fld') || el.parentElement;
  let m = host.querySelector('.ferr'); if (!m) { m = document.createElement('div'); m.className = 'ferr'; m.setAttribute('role', 'alert'); host.appendChild(m); }
  m.textContent = msg; el.focus();
  return false;
}
function clearErr(el) { el.classList.remove('err'); el.removeAttribute('aria-invalid'); const m = (el.closest('.fld') || el.parentElement).querySelector('.ferr'); if (m) m.remove(); }
// Confirmación dentro de la app (reemplaza confirm() del navegador).
let CONFIRM = null;
function confirmSheet(title, text, label, onYes) { CONFIRM = onYes; openSheet('confirm', JSON.stringify({ title, text, label })); }
SHEETS.confirm = {
  title: d => JSON.parse(d).title,
  body: d => { const o = JSON.parse(d); return `<p class="muted" style="text-align:center;margin:8px 0 4px">${esc(o.text)}</p><div class="btns"><button class="btn pri" style="background:var(--rd);color:#fff"${fn('confirmYes')}>${esc(o.label)}</button><button class="btn sec2"${fn('sheetBack')}>Cancelar</button></div>`; },
};
ACTIONS.confirmYes = () => { const f = CONFIRM; CONFIRM = null; STACK.pop(); if (f) f(); };
ACTIONS.sheetBack = () => sheetBack();

// ── Tareas automáticas (después de sincronizar, nunca antes) ───
let AUTO_DONE = false;
function autoTasks() {
  if (AUTO_DONE) return; AUTO_DONE = true;
  const d = getData(), cur = C.nowMk();
  let changed = false;
  const n = C.applyRecurrents(d);
  if (n) changed = true;
  // Presupuesto: si el mes en curso no tiene, parte con el del mes anterior.
  const has = o => o && Object.values(o).some(v => v > 0);
  if (!has(d.budgets[cur]) && has(d.budgets[C.shiftMk(cur, -1)]) && !d.budgetsU[cur]) { d.budgets[cur] = { ...d.budgets[C.shiftMk(cur, -1)] }; d.budgetsU[cur] = Date.now(); changed = true; }
  if (changed) { commit(); refresh(); if (n) toast(`${n} movimiento${n > 1 ? 's' : ''} recurrente${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''}.`); }
}

// ── Indicadores externos (UF y dólar) ──────────────────────────
// Mismos endpoints que usaba la versión anterior (mindicador.cl, por fecha).
// Si fallan, se conservan los últimos valores guardados; nunca se inventa uno.
async function fetchIndicator(name, min, max) {
  try {
    const n = new Date();
    const res = await fetch(`https://mindicador.cl/api/${name}/${C.pad(n.getDate())}-${C.pad(n.getMonth() + 1)}-${n.getFullYear()}`);
    if (!res.ok) return null;
    const j = await res.json(), v = j && j.serie && j.serie[0] && j.serie[0].valor;
    return v > min && v < max ? Math.round(v) : null;
  } catch (e) { return null; }
}
async function fetchIndicators() {
  const [u, usd] = await Promise.all([fetchIndicator('uf', 10000, 200000), fetchIndicator('dolar', 100, 5000)]);
  if (u) { UF = u; ls.set('uf_v', UF); }
  if (usd) { USD = usd; ls.set('usd_v', USD); }
  if ((u || usd) && DB) { refreshUsdAssets(); refresh(); }
}

// ── Arranque ───────────────────────────────────────────────────
function showApp() {
  $('login').hidden = true; $('app').hidden = false;
  const t = location.hash.replace('#/', '');
  go(TITLES[t] ? t : 'home');
}
function showLogin() { closeSheet(); $('app').hidden = true; $('login').hidden = false; }
function boot() {
  applyTheme();
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch (e) {} }
  let sess = null; try { sess = JSON.parse(ls.get(SESS_KEY) || 'null'); } catch (e) {}
  if (sess && sess.uid) {
    UI.user = sess; showApp();
    // Si la nube no responde (sin conexión), las tareas automáticas corren igual.
    setTimeout(autoTasks, 6000);
    setTimeout(fetchIndicators, 1500);
  } else showLogin();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
