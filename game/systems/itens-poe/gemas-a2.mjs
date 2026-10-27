// O LOTE A2 das gemas do PoE (dono, 19/10: "as gemas sem efeito do PoE"): a mecânica própria das gemas que o PoB chama de BUFF e o jogo não
// tinha como fazer — o Berserk, o Sangue Petrificado, a Fenda Temporal, o Escudo Gélido, o Emblema do Poder, a Parede de Força, a Lâmina de
// Energia, o Cajado Impregnado de Mana — e as auras templárias da Sentinela Divina. Os NÚMEROS vêm das linhas de cada gema no nível
// (`GemasPoe.daGemaA2`, guardados no buff: `b.a2`); aqui fica o estado da caçada (`hunt.a2`) e as contas. Quem chama: `acoes.mjs` (o uso e o
// tique — `Acoes.tiqueDasGemasA2`), `hunt/combate.mjs` e `poderes.mjs` (o acerto no personagem), `GemasPoe.adds` (o que vale na ficha).
//
// EXCEÇÕES DO DONO (19/10, as escolhas sem fonte do lote A2, aceitas): (1) o Berserk perde 5 × 1,2^(segundos inteiros) de Fúria por segundo, além
// da perda inerente; (2) a Parede de Força fica na casa do meio entre você e o alvo, a até 17 casas, com 6 m = 3 casas, e cada uso de projétil que a
// cruza gasta 1 das 17 colisões; (3) o raio do Emblema (3 m) = 2 casas, o alcance das torres da Torre Óssea (2,4 m) = 1 casa e a explosão delas
// (4,5 m) = 2 casas; (4) o Resfriamento da área do Escudo Gélido é o do solo frio do jogo (10%) × (1 + a qualidade); (5) o teto do Sangue
// Petrificado é por tique (a Vida sobe até o maior entre Vida Baixa e a do fim do tique anterior); (6) o monstro em fuga dá o passo que mais o
// afasta de você; (7) a Automação, a Lâmina e o Berserk ligados saem com a gema fora da barra, e o clique que desliga respeita a recarga da gema.
// (Também do dono: o raio de 1 casa do Escudo Gélido e o anel de 2 casas da Onda Arcana, sem fonte no PoB.)
//
// (Sem uso no nível do módulo dos outros módulos: o `gemas-poe.mjs` importa este — o ciclo só vale dentro das funções.)
import * as ModsPoe from './condicoes-poe.mjs';
import * as Testador from '../personagem/testador.mjs';

const PREFIXO = 'poe-gema:';
export const ACAO = Object.freeze({
  berserk: `${PREFIXO}Berserk`, sangue: `${PREFIXO}Petrified_Blood`, fenda: `${PREFIXO}Temporal_Rift`, automacao: `${PREFIXO}Automation`,
  lamina: `${PREFIXO}Energy_Blade`, escudoGelido: `${PREFIXO}Frost_Shield`, cajado: `${PREFIXO}Mana-Infused_Staff`, emblema: `${PREFIXO}Sigil_of_Power`,
  parede: `${PREFIXO}Wall_of_Force`, furiaSangrenta: `${PREFIXO}Blood_Rage`,
});
const casas = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// (o bicho e a casa sem `z` estão no andar da caçada)
const mesmoAndar = (h, o) => (o?.z ?? h?.z ?? 0) === (h?.z ?? 0);
/** O buff da gema ligado agora (ou null). */
export const ligado = (hunt, acao) => { const b = hunt?.buffs?.[acao]; return b && b.ate > (hunt.clock ?? 0) ? b : null; };

// ---------------------------------------------------------------- o Berserk

/**
 * (lote A2, dono 19/10) O BERSERK (PoB act_str.lua:934-1006): precisa de "Ao menos 5 de Fúria" para entrar; enquanto dura, perde "5 de Fúria por
 * segundo", com "a cada segundo 20% mais Fúria perdida" (a perda do segundo N é 5 × 1,2^N — o "mais" do PoE multiplica a cada segundo; a forma
 * exata da aceleração não está nos dados: a exceção (1) do dono), além da perda inerente; o buff acaba com a Fúria em 0, e só então a recarga começa
 * ("A Recarga desta Habilidade não é recuperada durante seu efeito"). Devolve true quando acabou neste tique.
 */
export function tiqueDoBerserk(hunt, agora = hunt?.clock ?? 0) {
  const b = ligado(hunt, ACAO.berserk);
  if (!b) return false;
  const f = (hunt.furia ??= { n: 0, ganhou: agora, perdeu: agora });
  const a2 = b.a2 ?? {};
  const porS = Number(a2.perdaPorS) || 5;
  const acelera = 1 + (Number(a2.aceleraPct) || 0) / 100;
  b.perdaEm ??= b.desde ?? agora;
  // (a perda contínua: o resto fracionário fica no buff)
  while (b.perdaEm < agora && f.n > 0) {
    const passo = Math.min(agora - b.perdaEm, 100);
    const seg = Math.floor((b.perdaEm - (b.desde ?? agora)) / 1000);
    b.resto = (b.resto ?? 0) + (porS * acelera ** seg * passo) / 1000;
    const inteiro = Math.floor(b.resto);
    if (inteiro > 0) { b.resto -= inteiro; f.n = Math.max(0, (f.n | 0) - inteiro); }
    else if (b.resto > 1 - 1e-9) { b.resto = 0; f.n = Math.max(0, (f.n | 0) - 1); }
    b.perdaEm += passo;
  }
  if (f.n > 0) return false;
  return true;
}

// ---------------------------------------------------------------- o Sangue Petrificado

/**
 * (lote A2) O SANGUE PETRIFICADO no acerto (act_str.lua:8538-8596, `LifeLossBelowHalfPrevented`): da Vida que o acerto tiraria ABAIXO da metade,
 * `impedePct` (40%) é impedida; dessa parte impedida, `perdePct` (81%, −0,25 por % de qualidade) é perdida ao longo de 1 s (a fila do tique) e o
 * resto não é perdido. `v`: a Vida que o acerto tira agora. Devolve a Vida que sai na hora.
 */
export function impedirNoSangue(estado, hunt, v, agora = hunt?.clock ?? 0) {
  const b = ligado(hunt, ACAO.sangue);
  if (!b || !(v > 0)) return v;
  const a2 = b.a2 ?? {};
  const metade = (estado.maxHp ?? 0) / 2;
  const hp = estado.hp ?? 0;
  const abaixo = Math.max(0, Math.min(v, metade - Math.max(0, hp - v)));
  if (!(abaixo > 0)) return v;
  const impedido = (abaixo * (Number(a2.impedePct) || 0)) / 100;
  const perde = (impedido * Math.max(0, (Number(a2.perdePct) || 0) - (Number(a2.qualidadeMenosPct) || 0))) / 100;
  const ms = Math.max(100, Number(a2.duranteMs) || 1000);
  if (perde > 0) ((hunt.a2 ??= {}).sangue ??= []).push({ porMs: perde / ms, de: agora, ate: agora + ms });
  return Math.max(0, Math.round(v - impedido));
}
/** (lote A2) O tique do Sangue Petrificado: a Vida impedida que se perde ao longo de 1 s (como o dano degenerativo do PoE, ela pode matar). */
export function tiqueDoSangue(estado, hunt, agora = hunt?.clock ?? 0) {
  const fila = hunt?.a2?.sangue;
  if (!fila?.length) return 0;
  let total = 0;
  for (const p of fila) {
    const fim = Math.min(agora, p.ate);
    if (fim > p.de) { p.resto = (p.resto ?? 0) + (fim - p.de) * p.porMs; p.de = fim; }
    const inteiro = Math.floor(p.resto ?? 0);
    if (inteiro > 0) { p.resto -= inteiro; total += inteiro; }
  }
  hunt.a2.sangue = fila.filter((p) => p.ate > agora || (p.resto ?? 0) >= 1);
  if (total > 0 && (estado.hp ?? 0) > 0) estado.hp = Math.max(Testador.pisoDaVida(estado), (estado.hp ?? 0) - total);
  return total;
}
/**
 * (lote A2) "Vida Recuperada diferente de Frascos não pode Recuperar Vida acima de Vida Baixa": a Vida que subiu desde o fim do tique anterior
 * (a regeneração, o roubo, a recuperação) só fica até Vida Baixa — ou até onde ela já estava (estar acima não tira nada). Quem chama: o tique, ANTES
 * dos frascos (que passam por cima); `fimDoTique` guarda a Vida depois deles. (Por tique: a exceção (5) do dono.)
 */
export function tetoDoSangue(estado, hunt) {
  const b = ligado(hunt, ACAO.sangue);
  if (!b || !b.a2?.tetoVidaBaixa || !((estado.hp ?? 0) > 0)) return;
  const baixa = Math.floor((estado.maxHp ?? 0) * ModsPoe.VIDA_BAIXA);
  const antes = hunt.a2?.sangueVida ?? estado.hp;
  const teto = Math.max(baixa, antes);
  if (estado.hp > teto) estado.hp = teto;
}
export function fimDoTiqueDoSangue(estado, hunt) {
  if (ligado(hunt, ACAO.sangue)) (hunt.a2 ??= {}).sangueVida = estado.hp ?? 0;
  else if (hunt?.a2) delete hunt.a2.sangueVida;
}
/** (lote A2) "Habilidades ganham Custo de Vida Base igual a 40% do Custo de Mana Base enquanto não estiver em Vida Baixa" — o % (0 sem ele). */
export function custoDeVidaDoSangue(estado, hunt) {
  const b = ligado(hunt, ACAO.sangue);
  if (!b) return 0;
  return (estado.hp ?? 0) > (estado.maxHp ?? 0) * ModsPoe.VIDA_BAIXA ? Number(b.a2?.custoVidaPct) || 0 : 0;
}

// ---------------------------------------------------------------- a Fenda Temporal

/**
 * (lote A2, dono 19/10: "Fenda Temporal: guardar os últimos 4 s. Usar quando a vida de 4 s atrás for 30 pontos percentuais maior que a atual;
 * volta a vida e a casa") As IMAGENS do passado (act_dex.lua:17756-17827): com o buff ligado, uma foto por tique — a Vida, a Mana, o Escudo de
 * Energia e a casa —, só dos últimos 4 s. A volta: `voltaDaFenda`.
 */
export const FENDA = Object.freeze({ janelaMs: 4000, diferencaPct: 30 });
export function fotografarFenda(estado, hunt, agora = hunt?.clock ?? 0) {
  if (!ligado(hunt, ACAO.fenda) || !hunt.pos) { if (hunt?.a2?.fenda) delete hunt.a2.fenda; return; }
  const l = ((hunt.a2 ??= {}).fenda ??= []).filter((f) => agora - f.t <= FENDA.janelaMs);
  if (!l.length || agora - l.at(-1).t >= 200) l.push({ t: agora, hp: estado.hp ?? 0, mana: estado.mana ?? 0, es: estado.es ?? 0, x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0 });
  hunt.a2.fenda = l;
}
/** A imagem mais antiga (a de ~4 s atrás) se a Vida dela passa da de agora em 30 pontos percentuais; senão null. */
export function voltaDaFenda(estado, hunt, agora = hunt?.clock ?? 0) {
  const l = hunt?.a2?.fenda;
  // (revisão do A2: morto não volta)
  if (!l?.length || !ligado(hunt, ACAO.fenda) || !((estado?.hp ?? 0) > 0)) return null;
  const velha = l[0];
  if (agora - velha.t < FENDA.janelaMs - 400) return null;
  const max = Math.max(1, estado.maxHp ?? 1);
  return (100 * velha.hp) / max - (100 * (estado.hp ?? 0)) / max >= FENDA.diferencaPct ? velha : null;
}

// ---------------------------------------------------------------- o Escudo Gélido

/**
 * (lote A2) O ESCUDO GÉLIDO (act_int.lua:8014-8109): o globo no chão onde você está, pela duração; ele drena o seu Escudo de Energia ("Você perde
 * 730 de Escudo de Energia por segundo" — por 1 s, a descrição: "drena seu escudo de energia por um segundo ou até que você fique sem") e ganha "1
 * Estágio a cada 0,3 s enquanto você estiver perdendo Escudo de Energia", até 4; cada estágio dá 910 de Vida máxima ao globo. O raio é o do dono
 * (exceção registrada, sem fonte no PoB: 1 casa = 2,2 m); o Resfriamento da área, a exceção (4) do dono. Só um por vez.
 */
export const ESCUDO_GELIDO = Object.freeze({ raio: 1, raioM: 2.2, drenaMs: 1000 });
export function porEscudoGelido(estado, hunt, a2, dur, agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return null;
  const g = { x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, desde: agora, ate: agora + dur, estagios: 0, vida: 0, drenaAte: agora + ESCUDO_GELIDO.drenaMs, ultimo: agora, a2: { ...a2 } };
  (hunt.a2 ??= {}).escudoGelido = g;
  // (os inimigos na área ficam Resfriados — a área fria do jogo, pela duração)
  // (o "Efeito de Afecções de Gelo aumentado em X%" da qualidade: o Resfriamento da área, × (1 + X%))
  ModsPoe.criarAreaFria(hunt, { x: g.x, y: g.y, raioM: ESCUDO_GELIDO.raioM, segundos: dur / 1000, agora, efeitoPct: ModsPoe.AREAS_FRIAS.efeitoPct * (1 + (Number(a2?.efeitoGeloPct) || 0) / 100) });
  return g;
}
export function escudoGelido(hunt, agora = hunt?.clock ?? 0) {
  const g = hunt?.a2?.escudoGelido;
  if (!g) return null;
  if (g.ate <= agora || (g.estagios > 0 && !(g.vida > 0) && agora >= g.drenaAte)) { delete hunt.a2.escudoGelido; return null; }
  return g;
}
export function tiqueDoEscudoGelido(estado, hunt, agora = hunt?.clock ?? 0) {
  const g = escudoGelido(hunt, agora);
  if (!g || agora <= g.ultimo) return;
  const a2 = g.a2 ?? {};
  const fim = Math.min(agora, g.drenaAte);
  if (fim > g.ultimo && (estado.es ?? 0) > 0) {
    const tira = Math.min(estado.es, ((Number(a2.esPorS) || 0) * (fim - g.ultimo)) / 1000);
    estado.es = Math.max(0, estado.es - tira);
    g.drenado = (g.drenado ?? 0) + (fim - g.ultimo);
    const max = Number(a2.estagiosMax) || 4;
    const n = Math.min(max, Math.floor(g.drenado / Math.max(50, Number(a2.estagioMs) || 300)));
    if (n > g.estagios) { g.vida += (n - g.estagios) * (Number(a2.vidaPorEstagio) || 0); g.estagios = n; }
  } else if ((estado.es ?? 0) <= 0) g.drenaAte = Math.min(g.drenaAte, agora);
  g.ultimo = agora;
}
/** (lote A2) Você está na área do Escudo Gélido (a até 1 casa dele)? */
export const naAreaDoEscudo = (hunt, p, agora = hunt?.clock ?? 0) => { const g = escudoGelido(hunt, agora); return !!g && !!p && mesmoAndar(hunt, g) && casas(g, p) <= ESCUDO_GELIDO.raio; };
/**
 * O acerto de um inimigo em você: com você na área, 20% (o inimigo na área) ou 60% (o de fora) do dano vai para a Vida do globo antes da sua Vida
 * e do seu Escudo de Energia. Devolve quanto o globo tomou.
 */
export function absorverNoEscudoGelido(hunt, dano, bicho, agora = hunt?.clock ?? 0) {
  const g = escudoGelido(hunt, agora);
  if (!g || !(dano > 0) || !(g.vida > 0) || !naAreaDoEscudo(hunt, hunt.pos, agora)) return 0;
  const dentro = !!bicho && mesmoAndar(hunt, bicho) && casas(g, bicho) <= ESCUDO_GELIDO.raio;
  const pct = Number(dentro ? g.a2?.dentroPct : g.a2?.foraPct) || 0;
  const tomou = Math.min(g.vida, Math.round((dano * pct) / 100));
  g.vida -= tomou;
  return tomou;
}

// ---------------------------------------------------------------- o Emblema do Poder

/**
 * (lote A2) O EMBLEMA DO PODER (act_int.lua:16091-16190): posto onde você está, pela duração; ganha 1 Estágio a cada 400 de Mana gasta com você na
 * área (no mínimo 1 s entre estágios), até 4; dá a você, na área, "7 a 141 de Dano de Raio Adicional por Estágio" (aos ataques e às magias), e os
 * inimigos na área causam 19% menos dano (+ a qualidade) no máximo de estágios. O raio: 3 m (o PoB: radius 30) = 2 casas (1,5 arredondado para
 * cima, como a área do jogo — a exceção (3) do dono). Só um por vez.
 */
export const EMBLEMA = Object.freeze({ raioM: 3, raio: 2 });
export function porEmblema(hunt, a2, dur, agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return null;
  const e = { x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, ate: agora + dur, estagios: 0, mana: 0, ultimoEstagio: -Infinity, a2: { ...a2 } };
  (hunt.a2 ??= {}).emblema = e;
  return e;
}
export function emblema(hunt, agora = hunt?.clock ?? 0) {
  const e = hunt?.a2?.emblema;
  if (!e) return null;
  if (e.ate <= agora) { delete hunt.a2.emblema; hunt.poeFichaMudou = true; return null; }
  return e;
}
export const naAreaDoEmblema = (hunt, p, agora = hunt?.clock ?? 0) => { const e = emblema(hunt, agora); return !!e && !!p && mesmoAndar(hunt, e) && casas(e, p) <= EMBLEMA.raio; };
/** A mana gasta (`acoes`, no custo pago): com você na área, conta para o próximo estágio. Devolve true se ganhou um (a ficha muda). */
export function aoGastarManaNoEmblema(hunt, mana, agora = hunt?.clock ?? 0) {
  const e = emblema(hunt, agora);
  if (!e || !(mana > 0) || !naAreaDoEmblema(hunt, hunt.pos, agora)) return false;
  const max = Number(e.a2?.estagiosMax) || 4;
  if (e.estagios >= max) return false;
  e.mana += mana;
  const por = Number(e.a2?.manaPorEstagio) || 400;
  if (e.mana < por || agora - e.ultimoEstagio < (Number(e.a2?.entreEstagiosMs) || 1000)) return false;
  e.mana -= por;
  e.estagios += 1;
  e.ultimoEstagio = agora;
  hunt.poeFichaMudou = true;
  return true;
}
/**
 * (lote G-B, dono 25/10 — D9: o PoB, SigilOfPower `buffAllies`) o Emblema de um COMPANHEIRO de party (`huntDoDono`) em você, na área dele: o Raio por estágio (aos
 * ataques e às magias). `pos`/`z`: onde você está. Null fora da área ou sem estágio.
 */
export function emblemaDoAliado(huntDoDono, pos, z = 0, agora = huntDoDono?.clock ?? 0) {
  const e = huntDoDono?.a2?.emblema;
  if (!e || !(e.ate > agora) || !(e.estagios > 0) || !pos || (e.z ?? 0) !== (z ?? 0) || casas(e, pos) > EMBLEMA.raio) return null;
  const [a, b] = e.a2?.raioPorEstagio ?? [0, 0];
  const t = {};
  for (const p of ['added', 'spell_added']) { t[`${p}_energy_dmg_min`] = a * e.estagios; t[`${p}_energy_dmg_max`] = b * e.estagios; }
  return t;
}
/** O "menos dano" do inimigo na área do Emblema no máximo de estágios (o %, ou 0) — `Reforcos.forcaDoBicho`. */
export function menosDanoDoEmblema(hunt, bicho, agora = hunt?.clock ?? 0) {
  const e = emblema(hunt, agora);
  if (!e || !bicho || e.estagios < (Number(e.a2?.estagiosMax) || 4) || !mesmoAndar(hunt, bicho) || casas(e, bicho) > EMBLEMA.raio) return 0;
  return Number(e.a2?.menosDanoPct) || 0;
}

// ---------------------------------------------------------------- a Parede de Força

/**
 * (lote A2, dono 19/10: "Parede de Força, simplificada: a parede é posta entre você e o alvo, com até 17 casas. O projétil que cruza ganha +1
 * ricochete com −20% de dano.") A parede (act_int.lua:20715-20784): um segmento de 6 m (3 casas) atravessado na linha entre você e o alvo, na casa do
 * meio (a até 17 casas de você), pela duração; cada uso de projétil que a cruza gasta 1 das 17 colisões (a exceção (2) do dono).
 */
export const PAREDE = Object.freeze({ distanciaMax: 17 });
export function porParede(hunt, alvo, a2, dur, agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return null;
  const de = hunt.pos;
  const para = alvo && mesmoAndar(hunt, alvo) ? alvo : { x: de.x + 2, y: de.y };
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const d = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
  const passo = Math.min(PAREDE.distanciaMax, Math.max(1, Math.round(d / 2)));
  const cx = de.x + Math.round((dx / d) * passo);
  const cy = de.y + Math.round((dy / d) * passo);
  // (atravessada: a perpendicular à direção — na diagonal, a outra diagonal)
  const px = -Math.sign(dy);
  const py = Math.sign(dx);
  const meia = Math.max(0, Math.floor(((Number(a2?.comprimentoM) || 6) / 2 - 1) / 2));
  const lista = [];
  for (let i = -Math.max(1, meia); i <= Math.max(1, meia); i++) lista.push({ x: cx + px * i, y: cy + py * i });
  const p = { casas: lista, z: hunt.z ?? 0, ate: agora + dur, colisoes: Number(a2?.colisoes) || 17, a2: { ...a2 } };
  (hunt.a2 ??= {}).parede = p;
  return p;
}
export function parede(hunt, agora = hunt?.clock ?? 0) {
  const p = hunt?.a2?.parede;
  if (!p) return null;
  if (p.ate <= agora || !(p.colisoes > 0)) { delete hunt.a2.parede; return null; }
  return p;
}
/** A linha de `de` a `para` (as casas de Bresenham, sem as pontas) passa por uma casa da parede? */
export function cruzaAParede(hunt, de, para, agora = hunt?.clock ?? 0) {
  const p = parede(hunt, agora);
  if (!p || !de || !para || (hunt.z ?? 0) !== p.z) return null;
  const set = new Set(p.casas.map((c) => `${c.x},${c.y}`));
  let x = de.x;
  let y = de.y;
  const dx = Math.abs(para.x - x);
  const dy = -Math.abs(para.y - y);
  const sx = x < para.x ? 1 : -1;
  const sy = y < para.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 64 && (x !== para.x || y !== para.y); i++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if ((x !== para.x || y !== para.y) && set.has(`${x},${y}`)) return p;
    // (a diagonal que passa entre duas casas da parede também cruza)
    if (set.has(`${x - sx},${y}`) && set.has(`${x},${y - sy}`)) return p;
  }
  return null;
}

// ---------------------------------------------------------------- o Cajado Impregnado de Mana

/**
 * (lote A2) A Onda Arcana do Cajado Impregnado: o raio do anel (exceção do dono, sem fonte no PoB: 2 casas) e o crítico base dela (6%, o poedb); (lote G-B, dono 25/10) a
 * Eficácia do Dano Adicionado (o PoB: damageEffectiveness 4,5 em todos os níveis — o "Eficácia do Dano Adicionado: 450%").
 */
export const ONDA_ARCANA = Object.freeze({ raio: 2, critBase: 6, eficacia: 4.5 });

// ---------------------------------------------------------------- a Sentinela Divina

/**
 * (lote A2, dono 19/10: "as auras templárias são sorteadas ao invocar, com o raio da aura de lacaio do jogo") As 6 AURAS TEMPLÁRIAS (a descrição do
 * poedb da Sentinela Divina): a sentinela invocada pela habilidade suportada nasce com uma, sorteada; ela vale em você enquanto você está no raio
 * dela.
 */
export const AURAS_TEMPLARIAS = Object.freeze([
  { nome: 'Fogo Templário', af: { phys_as_extra_fire: 15 } },
  { nome: 'Raio Templário', af: { phys_as_extra_energy: 15 } },
  // (revisão do A2: "1,5% da Vida regenerada por segundo" — o % da Vida máxima, `life_regen_max_pct`; o `life_regen_pct` é a velocidade aumentada)
  { nome: 'Regeneração Templária', af: { life_regen_max_pct: 1.5 } },
  { nome: 'Mana Templária', af: { mana_regen_pct: 30 } },
  { nome: 'Resistência Templária', af: { chaos_res: 23 } },
  { nome: 'Proteção Templária', af: { efeito_maldicao_proprio: -50 } },
]);
export const sortearAuraTemplaria = (rng = Math.random) => AURAS_TEMPLARIAS[Math.min(AURAS_TEMPLARIAS.length - 1, Math.floor(rng() * AURAS_TEMPLARIAS.length))];

// ---------------------------------------------------------------- o que vale na ficha

/**
 * (lote A2) O que as gemas do lote A2 dão a você agora (somado em `GemasPoe.adds`): o crítico do Escudo Gélido (na área, por estágio — o "+X% de
 * Chance de Golpe Crítico Mágico": pontos na base das magias), o Raio do Emblema do Poder (na área, por estágio) e as auras templárias das
 * sentinelas (no raio delas).
 */
export function adds(estado) {
  const hunt = estado?.hunt;
  if (!hunt) return null;
  const agora = hunt.clock ?? 0;
  const t = {};
  const g = hunt.a2?.escudoGelido ? escudoGelido(hunt, agora) : null;
  if (g && g.estagios > 0 && naAreaDoEscudo(hunt, hunt.pos, agora)) t['crit_chance@magia'] = (Number(g.a2?.critPorEstagio) || 0) * g.estagios;
  const e = hunt.a2?.emblema ? emblema(hunt, agora) : null;
  if (e && e.estagios > 0 && naAreaDoEmblema(hunt, hunt.pos, agora)) {
    const [a, b] = e.a2?.raioPorEstagio ?? [0, 0];
    for (const p of ['added', 'spell_added']) { t[`${p}_energy_dmg_min`] = a * e.estagios; t[`${p}_energy_dmg_max`] = b * e.estagios; }
  }
  for (const l of hunt.lacaios ?? []) {
    if (!(l.hp > 0) || !l.auraTemplaria || !hunt.pos || !mesmoAndar(hunt, l) || casas(l, hunt.pos) > (l.auraTemplaria.raio ?? 0)) continue;
    // (as sentinelas não somam a mesma aura: o maior de cada atributo, como os totens)
    for (const [k, v] of Object.entries(l.auraTemplaria.af)) t[k] = v < 0 ? Math.min(t[k] ?? 0, v) : Math.max(t[k] ?? 0, v);
  }
  return Object.keys(t).length ? t : null;
}
