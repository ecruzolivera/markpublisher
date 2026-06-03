(function() {
  var es = new EventSource('/live');
  var currentBootId = null;

  function saveReloadState() {
    try {
      var shells = document.querySelectorAll('.page-shell:not(.spacer)');
      var bestIdx = 0;
      var bestVisible = 0;
      var bestPageTop = 0;
      for (var i = 0; i < shells.length; i++) {
        var rect = shells[i].getBoundingClientRect();
        var visibleTop = Math.max(rect.top, 0);
        var visibleBottom = Math.min(rect.bottom, window.innerHeight);
        var visible = Math.max(0, visibleBottom - visibleTop);
        if (visible > bestVisible) {
          bestVisible = visible;
          bestIdx = i;
          bestPageTop = window.scrollY + rect.top;
        }
      }
      var state = {
        pageIndex: bestIdx,
        offsetWithinPage: Math.max(0, window.scrollY - bestPageTop)
      };
      sessionStorage.setItem('_mp_reload', JSON.stringify(state));
    } catch (_) {}
  }

  function saveToolbarState() {
    try {
      var spreadBtn = document.getElementById('tb-spread-facing');
      var state = {
        spreadMode: spreadBtn && spreadBtn.style.background === 'rgb(85, 85, 85)' ? 'facing' : 'single',
        zoom: parseFloat((document.getElementById('tb-zoom-slider') || {}).value || '100') / 100,
        zoomMode: (document.getElementById('tb-zoom-slider') || {}).value ? 'manual' : 'fit-width',
        colGap: parseInt((document.getElementById('tb-col-gap') || {}).value || '20'),
        rowGap: parseInt((document.getElementById('tb-row-gap') || {}).value || '20'),
        pageShadows: (document.getElementById('tb-shadows') || {}).checked !== false,
        startOnRight: (document.getElementById('tb-start-right') || {}).checked === true,
      };
      sessionStorage.setItem('_mp_toolbar', JSON.stringify(state));
    } catch (_) {}
  }

  function reloadPage() {
    saveReloadState();
    saveToolbarState();
    try { history.scrollRestoration = 'manual'; } catch (_) {}
    window.location.reload();
  }

  es.onmessage = function(e) {
    if (e.data === 'reload') {
      reloadPage();
    }
  };

  es.addEventListener('hello', function(e) {
    if (!currentBootId) {
      currentBootId = e.data;
      return;
    }

    if (currentBootId !== e.data) {
      currentBootId = e.data;
      reloadPage();
    }
  });
})();
