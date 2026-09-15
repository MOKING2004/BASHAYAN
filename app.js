/* ================================================================
   باشایان | نسخه فروشنده
   فایل منطق اصلی اپلیکیشن — نسخه نهایی اصلاح‌شده
   طراحی از محمدمهدی کوشکی
   ================================================================ */

(function () {
  'use strict';

  /* ============================================================
     بخش ۱: متغیرهای عمومی
     ============================================================ */

  const CONFIG = APP_CONFIG;
  const STORE = CONFIG.storage;

  let state = {
    activeTab: 'all',
    searchTerm: '',
    viewMode: 'table',
    theme: 'light',
    compareList: [],
    currentCartId: null,
    carts: {},
    toastTimer: null,
    searchTimer: null
  };

  /* ============================================================
     بخش ۲: توابع کمکی
     ============================================================ */

  function faNum(num) {
    if (num === undefined || num === null || isNaN(num)) return '۰';
    return Number(num).toLocaleString('fa-IR');
  }

  function calcBajet(base) {
    if (!base) return 0;
    return Math.round((base * CONFIG.installments.bajet.rate) / CONFIG.installments.bajet.months);
  }

  function calcAvand(base) {
    if (!base) return 0;
    return Math.round((base * CONFIG.installments.avand.rate) / CONFIG.installments.avand.months);
  }

  function getBase(item) {
    return (typeof item.b === 'number') ? item.b : item.p;
  }

  function itemId(item) {
    return 'p_' + item.n.replace(/\s+/g, '_').replace(/[^\u0600-\u06FFa-zA-Z0-9_]/g, '');
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('خطا در ذخیره‌سازی:', e);
    }
  }

  function load(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('خطا در بازیابی:', e);
      return defaultValue;
    }
  }

  function setRollingText(el, text) {
    if (!el) return;
    el.classList.remove('rolling');
    void el.offsetWidth;
    el.textContent = text;
    el.classList.add('rolling');
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ============================================================
     بخش ۳: Toast
     ============================================================ */

  function toast(message, type) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;

    if (state.toastTimer) clearTimeout(state.toastTimer);

    toastEl.textContent = message;
    toastEl.className = 'toast';
    if (type === 'success') toastEl.classList.add('success');
    if (type === 'error') toastEl.classList.add('error');

    requestAnimationFrame(function () {
      toastEl.classList.add('show');
    });

    state.toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2500);
  }

  /* ============================================================
     بخش ۴: تم
     ============================================================ */

  function initTheme() {
    const saved = load(STORE.theme, 'light');
    state.theme = saved;
    applyTheme(saved);
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', '#000000');
    } else {
      document.documentElement.removeAttribute('data-theme');
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', '#0f172a');
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    save(STORE.theme, state.theme);
  }

  /* ============================================================
     بخش ۵: حالت نمایش
     ============================================================ */

  function initViewMode() {
    const saved = load(STORE.viewMode, 'table');
    state.viewMode = saved;
    updateViewToggleUI();
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    save(STORE.viewMode, mode);
    updateViewToggleUI();
    renderContent();
  }

  function updateViewToggleUI() {
    const btns = document.querySelectorAll('.view-btn');
    btns.forEach(function (btn) {
      if (btn.dataset.view === state.viewMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /* ============================================================
     بخش ۶: تب‌ها
     ============================================================ */

  function renderTabs() {
    const tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;

    let totalItems = 0;
    CATEGORIES.forEach(function (cat) {
      totalItems += cat.items.length;
    });

    const list = [{ id: 'all', name: 'همه', color: '#0f172a', icon: '🏠' }].concat(CATEGORIES);

    let html = '';
    list.forEach(function (cat) {
      const cnt = cat.id === 'all' ? totalItems : cat.items.length;
      const isActive = state.activeTab === cat.id;
      const inlineStyle = isActive
        ? 'background:' + cat.color + ';border-color:' + cat.color + ';color:#fff;'
        : '';
      const icon = cat.icon ? cat.icon + ' ' : '';

      html += '<button type="button" class="tab' + (isActive ? ' active' : '') + '"'
        + ' data-id="' + cat.id + '"'
        + ' style="' + inlineStyle + '">'
        + icon + cat.name
        + '<span class="cnt">' + faNum(cnt) + '</span>'
        + '</button>';
    });

    tabsEl.innerHTML = html;

    const btns = tabsEl.querySelectorAll('.tab');
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        state.activeTab = this.getAttribute('data-id');
        renderTabs();
        renderContent();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ============================================================
     بخش ۷: رندر جدول
     ============================================================ */

  function renderTableRow(item, cat) {
    const base = getBase(item);
    const hasDiff = typeof item.b === 'number';
    const id = itemId(item);

    let priceHtml;
    if (hasDiff) {
      priceHtml = '<span class="old">' + faNum(item.b) + '</span>' + faNum(item.p);
    } else {
      priceHtml = faNum(item.p);
    }

    const badge = item.badge ? '<span class="badge">نقدی ویژه</span>' : '';
    const note = hasDiff
      ? '<small>بر اساس قیمت لیست (' + faNum(base) + ')</small>'
      : '<small>تومان</small>';

    const isCompared = state.compareList.indexOf(id) !== -1;
    const isInCart = isItemInCart(item.n);

    const nameSafe = escapeAttr(item.n);
    const featSafe = escapeAttr(stripHtml(item.k));

    return '<tr>'
      + '<td><div class="compare-check' + (isCompared ? ' checked' : '') + '" data-cmp-id="' + id + '" role="checkbox" aria-label="افزودن به مقایسه" tabindex="0"></div></td>'
      + '<td class="p-cell">'
        + '<div class="p-name">'
          + '<span class="copyable" data-copy="' + nameSafe + '">' + item.n + '</span>'
          + badge
          + '<button type="button" class="focus-btn" data-focus-id="' + id + '" aria-label="مشاهده جزئیات" title="مشاهده جزئیات">👁️</button>'
        + '</div>'
      + '</td>'
      + '<td class="p-feat-cell">'
        + '<div class="p-feat copyable" data-copy="' + featSafe + '">' + item.k + '</div>'
      + '</td>'
      + '<td class="p-price">'
        + '<span class="copyable" data-copy="' + item.p + '">' + priceHtml + '</span>'
      + '</td>'
      + '<td class="p-bajet">'
        + '<span class="copyable" data-copy="' + calcBajet(base) + '">' + faNum(calcBajet(base)) + '</span>'
        + note
      + '</td>'
      + '<td class="p-avand">'
        + '<span class="copyable" data-copy="' + calcAvand(base) + '">' + faNum(calcAvand(base)) + '</span>'
        + note
      + '</td>'
      + '<td>'
        + '<button type="button" class="add-btn' + (isInCart ? ' added' : '') + '"'
          + ' data-add-id="' + id + '">'
          + (isInCart ? '✓ در سبد' : '+ افزودن')
        + '</button>'
      + '</td>'
    + '</tr>';
  }

  function renderTable(cat, items) {
    const rows = items.map(function (item) {
      return renderTableRow(item, cat);
    }).join('');

    return '<div class="table-scroll"><table>'
      + '<thead><tr>'
      + '<th style="width:36px"></th>'
      + '<th style="width:26%">محصول</th>'
      + '<th style="width:28%">ویژگی‌ها</th>'
      + '<th style="width:13%">قیمت (تومان)</th>'
      + '<th style="width:13%">قسط ۲۴ ماهه<br><small>باجت</small></th>'
      + '<th style="width:13%">قسط ۱۸ ماهه<br><small>آوند</small></th>'
      + '<th style="width:80px">سبد</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  /* ============================================================
     بخش ۸: رندر کارت
     ============================================================ */

  function renderCard(item, cat, index) {
    const base = getBase(item);
    const hasDiff = typeof item.b === 'number';
    const id = itemId(item);

    const isCompared = state.compareList.indexOf(id) !== -1;
    const isInCart = isItemInCart(item.n);

    let priceHtml;
    if (hasDiff) {
      priceHtml = '<span class="old">' + faNum(item.b) + '</span>' + faNum(item.p);
    } else {
      priceHtml = faNum(item.p);
    }

    const badge = item.badge ? '<span class="badge card-badge">نقدی ویژه</span>' : '';

    let imgHtml;
    if (item.img) {
      imgHtml = '<img class="card-image" src="' + item.img + '" alt="' + escapeAttr(item.n) + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div class="card-image-placeholder" style="display:none;">📦</div>';
    } else {
      imgHtml = '<div class="card-image-placeholder">📦</div>';
    }

    return '<div class="card" data-focus-id="' + id + '" style="animation-delay:' + (index * 30) + 'ms">'
      + '<div class="card-image-wrap">'
        + imgHtml
        + '<div class="compare-check' + (isCompared ? ' checked' : '') + '" data-cmp-id="' + id + '" role="checkbox" aria-label="مقایسه" tabindex="0"></div>'
        + badge
      + '</div>'
      + '<div class="card-body">'
        + '<div class="card-title">' + item.n + '</div>'
        + '<div class="card-feat">' + stripHtml(item.k) + '</div>'
        + '<div class="card-prices">'
          + '<div class="card-price">' + priceHtml + '</div>'
          + '<div class="card-installments">'
            + '<div class="inst bajet">باجت ' + faNum(calcBajet(base)) + '</div>'
            + '<div class="inst avand">آوند ' + faNum(calcAvand(base)) + '</div>'
          + '</div>'
          + '<button type="button" class="card-add-btn' + (isInCart ? ' added' : '') + '" data-add-id="' + id + '">'
            + (isInCart ? '✓ در سبد' : '+ افزودن به سبد')
          + '</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function renderCards(cat, items) {
    const cards = items.map(function (item, i) {
      return renderCard(item, cat, i);
    }).join('');

    return '<div class="cards-grid">' + cards + '</div>';
  }

  /* ============================================================
     بخش ۹: رندر کارت دسته
     ============================================================ */

  function renderCategoryCard(cat, itemsOverride) {
    const items = itemsOverride || cat.items;
    const headStyle = 'background:linear-gradient(135deg,' + cat.color + ' 0%,' + shade(cat.color, -25) + ' 100%)';
    const icon = cat.icon ? cat.icon + ' ' : '';

    let bodyHtml;
    if (state.viewMode === 'card') {
      bodyHtml = renderCards(cat, items);
    } else {
      bodyHtml = renderTable(cat, items);
    }

    return '<section class="cat" data-cat="' + cat.id + '">'
      + '<div class="cat-head" style="' + headStyle + '">'
        + '<h2>' + icon + cat.name + '</h2>'
        + '<span class="cnt-pill">' + faNum(items.length) + ' کالا</span>'
      + '</div>'
      + bodyHtml
    + '</section>';
  }

  function shade(hex, percent) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + percent;
    let g = ((n >> 8) & 0xff) + percent;
    let b = (n & 0xff) + percent;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ============================================================
     بخش ۱۰: رندر محتوا
     ============================================================ */

  function renderContent() {
    const content = document.getElementById('content');
    if (!content) return;

    const q = state.searchTerm.trim().toLowerCase();

    if (q) {
      const grouped = {};
      const order = [];
      let totalMatches = 0;

      CATEGORIES.forEach(function (cat) {
        cat.items.forEach(function (it) {
          const plain = (it.n + ' ' + stripHtml(it.k)).toLowerCase();
          if (plain.indexOf(q) !== -1) {
            if (!grouped[cat.id]) {
              grouped[cat.id] = { cat: cat, items: [] };
              order.push(cat.id);
            }
            grouped[cat.id].items.push(it);
            totalMatches++;
          }
        });
      });

      if (totalMatches === 0) {
        content.innerHTML = '<div class="search-title">نتیجه‌ای برای «' + state.searchTerm + '» پیدا نشد.</div>';
        return;
      }

      let html = '<div class="search-title">' + faNum(totalMatches) + ' نتیجه برای «' + state.searchTerm + '»</div>';
      order.forEach(function (id) {
        html += renderCategoryCard(grouped[id].cat, grouped[id].items);
      });
      content.innerHTML = html;
      attachContentListeners();
      return;
    }

    if (state.activeTab === 'all') {
      let out = '';
      CATEGORIES.forEach(function (cat) {
        out += renderCategoryCard(cat);
      });
      content.innerHTML = out;
      attachContentListeners();
      return;
    }

    for (let i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === state.activeTab) {
        content.innerHTML = renderCategoryCard(CATEGORIES[i]);
        attachContentListeners();
        break;
      }
    }
  }

  /* ============================================================
     بخش ۱۱: جستجو
     ============================================================ */

  function initSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    if (!input) return;

    input.addEventListener('input', function (e) {
      if (state.searchTimer) clearTimeout(state.searchTimer);
      const value = e.target.value;

      if (value) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }

      state.searchTimer = setTimeout(function () {
        state.searchTerm = value;
        renderContent();
      }, CONFIG.searchDelay);
    });

    clearBtn.addEventListener('click', function () {
      input.value = '';
      state.searchTerm = '';
      clearBtn.classList.add('hidden');
      renderContent();
      input.focus();
    });
  }

  /* ============================================================
     بخش ۱۲: پیدا کردن محصول
     ============================================================ */

  function findItemById(id) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      for (let j = 0; j < cat.items.length; j++) {
        if (itemId(cat.items[j]) === id) {
          return { item: cat.items[j], category: cat };
        }
      }
    }
    return null;
  }

  /* ============================================================
     بخش ۱۳: Focus Mode
     ============================================================ */

  function openFocus(id) {
    const found = findItemById(id);
    if (!found) return;

    const item = found.item;
    const cat = found.category;
    const base = getBase(item);
    const hasDiff = typeof item.b === 'number';
    const isInCart = isItemInCart(item.n);
    const id2 = itemId(item);

    let imgHtml;
    if (item.img) {
      imgHtml = '<img class="focus-image" src="' + item.img + '" alt="' + escapeAttr(item.n) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div class="focus-image-placeholder" style="display:none;">📦</div>';
    } else {
      imgHtml = '<div class="focus-image-placeholder">📦</div>';
    }

    let priceHtml;
    if (hasDiff) {
      priceHtml = '<span class="old" style="display:block;font-size:12px;color:var(--muted);text-decoration:line-through;margin-bottom:2px;">' + faNum(item.b) + '</span>' + faNum(item.p);
    } else {
      priceHtml = faNum(item.p);
    }

    const html = ''
      + '<div class="focus-image-wrap">' + imgHtml + '</div>'
      + '<div class="focus-cat-badge" style="background:' + cat.color + ';">'
        + (cat.icon || '') + ' ' + cat.name
      + '</div>'
      + '<h2 class="focus-title copyable" data-copy="' + escapeAttr(item.n) + '">' + item.n + '</h2>'
      + '<div class="focus-features copyable" data-copy="' + escapeAttr(stripHtml(item.k)) + '">' + item.k + '</div>'
      + '<div class="focus-prices">'
        + '<div class="focus-price-row">'
          + '<span class="label">قیمت نقدی</span>'
          + '<span class="value copyable" data-copy="' + item.p + '">' + priceHtml + '</span>'
        + '</div>'
        + '<div class="focus-price-row bajet">'
          + '<span class="label">قسط ۲۴ ماهه (باجت)</span>'
          + '<span class="value copyable" data-copy="' + calcBajet(base) + '">' + faNum(calcBajet(base)) + ' تومان</span>'
        + '</div>'
        + '<div class="focus-price-row avand">'
          + '<span class="label">قسط ۱۸ ماهه (آوند)</span>'
          + '<span class="value copyable" data-copy="' + calcAvand(base) + '">' + faNum(calcAvand(base)) + ' تومان</span>'
        + '</div>'
      + '</div>'
      + '<button type="button" class="focus-add-btn' + (isInCart ? ' added' : '') + '" data-add-id="' + id2 + '">'
        + (isInCart ? '✓ در سبد' : '+ افزودن به سبد')
      + '</button>';

    const body = document.getElementById('focusBody');
    body.innerHTML = html;

    const modal = document.getElementById('focusModal');
    modal.classList.remove('hidden');
    requestAnimationFrame(function () {
      modal.classList.add('open');
    });
    modal.setAttribute('aria-hidden', 'false');
    showOverlay();

    attachCopyListeners(body);
    const addBtn = body.querySelector('[data-add-id]');
    if (addBtn) {
      addBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        addToCartById(this.dataset.addId, this);
      });
    }
  }

  function closeFocus() {
    const modal = document.getElementById('focusModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    hideOverlayIfNoOther();
  }

  /* ============================================================
     بخش ۱۴: مقایسه
     ============================================================ */

  function toggleCompare(id) {
    const index = state.compareList.indexOf(id);
    if (index === -1) {
      if (state.compareList.length >= CONFIG.maxCompare) {
        toast('حداکثر ' + faNum(CONFIG.maxCompare) + ' محصول می‌توانید مقایسه کنید', 'error');
        return;
      }
      state.compareList.push(id);
    } else {
      state.compareList.splice(index, 1);
    }
    saveCompare();
    updateCompareUI();
    updateCompareFloating();
  }

  function saveCompare() {
    save('bashayan_compare', state.compareList);
  }

  function loadCompare() {
    state.compareList = load('bashayan_compare', []);
  }

  function updateCompareUI() {
    document.querySelectorAll('[data-cmp-id]').forEach(function (el) {
      const id = el.dataset.cmpId;
      if (state.compareList.indexOf(id) !== -1) {
        el.classList.add('checked');
      } else {
        el.classList.remove('checked');
      }
    });
    updateCompareFloating();
  }

  function updateCompareFloating() {
    const floating = document.getElementById('compareFloating');
    const count = document.getElementById('compareCount');
    if (!floating) return;
    if (state.compareList.length === 0) {
      floating.classList.add('hidden');
      floating.classList.remove('show');
    } else {
      floating.classList.remove('hidden');
      requestAnimationFrame(function () {
        floating.classList.add('show');
      });
      count.textContent = faNum(state.compareList.length);
    }
  }

  function openCompare() {
    if (state.compareList.length === 0) {
      toast('ابتدا محصولاتی را برای مقایسه انتخاب کنید', 'error');
      return;
    }

    const items = [];
    state.compareList.forEach(function (id) {
      const found = findItemById(id);
      if (found) items.push(found);
    });

    if (items.length === 0) return;

    let minPrice = Infinity;
    items.forEach(function (f) {
      if (f.item.p < minPrice) minPrice = f.item.p;
    });

    let colsHtml = '';
    items.forEach(function (f) {
      const item = f.item;
      const cat = f.category;
      const base = getBase(item);

      let imgHtml;
      if (item.img) {
        imgHtml = '<img src="' + item.img + '" alt="' + escapeAttr(item.n) + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'📦\';">';
      } else {
        imgHtml = '📦';
      }

      const isBest = item.p === minPrice;
      const id = itemId(item);

      colsHtml += '<div class="compare-col' + (isBest ? ' highlight' : '') + '">'
        + '<div class="compare-col-head">'
          + '<div class="compare-col-img">' + imgHtml + '</div>'
          + '<div class="compare-col-title">' + item.n + '</div>'
          + '<button type="button" class="compare-col-remove" data-cmp-remove="' + id + '" aria-label="حذف از مقایسه">✕</button>'
        + '</div>'
        + '<div class="compare-row">'
          + '<span class="compare-row-label">دسته</span>'
          + '<span class="compare-row-value">' + (cat.icon || '') + ' ' + cat.name + '</span>'
        + '</div>'
        + '<div class="compare-row">'
          + '<span class="compare-row-label">قیمت</span>'
          + '<span class="compare-row-value">' + faNum(item.p) + ' تومان</span>'
        + '</div>'
        + '<div class="compare-row">'
          + '<span class="compare-row-label">قسط باجت</span>'
          + '<span class="compare-row-value">' + faNum(calcBajet(base)) + '</span>'
        + '</div>'
        + '<div class="compare-row">'
          + '<span class="compare-row-label">قسط آوند</span>'
          + '<span class="compare-row-value">' + faNum(calcAvand(base)) + '</span>'
        + '</div>'
        + '<div class="compare-row" style="flex-direction:column;gap:6px;">'
          + '<span class="compare-row-label">ویژگی‌ها</span>'
          + '<span class="compare-row-value" style="text-align:right;font-weight:500;font-size:11px;line-height:1.7;">' + item.k + '</span>'
        + '</div>'
        + '<button type="button" class="action-btn primary full" data-add-id="' + id + '">+ افزودن به سبد</button>'
      + '</div>';
    });

    const body = document.getElementById('compareBody');
    body.innerHTML = '<div class="compare-grid">' + colsHtml + '</div>';

    body.querySelectorAll('[data-cmp-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleCompare(this.dataset.cmpRemove);
        if (state.compareList.length === 0) {
          closeCompare();
        } else {
          openCompare();
        }
      });
    });

    body.querySelectorAll('[data-add-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addToCartById(this.dataset.addId, this);
      });
    });

    const modal = document.getElementById('compareModal');
    modal.classList.remove('hidden');
    requestAnimationFrame(function () {
      modal.classList.add('open');
    });
    modal.setAttribute('aria-hidden', 'false');
    showOverlay();
  }

  function closeCompare() {
    const modal = document.getElementById('compareModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    hideOverlayIfNoOther();
  }

  /* ============================================================
     بخش ۱۵: سبد خرید
     ============================================================ */

  function loadCarts() {
    state.carts = load(STORE.carts, {});
    state.currentCartId = load(STORE.activeCart, null);

    if (!state.currentCartId || !state.carts[state.currentCartId]) {
      const newId = 'cart_' + Date.now();
      state.carts[newId] = { name: 'سبد فعلی', items: [] };
      state.currentCartId = newId;
      saveCarts();
    }
  }

  function saveCarts() {
    save(STORE.carts, state.carts);
    save(STORE.activeCart, state.currentCartId);
  }

  function getCurrentCart() {
    return state.carts[state.currentCartId] || { name: 'سبد فعلی', items: [] };
  }

  function isItemInCart(name) {
    const cart = getCurrentCart();
    for (let i = 0; i < cart.items.length; i++) {
      if (cart.items[i].n === name) return true;
    }
    return false;
  }

  function addToCartById(id, btnEl) {
    const found = findItemById(id);
    if (!found) return;
    const item = found.item;
    const cat = found.category;
    const base = getBase(item);

    const cart = getCurrentCart();
    let existing = null;
    for (let i = 0; i < cart.items.length; i++) {
      if (cart.items[i].n === item.n) {
        existing = cart.items[i];
        break;
      }
    }

    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      cart.items.push({
        n: item.n,
        p: item.p,
        b: item.b || null,
        base: base,
        img: item.img || '',
        qty: 1,
        category: cat.name,
        color: cat.color
      });
    }

    saveCarts();
    updateCartUI();

    if (btnEl) {
      btnEl.classList.add('added');
      btnEl.textContent = '✓ اضافه شد';
      setTimeout(function () {
        btnEl.textContent = '✓ در سبد';
      }, 1200);
    }

    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
    }

    toast('به سبد اضافه شد ✓', 'success');
  }

  function changeQty(name, delta) {
    const cart = getCurrentCart();
    for (let i = 0; i < cart.items.length; i++) {
      if (cart.items[i].n === name) {
        cart.items[i].qty = (cart.items[i].qty || 1) + delta;
        if (cart.items[i].qty <= 0) {
          cart.items.splice(i, 1);
        }
        break;
      }
    }
    saveCarts();
    updateCartUI();
  }

  function removeFromCart(name) {
    const cart = getCurrentCart();
    for (let i = 0; i < cart.items.length; i++) {
      if (cart.items[i].n === name) {
        cart.items.splice(i, 1);
        break;
      }
    }
    saveCarts();
    updateCartUI();
    toast('از سبد حذف شد');
  }

  function clearCart() {
    if (!confirm('آیا مطمئنید می‌خواهید کل سبد را خالی کنید؟')) return;
    const cart = getCurrentCart();
    cart.items = [];
    saveCarts();
    updateCartUI();
    toast('سبد خالی شد');
  }

  function getCartTotals() {
    const cart = getCurrentCart();
    let cash = 0;
    let bajet = 0;
    let avand = 0;

    cart.items.forEach(function (it) {
      const qty = it.qty || 1;
      cash += it.p * qty;
      bajet += calcBajet(it.base) * qty;
      avand += calcAvand(it.base) * qty;
    });

    return { cash: cash, bajet: bajet, avand: avand, count: cart.items.length };
  }

  function updateCartUI() {
    const cart = getCurrentCart();
    const badge = document.getElementById('cartBadge');
    const floating = document.getElementById('floatingBar');
    const floatingCount = document.getElementById('floatingCount');
    const floatingTotal = document.getElementById('floatingTotal');

    if (badge) {
      badge.textContent = faNum(cart.items.length);
    }

    if (floating) {
      if (cart.items.length === 0) {
        floating.classList.add('hidden');
        floating.classList.remove('show');
      } else {
        floating.classList.remove('hidden');
        requestAnimationFrame(function () {
          floating.classList.add('show');
        });
      }
    }

    if (floatingCount) {
      floatingCount.textContent = faNum(cart.items.length) + ' محصول';
    }

    if (floatingTotal) {
      const totals = getCartTotals();
      floatingTotal.textContent = faNum(totals.cash) + ' تومان';
    }

    renderCartItems();

    // به‌روزرسانی دکمه‌های افزودن در جدول/کارت
    document.querySelectorAll('[data-add-id]').forEach(function (btn) {
      const found = findItemById(btn.dataset.addId);
      if (!found) return;
      const isCard = btn.classList.contains('card-add-btn');
      const defaultText = isCard ? '+ افزودن به سبد' : '+ افزودن';
      if (isItemInCart(found.item.n)) {
        btn.classList.add('added');
        btn.textContent = '✓ در سبد';
      } else {
        btn.classList.remove('added');
        btn.textContent = defaultText;
      }
    });
  }

  function renderCartItems() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    if (!container) return;

    const cart = getCurrentCart();

    if (cart.items.length === 0) {
      container.innerHTML = ''
        + '<div class="cart-empty">'
          + '<div class="cart-empty-icon">🛒</div>'
          + '<div class="cart-empty-title">سبد خرید شما خالی است</div>'
          + '<div class="cart-empty-text">برای افزودن، روی دکمه «+ افزودن» کنار هر محصول بزنید.</div>'
        + '</div>';
      if (footer) footer.classList.add('hidden');
      return;
    }

    if (footer) footer.classList.remove('hidden');

    let html = '';
    cart.items.forEach(function (it) {
      const qty = it.qty || 1;
      let imgHtml;
      if (it.img) {
        imgHtml = '<img src="' + it.img + '" alt="' + escapeAttr(it.n) + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'📦\';">';
      } else {
        imgHtml = '📦';
      }
      const nameSafe = escapeAttr(it.n);

      html += '<div class="cart-item">'
        + '<div class="cart-item-image">' + imgHtml + '</div>'
        + '<div class="cart-item-info">'
          + '<div class="cart-item-name">' + it.n + '</div>'
          + '<div class="cart-item-price">' + faNum(it.p) + ' تومان</div>'
        + '</div>'
        + '<div class="cart-item-actions">'
          + '<button type="button" class="qty-btn" data-qty-minus="' + nameSafe + '">−</button>'
          + '<span class="qty-value">' + faNum(qty) + '</span>'
          + '<button type="button" class="qty-btn" data-qty-plus="' + nameSafe + '">+</button>'
          + '<button type="button" class="remove-btn" data-remove="' + nameSafe + '" aria-label="حذف">🗑️</button>'
        + '</div>'
      + '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('[data-qty-plus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeQty(this.dataset.qtyPlus, 1);
      });
    });
    container.querySelectorAll('[data-qty-minus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeQty(this.dataset.qtyMinus, -1);
      });
    });
    container.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeFromCart(this.dataset.remove);
      });
    });

    const totals = getCartTotals();
    setRollingText(document.getElementById('summaryCash'), faNum(totals.cash) + ' تومان');
    setRollingText(document.getElementById('summaryBajet'), faNum(totals.bajet) + ' تومان');
    setRollingText(document.getElementById('summaryAvand'), faNum(totals.avand) + ' تومان');
  }

  /* ============================================================
     بخش ۱۶: سبدهای ذخیره‌شده
     ============================================================ */

  function openSavedCartsSheet() {
    const sheet = document.getElementById('savedCartsSheet');
    const listEl = document.getElementById('savedCartsList');

    const ids = Object.keys(state.carts);

    if (ids.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">سبدی ذخیره نشده است</div>';
    } else {
      let html = '';
      ids.forEach(function (id) {
        const cart = state.carts[id];
        const count = cart.items.length;
        const isActive = id === state.currentCartId;
        const nameSafe = escapeAttr(cart.name);
        html += '<div class="saved-cart-item' + (isActive ? ' active' : '') + '">'
          + '<div class="saved-cart-info" data-cart-switch="' + id + '">'
            + '<div class="saved-cart-name">' + cart.name + '</div>'
            + '<div class="saved-cart-meta">' + faNum(count) + ' محصول</div>'
          + '</div>'
          + '<button type="button" class="saved-cart-delete" data-cart-delete="' + id + '" aria-label="حذف">🗑️</button>'
        + '</div>';
      });
      listEl.innerHTML = html;

      listEl.querySelectorAll('[data-cart-switch]').forEach(function (el) {
        el.addEventListener('click', function () {
          switchCart(this.dataset.cartSwitch);
        });
      });

      listEl.querySelectorAll('[data-cart-delete]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteCart(this.dataset.cartDelete);
        });
      });
    }

    sheet.classList.remove('hidden');
    requestAnimationFrame(function () {
      sheet.classList.add('open');
    });
    sheet.setAttribute('aria-hidden', 'false');
    showOverlay();
  }

  function closeSavedCartsSheet() {
    const sheet = document.getElementById('savedCartsSheet');
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    hideOverlayIfNoOther();
  }

  function switchCart(id) {
    if (!state.carts[id]) return;
    state.currentCartId = id;
    saveCarts();
    updateCartUI();
    updateCurrentCartName();
    closeSavedCartsSheet();
    toast('سبد تغییر کرد', 'success');
  }

  function deleteCart(id) {
    if (Object.keys(state.carts).length <= 1) {
      toast('حداقل یک سبد باید باقی بماند', 'error');
      return;
    }
    if (!confirm('آیا این سبد حذف شود؟')) return;
    delete state.carts[id];
    if (state.currentCartId === id) {
      state.currentCartId = Object.keys(state.carts)[0];
    }
    saveCarts();
    updateCartUI();
    updateCurrentCartName();
    openSavedCartsSheet();
  }

  function createNewCart() {
    const name = prompt('نام سبد (مثلاً: آقای احمدی):');
    if (!name || !name.trim()) return;
    const id = 'cart_' + Date.now();
    state.carts[id] = { name: name.trim(), items: [] };
    state.currentCartId = id;
    saveCarts();
    updateCartUI();
    updateCurrentCartName();
    closeSavedCartsSheet();
    toast('سبد جدید ساخته شد', 'success');
  }

  function renameCurrentCart() {
    const cart = getCurrentCart();
    const name = prompt('نام جدید سبد:', cart.name);
    if (!name || !name.trim()) return;
    cart.name = name.trim();
    saveCarts();
    updateCurrentCartName();
    toast('نام سبد ذخیره شد', 'success');
  }

  function updateCurrentCartName() {
    const el = document.getElementById('currentCartName');
    if (el) el.textContent = getCurrentCart().name;
  }

  /* ============================================================
     بخش ۱۷: پیامک
     ============================================================ */

  function buildSmsText() {
    const cart = getCurrentCart();
    if (cart.items.length === 0) return '';

    const totals = getCartTotals();
    const today = new Date().toLocaleDateString('fa-IR');

    let text = CONFIG.sms.header + '\n';
    text += '━━━━━━━━━━━━━━━\n';
    text += 'تاریخ: ' + today + '\n';
    text += 'تعداد اقلام: ' + faNum(totals.count) + '\n\n';

    text += '🛒 اقلام سفارش:\n';
    cart.items.forEach(function (it, idx) {
      const qty = it.qty || 1;
      text += (idx + 1) + '. ' + it.n;
      if (qty > 1) text += ' (تعداد: ' + faNum(qty) + ')';
      text += '\n';
      text += '   قیمت: ' + faNum(it.p) + ' تومان\n';
    });

    text += '\n━━━━━━━━━━━━━━━\n';
    text += '💰 جمع نقدی: ' + faNum(totals.cash) + ' تومان\n';
    text += '📅 قسط ۲۴ ماهه (باجت): ' + faNum(totals.bajet) + ' تومان\n';
    text += '📅 قسط ۱۸ ماهه (آوند): ' + faNum(totals.avand) + ' تومان\n';
    text += '━━━━━━━━━━━━━━━\n';
    text += CONFIG.sms.taxNote + '\n';
    text += CONFIG.sms.footer + '\n';
    text += CONFIG.brandName + ' — ' + CONFIG.websiteLabel;

    return text;
  }

  function sendSms() {
    const cart = getCurrentCart();
    if (cart.items.length === 0) {
      toast('سبد خرید خالی است', 'error');
      return;
    }

    const text = buildSmsText();
    const encoded = encodeURIComponent(text);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? 'sms:&body=' + encoded
      : 'sms:?body=' + encoded;

    window.location.href = url;
    toast('در حال باز کردن پیام‌رسان...', 'success');
  }

  /* ============================================================
     بخش ۱۸: ماشین‌حساب
     ============================================================ */

  function openCalc() {
    const modal = document.getElementById('calcModal');
    modal.classList.remove('hidden');
    requestAnimationFrame(function () {
      modal.classList.add('open');
    });
    modal.setAttribute('aria-hidden', 'false');
    showOverlay();
    setTimeout(function () {
      document.getElementById('calcInput').focus();
    }, 300);
  }

  function closeCalc() {
    const modal = document.getElementById('calcModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    hideOverlayIfNoOther();
  }

  function initCalc() {
    const input = document.getElementById('calcInput');
    if (!input) return;

    input.addEventListener('input', function () {
      const val = this.value.replace(/[^\d]/g, '');
      this.value = val;

      const num = parseInt(val, 10);
      const bajetEl = document.getElementById('calcBajet');
      const avandEl = document.getElementById('calcAvand');

      if (!num || isNaN(num)) {
        bajetEl.textContent = '—';
        avandEl.textContent = '—';
        return;
      }

      bajetEl.textContent = faNum(calcBajet(num)) + ' تومان';
      avandEl.textContent = faNum(calcAvand(num)) + ' تومان';
    });

    document.querySelectorAll('.preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        input.value = this.dataset.preset;
        input.dispatchEvent(new Event('input'));
      });
    });
  }

  /* ============================================================
     بخش ۱۹: کپی با کلیک
     ============================================================ */

  function attachCopyListeners(root) {
    const scope = root || document;
    scope.querySelectorAll('.copyable').forEach(function (el) {
      if (el.dataset.copyBound === '1') return;
      el.dataset.copyBound = '1';

      el.addEventListener('click', function (e) {
        e.stopPropagation();
        const text = this.dataset.copy || this.textContent;
        copyText(text, this);
      });
    });
  }

  function copyText(text, sourceEl) {
    if (!text) return;

    const doCopy = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          document.body.removeChild(ta);
        }
      });
    };

    doCopy().then(function () {
      toast('کپی شد ✓', 'success');
      if (sourceEl) {
        sourceEl.classList.add('copied');
        setTimeout(function () {
          sourceEl.classList.remove('copied');
        }, 600);
      }
    }).catch(function () {
      toast('کپی نشد', 'error');
    });
  }

  /* ============================================================
     بخش ۲۰: Drawer سبد
     ============================================================ */

  function openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    drawer.classList.remove('hidden');
    requestAnimationFrame(function () {
      drawer.classList.add('open');
    });
    drawer.setAttribute('aria-hidden', 'false');
    showOverlay();
    updateCurrentCartName();
  }

  function closeCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    hideOverlayIfNoOther();
  }

  /* ============================================================
     بخش ۲۱: Overlay
     ============================================================ */

  function showOverlay() {
    const ov = document.getElementById('overlay');
    ov.classList.remove('hidden');
    requestAnimationFrame(function () {
      ov.classList.add('show');
    });
  }

  function hideOverlay() {
    const ov = document.getElementById('overlay');
    ov.classList.remove('show');
    setTimeout(function () {
      ov.classList.add('hidden');
    }, 300);
  }

  function hideOverlayIfNoOther() {
    const openPanel = document.querySelector('.drawer.open, .modal.open, .bottom-sheet.open');
    if (!openPanel) hideOverlay();
  }

  function closeAllPanels() {
    closeCartDrawer();
    closeFocus();
    closeCompare();
    closeCalc();
    closeSavedCartsSheet();
    closeAuthorSheet();
  }

  /* ============================================================
     بخش ۲۲: Bottom Sheet طراح
     ============================================================ */

  function openAuthorSheet() {
    const sheet = document.getElementById('authorSheet');
    sheet.classList.remove('hidden');
    requestAnimationFrame(function () {
      sheet.classList.add('open');
    });
    sheet.setAttribute('aria-hidden', 'false');
    showOverlay();
  }

  function closeAuthorSheet() {
    const sheet = document.getElementById('authorSheet');
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    hideOverlayIfNoOther();
  }

  /* ============================================================
     بخش ۲۳: اتصال رویدادها به محتوا
     ============================================================ */

  function attachContentListeners() {
    document.querySelectorAll('[data-cmp-id]').forEach(function (el) {
      if (el.dataset.bound === '1') return;
      el.dataset.bound = '1';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleCompare(this.dataset.cmpId);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCompare(this.dataset.cmpId);
        }
      });
    });

    document.querySelectorAll('[data-add-id]').forEach(function (el) {
      if (el.dataset.bound === '1') return;
      el.dataset.bound = '1';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        addToCartById(this.dataset.addId, this);
      });
    });

    document.querySelectorAll('[data-focus-id]').forEach(function (el) {
      if (el.dataset.bound === '1') return;
      el.dataset.bound = '1';
      el.addEventListener('click', function (e) {
        if (e.target.closest('.copyable') ||
            e.target.closest('[data-add-id]') ||
            e.target.closest('[data-cmp-id]') ||
            e.target.closest('.compare-check')) {
          return;
        }
        openFocus(this.dataset.focusId);
      });
    });

    attachCopyListeners(document);
  }

  /* ============================================================
     بخش ۲۴: راه‌اندازی رویدادهای هدر و پنل‌ها
     ============================================================ */

  function initEventListeners() {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    document.querySelectorAll('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setViewMode(this.dataset.view);
      });
    });

    const cartToggle = document.getElementById('cartToggle');
    if (cartToggle) cartToggle.addEventListener('click', openCartDrawer);

    const cartClose = document.getElementById('cartClose');
    if (cartClose) cartClose.addEventListener('click', closeCartDrawer);

    const floatingCartBtn = document.getElementById('floatingCartBtn');
    if (floatingCartBtn) floatingCartBtn.addEventListener('click', openCartDrawer);

    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    const smsCartBtn = document.getElementById('smsCartBtn');
    if (smsCartBtn) smsCartBtn.addEventListener('click', sendSms);

    const saveCartBtn = document.getElementById('saveCartBtn');
    if (saveCartBtn) saveCartBtn.addEventListener('click', renameCurrentCart);

    const savedCartsCurrent = document.getElementById('savedCartsCurrent');
    if (savedCartsCurrent) savedCartsCurrent.addEventListener('click', openSavedCartsSheet);

    const newCartBtn = document.getElementById('newCartBtn');
    if (newCartBtn) newCartBtn.addEventListener('click', createNewCart);

    const compareFloating = document.getElementById('compareFloating');
    if (compareFloating) compareFloating.addEventListener('click', openCompare);

    const floatingCompareBtn = document.getElementById('floatingCompareBtn');
    if (floatingCompareBtn) floatingCompareBtn.addEventListener('click', openCompare);

    const compareClose = document.getElementById('compareClose');
    if (compareClose) compareClose.addEventListener('click', closeCompare);

    const focusClose = document.getElementById('focusClose');
    if (focusClose) focusClose.addEventListener('click', closeFocus);

    const floatingCalcBtn = document.getElementById('floatingCalcBtn');
    if (floatingCalcBtn) floatingCalcBtn.addEventListener('click', openCalc);

    const calcClose = document.getElementById('calcClose');
    if (calcClose) calcClose.addEventListener('click', closeCalc);

    const designerLink = document.getElementById('designerLink');
    if (designerLink) designerLink.addEventListener('click', openAuthorSheet);

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.addEventListener('click', closeAllPanels);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllPanels();
    });
  }

  /* ============================================================
     بخش ۲۵: راه‌اندازی نهایی
     ============================================================ */

  function init() {
    initTheme();
    initViewMode();
    loadCarts();
    loadCompare();
    renderTabs();
    renderContent();
    initSearch();
    initCalc();
    initEventListeners();
    updateCartUI();
    updateCurrentCartName();
    updateCompareFloating();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
