// Escreve `game/frontend/client/src/artes.mjs`: o nome de cada PNG que existe
// em `client/assets/icons/` e `client/assets/ui/`.
//
// O cliente pedia arte que ainda não foi desenhada — `aba-<id>.png` para toda
// aba, `prey-defense`, `viagem-partida` — e descobria que ela não existe do
// jeito caro: um 404 por nome, em toda sessão. A auditoria do celular contou
// 30 deles; num telefone são 30 idas à rede por nada, e o console cheio de
// vermelho esconde o erro que importa.
//
// Com o índice, `artOrUiIcon`/`uiIcon` escolhem a pasta certa (ou nenhuma)
// sem perguntar à rede. Arte nova: ponha o PNG na pasta e rode isto de novo
// (o teste `artes-em-dia` acusa quando esquecer).
//
// Uso: node tools/indice-de-artes.mjs
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('../game/frontend/client/assets', import.meta.url));
export const DESTINO = fileURLToPath(new URL('../game/frontend/client/src/artes.mjs', import.meta.url));
const PASTAS = ['icons', 'ui'];

const nomes = (pasta) =>
  readdirSync(join(ASSETS, pasta))
    .filter((n) => n.endsWith('.png'))
    .map((n) => n.slice(0, -4))
    .sort();

export function conteudo() {
  const linhas = [
    '// GERADO por `node tools/indice-de-artes.mjs` — não edite à mão.',
    '// Os PNGs que existem em `client/assets/<pasta>/`, sem a extensão.',
    '// Ver o comentário no gerador e `artOrUiIcon` em hud.mjs.',
    'export const ARTES = {',
  ];
  for (const pasta of PASTAS) linhas.push(`  ${pasta}: new Set(${JSON.stringify(nomes(pasta))}),`);
  linhas.push('};', '');
  return linhas.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(DESTINO, conteudo());
  console.log('escrito', DESTINO);
}
