#!/usr/bin/env bash
# ---
# id: linux-limpar-cache-pacotes
# nome: "Linux - limpar cache de pacotes e dependências órfãs"
# descricao: "Limpa o cache do gerenciador de pacotes (apt/dnf/yum/zypper/pacman) e remove dependências órfãs. Simulação por padrão."
# categoria: Manutenção
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [limpeza, pacotes]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

f_root
echo "Gerenciador: $(f_pm)"
if f_simular; then
  case "$(f_pm)" in apt) apt-get -s autoremove | grep -E '^Remv' | head -20; du -sh /var/cache/apt/archives;; dnf|yum) du -sh /var/cache/"$(f_pm)" 2>/dev/null;; esac
  echo "SIMULAÇÃO: nada alterado (SIMULAR=false para limpar)."; exit 0
fi
case "$(f_pm)" in
  apt) apt-get -y autoremove --purge; apt-get -y clean;;
  dnf) dnf -y autoremove; dnf clean all;;
  yum) yum -y autoremove 2>/dev/null; yum clean all;;
  zypper) zypper -n clean --all;;
  pacman) pacman -Sc --noconfirm;;
  *) echo "Gerenciador não suportado."; exit 1;;
esac
exit 0
