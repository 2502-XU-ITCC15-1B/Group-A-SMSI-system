window.AppIcons = (() => {
  function icon(id, className = 'ui-icon') {
    const symbol = id.startsWith('ic-') ? id : `ic-${id}`;
    return `<svg class="${className}" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
  }

  async function load() {
    if (document.getElementById('icon-sprite')) return;

    const response = await fetch('/_icons.html').catch(() => null);
    if (!response?.ok) return;

    document.body.insertAdjacentHTML('afterbegin', await response.text());
  }

  document.addEventListener('DOMContentLoaded', load);

  return { icon, load };
})();
