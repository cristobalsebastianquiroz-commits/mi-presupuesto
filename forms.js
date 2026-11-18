// ═══════════════════════════════════════════════════════════════
// BOLSILLO · forms.js — hojas (formularios y detalles) y acciones
// Cada hoja: { title, body(data, state), live?, focus?, input? }.
//   live: hoja de consulta, se repinta sola cuando cambian los datos.
//   Los campos con data-k guardan su valor en state (ver bindField en ui.js).
// ═══════════════════════════════════════════════════════════════
'use strict';
const INST = [2, 3, 4, 6, 9, 10, 12, 18, 24, 36, 48];
const MAX_AMOUNT = 9999999999;
// Tarifas REFERENCIALES (UF de mantención mensual y tasa mensual de cuotas con
// interés). Cambian con el tiempo: el usuario puede corregirlas en "Configurar".
const TARIFAS = { // [tarjeta, mantención UF/mes, tasa % mensual, cargo semestral UF]
  'Banco de Chile': [['Visa FAN', 0, 2.2, 0], ['Universal', 0.07, 2.2, 0], ['Visa Dorada', 0.21, 2.2, 0], ['Mastercard Dorada', 0.21, 2.2, 0], ['Visa Platinum', 0.25, 2.2, 0], ['Mastercard Platinum', 0.25, 2.2, 0], ['Visa Signature', 0.35, 2.2, 0], ['Mastercard Black', 0.4, 2.2, 0], ['Visa Infinite', 0.5, 2.2, 0]],
  'Scotiabank Chile': [['Visa Gold (Plan)', 0, 3.49, 0], ['Gold Zero', 0.09, 3.49, 0], ['Visa Gold', 0.21, 3.49, 1.5], ['Visa Platinum', 0.25, 3.49, 0], ['Platinum Plus', 0.3, 3.49, 0], ['Visa Signature', 0.2, 3.49, 0], ['Mastercard Black', 0.4, 3.49, 2.5], ['Visa Infinite Air', 0.1, 3.49, 2.5], ['Singular Signature', 0.3, 3.49, 1.75]],
};

// ── Constructores de campos ────────────────────────────────────
const fld = (label, id, inner, hint) => `<div class="fld"><label for="${id}">${label}</label>${inner}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
const text = (id, k, v, ph = '', extra = '') => `<input class="inp" type="text" id="${id}" data-k="${k}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph)}" maxlength="80" autocomplete="off" ${extra}>`;
const money = (id, k, v, ph = '0') => `<div class="money"><input class="inp num" type="text" inputmode="numeric" autocomplete="off" data-money data-k="${k}" id="${id}" placeholder="${ph}" value="${esc(v || '')}"></div>`;
const select = (id, k, opts, v) => `<select class="inp" id="${id}" data-k="${k}">${opts.map(([val, l, dis]) => `<option value="${esc(val)}"${String(val) === String(v == null ? '' : v) ? ' selected' : ''}${dis ? ' disabled' : ''}>${esc(l)}</option>`).join('')}</select>`;
const date = (id, k, v) => `<input class="inp" type="date" id="${id}" data-k="${k}" value="${esc(v || '')}">`;
const toggle = (k, on, title, sub) => `<button type="button" class="sw" role="switch" aria-checked="${!!on}"${fn('toggleK', k)}><span><div style="font-weight:600">${title}</div>${sub ? `<div class="hint" style="margin:0">${sub}</div>` : ''}</span><span class="k"></span></button>`;
const emojiPick = (list, cur) => `<div class="emo" role="group" aria-label="Ícono">${list.map(e => `<button type="button" class="${e === cur ? 'on' : ''}"${fn('setEmoji', e)} aria-pressed="${e === cur}">${e}</button>`).join('')}</div>`;
const kv = (k, v, cls = '') => `<div class="kv ${cls}"><span>${k}</span><span class="num">${v}</span></div>`;
const g = n => (n ? C.group(n) : '');
const amtW = v => Math.max(String(v || '').length, 1) + 0.2 + 'ch'; // el monto grande crece con lo escrito
const topState = () => STACK[STACK.length - 1].state;
ACTIONS.toggleK = k => { const st = topState(); st[k] = !st[k]; rerender(); };
ACTIONS.setEmoji = e => { topState().emoji = e; rerender(); };
ACTIONS.setK = a => { const [k, v] = String(a).split('='); topState()[k] = v; rerender(); };
function validAmount(id, st, k = 'amount') {
  const a = C.parseMoney(st[k]);
  if (!a || a <= 0) return setErr(id, 'Ingresa un monto mayor que cero.') || 0;
  if (a > MAX_AMOUNT) return setErr(id, 'El monto es demasiado grande.') || 0;
  return a;
}
function validDate(id, v) { return C.isISO(v) ? v : (setErr(id, 'Ingresa una fecha válida.'), null); }
function download(name, content, mime) {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([content], { type: mime }));
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ══ MOVIMIENTO (crear / editar) ════════════════════════════════
function txInit(data, st) {
  if (st.init) return;
  const d = getData(), t = data && !String(data).startsWith('goal:') ? d.txs.find(x => x.id === data) : null;
  st.init = 1;
  if (t) {
    const link = t.purchId && d.cards.map(c => (c.purchases || []).find(p => p.id === t.purchId)).find(Boolean);
    Object.assign(st, { id: t.id, type: t.type, amount: g(t.amount), desc: t.desc || '', note: t.note || '', date: t.date || C.defaultDateFor(t.month), cat: t.cat, pago: t.pago || 'debit', metaId: t.metaId || '', acc: t.acc || '', cardId: t.cardId || '', crType: link ? link.type : 'cash', inst: link ? link.installments : 3, pickedCat: 1, origCard: t.cardId || '', origDate: t.date, wasCredit: t.pago === 'credit', legacy: !t.purchId, prevAmount: t.amount, prevDesc: t.desc });
  } else {
    const goalId = data ? String(data).slice(5) : '';
    Object.assign(st, { id: null, type: 'exp', amount: '', desc: '', note: '', date: C.defaultDateFor(UI.month), cat: goalId ? 'savings' : topCats(d, 'exp')[0].id, pago: ls.get('bolsillo_pago') || 'debit', metaId: goalId, acc: '', cardId: (d.cards[0] || {}).id || '', crType: 'cash', inst: 3, pickedCat: goalId ? 1 : 0, repeat: false });
  }
  if (!st.acc && d.accounts.length) st.acc = defaultAcc(d, st);
}
// Categorías ordenadas por uso (las más frecuentes primero).
function topCats(d, kind) {
  const n = {}; d.txs.forEach(t => { n[t.cat] = (n[t.cat] || 0) + 1; });
  return C.catsOf(d, kind).map((c, i) => ({ c, i })).sort((a, b) => (n[b.c.id] || 0) - (n[a.c.id] || 0) || a.i - b.i).map(x => x.c);
}
function defaultAcc(d, st) {
  const want = st.type === 'exp' && st.pago === 'cash' ? 'cash' : 'bank';
  return (d.accounts.find(a => a.kind === want) || d.accounts[0] || {}).id || '';
}
function txCatGrid(st) {
  const d = getData(), all = topCats(d, st.type === 'inc' ? 'inc' : 'exp');
  let list = st.allCats || all.length <= 8 ? all : all.slice(0, 8);
  if (!list.some(c => c.id === st.cat)) { const sel = all.find(c => c.id === st.cat); if (sel) list = list.slice(0, 7).concat(sel); }
  return `<div class="catgrid">${list.map(c => `<button type="button" class="catc${c.id === st.cat ? ' on' : ''}"${fn('txCat', c.id)} aria-pressed="${c.id === st.cat}"><em>${esc(c.icon)}</em><span>${esc(c.name)}</span></button>`).join('')}</div>
    ${all.length > 8 ? `<button type="button" class="link"${fn('toggleK', 'allCats')}>${st.allCats ? 'Ver menos' : `Ver las ${all.length} categorías`}</button>` : ''}`;
}
function txCreditPreview(st) {
  const d = getData(), card = d.cards.find(c => c.id === st.cardId) || d.cards[0], amt = C.parseMoney(st.amount);
  if (!card || !amt) return '';
  const inst = st.crType === 'cash' ? 1 : parseInt(st.inst) || 2, p = C.instPlan(amt, inst, st.crType, card.tasa || 0);
  return `<div class="box">${kv(inst > 1 ? `${inst} cuotas de` : 'Cargo único', fmt(p.monthly))}${p.stamps ? kv('Impuesto de timbres (1ª cuota)', fmt(p.stamps)) : ''}${p.interest ? kv('<span class="neg">Interés total</span>', `<span class="neg">${fmt(p.interest)}</span>`) : ''}${inst > 1 ? kv('Total a pagar', fmt(p.total), 'tot') : ''}</div>`;
}
SHEETS.tx = {
  commit(t, data, st) { if (t.id === 'tx-d' && !st.id) applyQuick(st, t.value, false, 'tap'); },
  title: (data, st) => (st.id ? 'Editar movimiento' : 'Nuevo movimiento'),
  focus: 'tx-a',
  body(data, st) {
    txInit(data, st);
    const d = getData(), isExp = st.type === 'exp';
    if (data && !st.id && !String(data).startsWith('goal:')) return null; // el movimiento ya no existe
    const descs = [...new Set(d.txs.filter(t => t.type === st.type && t.desc).slice(-200).reverse().map(t => t.desc))].slice(0, 30);
    const accSel = d.accounts.length ? fld(isExp ? 'Desde la cuenta' : 'Cuenta de destino', 'tx-acc', select('tx-acc', 'acc', [['', 'Sin cuenta']].concat(d.accounts.map(a => [a.id, `${a.name} · ${fmt(C.accountBalance(d, a))}`])), st.acc)) : '';
    let pay = '';
    if (isExp) {
      pay = `<div class="fld"><div class="lab">Pagado con</div><div class="seg" role="group">${Object.keys(PAGO).map(k => `<button type="button" class="${st.pago === k ? 'on' : ''}"${fn('txPago', k)} aria-pressed="${st.pago === k}">${PAGO[k]}</button>`).join('')}</div></div>`;
      if (st.pago === 'credit') {
        if (!d.cards.length) pay += `<div class="note">Aún no registras una tarjeta de crédito. El gasto se guardará igual; <button type="button" class="link"${sh('card-new')}>agrégala</button> para llevar sus cuotas.</div>`;
        else pay += `${d.cards.length > 1 ? fld('Tarjeta', 'tx-card', select('tx-card', 'cardId', d.cards.map(c => [c.id, `${c.alias || c.tipo} · ${c.banco}`]), st.cardId)) : ''}
          <div class="${st.crType !== 'cash' ? 'two' : ''}">${fld('Modalidad', 'tx-crt', select('tx-crt', 'crType', [['cash', 'Sin cuotas'], ['no', 'Sin interés'], ['yes', 'Con interés']], st.crType))}
          ${st.crType !== 'cash' ? fld('N° de cuotas', 'tx-ci', select('tx-ci', 'inst', INST.map(n => [n, n + ' cuotas']), st.inst)) : ''}</div><div id="tx-cr">${txCreditPreview(st)}</div>`;
      } else pay += accSel;
      const metas = d.metas.filter(m => !m.done || m.id === st.metaId);
      if (C.SAVINGS_CAT_IDS.includes(st.cat) && metas.length) pay += fld('Abonar a la meta', 'tx-meta', select('tx-meta', 'metaId', [['', 'Ninguna (ahorro general)']].concat(metas.map(m => [m.id, `${m.emoji || '🎯'} ${m.name}`])), st.metaId));
      else { const lm = C.linkedMetaFor(d, st.cat); if (lm) pay += `<div class="note">Este gasto abonará a tu meta “${esc(lm.name)}”.</div>`; }
    } else pay = accSel;
    if (!st.id && !st.freq) st.freq = C.frequentTxs(d);
    const freq = !st.id && st.freq.length ? `<div class="lab" style="margin:2px 0 6px">Frecuentes</div><div class="chips freq" style="margin-bottom:10px">${st.freq.map((f, i) => `<button type="button" class="chip"${fn('txFreq', i)}>${esc(C.getCat(d, f.cat).icon)} ${esc(f.desc)} <span class="muted num">${fmt(f.amount)}</span></button>`).join('')}</div>` : '';
    const mic = SPEECH && !st.id ? `<button type="button" class="mic${st.listening ? ' rec' : ''}" aria-label="Dictar movimiento"${fn('txVoice')}>${ico('mic')}</button>` : '';
    return `${freq}<div class="seg" role="group" style="margin-bottom:4px"><button type="button" class="${isExp ? 'on' : ''}"${fn('txType', 'exp')} aria-pressed="${isExp}">Gasto</button><button type="button" class="${!isExp ? 'on' : ''}"${fn('txType', 'inc')} aria-pressed="${!isExp}">Ingreso</button></div>
      <div class="amt-in ${st.type} fld"><label class="sr" for="tx-a">Monto</label><div class="amt-row"><span class="cur" aria-hidden="true">$</span><input type="text" inputmode="numeric" autocomplete="off" data-money data-k="amount" id="tx-a" placeholder="0" value="${esc(st.amount)}" style="width:${amtW(st.amount)}"></div></div>
      ${fld('Descripción <span style="font-weight:400">(opcional)</span>', 'tx-d', `<div class="with-mic">${text('tx-d', 'desc', st.desc, st.id ? (isExp ? '¿En qué fue?' : '¿De dónde viene?') : (isExp ? 'Ej: almuerzo 8.500 débito' : 'Ej: sueldo 1.200.000'), 'list="tx-dl"')}${mic}</div>` + `<datalist id="tx-dl">${descs.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
      <div class="fld"><div class="lab">Categoría</div><div id="tx-cats">${txCatGrid(st)}</div></div>
      ${pay}
      ${fld('Fecha', 'tx-dt', date('tx-dt', 'date', st.date))}
      <details class="more"${st.note || st.repeat ? ' open' : ''}><summary>Nota${st.id ? '' : ' y repetición'}</summary>
        ${fld('Nota', 'tx-n', text('tx-n', 'note', st.note, 'Ej: con descuento, compartido…'))}
        ${st.id ? '' : toggle('repeat', st.repeat, 'Repetir cada mes', 'Se registrará solo, el mismo día')}
      </details>
      ${st.id ? `<button class="btn dan"${fn('txDelete', st.id)}>Eliminar movimiento</button>` : ''}
      <div class="stick"><button class="btn pri" id="tx-save"${fn('txSave')}>${st.id ? 'Guardar cambios' : 'Guardar'}</button></div>`;
  },
  input(t, data, st) {
    if (t.id === 'tx-a') { const el = $('tx-cr'); if (el) el.innerHTML = txCreditPreview(st); }
    else if (t.id === 'tx-d' && !st.pickedCat) {
      // Sugerir la categoría usada la última vez con esta misma descripción.
      const q = t.value.trim().toLowerCase(), d = getData();
      const m = q && [...d.txs].reverse().find(x => x.type === st.type && (x.desc || '').toLowerCase() === q);
      if (m && m.cat !== st.cat && C.getCat(d, m.cat) !== C.UNKNOWN_CAT) { st.cat = m.cat; $('tx-cats').innerHTML = txCatGrid(st); }
    } else if (t.id === 'tx-crt' || t.id === 'tx-card' || t.id === 'tx-ci') rerender();
  },
};
// Texto libre o dictado: "almuerzo 8.500 débito" completa monto, descripción, medio y categoría.
// Texto libre o dictado: "almuerzo 8.500 débito" completa monto, descripción, medio y categoría.
// paint: 'now' repinta; 'tap' espera a que termine el toque en curso (al salir del
// campo, el siguiente toque —por ejemplo en Guardar— no se pierde); 'none' no repinta.
function applyQuick(st, text, force, paint = 'now') {
  const d = getData(), q = C.parseQuick(text, d);
  if (!force && !(q.amount && !C.parseMoney(st.amount))) return false;
  if (q.type && q.type !== st.type && !st.id && force) { st.type = q.type; st.cat = topCats(d, q.type)[0].id; st.pickedCat = 0; }
  if (q.amount && (!C.parseMoney(st.amount) || force)) st.amount = C.group(q.amount);
  st.desc = q.desc || '';
  if (q.pago && st.type === 'exp') st.pago = q.pago;
  if (q.cat && (!st.pickedCat || force) && C.catKind(C.getCat(d, q.cat)) === st.type) st.cat = q.cat;
  if (d.accounts.length && st.type === 'exp' && st.pago !== 'credit' && q.pago) st.acc = defaultAcc(d, st);
  if (paint === 'now') rerender();
  else if (paint === 'tap') afterTap(() => { if (STACK.length && topState() === st) rerender(); });
  return true;
}
// Ejecuta fn cuando termina el toque/clic en curso (o a los 400 ms si no hay ninguno).
function afterTap(fn) {
  let done = false;
  const go = () => { if (done) return; done = true; document.removeEventListener('click', go, true); setTimeout(fn, 0); };
  document.addEventListener('click', go, true);
  setTimeout(go, 400);
}
const SPEECH = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition) || null;
let REC = null;
function stopVoice() { if (REC) { const r = REC; REC = null; r.onresult = null; r.onend = null; try { r.abort(); } catch (e) {} if (r.st) r.st.listening = false; } }
window.stopVoice = stopVoice;
ACTIONS.txVoice = () => {
  const st = topState();
  if (REC && REC.st === st) { try { REC.stop(); } catch (e) {} return; }
  stopVoice();
  try {
    REC = new SPEECH(); REC.st = st; REC.lang = 'es-CL'; REC.interimResults = false; REC.maxAlternatives = 1;
    REC.onresult = e => { const txt = e.results[0][0].transcript; if (STACK.length && topState() === st) { applyQuick(st, txt, true); toast(`Entendí: “${txt}”`); } };
    REC.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') toast('No se pudo usar el micrófono. Revisa el permiso del navegador.', { err: true }); };
    REC.onend = () => { if (REC && REC.st === st) REC = null; st.listening = false; if (STACK.length && topState() === st) rerender(); };
    REC.start(); st.listening = true; rerender();
  } catch (e) { REC = null; toast('El dictado no está disponible en este navegador.', { err: true }); }
};
ACTIONS.txFreq = i => {
  const st = topState(), f = (st.freq || [])[parseInt(i)]; if (!f) return;
  Object.assign(st, { type: f.type, amount: C.group(f.amount), desc: f.desc, cat: f.cat, pickedCat: 1 });
  if (f.type === 'exp' && f.pago) st.pago = f.pago;
  if (getData().accounts.length) st.acc = defaultAcc(getData(), st);
  rerender();
};
ACTIONS.txType = v => { const st = topState(), d = getData(); if (st.type === v) return; st.type = v; st.cat = topCats(d, v)[0].id; st.pickedCat = 0; if (d.accounts.length) st.acc = defaultAcc(d, st); rerender(); };
ACTIONS.txCat = id => { const st = topState(); st.cat = id; st.pickedCat = 1; if (C.SAVINGS_CAT_IDS.includes(id) && !st.metaId) { const m = C.linkedMetaFor(getData(), id); if (m) st.metaId = m.id; } rerender(); };
ACTIONS.txPago = v => { const st = topState(), d = getData(); st.pago = v; if (d.accounts.length && v !== 'credit') st.acc = defaultAcc(d, st); rerender(); };
ACTIONS.txSave = () => {
  const st = topState(), d = getData();
  if (!st.id && !C.parseMoney(st.amount) && st.desc) applyQuick(st, st.desc, false, 'none'); // "café 3.500" + Enter
  const amount = validAmount('tx-a', st); if (!amount) return;
  const dt = validDate('tx-dt', st.date); if (!dt) return;
  const isNew = !st.id, isExp = st.type === 'exp';
  const t = isNew ? { id: C.uid(), isRecur: false } : d.txs.find(x => x.id === st.id);
  if (!t) { doneSheet('Ese movimiento ya no existe.', { err: true }); return; }
  Object.assign(t, { type: st.type, amount, cat: st.cat, pago: isExp ? st.pago : null, desc: (st.desc || '').trim(), note: (st.note || '').trim(), date: dt, dateLabel: C.dateLabel(dt) });
  if (isNew || dt !== st.origDate) t.month = C.mkOf(dt); // el mes lo define la fecha
  if (d.accounts.some(a => a.id === st.acc) && (!isExp || st.pago !== 'credit')) t.acc = st.acc; else delete t.acc;
  t.metaId = !isExp ? null : C.SAVINGS_CAT_IDS.includes(t.cat) ? (st.metaId || null) : ((C.linkedMetaFor(d, t.cat) || {}).id || null);
  touch(t);
  if (isNew) d.txs.push(t);
  const relink = !!st.cardId && st.cardId !== st.origCard && d.cards.some(c => c.id === st.cardId);
  C.syncTxPurchase(d, t, { cardId: st.cardId, crType: st.crType, inst: st.inst, legacy: !isNew && st.legacy, wasCredit: st.wasCredit, prevAmount: st.prevAmount, prevDesc: st.prevDesc, relink, dateChanged: !isNew && dt !== st.origDate });
  if (t.metaId) { const m = d.metas.find(x => x.id === t.metaId); if (m && !m.done && C.metaSaved(d, m) >= m.target) { m.done = true; m.autoDone = true; touch(m); toast(`¡Meta “${m.name}” alcanzada!`); } }
  const recurId = isNew && st.repeat ? C.uid() : null;
  if (recurId) d.recur.push(touch({ id: recurId, type: t.type, amount, cat: t.cat, pago: t.pago, desc: t.desc, note: t.note, startMonth: t.month, day: parseInt(dt.slice(8, 10)), acc: t.acc || '', cardId: t.cardId || '' }));
  if (isExp) ls.set('bolsillo_pago', st.pago);
  commit();
  const where = t.month !== UI.month ? ` en ${C.mlabel(t.month).toLowerCase()}` : '';
  doneSheet(isNew ? `${isExp ? 'Gasto' : 'Ingreso'} de ${fmt(amount)} registrado${where}.` : `Movimiento actualizado${where}.`, isNew ? { undo: () => { if (recurId && getData().recur.some(r => r.id === recurId)) removeFrom('recur', recurId); deleteTx(t.id, true); } } : undefined);
};
function deleteTx(id, silent) {
  const d = getData(), t = d.txs.find(x => x.id === id); if (!t) return;
  C.syncTxPurchase(d, { ...t, type: 'deleted' }, { legacy: !t.purchId, wasCredit: t.pago === 'credit' });
  removeFrom('txs', id);
  // Si el aporte había completado la meta automáticamente y ya no alcanza, se reabre.
  const m = t.metaId && d.metas.find(x => x.id === t.metaId);
  if (m && m.done && m.autoDone && C.metaSaved(d, m) < m.target) { m.done = false; m.autoDone = false; touch(m); }
  commit();
  if (silent) { refresh(); toast('Movimiento eliminado.'); } else doneSheet('Movimiento eliminado.');
}
ACTIONS.txDelete = id => confirmSheet('¿Eliminar este movimiento?', 'Se quitará de tus totales, de tu presupuesto y, si era a crédito, de las cuotas de la tarjeta.', 'Eliminar', () => deleteTx(id));

// ══ TRANSFERENCIA / PAGO DE TARJETA ════════════════════════════
SHEETS.transfer = {
  title: (data, st) => (st.id ? 'Editar transferencia' : 'Transferir o pagar tarjeta'),
  focus: 'tr-a',
  body(data, st) {
    const d = getData();
    if (!st.init) {
      const t = data ? d.txs.find(x => x.id === data) : null; st.init = 1;
      if (data && !t) return null;
      Object.assign(st, t ? { id: t.id, amount: g(t.amount), from: t.acc, to: t.toCard ? 'c:' + t.toCard : 'a:' + t.toAcc, date: t.date, desc: t.desc || '' }
        : { id: null, amount: '', from: (d.accounts[0] || {}).id || '', to: d.cards.length ? 'c:' + d.cards[0].id : 'a:' + ((d.accounts[1] || {}).id || ''), date: C.isoDate(), desc: '' });
    }
    if (!d.accounts.length) return `<div class="note">Para transferir o registrar el pago de la tarjeta primero agrega una cuenta.</div><button class="btn pri"${sh('account-form')}>Agregar cuenta</button>`;
    const dest = d.accounts.filter(a => a.id !== st.from).map(a => ['a:' + a.id, a.name]).concat(d.cards.map(c => ['c:' + c.id, 'Pago tarjeta ' + (c.alias || c.tipo)]));
    if (!dest.length) return `<div class="note">Necesitas otra cuenta o una tarjeta de crédito como destino.</div>`;
    if (!dest.some(x => x[0] === st.to)) st.to = dest[0][0];
    return `<div class="amt-in fld"><label class="sr" for="tr-a">Monto</label><div class="amt-row"><span class="cur" aria-hidden="true">$</span><input type="text" inputmode="numeric" autocomplete="off" data-money data-k="amount" id="tr-a" placeholder="0" value="${esc(st.amount)}" style="width:${amtW(st.amount)}"></div></div>
      ${fld('Desde', 'tr-f', select('tr-f', 'from', d.accounts.map(a => [a.id, `${a.name} · ${fmt(C.accountBalance(d, a))}`]), st.from))}
      ${fld('Hacia', 'tr-t', select('tr-t', 'to', dest, st.to), 'Una transferencia no es gasto ni ingreso: solo mueve plata. El pago de la tarjeta descuenta tu cuenta sin contar el gasto dos veces.')}
      ${fld('Fecha', 'tr-dt', date('tr-dt', 'date', st.date))}
      <div class="btns"><button class="btn pri"${fn('trSave')}>Guardar</button>${st.id ? `<button class="btn dan"${fn('trDelete', st.id)}>Eliminar</button>` : ''}</div>`;
  },
  input(t) { if (t.id === 'tr-f') rerender(); },
};
ACTIONS.trSave = () => {
  const st = topState(), d = getData();
  const amount = validAmount('tr-a', st); if (!amount) return;
  const dt = validDate('tr-dt', st.date); if (!dt) return;
  const t = st.id ? d.txs.find(x => x.id === st.id) : { id: C.uid() };
  if (!t) { doneSheet(); return; }
  const [kind, id] = [st.to.slice(0, 1), st.to.slice(2)];
  unmarkPaid(d, t);
  Object.assign(t, { type: 'tr', amount, acc: st.from, date: dt, dateLabel: C.dateLabel(dt), month: C.mkOf(dt), desc: '', cat: null, pago: null });
  delete t.toAcc; delete t.toCard;
  let paidNote = '';
  if (kind === 'c') {
    t.toCard = id;
    // Solo un pago que cubre el estado facturado lo marca como pagado.
    const card = d.cards.find(c => c.id === id), np = card && C.nextPayment(card, uf());
    if (np && np.closed) {
      if (amount >= np.total - 500) { card.paidCycles = { ...(card.paidCycles || {}), [np.cycle]: 1 }; t.paidCycle = np.cycle; touch(card); }
      else paidNote = ` Falta ${fmt(np.total - amount)} para cubrir el estado.`;
    }
  } else t.toAcc = id;
  touch(t); if (!st.id) d.txs.push(t);
  commit(); doneSheet(kind === 'c' ? 'Pago de tarjeta registrado.' + paidNote : 'Transferencia registrada.');
};
function unmarkPaid(d, t) {
  if (!t || !t.paidCycle || !t.toCard) return;
  const c = d.cards.find(x => x.id === t.toCard);
  if (c && c.paidCycles && c.paidCycles[t.paidCycle]) { c.paidCycles = { ...c.paidCycles }; delete c.paidCycles[t.paidCycle]; touch(c); }
  delete t.paidCycle;
}
ACTIONS.trDelete = id => confirmSheet('¿Eliminar esta transferencia?', 'Los saldos de las cuentas volverán a su valor anterior.', 'Eliminar', () => { const d = getData(); unmarkPaid(d, d.txs.find(x => x.id === id)); removeFrom('txs', id); commit(); doneSheet('Transferencia eliminada.'); });

// ══ CONSULTAS: categoría, alertas, compromisos, meses ══════════
SHEETS.cat = {
  live: true,
  title: id => { const c = C.getCat(getData(), id); return `${c.icon} ${c.name}`; },
  body(id) {
    const d = getData(), mk = UI.month, txs = C.mTxs(d, mk).filter(t => t.cat === id && t.type !== 'tr');
    const total = C.sum(txs, t => t.amount), b = (d.budgets[mk] || {})[id] || 0, avg = C.avgByCat(d, mk, 3), a = avg.by[id] || 0;
    const kind = C.catKind(C.getCat(d, id));
    return `<div class="hero" style="text-align:center;margin-bottom:12px"><div class="lbl">${esc(C.mlabel(mk))}</div><div class="big num">${fmt(total)}</div>
      ${b > 0 ? `${pg(C.pct(total, b), total > b ? 'over' : C.pct(total, b) >= 85 ? 'warn' : 'ok')}<div class="hint num">${C.pct(total, b)}% de ${fmt(b)} · ${total > b ? fmt(total - b) + ' excedido' : 'quedan ' + fmt(b - total)}</div>` : ''}
      ${a > 0 ? `<div class="hint num">Promedio de ${avg.months} mes${avg.months > 1 ? 'es' : ''} anterior${avg.months > 1 ? 'es' : ''}: ${fmt(a)}</div>` : ''}</div>
      ${kind === 'exp' ? `<button class="btn sec2" style="margin-bottom:12px"${sh('budget-cat', id)}>${b > 0 ? 'Cambiar límite' : 'Poner un límite mensual'}</button>` : ''}
      ${txs.length ? `<section class="card"><div class="rows">${txs.sort((x, y) => (String(y.date) > String(x.date) ? 1 : -1)).map(txRow).join('')}</div></section>` : empty('🧾', 'Sin movimientos en esta categoría este mes.')}`;
  },
};
SHEETS['cats-month'] = {
  live: true, title: () => 'Gasto por categoría',
  body() {
    const cb = C.categoryBreakdown(getData(), UI.month);
    return `<section class="card"><div class="rows">${cb.rows.map(r => `<button class="bud"${sh('cat', r.c.id)}><div class="top"><span class="nm">${esc(r.c.icon)} ${esc(r.c.name)}</span><span class="rt num"><strong>${fmt(r.spent)}</strong> <span class="muted">· ${C.pct(r.spent, cb.total)}%</span></span></div>${pg(C.pct(r.spent, cb.rows[0].spent), '', 'sm')}</button>`).join('')}</div></section>`;
  },
};
SHEETS.insights = { live: true, title: () => 'Para revisar', body: () => C.insights(getData(), UI.month, uf()).map(banner).join('') || empty('✅', 'Nada que revisar por ahora.') };
SHEETS.upcoming = { live: true, title: () => 'Próximos 30 días', body: () => { const up = C.upcoming(getData(), uf()); return up.length ? `<section class="card"><div class="rows">${up.map(upRow).join('')}</div></section>` : empty('📅', 'Sin compromisos en los próximos 30 días.'); } };
SHEETS.months = {
  title: () => 'Elegir mes',
  body() {
    const d = getData(), cur = C.nowMk();
    const mks = [...new Set(d.txs.map(t => t.month).filter(C.isMk).concat([cur, UI.month]))].sort().reverse();
    return `<section class="card"><div class="rows">${mks.map(mk => { const t = C.totals(C.mTxs(d, mk)); return row({ title: esc(C.mlabel(mk)) + (mk === cur ? ' ' + tag('Mes actual', 'g') : ''), sub: `Ingresos ${fmt(t.inc)} · Gastos ${fmt(t.spend)}`, right: mk === UI.month ? ico('check') : '', attr: fn('pickMonth', mk) }); }).join('')}</div></section>`;
  },
};

// ══ PRESUPUESTO ════════════════════════════════════════════════
function setBudget(mk, id, v) { const d = getData(); d.budgets[mk] = { ...(d.budgets[mk] || {}) }; if (v > 0) d.budgets[mk][id] = v; else delete d.budgets[mk][id]; d.budgetsU[mk] = Date.now(); }
SHEETS['budget-cat'] = {
  title: (id, st) => { const c = C.getCat(getData(), st.cat || id); return id ? `Límite · ${c.name}` : 'Agregar al presupuesto'; },
  focus: 'bg-a',
  body(id, st) {
    const d = getData(), mk = UI.month, bud = d.budgets[mk] || {};
    if (!st.init) { st.init = 1; st.cat = id || ''; st.amount = g(bud[id] || 0); }
    const free = C.catsOf(d, 'exp').filter(c => !(bud[c.id] > 0));
    if (!id && !st.cat) st.cat = (free[0] || {}).id || '';
    if (!id && !free.length) return `<div class="note">Todas tus categorías de gasto ya tienen límite este mes.</div>`;
    const avg = C.avgByCat(d, mk, 3), a = avg.by[st.cat] || 0, spent = C.sum(C.mTxs(d, mk).filter(t => t.type === 'exp' && t.cat === st.cat), t => t.amount);
    return `${id ? '' : fld('Categoría', 'bg-c', select('bg-c', 'cat', free.map(c => [c.id, `${c.icon} ${c.name}`]), st.cat))}
      ${fld(`Límite para ${esc(C.mlabel(mk).toLowerCase())}`, 'bg-a', money('bg-a', 'amount', st.amount), `Llevas ${fmt(spent)} este mes${a ? ` · promedio anterior ${fmt(a)}` : ''}.`)}
      <div class="btns"><button class="btn pri"${fn('budgetSave')}>Guardar límite</button>${id && bud[id] > 0 ? `<button class="btn dan"${fn('budgetRemove', id)}>Quitar límite</button>` : ''}</div>`;
  },
  input(t) { if (t.id === 'bg-c') rerender(); },
};
SHEETS['budget-add'] = { title: () => 'Agregar al presupuesto', focus: 'bg-a', body: (id, st) => SHEETS['budget-cat'].body(null, st), input: t => SHEETS['budget-cat'].input(t) };
ACTIONS.budgetSave = () => { const st = topState(), a = validAmount('bg-a', st); if (!a) return; if (!st.cat) return; setBudget(UI.month, st.cat, a); commit(); doneSheet('Límite guardado.'); };
ACTIONS.budgetRemove = id => { setBudget(UI.month, id, 0); commit(); doneSheet('Límite eliminado.'); };
ACTIONS.budgetSuggest = () => {
  const d = getData(), s = C.suggestBudget(d, UI.month); if (!s.months) return;
  const before = d.budgets[UI.month];
  d.budgets[UI.month] = s.budget; d.budgetsU[UI.month] = Date.now(); commit(); refresh();
  toast('Presupuesto propuesto con tu gasto promedio. Ajusta cada categoría.', { undo: () => { if (before) d.budgets[UI.month] = before; else delete d.budgets[UI.month]; d.budgetsU[UI.month] = Date.now(); commit(); refresh(); } });
};
ACTIONS.budgetCopy = () => { const d = getData(), prev = d.budgets[C.shiftMk(UI.month, -1)]; if (!prev) return; d.budgets[UI.month] = { ...prev }; d.budgetsU[UI.month] = Date.now(); commit(); refresh(); toast('Presupuesto copiado del mes anterior.'); };

// ══ METAS ══════════════════════════════════════════════════════
SHEETS.goal = {
  live: true,
  title: id => { const m = getData().metas.find(x => x.id === id); return m ? `${m.emoji || '🎯'} ${m.name}` : 'Meta'; },
  body(id) {
    const d = getData(), m = d.metas.find(x => x.id === id); if (!m) return null;
    const p = C.goalProjection(d, m), txs = d.txs.filter(t => t.metaId === id).sort((a, b) => (String(b.date) > String(a.date) ? 1 : -1));
    return `<div class="hero" style="text-align:center;margin-bottom:12px"><div class="big num">${p.pct}%</div>${pg(p.pct, p.reached ? 'ok' : '')}
        <div class="hint num">${fmt(p.saved)} de ${fmt(m.target)}${p.left > 0 ? ' · faltan ' + fmt(p.left) : ''}</div></div>
      <div class="box">${kv('Aporte mensual promedio', p.avg ? fmt(p.avg) : 'Sin aportes recientes')}${p.etaMk ? kv('A este ritmo la alcanzas en', esc(C.mlabel(p.etaMk))) : ''}${p.needPerMonth != null ? kv(`Para llegar a ${esc(C.mlabel(m.deadline).toLowerCase())} necesitas`, fmt(p.needPerMonth) + '/mes') : ''}${m.baseSaved ? kv('Ahorro inicial declarado', fmt(m.baseSaved)) : ''}</div>
      <div class="btns" style="margin:0 0 12px">${m.done ? '' : `<button class="btn pri"${sh('tx', 'goal:' + id)}>${ico('plus')} Aportar</button>`}<button class="btn sec2"${sh('goal-form', id)}>Editar meta</button></div>
      ${txs.length ? `<div class="sec"><span>Aportes</span></div><section class="card"><div class="rows">${txs.slice(0, 20).map(txRow).join('')}</div></section>` : ''}`;
  },
};
const GOAL_EMOJIS = ['🎯', '🛟', '🏖️', '✈️', '🚗', '🏠', '💻', '🎓', '💍', '👶', '🐾', '📈'];
SHEETS['goal-form'] = {
  title: (id) => (id ? 'Editar meta' : 'Nueva meta'), focus: 'g-n',
  body(id, st) {
    const d = getData(), m = id ? d.metas.find(x => x.id === id) : null;
    if (id && !m) return null;
    if (!st.init) Object.assign(st, { init: 1, emoji: m ? m.emoji || '🎯' : '🎯', name: m ? m.name : '', target: g(m && m.target), base: g(m && m.baseSaved), deadline: m && m.deadline || '', linkedCat: m && m.linkedCat || '' });
    const taken = cid => d.metas.find(x => x.id !== id && x.linkedCat === cid);
    const cats = C.catsOf(d, 'exp').filter(c => c.id !== 'savings').map(c => { const t = taken(c.id); return [c.id, `${c.icon} ${c.name}${t ? ` (ya enlazada a “${t.name}”)` : ''}`, !!t]; });
    return `${emojiPick(GOAL_EMOJIS, st.emoji)}
      ${fld('Nombre', 'g-n', text('g-n', 'name', st.name, 'Ej: Fondo de emergencia, viaje…'))}
      <div class="two">${fld('Monto objetivo', 'g-t', money('g-t', 'target', st.target))}${fld('Ya tengo ahorrado', 'g-s', money('g-s', 'base', st.base))}</div>
      ${fld('Fecha objetivo <span style="font-weight:400">(opcional)</span>', 'g-dl', `<input class="inp" type="month" id="g-dl" data-k="deadline" value="${esc(st.deadline)}" min="${C.nowMk()}">`, 'Con una fecha, Bolsillo calcula cuánto necesitas aportar cada mes.')}
      <details class="more"${st.linkedCat ? ' open' : ''}><summary>Enlazar a una categoría</summary>
        ${fld('Categoría enlazada', 'g-lc', select('g-lc', 'linkedCat', [['', 'Sin enlazar']].concat(cats), st.linkedCat), 'Cada gasto registrado en esa categoría contará como aporte a esta meta (útil para "Inversión"). Si no la enlazas, aportas eligiendo la meta al registrar un ahorro.')}
      </details>
      <div class="btns"><button class="btn pri"${fn('goalSave', id || '')}>${id ? 'Guardar' : 'Crear meta'}</button>
      ${m ? `<button class="btn sec2"${fn('goalToggle', id)}>${m.done ? 'Reabrir meta' : 'Marcar como completada'}</button><button class="btn dan"${fn('goalDelete', id)}>Eliminar meta</button>` : ''}</div>`;
  },
};
ACTIONS.goalSave = id => {
  const st = topState(), d = getData();
  if (!(st.name || '').trim()) return setErr('g-n', 'Ponle un nombre a la meta.');
  const target = validAmount('g-t', st, 'target'); if (!target) return;
  if (st.deadline && !C.isMk(st.deadline)) return setErr('g-dl', 'Fecha objetivo inválida.');
  const m = id ? d.metas.find(x => x.id === id) : { id: C.uid(), done: false, _migrated: true };
  if (!m) return doneSheet();
  Object.assign(m, { name: st.name.trim(), target, baseSaved: C.parseMoney(st.base), emoji: st.emoji, linkedCat: st.linkedCat || null, deadline: st.deadline || null });
  if (C.metaSaved(d, m) >= m.target) m.done = true;
  touch(m); if (!id) d.metas.push(m);
  commit(); doneSheet(id ? 'Meta actualizada.' : 'Meta creada.');
  if (!id) go('plan', { plan: 'goals' });
};
ACTIONS.goalToggle = id => { const m = getData().metas.find(x => x.id === id); if (!m) return; m.done = !m.done; touch(m); commit(); doneSheet(m.done ? 'Meta completada.' : 'Meta reabierta.'); };
ACTIONS.goalDelete = id => confirmSheet('¿Eliminar esta meta?', 'Los movimientos de ahorro se conservan, pero dejan de estar asociados a la meta.', 'Eliminar', () => {
  const d = getData(); d.txs.forEach(t => { if (t.metaId === id) { t.metaId = null; touch(t); } });
  removeFrom('metas', id); commit(); closeSheet(); refresh(); toast('Meta eliminada.');
});

// ══ RECURRENTES ════════════════════════════════════════════════
SHEETS['recur-form'] = {
  title: id => (id ? 'Editar recurrente' : 'Nuevo recurrente'), focus: 'r-a',
  body(id, st) {
    const d = getData(), r = id ? d.recur.find(x => x.id === id) : null;
    if (id && !r) return null;
    if (!st.init) Object.assign(st, { init: 1 }, r ? { type: r.type, amount: g(r.amount), desc: r.desc || '', cat: r.cat, pago: r.pago || 'debit', day: r.day || 1, acc: r.acc || '', cardId: r.cardId || '', paused: !!r.paused }
      : { type: 'exp', amount: '', desc: '', cat: 'rent', pago: 'debit', day: new Date().getDate(), acc: '', cardId: '', thisMonth: true });
    const isExp = st.type === 'exp', cats = C.catsOf(d, isExp ? 'exp' : 'inc');
    if (!cats.some(c => c.id === st.cat)) st.cat = cats[0].id;
    return `<div class="seg" style="margin-bottom:14px"><button type="button" class="${isExp ? 'on' : ''}"${fn('setK', 'type=exp')}>Gasto</button><button type="button" class="${!isExp ? 'on' : ''}"${fn('setK', 'type=inc')}>Ingreso</button></div>
      ${fld('Descripción', 'r-d', text('r-d', 'desc', st.desc, isExp ? 'Ej: Arriendo, Internet…' : 'Ej: Sueldo'))}
      <div class="two">${fld('Monto mensual', 'r-a', money('r-a', 'amount', st.amount))}${fld('Día del mes', 'r-day', `<input class="inp" type="number" inputmode="numeric" min="1" max="31" id="r-day" data-k="day" value="${esc(st.day)}">`)}</div>
      ${fld('Categoría', 'r-c', select('r-c', 'cat', cats.map(c => [c.id, `${c.icon} ${c.name}`]), st.cat))}
      ${isExp ? fld('Medio de pago', 'r-p', select('r-p', 'pago', Object.keys(PAGO).map(k => [k, PAGO[k]]), st.pago)) : ''}
      ${d.accounts.length && !(isExp && st.pago === 'credit') ? fld('Cuenta', 'r-acc', select('r-acc', 'acc', [['', 'Sin cuenta']].concat(d.accounts.map(a => [a.id, a.name])), st.acc)) : ''}
      ${isExp && st.pago === 'credit' && d.cards.length > 1 ? fld('Tarjeta', 'r-card', select('r-card', 'cardId', d.cards.map(c => [c.id, c.alias || c.tipo]), st.cardId || d.cards[0].id)) : ''}
      ${r ? toggle('paused', st.paused, 'En pausa', 'No se registrará hasta que lo reactives') : toggle('thisMonth', st.thisMonth, 'Registrar también este mes', 'Desactívalo si ya lo anotaste a mano')}
      <div class="btns"><button class="btn pri"${fn('recurSave', id || '')}>Guardar</button>${r ? `<button class="btn dan"${fn('recurDelete', id)}>Eliminar recurrente</button>` : ''}</div>`;
  },
  input(t) { if (t.id === 'r-p') rerender(); },
};
ACTIONS.recurSave = id => {
  const st = topState(), d = getData(), cur = C.nowMk();
  const amount = validAmount('r-a', st); if (!amount) return;
  const day = parseInt(st.day); if (!(day >= 1 && day <= 31)) return setErr('r-day', 'Día entre 1 y 31.');
  const r = id ? d.recur.find(x => x.id === id) : { id: C.uid(), startMonth: st.thisMonth ? C.shiftMk(cur, -1) : cur, note: '' };
  if (!r) return doneSheet();
  if (r.paused && !st.paused) d.recurApplied[r.id + '|' + C.shiftMk(cur, -1)] = 1; // al reactivar, el mes en pausa no se recupera
  Object.assign(r, { type: st.type, amount, desc: (st.desc || '').trim(), cat: st.cat, pago: st.type === 'exp' ? st.pago : null, day, acc: st.acc || '', cardId: st.cardId || '', paused: !!st.paused });
  touch(r); if (!id) d.recur.push(r);
  const n = C.applyRecurrents(d);
  commit(); doneSheet(n ? 'Recurrente guardado y registrado este mes.' : 'Recurrente guardado.');
};
ACTIONS.recurDelete = id => confirmSheet('¿Eliminar este recurrente?', 'Dejará de registrarse cada mes. Los movimientos ya creados se conservan.', 'Eliminar', () => { removeFrom('recur', id); commit(); doneSheet('Recurrente eliminado.'); });
ACTIONS.recurFromSuggestion = i => {
  const d = getData(), cur = C.nowMk(), s = C.detectRecurring(d)[parseInt(i)]; if (!s) return;
  const already = C.mTxs(d, cur).some(t => t.type === s.type && t.cat === s.cat && (t.desc || '').toLowerCase() === s.desc.toLowerCase());
  d.recur.push(touch({ id: C.uid(), type: s.type, amount: s.amount, desc: s.desc, cat: s.cat, pago: s.pago, day: s.day, note: '', startMonth: already ? cur : C.shiftMk(cur, -1) }));
  C.applyRecurrents(d); commit(); refresh(); toast(`“${s.desc}” ahora se registra solo cada mes.`);
};

// ══ CUENTAS ════════════════════════════════════════════════════
const ACC_KINDS = [['bank', 'Cuenta bancaria', '🏦'], ['cash', 'Efectivo', '💵'], ['savings', 'Cuenta de ahorro', '🐷']];
SHEETS['account-form'] = {
  title: id => (id ? 'Editar cuenta' : 'Nueva cuenta'), focus: 'ac-n',
  body(id, st) {
    const d = getData(), a = id ? d.accounts.find(x => x.id === id) : null;
    if (id && !a) return null;
    if (!st.init) Object.assign(st, { init: 1, name: a ? a.name : '', kind: a ? a.kind : 'bank', bal: a ? g(Math.abs(C.accountBalance(d, a))) : '', neg: a ? C.accountBalance(d, a) < 0 : false });
    return `${fld('Nombre', 'ac-n', text('ac-n', 'name', st.name, 'Ej: Cuenta corriente, CuentaRUT, Efectivo'))}
      ${fld('Tipo', 'ac-k', select('ac-k', 'kind', ACC_KINDS.map(k => [k[0], k[1]]), st.kind))}
      ${fld('Saldo actual', 'ac-b', money('ac-b', 'bal', st.bal), a ? 'Si no coincide con tu banco, corrígelo aquí: Bolsillo ajusta el saldo sin crear movimientos.' : 'El saldo de hoy. Desde ahora cada ingreso, gasto o transferencia de esta cuenta lo actualizará.')}
      ${toggle('neg', st.neg, 'Saldo negativo', 'Por ejemplo, si usas la línea de crédito o sobregiro')}
      <div class="btns"><button class="btn pri"${fn('accSave', id || '')}>Guardar</button>${a ? `<button class="btn dan"${fn('accDelete', id)}>Eliminar cuenta</button>` : ''}</div>`;
  },
};
ACTIONS.accSave = id => {
  const st = topState(), d = getData();
  if (!(st.name || '').trim()) return setErr('ac-n', 'Ponle un nombre a la cuenta.');
  const bal = C.parseMoney(st.bal) * (st.neg ? -1 : 1); if (Math.abs(bal) > MAX_AMOUNT) return setErr('ac-b', 'El monto es demasiado grande.');
  const a = id ? d.accounts.find(x => x.id === id) : { id: C.uid(), opening: 0 };
  if (!a) return doneSheet();
  Object.assign(a, { name: st.name.trim(), kind: st.kind, icon: (ACC_KINDS.find(k => k[0] === st.kind) || ACC_KINDS[0])[2] });
  if (!id) { a.opening = bal; a.cuadre = C.isoDate(); d.accounts.push(a); }
  else { if (bal !== C.accountBalance(d, a)) a.cuadre = C.isoDate(); a.opening = (a.opening || 0) + (bal - C.accountBalance(d, a)); }
  touch(a); commit(); doneSheet(id ? 'Cuenta actualizada.' : 'Cuenta agregada.');
};
ACTIONS.accDelete = id => confirmSheet('¿Eliminar esta cuenta?', 'Sus ingresos y gastos se conservan sin cuenta asociada. Las transferencias y abonos desde o hacia esta cuenta se eliminan.', 'Eliminar', () => {
  const d = getData();
  d.txs.filter(t => t.type === 'tr' && (t.acc === id || t.toAcc === id)).forEach(t => {
    unmarkPaid(d, t);
    if (t.owe) { const [k, oid] = t.owe.split('|'), c = (d[k] || []).find(x => x.id === oid), i = c ? (c.abonos || []).findIndex(a => a.txId === t.id) : -1; if (i >= 0) c.abonos[i] = { ...c.abonos[i], txId: null }; if (c) touch(c); }
    removeFrom('txs', t.id);
  });
  d.txs.forEach(t => { if (t.acc === id) { delete t.acc; touch(t); } });
  d.recur.forEach(r => { if (r.acc === id) { r.acc = ''; touch(r); } });
  removeFrom('accounts', id); commit(); closeSheet(); refresh(); toast('Cuenta eliminada.');
});

// ══ CUADRAR (saldo esperado vs. saldo real) ═══════════════════
// Inspirado en "Pulso" de Cuadra: comparas el saldo real de tu banco con el
// que calcula Bolsillo y registras la diferencia en un paso.
function cuadreDiff(d, st, a) {
  const raw = st['r_' + a.id]; if (raw == null || raw === '' || C.parseMoney(raw) > MAX_AMOUNT) return null;
  return C.parseMoney(raw) * (st['n_' + a.id] ? -1 : 1) - C.accountBalance(d, a);
}
function cuadreLine(d, st, a) {
  const diff = cuadreDiff(d, st, a);
  if (diff == null) return '<span class="muted">Escribe el saldo que ves en tu banco</span>';
  if (diff === 0) return '<span class="pos">✓ Cuadra perfecto</span>';
  return `<span class="${diff < 0 ? 'neg' : 'pos'}">${diff < 0 ? 'Faltan' : 'Sobran'} ${fmt(Math.abs(diff))}</span> <span class="muted">${diff < 0 ? '(gastos sin anotar)' : '(ingresos sin anotar)'}</span>`;
}
SHEETS.cuadrar = {
  title: () => 'Cuadrar cuentas',
  body(data, st) {
    const d = getData();
    if (!d.accounts.length) return `<div class="note">Para cuadrar, primero agrega tu cuenta con el saldo de hoy. Luego, cada cierto tiempo, compara ese saldo con el de tu banco.</div><button class="btn pri"${sh('account-form')}>Agregar cuenta</button>`;
    if (!st.init) { st.init = 1; st.how = 'mov'; d.accounts.forEach(a => { const b = C.accountBalance(d, a); st['r_' + a.id] = C.group(Math.abs(b)); st['n_' + a.id] = b < 0; }); }
    return `<p class="muted" style="margin-bottom:12px">Abre tu banco y escribe el saldo real de cada cuenta. Si no coincide, Bolsillo registra la diferencia.</p>
      ${d.accounts.map(a => `<section class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:8px"><strong>${esc(a.icon || '🏦')} ${esc(a.name)}</strong><span class="hint num" style="margin:0">En Bolsillo ${fmt(C.accountBalance(d, a))}</span></div>
        ${money('cu-' + a.id, 'r_' + a.id, st['r_' + a.id])}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px"><div class="hint num" id="cu-d-${esc(a.id)}" style="margin:0">${cuadreLine(d, st, a)}</div><button type="button" class="link"${fn('cuNeg', a.id)}>${st['n_' + a.id] ? 'Saldo negativo ✓' : '¿Negativo?'}</button></div></section>`).join('')}
      <div class="lab" style="margin-top:6px">Si hay diferencias</div>
      <div class="seg" style="margin-bottom:6px"><button type="button" class="${st.how === 'mov' ? 'on' : ''}"${fn('setK', 'how=mov')}>Registrar movimiento</button><button type="button" class="${st.how === 'adj' ? 'on' : ''}"${fn('setK', 'how=adj')}>Solo ajustar saldo</button></div>
      <div class="hint" style="margin-bottom:8px">${st.how === 'mov' ? 'Se anota como gasto o ingreso “Diferencia al cuadrar” y cuenta en tus totales del mes.' : 'Se corrige el saldo sin afectar tus gastos ni ingresos.'}</div>
      <div class="stick"><button class="btn pri"${fn('cuSave')}>Cuadrar</button></div>`;
  },
  input(t, data, st) { const d = getData(), a = t.id && t.id.startsWith('cu-') && d.accounts.find(x => 'cu-' + x.id === t.id); if (a) { const el = document.getElementById('cu-d-' + a.id); if (el) el.innerHTML = cuadreLine(d, st, a); } },
};
ACTIONS.cuNeg = id => { const st = topState(); st['n_' + id] = !st['n_' + id]; rerender(); };
ACTIONS.cuSave = () => {
  const st = topState(), d = getData(), today = C.isoDate();
  const big = d.accounts.find(a => C.parseMoney(st['r_' + a.id]) > MAX_AMOUNT);
  if (big) return setErr('cu-' + big.id, 'El monto es demasiado grande.');
  let total = 0, n = 0;
  d.accounts.forEach(a => {
    const diff = cuadreDiff(d, st, a); if (diff == null) return;
    if (diff !== 0) {
      n++; total += diff;
      if (st.how === 'adj') a.opening = (a.opening || 0) + diff;
      else d.txs.push(touch({ id: C.uid(), type: diff < 0 ? 'exp' : 'inc', amount: Math.abs(diff), cat: diff < 0 ? 'other' : 'income', pago: diff < 0 ? (a.kind === 'cash' ? 'cash' : 'debit') : null, acc: a.id, desc: 'Diferencia al cuadrar', note: '', date: today, dateLabel: C.dateLabel(today), month: C.mkOf(today), metaId: diff < 0 ? ((C.linkedMetaFor(d, 'other') || {}).id || null) : null, isRecur: false }));
    }
    a.cuadre = today; touch(a);
  });
  commit(); closeSheet(); refresh();
  toast(n ? `Cuentas cuadradas. Diferencia total: ${total > 0 ? '+' : ''}${fmt(total)}.` : '¡Todo cuadra! Tus cuentas coinciden con tu banco.');
};

// ══ TARJETAS DE CRÉDITO ════════════════════════════════════════
SHEETS['card-new'] = {
  title: (d, st) => ['Agregar tarjeta', 'Elige tu tarjeta', 'Configurar tarjeta'][st.step || 0],
  body(data, st) {
    if (!st.init) Object.assign(st, { init: 1, step: 0, banco: '', tipo: '', alias: '', last4: '', cut: 5, due: 12, limit: '', mant: '0', tasa: '' });
    if (st.step === 0) return `<p class="muted" style="margin-bottom:12px">¿De qué banco es?</p><section class="card"><div class="rows">
      ${Object.keys(TARIFAS).map(b => row({ icon: `<div class="ic">${ico('card')}</div>`, title: esc(b), sub: 'Con tarifas referenciales precargadas', attr: fn('cardBank', b), chev: 1 })).join('')}
      ${row({ icon: `<div class="ic">${ico('plus')}</div>`, title: 'Otro banco o emisor', sub: 'Ingresas tú la mantención y la tasa', attr: fn('cardBank', ''), chev: 1 })}</div></section>`;
    if (st.step === 1) return `<section class="card"><div class="rows">${TARIFAS[st.banco].map(([tipo, mant]) => row({ title: esc(tipo), sub: mant ? `Mantención ref. UF ${String(mant).replace('.', ',')}/mes` : 'Sin mantención (ref.)', attr: fn('cardType', tipo), chev: 1 })).join('')}</div></section>`;
    const custom = !TARIFAS[st.banco] || !TARIFAS[st.banco].some(x => x[0] === st.tipo);
    return `${custom ? `<div class="two">${fld('Banco o emisor', 'cd-b', text('cd-b', 'banco', st.banco, 'Ej: Santander'))}${fld('Tarjeta', 'cd-t', text('cd-t', 'tipo', st.tipo, 'Ej: Visa Gold'))}</div>` : `<div class="note"><strong>${esc(st.banco)} · ${esc(st.tipo)}</strong></div>`}
      ${cardFields(st)}
      <div class="btns"><button class="btn pri"${fn('cardSave', '')}>Agregar tarjeta</button></div>`;
  },
};
function cardFields(st) {
  return `<div class="two">${fld('Alias <span style="font-weight:400">(opcional)</span>', 'cd-al', text('cd-al', 'alias', st.alias, 'Ej: Mi Visa'))}${fld('Últimos 4 dígitos', 'cd-l4', text('cd-l4', 'last4', st.last4, '0000', 'inputmode="numeric" maxlength="4"'))}</div>
    <div class="two">${fld('Día de facturación', 'cd-ct', `<input class="inp" type="number" inputmode="numeric" min="1" max="28" id="cd-ct" data-k="cut" value="${esc(st.cut)}">`)}${fld('Días hasta el vencimiento', 'cd-du', `<input class="inp" type="number" inputmode="numeric" min="1" max="45" id="cd-du" data-k="due" value="${esc(st.due)}">`)}</div>
    ${fld('Cupo total', 'cd-lm', money('cd-lm', 'limit', st.limit), 'Opcional. Sirve para ver cuánto cupo tienes comprometido.')}
    <div class="two">${fld('Mantención (UF/mes)', 'cd-m', text('cd-m', 'mant', st.mant, '0', 'inputmode="decimal"'))}${fld('Tasa cuotas (% mensual)', 'cd-ta', text('cd-ta', 'tasa', st.tasa, 'Ej: 2,2', 'inputmode="decimal"'))}</div>
    <div class="hint" style="margin:-6px 0 14px">Mantención y tasa son referenciales: confírmalas en tu estado de cuenta.</div>`;
}
const dec = s => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(n) && n >= 0 ? n : NaN; };
ACTIONS.cardBank = b => { const st = topState(); st.banco = b; st.step = b ? 1 : 2; if (!b) { st.tipo = ''; st.mant = '0'; st.tasa = ''; } rerender(); };
ACTIONS.cardType = tipo => { const st = topState(), t = TARIFAS[st.banco].find(x => x[0] === tipo); st.tipo = tipo; st.mant = String(t[1]).replace('.', ','); st.tasa = String(t[2]).replace('.', ','); st.sem = t[3] || 0; st.step = 2; rerender(); };
ACTIONS.cardSave = id => {
  const st = topState(), d = getData();
  if (!id && !(st.banco || '').trim()) return setErr('cd-b', 'Indica el banco o emisor.');
  if (!id && !(st.tipo || '').trim()) return setErr('cd-t', 'Indica el nombre de la tarjeta.');
  const cut = parseInt(st.cut), due = parseInt(st.due), mant = dec(st.mant || '0'), tasa = dec(st.tasa || '0');
  if (!(cut >= 1 && cut <= 28)) return setErr('cd-ct', 'Día entre 1 y 28.');
  if (!(due >= 1 && due <= 45)) return setErr('cd-du', 'Entre 1 y 45 días.');
  if (isNaN(mant) || mant > 5) return setErr('cd-m', 'Valor en UF, por ejemplo 0,21.');
  if (isNaN(tasa) || tasa > 10) return setErr('cd-ta', 'Tasa mensual en %, por ejemplo 2,2.');
  if (st.last4 && !/^\d{4}$/.test(st.last4)) return setErr('cd-l4', 'Deben ser 4 dígitos.');
  const c = id ? d.cards.find(x => x.id === id) : { id: C.uid(), banco: st.banco.trim(), tipo: st.tipo.trim(), sem: st.sem || 0, purchases: [], extras: [], reconciliations: [] };
  if (!c) return doneSheet();
  Object.assign(c, { alias: (st.alias || '').trim(), last4: st.last4 || '', cut, due, limit: C.parseMoney(st.limit), mant, tasa });
  touch(c); if (!id) d.cards.push(c);
  commit(); doneSheet(id ? 'Tarjeta actualizada.' : 'Tarjeta agregada.');
  if (!id) openSheet('card', c.id);
};
SHEETS['card-edit'] = {
  title: () => 'Configurar tarjeta',
  body(id, st) {
    const c = getData().cards.find(x => x.id === id); if (!c) return null;
    if (!st.init) Object.assign(st, { init: 1, alias: c.alias || '', last4: c.last4 || '', cut: C.cardCut(c), due: C.cardDueDays(c), limit: g(c.limit), mant: String(c.mant || 0).replace('.', ','), tasa: String(c.tasa || 0).replace('.', ',') });
    return `<div class="note"><strong>${esc(c.banco)} · ${esc(c.tipo)}</strong></div>${cardFields(st)}
      <div class="btns"><button class="btn pri"${fn('cardSave', id)}>Guardar</button><button class="btn dan"${fn('cardDelete', id)}>Eliminar tarjeta</button></div>`;
  },
};
ACTIONS.cardDelete = id => confirmSheet('¿Eliminar esta tarjeta?', 'Se borrarán sus compras en cuotas y cotejos. Los movimientos registrados se conservan.', 'Eliminar', () => { removeFrom('cards', id); commit(); closeSheet(); refresh(); toast('Tarjeta eliminada.'); });
SHEETS.card = {
  live: true,
  title: id => { const c = getData().cards.find(x => x.id === id); return c ? (c.alias || c.tipo) : 'Tarjeta'; },
  body(id) {
    const d = getData(), c = d.cards.find(x => x.id === id); if (!c) return null;
    const now = new Date(), s = C.cardStatus(c, uf(), now), np = s.next, days = C.daysBetween(now, np.due);
    const closedCyc = C.shiftMk(s.open, -1), paidClosed = (c.paidCycles || {})[closedCyc] && C.cycleDueDate(c, closedCyc) >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const purchases = (c.purchases || []).filter(p => p.active !== false);
    const live = purchases.filter(p => C.purchState(p, s.open).rem > 0), ended = purchases.length - live.length;
    const proj = C.cardProjection(c, uf(), now, 3), mx = Math.max(...proj.map(x => x.total), 1);
    return `<div class="cc"><div style="display:flex;justify-content:space-between;gap:8px"><div><div class="k">${esc(c.banco)}${c.last4 ? ' ·· ' + esc(c.last4) : ''}</div><div style="font-weight:600">${esc(c.tipo)}</div></div><div style="text-align:right"><div class="k">${np.closed ? 'Total facturado' : 'Próximo estado (estimado)'}</div><div class="big num" id="cc-next">${fmt(np.total)}</div></div></div>
        <div class="meta"><span>${np.closed ? 'Vence' : 'Cierra ' + esc(C.shortDate(s.cut)) + ' · vence'} ${esc(C.shortDate(np.due))} (${whenTxt(days)})</span><span class="num">Deuda en cuotas ${fmt(s.bal)}</span></div>
        ${s.used != null ? `${pg(s.used)}<div class="meta" style="margin-top:6px"><span>Cupo comprometido ${s.used}%</span><span class="num">de ${fmt(c.limit)}</span></div>` : ''}</div>
      ${np.closed ? `<button class="btn sec2" style="margin-bottom:12px"${fn('cardPaid', id)}>${ico('check')} Ya pagué este estado</button>` : paidClosed ? `<div class="note">Estado de ${esc(C.mlabel(closedCyc).toLowerCase())} marcado como pagado. <button class="link"${fn('cardUnpaid', id)}>Deshacer</button></div>` : ''}
      <div class="box">${kv('Cuotas y compras del ciclo', fmt(np.purch))}${np.tax ? kv('Impuesto de timbres', fmt(np.tax)) : ''}${kv(`Mantención (UF ${String(c.mant || 0).replace('.', ',')} × ${fmt(uf())}${UF ? '' : ', UF ref.'})`, fmt(np.mant))}${np.ext ? kv('Otros cargos', fmt(np.ext)) : ''}${kv('Total', fmt(np.total), 'tot')}${c.sem > 0 ? `<div class="hint">Además, cargo semestral referencial de ${fmt(Math.round(c.sem * uf()))} (UF ${String(c.sem).replace('.', ',')}), no incluido en el total.</div>` : ''}</div>
      <div class="sec"><span>Compras vigentes</span><button class="link"${sh('purchase-form', id)}>+ Agregar</button></div>
      ${live.length ? `<section class="card"><div class="rows">${live.map(p => { const ps = C.purchState(p, s.open); return row({ icon: `<div class="ic">${esc(p.emoji || '🛍️')}</div>`, title: esc(p.desc), sub: p.installments > 1 ? `Cuota ${C.clamp(ps.cur, 1, p.installments)} de ${p.installments}${ps.cur < 1 ? ' · parte en ' + esc(C.mlabel(p.from).toLowerCase()) : ''} · ${p.type === 'yes' ? 'con interés' : 'sin interés'}` : 'Pago único', right: fmt(p.instAmt), rsub: p.installments > 1 ? `restan ${fmt(p.instAmt * ps.rem)}` : '', attr: sh('purchase', id + '|' + p.id) }); }).join('')}</div></section>` : `<p class="muted" style="margin:0 4px">Sin compras pendientes en esta tarjeta.</p>`}
      ${ended ? `<div class="hint" style="margin:8px 4px 0">${ended} compra${ended > 1 ? 's' : ''} ya pagada${ended > 1 ? 's' : ''} por completo.</div>` : ''}
      <div class="sec"><span>Lo que viene</span></div>
      <section class="card"><div class="bars">${proj.map(x => `<div class="bar2"><span>${C.MS[parseInt(x.cycle.slice(5)) - 1]} ${x.cycle.slice(2, 4)}</span><div class="tr"><i style="width:${C.pct(x.total, mx)}%;background:var(--ac)"></i></div><span class="vals num">${fmt(x.total)}</span></div>`).join('')}</div></section>
      <div class="btns"><button class="btn sec2"${sh('purchase-form', id + '|hist')}>Agregar cuotas que ya vienen corriendo</button><button class="btn sec2"${sh('card-calc', id)}>Simular una compra en cuotas</button><button class="btn sec2"${sh('reconcile', id)}>Cotejar con el estado de cuenta</button><button class="btn sec2"${sh('card-edit', id)}>Configurar tarjeta</button></div>`;
  },
};
ACTIONS.cardPaid = id => { const c = getData().cards.find(x => x.id === id), np = c && C.nextPayment(c, uf()); if (!np || !np.closed) return; c.paidCycles = { ...(c.paidCycles || {}), [np.cycle]: 1 }; touch(c); commit(); refresh(); toast('Estado marcado como pagado.'); };
ACTIONS.cardUnpaid = id => { const c = getData().cards.find(x => x.id === id); if (!c) return; const cyc = C.shiftMk(C.billingCycle(c), -1); c.paidCycles = { ...(c.paidCycles || {}) }; delete c.paidCycles[cyc]; touch(c); commit(); refresh(); };
function purchPreview(st, card, hist) {
  const amt = C.parseMoney(st.amount); if (!amt) return '';
  const inst = st.type === 'cash' ? 1 : parseInt(st.inst) || 2, p = C.instPlan(amt, inst, st.type, card.tasa || 0);
  const cur = C.clamp(parseInt(st.cur) || 1, 1, inst), rem = inst - cur + 1;
  return `<div class="box">${kv('Cuota mensual', fmt(p.monthly))}${!hist && p.stamps ? kv('Impuesto de timbres (1ª cuota)', fmt(p.stamps)) : ''}${p.interest ? kv('<span class="neg">Interés total</span>', `<span class="neg">${fmt(p.interest)}</span>`) : ''}${hist ? kv(`Quedan ${rem} cuota${rem > 1 ? 's' : ''}`, fmt(p.monthly * rem), 'tot') : kv('Total a pagar', fmt(p.total), 'tot')}</div>`;
}
SHEETS['purchase-form'] = {
  title: data => (String(data).endsWith('|hist') ? 'Cuotas en curso' : 'Nueva compra'), focus: 'pu-d',
  body(data, st) {
    const [cardId, mode] = String(data).split('|'), hist = mode === 'hist', d = getData(), c = d.cards.find(x => x.id === cardId); if (!c) return null;
    const open = C.billingCycle(c);
    if (!st.init) Object.assign(st, { init: 1, desc: '', amount: '', type: hist ? 'no' : 'cash', inst: hist ? 12 : 3, cur: 2, from: open });
    return `${hist ? `<div class="note">Para compras anteriores que aún estás pagando. Usa el número de cuota que aparece en tu estado de cuenta (ej. “03/12”).</div>` : ''}
      ${fld('Descripción', 'pu-d', text('pu-d', 'desc', st.desc, 'Ej: Televisor'))}
      ${fld('Monto total de la compra', 'pu-a', money('pu-a', 'amount', st.amount))}
      <div class="${st.type !== 'cash' ? 'two' : ''}">${fld('Modalidad', 'pu-t', select('pu-t', 'type', (hist ? [] : [['cash', 'Sin cuotas']]).concat([['no', 'Sin interés'], ['yes', `Con interés (${String(c.tasa || 0).replace('.', ',')}%)`]]), st.type))}
      ${st.type !== 'cash' ? fld('N° de cuotas', 'pu-i', select('pu-i', 'inst', INST.map(n => [n, n + ' cuotas']), st.inst)) : ''}</div>
      ${hist ? fld('Cuota que se cobra en el ciclo actual', 'pu-cur', `<input class="inp" type="number" inputmode="numeric" min="1" max="48" id="pu-cur" data-k="cur" value="${esc(st.cur)}">`)
        : fld('Primera cuota en el estado de', 'pu-f', select('pu-f', 'from', [0, 1, 2].map(i => { const k = C.shiftMk(open, i); return [k, `${C.mlabel(k)} · vence ${C.shortDate(C.cycleDueDate(c, k))}`]; }), st.from))}
      <div id="pu-pv">${purchPreview(st, c, hist)}</div>
      ${hist ? '' : `<div class="hint" style="margin-bottom:8px">Esto solo agrega la compra a la tarjeta. Para que además cuente como gasto del mes, regístrala con el botón “+” eligiendo “Crédito”.</div>`}
      <div class="btns"><button class="btn pri"${fn('purchSave', data)}>Agregar</button></div>`;
  },
  input(t, data, st) {
    if (t.id === 'pu-t') return rerender();
    const el = $('pu-pv'), c = getData().cards.find(x => x.id === String(data).split('|')[0]);
    if (el && c) el.innerHTML = purchPreview(st, c, String(data).endsWith('|hist'));
  },
};
ACTIONS.purchSave = data => {
  const [cardId, mode] = String(data).split('|'), hist = mode === 'hist', st = topState(), d = getData(), c = d.cards.find(x => x.id === cardId); if (!c) return doneSheet();
  if (!(st.desc || '').trim()) return setErr('pu-d', 'Describe la compra.');
  const amount = validAmount('pu-a', st); if (!amount) return;
  const inst = st.type === 'cash' ? 1 : parseInt(st.inst) || 2, p = C.instPlan(amount, inst, st.type, c.tasa || 0);
  let from = st.from;
  if (hist) { const cur = parseInt(st.cur); if (!(cur >= 1 && cur <= inst)) return setErr('pu-cur', `Entre 1 y ${inst}.`); from = C.shiftMk(C.billingCycle(c), -(cur - 1)); }
  (c.purchases = c.purchases || []).push({ id: C.uid(), desc: st.desc.trim(), amount, type: st.type, installments: inst, instAmt: p.monthly, stamps: hist ? 0 : p.stamps, from, emoji: hist ? '📄' : '🛍️', active: true, historic: hist || undefined });
  touch(c); commit(); doneSheet('Compra agregada a la tarjeta.');
};
SHEETS.purchase = {
  title: () => 'Compra en cuotas',
  body(data, st) {
    const [cardId, pid] = String(data).split('|'), d = getData(), c = d.cards.find(x => x.id === cardId), p = c && (c.purchases || []).find(x => x.id === pid); if (!p) return null;
    const ps = C.purchState(p, C.billingCycle(c)), linked = p.txId && d.txs.some(t => t.id === p.txId);
    if (!st.init) Object.assign(st, { init: 1, cur: C.clamp(ps.cur, 1, p.installments) });
    return `<div class="hero" style="text-align:center;margin-bottom:12px"><div class="lbl">${esc(p.desc)}</div><div class="big num">${fmt(p.amount)}</div><div class="hint num">${p.installments > 1 ? `${p.installments} cuotas de ${fmt(p.instAmt)} · restan ${fmt(p.instAmt * ps.rem)}` : 'Pago único'}</div></div>
      ${p.installments > 1 ? `${fld('¿No calza con tu estado de cuenta? Cuota del ciclo actual', 'ep-cur', `<input class="inp" type="number" inputmode="numeric" min="1" max="${p.installments}" id="ep-cur" data-k="cur" value="${esc(st.cur)}">`)}<button class="btn sec2"${fn('purchFix', data)}>Corregir cuota</button>` : ''}
      <div class="btns">${linked ? `<div class="note">Esta compra viene de un movimiento. Edítalo o elimínalo desde ahí para mantener todo cuadrado.</div><button class="btn sec2"${sh('tx', p.txId)}>Ver movimiento</button>` : `<button class="btn dan"${fn('purchDelete', data)}>Eliminar compra</button>`}</div>`;
  },
};
ACTIONS.purchFix = data => { const [cardId, pid] = String(data).split('|'), st = topState(), c = getData().cards.find(x => x.id === cardId), p = c && c.purchases.find(x => x.id === pid); if (!p) return; const cur = parseInt(st.cur); if (!(cur >= 1 && cur <= p.installments)) return setErr('ep-cur', `Entre 1 y ${p.installments}.`); p.from = C.shiftMk(C.billingCycle(c), -(cur - 1)); touch(c); commit(); doneSheet('Cuota corregida.'); };
ACTIONS.purchDelete = data => confirmSheet('¿Eliminar esta compra?', 'Se quitarán sus cuotas pendientes de la tarjeta.', 'Eliminar', () => { const [cardId, pid] = String(data).split('|'), c = getData().cards.find(x => x.id === cardId); if (c) { c.purchases = c.purchases.filter(p => p.id !== pid); getData().deleted[pid] = Date.now(); touch(c); commit(); } doneSheet('Compra eliminada.'); });
SHEETS['card-calc'] = {
  title: () => 'Simular compra en cuotas', focus: 'cc-a',
  body(id, st) {
    const c = getData().cards.find(x => x.id === id); if (!c) return null;
    if (!st.init) Object.assign(st, { init: 1, amount: '', inst: 6, type: 'no' });
    return `${fld('Monto', 'cc-a', money('cc-a', 'amount', st.amount))}<div class="two">${fld('Cuotas', 'cc-i', select('cc-i', 'inst', INST.map(n => [n, n + ' cuotas']), st.inst))}${fld('Tipo', 'cc-t', select('cc-t', 'type', [['no', 'Sin interés'], ['yes', `Con interés (${String(c.tasa || 0).replace('.', ',')}%)`]], st.type))}</div><div id="cc-pv">${purchPreview(st, c)}</div>
      <div class="hint">Simulación con la tasa configurada en la tarjeta. No registra nada.</div>`;
  },
  input(t, id, st) { const c = getData().cards.find(x => x.id === id); if (c) $('cc-pv').innerHTML = purchPreview(st, c); },
};
function reconcilePreview(st, c) {
  const real = C.parseMoney(st.real); if (!real) return '';
  const calc = C.nextPayment(c, uf()).total, diff = real - calc, ok = Math.abs(diff) <= 500;
  return `<div class="box">${kv('Calculado por Bolsillo', fmt(calc))}${kv('Tu estado de cuenta', fmt(real))}${kv('Diferencia', `<span class="${ok ? 'pos' : 'neg'}">${diff > 0 ? '+' : ''}${fmt(diff)}</span>`, 'tot')}
    <div class="hint">${ok ? 'Calza con lo registrado.' : diff > 0 ? 'El banco cobra más: puede faltar una compra, un avance o intereses.' : 'El banco cobra menos: revisa si alguna cuota ya terminó o si la mantención real es distinta.'}</div></div>`;
}
SHEETS.reconcile = {
  title: () => 'Cotejar estado de cuenta', focus: 'rc-t',
  body(id, st) {
    const c = getData().cards.find(x => x.id === id); if (!c) return null;
    if (!st.init) Object.assign(st, { init: 1, real: '' });
    const hist = [...(c.reconciliations || [])].reverse().slice(0, 6);
    return `${fld('Monto total facturado según tu banco', 'rc-t', money('rc-t', 'real', st.real))}<div id="rc-pv">${reconcilePreview(st, c)}</div>
      <div class="btns"><button class="btn pri"${fn('reconcileSave', id)}>Guardar cotejo</button></div>
      ${hist.length ? `<div class="sec"><span>Cotejos anteriores</span></div><section class="card"><div class="rows">${hist.map(r => { const diff = r.real - r.calc; return row({ title: esc(C.isMk(r.month) ? C.mlabel(r.month) : r.month), sub: `Bolsillo ${fmt(r.calc)} · banco ${fmt(r.real)}`, right: Math.abs(diff) <= 500 ? tag('Calza', 'g') : `<span class="neg">${diff > 0 ? '+' : ''}${fmt(diff)}</span>` }); }).join('')}</div></section>` : ''}`;
  },
  input(t, id, st) { const c = getData().cards.find(x => x.id === id); if (c) $('rc-pv').innerHTML = reconcilePreview(st, c); },
};
ACTIONS.reconcileSave = id => { const st = topState(), c = getData().cards.find(x => x.id === id); if (!c) return doneSheet(); const real = validAmount('rc-t', st, 'real'); if (!real) return; const np = C.nextPayment(c, uf()); (c.reconciliations = c.reconciliations || []).push({ id: C.uid(), month: np.cycle, calc: np.total, real, date: C.isoDate() }); touch(c); commit(); doneSheet('Cotejo guardado.'); };

// ══ DEBO / ME DEBEN ════════════════════════════════════════════
const OWE = { deudas: { one: 'deuda', who: '¿A quién le debes?', paid: 'pagado', done: 'Marcar como pagada' }, cobros: { one: 'préstamo', who: '¿Quién te debe?', paid: 'cobrado', done: 'Marcar como cobrado' } };
SHEETS['owe-form'] = {
  title: data => { const [k, id] = String(data).split('|'); return id ? 'Editar' : k === 'deudas' ? 'Nueva deuda' : 'Nuevo préstamo'; }, focus: 'ow-n',
  body(data, st) {
    const [kind, id] = String(data).split('|'), d = getData(), c = id ? d[kind].find(x => x.id === id) : null;
    if (id && !c) return null;
    if (!st.init) Object.assign(st, { init: 1, name: c ? c.name : '', amount: g(c && c.amount), desc: c ? c.desc || '' : '', date: c && C.isISO(c.date) ? c.date : C.isoDate(), due: c && c.due || '' });
    return `${fld(OWE[kind].who, 'ow-n', text('ow-n', 'name', st.name, 'Nombre'))}${fld('Monto', 'ow-a', money('ow-a', 'amount', st.amount))}${fld('Motivo <span style="font-weight:400">(opcional)</span>', 'ow-d', text('ow-d', 'desc', st.desc, 'Ej: Préstamo, cena…'))}
      <div class="two">${fld('Fecha', 'ow-dt', date('ow-dt', 'date', st.date))}${fld('Vence <span style="font-weight:400">(opcional)</span>', 'ow-due', date('ow-due', 'due', st.due))}</div>
      <div class="btns"><button class="btn pri"${fn('oweSave', data)}>Guardar</button></div>`;
  },
};
ACTIONS.oweSave = data => {
  const [kind, id] = String(data).split('|'), st = topState(), d = getData();
  if (!(st.name || '').trim()) return setErr('ow-n', 'Ingresa un nombre.');
  const amount = validAmount('ow-a', st); if (!amount) return;
  if (!validDate('ow-dt', st.date)) return;
  if (st.due && !C.isISO(st.due)) return setErr('ow-due', 'Fecha inválida.');
  const c = id ? d[kind].find(x => x.id === id) : { id: C.uid(), paid: 0, abonos: [], done: false };
  if (!c) return doneSheet();
  if (id && amount < (c.paid || 0)) return setErr('ow-a', `Ya hay ${fmt(c.paid)} abonados: el monto no puede ser menor.`);
  Object.assign(c, { name: st.name.trim(), amount, desc: (st.desc || '').trim(), date: st.date, due: st.due || null });
  if (id) c.done = (c.paid || 0) >= amount;
  touch(c); if (!id) d[kind].push(c);
  commit(); doneSheet('Guardado.');
};
// Un abono puede registrarse además como movimiento de una cuenta: es una
// transferencia (no es gasto ni ingreso), así el saldo de la cuenta baja o sube
// y el patrimonio no cambia dos veces.
SHEETS.owe = {
  live: true,
  title: data => { const [k, id] = String(data).split('|'), c = getData()[k].find(x => x.id === id); return c ? c.name : ''; },
  body(data, st) {
    const [kind, id] = String(data).split('|'), d = getData(), c = d[kind].find(x => x.id === id); if (!c) return null;
    const left = C.owedLeft(c), o = OWE[kind];
    if (st.abAcc === undefined) st.abAcc = (d.accounts.find(a => a.kind === 'bank') || d.accounts[0] || {}).id || '';
    const accSel = d.accounts.length ? fld(kind === 'deudas' ? 'Pagado desde' : 'Recibido en', 'ow-acc', select('ow-acc', 'abAcc', [['', 'No registrar en una cuenta']].concat(d.accounts.map(a => [a.id, `${a.name} · ${fmt(C.accountBalance(d, a))}`])), st.abAcc)) : '';
    return `<div class="hero" style="text-align:center;margin-bottom:12px"><div class="lbl">${c.done ? 'Saldada' : 'Pendiente'}</div><div class="big num">${fmt(c.done ? 0 : left)}</div>
      <div class="hint num">de ${fmt(c.amount)}${c.paid ? ` · ${fmt(c.paid)} ${o.paid}` : ''}${c.desc ? ' · ' + esc(c.desc) : ''}${c.due ? ' · vence ' + esc(C.dateLabel(c.due)) : ''}</div><div style="margin-top:10px">${pg(C.pct(c.paid || 0, c.amount), 'ok')}</div></div>
      ${(c.abonos || []).length ? `<section class="card" style="margin-bottom:12px"><div class="rows">${c.abonos.map((a, i) => { const acc = a.txId && d.txs.find(t => t.id === a.txId); const an = acc && d.accounts.find(x => x.id === (acc.acc || acc.toAcc)); return row({ title: 'Abono', sub: esc(C.isISO(a.date) ? C.dateLabel(a.date) : a.date) + (an ? ' · ' + esc(an.name) : ''), right: fmt(a.amount), rsub: `<button class="link"${fn('abonoDelete', data + '|' + i)}>Quitar</button>` }); }).join('')}</div></section>` : ''}
      ${c.done ? '' : `${fld('Registrar abono', 'ow-ab', money('ow-ab', 'abono', st.abono || ''))}${accSel}<button class="btn pri"${fn('oweAbono', data)}>Registrar abono</button>`}
      <div class="btns"><button class="btn sec2"${fn('oweToggle', data)}>${c.done ? 'Reabrir' : o.done}</button><button class="btn sec2"${sh('owe-form', data)}>Editar</button><button class="btn dan"${fn('oweDelete', data)}>Eliminar</button></div>`;
  },
};
ACTIONS.oweAbono = data => {
  const [kind, id] = String(data).split('|'), st = topState(), d = getData(), c = d[kind].find(x => x.id === id); if (!c) return;
  const a = validAmount('ow-ab', st, 'abono'); if (!a) return;
  if (a > C.owedLeft(c)) return setErr('ow-ab', `El abono supera lo pendiente (${fmt(C.owedLeft(c))}).`);
  const date = C.isoDate(), ab = { id: C.uid(), amount: a, date };
  if (st.abAcc && d.accounts.some(x => x.id === st.abAcc)) {
    const t = { id: C.uid(), type: 'tr', amount: a, date, dateLabel: C.dateLabel(date), month: C.mkOf(date), desc: `${kind === 'deudas' ? 'Abono a' : 'Abono de'} ${c.name}`, cat: null, pago: null, owe: kind + '|' + id };
    if (kind === 'deudas') t.acc = st.abAcc; else t.toAcc = st.abAcc;
    d.txs.push(touch(t)); ab.txId = t.id;
  }
  c.paid = (c.paid || 0) + a; (c.abonos = c.abonos || []).push(ab);
  if (c.paid >= c.amount) c.done = true;
  st.abono = ''; touch(c); commit(); refresh(); toast(c.done ? 'Quedó saldada.' : 'Abono registrado.');
};
ACTIONS.abonoDelete = arg => {
  const [kind, id, i] = String(arg).split('|');
  confirmSheet('¿Quitar este abono?', 'Lo pendiente vuelve a aumentar y, si estaba en una cuenta, su saldo vuelve al valor anterior.', 'Quitar', () => {
    const d = getData(), c = d[kind].find(x => x.id === id), a = c && (c.abonos || [])[parseInt(i)]; if (!a) return;
    c.abonos.splice(parseInt(i), 1); if (a.id) d.deleted[a.id] = Date.now(); c.paid = Math.max((c.paid || 0) - a.amount, 0); if (c.paid < c.amount) c.done = false;
    if (a.txId && d.txs.some(t => t.id === a.txId)) removeFrom('txs', a.txId);
    touch(c); commit(); refresh(); toast('Abono quitado.');
  });
};
ACTIONS.oweToggle = data => { const [kind, id] = String(data).split('|'), c = getData()[kind].find(x => x.id === id); if (!c) return; c.done = !c.done; touch(c); commit(); refresh(); };
ACTIONS.oweDelete = data => confirmSheet('¿Eliminar este registro?', 'Se quitará de tu patrimonio junto con sus abonos (y los movimientos de cuenta de esos abonos).', 'Eliminar', () => { const [kind, id] = String(data).split('|'), d = getData(); d.txs.filter(t => t.owe === kind + '|' + id).forEach(t => removeFrom('txs', t.id)); removeFrom(kind, id); commit(); closeSheet(); refresh(); toast('Eliminado.'); });

// ══ BIENES ═════════════════════════════════════════════════════
const ASSET_EMOJIS = ['💰', '🏠', '🚗', '📈', '🏦', '💵', '🪙', '💎'];
SHEETS['asset-form'] = {
  title: id => (id ? 'Editar bien' : 'Nuevo bien'), focus: 'as-n',
  body(id, st) {
    const a = id ? getData().assets.find(x => x.id === id) : null;
    if (id && !a) return null;
    if (!st.init) Object.assign(st, { init: 1, emoji: a ? a.icon || '💰' : '💰', name: a ? a.name : '', cur: a && a.currency === 'USD' ? 'usd' : 'clp', value: g(a ? (a.currency === 'USD' ? a.amountUSD : a.value) : 0) });
    const usd = st.cur === 'usd', v = C.parseMoney(st.value);
    return `${emojiPick(ASSET_EMOJIS, st.emoji)}${fld('Descripción', 'as-n', text('as-n', 'name', st.name, 'Ej: Auto, depto, fondo mutuo…'))}
      <div class="fld"><div class="lab">Moneda</div><div class="seg"><button type="button" class="${usd ? '' : 'on'}"${fn('setK', 'cur=clp')}>Pesos</button><button type="button" class="${usd ? 'on' : ''}"${fn('setK', 'cur=usd')}>Dólares</button></div></div>
      ${fld(`Valor estimado ${usd ? '(US$)' : ''}`, 'as-v', money('as-v', 'value', st.value), usd ? (USD ? `<span id="as-pv">≈ ${fmt(v * USD)} · dólar a ${fmt(USD)}</span>` : 'Aún no hay tipo de cambio disponible (se obtiene con conexión). Regístralo en pesos por ahora.') : '')}
      <div class="btns"><button class="btn pri"${fn('assetSave', id || '')}>Guardar</button>${a ? `<button class="btn dan"${fn('assetDelete', id)}>Eliminar</button>` : ''}</div>`;
  },
  input(t, id, st) { const el = $('as-pv'); if (el && t.id === 'as-v') el.textContent = `≈ ${fmt(C.parseMoney(st.value) * USD)} · dólar a ${fmt(USD)}`; },
};
ACTIONS.assetSave = id => {
  const st = topState(), d = getData();
  if (!(st.name || '').trim()) return setErr('as-n', 'Describe el bien.');
  const v = validAmount('as-v', st, 'value'); if (!v) return;
  if (st.cur === 'usd' && !USD) return setErr('as-v', 'Sin tipo de cambio disponible: regístralo en pesos.');
  const a = id ? d.assets.find(x => x.id === id) : { id: C.uid(), active: true };
  if (!a) return doneSheet();
  Object.assign(a, { name: st.name.trim(), icon: st.emoji });
  if (st.cur === 'usd') Object.assign(a, { currency: 'USD', amountUSD: v, value: Math.round(v * USD) }); else { Object.assign(a, { currency: 'CLP', value: v }); delete a.amountUSD; }
  touch(a); if (!id) d.assets.push(a);
  commit(); doneSheet('Guardado.');
};
ACTIONS.assetDelete = id => confirmSheet('¿Eliminar este bien?', 'Dejará de sumar a tu patrimonio.', 'Eliminar', () => { removeFrom('assets', id); commit(); doneSheet('Eliminado.'); });

// ══ ANÁLISIS: salud financiera, comparación, reporte ═══════════
function kpiCard(label, value, status, statusLabel, bar, desc, tip) {
  const tone = { g: 'ok', y: 'warn', r: 'over' }[status];
  return `<section class="card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><div><div class="muted" style="font-size:13px;font-weight:600">${label}</div><div class="num" style="font-size:20px;font-weight:700">${value}</div></div>${tag(statusLabel, status)}</div>
    ${pg(bar, tone, 'sm')}<p class="hint">${desc}</p>${tip ? `<div class="note" style="margin:10px 0 0">${tip}</div>` : ''}</section>`;
}
SHEETS.kpis = {
  live: true, title: () => 'Salud financiera',
  body() {
    const k = C.finKPIs(getData(), uf());
    if (!k.monthsUsed || !k.hasIncome) return empty('📊', 'Estos indicadores se calculan con tus ingresos y gastos reales. Registra al menos un mes con ingresos para verlos.');
    const st = (v, a, b, inv) => (inv ? (v >= a ? 'g' : v >= b ? 'y' : 'r') : (v <= a ? 'g' : v <= b ? 'y' : 'r'));
    const sv = st(k.savingsRate, 10, 0, true), dt = st(k.dti, 30, 40), fx = st(k.fixedRatio, 50, 65), ds = st(k.discreRatio, 30, 45);
    const em = k.emergMonths == null ? null : st(k.emergMonths, 3, 1, true);
    return `<div class="note">Promedio de ${k.monthsUsed} mes${k.monthsUsed > 1 ? 'es' : ''} con movimientos (hasta el mes en curso). Los rangos son referencias generales, no asesoría financiera.</div>
      ${kpiCard('Tasa de ahorro', Math.round(k.savingsRate) + '%', sv, k.savingsRate >= 20 ? 'Excelente' : k.savingsRate >= 10 ? 'Saludable' : k.savingsRate >= 0 ? 'Bajo lo ideal' : 'En negativo', C.clamp(k.savingsRate, 0, 40) / 40 * 100, `De ${fmt(k.avgInc)} de ingreso promedio, no consumes ${fmt(Math.max(k.avgSaved, 0))} al mes. Referencia: 10% a 20% o más.`, sv === 'r' ? 'Estás gastando más de lo que ingresa. Revisa primero los gastos no esenciales.' : sv === 'y' ? 'Un ahorro fijo apenas recibes tu ingreso ayuda a llegar al 10%.' : '')}
      ${kpiCard('Tarjeta sobre ingreso', Math.round(k.dti) + '%', dt, k.dti <= 30 ? 'Saludable' : k.dti <= 40 ? 'Cuidado' : 'Alerta', C.clamp(k.dti, 0, 60) / 60 * 100, `${fmt(k.cardsMonthly)} al mes en estados de tarjeta. Referencia: no superar 30% a 40% del ingreso.`, dt !== 'g' ? 'Evita nuevas cuotas hasta bajar este número.' : '')}
      ${em ? kpiCard('Fondo de emergencia', k.emergMonths.toFixed(1).replace('.', ',') + ' meses', em, k.emergMonths >= 6 ? 'Excelente' : k.emergMonths >= 3 ? 'Cubierto' : k.emergMonths >= 1 ? 'En construcción' : 'Vulnerable', C.clamp(k.emergMonths, 0, 6) / 6 * 100, `Con ${fmt(k.liquid)} entre cuentas y metas cubrirías ese tiempo de gastos esenciales. Referencia: 3 a 6 meses.`, em === 'r' ? 'Antes de otras metas, prioriza construir este respaldo.' : '') : ''}
      ${kpiCard('Gastos esenciales', Math.round(k.fixedRatio) + '%', fx, k.fixedRatio <= 50 ? 'Saludable' : k.fixedRatio <= 65 ? 'Ajustado' : 'Muy alto', C.clamp(k.fixedRatio, 0, 80) / 80 * 100, `${fmt(k.avgFijo)} al mes en vivienda, alimentación, transporte, salud y educación. Referencia: hasta 50% del ingreso.`, '')}
      ${kpiCard('Gastos no esenciales', Math.round(k.discreRatio) + '%', ds, k.discreRatio <= 30 ? 'Bajo control' : k.discreRatio <= 45 ? 'Elevado' : 'Muy alto', C.clamp(k.discreRatio, 0, 60) / 60 * 100, `${fmt(k.avgDiscre)} al mes en salidas, compras y gustos. Referencia: hasta 30% del ingreso.`, ds === 'r' ? 'Aquí está tu mayor margen: lo que bajes se convierte directo en ahorro.' : '')}`;
  },
};
SHEETS.compare = {
  live: true, title: () => 'Comparar meses',
  body() {
    const dm = C.monthsSeries(getData(), 8);
    if (!dm.length) return empty('📊', 'Aún no hay meses con movimientos para comparar.');
    const mx = Math.max(...dm.map(m => Math.max(m.inc, m.exp)), 1), avg = k => Math.round(C.sum(dm, m => m[k]) / dm.length), best = [...dm].sort((a, b) => b.net - a.net)[0];
    return `<section class="card"><div class="stats" style="border:none;margin:0;padding:0"><div class="stat"><div class="k">Ingreso prom.</div><div class="v num pos">${fmt(avg('inc'))}</div></div><div class="stat"><div class="k">Egreso prom.</div><div class="v num">${fmt(avg('exp'))}</div></div><div class="stat"><div class="k">Mejor mes</div><div class="v">${esc(C.MS[parseInt(best.mk.slice(5)) - 1])} ${best.mk.slice(2, 4)}</div></div></div></section>
      <div class="sec"><span>Últimos ${dm.length} meses</span><span style="font-weight:500"><span class="pos">■</span> ingresos <span class="neg">■</span> egresos</span></div>
      <section class="card"><div class="bars">${[...dm].reverse().map(m => `<button class="bar2"${fn('pickMonth', m.mk)}><span style="font-weight:${m.mk === UI.month ? 700 : 400}">${C.MS[parseInt(m.mk.slice(5)) - 1]} ${m.mk.slice(2, 4)}</span><div class="tr"><i style="width:${C.pct(m.inc, mx)}%;background:var(--gn)"></i><i style="width:${C.pct(m.exp, mx)}%;background:var(--rd)"></i></div><span class="vals num"><span class="${m.net >= 0 ? 'pos' : 'neg'}" style="font-weight:700">${m.net >= 0 ? '+' : '−'}${fmt(Math.abs(m.net))}</span><br><span class="muted">${fmt(m.exp)}</span></span></button>`).join('')}</div></section>
      <p class="hint" style="margin:8px 4px">Egresos incluye aportes a ahorro. Toca un mes para abrirlo.</p>`;
  },
};
SHEETS.report = {
  live: true, title: () => 'Reporte mensual',
  body() {
    const d = getData(), mk = UI.month, t = C.totals(C.mTxs(d, mk)), cb = C.categoryBreakdown(d, mk), bs = C.budgetSummary(d, mk);
    return `<section class="card"><div class="card-h"><h2>Bolsillo · ${esc(C.mlabel(mk))}</h2></div>
        ${kv('Ingresos', fmt(t.inc))}${kv('Gastos', fmt(t.spend))}${kv('Ahorro e inversión', fmt(t.saved))}${t.credit ? kv('<span class="muted">De los gastos, con tarjeta de crédito</span>', fmt(t.credit)) : ''}${kv('Disponible del mes', fmt(t.net), 'tot')}</section>
      ${cb.rows.length ? `<section class="card" style="margin-top:12px"><div class="card-h"><h2>Egresos por categoría</h2></div>${cb.rows.map(r => { const b = (d.budgets[mk] || {})[r.c.id]; return kv(esc(r.c.name) + (b > 0 ? `<div class="hint" style="margin:0">límite ${fmt(b)}</div>` : ''), `${fmt(r.spent)} · ${C.pct(r.spent, cb.total)}%`); }).join('')}${bs.hasBudget ? kv('Presupuesto total', `${fmt(bs.spentB)} de ${fmt(bs.totalB)}`, 'tot') : ''}</section>` : ''}
      <p class="hint" style="text-align:center;margin-top:12px">Generado el ${esc(C.dateLabel(C.isoDate()))}</p>
      <button class="btn pri no-print" style="margin-top:12px" onclick="window.print()">Imprimir o guardar como PDF</button>`;
  },
};

// ══ MÁS: ajustes, categorías, respaldo ═════════════════════════
SHEETS.more = {
  live: true, title: () => 'Más',
  body() {
    const d = getData(), th = ls.get(THEME_KEY) || (ls.get('dk') === '1' ? 'dark' : 'auto'), u = UI.user;
    const r = (ic, title, sub, attr) => row({ icon: `<div class="ic">${ico(ic)}</div>`, title, sub, attr, chev: 1 });
    return `<div class="sec" style="margin-top:0"><span>Análisis</span></div><section class="card"><div class="rows">
        ${r('chart', 'Salud financiera', 'Indicadores de ahorro, deuda y respaldo', sh('kpis'))}${r('swap', 'Comparar meses', 'Ingresos y egresos mes a mes', sh('compare'))}${r('list', 'Reporte mensual', 'Para imprimir o guardar como PDF', sh('report'))}</div></section>
      <div class="sec"><span>Preferencias</span></div><section class="card">
        <div class="lab">Apariencia</div><div class="seg" style="margin-bottom:14px">${[['auto', 'Automática'], ['light', 'Clara'], ['dark', 'Oscura']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}"${fn('theme', k)} aria-pressed="${th === k}">${l}</button>`).join('')}</div>
        <div class="rows">${r('target', 'Categorías', `${C.allCats(d).length} categorías · ${d.cats.length} propias`, sh('categories'))}</div></section>
      <div class="sec"><span>Tus datos</span></div><section class="card"><div class="rows">
        ${r('up', 'Descargar respaldo', 'Archivo con toda tu información (JSON)', fn('exportJSON'))}${r('list', 'Exportar movimientos', 'Planilla CSV para Excel o Google Sheets', fn('exportCSV'))}${r('repeat', 'Restaurar respaldo', 'Fusiona un respaldo con tus datos actuales', fn('importPick'))}</div>
        <input type="file" id="imp-file" accept="application/json,.json" hidden></section>
      <div class="sec"><span>Cuenta</span></div><section class="card">
        ${u ? `<div style="font-weight:600">${esc(u.displayName || u.email || 'Sesión iniciada')}</div>${u.email && u.displayName ? `<div class="hint" style="margin-top:0">${esc(u.email)}</div>` : ''}` : ''}
        <div class="hint" id="sync-state">${esc(syncLabel())}</div>
        ${(() => { const u = C.cloudUsage(UI.bytes || 0); return `<div class="hint">Espacio usado en la nube: <span class="num ${u.level === 'bad' ? 'neg' : u.level === 'warn' ? 'warn' : ''}">${u.pct}%</span> del máximo por cuenta</div>`; })()}
        <div class="btns"><button class="btn sec2"${fn('syncNow')}>Sincronizar ahora</button><button class="btn dan"${fn('signOut')}>Cerrar sesión</button></div></section>
      <p class="hint" style="text-align:center;margin-top:16px">Bolsillo ${APP_VERSION} · ${d.txs.length} movimientos${UF ? ` · UF ${fmt(UF)}` : ''}</p>`;
  },
  input(t) { if (t.id === 'imp-file' && t.files && t.files[0]) importFile(t.files[0]); },
};
ICONS.up = 'M12 16V4M6 10l6-6 6 6M4 20h16';
ACTIONS.theme = k => { applyTheme(k); refresh(); };
ACTIONS.syncNow = () => { if (window.Sync) Sync.now(true); else toast('Sin conexión con la nube en este momento.', { err: true }); };
ACTIONS.signOut = () => confirmSheet('¿Cerrar sesión?', 'Tus datos quedan guardados en tu cuenta. En este dispositivo se cerrará el acceso.', 'Cerrar sesión', () => { closeSheet(); if (window.Sync) Sync.signOut(); else { ls.del(SESS_KEY); showLogin(); } });
ACTIONS.exportJSON = () => { download(`bolsillo-respaldo-${C.isoDate()}.json`, JSON.stringify(getData(), null, 1), 'application/json'); toast('Respaldo descargado.'); };
ACTIONS.exportCSV = () => { download(`bolsillo-movimientos-${C.isoDate()}.csv`, C.toCSV(getData()), 'text/csv;charset=utf-8'); toast('Movimientos exportados.'); };
ACTIONS.importPick = () => { const f = $('imp-file'); if (f) { f.value = ''; f.click(); } };
function importFile(file) {
  if (file.size > 20 * 1024 * 1024) return toast('El archivo es demasiado grande.', { err: true });
  const rd = new FileReader();
  rd.onerror = () => toast('No se pudo leer el archivo.', { err: true });
  rd.onload = () => {
    let o; try { o = JSON.parse(rd.result); } catch (e) { return toast('El archivo no es un respaldo válido.', { err: true }); }
    const err = C.validateBackup(o); if (err) return toast(err, { err: true });
    confirmSheet('¿Restaurar este respaldo?', `Contiene ${o.txs.length} movimientos. Se fusionará con tus datos actuales: no se borra nada y, si un registro existe en ambos, queda la versión más reciente.`, 'Restaurar', () => {
      ls.set(KEY + '_backup_import', JSON.stringify(getData()));
      C.normalize(o);
      const merged = C.mergeDocs(getData(), o); C.normalize(merged);
      DB = merged; refreshUsdAssets(); commit(); closeSheet(); refresh(true); toast('Respaldo restaurado.');
    });
  };
  rd.readAsText(file);
}
SHEETS.categories = {
  live: true, title: () => 'Categorías',
  body() {
    const d = getData();
    return `<div class="sec" style="margin-top:0"><span>Tuyas</span><button class="link"${sh('cat-form')}>+ Nueva</button></div>
      ${d.cats.length ? `<section class="card"><div class="rows">${d.cats.map(c => row({ icon: catIcon(c), title: esc(c.name), sub: `${C.catKind(c) === 'inc' ? 'Ingreso' : 'Gasto'} · ${C.catUsage(d, c.id)} movimiento(s)`, attr: sh('cat-form', c.id), chev: 1 })).join('')}</div></section>` : '<p class="muted" style="margin:0 4px">Aún no creas categorías propias.</p>'}
      <div class="sec"><span>Incluidas</span></div><section class="card"><div class="rows">${C.BASE_CATS.map(c => row({ icon: catIcon(c), title: esc(c.name), sub: C.catKind(c) === 'inc' ? 'Ingreso' : 'Gasto' })).join('')}</div></section>`;
  },
};
SHEETS['cat-form'] = {
  title: id => (id ? 'Editar categoría' : 'Nueva categoría'), focus: 'ct-n',
  body(id, st) {
    const d = getData(), c = id ? d.cats.find(x => x.id === id) : null;
    if (id && !c) return null;
    if (!st.init) Object.assign(st, { init: 1, name: c ? c.name : '', icon: c ? c.icon : '📌', kind: c ? C.catKind(c) : 'exp', moveTo: '' });
    const used = c ? C.catUsage(d, id) : 0, others = C.catsOf(d, st.kind).filter(x => x.id !== id);
    return `<div class="two" style="grid-template-columns:96px 1fr">${fld('Ícono', 'ct-i', text('ct-i', 'icon', st.icon, '📌', 'maxlength="4" style="text-align:center;font-size:20px"'))}${fld('Nombre', 'ct-n', text('ct-n', 'name', st.name, 'Ej: Peluquería', 'maxlength="24"'))}</div>
      ${c ? '' : `<div class="fld"><div class="lab">Tipo</div><div class="seg"><button type="button" class="${st.kind === 'exp' ? 'on' : ''}"${fn('setK', 'kind=exp')}>Gasto</button><button type="button" class="${st.kind === 'inc' ? 'on' : ''}"${fn('setK', 'kind=inc')}>Ingreso</button></div></div>`}
      <div class="btns"><button class="btn pri"${fn('catSave', id || '')}>${c ? 'Guardar' : 'Crear categoría'}</button></div>
      ${c ? `<div style="margin-top:20px"></div>${used ? fld(`Mover sus ${used} movimiento(s) a`, 'ct-mv', select('ct-mv', 'moveTo', [['', 'Elige una categoría']].concat(others.map(x => [x.id, `${x.icon} ${x.name}`])), st.moveTo), 'Para no dejar movimientos sin categoría, elige a dónde pasan.') : ''}<button class="btn dan"${fn('catDelete', id)}>Eliminar categoría</button>` : ''}`;
  },
};
ACTIONS.catSave = id => {
  const st = topState(), d = getData(), name = (st.name || '').trim();
  if (!name) return setErr('ct-n', 'Ponle un nombre.');
  if (C.allCats(d).some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) return setErr('ct-n', 'Ya existe una categoría con ese nombre.');
  const c = id ? d.cats.find(x => x.id === id) : { id: 'c_' + C.uid(), color: '#6B5FA8', kind: st.kind };
  if (!c) return doneSheet();
  Object.assign(c, { name, icon: (st.icon || '').trim() || '📌' });
  touch(c); if (!id) d.cats.push(c);
  commit(); doneSheet(id ? 'Categoría actualizada.' : 'Categoría creada.');
};
ACTIONS.catDelete = id => {
  const st = topState(), d = getData(), used = C.catUsage(d, id);
  if (used && !st.moveTo) return setErr('ct-mv', 'Elige a qué categoría mover sus movimientos.');
  const run = () => {
    if (used) {
      d.txs.forEach(t => { if (t.cat === id) { t.cat = st.moveTo; touch(t); } });
      d.recur.forEach(r => { if (r.cat === id) { r.cat = st.moveTo; touch(r); } });
    }
    {
      Object.keys(d.budgets).forEach(mk => { if (d.budgets[mk] && d.budgets[mk][id] != null) { d.budgets[mk] = { ...d.budgets[mk] }; delete d.budgets[mk][id]; d.budgetsU[mk] = Date.now(); } });
    }
    d.metas.forEach(m => { if (m.linkedCat === id) { m.linkedCat = null; touch(m); } });
    if (UI.f.cat === id) UI.f.cat = '';
    removeFrom('cats', id); commit(); doneSheet('Categoría eliminada.');
  };
  used ? run() : confirmSheet('¿Eliminar esta categoría?', 'No tiene movimientos asociados.', 'Eliminar', run);
};

boot();
