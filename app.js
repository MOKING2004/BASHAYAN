/* ============================================================
   Bashayan Catalog — App Logic (Robust Version)
   ============================================================ */
'use strict';

const nf    = new Intl.NumberFormat('en-US');
const faNum = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const fmtNum = n => nf.format(Math.round(Number(n)) || 0);

const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

const norm = s => String(s)
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
  .replace(/\s+/g, ' ').toLowerCase().trim();

const ICONS = {
  'برودتی':'❄️','جارو برقی':'🧹','فر و مایکروفر':'🍞','لوازم کوچک':'⚡',
  'صوتی':'🔊','تصویری':'📺','لباسشویی':'👕','ظرفشویی':'🍽️',
  'سرمایشی و گرمایشی':'🌡️','آشپزخانه و هود':'🍳',
};

const $ = id => document.getElementById(id);
const heroEl = $('hero'), chipsEl = $('chips'), gridEl = $('grid'), emptyEl = $('empty');
const countEl = $('count'), sortEl = $('sort'), qEl = $('q'), searchEl = $('search');
const clearQ = $('clearQ'), searchBtn = $('searchBtn'), themeBtn = $('themeBtn');
const toTopBtn = $('toTop'), toastEl = $('toast'), resetBtn = $('resetBtn');

let state = { cat: null, sub: null, q: '', sort: 'default' };
let searchTimer = null, toastTimer = null, firstRender = true;

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#000000' : '#f5f5f7');
}
(function initTheme() {
  const saved = localStorage.getItem('bashayan_theme');
  const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || sys);
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('bashayan_theme', next);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('bashayan_theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
})();

function showToast(msg, isUpdate = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('update', isUpdate);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), isUpdate ? 4200 : 1800);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

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
    b.classList.toggle('active', b.dataset.cat === state.cat));
}
function renderChips() {
  if (!state.cat) { chipsEl.innerHTML = ''; return; }
  const subs = SUB_CATEGORIES[state.cat] || [];
  chipsEl.innerHTML =
    `<button type="button" class="chip${!state.sub ? ' active' : ''}" data-sub="">همه</button>` +
    subs.map(s => `<button type="button" class="chip${state.sub === s ? ' active' : ''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('');
}

function getFiltered() {
  let list = PRODUCTS;
  if (state.cat) list = list.filter(p => p.c === state.cat);
  if (state.sub) list = list.filter(p => p.s === state.sub);
  if (state.q) {
    const q = norm(state.q);
    list = list.filter(p => {
      const colorNames = (p.colors || []).map(c => c.name).join(' ') + (p.col || '');
      return norm(p.n).includes(q) || norm(p.m).includes(q) ||
             norm(colorNames).includes(q) || norm(p.c).includes(q) || norm(p.s).includes(q);
    });
  }
  if (state.sort === 'default') {
    if (state.cat === 'تصویری' || state.sub === 'تلویزیون' || state.cat === 'لباسشویی') {
      list = [...list].sort((a, b) => (a.spec || 0) - (b.spec || 0));
    }
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

const COPY_SVG  = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

function calcInstallments(p) {
  if (p <= 0) return '';
  const avand12 = p / 12;
  const avand18 = (p * 1.10) / 18;
  const budget24 = (p * 1.0545798) / 24;
  const ashnaDown = p / 2;
  const ashnaM = ashnaDown / 3;
  return `
    <details class="inst-box">
      <summary>💳 شرایط اقساط</summary>
      <div class="inst-grid">
        <div class="inst-row"><span>آوند ۱۲ ماهه:</span> <b>${fmtNum(avand12)}</b></div>
        <div class="inst-row"><span>آوند ۱۸ ماهه (۱۰٪):</span> <b>${fmtNum(avand18)}</b></div>
        <div class="inst-row"><span>باجت ۲۴ ماهه (۵.۴٪):</span> <b>${fmtNum(budget24)}</b></div>
        <div class="inst-row" style="border-top: 1px dashed var(--line); padding-top: 6px; margin-top: 2px;">
          <span>آشنایان ۳ ماهه:</span> <b>پیش‌پرداخت ${fmtNum(ashnaDown)} | ماهی ${fmtNum(ashnaM)}</b>
        </div>
      </div>
    </details>`;
}

function cardHTML(p, i) {
  const delay = firstRender ? Math.min(i * 0.02, 0.18) : 0;
  
  // Anti-Crash Code: Handles both old and new data structures
  let dotsHTML = '';
  if (p.colors && Array.isArray(p.colors)) {
    dotsHTML = p.colors.map(c => `<span class="color-dot" style="--c:${c.hex}" title="${esc(c.name)}"></span>`).join('');
  } else if (p.hex) {
    dotsHTML = `<span class="color-dot" style="--c:${p.hex}" title="${esc(p.col)}"></span>`;
  }

  const foot = p.p > 0
    ? `<div class="price"><span class="num">${fmtNum(p.p)}</span><span class="unit">تومان</span></div>
       <button type="button" class="copy-btn" data-copy="${p.p}" aria-label="کپی قیمت">${COPY_SVG}کپی</button>`
    : `<div class="price"><span class="num" style="color:var(--text-3);font-size:13px;font-weight:500">استعلام قیمت</span></div>`;

  return `<article class="card" style="--delay:${delay}s">
    <span class="card-cat">${esc(p.c)}</span>
    <h3 class="card-title">${esc(p.n)}</h3>
    <div class="card-meta">
      <div class="color-dots">${dotsHTML}</div>
      <span class="dot-sep"></span>
      <button type="button" class="model-copy" data-model="${esc(p.m)}" aria-label="کپی مدل">
        مدل ${esc(p.m)} ${COPY_SVG}
      </button>
    </div>
    <div class="card-foot">${foot}</div>
    ${calcInstallments(p.p)}
  </article>`;
}

function renderGrid() {
  const list = getFiltered();
  countEl.textContent = faNum(list.length);
  if (!list.length) {
    gridEl.innerHTML = ''; emptyEl.hidden = false; firstRender = false; return;
  }
  emptyEl.hidden = true;
  gridEl.innerHTML = list.map(cardHTML).join('');
  firstRender = false;
}

heroEl.addEventListener('click', e => {
  const btn = e.target.closest('.hero-card'); if (!btn) return;
  const cat = btn.dataset.cat;
  if (state.cat === cat) { state.cat = null; state.sub = null; }
  else { state.cat = cat; state.sub = null; }
  syncHeroActive(); renderChips(); renderGrid();
});
chipsEl.addEventListener('click', e => {
  const btn = e.target.closest('.chip'); if (!btn) return;
  state.sub = btn.dataset.sub || null;
  renderChips(); renderGrid();
});
sortEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-sort]'); if (!btn) return;
  state.sort = btn.dataset.sort;
  sortEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
  renderGrid();
});
gridEl.addEventListener('click', async e => {
  const priceBtn = e.target.closest('.copy-btn');
  if (priceBtn) {
    const price = Number(priceBtn.dataset.copy);
    const ok = await copyText(fmtNum(price) + ' تومان');
    if (!ok) { showToast('کپی نشد'); return; }
    priceBtn.classList.add('copied');
    priceBtn.innerHTML = CHECK_SVG + 'کپی شد';
    setTimeout(() => { priceBtn.classList.remove('copied'); priceBtn.innerHTML = COPY_SVG + 'کپی'; }, 1500);
    showToast('قیمت کپی شد');
    return;
  }
  const modelBtn = e.target.closest('.model-copy');
  if (modelBtn) {
    const model = modelBtn.dataset.model;
    const ok = await copyText(model);
    if (!ok) { showToast('کپی نشد'); return; }
    const originalHTML = modelBtn.innerHTML;
    modelBtn.classList.add('copied');
    modelBtn.innerHTML = CHECK_SVG + 'کپی شد';
    setTimeout(() => { modelBtn.classList.remove('copied'); modelBtn.innerHTML = originalHTML; }, 1500);
    showToast('مدل کپی شد');
  }
});

searchBtn.addEventListener('click', () => {
  const open = document.body.classList.toggle('search-open');
  searchBtn.setAttribute('aria-expanded', open);
  if (open) setTimeout(() => qEl.focus({ preventScroll: true }), 350);
});
qEl.addEventListener('input', () => {
  searchEl.classList.toggle('has-value', qEl.value.trim().length > 0);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = qEl.value.trim(); renderGrid(); }, 120);
});
qEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    qEl.value = ''; qEl.dispatchEvent(new Event('input'));
    document.body.classList.remove('search-open');
    searchBtn.setAttribute('aria-expanded', 'false');
  }
});
clearQ.addEventListener('click', () => {
  qEl.value = ''; qEl.dispatchEvent(new Event('input')); qEl.focus();
});
resetBtn.addEventListener('click', () => {
  state = { cat: null, sub: null, q: '', sort: 'default' };
  qEl.value = ''; searchEl.classList.remove('has-value');
  document.body.classList.remove('search-open');
  searchBtn.setAttribute('aria-expanded', 'false');
  sortEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.sort === 'default'));
  syncHeroActive(); renderChips(); renderGrid();
});
window.addEventListener('scroll', () => {
  toTopBtn.classList.toggle('show', window.scrollY > 500);
}, { passive: true });
toTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

(function checkUpdate() {
  const KEY = 'bashayan_data_version';
  const last = localStorage.getItem(KEY);
  if (last && last !== DATA_VERSION) {
    setTimeout(() => showToast('✨ لیست قیمت‌ها به‌روزرسانی شد', true), 900);
  }
  localStorage.setItem(KEY, DATA_VERSION);
  const ver = $('verLine');
  if (ver) ver.textContent = `نسخه ${DATA_VERSION} · ${DATA_UPDATED}`;
})();

renderHero();
renderChips();
renderGrid();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}
