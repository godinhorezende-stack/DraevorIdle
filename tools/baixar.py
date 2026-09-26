"""Crawler recursivo do ravoxidle.com.br: descobre e baixa todo asset publico.

Descoberta em camadas:
  1. HTML seed  -> src/href
  2. .mjs/.js   -> `from '...'` / `import(...)` + literais de caminho
  3. .json      -> qualquer string que pareca caminho de asset
  4. .css       -> url(...)
"""
import asyncio, json, re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

BASE = "https://ravoxidle.com.br"
OUT = Path(__file__).resolve().parent.parent / "assets_raw"
CONC = 16

SEEDS = [
    "/jogar",
    "/",
    "/client/style.css",
    "/client/src/main.mjs",
    "/gamedata/outfits.json",
    "/gamedata/item-sprites.json",
    "/gamedata/effect-sprites.json",
    "/gamedata/missile-sprites.json",
]

RE_PATH = re.compile(
    r"""['"(]\s*((?:\.{1,2}/|/)?(?:client|packages|gamedata|assets|img|shared|audio|sfx|musica|fonts)/"""
    r"""[A-Za-z0-9._\-/]+\.(?:png|jpg|jpeg|webp|gif|svg|json|mjs|js|css|m4a|mp3|ogg|wav|woff2?|ttf))""",
    re.I,
)
RE_IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*['"]([^'"]+\.m?js)['"]""")
RE_HTML_SRC = re.compile(r"""(?:src|href)\s*=\s*['"]([^'"#?]+)['"]""", re.I)
RE_CSS_URL = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", re.I)

TEXT_EXT = {".html", ".js", ".mjs", ".json", ".css", ""}

seen: set[str] = set()
ok: dict[str, int] = {}
fail: dict[str, str] = {}


def strip_query(u: str) -> str:
    return u.split("?", 1)[0]


def norm(u: str, ref: str) -> str | None:
    if not u or u.startswith(("data:", "blob:", "mailto:", "javascript:", "ws:", "wss:")):
        return None
    full = urljoin(ref, u)
    p = urlparse(full)
    if p.netloc and p.netloc != urlparse(BASE).netloc:
        return None
    return f"{BASE}{strip_query(p.path)}"


def local_path(url: str) -> Path:
    rel = strip_query(urlparse(url).path).lstrip("/") or "index.html"
    if rel.endswith("/"):
        rel += "index.html"
    if "." not in Path(rel).name:
        rel += ".html"
    return OUT / rel


def descobrir(url: str, body: bytes) -> set[str]:
    ext = Path(urlparse(url).path).suffix.lower()
    if ext not in TEXT_EXT and ext != ".html":
        return set()
    try:
        txt = body.decode("utf-8", "replace")
    except Exception:
        return set()
    achados: set[str] = set()
    if ext in (".html", ""):
        achados |= set(RE_HTML_SRC.findall(txt))
    if ext == ".css":
        achados |= set(RE_CSS_URL.findall(txt))
    achados |= set(RE_IMPORT.findall(txt))
    achados |= {m for m in RE_PATH.findall(txt)}
    out = set()
    for a in achados:
        n = norm(a, url)
        if n:
            out.add(n)
    return out


def expandir_manifest(url: str, body: bytes) -> set[str]:
    out: set[str] = set()
    if not url.endswith(".json"):
        return out
    try:
        data = json.loads(body)
    except Exception:
        return out

    def walk(node):
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, str):
            if re.search(r"\.(png|jpg|jpeg|webp|gif|svg|m4a|mp3|ogg|json)$", node, re.I):
                n = norm(node, url)
                if n:
                    out.add(n)

    walk(data)
    return out


async def baixar(client, url, fila):
    try:
        r = await client.get(url, timeout=40)
    except Exception as e:
        fail[url] = repr(e)[:120]
        return
    if r.status_code >= 400:
        fail[url] = str(r.status_code)
        return
    body = r.content
    p = local_path(url)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(body)
    ok[url] = len(body)
    for novo in descobrir(url, body) | expandir_manifest(url, body):
        if novo not in seen:
            seen.add(novo)
            fila.put_nowait(novo)


async def main():
    fila: asyncio.Queue = asyncio.Queue()
    for s in SEEDS:
        u = BASE + s
        seen.add(u)
        fila.put_nowait(u)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Referer": BASE + "/jogar",
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        async def worker():
            while True:
                url = await fila.get()
                try:
                    await baixar(client, url, fila)
                    n = len(ok) + len(fail)
                    if n % 50 == 0:
                        print(f"  {n} baixados / {fila.qsize()} na fila", flush=True)
                finally:
                    fila.task_done()

        workers = [asyncio.create_task(worker()) for _ in range(CONC)]
        await fila.join()
        for w in workers:
            w.cancel()

    total = sum(ok.values())
    print(f"\nOK   : {len(ok)} arquivos, {total/1_048_576:.1f} MiB")
    print(f"FALHA: {len(fail)}")
    (OUT.parent / "manifest.json").write_text(
        json.dumps({"ok": ok, "fail": fail}, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    for u, e in list(fail.items())[:25]:
        print(f"  x {e:>6}  {u}")


asyncio.run(main())
