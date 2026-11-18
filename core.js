// ═══════════════════════════════════════════════════════════════
// BOLSILLO · core.js — lógica financiera pura (sin DOM ni red)
// Se usa en el navegador (window.Core) y en Node (tests/core.test.js).
// Toda función recibe los datos y la fecha "now" como parámetros, de modo
// que los cálculos son deterministas y se pueden probar.
// ═══════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 2;
  const MS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // kind: 'exp' (gasto) | 'inc' (ingreso). Los ids existentes no cambian.
  const BASE_CATS = [
    { id: 'food', name: 'Alimentación', icon: '🛒', color: '#3A8C5E' },
    { id: 'restaurant', name: 'Restaurantes', icon: '🍽️', color: '#D4682A' },
    { id: 'transport', name: 'Transporte', icon: '🚌', color: '#2E7AB5' },
    { id: 'car', name: 'Auto/Bencina', icon: '⛽', color: '#5C6BC0' },
    { id: 'home', name: 'Hogar', icon: '🏠', color: '#7B5EA7' },
    { id: 'rent', name: 'Arriendo', icon: '🔑', color: '#C05E8E' },
    { id: 'health', name: 'Salud', icon: '💊', color: '#C94040' },
    { id: 'gym', name: 'Deporte/Gym', icon: '🏋️', color: '#2E9E80' },
    { id: 'leisure', name: 'Ocio', icon: '🎬', color: '#E07840' },
    { id: 'clothes', name: 'Ropa', icon: '👕', color: '#9B59B6' },
    { id: 'tech', name: 'Tecnología', icon: '📱', color: '#2980B9' },
    { id: 'subs', name: 'Suscripciones', icon: '📺', color: '#D81B7A' },
    { id: 'travel', name: 'Viajes', icon: '✈️', color: '#0097A7' },
    { id: 'edu', name: 'Educación', icon: '📚', color: '#5D7A3E' },
    { id: 'pets', name: 'Mascotas', icon: '🐾', color: '#A0522D' },
    { id: 'gifts', name: 'Regalos', icon: '🎁', color: '#B8860B' },
    { id: 'savings', name: 'Ahorro', icon: '🐷', color: '#B07D1E' },
    { id: 'invest', name: 'Inversión', icon: '📈', color: '#1B6B38' },
    { id: 'other', name: 'Otros', icon: '📦', color: '#7A7468' },
    { id: 'salary', name: 'Sueldo', icon: '💼', color: '#1F7A4D', kind: 'inc' },
    { id: 'side', name: 'Honorarios / extra', icon: '🧾', color: '#2E7AB5', kind: 'inc' },
    { id: 'income', name: 'Otros ingresos', icon: '💵', color: '#3A8C5E', kind: 'inc' },
  ];
  const UNKNOWN_CAT = { id: '?', name: 'Sin categoría', icon: '❔', color: '#8A8478' };
  const FIXED_CAT_IDS = ['food', 'transport', 'car', 'home', 'rent', 'health', 'edu', 'pets'];
  const SAVINGS_CAT_IDS = ['savings', 'invest'];
  const COLLECTIONS = ['txs', 'cats', 'metas', 'cobros', 'deudas', 'cards', 'assets', 'accounts', 'recur'];

  // ── Texto seguro ────────────────────────────────────────────
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

  // ── Fechas (siempre en hora local; nunca toISOString/UTC) ────
  const pad = n => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && isoDate(parseISO(s)) === s;
  const isMk = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s));
  const mkOf = s => String(s).slice(0, 7);
  const nowMk = (now = new Date()) => isoDate(now).slice(0, 7);
  const shiftMk = (mk, delta) => {
    let [y, m] = mk.split('-').map(Number);
    m += delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    return `${y}-${pad(m)}`;
  };
  const mkDiff = (a, b) => { const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number); return (ay - by) * 12 + (am - bm); };
  const daysInMonth = mk => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const dateLabel = s => { const [y, m, d] = String(s).split('-'); return `${parseInt(d)} ${MS[parseInt(m) - 1]} ${y}`; };
  const shortDate = d => `${d.getDate()} ${MS[d.getMonth()].toLowerCase()}`;
  const mlabel = mk => { const [y, m] = mk.split('-'); return MONTHS[parseInt(m) - 1] + ' ' + y; };
  const daysBetween = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  // Fecha por defecto al registrar: hoy si se mira el mes en curso; si se mira
  // otro mes, un día dentro de ese mes (para que el movimiento no "desaparezca").
  const defaultDateFor = (mk, now = new Date()) => {
    if (mk === nowMk(now)) return isoDate(now);
    return `${mk}-${pad(mk < nowMk(now) ? daysInMonth(mk) : 1)}`;
  };

  // ── Dinero (CLP: enteros, separador de miles con punto) ──────
  const group = n => String(Math.round(Math.abs(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fmt = n => (Math.round(n || 0) < 0 ? '-$' : '$') + group(n);
  const parseMoney = s => { const dgt = String(s == null ? '' : s).replace(/\D/g, ''); return dgt ? parseInt(dgt, 10) : 0; };
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  let _n = 0;
  const uid = () => Date.now().toString(36) + (_n++ % 1296).toString(36) + Math.random().toString(36).slice(2, 6);

  // ── Documento: valores por defecto y migraciones ─────────────
  // No elimina información. Devuelve true si modificó algo persistente.
  function normalize(d) {
    let changed = false;
    for (const k of COLLECTIONS) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['budgets', 'budgetsU', 'netWorthHist', 'applied', 'recurApplied', 'deleted'])
      if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {};
    // Metas: de contador manual "saved" a base + aportes (migración original).
    d.metas.forEach(m => {
      if (!m._migrated) {
        const linked = sum(d.txs.filter(t => t.metaId === m.id), t => t.amount);
        m.baseSaved = (m.saved || 0) - linked;
        delete m.saved; m._migrated = true; changed = true;
      }
    });
    // Abonos sin id (versión anterior): id determinista según su posición.
    ['deudas', 'cobros'].forEach(k => (d[k] || []).forEach(c => (c.abonos || []).forEach((a, i) => { if (a && a.id == null) { a.id = `ab_${c.id}_${i}`; changed = true; } })));
    // Recurrentes: de "mes aplicado" (global) a aplicado por recurrente y mes.
    if ((d.schema || 1) < 2) {
      Object.keys(d.applied).forEach(mk => {
        if (d.applied[mk]) d.recur.forEach(r => { if (r.startMonth !== mk) d.recurApplied[r.id + '|' + mk] = 1; });
      });
      d.schema = SCHEMA; changed = true;
    }
    return changed;
  }
  const emptyDoc = () => { const d = {}; normalize(d); return d; };

  // ── Categorías ───────────────────────────────────────────────
  const allCats = d => [...BASE_CATS, ...(d.cats || [])];
  const getCat = (d, id) => allCats(d).find(c => c.id === id) || UNKNOWN_CAT;
  const catKind = c => c.kind || 'exp';
  const catsOf = (d, kind) => allCats(d).filter(c => catKind(c) === kind);
  const catUsage = (d, id) => d.txs.filter(t => t.cat === id).length + d.recur.filter(r => r.cat === id).length;

  // ── Movimientos y totales ────────────────────────────────────
  const mTxs = (d, mk) => d.txs.filter(t => t.month === mk);
  // inc: ingresos · exp: todo lo egresado (incluye aportes a ahorro)
  // saved: aportes a ahorro/inversión · spend: consumo (exp − saved)
  // credit: parte del gasto pagada con tarjeta de crédito · net: inc − exp
  // Las transferencias (type 'tr') no son ingreso ni gasto.
  function totals(txs) {
    let inc = 0, exp = 0, saved = 0, credit = 0;
    for (const t of txs) {
      const a = t.amount || 0;
      if (t.type === 'inc') inc += a;
      else if (t.type === 'exp') {
        exp += a;
        if (SAVINGS_CAT_IDS.includes(t.cat)) saved += a;
        if (t.pago === 'credit') credit += a;
      }
    }
    return { inc, exp, saved, spend: exp - saved, credit, net: inc - exp };
  }

  function categoryBreakdown(d, mk) {
    const txs = mTxs(d, mk).filter(t => t.type === 'exp');
    const by = {};
    txs.forEach(t => { by[t.cat] = (by[t.cat] || 0) + t.amount; });
    const rows = Object.keys(by).map(id => ({ c: getCat(d, id), spent: by[id] })).sort((a, b) => b.spent - a.spent);
    return { total: sum(rows, r => r.spent), rows };
  }

  // Promedio mensual de gasto por categoría en los n meses anteriores a mk
  // que tienen movimientos (un mes vacío no baja el promedio).
  function avgByCat(d, mk, n = 3) {
    const months = [];
    for (let i = 1; i <= n; i++) { const k = shiftMk(mk, -i); if (mTxs(d, k).length) months.push(k); }
    const out = {};
    if (!months.length) return { months: 0, by: out };
    months.forEach(k => mTxs(d, k).forEach(t => { if (t.type === 'exp') out[t.cat] = (out[t.cat] || 0) + t.amount; }));
    Object.keys(out).forEach(k => { out[k] = Math.round(out[k] / months.length); });
    return { months: months.length, by: out };
  }

  // ── Presupuesto ──────────────────────────────────────────────
  function budgetSummary(d, mk) {
    const budget = d.budgets[mk] || {};
    const { rows: spentRows } = categoryBreakdown(d, mk);
    const spentBy = {}; spentRows.forEach(r => { spentBy[r.c.id] = r.spent; });
    const rows = Object.keys(budget).filter(id => budget[id] > 0).map(id => {
      const b = budget[id], spent = spentBy[id] || 0, p = pct(spent, b);
      const saving = SAVINGS_CAT_IDS.includes(id); // ahorrar más de lo planeado es bueno
      return { c: getCat(d, id), b, spent, left: b - spent, pct: p, saving, status: saving ? 'ok' : spent > b ? 'over' : (p >= 85 && spent < b) ? 'warn' : 'ok' };
    }).sort((a, b) => b.pct - a.pct);
    const unbudgeted = spentRows.filter(r => !(budget[r.c.id] > 0));
    const totalB = sum(rows, r => r.b), spentB = sum(rows, r => r.spent);
    return { rows, unbudgeted, totalB, spentB, leftB: totalB - spentB, outside: sum(unbudgeted, r => r.spent), hasBudget: rows.length > 0 };
  }
  // Sugerencia de presupuesto: promedio real de los últimos meses, redondeado
  // hacia arriba al millar. No inventa cifras: sin historial no sugiere nada.
  function suggestBudget(d, mk) {
    const { months, by } = avgByCat(d, mk, 3);
    const out = {};
    Object.keys(by).forEach(id => { if (by[id] > 0 && getCat(d, id) !== UNKNOWN_CAT) out[id] = Math.ceil(by[id] / 1000) * 1000; });
    return { months, budget: out };
  }

  // ── Metas ────────────────────────────────────────────────────
  const metaSaved = (d, m) => (m.baseSaved || 0) + sum(d.txs.filter(t => t.metaId === m.id), t => t.amount);
  const linkedMetaFor = (d, catId) => d.metas.find(m => !m.done && m.linkedCat === catId) || null;
  function goalProjection(d, m, now = new Date()) {
    const saved = metaSaved(d, m), left = Math.max(m.target - saved, 0);
    const cur = nowMk(now);
    // Aporte mensual promedio de los últimos 3 meses cerrados con aportes.
    let tot = 0, n = 0;
    for (let i = 1; i <= 3; i++) {
      const s = sum(d.txs.filter(t => t.metaId === m.id && t.month === shiftMk(cur, -i)), t => t.amount);
      if (s > 0) { tot += s; n++; }
    }
    const avg = n ? Math.round(tot / n) : 0;
    const out = { saved, left, pct: clamp(pct(saved, m.target), 0, 100), avg, reached: saved >= m.target, etaMk: null, monthsLeft: null, needPerMonth: null, onTrack: null };
    if (left > 0 && avg > 0) { out.monthsLeft = Math.ceil(left / avg); out.etaMk = shiftMk(cur, out.monthsLeft); }
    if (left > 0 && m.deadline && isMk(m.deadline)) {
      const mLeft = Math.max(mkDiff(m.deadline, cur) + 1, 1);
      out.needPerMonth = Math.ceil(left / mLeft);
      out.onTrack = avg > 0 ? avg >= out.needPerMonth : null;
    }
    return out;
  }

  // ── Tarjetas de crédito ──────────────────────────────────────
  // Timbres y estampillas (DL 3475): 0,066% × (cuotas + 1), una sola vez.
  // Tasa calibrada por el autor original contra estados de cuenta reales.
  const stampsTax = (amt, inst) => (inst > 1 ? Math.round(amt * 0.00066 * (inst + 1)) : 0);
  function instPlan(amt, inst, type, ratePct) {
    inst = Math.max(parseInt(inst) || 1, 1);
    const r = (ratePct || 0) / 100;
    let monthly = amt / inst, interest = 0;
    if (type === 'yes' && inst > 1 && r > 0) {
      monthly = amt * (r * Math.pow(1 + r, inst)) / (Math.pow(1 + r, inst) - 1);
      interest = monthly * inst - amt;
    }
    const stamps = stampsTax(amt, inst);
    return { monthly: Math.round(monthly), interest: Math.round(interest), stamps, total: Math.round(monthly * inst + stamps) };
  }
  const cardCut = c => clamp(parseInt(c && c.cut) || 5, 1, 28);
  const cardDueDays = c => clamp(parseInt(c && c.due) || 12, 1, 45);
  // Ciclo ABIERTO: el estado de cuenta que aún no cierra.
  function billingCycle(card, now = new Date()) {
    let y = now.getFullYear(), m = now.getMonth() + 1;
    if (now.getDate() > cardCut(card)) { m++; if (m > 12) { m = 1; y++; } }
    return `${y}-${pad(m)}`;
  }
  const cycleCutDate = (card, cyc) => { const [y, m] = cyc.split('-').map(Number); return new Date(y, m - 1, cardCut(card)); };
  const cycleDueDate = (card, cyc) => { const [y, m] = cyc.split('-').map(Number); return new Date(y, m - 1, cardCut(card) + cardDueDays(card)); };
  function purchState(p, cyc) {
    const el = mkDiff(cyc, p.from), cur = el + 1;
    return { cur, rem: clamp(p.installments - el, 0, p.installments), active: cur >= 1 && cur <= p.installments };
  }
  const activePurch = card => (card.purchases || []).filter(p => p.active !== false);
  function cycleTotal(card, cyc, UF) {
    let purch = 0, tax = 0;
    activePurch(card).forEach(p => {
      const st = purchState(p, cyc);
      if (st.active) { purch += p.instAmt; if (p.stamps && st.cur === 1) tax += p.stamps; }
    });
    const mant = Math.round((card.mant || 0) * UF);
    const ext = sum((card.extras || []).filter(e => e.active), e => e.amount);
    return { cycle: cyc, purch, tax, mant, ext, total: purch + tax + mant + ext };
  }
  const debtFrom = (card, cyc) => sum(activePurch(card), p => p.instAmt * purchState(p, cyc).rem);
  // Próximo pago REAL: si el último estado ya cerró pero aún no vence, ese es
  // el que hay que pagar (antes se mostraba el ciclo siguiente por error).
  function nextPayment(card, UF, now = new Date()) {
    const open = billingCycle(card, now), closed = shiftMk(open, -1);
    const closedDue = cycleDueDate(card, closed);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const paid = (card.paidCycles || {})[closed];
    // Un estado facturado sin marcar como pagado se sigue mostrando hasta
    // 7 días después de su vencimiento (como "vencido"); luego se asume pagado.
    const graceEnd = new Date(closedDue.getFullYear(), closedDue.getMonth(), closedDue.getDate() + 7);
    if (graceEnd >= today && !paid) {
      const t = cycleTotal(card, closed, UF);
      if (t.total > 0) return { ...t, due: closedDue, closed: true, overdue: closedDue < today };
    }
    return { ...cycleTotal(card, open, UF), due: cycleDueDate(card, open), closed: false };
  }
  function cardStatus(card, UF, now = new Date()) {
    const open = billingCycle(card, now), next = nextPayment(card, UF, now);
    const bal = debtFrom(card, next.closed ? next.cycle : open);
    return { open, cut: cycleCutDate(card, open), current: cycleTotal(card, open, UF), next, bal, used: card.limit > 0 ? clamp(pct(bal, card.limit), 0, 100) : null };
  }
  function cardProjection(card, UF, now = new Date(), n = 3) {
    const base = billingCycle(card, now), start = nextPayment(card, UF, now).closed ? 0 : 1;
    return Array.from({ length: n }, (_, i) => { const cyc = shiftMk(base, i + start); return { cycle: cyc, total: cycleTotal(card, cyc, UF).total }; });
  }
  // Mantiene enlazados un movimiento pagado con crédito y su compra en la
  // tarjeta: crear, actualizar o quitar la compra según el estado del movimiento.
  function syncTxPurchase(d, tx, opts = {}, now = new Date()) {
    const ts = Date.now();
    const find = () => { for (const c of d.cards) { const p = (c.purchases || []).find(x => x.txId === tx.id); if (p) return { c, p }; } return null; };
    // Compras creadas por la versión anterior no guardaban el vínculo: se
    // adopta la que coincide exactamente (monto y descripción previos).
    const adopt = () => {
      if (tx.purchId || !opts.legacy) return null;
      const amt = opts.prevAmount != null ? opts.prevAmount : tx.amount, desc = (opts.prevDesc != null ? opts.prevDesc : tx.desc) || 'Compra';
      for (const c of d.cards) { const p = (c.purchases || []).find(x => x.fromTx && !x.txId && x.amount === amt && x.desc === desc); if (p) { p.txId = tx.id; return { c, p }; } }
      return null;
    };
    const cur = find() || adopt();
    const drop = (c, p) => { c.purchases = c.purchases.filter(x => x !== p); c.u = ts; if (d.deleted) d.deleted[p.id] = ts; };
    const wants = tx.type === 'exp' && tx.pago === 'credit' && d.cards.length > 0;
    if (!wants) {
      if (cur) drop(cur.c, cur.p);
      delete tx.purchId; delete tx.cardId;
      return null;
    }
    // Movimiento antiguo a crédito sin compra identificable: no se crea otra
    // (evita duplicar la deuda que ya pudo quedar registrada en la tarjeta).
    if (!cur && opts.legacy && opts.wasCredit) return null;
    // Estaba enlazado a una compra que ya no existe (se eliminó su tarjeta):
    // no se crea deuda en otra tarjeta salvo que el usuario elija una.
    if (!cur && tx.purchId && !opts.relink) return null;
    const card = d.cards.find(c => c.id === (opts.cardId || (cur && cur.c.id) || tx.cardId)) || d.cards[0];
    const type = opts.crType || (cur && cur.p.type) || 'cash';
    const inst = type === 'cash' ? 1 : Math.max(parseInt(opts.inst || (cur && cur.p.installments)) || 2, 2);
    const plan = instPlan(tx.amount, inst, type, card.tasa || 0);
    if (cur && cur.c !== card) drop(cur.c, cur.p);
    let p = cur && cur.c === card ? cur.p : null;
    if (!p) {
      // El ciclo de la primera cuota depende de la fecha de la compra.
      const when = tx.date && isISO(tx.date) ? parseISO(tx.date) : now;
      p = { id: uid(), emoji: '🛍️', active: true, fromTx: true, txId: tx.id, from: billingCycle(card, when) };
      (card.purchases = card.purchases || []).push(p);
    }
    else if ((opts.dateChanged || (p.txDate && p.txDate !== tx.date)) && tx.date && isISO(tx.date)) p.from = billingCycle(card, parseISO(tx.date)); // la fecha mueve la compra de ciclo
    if (tx.date) p.txDate = tx.date;
    Object.assign(p, { desc: tx.desc || getCat(d, tx.cat).name, amount: tx.amount, type, installments: inst, instAmt: plan.monthly, stamps: plan.stamps });
    card.u = ts; tx.purchId = p.id; tx.cardId = card.id;
    return p;
  }

  // ── Cuentas (opcionales) ─────────────────────────────────────
  // Saldo = saldo inicial + ingresos − gastos pagados desde la cuenta
  //         ± transferencias. Las compras con tarjeta de crédito no la tocan.
  function accountBalance(d, acc) {
    let b = acc.opening || 0;
    for (const t of d.txs) {
      if (t.type === 'inc' && t.acc === acc.id) b += t.amount;
      else if (t.type === 'exp' && t.acc === acc.id && t.pago !== 'credit') b -= t.amount;
      else if (t.type === 'tr') { if (t.acc === acc.id) b -= t.amount; if (t.toAcc === acc.id) b += t.amount; }
    }
    return b;
  }

  // ── Deudas personales / por cobrar ───────────────────────────
  const owedLeft = c => Math.max((c.amount || 0) - (c.paid || 0), 0);
  const pendingSum = list => sum(list.filter(c => !c.done), owedLeft);

  // ── Patrimonio neto ──────────────────────────────────────────
  function netWorth(d, UF, now = new Date()) {
    const accounts = sum(d.accounts, a => accountBalance(d, a));
    const goals = sum(d.metas, m => metaSaved(d, m));
    const assets = sum(d.assets.filter(a => a.active !== false), a => a.value);
    const receivable = pendingSum(d.cobros);
    const cardDebt = sum(d.cards, c => cardStatus(c, UF, now).bal);
    const debts = pendingSum(d.deudas);
    const totalAssets = accounts + goals + assets + receivable, totalDebt = cardDebt + debts;
    return { accounts, goals, assets, receivable, cardDebt, debts, totalAssets, totalDebt, net: totalAssets - totalDebt };
  }
  function netWorthTrend(d, net, now = new Date()) {
    const cur = nowMk(now);
    const keys = Object.keys(d.netWorthHist).filter(k => k < cur).sort();
    const last = keys[keys.length - 1] || null;
    const series = keys.slice(-11).map(k => ({ mk: k, v: d.netWorthHist[k] })).concat([{ mk: cur, v: net }]);
    return { lastKey: last, diff: last ? net - d.netWorthHist[last] : null, series };
  }

  // ── Indicadores de salud financiera ──────────────────────────
  // Promedio de hasta 3 meses con datos, terminando en el mes en curso.
  function finKPIs(d, UF, now = new Date()) {
    const cur = nowMk(now);
    const md = [0, 1, 2].map(off => {
      const txs = mTxs(d, shiftMk(cur, -off)), t = totals(txs);
      const fijo = sum(txs.filter(x => x.type === 'exp' && FIXED_CAT_IDS.includes(x.cat)), x => x.amount);
      return { inc: t.inc, consumo: t.spend, fijo, discre: Math.max(t.spend - fijo, 0) };
    }).filter(m => m.inc > 0 || m.consumo > 0);
    const n = md.length, avg = k => (n ? sum(md, m => m[k]) / n : 0);
    const avgInc = avg('inc'), avgConsumo = avg('consumo'), avgFijo = avg('fijo'), avgDiscre = avg('discre');
    const cardsMonthly = sum(d.cards, c => cardStatus(c, UF, now).current.total);
    const nw = netWorth(d, UF, now);
    const liquid = nw.accounts + nw.goals;
    const denom = avgFijo > 0 ? avgFijo : avgConsumo;
    const r = (a, b) => (b > 0 ? (a / b) * 100 : null);
    return {
      monthsUsed: n, hasIncome: avgInc > 0, avgInc, avgConsumo, avgFijo, avgDiscre, avgSaved: avgInc - avgConsumo,
      savingsRate: r(avgInc - avgConsumo, avgInc), fixedRatio: r(avgFijo, avgInc), discreRatio: r(avgDiscre, avgInc),
      cardsMonthly, dti: r(cardsMonthly, avgInc), liquid, emergMonths: denom > 0 ? liquid / denom : null, nw,
    };
  }

  // ── Recurrentes ──────────────────────────────────────────────
  // Se aplican solo al mes calendario en curso, cuando llega su día, con un id
  // determinista (así dos dispositivos no los duplican al sincronizar).
  const recurDay = (r, mk) => Math.min(clamp(parseInt(r.day) || 1, 1, 31), daysInMonth(mk));
  const recurKey = (r, mk) => r.id + '|' + mk;
  // startMonth = mes en que el movimiento original ya se registró a mano; el
  // recurrente empieza a generarse desde el mes siguiente.
  const recurPendingFor = (d, mk) => d.recur.filter(r => !r.paused && (r.startMonth || '') < mk && !d.recurApplied[recurKey(r, mk)]);
  // También recupera el mes anterior: si la app no se abrió desde antes del
  // día de un recurrente, ese movimiento se registra igual (con su fecha real).
  function applyRecurrents(d, now = new Date()) {
    const cur = nowMk(now), ts = Date.now();
    let n = 0;
    [shiftMk(cur, -1), cur].forEach(mk => {
      const lastDay = mk === cur ? now.getDate() : daysInMonth(mk);
      recurPendingFor(d, mk).forEach(r => {
        const rd = recurDay(r, mk);
        if (rd > lastDay) return;
        const date = `${mk}-${pad(rd)}`;
        const tx = { id: `rc_${r.id}_${mk}`, type: r.type, amount: r.amount, cat: r.cat, pago: r.type === 'inc' ? null : (r.pago || 'debit'), desc: r.desc || '', note: r.note || '', date, dateLabel: dateLabel(date), month: mk, metaId: null, isRecur: true, recurId: r.id, u: ts };
        if (r.acc && d.accounts.some(a => a.id === r.acc)) tx.acc = r.acc;
        if (tx.type === 'exp') { const m = linkedMetaFor(d, tx.cat); if (m) tx.metaId = m.id; }
        if (!d.txs.some(t => t.id === tx.id)) { d.txs.push(tx); syncTxPurchase(d, tx, { cardId: r.cardId }, parseISO(date)); }
        d.recurApplied[recurKey(r, mk)] = 1; n++;
      });
    });
    return n;
  }
  // Detecta gastos que se repiten (misma descripción y categoría en los 3
  // meses anteriores) y aún no son recurrentes: candidatos a automatizar.
  function detectRecurring(d, now = new Date()) {
    const cur = nowMk(now), prev = [1, 2, 3].map(i => shiftMk(cur, -i));
    const norm = s => String(s || '').trim().toLowerCase();
    const seen = {};
    prev.forEach(mk => {
      const inMonth = {};
      mTxs(d, mk).forEach(t => {
        if (t.type === 'tr' || t.isRecur || !norm(t.desc)) return;
        const k = t.type + '|' + t.cat + '|' + norm(t.desc);
        if (!inMonth[k]) { inMonth[k] = 1; (seen[k] = seen[k] || []).push(t); }
      });
    });
    const existing = new Set(d.recur.map(r => r.type + '|' + r.cat + '|' + norm(r.desc)));
    return Object.keys(seen).filter(k => seen[k].length === 3 && !existing.has(k)).map(k => {
      const list = seen[k], amts = list.map(t => t.amount), avg = Math.round(sum(amts, x => x) / 3);
      const stable = Math.max(...amts) - Math.min(...amts) <= avg * 0.15;
      return stable ? { type: list[0].type, cat: list[0].cat, desc: list[0].desc, amount: list[0].amount, pago: list[0].pago, day: parseInt(String(list[0].date || '').slice(8, 10)) || 1 } : null;
    }).filter(Boolean);
  }

  // ── Próximos compromisos (30 días) ───────────────────────────
  function upcoming(d, UF, now = new Date(), horizon = 30) {
    const out = [], today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const push = (date, o) => { const days = daysBetween(today, date); if (days <= horizon) out.push({ ...o, date, days }); };
    d.cards.forEach(c => {
      const np = nextPayment(c, UF, now);
      if (np.total > 0) push(np.due, { kind: 'card', id: c.id, title: `Pago ${c.alias || c.tipo}`, sub: np.closed ? 'Estado facturado' : 'Estimado del ciclo en curso', amount: np.total, estimate: !np.closed });
    });
    [nowMk(now), shiftMk(nowMk(now), 1)].forEach(mk => {
      recurPendingFor(d, mk).forEach(r => {
        const date = parseISO(`${mk}-${pad(recurDay(r, mk))}`);
        if (date >= today) push(date, { kind: 'recur', id: r.id, title: r.desc || getCat(d, r.cat).name, sub: r.type === 'inc' ? 'Ingreso recurrente' : 'Gasto recurrente', amount: r.amount, income: r.type === 'inc' });
      });
    });
    d.deudas.filter(x => !x.done && x.due && isISO(x.due)).forEach(x => push(parseISO(x.due), { kind: 'debt', id: x.id, title: `Pagar a ${x.name}`, sub: x.desc || 'Deuda', amount: owedLeft(x) }));
    d.cobros.filter(x => !x.done && x.due && isISO(x.due)).forEach(x => push(parseISO(x.due), { kind: 'loan', id: x.id, title: `Cobrar a ${x.name}`, sub: x.desc || 'Por cobrar', amount: owedLeft(x), income: true }));
    return out.sort((a, b) => a.days - b.days);
  }

  // ── Proyección de cierre de mes ──────────────────────────────
  // Lo ya gastado + lo que gastaste en los MISMOS días restantes de los meses
  // anteriores (promedio de hasta 3). Así las cuentas que se pagan a inicio de
  // mes no inflan la proyección. Sin historial no se proyecta nada.
  function monthForecast(d, now = new Date()) {
    const mk = nowMk(now), day = now.getDate(), dim = daysInMonth(mk);
    const dayOf = x => parseInt(String(x.date || '').slice(8, 10)) || 1;
    const txs = mTxs(d, mk), t = totals(txs);
    if (day >= dim || t.exp <= 0) return null;
    // Lo variable que suele gastarse en los días que quedan (sin recurrentes, que se suman aparte).
    const tails = [];
    for (let i = 1; i <= 3; i++) {
      const prev = mTxs(d, shiftMk(mk, -i));
      if (!prev.some(x => x.type === 'exp')) continue;
      tails.push(sum(prev.filter(x => x.type === 'exp' && !x.isRecur && dayOf(x) > day), x => x.amount));
    }
    if (!tails.length) return null;
    const histTail = Math.round(sum(tails, x => x) / tails.length);
    const spentToDate = sum(txs.filter(x => x.type === 'exp' && (dayOf(x) <= day || x.isRecur)), x => x.amount);
    const futureManual = sum(txs.filter(x => x.type === 'exp' && !x.isRecur && dayOf(x) > day), x => x.amount); // ya anotados con fecha futura
    const pend = recurPendingFor(d, mk);
    const pendExp = sum(pend.filter(r => r.type === 'exp'), r => r.amount), pendInc = sum(pend.filter(r => r.type === 'inc'), r => r.amount);
    const tail = Math.max(histTail, futureManual);
    const projExp = spentToDate + tail + pendExp, projInc = t.inc + pendInc;
    return { projExp, projInc, projNet: projInc - projExp, tail, months: tails.length, daysLeft: dim - day };
  }

  // ── Racha: meses cerrados consecutivos sin gastar más de lo ingresado ──
  function positiveStreak(d, now = new Date()) {
    let n = 0, mk = shiftMk(nowMk(now), -1);
    for (let i = 0; i < 24; i++, mk = shiftMk(mk, -1)) {
      const txs = mTxs(d, mk), t = totals(txs);
      if (!txs.length || t.inc <= 0 || t.net < 0) break;
      n++;
    }
    return n;
  }

  // ── Alertas y recomendaciones (basadas solo en datos registrados) ──
  // level: 'bad' | 'warn' | 'good' | 'info'. action: [tipo, argumento]
  function insights(d, mk, UF, now = new Date()) {
    const out = [], isCur = mk === nowMk(now);
    const t = totals(mTxs(d, mk)), bs = budgetSummary(d, mk);
    bs.rows.filter(r => r.status === 'over').forEach(r => out.push({ level: 'bad', key: 'over-' + r.c.id, title: `${r.c.name}: presupuesto superado`, text: `Llevas ${fmt(r.spent)} de ${fmt(r.b)} (${fmt(-r.left)} sobre el límite).`, action: ['cat', r.c.id] }));
    if (isCur) {
      const frac = now.getDate() / daysInMonth(mk);
      bs.rows.filter(r => r.status === 'warn' && r.pct >= 90 && frac < 0.8).forEach(r => out.push({ level: 'warn', key: 'near-' + r.c.id, title: `${r.c.name}: queda ${fmt(r.left)}`, text: `Ya usaste el ${r.pct}% y faltan ${daysInMonth(mk) - now.getDate()} días de mes.`, action: ['cat', r.c.id] }));
      upcoming(d, UF, now, 7).filter(u => !u.income).forEach(u => out.push({ level: u.days < 0 ? 'bad' : 'warn', key: 'due-' + u.kind + u.id, title: u.days < 0 ? `${u.title}: vencido` : `${u.title} ${u.days === 0 ? 'vence hoy' : u.days === 1 ? 'vence mañana' : 'vence en ' + u.days + ' días'}`, text: `${fmt(u.amount)}${u.estimate ? ' (estimado)' : ''} · ${shortDate(u.date)}.`, action: [u.kind, u.id] }));
      const f = monthForecast(d, now);
      if (f && f.projInc > 0 && f.projNet < 0) out.push({ level: 'warn', key: 'forecast', title: 'Podrías cerrar el mes en negativo', text: `Si el resto del mes gastas como en los meses anteriores (${fmt(f.tail)}), llegarías a ${fmt(f.projExp)} frente a ${fmt(f.projInc)} de ingreso.`, action: ['tab', 'moves'] });
    }
    if (bs.totalB > 0 && t.inc > 0 && bs.totalB > t.inc) out.push({ level: 'warn', key: 'plan', title: 'Tu presupuesto supera tu ingreso', text: `Planificaste ${fmt(bs.totalB)} y registras ${fmt(t.inc)} de ingreso: sobran ${fmt(bs.totalB - t.inc)} por ajustar.`, action: ['tab', 'plan'] });
    // Aumentos inusuales frente al promedio de los meses anteriores.
    const avg = avgByCat(d, mk, 3);
    if (avg.months >= 2) {
      categoryBreakdown(d, mk).rows.filter(r => !SAVINGS_CAT_IDS.includes(r.c.id)).forEach(r => {
        const a = avg.by[r.c.id] || 0;
        if (a > 0 && r.spent >= a * 1.3 && r.spent - a >= 10000 && !out.some(o => o.key === 'over-' + r.c.id))
          out.push({ level: 'warn', key: 'spike-' + r.c.id, title: `${r.c.name} subió ${pct(r.spent - a, a)}%`, text: `${fmt(r.spent)} este mes frente a ${fmt(a)} de promedio (${avg.months} meses).`, action: ['cat', r.c.id] });
      });
    }
    if (!bs.hasBudget && avg.months >= 1) out.push({ level: 'info', key: 'nobudget', title: 'Aún no tienes presupuesto este mes', text: 'Puedo proponerte uno a partir de lo que gastaste en los meses anteriores.', action: ['tab', 'plan'] });
    if (isCur) detectRecurring(d, now).slice(0, 1).forEach(r => out.push({ level: 'info', key: 'recur-' + r.desc, title: `"${r.desc}" se repite cada mes`, text: `Lo registraste 3 meses seguidos por ~${fmt(r.amount)}. Puedes automatizarlo como recurrente.`, action: ['recur-suggest', r.desc] }));
    if (t.inc > 0 && t.saved > 0 && t.saved / t.inc >= 0.1 && t.net >= 0) out.push({ level: 'good', key: 'saving', title: `Ahorraste el ${pct(t.saved, t.inc)}% de tu ingreso`, text: `${fmt(t.saved)} destinados a ahorro o inversión este mes.`, action: ['tab', 'plan'] });
    if (isCur && d.accounts.some(a => needsCuadre(a, now))) out.push({ level: 'info', key: 'cuadre', title: 'Cuadra tus cuentas', text: 'Compara el saldo real de tu banco con el de Bolsillo: toma un minuto y mantiene tus cifras al día.', action: ['cuadrar', ''] });
    if (isCur) { const st = positiveStreak(d, now); if (st >= 2) out.push({ level: 'good', key: 'streak', title: `${st} meses seguidos en positivo`, text: 'Cerraste cada uno gastando menos de lo que ingresó.', action: ['compare', ''] }); }
    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  // ── Comparación mensual ──────────────────────────────────────
  function monthsSeries(d, n = 8) {
    const mks = [...new Set(d.txs.filter(t => t.type !== 'tr').map(t => t.month).filter(isMk))].sort().slice(-n);
    return mks.map(mk => ({ mk, ...totals(mTxs(d, mk)) }));
  }

  // ── Fusión de documentos (sincronización sin pérdida) ────────
  // Une dos copias registro por registro: gana la versión con "u" más reciente;
  // un borrado (tombstone en .deleted) solo gana si es posterior a la última
  // edición. Nunca descarta un registro que exista en un solo lado sin haber
  // sido borrado explícitamente.
  // Dentro de un registro editado en dos dispositivos, no se pierden las
  // compras de una tarjeta ni los abonos agregados en el otro.
  function mergeNested(col, w, l, del) {
    if (!l) return w;
    const extra = (wl, ll) => (ll || []).filter(x => x && x.id != null && !del[x.id] && !(wl || []).some(y => y && y.id === x.id));
    if (col === 'cards') {
      const add = extra(w.purchases, l.purchases), pc = { ...(l.paidCycles || {}), ...(w.paidCycles || {}) };
      if (!add.length && Object.keys(pc).length === Object.keys(w.paidCycles || {}).length) return w;
      return { ...w, purchases: [...(w.purchases || []), ...add], paidCycles: pc };
    }
    if (col === 'deudas' || col === 'cobros') {
      const add = extra(w.abonos, l.abonos);
      if (!add.length) return w;
      const paid = (w.paid || 0) + sum(add, x => x.amount);
      return { ...w, abonos: [...(w.abonos || []), ...add], paid, done: paid >= (w.amount || 0) ? true : w.done };
    }
    return w;
  }
  function mergeDocs(a, b) {
    a = a || {}; b = b || {};
    const aNew = (a.updatedAt || 0) >= (b.updatedAt || 0), out = {};
    const del = { ...(b.deleted || {}) };
    Object.keys(a.deleted || {}).forEach(k => { del[k] = Math.max(del[k] || 0, a.deleted[k]); });
    for (const col of COLLECTIONS) {
      const map = new Map();
      const put = (it, pref) => {
        if (!it || it.id == null) return;
        const ex = map.get(it.id);
        if (!ex) { map.set(it.id, { it, pref, other: null }); return; }
        if ((it.u || 0) > (ex.it.u || 0) || ((it.u || 0) === (ex.it.u || 0) && pref && !ex.pref)) map.set(it.id, { it, pref, other: ex.it });
        else ex.other = it;
      };
      (a[col] || []).forEach(it => put(it, aNew));
      (b[col] || []).forEach(it => put(it, !aNew));
      out[col] = [...map.values()].map(x => mergeNested(col, x.it, x.other, del)).filter(it => !(del[it.id] && del[it.id] >= (it.u || 0)));
    }
    const pick = (k, mk) => {
      const au = (a.budgetsU || {})[mk] || 0, bu = (b.budgetsU || {})[mk] || 0;
      const A = (a[k] || {})[mk], B = (b[k] || {})[mk];
      if (au !== bu) return au > bu ? A : B;          // gana la versión más reciente, aunque sea "sin presupuesto"
      if (A === undefined) return B; if (B === undefined) return A;
      return aNew ? A : B;
    };
    out.budgets = {}; out.budgetsU = {};
    new Set([...Object.keys(a.budgets || {}), ...Object.keys(b.budgets || {})]).forEach(mk => {
      const v = pick('budgets', mk); if (v !== undefined) out.budgets[mk] = v;
      const u = Math.max((a.budgetsU || {})[mk] || 0, (b.budgetsU || {})[mk] || 0); if (u) out.budgetsU[mk] = u;
    });
    const [hi, lo] = aNew ? [a, b] : [b, a];
    out.netWorthHist = { ...(lo.netWorthHist || {}), ...(hi.netWorthHist || {}) };
    out.applied = { ...(lo.applied || {}), ...(hi.applied || {}) };
    out.recurApplied = { ...(lo.recurApplied || {}), ...(hi.recurApplied || {}) };
    const cutoff = Date.now() - 180 * 86400000; // los tombstones caducan a los 180 días
    out.deleted = {}; Object.keys(del).forEach(k => { if (del[k] > cutoff) out.deleted[k] = del[k]; });
    out.schema = Math.max(a.schema || 1, b.schema || 1);
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    return out;
  }
  // Comparación de contenido (ignora el orden de los registros).
  function sameData(a, b) {
    const canon = d => JSON.stringify(COLLECTIONS.map(c => [...((d || {})[c] || [])].sort((x, y) => String(x.id) < String(y.id) ? -1 : 1))
      .concat([(d || {}).budgets || {}, (d || {}).recurApplied || {}, (d || {}).netWorthHist || {}, Object.keys((d || {}).deleted || {}).sort()]));
    return canon(a) === canon(b);
  }

  // ── Registro rápido ─────────────────────────────────────────
  // Movimientos frecuentes (últimos 90 días): misma descripción, categoría,
  // tipo y monto repetidos al menos 2 veces. Sirven de atajo de un toque.
  function frequentTxs(d, now = new Date(), n = 6) {
    const since = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
    const by = {};
    d.txs.forEach(t => {
      if ((t.type !== 'exp' && t.type !== 'inc') || !t.desc || String(t.date || '') < since) return;
      const k = [t.type, t.cat, String(t.desc).trim().toLowerCase(), t.amount].join('|');
      const e = by[k] || (by[k] = { n: 0, last: '', t });
      e.n++; if (String(t.date) >= e.last) { e.last = String(t.date); e.t = t; }
    });
    return Object.values(by).filter(e => e.n >= 2).sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1)).slice(0, n)
      .map(e => ({ type: e.t.type, cat: e.t.cat, desc: e.t.desc, amount: e.t.amount, pago: e.t.pago || null, n: e.n }));
  }
  // Interpreta un texto libre ("almuerzo 8.500 débito", "sueldo 1.200.000")
  // y devuelve los campos que reconoce. Lo que no reconoce no lo inventa.
  // Palabras habituales en Chile → categoría sugerida (solo una sugerencia, editable).
  const QUICK_WORDS = {
    food: ['super', 'supermercado', 'lider', 'jumbo', 'unimarc', 'tottus', 'santa', 'feria', 'almacen', 'almacén', 'pan', 'verduras'],
    restaurant: ['almuerzo', 'cena', 'desayuno', 'cafe', 'café', 'restaurant', 'restaurante', 'sushi', 'pizza', 'completo', 'delivery', 'rappi', 'pedidosya'],
    transport: ['uber', 'didi', 'cabify', 'taxi', 'metro', 'bip', 'micro', 'bus', 'colectivo', 'peaje', 'tag'],
    car: ['bencina', 'copec', 'shell', 'petrobras', 'estacionamiento', 'mecanico', 'mecánico'],
    health: ['farmacia', 'medico', 'médico', 'doctor', 'dentista', 'isapre', 'fonasa', 'remedios', 'examen'],
    subs: ['netflix', 'spotify', 'disney', 'youtube', 'icloud', 'hbo', 'max', 'prime', 'chatgpt'],
    home: ['luz', 'agua', 'gas', 'internet', 'gastos comunes', 'enel', 'aguas', 'vtr', 'entel', 'movistar', 'wom'],
    rent: ['arriendo', 'dividendo'],
    leisure: ['cine', 'concierto', 'entradas', 'bar', 'carrete', 'juego'],
    gym: ['gimnasio', 'gym', 'smartfit', 'energy'],
    clothes: ['ropa', 'zapatillas', 'zapatos', 'polera', 'pantalon', 'pantalón'],
    pets: ['veterinario', 'mascota', 'perro', 'gato'],
    edu: ['colegio', 'universidad', 'curso', 'matricula', 'matrícula', 'libros'],
    gifts: ['regalo', 'cumpleaños'],
  };
  // Valor de un número escrito o dictado: "8.500", "8,500", "1.250.000", "8.500,50",
  // "30 mil", "1,5 lucas", "3 mil 500". Los pesos chilenos no usan decimales.
  function quickNumber(tok, mult, extra) {
    let v;
    if (/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(tok) && !(mult && /^\d+[.,]\d{1,2}$/.test(tok))) {
      v = parseInt(tok.replace(/[.,]\d{1,2}$/, m => (/^[.,]\d{3}$/.test(m) ? m : '')).replace(/\D/g, ''), 10);
    } else v = parseFloat(tok.replace(',', '.'));
    if (mult) v = v * 1000 + (extra || 0);
    return Math.round(v);
  }
  function parseQuick(text, d) {
    const raw = String(text || '').trim(); if (!raw) return {};
    const out = {};
    let rest = raw;
    // Monto: entre todos los números, el mayor que parezca un monto (no un año suelto).
    const re = /\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d+)?)(?:\s*(mil|lucas?)\b(?:\s+(\d{1,3})\b)?)?/gi;
    const cands = [];
    let m;
    while ((m = re.exec(rest))) {
      const mult = !!m[2], v = quickNumber(m[1], mult, m[3] ? parseInt(m[3], 10) : 0);
      const year = !mult && /^(19|20)\d{2}$/.test(m[1]);
      if (v > 0 && (mult || v >= 100)) cands.push({ v, year, i: m.index, len: m[0].length });
    }
    const pool = cands.some(c => !c.year) ? cands.filter(c => !c.year) : cands;
    const best = pool.sort((a, b) => b.v - a.v)[0];
    if (best) { out.amount = best.v; rest = rest.slice(0, best.i) + ' ' + rest.slice(best.i + best.len); }
    const take = (re2, k, v) => { if (re2.test(rest)) { out[k] = v; rest = rest.replace(re2, ' '); } };
    take(/\b(con\s+)?(tarjeta\s+de\s+)?cr[eé]dito\b/i, 'pago', 'credit');
    take(/\b(con\s+)?(tarjeta\s+de\s+)?d[eé]bito\b/i, 'pago', 'debit');
    take(/\b(en\s+|con\s+)?efectivo\b/i, 'pago', 'cash');
    if (/\b(sueldo|ingreso|me\s+pagaron|honorarios?|aguinaldo|gratificaci[oó]n)\b/i.test(rest)) out.type = 'inc';
    rest = rest.replace(/\s+/g, ' ').replace(/^[\s,.;:$-]+|[\s,.;:$-]+$/g, '');
    if (rest) out.desc = rest.charAt(0).toUpperCase() + rest.slice(1);
    // Categoría: la usada antes con esa misma descripción; si no, palabras
    // habituales; si no, el nombre exacto de una categoría.
    if (d && out.desc) {
      const q = out.desc.toLowerCase(), kind = out.type || 'exp';
      const prev = [...d.txs].reverse().find(t => t.type === kind && String(t.desc || '').toLowerCase() === q);
      if (prev && getCat(d, prev.cat) !== UNKNOWN_CAT) out.cat = prev.cat;
      else {
        const words = q.split(/[^a-záéíóúñü]+/i).filter(Boolean);
        const has = w => (w.includes(' ') ? q.includes(w) : words.includes(w));
        const k = kind === 'exp' && Object.keys(QUICK_WORDS).find(id => QUICK_WORDS[id].some(has));
        const c = !k && catsOf(d, kind).find(c => c.name.toLowerCase().split(/[\/\s.]+/).some(w => w.length >= 4 && words.some(x => x === w || x + 's' === w || w + 's' === x)));
        if (k) out.cat = k; else if (c) out.cat = c.id;
      }
      if (!out.type && out.cat && catKind(getCat(d, out.cat)) === 'exp') out.type = 'exp';
    } else if (!out.type && out.pago) out.type = 'exp';
    return out;
  }

  // ── Cuadrar cuentas (saldo esperado vs. saldo real) ─────────
  // Una cuenta está "por cuadrar" si nunca se cuadró o hace más de 7 días.
  const needsCuadre = (a, now = new Date()) => !isISO(a.cuadre) || daysBetween(parseISO(a.cuadre), now) > 7;

  // ── Tamaño del documento en la nube ──────────────────────────
  // Firestore admite hasta 1 MiB por documento. El JSON en UTF-8 es una
  // aproximación razonable del tamaño que calcula Firestore.
  const CLOUD_LIMIT = 1048576;
  const docBytes = d => new TextEncoder().encode(JSON.stringify(d || {})).length;
  const cloudUsage = bytes => ({ bytes, pct: Math.round((bytes / CLOUD_LIMIT) * 100), level: bytes >= CLOUD_LIMIT * 0.9 ? 'bad' : bytes >= CLOUD_LIMIT * 0.75 ? 'warn' : 'ok' });

  // ── Respaldo: validación y exportación ───────────────────────
  function validateBackup(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 'El archivo no es un respaldo de Bolsillo.';
    if (!Array.isArray(o.txs)) return 'El respaldo no contiene movimientos (campo "txs").';
    for (const k of COLLECTIONS) if (o[k] !== undefined && !Array.isArray(o[k])) return `El campo "${k}" tiene un formato inválido.`;
    const bad = o.txs.find(t => !t || typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount < 0 || !['inc', 'exp', 'tr'].includes(t.type) || !isMk(t.month));
    if (bad) return 'Hay movimientos con datos inválidos; no se importó nada.';
    return null;
  }
  function toCSV(d) {
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
    const pago = { cash: 'Efectivo', debit: 'Débito', credit: 'Crédito' };
    const tipo = { inc: 'Ingreso', exp: 'Gasto', tr: 'Transferencia' };
    const acc = id => (d.accounts.find(a => a.id === id) || {}).name || '';
    const rows = [['Fecha', 'Tipo', 'Monto', 'Categoría', 'Descripción', 'Nota', 'Medio de pago', 'Cuenta', 'Mes']];
    [...d.txs].sort((a, b) => String(a.date) < String(b.date) ? -1 : 1).forEach(t =>
      rows.push([t.date || '', tipo[t.type] || t.type, t.type === 'exp' ? -t.amount : t.amount, t.type === 'tr' ? '' : getCat(d, t.cat).name, t.desc, t.note, pago[t.pago] || '', acc(t.acc), t.month]));
    return '﻿' + rows.map(r => r.map((c, i) => (i === 2 && typeof c === 'number' ? c : q(c))).join(';')).join('\r\n');
  }

  return {
    SCHEMA, MS, MONTHS, BASE_CATS, UNKNOWN_CAT, FIXED_CAT_IDS, SAVINGS_CAT_IDS, COLLECTIONS,
    esc, pad, isoDate, parseISO, isISO, isMk, mkOf, nowMk, shiftMk, mkDiff, daysInMonth, dateLabel, shortDate, mlabel, daysBetween, defaultDateFor,
    group, fmt, parseMoney, pct, clamp, sum, uid,
    normalize, emptyDoc, allCats, getCat, catKind, catsOf, catUsage,
    mTxs, totals, categoryBreakdown, avgByCat, budgetSummary, suggestBudget,
    metaSaved, linkedMetaFor, goalProjection,
    stampsTax, instPlan, cardCut, cardDueDays, billingCycle, cycleCutDate, cycleDueDate, purchState, cycleTotal, debtFrom, nextPayment, cardStatus, cardProjection, syncTxPurchase,
    accountBalance, owedLeft, pendingSum, netWorth, netWorthTrend, finKPIs,
    recurDay, recurPendingFor, applyRecurrents, detectRecurring, upcoming, monthForecast, positiveStreak, insights, monthsSeries,
    mergeDocs, sameData, validateBackup, toCSV, CLOUD_LIMIT, docBytes, cloudUsage, frequentTxs, parseQuick, needsCuadre,
  };
});
