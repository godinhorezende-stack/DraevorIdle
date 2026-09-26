import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GD = ROOT / "assets_raw" / "gamedata"
sprites = json.loads((GD / "item-sprites.json").read_text(encoding="utf-8"))

candidates = [i for i in range(100, 700) if str(i) in sprites]
print("candidatos com sprite entre 100-700:", len(candidates))

pages_cache = {}


def get_page(base, page):
    key = (base, page)
    if key not in pages_cache:
        p = GD / "sprites" / "items" / f"{base}{page}.png"
        pages_cache[key] = Image.open(p).convert("RGBA") if p.exists() else None
    return pages_cache[key]


cols = 20
cell = 40
rows = (len(candidates) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cell, rows * cell), (30, 30, 30, 255))
draw = ImageDraw.Draw(sheet)

for idx, iid in enumerate(candidates):
    s = sprites[str(iid)]
    base = s.get("b", "items32-")
    view = s["s"][0]
    page_img = get_page(base, view[0])
    if not page_img:
        continue
    w, h = s["w"], s["h"]
    crop = page_img.crop((view[1], view[2], view[1] + w, view[2] + h))
    cx = (idx % cols) * cell
    cy = (idx // cols) * cell
    if w > cell or h > cell:
        scale = min(cell / w, cell / h)
        crop = crop.resize((max(1, int(w * scale)), max(1, int(h * scale))))
    sheet.paste(crop, (cx + (cell - crop.width) // 2, cy + (cell - crop.height) // 2), crop)
    draw.text((cx + 1, cy + 1), str(iid), fill=(255, 255, 0, 255))

out = ROOT / "floor_candidates_100_700.png"
sheet.save(out)
print("salvo", out, sheet.size)
