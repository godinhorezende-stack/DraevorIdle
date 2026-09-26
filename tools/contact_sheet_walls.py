import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GD = ROOT / "assets_raw" / "gamedata"
sprites = json.loads((GD / "item-sprites.json").read_text(encoding="utf-8"))

ids = sorted(int(k) for k, v in sprites.items() if v["h"] > v["w"] and int(k) < 40000)
print("candidatos tall id<40000:", len(ids))

pages = {}


def get_page(base, page):
    key = (base, page)
    if key not in pages:
        p = GD / "sprites" / "items" / f"{base}{page}.png"
        pages[key] = Image.open(p).convert("RGBA") if p.exists() else None
    return pages[key]


cell = 72
cols = 10
rows = (len(ids) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cell, rows * cell), (40, 40, 40, 255))
draw = ImageDraw.Draw(sheet)

for idx, iid in enumerate(ids):
    s = sprites[str(iid)]
    base = s.get("b", "items32-")
    view = s["s"][0]
    img = get_page(base, view[0])
    w, h = s["w"], s["h"]
    crop = img.crop((view[1], view[2], view[1] + w, view[2] + h))
    scale = min((cell - 8) / w, (cell - 8) / h)
    crop = crop.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.NEAREST)
    cx = (idx % cols) * cell
    cy = (idx // cols) * cell
    sheet.paste(crop, (cx + (cell - crop.width) // 2, cy + (cell - crop.height) // 2), crop)
    draw.text((cx + 1, cy + 1), str(iid), fill=(255, 255, 0, 255))

out = ROOT / "wall_candidates.png"
sheet.save(out)
print("salvo", out, sheet.size)
