"""Passo 2: expande os atlas de sprite a partir dos indices de gamedata.

outfits.json    -> /gamedata/sprites/outfits/{look}.png
item-sprites    -> /gamedata/sprites/items/{base}{page}.png
effect-sprites  -> /gamedata/sprites/effects/{base}{page}.png
missile-sprites -> /gamedata/sprites/missiles/{base}{page}.png
"""
import asyncio, json
from pathlib import Path
import httpx

BASE = "https://ravoxidle.com.br"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets_raw"
GD = OUT / "gamedata"
CONC = 24

ok, fail = {}, {}


async def get(client, url):
    for tentativa in range(3):
        try:
            r = await client.get(url, timeout=60)
            if r.status_code < 400:
                return r.content
            if r.status_code == 404:
                fail[url] = "404"
                return None
        except Exception as e:
            if tentativa == 2:
                fail[url] = repr(e)[:100]
        await asyncio.sleep(0.4 * (tentativa + 1))
    fail.setdefault(url, "retry")
    return None


def salvar(url, body):
    p = OUT / url.replace(BASE + "/", "")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(body)
    ok[url] = len(body)


async def baixar_url(client, url, sem):
    async with sem:
        rel = OUT / url.replace(BASE + "/", "")
        if rel.exists():
            return
        b = await get(client, url)
        if b:
            salvar(url, b)


def load(name):
    return json.loads((GD / name).read_text(encoding="utf-8"))


async def main():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Referer": BASE + "/jogar",
    }
    sem = asyncio.Semaphore(CONC)
    async with httpx.AsyncClient(headers=headers) as client:
        urls = set()

        # ---- outfits ----
        outfits = load("outfits.json")
        for look in outfits:
            urls.add(f"{BASE}/gamedata/sprites/outfits/{look}.png")
        print(f"outfits: {len(outfits)}")

        # ---- items / effects / missiles ----
        for name, sub, default_base in (
            ("item-sprites.json", "items", "items32-"),
            ("effect-sprites.json", "effects", "effects-"),
            ("missile-sprites.json", "missiles", "missiles-"),
        ):
            data = load(name)
            pages = set()
            for v in data.values():
                base = v.get("b", default_base)
                for view in v.get("s", []):
                    pages.add((base, view[0]))
            for base, page in pages:
                urls.add(f"{BASE}/gamedata/sprites/{sub}/{base}{page}.png")
            print(f"{name}: {len(data)} entradas, {len(pages)} paginas de atlas")

        print(f"\ntotal de urls a baixar (novas + ja existentes): {len(urls)}")
        await asyncio.gather(*(baixar_url(client, u, sem) for u in sorted(urls)))

    print(f"\nNOVOS: {len(ok)} arquivos, {sum(ok.values())/1_048_576:.1f} MiB")
    print(f"FALHA: {len(fail)}")
    (ROOT / "manifest-passo2.json").write_text(
        json.dumps({"ok": ok, "fail": fail}, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    for u, e in list(fail.items())[:30]:
        print(f"  x {e:>6}  {u}")


asyncio.run(main())
