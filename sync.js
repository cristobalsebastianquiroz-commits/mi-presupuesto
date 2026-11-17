// ═══════════════════════════════════════════════════════════════
// BOLSILLO · sync.js — sesión (Google) y respaldo en Firestore
//
// Reglas de integridad:
//  1. Nunca se pisa un documento completo: antes de subir se lee la nube y se
//     FUSIONA registro por registro (Core.mergeDocs).
//  2. Los datos locales pertenecen a un usuario (bolsillo_owner). Si entra
//     otra cuenta, los del anterior se apartan y jamás se suben a la nueva.
//  3. La app funciona sin este módulo (sin conexión): todo queda en el
//     dispositivo y se sincroniza al volver la red.
//
// IMPORTANTE (consola de Firebase → Firestore → Reglas). La seguridad real de
// los datos depende de estas reglas, no de este archivo:
//   match /usuarios/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }
// ═══════════════════════════════════════════════════════════════
const FB = 'https://www.gstatic.com/firebasejs/10.12.0/';
const CONFIG = {
  apiKey: 'AIzaSyBdozpKZrxC63eil14drCAJ1txISA702W0',
  authDomain: 'mi-presupuesto-d12de.firebaseapp.com',
  projectId: 'mi-presupuesto-d12de',
  storageBucket: 'mi-presupuesto-d12de.firebasestorage.app',
  messagingSenderId: '418712208787',
  appId: '1:418712208787:web:2b4d769ba39c1c780c9466',
};
const KEY = 'bolsillo_v1', OWNER_KEY = 'bolsillo_owner', SESS_KEY = 'bolsillo_sess';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
const status = s => window.App.setSync(s);
const say = t => { const el = document.getElementById('ls'); if (el) el.textContent = t; };

let fb = null, user = null, timer = null, busy = false, again = false, firstDone = false, dirty = false;

// Aparta los datos de otro usuario antes de trabajar con la cuenta actual.
function claimLocal(uid) {
  const owner = lsGet(OWNER_KEY), raw = lsGet(KEY);
  if (owner && owner !== uid) {
    if (raw && raw.length > 2) lsSet(KEY + '__' + owner, raw); // se conserva, apartado
    window.App.resetLocal();
  }
  // Si este usuario dejó datos apartados (cerró sesión sin red), se recuperan.
  if (!lsGet(KEY)) { const mine = lsGet(KEY + '__' + uid); if (mine) { lsSet(KEY, mine); lsDel(KEY + '__' + uid); } }
  lsSet(OWNER_KEY, uid);
  window.App.dropCache();
}

async function syncNow(manual) {
  if (!fb || !user) { if (manual) status(navigator.onLine ? 'error' : 'offline'); return; }
  if (busy) { again = true; return; }
  busy = true; clearTimeout(timer); timer = null; status('syncing');
  try {
    const ref = fb.doc(fb.db, 'usuarios', user.uid);
    const snap = await fb.getDoc(ref);
    const remote = snap.exists() ? snap.data() : null;
    const local = window.App.getDoc();                 // se lee DESPUÉS de la red: incluye lo último
    const merged = remote ? Core.mergeDocs(local, remote) : local;
    if (remote && !Core.sameData(merged, local)) window.App.replaceDoc(JSON.parse(JSON.stringify(merged)));
    if (!remote || !Core.sameData(merged, remote)) {
      const out = JSON.parse(JSON.stringify(merged)); // sin undefined (Firestore los rechaza)
      delete out.month;                               // el mes visible es propio de cada dispositivo
      await fb.setDoc(ref, out);
    }
    dirty = false; status('ok');
  } catch (e) {
    console.warn('Sincronización:', e && e.message ? e.message : e);
    status(navigator.onLine ? 'error' : 'offline');
    if (/maximum allowed size|exceeds/i.test(String(e && e.message))) window.App.toastErr('Tus datos superaron el máximo de la nube y no se sincronizaron. Están a salvo en este dispositivo: descarga un respaldo desde Más.');
  } finally {
    busy = false;
    if (!firstDone) { firstDone = true; window.App.afterFirstSync(); }
    if (again) { again = false; schedule(); }
  }
}
function schedule() {
  dirty = true;
  if (!user) return;
  status(navigator.onLine ? 'pending' : 'offline');
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 2000);
}

window.Sync = {
  schedule,
  now: manual => syncNow(manual),
  async signIn() {
    const btn = document.getElementById('btn-google');
    if (!fb) { say('Sin conexión. Conéctate a internet para iniciar sesión.'); return; }
    btn.disabled = true; say('Conectando…');
    try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); say(''); }
    catch (e) { say(e && e.code === 'auth/popup-closed-by-user' ? 'Inicio de sesión cancelado.' : 'No se pudo iniciar sesión. Inténtalo de nuevo.'); }
    finally { btn.disabled = false; }
  },
  async signOut() {
    // Intenta subir lo pendiente; después aparta los datos locales del usuario.
    if (dirty) await syncNow();
    const owner = lsGet(OWNER_KEY), raw = lsGet(KEY);
    if (owner && raw) lsSet(KEY + '__' + owner, raw);
    lsDel(KEY); lsDel(SESS_KEY); lsDel(OWNER_KEY);
    window.App.resetLocal();
    const u = user; user = null; firstDone = false;
    try { if (fb && u) await fb.signOut(fb.auth); } catch (e) {}
    window.App.onUser(null); status('off');
  },
};

window.addEventListener('online', () => { if (user) syncNow(); });
window.addEventListener('offline', () => { if (user) status('offline'); });
document.addEventListener('visibilitychange', () => {
  if (!user) return;
  if (document.visibilityState === 'hidden') { if (timer) syncNow(); }   // subir lo pendiente al salir
  else syncNow();                                                         // traer cambios de otros dispositivos al volver
});

(async function init() {
  try {
    const [a, au, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
    const app = a.initializeApp(CONFIG);
    fb = { auth: au.getAuth(app), db: fs.getFirestore(app), doc: fs.doc, getDoc: fs.getDoc, setDoc: fs.setDoc, signInWithPopup: au.signInWithPopup, GoogleAuthProvider: au.GoogleAuthProvider, signOut: au.signOut };
    au.onAuthStateChanged(fb.auth, u => {
      if (u) {
        const first = !user;
        user = u;
        claimLocal(u.uid);
        lsSet(SESS_KEY, JSON.stringify({ uid: u.uid, displayName: u.displayName, email: u.email }));
        window.App.onUser({ uid: u.uid, displayName: u.displayName, email: u.email });
        if (first) syncNow();
      } else if (user || !lsGet(SESS_KEY)) {
        user = null; window.App.onUser(null); status('off');
      } else {
        // Había sesión guardada pero Firebase ya no la reconoce: se pide entrar de nuevo
        // sin borrar nada del dispositivo.
        lsDel(SESS_KEY); window.App.onUser(null); status('off');
        say('Tu sesión expiró. Vuelve a entrar para sincronizar.');
      }
    });
  } catch (e) {
    // Sin red o SDK no disponible: la app sigue en modo local.
    status('offline');
    if (!lsGet(SESS_KEY)) say('Sin conexión. Conéctate a internet para iniciar sesión.');
    if (!firstDone) { firstDone = true; window.App.afterFirstSync(); }
  }
})();
