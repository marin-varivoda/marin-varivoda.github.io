(() => {
  const root = document.documentElement;
  const menu = document.querySelector('.accessibility');
  const toggle = menu.querySelector('.accessibility-toggle');
  const panel = document.getElementById('accessibility-options');
  const largerText = document.getElementById('larger-text');
  const highContrast = document.getElementById('high-contrast');
  const storageKey = 'marin-accessibility';

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || {};
    largerText.checked = saved.largerText === true;
    highContrast.checked = saved.highContrast === true;
  } catch (_) {  }

  function apply() {
    root.classList.toggle('larger-text', largerText.checked);
    root.classList.toggle('high-contrast', highContrast.checked);
  }

  function save() {
    apply();
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        largerText: largerText.checked,
        highContrast: highContrast.checked,
      }));
    } catch (_) {  }
  }

  largerText.addEventListener('change', save);
  highContrast.addEventListener('change', save);
  document.getElementById('reset-accessibility').addEventListener('click', () => {
    largerText.checked = false;
    highContrast.checked = false;
    save();
  });
  function setExpanded(expanded) {
    toggle.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
  }
  toggle.addEventListener('click', () => setExpanded(panel.hidden));
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setExpanded(false);
      toggle.focus();
      event.stopPropagation();
    }
  });
  apply();
  menu.hidden = false;
})();
