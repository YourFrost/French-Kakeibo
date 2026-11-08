// Toute la logique de calcul du budget (sans accès DOM).
export const TYPES = {
  besoin:  { label: 'Besoin',  hint: 'Indispensable',   color: 'var(--besoin)' },
  plaisir: { label: 'Plaisir', hint: 'Envie, loisir',   color: 'var(--plaisir)' },
  imprevu: { label: 'Imprévu', hint: 'Urgence, surprise', color: 'var(--imprevu)' },
};
export const TYPE_KEYS = Object.keys(TYPES);

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
  const fixed = sum(st.fixed, i => i.amount);
  const savings = sum(st.goals, g => goalMonthly(g, now));
  const budget = income - fixed - savings;      // budget "variable" du mois
  const spent = sum(TYPE_KEYS, t => byType[t]);
  const remaining = budget - spent;
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

  return { y, m, items, byType, income, fixed, savings, budget, spent, remaining, dim, day, daysLeft, perDay, expected, isCurrent, isPast, daily, cumulative };
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
  return evs.sort((a, b) => a.date - b.date).slice(0, limit);
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
  return out;
}
