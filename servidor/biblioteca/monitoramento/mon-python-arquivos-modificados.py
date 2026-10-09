# ---
# id: mon-python-arquivos-modificados
# nome: "Monitor - arquivos alterados recentemente em um diretório"
# descricao: "Conta arquivos modificados nos últimos N minutos em um diretório (detecção de atividade anômala, ex.: ransomware em compartilhamentos). Python 3 padrão."
# categoria: Monitoramento
# so: [windows, linux, macos]
# shell: python
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [arquivos, ransomware, monitor]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Diretório"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: MINUTOS
#     rotulo: "Janela (minutos)"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA
#     rotulo: "Alerta (arquivos)"
#     tipo: numero
#     padrao: 500
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (arquivos)"
#     tipo: numero
#     padrao: 2000
#     obrigatorio: false
#     opcoes: []
# ---
import os, sys, time
c = os.environ.get("FAROL_CAMINHO", "")
def num(v, d):
    return int(v) if v.isdigit() else d
m = num(os.environ.get("FAROL_MINUTOS", ""), 10)
a = num(os.environ.get("FAROL_ALERTA", ""), 500)
k = num(os.environ.get("FAROL_CRITICO", ""), 2000)
if not os.path.isdir(c):
    print("Diretório inválido:", c)
    sys.exit(1)
lim = time.time() - m * 60
n = 0
for raiz, _, arqs in os.walk(c):
    for f in arqs:
        try:
            if os.stat(os.path.join(raiz, f)).st_mtime >= lim:
                n += 1
        except OSError:
            pass
msg = f"{n} arquivo(s) alterado(s) nos últimos {m} min em {c}"
nivel = "critico" if n >= k else "alerta" if n >= a else "ok"
print(f"FAROL_STATUS: {nivel} {msg}")
