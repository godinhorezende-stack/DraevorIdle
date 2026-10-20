// IMPORTA a EFICÁCIA DO DANO ADICIONADO de cada gema, por nível, do Path of Building para `gamedata/itens-poe/pob-eficacia.json` (S002 — dono,
// 16/10: "Pode baixar" os `Data/Skills/act_*.lua`). A tabela de níveis do poedb não traz a coluna (só a faixa nas propriedades: "Eficácia do
// Dano Adicionado: (300 — 480)%" na Bola de Fogo); no PoB ela é o `damageEffectiveness` de cada nível (`levels[N]`).
//
// Os arquivos do PoB são só LIDOS como texto (nada do Lua roda). Baixados com a autorização do dono (16/10) de
// raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding/master/src/Data/Skills/ para fora do repositório.
//
//   node tools/importar-pob-eficacia.mjs [pasta Data/Skills do PoB]     (padrão: /home/deploy/referencias-poe/pob/Skills)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const SAIDA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'pob-eficacia.json');
const FONTE_PADRAO = '/home/deploy/referencias-poe/pob/Skills';
const ARQUIVOS = ['act_int.lua', 'act_str.lua', 'act_dex.lua'];

/**
 * `{ "Nome da gema": { nivel: eficácia } }` de um `act_*.lua`: as magias que têm o `damageEffectiveness` nos níveis — ou, com `{ ataques: true }`,
 * os ATAQUES (dono, 20/10: "eficácia como no PoE" — no ataque o PoB multiplica a arma pelo `baseMultiplier` e todo dano ADICIONADO pelo
 * `damageEffectiveness`, `CalcOffence.lua` "Calculate base hit damage"; sem o `damageEffectiveness` no nível, 1 — o `damageEffectiveness or 1` do PoB,
 * CalcOffence.lua:3262 —, gravado no nível, para o nível de baixo da tabela não valer por ele: o Tornado Shot 1, a Blade Trap 24, a Vaal Rain of Arrows 20).
 */
export function eficacias(texto, { ataques = false } = {}) {
  const saida = {};
  const inicios = [...texto.matchAll(/^skills\["\w+"\] = \{/gm)].map((m) => m.index);
  inicios.forEach((i, k) => {
    const corpo = texto.slice(i, inicios[k + 1] ?? texto.length);
    const nome = /\n\tname = "([^"]+)"/.exec(corpo)?.[1];
    const niveis = /\n\tlevels = \{([\s\S]*?)\n\t\},?\n/.exec(corpo)?.[1];
    // (só o que não é ATAQUE — no ataque, o número é o "Dano de Ataque X% de base", que o jogo já tem pela tabela do poedb; o Arauto do Gelo,
    // por exemplo, não marca `spell` nos `baseFlags`. Sem o `damageEffectiveness` nos níveis, a gema fica de fora: 100%, o padrão do PoE.)
    const magia = !/\n\tbaseFlags = \{[^}]*\battack = true/.test(corpo);
    if (!nome || !niveis || magia === ataques || /\n\thidden = true/.test(corpo)) return;
    const porNivel = {};
    for (const m of niveis.matchAll(/\[(\d+)\] = \{([^\n]*)\}/g)) {
      const ef = /damageEffectiveness = (-?[\d.]+)/.exec(m[2]);
      if (ef) porNivel[m[1]] = Math.round(Number(ef[1]) * 10000) / 10000;
      else if (ataques) porNivel[m[1]] = 1;
    }
    if (Object.keys(porNivel).length && !saida[nome]) saida[nome] = porNivel;
  });
  return saida;
}

export function importar(pasta = FONTE_PADRAO) {
  const gemas = {};
  const ataques = {};
  for (const a of ARQUIVOS) {
    const texto = readFileSync(join(pasta, a), 'utf8');
    for (const [k, v] of Object.entries(eficacias(texto))) gemas[k] ??= v;
    for (const [k, v] of Object.entries(eficacias(texto, { ataques: true }))) ataques[k] ??= v;
  }
  // (20/10: + `ataques` — os ataques à parte, para a eficácia das magias não mudar)
  return { fonte: 'Path of Building (PathOfBuildingCommunity/PathOfBuilding, master, src/Data/Skills: act_int.lua, act_str.lua, act_dex.lua) — 16/10/2026; ataques 20/10/2026', gemas, ataques };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dados = importar(process.argv[2] ?? FONTE_PADRAO);
  writeFileSync(SAIDA, `${JSON.stringify(dados)}\n`);
  console.log(`${Object.keys(dados.gemas).length} magias e ${Object.keys(dados.ataques).length} ataques com a eficácia por nível → ${SAIDA}`);
}
