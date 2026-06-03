(function() {
  const container = document.getElementById('pages-zoom-layer');
  let total = container.querySelectorAll('.page-shell:not(.spacer)').length;

  let state = {
    zoom: 1,
    zoomMode: 'fit-width',
    spreadMode: 'facing',
    colGap: 20,
    rowGap: 20,
    startOnRight: true,
    pageShadows: true,
    currentPage: 1,
  };

  let basePage = { width: 800, height: 1100 };

  function getShells() {
    return Array.from(container.querySelectorAll('.page-shell'));
  }

  function getRealShells() {
    return Array.from(container.querySelectorAll('.page-shell:not(.spacer)'));
  }

  function measureShellBase(shell, page) {
    const cachedWidth = parseFloat(shell.dataset.baseWidth || '0');
    const cachedHeight = parseFloat(shell.dataset.baseHeight || '0');
    if (cachedWidth > 0 && cachedHeight > 0) {
      return { width: cachedWidth, height: cachedHeight };
    }

    const prevTransform = page.style.transform;
    const prevOrigin = page.style.transformOrigin;
    const prevShellWidth = shell.style.width;
    const prevShellHeight = shell.style.height;

    page.style.transform = 'none';
    page.style.transformOrigin = '';
    shell.style.width = '';
    shell.style.height = '';

    const rect = page.getBoundingClientRect();
    const base = { width: rect.width, height: rect.height };

    shell.dataset.baseWidth = String(base.width);
    shell.dataset.baseHeight = String(base.height);

    page.style.transform = prevTransform;
    page.style.transformOrigin = prevOrigin;
    shell.style.width = prevShellWidth;
    shell.style.height = prevShellHeight;

    return base;
  }

  function measureBasePage() {
    const shell = container.querySelector('.page-shell:not(.spacer)');
    if (!shell) return;

    const page = shell.querySelector('.page');
    if (!page) return;

    const base = measureShellBase(shell, page);
    basePage.width = base.width;
    basePage.height = base.height;
  }

  const els = {
    zoomSlider: document.getElementById('tb-zoom-slider'),
    zoomLabel: document.getElementById('tb-zoom-label'),
    spreadSingle: document.getElementById('tb-spread-single'),
    spreadFacing: document.getElementById('tb-spread-facing'),
    colGap: document.getElementById('tb-col-gap'),
    rowGap: document.getElementById('tb-row-gap'),
    shadows: document.getElementById('tb-shadows'),
    startRight: document.getElementById('tb-start-right'),
    pageInput: document.getElementById('tb-page-input'),
    pageCount: document.getElementById('tb-page-count'),
  };

  function applyZoom() {
    getShells().forEach(shell => {
      const page = shell.querySelector('.page');
      if (!page) return;

      const base = measureShellBase(shell, page);
      shell.style.width = base.width * state.zoom + 'px';
      shell.style.height = base.height * state.zoom + 'px';
      page.style.transform = 'scale(' + state.zoom + ')';
      page.style.transformOrigin = 'top left';
    });

    els.zoomSlider.value = Math.round(state.zoom * 100);
    els.zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
  }

  function computeFitWidth() {
    measureBasePage();
    const pad = 40;
    const available = window.innerWidth - pad;

    if (state.spreadMode === 'facing') {
      const spreadWidth = basePage.width * 2 + state.colGap;
      return Math.max(0.1, Math.min(3, available / spreadWidth));
    }

    return Math.max(0.1, Math.min(3, available / basePage.width));
  }

  function computeFitPage() {
    measureBasePage();
    const toolbarH = 40;
    const pad = 40;
    const available = window.innerHeight - toolbarH - pad;
    return Math.max(0.1, Math.min(3, available / basePage.height));
  }

  function recomputeFit() {
    if (state.zoomMode === 'fit-width') {
      state.zoom = computeFitWidth();
      applyZoom();
    } else if (state.zoomMode === 'fit-page') {
      state.zoom = computeFitPage();
      applyZoom();
    }
  }

  function setZoom(mode) {
    state.zoomMode = mode;
    if (mode === 'fit-width') state.zoom = computeFitWidth();
    else if (mode === 'fit-page') state.zoom = computeFitPage();
    applyZoom();
  }

  function applySpread() {
    container.classList.remove('spread-single', 'spread-facing');
    container.classList.add('spread-' + state.spreadMode);

    document.querySelectorAll('.page-shell.spacer').forEach(s => s.remove());

    if (state.spreadMode === 'facing' && state.startOnRight) {
      const spacer = document.createElement('div');
      spacer.className = 'page-shell spacer';
      spacer.innerHTML = '<div class="page" style="width:210mm;height:297mm;"></div>';
      container.insertBefore(spacer, container.firstChild);
    }

    updatePageCount();
    recomputeFit();
    applyZoom();
  }

  function applyGaps() {
    document.documentElement.style.setProperty('--preview-col-gap', state.colGap + 'px');
    document.documentElement.style.setProperty('--preview-row-gap', state.rowGap + 'px');
    recomputeFit();
  }

  function applyShadows() {
    document.documentElement.style.setProperty(
      '--preview-page-shadow',
      state.pageShadows ? '0 2px 12px rgba(0,0,0,0.15)' : 'none'
    );
  }

  function updatePageCount() {
    total = getRealShells().length;
    els.pageCount.textContent = '/ ' + total;
  }

  function scrollToPage(n) {
    n = Math.max(1, Math.min(total, n));
    state.currentPage = n;
    const shellsAll = getRealShells();
    const target = shellsAll[n - 1];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    els.pageInput.value = n;
  }

  document.getElementById('tb-fit-width').onclick = () => setZoom('fit-width');
  document.getElementById('tb-fit-page').onclick = () => setZoom('fit-page');
  document.getElementById('tb-zoom-out').onclick = () => {
    state.zoomMode = 'manual';
    state.zoom = Math.max(0.1, state.zoom - 0.05);
    applyZoom();
  };
  document.getElementById('tb-zoom-in').onclick = () => {
    state.zoomMode = 'manual';
    state.zoom = Math.min(3, state.zoom + 0.05);
    applyZoom();
  };
  els.zoomSlider.oninput = () => {
    state.zoomMode = 'manual';
    state.zoom = parseFloat(els.zoomSlider.value) / 100;
    applyZoom();
  };

  els.spreadSingle.onclick = () => { state.spreadMode = 'single'; applySpread(); };
  els.spreadFacing.onclick = () => { state.spreadMode = 'facing'; applySpread(); };

  els.colGap.oninput = () => { state.colGap = parseInt(els.colGap.value); applyGaps(); };
  els.rowGap.oninput = () => { state.rowGap = parseInt(els.rowGap.value); applyGaps(); };
  els.shadows.onchange = () => { state.pageShadows = els.shadows.checked; applyShadows(); };
  els.startRight.onchange = () => { state.startOnRight = els.startRight.checked; applySpread(); };

  document.getElementById('tb-prev').onclick = () => {
    const step = state.spreadMode === 'facing' ? 2 : 1;
    scrollToPage(state.currentPage - step);
  };
  document.getElementById('tb-next').onclick = () => {
    const step = state.spreadMode === 'facing' ? 2 : 1;
    scrollToPage(state.currentPage + step);
  };
  els.pageInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const n = parseInt(els.pageInput.value);
      if (!isNaN(n)) scrollToPage(n);
    }
  };

  window.addEventListener('resize', () => recomputeFit());

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); document.getElementById('tb-prev').click(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('tb-next').click(); }
  });

  let observer = new IntersectionObserver((entries) => {
    let best = null;
    let bestRatio = 0;
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio;
        best = entry.target;
      }
    }
    if (best) {
      const all = getRealShells();
      const idx = all.indexOf(best);
      if (idx >= 0) {
        state.currentPage = idx + 1;
        els.pageInput.value = state.currentPage;
      }
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  getRealShells().forEach(s => observer.observe(s));

  function updateSpreadButtons() {
    els.spreadSingle.style.background = state.spreadMode === 'single' ? '#555' : '#444';
    els.spreadSingle.style.color = state.spreadMode === 'single' ? '#fff' : '#ddd';
    els.spreadFacing.style.background = state.spreadMode === 'facing' ? '#555' : '#444';
    els.spreadFacing.style.color = state.spreadMode === 'facing' ? '#fff' : '#ddd';
  }

  const origApplySpread = applySpread;
  applySpread = function() {
    origApplySpread();
    updateSpreadButtons();
  };

  container.classList.add('spread-facing');
  measureBasePage();
  applySpread();
  setZoom('fit-width');
  applyGaps();
  applyShadows();
  els.pageInput.value = '1';
  updatePageCount();
  updateSpreadButtons();

  function restoreToolbarState() {
    try {
      var raw = sessionStorage.getItem('_mp_toolbar');
      sessionStorage.removeItem('_mp_toolbar');
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved.spreadMode) state.spreadMode = saved.spreadMode;
      if (typeof saved.zoom === 'number') {
        state.zoom = saved.zoom;
        state.zoomMode = saved.zoomMode || 'manual';
      }
      if (typeof saved.colGap === 'number') state.colGap = saved.colGap;
      if (typeof saved.rowGap === 'number') state.rowGap = saved.rowGap;
      if (typeof saved.pageShadows === 'boolean') state.pageShadows = saved.pageShadows;
      if (typeof saved.startOnRight === 'boolean') state.startOnRight = saved.startOnRight;

      applySpread();
      applyZoom();
      els.zoomSlider.value = Math.round(state.zoom * 100);
      els.zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
      els.colGap.value = state.colGap;
      els.rowGap.value = state.rowGap;
      els.shadows.checked = state.pageShadows;
      els.startRight.checked = state.startOnRight;
      applyGaps();
      applyShadows();
      updateSpreadButtons();
    } catch (_) {}
  }

  restoreToolbarState();

  function restoreSavedScroll() {
    try {
      var raw = sessionStorage.getItem('_mp_reload');
      sessionStorage.removeItem('_mp_reload');
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (typeof saved.pageIndex !== 'number') return;
      var shells = getRealShells();
      if (!shells.length) return;
      var idx = Math.max(0, Math.min(saved.pageIndex, shells.length - 1));
      var target = shells[idx];
      var pageTop = window.scrollY + target.getBoundingClientRect().top;
      var top = pageTop + (saved.offsetWithinPage || 0);
      window.scrollTo({ top: top, behavior: 'auto' });
      state.currentPage = idx + 1;
      els.pageInput.value = state.currentPage;
    } catch (_) {}
    try { history.scrollRestoration = 'auto'; } catch (_) {}
  }

  restoreSavedScroll();

  requestAnimationFrame(function() {
    restoreSavedScroll();
  });
})();
