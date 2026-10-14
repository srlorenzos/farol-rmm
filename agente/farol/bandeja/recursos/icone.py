"""Ícone do farol para a bandeja, desenhado por código com Pillow (sem arquivo binário versionado: a
imagem muda de cor/ponto de status em tempo real, então gerar é mais simples e mais confiável que
carregar e recolorir um PNG do disco — e dispensa qualquer `datas` extra no empacotamento com PyInstaller).

Composição: torre + facho num círculo da cor da marca (configurável pelo MSP), com um ponto de status no
canto inferior direito — verde (conectado), cinza (desconectado) ou laranja (resposta não lida), igual ao
estado mostrado em #/dispositivos no painel.
"""
from __future__ import annotations

from PIL import Image, ImageDraw

CORES_STATUS = {
    "conectado": (34, 197, 94),       # verde — mesmo tom de `estado-online` no painel
    "desconectado": (148, 163, 184),  # cinza
    "resposta": (249, 115, 22),       # laranja — resposta não lida
}
COR_MARCA_PADRAO = "#2563eb"


def _cor_rgb(cor_hex: str) -> tuple[int, int, int]:
    h = cor_hex.lstrip("#")
    if len(h) != 6:
        h = "2563eb"
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def gerar(tamanho: int = 64, status: str = "desconectado", cor_marca: str = COR_MARCA_PADRAO) -> Image.Image:
    """Devolve uma imagem RGBA tamanho×tamanho (pystray reamostra para o tamanho real da bandeja)."""
    s = max(16, int(tamanho))
    escala = s / 64
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    marca = _cor_rgb(cor_marca)
    fundo_escuro = tuple(max(0, int(c * 0.55)) for c in marca)
    d.ellipse((1 * escala, 1 * escala, 62 * escala, 62 * escala), fill=(*fundo_escuro, 255))

    # Facho (triângulo claro à direita, sugerindo luz) e torre (trapézio central).
    d.polygon([(34 * escala, 16 * escala), (56 * escala, 10 * escala), (56 * escala, 20 * escala), (34 * escala, 24 * escala)],
              fill=(255, 216, 163, 235))
    d.polygon([(27 * escala, 46 * escala), (37 * escala, 46 * escala), (34.5 * escala, 20 * escala), (29.5 * escala, 20 * escala)],
              fill=(255, 255, 255, 245))
    d.rectangle((26 * escala, 18 * escala, 38 * escala, 24 * escala), fill=(255, 255, 255, 245))
    d.rectangle((23 * escala, 46 * escala, 41 * escala, 50 * escala), fill=(226, 232, 240, 255))

    # Ponto de status (com anel escuro para destacar em fundos claros ou escuros da bandeja do Windows).
    cor = CORES_STATUS.get(status, CORES_STATUS["desconectado"])
    cx, cy, r = 48 * escala, 48 * escala, 14 * escala
    d.ellipse((cx - r - 2 * escala, cy - r - 2 * escala, cx + r + 2 * escala, cy + r + 2 * escala), fill=(15, 23, 32, 255))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*cor, 255))
    return img


def gerar_janela(cor_marca: str = COR_MARCA_PADRAO, tamanho: int = 256) -> Image.Image:
    """Ícone maior (sem ponto de status), usado no cabeçalho/favicon da janela da bandeja."""
    return gerar(tamanho, status="conectado", cor_marca=cor_marca)
