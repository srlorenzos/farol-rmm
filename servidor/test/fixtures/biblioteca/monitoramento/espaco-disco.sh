#!/usr/bin/env bash
# ---
# id: espaco-disco
# nome: Monitor de espaço em disco
# descricao: "Alerta quando a partição raiz passa do limite #1."
# categoria: Monitoramento
# so: [linux, macos]
# tipo: monitor
# tempo_limite: 30
# tags: [disco]
# variaveis:
#   - nome: LIMITE
#     rotulo: Limite (%)
#     tipo: numero
#     padrao: 90
#   - nome: NIVEL
#     rotulo: Severidade
#     tipo: selecao
#     opcoes: [alerta, critico]
#     padrao: alerta
# ---
uso=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "$uso" -gt "${FAROL_LIMITE:-90}" ]; then
  echo "FAROL_STATUS: ${FAROL_NIVEL:-alerta} disco em ${uso}%"
else
  echo "FAROL_STATUS: ok disco em ${uso}%"
fi
