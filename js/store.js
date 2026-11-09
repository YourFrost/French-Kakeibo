// Stockage local — toutes les données restent sur l'appareil.
// Double écriture : localStorage (lecture synchrone rapide) + IndexedDB (copie de secours).
const KEY = 'kakeibo.v1';
const blank = () => ({
  onboarded: false, name: '', startDay: 1,
  incomes: [], fixed: [], budgets: [], goals: [], expenses: [],
  snapshots: {},  // situation figée par mois (revenus, charges, budgets, épargne)
  closures: {},   // fin de mois : affectation du budget restant
  reminder: { on: false, time: '20:00', skip: '' },
  lastBackup: '', backupSnooze: '',
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw ? { ...blank(), ...raw } : blank();
  } catch { return blank(); }
}

let state = load();

/* --- IndexedDB (copie de secours) --- */
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('kakeibo', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function idbSet(v) {
  try { const db = await openDB(); db.transaction('kv', 'readwrite').objectStore('kv').put(JSON.parse(JSON.stringify(v)), 'state'); } catch { /* indisponible */ }
}
async function idbGet() {
  try {
    const db = await openDB();
    return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  } catch { return null; }
}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible */ }
  idbSet(state);
};

/** À appeler au démarrage : demande un stockage persistant et restaure la copie de secours si besoin. */
export async function init() {
  try { await navigator.storage?.persist?.(); } catch { /* non supporté */ }
  if (!localStorage.getItem(KEY)) {
    const backup = await idbGet();
    if (backup && backup.onboarded) { state = { ...blank(), ...backup }; save(); return 'restored'; }
  }
  idbSet(state);
  return null;
}
export const isPersisted = async () => { try { return (await navigator.storage?.persisted?.()) ?? false; } catch { return false; } };

export const get = () => state;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export function update(fn) { fn(state); save(); }
export function replace(next) { state = { ...blank(), ...next }; save(); }
export const reset = () => replace(blank());
export const exportJSON = () => JSON.stringify(state, null, 2);
