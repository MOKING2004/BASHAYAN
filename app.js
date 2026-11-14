/* ============================================================
   Life Catalog — App Logic
   ============================================================ */
'use strict';

/* ---------- Utilities ---------- */
const nf    = new Intl.NumberFormat('en-US');
const faNum = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const fmtNum = n => nf.format(Number(n) || 0);

const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

const norm = s => String(s)
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .trim();

/* ---------- Category Icons ---------- */
const ICONS = {
  'برودتی':            '❄️',
  'جارو برقی':          '🧹',
  'فر و مایکروفر':      '🍞',
  'لوازم کوچک':         '⚡',
  'صوتی و تصویری':      '📺',
  'لباسشویی':           '👕',
  'شستشو':              '💧',
  'ظرفشویی':            '🍽️',
  'سرمایشی و گرمایشی':  '🌡️',
  'آشپزخانه و هود':     '🍳',
};

/* ---------- DOM refs ---------- */
const $ = id => document.getElementById(id);
const heroEl   = $('hero');
const chipsEl  = $('chips');
const gridEl   = $('grid');
const emptyEl  = $('empty');
const countEl  = $('count');
const sortEl   = $('sort');
const qEl      = $('q');
const searchEl = $('search');
const clearQ   = $('clearQ');
const searchBtn= $('searchBtn');
const themeBtn = $('themeBtn');
const toTopBtn = $('toTop');
const toastEl  = $('toast');
const resetBtn = $('resetBtn');

/* ---------- State ---------- */
let state = { cat: null, sub: null, q: '', sort: 'default' };
let searchTimer = null;
let toastTimer  = null;
let firstRender = true;

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#000000' : '#f5f5f7');
}

(function initTheme() {
  const saved = localStorage.getItem('life_theme');
  const sys   = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || sys);

  themeBtn.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('life_theme', next);
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('life_theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
})();

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, isUpdate = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('update', isUpdate);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), isUpdate ? 4200 : 1800);
}

/* ============================================================
   CLIPBOARD
   ============================================================ */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* fallthrough */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/* ============================================================
   HERO
   ============================================================ */
const CAT_COUNTS = PRODUCTS.reduce((a, p) => (a[p.c] = (a[p.c] || 0) + 1, a), {});

function renderHero() {
  heroEl.innerHTML = CATEGORIES.map(cat => `
    <button type="button" class="hero-card${state.cat === cat ? ' active' : ''}" data-cat="${esc(cat)}">
      <span class="hero-ico">${ICONS[cat] || '📦'}</span>
      <span class="hero-name">${esc(cat)}</span>
      <span class="hero-count">${faNum(CAT_COUNTS[cat] || 0)} کالا</span>
    </button>`).join('');
}

function syncHeroActive() {
  heroEl.querySelectorAll('.hero-card').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === state.cat)
  );
}

/* ============================================================
   CHIPS
   ============================================================ */
function renderChips() {
  if (!state.cat) { chipsEl.innerHTML = ''; return; }
  const subs = SUB_CATEGORIES[state.cat] || [];
  chipsEl.innerHTML =
    `<button type="button" class="chip${!state.sub ? ' active' : ''}" data-sub="">همه</button>` +
    subs.map(s => `<button type="button" class="chip${state.sub === s ? ' active' : ''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('');
}

/* ============================================================
   FILTER + SORT
   ============================================================ */
function getFiltered() {
  let list = PRODUCTS;
  if (state.cat) list = list.filter(p => p.c === state.cat);
  if (state.sub) list = list.filter(p => p.s === state.sub);

  if (state.q) {
    const q = norm(state.q);
    list = list.filter(p =>
      norm(p.n).includes(q)   ||
      norm(p.m).includes(q)   ||
      norm(p.col).includes(q) ||
      norm(p.c).includes(q)   ||
      norm(p.s).includes(q)
    );
  }

  if (state.sort === 'asc' || state.sort === 'desc') {
    const dir = state.sort === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (a.p === 0 && b.p === 0) return a.id - b.id;
      if (a.p === 0) return 1;
      if (b.p === 0) return -1;
      const d = a.p - b.p;
      return d !== 0 ? d * dir : a.id - b.id;
    });
  }
  return list;
}

/* ============================================================
   GRID
   ============================================================ */
const COPY_SVG  = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

function cardHTML(p, i) {
  const delay = firstRender ? Math.min(i * 0.02, 0.18) : 0;
  const foot = p.p > 0
    ? `<div class="price"><span class="num">${fmtNum(p.p)}</span><span class="unit">تومان</span></div>
       <button type="button" class="copy-btn" data-copy="${p.p}" aria-label="کپی قیمت">${COPY_SVG}کپی</button>`
    : `<div class="price"><span class="num" style="color:var(--text-3);font-size:13px;font-weight:500">استعلام قیمت</span></div>`;

  return `<article class="card" style="--delay:${delay}s">
    <span class="card-cat">${esc(p.c)}</span>
    <h3 class="card-title">${esc(p.n)}</h3>
    <div class="card-meta">
      <span class="color-dot" style="--c:${p.hex}"></span>
      <span>${esc(p.col)}</span>
      <span class="dot-sep"></span>
      <span>مدل ${esc(p.m)}</span>
    </div>
    <div class="card-foot">${foot}</div>
  </article>`;
}

function renderGrid() {
  const list = getFiltered();
  countEl.textContent = faNum(list.length);

  if (!list.length) {
    gridEl.innerHTML = '';
    emptyEl.hidden = false;
    firstRender = false;
    return;
  }
  emptyEl.hidden = true;
  gridEl.innerHTML = list.map(cardHTML).join('');
  firstRender = false;
}

/* ============================================================
   EVENTS
   ============================================================ */

/* Hero click */
heroEl.addEventListener('click', e => {
  const btn = e.target.closest('.hero-card');
  if (!btn) return;
  const cat = btn.dataset.cat;

  if (state.cat === cat) {
    state.cat = null;
    state.sub = null;
  } else {
    state.cat = cat;
    state.sub = null;
  }
  syncHeroActive();
  renderChips();
  renderGrid();
});

/* Chips click */
chipsEl.addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  state.sub = btn.dataset.sub || null;
  renderChips();
  renderGrid();
});

/* Sort click */
sortEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-sort]');
  if (!btn) return;
  state.sort = btn.dataset.sort;
  sortEl.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b === btn)
  );
  renderGrid();
});

/* Copy (delegation on grid) */
gridEl.addEventListener('click', async e => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  const price = Number(btn.dataset.copy);
  const ok = await copyText(fmtNum(price) + ' تومان');
  if (!ok) { showToast('کپی نشد'); return; }

  btn.classList.add('copied');
  btn.innerHTML = CHECK_SVG + 'کپی شد';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = COPY_SVG + 'کپی';
  }, 1500);
  showToast('قیمت کپی شد');
});

/* Search */
searchBtn.addEventListener('click', () => {
  const open = document.body.classList.toggle('search-open');
  searchBtn.setAttribute('aria-expanded', open);
  if (open) setTimeout(() => qEl.focus({ preventScroll: true }), 350);
});

qEl.addEventListener('input', () => {
  searchEl.classList.toggle('has-value', qEl.value.trim().length > 0);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = qEl.value.trim();
    renderGrid();
  }, 120);
});

qEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    qEl.value = '';
    qEl.dispatchEvent(new Event('input'));
    document.body.classList.remove('search-open');
    searchBtn.setAttribute('aria-expanded', 'false');
  }
});

clearQ.addEventListener('click', () => {
  qEl.value = '';
  qEl.dispatchEvent(new Event('input'));
  qEl.focus();
});

/* Reset */
resetBtn.addEventListener('click', () => {
  state = { cat: null, sub: null, q: '', sort: 'default' };
  qEl.value = '';
  searchEl.classList.remove('has-value');
  document.body.classList.remove('search-open');
  searchBtn.setAttribute('aria-expanded', 'false');
  sortEl.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === 'default')
  );
  syncHeroActive();
  renderChips();
  renderGrid();
});

/* Back to top */
window.addEventListener('scroll', () => {
  toTopBtn.classList.toggle('show', window.scrollY > 500);
}, { passive: true });

toTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ============================================================
   UPDATE NOTIFICATION
   ============================================================ */
(function checkUpdate() {
  const KEY  = 'life_data_version';
  const last = localStorage.getItem(KEY);

  if (last && last !== DATA_VERSION) {
    setTimeout(() => showToast('✨ لیست قیمت‌ها به‌روزرسانی شد', true), 900);
  }
  localStorage.setItem(KEY, DATA_VERSION);

  const ver = $('verLine');
  if (ver) ver.textContent = `نسخه ${DATA_VERSION} · ${DATA_UPDATED}`;
})();

/* ============================================================
   INIT
   ============================================================ */
renderHero();
renderChips();
renderGrid();

/* ---------- Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}
