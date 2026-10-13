// Página de sucesso: busca a licença da sessão paga (api/licenca) e a mostra. Tenta por até ~60 s enquanto o webhook chega.
const $ = (s) => document.querySelector(s);
const raiz = document.documentElement;
$('[data-tema]')?.addEventListener('click', () => {
  const t = raiz.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  raiz.setAttribute('data-theme', t);
  try { localStorage.setItem('farol-site-tema', t); } catch { /* sem armazenamento */ }
});

const sessao = new URLSearchParams(location.search).get('session_id') || '';
const ico = $('#estado-ico');
const trocarIcone = (id, classe) => { ico.className = `estado-ico ${classe}`; ico.firstElementChild.firstElementChild.setAttribute('href', `#${id}`); ico.firstElementChild.classList.toggle('giro', id === 'i-giro'); };
const mostrar = (titulo, texto) => { $('#titulo').textContent = titulo; $('#texto').textContent = texto; };

function falha(titulo, texto) {
  trocarIcone('i-x', 'erro');
  mostrar(titulo, texto);
}

function exibir(l) {
  trocarIcone('i-check', '');
  mostrar('Pagamento confirmado', 'Obrigado! Sua licença do Farol RMM está pronta.');
  const fmt = (ms) => new Date(ms).toLocaleDateString('pt-BR');
  const linhas = [['Cliente', l.cliente], ['Plano', l.plano === 'msp' ? 'MSP' : 'Profissional'], ['Dispositivos', String(l.dispositivos_max)], ['Válida até', l.expira_em ? fmt(l.expira_em) : 'Sem validade'], ['Cobrança', l.intervalo === 'ano' ? 'Anual' : 'Mensal']];
  const resumo = $('#resumo');
  resumo.replaceChildren();
  for (const [k, v] of linhas) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    resumo.append(dt, dd);
  }
  $('#chave').textContent = l.chave;
  $('#licenca').hidden = false;
  $('#copiar').addEventListener('click', async () => {
    const rot = $('#copiar span');
    try { await navigator.clipboard.writeText(l.chave); rot.textContent = 'Copiada'; } catch { rot.textContent = 'Selecione e copie manualmente'; }
    setTimeout(() => { rot.textContent = 'Copiar chave'; }, 2200);
  });
  $('#baixar').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([`${l.chave}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'farol-licenca.txt'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

async function buscar(tentativa = 0) {
  try {
    const r = await fetch(`/api/licenca?session_id=${encodeURIComponent(sessao)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (r.status === 200 && j.chave) return exibir(j);
    if (r.status === 202 || r.status === 502) {
      if (tentativa >= 30) return falha('A confirmação está demorando', 'O pagamento pode ter sido aprovado, mas a licença ainda não chegou. Recarregue esta página em alguns minutos ou fale conosco com o e-mail do pagamento.');
      return setTimeout(() => buscar(tentativa + 1), 2000);
    }
    if (r.status === 503) return falha('Entrega indisponível', 'O armazenamento das licenças ainda não está configurado. Entre em contato para receber a sua chave.');
    return falha('Não encontramos a licença', j.erro || 'Verifique se o endereço desta página está completo.');
  } catch {
    if (tentativa >= 30) return falha('Sem conexão', 'Não conseguimos consultar a licença. Recarregue a página.');
    setTimeout(() => buscar(tentativa + 1), 2000);
  }
}

if (!/^cs_(test|live)_[A-Za-z0-9]{20,200}$/.test(sessao)) falha('Sessão não encontrada', 'Esta página precisa do link enviado pelo Stripe após o pagamento. Se você ainda não comprou, veja os planos na página inicial.');
else buscar();
