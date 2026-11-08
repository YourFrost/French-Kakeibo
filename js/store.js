// Stockage local (localStorage) — toutes les données restent sur l'appareil.
const KEY = 'kakeibo.v1';
const blank = () => ({ onboarded: false, incomes: [], fixed: [], budgets: [], goals: [], expenses: [] });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw ? { ...blank(), ...raw } : blank();
  } catch { return blank(); }
}

let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible */ } };

export const get = () => state;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export function update(fn) { fn(state); save(); }
export function replace(next) { state = { ...blank(), ...next }; save(); }
export const reset = () => replace(blank());
export const exportJSON = () => JSON.stringify(state, null, 2);
