(function () {
  var KEY = 'pos_theme';

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function setTheme(mode) {
    if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(KEY, mode);
    } catch (e) {}
    updateToggleButton();
    window.dispatchEvent(new CustomEvent('posthemechange', { detail: { theme: mode } }));
  }

  function toggleTheme() {
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  }

  function updateToggleButton() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var light = getTheme() === 'light';
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    btn.title = light ? 'Switch to dark mode' : 'Switch to light mode';
    btn.setAttribute('aria-label', btn.title);
  }

  window.getPosTheme = getTheme;
  window.setPosTheme = setTheme;

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
    updateToggleButton();
  });
})();
