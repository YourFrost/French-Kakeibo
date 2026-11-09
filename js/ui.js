// Feuille modale (bottom sheet) générique + toast.
import { parseAmount } from './calc.js';

const root = document.getElementById('sheet-root');
const toastEl = document.getElementById('toast');

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

export function closeSheet() {
  root.classList.remove('open');
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 380);
}

function fieldHTML(f) {
  const id = `f_${f.name}`;
  const v = f.type === 'money' && f.value ? String(f.value).replace('.', ',') : (f.value ?? '');
  const label = f.label ? `<label for="${id}">${f.label}${f.optional ? ' <em>optionnel</em>' : ''}</label>` : '';
  let input;
  if (f.type === 'choice') {
    input = `<input type="hidden" name="${f.name}" value="${esc(v)}"><div class="choices" data-choice="${f.name}">${f.options.map(o =>
      `<button type="button" class="pill ch${o.value === v ? ' on' : ''}" data-v="${esc(o.value)}" ${o.color ? `style="--c:${o.color}"` : ''}>${esc(o.label)}</button>`).join('')}</div>`;
  } else if (f.type === 'money') {
    input = `<div class="money"><input id="${id}" name="${f.name}" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(v)}"><span>€</span></div>`;
  } else if (f.type === 'day') {
    input = `<input id="${id}" name="${f.name}" type="number" inputmode="numeric" min="1" max="31" placeholder="${esc(f.placeholder || '')}" value="${esc(v)}">`;
  } else {
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" autocomplete="off" placeholder="${esc(f.placeholder || '')}" value="${esc(v)}" ${f.list ? `list="${id}_l"` : ''}>`;
  }
  const list = f.list ? `<datalist id="${id}_l">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : '';
  const sugg = f.suggestions ? `<div class="sugg">${f.suggestions.map(s => `<button type="button" class="pill" data-fill="${f.name}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';
  return `<div class="field${f.type === 'money' ? ' big' : ''}${f.half ? ' half' : ''}">${label}${input}${list}${f.help ? `<p class="help">${f.help}</p>` : ''}${sugg}</div>`;
}

/**
 * cfg: { title, message?, fields[], submitters?[{label,value,cls,color}], noEnter?, onSubmit(values, submitterValue), onDelete? }
 */
function setField(form, name, value) {
  const el = form.elements[name];
  if (!el) return;
  el.value = value;
  form.querySelectorAll(`[data-choice="${name}"] .ch`).forEach(b => b.classList.toggle('on', b.dataset.v === value));
}

export function openSheet(cfg) {
  toastEl.classList.remove('show');
  const subs = cfg.submitters || [{ label: cfg.submitLabel || 'Enregistrer', value: 'ok', cls: 'primary' }];
  const typed = subs.length > 1;
  root.innerHTML = `<div class="backdrop"></div>
    <form class="sheet" novalidate>
      <div class="grab"></div>
      <h2>${cfg.title}</h2>
      ${cfg.message ? `<p class="msg">${cfg.message}</p>` : ''}
      ${cfg.presets ? `<div class="presets"><p class="pick">Idées rapides</p><div class="ptabs">${cfg.presets.map((g, i) => `<button type="button" class="ptab${i ? '' : ' on'}" data-g="${i}">${esc(g.name)}</button>`).join('')}</div><div class="sugg wrap pitems"></div></div>` : ''}
      <div class="fields">${(cfg.fields || []).map(fieldHTML).join('')}</div>
      ${typed ? '<p class="pick">Quel type de dépense ?</p>' : ''}
      <div class="actions${typed ? ' typed' : ''}">
        ${subs.map(s => `<button type="submit" value="${s.value}" class="btn ${s.cls || 'primary'}" ${s.color ? `style="--c:${s.color}"` : ''}>${s.label}${s.hint ? `<small>${s.hint}</small>` : ''}</button>`).join('')}
      </div>
      ${cfg.onDelete ? `<button type="button" class="btn ghost${cfg.deleteLabel ? '' : ' danger'}" data-del>${cfg.deleteLabel || 'Supprimer'}</button>` : ''}
    </form>`;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));

  const form = root.querySelector('form');
  const q = n => form.elements[n];
  root.querySelector('.backdrop').onclick = closeSheet;
  form.querySelectorAll('[data-fill]').forEach(b => b.onclick = () => { q(b.dataset.fill).value = b.dataset.v; q(b.dataset.fill).focus(); });
  form.querySelectorAll('.choices').forEach(box => box.addEventListener('click', e => {
    const b = e.target.closest('.ch'); if (!b) return;
    const name = box.dataset.choice, f = cfg.fields.find(x => x.name === name);
    setField(form, name, b.classList.contains('on') && f.optional ? '' : b.dataset.v);
  }));
  if (cfg.presets) {
    const items = form.querySelector('.pitems');
    const show = i => {
      form.querySelectorAll('.ptab').forEach(t => t.classList.toggle('on', t.dataset.g === String(i)));
      items.innerHTML = cfg.presets[i].items.map((it, j) => `<button type="button" class="pill" data-j="${j}">${esc(it.label)}</button>`).join('');
      items.querySelectorAll('.pill').forEach(p => p.onclick = () => {
        const it = cfg.presets[i].items[p.dataset.j];
        Object.entries(it).forEach(([k, v]) => setField(form, k, v));
        (form.elements.amount || form.elements.label).focus();
      });
    };
    form.querySelectorAll('.ptab').forEach(t => t.onclick = () => show(Number(t.dataset.g)));
    show(0);
  }
  if (cfg.onDelete) form.querySelector('[data-del]').onclick = () => { cfg.onDelete(); closeSheet(); };
  if (cfg.noEnter) form.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

  let last = subs[0].value;
  form.querySelectorAll('button[type=submit]').forEach(b => b.addEventListener('click', () => { last = b.value; }));

  form.onsubmit = e => {
    e.preventDefault();
    const values = {};
    let bad = null;
    for (const f of cfg.fields || []) {
      const raw = (q(f.name).value || '').trim();
      let val = raw;
      if (f.type === 'money') val = parseAmount(raw);
      else if (f.type === 'day') val = raw ? Math.round(Number(raw)) : null;
      const empty = f.type === 'money' ? !(val > 0) : (val === '' || val === null);
      if (empty && !f.optional) bad = bad || f.name;
      if (f.type === 'day' && val !== null && (val < 1 || val > 31)) bad = bad || f.name;
      values[f.name] = f.optional && empty ? (f.type === 'money' ? 0 : f.type === 'day' ? null : '') : val;
    }
    if (bad) {
      const el = q(bad).closest('.field');
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      q(bad).focus();
      return;
    }
    const fu = cfg.followUp && cfg.followUp(last);
    if (fu) { showFollow(fu, values, last); return; }
    if (cfg.onSubmit(values, last) !== false) closeSheet();
  };

  // Deuxième étape (ex. catégorie d'un plaisir) : remplace les boutons de type par des choix.
  function showFollow(fu, values, type) {
    const actions = form.querySelector('.actions'), pick = form.querySelector('.pick');
    const prev = pick ? pick.textContent : '';
    const box = document.createElement('div');
    box.className = 'actions follow';
    box.style.setProperty('--c', fu.color);
    box.innerHTML = fu.options.map(o => `<button type="button" class="btn opt${o.value === fu.current ? ' current' : ''}" data-o="${o.value}">${esc(o.label)}</button>`).join('')
      + '<button type="button" class="btn ghost back-step">← Changer de type</button>';
    actions.hidden = true;
    if (pick) pick.textContent = fu.prompt;
    actions.after(box);
    box.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (cfg.onSubmit(values, type, b.dataset.o) !== false) closeSheet(); });
    box.querySelector('.back-step').onclick = () => { box.remove(); actions.hidden = false; if (pick) pick.textContent = prev; };
  }

  setTimeout(() => { const first = form.querySelector('input'); if (first && cfg.focus !== false) first.focus(); }, 380);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('open')) closeSheet(); });
