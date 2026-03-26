// Gallery Editor — activate with ?edit in URL or Cmd+Shift+/
(function() {
  var active = false;
  var selectedImg = null;
  var dragStart = null;
  var startPos = null;
  var toolbar, indicator;

  function getPositions() {
    var key = 'galleryPositions_' + location.pathname;
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch(e) { return {}; }
  }
  function savePositions(p) {
    localStorage.setItem('galleryPositions_' + location.pathname, JSON.stringify(p));
  }
  function applyPositions() {
    var p = getPositions();
    document.querySelectorAll('.item img').forEach(function(img) {
      var src = img.getAttribute('src');
      if (p[src]) img.style.objectPosition = p[src];
    });
  }

  function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.id = 'gallery-editor-toolbar';
    toolbar.innerHTML = '<span style="color:#d4956b;font-weight:600;">EDITOR MODE</span>' +
      '<span id="editor-hint" style="color:#999;font-size:0.55rem;">Click an image, then drag to reposition the crop</span>' +
      '<div style="display:flex;gap:8px;">' +
      '<button id="editor-reset-one" style="padding:4px 12px;background:#555;color:#fff;border:none;font-size:0.55rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;display:none;">Reset This</button>' +
      '<button id="editor-save" style="padding:4px 12px;background:#d4956b;color:#fff;border:none;font-size:0.55rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">Save</button>' +
      '<button id="editor-export" style="padding:4px 12px;background:transparent;color:#fff;border:1px solid #666;font-size:0.55rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">Export JSON</button>' +
      '<button id="editor-reset" style="padding:4px 12px;background:transparent;color:#999;border:1px solid #555;font-size:0.55rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">Reset All</button>' +
      '</div>';
    toolbar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1a1a1a;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:0.6rem;letter-spacing:2px;text-transform:uppercase;';
    document.body.appendChild(toolbar);

    indicator = document.createElement('div');
    indicator.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#d4956b;padding:8px 16px;border-radius:4px;font-family:sans-serif;font-size:0.6rem;letter-spacing:1px;z-index:9999;display:none;pointer-events:none;';
    document.body.appendChild(indicator);

    document.getElementById('editor-save').onclick = function() {
      indicator.textContent = 'Positions saved';
      indicator.style.display = 'block';
      setTimeout(function() { indicator.style.display = 'none'; }, 1500);
    };
    document.getElementById('editor-export').onclick = function() {
      var p = getPositions();
      var blob = new Blob([JSON.stringify(p, null, 2)], {type: 'application/json'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gallery-positions-' + location.pathname.replace(/\//g, '-').replace(/\.html/, '') + '.json';
      a.click();
    };
    document.getElementById('editor-reset').onclick = function() {
      if (confirm('Reset all image positions?')) {
        localStorage.removeItem('galleryPositions_' + location.pathname);
        document.querySelectorAll('.item img').forEach(function(img) { img.style.objectPosition = ''; });
        indicator.textContent = 'All positions reset';
        indicator.style.display = 'block';
        setTimeout(function() { indicator.style.display = 'none'; }, 1500);
      }
    };
    document.getElementById('editor-reset-one').onclick = function() {
      if (selectedImg) {
        selectedImg.style.objectPosition = '';
        var p = getPositions();
        delete p[selectedImg.getAttribute('src')];
        savePositions(p);
        indicator.textContent = 'Position reset';
        indicator.style.display = 'block';
        setTimeout(function() { indicator.style.display = 'none'; }, 1500);
      }
    };
  }

  function activate() {
    active = true;
    createToolbar();
    applyPositions();

    // Add outlines
    document.querySelectorAll('.item').forEach(function(item) {
      item.style.outline = '1px dashed rgba(212,149,107,0.3)';
      item.style.cursor = 'move';
    });

    // Click to select
    document.querySelectorAll('.item img').forEach(function(img) {
      img.addEventListener('mousedown', function(e) {
        e.preventDefault();
        selectedImg = img;
        dragStart = { x: e.clientX, y: e.clientY };
        var current = img.style.objectPosition || '50% 50%';
        var parts = current.split(' ');
        startPos = { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };

        // Highlight selected
        document.querySelectorAll('.item').forEach(function(i) { i.style.outline = '1px dashed rgba(212,149,107,0.3)'; });
        img.parentElement.style.outline = '2px solid #d4956b';
        document.getElementById('editor-reset-one').style.display = 'inline-block';

        indicator.textContent = 'Drag to reposition';
        indicator.style.display = 'block';
      });
    });

    document.addEventListener('mousemove', function(e) {
      if (!dragStart || !selectedImg) return;
      var dx = (e.clientX - dragStart.x) * 0.3;
      var dy = (e.clientY - dragStart.y) * 0.3;
      var newX = Math.max(0, Math.min(100, startPos.x + dx));
      var newY = Math.max(0, Math.min(100, startPos.y + dy));
      selectedImg.style.objectPosition = newX.toFixed(1) + '% ' + newY.toFixed(1) + '%';
      indicator.textContent = Math.round(newX) + '% ' + Math.round(newY) + '%';
      indicator.style.display = 'block';
    });

    document.addEventListener('mouseup', function() {
      if (dragStart && selectedImg) {
        var p = getPositions();
        p[selectedImg.getAttribute('src')] = selectedImg.style.objectPosition;
        savePositions(p);
        indicator.textContent = 'Saved: ' + selectedImg.style.objectPosition;
        setTimeout(function() { indicator.style.display = 'none'; }, 1000);
      }
      dragStart = null;
    });
  }

  // Auto-activate with ?edit
  if (location.search.includes('edit')) activate();

  // Keyboard shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '.' || e.key === '/')) {
      e.preventDefault();
      if (!active) activate();
      else {
        active = false;
        if (toolbar) toolbar.remove();
        if (indicator) indicator.remove();
        document.querySelectorAll('.item').forEach(function(i) { i.style.outline = ''; i.style.cursor = ''; });
      }
    }
  });

  // Always apply saved positions on load
  applyPositions();
})();
