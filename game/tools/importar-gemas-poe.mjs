// IMPORTADOR das GEMAS e dos SUPORTES do PoE para o repositório (dono, 08/10: "tudo no repositório").
//
// A coleção do dono fica fora do repositório (`REFERENCIAS_POE`, padrão `/home/deploy/referencias-poe`): é só a fonte deste tool. O jogo
// lê o que ele grava em `gamedata/itens-poe/`:
//   - `gemas-poe.json`: as 562 gemas (o `window.GEMAS` de `poe-gemas-poedb/engine/dados/gemas.js`, passado para JSON — o jogo não executa
//     mais o JavaScript da coleção);
//   - `icones-gemas/`: os ícones das gemas (`poe-gemas-poedb/icones`);
//   - `suportes-poe.json` e `icones-suportes/`: os suportes (`poe-suportes-poedb/suportes.json` e `icones`).
// O interpretador das gemas (`poe-gemas-poedb/engine/src/gemas/*.mjs`) virou código do repositório (`systems/itens-poe/compilador-de-gemas/`)
// e NÃO é copiado aqui: mudanças nele são feitas no repositório.
// Uso: node game/tools/importar-gemas-poe.mjs   (de qualquer pasta)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const GEMAS = join(RAIZ, 'poe-gemas-poedb');
const SUPORTES = join(RAIZ, 'poe-suportes-poedb');
const DESTINO = fileURLToPath(new URL('../gamedata/itens-poe/', import.meta.url));

function copiarPasta(de, para) {
  rmSync(para, { recursive: true, force: true });
  mkdirSync(para, { recursive: true });
  let n = 0;
  let bytes = 0;
  for (const f of readdirSync(de)) {
    if (!statSync(join(de, f)).isFile()) continue;
    copyFileSync(join(de, f), join(para, f));
    n++;
    bytes += statSync(join(para, f)).size;
  }
  return `${n} arquivos (${(bytes / 1e6).toFixed(1)} MB)`;
}

for (const p of [join(GEMAS, 'engine', 'dados', 'gemas.js'), join(GEMAS, 'icones'), join(SUPORTES, 'suportes.json'), join(SUPORTES, 'icones')]) {
  if (!existsSync(p)) {
    console.error(`Não achei ${p} (defina REFERENCIAS_POE para a pasta das referências do PoE).`);
    process.exit(1);
  }
}

const janela = {};
runInNewContext(readFileSync(join(GEMAS, 'engine', 'dados', 'gemas.js'), 'utf8'), { window: janela });
const gemas = janela.GEMAS ?? [];
writeFileSync(join(DESTINO, 'gemas-poe.json'), JSON.stringify(gemas));
console.log(`gemas-poe.json: ${gemas.length} gemas`);
console.log(`icones-gemas/: ${copiarPasta(join(GEMAS, 'icones'), join(DESTINO, 'icones-gemas'))}`);
const suportes = JSON.parse(readFileSync(join(SUPORTES, 'suportes.json'), 'utf8'));
writeFileSync(join(DESTINO, 'suportes-poe.json'), JSON.stringify(suportes));
console.log(`suportes-poe.json: ${suportes.length} suportes`);
console.log(`icones-suportes/: ${copiarPasta(join(SUPORTES, 'icones'), join(DESTINO, 'icones-suportes'))}`);
