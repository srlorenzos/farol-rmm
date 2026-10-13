"""Gera os recursos visuais do empacotamento: farol.ico (16 a 256 px) e as imagens do assistente do Setup.

Uso: python gerar_recursos.py   (precisa do Pillow). Escreve na própria pasta.
O desenho acompanha painel/favicon.svg: farol âmbar sobre azul-petróleo.
"""
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
FUNDO = (13, 31, 38, 255)
FUNDO2 = (22, 36, 58, 255)
AMBAR = (245, 184, 61, 255)
LUZ = (255, 154, 46, 255)


def farol(tam: int = 1024) -> Image.Image:
    """Ícone quadrado do farol, desenhado em alta resolução para reduzir sem serrilhado."""
    s = tam / 32
    img = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, tam - 1, tam - 1), radius=int(7 * s), fill=FUNDO2)
    # feixes de luz
    d.polygon([(11 * s, 10.2 * s), (2.5 * s, 7.5 * s), (2.5 * s, 12.5 * s)], fill=(245, 184, 61, 90))
    d.polygon([(21 * s, 10.2 * s), (29.5 * s, 7.5 * s), (29.5 * s, 12.5 * s)], fill=(245, 184, 61, 90))
    # torre
    d.polygon([(12.4 * s, 27 * s), (13.6 * s, 13 * s), (18.4 * s, 13 * s), (19.6 * s, 27 * s)], fill=AMBAR)
    d.rectangle((13.4 * s, 17 * s, 18.6 * s, 19 * s), fill=FUNDO2)  # faixa
    d.rectangle((13.6 * s, 21.5 * s, 18.4 * s, 23.5 * s), fill=FUNDO2)
    # lanterna e telhado
    d.rectangle((13.2 * s, 8.2 * s, 18.8 * s, 13 * s), fill=LUZ)
    d.polygon([(12.4 * s, 8.4 * s), (16 * s, 5 * s), (19.6 * s, 8.4 * s)], fill=AMBAR)
    # base
    d.rounded_rectangle((8.5 * s, 26.6 * s, 23.5 * s, 28.2 * s), radius=int(0.8 * s), fill=AMBAR)
    return img


def main() -> None:
    base = farol(1024)
    tamanhos = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    imgs = [base.resize((t, t), Image.LANCZOS) for t in tamanhos]
    imgs[-1].save(AQUI / "farol.ico", format="ICO", sizes=[(t, t) for t in tamanhos], append_images=imgs[:-1])
    base.resize((256, 256), Image.LANCZOS).save(AQUI / "farol.png")

    # Imagens do assistente do Inno Setup (BMP): lateral 164x314 e pequena 55x55.
    lateral = Image.new("RGB", (164, 314), FUNDO[:3])
    g = ImageDraw.Draw(lateral)
    for y in range(314):  # degradê vertical sutil
        t = y / 313
        g.line([(0, y), (164, y)], fill=(int(13 + 9 * t), int(31 + 5 * t), int(38 + 20 * t)))
    icone = base.resize((96, 96), Image.LANCZOS)
    lateral.paste(icone, (34, 60), icone)
    g.rectangle((34, 180, 130, 182), fill=AMBAR[:3])
    lateral.save(AQUI / "setup-lateral.bmp")
    pequena = Image.new("RGB", (55, 55), (255, 255, 255))
    ic = base.resize((55, 55), Image.LANCZOS)
    pequena.paste(ic, (0, 0), ic)
    pequena.save(AQUI / "setup-pequena.bmp")
    print("recursos gerados em", AQUI)


if __name__ == "__main__":
    main()
