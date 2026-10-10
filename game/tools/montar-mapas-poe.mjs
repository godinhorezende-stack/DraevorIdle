// Os MAPAS do PoE (endgame T1–T16, 10/10) a partir do poedb guardado pelo Scrapling (`/home/deploy/scrapling/saida/html`, fora do repo):
//   - `Maps_low_tier`, `Maps_mid_tier`, `Maps_top_tier`: os modificadores de mapa de cada faixa (o poedb traz o JSON dos mods na página);
//   - `Map_(Tier_N)`: a base de cada tier ("Mapa (Nível N)", `MapKeyTierN`). O ícone é o do dono (10/10): a moeda com o número do tier,
//     importada por `tools/importar-icones-mapas.mjs` para `gamedata/itens-poe/icones-itens/poe-itens/Mapas/icones/Map_Tier_N.png` (a sprite
//     `MapNumbersN` do poedb era só a camada do número).
// Saída: `gamedata/itens-poe/mapas.json` — a CLASSE Mapas no formato do catálogo (bases e páginas de mods, para o gerador, as moedas e o
// balão funcionarem sem um segundo sistema), o EFEITO de cada família no jogo (`EFEITOS`, abaixo: só entra no pool o que age de verdade) e
// a lista do que ainda não tem mecânica (`naoImplementados`, com o motivo — não sorteia). As seções feitas à mão (`tiers`, `drop`,
// `dispositivo`, `instancia`) são PRESERVADAS: rodar de novo só refaz a classe e os mods.
//
//   node tools/montar-mapas-poe.mjs            (POEDB_HTML=<pasta> para outra cópia do poedb)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const HTML = process.env.POEDB_HTML ?? '/home/deploy/scrapling/saida/html';
const SAIDA = new URL('../gamedata/itens-poe/mapas.json', import.meta.url);
const FAIXAS = { baixo: { pagina: 'Maps_low_tier', tiers: [1, 5] }, medio: { pagina: 'Maps_mid_tier', tiers: [6, 10] }, alto: { pagina: 'Maps_top_tier', tiers: [11, 16] } };
export const ID_BASE = 7_700_000;

/*
 * O EFEITO de cada família no jogo. `{ alvo, stat, de, escala?, fixo?, parcial? }`: `de` = o índice do valor no modelo ({0}, {1}…), `escala`
 * multiplica (o "aumentado" do crítico vira pontos sobre os 5% de base do PoE), `fixo` = um valor que não vem do texto. Alvos:
 *   monstros.<stat>  — somado nos monstros da instância (`Raridade.aplicar` → `extra`: vidaPct, danoPct, velocidadePct…; `resist.<el>`;
 *                       `danoExtraPct.<el>` = "X% do Dano Físico como Dano de <el> extra"; `imuneAtordoamento`);
 *   chefe.<stat>     — só no chefe do mapa (vidaPct, danoPct);
 *   instancia.<k>    — a composição (rarosPct, magicosPct, chefes);
 *   jogador.<stat>   — o atributo do personagem enquanto está no mapa (`Afixos.soma`); `jogador.maldicao` = a maldição do PoE em você.
 * `parcial`: o que da linha ainda não age (aparece no balão).
 */
const EFEITOS = {
  // ("X% mais Vida de Monstros": um "mais" do PoE — dois deles MULTIPLICAM, `mais: true`.)
  MapMonsterLife: [{ alvo: 'monstros', stat: 'vidaPct', de: 0, mais: true }],
  MapMonsterCannotBeStunned: [{ alvo: 'monstros', stat: 'vidaPct', de: 0, mais: true }, { alvo: 'monstros', stat: 'imuneAtordoamento', fixo: 1 }],
  MapMonsterDamage: [{ alvo: 'monstros', stat: 'danoPct', de: 0 }],
  MapMonsterElementalDamage: [{ alvo: 'monstros', stat: 'danoExtraPct.fire', de: 0 }],
  MapMonsterFireDamage: [{ alvo: 'monstros', stat: 'danoExtraPct.fire', de: 0 }],
  MapMonsterColdDamage: [{ alvo: 'monstros', stat: 'danoExtraPct.ice', de: 0 }],
  MapMonsterLightningDamage: [{ alvo: 'monstros', stat: 'danoExtraPct.energy', de: 0 }],
  MapMonsterPhysicalResistance: [{ alvo: 'monstros', stat: 'resist.physical', de: 0 }],
  MapMonstersAllResistances: [{ alvo: 'monstros', stat: 'resist.chaos', de: 0 }, { alvo: 'monstros', stat: 'resist.fire', de: 1 }, { alvo: 'monstros', stat: 'resist.ice', de: 1 }, { alvo: 'monstros', stat: 'resist.energy', de: 1 }],
  MapMonsterFast: [{ alvo: 'monstros', stat: 'velocidadePct', de: 0 }, { alvo: 'monstros', stat: 'velocidadeDeAtaquePct', de: 1, parcial: 'a velocidade de conjuração dos monstros ainda não existe no jogo' }],
  MapMonsterCriticalStrikesAndDamage: [{ alvo: 'monstros', stat: 'critChance', de: 0, escala: 0.05 }, { alvo: 'monstros', stat: 'critMultiplicador', de: 1 }],
  MapMonstersMaximumLifeAddedEnergyShield: [{ alvo: 'monstros', stat: 'esPct', de: 0 }],
  MapMonsterAccuracyPlayersUnlockyDodge: [{ alvo: 'monstros', stat: 'precisaoPct', de: 0, parcial: 'o azar na supressão de dano mágico ainda não existe no jogo' }],
  MapNemesisModOnRares: [{ alvo: 'instancia', stat: 'rarosPct', de: 0 }],
  MapBloodlinesModOnMagics: [{ alvo: 'instancia', stat: 'magicosPct', de: 0 }],
  MapBossMod: [{ alvo: 'chefe', stat: 'danoPct', de: 0, parcial: 'a velocidade de conjuração do chefe ainda não existe no jogo' }],
  MapDangerousBoss: [{ alvo: 'chefe', stat: 'danoPct', de: 0, parcial: 'a velocidade de conjuração do chefe ainda não existe no jogo' }],
  MapMassiveBoss: [{ alvo: 'chefe', stat: 'vidaPct', de: 0, parcial: 'o efeito em área do chefe ainda não existe no jogo' }],
  MapTwoBosses: [{ alvo: 'instancia', stat: 'chefes', fixo: 2 }],
  MapPlayerCurse: [{ alvo: 'jogador', stat: 'maldicao', fixo: 'fraquezaElemental' }],
  MapPlayerElementalWeakness: [{ alvo: 'jogador', stat: 'maldicao', fixo: 'fraquezaElemental' }],
  MapPlayerVulnerability: [{ alvo: 'jogador', stat: 'maldicao', fixo: 'vulnerabilidade' }],
  MapPlayerEnfeeblement: [{ alvo: 'jogador', stat: 'maldicao', fixo: 'enfraquecer' }],
  MapPlayerReducedRegen: [{ alvo: 'jogador', stat: 'recuperacao_inc', de: 0, escala: -1 }],
  MapPlayerMaxResists: [{ alvo: 'jogador', stat: 'fire_res_max', de: 0 }, { alvo: 'jogador', stat: 'ice_res_max', de: 0 }, { alvo: 'jogador', stat: 'energy_res_max', de: 0 }, { alvo: 'jogador', stat: 'chaos_res_max', de: 0 }],
  MapPlayerAccuracyRating: [{ alvo: 'jogador', stat: 'accuracy_less', de: 0 }],
  MapPlayerCooldownRecovery: [{ alvo: 'jogador', stat: 'cooldown_recovery', de: 0, escala: -1 }],
  MapPlayersGainReducedFlaskCharges: [{ alvo: 'jogador', stat: 'frasco_cargas_recebidas', de: 0, escala: -1 }],
};
/** A versão de uma família com OUTRO texto (o mesmo grupo no poedb, outro efeito): pelo texto, antes do efeito da família. */
const EFEITOS_POR_TEXTO = [
  // ("não podem Regenerar Vida, Mana ou Escudo de Energia" — o tier alto da família da recuperação; o jogo não tem regeneração de escudo.)
  [/não podem Regenerar Vida, Mana ou Escudo de Energia/i, [{ alvo: 'jogador', stat: 'sem_regen_vida', fixo: 1 }, { alvo: 'jogador', stat: 'sem_regen_mana', fixo: 1 }]],
  // A família das maldições do mapa (MapPlayerCurse) tem uma versão por maldição: cada uma é a SUA (`condicoes-poe.MALDICOES_DOS_MONSTROS`).
  [/Amaldiçoados com Fraqueza Elemental/i, [{ alvo: 'jogador', stat: 'maldicao', fixo: 'fraquezaElemental' }]],
  [/Amaldiçoados com Vulnerabilidade/i, [{ alvo: 'jogador', stat: 'maldicao', fixo: 'vulnerabilidade' }]],
  [/Amaldiçoados com Debilitar/i, [{ alvo: 'jogador', stat: 'maldicao', fixo: 'enfraquecer' }]],
];
/** A versão de uma família que ainda NÃO age (a família tem efeito, esta versão não): fica fora do sorteio, com o motivo. */
const NAO_IMPLEMENTADOS_POR_TEXTO = [
  [/Amaldiçoados com Grilhões Temporais/i, 'a maldição Grilhões Temporais (lentidão) ainda não existe entre as maldições dos monstros'],
];
/** Por que a família ainda não age (o que falta no jogo). */
const MOTIVO = {
  MapTotems: 'os totens dos monstros ainda não existem no jogo',
  MapGroundEffect: 'o solo ardente/gélido/eletrizado ainda não existe no jogo',
  MapMonsterPacks: 'trocar os grupos por uma família de monstros (Esqueletos…) ainda não existe no jogo',
  MapBossPossessed: 'os espíritos que possuem monstros ainda não existem no jogo',
  MapMonsterChain: 'as habilidades dos monstros ainda não ricocheteiam',
  MapMonsterMultipleProjectiles: 'os projéteis adicionais dos monstros ainda não existem',
  MapMonsterAreaOfEffect: 'o efeito em área dos monstros ainda não existe',
  MapMonsterPhysicalReflection: 'os espinhos de dano fixo dos monstros raros ainda não existem (o reflexo de hoje é em % do dano)',
  MapMonsterElementalReflection: 'os espinhos de dano fixo dos monstros raros ainda não existem (o reflexo de hoje é em % do dano)',
};

const limpar = (s) => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
/** Os objetos de mod do JSON embutido na página do poedb. */
function modsDaPagina(nome) {
  const h = readFileSync(join(HTML, `${nome}.html`), 'utf8');
  const out = [];
  for (const m of h.matchAll(/\[\{"Name":/g)) {
    let prof = 0;
    for (let j = m.index; j < h.length; j++) {
      if (h[j] === '[') prof++;
      else if (h[j] === ']' && --prof === 0) {
        try { out.push(...JSON.parse(h.slice(m.index, j + 1))); } catch { /* outro array */ }
        break;
      }
    }
  }
  return out;
}
const ehDaRecompensa = (l) => /^Quantidade de Itens encontrados|^Raridade de Itens encontrados|^Tamanho do Grupo aumentado/i.test(l);
/** A descrição INTERNA que o poedb não traduziu ("map extra content weighting [1]"): não é texto de jogador, não vai para o item. */
const ehInterna = (l) => /^[a-z][a-z0-9 _%+'-]*\[[-\d., ]+\]$/.test(l);
/** Uma linha → { texto, modelo, faixas } (as faixas "(a—b)" e os números soltos viram {i}). */
function linhaDoMod(l, inicio) {
  const faixas = [];
  let i = inicio;
  const modelo = l.replace(/\((-?\d+(?:\.\d+)?)\s*—\s*(-?\d+(?:\.\d+)?)\)|(-?\d+(?:\.\d+)?)/g, (_, a, b, c) => {
    faixas.push(a != null ? [Number(a), Number(b)] : [Number(c), Number(c)]);
    return `{${i++}}`;
  });
  return { modelo, faixas };
}
const nomeDoMod = (n) => (String(n).match(/\{([^}]+)\}/)?.[1] ?? String(n)).trim();
const numero = (l) => Number(l.match(/(-?\d+(?:\.\d+)?)\s*%?\s*$/)?.[1] ?? 0);

const antigo = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : {};
const paginas = {};
const naoImplementados = new Map();
for (const [faixa, { pagina }] of Object.entries(FAIXAS)) {
  const lados = { prefixos: [], sufixos: [] };
  for (const m of modsDaPagina(pagina)) {
    const familia = (m.ModFamilyList ?? [])[0] ?? '?';
    const linhas = limpar(m.str).split('\n').map((x) => x.trim()).filter(Boolean);
    const efeitoDasLinhas = linhas.filter((l) => !ehDaRecompensa(l) && !ehInterna(l));
    const recompensa = {
      quantidade: numero(linhas.find((l) => /^Quantidade de Itens/i.test(l)) ?? ''),
      raridade: numero(linhas.find((l) => /^Raridade de Itens/i.test(l)) ?? ''),
      grupo: numero(linhas.find((l) => /^Tamanho do Grupo/i.test(l)) ?? ''),
    };
    if (!EFEITOS[familia]) {
      naoImplementados.set(familia, { familia, texto: efeitoDasLinhas.join(' / '), motivo: MOTIVO[familia] ?? 'ainda não tem a mecânica no jogo' });
      continue;
    }
    const semEfeito = NAO_IMPLEMENTADOS_POR_TEXTO.find(([re]) => efeitoDasLinhas.some((l) => re.test(l)));
    if (semEfeito) {
      naoImplementados.set(`${familia}:${efeitoDasLinhas.join(' / ')}`, { familia, texto: efeitoDasLinhas.join(' / '), motivo: semEfeito[1] });
      continue;
    }
    let n = 0;
    const partes = efeitoDasLinhas.map((l) => { const r = linhaDoMod(l, n); n += r.faixas.length; return r; });
    const modelo = partes.map((p) => p.modelo).join(' / ');
    const faixas = partes.flatMap((p) => p.faixas);
    const texto = modelo.replace(/\{(\d+)\}/g, (_, k) => { const [a, b] = faixas[k]; return a === b ? String(a) : `(${a}—${b})`; });
    const lado = m.ModGenerationTypeID === '1' ? 'prefixo' : 'sufixo';
    lados[`${lado}s`].push({
      familia, lado, tags: [], peso: Number(m.DropChance) || 0, ilvlMax: 1,
      tiers: [{ tier: 1, nome: nomeDoMod(m.Name), ilvl: 1, peso: Number(m.DropChance) || 0, texto, modelo, faixas }],
      efeitos: EFEITOS_POR_TEXTO.find(([re]) => re.test(texto))?.[1] ?? EFEITOS[familia], recompensa,
    });
  }
  paginas[faixa] = lados;
}

const tiers = antigo.tiers ?? Array.from({ length: 16 }, (_, k) => ({ tier: k + 1, nivel: 68 + k }));
const faixaDoTier = (t) => Object.entries(FAIXAS).find(([, f]) => t >= f.tiers[0] && t <= f.tiers[1])[0];
const classe = {
  id: 'Maps', grupo: 'Mapas', fontes: ['https://poedb.tw/pt/Maps', ...Object.values(FAIXAS).map((f) => `https://poedb.tw/pt/${f.pagina}`)],
  bases: tiers.map(({ tier, nivel }) => ({
    id: `Maps/Map_Tier_${tier}`, slug: `Map_Tier_${tier}`, nome: `Mapa (Nível ${tier})`, itemId: ID_BASE + tier,
    requisitos: { nivel: null, forca: null, destreza: null, inteligencia: null },
    atributos: { tier, nivel_area: nivel }, implicitos: [], icone: `poe-itens/Mapas/icones/Map_Tier_${tier}.png`, iconeLado: 80, pool: faixaDoTier(tier),
  })),
  paginas, unicos: [],
};
const saida = {
  _nota: 'Os MAPAS do endgame do PoE (T1–T16). `classe` e os mods (`classe.paginas`) são gerados por tools/montar-mapas-poe.mjs a partir do poedb (rodar de novo refaz só eles); `tiers`, `drop`, `dispositivo` e `instancia` são a CONFIGURAÇÃO do jogo, editável aqui e preservada pelo gerador. Só entram no pool as famílias com `efeitos` (o que age de verdade no jogo); as outras ficam em `naoImplementados`, com o motivo.',
  tiers,
  ...(antigo.drop ? { drop: antigo.drop } : {}),
  ...(antigo.dispositivo ? { dispositivo: antigo.dispositivo } : {}),
  ...(antigo.instancia ? { instancia: antigo.instancia } : {}),
  classe,
  naoImplementados: [...naoImplementados.values()].sort((a, b) => a.familia.localeCompare(b.familia)),
};
writeFileSync(SAIDA, `${JSON.stringify(saida, null, 1)}\n`);
const contar = (f) => paginas[f].prefixos.length + paginas[f].sufixos.length;
console.log(`mapas.json: ${tiers.length} tiers; mods com efeito — baixo ${contar('baixo')}, médio ${contar('medio')}, alto ${contar('alto')}; famílias sem mecânica: ${naoImplementados.size}`);
