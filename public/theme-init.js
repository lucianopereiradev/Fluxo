// Applies the saved theme and privacy mode before the first paint (no flash of the wrong theme).
// Kept as an external file so the Content Security Policy needs no inline scripts.
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('fluxo:ui') || '{}').state || {};
    var theme = saved.theme || 'system';
    if (theme === 'system') {
      theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme;
    if (saved.privacy) document.documentElement.classList.add('privacy-on');
    var lang = localStorage.getItem('fluxo:lang') || navigator.language || 'en';
    document.documentElement.lang = /^pt/i.test(lang) ? 'pt-BR' : 'en';
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();
