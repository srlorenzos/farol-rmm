"""Bandeja do Farol: ícone na área de notificação do Windows (pystray) + janela de suporte (pywebview, com
fallback no navegador) para o usuário final ver o sistema e abrir/acompanhar chamados. Processo separado do
agente principal (roda na sessão do usuário, sem o segredo do agente); fala com ele só pela API local em
127.0.0.1 (ver farol.modulos.api_local e farol.bandeja.cliente_local).
"""
