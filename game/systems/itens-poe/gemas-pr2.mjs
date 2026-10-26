// O LOTE PR2 das gemas do PoE (dono, 20/10: as gemas ATIVAS de projétil que mexem no RECURSO — a Vida, o Escudo de Energia e os frascos). Aqui ficam os
// DADOS das linhas e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (o status e os leitores no nível), `acoes.mjs` (o uso: a base pela Vida e
// pelo Escudo, o dano em você, as cargas dos frascos, o Definhar) e `cacadas.mjs` (o dreno do debuff no tique).
//
// O que o lote faz, pelo PoE 1 (o PoB e o poedb), com as decisões do dono (20/10, as recomendações do plano aceitas):
//   - o RITUAL PROIBIDO (as duas): "Causa X% do seu máximo de Vida / Escudo de Energia como Dano de Caos base" — o PoB soma Vida × X + Escudo × Y no
//     ChaosMin E no ChaosMax da gema (preDamageFunc, act_int.lua:7390-7412): é dano BASE (não passa pela Eficácia do Dano Adicionado); e "Sofre X% da Vida
//     Máxima e Y% do Escudo de Energia Máximo como Dano de Caos" a cada conjuração — floor(round(Vida × X) × (100 − res. a Caos)/100 × o dano de Caos sofrido)
//     (o mesmo para o Escudo). D1 do dono: passa pela resistência a Caos, como no PoB, e PODE MATAR. O dano é de Caos: atravessa o Escudo de Energia, como o
//     Caos do PoE (`ModsPoe.caosAtravessaOEscudo` — salvo "X% do dano de caos sofrido não ignora o escudo de energia");
//   - o DRENAR ESSÊNCIA (as três): "Regenera X% do Dano do Debuff como Vida" (siphon_life_leech_from_damage_permyriad 50/100, + 2,5 por qualidade) e o do
//     Desespero, "Perca Vida e Escudo de Energia igual a 0.3% do Dano do Debuff" (essence_drain_lose_life_from_damage_permyriad 30). D2 do dono: a % do dano
//     de CADA debuff ativo da gema, somados (o Contágio espalha, então soma mais); sem teto. O dano é o que o pulso do degenerativo causa (depois da
//     resistência do alvo — `Dot.tique`), então "por segundo" é o dano por segundo de cada debuff;
//   - a BARGANHA SOMBRIA, só a parte em VOCÊ (D3 do dono): sem Esqueleto vivo, "Usa sua Vida" — 12% (+ a qualidade) da sua Vida máxima como Dano de Caos
//     BASE (o PoB, DarkPact "Cast on Player": ChaosMin/Max + Vida × X/100, act_int.lua:3888-3901) e "136% mais Dano com Acertos e Afecções se usar sua
//     Vida" (skeletal_chains_no_minions_damage_+%_final, MORE com Hit e Ailment); como no PoB, a Vida NÃO sai de você. A parte dos Esqueletos é da outra
//     sessão (as linhas "Sacrifica X% da Vida do Esqueleto…" seguem "efeito não simulado");
//   - os COMPOSTOS (D4 do dono: sem carga, como no PoE — o projétil sai sem o bônus): o Venenoso consome N cargas (1; o Saltador, 8) do PRIMEIRO Frasco de
//     Vida do cinto que tiver as N, por projétil, e ganha "Dano de Caos Adicional igual a X% da Quantidade de Recuperação do Frasco" (o PoB: ChaosMin/Max +
//     LifeFlaskRecovery × X/100, act_dex.lua:17417); o Explosivo consome 1 carga de UM frasco de cada tipo — Rubi, Safira, Topázio —, por projétil: a Safira
//     dá o Gelo adicional, o Topázio o Raio, o Rubi "+X% de Multiplicador de Dano Degenerativo com Incêndios" (o da Destruição: "+X% de Multiplicador de Golpe
//     Crítico"); a qualidade, "Cargas de Frasco usadas reduzidas em X%"; a do Venenoso, "X% de chance de infligir Definhando por 2 segundos ao Acertar";
//   - o Composto Venenoso SALTADOR: "Projéteis podem Ricochetear ao atingir o solo / Ricocheteiam para direções aleatórias" — o salto no solo do A3 (o
//     quadrado de 1 casa a cada 3 casas), com o rumo de cada salto sorteado (`gemas-poe.REGRAS_DE_ALVOS` → `saltoAleatorio`, `Secundarios.resolver`).
//
// EXCEÇÕES DO DONO (as escolhas sem fonte do lote — aprovadas pelo dono, 20/10): (1) o Ritual do totem e o da armadilha/mina não ferem você (o totem é da outra sessão; a do
// PoE fere o totem); (2) a perda do Desespero é a "perda por segundo" do jogo (a da Fúria Sangrenta): não passa pelas resistências nem pelo "dano sofrido" e
// não mata (deixa 1 de Vida); (3) "Esqueleto em alcance" (a Barganha) = um Esqueleto seu vivo a até o alcance da gema de você ou do alvo; (4) com mais de um
// projétil, cada um consome o seu; os que o frasco não pagou saem sem o bônus — no jogo os projéteis de um uso têm uma conta só, então o bônus do uso é ×
// (pagos ÷ projéteis); (5) o Rubi da Destruição e o do Explosivo seguem o mesmo ×; (6) as cargas reduzidas da qualidade são frações (0,85 de 1), como as
// cargas dos frascos do jogo.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return m; } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- o Ritual Proibido

const LINHA_BASE_DA_VIDA = /^Causa ([\d.]+) % do seu máximo de Vida como Dano de Caos base$/i;
const LINHA_BASE_DO_ESCUDO = /^Causa ([\d.]+) % do seu máximo de Escudo de Energia como Dano de Caos base$/i;
const LINHA_SOFRE_OS_DOIS = /^Sofre ([\d.]+) % da Vida Máxima e ([\d.]+) % do Escudo de Energia Máximo como Dano de Caos$/i;
const LINHA_SOFRE_O_ESCUDO = /^Sofre ([\d.]+) % do Escudo de Energia Máximo como Dano de Caos$/i;
/** O Ritual Proibido: `{ vidaPct, esPct, sofreVidaPct, sofreEsPct }` (a base pela Vida/Escudo e o dano em você a cada conjuração), ou null. */
export function ritualDasLinhas(slug, linhas = []) {
  if (!/^Forbidden_Rite/.test(slug)) return null;
  const vidaPct = Number(achar(linhas, LINHA_BASE_DA_VIDA)?.[1]) || 0;
  const esPct = Number(achar(linhas, LINHA_BASE_DO_ESCUDO)?.[1]) || 0;
  const dois = achar(linhas, LINHA_SOFRE_OS_DOIS);
  const so = achar(linhas, LINHA_SOFRE_O_ESCUDO);
  const sofreVidaPct = dois ? Number(dois[1]) : 0;
  const sofreEsPct = dois ? Number(dois[2]) : so ? Number(so[1]) : 0;
  return vidaPct || esPct || sofreVidaPct || sofreEsPct ? { vidaPct, esPct, sofreVidaPct, sofreEsPct } : null;
}
/** A base de Caos a mais (o mínimo e o máximo iguais): Vida máxima × X% + Escudo de Energia máximo × Y%. */
export const baseDoRitual = (r, vidaMax = 0, esMax = 0) => (r ? (Math.max(0, vidaMax) * r.vidaPct + Math.max(0, esMax) * r.esPct) / 100 : 0);
/**
 * O dano de Caos em você numa conjuração (o PoB: floor(round(Vida × X) × (100 − res)/100 × o sofrido), o mesmo do Escudo, somados). `fator`: o que passa da
 * resistência a Caos e dos "dano sofrido" (`ModsPoe.fatorDaResistenciaRecebida(ficha, 'chaos')` — a Inoculação do Caos dá 0).
 */
export function danoEmVoceDoRitual(r, vidaMax = 0, esMax = 0, fator = 1) {
  if (!r) return 0;
  const f = Math.max(0, fator);
  return Math.floor(Math.round((Math.max(0, vidaMax) * r.sofreVidaPct) / 100) * f) + Math.floor(Math.round((Math.max(0, esMax) * r.sofreEsPct) / 100) * f);
}

// ---------------------------------------------------------------- o Drenar Essência

const LINHA_DO_DRENO = /^Regenera \+?([\d.]+) % do Dano do Debuff como Vida$/i;
const LINHA_DA_PERDA = /^Perca Vida e Escudo de Energia igual a ([\d.]+) % do Dano do Debuff$/i;
/** O Drenar Essência: `{ vidaPct, perdaPct }` — a Vida regenerada e a Vida e o Escudo perdidos, em % do dano de cada debuff da gema —, ou null. */
export function drenoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Essence_Drain/.test(slug)) return null;
  const vidaPct = somar([...linhas, ...daQualidade], LINHA_DO_DRENO);
  const perdaPct = somar(linhas, LINHA_DA_PERDA);
  return vidaPct || perdaPct ? { vidaPct, perdaPct } : null;
}
/** O que um pulso de `dano` (já depois da resistência do alvo) dá: `{ vida, perda }`. */
export const drenoDoPulso = (d, dano) => ({ vida: (Math.max(0, dano) * (d?.vidaPct ?? 0)) / 100, perda: (Math.max(0, dano) * (d?.perdaPct ?? 0)) / 100 });

// ---------------------------------------------------------------- a Barganha Sombria (a parte em você)

const LINHA_DA_BARGANHA = /^Sacrifica \+?([\d.]+) % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos$/i;
const LINHA_USA_SUA_VIDA = /^Usa sua Vida se não houver Esqueletos em alcance$/i;
const LINHA_MAIS_COM_SUA_VIDA = /^([\d.]+) % mais Dano com Acertos e Afecções se usar sua Vida$/i;
/** A Barganha Sombria: `{ vidaPct, maisPct }` (o X% da Vida, com a qualidade, e o "mais Dano" se usar a sua), ou null. */
export function barganhaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Dark_Bargain' || !achar(linhas, LINHA_USA_SUA_VIDA)) return null;
  return { vidaPct: somar([...linhas, ...daQualidade], LINHA_DA_BARGANHA), maisPct: Number(achar(linhas, LINHA_MAIS_COM_SUA_VIDA)?.[1]) || 0 };
}
/** Um lacaio seu é Esqueleto (o tipo do PoB — `RaisedSkeleton…` — ou o nome). */
export const ehEsqueleto = (l) => !!l && (/^RaisedSkeleton/.test(String(l.pob ?? '')) || /esqueleto|skeleton/i.test(String(l.nome ?? '')));

// ---------------------------------------------------------------- os Compostos

const LINHA_DO_VENENOSO = /^Consome (\d+) Cargas? de 1 Frasco de Vida, se possível, por Projétil Disparado$/i;
const LINHA_DA_RECUPERACAO = /^Dano de Caos Adicional igual a ([\d.]+) % da Quantidade de Recuperação do Frasco se Cargas foram consumidas de um Frasco de Vida$/i;
const LINHA_DO_EXPLOSIVO = /^Pode consumir Cargas de um Frasco de Rubi, Safira e Topázio Consome (\d+) Cargas? de 1 Frasco de cada tipo válido, se possível, por Projétil Disparado$/i;
const LINHA_DA_SAFIRA = /^Causa ([\d.]+) a ([\d.]+) de Dano de Gelo Adicional se Cargas de um Frasco de Safira foram consumidas$/i;
const LINHA_DO_TOPAZIO = /^Causa ([\d.]+) a ([\d.]+) de Dano de Raio Adicional se Cargas de um Frasco de Topázio foram consumidas$/i;
const LINHA_DO_RUBI_INCENDIO = /^\+([\d.]+) % de Multiplicador de Dano Degenerativo com Incêndios se Cargas de um Frasco de Rubi foram consumidas$/i;
const LINHA_DO_RUBI_CRITICO = /^\+([\d.]+) % de Multiplicador de Golpe Crítico se Cargas foram consumidas de um Frasco de Rubi$/i;
const LINHA_DAS_CARGAS = /^Cargas de Frasco usadas reduzidas em ([\d.]+) %$/i;
/** Os frascos que o Explosivo usa (a base do frasco no catálogo do PoE). */
export const FRASCO_DO_TIPO = Object.freeze({ safira: 'Sapphire_Flask', topazio: 'Topaz_Flask', rubi: 'Ruby_Flask' });
/**
 * O Composto: `{ tipo: 'vida', cargas, pctDaRecuperacao }` (o Venenoso) ou `{ tipo: 'explosivo', cargas, safira: [a, b], topazio: [a, b], rubi: { atributo:
 * valor } }` (o Explosivo — o Rubi: o Multiplicador degenerativo do Incêndio, `dot_multi_fire`; o da Destruição: o de Golpe Crítico, `crit_dmg`), com as
 * `cargas` por projétil já × a redução da qualidade; ou null.
 */
export function compostoDasLinhas(slug, linhas = [], daQualidade = []) {
  const red = Math.max(0, Math.min(100, somar(daQualidade, LINHA_DAS_CARGAS)));
  const vida = achar(linhas, LINHA_DO_VENENOSO);
  if (vida) return { tipo: 'vida', cargas: Number(vida[1]) * (1 - red / 100), pctDaRecuperacao: Number(achar(linhas, LINHA_DA_RECUPERACAO)?.[1]) || 0 };
  const ex = achar(linhas, LINHA_DO_EXPLOSIVO);
  if (!ex) return null;
  const faixa = (m) => (m ? [Number(m[1]), Number(m[2])] : null);
  const inc = achar(linhas, LINHA_DO_RUBI_INCENDIO);
  const crit = achar(linhas, LINHA_DO_RUBI_CRITICO);
  return { tipo: 'explosivo', cargas: Number(ex[1]) * (1 - red / 100), safira: faixa(achar(linhas, LINHA_DA_SAFIRA)), topazio: faixa(achar(linhas, LINHA_DO_TOPAZIO)),
    rubi: inc ? { dot_multi_fire: Number(inc[1]) } : crit ? { crit_dmg: Number(crit[1]) } : null };
}
/**
 * Quantos dos `n` projéteis um frasco com `cargas` paga, a `porProjetil` cada: `{ pagos, gastas }` (o que o frasco não paga sai sem o bônus — a exceção 4).
 */
export function pagosPeloFrasco(cargas, porProjetil, n) {
  const c = Math.max(0, Number(cargas) || 0);
  const p = Math.max(0, Number(porProjetil) || 0);
  const total = Math.max(1, Math.round(n) || 1);
  if (!(p > 0)) return { pagos: total, gastas: 0 };
  const pagos = Math.min(total, Math.floor(c / p + 1e-9));
  return { pagos, gastas: pagos * p };
}
/**
 * O que o uso ganha dos frascos (`{ af }` no formato do efeito da gema — `somadoMin:<el>`/`somadoMax:<el>` e `af:<atributo>`): o adicional × a fração dos
 * projéteis pagos. `pagos`: `{ vida: { fracao, recuperacao } }` ou `{ safira, topazio, rubi }` com a fração de cada.
 */
export function bonusDoComposto(c, pagos) {
  const af = {};
  const add = (el, a, b) => { if (!(a > 0 || b > 0)) return; af[`somadoMin:${el}`] = (af[`somadoMin:${el}`] ?? 0) + a; af[`somadoMax:${el}`] = (af[`somadoMax:${el}`] ?? 0) + b; af.somadoMin = (af.somadoMin ?? 0) + a; af.somadoMax = (af.somadoMax ?? 0) + b; };
  if (!c || !pagos) return af;
  if (c.tipo === 'vida') {
    const f = pagos.vida?.fracao ?? 0;
    const x = ((pagos.vida?.recuperacao ?? 0) * c.pctDaRecuperacao) / 100 * f;
    add('chaos', x, x);
    return af;
  }
  if (c.safira && pagos.safira > 0) add('ice', c.safira[0] * pagos.safira, c.safira[1] * pagos.safira);
  if (c.topazio && pagos.topazio > 0) add('energy', c.topazio[0] * pagos.topazio, c.topazio[1] * pagos.topazio);
  if (c.rubi && pagos.rubi > 0) for (const [k, v] of Object.entries(c.rubi)) af[`af:${k}`] = (af[`af:${k}`] ?? 0) + v * pagos.rubi;
  return af;
}

const LINHA_DO_DEFINHAR = /^([\d.]+) % de chance de infligir Definhando por ([\d.]+) segundos ao Acertar$/i;
/** "X% de chance de infligir Definhando por N segundos ao Acertar" (a qualidade do Venenoso): `{ chance, ms }`, ou null. */
export function definharDasLinhas(daQualidade = []) {
  const m = achar(daQualidade, LINHA_DO_DEFINHAR);
  return m && Number(m[1]) > 0 ? { chance: Number(m[1]), ms: Math.round(Number(m[2]) * 1000) } : null;
}

// ---------------------------------------------------------------- o status

const LINHAS_PR2 = [
  [LINHA_BASE_DA_VIDA, /^Forbidden_Rite$/], [LINHA_BASE_DO_ESCUDO, /^Forbidden_Rite/], [LINHA_SOFRE_OS_DOIS, /^Forbidden_Rite$/], [LINHA_SOFRE_O_ESCUDO, /^Forbidden_Rite_of_Soul_Sacrifice$/],
  [LINHA_DO_DRENO, /^Essence_Drain(_of_Wickedness)?$/], [LINHA_DA_PERDA, /^Essence_Drain_of_Desperation$/],
  [LINHA_USA_SUA_VIDA, /^Dark_Bargain$/], [LINHA_MAIS_COM_SUA_VIDA, /^Dark_Bargain$/],
  [LINHA_DO_VENENOSO, /^Poisonous_Concoction/], [LINHA_DA_RECUPERACAO, /^Poisonous_Concoction/], [LINHA_DO_DEFINHAR, /^Poisonous_Concoction/],
  [/^Projéteis podem Ricochetear ao atingir o solo Projéteis Ricocheteiam para direções aleatórias$/i, /^Poisonous_Concoction_of_Bouncing$/],
  [LINHA_DO_EXPLOSIVO, /^Explosive_Concoction/], [LINHA_DA_SAFIRA, /^Explosive_Concoction/], [LINHA_DO_TOPAZIO, /^Explosive_Concoction/], [LINHA_DO_RUBI_INCENDIO, /^Explosive_Concoction$/],
  [LINHA_DO_RUBI_CRITICO, /^Explosive_Concoction_of_Destruction$/], [LINHA_DAS_CARGAS, /^Explosive_Concoction/],
];
/** A linha da gema é uma das que este lote faz (sai de "efeito não simulado"). */
export const ehLinhaPR2 = (slug, l) => LINHAS_PR2.some(([re, gema]) => gema.test(slug) && re.test(norm(l)));
