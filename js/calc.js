// Toute la logique de calcul du budget (sans accès DOM).
export const TYPES = {
  besoin:  { label: 'Besoin',  hint: 'Indispensable',   color: 'var(--besoin)' },
  plaisir: { label: 'Plaisir', hint: 'Envie, loisir',   color: 'var(--plaisir)' },
  imprevu: { label: 'Imprévu', hint: 'Urgence, surprise', color: 'var(--imprevu)' },
};
export const TYPE_KEYS = Object.keys(TYPES);

export const FIXED_CATS = {
  indispensable: { label: 'Indispensable', color: 'var(--besoin)' },
  loisirs:       { label: 'Loisirs',       color: 'var(--plaisir)' },
  temporaire:    { label: 'Temporaire',    color: 'var(--imprevu)' },
};
export const PLAISIR_CATS = [
  { key: 'sorties', label: 'Sorties & restos' }, { key: 'shopping', label: 'Shopping' },
  { key: 'culture', label: 'Culture & loisirs' }, { key: 'sport', label: 'Sport & bien-être' },
  { key: 'moto', label: 'Moto & auto' }, { key: 'tech', label: 'High-tech & jeux' },
  { key: 'voyage', label: 'Voyages' }, { key: 'cadeaux', label: 'Cadeaux' }, { key: 'autre', label: 'Autre' },
];
export const catLabel = k => (PLAISIR_CATS.find(c => c.key === k) || { label: 'Autre' }).label;

/** Catalogue de charges courantes : { label, cat } → pré-remplit le formulaire. */
const I = 'indispensable', L = 'loisirs', T = 'temporaire';
export const FIXED_PRESETS = [
  { name: 'Divertissement', items: [['Netflix', L], ['Spotify', L], ['Disney+', L], ['Prime Video', L], ['Canal+', L], ['YouTube Premium', L], ['Abonnement jeux vidéo', L], ['Presse / magazine', L]] },
  { name: 'Activité', items: [['Salle de sport', L], ['Club de sport', L], ['Cours (musique, danse…)', L], ['Piscine', L], ['Activité enfants', L]] },
  { name: 'Logement', items: [['Loyer', I], ['Électricité', I], ['Gaz', I], ['Eau', I], ['Box internet', I], ['Assurance habitation', I], ['Charges de copropriété', I]] },
  { name: 'Transport', items: [['Assurance moto', I], ['Assurance auto', I], ['Abonnement transports', I], ['Crédit auto / moto', T], ['Parking / garage', I]] },
  { name: 'Numérique', items: [['Forfait mobile', I], ['Stockage cloud', L], ['Logiciel / application', L], ['Box repas / coffret', L]] },
  { name: 'Santé', items: [['Mutuelle', I], ['Assurance prévoyance', I], ['Abonnement bien-être', L]] },
  { name: 'Finances', items: [['Crédit conso', T], ['Remboursement de dette', T], ['Frais bancaires', I], ['Impôts', I], ['Don / association', L]] },
  { name: 'Famille', items: [['Garde d’enfants', I], ['Cantine / école', I], ['Pension alimentaire', I], ['Argent de poche', L]] },
].map(g => ({ name: g.name, items: g.items.map(([label, cat]) => ({ label, cat })) }));
export const BUDGET_IDEAS = ['Courses', 'Transport', 'Carburant', 'Restaurants', 'Moto', 'Santé', 'Vêtements', 'Sorties', 'Cadeaux', 'Animaux'];

export const fmtMonth = ym => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(parseISO(ym + '-01'));
/** Charges fixes actives pour le mois `key` (YYYY-MM) : une charge temporaire s'arrête après son dernier mois. */
export const activeFixed = (st, key) => st.fixed.filter(f => !f.until || f.until >= key);

const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysIn = (y, m) => new Date(y, m + 1, 0).getDate(); // m : 0-11
export const parseAmount = s => {
  const n = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const nf0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur = n => {
  const r = Math.round((n + Number.EPSILON) * 100) / 100 || 0;
  return Number.isInteger(r) ? nf0.format(r) : nf2.format(r);
};
export const pct = n => `${Math.round(n * 100)} %`;

/** Mois restants jusqu'à l'échéance (mois courant inclus, minimum 1). */
export function monthsLeft(deadline, now) {
  const [y, m] = deadline.split('-').map(Number);
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()) + 1);
}

/** Montant à mettre de côté chaque mois pour un objectif. */
export function goalMonthly(g, now) {
  const rest = Math.max(0, g.target - (g.saved || 0));
  if (!rest) return 0;
  return g.deadline ? rest / monthsLeft(g.deadline, now) : (g.monthly || 0);
}

const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);

/** Synthèse d'un mois (y, m 0-11). */
export function summary(st, y, m, now = new Date()) {
  const key = `${y}-${pad(m + 1)}`;
  const items = st.expenses.filter(e => e.date.startsWith(key));
  const byType = Object.fromEntries(TYPE_KEYS.map(t => [t, sum(items.filter(e => e.type === t), e => e.amount)]));
  const income = sum(st.incomes, i => i.amount);
  const fixedItems = activeFixed(st, key);
  const fixed = sum(fixedItems, i => i.amount);
  const fixedByCat = Object.fromEntries(Object.keys(FIXED_CATS).map(c => [c, sum(fixedItems.filter(f => (f.cat || 'indispensable') === c), f => f.amount)]));
  const plaisirByCat = {};
  // Plaisirs regroupés par budget choisi (ancienne catégorie conservée pour les anciennes saisies).
  const budgetName = id => (st.budgets || []).find(b => b.id === id)?.label;
  items.forEach(e => {
    if (e.type !== 'plaisir') return;
    const c = budgetName(e.budget) || (e.cat ? catLabel(e.cat) : 'Sans budget');
    plaisirByCat[c] = (plaisirByCat[c] || 0) + e.amount;
  });
  const budgets = (st.budgets || []).map(b => ({ ...b, spent: sum(items.filter(e => e.budget === b.id), e => e.amount) }));
  const savings = sum(st.goals, g => goalMonthly(g, now));
  const budget = income - fixed - savings;      // budget "variable" du mois
  const spent = sum(TYPE_KEYS, t => byType[t]);
  const remaining = budget - spent;
  const reserved = budgets.reduce((t, b) => t + Math.max(0, b.amount - b.spent), 0); // part des budgets pas encore consommée
  const free = remaining - reserved;
  const dim = daysIn(y, m);
  const isCurrent = now.getFullYear() === y && now.getMonth() === m;
  const isPast = y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth());
  const day = isCurrent ? now.getDate() : isPast ? dim : 0;
  const daysLeft = isCurrent ? dim - day + 1 : 0;
  const perDay = daysLeft && remaining > 0 ? remaining / daysLeft : 0;
  const expected = budget > 0 ? (budget * day) / dim : 0;

  const daily = Array.from({ length: dim }, () => ({ besoin: 0, plaisir: 0, imprevu: 0 }));
  items.forEach(e => { daily[parseISO(e.date).getDate() - 1][e.type] += e.amount; });
  let acc = 0;
  const cumulative = daily.map(d => (acc += d.besoin + d.plaisir + d.imprevu));

  return { y, m, items, byType, fixedByCat, plaisirByCat, budgets, reserved, free, income, fixed, savings, budget, spent, remaining, dim, day, daysLeft, perDay, expected, isCurrent, isPast, daily, cumulative };
}

/** Prochains événements (prélèvements / rentrées) sur ~30 jours. */
export function upcoming(st, now = new Date(), limit = 6) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = it => {
    let d = new Date(today.getFullYear(), today.getMonth(), Math.min(it.day, daysIn(today.getFullYear(), today.getMonth())));
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(it.day, daysIn(today.getFullYear(), today.getMonth() + 1)));
    return d;
  };
  const evs = [
    ...st.fixed.filter(f => f.day).map(f => ({ kind: 'fixed', ...f })),
    ...st.incomes.filter(f => f.day).map(f => ({ kind: 'income', ...f })),
  ].map(e => { const date = next(e); return { ...e, date, inDays: Math.round((date - today) / 864e5) }; });
  return evs.filter(e => e.kind !== 'fixed' || !e.until || e.until >= `${e.date.getFullYear()}-${pad(e.date.getMonth() + 1)}`).sort((a, b) => a.date - b.date).slice(0, limit);
}

/** Notes et conseils — { tone: good | warn | info, text }. */
export function insights(st, s) {
  const out = [];
  const add = (tone, text) => out.push({ tone, text });
  if (!s.income) return [{ tone: 'info', text: 'Ajoute au moins une rentrée d’argent pour obtenir des conseils personnalisés.' }];

  if (s.budget < 0) {
    add('warn', `Tes charges fixes et tes objectifs dépassent tes revenus de ${eur(-s.budget)}. Allonge les délais de tes objectifs ou réduis une charge.`);
  } else {
    add('info', `Une fois les charges et l’épargne prévues, il te reste ${eur(s.budget)} par mois à dépenser, soit environ ${eur(s.budget / s.dim)} par jour.`);
  }
  const fixedShare = s.fixed / s.income;
  if (fixedShare > 0.5) add('warn', `Tes charges fixes pèsent ${pct(fixedShare)} de tes revenus. Le repère classique est 50 % maximum.`);
  else if (s.fixed > 0) add('good', `Tes charges fixes ne représentent que ${pct(fixedShare)} de tes revenus : bonne marge de manœuvre.`);

  const saveRate = s.savings / s.income;
  if (st.goals.length && saveRate >= 0.2) add('good', `Tu mets ${pct(saveRate)} de ton revenu de côté : au-dessus du repère des 20 %. Bravo !`);
  else if (st.goals.length && saveRate > 0) add('info', `Tu épargnes ${pct(saveRate)} de ton revenu. Viser 20 % est un bon cap quand c’est possible.`);
  if (!st.goals.length) add('info', 'Définis un objectif d’épargne pour donner un but concret à ton budget.');

  for (const g of st.goals) {
    if (g.saved >= g.target) add('good', `Objectif « ${g.label} » atteint ! 🎉`);
    else if (g.deadline && monthsLeft(g.deadline, new Date()) <= 2) add('warn', `« ${g.label} » arrive à échéance : il reste ${eur(g.target - g.saved)} à mettre de côté.`);
  }

  if (s.budget > 0) {
    if (s.remaining < 0) add('warn', `Tu as dépassé ton budget du mois de ${eur(-s.remaining)}. Garde seulement les besoins jusqu’à la fin du mois.`);
    else if (s.isCurrent && s.spent > 0) {
      if (s.spent > s.expected * 1.1) add('warn', `Tu dépenses plus vite que prévu : ${eur(s.spent - s.expected)} au-dessus du rythme idéal. Il te reste ${eur(s.perDay)} par jour.`);
      else add('good', `Tu es dans les clous : ${eur(Math.max(0, s.expected - s.spent))} sous le rythme idéal du mois.`);
    }
    if (s.spent > 0 && s.byType.plaisir / s.spent > 0.4) add('warn', `Les plaisirs représentent ${pct(s.byType.plaisir / s.spent)} de tes dépenses du mois. Pas de culpabilité, mais garde un œil dessus.`);
    if (s.byType.imprevu > 0) add('info', `${eur(s.byType.imprevu)} d’imprévus ce mois-ci. Un matelas de sécurité t’évite de puiser dans tes objectifs.`);
  }
  for (const b of s.budgets) {
    const r = b.spent / b.amount;
    if (r > 1) add('warn', `Budget « ${b.label} » dépassé de ${eur(b.spent - b.amount)}.`);
    else if (r >= 0.8 && s.isCurrent) add('warn', `Budget « ${b.label} » consommé à ${pct(r)} : il te reste ${eur(b.amount - b.spent)}.`);
  }
  const bsum = sum(s.budgets, b => b.amount);
  if (s.budget > 0 && bsum > s.budget) add('warn', `Tes budgets cumulés (${eur(bsum)}) dépassent ce que tu peux dépenser (${eur(s.budget)}). Revois-les à la baisse.`);
  const topCat = Object.entries(s.plaisirByCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat) add('info', `Ton premier poste de plaisir : ${topCat[0]} (${eur(topCat[1])}, soit ${pct(topCat[1] / s.byType.plaisir)} de tes plaisirs).`);
  if (s.fixedByCat.loisirs > 0) add('info', `Tes abonnements et activités de loisirs coûtent ${eur(s.fixedByCat.loisirs)} par mois, soit ${eur(s.fixedByCat.loisirs * 12)} par an.`);
  const curKey = iso(new Date()).slice(0, 7);
  const ending = st.fixed.filter(f => f.until && f.until >= curKey).sort((a, b) => a.until.localeCompare(b.until))[0];
  if (ending) add('info', `Dès la fin de « ${ending.label} » (${fmtMonth(ending.until)}), tu récupères ${eur(ending.amount)} par mois.`);
  const ORDER = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}
