import * as S from './store.js';
import { TYPES, TYPE_KEYS, eur, iso, parseISO, summary, upcoming, insights, goalMonthly, monthsLeft } from './calc.js';
import { ring, stackBar, bars, line, legend, kick } from './charts.js';
import { openSheet, esc, toast } from './ui.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const now = () => new Date();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const ui = { tab: 'home', step: 0, filter: 'all', ym: { y: now().getFullYear(), m: now().getMonth() }, lastId: null };

/* ---------- Icônes ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  home: P('<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z"/>'),
  journal: P('<path d="M8 6h11M8 12h11M8 18h11"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/>'),
  bilan: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  goals: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  left: P('<path d="m15 6-6 6 6 6"/>'),
  right: P('<path d="m9 6 6 6-6 6"/>'),
  income: P('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  fixed: P('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>'),
  goal: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
  check: P('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
};

/* ---------- Définition des éléments éditables ---------- */
const KINDS = {
  income: {
    list: 'incomes', name: 'Rentrée d’argent',
    fields: it => [
      { name: 'label', label: 'Intitulé', value: it?.label, placeholder: 'Salaire', suggestions: ['Salaire', 'Prime', 'Aide (CAF)', 'Revenu complémentaire'] },
      { name: 'amount', label: 'Montant mensuel net', type: 'money', value: it?.amount },
      { name: 'day', label: 'Jour de versement', type: 'day', optional: true, value: it?.day, placeholder: 'ex. 28' },
    ],
  },
  fixed: {
    list: 'fixed', name: 'Dépense fixe',
    fields: it => [
      { name: 'label', label: 'Intitulé', value: it?.label, placeholder: 'Loyer', suggestions: ['Loyer', 'Électricité', 'Internet', 'Téléphone', 'Assurance', 'Transport', 'Abonnements', 'Crédit'] },
      { name: 'amount', label: 'Montant mensuel', type: 'money', value: it?.amount },
      { name: 'day', label: 'Jour de prélèvement', type: 'day', optional: true, value: it?.day, placeholder: 'ex. 5' },
    ],
  },
  goal: {
    list: 'goals', name: 'Objectif d’épargne',
    fields: it => [
      { name: 'label', label: 'De quoi s’agit-il ?', value: it?.label, placeholder: 'Vacances', suggestions: ['Vacances', 'Fonds d’urgence', 'Voyage', 'Projet', 'Achat plaisir'] },
      { name: 'target', label: 'Montant à atteindre', type: 'money', value: it?.target },
      { name: 'saved', label: 'Déjà épargné', type: 'money', optional: true, value: it?.saved },
      { name: 'deadline', label: 'Échéance', type: 'month', optional: true, value: it?.deadline, half: true },
      { name: 'monthly', label: 'Ou versement / mois', type: 'money', optional: true, value: it?.monthly, half: true, help: 'Sans échéance, indique combien tu veux verser chaque mois.' },
    ],
  },
};

function openItem(kind, id) {
  const k = KINDS[kind];
  const arr = S.get()[k.list];
  const it = id ? arr.find(x => x.id === id) : null;
  openSheet({
    title: id ? `Modifier` : `Ajouter · ${k.name}`,
    fields: k.fields(it),
    onSubmit: v => {
      if (kind === 'goal') v.saved = v.saved || 0;
      S.update(st => {
        if (it) Object.assign(st[k.list].find(x => x.id === id), v);
        else { const n = { id: S.uid(), ...v }; ui.lastId = n.id; st[k.list].push(n); }
      });
      render({ soft: true });
    },
    onDelete: it ? () => { S.update(st => { st[k.list] = st[k.list].filter(x => x.id !== id); }); render({ soft: true }); } : null,
  });
}

function openExpense(id) {
  const st = S.get();
  const e = id ? st.expenses.find(x => x.id === id) : null;
  const labels = [...new Set(st.expenses.slice(-60).map(x => x.label).filter(Boolean))];
  openSheet({
    title: e ? 'Modifier la dépense' : 'Nouvelle dépense',
    noEnter: true,
    fields: [
      { name: 'amount', type: 'money', value: e?.amount },
      { name: 'label', label: 'Note', optional: true, value: e?.label, placeholder: 'Courses, café, essence…', half: true, list: labels },
      { name: 'date', label: 'Date', type: 'date', value: e?.date || iso(now()), half: true },
    ],
    submitters: TYPE_KEYS.map(t => ({ value: t, label: TYPES[t].label, hint: TYPES[t].hint, cls: 'type' + (e?.type === t ? ' current' : ''), color: TYPES[t].color })),
    onSubmit: (v, type) => {
      const data = { amount: v.amount, label: v.label, date: v.date || iso(now()), type };
      S.update(s => {
        if (e) Object.assign(s.expenses.find(x => x.id === id), data);
        else { const n = { id: S.uid(), ...data }; ui.lastId = n.id; s.expenses.push(n); }
      });
      const ym = parseISO(data.date);
      ui.ym = { y: ym.getFullYear(), m: ym.getMonth() };
      render({ soft: true });
      toast(`${eur(data.amount)} · ${TYPES[type].label} ajouté`);
    },
    onDelete: e ? () => { S.update(s => { s.expenses = s.expenses.filter(x => x.id !== id); }); render({ soft: true }); toast('Dépense supprimée'); } : null,
  });
}

function openContribute(id) {
  const g = S.get().goals.find(x => x.id === id);
  openSheet({
    title: `Verser sur « ${esc(g.label)} »`,
    message: `Déjà ${eur(g.saved || 0)} sur ${eur(g.target)}.`,
    fields: [{ name: 'amount', type: 'money' }],
    submitLabel: 'Ajouter à l’épargne',
    onSubmit: v => {
      S.update(st => { st.goals.find(x => x.id === id).saved = (g.saved || 0) + v.amount; });
      render({ soft: true });
      toast(g.saved + v.amount >= g.target ? 'Objectif atteint ! 🎉' : `${eur(v.amount)} mis de côté`);
    },
  });
}

/* ---------- Helpers de vue ---------- */
const monthName = ({ y, m }) => cap(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)));
const sumView = () => summary(S.get(), ui.ym.y, ui.ym.m, now());
function dayLabel(s) {
  const t = iso(now()), y = iso(new Date(Date.now() - 864e5));
  if (s === t) return 'Aujourd’hui';
  if (s === y) return 'Hier';
  return cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(s)));
}
const dueLabel = n => n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : `Dans ${n} j`;

function itemRow(kind, it) {
  let sub, amt = it.amount;
  if (kind === 'goal') {
    amt = it.target;
    const m = goalMonthly(it, now());
    sub = it.deadline
      ? `D’ici ${cap(new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(parseISO(it.deadline + '-01')))} · ${eur(m)}/mois`
      : it.monthly ? `${eur(it.monthly)}/mois` : 'Sans échéance';
  } else sub = it.day ? `Le ${it.day} de chaque mois` : 'Chaque mois';
  return `<button class="row${ui.lastId === it.id ? ' pop' : ''}" data-act="edit-item" data-kind="${kind}" data-id="${it.id}">
    <span class="ico ${kind}">${ICON[kind]}</span><span class="grow"><b>${esc(it.label)}</b><small>${sub}</small></span><span class="amt">${eur(amt)}</span></button>`;
}
function listBlock(kind, title, items, empty) {
  return `<section class="card"><div class="card-h"><h3>${title}</h3><button class="link" data-act="add-item" data-kind="${kind}">+ Ajouter</button></div>
    ${items.length ? `<div class="rows">${items.map(i => itemRow(kind, i)).join('')}</div>` : `<p class="empty-s">${empty}</p>`}</section>`;
}
function notes(list) {
  return `<div class="notes">${list.map(n => `<div class="note ${n.tone}"><i></i><p>${n.text}</p></div>`).join('')}</div>`;
}
function ringParts(s) {
  if (s.budget <= 0) return { parts: [{ v: s.spent > 0 ? 1 : 0 }], over: true };
  const over = s.remaining < 0;
  const scale = over ? 1 / (s.spent / s.budget) : 1;
  return { over, parts: TYPE_KEYS.map(t => ({ v: s.byType[t] / s.budget * scale, color: TYPES[t].color })) };
}
const monthNav = () => {
  const cur = ui.ym.y === now().getFullYear() && ui.ym.m === now().getMonth();
  return `<div class="monthnav"><button data-act="month" data-d="-1" aria-label="Mois précédent">${ICON.left}</button><b>${monthName(ui.ym)}</b>
    <button data-act="month" data-d="1" aria-label="Mois suivant" ${cur ? 'disabled' : ''}>${ICON.right}</button></div>`;
};

/* ---------- Onboarding ---------- */
function onboarding() {
  const st = S.get();
  const dots = `<div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i === ui.step ? 'on' : i < ui.step ? 'done' : ''}"></i>`).join('')}</div>`;
  const back = ui.step > 0 ? `<button class="back" data-act="ob-back" aria-label="Retour">${ICON.left}</button>` : '<span></span>';
  const head = `<div class="ob-top">${back}${dots}<span></span></div>`;
  const next = (label, disabled) => `<div class="ob-foot"><button class="btn primary" data-act="ob-next" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
  let body;
  if (ui.step === 0) {
    return `<div class="page ob welcome stagger">
      <div class="hero-logo">${ring([{ v: .42, color: 'var(--besoin)' }, { v: .33, color: 'var(--plaisir)' }, { v: .17, color: 'var(--imprevu)' }], { size: 150, stroke: 16 })}</div>
      <h1>Kakeibo</h1>
      <p class="lead">L’art japonais de tenir ses comptes, simplement. Chaque euro dépensé est un <b>besoin</b>, un <b>plaisir</b> ou un <b>imprévu</b>.</p>
      <ul class="pitch"><li><i style="background:var(--besoin)"></i>Dis-nous d’où vient ton argent</li><li><i style="background:var(--plaisir)"></i>Où il part chaque mois</li><li><i style="background:var(--imprevu)"></i>Et ce que tu veux construire</li></ul>
      <div class="ob-foot"><button class="btn primary" data-act="ob-next">Commencer</button><small>Tes données restent sur ton téléphone.</small></div></div>`;
  }
  if (ui.step === 1) body = `<h1>Tes rentrées</h1><p class="lead">Salaire et autres revenus nets reçus chaque mois.</p>${listBlock('income', 'Rentrées d’argent', st.incomes, 'Ajoute ton salaire pour commencer.')}${next('Continuer', !st.incomes.length)}`;
  if (ui.step === 2) body = `<h1>Tes dépenses fixes</h1><p class="lead">Loyer, abonnements, assurances… avec leur date de prélèvement.</p>${listBlock('fixed', 'Dépenses fixes', st.fixed, 'Rien pour l’instant — tu peux passer cette étape.')}${next(st.fixed.length ? 'Continuer' : 'Passer')}`;
  if (ui.step === 3) body = `<h1>Tes objectifs</h1><p class="lead">Qu’est-ce que tu veux t’offrir plus tard ? Avec ou sans délai.</p>${listBlock('goal', 'Objectifs d’épargne', st.goals, 'Vacances, fonds d’urgence, projet… ajoute-en un.')}${next(st.goals.length ? 'Voir mon budget' : 'Voir mon budget sans objectif')}`;
  if (ui.step === 4) {
    const s = summary(st, now().getFullYear(), now().getMonth(), now());
    body = `<h1>Ton budget</h1><p class="lead">Voici la situation calculée pour ton mois.</p>
      <section class="card hero-sum"><small>Reste à vivre / mois</small><div class="big ${s.budget < 0 ? 'neg' : ''}" data-count="${s.budget}">${eur(0)}</div>
      <p class="sub">soit environ <b>${eur(Math.max(0, s.budget) / s.dim)}</b> par jour</p>
      ${stackBar([{ v: s.fixed, color: 'var(--fixed)' }, { v: s.savings, color: 'var(--save)' }, { v: Math.max(0, s.budget), color: 'var(--accent)' }])}
      <ul class="legend flat"><li><i style="background:var(--fixed)"></i><span>Charges fixes</span><b>${eur(s.fixed)}</b></li><li><i style="background:var(--save)"></i><span>Épargne</span><b>${eur(s.savings)}</b></li><li><i style="background:var(--accent)"></i><span>À dépenser</span><b>${eur(Math.max(0, s.budget))}</b></li></ul></section>
      <section class="card"><div class="card-h"><h3>Notes</h3></div>${notes(insights(st, s).slice(0, 4))}</section>
      <div class="ob-foot"><button class="btn primary" data-act="ob-finish">Lancer mon Kakeibo</button></div>`;
  }
  return `<div class="page ob stagger">${head}${body}</div>`;
}

/* ---------- Accueil ---------- */
function home() {
  const st = S.get(), t = now();
  const s = summary(st, t.getFullYear(), t.getMonth(), t);
  const { parts, over } = ringParts(s);
  const up = upcoming(st, t, 5);
  const date = cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(t));
  return `<div class="page stagger">
    <header class="top"><div><small>${date}</small><h1>Bonjour 👋</h1></div><button class="icon-btn" data-act="tab" data-v="settings" aria-label="Réglages">${ICON.gear}</button></header>
    <section class="card hero">
      ${ring(parts, { over, size: 232, stroke: 15, children: `<small>${s.remaining < 0 ? 'Dépassement' : 'Reste ce mois'}</small><div class="big ${s.remaining < 0 ? 'neg' : ''}" data-count="${Math.abs(s.remaining)}">${eur(0)}</div><small>sur ${eur(Math.max(0, s.budget))}</small>` })}
      <p class="pace">${s.remaining > 0 ? `Tu peux dépenser <b>${eur(s.perDay)}</b> par jour · ${s.daysLeft} j restants` : s.budget <= 0 ? 'Revois tes charges ou tes objectifs dans les réglages.' : 'Budget du mois épuisé — seulement l’essentiel !'}</p>
    </section>
    <section class="types">${TYPE_KEYS.map(k => `<div class="tcard" style="--c:${TYPES[k].color}"><i></i><small>${TYPES[k].label}</small><b data-count="${s.byType[k]}">${eur(0)}</b></div>`).join('')}</section>
    ${up.length ? `<section class="card"><div class="card-h"><h3>À venir</h3></div><div class="rows">${up.map(e => `<div class="row static"><span class="ico ${e.kind}">${ICON[e.kind]}</span><span class="grow"><b>${esc(e.label)}</b><small>${dueLabel(e.inDays)}</small></span><span class="amt ${e.kind === 'income' ? 'plus' : ''}">${e.kind === 'income' ? '+' : '−'}${eur(e.amount)}</span></div>`).join('')}</div></section>` : ''}
    <section class="card"><div class="card-h"><h3>Notes du moment</h3></div>${notes(insights(st, s).slice(0, 3))}</section>
  </div>`;
}

/* ---------- Journal ---------- */
function journal() {
  const s = sumView();
  const f = ui.filter;
  const items = s.items.filter(e => f === 'all' || e.type === f).sort((a, b) => b.date.localeCompare(a.date) || 0);
  const groups = {};
  items.slice().reverse().sort((a, b) => b.date.localeCompare(a.date)).forEach(e => (groups[e.date] ||= []).push(e));
  const chips = [['all', 'Tout'], ...TYPE_KEYS.map(k => [k, TYPES[k].label])].map(([k, l]) => `<button class="chip${f === k ? ' on' : ''}" ${k !== 'all' ? `style="--c:${TYPES[k].color}"` : ''} data-act="filter" data-v="${k}">${l}</button>`).join('');
  return `<div class="page stagger">
    <header class="top"><h1>Journal</h1></header>${monthNav()}
    <section class="card total"><small>Dépensé ce mois</small><div class="big" data-count="${s.spent}">${eur(0)}</div>
      ${stackBar(TYPE_KEYS.map(k => ({ v: s.byType[k], color: TYPES[k].color })))}</section>
    <div class="chips">${chips}</div>
    ${items.length ? Object.entries(groups).map(([d, list]) => `<section class="day"><h4><span>${dayLabel(d)}</span><span>${eur(list.reduce((t, e) => t + e.amount, 0))}</span></h4>
      <div class="rows card">${list.map(e => `<button class="row${ui.lastId === e.id ? ' pop' : ''}" data-act="edit-expense" data-id="${e.id}">
        <span class="dot" style="background:${TYPES[e.type].color}"></span><span class="grow"><b>${esc(e.label || TYPES[e.type].label)}</b><small>${TYPES[e.type].label}</small></span><span class="amt">−${eur(e.amount)}</span></button>`).join('')}</div></section>`).join('')
      : `<div class="empty"><div class="bubble">${ICON.journal}</div><p>Aucune dépense ${f === 'all' ? 'ce mois-ci' : 'dans cette catégorie'}.</p><small>Appuie sur + pour noter la première.</small></div>`}
  </div>`;
}

/* ---------- Bilan ---------- */
function bilan() {
  const st = S.get(), s = sumView();
  const tot = s.spent;
  const qs = [
    ['Combien ai-je d’argent ?', eur(s.income)],
    ['Combien je veux en épargner ?', eur(s.savings)],
    ['Combien ai-je dépensé ?', eur(s.spent + s.fixed)],
  ];
  const top = TYPE_KEYS.slice().sort((a, b) => s.byType[b] - s.byType[a])[0];
  const advice = !tot ? 'Note tes dépenses au fil de l’eau pour voir apparaître tes habitudes.'
    : s.remaining < 0 ? `Tu as dépassé ton budget de ${eur(-s.remaining)}. Le poste le plus lourd : ${TYPES[top].label.toLowerCase()} (${eur(s.byType[top])}). Fixe-toi un plafond pour le mois prochain.`
    : `Ton poste principal : ${TYPES[top].label.toLowerCase()} (${eur(s.byType[top])}). ${top === 'plaisir' ? 'Choisis les plaisirs qui comptent vraiment.' : top === 'imprevu' ? 'Alimente un fonds d’urgence pour amortir les surprises.' : 'Cherche si un besoin peut être optimisé.'}`;
  return `<div class="page stagger">
    <header class="top"><h1>Bilan</h1></header>${monthNav()}
    <section class="card"><div class="card-h"><h3>Répartition de ton revenu</h3></div>
      ${stackBar([{ v: s.fixed, color: 'var(--fixed)' }, { v: s.savings, color: 'var(--save)' }, { v: Math.max(0, s.budget), color: 'var(--accent)' }])}
      <ul class="legend flat"><li><i style="background:var(--fixed)"></i><span>Charges fixes</span><b>${eur(s.fixed)}</b></li><li><i style="background:var(--save)"></i><span>Épargne</span><b>${eur(s.savings)}</b></li><li><i style="background:var(--accent)"></i><span>À dépenser</span><b>${eur(Math.max(0, s.budget))}</b></li></ul></section>
    <section class="card"><div class="card-h"><h3>Où part ton argent</h3></div>
      ${tot ? `<div class="donut-row">${ring(TYPE_KEYS.map(k => ({ v: s.byType[k] / tot, color: TYPES[k].color })), { size: 150, stroke: 18, children: `<small>Total</small><b class="mid" data-count="${tot}">${eur(0)}</b>` })}${legend(s.byType, tot)}</div>` : '<p class="empty-s">Pas encore de dépenses ce mois-ci.</p>'}</section>
    ${tot && s.budget > 0 ? `<section class="card"><div class="card-h"><h3>Rythme du mois</h3><span class="key"><i class="k1"></i>Réel <i class="k2"></i>Idéal</span></div>${line(s.cumulative, s.budget, Math.max(1, s.day))}</section>` : ''}
    ${tot ? `<section class="card"><div class="card-h"><h3>Jour par jour</h3></div>${bars(s.daily)}</section>` : ''}
    <section class="card"><div class="card-h"><h3>Notes</h3></div>${notes(insights(st, s).slice(0, 5))}</section>
    <section class="card kk"><div class="card-h"><h3>Les 4 questions du Kakeibo</h3></div>
      ${qs.map(([q, a]) => `<div class="q"><span>${q}</span><b>${a}</b></div>`).join('')}
      <div class="q last"><span>Comment puis-je m’améliorer ?</span><p>${advice}</p></div></section>
  </div>`;
}

/* ---------- Objectifs ---------- */
function goals() {
  const st = S.get(), t = now();
  const total = st.goals.reduce((a, g) => a + goalMonthly(g, t), 0);
  return `<div class="page stagger">
    <header class="top"><h1>Objectifs</h1><button class="icon-btn" data-act="add-item" data-kind="goal" aria-label="Ajouter">${ICON.plus}</button></header>
    ${st.goals.length ? `<p class="lead tight">À mettre de côté ce mois-ci : <b>${eur(total)}</b></p>` : ''}
    ${st.goals.map(g => {
      const p = Math.min(1, (g.saved || 0) / g.target), done = p >= 1, m = goalMonthly(g, t);
      return `<section class="card goal${done ? ' done' : ''}">
        <div class="goal-h"><div><h3>${esc(g.label)}</h3><small>${done ? 'Objectif atteint 🎉' : g.deadline ? `${monthsLeft(g.deadline, t)} mois restants · ${eur(m)}/mois` : g.monthly ? `${eur(g.monthly)}/mois · sans échéance` : 'Sans échéance'}</small></div><b class="pctn">${Math.round(p * 100)} %</b></div>
        <div class="pbar"><i data-p="${(p * 100).toFixed(1)}%"></i></div>
        <div class="goal-f"><span><b>${eur(g.saved || 0)}</b> / ${eur(g.target)}</span>
          <span><button class="link" data-act="edit-item" data-kind="goal" data-id="${g.id}">Modifier</button>${done ? '' : `<button class="mini" data-act="contribute" data-id="${g.id}">+ Verser</button>`}</span></div></section>`;
    }).join('') || `<div class="empty"><div class="bubble">${ICON.goals}</div><p>Aucun objectif pour l’instant.</p><button class="btn primary sm" data-act="add-item" data-kind="goal">Créer un objectif</button></div>`}
  </div>`;
}

/* ---------- Réglages ---------- */
function settings() {
  const st = S.get();
  return `<div class="page stagger">
    <header class="top"><button class="back" data-act="tab" data-v="home" aria-label="Retour">${ICON.left}</button><h1>Réglages</h1><span></span></header>
    <p class="lead tight">Ta situation. Les calculs se mettent à jour automatiquement.</p>
    ${listBlock('income', 'Rentrées d’argent', st.incomes, 'Aucune rentrée.')}
    ${listBlock('fixed', 'Dépenses fixes', st.fixed, 'Aucune dépense fixe.')}
    ${listBlock('goal', 'Objectifs', st.goals, 'Aucun objectif.')}
    <section class="card"><div class="card-h"><h3>Données</h3></div>
      <div class="rows"><button class="row" data-act="export"><span class="grow"><b>Exporter une sauvegarde</b><small>Fichier JSON</small></span></button>
      <button class="row" data-act="import"><span class="grow"><b>Importer une sauvegarde</b><small>Remplace les données actuelles</small></span></button>
      <button class="row danger" data-act="reset"><span class="grow"><b>Tout effacer</b><small>Revenir à zéro</small></span></button></div>
      <input type="file" id="file" accept="application/json" hidden></section>
  </div>`;
}

/* ---------- Navigation & rendu ---------- */
const TABS = [['home', 'Accueil'], ['journal', 'Journal'], ['bilan', 'Bilan'], ['goals', 'Objectifs']];
function navHTML() {
  const b = ([k, l]) => `<button data-act="tab" data-v="${k}" class="${ui.tab === k ? 'on' : ''}" aria-label="${l}">${ICON[k === 'goals' ? 'goals' : k]}<span>${l}</span></button>`;
  return `${b(TABS[0])}${b(TABS[1])}<button class="fab" data-act="add-expense" aria-label="Ajouter une dépense">${ICON.plus}</button>${b(TABS[2])}${b(TABS[3])}`;
}
const VIEWS = { home, journal, bilan, goals, settings };

function render({ soft = false } = {}) {
  const st = S.get();
  const y = view.scrollTop, wy = window.scrollY;
  view.classList.toggle('soft', soft);
  if (!st.onboarded) {
    document.body.classList.add('onboarding');
    nav.innerHTML = '';
    view.innerHTML = onboarding();
  } else {
    document.body.classList.remove('onboarding');
    view.innerHTML = VIEWS[ui.tab]();
    nav.innerHTML = navHTML();
  }
  view.querySelectorAll('.stagger > *').forEach((el, i) => el.style.setProperty('--i', i));
  if (soft) { window.scrollTo(0, wy); view.scrollTop = y; } else window.scrollTo(0, 0);
  kick(view);
  ui.lastId = null;
}

const ACTIONS = {
  tab: a => { ui.tab = a.dataset.v; render(); },
  'add-expense': () => openExpense(),
  'edit-expense': a => openExpense(a.dataset.id),
  'add-item': a => openItem(a.dataset.kind),
  'edit-item': a => openItem(a.dataset.kind, a.dataset.id),
  contribute: a => openContribute(a.dataset.id),
  month: a => {
    const d = ui.ym.m + Number(a.dataset.d);
    const next = new Date(ui.ym.y, d, 1);
    if (next > now()) return;
    ui.ym = { y: next.getFullYear(), m: next.getMonth() };
    render();
  },
  filter: a => { ui.filter = a.dataset.v; render({ soft: true }); },
  'ob-next': () => { ui.step++; render(); },
  'ob-back': () => { ui.step--; render(); },
  'ob-finish': () => { S.update(st => { st.onboarded = true; }); ui.tab = 'home'; render(); },
  export: () => {
    const url = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `kakeibo-${iso(now())}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  import: () => document.getElementById('file').click(),
  reset: () => openSheet({
    title: 'Tout effacer ?', message: 'Toutes tes données (situation, dépenses, objectifs) seront supprimées définitivement.',
    submitLabel: 'Oui, tout effacer', fields: [], focus: false,
    submitters: [{ label: 'Oui, tout effacer', value: 'ok', cls: 'danger-fill' }],
    onSubmit: () => { S.reset(); ui.step = 0; ui.tab = 'home'; render(); },
  }),
};

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && ACTIONS[a.dataset.act] && !a.disabled) ACTIONS[a.dataset.act](a);
});
document.addEventListener('change', e => {
  if (e.target.id !== 'file') return;
  const f = e.target.files[0];
  if (!f) return;
  f.text().then(t => {
    try {
      const d = JSON.parse(t);
      if (!Array.isArray(d.expenses) || !Array.isArray(d.incomes)) throw 0;
      S.replace({ ...d, onboarded: true }); render(); toast('Sauvegarde importée');
    } catch { toast('Fichier invalide'); }
  });
});

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
