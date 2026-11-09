import * as S from './store.js';
import { TYPES, TYPE_KEYS, FIXED_CATS, FIXED_PRESETS, BUDGET_IDEAS, fmtMonth, eur, iso, parseISO, summary, insights, goalMonthly, monthsLeft, curYM as curYMc, periodOfDate, periodRange, capture } from './calc.js';
import { ring, stackBar, bars, line, legend, yearBars, compareLines, kick } from './charts.js';
import { openSheet, esc, toast } from './ui.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const now = () => new Date();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const ui = { bmode: 'month', year: 0, tab: 'home', step: 0, filter: 'all', fbudget: 'all', q: '', ym: { y: 0, m: 0 }, lastId: null };
const sd = () => S.get().startDay || 1;
const curYM = () => curYMc(sd(), now());   // période en cours (mois civil ou mois de paie)

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
  budget: P('<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  calendar: P('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  bell: P('<path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'),
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
      { name: 'label', label: 'Intitulé', value: it?.label, placeholder: 'Loyer' },
      { name: 'amount', label: 'Montant mensuel', type: 'money', value: it?.amount },
      { name: 'cat', label: 'Catégorie', type: 'choice', value: it?.cat || 'indispensable', options: Object.entries(FIXED_CATS).map(([value, c]) => ({ value, label: c.label, color: c.color })) },
      { name: 'day', label: 'Jour de prélèvement', type: 'day', optional: true, value: it?.day, placeholder: 'ex. 5', half: true },
      { name: 'until', label: 'Dernier mois', type: 'month', optional: true, value: it?.until, half: true, help: 'Pour une charge temporaire : elle s’arrête après ce mois.' },
    ],
    presets: FIXED_PRESETS,
  },
  budget: {
    list: 'budgets', name: 'Budget mensuel',
    fields: it => [
      { name: 'label', label: 'Poste de dépense', value: it?.label, placeholder: 'Courses', suggestions: BUDGET_IDEAS },
      { name: 'amount', label: 'Budget par mois', type: 'money', value: it?.amount, help: 'Une limite que tu t’accordes. Tu seras prévenu en l’approchant.' },
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
    presets: !it && k.presets ? k.presets : null,
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
      { name: 'amount', type: 'money', keypad: true, value: e?.amount },
      ...(st.budgets.length ? [{ name: 'budget', label: 'Budget', type: 'choice', optional: true, value: e?.budget || '', options: st.budgets.map(b => ({ value: b.id, label: b.label })) }] : []),
      { name: 'label', label: 'Note', optional: true, value: e?.label, placeholder: 'Courses, café, essence…', half: true, list: labels },
      { name: 'date', label: 'Date', type: 'date', value: e?.date || iso(now()), half: true },
    ],
    submitters: TYPE_KEYS.map(t => ({ value: t, label: TYPES[t].label, hint: TYPES[t].hint, cls: 'type' + (e?.type === t ? ' current' : ''), color: TYPES[t].color })),
    onSubmit: (v, type) => {
      const data = { amount: v.amount, label: v.label, date: v.date || iso(now()), type, cat: undefined, budget: v.budget || undefined };
      S.update(s => {
        if (e) Object.assign(s.expenses.find(x => x.id === id), data);
        else { const n = { id: S.uid(), ...data }; ui.lastId = n.id; s.expenses.push(n); }
      });
      const ym = periodOfDate(parseISO(data.date), sd());
      ui.ym = ym;
      render({ soft: true });
      let msg = `${eur(data.amount)} · ${TYPES[type].label} ajouté`;
      if (data.budget) {
        const b = summary(S.get(), ym.y, ym.m, now()).budgets.find(x => x.id === data.budget);
        if (b && b.spent > b.amount) msg = `⚠️ Budget « ${b.label} » dépassé de ${eur(b.spent - b.amount)}`;
        else if (b && b.spent >= b.amount * 0.8) msg = `Budget « ${b.label} » à ${Math.round(b.spent / b.amount * 100)} %`;
      }
      toast(msg);
    },
    onDelete: e ? () => { S.update(s => { s.expenses = s.expenses.filter(x => x.id !== id); }); render({ soft: true }); toast('Dépense supprimée'); } : null,
  });
}

function openContribute(id) {
  const g = S.get().goals.find(x => x.id === id);
  openSheet({
    title: `Verser sur « ${esc(g.label)} »`,
    message: `Déjà ${eur(g.saved || 0)} sur ${eur(g.target)}.`,
    fields: [{ name: 'amount', type: 'money', keypad: true }],
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
  } else if (kind === 'budget') sub = 'Par mois';
  else {
    sub = it.day ? `Le ${it.day} de chaque mois` : 'Chaque mois';
    if (kind === 'fixed') {
      const c = FIXED_CATS[it.cat || 'indispensable'];
      sub = `<i class="cdot" style="background:${c.color}"></i>${c.label} · ${sub}${it.until ? ` · jusqu’à ${fmtMonth(it.until)}` : ''}`;
    }
  }
  return `<button class="row${ui.lastId === it.id ? ' pop' : ''}" data-act="edit-item" data-kind="${kind}" data-id="${it.id}">
    <span class="ico ${kind}">${ICON[kind]}</span><span class="grow"><b>${esc(it.label)}</b><small>${sub}</small></span><span class="amt">${eur(amt)}</span></button>`;
}
function listBlock(kind, title, items, empty) {
  return `<section class="card"><div class="card-h"><h3>${title}</h3><button class="link" data-act="add-item" data-kind="${kind}">+ Ajouter</button></div>
    ${items.length ? `<div class="rows">${items.map(i => itemRow(kind, i)).join('')}</div>` : `<p class="empty-s">${empty}</p>`}</section>`;
}
function budgetsCard(s, add) {
  const head = `<div class="card-h"><h3>Mes budgets</h3>${add ? '<button class="link" data-act="add-item" data-kind="budget">+ Ajouter</button>' : ''}</div>`;
  if (!s.budgets.length) return add ? `<section class="card">${head}<p class="empty-s">Fixe-toi une limite par poste (courses, transport…) pour ne pas la dépasser.</p></section>` : '';
  return `<section class="card">${head}${s.budgets.map(b => {
    const r = b.spent / b.amount, cls = r > 1 ? 'over' : r >= 0.8 ? 'warn' : '';
    return `<button class="bud ${cls}" data-act="edit-item" data-kind="budget" data-id="${b.id}"><div class="bud-h"><b>${esc(b.label)}</b><span>${eur(b.spent)} <small>/ ${eur(b.amount)}</small></span></div>
      <div class="pbar"><i data-p="${Math.min(100, r * 100).toFixed(1)}%"></i></div>
      <small>${r > 1 ? `Dépassé de ${eur(b.spent - b.amount)}` : `Il reste ${eur(b.amount - b.spent)}`}</small></button>`;
  }).join('')}</section>`;
}
function fixedCatsCard(s) {
  if (!s.fixed) return '';
  const ks = Object.keys(FIXED_CATS);
  return `<section class="card"><div class="card-h"><h3>Charges fixes par catégorie</h3></div>
    ${stackBar(ks.map(k => ({ v: s.fixedByCat[k], color: FIXED_CATS[k].color })))}
    <ul class="legend flat">${ks.map(k => `<li><i style="background:${FIXED_CATS[k].color}"></i><span>${FIXED_CATS[k].label}</span><b>${eur(s.fixedByCat[k])}</b></li>`).join('')}</ul></section>`;
}
function plaisirCard(s) {
  const pc = Object.entries(s.plaisirByCat).map(([label, v]) => ({ label, v })).filter(c => c.v > 0).sort((a, b) => b.v - a.v);
  if (!pc.length) return '';
  return `<section class="card"><div class="card-h"><h3>Tes plaisirs par budget</h3><small>${eur(s.byType.plaisir)}</small></div>
    ${pc.map((c, i) => `<div class="crow"><div class="crow-h"><span>${esc(c.label)}${i === 0 && pc.length > 1 ? ' <em class="rank">N°1</em>' : ''}</span><b>${eur(c.v)}</b><small>${Math.round(c.v / s.byType.plaisir * 100)} %</small></div>
      <div class="pbar plais"><i data-p="${(c.v / pc[0].v * 100).toFixed(1)}%"></i></div></div>`).join('')}
    ${S.get().budgets.length ? '' : '<p class="help hint">Crée des budgets (Réglages) et rattache-les à tes dépenses pour voir où partent tes plaisirs.</p>'}</section>`;
}
/* ---------- Sauvegarde, rappel, fin de mois, prélèvements ---------- */
/** Enregistre un fichier : feuille de partage du téléphone (Fichiers, Drive…) si possible, sinon téléchargement. */
async function saveFile(name, text, mime) {
  const file = new File([text], name, { type: mime });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
  } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  const url = URL.createObjectURL(file);
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
const daysSince = s => Math.floor((now() - parseISO(s)) / 864e5);
function backupDue(st) {
  if (!st.onboarded || st.expenses.length < 10) return false;
  if (st.backupSnooze && st.backupSnooze > iso(now())) return false;
  return !st.lastBackup || daysSince(st.lastBackup) > 30;
}
function reminderDue(st = S.get()) {
  const r = st.reminder;
  if (!st.onboarded || !r || !r.on) return false;
  const t = now(), [h, mi] = r.time.split(':').map(Number), td = iso(t);
  if (t.getHours() * 60 + t.getMinutes() < h * 60 + mi) return false;
  return r.skip !== td && !st.expenses.some(e => e.date === td);
}
const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
const mLong = (y, m) => new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(y, m, 1));
const startDayCard = () => `<section class="card"><div class="rows"><button class="row" data-act="edit-startday"><span class="ico fixed">${ICON.calendar}</span><span class="grow"><b>Début du mois</b>
  <small>${sd() > 1 ? `${sd()} (jour de paie) · du ${sd()} au ${sd() - 1}` : '1er du mois (mois civil)'}</small></span><span class="link">Modifier</span></button></div></section>`;

/** Période précédente à clôturer (budget non dépensé à affecter), si elle existe. */
function closureInfo(st) {
  const c = curYM(), pd = new Date(c.y, c.m - 1, 1);
  const pv = summary(st, pd.getFullYear(), pd.getMonth(), now());
  const cl = st.closures[pv.key];
  const left = pv.remaining - (cl ? sum(cl.allocations, a => a.amount) : 0);
  return pv.isPast && !(cl && cl.done) && left >= 1 && pv.items.length ? { pv, left } : null;
}
function closureCard(s) {
  const cl = S.get().closures[s.key];
  const goalName = id => (S.get().goals.find(g => g.id === id) || { label: 'cagnotte supprimée' }).label;
  const lines = cl ? cl.allocations.map(a => `<div class="row static"><span class="grow"><b>${a.to === 'carry' ? 'Reporté au mois suivant' : `Cagnotte · ${esc(goalName(a.to))}`}</b></span><span class="amt">${eur(a.amount)}</span></div>`).join('') : '';
  const left = s.remaining - (cl ? sum(cl.allocations, a => a.amount) : 0);
  const can = s.isPast && !(cl && cl.done) && left >= 1 && s.items.length;
  if (!lines && !can) return '';
  return `<section class="card"><div class="card-h"><h3>Fin de mois</h3></div>${lines ? `<div class="rows">${lines}</div>` : ''}
    ${can ? `<p class="empty-s">${eur(left)} non dépensés. <button class="link" data-act="closure" data-key="${s.key}">Les affecter</button></p>` : ''}</section>`;
}
function openClosure(key) {
  const st = S.get(), [y, mo] = key.split('-').map(Number);
  const s = summary(st, y, mo - 1, now()), cl = st.closures[key];
  const left = s.remaining - (cl ? sum(cl.allocations, a => a.amount) : 0);
  if (left < 1) return;
  const goals = st.goals.filter(g => (g.saved || 0) < g.target);
  openSheet({
    title: `Fin de ${mLong(y, mo - 1)}`,
    message: `Il te reste <b>${eur(left)}</b> de budget non dépensé. Où veux-tu le mettre ?`,
    fields: [
      { name: 'amount', type: 'money', keypad: true, value: Math.round(left * 100) / 100 },
      { name: 'dest', label: 'Destination', type: 'choice', value: 'carry', options: [{ value: 'carry', label: 'Mois suivant' }, ...goals.map(g => ({ value: g.id, label: `Cagnotte · ${g.label}` }))] },
    ],
    submitLabel: 'Affecter', deleteLabel: 'Garder, ne rien reporter',
    onSubmit: v => {
      const amt = Math.min(v.amount, left);
      S.update(d => {
        const c = (d.closures[key] ||= { done: false, allocations: [] });
        c.allocations.push({ to: v.dest, amount: amt });
        if (v.dest !== 'carry') { const g = d.goals.find(x => x.id === v.dest); if (g) g.saved = (g.saved || 0) + amt; }
        if (left - amt < 1) c.done = true;
      });
      render({ soft: true });
      toast(v.dest === 'carry' ? `${eur(amt)} reportés sur le mois suivant` : `${eur(amt)} ajoutés à la cagnotte`);
    },
    onDelete: () => { S.update(d => { (d.closures[key] ||= { done: false, allocations: [] }).done = true; }); render({ soft: true }); },
  });
}
function debitsCard(s) {
  if (!s.debits.length && !s.noDate.length) return '';
  const up = s.debits.filter(d => !d.done), passed = s.debits.filter(d => d.done && d.kind === 'fixed');
  const total = s.debited + s.toDebit;
  return `<section class="card"><div class="card-h"><h3>Prélèvements du mois</h3><small>${s.toDebit > 0 ? `Reste ${eur(s.toDebit)}` : 'Tout est passé'}</small></div>
    ${total ? `<div class="pbar"><i data-p="${(s.debited / total * 100).toFixed(1)}%"></i></div><p class="deb-sum"><span>${eur(s.debited)} prélevés</span><span>${eur(s.toDebit)} à venir</span></p>` : ''}
    ${up.length ? `<div class="rows">${up.slice(0, 6).map(d => `<div class="row static"><span class="ico ${d.kind}">${ICON[d.kind]}</span><span class="grow"><b>${esc(d.label)}</b><small>${dueLabel(d.inDays)} · ${fmtD(d.date)}</small></span><span class="amt ${d.kind === 'income' ? 'plus' : ''}">${d.kind === 'income' ? '+' : '−'}${eur(d.amount)}</span></div>`).join('')}</div>` : ''}
    ${passed.length ? `<p class="fsum">✓ ${passed.length} prélèvement${passed.length > 1 ? 's' : ''} déjà passé${passed.length > 1 ? 's' : ''} · ${eur(s.debited)}</p>` : ''}
    ${s.noDate.length ? `<p class="fsum">+ ${s.noDate.length} charge${s.noDate.length > 1 ? 's' : ''} sans date · ${eur(s.noDateTotal)}</p>` : ''}</section>`;
}
function banners(st) {
  const b = [];
  if (reminderDue(st)) b.push(`<section class="card banner"><div><b>Tes dépenses du jour ?</b><small>Rien de noté aujourd’hui.</small></div><div class="bn-act"><button class="mini" data-act="add-expense">Ajouter</button><button class="link" data-act="skip-today">Rien aujourd’hui</button></div></section>`);
  const cl = closureInfo(st);
  if (cl) b.push(`<section class="card banner accent"><div><b>${eur(cl.left)} non dépensés en ${mLong(cl.pv.y, cl.pv.m)}</b><small>Reporte-les au mois suivant ou mets-les dans une cagnotte.</small></div><div class="bn-act"><button class="mini" data-act="closure" data-key="${cl.pv.key}">Choisir</button></div></section>`);
  if (backupDue(st)) b.push(`<section class="card banner"><div><b>Pense à sauvegarder tes données</b><small>${st.lastBackup ? `Dernière sauvegarde il y a ${daysSince(st.lastBackup)} jours.` : 'Aucune sauvegarde pour l’instant.'}</small></div><div class="bn-act"><button class="mini" data-act="export">Sauvegarder</button><button class="link" data-act="backup-later">Plus tard</button></div></section>`);
  return b.slice(0, 2).join('');
}

function notes(list) {
  return `<div class="notes">${list.map(n => `<div class="note ${n.tone}"><i></i><p>${n.text}</p></div>`).join('')}</div>`;
}
function ringParts(s) {
  if (s.budget <= 0) return { parts: [{ v: s.spent > 0 ? 1 : 0 }], over: true };
  const over = s.remaining < 0;
  const scale = over ? 1 / (s.spent / s.budget) : 1;
  const parts = TYPE_KEYS.map(t => ({ v: s.byType[t] / s.budget * scale, color: TYPES[t].color }));
  if (!over && s.reserved > 0) parts.push({ v: s.reserved / s.budget, color: 'var(--reserve)' });
  return { over, parts };
}
const fmtD = d => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
const monthNav = () => {
  const c = curYM(), cur = ui.ym.y === c.y && ui.ym.m === c.m;
  const r = sd() > 1 ? periodRange(ui.ym.y, ui.ym.m, sd()) : null;
  return `<div class="monthnav"><button data-act="month" data-d="-1" aria-label="Mois précédent">${ICON.left}</button>
    <div class="mn"><b>${monthName(ui.ym)}</b>${r ? `<small>${fmtD(r.start)} – ${fmtD(r.end)}</small>` : ''}</div>
    <button data-act="month" data-d="1" aria-label="Mois suivant" ${cur ? 'disabled' : ''}>${ICON.right}</button></div>`;
};

/* ---------- Onboarding ---------- */
function onboarding() {
  const st = S.get();
  const dots = `<div class="dots">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i === ui.step ? 'on' : i < ui.step ? 'done' : ''}"></i>`).join('')}</div>`;
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
      <div class="field name-field"><label for="name">Comment t’appelles-tu ?</label><input id="name" autocomplete="given-name" autocapitalize="words" maxlength="30" placeholder="Ton prénom" value="${esc(st.name)}"></div>
      <div class="ob-foot"><button class="btn primary" data-act="ob-next" ${st.name ? '' : 'disabled'}>Commencer</button><small>Tes données restent sur ton téléphone.</small></div></div>`;
  }
  if (ui.step === 1) body = `<h1>Tes rentrées</h1><p class="lead">Salaire et autres revenus nets reçus chaque mois.</p>${listBlock('income', 'Rentrées d’argent', st.incomes, 'Ajoute ton salaire pour commencer.')}${startDayCard()}${next('Continuer', !st.incomes.length)}`;
  if (ui.step === 2) body = `<h1>Tes dépenses fixes</h1><p class="lead">Loyer, abonnements, assurances… avec leur date de prélèvement.</p>${listBlock('fixed', 'Dépenses fixes', st.fixed, 'Rien pour l’instant — tu peux passer cette étape.')}${next(st.fixed.length ? 'Continuer' : 'Passer')}`;
  if (ui.step === 3) body = `<h1>Tes budgets</h1><p class="lead">Une limite mensuelle par poste (courses, transport…) pour ne pas la dépasser. Optionnel.</p>${listBlock('budget', 'Budgets mensuels', st.budgets, 'Tu pourras en ajouter plus tard.')}${next(st.budgets.length ? 'Continuer' : 'Passer')}`;
  if (ui.step === 4) body = `<h1>Tes objectifs</h1><p class="lead">Qu’est-ce que tu veux t’offrir plus tard ? Avec ou sans délai.</p>${listBlock('goal', 'Objectifs d’épargne', st.goals, 'Vacances, fonds d’urgence, projet… ajoute-en un.')}${next(st.goals.length ? 'Voir mon budget' : 'Voir mon budget sans objectif')}`;
  if (ui.step === 5) {
    const c = curYM(), s = summary(st, c.y, c.m, now());
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
  const st = S.get(), t = now(), c = curYM();
  const s = summary(st, c.y, c.m, t);
  const { parts, over } = ringParts(s);
  const date = cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(t));
  return `<div class="page stagger">
    <header class="top"><div><small>${date}</small><h1>Bonjour${st.name ? ' ' + esc(st.name) : ''} 👋</h1></div><button class="icon-btn" data-act="tab" data-v="settings" aria-label="Réglages">${ICON.gear}</button></header>
    ${banners(st)}
    <section class="card hero">
      ${ring(parts, { over, size: 232, stroke: 15, children: `<small>${s.remaining < 0 ? 'Dépassement' : 'Reste ce mois'}</small><div class="big ${s.remaining < 0 ? 'neg' : ''}" data-count="${Math.abs(s.remaining)}">${eur(0)}</div><small>sur ${eur(Math.max(0, s.budget))}</small>` })}
      ${s.budgets.length && s.budget > 0 ? `<div class="ringkey"><span><i style="background:conic-gradient(var(--besoin) 0 33%, var(--plaisir) 0 66%, var(--imprevu) 0)"></i>Dépensé <b>${eur(s.spent)}</b></span><span><i style="background:var(--reserve)"></i>Budgets à venir <b>${eur(s.reserved)}</b></span><span><i class="free"></i>Libre <b>${eur(Math.max(0, s.free))}</b></span></div>` : ''}
      <p class="pace">${s.remaining > 0 ? `Tu peux dépenser <b>${eur(s.perDay)}</b> par jour · ${s.daysLeft} j restants` : s.budget <= 0 ? 'Revois tes charges ou tes objectifs dans les réglages.' : 'Budget du mois épuisé — seulement l’essentiel !'}</p>
    </section>
    <section class="types">${TYPE_KEYS.map(k => `<div class="tcard" style="--c:${TYPES[k].color}"><i></i><small>${TYPES[k].label}</small><b data-count="${s.byType[k]}">${eur(0)}</b></div>`).join('')}</section>
    ${budgetsCard(s, true)}
    ${debitsCard(s)}
    <section class="card"><div class="card-h"><h3>Notes du moment</h3></div>${notes(insights(st, s).slice(0, 3))}</section>
  </div>`;
}

/* ---------- Journal ---------- */
/** Lignes du journal : dépenses filtrées + prélèvements déjà passés. */
function journalRows(s) {
  const st = S.get(), f = ui.filter, fb = ui.fbudget, q = ui.q.trim().toLowerCase();
  const bname = id => (st.budgets.find(b => b.id === id) || {}).label || '';
  const rows = [];
  s.items.forEach(e => {
    if (f !== 'all' && e.type !== f) return;
    if (fb === 'none' && e.budget) return;
    if (fb !== 'all' && fb !== 'none' && e.budget !== fb) return;
    if (q && !`${e.label || ''} ${bname(e.budget)} ${TYPES[e.type].label} ${String(e.amount).replace('.', ',')}`.toLowerCase().includes(q)) return;
    rows.push({ kind: 'exp', date: e.date, e, bname: bname(e.budget) });
  });
  if ((f === 'all' || f === 'debit') && fb === 'all') {
    s.debits.filter(d => d.done && (!q || d.label.toLowerCase().includes(q) || 'prélèvement rentrée'.includes(q))).forEach(d => rows.push({ kind: 'deb', date: iso(d.date), d }));
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
function journalList() {
  const s = sumView(), rows = journalRows(s);
  const exp = rows.filter(r => r.kind === 'exp');
  const filtered = ui.q || ui.filter !== 'all' || ui.fbudget !== 'all';
  const line = filtered ? `<p class="fsum"><b>${exp.length}</b> dépense${exp.length > 1 ? 's' : ''} · <b>${eur(sum(exp, r => r.e.amount))}</b></p>` : '';
  if (!rows.length) return `${line}<div class="empty"><div class="bubble">${ICON.journal}</div><p>${filtered ? 'Aucun résultat.' : 'Aucune dépense ce mois-ci.'}</p><small>${filtered ? 'Essaie un autre filtre.' : 'Appuie sur + pour noter la première.'}</small></div>`;
  const groups = {};
  rows.forEach(r => (groups[r.date] ||= []).push(r));
  const rowHTML = r => r.kind === 'exp'
    ? `<button class="row${ui.lastId === r.e.id ? ' pop' : ''}" data-act="edit-expense" data-id="${r.e.id}"><span class="dot" style="background:${TYPES[r.e.type].color}"></span><span class="grow"><b>${esc(r.e.label || TYPES[r.e.type].label)}</b><small>${TYPES[r.e.type].label}${r.bname ? ' · ' + esc(r.bname) : ''}</small></span><span class="amt">−${eur(r.e.amount)}</span></button>`
    : `<div class="row static debit"><span class="ico ${r.d.kind}">${ICON[r.d.kind]}</span><span class="grow"><b>${esc(r.d.label)}</b><small>${r.d.kind === 'income' ? 'Rentrée' : 'Prélèvement automatique'}</small></span><span class="amt ${r.d.kind === 'income' ? 'plus' : ''}">${r.d.kind === 'income' ? '+' : '−'}${eur(r.d.amount)}</span></div>`;
  return line + Object.entries(groups).map(([d, list]) => `<section class="day"><h4><span>${dayLabel(d)}</span><span>${eur(sum(list.filter(r => r.kind === 'exp'), r => r.e.amount))}</span></h4><div class="rows card">${list.map(rowHTML).join('')}</div></section>`).join('');
}
function journal() {
  const s = sumView(), st = S.get(), f = ui.filter;
  const chip = (act, v, label, on, color) => `<button class="chip${on ? ' on' : ''}" ${color ? `style="--c:${color}"` : ''} data-act="${act}" data-v="${v}">${esc(label)}</button>`;
  const types = [chip('filter', 'all', 'Tout', f === 'all'), ...TYPE_KEYS.map(k => chip('filter', k, TYPES[k].label, f === k, TYPES[k].color)), chip('filter', 'debit', 'Prélèvements', f === 'debit')].join('');
  const buds = st.budgets.length ? `<div class="chips sub">${[chip('fbudget', 'all', 'Tous budgets', ui.fbudget === 'all'), ...st.budgets.map(b => chip('fbudget', b.id, b.label, ui.fbudget === b.id)), chip('fbudget', 'none', 'Sans budget', ui.fbudget === 'none')].join('')}</div>` : '';
  return `<div class="page stagger">
    <header class="top"><h1>Journal</h1><button class="link" data-act="csv">Exporter CSV</button></header>${monthNav()}
    <section class="card total"><small>Dépensé ce mois</small><div class="big" data-count="${s.spent}">${eur(0)}</div>
      ${stackBar(TYPE_KEYS.map(k => ({ v: s.byType[k], color: TYPES[k].color })))}</section>
    <div class="search">${ICON.search}<input id="q" type="search" placeholder="Rechercher (note, budget, montant…)" value="${esc(ui.q)}" autocomplete="off"></div>
    <div class="chips">${types}</div>${buds}
    <div id="jlist">${journalList()}</div>
  </div>`;
}

/* ---------- Bilan ---------- */
function bilanMonth() {
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
  return `${monthNav()}
    ${closureCard(s)}
    <section class="card"><div class="card-h"><h3>Répartition de ton revenu</h3></div>
      ${stackBar([{ v: s.fixed, color: 'var(--fixed)' }, { v: s.savings, color: 'var(--save)' }, { v: Math.max(0, s.budget), color: 'var(--accent)' }])}
      <ul class="legend flat"><li><i style="background:var(--fixed)"></i><span>Charges fixes</span><b>${eur(s.fixed)}</b></li><li><i style="background:var(--save)"></i><span>Épargne</span><b>${eur(s.savings)}</b></li><li><i style="background:var(--accent)"></i><span>À dépenser</span><b>${eur(Math.max(0, s.budget))}</b></li></ul></section>
    ${fixedCatsCard(s)}
    ${budgetsCard(s, false)}
    <section class="card"><div class="card-h"><h3>Où part ton argent</h3></div>
      ${tot ? `<div class="donut-row">${ring(TYPE_KEYS.map(k => ({ v: s.byType[k] / tot, color: TYPES[k].color })), { size: 150, stroke: 18, children: `<small>Total</small><b class="mid" data-count="${tot}">${eur(0)}</b>` })}${legend(s.byType, tot)}</div>` : '<p class="empty-s">Pas encore de dépenses ce mois-ci.</p>'}</section>
    ${plaisirCard(s)}
    ${tot && s.budget > 0 ? `<section class="card"><div class="card-h"><h3>Rythme du mois</h3><span class="key"><i class="k1"></i>Réel <i class="k2"></i>Idéal</span></div>${line(s.cumulative, s.budget, Math.max(1, s.day))}</section>` : ''}
    ${tot ? `<section class="card"><div class="card-h"><h3>Jour par jour</h3></div>${bars(s.daily)}</section>` : ''}
    <section class="card"><div class="card-h"><h3>Notes</h3></div>${notes(insights(st, s).slice(0, 5))}</section>
    <section class="card kk"><div class="card-h"><h3>Les 4 questions du Kakeibo</h3></div>
      ${qs.map(([q, a]) => `<div class="q"><span>${q}</span><b>${a}</b></div>`).join('')}
      <div class="q last"><span>Comment puis-je m’améliorer ?</span><p>${advice}</p></div></section>`;
}

/* ---------- Objectifs ---------- */
/* ---------- Bilan : modes Comparer & Année ---------- */
const mShort = (y, m) => new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(y, m, 1)).replace('.', '');
const deltaHTML = (a, b) => {
  const d = a - b;
  if (Math.abs(d) < 0.005) return '<span class="delta flat">=</span>';
  const p = b ? ` (${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) / b * 100)} %)` : '';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${eur(Math.abs(d))}${p}</span>`;
};
/** Dépenses d'un mois jusqu'au jour `limit` inclus (comparaison à périmètre égal). */
function upTo(s, limit) {
  const dayOf = e => Math.round((parseISO(e.date) - s.start) / 864e5) + 1;
  const byType = { besoin: 0, plaisir: 0, imprevu: 0 }, byBudget = {};
  s.items.forEach(e => {
    if (dayOf(e) > limit) return;
    byType[e.type] += e.amount;
    if (e.budget) byBudget[e.budget] = (byBudget[e.budget] || 0) + e.amount;
  });
  return { byType, byBudget, total: sum(TYPE_KEYS, k => byType[k]) };
}

function bilanCompare() {
  const st = S.get(), cur = sumView();
  const pd = new Date(ui.ym.y, ui.ym.m - 1, 1);
  const prev = summary(st, pd.getFullYear(), pd.getMonth(), now());
  const limit = cur.isCurrent ? cur.day : cur.dim;
  const A = upTo(cur, limit), B = upTo(prev, limit);
  const cn = cap(mShort(cur.y, cur.m)), pn = cap(mShort(prev.y, prev.m));
  if (!A.total && !B.total) return `${monthNav()}<div class="empty"><div class="bubble">${ICON.bilan}</div><p>Rien à comparer pour l’instant.</p><small>Il faut des dépenses sur ${cap(mLong(cur.y, cur.m))} ou ${mLong(prev.y, prev.m)}.</small></div>`;

  const maxT = Math.max(...TYPE_KEYS.flatMap(k => [A.byType[k], B.byType[k]]), 1);
  const w = v => `${(v / maxT * 100).toFixed(1)}%`;
  const types = TYPE_KEYS.map(k => `<div class="cmp"><div class="cmp-h"><span><i class="cdot" style="background:${TYPES[k].color}"></i>${TYPES[k].label}</span>${deltaHTML(A.byType[k], B.byType[k])}</div>
    <div class="cmp-b"><small>${cn}</small><div class="pbar"><i style="background:${TYPES[k].color}" data-p="${w(A.byType[k])}"></i></div><b>${eur(A.byType[k])}</b></div>
    <div class="cmp-b prev"><small>${pn}</small><div class="pbar"><i style="background:${TYPES[k].color};opacity:.38" data-p="${w(B.byType[k])}"></i></div><b>${eur(B.byType[k])}</b></div></div>`).join('');

  const bl = st.budgets.map(b => ({ b, a: A.byBudget[b.id] || 0, p: B.byBudget[b.id] || 0 })).filter(x => x.a || x.p);
  const budgetsRows = bl.length ? `<section class="card"><div class="card-h"><h3>Par budget</h3></div><div class="rows">${bl.map(x =>
    `<div class="row static"><span class="grow"><b>${esc(x.b.label)}</b><small>${pn} : ${eur(x.p)}</small></span><span class="mcol"><span class="amt">${eur(x.a)}</span>${deltaHTML(x.a, x.p)}</span></div>`).join('')}</div></section>` : '';

  const curve = cur.cumulative.slice(0, Math.max(1, limit));
  const notesList = [];
  const dTot = A.total - B.total;
  if (B.total === 0) notesList.push({ tone: 'info', text: `Pas de dépenses enregistrées en ${mLong(prev.y, prev.m)} : rien à comparer pour l’instant.` });
  else {
    notesList.push({ tone: dTot > B.total * 0.1 ? 'warn' : dTot < 0 ? 'good' : 'info', text: `${dTot > 0 ? 'Tu dépenses' : 'Tu dépenses'} ${eur(Math.abs(dTot))} ${dTot > 0 ? 'de plus' : 'de moins'} qu’en ${mLong(prev.y, prev.m)}${cur.isCurrent ? ' à la même date' : ''}.` });
    const big = TYPE_KEYS.map(k => ({ k, d: A.byType[k] - B.byType[k] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    if (Math.abs(big.d) > 0.5) notesList.push({ tone: big.d > 0 ? 'warn' : 'good', text: `Le poste qui a le plus bougé : ${TYPES[big.k].label.toLowerCase()} (${big.d > 0 ? '+' : '−'}${eur(Math.abs(big.d))}).` });
  }
  return `${monthNav()}
    <section class="card cmp-total"><small>Dépensé en ${mLong(cur.y, cur.m)}${cur.isCurrent ? ` (jours 1 à ${limit})` : ''}</small>
      <div class="big" data-count="${A.total}">${eur(0)}</div>
      <p class="vs">${B.total ? `${deltaHTML(A.total, B.total)} <span>vs ${mLong(prev.y, prev.m)} : ${eur(B.total)}</span>` : `<span>Pas de données en ${mLong(prev.y, prev.m)}</span>`}</p></section>
    <section class="card"><div class="card-h"><h3>Par type</h3></div>${types}</section>
    ${budgetsRows}
    <section class="card"><div class="card-h"><h3>Cumul des dépenses</h3><span class="key"><i class="k1"></i>${cn} <i class="k2"></i>${pn}</span></div>${compareLines(curve, prev.cumulative)}</section>
    <section class="card"><div class="card-h"><h3>Notes</h3></div>${notes(notesList)}</section>`;
}

function bilanYear() {
  const st = S.get(), y = ui.year, t = now(), cy = curYM();
  const months = Array.from({ length: 12 }, (_, m) => summary(st, y, m, t));
  const withData = months.filter(s => s.spent > 0);
  const total = sum(months, s => s.spent);
  const yearNav = `<div class="monthnav"><button data-act="year" data-d="-1" aria-label="Année précédente">${ICON.left}</button><b>${y}</b>
    <button data-act="year" data-d="1" aria-label="Année suivante" ${y >= cy.y ? 'disabled' : ''}>${ICON.right}</button></div>`;
  if (!total) return `${yearNav}<div class="empty"><div class="bubble">${ICON.bilan}</div><p>Aucune dépense en ${y}.</p><small>Les mois se remplissent au fil de tes saisies.</small></div>`;

  const limit = y === cy.y ? cy.m : 11;
  const prevTotal = sum(Array.from({ length: limit + 1 }, (_, m) => summary(st, y - 1, m, t)), s => s.spent);
  const done = withData.filter(s => !s.isCurrent);           // mois terminés (le mois en cours est partiel)
  const avg = done.length ? sum(done, s => s.spent) / done.length : total;
  const byType = Object.fromEntries(TYPE_KEYS.map(k => [k, sum(months, s => s.byType[k])]));
  const worst = done.slice().sort((a, b) => b.spent - a.spent)[0];
  const best = done.slice().sort((a, b) => a.spent - b.spent)[0];
  const over = done.filter(s => s.budget > 0 && s.remaining < 0).length;
  const maxM = Math.max(...months.map(s => s.spent), 1);
  const budget = months[0].budget;

  const shown = months.filter(s => s.isPast || s.isCurrent);
  const list = shown.map(s => {
    const p = s.m > 0 ? months[s.m - 1].spent : 0;
    return `<button class="row" data-act="goto-month" data-m="${s.m}"><span class="grow"><b>${cap(mLong(y, s.m))}</b><div class="pbar thin"><i data-p="${(s.spent / maxM * 100).toFixed(1)}%"></i></div></span>
      <span class="mcol"><span class="amt">${s.spent ? eur(s.spent) : '—'}</span>${s.isCurrent ? '<small>en cours</small>' : s.spent && p ? deltaHTML(s.spent, p) : ''}</span></button>`;
  }).join('');

  const nl = [{ tone: 'info', text: `Tu as dépensé ${eur(total)} en ${y}${done.length ? `, soit ${eur(avg)} en moyenne sur les ${done.length} mois terminés` : ''}.` }];
  if (done.length > 1) {
    nl.push({ tone: 'warn', text: `Mois le plus dépensier : ${mLong(y, worst.m)} (${eur(worst.spent)}).` });
    nl.push({ tone: 'good', text: `Mois le plus sobre : ${mLong(y, best.m)} (${eur(best.spent)}).` });
  }
  if (budget > 0 && done.length) nl.push(over ? { tone: 'warn', text: `Tu as dépassé ton budget ${over} mois sur ${done.length}.` } : { tone: 'good', text: 'Budget respecté tous les mois. Bravo !' });
  if (prevTotal > 0) nl.push({ tone: total > prevTotal ? 'warn' : 'good', text: `${total > prevTotal ? 'Tu dépenses davantage' : 'Tu dépenses moins'} qu’en ${y - 1} sur la même période (${eur(Math.abs(total - prevTotal))} d’écart).` });

  return `${yearNav}
    <section class="card cmp-total"><small>Dépensé en ${y}</small><div class="big" data-count="${total}">${eur(0)}</div>
      <p class="vs"><span>${eur(avg)} / mois en moyenne${done.length ? ' (mois terminés)' : ''}</span></p>
      ${prevTotal > 0 ? `<p class="vs">${deltaHTML(total, prevTotal)} <span>vs ${y - 1} (même période)</span></p>` : ''}</section>
    <section class="card"><div class="card-h"><h3>Mois par mois</h3>${budget > 0 ? '<span class="key"><i class="k2"></i>Budget</span>' : ''}</div>
      ${yearBars(months.map(s => s.byType), budget)}</section>
    <section class="card"><div class="card-h"><h3>Répartition sur l’année</h3></div>${stackBar(TYPE_KEYS.map(k => ({ v: byType[k], color: TYPES[k].color })))}<div style="height:14px"></div>${legend(byType, total)}</section>
    <section class="card"><div class="card-h"><h3>Détail par mois</h3><small>Touche pour ouvrir</small></div><div class="rows">${list}</div></section>
    <section class="card"><div class="card-h"><h3>Notes</h3></div>${notes(nl)}</section>`;
}

function bilan() {
  const modes = [['month', 'Mois'], ['compare', 'Comparer'], ['year', 'Année']];
  const body = ui.bmode === 'compare' ? bilanCompare() : ui.bmode === 'year' ? bilanYear() : bilanMonth();
  return `<div class="page stagger"><header class="top"><h1>Bilan</h1></header>
    <div class="seg">${modes.map(([k, l]) => `<button class="${ui.bmode === k ? 'on' : ''}" data-act="bmode" data-v="${k}">${l}</button>`).join('')}</div>${body}</div>`;
}

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
  const st = S.get(), r = st.reminder || {};
  return `<div class="page stagger">
    <header class="top"><button class="back" data-act="tab" data-v="home" aria-label="Retour">${ICON.left}</button><h1>Réglages</h1><span></span></header>
    <p class="lead tight">Ta situation. Les calculs se mettent à jour automatiquement.</p>
    <section class="card"><div class="card-h"><h3>Profil</h3></div><div class="rows"><button class="row" data-act="edit-name"><span class="grow"><b>Prénom</b><small>${esc(st.name || 'Non renseigné')}</small></span><span class="link">Modifier</span></button></div></section>
    ${startDayCard()}
    <section class="card"><div class="card-h"><h3>Rappel quotidien</h3></div><div class="rows">
      <button class="row" data-act="edit-reminder"><span class="ico fixed">${ICON.bell}</span><span class="grow"><b>${r.on ? `Activé · ${r.time}` : 'Désactivé'}</b><small>Te rappelle de noter tes dépenses du jour</small></span><span class="link">Régler</span></button>
      ${r.on ? `<button class="row" data-act="reminder-ics"><span class="grow"><b>Ajouter à mon calendrier</b><small>Notification fiable chaque jour, même app fermée</small></span></button>` : ''}</div></section>
    ${listBlock('income', 'Rentrées d’argent', st.incomes, 'Aucune rentrée.')}
    ${listBlock('fixed', 'Dépenses fixes', st.fixed, 'Aucune dépense fixe.')}
    ${listBlock('budget', 'Budgets mensuels', st.budgets, 'Aucun budget.')}
    ${listBlock('goal', 'Objectifs et cagnottes', st.goals, 'Aucun objectif.')}
    <section class="card"><div class="card-h"><h3>Données</h3></div>
      <p class="store" id="persist">Vérification du stockage…</p>
      <div class="rows"><button class="row" data-act="export"><span class="grow"><b>Sauvegarder sur mon téléphone</b><small>${st.lastBackup ? `Dernière sauvegarde : ${cap(new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(st.lastBackup)))}` : 'Jamais sauvegardé'} · fichier à enregistrer dans Fichiers / Drive</small></span></button>
      <button class="row" data-act="import"><span class="grow"><b>Restaurer une sauvegarde</b><small>Remplace les données actuelles</small></span></button>
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

/** Fige la situation de la période en cours (revenus, charges, budgets, épargne) pour garder un historique fidèle. */
function snap() {
  const st = S.get();
  if (!st.onboarded) return;
  const c = curYM(), key = `${c.y}-${String(c.m + 1).padStart(2, '0')}`, cap = capture(st, now());
  if (JSON.stringify(st.snapshots[key]) !== JSON.stringify(cap)) S.update(d => { d.snapshots[key] = cap; });
}

function render({ soft = false } = {}) {
  snap();
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
  if (st.onboarded && ui.tab === 'settings') S.isPersisted().then(p => {
    const el = document.getElementById('persist');
    if (el) el.innerHTML = p ? '🔒 Stockage protégé par ton navigateur.' : 'Stockage non garanti : installe l’app sur l’écran d’accueil et fais une sauvegarde régulière.';
  });
}

const ACTIONS = {
  tab: a => { ui.tab = a.dataset.v; render(); },
  'add-expense': () => openExpense(),
  'edit-expense': a => openExpense(a.dataset.id),
  'add-item': a => openItem(a.dataset.kind),
  'edit-item': a => openItem(a.dataset.kind, a.dataset.id),
  contribute: a => openContribute(a.dataset.id),
  month: a => {
    const t = ui.ym.y * 12 + ui.ym.m + Number(a.dataset.d), c = curYM();
    if (t > c.y * 12 + c.m) return;
    ui.ym = { y: Math.floor(t / 12), m: t % 12 };
    render();
  },
  filter: a => { ui.filter = a.dataset.v; render({ soft: true }); },
  bmode: a => { ui.bmode = a.dataset.v; render(); },
  year: a => { ui.year = Math.min(curYM().y, ui.year + Number(a.dataset.d)); render(); },
  'goto-month': a => { ui.ym = { y: ui.year, m: Number(a.dataset.m) }; ui.bmode = 'month'; render(); },
  'edit-name': () => openSheet({
    title: 'Ton prénom', autofocus: true, fields: [{ name: 'firstname', label: 'Prénom', value: S.get().name, placeholder: 'Ton prénom' }],
    onSubmit: v => { S.update(st => { st.name = v.firstname; }); render({ soft: true }); },
  }),
  'ob-next': () => { ui.step++; render(); },
  'ob-back': () => { ui.step--; render(); },
  'ob-finish': () => { S.update(st => { st.onboarded = true; }); ui.tab = 'home'; render(); },
  export: async () => {
    const r = await saveFile(`kakeibo-${iso(now())}.json`, S.exportJSON(), 'application/json');
    if (r === 'cancel') return;
    S.update(st => { st.lastBackup = iso(now()); });
    render({ soft: true });
    toast(r === 'shared' ? 'Sauvegarde envoyée' : 'Sauvegarde téléchargée');
  },
  'backup-later': () => { S.update(st => { st.backupSnooze = iso(new Date(Date.now() + 7 * 864e5)); }); render({ soft: true }); },
  fbudget: a => { ui.fbudget = a.dataset.v; render({ soft: true }); },
  csv: async () => {
    const st = S.get(), s = sumView();
    const bname = id => (st.budgets.find(b => b.id === id) || {}).label || '';
    const rows = [['Date', 'Type', 'Montant', 'Budget', 'Note'], ...s.items.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, TYPES[e.type].label, String(e.amount).replace('.', ','), bname(e.budget), e.label || ''])];
    const text = '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const r = await saveFile(`kakeibo-${s.key}.csv`, text, 'text/csv');
    if (r !== 'cancel') toast('Export du mois créé');
  },
  closure: a => openClosure(a.dataset.key),
  'skip-today': () => { S.update(st => { st.reminder.skip = iso(now()); }); render({ soft: true }); },
  'edit-startday': () => openSheet({
    title: 'Mon mois', message: 'Payé le 28 ? Ton mois de budget peut aller du 28 au 27. Laisse vide pour suivre le mois civil.',
    fields: [{ name: 'day', label: 'Le mois commence le', type: 'day', optional: true, value: sd() > 1 ? sd() : '', placeholder: '1 = mois civil' }],
    onSubmit: v => {
      const d = v.day || 1;
      if (d > 28) { toast('Choisis un jour entre 1 et 28'); return false; }
      S.update(st => { st.startDay = d; });
      ui.ym = curYM(); ui.year = ui.ym.y;
      render({ soft: true });
    },
  }),
  'edit-reminder': () => {
    const r = S.get().reminder;
    openSheet({
      title: 'Rappel quotidien',
      message: 'Un bandeau t’invite à noter tes dépenses si tu n’as rien saisi aujourd’hui. Pour une vraie notification, même app fermée, ajoute ensuite le rappel à ton calendrier.',
      fields: [
        { name: 'on', label: 'Rappel', type: 'choice', value: r.on ? 'on' : 'off', options: [{ value: 'on', label: 'Activé' }, { value: 'off', label: 'Désactivé' }] },
        { name: 'time', label: 'Heure', type: 'time', value: r.time || '20:00' },
      ],
      onSubmit: v => { S.update(st => { st.reminder = { on: v.on === 'on', time: v.time, skip: '' }; }); render({ soft: true }); toast(v.on === 'on' ? `Rappel à ${v.time}` : 'Rappel désactivé'); },
    });
  },
  'reminder-ics': async () => {
    const r = S.get().reminder, t = now(), p = n => String(n).padStart(2, '0');
    const [h, m] = r.time.split(':');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kakeibo//FR', 'BEGIN:VEVENT', 'UID:kakeibo-rappel-quotidien@kakeibo',
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}T${h}${m}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
      'SUMMARY:Noter mes dépenses du jour (Kakeibo)', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Kakeibo : note tes dépenses du jour', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const res = await saveFile('rappel-kakeibo.ics', ics, 'text/calendar');
    if (res !== 'cancel') toast('Ouvre le fichier pour l’ajouter au calendrier');
  },
  import: () => document.getElementById('file').click(),
  reset: () => openSheet({
    title: 'Tout effacer ?', message: 'Toutes tes données (situation, dépenses, objectifs) seront supprimées définitivement.',
    submitLabel: 'Oui, tout effacer', fields: [],
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

document.addEventListener('input', e => {
  if (e.target.id === 'q') {
    ui.q = e.target.value;
    const l = document.getElementById('jlist');
    if (l) l.innerHTML = journalList();
    return;
  }
  if (e.target.id !== 'name') return;
  const v = e.target.value.trim();
  S.update(st => { st.name = v; });
  const b = document.querySelector('[data-act=ob-next]');
  if (b) b.disabled = !v;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'name' && e.target.value.trim()) { e.preventDefault(); e.target.blur(); ACTIONS['ob-next'](); }
});

// Rappel quotidien : surveille l'heure, et le changement de jour / de période
let lastDue = false, lastDay = iso(now());
function tick() {
  if (!S.get().onboarded) return;
  const d = reminderDue(), today = iso(now());
  if (today !== lastDay) { lastDay = today; ui.ym = curYM(); ui.year = ui.ym.y; render({ soft: true }); lastDue = d; return; }
  if (d !== lastDue) { lastDue = d; if (ui.tab === 'home') render({ soft: true }); }
}
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

(async () => {
  const restored = await S.init();
  ui.ym = curYM(); ui.year = ui.ym.y;
  lastDue = reminderDue();
  render();
  if (restored) toast('Données restaurées depuis la copie de secours');
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
