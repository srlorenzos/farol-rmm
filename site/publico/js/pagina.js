// Páginas simples (termos e privacidade): só o botão de tema.
const raiz = document.documentElement;
document.querySelector('[data-tema]')?.addEventListener('click', () => {
  const t = raiz.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  raiz.setAttribute('data-theme', t);
  try { localStorage.setItem('farol-site-tema', t); } catch { /* sem armazenamento */ }
});
