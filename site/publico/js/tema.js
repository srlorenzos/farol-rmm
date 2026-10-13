// Aplica o tema salvo antes da pintura (evita piscar) e marca a página como "com JS" para as animações.
(function () {
  var raiz = document.documentElement;
  raiz.classList.add('js');
  var tema = 'dark';
  try { tema = localStorage.getItem('farol-site-tema') || 'dark'; } catch (e) { /* armazenamento indisponível */ }
  if (tema !== 'light' && tema !== 'dark') tema = 'dark';
  raiz.setAttribute('data-theme', tema);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'light' ? '#f3f6f7' : '#081217');
})();
