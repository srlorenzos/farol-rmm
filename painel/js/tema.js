// Aplica o tema salvo antes da primeira pintura (script clássico e síncrono; a CSP proíbe script inline).
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('farol:tema') || 'null');
    document.documentElement.dataset.theme = t === 'claro' ? 'light' : 'dark';
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
}());
