# Valida as skills do projeto: frontmatter (name = pasta, description <= 1024), links, caminhos citados em `crase` e nomes de
# função/constante citados (existem no código). Uso: python3 .claude/skills/validar.py  (de qualquer pasta)
import re, os, subprocess, glob
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SK = os.path.join(RAIZ, '.claude/skills')
G = os.path.join(RAIZ, 'game')
probs = []
def existe_caminho(c, base_md):
    c = c.split(':')[0].rstrip('/').replace('`', '')
    if '*' in c or '{' in c or '<' in c or c.startswith('/') or c.startswith('http'):
        if '{' in c:  # a/{b,c}.mjs
            m = re.match(r'(.*)\{([^}]*)\}(.*)', c)
            return all(existe_caminho(m.group(1) + x + m.group(3), base_md) for x in m.group(2).split(','))
        if '*' in c: return any(glob.glob(os.path.join(b, c)) for b in [RAIZ, G, os.path.join(G, 'gamedata')])
        return True
    if re.search(r'-N\.json$', c): c = c.replace('-N.json', '-[0-9]*.json'); return bool(glob.glob(os.path.join(RAIZ, c))) or bool(glob.glob(os.path.join(G, c))) or bool(glob.glob(os.path.join(G, 'gamedata', c)))
    bases = [RAIZ, G] + [os.path.join(G, x) for x in ['systems', 'systems/itens-poe', 'systems/hunt', 'gamedata', 'gamedata/itens-poe', 'gamedata/atos', 'testes', 'websocket', 'engine', 'frontend/client/src', 'admin']] + [os.path.dirname(base_md)]
    return any(os.path.exists(os.path.join(b, c)) for b in bases)
codigo = subprocess.run(['grep', '-rhoE', r'(function|const|let|class) [A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*\s*\(|  [a-zA-Z]+\(\) \{|[A-Z_]{3,}', '--include=*.mjs', os.path.join(G, 'systems'), os.path.join(G, 'websocket'), os.path.join(G, 'backend'), os.path.join(G, 'admin'), os.path.join(G, 'engine'), os.path.join(G, 'database'), os.path.join(G, 'testes')], capture_output=True, text=True).stdout
nomes = set(re.findall(r'[A-Za-z_][A-Za-z0-9_]*', codigo))
resumo = []
for d in sorted(x for x in os.listdir(SK) if os.path.isdir(os.path.join(SK, x))):
    md = os.path.join(SK, d, 'SKILL.md')
    if not os.path.exists(md): probs.append(f'{d}: sem SKILL.md'); continue
    s = open(md).read()
    m = re.match(r'^---\nname: ([^\n]+)\ndescription: ([^\n]+)\n---\n', s)
    if not m: probs.append(f'{d}: frontmatter inválido'); continue
    nome, desc = m.group(1).strip(), m.group(2).strip()
    if nome != d: probs.append(f'{d}: name "{nome}" diferente da pasta')
    if not re.fullmatch(r'[a-z0-9-]{1,64}', nome): probs.append(f'{d}: name fora do padrão')
    if len(desc) > 1024: probs.append(f'{d}: description com {len(desc)} caracteres (> 1024)')
    arquivos = [md] + glob.glob(os.path.join(SK, d, 'references', '*.md'))
    for arq in arquivos:
        t = open(arq).read()
        for alvo in re.findall(r'\]\(([^)]+)\)', t):
            if alvo.startswith('http') or alvo.startswith('#'): continue
            if not os.path.exists(os.path.join(os.path.dirname(arq), alvo)): probs.append(f'{os.path.relpath(arq, SK)}: link quebrado {alvo}')
        for c in re.findall(r'`([^`\n]+)`', t):
            for parte in re.split(r'\s+', c):
                parte = parte.strip('(),;')
                if re.search(r'\.(mjs|json|md|sh|js)$', parte) or parte.endswith('/') and '/' in parte[:-1]:
                    if not existe_caminho(parte, arq) and not re.search(r'campanha-(ajustes|mapas)\.json', parte): probs.append(f'{os.path.relpath(arq, SK)}: caminho não existe: {parte}')
            # identificadores: `nome`, `Mod.nome`, `nome(...)`
            for ident in re.findall(r'(?:^|[\s(`.])([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)(?=[\s(),`.]|$)', ' ' + c + ' '):
                if ident not in nomes and subprocess.run(['grep', '-rqw', '--include=*.mjs', ident, G], capture_output=True).returncode != 0: probs.append(f'{os.path.relpath(arq, SK)}: nome não achado no código: {ident}')
    resumo.append((d, len(desc), len(s.splitlines()), len(arquivos)))
for r in resumo: print(f'{r[0]:22} descrição {r[1]:4} caracteres · SKILL.md {r[2]:3} linhas · {r[3]} arquivo(s)')
print('\nPROBLEMAS:', len(probs))
for p in sorted(set(probs)): print(' -', p)
