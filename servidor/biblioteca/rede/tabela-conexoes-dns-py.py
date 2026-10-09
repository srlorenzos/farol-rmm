# ---
# id: tabela-conexoes-dns-py
# nome: "Python - resolução DNS em lote"
# descricao: "Resolve uma lista de nomes (A/AAAA) e mede o tempo de resposta usando apenas a biblioteca padrão do Python 3."
# categoria: Rede
# so: [windows, linux, macos]
# shell: python
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [python, dns]
# variaveis:
#   - nome: NOMES
#     rotulo: "Nomes separados por vírgula"
#     tipo: texto
#     padrao: "google.com,microsoft.com"
#     obrigatorio: false
#     opcoes: []
# ---
import os, re, socket, time
nomes = [n.strip() for n in os.environ.get("FAROL_NOMES", "google.com,microsoft.com").split(",") if n.strip()]
for n in nomes:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", n):
        print(f"Nome inválido ignorado: {n}")
        continue
    t = time.time()
    try:
        r = sorted({x[4][0] for x in socket.getaddrinfo(n, None)})
        print(f"{n:<30} {int((time.time()-t)*1000):>5} ms  {', '.join(r)}")
    except OSError as e:
        print(f"{n:<30} FALHA: {e}")
