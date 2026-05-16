window.AppIcons = (() => {
  function icon(id, className = 'ui-icon') {
    const symbol = id.startsWith('ic-') ? id : `ic-${id}`;
    return `<svg class="${className}" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
  }

  async function load() {
    if (document.getElementById('icon-sprite')) return;

    const candidates = ['/_icons.html', '../_icons.html', './_icons.html', '_icons.html'];
    let response = null;
    for (const path of candidates) {
      try {
        response = await fetch(path);
        if (response && response.ok) break;
      } catch (e) {
        response = null;
      }
    }

    if (!response?.ok) return;

    document.body.insertAdjacentHTML('afterbegin', await response.text());
  }

  document.addEventListener('DOMContentLoaded', load);

  return { icon, load };
})();
