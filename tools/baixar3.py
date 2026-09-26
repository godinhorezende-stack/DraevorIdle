"""Passo 3: icones referenciados por template string (`tb-${id}`, `sk-${skill}`),
que o crawler do passo 1 nao pega porque nunca aparecem como caminho literal no
codigo. Tenta um punhado de nomes candidatos, em icons/ e ui/, e guarda so' o
que o site vivo responder 200.
"""
import asyncio
from pathlib import Path
import httpx

BASE = "https://ravoxidle.com.br"
OUT = Path(__file__).resolve().parent.parent / "assets_raw"

TOOLBAR = [
    "banco", "locker", "prey", "forja", "arvore", "gemas", "charms", "proficiency",
    "imbuements", "hunts", "city", "character", "inventory", "cyclopedia", "quests",
    "loot", "chat", "analyzer", "logout", "options", "party",
]
SKILLS = ["sword", "axe", "club", "distance", "fist", "magic", "shielding", "misc", "magic-sorcerer"]
ELEMENTOS = ["physical", "holy", "ice", "earth", "fire", "energy"]
DIVERSOS = ["ficha-exp", "ficha-alcance", "ficha-progresso", "ficha-kills", "coin-store"]

candidatos = set()
for nome in TOOLBAR:
    candidatos.add(f"/client/assets/icons/{nome}.png")
    candidatos.add(f"/client/assets/ui/{nome}.png")
    candidatos.add(f"/client/assets/ui/tb-{nome}.png")
for nome in SKILLS:
    candidatos.add(f"/client/assets/icons/sk-{nome}.png")
    candidatos.add(f"/client/assets/ui/sk-{nome}.png")
for nome in ELEMENTOS:
    candidatos.add(f"/client/assets/icons/el-{nome}.png")
    candidatos.add(f"/client/assets/ui/el-{nome}.png")
for nome in DIVERSOS:
    candidatos.add(f"/client/assets/icons/{nome}.png")
    candidatos.add(f"/client/assets/ui/{nome}.png")

ok, fail = {}, {}


async def tentar(client, caminho, sem):
    async with sem:
        url = BASE + caminho
        alvo = OUT / caminho.lstrip("/")
        if alvo.exists():
            return
        try:
            r = await client.get(url, timeout=20)
        except Exception as e:
            fail[caminho] = repr(e)[:80]
            return
        if r.status_code != 200 or not r.content:
            fail[caminho] = r.status_code
            return
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_bytes(r.content)
        ok[caminho] = len(r.content)


async def main():
    headers = {"User-Agent": "Mozilla/5.0", "Referer": BASE + "/jogar"}
    sem = asyncio.Semaphore(16)
    async with httpx.AsyncClient(headers=headers) as client:
        await asyncio.gather(*(tentar(client, c, sem) for c in sorted(candidatos)))
    print(f"achados: {len(ok)}")
    for c in sorted(ok):
        print(f"  + {c}")
    print(f"nao existem: {len(fail)} (esperado — so' tentativa)")


asyncio.run(main())
