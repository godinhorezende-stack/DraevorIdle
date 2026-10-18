// (lote 78) Os ÍCONES dos nós das JOIAS RAMIFICADORAS e a MOLDURA dos encaixes de expansão na árvore do PoE. Os nós que a joia cria não são da
// árvore (ids 0x10000+), então o mapa de sprites (`arvore-sprites.json`) não os tinha: aqui entram as coordenadas dos ícones de
// `gamedata/itens-poe/ramificadoras.json` — os notáveis (`notableActive/Inactive`), as pequenas de cada encantamento (`normalActive/Inactive`) e
// as pedras fundamentais das únicas (`keystoneActive/Inactive`) — e as molduras do encaixe de expansão (`JewelSocketAlt*`), todas nas MESMAS
// folhas que a árvore já usa (nenhuma imagem nova). O nó leva a chave do ícone em `arte` (`passivas/arvore.noParaCliente`).
//
// O importador da árvore (`tools/importar-arvore-poeskilltree.mjs`) chama `coordsDasRamificadoras` ao gerar o mapa. Rodado direto, só acrescenta
// estas coordenadas ao `arvore-sprites.json` que já existe (sem baixar nada):
//   node tools/sprites-ramificadoras.mjs   (POESKILLTREE=<pasta da versão raspada>, padrão /home/deploy/scrapling/saida/poeskilltree/3.25.0)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A chave curta de um ícone (a mesma do importador): `Art/2DArt/SkillIcons/passives/x.png` → `x`. */
const chave = (caminho) => String(caminho ?? '').replace(/^Art\/2DArt\/SkillIcons\/passives\//, '').replace(/\.png$/i, '');
export const MOLDURAS_DA_EXPANSAO = ['JewelSocketAltNormal', 'JewelSocketAltCanAllocate', 'JewelSocketAltActive'];

/**
 * Acrescenta a `coords` (`{ tipo: { chave: [x, y, l, a] } }`) os ícones das Ramificadoras e as molduras do encaixe de expansão, das folhas do
 * SkillTree.json `st` no zoom `zoom`. `tipos`: a folha de cada tipo no mapa — o ícone só entra se a folha for a mesma. Devolve o que faltou.
 */
export function coordsDasRamificadoras({ st, zoom, ramificadoras, coords, tipos }) {
  const sprite = (tipo) => st.sprites?.[tipo]?.[zoom];
  const arquivo = (tipo) => sprite(tipo)?.filename?.split('/').pop().split('?')[0];
  const faltou = [];
  const usar = (tipo, caminho, k = chave(caminho)) => {
    const c = sprite(tipo)?.coords?.[caminho];
    if (!c || (tipos?.[tipo] && tipos[tipo] !== arquivo(tipo))) return false;
    (coords[tipo] ??= {})[k] = [c.x, c.y, c.w, c.h];
    return true;
  };
  const icones = [
    ...Object.values(ramificadoras.notaveis ?? {}).map((n) => [n.icone, ['notableActive', 'notableInactive']]),
    ...Object.values(ramificadoras.tamanhos ?? {}).flatMap((t) => (t.encantamentos ?? []).map((e) => [e.icone, ['normalActive', 'normalInactive']])),
    ...Object.values(ramificadoras.pedras ?? {}).map((p) => [p.icone, ['keystoneActive', 'keystoneInactive']]),
  ];
  for (const [icone, par] of icones) if (icone && !par.map((t) => usar(t, icone)).every(Boolean)) faltou.push(icone);
  for (const m of MOLDURAS_DA_EXPANSAO) if (!usar('frame', m, m)) faltou.push(m);
  return faltou;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ORIGEM = process.env.POESKILLTREE ?? '/home/deploy/scrapling/saida/poeskilltree/3.25.0';
  const DESTINO = new URL('../gamedata/itens-poe/arvore-sprites.json', import.meta.url);
  const st = JSON.parse(readFileSync(join(ORIGEM, 'SkillTree.json'), 'utf8'));
  const mapa = JSON.parse(readFileSync(DESTINO, 'utf8'));
  const ramificadoras = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/ramificadoras.json', import.meta.url), 'utf8'));
  const antes = JSON.stringify(mapa.coords).length;
  const faltou = coordsDasRamificadoras({ st, zoom: String(mapa.zoom), ramificadoras, coords: mapa.coords, tipos: mapa.tipos });
  writeFileSync(DESTINO, JSON.stringify(mapa) + '\n');
  console.log(JSON.stringify({ coords: `${antes} → ${JSON.stringify(mapa.coords).length} caracteres`, faltou }));
}
