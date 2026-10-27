// Os MODS CONDICIONAIS do PoE (sistema de itens do PoE — só com ITENS_POE=1; dono, 07/10: "vários efeitos das armas não estão
// funcionando… n é só arma mas tbm equipamentos… colocando igual no PoE").
//
// Um mod do PoE muitas vezes vale só numa situação: "Dano Corpo a Corpo aumentado", "Velocidade de Ataque segurando um Escudo",
// "Chance de Crítico com Habilidades de Fogo", "Velocidade de Movimento se você Matou Recentemente", "Espaço esquerdo de anel: …".
// A tradução (`gamedata/itens-poe/traducao.json`) grava esses mods como `atributo@cond1+cond2` (ex.: `dmg_inc@corpo`,
// `atk_speed@comEscudo`, `crit_chance_inc@fogo`). Há dois tipos de condição:
//   - de ESTADO (o que o personagem empunha, o que aconteceu há pouco, o anel em que a peça está): resolvidas na SOMA dos atributos
//     (`resolver`, chamado no fim de `Afixos.soma`) — valendo, o número entra no atributo de sempre (`atk_speed`, `block`…);
//   - do GOLPE (as tags da habilidade: ataque, magia, corpo a corpo, projétil, área, fogo…; e o alvo com Vida Baixa): resolvidas em cada
//     acerto (`fichaDoGolpe`), que devolve a ficha daquele golpe com o "aumentado", o crítico, a penetração e as afecções dele.
import { ligado } from './catalogo.mjs';
import { maximo as maximoDeCargas } from './cargas.mjs';
import { maldicoesNoJogador as maldicoesDoMapa } from './mapas.mjs';
import * as Limites from '../combate/limites.mjs';
import * as Formulas from '../combate/formulas.mjs';
import { simples } from '../combate/modificadores.mjs';
import * as BuffsDeMob from '../mobs/buffs.mjs';
import { quemRecebeAMaldicao } from './vinculos.mjs';
import * as Aliados from './aliados.mjs';
import { raioQueCresce } from './gemas-b1.mjs';
// (lotes G-A e G-C, dono 25/10: a Precisão a menos do Enfraquecer, o Impelir restrito)
import * as GemasGAC from './gemas-gac.mjs';
import { renovarLento } from './gemas-gbd.mjs';
// (lote E2B, 26/10: o dano sofrido do debuff da Armadilha de Urso nos acertos de Armadilha e Mina)
import { danoDoUrso } from './gemas-e2b.mjs';
// (lote D1, 27/10: o Carne e Pedra — o dano sofrido nas duas Posturas)
import { fatorDaAreia, fatorDoSangue } from './gemas-d1.mjs';
// (lote S2B, 27/10: o Passe Enfeitiçado — "Inimigos afetados por feitiços … não podem causar golpes críticos")
import { semCriticoPeloFeitico } from './suportes-s2b.mjs';

/** "Recentemente" no PoE: nos últimos 4 segundos. */
export const RECENTE_MS = 4000;
/** "Vida Baixa" no PoE: 50% da vida máxima ou menos. */
export const VIDA_BAIXA = 0.5;
/** A janela em que o personagem conta como "movendo-se" depois do último passo. */
const MOVENDO_MS = 600;
/**
 * (ciclo 7, lote G) O SOLO SAGRADO que o personagem cria (`hunt.solosSagrados = [{ x, y, raio, ate }]`): sobre ele, 6% da Vida regenerada por
 * segundo (o poedb: "consecrate … % life regen per minute [360]") e as Maldições com 50% menos efeito. "Efeitos do Solo Sagrado … Perduram
 * por N segundos" (`solo_sagrado_perdura_s`): vale até N s depois de sair.
 */
export const SOLO_SAGRADO = { regenPct: 6, raio: 1, maximo: 5 };
/** (lote G20c: o Solo Sagrado de um TOTEM — `dono` — só vale enquanto ele vive) */
const soloValendo = (h, s, agora) => s.ate > agora && (!s.dono || (h.lacaios ?? []).some((l) => l.uid === s.dono && l.hp > 0));
export function noSoloSagrado(h, agora = h?.clock ?? 0) {
  const p = h?.pos;
  const sobre = !!p && (h.solosSagrados ?? []).some((s) => soloValendo(h, s, agora) && Math.max(Math.abs(s.x - p.x), Math.abs(s.y - p.y)) <= s.raio);
  return sobre || (h?.poeSoloAte ?? 0) > agora;
}
/** (lote G20c) Sobre o Solo Sagrado do Totem Flamejante Sagrado: "concede Imunidade a Maldições para você e Aliados". */
export function soloImuneAMaldicoes(h, agora = h?.clock ?? 0) {
  const p = h?.pos;
  return !!p && (h.solosSagrados ?? []).some((s) => s.imuneMaldicao && soloValendo(h, s, agora) && Math.max(Math.abs(s.x - p.x), Math.abs(s.y - p.y)) <= s.raio);
}
// (lote B2, dono 20/10: + `onde` — o lugar e o raio em casas do Solo Sagrado que a gema cria longe de você: a Chama Purificadora, no local mirado)
// (revisão B2, 21/10: o teto de 5 é POR FONTE, como no PoE — cada habilidade tem o limite dela: `onde.fonte` — a gema que o cria (a Chama Purificadora); sem ela, o
// Solo Sagrado "seu" (o deslocamento, o no acerto). O do TOTEM (`dono`) não entra em teto nenhum: dura enquanto o totem vive; o de totem morto sai da lista.)
export function criarSoloSagrado(h, segundos, agora = h?.clock ?? 0, onde = null) {
  if (!h?.pos || !(segundos > 0)) return;
  const fonte = onde?.fonte ?? null;
  const vivos = (h.solosSagrados ??= []).filter((s) => soloValendo(h, s, agora));
  const daFonte = vivos.filter((s) => !s.dono && (s.fonte ?? null) === fonte);
  daFonte.push({ x: onde?.x ?? h.pos.x, y: onde?.y ?? h.pos.y, raio: onde?.raio ?? SOLO_SAGRADO.raio, ate: agora + segundos * 1000, ...(fonte != null ? { fonte } : {}) });
  const fica = new Set(daFonte.slice(-SOLO_SAGRADO.maximo));
  h.solosSagrados = [...vivos.filter((s) => s.dono || (s.fonte ?? null) !== fonte), ...daFonte.filter((s) => fica.has(s))];
}
/**
 * (lote 57, a Doutrina Racional — dono, 16/10: "Implementar como o Sagrado") O SOLO PROFANO que o personagem cria (`hunt.solosProfanos = [{ x,
 * y, raio, ate }]`, como o Sagrado): o lembrete da única — "Acertos contra inimigos em Solo Profano têm chance de golpe crítico aumentada em
 * 100% e maldições têm efeito aumentado em 10% sobre eles". No chão por 8 s (a fonte não diz: a duração do Sagrado criado no acerto); o inimigo
 * sobre ele fica marcado (`estados.soloProfano`) e, com "Efeitos do Solo Profano criados por você Perduram por N segundos", por mais N s.
 */
export const SOLO_PROFANO = Object.freeze({ raio: 1, maximo: 5, duracaoS: 8, critIncPct: 100, efeitoMaldicaoPct: 10 });
export function criarSoloProfano(h, segundos = SOLO_PROFANO.duracaoS, agora = h?.clock ?? 0) {
  if (!h?.pos || !(segundos > 0)) return;
  const lista = (h.solosProfanos ??= []).filter((s) => s.ate > agora);
  lista.push({ x: h.pos.x, y: h.pos.y, raio: SOLO_PROFANO.raio, ate: agora + segundos * 1000 });
  h.solosProfanos = lista.slice(-SOLO_PROFANO.maximo);
}
/** O inimigo `m` está sob o Solo Profano (sobre ele, ou no "perdura")? */
export const noSoloProfano = (m, agora) => (m?.estados?.soloProfano?.ate ?? 0) > agora;
/**
 * (lote 41, P032 — dono, 16/10: "Fazer todos") As ÁREAS FRIAS do PoE (as "Chilling Areas": o Solo Gelado, as áreas da Geada Rastejante e do
 * Golpe Frio, o Vórtice — o poedb, Algor Mortis): as gemas que as criam deixam no chão uma área — o raio em metros da gema (1 casa = 2 m), pela
 * duração dela —, e quem está dentro fica Resfriado ("Unless otherwise specified chilled ground slows for 10%" — `cacadas.resfriarNasAreasFrias`,
 * no tique). É o que a Geada Cortante lê ("Inimigos nas suas áreas frias sofrem dano de frio aumentado pelo esfriamento" — o Resfriamento).
 */
export const AREAS_FRIAS = Object.freeze({
  efeitoPct: 10,
  maximo: 12,
  porGema: Object.freeze({
    Frostblink: { raioM: 2 }, Creeping_Frost: { raioM: 2, noAlvo: true }, Cold_Snap: { raioM: 3 }, Vaal_Cold_Snap: { raioM: 3.6 }, Vortex: { raioM: 2.3 },
    Frost_Blades_of_Katabasis: { raioM: 2, noAlvo: true },
    // (lote A3b, dono 19/10: D6: a Geada Rastejante das Banquisas também deixa a área fria — ela anda com o chão, `Acoes.tiqueDosObjetos`)
    Creeping_Frost_of_Floes: { raioM: 2, noAlvo: true },
  }),
});
// (lote A2: + `efeitoPct` — a área com o Resfriamento próprio: o Escudo Gélido, com o "Efeito de Afecções de Gelo aumentado" da qualidade dele)
// (lote A3b, dono 19/10: + `obj` — o id do objeto do chão a que a área fria pertence: a da Geada Rastejante anda com ele, `Acoes.tiqueDosObjetos`)
// (lote A5, dono 20/10 — D5: + `fragilGelo` — a área da habilidade suportada pelo Resfriamento Ósseo: quem está nela sofre o Gelo aumentado pelo Resfriamento)
// (lote B1, dono 20/10 — D-B1.6/D-B1.7: + `cresce` — o chão dos Estalos Gélidos, `{ deM, ateM, fator, sorte }`: o raio vai de `deM` a `ateM` pela duração,
// `atualizarAreasFrias`; + `aoMorrer` — `{ tipo, chance }`, a carga quando um inimigo morre nela, `cargasAoMorrerNaAreaFria`; + `porSegundo` — o tipo da carga a
// cada segundo com um inimigo nela, `cargasPorSegundoDasAreasFrias`)
export function criarAreaFria(h, { x, y, raioM, segundos, agora = h?.clock ?? 0, efeitoPct = null, obj = null, fragilGelo = false, cresce = null, aoMorrer = null, porSegundo = null }) {
  if (!h || !(segundos > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  // (revisão do B1: a do Frenesi por segundo que acaba agora fica até pagar o último — `cargasPorSegundoDasAreasFrias`)
  const lista = (h.areasFrias ??= []).filter((a) => a.ate > agora || (a.porSegundo && a.proximaCarga <= a.ate));
  const durMs = Math.round(segundos * 1000);
  const doCrescer = cresce ? { ...cresce, inicio: agora, durMs } : null;
  lista.push({ x, y, raio: doCrescer ? raioQueCresce(doCrescer, agora) : Math.max(0, Math.round((Number(raioM) || 0) / 2)), ate: agora + durMs, ...(efeitoPct > 0 ? { efeitoPct } : {}), ...(obj ? { obj } : {}), ...(fragilGelo ? { fragilGelo: true } : {}),
    ...(doCrescer ? { cresce: doCrescer } : {}), ...(aoMorrer ? { aoMorrer } : {}), ...(porSegundo ? { porSegundo, proximaCarga: agora + 1000 } : {}) });
  h.areasFrias = lista.slice(-AREAS_FRIAS.maximo);
}
/** (lote B1, D-B1.7) O raio das áreas frias que crescem, no instante `agora` (o tique — `cacadas.resfriarNasAreasFrias`). */
export function atualizarAreasFrias(h, agora = h?.clock ?? 0) {
  for (const a of h?.areasFrias ?? []) if (a.cresce) a.raio = raioQueCresce(a.cresce, agora);
}
const naArea = (a, b) => Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) <= a.raio && (b.z == null || a.z == null || b.z === a.z);
/** (lote B1, D-B1.6) As cargas que a morte de `morto` dá (o Estalo Gélido: 25% de Frenesi; o Vaal: o Poder) — as áreas frias com `aoMorrer` em que ele estava. */
export function cargasAoMorrerNaAreaFria(h, morto, agora = h?.clock ?? 0, rng = Math.random) {
  const ganhos = [];
  if (!morto) return ganhos;
  for (const a of h?.areasFrias ?? []) if (a.aoMorrer && a.ate > agora && naArea(a, morto) && rng() * 100 < a.aoMorrer.chance) ganhos.push(a.aoMorrer.tipo);
  return ganhos;
}
/** (lote B1, D-B1.6) "A cada Segundo, receba uma Carga de Frenesi se um Inimigo estiver na Área" (o Estalo Gélido Vaal): os tipos que este tique dá. */
export function cargasPorSegundoDasAreasFrias(h, agora = h?.clock ?? 0) {
  const ganhos = [];
  for (const a of h?.areasFrias ?? []) {
    // (revisão do B1: a área que acabou neste tique ainda paga o segundo do fim — o laço vai até `ate`)
    if (!a.porSegundo) continue;
    while (a.proximaCarga <= Math.min(agora, a.ate)) {
      if ((h.monstros ?? []).some((m) => m.hp > 0 && !m.dummy && naArea(a, m))) ganhos.push(a.porSegundo);
      a.proximaCarga += 1000;
    }
  }
  return ganhos;
}
/** (lote A5, D5) O bicho está numa área fria do Resfriamento Ósseo agora? */
export const naAreaFriaFragil = (h, b, agora = h?.clock ?? 0) => !!b && (h?.areasFrias ?? []).some((a) => a.fragilGelo && a.ate > agora && Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) <= a.raio);
/** O bicho está numa das suas áreas frias agora? */
export const naAreaFria = (h, b, agora = h?.clock ?? 0) => !!b && (h?.areasFrias ?? []).some((a) => a.ate > agora && Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) <= a.raio);
/** (lote A2) O Resfriamento da área fria em que o bicho está (o maior delas): o de sempre, ou o próprio da área. */
export const efeitoDaAreaFria = (h, b, agora = h?.clock ?? 0) => Math.max(0, ...(h?.areasFrias ?? []).filter((a) => a.ate > agora && !!b && Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) <= a.raio).map((a) => a.efeitoPct ?? AREAS_FRIAS.efeitoPct));
/**
 * (lote G) A POSTURA. (lote C3, dono 25/10 — D3.1: o Sangue e Areia como o PoE — o PoB, BloodAndSand: o buff ligado está na Postura de SANGUE ou na de AREIA, a que
 * ele guarda em `postura` — ligar começa na de Sangue; usar de novo alterna, `GemasC3.trocarPostura`. Antes, o buff ligado era sempre a de Areia, e os bônus de Sangue
 * nunca valiam.) Sem o buff, a de Sangue (o lembrete: "Você está automaticamente em Postura de Sangue").
 */
// (lote D1, 27/10: + o Carne e Pedra — a outra gema de Postura do PoE; as duas ficam na mesma Postura, `acoes.trocarPosturaNoUso`)
const buffDaPostura = (h, agora) => Object.entries(h?.buffs ?? {}).find(([id, b]) => b && b.ate > agora && /Blood_and_Sand|Flesh_and_Stone/.test(id))?.[1] ?? null;
export const posturaDe = (h, agora = h?.clock ?? 0) => (buffDaPostura(h, agora)?.postura === 'areia' ? 'areia' : 'sangue');
/**
 * (lote C3, dono 25/10) Você está numa Tempestade de Lâminas SANGRENTA sua (`hunt.poeObjetos` — `GemasC3`, a Tempestade de Lâminas): "12% mais Velocidade de Ataque
 * enquanto estiver em uma Tempestade de Lâminas Sangrentas" (o PoB: Condition BladestormInBloodstorm).
 */
export const emTempestadeSangrenta = (h, agora = h?.clock ?? 0) => !!h?.pos && (h.poeObjetos ?? []).some((o) => o.tipo === 'tempestadeDeLaminas' && o.postura === 'sangue' && o.dono === 'voce' && o.ate > agora && (o.z ?? 0) === (h.z ?? 0) && Math.max(Math.abs(o.x - h.pos.x), Math.abs(o.y - h.pos.y)) <= (o.raio ?? 0));
/**
 * (11/10) O ESTANDARTE PLANTADO (Estandarte de Guerra, Horrendo, da Desafiança — o buff da gema `*_Banner`, com `estandarte: { x, y, z, valor,
 * efeitoMais }`): o PoE atual — usar a gema consome todo o Valor e planta o estandarte, com a aura dele (`mods-poe.plantarEstandarte`).
 */
export const estandartePlantado = (h, agora = h?.clock ?? 0) => Object.entries(h?.buffs ?? {}).find(([id, b]) => b && b.ate > agora && /_Banner/.test(id))?.[1] ?? null;
export const estandarteAtivo = (h, agora = h?.clock ?? 0) => !!estandartePlantado(h, agora);
/** (lote 32) Algum Buff de Clamor do PoE em você agora (`hunt.buffs`, tipo `poe-clamor`)? */
export const sobBuffDeClamor = (h, agora = h?.clock ?? 0) => Object.values(h?.buffs ?? {}).some((b) => b && b.tipo === 'poe-clamor' && b.ate > agora);
/** (lote 31) O inimigo está na área do seu Estandarte plantado (o raio do buff — o mesmo da aura, `mods-poe.aurasProximas`)? */
export function pertoDoEstandarte(h, alvo, agora = h?.clock ?? 0) {
  const p = estandartePlantado(h, agora);
  if (!p?.estandarte || !alvo) return false;
  return Math.max(Math.abs(alvo.x - p.estandarte.x), Math.abs(alvo.y - p.estandarte.y)) <= (p.raio ?? 1);
}
/**
 * (15/10, lote 31 — P043) O Mestre do Metal: "Você e Aliados próximos causam de X a Y de Dano Físico adicional para cada Empalar no Inimigo" —
 * `[min, max]` × os Empalamentos ativos NESTE alvo agora (os do acerto que ainda vai empalar não contam), ou null. O golpe soma como dano
 * adicionado Físico: a eficácia, o "aumentado" do Físico, os "mais", o crítico e a defesa do alvo (`hunt/combate.round`, `acoes.mjs`).
 */
export function fisicoPorEmpalamento(ficha, alvo, agora) {
  const max = Number(ficha?.afPoe?.empalar_fisico_add_max) || 0;
  if (!ligado() || !(max > 0) || !Array.isArray(alvo?.estados?.empalado)) return null;
  const n = alvo.estados.empalado.filter((x) => x.ate > agora && x.acertos > 0).length;
  if (!n) return null;
  const min = Math.min(Number(ficha.afPoe.empalar_fisico_add_min) || 0, max);
  return [n * min, n * max];
}
/**
 * (lote 32, P038 — as Forças Profanadas: "Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você") AO AMALDIÇOAR o
 * inimigo, o Resfriamento e a Eletrização que ele tem voltam à duração cheia deles (`dur`, gravada quando foram postos; sem ela, 2 s).
 */
export function renovarFrioEChoque(bicho, agora) {
  const e = bicho?.estados;
  if (!e) return;
  // (revisão G: o lento com as instâncias de cada fonte — cada uma volta à duração cheia dela, `GemasGBD.renovarLento`)
  renovarLento(e, agora);
  if (e.chocado?.ate > agora) e.chocado.ate = Math.max(e.chocado.ate, agora + (e.chocado.dur ?? 2000));
  for (const x of e.chocadosPilha ?? []) if (x.ate > agora) x.ate = Math.max(x.ate, agora + (x.dur ?? 2000));
}
/**
 * (15/10, lote 31 — P037) A PROVOCAÇÃO: a do Clamor (`Reforcos.provocar` grava `provocadoAte`) e a do acerto, do frasco, do totem, do lacaio e do
 * mercenário (`estados.provocado`; a do totem, do lacaio e do mercenário com `deLacaio` — não é "por você").
 */
export const provocadoPeloClamor = (alvo, agora) => (alvo?.provocadoAte ?? 0) > agora;
export const provocadoPorVoce = (alvo, agora) => provocadoPeloClamor(alvo, agora) || (ativo(alvo?.estados?.provocado, agora) && !alvo.estados.provocado.deLacaio);
/**
 * (lote G) O VALOR dos Estandartes (o lembrete: "você ganha 1 de Valor ao matar corpo a corpo ou ao acertar ataques corpo a corpo contra inimigos
 * raros ou únicos, não mais do que uma vez a cada 0.5 segundos, até um máximo de 50"). (11/10, o PoE atual: "O Valor é ganho enquanto você tem uma
 * habilidade de Estandarte" — na barra, `hunt.poeTemEstandarte` — "Enquanto você não tiver nenhum Estandarte plantado, você pode ganhar Valor";
 * plantar o consome inteiro.)
 */
export const VALOR = { maximo: 50, intervaloMs: 500 };
export const valorAtual = (h) => Math.max(0, h?.valor?.n ?? 0);
export const valorMaximo = (total) => VALOR.maximo + (Number(total?.max_valor) || 0);
export function ganharValor(h, n, total, agora = h?.clock ?? 0, { semIntervalo = false } = {}) {
  if (!h || !ligado() || !(n > 0) || !h.poeTemEstandarte) return;
  // ("Ter um Estandarte plantado não impede que você ganhe Valor")
  if (estandarteAtivo(h, agora) && !(Number(total?.valor_com_estandarte_plantado) > 0)) return;
  const v = (h.valor ??= { n: 0, ultimo: -Infinity });
  if (!semIntervalo && agora - v.ultimo < VALOR.intervaloMs) return;
  v.ultimo = agora;
  v.n = Math.min(valorMaximo(total), v.n + n * Math.max(0, 1 + (Number(total?.valor_recebido_inc) || 0) / 100));
}
/** (lote E) Os cadáveres da caçada (`hunt.cadaveres`, os últimos mortos) a até 4 casas do personagem. */
const cadaveresPerto = (h) => (h?.pos ? (h.cadaveres ?? []).filter((c) => Math.max(Math.abs(c.x - h.pos.x), Math.abs(c.y - h.pos.y)) <= 4).length : 0);
/** (lote D) A janela em que o personagem conta como "Conjurando" depois de usar uma Magia (o tempo de uma conjuração do PoE). */
const CONJURANDO_MS = 1500;

/**
 * (ciclo 7, lote D) A FORTIFICAÇÃO do PoE (o lembrete da árvore: "Sofre 1% menos Dano de Acertos por Fortificação. Máximo de 20 Fortificações.
 * Fortificação dura 6 segundos"). Fica na caçada (`hunt.fortificacao = { n, ate }`); cada Acerto Fortificante renova a duração de todas.
 * "Fortificações concedem uma quantidade de Fortificação baseado no Dano do Acerto" — o PoE não publica a conta: aqui, 1 Fortificação por 1%
 * da vida máxima do alvo que o acerto tirou (mínimo 1).
 */
export const FORTIFICACAO = { maximo: 20, duracaoMs: 6000 };
export const maxFortificacao = (total) => Math.max(0, FORTIFICACAO.maximo + (Number(total?.max_fortificacao) || 0));
/**
 * As Fortificações do personagem agora ("Você atingiu sua fortificação máxima": sempre o máximo). `total`: a soma; sem ela, o teto e o
 * "sempre no máximo" que a última ficha guardou na caçada (`adds` — não refaz a ficha aqui: este cálculo roda DENTRO dela).
 */
export function fortificacao(estado, total = null) {
  const h = estado?.hunt;
  const max = total ? maxFortificacao(total) : h?.fortificacaoTeto?.max ?? FORTIFICACAO.maximo;
  if (total ? Number(total.fortificacao_sempre_max) > 0 : h?.fortificacaoTeto?.sempre) return max;
  const f = h?.fortificacao;
  const propria = f && f.ate > (h.clock ?? 0) ? Math.min(f.n, max) : 0;
  // (13/10) "Aliados Próximos contam como tendo Fortificação igual a sua" (o Campeão de um companheiro perto — `aliados.mjs`)
  return Math.max(propria, Aliados.fortificacaoDosAliados(estado));
}
/** Ganha `n` Fortificações (até o máximo) e renova a duração ("Duração da Fortificação aumentada"). */
// (lote A5, dono 20/10: `doUso` — o que o USO dá à Fortificação, da ficha do golpe: o "Duração da Fortificação aumentada" da qualidade do suporte Fortificar
// — `incPct`, somado ao da soma — e a duração base da Golpe Vigilante — `baseS`, "Acertos Corpo a Corpo Fortificam por 8 segundos", no lugar dos 6 s)
export function ganharFortificacao(hunt, n, total, agora = hunt?.clock ?? 0, doUso = null) {
  if (!hunt || !ligado() || !(n > 0)) return 0;
  const max = maxFortificacao(total);
  const f = hunt.fortificacao && hunt.fortificacao.ate > agora ? hunt.fortificacao : { n: 0, ate: 0 };
  const base = Number(doUso?.baseS) > 0 ? Number(doUso.baseS) * 1000 : FORTIFICACAO.duracaoMs;
  const inc = doUso?.incPct != null ? Number(doUso.incPct) || 0 : Number(total?.fortificacao_duracao_inc) || 0;
  const dur = Math.round(base * Math.max(0.1, 1 + inc / 100));
  // (revisão do A5: um acerto com duração menor não encurta a Fortificação que já corre — fica o maior fim)
  hunt.fortificacao = { n: Math.min(max, f.n + Math.max(1, Math.round(n))), ate: Math.max(f.ate ?? 0, agora + dur) };
  return hunt.fortificacao.n;
}

/**
 * Separa `stat%escala@a+b` em `{ stat, escala, conds: ['a','b'], teto }`. A ESCALA é o "por X" do PoE (`life%nivel` = "+N de Vida por Nível",
 * `atk_speed%atr:dex:10` = "a cada 10 de Destreza", `dmg_inc%carga:frenesi` = "por Carga de Frenesi") — `escalar`. O TETO é o "até um
 * máximo de N" do fim da frase (`move_speed%evasao:500~20` = "+1% a cada 500 de Evasão, até 20%"): o total escalado não passa dele.
 */
export function partir(chave) {
  const k = String(chave);
  const i = k.indexOf('@');
  const esq = i < 0 ? k : k.slice(0, i);
  const conds = i < 0 ? [] : k.slice(i + 1).split('+').filter(Boolean);
  const j = esq.indexOf('%');
  let escala = j < 0 ? null : esq.slice(j + 1);
  let teto = null;
  const t = escala?.indexOf('~') ?? -1;
  if (t >= 0) {
    teto = Number(escala.slice(t + 1));
    escala = escala.slice(0, t);
    if (!Number.isFinite(teto)) teto = null;
  }
  return { stat: j < 0 ? esq : esq.slice(0, j), escala, conds, teto };
}
/** O valor escalado (`v × m`) com o teto da chave (`partir`): o teto limita o tamanho, para o lado do sinal de `v`. */
export const comTeto = (v, m, teto) => (teto == null ? v * m : Math.sign(v) * Math.min(Math.abs(v * m), Math.abs(teto)));
export const ehCondicional = (chave) => String(chave).includes('@') || String(chave).includes('%');

// ---------------------------------------------------------------- as condições

/** As classes de arma do PoE → a condição "com <arma>". */
const COND_DA_CLASSE = {
  Bows: 'comArco', Wands: 'comVarinha', Daggers: 'comAdaga', Rune_Daggers: 'comAdaga', Claws: 'comGarra',
  One_Hand_Swords: 'comEspada', Thrusting_One_Hand_Swords: 'comEspada', Two_Hand_Swords: 'comEspada',
  One_Hand_Axes: 'comMachado', Two_Hand_Axes: 'comMachado', One_Hand_Maces: 'comMaca', Two_Hand_Maces: 'comMaca', Sceptres: 'comCetro',
  Staves: 'comCajado', Warstaves: 'comCajado',
};
const DUAS_MAOS = new Set(['Bows', 'Two_Hand_Swords', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Staves', 'Warstaves']);
const A_DISTANCIA = new Set(['Bows', 'Wands']);
/** As condições de ESTADO conhecidas (as outras são tags do golpe). (ciclo 7: `elusivo` vale com o buff Elusivo; `soloSagrado`, sobre o Solo Sagrado.) */
export const CONDICOES_DE_ESTADO = new Set([
  ...new Set(Object.values(COND_DA_CLASSE)), 'umaMao', 'duasMaos', 'armaCorpo', 'comEscudo', 'duasArmas',
  'matouRecente', 'naoMatouRecente', 'criticoRecente', 'naoCriticoRecente', 'acertadoRecente', 'semDanoRecente', 'movendo', 'vidaBaixa',
  'lacaioMorreuRecente', 'usouLacaioRecente', 'elusivo', 'soloSagrado', 'vidaCheia', 'furiaCheia', 'drenoRemovidoCheio',
  // (07/10, os únicos:) mana, escudo, afecções em você, frasco, roubo, parado, mão secundária, e os "recentemente" dos acontecimentos.
  'manaBaixa', 'naoManaBaixa', 'escudoCheio', 'semEscudo', 'ardendo', 'naoArdendo', 'congeladoProprio', 'eletrizadoProprio', 'resfriadoProprio',
  'sangrandoProprio', 'envenenadoProprio', 'amaldicoadoProprio', 'semAfeccaoElemental', 'duranteFrasco', 'semFrasco', 'drenando', 'drenandoVida', 'parado',
  'maoSecundariaVazia', 'desarmado', 'naoSobrecarregado', 'naoVidaBaixa', 'naoAcertadoRecente', 'bloqueouRecente', 'naoBloqueouRecente', 'atordoouRecente',
  'congelouRecente', 'incendiouRecente', 'eletrizouRecente', 'usouMovimentoRecente', 'usouVaalRecente', 'clamouRecente', 'acertouRecente',
  'ganhouPoderRecente', 'naoGanhouPoderRecente', 'naoGanhouFrenesiRecente', 'naoPerdeuPoderRecente', 'consumiuCadaverRecente', 'naoConsumiuCadaverRecente',
  'gastouManaRecente', 'usouHabilidadeRecente', 'mudouPosturaRecente', 'recargaEsIniciouRecente', 'naoCritRecente', 'naoCriticouRecente',
  'naoMatouRecente2', 'usouRubiRecente', 'usouSafiraRecente', 'usouTopazioRecente', 'usouAmetistaRecente', 'naoConjurouAvancoRecente', 'conjurouAvancoRecente',
  'detonouMinaRecente', 'naoDetonouMinaRecente', 'usouFogoRecente', 'acertouUnicoRecente',
  // (12/10, as Tinturas:) com uma Tintura ativa; usou um Frasco de Vida recentemente.
  'tinturaAtiva', 'usouFrascoVidaRecente',
  // (13/10, os parciais exatos:) a Garra na mão secundária (a Maestria de Garras); o efeito de um Frasco de Mana correndo (Extração de Essência).
  'garraNaSecundaria', 'duranteFrascoMana',
  // (11/10) nenhum inimigo com a sua Marca ("quando você Acertar um Inimigo Raro ou Único e não tiver Marca").
  'semMarca',
  // (09/10, os implícitos eldritch:) a PRESENÇA — um inimigo Único (ou chefe) perto, o Chefe Final do Atlas (um pináculo) perto, e um Raro
  // ou Único próximo.
  'unicoNaPresenca', 'chefeFinalNaPresenca', 'raroOuUnicoPerto',
  // (09/10, a árvore:) sem modificador de Vida no Peitoral; Elmo, Peitoral, Luvas e Botas todos com Evasão / com Armadura na base;
  // reservando Vida E Mana.
  'peitoralSemVida', 'armadurasComEvasao', 'armadurasComArmadura', 'reservouVidaEMana',
  // (09/10, lote 5:) o Elmo com mais Armadura que Evasão (e o contrário); Elmo, Luvas e Botas com Armadura E Escudo de Energia; o Amuleto
  // com um modificador explícito de Evasão.
  'elmoArmaduraMaior', 'elmoEvasaoMaior', 'outrasComArmaduraEEscudo', 'amuletoComEvasao', 'armasDiferentes',
  // (lote 6:) com algum Escudo de Energia; os dois anéis com um modificador explícito de Evasão.
  'comEscudoDeEnergia', 'aneisComEvasao',
  // (ciclo 7, lote D:) atordoado recentemente (e enquanto conjurava), acertado por um ATAQUE recentemente (e o contrário), conjurando agora,
  // Fortificado, estilhaçou um inimigo / infligiu Exposição / Empalou recentemente.
  'atordoadoRecente', 'atordoadoConjurandoRecente', 'acertadoAtaqueRecente', 'naoAcertadoAtaqueRecente', 'conjurando', 'fortificado',
  'estilhacouRecente', 'exposicaoRecente', 'empalouRecente',
  // (lote 71) matou um inimigo Amaldiçoado recentemente (`mods-poe.evento` — o `matar` com maldição no alvo).
  'matouAmaldicoadoRecente',
  // (lote 72) gastou Vida no Custo recentemente (`acoes` — o custo pago em Vida); acertou com a arma da mão principal / secundária
  // recentemente (`mods-poe.aoAcertar` — a mão da ficha do golpe).
  'gastouVidaRecente', 'acertouMaoPrincipalRecente', 'acertouMaoSecundariaRecente',
  // (lote 73) sofreu um Acerto Selvagem recentemente (o acerto de ao menos 15% da Vida máxima — `RETALIACAO.selvagemPct`).
  'sofreuAcertoSelvagemRecente',
  // (lote E) canalizando agora (usou uma habilidade de Canalização há pouco).
  'canalizando',
  // (14/10) a Égide Física esgotada (ou não) — `hunt.egides`
  'egideFisicaEsgotada', 'egideFisicaAtiva',
  // (lote E) com ao menos um cadáver perto (a até 4 casas — `hunt.cadaveres`).
  'cadaverPerto',
  // (lote F) no máximo um Raro ou Único por perto; ao menos dois Raros ou Únicos por perto (a Presença).
  'maxUmRaroPerto', 'doisRarosPerto',
  // (lote G) a Postura (Sangue / Areia — a gema Sangue e Areia), com um Estandarte (a aura de Estandarte ligada).
  'posturaSangue', 'posturaAreia', 'estandarteAtivo',
  // (lote C3, dono 25/10) numa Tempestade de Lâminas Sangrenta sua (`emTempestadeSangrenta`).
  'emTempestadeSangrenta',
  // (lote 65, as Ramificadoras) afetado por um Arauto (ao menos uma gema de Arauto ligada)
  'afetadoPorArauto', 'afetadoPorGuardaNaoVaal', 'guardaNaoVaalTerminouRecente',
  // (lote 66) "enquanto portando um(a) X ou Y" — a arma em QUALQUER das mãos (as condições `comX` são da mão principal): Garra ou Adaga, Machado
  // ou Espada, Maça, Cetro ou Cajado
  'comGarraOuAdaga', 'comMachadoOuEspada', 'comMacaCetroOuCajado',
  // (revisão do lote da eficácia, 20/10) "com Maças e Cetros" — no PoE o Cetro é Maça (o PoB: `Sceptre = { flag = "Mace" }`): a mão principal com um dos dois
  'comMacaOuCetro',
  // (lote 67) Resfriou um inimigo recentemente; plantou uma Mina ou arremessou uma Armadilha recentemente
  'resfriouRecente', 'plantouRecente',
  // (lote 68) durante o efeito de um Frasco de VIDA
  'duranteFrascoVida',
  // (11/10, os únicos:) nenhum item equipado corrompido / todos corrompidos; um Anel Mágico (em qualquer lado, no esquerdo, no direito); drenando
  // Escudo de Energia / Mana; as garras no desarmado (`garra_desarmado` dá o "com Garra" ao desarmado).
  'semItemCorrompido', 'todosCorrompidos', 'semVidaNosOutros', 'anelMagico', 'anelMagicoEsquerdo', 'anelMagicoDireito', 'drenandoEs', 'drenandoMana',
]);
/** O raio da PRESENÇA (PoE: a área em volta do personagem que os implícitos eldritch olham), em casas. */
export const RAIO_DA_PRESENCA = 6;
/** As condições de estado com PARÂMETRO: `atrMin:str:200` (ao menos 200 de Força), `atrMaior:dex:int`, `buff:agressividade`,
 * `semCargas:frenesi`, `comCargas:poder`, `cargasMax:tolerancia`, `furiaMin:N`, `lacaio:bestial`. */
const COND_COM_PARAMETRO = /^(canalizandoHa|matouRecenteMin|afetadoPorAbissal|afetadoPor|maiorAtributo|itensInfluencia|comAbissalLocal|atrMin|atrMaior|buff|semBuff|bloqueioEscudoMin|vidaManaPerto|semCargas|comCargas|cargasMax|furiaMin|lacaio|escudoMin|resMin|maestriasDe|usouTag|fortMin|evRecente|naoEvRecente|armaComEncaixes|inimigosPertoMin|aliadosPerto|nosUltimos|paradoHa|devocaoMin|primordiaisMin):/;
export const ehCondDeEstado = (c) => CONDICOES_DE_ESTADO.has(c) || COND_COM_PARAMETRO.test(c);
/** As tags de GOLPE conhecidas (as do poedb em português viram estas — `tagsDoPoe`). */
export const TAGS_DE_GOLPE = new Set([
  'alvoExcomungado', 'alvoSemArmadura', 'alvoSemEvasao', 'ataque', 'magia', 'corpo', 'projetil', 'area', 'fogo', 'gelo', 'raio', 'fisico', 'caos', 'elemental', 'arco', 'totem', 'armadilha',
  'mina', 'lacaio', 'arauto', 'vaal', 'movimento', 'clamor', 'aura', 'maldicao', 'alvoVidaBaixa', 'dot', 'habilidade', 'suporte', 'golem',
  // O ALVO do golpe (o estado dele naquele acerto): Resfriado, Congelado, Eletrizado, Cego, Sangrando, Envenenado, Incendiado, Amaldiçoado,
  // Lento, Mutilado, Provocado, a raridade, a vida cheia; e o golpe de perto ("em Curto Alcance"), na mão principal/secundária.
  'alvoResfriado', 'alvoCongelado', 'alvoEletrizado', 'alvoCego', 'alvoSangrando', 'alvoEnvenenado', 'alvoIncendiado', 'alvoAmaldicoado',
  'alvoLento', 'alvoMutilado', 'alvoProvocado', 'alvoAtordoado', 'alvoEletrizadoOuCongelado', 'guarda', 'gemaCritica', 'alvoRaro', 'alvoUnico', 'alvoMagico', 'alvoVidaCheia', 'alvoPerto', 'canalizar', 'retaliacao', 'estandarte', 'custaVida',
  'golpe', 'pancada', 'nova', 'runa', 'marca', 'feitico', 'vinculo', 'ativada', 'desarmadoGolpe', 'naoCritico',
  // (ciclo 7) o alvo com a SUA Marca ("contra o Inimigo Marcado", "Golpe de Misericórdia contra Inimigos Marcados").
  'alvoMarcado',
  // (lote 68) o alvo com alguma Afecção ("contra Inimigos afetados por Afecções": Incendiado, Sangrando, Envenenado, Resfriado, Congelado,
  // Eletrizado, Causticado, Fragilizado, Exaurido)
  'alvoComAfeccao',
  // (A cor da GEMA — o atributo dela —, para o nível das gemas encaixadas: `skills/gemas.extrasDaGemaPoe`; e a cor do ENCAIXE em que ela está.)
  'forca', 'destreza', 'inteligencia', 'encaixeVermelho', 'encaixeVerde', 'encaixeAzul', 'encaixeBranco',
  // (ciclo 7, lote D) o que o golpe FEZ — resolvido depois do sorteio, no `aoAcertar`: foi Crítico ("Acertos Críticos possuem Golpe de
  // Misericórdia", "Atordoamentos dos Golpes Críticos têm Duração aumentada") e Atordoou ("Acertos que Atordoarem … Golpe de Misericórdia").
  'critico', 'golpeAtordoou',
  // (lote D) a MÃO do golpe de ataque ("com Acertos da Mão Principal/Secundária": `Ficha.fichaDaMao` marca a secundária).
  'maoPrincipal', 'maoSecundaria',
  // (lote D) o alvo com Exposição a um elemento; o alvo FORA da Vida Baixa ("contra inimigos que não estiverem em vida baixa").
  'alvoExposicaoFogo', 'alvoExposicaoGelo', 'alvoExposicaoRaio', 'alvoNaoVidaBaixa',
  // (lote 57) o alvo sob o seu Solo Profano (`noSoloProfano`)
  'alvoNoSoloProfano',
  // (lote 57) a gema de suporte que não é Excepcional (`skills/gemas.extrasDaGemaPoe` — o nível das gemas)
  'naoExcepcional',
  // (lote 54) o ataque com o ESCUDO (a mão secundária do PoE com escudo — `acoes.tagsPoeDaSkill`: a Fúria Fulminante)
  'ataqueDeEscudo',
  // (lote 55) a habilidade que NÃO é de Canalização ("Habilidades Não Canalizadoras têm … de Custo de Mana" — `acoes.tagsPoeDaSkill`)
  'naoCanalizar',
  // (lote F) o ataque com o Tempo de Ataque maior que 1 segundo (o intervalo do golpe da ficha).
  'ataqueLento', 'alvoComEscudo', 'alvoSemDreno',
  // (lote G) a gema de Postura; o ataque Impelido por um Clamor (`hunt.impelidos`).
  'postura', 'impelido',
  // (lote A1b, revisão do dono 19/10) DE QUEM é o Impelir: o do Clamor (os bônus do buff do Clamor — `GemasPoe.clamorPeloPoder`) e o da Emboscada
  'impelidoClamor', 'impelidoEmboscada',
  // (17/10, lote G18) o terceiro uso SEGUIDO da mesma gema (o Martelo Glacial: "Cada terceiro golpe sucessivo …" — `hunt.poeTerceiroGolpe`)
  'terceiroGolpe',
  // (15/10, lote 31) o abate por um ACERTO (o golpe fatal não foi dano contínuo — `quem-feriu.tagsDoAbate`); o inimigo Provocado pelo seu
  // CLAMOR (`Reforcos.provocar` — `provocadoAte`); o morto na área do seu Estandarte plantado (`pertoDoEstandarte`).
  'acerto', 'alvoProvocadoClamor', 'alvoPertoDoEstandarte',
]);
/**
 * As condições que dependem do ESPAÇO em que a peça está (resolvidas peça a peça em `Afixos.somaDeItens`): o anel (esquerdo/direito) e a
 * MÃO ("quando na Mão Principal", "na Mão Secundária" — a arma da mão secundária fica no espaço do escudo; dono, 10/10: os únicos).
 */
export const CONDICOES_DE_ANEL = { anelEsquerdo: 'ring', anelDireito: 'ring2', naMaoPrincipal: 'weapon', naMaoSecundaria: 'shield' };
/**
 * Os atributos que o ACERTO lê com a tag `critico` (só no golpe crítico — `mods-poe.aoAcertar`): "Acertos Críticos possuem Golpe de
 * Misericórdia" = `culling@critico` (+ ciclo 7: a duração do Atordoamento, o Empurrão e o Agravar no crítico). A tag não vale para os outros
 * (nenhum outro lugar a pergunta: o balão diria que funciona sem funcionar).
 */
export const SO_NO_CRITICO = new Set(['culling', 'chance_empalar', 'stun_duration', 'chance_empurrar', 'chance_agravar']);
/** (ciclo 7, lote D) O mesmo para a tag `golpeAtordoou` ("Acertos que Atordoarem…"): os atributos que o acerto lê depois do sorteio do atordoamento. */
export const SO_AO_ATORDOAR = new Set(['culling', 'chance_fortificar', 'chance_agravar']);

const classeDe = (peca) => peca?.poe?.classe ?? null;
const recente = (quando, agora) => quando != null && agora - quando <= RECENTE_MS;

/** As condições de estado que VALEM agora para o personagem (um Set). `total`: a soma (para os máximos de cargas e os atributos). */
/** As defesas da BASE de uma peça do PoE (`{ armadura, evasao, escudo }`: o que o catálogo diz da base), ou null. */
let leitorDeBase = null;
let leitorDeMaestrias = null;
/** Quem conta as maestrias alocadas de um tema (`passivas/arvore.mjs`): `(estado, 'Vida') → n`. */
export function definirLeitorDeMaestrias(fn) { leitorDeMaestrias = fn; }
/** (11/10) A soma da ÁRVORE do personagem (quem registra: `afixos.mjs`) — o que as gemas leem sem montar a ficha ("Habilidades do Peitoral …"). */
let leitorDaArvore = null;
export function definirLeitorDaArvore(fn) { leitorDaArvore = fn; }
export const somaDaArvore = (estado) => leitorDaArvore?.(estado) ?? {};
export function definirLeitorDeBase(fn) { leitorDeBase = fn; }
/** (lote 27/28) As joias que valem nos encaixes da ÁRVORE (quem registra: `passivas/arvore.mjs`): `(estado) → [peça]`. */
let leitorDeJoias = null;
export function definirLeitorDeJoias(fn) { leitorDeJoias = fn; }
export const joiasDaArvore = (estado) => leitorDeJoias?.(estado) ?? [];
/** A peça é uma Joia Abissal (um dos 4 Olhos)? */
export const ehJoiaAbissal = (p) => p?.poe?.classe === 'Abyss_Jewels';
/**
 * (15/10, lote 28) As JOIAS ABISSAIS "afetando você" (PoE: "Abyss Jewel affecting you"): as encaixadas nos encaixes abissais das peças
 * vestidas e as dos encaixes alocados da árvore.
 */
export function joiasAbissaisAfetando(estado) {
  const lista = [];
  for (const [slot, p] of Object.entries(estado?.equipment ?? {})) if (p && slot !== 'backpack') for (const j of p.poe?.abissais ?? []) if (j) lista.push(j);
  for (const j of joiasDaArvore(estado)) if (ehJoiaAbissal(j)) lista.push(j);
  return lista;
}
/** A joia é da base `slug` (`Murderous_Eye_Jewel` — o Olho Assassino)? Sem `slug`, qualquer uma. */
const daBaseAbissal = (j, slug) => !slug || String(j?.poe?.base ?? '').endsWith(`/${slug}`);
export const defesasDaPeca = (poe) => leitorDeBase?.(poe) ?? null;
/** A defesa da PEÇA vestida (`{ armadura, evasao, escudo }`): a faixa sorteada dela (`peca.base`); sem faixa, a da base do catálogo. */
export function defesaDaPecaVestida(p) {
  if (!p) return null;
  const d = p.poe ? defesasDaPeca(p.poe) : null;
  const meio = (f, k) => (Array.isArray(p.base?.[f]) ? (p.base[f][0] + p.base[f][1]) / 2 : d?.[k] ?? 0);
  return { armadura: meio('armor', 'armadura'), evasao: meio('evasion', 'evasao'), escudo: meio('es', 'escudo') };
}

export function condicoesDe(estado, total = null, principais = null) {
  const v = new Set();
  v.parametros = { estado, total, principais };
  const arma = classeDe(estado?.equipment?.weapon);
  const outra = classeDe(estado?.equipment?.shield);
  if (arma && COND_DA_CLASSE[arma]) v.add(COND_DA_CLASSE[arma]);
  if (arma) v.add(DUAS_MAOS.has(arma) ? 'duasMaos' : 'umaMao');
  if (arma && !A_DISTANCIA.has(arma)) v.add('armaCorpo');
  if (outra === 'Shields') v.add('comEscudo');
  if (outra === 'Claws') v.add('garraNaSecundaria');
  if (outra && COND_DA_CLASSE[outra]) v.add('duasArmas');
  // ("enquanto portando dois Tipos de Armas diferentes": duas armas de classes diferentes — espada e machado, adaga e garra…)
  if (arma && outra && COND_DA_CLASSE[arma] && COND_DA_CLASSE[outra] && COND_DA_CLASSE[arma] !== COND_DA_CLASSE[outra]) v.add('armasDiferentes');
  // ("Conta como Dupla Empunhadura", "Conta como todos Tipos de Armas Corpo a Corpo de Uma Mão".)
  const pecas = Object.values(estado?.equipment ?? {});
  if (pecas.some((p) => Number(p?.poe?.af?.conta_duas_armas) > 0)) v.add('duasArmas');
  if (pecas.some((p) => Number(p?.poe?.af?.conta_todas_armas_uma_mao) > 0)) for (const c of ['comEspada', 'comMachado', 'comMaca', 'comAdaga', 'comGarra', 'comCetro', 'umaMao', 'armaCorpo']) v.add(c);
  // (lote 66) a arma em qualquer das mãos
  const nasMaos = new Set([COND_DA_CLASSE[arma], COND_DA_CLASSE[outra]].filter(Boolean));
  const tem = (...cs) => cs.some((c) => v.has(c) || nasMaos.has(c));
  if (tem('comGarra', 'comAdaga')) v.add('comGarraOuAdaga');
  if (tem('comMachado', 'comEspada')) v.add('comMachadoOuEspada');
  if (tem('comMaca', 'comCetro', 'comCajado')) v.add('comMacaCetroOuCajado');
  if (v.has('comMaca') || v.has('comCetro')) v.add('comMacaOuCetro');
  const h = estado?.hunt;
  const r = h?.poeRecente ?? {};
  const agora = h?.clock ?? 0;
  if (h) {
    v.add(recente(r.matou, agora) ? 'matouRecente' : 'naoMatouRecente');
    v.add(recente(r.critico, agora) ? 'criticoRecente' : 'naoCriticoRecente');
    // ("se o Dreno foi removido Preenchendo a Vida Não Reservada": recentemente — `Ficha.recuperarRoubo` marca quando a vida cheia encerra o dreno.)
    if (recente(r.drenoCheio, agora)) v.add('drenoRemovidoCheio');
    // ("enquanto no máximo de Fúria": a Fúria no máximo — 30 + "+N à Fúria máxima".)
    if ((h.furia?.n ?? 0) > 0 && (h.furia.n | 0) >= maximoDeFuria(total)) v.add('furiaCheia');
    if (recente(r.acertado, agora)) v.add('acertadoRecente');
    if (!recente(r.dano, agora)) v.add('semDanoRecente');
    if (r.moveu != null && agora - r.moveu <= MOVENDO_MS) v.add('movendo');
    // (Vida Cheia: a vida no máximo.)
    if (recente(r.lacaioMorreu, agora)) v.add('lacaioMorreuRecente');
    if (recente(r.usouLacaio, agora)) v.add('usouLacaioRecente');
  } else {
    v.add('naoMatouRecente').add('naoCriticoRecente').add('semDanoRecente');
  }
  // (09/10, as maestrias da árvore:) "Você conta como em Vida Baixa enquanto em 75% da Vida máxima ou abaixo" / "…em Vida Cheia enquanto em
  // 90% ou acima": o limiar muda (o maior/menor vale).
  const baixa = Math.max(VIDA_BAIXA, (Number(total?.limiar_vida_baixa) || 0) / 100);
  const cheia = Math.min(1, (Number(total?.limiar_vida_cheia) || 100) / 100);
  if ((estado?.maxHp ?? 0) > 0 && (estado.hp ?? 0) <= baixa * estado.maxHp) v.add('vidaBaixa');
  else v.add('naoVidaBaixa');
  if ((estado?.maxHp ?? 0) > 0 && (estado.hp ?? 0) >= cheia * estado.maxHp) v.add('vidaCheia');
  if ((estado?.maxMana ?? 0) > 0 && (estado.mana ?? 0) <= VIDA_BAIXA * estado.maxMana) v.add('manaBaixa');
  else v.add('naoManaBaixa');
  if (!(estado?.es > 0)) v.add('semEscudo');
  if (!(estado?.hunt?.monstros ?? []).some((m) => m.hp > 0 && Object.values(m.maldicoes ?? {}).some((x) => x?.marca && x.ate > (estado.hunt.clock ?? 0)))) v.add('semMarca');
  // (09/10) As peças vestidas: o Peitoral sem modificador de Vida; as quatro armaduras com Evasão / com Armadura na base (`defesasDaPeca`).
  const eq = estado?.equipment ?? {};
  const corpo = eq.body?.poe;
  if (corpo && ![...(corpo.implicitos ?? []), ...(corpo.prefixos ?? []), ...(corpo.sufixos ?? []), ...(corpo.modificadores ?? [])].some((m) => /Vida/.test(m.modelo ?? m.texto ?? ''))) v.add('peitoralSemVida');
  const quatro = ['head', 'body', 'gloves', 'feet'].map((s) => eq[s]?.poe ? defesasDaPeca(eq[s].poe) : null);
  if (quatro.every((d) => d?.evasao > 0)) v.add('armadurasComEvasao');
  if (quatro.every((d) => d?.armadura > 0)) v.add('armadurasComArmadura');
  const defesa = defesaDaPecaVestida;
  const elmo = defesa(eq.head);
  if (elmo && elmo.armadura > elmo.evasao) v.add('elmoArmaduraMaior');
  if (elmo && elmo.evasao > elmo.armadura) v.add('elmoEvasaoMaior');
  if (['head', 'gloves', 'feet'].every((s) => { const d = defesa(eq[s]); return d?.armadura > 0 && d.escudo > 0; })) v.add('outrasComArmaduraEEscudo');
  const explicitoDeEvasao = (poe) => !!poe && [...(poe.prefixos ?? []), ...(poe.sufixos ?? [])].some((m) => /Evasão/.test(m.modelo ?? m.texto ?? ''));
  if (explicitoDeEvasao(eq.neck?.poe)) v.add('amuletoComEvasao');
  if (explicitoDeEvasao(eq.ring?.poe) && explicitoDeEvasao(eq.ring2?.poe)) v.add('aneisComEvasao');
  if ((estado?.es ?? 0) > 0) v.add('comEscudoDeEnergia');
  // ("se nenhum Item Equipado for Corrompido" / "se todos os Itens Equipados forem Corrompidos": as peças vestidas, fora a mochila.)
  const vestidas = Object.entries(eq).filter(([slot, p]) => p && slot !== 'backpack').map(([, p]) => p);
  if (!vestidas.some((p) => p.poe?.corrompido)) v.add('semItemCorrompido');
  const magico = (p) => p?.poe?.raridade === 'magico';
  if (magico(eq.ring)) v.add('anelMagicoEsquerdo').add('anelMagico');
  if (magico(eq.ring2)) v.add('anelMagicoDireito').add('anelMagico');
  if (!arma && Number(total?.garra_desarmado) > 0) v.add('comGarra');
  if (vestidas.length && vestidas.every((p) => p.poe?.corrompido)) v.add('todosCorrompidos');
  if (h) {
    const res = Object.values(h.buffs ?? {}).filter((b) => b?.reserva && b.ate > (h.clock ?? 0));
    if (res.some((b) => b.reserva.recurso === 'vida') && res.some((b) => b.reserva.recurso !== 'vida')) v.add('reservouVidaEMana');
  }
  if (estado?.es > 0 && estado.esCheio) v.add('escudoCheio');
  if (!arma) v.add('desarmado');
  if (!estado?.equipment?.shield) v.add('maoSecundariaVazia');
  // (lote 80, a Técnica da Palma Oca) "não Sobrecarregado": sem Luvas e sem item na Mão Principal ou Secundária (o lembrete do PoE; o PoB)
  if (!arma && !estado?.equipment?.shield && !estado?.equipment?.gloves) v.add('naoSobrecarregado');
  if (h) {
    const dots = h.efeitosDoJogador?.dots ?? [];
    const temDot = (...t) => dots.some((d) => t.includes(d.tipo) && d.falta > 0);
    if (temDot('queimadura')) v.add('ardendo'); else v.add('naoArdendo');
    if (temDot('sangramento')) v.add('sangrandoProprio');
    if (temDot('veneno', 'venenoPoe')) v.add('envenenadoProprio');
    // (+ as maldições do PoE que os monstros põem em você — `amaldicoarJogador`)
    if (temDot('maldicao') || Object.values(h.maldicoesNoJogador ?? {}).some((m) => m && m.ate > agora)) v.add('amaldicoadoProprio');
    // (+ a Eletrização do crítico de um monstro — `monstros-no-jogador.eletrizar`: Dano recebido aumentado, sem dano contínuo.)
    if (temDot('choque') || (h.debuffsDoJogador?.eletrizado?.ate ?? 0) > agora) v.add('eletrizadoProprio');
    const c = h.controle ?? {};
    if (c.congelado?.ate > agora) v.add('congeladoProprio');
    if (c.lento?.ate > agora) v.add('resfriadoProprio');
    if (!v.has('ardendo') && !v.has('congeladoProprio') && !v.has('eletrizadoProprio') && !v.has('resfriadoProprio')) v.add('semAfeccaoElemental');
    const frascos = Object.values(h.frascosPoe?.ativos ?? {}).some((a) => a.ate > agora);
    v.add(frascos ? 'duranteFrasco' : 'semFrasco');
    if (Object.values(h.frascosPoe?.ativos ?? {}).some((a) => a.ate > agora && a.recurso === 'mana')) v.add('duranteFrascoMana');
    if (Object.values(h.frascosPoe?.ativos ?? {}).some((a) => a.ate > agora && a.recurso === 'vida')) v.add('duranteFrascoVida');
    if (Object.values(h.frascosPoe?.tinturas ?? {}).some((t) => t?.ativa)) v.add('tinturaAtiva');
    if ((h.roubos ?? []).some((x) => x.restante > 0)) v.add('drenando');
    // (revisão do A5: só o Dreno de VIDA — "Dano aumentado enquanto Drenando Vida", a qualidade do Dreno de Vida)
    if ((h.roubos ?? []).some((x) => x.restante > 0 && x.recurso === 'vida')) v.add('drenandoVida');
    if ((h.roubos ?? []).some((x) => x.restante > 0 && x.recurso === 'es')) v.add('drenandoEs');
    if ((h.roubos ?? []).some((x) => x.restante > 0 && x.recurso === 'mana')) v.add('drenandoMana');
    if (!v.has('movendo')) v.add('parado');
    if (!recente(r.acertado, agora)) v.add('naoAcertadoRecente');
    if (!recente(r.critico, agora)) v.add('naoCritRecente');
    for (const [k, cond] of Object.entries(RECENTES)) if (recente(r[k], agora)) v.add(cond);
    if (!recente(r.bloqueou, agora)) v.add('naoBloqueouRecente');
    if (!recente(r.ganhouPoder, agora)) v.add('naoGanhouPoderRecente');
    if (!recente(r.ganhouFrenesi, agora)) v.add('naoGanhouFrenesiRecente');
    if (!recente(r.perdeuPoder, agora)) v.add('naoPerdeuPoderRecente');
    // (lote 80, o Discípulo de Kitava: "10% mais Dano sofrido se você não Consumiu um Cadáver Recentemente")
    if (!recente(r.consumiuCadaver, agora)) v.add('naoConsumiuCadaverRecente');
    if (!recente(r.usouAvanco, agora)) v.add('naoConjurouAvancoRecente');
    if (!recente(r.acertadoAtaque, agora)) v.add('naoAcertadoAtaqueRecente');
    // (lote D) "enquanto Conjurando": usou uma Magia há pouco (o tempo de uma conjuração); Fortificado: com alguma Fortificação.
    if (r['usou:magia'] != null && agora - r['usou:magia'] <= CONJURANDO_MS) v.add('conjurando');
    if (fortificacao(estado, total) > 0) v.add('fortificado');
    // (lote 42, P074: o canalizar contínuo — `canalizandoAgora`; antes, 1 s depois de usar uma habilidade de Canalização)
    if (canalizandoAgora(h, agora)) v.add('canalizando');
    if (h.egides?.fisica) v.add(h.egides.fisica.valor > 0 ? 'egideFisicaAtiva' : 'egideFisicaEsgotada');
    if (cadaveresPerto(h) > 0) v.add('cadaverPerto');
    // (lote G) Elusivo (o buff — antes a condição nunca valia), o Solo Sagrado, a Postura e o Estandarte.
    if (buffAtivo(estado, 'elusivo', total)) v.add('elusivo');
    if (noSoloSagrado(h, agora)) v.add('soloSagrado');
    v.add(posturaDe(h, agora) === 'areia' ? 'posturaAreia' : 'posturaSangue');
    if (emTempestadeSangrenta(h, agora)) v.add('emTempestadeSangrenta');
    if (estandarteAtivo(h, agora)) v.add('estandarteAtivo');
    if (Object.values(h.buffs ?? {}).some((b) => b && b.ate > agora && b.tipo === 'poe-arauto')) v.add('afetadoPorArauto');
    // (lote 80, a Astúcia do Veterano) "enquanto afetado por uma Habilidade de Guarda não Vaal" e "se um Buff de Guarda não Vaal terminou
    // Recentemente" (o que expirou há até 4 s — ou o que voltou, pela marca `guardaNaoVaalTerminou`)
    const guardas = Object.values(h.buffs ?? {}).filter((b) => b?.guarda && !b.vaal);
    if (guardas.some((b) => b.ate > agora)) v.add('afetadoPorGuardaNaoVaal');
    if (guardas.some((b) => b.ate <= agora && recente(b.ate, agora))) v.add('guardaNaoVaalTerminouRecente');
    if (recente(r['usou:mina'], agora) || recente(r['usou:armadilha'], agora)) v.add('plantouRecente');
    if (!recente(r.detonouMina, agora)) v.add('naoDetonouMinaRecente');
    // A PRESENÇA: quem está vivo a até `RAIO_DA_PRESENCA` casas — o Único (ou o chefe), o Raro, e o chefe pináculo da sala (o "Chefe Final do
    // Atlas" dos implícitos eldritch: `hunt.bossPinaculo`, marcado na entrada — `cacadas.entrar`).
    if (h.pos) {
      const perto = (h.monstros ?? []).filter((m) => m.hp > 0 && Math.max(Math.abs(m.x - h.pos.x), Math.abs(m.y - h.pos.y)) <= RAIO_DA_PRESENCA);
      const unico = perto.some((m) => m.raridade === 'unico' || m.raridade === 'boss' || m.boss);
      if (unico) v.add('unicoNaPresenca');
      if (unico || perto.some((m) => m.raridade === 'raro')) v.add('raroOuUnicoPerto');
      const raros = perto.filter((m) => m.raridade === 'raro' || m.raridade === 'unico' || m.raridade === 'boss' || m.boss).length;
      if (raros <= 1) v.add('maxUmRaroPerto');
      if (raros >= 2) v.add('doisRarosPerto');
      if (h.bossPinaculo && perto.some((m) => m.boss || m.raridade === 'boss')) v.add('chefeFinalNaPresenca');
    }
  } else v.add('parado').add('naoAcertadoAtaqueRecente').add('semFrasco').add('naoDetonouMinaRecente').add('naoAcertadoRecente').add('naoBloqueouRecente').add('naoGanhouPoderRecente').add('naoGanhouFrenesiRecente').add('naoPerdeuPoderRecente').add('naoConsumiuCadaverRecente').add('naoConjurouAvancoRecente').add('naoCritRecente').add('naoArdendo').add('semAfeccaoElemental');
  // (lote 80, a Palma Oca) "Você conta como em Dupla Empunhadura enquanto …" da ÁRVORE (`conta_duas_armas@<cond>`): as peças já contam acima
  if (!v.has('duasArmas') && Object.entries(total ?? {}).some(([k, x]) => k.startsWith('conta_duas_armas@') && Number(x) > 0 && partir(k).conds.every((c) => vale(v, c)))) v.add('duasArmas');
  return v;
}
/** Os acontecimentos "recentes" (o que `marcar` grava) → a condição. */
const RECENTES = {
  bloqueou: 'bloqueouRecente', atordoou: 'atordoouRecente', congelou: 'congelouRecente', incendiou: 'incendiouRecente', eletrizou: 'eletrizouRecente',
  usouMovimento: 'usouMovimentoRecente', usouVaal: 'usouVaalRecente', clamou: 'clamouRecente', acertou: 'acertouRecente', ganhouPoder: 'ganhouPoderRecente',
  consumiuCadaver: 'consumiuCadaverRecente', guardaNaoVaalTerminou: 'guardaNaoVaalTerminouRecente', gastouMana: 'gastouManaRecente', usouHabilidade: 'usouHabilidadeRecente', recargaEs: 'recargaEsIniciouRecente',
  usouRubi: 'usouRubiRecente', usouSafira: 'usouSafiraRecente', usouTopazio: 'usouTopazioRecente', usouAmetista: 'usouAmetistaRecente', usouAvanco: 'conjurouAvancoRecente',
  atordoado: 'atordoadoRecente', atordoadoConjurando: 'atordoadoConjurandoRecente', acertadoAtaque: 'acertadoAtaqueRecente', estilhacou: 'estilhacouRecente',
  infligiuExposicao: 'exposicaoRecente', empalou: 'empalouRecente', mudouPostura: 'mudouPosturaRecente',
  detonouMina: 'detonouMinaRecente', usouFogo: 'usouFogoRecente', acertouUnico: 'acertouUnicoRecente', usouFrascoVida: 'usouFrascoVidaRecente',
  resfriou: 'resfriouRecente', matouAmaldicoado: 'matouAmaldicoadoRecente',
  gastouVida: 'gastouVidaRecente', acertouMaoPrincipal: 'acertouMaoPrincipalRecente', acertouMaoSecundaria: 'acertouMaoSecundariaRecente',
  sofreuSelvagem: 'sofreuAcertoSelvagemRecente',
};
/** Uma condição vale? (as com parâmetro leem o estado, a soma e os atributos guardados no Set). */
export function vale(conds, c) {
  if (conds.has(c)) return true;
  const m = COND_COM_PARAMETRO.exec(c);
  if (!m) return false;
  const { estado, total, principais } = conds.parametros ?? {};
  const [tipo, ...resto] = c.split(':');
  const h = estado?.hunt;
  const agora = h?.clock ?? 0;
  const cargas = (t) => { const x = h?.cargasPoe?.[t]; return x && x.ate > agora ? x.n | 0 : 0; };
  const maxCargas = (t) => maximoDeCargas(total, t);
  switch (tipo) {
    case 'atrMin': return (principais?.[resto[0]] ?? 0) >= Number(resto[1]);
    // (lote 67) "caso você tenha Matado ao menos N Inimigos Recentemente": `matouRecenteMin:N`
    case 'matouRecenteMin': return (h?.poeMortesRecentes ?? []).filter((t) => agora - t <= RECENTE_MS).length >= Number(resto[0]);
    // (lote 68) "caso você tenha Canalizado por ao menos N segundo" / "após Canalizar por N segundo": canalizando agora, há N s (`hunt.canalizacao.desde`)
    case 'canalizandoHa': return canalizandoAgora(h, agora) && agora - (h.canalizacao.desde ?? agora) >= (Number(resto[0]) || 0) * 1000;
    // (lote 28) "enquanto afetado por uma Joia Abissal Rara/Mágica/Única": `afetadoPorAbissal:raro`.
    case 'afetadoPorAbissal': return joiasAbissaisAfetando(estado).some((j) => j.poe?.raridade === resto[0]);
    // (lote 55, o Olho do Vigia) "enquanto afetado por <Aura>": `afetadoPor:<o nome da gema>` — a aura da gema ligada (`hunt.buffs`) ou a do seu
    // mercenário vivo (`l.auraEfeitos`); o id da ação vem do nome (`definirAcaoPeloNome` — `skills/gemas.mjs`).
    case 'afetadoPor': {
      const id = acaoPeloNome?.(resto[0]);
      return !!id && ((h?.buffs?.[id]?.ate ?? 0) > agora || (h?.lacaios ?? []).some((l) => l?.mercenario && l.hp > 0 && l.auraEfeitos?.id === id));
    }
    // ("Com uma joia Olho X encaixada": a condição é da PEÇA — `daPeca` resolve; solta, não vale.)
    case 'comAbissalLocal': return false;
    // "se você tiver ao menos N Maestrias de Vida alocadas": `maestriasDe:Vida:N` (a árvore registra quem conta — `definirLeitorDeMaestrias`).
    case 'maestriasDe': return (leitorDeMaestrias?.(estado, resto[0]) ?? 0) >= Number(resto[1]);
    case 'atrMaior': return (principais?.[resto[0]] ?? 0) > (principais?.[resto[1]] ?? 0);
    // (lote 56, a Doutrina Racional) "se a Força for seu maior Atributo": `maiorAtributo:str` — ele não perde para nenhum dos outros (o empate vale,
    // como o PoB: o atributo igual ao maior)
    // (lote 57, o Limitado pelo Destino) "se N Itens do <Influência> estiverem equipados": `itensInfluencia:<influência>:<N>` — as peças vestidas
    // com a influência (`poe.influencias`: shaper, elder, crusader, redeemer, hunter, warlord)
    case 'itensInfluencia': return Object.entries(estado?.equipment ?? {}).filter(([slot, p]) => slot !== 'backpack' && (p?.poe?.influencias ?? []).includes(resto[0])).length >= Number(resto[1]);
    case 'maiorAtributo': { const a = principais?.[resto[0]] ?? 0; return ['str', 'dex', 'int'].every((k) => (principais?.[k] ?? 0) <= a); }
    case 'buff': return buffAtivo(estado, resto[0], total);
    case 'semBuff': return !buffAtivo(estado, resto[0], total);
    // ("se a Vida Máxima e Mana Máxima estiverem dentro de N": a diferença entre elas.)
    case 'vidaManaPerto': return Math.abs((estado?.maxHp ?? 0) - (estado?.maxMana ?? 0)) <= Number(resto[0]);
    // ("caso o Escudo Equipado possua ao menos N% de Chance de Bloquear": a do próprio escudo.)
    case 'bloqueioEscudoMin': return (Number(estado?.equipment?.shield?.poe?.af?.block) || 0) >= Number(resto[0]);
    case 'semCargas': return cargas(resto[0]) === 0;
    // (lote 32, P041) "se você não se moveu nos últimos N segundos": `paradoHa:N` — desde o último passo (ou a entrada, sem passo ainda).
    case 'paradoHa': { const r = h?.poeRecente ?? {}; return agora - (r.moveu ?? h?.poeEntrou ?? agora) >= Number(resto[0]) * 1000; }
    case 'comCargas': return cargas(resto[0]) > 0;
    // (+ "Conta como ter o número máximo de cargas de poder" — `conta_max_poder`.)
    case 'cargasMax': return cargas(resto[0]) >= maxCargas(resto[0]) || (resto[0] === 'poder' && Number(total?.conta_max_poder) > 0);
    case 'furiaMin': return (h?.furia?.n ?? 0) >= Number(resto[0]);
    case 'lacaio': return (h?.lacaios ?? []).some((l) => l.hp > 0 && (resto[0] === 'qualquer' || new RegExp(resto[0], 'i').test(l.nome ?? '')));
    // (13/10) "se você tiver pelo menos N aliados por perto": os seus lacaios vivos e os companheiros da party na sala a até 3 casas.
    case 'aliadosPerto': {
      const party = h?.pos ? (h.partilha?.naSala ?? []).filter((o) => o && o !== estado && o.hunt?.pos && (o.hunt.z ?? 0) === (h.z ?? 0) && Math.max(Math.abs(o.hunt.pos.x - h.pos.x), Math.abs(o.hunt.pos.y - h.pos.y)) <= Aliados.PADRAO.raio).length : 0;
      return (h?.lacaios ?? []).filter((l) => l.hp > 0).length + party >= Math.max(1, Number(resto[0]) || 1);
    }
    case 'escudoMin': return (estado?.maxEsPoe ?? 0) >= Number(resto[0]);
    // (lote 48, a Fé Militante) "enquanto você tiver pelo menos N de Devoção": a soma da Devoção (os nós conquistados pelos Templários)
    case 'devocaoMin': return (Number(total?.devocao) || 0) >= Number(resto[0]);
    // (lote 49, a Pedra Anima) "caso você tenha N Itens Primordiais Encaixados ou Equipados": as joias da árvore e as peças vestidas com "Primordial"
    case 'primordiaisMin': return [...joiasDaArvore(estado), ...Object.entries(estado?.equipment ?? {}).filter(([s]) => s !== 'backpack').map(([, p]) => p)].filter((p) => Number(p?.poe?.af?.primordial) > 0).length >= Number(resto[0]);
    // (ciclo 7) "se você usou uma Habilidade de <tag> Recentemente" (`marcarUsoPorTag`).
    case 'usouTag': return recente(h?.poeRecente?.[`usou:${resto[0]}`], agora);
    // (lote D) "enquanto você tiver ao menos N Fortificações"; o evento aconteceu (ou não) recentemente — `evRecente:suprimir`.
    case 'fortMin': return fortificacao(estado, total) >= Number(resto[0]);
    case 'evRecente': return recente(h?.poeRecente?.[`ev:${resto[0]}`], agora);
    // (13/10) "nos últimos N segundos" — o prazo exato, não o "recentemente" (4 s): `nosUltimos:<N>:<o que `marcar` gravou>` (`usouFrascoVida`,
    // `recargaEs`, `ev:usarFrascoMana` — o evento).
    case 'nosUltimos': { const q = h?.poeRecente?.[resto.slice(1).join(':')]; return q != null && agora - q <= (Number(resto[0]) || 0) * 1000; }
    case 'naoEvRecente': return !recente(h?.poeRecente?.[`ev:${resto[0]}`], agora);
    // (lote E) "se a arma da sua mão principal tiver um encaixe verde e vermelho": `armaComEncaixes:GR` (as letras das cores dos encaixes abertos).
    // (11/10) "enquanto com ao menos N Inimigos Próximos": os vivos a até 2 casas (a mesma conta da escala `inimigosPerto`).
    case 'inimigosPertoMin': { const p = h?.pos; return !!p && (h.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 2).length >= Number(resto[0]); }
    case 'armaComEncaixes': { const p = estado?.equipment?.weapon; const cores = (p?.soquetes?.cores ?? []).slice(0, p?.soquetes?.abertos ?? 0); return [...String(resto[0] ?? '')].every((cor) => cores.includes(cor)); }
    default: return false;
  }
}

/**
 * (ciclo 7) O uso de uma habilidade POR TAG: o "recentemente" de cada tag (`usou:<tag>` — a condição `usouTag:<tag>`) e, por tag, a última
 * vez que cada gema foi usada (a escala `distintas:<tag>:<segundos>` — "por cada Habilidade de Retaliação diferente usada nos últimos N s").
 */
export function marcarUsoPorTag(hunt, tags, slug, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  const usos = (hunt.poeUsosPorTag ??= {});
  const recentes = (hunt.poeUsosRecentes ??= {});
  for (const t of tags ?? []) {
    if (t === 'habilidade') continue;
    marcar(hunt, `usou:${t}`, agora);
    if (slug) (usos[t] ??= {})[slug] = agora;
    // (lote E) a lista dos últimos usos de cada tag (a escala `usos:<tag>`), só os dos últimos 20 s
    const lista = (recentes[t] ??= []);
    lista.push(agora);
    while (lista.length && (lista[0] < agora - 20000 || lista.length > 60)) lista.shift();
  }
}
/** Quantas gemas DIFERENTES com a tag foram usadas nos últimos `segundos`. */
export function distintasRecentes(hunt, tag, segundos, agora = hunt?.clock ?? 0) {
  return Object.values(hunt?.poeUsosPorTag?.[tag] ?? {}).filter((t) => agora - t <= segundos * 1000).length;
}

/** Marca um acontecimento "recente" na caçada (`matou`, `critico`, `acertado`, `dano`, `moveu`, `lacaioMorreu`, `usouLacaio`). */
/**
 * (lote 34 — P023) Uma Mina sua DETONOU (`acoes`, a plantada que sai — acertando alguém ou não): "por cada Mina Detonada Recentemente" é a
 * escala `usos:minaDetonada[:4:<máximo>]` (a contagem dos últimos 4 s).
 */
export function marcarMinaDetonada(hunt, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  const lista = ((hunt.poeUsosRecentes ??= {}).minaDetonada ??= []);
  lista.push(agora);
  while (lista.length && (lista[0] < agora - 20000 || lista.length > 60)) lista.shift();
}
export function marcar(hunt, oque, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  (hunt.poeRecente ??= {})[oque] = agora;
}

/**
 * (13/10) A SOBRECARGA ELEMENTAL (keystone do PoE): "Habilidades que causaram um Golpe Crítico nos últimos 8 segundos causam 40% mais Dano
 * Elemental com Acertos e Afecções" — por HABILIDADE (o id da ação; o golpe básico é `golpe`): `marcarCriticoDaHabilidade` no acerto crítico
 * (`mods-poe.aoAcertar`, o da varinha), e `fatorDaSobrecarga` multiplica a parte de Fogo, Gelo e Raio do golpe dela. A ficha com a keystone
 * leva `sobrecargaElemental` (`passivas/keystones`), que também tira o dano extra do crítico e o "de crítico" das afecções.
 */
export const SOBRECARGA = Object.freeze({ janelaMs: 8000, maisPct: 40 });
export function marcarCriticoDaHabilidade(hunt, habilidade = 'golpe', agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  (hunt.poeCriticoPorHabilidade ??= {})[habilidade] = agora;
}
export function fatorDaSobrecarga(ficha, hunt, habilidade, elemento, agora = hunt?.clock ?? 0) {
  if (!ficha?.sobrecargaElemental || !['fire', 'ice', 'energy'].includes(elemento)) return 1;
  const q = hunt?.poeCriticoPorHabilidade?.[habilidade ?? 'golpe'];
  return q != null && agora - q <= SOBRECARGA.janelaMs ? 1 + SOBRECARGA.maisPct / 100 : 1;
}
/**
 * O "MAIS" do dano ELEMENTAL de um golpe na parte de Fogo, Gelo e Raio: a Sobrecarga Elemental (`fatorDaSobrecarga`) × (14/10) o "X% mais Dano
 * Elemental" (`mais_dano_elemental` — o Avatar da Selva: "100% mais Dano Elemental enquanto Liberto"). 1 no Físico e no Caos.
 */
export function fatorDoDanoElemental(ficha, hunt, habilidade, elemento, agora = hunt?.clock ?? 0) {
  if (!['fire', 'ice', 'energy'].includes(elemento)) return 1;
  // (+ lote 32: a Convergência, um "mais" de outra fonte — multiplica)
  return fatorDaSobrecarga(ficha, hunt, habilidade, elemento, agora) * Math.max(0, 1 + valor(ficha, 'mais_dano_elemental') / 100) * Math.max(0, 1 + valor(ficha, 'mais_dano_elemental_convergencia') / 100);
}

/**
 * (14/10) O WARDEN. A CASCA da Pele de Árvore ("Concede a Habilidade Pele de Árvore Nível 20" — a habilidade sai sozinha: o jogo usa as
 * habilidades sozinho; os números são os do nível 20, poedb): ganha 1 Casca por segundo se você não foi Acertado por um Ataque Recentemente,
 * perde 1 quando um Ataque inimigo acerta (e, com a Lição das Estações, quando Dano Mágico acerta — `perderCasca`), até 10. O AVATAR LIBERTO
 * ("Concede a Habilidade Avatar Liberto Nível 20"): 1 de Fúria Liberta por Afecção Elemental infligida com um Acerto (no máximo uma vez a
 * cada 0,2 s por tipo — `ganharFuriaLiberta`); com 100, a habilidade consome tudo e deixa Liberto por 10 s (`liberto`).
 */
export const CASCA = Object.freeze({ maximo: 10, ganhoMs: 1000, fisicoAtaquePorCasca: 60, evadirMaisPorCascaAbaixo: 4 });
export const FURIA_LIBERTA = Object.freeze({ maximo: 100, intervaloMs: 200, libertoS: 10 });
export function tiqueDoWarden(estado, hunt, afPoe, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  if (Number(afPoe?.pele_de_arvore) > 0) {
    const c = (hunt.casca ??= { n: 0, ultimo: agora });
    if (recente(hunt.poeRecente?.acertadoAtaque, agora) || c.n >= CASCA.maximo) c.ultimo = agora;
    else while (agora - c.ultimo >= CASCA.ganhoMs && c.n < CASCA.maximo) { c.n++; c.ultimo += CASCA.ganhoMs; }
  } else if (hunt.casca) delete hunt.casca;
  const f = hunt.furiaLiberta;
  if (Number(afPoe?.avatar_liberto) > 0 && (f?.n ?? 0) >= FURIA_LIBERTA.maximo && !buffAtivo(estado, 'liberto')) {
    f.n = 0;
    ganharBuff(hunt, 'liberto', FURIA_LIBERTA.libertoS, agora);
  }
}
/** Perde `n` Cascas (o Ataque inimigo que acertou: 1; o Dano Mágico, com a Lição das Estações). */
export function perderCasca(hunt, n = 1, agora = hunt?.clock ?? 0) {
  const c = hunt?.casca;
  if (!c || !(n > 0)) return;
  c.n = Math.max(0, c.n - n);
  c.ultimo = agora;
}
/** As Afecções Elementais pelo estado que o acerto pôs (`afeccoes.aoAcertar`). */
const AFECCAO_ELEMENTAL_DO_ESTADO = { queimando: 'incendio', congelado: 'congelamento', lento: 'resfriamento', eletrizado: 'eletrizacao', causticado: 'causticacao' };
/** A Fúria Liberta pelos estados que um acerto pôs (`postos`): 1 por tipo de Afecção Elemental, no máximo uma vez a cada 0,2 s por tipo. */
export function ganharFuriaLiberta(estado, hunt, afPoe, postos, agora = hunt?.clock ?? 0) {
  const por = Number(afPoe?.furia_liberta_por_afeccao) || 0;
  if (!(por > 0) || !hunt || !ligado() || !postos?.length) return;
  if (Number(afPoe.furia_liberta_nao_liberto) > 0 && buffAtivo(estado, 'liberto')) return;
  const f = (hunt.furiaLiberta ??= { n: 0, ultimo: {} });
  for (const tipo of new Set(postos.map((p) => AFECCAO_ELEMENTAL_DO_ESTADO[p]).filter(Boolean))) {
    if (agora - (f.ultimo[tipo] ?? -Infinity) < FURIA_LIBERTA.intervaloMs) continue;
    f.ultimo[tipo] = agora;
    f.n = Math.min(FURIA_LIBERTA.maximo, f.n + por);
  }
}
/**
 * (14/10) O GUARDIAN. A CHAMA SANTIFICADA (o Marechal da Divindade: "Inflige Chama Santificada ao atingir corpo a corpo" — o lembrete do PoE:
 * "Ataques contra inimigos afetados por Chama Santificada ganham 25% do dano físico como dano de fogo adicional. Chama Santificada é removida após
 * um ataque que se beneficia desse dano adicional. Dura seis segundos e não beneficia quem a infligiu"): no bicho, `estados.chamas` — uma por
 * quem pôs (`hunt.idChama`), até 1 + "+N Chamas". O ATAQUE de um ALIADO (o companheiro da party; o lacaio, até o seu) leva o Fogo extra de
 * todas as que não são dele e as tira; cada uma conta para quem a pôs ("removidas por um ataque aliado recentemente": Raio extra).
 */
export const CHAMA_SANTIFICADA = Object.freeze({ duracaoMs: 6000, fogoPct: 25, recenteMs: 4000 });
/** O id de quem põe a Chama (o da caçada: dura o tempo da Chama). */
export const idDaChama = (hunt) => (hunt ? (hunt.idChama ??= `c${Math.random().toString(36).slice(2, 10)}`) : null);
export function porChamaSantificada(hunt, alvo, afPoe, agora = hunt?.clock ?? 0, { doClamor = false } = {}) {
  // (lote 72, a Palavra Sagrada: "Seus clamores infligem Chama Santificada" — `doClamor`, o Clamor de quem tem a linha: `acoes`)
  if (!ligado() || !hunt || !alvo || !(doClamor || Number(afPoe?.chama_santificada_corpo) > 0)) return false;
  const dono = idDaChama(hunt);
  const e = (alvo.estados ??= {});
  const vivas = (e.chamas ?? []).filter((c) => c.ate > agora);
  const minhas = vivas.filter((c) => c.dono === dono);
  const ate = agora + CHAMA_SANTIFICADA.duracaoMs;
  if (minhas.length >= 1 + (Number(afPoe.chama_santificada_extra) || 0)) minhas.sort((a, b) => a.ate - b.ate)[0].ate = ate;
  else vivas.push({ dono, ate, pct: CHAMA_SANTIFICADA.fogoPct * Math.max(0, 1 + (Number(afPoe.chama_santificada_efeito) || 0) / 100) });
  e.chamas = vivas;
  return true;
}
/**
 * O ATAQUE de `quem` (o id da caçada de quem ataca; o lacaio: `lacaio:<id do dono>`) no bicho: o % do Físico como Fogo extra das Chamas que não
 * são dele — que saem; cada uma é "removida por um ataque aliado" para quem a pôs (os da sala: `estado` e a party — `hunt.poeChamasRemovidas`).
 */
export function consumirChamas(estado, alvo, quem, agora = estado?.hunt?.clock ?? 0) {
  const e = alvo?.estados;
  if (!ligado() || !e?.chamas?.length) return 0;
  let pct = 0;
  const ficam = [];
  for (const c of e.chamas) {
    if (!(c.ate > agora)) continue;
    if (c.dono === quem) { ficam.push(c); continue; }
    pct += c.pct;
    const dono = [estado, ...(estado?.hunt?.partilha?.naSala ?? [])].find((o) => o?.hunt?.idChama === c.dono);
    if (dono) { (dono.hunt.poeChamasRemovidas ??= []).push(agora); dono.hunt.poeFichaMudou = true; }
  }
  e.chamas = ficam;
  return pct;
}
/**
 * A RELÍQUIA ELEMENTAL (a Cruzada Implacável: "25% de chance de Ativar Convocar Relíquia Elemental Nível 20 quando você ou um Aliado próximo
 * Matar um Inimigo, ou Acertar um Inimigo Raro ou Único"): a ocasião fica pendente na caçada de cada um perto (`notarParaReliquia`) e quem tem o
 * nó sorteia no tique dele (`acoes.tiqueDoGuardian`).
 */
export const RELIQUIA = Object.freeze({ duracaoMs: 5000, recargaMs: 300, raioAliado: 3 });
export function notarParaReliquia(estado, hunt, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return;
  hunt.poeReliquiaPendente = (hunt.poeReliquiaPendente ?? 0) + 1;
  for (const o of hunt.partilha?.naSala ?? []) {
    if (!o || o === estado || !o.hunt?.pos || !hunt.pos || (o.hunt.z ?? 0) !== (hunt.z ?? 0)) continue;
    if (Math.max(Math.abs(o.hunt.pos.x - hunt.pos.x), Math.abs(o.hunt.pos.y - hunt.pos.y)) <= RELIQUIA.raioAliado) o.hunt.poeReliquiaPendente = (o.hunt.poeReliquiaPendente ?? 0) + 1;
  }
}
/**
 * (14/10) As ÉGIDES do PoE (o lembrete: "Égide toma o dano elemental dos acertos por você até se esgotar; volta ao valor cheio depois de um
 * tempo sem dano elemental de acertos, ou se esgotar"): `hunt.egides[nome] = { tipos, valor, max, ultimoDano }` — o máximo e a volta ao valor
 * cheio no tique (`acoes.tiqueDasEgides`, que sabe as peças e a árvore). Aqui, a parte de cada tipo do acerto sai da Égide dele ANTES do Escudo
 * e da Vida (o golpe do monstro e a magia dele). Devolve o total absorvido; `porTipo` sai com o que sobrou.
 */
// (lote 44, P072: a Égide Primitiva volta em 5 s — o `aegis_recharge_delay_ms` dela no PoB e no poedb, 5000; as dos únicos, 10000)
export const EGIDE = Object.freeze({ recargaMs: 10000, recargaPrimitivaMs: 5000, ordem: ['fisica', 'fogo', 'gelo', 'raio', 'elemental', 'primitiva'] });
export function absorverNaEgide(hunt, porTipo, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt?.egides) return 0;
  let total = 0;
  for (const nome of EGIDE.ordem) {
    const e = hunt.egides[nome];
    if (!e) continue;
    for (const el of e.tipos) {
      const v = porTipo[el] ?? 0;
      if (!(v > 0)) continue;
      // (o dano do tipo dela reinicia a espera, esgotada ou não)
      e.ultimoDano = agora;
      const tirado = Math.min(v, e.valor);
      if (!(tirado > 0)) continue;
      e.valor -= tirado;
      porTipo[el] = v - tirado;
      total += tirado;
      if (!(e.valor > 0)) hunt.poeFichaMudou = true;
    }
  }
  return total;
}

/**
 * (lote 42, P074 — dono, 16/10: "Fazer todos") A CANALIZAÇÃO CONTÍNUA: a habilidade de Canalização usada de novo em seguida — a mesma, sem outra
 * no meio — continua o MESMO canalizar (`hunt.canalizacao = { acao, desde, ate, magia }`, do `disparar`: o `ate` é o fim do uso de agora);
 * outra habilidade interrompe, como no PoE. É o "enquanto canaliza" das linhas e da Infusão Espiritual.
 */
export const canalizandoAgora = (h, agora = h?.clock ?? 0, { magia = false } = {}) => !!h?.canalizacao && agora <= h.canalizacao.ate && (!magia || !!h.canalizacao.magia);
/**
 * (14/10) A INFUSÃO ESPIRITUAL do PoE (o Rito Profano do Occultist: "Ganha Infusão Espiritual a cada 0,5 segundos enquanto canaliza uma
 * magia" — o poedb: cada acúmulo dá 15% de início mais rápido da Recarga do Escudo de Energia, Magias Canalizadas 5% mais Dano e 10% mais
 * Custo; máximo 10; perde um a cada 0,5 s se não ganhou nos últimos 4 s). (lote 42: pelo canalizar contínuo — um acúmulo a cada 0,5 s
 * canalizando a magia, desde o começo do canalizar; antes, usar uma Magia de Canalização contava como canalizar por 1 s.)
 */
export const INFUSAO = Object.freeze({ maximo: 10, ganhoMs: 500, perdaMs: 500, semGanhoMs: 4000, canalizandoMs: 1000, esInicioPct: 15, maisDanoPct: 5, maisCustoPct: 10 });
export function tiqueDaInfusao(hunt, afPoe, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return;
  const i = hunt.infusaoEspiritual;
  if (Number(afPoe?.infusao_espiritual) > 0 && canalizandoAgora(hunt, agora, { magia: true })) {
    const x = (hunt.infusaoEspiritual ??= { n: 0, ultimoGanho: -Infinity });
    if (agora - Math.max(hunt.canalizacao.desde, x.ultimoGanho) >= INFUSAO.ganhoMs) {
      x.ultimoGanho = agora;
      if (x.n < INFUSAO.maximo) { x.n++; hunt.poeFichaMudou = true; }
    }
    return;
  }
  if (!i?.n) return;
  if (agora - i.ultimoGanho > INFUSAO.semGanhoMs && agora - (i.ultimaPerda ?? -Infinity) >= INFUSAO.perdaMs) {
    i.n--;
    i.ultimaPerda = agora;
    hunt.poeFichaMudou = true;
    if (!i.n) delete hunt.infusaoEspiritual;
  }
}

/**
 * (14/10) Os cartões do HUD do que o PoE dá por nome: os buffs com tempo (os altares, a Adrenalina, o Liberto…), a Casca e a Fúria Liberta.
 * `contador`: o número no cartão no lugar do relógio. (16/10) `efeito`: o efeito do Elusivo agora, em %, no lugar do relógio.
 */
export function buffsDoCliente(estado) {
  const h = estado?.hunt;
  if (!h || !ligado()) return [];
  const agora = h.clock ?? 0;
  const saida = [];
  for (const [nome, ate] of Object.entries(h.poeBuffs ?? {})) {
    if (!(ate > agora) || !BUFFS[nome]) continue;
    const cartao = { icone: null, nome: BUFFS[nome].nome, resta: ate - agora, tipo: 'buffPoe', buff: nome };
    // (16/10) O Elusivo perde 20 pontos de efeito por segundo (`efeitoDoElusivo`, lote 33): o cartão mostra o efeito de agora, e o balão explica.
    if (nome === 'elusivo' && h.poeElusivo) {
      cartao.efeito = Math.round(efeitoDoElusivo(h, agora));
      cartao.dica = `Elusivo: ${cartao.efeito}% de efeito, ${Math.ceil(cartao.resta / 1000)}s restantes (perde ${ELUSIVO.perdaPorSegundo} pontos por segundo e sai em 0%; com ele ativo, não se ganha outro)`;
    }
    saida.push(cartao);
  }
  if (h.casca) saida.push({ icone: null, nome: 'Casca', resta: 0, tipo: 'casca', contador: h.casca.n, dica: `Casca: ${h.casca.n} de ${CASCA.maximo} (a Pele de Árvore — ganha 1 por segundo sem ser Acertado por um Ataque Recentemente)` });
  // (14/10) as Égides (o valor que ainda toma) e a Infusão Espiritual
  const NOME_DA_EGIDE = { primitiva: 'Égide Primitiva', fogo: 'Égide de Fogo', gelo: 'Égide de Gelo', raio: 'Égide Relampejante', elemental: 'Égide Elemental', fisica: 'Égide Física' };
  for (const [nome, e] of Object.entries(h.egides ?? {})) saida.push({ icone: null, nome: NOME_DA_EGIDE[nome] ?? nome, resta: 0, tipo: 'egide', contador: Math.round(e.valor), dica: `${NOME_DA_EGIDE[nome] ?? nome}: ${Math.round(e.valor)} de ${Math.round(e.max)} (toma o dano ${({ fisica: 'Físico', fogo: 'de Fogo', gelo: 'de Gelo', raio: 'de Raio' })[nome] ?? 'de Fogo, Gelo e Raio'} dos acertos antes do Escudo e da Vida; volta cheia 10 s depois do último dano)` });
  if (h.infusaoEspiritual?.n > 0) saida.push({ icone: null, nome: 'Infusão Espiritual', resta: 0, tipo: 'infusaoEspiritual', contador: h.infusaoEspiritual.n, dica: `Infusão Espiritual: ${h.infusaoEspiritual.n} de ${INFUSAO.maximo} (por acúmulo: 15% de início mais rápido da Recarga do Escudo, Magias Canalizadas 5% mais Dano e 10% mais Custo)` });
  // (14/10) o Infestador: Incubando ou Infestando, com o Valor da Praga
  if (h.praga) saida.push({ icone: null, nome: h.praga.modo === 'infestando' ? 'Infestando' : 'Incubando', resta: 0, tipo: 'praga', contador: Math.round(h.praga.valor), dica: `Valor da Praga: ${Math.round(h.praga.valor)} de ${Math.round(h.praga.max ?? 0)} (o Infestador — ${h.praga.modo === 'infestando' ? 'Infestando: Caos nos inimigos a até 2 casas até o Valor acabar' : 'Incubando: 40% do dano de cada Veneno seu; no máximo, Infesta sozinho'})` });
  // (revisão do A2: a Fúria de agora no HUD — a condição "Fúria ≥ N" do slot, o Berserk)
  const furia = furiaAtual(estado);
  if (furia > 0) saida.push({ icone: null, nome: 'Fúria', resta: 0, tipo: 'furia', contador: furia, dica: `Fúria: ${furia} de ${maximoDeFuria(fichaDa(h)?.afPoe)} (1% mais Dano de Ataque por ponto; perde ${FURIA.perdaPorS} por segundo depois de ${FURIA.esperaMs / 1000} s sem ganhar Fúria nem ser Acertado)` });
  if (h.furiaLiberta?.n > 0) saida.push({ icone: null, nome: 'Fúria Liberta', resta: 0, tipo: 'furiaLiberta', contador: h.furiaLiberta.n, dica: `Fúria Liberta: ${h.furiaLiberta.n} de ${FURIA_LIBERTA.maximo} (com ${FURIA_LIBERTA.maximo}, o Avatar Liberto deixa Liberto por ${FURIA_LIBERTA.libertoS} s)` });
  return saida;
}

// ---------------------------------------------------------------- a soma

/**
 * Resolve os atributos condicionais de ESTADO na soma (`total`, mexe nele): `atk_speed@comEscudo` com escudo entra em `atk_speed`.
 * Os que têm alguma tag de GOLPE ficam (o `fichaDoGolpe` resolve em cada acerto). Devolve `total`.
 */
export function resolver(estado, total, principais = null) {
  if (!ligado() || !total) return total;
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    // (Os EVENTOS — `ev:…@cond`, `ev:…%escala` — ficam: a condição e a escala valem na hora do evento — `mods-poe.evento`. Resolvidos aqui
    // também, o "ao Matar enquanto não estiver com Mana Baixa" saía duas vezes: a chave resolvida, sem condição, e a condicional.)
    if (!ehCondicional(k) || typeof v !== 'number' || String(k).startsWith('ev:')) continue;
    const { stat, escala, conds: c, teto } = partir(k);
    if (c.some((x) => !ehCondDeEstado(x))) continue;
    // A escala que depende da FICHA (precisão, armadura, evasão, escudo, bloqueio): a segunda passada da ficha (`escalasDaFicha`).
    if (escala && ESCALAS_DA_FICHA.test(escala)) continue;
    conds ??= condicoesDe(estado, total, principais);
    if (!c.every((x) => vale(conds, x))) continue;
    const m = escala ? fatorDaEscala(estado, total, principais, escala) : 1;
    if (m) total[stat] = (total[stat] ?? 0) + comTeto(v, m, teto);
  }
  return total;
}

/** As escalas que só a ficha sabe (a segunda passada). */
export const ESCALAS_DA_FICHA = /^(precisao|armadura|evasao|esMax|bloqueio|bloqueioMagico|armaduraEscudo|evasaoEscudo|esEscudo|armEvaEscudo|bloqueioEscudo|resFogo|resGelo|resRaio|resCaos|evasaoPeitoral|esElmo|resFogoExcedente|resGeloExcedente|resRaioExcedente):/;

/**
 * O fator de uma ESCALA ("por X"): `nivel`, `atr:dex:10` (a cada 10 de Destreza), `carga:frenesi`, `cargaMax:poder`, `furia`, `furia:5`,
 * `vidaMax:N`, `manaMax:N`, `encaixe:R` (sockets vermelhos no equipamento), `encaixeVazio:G`, `itemCorrompido`, `itemNaoCorrompido`,
 * `itemUnico`, `lacaio` (vivos), `lacaio:zumbi`, `venenoEmVoce`, `afeccaoEmVoce`, `atributoMenor:N`, `atributos:N`, `mana:N`.
 */
/** Os segundos inteiros parado (sem trocar de casa há mais de `MOVENDO_MS`; desde que entrou, se ainda não andou). */
const segundosParado = (h, agora) => { const r = h?.poeRecente ?? {}; return r.moveu != null && agora - r.moveu <= MOVENDO_MS ? 0 : Math.floor((agora - (r.moveu ?? h?.poeEntrou ?? agora)) / 1000); };
/** (lote 80) O teto das Vinhas Constringentes (o PoB). */
const VINHAS_MAXIMO = 10;
export function fatorDaEscala(estado, total, principais, escala) {
  const [tipo, a, b] = escala.split(':');
  const h = estado?.hunt;
  const agora = h?.clock ?? 0;
  const cada = (valor, n) => Math.floor(Math.max(0, valor) / Math.max(1, Number(n) || 1));
  const eq = Object.entries(estado?.equipment ?? {}).filter(([slot, p]) => p && slot !== 'backpack');
  switch (tipo) {
    case 'nivel': return a ? cada(estado?.level ?? 1, a) : estado?.level ?? 1;
    case 'atr': return cada(principais?.[a] ?? 0, b);
    case 'atributoMenor': return cada(Math.min(principais?.str ?? 0, principais?.dex ?? 0, principais?.int ?? 0), a);
    case 'atributos': return cada((principais?.str ?? 0) + (principais?.dex ?? 0) + (principais?.int ?? 0), a);
    case 'carga': { const x = h?.cargasPoe?.[a]; return x && x.ate > agora ? x.n | 0 : 0; }
    case 'cargaMax': return maximoDeCargas(total, a);
    case 'furia': return a ? cada(h?.furia?.n ?? 0, a) : h?.furia?.n ?? 0;
    // (a keystone Fúria — o Rampage do PoE: "a cada N Mortes de Fúria" — o contador de abates seguidos, `contarRampage`)
    case 'rampage': { const r = h?.rampage; const n = r && r.ate > agora ? r.n : 0; return a ? cada(n, a) : n; }
    // ("por cada Inimigo Eletrizado que você Matou Recentemente": os abates de eletrizados nos últimos 4 s — `hunt/combate`)
    case 'eletrizadosMortosRecente': return (h?.poeEletrizadosMortos ?? []).filter((t) => agora - t <= RECENTE_MS).length;
    case 'vidaMax': return cada(estado?.maxHp ?? 0, a);
    case 'manaMax': return cada(estado?.maxMana ?? 0, a);
    case 'encaixe': return eq.reduce((n, [, p]) => n + (p.soquetes?.cores ?? []).slice(0, p.soquetes?.abertos ?? 0).filter((c) => c === a).length, 0);
    case 'encaixeVazio': return eq.reduce((n, [, p]) => n + (p.soquetes?.cores ?? []).slice(0, p.soquetes?.abertos ?? 0).filter((c, i) => c === a && !p.soquetes?.gemas?.[i]).length, 0);
    case 'itemCorrompido': return eq.filter(([, p]) => p.poe?.corrompido).length;
    case 'itemNaoCorrompido': return eq.filter(([, p]) => !p.poe?.corrompido).length;
    case 'itemUnico': return eq.filter(([, p]) => p.poe?.raridade === 'unico').length;
    // (lote 28) "por Joia Abissal afetando você" / "por Joia do Olho Assassino afetando você": `joiasAbissais`, `joiasAbissais:Murderous_Eye_Jewel`.
    case 'joiasAbissais': return joiasAbissaisAfetando(estado).filter((j) => daBaseAbissal(j, a)).length;
    // (lote 49) "por Espectro Grandioso" (cada um conta os Espectros Grandiosos encaixados na árvore — o PoE: "per Grand Spectrum"):
    // `joiaUnica:Grand_Spectrum`; "para cada Item Mágico equipado" (o Potencial Oculto): `itemMagico`.
    case 'joiaUnica': return joiasDaArvore(estado).filter((j) => j?.poe?.raridade === 'unico' && j.poe.unico === a).length;
    // (lote 58, a Fé Militante) "por cada 10 de Devoção": `devocao:10` — a Devoção total da ficha (as passivas conquistadas pelos Templários)
    case 'devocao': return cada(Number(total?.devocao) || 0, a);
    case 'itemMagico': return eq.filter(([, p]) => p.poe?.raridade === 'magico').length;
    // (lote 50, o Auto-Flagelo) "por Maldição em Você": as dos monstros, as refletidas e as do mapa, ativas
    case 'maldicoesEmVoce': return Object.values(h?.maldicoesNoJogador ?? {}).filter((x) => x && x.ate > agora).length + maldicoesDoMapa(estado).length;
    // (+ ciclo 7: o teto — `lacaio::10`, "por Lacaio, até 10%")
    case 'lacaio': { const n = (h?.lacaios ?? []).filter((l) => l.hp > 0 && (!a || new RegExp(a, 'i').test(l.nome ?? ''))).length; return b ? Math.min(Number(b) || n, n) : n; }
    case 'venenoEmVoce': return Math.min(Number(b) || Infinity, (h?.efeitosDoJogador?.dots ?? []).filter((d) => /veneno/i.test(d.tipo) && d.falta > 0).length);
    case 'afeccaoEmVoce': return new Set((h?.efeitosDoJogador?.dots ?? []).filter((d) => d.falta > 0).map((d) => d.tipo)).size + ['congelado', 'lento', 'atordoado'].filter((k) => h?.controle?.[k]?.ate > agora).length;
    case 'mana': return cada(estado?.maxMana ?? 0, a);
    // (09/10) "para cada Adaga que estiver Portando": as armas empunhadas daquela classe (a da mão principal e a da outra mão).
    case 'armas': return ['weapon', 'shield'].filter((s) => COND_DA_CLASSE[classeDe(estado?.equipment?.[s])] === a).length;
    // (09/10) "para cada uma das suas Habilidades de Aura ou Arauto afetando você": as auras e arautos ligados.
    case 'aurasAtivas': return Object.values(h?.buffs ?? {}).filter((b) => b && b.ate > agora && /^poe-(aura|arauto)$/.test(b.tipo ?? '')).length;
    // "por cada Arauto afetando você": só os arautos ligados.
    case 'arautosAtivos': return Object.values(h?.buffs ?? {}).filter((b) => b && b.ate > agora && b.tipo === 'poe-arauto').length;
    // (09/10) "por Inimigo em Curto Alcance" (a até 2 casas), "por Inimigo próximo" (a até 4).
    case 'inimigosPerto': { const r = Number(a) || 2; const p = h?.pos; return p ? (h.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= r).length : 0; }
    case 'matouRecente': return Math.min(Number(b) || Infinity, (h?.poeMortesRecentes ?? []).filter((t) => agora - t <= RECENTE_MS).length);
    // (ciclo 7) "por cada Habilidade de <tag> diferente que você tenha usado nos últimos N segundos": `distintas:<tag>:<N>`.
    case 'distintas': return distintasRecentes(h, a, Number(b) || 4, agora);
    // (lote D) "por Fortificação"; "para cada Fortificação acima de 20": `fortificacaoAcima:20`.
    case 'fortificacao': return a ? cada(fortificacao(estado, total), a) : fortificacao(estado, total);
    case 'fortificacaoAcima': return Math.max(0, fortificacao(estado, total) - (Number(a) || 0));
    // (lote E) "por cada Magia Não Instantânea que você tenha Conjurado Recentemente": `usos:magia[:<segundos>[:<máximo>]]` (`marcarUsoPorTag`).
    case 'usos': { const [, , s, max] = escala.split(':'); const desde = agora - (Number(s) || RECENTE_MS / 1000) * 1000; const n = (h?.poeUsosRecentes?.[a] ?? []).filter((t) => t > desde).length; return max ? Math.min(Number(max), n) : n; }
    // (lote F) "por ponto em Força ou Inteligência, o que for menor": `menorEntre:str:int`; "por segundo que você tenha ficado parado": `paradoS`.
    case 'menorEntre': return Math.min(principais?.[a] ?? 0, principais?.[b] ?? 0);
    // (lote H) "Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos": `stat:projectile_speed` (o atributo da soma).
    case 'stat': return Number(total?.[a]) || 0;
    // (lote G) "por cada Valor": o Valor agora.
    case 'valor': return valorAtual(h);
    // (11/10, o Deadeye) "por Força dos Ventos" (até 10, cada uma por 4 s — `ganharForcaDosVentos`).
    case 'forcaDosVentos': return h?.forcaDosVentos?.ate > agora ? h.forcaDosVentos.n : 0;
    // (11/10) "por cada Valor consumido por tal Estandarte": o do Estandarte plantado.
    case 'valorDoEstandarte': return estandartePlantado(h, agora)?.estandarte?.valor ?? 0;
    // "para cada segundo que você for afetado por um Buff de Clamor": `desdeUsou:clamor` (os segundos desde o último uso, nos últimos 20 s).
    case 'desdeUsou': { const t = h?.poeRecente?.[`usou:${a}`]; return t != null && agora - t <= 20000 ? Math.floor((agora - t) / 1000) : 0; }
    // (lote 32, P042) "para cada segundo que você for afetado por um Buff de Clamor": os segundos SEGUIDOS sob algum (`acoes` grava o começo,
    // `hunt.poeSobClamorDesde`, quando o Clamor sai sem nenhum outro ativo); sem buff de Clamor em você, 0.
    case 'afetadoPorClamor': { const d = h?.poeSobClamorDesde; return d != null && sobBuffDeClamor(h, agora) ? Math.floor((agora - d) / 1000) : 0; }
    case 'paradoS': return segundosParado(h, agora);
    // (lote 80, a Paciência da Natureza) "por Vinha Constringente": 2 por segundo parado ("Ganha 2 Vinhas Constringentes a cada segundo enquanto
    // parado" — `vinhas_constringentes_por_s`), até 10 — o PoB (`Multiplier:GraspingVinesCount`, limitTotal 10); ao andar, voltam a 0
    case 'vinhas': return Math.min(VINHAS_MAXIMO, (Number(total?.vinhas_constringentes_por_s) || 0) * segundosParado(h, agora));
    // (lote F) "por Habilidade Passiva de Maestria Alocada" (`maestrias`) e "para cada tipo diferente de Maestria Alocada" (`tiposDeMaestria`).
    case 'maestrias': return leitorDeMaestrias?.(estado, null) ?? 0;
    case 'tiposDeMaestria': return leitorDeMaestrias?.(estado, '*') ?? 0;
    // "por cada 5% de Escudo de Energia faltando": `esFaltando:5`.
    case 'esFaltando': { const max = estado?.maxEsPoe ?? 0; return max > 0 ? cada((100 * (max - Math.min(max, estado.es ?? 0))) / max, a) : 0; }
    // (11/10) "por cada N de Vida / Mana Reservada": o que as auras ligadas (e a "Reserva X% da Vida" das peças) trancam agora.
    case 'vidaReservada': return cada(reservadoAgora(estado, 'vida', total), a);
    // ("por cada N de Vida Máxima ou Mana Máxima, o que for menor")
    case 'vidaOuManaMenor': return cada(Math.min(estado?.maxHp ?? 0, estado?.maxMana ?? 0), a);
    // ("por Inimigo Envenenado": os bichos envenenados vivos na presença.)
    case 'inimigosEnvenenados': { const p = h?.pos; return p ? (h.monstros ?? []).filter((m) => m.hp > 0 && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= RAIO_DA_PRESENCA && (m.dots ?? []).some((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0)).length : 0; }
    // ("por cada N de Mana total que você tenha Gasto Recentemente": a mana gasta nos últimos 4 s.)
    case 'manaGastaRecente': return cada((h?.poeManaGasta ?? []).filter((x) => agora - x.t <= RECENTE_MS).reduce((n, x) => n + x.n, 0), a);
    // ("por cada Magia Não Instantânea que você tenha Conjurado Recentemente": as magias dos últimos 4 s.)
    case 'magiasRecentes': return (h?.poeMagiasRecentes ?? []).filter((t) => agora - t <= RECENTE_MS).length;
    // ("Para cada cadáver próximo": os mortos da caçada que ficaram no chão — `hunt.cadaveres` — a até N casas, 4 sem número; `cadaveresPerto::10`,
    // com teto.)
    case 'cadaveresPerto': { const r = Number(a) || 4; const p = h?.pos; const n = p ? (h.cadaveres ?? []).filter((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= r).length : 0; return b ? Math.min(Number(b), n) : n; }
    case 'manaReservada': return cada(reservadoAgora(estado, 'mana', total), a);
    // (13/10) "por cada N de Mana Máxima Não Reservada" (o Santuário do Pensamento): a máxima menos a reservada.
    case 'manaNaoReservada': return cada(Math.max(0, (estado?.maxMana ?? 0) - reservadoAgora(estado, 'mana', total)), a);
    default: return 0;
  }
}

/** A segunda passada da ficha: as escalas que dependem dela (precisão, armadura, evasão, escudo, bloqueio). `{ stat: valor }` a somar. */
export function escalasDaFicha(estado, total, ficha) {
  if (!ligado() || !total || !ficha) return null;
  const saida = {};
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (typeof v !== 'number' || !String(k).includes('%')) continue;
    const { stat, escala, conds: c, teto } = partir(k);
    // (As tags de GOLPE ficam na chave — "Dano de Ataque … por 10 de Armadura no Escudo": `dmg_inc@ataque`, o `fichaDoGolpe` resolve.)
    if (!escala || !ESCALAS_DA_FICHA.test(escala) || c.some((x) => !ehCondDeEstado(x) && !TAGS_DE_GOLPE.has(x))) continue;
    conds ??= condicoesDe(estado, total);
    if (!c.filter(ehCondDeEstado).every((x) => vale(conds, x))) continue;
    const golpe = c.filter((x) => !ehCondDeEstado(x));
    // (o teto `~N` já sai no `partir`)
    const [tipo, n] = escala.split(':');
    // (+ a RESISTÊNCIA total de um elemento — "para cada 1% de Resistência a Fogo Total": `resFogo:1`; e a defesa e o bloqueio da peça
    // do ESCUDO — "por 10 de Armadura ou Evasão no Escudo": `armEvaEscudo:10`.)
    const escudo = estado?.equipment?.shield;
    const de = defesaDaPecaVestida(escudo) ?? { armadura: 0, evasao: 0, escudo: 0 };
    const base = {
      precisao: ficha.accuracy, armadura: ficha.armor, evasao: ficha.evasion, esMax: ficha.energyShield, bloqueio: (ficha.blockChance ?? 0) * 100, bloqueioMagico: (ficha.bloqueioDeMagia ?? 0) * 100,
      resFogo: ficha.protection?.fire, resGelo: ficha.protection?.ice, resRaio: ficha.protection?.energy, resCaos: ficha.protection?.chaos,
      armaduraEscudo: de.armadura, evasaoEscudo: de.evasao, esEscudo: de.escudo, armEvaEscudo: de.armadura + de.evasao,
      bloqueioEscudo: Number(escudo?.poe?.af?.block) || 0,
      // (lote F) "por N de Evasão no Peitoral equipado", "por N de Escudo de Energia Máximo no Elmo Equipado".
      evasaoPeitoral: (defesaDaPecaVestida(estado?.equipment?.body) ?? {}).evasao ?? 0, esElmo: (defesaDaPecaVestida(estado?.equipment?.head) ?? {}).escudo ?? 0,
      // (a resistência EXCEDENTE — acima do máximo: "Armadura é aumentada pela Resistência a Fogo Excedente"; "por X% de resistência a dano de gelo excedente")
      resFogoExcedente: ficha.excedentes?.protection?.fire ?? 0, resGeloExcedente: ficha.excedentes?.protection?.ice ?? 0, resRaioExcedente: ficha.excedentes?.protection?.energy ?? 0,
    }[tipo] ?? 0;
    const m = Math.floor(Math.max(0, base) / Math.max(1, Number(n) || 1));
    const chave = golpe.length ? `${stat}@${golpe.join('+')}` : stat;
    if (m) saida[chave] = (saida[chave] ?? 0) + comTeto(v, m, teto);
  }
  return Object.keys(saida).length ? saida : null;
}

// ---------------------------------------------------------------- os BUFFS nomeados do PoE

/**
 * Os buffs com nome do PoE (os números são os do lembrete do próprio catálogo): enquanto ativos, somam estes atributos (`adds`).
 * Ganha-se por evento (`ev:<evento>:buff:<nome>` = segundos — `mods-poe.evento`) ou sempre (`sempre:<nome>@cond`).
 */
export const BUFFS = {
  agressividade: { nome: 'Agressividade', af: { atk_speed: 20, cast_speed: 20, move_speed: 20 } },
  adrenalina: { nome: 'Adrenalina', af: { dmg_inc: 100, atk_speed: 25, cast_speed: 25, move_speed: 25, phys_res: 10 } },
  poderProfano: { nome: 'Poder Profano', af: { phys_as_extra_chaos: 100 } },
  // ("Ganha Imunidade a Dano Físico durante N segundos quando Enfurecido": o físico recebido vai a zero — `fatorDoDanoRecebido`.)
  imunidadeFisica: { nome: 'Imunidade a Dano Físico', af: { dano_physical_recebido_inc: -1000 } },
  poderCaotico: { nome: 'Poder Caótico', af: { phys_as_extra_chaos: 30 } },
  furiaArcana: { nome: 'Fúria Arcana', af: { cast_speed: 10, mana_regen_pct: 30, spell_dmg: 10 } },
  // (lote 71) o lembrete do catálogo: "aumenta as Cargas de Frasco recebidas em 20% e efeito de Frascos em 10%"
  genioAlquimico: { nome: 'Gênio Alquímico', af: { frasco_cargas_recebidas: 20, frasco_efeito: 10 } },
  elusivo: { nome: 'Elusivo', af: { avoid_damage: 15, move_speed: 30 } },
  trespassar: { nome: 'Trespassar', af: {} },
  divindade: { nome: 'Divindade', af: { fire_dmg: 50, ice_dmg: 50, energy_dmg: 50, dmg_reduction: 10 } },
  furtividadeFelina: { nome: 'Furtividade Felina', af: { crit_chance_inc: 50 } },
  agilidadeDoGato: { nome: 'Agilidade do Gato', af: { avoid_damage: 10, move_speed: 10 } },
  vooDaAve: { nome: 'Vôo da Ave', af: { move_speed: 20 } },
  poderDaAve: { nome: 'Poder da Ave', af: { atk_speed: 10, cast_speed: 10 } },
  // (13/10: igual à keystone — "50% de Dano Físico, Gelo e Raio Convertidos para Dano de Fogo", "Não causa Dano que não seja de Fogo")
  avatarDoFogo: { nome: 'Avatar do Fogo', af: { phys_conv_fire: 50, conv_ice_fire: 50, conv_energy_fire: 50, 'so_dano:fire': 1 } },
  sobrecargaElemental: { nome: 'Sobrecarga Elemental', af: { fire_dmg: 40, ice_dmg: 40, energy_dmg: 40 } },
  // (a keystone: os acertos não erram e nunca são críticos)
  tecnicaResoluta: { nome: 'Técnica Resoluta', af: { nunca_erra: 1, nunca_critico: 1 } },
  juramentoDoZelote: { nome: 'Juramento do Zelote', af: {} },
  // (a keystone do PoE: o dreno de vida corpo a corpo é instantâneo e a vida só se recupera pelo dreno — `Ficha.aplicarLeech`, `vidaSoPeloDreno`)
  pactoVaal: { nome: 'Pacto Vaal', af: { roubo_vida_instantaneo_corpo: 1, sem_recuperar_vida_fora_dreno: 1 } },
  // (a keystone do PoE: o multiplicador degenerativo das afecções é o de crítico, o crítico não dá dano extra, sem crítico não há afecção)
  agoniaPerfeita: { nome: 'Agonia Perfeita', af: { agonia_perfeita: 1, sem_afeccao_sem_critico: 1, critico_sem_dano_extra: 1 } },
  presencaEnlouquecedora: { nome: 'Presença Enlouquecedora', af: { dmg_inc: 10 } },
  presencaDoCriador: { nome: 'Presença do Criador', af: { dmg_inc: 10 } },
  fervorSacrificial: { nome: 'Fervor Sacrificial', af: {} },
  vossoAbraco: { nome: 'Vosso Abraço', af: { fire_dmg: 50, dmg_inc: 25 } },
  intangivel: { nome: 'Intangibilidade', af: {} },
  devoradorDeAlmas: { nome: 'Devorador de Almas', af: { atk_speed: 10, cast_speed: 10 } },
  ultimoSuspiro: { nome: 'Último Suspiro', af: {} },
  danCaCarmesim: { nome: 'Dança Carmesim', af: {} },
  confluxo: { nome: 'Confluxo Elemental', af: { chance_ignite: 100, chance_freeze: 100, chance_shock: 100 } },
  altarMenor: { nome: 'Altar Menor', af: { dmg_inc: 10 } },
  // (14/10) Os ALTARES do PoE — os buffs dos Santuários (poedb, PoE 3.29; `altar: true`): os 13 do sorteio do PoE (a Harmonia do Propósito e o
  // Gritos dos Dessecados — `ALTARES_DO_SORTEIO`; o Ressonante do PoE antigo é o Carregado de hoje) e os Menores dos únicos (o Erro Crasso).
  // "Efeito dos Buffs de Altares em você aumentado" multiplica os números (`efeito_altar` — não o nível das gemas disparadas). As Novas e os
  // Esqueletos dos Maiores: o poedb não publica o dano nem a frequência — as gemas do jogo (Nova Glacial, Nova Elétrica, Convocar Esqueleto)
  // nível 20, a cada 2 s (4 s os Esqueletos). O Altar de Aceleração: a Velocidade de Projéteis não se aplica (o projétil do jogo vai direto ao alvo).
  altarAceleracao: { nome: 'Altar de Aceleração', altar: true, af: { action_speed: 50 } },
  altarBrutal: { nome: 'Altar Brutal', altar: true, af: { chance_empurrar: 100, stun_duration: 30, dmg_inc: 50 } },
  altarDiamante: { nome: 'Altar Diamante', altar: true, af: { critico_sempre: 1 } },
  altarEcoante: { nome: 'Altar Ecoante', altar: true, af: { repeticoes_extra: 1 } },
  altarSombrio: { nome: 'Altar Sombrio', altar: true, af: { naocaos_as_extra_chaos: 10, 'ev:matar:explodirChance:25:chaos': 40 } },
  altarImpenetravel: { nome: 'Altar Impenetrável', altar: true, af: { evasion_pct: 100, es_pct: 100, armour_pct: 100 } },
  altarMassivo: { nome: 'Altar Massivo', altar: true, af: { life_inc: 40, area_inc: 40 } },
  altarReabastecimento: { nome: 'Altar de Reabastecimento', altar: true, af: { mana_regen_pct: 200, life_regen_max_pct: 6.67 } },
  altarResistencia: { nome: 'Altar de Resistência', altar: true, af: { fire_res_max: 10, ice_res_max: 10, energy_res_max: 10, chaos_res_max: 10, fire_res: 50, ice_res: 50, energy_res: 50 } },
  altarCarregado: { nome: 'Altar Carregado', altar: true, af: { max_tolerancia: 1, max_frenesi: 1, max_poder: 1, carga_qualquer_ao_matar: 60, 'ev:acertar:cargaAleatoria': 20 } },
  altarCongelanteMaior: { nome: 'Altar Congelante Maior', altar: true, af: { phys_as_extra_ice: 30, 'periodico:2:gatilho:nova-glacial': 20 } },
  altarEletrizanteMaior: { nome: 'Altar Eletrizante Maior', altar: true, af: { phys_as_extra_energy: 30, 'periodico:2:gatilho:nova-eletrica': 20 } },
  altarEsqueleticoMaior: { nome: 'Altar Esquelético Maior', altar: true, af: { phys_as_extra_chaos: 30, 'periodico:4:gatilho:convocar-esqueleto': 20 } },
  altarBrutalMenor: { nome: 'Altar Brutal Menor', altar: true, af: { chance_empurrar: 100, stun_duration: 20, dmg_inc: 20 } },
  altarMassivoMenor: { nome: 'Altar Massivo Menor', altar: true, af: { life_inc: 20, area_inc: 20 } },
  // (14/10, o Warden: o Avatar Liberto deixa Liberto por 10 s — os efeitos são as linhas "… enquanto Liberto" do Avatar da Selva, `@buff:liberto`)
  liberto: { nome: 'Liberto', af: {} },
  // (14/10, o Grande Emissário das Direções — `acoes.tiqueDoEmissario`: um ao acaso, ou todos)
  emissarioProjeteis: { nome: 'Direções: Projéteis', af: { extra_projectiles: 2 } },
  emissarioRicochetes: { nome: 'Direções: Ricochetes', af: { ricochetes: 2 } },
  emissarioPerfuracao: { nome: 'Direções: Perfuração', af: { perfurar: 2 } },
  emissarioDifusao: { nome: 'Direções: Difusão', af: { bifurcar: 2, bifurcar_de_novo: 1 } },
  emissarioTodos: { nome: 'Direções: Todos', af: { extra_projectiles: 2, ricochetes: 2, perfurar: 2, bifurcar: 2, bifurcar_de_novo: 1 } },
  // (lote F) Vento Favorável (o lembrete do PoE: Velocidade de Ação aumentada — aqui, as velocidades de ataque, conjuração e movimento).
  // (lote 30, P027: "Vento Favorável aumenta a Velocidade de Ação em 8%" — o lembrete do próprio nó; era +10% de ataque, conjuração e movimento)
  ventoFavoravel: { nome: 'Vento Favorável', af: { action_speed: 8 } },
  // (o Inquisidor: "Fanatismo concede às magias conjuradas por você +75% de velocidade de conjuração, -75% de custo e área de efeito
  // aumentada em 75%"; o Elementalista: "Convergência concede 30% mais Dano Elemental e dura 4 segundos" — aproximado: nas habilidades Elementais.)
  fanatismo: { nome: 'Fanatismo', af: { cast_speed: 75, 'custo_mana_inc@magia': -75, 'area_inc@magia': 75 } },
  // (lote 32, P073: "Convergência concede 30% mais Dano Elemental" — as partes de Fogo, Gelo e Raio do golpe; era o golpe inteiro com a tag)
  convergencia: { nome: 'Convergência', af: { mais_dano_elemental_convergencia: 30 } },
  // (o suporte Crueldade: "Crueldade: até 40% mais Dano Degenerativo" — aproximado: os 40%; o "Efeito da Crueldade" multiplica)
  crueldade: { nome: 'Crueldade', af: { dano_dot_mais: 40 } },
  // (o suporte Momentum: "Rapidez concede Velocidade de Movimento aumentada em 15% por Momentum perdido" — o valor é o do momento em que veio)
  rapidez: { nome: 'Rapidez', af: (estado) => ({ move_speed: estado?.hunt?.rapidez?.movimentoPct ?? 0 }) },
  // (lote S2A, 27/10) a Fonte de Vida do suporte (o PoB: Lifetap → FlaskLifeRecovery INC 20) e o Ímpeto de Combate do Combate Próximo (o efeito — o "mais" da
  // Velocidade de Ataque das Habilidades de Deslocamento não suportadas — é do uso: `suportes-s2a.fatorDoImpeto`)
  fonteDeVida: { nome: 'Fonte de Vida', af: { frasco_vida_rec: 20 } },
  impetoDeCombate: { nome: 'Ímpeto de Combate', af: {} },
};
/** (14/10) Os 13 altares do sorteio do PoE ("Ganha um buff de altar aleatório" — a lista do Gritos dos Dessecados no poedb). */
export const ALTARES_DO_SORTEIO = Object.freeze(['altarAceleracao', 'altarBrutal', 'altarCongelanteMaior', 'altarDiamante', 'altarEcoante', 'altarSombrio', 'altarImpenetravel', 'altarMassivo', 'altarReabastecimento', 'altarResistencia', 'altarCarregado', 'altarEletrizanteMaior', 'altarEsqueleticoMaior']);
/** O buff está ativo? (ganho por evento, ou "sempre" pela soma). */
export function buffAtivo(estado, nome, total = null) {
  const h = estado?.hunt;
  if (h?.poeBuffs?.[nome] > (h?.clock ?? 0)) return true;
  return Number(total?.[`sempre:${nome}`]) > 0;
}
/**
 * (14/10) Os ALTARES ativos mudaram desde a última olhada? O Massivo mexe na vida máxima: a caçada refaz a ficha e a vida quando muda
 * (`cacadas.tique`). `total`: a soma da ficha (o "sempre" condicional — o Gritos dos Dessecados).
 */
export function altaresMudaram(estado, total = null) {
  const h = estado?.hunt;
  if (!h) return false;
  const vivos = Object.keys(BUFFS).filter((n) => BUFFS[n].altar && buffAtivo(estado, n, total)).join(',');
  if (vivos === (h.poeAltaresVistos ?? '')) return false;
  h.poeAltaresVistos = vivos;
  return true;
}
/** Ganha um buff por `segundos` (renova para o maior). */
/**
 * (lote 33 — P015/P055) O ELUSIVO do PoE (o lembrete: "Elusivo concede inicialmente 15% de chance de Esquivar de Acertos … e Velocidade de
 * Movimento aumentada em 30%. O buff reduz seu efeito, sendo removido ao chegar em 0% de efeito. Se você já tiver o buff Elusivo, não poderá
 * ganhar Elusivo"; o poedb: "perde efetividade a 20% por segundo … a duração vem do efeito do buff, não dos modificadores de duração"): começa
 * no efeito cheio — 100% + o "Efeito do Elusivo aumentado" (e o do suporte que o deu, a Lâmina Noturna) — e perde 20 pontos por segundo.
 */
export const ELUSIVO = Object.freeze({ perdaPorSegundo: 20 });
/** O efeito do Elusivo em você agora, em % (0 sem ele; o "sempre" das peças — sem `poeElusivo` — fica cheio). */
export function efeitoDoElusivo(hunt, agora = hunt?.clock ?? 0) {
  const x = hunt?.poeElusivo;
  if (!x || !(hunt.poeBuffs?.elusivo > agora)) return 0;
  return Math.max(0, x.e0 - (ELUSIVO.perdaPorSegundo * (agora - x.desde)) / 1000);
}
export function ganharBuff(hunt, nome, segundos, agora = hunt?.clock ?? 0, { efeitoExtra = 0 } = {}) {
  if (!hunt || !BUFFS[nome] || !(segundos > 0)) return;
  const b = (hunt.poeBuffs ??= {});
  if (nome === 'elusivo') {
    if (b.elusivo > agora) return;
    (hunt.poeEfeitoDeBuff ??= {}).elusivo = efeitoExtra;
    const e0 = 100 * Math.max(0, 1 + ((Number(fichaDa(hunt)?.afPoe?.['efeito_buff:elusivo']) || 0) + efeitoExtra) / 100);
    hunt.poeElusivo = { desde: agora, e0 };
    b.elusivo = agora + Math.ceil((e0 / ELUSIVO.perdaPorSegundo) * 1000);
    hunt.poeFichaMudou = true;
    return;
  }
  // (14/10: a ficha é refeita no tique — o buff ganho vale já, como o vencido sai: `tique`)
  if (!(b[nome] > agora)) hunt.poeFichaMudou = true;
  b[nome] = Math.max(b[nome] ?? 0, agora + segundos * 1000);
  // "Remove todas as Afecções e Incêndios quando ao ganhar Adrenalina" (o Campeão/Gladiador): os danos contínuos de afecção em você
  // (Incêndio, Sangramento, Veneno, Eletrização, Resfriamento) e o Congelamento/Resfriamento do controle.
  if (nome === 'adrenalina' && Number(fichaDa(hunt)?.afPoe?.adrenalina_remove_afeccoes) > 0) {
    const h = hunt.efeitosDoJogador;
    if (h?.dots) h.dots = h.dots.filter((d) => !['queimadura', 'sangramento', 'veneno', 'venenoPoe', 'choque', 'gelo'].includes(d.tipo));
    if (hunt.controle) { delete hunt.controle.congelado; delete hunt.controle.lento; }
  }
}
/**
 * O que os buffs ativos somam (`Afixos.soma`, depois das condições — o "sempre" condicional já resolvido): `{ stat: valor }` ou null.
 * "+X% Efeito da Agressividade" multiplica a dela. (+ os bônus TEMPORÁRIOS com valor dos eventos — "Velocidade de Movimento aumentada em X%
 * por N segundos ao Jogar uma Armadilha": `hunt.poeTemporarios`.)
 */
export function adds(estado, total = null) {
  if (!ligado()) return null;
  const saida = {};
  const agoraT = estado?.hunt?.clock ?? 0;
  for (const x of Object.values(estado?.hunt?.poeTemporarios ?? {})) if (x && x.ate > agoraT) saida[x.stat] = (saida[x.stat] ?? 0) + x.valor;
  for (const [nome, b] of Object.entries(BUFFS)) {
    if (!buffAtivo(estado, nome, total)) continue;
    // (+ o efeito que veio junto com o buff — o do suporte que o concedeu: `hunt.poeEfeitoDeBuff`, a Crueldade, o Elusivo da Lâmina Noturna)
    // (+ 14/10: o "Efeito dos Buffs de Altares em você aumentado" nos altares — não no nível das gemas que eles disparam, `periodico:`)
    // (lote 33: o Elusivo ganho decai — o efeito dele agora, `efeitoDoElusivo`, no lugar do aumentado)
    const elusivoAgora = nome === 'elusivo' && estado?.hunt?.poeElusivo && estado.hunt.poeBuffs?.elusivo > agoraT ? efeitoDoElusivo(estado.hunt, agoraT) / 100 : null;
    const efeito = elusivoAgora ?? 1 + ((Number(total?.[`efeito_buff:${nome}`]) || 0) + (Number(estado?.hunt?.poeEfeitoDeBuff?.[nome]) || 0) + (b.altar ? Number(total?.efeito_altar) || 0 : 0)) / 100;
    for (const [k, v] of Object.entries(typeof b.af === 'function' ? b.af(estado) : b.af)) saida[k] = (saida[k] ?? 0) + v * (k.startsWith('periodico:') ? 1 : efeito);
  }
  // (lote G) Sobre o Solo Sagrado: 6% da Vida por segundo (× "Efeito de Solos Sagrados Criados por você aumentado"), "Seu chão consagrado
  // concede precisão aumentada em X%" e "faz com que a Regeneração de Vida também Recupere Escudo de Energia".
  if (noSoloSagrado(estado?.hunt)) {
    const regen = SOLO_SAGRADO.regenPct * Math.max(0, 1 + (Number(total?.efeito_solo_sagrado) || 0) / 100);
    saida.life_regen_max_pct = (saida.life_regen_max_pct ?? 0) + regen;
    if (Number(total?.solo_sagrado_precisao) > 0) saida.accuracy_inc = (saida.accuracy_inc ?? 0) + Number(total.solo_sagrado_precisao);
    if (Number(total?.solo_sagrado_es) > 0) saida.es_regen_pct = (saida.es_regen_pct ?? 0) + regen;
  }
  // (o Necromante: "Suas Habilidades de Oferenda também afetam você", "Suas Oferendas possuem X% de redução do Efeito em você" — a Oferenda
  // usada vale em você, tudo o que ela dá — `acoes`, `hunt.oferendaEmVoce`. Lote 32, P028: a Carnal também na Conjuração e no Movimento; a
  // Óssea também no bloqueio de Magia, e a regeneração dela só "se Bloqueou recentemente"; a Espiritual, o crítico.)
  const of = estado?.hunt?.oferendaEmVoce;
  if (of && of.ate > agoraT && Number(total?.oferenda_em_voce) > 0) {
    const f = Math.max(0, 1 - (Number(total?.oferenda_efeito_reduzido) || 0) / 100);
    const regen = of.regenPct && (!of.regenSeBloqueou || recente(estado.hunt.poeRecente?.bloqueou, agoraT)) ? of.regenPct : 0;
    for (const [k, v] of [['atk_speed', of.velAtaquePct], ['cast_speed', of.velConjPct], ['move_speed', of.velMovPct], ['crit_chance_inc', of.critInc], ['crit_dmg', of.critMult], ['block', of.bloqueioPct], ['spell_block', of.bloqueioMagicoPct], ['life_regen_max_pct', regen]]) if (v) saida[k] = (saida[k] ?? 0) + v * f;
  }
  // (14/10, o Warden) A CASCA da Pele de Árvore (`hunt.casca` — `tiqueDoWarden`): -60 de Dano Físico dos Acertos de Ataque por Casca e 4% mais
  // chance de Evadir Ataques por Casca abaixo do máximo; a Lição das Estações: -25 de cada tipo de dano dos Acertos de Magia por Casca
  // (`casca_magia_fixo`) e +3% do Dano Mágico Suprimido Impedido por Casca abaixo do máximo (`casca_supressao`).
  const casca = estado?.hunt?.casca;
  if (casca) {
    const abaixo = CASCA.maximo - casca.n;
    saida.physical_sofrido_ataque = (saida.physical_sofrido_ataque ?? 0) - CASCA.fisicoAtaquePorCasca * casca.n;
    saida.chance_evadir_mais = (saida.chance_evadir_mais ?? 0) + CASCA.evadirMaisPorCascaAbaixo * abaixo;
    const porMagia = Number(total?.casca_magia_fixo) || 0;
    if (porMagia) for (const el of ELS) saida[`${el}_sofrido_magia`] = (saida[`${el}_sofrido_magia`] ?? 0) + porMagia * casca.n;
    const supressao = Number(total?.casca_supressao) || 0;
    if (supressao) saida.supressao_prevenida = (saida.supressao_prevenida ?? 0) + supressao * abaixo;
  }
  // (14/10, o Marechal da Divindade) "Ganha 10% do dano físico como dano elétrico adicional para cada uma das suas Chamas Santificadas que foram
  // removidas recentemente por um ataque aliado, até 80%".
  const porRemovida = Number(total?.chama_santificada_raio) || 0;
  if (porRemovida > 0) {
    const removidas = (estado?.hunt?.poeChamasRemovidas ?? []).filter((t) => agoraT - t <= CHAMA_SANTIFICADA.recenteMs).length;
    if (removidas) saida.phys_as_extra_energy = (saida.phys_as_extra_energy ?? 0) + Math.min(Number(total?.chama_santificada_raio_max) || Infinity, porRemovida * removidas);
  }
  // (14/10, o Reliquarian) As ARANHAS ESPECTRAIS vivas: 2% de Velocidade de Ataque e 15% de Dano com Veneno cada (`acoes.tiqueDasAranhas`); o
  // PODER FANTASMAL ("Cada Fantasma Convocado concede a Você Poder Fantasmal": Dano Físico Mágico Adicional — lote 44, P064: o de cada Fantasma
  // vivo pelo nível do Suporte: Convocar Fantasma que o convocou, a tabela do PoB — `LacaiosPoe.poderFantasmalNoNivel`)
  const vivosDo = (k) => (estado?.hunt?.lacaios ?? []).filter((l) => l?.[k] && l.hp > 0);
  const aranhas = vivosDo('aranha').length;
  if (aranhas) {
    saida.atk_speed = (saida.atk_speed ?? 0) + 2 * aranhas;
    saida.poison_dmg_inc = (saida.poison_dmg_inc ?? 0) + 15 * aranhas;
  }
  if (Number(total?.poder_fantasmal) > 0) {
    for (const l of vivosDo('fantasma')) {
      const [min, max] = l.poderFantasmal ?? [l.dano?.min ?? 0, l.dano?.max ?? 0];
      saida.spell_added_physical_dmg_min = (saida.spell_added_physical_dmg_min ?? 0) + min;
      saida.spell_added_physical_dmg_max = (saida.spell_added_physical_dmg_max ?? 0) + max;
    }
  }
  // (14/10, o Rito Profano) A INFUSÃO ESPIRITUAL, por acúmulo (`INFUSAO`)
  const infusao = estado?.hunt?.infusaoEspiritual?.n ?? 0;
  if (infusao > 0) {
    saida.es_recharge_start = (saida.es_recharge_start ?? 0) + INFUSAO.esInicioPct * infusao;
    saida['mais_dano@canalizar+magia'] = (saida['mais_dano@canalizar+magia'] ?? 0) + INFUSAO.maisDanoPct * infusao;
    saida['custo_mana_mais@canalizar+magia'] = (saida['custo_mana_mais@canalizar+magia'] ?? 0) + INFUSAO.maisCustoPct * infusao;
  }
  // (14/10, a Cruzada Implacável) A AURA de cada Relíquia Elemental viva (Cólera, Ódio ou Ira, nível 20 — `l.auraAf`): em você e, pela foto dos
  // "Você e Aliados" (`aliados:`), nos companheiros perto. (O fim dela é o do lacaio — o tique dos lacaios tira a que acabou e refaz a ficha.)
  for (const l of estado?.hunt?.lacaios ?? []) {
    if (!l?.reliquia || !(l.hp > 0)) continue;
    for (const [k, v] of Object.entries(l.auraAf ?? {})) { saida[k] = (saida[k] ?? 0) + v; saida[`aliados:${k}`] = (saida[`aliados:${k}`] ?? 0) + v; }
  }
  // (lote F) "Fúria Arcana também concede +X% de dano mágico a você".
  if (buffAtivo(estado, 'furiaArcana', total) && Number(total?.furia_arcana_dano_magico) > 0) saida.spell_dmg = (saida.spell_dmg ?? 0) + Number(total.furia_arcana_dano_magico);
  // (lote F) Os bônus POR TEMPO dos eventos (`ev:<evento>:stat:<atributo>:<segundos>` — "Ganha Velocidade de Ataque aumentada em 20% por 4
  // segundos quando Matar um Inimigo Raro ou Único"): `hunt.poeBonusPorTempo`, o maior de cada atributo.
  const agoraB = estado?.hunt?.clock ?? 0;
  for (const [stat, b] of Object.entries(estado?.hunt?.poeBonusPorTempo ?? {})) if (b.ate > agoraB) saida[stat] = (saida[stat] ?? 0) + b.valor;
  // (lote D) A Fortificação: 1% menos Dano de Acertos por Fortificação (`ficha` multiplica — é "menos"). O teto fica na caçada (`fortificacao`).
  if (estado?.hunt && total) estado.hunt.fortificacaoTeto = { max: maxFortificacao(total), sempre: Number(total.fortificacao_sempre_max) > 0 };
  const f = fortificacao(estado, total);
  if (f > 0) saida.fortificacao_menos_dano = f;
  return Object.keys(saida).length ? saida : null;
}
// ---------------------------------------------------------------- as MALDIÇÕES dos monstros em VOCÊ

/**
 * As maldições que um monstro do PoE põe em você (o modificador "Amaldiçoa" — `mobs/mecanicas.aoAtacar`, efeito `maldicao`) e as que os
 * monstros com "Reflete Feitiços" devolvem (`Reforcos.marcar`). Cada uma é um conjunto de atributos que entra na SUA soma enquanto dura
 * (`addsDasMaldicoesNoJogador`): a Fraqueza Elemental tira resistência ANTES do máximo de 75%, como no PoE. Os números são os da gema no
 * nível mais baixo do PoE (a do monstro não tem nível no poedb).
 */
export const MALDICOES_DOS_MONSTROS = {
  fraquezaElemental: { nome: 'Fraqueza Elemental', af: { fire_res: -20, ice_res: -20, energy_res: -20 } },
  vulnerabilidade: { nome: 'Vulnerabilidade', af: { dano_physical_recebido_inc: 20 } },
  enfraquecer: { nome: 'Enfraquecer', af: { mais_dano: -20 } },
  // (As dos MAPAS ÚNICOS — O Claustro Pútrido —, com os valores do poedb: "inflige -17% de Resistência a Fogo/Gelo/Raio", "-15% a Caos".)
  flamabilidade: { nome: 'Flamabilidade', af: { fire_res: -17 } },
  congelabilidade: { nome: 'Congelabilidade', af: { ice_res: -17 } },
  condutividade: { nome: 'Condutividade', af: { energy_res: -17 } },
  desespero: { nome: 'Desespero', af: { chaos_res: -15 } },
};
export const DURACAO_DA_MALDICAO_DO_MONSTRO_MS = 6000;
/** (lote 55, o Olho do Vigia) "Imune a <Maldição>": a imunidade a cada maldição que os monstros põem em você (pelo nome dela). */
// (lote A2: + os Grilhões Temporais — a Fenda Temporal: "Buff te torna Inafetável por Grilhões Temporais")
const IMUNE_A_MALDICAO = { 'Fraqueza Elemental': 'imune_fraqueza_elemental', Vulnerabilidade: 'imune_vulnerabilidade', Enfraquecer: 'imune_enfraquecer', Flamabilidade: 'imune_flamabilidade', Congelabilidade: 'imune_congelabilidade', Condutividade: 'imune_condutividade', Desespero: 'imune_desespero', 'Grilhões Temporais': 'imune_grilhoes_temporais' };
const imuneAMaldicao = (af, nome) => Number(af?.[IMUNE_A_MALDICAO[nome]]) > 0;
/**
 * (lote 30, P017) "Debuffs em você expiram X% mais rápido": o tempo deles corre (1 + X%) vezes mais depressa — a duração ÷ (1 + X%), em TODO
 * debuff em você (as afecções, as maldições, os debuffs dos monstros).
 */
export const fatorDosDebuffs = (af) => 1 / Math.max(0.01, 1 + (Number(af?.debuffs_expiram_rapido) || 0) / 100);
/** (lote 30, P016/P076) As chaves do "X% mais Dano de <tipo>" — só a parte daquele tipo do golpe (`fatorRecebidoPeloBicho`). */
export const MAIS_DANO_DO_TIPO = Object.freeze({ physical: 'mais_dano_fisico', fire: 'mais_dano_fogo', ice: 'mais_dano_gelo', energy: 'mais_dano_raio', chaos: 'mais_dano_caos' });
/** Põe uma maldição em você (renova a mesma): `{ nome, af, ms }`. */
export function amaldicoarJogador(hunt0, id, { nome, af, ms = DURACAO_DA_MALDICAO_DO_MONSTRO_MS }, agora = hunt0?.clock ?? 0) {
  // (12/10: "Maldições são infligidas em Você ao invés dos alvos Vinculados" — a maldição vai para quem vincula este jogador.)
  const hunt = quemRecebeAMaldicao(hunt0) ?? hunt0;
  if (!hunt || !af) return;
  // (lote 52, a Desgraça das Bruxas: imune a Maldições por tempo — `ModsPoe.desgracaDasBruxas`)
  if ((hunt.imunidadesPoe?.maldicao ?? 0) > agora) return;
  if (imuneAMaldicao(fichaDa(hunt)?.afPoe, nome)) return;
  // ("Duração das Maldições em você aumentada em X%".)
  ms = Math.round(ms * Math.max(0.1, 1 + (Number(fichaDa(hunt)?.afPoe?.duracao_maldicao_propria) || 0) / 100) * fatorDosDebuffs(fichaDa(hunt)?.afPoe));
  const lista = (hunt.maldicoesNoJogador ??= {});
  // (lote 50, a regra do PoE) a MESMA maldição não acumula (a nova tira a de antes, de outro monstro), e você tem o LIMITE de 1 maldição — +1 por
  // "N Maldições adicionais podem ser aplicadas à você" (o Auto-Flagelo, `maldicoes_extra_em_voce`): passou do limite, a mais velha sai.
  for (const [k, x] of Object.entries(lista)) if (k !== id && x?.nome === nome) delete lista[k];
  lista[id] = { ate: agora + ms, nome, af, desde: agora };
  const limite = 1 + Math.max(0, Math.round(Number(fichaDa(hunt)?.afPoe?.maldicoes_extra_em_voce) || 0));
  const ativas = Object.entries(lista).filter(([, x]) => x && x.ate > agora && !String(x.nome ?? '').startsWith('refletida')).sort((a, b) => (b[1].desde ?? 0) - (a[1].desde ?? 0));
  for (const [k] of ativas.slice(limite)) delete lista[k];
}
/**
 * O que as maldições em você somam agora (`Afixos.soma`, DEPOIS das condições — o "Imune a Maldições enquanto possuir ao menos N de Fúria"
 * já resolvido): × "Efeito das Maldições em você" (`efeito_maldicao_proprio`); nada com "Imune a Maldições"; e, com "Suas Resistências
 * Elementais não podem ser reduzidas por Maldições" (`res_elem_nao_reduzida_maldicao`), sem a parte que tira resistência elemental.
 */
export function addsDasMaldicoesNoJogador(estado, total) {
  if (!ligado()) return null;
  const h = estado?.hunt;
  const agora = h?.clock ?? 0;
  // (lote G20c: sobre o Solo Sagrado do Totem Flamejante Sagrado, nenhuma maldição pega em você)
  if (soloImuneAMaldicoes(h, agora)) return null;
  // (+ as do MAPA do endgame em que você está — "Jogadores são Amaldiçoados com Vulnerabilidade": valem o mapa inteiro.)
  const ativas = [...Object.values(h?.maldicoesNoJogador ?? {}).filter((m) => m && m.ate > agora), ...maldicoesDoMapa(estado).map((id) => MALDICOES_DOS_MONSTROS[id]).filter(Boolean)];
  // (+ lote 52: a imunidade por tempo da Desgraça das Bruxas)
  if (!ativas.length || Number(total?.imune_maldicao) > 0 || (h?.imunidadesPoe?.maldicao ?? 0) > agora) return null;
  // (lote 55: a imune a ESTA maldição não soma — "Imune a Vulnerabilidade enquanto afetado por Determinação")
  const valem = ativas.filter((m) => !imuneAMaldicao(total, m.nome));
  if (!valem.length) return null;
  const efeito = Math.max(0, 1 + (Number(total?.efeito_maldicao_proprio) || 0) / 100);
  const semResElemental = Number(total?.res_elem_nao_reduzida_maldicao) > 0;
  const saida = {};
  for (const m of valem) for (const [k, v] of Object.entries(m.af ?? {})) {
    if (semResElemental && v < 0 && /^(fire|ice|energy)_res$/.test(k)) continue;
    saida[k] = (saida[k] ?? 0) + v * efeito;
  }
  return Object.keys(saida).length ? saida : null;
}

/** Os buffs ativos para a tela (cartões da caçada). */
export function buffsParaTela(estado) {
  const h = estado?.hunt;
  if (!h?.poeBuffs) return [];
  const agora = h.clock ?? 0;
  return Object.entries(h.poeBuffs).filter(([, ate]) => ate > agora).map(([k, ate]) => ({ icone: null, nome: BUFFS[k]?.nome ?? k, resta: ate - agora, tipo: 'buffPoe' }));
}

/**
 * Os condicionais de GOLPE que sobram na soma (já com as condições de estado conferidas): `[{ stat, tags: [...], valor }]`. A ficha guarda
 * isto (`ficha.porTag`) para cada acerto escolher os seus.
 */
export function porTag(estado, total, principais = null) {
  if (!ligado() || !total) return [];
  const saida = [];
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (!ehCondicional(k) || typeof v !== 'number' || !v || String(k).startsWith('ev:')) continue;
    const { stat, escala, conds: c, teto } = partir(k);
    const tags = c.filter((x) => !ehCondDeEstado(x));
    if (!tags.length) continue;
    if (escala && ESCALAS_DA_FICHA.test(escala)) continue;
    conds ??= condicoesDe(estado, total, principais);
    if (!c.filter((x) => ehCondDeEstado(x)).every((x) => vale(conds, x))) continue;
    const m = escala ? fatorDaEscala(estado, total, principais, escala) : 1;
    if (m) saida.push({ stat, tags, valor: comTeto(v, m, teto) });
  }
  return saida;
}

/**
 * Os mods de EVENTO da soma (`ev:<evento>:<ação>[:<parâmetro>]@conds`): `[{ evento, acao, param, conds, valor }]`. As condições são
 * conferidas na hora do evento (com o alvo dele) — `mods-poe.evento`.
 */
export function eventosDa(total) {
  if (!ligado() || !total) return [];
  const saida = [];
  for (const [k, v] of Object.entries(total)) {
    if (!String(k).startsWith('ev:') || typeof v !== 'number' || !v) continue;
    const { stat, escala, teto, conds } = partir(k);
    const [, evento, acao, ...param] = stat.split(':');
    // (+ a ESCALA — "N de Vida ganha por Carga de Frenesi ao Matar" = `ev:matar:vida%carga:frenesi`: o valor × o fator na hora do evento.)
    saida.push({ evento, acao, param: param.join(':'), conds, valor: v, ...(escala ? { escala, teto } : {}) });
  }
  return saida;
}

// ---------------------------------------------------------------- o golpe

/** As tags do poedb (em português) → as tags de golpe daqui. */
const TAG_DO_POE = {
  Ataque: 'ataque', Magia: 'magia', 'Corpo a Corpo': 'corpo', Projétil: 'projetil', Área: 'area', Fogo: 'fogo', Gelo: 'gelo', Raio: 'raio',
  Físico: 'fisico', Caos: 'caos', Arco: 'arco', Totem: 'totem', Armadilha: 'armadilha', Mina: 'mina', Lacaio: 'lacaio', Arauto: 'arauto',
  Vaal: 'vaal', Movimento: 'movimento', Clamor: 'clamor', Aura: 'aura', Maldição: 'maldicao',
  // (lote 50) as gemas de Golem — "se você Convocou um Golem nos últimos N segundos" (`nosUltimos:N:usou:golem`, `marcarUsoPorTag`)
  Golem: 'golem',
  // (09/10, a árvore:) "Habilidade de Guarda" e "Gemas de Habilidade Críticas" (a tag Crítico da gema — não o golpe crítico).
  Guarda: 'guarda', Crítico: 'gemaCritica',
  // (09/10, auditoria da árvore) As tags que existiam em TAGS_DE_GOLPE mas nenhuma gema produzia — as regras com elas nunca valiam. Nas
  // gemas em português: Golpear = Strike, Impacto = Slam, Runa = Brand ("Runa Tempestuosa"), Marca = Mark, Feitiço = Hex, Vínculo = Link,
  // Ativação = Trigger.
  Golpear: 'golpe', Impacto: 'pancada', Nova: 'nova', Canalização: 'canalizar', Feitiço: 'feitico', Vínculo: 'vinculo', Marca: 'marca',
  Runa: 'runa', Ativação: 'ativada', Retaliação: 'retaliacao', Postura: 'postura',
};
/** As tags de golpe de uma lista de tags do poedb (`['Ataque','Projétil','Arco']` → `['ataque','projetil','arco']`), + `elemental`. */
export function tagsDoPoe(lista = []) {
  const t = new Set();
  for (const x of lista) {
    const k = TAG_DO_POE[String(x).replace(/^poe:/, '')];
    if (k) t.add(k);
  }
  if (t.has('fogo') || t.has('gelo') || t.has('raio')) t.add('elemental');
  return [...t];
}
/** As tags do golpe básico: ataque + corpo a corpo (ou projétil, de longe) + físico (+ arco). */
export function tagsDoGolpeBasico(estado, categoria) {
  const arma = classeDe(estado?.equipment?.weapon);
  const longe = categoria === 'distancia' || categoria === 'magica' || A_DISTANCIA.has(arma);
  const t = ['ataque', longe ? 'projetil' : 'corpo', 'fisico'];
  if (arma === 'Bows') t.push('arco');
  return t;
}

/** A soma dos condicionais de golpe da ficha que valem para estas tags: `{ stat: valor }`. */
export function somaPorTags(ficha, tags) {
  const tem = new Set(tags);
  const s = {};
  for (const x of ficha?.porTag ?? []) if (x.tags.every((t) => tem.has(t))) s[x.stat] = (s[x.stat] ?? 0) + x.valor;
  return s;
}

const ELEMENTO_DA_TAG = { fogo: 'fire', gelo: 'ice', raio: 'energy', fisico: 'physical', caos: 'chaos' };

/**
 * A FICHA DE UM GOLPE: a ficha do personagem com o que vale só para estas tags (e este alvo) — o "Dano aumentado" (entra em cada elemento
 * de `danoDoElemento`, a soma aditiva do PoE), o crítico (chance × os "aumentada", multiplicador), a penetração e as afecções. Sem nada
 * condicional, a MESMA ficha volta (nada muda).
 */
/**
 * As keystones da DISTÂNCIA do projétil de ataque (os números da wiki no poedb; 1 casa = 2 m = 20 unidades do PoE): Tiro Distante — ×0,8
 * a 0, ×1,2 a 35 e ×1,6 a partir de 70 unidades; Queima-Roupa — ×1,3 até 10, ×1,0 a 35 e ×0,7 a 150. As duas multiplicam juntas.
 */
export const DISTANCIA_DO_PROJETIL = { tiroDistante: [[0, 0.8], [35, 1.2], [70, 1.6]], queimaRoupa: [[10, 1.3], [35, 1], [150, 0.7]], unidadesPorCasa: 20 };
const interpolar = (tabela, x) => {
  if (x <= tabela[0][0]) return tabela[0][1];
  for (let i = 1; i < tabela.length; i++) if (x <= tabela[i][0]) { const [x0, y0] = tabela[i - 1]; const [x1, y1] = tabela[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return tabela[tabela.length - 1][1];
};
/**
 * (lote 33 — P013/P021/P030/P052) As RAMPAS DE DISTÂNCIA do Path of Building (`DistanceRamp`, interpolação linear entre os pontos; em
 * unidades do PoE, 1 casa = 2 m = 20 unidades — dono, 15/10: "Medir em metros"): "ganham … conforme viajam adiante" (o crítico das flechas, o
 * Tiro Longo, o Tiro Distante do Deadeye, o dano das flechas) = 0 até 35 unidades, o máximo a partir de 70; "no início de seu movimento,
 * reduzido para 0% na medida em que viajam" (a Animosidade Adjacente) = o máximo até 35, 0 a partir de 70.
 */
export const RAMPAS_DE_DISTANCIA = { viajando: [[35, 0], [70, 1]], noInicio: [[35, 1], [70, 0]] };
/** A distância até o alvo em unidades do PoE (as casas × 20), ou null sem alvo ou posição. */
export const unidadesAte = (alvo, pos) => (alvo && pos ? Math.max(Math.abs(alvo.x - pos.x), Math.abs(alvo.y - pos.y)) * DISTANCIA_DO_PROJETIL.unidadesPorCasa : null);
/**
 * (lote 33 — P045) A PROXIMIDADE do corpo a corpo do PoB (`MeleeProximity`, "Causa até 15% mais Dano Corpo a Corpo aos Inimigos, baseado na
 * proximidade" — o Impacto): o máximo até 15 unidades, caindo em linha (1/25 por unidade) de 16 a 39, nada a partir de 40 — os ramos do PoB.
 * O vizinho colado está a 1 casa = 20 unidades: 80% do máximo.
 */
export function proximidadeCorpoACorpo(unidades) {
  if (unidades == null) return 0;
  if (unidades >= 16 && unidades <= 39) return 1 - (unidades - 15) / 25;
  if (unidades >= 40) return 0;
  return 1;
}
/** O "X% mais Dano Corpo a Corpo … baseado na proximidade" deste golpe corpo a corpo no `alvo` (1 sem a linha, sem alvo, de longe). */
export function maisPelaProximidade(ficha, tags, alvo, estado) {
  const t = tags instanceof Set ? tags : new Set(tags ?? []);
  if (!ligado() || !ficha?.afPoe || !t.has('corpo')) return 1;
  const v = (Number(ficha.afPoe.mais_dano_proximidade) || 0) + (somaPorTags(ficha, [...t]).mais_dano_proximidade ?? 0);
  if (!v) return 1;
  return Math.max(0, 1 + (v * proximidadeCorpoACorpo(unidadesAte(alvo, estado?.hunt?.pos))) / 100);
}
function pelaDistancia(ficha, tags, alvo, estado, s = null) {
  const longe = Number(ficha.afPoe.tiro_distante) > 0;
  // (lote A3, dono 19/10 — D9: + a do USO — o suporte Ponto Cego, `af:queima_roupa` na ficha do uso, a flag PointBlank do PoB: a mesma rampa, sem somar
  // com a keystone)
  const perto = Number(ficha.afPoe.queima_roupa) > 0 || Number(s?.queima_roupa) > 0;
  if ((!longe && !perto) || !tags.has('projetil') || !tags.has('ataque') || !alvo || !estado?.hunt?.pos) return 1;
  const d = Math.max(Math.abs(alvo.x - estado.hunt.pos.x), Math.abs(alvo.y - estado.hunt.pos.y)) * DISTANCIA_DO_PROJETIL.unidadesPorCasa;
  return (longe ? interpolar(DISTANCIA_DO_PROJETIL.tiroDistante, d) : 1) * (perto ? interpolar(DISTANCIA_DO_PROJETIL.queimaRoupa, d) : 1);
}

/**
 * (13/10) O que a DISTÂNCIA até `alvo` dá ao acerto de PROJÉTIL de uma habilidade (a ficha da habilidade é montada sem alvo — `acoes.contaDoDano`;
 * o golpe básico já passa o alvo a `fichaDoGolpe`): `{ incPct, mais }` — o "aumentado" ("aumentado em 40% aos alvos no início de seu
 * movimento, reduzido para 0%", o Tiro Longo) e o "mais" ("até 30% mais Dano aos alvos no início", "ganham Dano ao viajar adiante, até 30%
 * mais", e as keystones Tiro Distante / Queima-Roupa). Do colado (tudo do "perto") a 6 casas (tudo do "longe").
 */
export function projetilNoAlvo(ficha, tags, alvo, estado, uso = null) {
  const t = new Set(tags ?? []);
  const pos = estado?.hunt?.pos;
  if (!ligado() || !ficha?.afPoe || !t.has('projetil') || !alvo || !pos) return { incPct: 0, mais: 1 };
  const s = somaPorTags(ficha, [...t]);
  // (lote 33: as rampas do PoB, em unidades — `RAMPAS_DE_DISTANCIA`; antes, do colado a 6 casas em linha)
  const u = unidadesAte(alvo, pos);
  const noInicio = interpolar(RAMPAS_DE_DISTANCIA.noInicio, u);
  const viajando = interpolar(RAMPAS_DE_DISTANCIA.viajando, u);
  const de = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  return {
    incPct: de('projetil_perto_dmg_inc') * noInicio + de('projetil_longe_inc') * viajando,
    mais: Math.max(0, 1 + (de('projetil_perto_mais') * noInicio + de('projetil_longe_mais') * viajando) / 100) * pelaDistancia(ficha, t, alvo, estado, s) * rampaDoUso(uso, u),
  };
}
/**
 * (lote A3, dono 19/10 — F2, D2: "a rampa do Pulso segue o PoB") A RAMPA DE DISTÂNCIA da gema (DistanceRamp do PoB, × o ProjectileSpeedMod do uso):
 * "X% mais/menos Dano" de 0 até 60 unidades × o mod — o Pulso Congelante (−50%, act_int.lua:7687) e o Olho Invernal (+200%, act_int.lua:5519).
 * `uso`: `{ rampaMaisPct, modVel }`; `u`: a distância em unidades (as casas × 20 — o colado, 20). Sem rampa, 1.
 */
export function rampaDoUso(uso, u) {
  const pct = Number(uso?.rampaMaisPct) || 0;
  if (!pct || u == null) return 1;
  const ate = 60 * Math.max(0.05, Number(uso.modVel) || 1);
  return Math.max(0, 1 + (pct * Math.min(1, Math.max(0, u / ate))) / 100);
}
/** (lote A3, F2) A chance de Congelar da rampa do Pulso Congelante: X% em 0 unidades, caindo a 0 em 15 × o ProjectileSpeedMod (act_int.lua:7688). */
export function congelarDaRampa(uso, u) {
  const pct = Number(uso?.rampaCongelar) || 0;
  if (!pct || u == null) return 0;
  const ate = 15 * Math.max(0.05, Number(uso.modVel) || 1);
  return pct * Math.max(0, 1 - u / ate);
}

/**
 * (lote A5b, dono 20/10) A PRECISÃO pela conta da ficha (`ficha.contaDaPrecisao`): (base + fixos + a LOCAL da arma da mão + `fixos` a mais) × (1 + (o % da ficha +
 * `pct` a mais)/100) × os "menos/mais" da ficha. A mão: a principal, a `secundaria` (a arma dela, com duas armas) ou `ambas` (o golpe que combina as duas — a
 * média das duas locais).
 */
export function precisaoDaConta(c, mao = null, { fixos = 0, pct = 0 } = {}) {
  if (!c) return 0;
  const lp = Number(c.localPrincipal) || 0;
  const ls = Number(c.localSecundaria) || 0;
  const local = mao === 'secundaria' ? ls : mao === 'ambas' ? (lp + ls) / 2 : lp;
  return Math.round(simples(c.base, { fixos: c.fixos + local + fixos, pct: c.pct + pct }).bruto * c.fator);
}
export function fichaDoGolpe(ficha, tags = [], { alvo = null, estado = null, rng = Math.random } = {}) {
  if (!ligado() || !ficha?.afPoe) return ficha;
  const agora = estado?.hunt?.clock ?? 0;
  const t = new Set([...tags, ...tagsDoAlvo(alvo, agora)]);
  if (alvo && alvo.maxHp > 0 && alvo.hp <= VIDA_BAIXA * alvo.maxHp) t.add('alvoVidaBaixa');
  else if (alvo && alvo.maxHp > 0) t.add('alvoNaoVidaBaixa');
  if (alvo && estado?.hunt?.pos && Math.max(Math.abs(alvo.x - estado.hunt.pos.x), Math.abs(alvo.y - estado.hunt.pos.y)) <= 2) t.add('alvoPerto');
  // (lote D) A mão do ataque: a secundária (`Ficha.fichaDaMao` → `mao`), as duas (a Cutilada) ou a principal.
  if (t.has('ataque')) {
    if ((ficha.intervaloDoGolpeMs ?? 0) > 1000) t.add('ataqueLento');
    // ("Clamores não podem Impelir Habilidades de Deslocamento": a de Movimento não leva nem gasta o Impelir.)
    const semNoDeslocamento = t.has('movimento') && Number(ficha.afPoe.clamor_nao_impele_movimento) > 0;
    // (lote G20a: o ataque do totem não é Impelido — no PoE, só os seus)
    // (lote A1b, dono 19/10: D-b, e a revisão do dono) o ataque que gasta a Emboscada é Impelido POR ELA (`Acoes.emboscadaNoGolpe` marca `golpe`): leva a
    // `impelido` genérica (os "Ataques Impelidos …" da árvore, das peças e dos suportes valem) e a `impelidoEmboscada`, mas NÃO a `impelidoClamor` — "Ataques
    // Impelidos por esta Habilidade não podem ser Impelidos por outras Habilidades": os bônus do buff do Clamor não valem nele
    // (revisão do C1: a habilidade que não pode ser Impelida — `naoImpelivel`, NeverExertable no PoB: as Vaal de ataque, a Tormenta de Espadas, a Evisceração… — não é
    // Impelida nem pela Emboscada nem pelo Clamor)
    const naoImpelivel = t.has('naoImpelivel');
    const daEmboscada = !naoImpelivel && !t.has('totem') && !!estado?.hunt?.emboscada?.golpe && (estado.hunt.emboscada.ate ?? 0) > agora;
    if (daEmboscada) { t.add('impelido'); t.add('impelidoEmboscada'); }
    // (lote G-A, D2: o Impelir do Sísmico só vale nas Pancadas, o do Ancestral só nos Golpes — `GemasGAC.impeleEste`)
    // (lote S1, dono 26/10: um Impelir por Clamor — todos os que alcançam este ataque, `GemasGAC.impelemEste`)
    else if (!naoImpelivel && !semNoDeslocamento && !t.has('totem') && estado?.hunt?.impelidos) {
      const impelem = GemasGAC.impelemEste(estado.hunt.impelidos, [...t], agora);
      if (impelem.length) { t.add('impelido'); t.add('impelidoClamor'); for (const x of impelem) if (x.de) t.add(`impelidoClamor_${x.de}`); }
    }
    // (revisão G, 26/10: `impelidoClamor_<slug>` — DE QUAL Clamor é o Impelir; os bônus do buff de cada Clamor só valem no ataque Impelido por ele — `GemasPoe.adds`)
    if (estado?.hunt?.poeTerceiroGolpe) t.add('terceiroGolpe');
    if (ficha.mao === 'secundaria' || ficha.mao === 'ambas') t.add('maoSecundaria');
    if (ficha.mao !== 'secundaria') t.add('maoPrincipal');
  }
  const s = somaPorTags(ficha, [...t]);
  // (17/10, lote G6) o que as suas MARCAS/maldições no alvo dão a este golpe ("Acertos contra Inimigos Amaldiçoados ganham…", "…Dreno de Vida
  // quando Acertados por Ataques" — `contra.golpe` da maldição do bicho, × o efeito dela; `@ataque`: só nos ataques)
  const contraOAlvo = {};
  for (const m of Object.values(alvo?.maldicoes ?? {})) {
    if (!m?.contra || !(m.ate > agora)) continue;
    for (const [k, v] of Object.entries(m.contra.golpe ?? {})) {
      const { stat, conds } = partir(k);
      if (conds.every((c) => t.has(c))) contraOAlvo[stat] = (contraOAlvo[stat] ?? 0) + v * (m.contra.fator ?? 1);
    }
  }
  for (const [k, v] of Object.entries(contraOAlvo)) s[k] = (s[k] ?? 0) + v;
  // (lote F) A DISTÂNCIA até o alvo, em casas (1 = colado): os projéteis que ganham ou perdem dano conforme viajam — "Projéteis causam Dano
  // aumentado em 40% aos alvos no início de seu movimento, reduzido para 0%" (`projetil_perto_dmg_inc`), "até 30% mais Dano aos alvos no
  // início" (`projetil_perto_mais`), "ganham Dano ao viajar adiante, até 30% mais" (`projetil_longe_mais`), "Flechas ganham Chance de Golpe
  // Crítico enquanto viajam adiante, até 100%" (`flecha_longe_crit_inc`). (lote 33: as rampas do PoB, em unidades — `RAMPAS_DE_DISTANCIA`.)
  const pos = estado?.hunt?.pos;
  const u = unidadesAte(alvo, pos);
  const perto = u == null ? 0 : interpolar(RAMPAS_DE_DISTANCIA.noInicio, u);
  const longe = u == null ? 0 : interpolar(RAMPAS_DE_DISTANCIA.viajando, u);
  const doProjetil = (k) => (t.has('projetil') ? (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0) : 0);
  // (lote F) "Causa 1% mais Dano com Acertos e Afecções contra Inimigos Raros e Únicos por cada segundo que passarem em sua Presença, máximo
  // de 100%" (`mais_dano_presenca:<máx>` = X; o tempo de cada um — `mods-poe.aurasProximas`).
  let daPresenca = 0;
  if ((t.has('alvoRaro') || t.has('alvoUnico')) && alvo?.estados?.presencaMs > 0) {
    for (const [k, x] of Object.entries(ficha.afPoe)) if (k.startsWith('mais_dano_presenca:') && x > 0) daPresenca += Math.min(Number(k.slice('mais_dano_presenca:'.length)) || 0, (x * alvo.estados.presencaMs) / 1000);
  }
  // A Fúria do PoE ("Fúria concede Dano Mágico ao invés": nas magias).
  // (lote A2, dono 19/10: "A Fúria segue o PoB" — CalcPerform.lua:886-895: o Efeito da Fúria é floor(Fúria × (1 + "Efeito da Fúria aumentado")) e
  // cada ponto dá 1% de Dano MAIS — `Damage MORE` com a flag do Ataque, ou da Magia —, não aumentado; multiplica no `fator`, abaixo)
  const furiaNaMagia = (Number(ficha.afPoe.furia_magica) || 0) > 0;
  // (+ lote F: "Efeito da Fúria aumentado em X%"; lote A2: + o do Berserk — `efeito_furia` no buff dele)
  const furia = (furiaNaMagia ? t.has('magia') : t.has('ataque')) ? efeitoDaFuria(estado, ficha.afPoe) : 0;
  // (O "Dano aumentado" sem condição já está em `danoDoElemento` da ficha; aqui só o condicional e a Fúria.)
  // (13/10: + o Tiro Longo — "Projéteis ganham Dano conforme viajam adiante, causando Dano aumentado em até X% com Acertos em alvos":
  // `projetil_longe_inc`, do colado a 6 casas)
  // (14/10, a Maestria de Varinhas: "Ataques têm 100% de Poder Arcano ao usar uma varinha" — o lembrete do PoE: "Poder Arcano faz com que
  // aumentos e reduções de dano mágico também se apliquem ao dano de ataque na mesma porcentagem do seu valor": o "Dano Mágico aumentado"
  // × o %, no "aumentado" do ataque)
  const arcano = t.has('ataque') ? (Number(ficha.afPoe.poder_arcano) || 0) + (s.poder_arcano ?? 0) : 0;
  const doArcano = arcano > 0 ? (((ficha.danoDeMagiaDoPoe ?? 0) + (s.spell_dmg ?? 0)) * arcano) / 100 : 0;
  const danoGeral = (s.dmg_inc ?? 0) + doProjetil('projetil_perto_dmg_inc') * perto + doProjetil('projetil_longe_inc') * longe + doArcano;
  // (lote G13: + a aura de crítico das Minas da gema no alvo — `minaCritico`; lote 57: + o Solo Profano — "Acertos contra inimigos em Solo Profano têm
  // chance de golpe crítico aumentada em 100%")
  const critInc = (s.crit_chance_inc ?? 0) + (t.has('arco') ? doProjetil('flecha_longe_crit_inc') * longe : 0) + (alvo && ativo(alvo.estados?.minaCritico, agora) ? alvo.estados.minaCritico.pct ?? 0 : 0) + (t.has('alvoNoSoloProfano') ? SOLO_PROFANO.critIncPct : 0);
  const critMult = s.crit_dmg ?? 0;
  const pen = s.elem_pen ?? 0;
  // (13/10: + o "mais Dano Degenerativo" com condição — `dano_dot_mais@magia`, "Mais X% de dano degenerativo com habilidades mágicas")
  // (+ lote G17: o "não pode" — o Foco Elemental e a Sede de Sangue, nas linhas dos suportes)
  // (lote A5, dono 20/10: + o máximo da Eletrização, o −X% de Fogo dos Incendiados, o "Eletriza ao resfriar / Resfria ao eletrizar" do Coursing Current e o Resfriamento Ósseo —
  // as linhas da gema e dos suportes que as afecções do golpe leem)
  const temAfeccao = Object.keys(s).some((k) => /^(chance_|dot_|dano_dot_|ailment_|poison_|bleed_|ignite_|duracao_|efeito_|envenena|pode:|nao_pode:|congelamento_como|eletrizacao_como|resfriamento_como|eletrizacao_maximo|res_menos_|eletriza_ao_|resfria_ao_|resfriado_fragil_gelo|sangramento_mais_rapido)/.test(k));
  // Os sorteios do golpe: "Dano Dobrado"/"Triplicado" e "ignorar a Redução de Dano Físico" (a chance sem condição + a do golpe).
  const chance = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  const triplo = chance('chance_dano_triplo') > 0 && rng() * 100 < chance('chance_dano_triplo');
  // (lote D2, dono 27/10: + a chance das Minas de Alto Impacto perto do alvo — `minaDobro`, o golpe com alvo)
  const doAltoImpacto = alvo && ativo(alvo.estados?.minaDobro, agora) ? alvo.estados.minaDobro.pct ?? 0 : 0;
  const dobro = !triplo && chance('chance_dano_dobrado') + doAltoImpacto > 0 && rng() * 100 < chance('chance_dano_dobrado') + doAltoImpacto;
  const ignora = chance('ignora_reducao_fisica') > 0 && rng() * 100 < chance('ignora_reducao_fisica');
  const invertida = chance('chance_res_invertida') > 0 && rng() * 100 < chance('chance_res_invertida');
  // (lote S2B: a Tríade Profana — "X% de chance de ignorar a resistência a dano de caos e elétrico do inimigo", sorteado por acerto)
  const ignoraCaosRaio = chance('s2b_ignora_res_caos_raio') > 0 && rng() * 100 < chance('s2b_ignora_res_caos_raio');
  const f = { ...ficha };
  f.tagsDoGolpe = [...t];
  // (lote A5b, dono 20/10: a PRECISÃO deste golpe — o "+X de Precisão" e o "X% de Precisão aumentada" com as tags dele: a gema e os suportes (a Precisão
  // Adicional, pela tag `habilidade`) somam à conta da ficha, como o PoE soma os modificadores da habilidade; e o "Não pode ser Evadido" da gema — o mesmo
  // `nuncaErra` do "Acertos não podem ser Evadidos" — `Defesa.errou`)
  if (ficha.contaDaPrecisao && ((s.accuracy ?? 0) || (s.accuracy_inc ?? 0))) f.accuracy = precisaoDaConta(ficha.contaDaPrecisao, ficha.mao, { fixos: s.accuracy ?? 0, pct: s.accuracy_inc ?? 0 });
  if ((s.nunca_erra ?? 0) > 0) f.nuncaErra = true;
  // (lote 71: o golpe já Dobrado/Triplicado — o "Seus Golpes Críticos têm chance de causar Dano Dobrado" não dobra de novo: `Ficha.rolarCritico`)
  f.danoDobradoNoGolpe = triplo || dobro;
  // "X% mais/menos Dano" (com condição): multiplica o golpe inteiro (o mesmo fator das cargas, em `Ficha.rolarCritico`).
  const mais = (s.mais_dano ?? 0) + (Number(ficha.afPoe.mais_dano) || 0);
  const maisDoCaminho = Math.max(0, 1 + (doProjetil('projetil_perto_mais') * perto + doProjetil('projetil_longe_mais') * longe + daPresenca) / 100);
  // (lote F) "Acertos têm X% de chance de causar Y% mais Dano em Área": `chance_mais_dano_area:<Y>` = X (só o golpe em Área).
  let maisArea = 1;
  if (t.has('area')) for (const [k, x] of Object.entries(ficha.afPoe)) if (k.startsWith('chance_mais_dano_area:') && x > 0 && rng() * 100 < x) maisArea *= 1 + (Number(k.slice('chance_mais_dano_area:'.length)) || 0) / 100;
  // (+ lote 33, P045: o Impacto — "até X% mais Dano Corpo a Corpo … baseado na proximidade", `maisPelaProximidade`)
  const fator = (triplo ? 3 : dobro ? 2 : 1) * Math.max(0, 1 + mais / 100) * (1 + furia / 100) * maisArea * maisDoCaminho * pelaDistancia(ficha, t, alvo, estado) * maisPelaProximidade(ficha, t, alvo, estado);
  if (fator !== 1) f.fatorDasCargas = (ficha.fatorDasCargas ?? 1) * fator;
  // (lote A5b, dono 20/10) a Técnica Precisa POR USO: "40% mais Dano de Ataque se a Precisão for maior que a Vida máxima" — a precisão deste golpe (a do uso)
  if (ficha.tecnicaPrecisa && t.has('ataque') && estado) {
    const vale = (f.accuracy ?? 0) > (estado.maxHp ?? Infinity);
    if (vale !== ficha.tecnicaPrecisa.aplicada) {
      f.fatorDasCargas = (f.fatorDasCargas ?? 1) * (vale ? ficha.tecnicaPrecisa.fator : 1 / ficha.tecnicaPrecisa.fator);
      f.tecnicaPrecisa = { ...ficha.tecnicaPrecisa, aplicada: vale };
    }
  }
  // (lote 30, P016/P076) o "X% mais Dano de <tipo>" com as condições deste golpe (o sem condição está na ficha) — `fatorRecebidoPeloBicho` o
  // aplica só na parte daquele tipo.
  const maisDoElemento = Object.fromEntries(Object.entries(MAIS_DANO_DO_TIPO).map(([el, k]) => [el, (s[k] ?? 0) + (Number(ficha.afPoe[k]) || 0)]).filter(([, x]) => x));
  if (Object.keys(maisDoElemento).length) f.maisDoElemento = maisDoElemento;
  if (ignora) f.ignoraReducaoFisica = true;
  if (invertida) f.resInvertida = true;
  if (ignoraCaosRaio) f.ignoraResDe = ['chaos', 'energy'];
  // O "aumentado" de UM elemento com condição ("Dano de Gelo aumentado com Habilidades de Ataque"), a penetração de um elemento, o dano
  // somado com condição ("contra Inimigos Resfriados") e o roubo com condição ("contra Inimigos Eletrizados").
  const doElemento = { physical: (s.phys_dmg ?? 0), fire: s.fire_dmg ?? 0, ice: s.ice_dmg ?? 0, energy: s.energy_dmg ?? 0, chaos: s.chaos_dmg ?? 0 };
  const temElemento = Object.values(doElemento).some(Boolean);
  if (danoGeral || temElemento) f.danoDoElemento = Object.fromEntries(Object.entries({ physical: 0, fire: 0, ice: 0, energy: 0, chaos: 0, ...(ficha.danoDoElemento ?? {}) }).map(([el, v]) => [el, v + danoGeral + (doElemento[el] ?? 0)]));
  // A escala do ALVO ("Ganha X% do Dano de Gelo como Dano de Fogo Extra por Y% de Efeito de Resfriamento no Inimigo"): o efeito no bicho agora.
  const doAlvo = {};
  if (alvo) for (const x of escaladosPeloAlvo(ficha.afPoe)) {
    if (!x.tags.every((c) => t.has(c))) continue;
    const m = fatorDoAlvo(alvo, agora, x.escala);
    if (m) doAlvo[x.stat] = (doAlvo[x.stat] ?? 0) + comTeto(x.valor, m, x.teto);
  }
  for (const [k, v] of Object.entries(doAlvo)) s[k] = (s[k] ?? 0) + v;
  // (o que a escala do ALVO deu — `valor` soma, para quem lê pela ficha do golpe: a conversão das partes, os eventos…)
  if (Object.keys(doAlvo).length) f.extrasDoAlvo = doAlvo;
  else delete f.extrasDoAlvo;
  // (lote G6: o da Marca também, para quem lê pelo `valor` — a Vida/Mana por acerto do `aoAcertar`)
  if (Object.keys(contraOAlvo).length) f.extrasDoAlvo = { ...(f.extrasDoAlvo ?? {}), ...Object.fromEntries(Object.entries(contraOAlvo).map(([k, v]) => [k, v + (Number(f.extrasDoAlvo?.[k]) || 0)])) };
  // ("Adiciona X a Y de Dano de Caos para cada Maldição no Inimigo" — nos ataques e nas magias: × as maldições no alvo agora.)
  const porMaldicao = [Number(ficha.afPoe.added_chaos_por_maldicao_min) || 0, Number(ficha.afPoe.added_chaos_por_maldicao_max) || 0];
  const maldicoes = (porMaldicao[0] || porMaldicao[1]) && alvo ? maldicoesNoAlvo(alvo, agora) : 0;
  if (maldicoes) {
    for (const p of ['added', 'spell_added']) {
      s[`${p}_chaos_dmg_min`] = (s[`${p}_chaos_dmg_min`] ?? 0) + porMaldicao[0] * maldicoes;
      s[`${p}_chaos_dmg_max`] = (s[`${p}_chaos_dmg_max`] ?? 0) + porMaldicao[1] * maldicoes;
    }
  }
  const somado = {};
  for (const el of ['fire', 'ice', 'energy', 'chaos', 'physical']) {
    const a = s[`added_${el}_dmg_min`] ?? 0;
    const b = s[`added_${el}_dmg_max`] ?? 0;
    if (a || b) somado[el] = [a, b];
  }
  if (Object.keys(somado).length) {
    const novo = { ...(ficha.danoSomado ?? {}) };
    for (const [el, [a, b]] of Object.entries(somado)) novo[el] = [(novo[el]?.[0] ?? 0) + a, (novo[el]?.[1] ?? 0) + b];
    f.danoSomado = novo;
    const novoM = { ...(ficha.danoSomadoMagia ?? {}) };
    for (const el of ['fire', 'ice', 'energy', 'chaos', 'physical']) { const a = s[`spell_added_${el}_dmg_min`] ?? 0; const b = s[`spell_added_${el}_dmg_max`] ?? 0; if (a || b) novoM[el] = [(novoM[el]?.[0] ?? 0) + a, (novoM[el]?.[1] ?? 0) + b]; }
    f.danoSomadoMagia = novoM;
  }
  if (s.life_leech) f.lifeLeech = (ficha.lifeLeech ?? 0) + s.life_leech / 100;
  if (s.mana_leech) f.manaLeech = (ficha.manaLeech ?? 0) + s.mana_leech / 100;
  // "Nunca causa Acertos Críticos" / "Não pode Causar Golpes Críticos com Ataques".
  if ((s.nunca_critico ?? 0) > 0) { f.critChance = 0; f.critMagiaPoe = ficha.critMagiaPoe ? { fixa: -100, aumentada: 0 } : null; f.critChanceMagia = 0; return finalizar(f, ficha, s, temAfeccao); }
  // (lote 54) o crítico BASE a mais deste golpe (`crit_base_golpe` — a Fúria Fulminante nos ataques com escudo): soma à base, antes do "aumentado"
  const baseDoGolpe = (s.crit_base_golpe ?? 0) / 100;
  if ((critInc || baseDoGolpe) && ficha.critPontos != null) {
    const teto = ficha.critTeto ?? 1;
    f.critChance = Math.min(teto, Math.max(0, (ficha.critPontos + baseDoGolpe) * (1 + ((ficha.critInc ?? 0) + critInc) / 100) * (ficha.critMais ?? 1)));
    // (a chance refeita volta a ser Sortuda só se a da ficha era — `critSortudo`; senão o sorteio do golpe rola duas vezes)
    if (ficha.critSortudo) f.critChance = Math.min(teto, 1 - (1 - Math.min(1, f.critChance)) ** 2);
    if (ficha.critMagiaPoe) f.critMagiaPoe = { ...ficha.critMagiaPoe, aumentada: ficha.critMagiaPoe.aumentada + critInc };
    if (ficha.critChanceMagia != null) f.critChanceMagia = Math.min(teto, Math.max(0, (ficha.critPontos + baseDoGolpe) * (1 + ((ficha.critInc ?? 0) + (ficha.critIncMagia ?? 0) + critInc) / 100) * (ficha.critMais ?? 1)));
  }
  if (s.crit_chance) f.critChance = Math.min(ficha.critTeto ?? 1, (f.critChance ?? 0) + s.crit_chance / 100);
  // (lote D) "X% mais Chance de Crítico contra Inimigos com Vida Baixa" (com condição do golpe): multiplica a chance deste golpe.
  if (s.crit_mais_pct) {
    const m = Math.max(0, 1 + s.crit_mais_pct / 100);
    f.critChance = Math.min(ficha.critTeto ?? 1, (f.critChance ?? 0) * m);
    if (f.critChanceMagia != null) f.critChanceMagia = Math.min(ficha.critTeto ?? 1, f.critChanceMagia * m);
  }
  // (O multiplicador FIXO — "Seu Multiplicador de Acerto Crítico é N%" — e o "Golpes Críticos não causam Dano extra" não somam o do golpe.)
  const multFixo = Number(ficha.afPoe?.crit_multi_fixo) > 0 || Number(ficha.afPoe?.critico_sem_dano_extra) > 0;
  if (critMult && !multFixo) f.critMultiplier = (ficha.critMultiplier ?? 1.5) + critMult / 100;
  // (lote A5, dono 20/10: o "Golpes Críticos não causam Dano extra" da GEMA — a Queda de Lâminas do Empalamento —: o multiplicador do golpe em 100%; o
  // bruto — o das afecções da Agonia Perfeita — fica)
  if ((s.critico_sem_dano_extra ?? 0) > 0) f.critMultiplier = 1;
  // (o multiplicador de crítico BRUTO — o da Agonia Perfeita, que tira o dano extra do crítico mas usa o multiplicador nas afecções)
  if (critMult && ficha.critMultiplierBruto != null) f.critMultiplierBruto = ficha.critMultiplierBruto + critMult / 100;
  const penPorElemento = { fire: s.fire_pen ?? 0, ice: s.ice_pen ?? 0, energy: s.energy_pen ?? 0 };
  if (pen || s.phys_pen || Object.values(penPorElemento).some(Boolean)) {
    const p = ficha.penetracao ?? { fisica: 0, elemental: 0, porElemento: {} };
    const pe = { ...(p.porElemento ?? {}) };
    for (const [el, v] of Object.entries(penPorElemento)) if (v) pe[el] = (pe[el] ?? 0) + v;
    f.penetracao = { ...p, elemental: Math.min(100, (p.elemental ?? 0) + pen), fisica: Math.min(100, (p.fisica ?? 0) + (s.phys_pen ?? 0)), porElemento: pe };
  }
  return finalizar(f, ficha, s, temAfeccao);
}
function finalizar(f, ficha, s, temAfeccao) {
  if (temAfeccao && ficha.recalcularAfeccoes) f.afeccoes = ficha.recalcularAfeccoes({ ...ficha.afPoe, ...somarSobre(ficha.afPoe, s) });
  // (as afecções do golpe sabem o multiplicador de crítico dele — "Multiplicador de Dano Degenerativo para Afecções é igual ao Multiplicador
  // de Golpe Crítico", a Agonia Perfeita)
  if (f.afeccoes?.agoniaPerfeita) f.afeccoes = { ...f.afeccoes, multiplicadorDoCritico: f.critMultiplierBruto ?? f.critMultiplier };
  return f;
}

/** As tags do ALVO num acerto/evento (o que as condições `alvo*` leem): os estados dele agora e a raridade. */
/** As defesas do BICHO (armadura, evasão): quem sabe é `mobs/atributos` — a caçada registra (este módulo não o importa: o ciclo de imports). */
// eslint-disable-next-line no-var
var defesasDoBicho;
export function definirDefesasDoBicho(fn) { defesasDoBicho = fn; }
export function tagsDoAlvo(alvo, agora) {
  const t = [];
  if (!alvo) return t;
  const e = alvo.estados ?? {};
  const at = (x) => !!x && x.ate > agora;
  if (at(e.lento)) t.push('alvoResfriado', 'alvoLento');
  // (lote C4, dono 21/10) o Tolhido (o Hinder do PoE, `estados.tolhido` — o "Inimigos Desacelerados por você"): Lento, não Resfriado
  else if (at(e.tolhido)) t.push('alvoLento');
  if (at(e.congelado)) t.push('alvoCongelado');
  if (at(e.chocado)) t.push('alvoEletrizado');
  if (at(e.cego)) t.push('alvoCego');
  if (at(e.mutilado)) t.push('alvoMutilado');
  // (lote 31: o Provocado pelo Clamor também é Provocado)
  if (at(e.provocado) || provocadoPeloClamor(alvo, agora)) t.push('alvoProvocado');
  if (provocadoPeloClamor(alvo, agora)) t.push('alvoProvocadoClamor');
  if (at(e.atordoado)) t.push('alvoAtordoado');
  if (at(e.excomungado)) t.push('alvoExcomungado');
  // (o inimigo sem Armadura / sem Evasão — "ao Acertar um Inimigo sem Armadura": as defesas do bicho, pelo gancho da caçada)
  const defesas = defesasDoBicho?.(alvo);
  if (defesas) { if (!(defesas.armadura > 0)) t.push('alvoSemArmadura'); if (!(defesas.evasao > 0)) t.push('alvoSemEvasao'); }
  const dots = alvo.dots ?? [];
  const dot = (...k) => dots.some((d) => k.includes(d.tipo) && d.falta > 0);
  if (dot('sangramento')) t.push('alvoSangrando');
  if (dot('veneno', 'venenoPoe')) t.push('alvoEnvenenado');
  if (dot('queimadura')) t.push('alvoIncendiado');
  // (+ a MALDIÇÃO do PoE posta pelo acerto — `alvo.maldicoes`, `Reforcos.marcar`: antes as regras "@alvoAmaldicoado" não a viam)
  if (dot('maldicao') || at(e.amaldicoado) || amaldicoadoPorVoce(alvo, agora)) t.push('alvoAmaldicoado');
  if (marcaNoBicho(alvo, agora)) t.push('alvoMarcado');
  if (noSoloProfano(alvo, agora)) t.push('alvoNoSoloProfano');
  // ("contra Inimigos Afetados por ao menos N Venenos": `alvoVenenos:N` para cada N até o número de venenos no alvo)
  const venenos = dots.filter((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0).length;
  for (let n = 1; n <= Math.min(venenos, 100); n++) t.push(`alvoVenenos:${n}`);
  if (at(e.chocado) || at(e.congelado)) t.push('alvoEletrizadoOuCongelado');
  if (['alvoResfriado', 'alvoCongelado', 'alvoEletrizado', 'alvoSangrando', 'alvoEnvenenado', 'alvoIncendiado'].some((x) => t.includes(x)) || at(e.causticado) || at(e.fragilizado) || at(e.exaurido)) t.push('alvoComAfeccao');
  const rar = alvo.raridade ?? alvo.raridadePoe;
  if (rar === 'raro') t.push('alvoRaro');
  if (rar === 'unico' || alvo.boss || alvo.chefe) t.push('alvoUnico');
  if (rar === 'magico') t.push('alvoMagico');
  if (alvo.maxHp > 0 && alvo.hp >= alvo.maxHp) t.push('alvoVidaCheia');
  // (11/10) o alvo com "Vida Não Pode ser Drenada" (o modificador do monstro — "contra Inimigos que não podem ter Vida Drenada deles").
  if (alvo.semDreno) t.push('alvoSemDreno');
  // (lote F) o alvo com Escudo de Energia ("aos inimigos que tiverem Escudo de Energia" — o escudo dos monstros do PoE, `esPoe`).
  if ((alvo.esPoe?.atual ?? 0) > 0) t.push('alvoComEscudo');
  // (lote D) com Exposição a um elemento ("contra inimigos com Exposição a Raio").
  for (const [el, tag] of [['fire', 'alvoExposicaoFogo'], ['ice', 'alvoExposicaoGelo'], ['energy', 'alvoExposicaoRaio']]) if ((e.exposicao?.[el] ?? 0) > agora) t.push(tag);
  return t;
}
const somarSobre = (base, s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, (base[k] ?? 0) + v]));

/**
 * (17/10, lote G7) O ALVO no golpe das GEMAS: a ficha da habilidade é montada sem alvo (`acoes.contaDoDano`), então o que depende DELE — os
 * condicionais da soma com tag de alvo ("Chance de Crítico aumentada em X% contra Inimigos Eletrizados" = `crit_chance_inc@alvoEletrizado`, "X%
 * mais Dano contra Inimigos em Vida Cheia", os da árvore e das peças), as escalas do alvo (o Resfriamento/a Eletrização nele) e o que as suas
 * Marcas no alvo dão (`contra.golpe`) — não entrava nos acertos das gemas (só no golpe básico, que monta a ficha com o alvo). Devolve `{ s, tags }`:
 * a SOMA a mais deste alvo (só o que depende dele) e as tags do golpe com as do alvo. O resto (a distância, a proximidade) já é alvo a alvo.
 */
export function golpeNoAlvo(ficha, alvo, agora) {
  if (!ligado() || !alvo || !ficha) return null;
  const doAlvo = new Set(tagsDoAlvo(alvo, agora));
  if (alvo.maxHp > 0 && alvo.hp <= VIDA_BAIXA * alvo.maxHp) doAlvo.add('alvoVidaBaixa');
  else if (alvo.maxHp > 0) doAlvo.add('alvoNaoVidaBaixa');
  const t = new Set([...(ficha.tagsDoGolpe ?? []), ...doAlvo]);
  const s = {};
  for (const x of ficha.porTag ?? []) if (x.tags.some((tag) => doAlvo.has(tag)) && x.tags.every((tag) => t.has(tag))) s[x.stat] = (s[x.stat] ?? 0) + x.valor;
  for (const x of escaladosPeloAlvo(ficha.afPoe)) {
    if (!x.tags.every((c) => t.has(c))) continue;
    const m = fatorDoAlvo(alvo, agora, x.escala);
    if (m) s[x.stat] = (s[x.stat] ?? 0) + comTeto(x.valor, m, x.teto);
  }
  // (lote G13: a aura de crítico das Minas da gema — "Cada Mina aplica Chance de Golpe Crítico aumentada em X% contra Inimigos próximos")
  if (ativo(alvo.estados?.minaCritico, agora)) s.crit_chance_inc = (s.crit_chance_inc ?? 0) + (alvo.estados.minaCritico.pct ?? 0);
  for (const m of Object.values(alvo.maldicoes ?? {})) {
    if (!m?.contra || !(m.ate > agora)) continue;
    for (const [k, v] of Object.entries(m.contra.golpe ?? {})) {
      const { stat, conds } = partir(k);
      if (conds.every((c) => t.has(c))) s[stat] = (s[stat] ?? 0) + v * (m.contra.fator ?? 1);
    }
  }
  return Object.keys(s).length ? { s, tags: [...t] } : { s, tags: [...t], vazio: true };
}

/** O elemento de uma tag (`'fogo'` → `'fire'`). */
export const elementoDaTag = (tag) => ELEMENTO_DA_TAG[tag] ?? null;

// ---------------------------------------------------------------- a Fúria

/**
 * Fúria do PoE: até 30; 1% de Dano de Ataque MAIS por Fúria. (lote A2, dono 19/10: "A Fúria segue o PoB" — CalcPerform.lua:891-900: o dano é
 * "mais", e a perda inerente é de 10 por segundo, depois de 2 s sem ganhar Fúria; antes, 1% aumentado e 1 a cada 0,5 s.) `perdaPorS`: a perda
 * inerente; `perdaMs` (1000 / 10 = 100 ms por ponto) fica para quem lê o intervalo.
 */
export const FURIA = { maximo: 30, perdaPorS: 10, perdaMs: 100, esperaMs: 2000 };
export function furiaAtual(estado) {
  const f = estado?.hunt?.furia;
  // (lote A2: o teto é a Fúria máxima — `ganharFuria` corta no ganho e o `tiqueDaFuria` a cada tique, quando o máximo cai —, como o PoB:
  // min(Fúria, máximo); antes, 30 fixo aqui, e o "+N ao Máximo de Fúria" do Clamor Vingativo não passava de 30)
  return f ? Math.max(0, f.n | 0) : 0;
}
/** (lote A2) O EFEITO da Fúria agora (o PoB: floor(Fúria × (1 + "Efeito da Fúria aumentado" / 100))) — o % de dano MAIS. */
export const efeitoDaFuria = (estado, af) => Math.floor(furiaAtual(estado) * Math.max(0, 1 + (Number(af?.efeito_furia) || 0) / 100));
/** A Fúria máxima: 30 + "+N à Fúria máxima" (a árvore e as peças), × ½ com "Fúria máxima é reduzida à metade". */
export const maximoDeFuria = (af) => Math.floor((FURIA.maximo + (Number(af?.furia_max) || 0)) * (Number(af?.furia_max_metade) > 0 ? 0.5 : 1));
export function ganharFuria(hunt, n, agora = hunt?.clock ?? 0) {
  if (!hunt || !(n > 0)) return;
  const f = (hunt.furia ??= { n: 0, ganhou: agora, perdeu: agora });
  f.n = Math.min(maximoDeFuria(fichaDa(hunt)?.afPoe), (f.n | 0) + n);
  f.ganhou = agora;
  f.perdeu = agora;
}
// ---------------------------------------------------------------- o Momentum (suporte do PoE)

/**
 * O MOMENTUM (suporte do PoE): "Ganhe 1 de Momentum quando você Usar uma Habilidade Suportada", "Perca todo o Momentum ao se Mover" e "Ao
 * atingir N de Momentum, perca todo o Momentum e ganhe Rapidez por D segundos" (a Rapidez: velocidade de movimento por Momentum perdido).
 * A velocidade de ataque "por Momentum" é lida na hora do uso (`Acoes.temposDaGemaPoe`). `efeito`: o da gema (`Gemas.efeitoNaSkill`).
 * Devolve `{ perdido }` quando chegou no máximo (a ficha muda com a Rapidez), senão null.
 */
export const momentumAtual = (estado) => Math.max(0, estado?.hunt?.momentum?.n | 0);
export function ganharMomentum(hunt, efeito, agora = hunt?.clock ?? 0) {
  const porUso = Number(efeito?.momentumPorUso) || 0;
  if (!hunt || !(porUso > 0)) return null;
  const m = (hunt.momentum ??= { n: 0 });
  m.n = (m.n | 0) + porUso;
  const maximo = Number(efeito.momentumMaximo) || 0;
  if (!(maximo > 0) || m.n < maximo) return null;
  const perdido = m.n;
  m.n = 0;
  if (efeito.rapidezMs > 0) {
    hunt.rapidez = { movimentoPct: (Number(efeito.rapidezMovimentoPct) || 0) * perdido };
    ganharBuff(hunt, 'rapidez', efeito.rapidezMs / 1000, agora);
  }
  return { perdido };
}
/** Andou: perde todo o Momentum. */
export function perderMomentum(hunt) {
  if (hunt?.momentum?.n) hunt.momentum.n = 0;
}

/** O tique da Fúria (a caçada chama): sem ganhar há `esperaMs`, perde 1 a cada `perdaMs`. */
/**
 * A keystone FÚRIA (o Rampage do PoE 1 — `mods-poe.contarRampage`): o contador de abates seguidos, até 1000, zera 5 s sem matar. As 13
 * FAIXAS (o poedb, "Rampage Killstreak") são o "na Fúria" / "quando Enfurecido" dos únicos.
 */
export const RAMPAGE = { maximo: 1000, esperaMs: 5000, faixas: [15, 30, 45, 70, 100, 135, 175, 220, 270, 325, 385, 450, 520] };
/** O fim da Fúria (5 s sem matar): o contador zera; "Perde todas Cargas de Tolerância quando a Fúria termina". */
function tiqueDoRampage(hunt, ficha, agora) {
  const r = hunt.rampage;
  if (!r || r.ate > agora) return;
  delete hunt.rampage;
  if (r.n > 0 && valor(ficha, 'rampage_perde_tolerancia') > 0 && hunt.cargasPoe?.tolerancia) delete hunt.cargasPoe.tolerancia;
  hunt.poeFichaMudou = true;
}

/**
 * (lote 32, P048 — o Ritual da Ruína: "Perca X% de Vida por segundo por Fúria enquanto não estiver perdendo Fúria") A Fúria que você tem
 * enquanto NÃO a perde — 0 enquanto ela cai (a perda inerente começou: 2 s sem ganhar, + o "começa N segundos depois"; ou "Perde N de Fúria
 * por segundo", que tira sempre).
 */
/**
 * (revisão do A2) O começo da espera da perda inerente: o último GANHO de Fúria ou o último ACERTO recebido, o mais recente (o PoE 1: "se você não
 * tiver sido Atingido nem ganhado Fúria nos últimos 2 segundos").
 */
const inicioDaEspera = (hunt, f) => Math.max(f.ganhou ?? -Infinity, hunt?.poeRecente?.acertado ?? -Infinity);
/** (revisão do A2) O Berserk ligado (a Fúria cai o tempo todo enquanto ele dura — `GemasA2.tiqueDoBerserk`). */
const berserkLigado = (hunt, agora) => (hunt?.buffs?.['poe-gema:Berserk']?.ate ?? -Infinity) > agora;
export function furiaSemPerder(hunt, af, agora = hunt?.clock ?? 0) {
  const f = hunt?.furia;
  if (!f || !(f.n > 0) || Number(af?.furia_perde_por_s) > 0 || berserkLigado(hunt, agora)) return 0;
  if (agora - inicioDaEspera(hunt, f) >= FURIA.esperaMs + 1000 * (Number(af?.furia_atraso_s) || 0)) return 0;
  return Math.min(maximoDeFuria(af), f.n | 0);
}
export function tiqueDaFuria(hunt, agora = hunt?.clock ?? 0) {
  const f = hunt?.furia;
  if (!f || !(f.n > 0)) return;
  // (revisão do A2: o teto é o máximo de AGORA — "+N ao Máximo de Fúria" que acabou, "Fúria máxima pela metade" — o PoB: min(Fúria, máximo))
  const maximo = maximoDeFuria(fichaDa(hunt)?.afPoe);
  if (fichaDa(hunt) && f.n > maximo) f.n = maximo;
  // ("Perde N de Fúria por segundo": a perda das peças, sempre — além da inerente.)
  const perdePorS = Number(fichaDa(hunt)?.afPoe?.furia_perde_por_s) || 0;
  if (perdePorS > 0) {
    f.perdaExtraEm ??= agora;
    while (f.n > 0 && agora - f.perdaExtraEm >= 1000) { f.n = Math.max(0, f.n - perdePorS); f.perdaExtraEm += 1000; }
    if (!(f.n > 0)) return;
  } else delete f.perdaExtraEm;
  // (+ lote F: "Perda Inerente de Fúria começa N segundos depois")
  // (revisão do A2: desde o último ganho OU o último acerto recebido)
  if (agora - inicioDaEspera(hunt, f) < FURIA.esperaMs + 1000 * (Number(fichaDa(hunt)?.afPoe?.furia_atraso_s) || 0)) { f.perdeu = agora; return; }
  // ("Perda Inerente de Fúria é X% mais lenta / mais rápida" — a árvore.) (lote A2: o PoB — CalcPerform.lua:900 — 10 × (1 + InherentRageLoss INC):
  // o "mais lenta" é o INC negativo — `furia_perda_lenta` positivo —, e "impede a perda inerente" a zera)
  const porS = FURIA.perdaPorS * Math.max(0, 1 - (Number(fichaDa(hunt)?.afPoe?.furia_perda_lenta) || 0) / 100);
  if (!(porS > 0)) { f.perdeu = agora; return; }
  const perdaMs = 1000 / porS;
  while (f.n > 0 && agora - f.perdeu >= perdaMs) { f.n--; f.perdeu += perdaMs; }
}

/** A chave de um atributo da peça vestida em `slot`, resolvendo a condição de ESPAÇO (anel, mão): no espaço certo, sem a condição; noutro, null. */
export function doAnel(chave, slot) {
  const { stat, escala, conds, teto } = partir(chave);
  const deAnel = conds.filter((c) => CONDICOES_DE_ANEL[c]);
  if (!deAnel.length) return chave;
  if (!deAnel.every((c) => CONDICOES_DE_ANEL[c] === slot)) return null;
  const resto = conds.filter((c) => !CONDICOES_DE_ANEL[c]);
  const base = escala ? `${stat}%${escala}${teto != null ? `~${teto}` : ''}` : stat;
  return resto.length ? `${base}@${resto.join('+')}` : base;
}
/**
 * A escala da PRÓPRIA PEÇA (resolvida peça a peça em `Afixos.somaDeItens`, como o anel): `encaixeLocal:R` = "por Encaixe Vermelho" desta
 * peça (o Punho da Tríade: "Lacaios convertem X% do Dano Físico para Dano de Fogo por Encaixe Vermelho"). Devolve `[chave, valor]` sem a
 * escala (as condições ficam), ou a própria chave.
 */
const TEM_VIDA = /\bVida\b/;
export function daPeca(chave, valor, peca, estado = null) {
  const { stat, escala, conds, teto } = partir(chave);
  // ("+N ao máximo de Vida se não houverem Modificadores de Vida em outros Itens Equipados": as OUTRAS peças vestidas sem mod de Vida.)
  if (conds.includes('semVidaNosOutros')) {
    const outras = Object.entries(estado?.equipment ?? {}).filter(([slot, p]) => p && p !== peca && slot !== 'backpack');
    const temVida = outras.some(([, p]) => [...(p.poe?.implicitos ?? []), ...(p.poe?.prefixos ?? []), ...(p.poe?.sufixos ?? []), ...(p.poe?.modificadores ?? [])].some((m) => TEM_VIDA.test(m.modelo ?? m.texto ?? '')));
    if (temVida) return [chave, 0];
    const resto = conds.filter((c) => c !== 'semVidaNosOutros');
    const base = escala ? `${stat}%${escala}${teto != null ? `~${teto}` : ''}` : stat;
    return daPeca(resto.length ? `${base}@${resto.join('+')}` : base, valor, peca, estado);
  }
  // (lote 28) "Com uma joia Olho X encaixada": `comAbissalLocal:<base>` — vale com uma joia dessa base nos encaixes abissais DESTA peça.
  const local = conds.find((c) => c.startsWith('comAbissalLocal:'));
  if (local) {
    const slug = local.slice('comAbissalLocal:'.length);
    if (!(peca?.poe?.abissais ?? []).some((j) => j && daBaseAbissal(j, slug))) return [chave, 0];
    const resto = conds.filter((c) => c !== local);
    const base = escala ? `${stat}%${escala}${teto != null ? `~${teto}` : ''}` : stat;
    return daPeca(resto.length ? `${base}@${resto.join('+')}` : base, valor, peca, estado);
  }
  // (lote 28) "por joia Olho X encaixada": `abissalLocal:<base>` — as joias dessa base nos encaixes abissais desta peça.
  const abissal = /^abissalLocal(?::(\w+))?$/.exec(escala ?? '');
  if (abissal) {
    const n = (peca?.poe?.abissais ?? []).filter((j) => j && daBaseAbissal(j, abissal[1])).length;
    return [conds.length ? `${stat}@${conds.join('+')}` : stat, comTeto(valor, n, teto)];
  }
  // (+ `gemaLocal:R` — "por gema vermelha encaixada": os encaixes daquela cor COM gema — e `encaixeVazioLocal` — "por encaixe vazio".)
  const m = /^(encaixeLocal|gemaLocal):([RGBW])$|^(encaixeVazioLocal)$/.exec(escala ?? '');
  if (!m) return [chave, valor];
  const s = peca?.soquetes;
  const abertos = (s?.cores ?? []).slice(0, s?.abertos ?? 0);
  const n = m[3] ? abertos.filter((c, i) => !s?.gemas?.[i]).length : abertos.filter((c, i) => c === m[2] && (m[1] === 'encaixeLocal' || !!s?.gemas?.[i])).length;
  return [conds.length ? `${stat}@${conds.join('+')}` : stat, comTeto(valor, n, teto)];
}

/**
 * (lote 28) Os LOCAIS da arma que dependem das Joias Abissais encaixadas nela (o Rasgacarne único: "Dano físico / Velocidade de ataque /
 * Chance de golpe crítico aumentada em X% por joia Olho Y encaixada" — no PoE, locais da arma): `{ phys_dmg_local, atk_speed_local,
 * crit_chance_local }`, já com as joias da peça.
 */
export function locaisAbissais(peca) {
  const r = {};
  for (const [k, v] of Object.entries(peca?.poe?.af ?? {})) {
    if (typeof v !== 'number' || !/%abissalLocal/.test(k)) continue;
    const [k1, v1] = daPeca(k, v, peca);
    if (/^(phys_dmg_local|atk_speed_local|crit_chance_local)$/.test(k1)) r[k1] = (r[k1] ?? 0) + v1;
  }
  return r;
}

/** O nome de uma gema como chave (`Toque de Doryani` → `toque-de-doryani`): o que "Concede a Habilidade X" grava. */
export const slugDoNome = (nome) => String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- os atributos DINÂMICOS (validação da tradução)

/** Os eventos que `mods-poe.evento` dispara e as ações que ele sabe fazer. */
export const EVENTOS = new Set(['incendiarNovo', 'ganharAdrenalina', 'amaldicoarSemMaldicao', 'amaldicoarSemMaldicaoNaoAura', 'usarFrascoVida', 'usarGuarda', 'matar', 'critico', 'bloquear', 'bloquearAtaque', 'bloquearMagia', 'serAcertado', 'serAcertadoCritico', 'atordoar', 'incendiar', 'congelar', 'eletrizar', 'envenenar',
  'acertar', 'usarHabilidade', 'usarMagia', 'usarAtaque', 'usarMovimento', 'usarVaal', 'usarClamor', 'usarFrasco', 'usarFrascoMana', 'suprimir', 'perderTolerancia',
  'maxPoder', 'maxFrenesi', 'maxTolerancia', 'tempo', 'provocar', 'golpeDeMisericordia', 'vidaBaixa', 'equipado', 'perderPoder', 'conjurarMaldicao', 'gastarMana', 'armadilha', 'morrer', 'lancarArmadilha', 'detonarMina', 'drenoCheio', 'rampage', 'empurrar',
  // (ciclo 7, lote D) quando Atordoado; quando sofrer Dano Físico de um Acerto (`mods-poe.aoSerAcertado`).
  'serAtordoado', 'sofrerFisico',
  // (lote G) ao mudar de Postura (`mods-poe.aurasProximas`).
  'mudarPostura',
  // (lote E) a Mina detonou (no jogo, ao usar a gema de Mina — `acoes`); consumiu um cadáver (`mods-poe` → `consumirCadaver`).
  'mina', 'consumirCadaver',
  // (15/10, lote 31 — S001) o abate do seu LACAIO e do seu TOTEM ("por você ou seus Lacaios", "você ou seus Totens Matarem") e a morte de
  // qualquer inimigo, por quem for ("Inimigos Mortos próximos ao seu Estandarte", "Provocados por seus Clamores Explodem ao morrer") —
  // `hunt/combate.matarMonstro`, pelo carimbo de `hunt/quem-feriu`.
  'matarLacaio', 'matarTotem', 'inimigoMorrer',
  // (lote 70) ao Convocar um Totem (`acoes.invocarLacaios`)
  'convocarTotem']);
export const ACOES = new Set(['transferirMarca', 'frascoChance', 'explodirChance', 'buffChance', 'vidaPctChance', 'manaPctChance', 'vidaFaltaPct', 'perdeMana', 'perdeUmaCarga', 'refletir', 'vida', 'vidaPct', 'mana', 'manaPct', 'es', 'esPct', 'carga', 'cargaMax', 'perdeCargas', 'cargaAleatoria', 'buff', 'alvo', 'proximos',
  'dano', 'danoPctVida', 'furia', 'frasco', 'recargaEs', 'explodir', 'gatilho', 'espalhar', 'roubarCargas', 'maldicao', 'soloSagrado', 'soloProfano', 'fumaca', 'removerAfeccao', 'perdeVidaPct', 'perdeEsPct', 'perdeManaPct',
  // (11/10, os únicos)
  'perdeVida', 'esDaArmadura', 'vidaParaEs', 'degenEmVoce', 'statTemp', 'statTempPorMana', 'furiaPorMana', 'transferirMaldicoes', 'degenNoAlvo', 'danoPorMana', 'empurrarProximos',
  // (ciclo 7, lote D) `mods-poe.aplicarAcao`
  'regenPct', 'fortificacao', 'atordoarProximos',
  // (lote E)
  'consumirCadaver', 'vidaDaRegen',
  // (lote F)
  'stat', 'congelarProximos', 'regenDaDefesa', 'vidaChance', 'vidaPorDefinhamento', 'vidaPorVeneno', 'furiaPorPoder',
  // (lote 72) `mods-poe.aplicarAcao`: a carga aleatória por Poder do Clamor e o atributo temporário por Poder
  'cargaAleatoriaPorPoder', 'statTempPorPoder',
  // (lote G)
  'valor', 'mortalha']);
/** Os prefixos de atributo montados pelo nome (`sempre:<buff>`, `efeito_buff:<buff>`, `concede:<gema>`, `suporte_local:<gema>`). */
/**
 * Quem sabe se uma gema existe pelo NOME ("Concede a Habilidade X", "Suportadas por X"): as gemas do PoE carregam depois e `skills/gemas.mjs`
 * registra aqui (neste módulo puro, para a tradução não importar as gemas — o que fecharia um ciclo de imports). `undefined` = não se sabe ainda.
 */
// eslint-disable-next-line no-var
var conhecePelaGema;
export function definirGemasConhecidas(fn) { conhecePelaGema = fn; }
export function gemaConhecida(slug) { return conhecePelaGema ? conhecePelaGema(slug) : undefined; }
/** (lote 55) O id da ação da gema ativa pelo nome (`afetadoPor:<nome>` — "enquanto afetado por <Aura>"): quem registra é `skills/gemas.mjs`. */
// eslint-disable-next-line no-var
var acaoPeloNome;
export function definirAcaoPeloNome(fn) { acaoPeloNome = fn; }
// (lote 56: + `aura_unica:<gema>` — a Visão Sublime, "Habilidades de Aura diferentes de <Aura> são Desabilitadas" — `acoes.auraPermitida`)
// (+ lote 56: `fuga_impossivel:<pedra>` e `proibida_chama:<notável>` / `proibida_carne:<notável>` — `passivas/arvore`)
const DINAMICOS = /^(sempre|efeito_buff|concede|suporte_local|suporte_peitoral|keystone|aura_unica|fuga_impossivel|proibida_chama|proibida_carne):[\w-]+$/;
/** As FAMÍLIAS de atributo com parâmetro que o código monta pelo nome (o parâmetro tem de ser um dos que ele conhece). */
const ELS_P = '(physical|fire|ice|energy|chaos)';
const TIPOS_DE_LACAIO = '(sentinela|zumbi|espectro|golem|esqueleto|totem|espirito|fantasma|reliquia|sagrado|arma|aranha|arqueiro|balista|arauto|qualquer)';
const PARAMETRICOS = [
  new RegExp(`^pode:(incendio|congelamento|resfriamento|eletrizacao|veneno|sangramento):${ELS_P}$`), // itens-poe/afeccoes.daSoma
  new RegExp(`^nao_pode:(incendio|congelamento|resfriamento|eletrizacao|veneno|sangramento)(:${ELS_P})?$`), // itens-poe/afeccoes.daSoma
  new RegExp(`^(max_lacaio|max_lacaio_pct|lacaio_dano|lacaio_mais_dano|lacaio_vida|lacaio_vida_mais|lacaio_vida_fixa|lacaio_mov|lacaio_duracao|lacaio_degen|lacaio_vel_ataque|lacaio_imune_elemental|lacaio_vel_conj|lacaio_armadura|lacaio_cdr|lacaio_regen_pct|lacaio_dano_recente|lacaio_dano_recente_s|lacaio_conv_caos|lacaio_definhar|lacaio_provocar):${TIPOS_DE_LACAIO}$`), // lacaios-poe.oQueInvoca
  /^recarga_gema:[A-Za-z_]+$/, // acoes.temposDaGemaPoe (a recarga de UMA gema, pelo começo do slug)
  // (11/10, os únicos:) o dano físico somado, o Avatar do Fogo (a conversão e o "só Fogo"), Cinzas e Incendiar no acerto, a duração renovada
  // no Raro/Único, o dano drenado para o dono, a explosão do morto e a RESTRIÇÃO ("Você não pode ter Lacaios não-Golens": `so_lacaio:golem`).
  // (11/10, os únicos:) o GATILHO da peça — "Ativa uma Magia Elemental Encaixada ao Bloquear, com 0,25 segundo de Recarga" =
  // `gatilho_local:bloquear:elemental` (o valor é a recarga, em segundos; `acoes.mjs` dispara as gemas da própria peça).
  // (11/10) a reserva de UMA gema: "Ódio tem Eficácia da Reserva de Mana aumentada", "Congelabilidade não tem Reserva se Conjurada como Aura".
  /^(eficiencia_reserva_gema|sem_reserva|max_totem_gema):[\w-]+$/,
  // (lote 67) "<Maldição> pode afetar Inimigos a Prova de Feitiços": o slug da gema (`acoes` — a regra da maldição)
  /^feitico_afeta_aprova:[A-Za-z_]+$/,
  // (11/10) o buff a cada N segundos ("Você ganha Sobrecarga Elemental por 8 segundos a cada 16 segundos" = `buff_periodico:sobrecargaElemental:16`,
  // o valor é a duração) e as auras com valor nos inimigos próximos (a lentidão, as resistências, a de Raio igual à sua) — `mods-poe.aurasProximas`.
  /^buff_periodico:(sobrecargaElemental|adrenalina|agressividade|elusivo|fortificado|furiaArcana|poderProfano|avatarDoFogo|trespassar):\d+$/,
  // (14/10) o altar aleatório a cada N segundos (a Harmonia do Propósito — `mods-poe.aurasProximas`; o valor é a duração base, em segundos)
  /^altar_aleatorio:\d+$/,
  /^aura_proximos_res:(fire|ice|energy|chaos|todas)$/, /^aura_proximos_res_igual:(fire|ice|energy|chaos)$/,
  /^gatilho_local:(usarAtaque|usarMagia|bloquear|critico|acertar|congelar|perderTolerancia|matar|gastarMana):(magia|elemental|fogo|gelo|raio|maldicao|arco|clamor|lacaio)$/,
  new RegExp(`^(lacaio_somado_min|lacaio_somado_max|lacaio_conv_fogo|lacaio_so_fogo|lacaio_cinzas|lacaio_incendiar|lacaio_renova|lacaio_dreno_dono|lacaio_explodir|so_lacaio):${TIPOS_DE_LACAIO}$`), // lacaios-poe.oQueInvoca
  /^res_fixa(_tem)?:(fire|ice|energy|chaos)$/, // ficha (resistência fixa)
  /^frasco_regen_[ns]:(vida|mana|utilidade|todos)$/, /^frasco_instantaneo_baixa:(vida|mana)$/, /^sem_frasco:(vida|mana|utilidade)$/, // itens-poe/frascos
  /^aura_proximos:(cego|mutilado|intimidado|inervado|debilitado|cinzas|causticado|fragilizado|exaurido|lento|provocado|resfriado|exposicaoFogo|exposicaoGelo|exposicaoRaio|amaldicoado|definhado|semCritico)$/, // mods-poe.aurasProximas
  /^efeito_buff_gema:(aura|clamor|arauto|lacaio|todos|golem|vinculo|guarda|estandarte)$/,
  /^efeito_maldicao_expirou:\d+$/, /^maldicao_(lento|dano)_expirou:\d+$/, // acoes.efeitosDaMaldicao → Reforcos.marcar ("Efeito aumentado se Y% da Duração da Maldição expirou") // itens-poe/gemas-poe (reforços das gemas; golem: os bônus dos golens ao dono)
  new RegExp(`^sem_dano:(${ELS_P.slice(1, -1)}|elemental|naocaos|naoelemental|naofisico)$`), new RegExp(`^so_dano:${ELS_P}$`), // transformarPartes
  // (ciclo 7, lote D) mods-poe.aoSerAtordoado ("por 1 segundo por cada 100ms de Duração do Atordoamento") e os periódicos (mods-poe.aurasProximas).
  /^adrenalina_por_atordoamento:\d+$/, /^defender_armadura:\d+$/, /^phys_extra_aleatorio_chance:\d+$/,
  /^periodico:\d+(?:\.\d+)?(?:d\d+(?:\.\d+)?)?:(regenPct:(hp|mana|es):\d+(?:\.\d+)?|vidaPct|manaPct|esPct|fortificacao|atordoarProximos|furia|removerAfeccao(:elementais)?|proximos:[a-zA-Z]+(:\d+)?|buff:[a-zA-Z]+|consumirCadaver:(hp|mana|es|vidaMana)|vidaDaRegen:\d+(?:\.\d+)?|carga:(poder|frenesi|tolerancia)|removerAfeccao:todas|stat:[a-z_]+:\d+(?:\.\d+)?|frasco|congelarProximos:\d+(?:\.\d+)?|regenDaDefesa:(hp|es):(evasao|armadura|armaduraEvasao):\d+(?:\.\d+)?|soloSagrado:\d+(?:\.\d+)?|mortalha:\d+)$/,
  /^clamor_impele_chance:\d+$/, // acoes (o Clamor Impele N a mais, com chance)
  /^mais_dano_presenca:\d+$/, // condicoes-poe.fichaDoGolpe (o tempo na Presença)
  /^mina_(fragiliza|enfraquece):\d+$/, // mods-poe.aoAcertar (o alvo da Mina)
  // (lote F) a chance de mais dano em Área (fichaDoGolpe); as auras nos inimigos próximos (mods-poe.aurasProximas)
  /^chance_mais_dano_area:\d+$/, new RegExp(`^aura_res_menos:${ELS_P}$`),
  // (11/10) PLANTAR o Estandarte (mods-poe.plantarEstandarte): a vida por N de Valor consumido; as cargas com o Valor máximo
  /^estandarte_vida_por_valor:\d+$/, /^estandarte_cargas_cheio:(frenesi|tolerancia|poder)$/,
];
/** O atributo dinâmico tem efeito (sabe-se o que fazer com ele)? */
// (13/10) Quem confere um atributo "de verdade" (o do Draevor ou o novo com efeito): a tradução registra (`traduzir.mjs` — este módulo não a
// importa: o ciclo de imports).
// eslint-disable-next-line no-var
var validadorDeAtributo;
export function definirValidadorDeAtributo(fn) { validadorDeAtributo = fn; }
export function dinamicoValido(stat) {
  // (13/10) A aura "Você e Aliados" do nó/item (`aliados:<stat>` — `itens-poe/aliados.mjs`): vale pelo atributo que ela dá.
  if (String(stat).startsWith('aliados:')) return validadorDeAtributo ? validadorDeAtributo(String(stat).slice('aliados:'.length)) : false;
  // (13/10, o Inspirador: "Você e Aliados próximos dos seus Estandartes" — `aliados_estandarte:<stat>`, os aliados na área do Estandarte plantado.)
  if (String(stat).startsWith('aliados_estandarte:')) return validadorDeAtributo ? validadorDeAtributo(String(stat).slice('aliados_estandarte:'.length)) : false;
  if (String(stat).startsWith('ev:')) {
    const [, evento, acao] = stat.split(':');
    return EVENTOS.has(evento) && ACOES.has(acao);
  }
  const m = /^(sempre|efeito_buff):(\w+)$/.exec(stat);
  if (m) return !!BUFFS[m[2]];
  // O efeito de buff de UMA gema (`efeito_buff_gema:ira` — gemas-poe.adds) e o de UMA maldição (`efeito_maldicao_gema:flamabilidade` —
  // acoes.efeitosDaMaldicao): valem pela FORMA, como `concede:<gema>`; a gema que o jogo não tem a tradução já marca "não existe", com o nome.
  if (/^(efeito_buff_gema|efeito_maldicao_gema):[\w-]+$/.test(stat)) return true;
  return DINAMICOS.test(stat) || PARAMETRICOS.some((re) => re.test(stat));
}
/** A escala é conhecida? */
export const escalaValida = (e0) => { const e = String(e0 ?? '').replace(/~-?\d+(?:\.\d+)?$/, ''); return !e || /^(nivel|atr|atributoMenor|atributos|carga|cargaMax|furia|vidaMax|manaMax|encaixe|encaixeLocal|gemaLocal|encaixeVazioLocal|encaixeVazio|vidaReservada|manaReservada|manaNaoReservada|gemasNaPeca|cadaveresPerto|magiasRecentes|vidaOuManaMenor|manaGastaRecente|inimigosEnvenenados|resfriamentoNoAlvo|eletrizacaoNoAlvo|itemCorrompido|itemNaoCorrompido|itemUnico|joiasAbissais|joiaUnica|devocao|itemMagico|maldicoesEmVoce|abissalLocal|lacaio|venenoEmVoce|afeccaoEmVoce|mana|matouRecente|inimigosPerto|aurasAtivas|arautosAtivos|armas|rampage|eletrizadosMortosRecente|distintas|fortificacao|fortificacaoAcima|esFaltando|usos|maestrias|tiposDeMaestria|menorEntre|paradoS|vinhas|desdeUsou|afetadoPorClamor|valor|valorDoEstandarte|forcaDosVentos|stat)(:|$)/.test(e) || ESCALAS_DA_FICHA.test(e); };

/** Os números base do PoE dos efeitos de acerto. */
export const NO_ACERTO = {
  // Atordoamento: chance = 200 × dano ÷ limiar (a vida máxima do alvo, − o "Ponto de Atordoamento reduzido"); abaixo de 15%, nada.
  atordoamento: { fator: 200, minimoPct: 15, duracaoMs: 350 },
  mutilar: { duracaoMs: 4000, lentidaoPct: 30 },
  cegar: { duracaoMs: 4000, precisaoMenosPct: 20 },
  desacelerar: { duracaoMs: 4000, lentidaoPct: 30 },
  provocar: { duracaoMs: 3000, danoMenosPct: 10 },
  // Empalar: guarda 10% do dano Físico do acerto; os próximos 5 acertos no alvo causam o guardado de novo; até 5 empalamentos, 8 s.
  empalar: { pctDoFisico: 10, acertos: 5, maximo: 5, duracaoMs: 8000 },
};
/** A recuperação do dano sofrido (Recoup do PoE) acontece em 4 s. */
export const RECUPERACAO_MS = 4000;

// ---------------------------------------------------------------- ler um mod

/**
 * "É SORTUDO / AZARADO" (PoE): a chance rola duas vezes — Sortudo fica com o melhor resultado, Azarado com o pior; os dois juntos se anulam.
 * `sortudo`/`azarado`: os valores dos atributos (> 0 = tem). Devolve se deu certo.
 */
export function sorteado(chance, sortudo, azarado, rng = Math.random, tres = false) {
  const lado = (Number(sortudo) > 0 ? 1 : 0) - (Number(azarado) > 0 ? 1 : 0);
  const rolar = () => rng() < chance;
  // ("Seus efeitos de sorte ou azar usam a melhor ou a pior de três jogadas, em vez de duas" — `tres`.)
  if (lado > 0) return rolar() || rolar() || (tres && rolar());
  if (lado < 0) return rolar() && rolar() && (!tres || rolar());
  return rolar();
}

/**
 * Quanto do recurso (`vida`/`mana`) está RESERVADO agora: as auras ligadas da caçada (`hunt.buffs[].reserva`, a mesma conta de
 * `itens-poe/reserva.valor`) e, na vida, a "Reserva X% da Vida" das peças (`reserva_vida_pct` — `total`: a soma; sem ela, a ficha da caçada).
 */
export function reservadoAgora(estado, recurso, total = null) {
  const h = estado?.hunt;
  const agora = h?.clock ?? 0;
  const maxima = recurso === 'vida' ? estado?.maxHp ?? 0 : estado?.maxMana ?? 0;
  let n = 0;
  for (const b of Object.values(h?.buffs ?? {})) {
    if (!b?.reserva || !(b.ate > agora) || (b.reserva.recurso === 'vida') !== (recurso === 'vida')) continue;
    n += Math.ceil((b.reserva.pct ? (maxima * b.reserva.pct) / 100 : b.reserva.fixo ?? 0) * (b.reserva.fator ?? 1));
  }
  const pct = recurso === 'vida' ? Number((total ?? fichaDa(h)?.afPoe)?.reserva_vida_pct) || 0 : 0;
  if (pct > 0) n += Math.ceil((maxima * pct) / 100);
  return n;
}
/** O valor de um atributo do PoE na soma do personagem (`ficha.afPoe`: já com as condições de estado), + o condicional do golpe. */
export function valor(ficha, stat) {
  const base = Number(ficha?.afPoe?.[stat]) || 0;
  if (!ficha?.tagsDoGolpe) return base;
  return base + (somaPorTags(ficha, ficha.tagsDoGolpe)[stat] ?? 0) + (Number(ficha.extrasDoAlvo?.[stat]) || 0);
}
export const ativo = (s, agora) => !!s && s.ate > agora;

// ---------------------------------------------------------------- no ACERTO do personagem

/** O "X% de chance de causar Dano Dobrado" de um golpe: 2 ou 1. */
export const fatorDeDanoDobrado = (ficha, rng = Math.random) => (ligado() && rng() * 100 < valor(ficha, 'chance_dano_dobrado') ? 2 : 1);

/** O golpe ignora a redução de dano Físico do alvo? (a chance do "Acertos … ignoram a Redução de Dano Físico"). */
export const ignoraReducaoFisica = (ficha, rng = Math.random) => ligado() && rng() * 100 < valor(ficha, 'ignora_reducao_fisica');

/**
 * As partes de dano EXTRA de um ataque a partir do Físico dele: "Ganha X% do Dano Físico como Dano de Caos/Fogo extra" e "X% do Dano Físico
 * … é Convertido para um Elemento Aleatório". `fisico`: `[min, max]` (ou um número). Devolve `{ extras: { elemento: [min, max] },
 * convertidoPct }` — o convertido sai do Físico (quem chama tira) e entra no elemento sorteado.
 */
// (lote A5c, dono 20/10: `teto` — o que a conversão da GEMA deixou do Físico, em %: no PoE a conversão da gema vem primeiro e as de outras fontes só
// convertem o que sobrou; sem ele, 100, como antes)
export function extrasDoFisico(ficha, fisico, rng = Math.random, teto = 100) {
  const [a, b] = Array.isArray(fisico) ? fisico : [fisico, fisico];
  const extras = {};
  const somar = (el, pct) => { if (pct > 0) { const x = extras[el] ?? [0, 0]; extras[el] = [x[0] + (a * pct) / 100, x[1] + (b * pct) / 100]; } };
  somar('chaos', valor(ficha, 'phys_as_extra_chaos'));
  somar('fire', valor(ficha, 'phys_as_extra_fire'));
  somar('ice', valor(ficha, 'phys_as_extra_ice'));
  somar('energy', valor(ficha, 'phys_as_extra_energy'));
  // "Ganha X% do Dano Físico como Dano Extra de um Elemento aleatório": um elemento sorteado a cada golpe.
  if (valor(ficha, 'phys_as_extra_random') > 0) somar(['fire', 'ice', 'energy'][Math.floor(rng() * 3)], valor(ficha, 'phys_as_extra_random'));
  // (lote E) "X% de chance de Acertos causarem Y% do Dano Físico como Dano Extra de um Elemento aleatório": `phys_extra_aleatorio_chance:<Y>` = X.
  for (const [k, x] of Object.entries(ficha?.afPoe ?? {})) {
    if (!k.startsWith('phys_extra_aleatorio_chance:') || !(x > 0) || !(rng() * 100 < x)) continue;
    somar(['fire', 'ice', 'energy'][Math.floor(rng() * 3)], Number(k.slice('phys_extra_aleatorio_chance:'.length)) || 0);
  }
  // ("Acertos com esta Arma ganham X% de Dano Físico como Dano de Gelo ou Raio Extra": um dos dois, sorteado a cada golpe.)
  if (valor(ficha, 'phys_as_extra_gelo_ou_raio') > 0) somar(rng() < 0.5 ? 'ice' : 'energy', valor(ficha, 'phys_as_extra_gelo_ou_raio'));
  // As CONVERSÕES ("X% do Dano Físico Convertido em Dano de Fogo", e a de elemento aleatório): no máximo 100% do Físico, como no PoE.
  // (lote A5c, dono 20/10: "modo PoE segue o PoE") passando do que há para converter (o `teto`), o PoE reduz TODAS PROPORCIONALMENTE — antes eram em
  // sequência (o Fogo primeiro, o aleatório por último)
  const pedidos = ['fire', 'ice', 'energy', 'chaos'].map((el) => [el, Math.max(0, valor(ficha, `phys_conv_${el}`))]);
  if (valor(ficha, 'phys_conv_random') > 0) pedidos.push([['fire', 'ice', 'energy'][Math.floor(rng() * 3)], valor(ficha, 'phys_conv_random')]);
  const total = pedidos.reduce((t, [, x]) => t + x, 0);
  const escala = total > 0 ? Math.min(1, Math.max(0, teto) / total) : 0;
  let conv = 0;
  for (const [el, x] of pedidos) { const p = x * escala; if (p > 0) { somar(el, p); conv += p; } }
  return { extras, convertidoPct: conv };
}

// ---------------------------------------------------------------- quando o personagem é ACERTADO

/** O personagem BLOQUEOU o golpe de `bicho`: "Inflige Causticar/Enfraquecer/Exaurir em Inimigos ao Bloquear seu Dano". */
export const AO_BLOQUEAR = { duracaoMs: 4000, causticar: 10, enfraquecer: 6, exaurir: 10 };
/** (lote 33, P009) O fator do "Efeito de Afecções Não-Danificadoras aumentado" no Causticar, Fragilizar e Exaurir que VOCÊ inflige. */
export const fatorNaoDano = (af) => Math.max(0, 1 + (Number(af?.efeito_nao_dano) || 0) / 100);
export const AFECCOES_NAO_DANO = new Set(['causticado', 'fragilizado', 'exaurido']);
export function aoBloquear(hunt, bicho, ficha, { agora = hunt?.clock ?? 0, eventos = [] } = {}) {
  if (!ligado() || !bicho || !ficha?.afPoe) return eventos;
  const e = (bicho.estados ??= {});
  const ate = agora + AO_BLOQUEAR.duracaoMs;
  // Causticar: −10% de resistências elementais; Enfraquecer (Fragilizar): +6% de chance de crítico contra; Exaurir (Exaurido): 10% menos dano.
  const f = fatorNaoDano(ficha.afPoe);
  if (valor(ficha, 'bloqueio_causticar') > 0) { e.causticado = { ate, pct: AO_BLOQUEAR.causticar * f }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'causticado' }); }
  if (valor(ficha, 'bloqueio_enfraquecer') > 0) { e.fragilizado = { ate, pct: AO_BLOQUEAR.enfraquecer * f }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'fragilizado' }); }
  if (valor(ficha, 'bloqueio_exaurir') > 0) { e.exaurido = { ate, pct: AO_BLOQUEAR.exaurir * f }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'exaurido' }); }
  return eventos;
}

/** O ESCONJURO do PoE: 10% de dano causado reduzido e 10% de dano sofrido aumentado. */
export const ESCONJURO = Object.freeze({ pct: 10 });
/**
 * O bicho está Esconjurado? O Cegado com Esconjuro ("Inimigos Cegados por você têm Esconjuro") e, lote 72, o Amaldiçoado por você quando X% da
 * duração de uma maldição nele já passou (`amaldicoados_esconjuro_apos_pct` de `afPoe` — `maldicoes[id] = { desde, dur, ate }`).
 */
export function esconjurado(bicho, afPoe, agora) {
  const e = bicho?.estados ?? {};
  if (ativo(e.cego, agora) && e.cego.esconjuro) return true;
  const pct = Number(afPoe?.amaldicoados_esconjuro_apos_pct) || 0;
  if (!(pct > 0) || !ligado()) return false;
  return Object.values(bicho?.maldicoes ?? {}).some((m) => m && m.ate > agora && m.dur > 0 && agora - (m.desde ?? agora) >= (m.dur * pct) / 100);
}
/** O que os estados do PoE no BICHO mudam no golpe dele: `{ danoFator, precisaoFator, criticoFator }` (Cego, Exaurido, Provocado). */
export function doBicho(bicho, agora, { contraOutro = false, ficha = null } = {}) {
  const e = bicho?.estados ?? {};
  let danoFator = 1;
  let precisaoFator = 1;
  let criticoFator = 1;
  if (ativo(e.exaurido, agora)) danoFator *= 1 - e.exaurido.pct / 100;
  // (lote E) "Cada Mina aplica Dano causado reduzido em X% aos Inimigos próximos a ela, até Y%" (o poedb traduz "Dano sofrido reduzido"; no
  // PoE é o dano que o inimigo causa).
  if (ativo(e.minaFraco, agora)) danoFator *= Math.max(0, 1 - (e.minaFraco.pct ?? 0) / 100);
  // ("Com ao menos um cadáver próximo, Inimigos próximos causam Dano reduzido em X%" — a aura `aura_dano_menos`, `mods-poe.aurasProximas`.)
  if (ativo(e.auraFraco, agora)) danoFator *= Math.max(0, 1 - (e.auraFraco.pct ?? 0) / 100);
  // (lote H) "X% menos Dano sofrido dos outros Inimigos próximos do Inimigo Marcado".
  if (ativo(e.pertoDoMarcado, agora) && ficha) danoFator *= Math.max(0, 1 - (Number(ficha.afPoe?.menos_dano_perto_do_marcado) || 0) / 100);
  // (lote F) "Inimigos Próximos Resfriados causam Dano reduzido em X% com Acertos" (de quem leva o golpe — `ficha`).
  if (ativo(e.lento, agora) && ficha) danoFator *= Math.max(0, 1 - (Number(ficha.afPoe?.resfriados_dano_red) || 0) / 100);
  if (contraOutro && ativo(e.provocado, agora)) danoFator *= 1 - NO_ACERTO.provocar.danoMenosPct / 100;
  // (lote D1, decisão do dono 27/10 — o PoB, FleshAndStone: DamageTakenWhenHit MORE) o Carne e Pedra na Postura da Areia: você sofre Y% menos Dano dos acertos do inimigo
  // na aura — o valor cheio, sem a queda pela distância; só em você (não no lacaio)
  if (!contraOutro) danoFator *= fatorDaAreia(bicho, agora);
  if (ativo(e.cego, agora)) {
    // (O "Efeito do Cegamento aumentado" de quem cegou: `e.cego.efeito`.)
    precisaoFator *= 1 - (NO_ACERTO.cegar.precisaoMenosPct * (e.cego.efeito ?? 1)) / 100;
    criticoFator *= 1 - (e.cego.criticoMenosPct ?? 0) / 100;
    // "Inimigos Cegados por você têm Esconjuro": causam 10% menos dano (o Esconjuro — `esconjurado`, abaixo da Cegueira).
    // (lote D) "Dano Sofrido de Inimigos Cegos reduzido em X%" (de quem leva o golpe — `ficha`).
    // (lote E: o "Dano reduzido" das Minas vai abaixo, fora da Cegueira.)
    const red = Number(ficha?.afPoe?.dano_de_cegos_red) || 0;
    if (red > 0 && ligado()) danoFator *= Math.max(0, 1 - red / 100);
  }
  // O ESCONJURO (o lembrete do PoE: "dano causado reduzido em 10% e dano sofrido aumentado em 10%"): o do Cegado e, lote 72, o do Amaldiçoado
  // ("Inimigos Amaldiçoados por você tem Esconjuro se X% da Duração da Maldição expirou" — de quem leva o golpe, `ficha`).
  if (esconjurado(bicho, ficha?.afPoe, agora)) danoFator *= 1 - ESCONJURO.pct / 100;
  if (ativo(e.debilitado, agora)) danoFator *= 0.9;
  // (ciclo 7) "Inimigo Marcado tem Precisão reduzida em X%".
  const precisaoMenos = regraDaMarca(bicho, agora, 'precisaoMenos');
  if (precisaoMenos) precisaoFator *= Math.max(0, 1 - precisaoMenos / 100);
  // (lote G-A) o Enfraquecer: "Inimigos Amaldiçoados possuem uma redução de X% de Precisão" (`GemasGAC.precisaoMenos`)
  const daMaldicao = GemasGAC.precisaoMenos(bicho, agora);
  if (daMaldicao > 0) precisaoFator *= Math.max(0, 1 - daMaldicao / 100);
  // "Inimigos Resfriados pelos seus Acertos reduz o Dano causado pela metade do Efeito de Resfriamento" (o Modelador do Inverno).
  if (ativo(e.lento, agora) && e.lento.reduzDano) danoFator *= Math.max(0, 1 - e.lento.pct / 200);
  // Coberto de Gelo (PoE): 50% menos chance de crítico (o +20% de dano de Gelo recebido está em `fatorRecebidoPeloBicho`).
  if (ativo(e.cobertoGelo, agora)) criticoFator *= 0.5;
  // (12/10) As Cargas de Poder do monstro (`mobs/mecanicas.ganharCarga`): +50% de chance de crítico (aumentada) por carga.
  const critDasCargas = BuffsDeMob.soma(bicho, agora, 'critAumentadoPct');
  if (critDasCargas > 0) criticoFator *= 1 + critDasCargas / 100;
  return { danoFator, precisaoFator, criticoFator };
}
/** A resistência elemental a menos do bicho Causticado (pontos), e a chance de crítico a mais contra ele Fragilizado (pontos de %). */
export const causticado = (bicho, agora) => (ativo(bicho?.estados?.causticado, agora) ? bicho.estados.causticado.pct : 0) + (bicho?.estados?.causticadosPilha ?? []).filter((x) => x.ate > agora).reduce((t, x) => t + x.pct, 0);
/** O Equilíbrio Elemental no bicho: +25 nos elementos que o acertaram, −50 nos outros (0 sem ele ou fora dos elementais). */
export function equilibrio(bicho, agora, tipo) {
  const q = bicho?.estados?.equilibrio;
  if (!ativo(q, agora) || !['fire', 'ice', 'energy'].includes(tipo)) return 0;
  return q.atingidos.includes(tipo) ? 25 : -50;
}
export const fragilizado = (bicho, agora) => (ativo(bicho?.estados?.fragilizado, agora) ? bicho.estados.fragilizado.pct : 0);
/** (ciclo 7, lote D) O ESMAGADO do PoE: 15% menos Redução de Dano Físico (`hunt/resistencia.resistenciaDe`). */
export const esmagado = (bicho, agora) => (ativo(bicho?.estados?.esmagado, agora) ? 15 : 0);
/** (lote F) "Inimigos Próximos possuem −X% de Resistência a Gelo" (a aura `aura_res_menos:<tipo>` — `mods-poe.aurasProximas`). */
export const resMenosDaAura = (bicho, agora, tipo) => (ativo(bicho?.estados?.auraRes, agora) ? Number(bicho.estados.auraRes.pct?.[tipo]) || 0 : 0);

// ---------------------------------------------------------------- o tique da caçada

/** (lote 34) As listas de usos que as escalas da ficha leem (`…%usos:<lista>…`), com cache por ficha. */
const USOS_DA_FICHA = new WeakMap();
function usosDaFicha(ficha) {
  if (!ficha?.afPoe) return new Set();
  let u = USOS_DA_FICHA.get(ficha);
  if (!u) {
    u = new Set();
    for (const k of Object.keys(ficha.afPoe)) { const m = /%usos:([^:@~]+)/.exec(k); if (m) u.add(m[1]); }
    USOS_DA_FICHA.set(ficha, u);
  }
  return u;
}
/**
 * Um tique (a caçada chama, `ms` de tempo): a Fúria, o "movendo-se", a recuperação do dano sofrido (Recoup) e a regeneração do Escudo de
 * Energia ("N de Escudo de Energia Regenerado por segundo"). `ficha`: a do personagem.
 */
/**
 * (lote 51, a Dissolução da Carne — dono, 16/10: "Implementar") a VIDA RESERVADA pelo dano (`arvore.danoRecebido`): enquanto houver, a vida não
 * passa da máxima − a reservada (a recuperação não enche a parte reservada); passados os segundos sem dano na Vida (2 — o da linha), ela volta.
 * Com a vida toda reservada, você morre (a vida chega a 0, como no PoE).
 */
/**
 * (lote 54) O DEVORADOR DE ALMAS nos lacaios (a Fome Eterna: "Espectros Erguidos tem 50% de chance de ganhar Devorador de Almas por 20 segundos
 * ao Matar" — `LacaiosPoe.aoMatarDoLacaio`). Como no PoE (poedb, Soul_Eater): enquanto tiver o buff, o lacaio consome a alma de qualquer coisa
 * morta perto (60 unidades = 3 casas), +5% de Velocidade de Ataque e Conjuração por alma; sem alma nova Recentemente, perde 1 a cada 0,5 s;
 * máximo de 45 (o buff não renova enquanto dura; acabou, as almas vão junto).
 */
export const DEVORADOR_DE_ALMAS = Object.freeze({ porAlmaPct: 5, maximo: 45, raioCasas: 3, perdaMs: 500 });
export function almasDoLacaio(l, agora) {
  // (lote D2, dono 27/10: as almas da Transfusão — `almas.livre` — valem mesmo sem o buff do Devorador)
  if (!l?.almas || (!((l.buffs?.devoradorDeAlmas ?? 0) > agora) && !l.almas.livre)) return 0;
  const parado = agora - (l.almas.em ?? agora) - RECENTE_MS;
  return Math.max(0, l.almas.n - (parado > 0 ? Math.floor(parado / DEVORADOR_DE_ALMAS.perdaMs) : 0));
}
/** Um inimigo morreu (`morto`, por quem for): cada lacaio com o Devorador de Almas a até 3 casas consome a alma. Devolve quantos consumiram. */
export function almaParaOsLacaios(lacaios, morto, agora) {
  if (!morto) return 0;
  let n = 0;
  for (const l of lacaios ?? []) {
    if (!(l?.hp > 0) || !((l.buffs?.devoradorDeAlmas ?? 0) > agora) || Math.max(Math.abs(l.x - morto.x), Math.abs(l.y - morto.y)) > DEVORADOR_DE_ALMAS.raioCasas) continue;
    l.almas = { n: Math.min(DEVORADOR_DE_ALMAS.maximo, almasDoLacaio(l, agora) + 1), em: agora, ...(l.almas?.livre ? { livre: true } : {}) };
    n++;
  }
  return n;
}
export function tiqueDaDissolucao(estado, hunt, ficha, agora = hunt?.clock ?? 0) {
  const r = hunt?.dissolucao;
  if (!r || !(r.reservado > 0)) return;
  const s = Number(ficha?.afPoe?.dissolucao_reserva_s) || 0;
  const max = estado.maxHp ?? 0;
  if (!(s > 0) || agora - (r.ultimo ?? 0) >= s * 1000) {
    if ((estado.hp ?? 0) > 0) estado.hp = Math.min(max, (estado.hp ?? 0) + r.reservado);
    delete hunt.dissolucao;
    return;
  }
  if ((estado.hp ?? 0) > max - r.reservado) estado.hp = Math.max(0, max - r.reservado);
}
export function tique(estado, hunt, ficha, ms, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return;
  hunt.poeEntrou ??= agora; // (lote F: "por segundo que você tenha ficado parado" conta desde a entrada, se ainda não andou)
  hunt.poeFatorDosDebuffs = fatorDosDebuffs(ficha?.afPoe); // (lote 30: para quem põe debuff sem a ficha — a maldição refletida)
  // (11/10) Um buff com tempo acabou neste tique (os nomeados — Crueldade, Elusivo, Fanatismo… — e a Oferenda em você): a ficha é refeita, e o
  // bônus sai na hora (não no próximo acerto que a refizesse).
  const venceu = (ate) => typeof ate === 'number' && ate <= agora && ate > agora - Math.max(1, ms);
  // (lote 51: + os bônus temporários — `poeTemporarios`, o modificador do Raro do Aprendizado Inspirado; lote 52: + a imunidade a Maldições
  // da Desgraça das Bruxas)
  if (Object.values(hunt.poeBuffs ?? {}).some(venceu) || venceu(hunt.oferendaEmVoce?.ate) || Object.values(hunt.poeTemporarios ?? {}).some((x) => venceu(x?.ate)) || venceu(hunt.imunidadesPoe?.maldicao)) hunt.poeFichaMudou = true;
  tiqueDaFuria(hunt, agora);
  tiqueDasCargasFanaticas(hunt, ficha, agora);
  tiqueDaDissolucao(estado, hunt, ficha, agora);
  // (14/10) o Warden: a Casca da Pele de Árvore e o Avatar Liberto
  tiqueDoWarden(estado, hunt, ficha?.afPoe, agora);
  // (lote 72, o Quebra-Maldições) "Remove uma Maldição após Canalizar por N segundos": uma por canalização (a que começou em `desde`).
  const canal = hunt.canalizacao;
  const apos = Number(ficha?.afPoe?.canalizar_remove_maldicao_s) || 0;
  if (apos > 0 && canalizandoAgora(hunt, agora) && agora - (canal.desde ?? agora) >= apos * 1000 && hunt.poeMaldicaoQuebrada !== canal.desde) {
    hunt.poeMaldicaoQuebrada = canal.desde;
    const [id] = Object.entries(hunt.maldicoesNoJogador ?? {}).find(([, m]) => m && m.ate > agora) ?? [];
    if (id) { delete hunt.maldicoesNoJogador[id]; hunt.poeFichaMudou = true; }
  }
  // (14/10, o Occultist) a Infusão Espiritual
  tiqueDaInfusao(hunt, ficha?.afPoe, agora);
  // (14/10, os únicos: "Habilidades de retaliação se tornam usáveis a cada N segundos" — as duas janelas, a do bloqueio e a do Acerto
  // Selvagem, abrem sozinhas a cada N s)
  const retaliacaoCada = Number(ficha?.afPoe?.retaliacao_cada_s) || 0;
  if (retaliacaoCada > 0 && agora >= (hunt.poeRetaliacaoCadaEm ?? 0)) {
    for (const g of ['bloquear', 'selvagem']) abrirRetaliacao(hunt, g, ficha.afPoe, agora);
    hunt.poeRetaliacaoCadaEm = agora + retaliacaoCada * 1000;
  }
  // (14/10, o Guardian) as Chamas Santificadas removidas deixam de ser "recentes": a ficha é refeita (o Raio extra cai)
  if (hunt.poeChamasRemovidas?.length) {
    const antes = hunt.poeChamasRemovidas.length;
    hunt.poeChamasRemovidas = hunt.poeChamasRemovidas.filter((t) => agora - t <= CHAMA_SANTIFICADA.recenteMs);
    if (hunt.poeChamasRemovidas.length !== antes) hunt.poeFichaMudou = true;
  }
  // (ciclo 7) "Inimigos próximos do seu Inimigo Marcado são Cegados" (a até 2 casas dele).
  for (const m of hunt.monstros ?? []) {
    if (!(m.hp > 0) || !regraDaMarca(m, agora, 'cegaProximos')) continue;
    for (const o of hunt.monstros) if (o !== m && o.hp > 0 && !o.dummy && Math.max(Math.abs(o.x - m.x), Math.abs(o.y - m.y)) <= 2) (o.estados ??= {}).cego = { ate: Math.max(o.estados?.cego?.ate ?? 0, agora + 500) };
  }
  // (lote D) A Fortificação que acabou: "Recupera N de Vida por cada Fortificação perdida".
  const fort = hunt.fortificacao;
  if (fort && fort.ate <= agora) {
    const porUma = valor(ficha, 'vida_por_fortificacao_perdida');
    if (porUma > 0 && fort.n > 0 && (estado.hp ?? 0) > 0 && !vidaSoPeloDreno(ficha?.afPoe)) estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + Math.round(porUma * fort.n));
    delete hunt.fortificacao;
  }
  tiqueDoRampage(hunt, ficha, agora);
  const pos = hunt.pos ? `${hunt.pos.x},${hunt.pos.y}` : null;
  if (pos && hunt.poeUltimaPos && pos !== hunt.poeUltimaPos) marcar(hunt, 'moveu', agora);
  hunt.poeUltimaPos = pos;
  // (lote 32) As condições e escalas do RELÓGIO, que nenhum acontecimento refaz na ficha — "movendo-se"/"parado", "se você não se moveu nos
  // últimos N segundos", "por segundo parado", "para cada segundo afetado por um Buff de Clamor" e os "Recentemente" que começam e acabam
  // ("se você não foi Acertado por um Ataque Recentemente" volta 4 s depois do acerto): a ficha é refeita quando o segundo inteiro delas muda
  // (até 10 s parado, até 60 s sob Clamor — depois, nada muda) ou quando um "recente" entra ou sai da janela.
  const recentes = hunt.poeRecente ?? {};
  const desdeOPasso = agora - (recentes.moveu ?? hunt.poeEntrou ?? agora);
  const sobClamor = hunt.poeSobClamorDesde != null && sobBuffDeClamor(hunt, agora) ? Math.min(60, Math.floor((agora - hunt.poeSobClamorDesde) / 1000)) : -1;
  const valendo = Object.keys(recentes).filter((k) => recente(recentes[k], agora)).sort().join(',');
  // (+ lote 33: o efeito do Elusivo que cai — a cada 10 pontos; + lote 34: as contagens "por cada X Recentemente" / "nos últimos N segundos" — as
  // listas de usos, nas janelas de 4, 8 e 10 s: "por cada Mina Detonada Recentemente", "por cada Magia que você Conjurou Recentemente"…)
  // (só as listas que alguma linha da ficha usa — `usosDaFicha`; as outras mudam a cada acerto e refariam a ficha à toa)
  const usados = usosDaFicha(ficha);
  const usos = usados.size ? Object.entries(hunt.poeUsosRecentes ?? {}).filter(([k]) => usados.has(k)).map(([k, l]) => `${k}:${[4000, 8000, 10000].map((j) => l.filter((t) => agora - t <= j).length).join('/')}`).join(',') : '';
  // (+ lote 42: canalizando agora — o "enquanto canaliza" começa e acaba sem acontecimento; lote A4: + qual gema e o estágio do tempo dela — o que
  // a canalização dá a você, `GemasPoe.adds`)
  const relogio = `${desdeOPasso <= MOVENDO_MS ? 'm' : Math.min(10, Math.floor(desdeOPasso / 1000))}|${sobClamor}|${valendo}|${Math.floor(efeitoDoElusivo(hunt, agora) / 10)}|${usos}|${canalizandoAgora(hunt, agora) ? `c:${hunt.canalizacao.acao ?? ''}:${hunt.canalizacao.estagioDaFicha ?? ''}` : ''}`;
  if (hunt.poeRelogioDaFicha !== undefined && hunt.poeRelogioDaFicha !== relogio) hunt.poeFichaMudou = true;
  hunt.poeRelogioDaFicha = relogio;
  if (hunt.recuperacoes?.length && (estado.hp ?? 0) > 0) {
    for (const r of hunt.recuperacoes) {
      const fim = Math.min(agora, r.ate);
      // (lote D: a recuperação com duração própria — "Regenera X% de Vida durante 1 segundo" — começa em `desde`)
      const de = r.ultimo ?? r.desde ?? r.ate - RECUPERACAO_MS;
      const quanto = Math.max(0, fim - Math.max(de, agora - ms)) * r.porMs;
      r.ultimo = fim;
      r.resto = (r.resto ?? 0) + quanto;
      const inteiro = Math.floor(r.resto);
      if (inteiro > 0) {
        r.resto -= inteiro;
        if (r.recurso === 'hp') { if (!vidaSoPeloDreno(ficha?.afPoe)) estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + inteiro); }
        else if (r.recurso === 'es') estado.es = Math.min(Math.max(0, Math.round(ficha?.energyShield ?? 0)), (estado.es ?? 0) + inteiro);
        else estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + inteiro);
      }
    }
    hunt.recuperacoes = hunt.recuperacoes.filter((r) => r.ate > agora);
  }
  // (ciclo 7) "X% do Dano Físico negado de Acertos Recentes é Regenerado como Escudo de Energia por segundo" (o Escudo Divino) e "X% do Total
  // de Dano Físico dos Acertos impedido nos últimos 10 segundos é Regenerado como Vida por segundo": o negado guardado (`registrarFisicoNegado`).
  const negados = (hunt.poeFisicoNegado ?? []).filter((x) => agora - x.t <= 10000);
  hunt.poeFisicoNegado = negados;
  const negado = (janela) => negados.filter((x) => agora - x.t <= janela).reduce((s, x) => s + x.v, 0);
  const paraEs = valor(ficha, 'fisico_negado_em_es_pct');
  const paraVida = valor(ficha, 'fisico_negado_em_vida_pct');
  if (paraEs > 0) { hunt.poeEsNegado = (hunt.poeEsNegado ?? 0) + ((negado(RECENTE_MS) * paraEs) / 100) * (ms / 1000); const n = Math.floor(hunt.poeEsNegado); if (n > 0) { hunt.poeEsNegado -= n; estado.es = Math.min(Math.max(0, Math.round(ficha?.energyShield ?? 0)), (estado.es ?? 0) + n); } }
  if (paraVida > 0 && (estado.hp ?? 0) > 0 && !vidaSoPeloDreno(ficha?.afPoe)) { hunt.poeVidaNegada = (hunt.poeVidaNegada ?? 0) + ((negado(10000) * paraVida) / 100) * (ms / 1000); const n = Math.floor(hunt.poeVidaNegada); if (n > 0) { hunt.poeVidaNegada -= n; estado.hp = Math.min(estado.maxHp ?? 0, estado.hp + n); } }
  // (ciclo 7, lote F) "Não pode Recuperar Escudo de Energia acima da Evasão / da Armadura" (as keystones novas): o escudo para no teto.
  const tetoDoEscudo = Math.min(valor(ficha, 'es_ate_evasao') > 0 ? ficha?.evasion ?? 0 : Infinity, valor(ficha, 'es_ate_armadura') > 0 ? ficha?.armor ?? 0 : Infinity);
  const esMax = Math.max(0, Math.round(Math.min(ficha?.energyShield ?? 0, tetoDoEscudo)));
  if ((estado.es ?? 0) > esMax && tetoDoEscudo < Infinity) estado.es = esMax;
  // "Enquanto não estiver em Vida Cheia, Sacrifica X% da Mana por Segundo para Recuperar a mesma quantidade de Vida".
  const sacrificio = valor(ficha, 'mana_para_vida_pct_s');
  if (sacrificio > 0 && (estado.hp ?? 0) > 0 && (estado.hp ?? 0) < (estado.maxHp ?? 0) && !vidaSoPeloDreno(ficha?.afPoe)) {
    hunt.poeSacrificio = (hunt.poeSacrificio ?? 0) + Math.min(estado.mana ?? 0, (((estado.maxMana ?? 0) * sacrificio) / 100) * (ms / 1000));
    const n = Math.min(Math.floor(hunt.poeSacrificio), (estado.maxHp ?? 0) - estado.hp);
    if (n > 0) { hunt.poeSacrificio -= n; estado.mana = Math.max(0, (estado.mana ?? 0) - n); estado.hp += n; }
  }
  estado.esCheio = esMax > 0 && (estado.es ?? 0) >= esMax;
  estado.maxEsPoe = esMax;
  // (Sacrifício Eterno: "Quando atingir Escudo de Energia cheio, Sacrifica todo o Escudo de Energia para ganhar +5% do Máximo de
  // Resistências por 4 segundos".)
  if (estado.esCheio && valor(ficha, 'sacrificio_eterno') > 0) {
    estado.es = 0;
    const t = (hunt.poeTemporarios ??= {});
    for (const el of ['fire', 'ice', 'energy', 'chaos']) t[`${el}_res_max`] = { stat: `${el}_res_max`, valor: 5, ate: agora + 4000 };
    hunt.poeFichaMudou = true;
  }
  // A perda por segundo dos únicos ("Perde N de Vida por segundo", "Perde X% de Mana por Segundo", "se você foi Acertado Recentemente"…).
  const s = ms / 1000;
  const perde = (campo, max, quanto) => { if (quanto > 0 && (estado.hp ?? 0) > 0) estado[campo] = Math.max(campo === 'hp' ? 1 : 0, (estado[campo] ?? 0) - quanto * s); };
  // (+ lote 32, P048: o Ritual da Ruína — X% por Fúria, enquanto ela não cai)
  const porFuria = valor(ficha, 'perde_vida_pct_s_por_furia') * furiaSemPerder(hunt, ficha?.afPoe, agora);
  perde('hp', estado.maxHp, valor(ficha, 'perde_vida_s') + ((estado.maxHp ?? 0) * (valor(ficha, 'perde_vida_pct_s') + porFuria)) / 100);
  perde('mana', estado.maxMana, ((estado.maxMana ?? 0) * valor(ficha, 'perde_mana_pct_s')) / 100);
  perde('es', esMax, (esMax * valor(ficha, 'perde_es_pct_s')) / 100);
  // (O Agnóstico: "Enquanto não estiver em Vida Cheia, Sacrifica 20% da Mana por Segundo para Recuperar a mesma quantidade de Vida".)
  const agnostico = valor(ficha, 'mana_vira_vida_pct_s');
  if (agnostico > 0 && (estado.hp ?? 0) > 0 && (estado.hp ?? 0) < (estado.maxHp ?? 0) && !vidaSoPeloDreno(ficha?.afPoe)) {
    hunt.poeAgnosticoResto = (hunt.poeAgnosticoResto ?? 0) + Math.min((estado.maxMana ?? 0) * agnostico / 100 * s, estado.mana ?? 0, (estado.maxHp ?? 0) - (estado.hp ?? 0));
    const inteiro = Math.floor(hunt.poeAgnosticoResto);
    if (inteiro > 0) {
      hunt.poeAgnosticoResto -= inteiro;
      estado.mana = Math.max(0, (estado.mana ?? 0) - inteiro);
      estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + inteiro);
    }
  }
  // (+ o dano por segundo em você de um ELEMENTO das peças — "N de Dano de Fogo recebido por segundo por Carga de Tolerância…" — pela
  // resistência daquele elemento; não mata, como a perda de sempre.)
  const proprio = ['degen_proprio_fire', 'degen_proprio_ice', 'degen_proprio_energy', 'degen_proprio_chaos'].reduce((n, k) => n + valor(ficha, k) * (1 - Math.min(100, ficha?.protection?.[k.slice('degen_proprio_'.length)] ?? 0) / 100), 0);
  perde('hp', estado.maxHp, proprio);
  // (+ a "Velocidade de Recuperação de Escudo de Energia aumentada": a regeneração é recuperação.)
  // (+ o Juramento do Zelote: a regeneração de VIDA da ficha, aplicada ao escudo — `ficha.regenPoe.esDaVida`.)
  // (a Ambição Imortal: "Não pode Recarregar ou Regenerar Escudo de Energia" — `sem_regen_es`)
  // (+ "X% menos Recuperação do Escudo de Energia" — `recuperacao_es_menos`, na regeneração; na recarga é o `es_recarga_menos`.)
  const esRegen = valor(ficha, 'sem_regen_es') > 0 ? 0 : Math.max(0, 1 - valor(ficha, 'recuperacao_es_menos') / 100) * (valor(ficha, 'es_regen') + (esMax * valor(ficha, 'es_regen_pct')) / 100) * Math.max(0, 1 + (valor(ficha, 'recuperacao_es_inc') + valor(ficha, 'recuperacao_inc')) / 100) + (ficha?.regenPoe?.esDaVida ?? 0);
  if (esRegen > 0 && esMax > 0 && (estado.es ?? 0) < esMax) {
    hunt.poeEsResto = (hunt.poeEsResto ?? 0) + (esRegen * ms) / 1000;
    const inteiro = Math.floor(hunt.poeEsResto);
    if (inteiro > 0) {
      hunt.poeEsResto -= inteiro;
      estado.es = Math.min(esMax, (estado.es ?? 0) + inteiro);
    }
  }
}

/**
 * (lote 80) Os projéteis a mais do golpe básico de longe: os adicionais + a perfuração — sem a perfuração com "Projéteis param ao colidir" /
 * "não podem Perfurar" (`projeteis_param`: o Cineticismo, o único) — antes o golpe básico perfurava assim mesmo.
 */
export const projeteisDoGolpeBasico = (f) => valor(f, 'extra_projectiles') + (valor(f, 'projeteis_param') > 0 ? 0 : valor(f, 'perfurar'));
/**
 * Os alvos dos projéteis a MAIS / da perfuração de um golpe de longe: os `n` bichos vivos mais perto do `alvo` (sem ele), a até `alcance`
 * casas do personagem.
 */
export function alvosDosProjeteisExtras(hunt, alvo, n, alcance) {
  if (!ligado() || !(n > 0) || !hunt?.pos || !alvo) return [];
  const d = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return (hunt.monstros ?? [])
    .filter((m) => m !== alvo && m.hp > 0 && !m.dummy && d(hunt.pos, m) <= alcance)
    .sort((a, b) => d(alvo, a) - d(alvo, b))
    .slice(0, Math.floor(n));
}

/** A grade do andar de cada caçada (fora do estado salvo: a caçada registra a cada tique — `cacadas.tique`). */
const GRADES = new WeakMap();
export const definirGradeDoCombate = (hunt, fn) => { if (hunt) GRADES.set(hunt, fn); };
/** (lote 42) A grade do andar da caçada (`{ andavel }` — as casas que se andam), ou null: o terreno do voo do projétil (`Secundarios.resolver`). */
export const gradeDoCombate = (hunt) => (hunt ? GRADES.get(hunt)?.() ?? null : null);

/**
 * O EMPURRÃO do PoE ("chance de Empurrar Inimigos ao acertar"): o bicho vai UMA casa para longe do personagem, se ela é andável e livre.
 * Devolve true se moveu.
 */
export function empurrar(hunt, bicho) {
  if (!hunt?.pos || !bicho || bicho.boss || bicho.dummy) return false;
  // ("Não pode Empurrar Inimigos")
  if (Number(fichaDa(hunt)?.afPoe?.sem_empurrao) > 0) return false;
  const dx = Math.sign(bicho.x - hunt.pos.x);
  const dy = Math.sign(bicho.y - hunt.pos.y);
  if (!dx && !dy) return false;
  const para = { x: bicho.x + dx, y: bicho.y + dy };
  const grade = GRADES.get(hunt)?.() ?? null;
  if (grade?.andavel && !grade.andavel.has(`${para.x},${para.y}`)) return false;
  if (hunt.monstros.some((m) => m !== bicho && m.hp > 0 && m.x === para.x && m.y === para.y)) return false;
  bicho.x = para.x;
  bicho.y = para.y;
  // (o empurrado também está "em movimento" — o Sangramento dói mais)
  bicho.andouEm = hunt.clock ?? 0;
  return true;
}


/** O Escudo de Energia que pode pagar o custo de uma habilidade cuja gema está na peça do `slot` ("Gaste Escudo de Energia antes da Mana…"). */
export function escudoParaOCusto(estado, slot, ficha) {
  // (+ a "Bateria Anciã": o escudo paga o custo de TODAS as habilidades.)
  const global = Number(ficha?.afPoe?.['keystone:bateriaAnciã']) > 0 || Number(ficha?.afPoe?.bateria_ancia) > 0;
  if (!ligado() || !(global || (slot && Number(estado?.equipment?.[slot]?.poe?.af?.custo_do_escudo_local) > 0))) return 0;
  return Math.max(0, Math.min(estado.es ?? 0, Math.round(ficha?.energyShield ?? 0)));
}

/**
 * (lote 36, P002 — a decisão do dono "Toda área em metros", 16/10) A ÁREA DE EFEITO do PoE no jogo: o raio cresce × √(o fator da área) — o
 * fator é (1 + o "aumentado") × cada "mais/menos" —, como no PoE (o raio × √(1 + X%)). Numa forma de raio `raio` casas (2 m cada), as casas
 * a mais (ou a menos, no fator < 1) são o raio × (√fator − 1), e a fração vira a chance de uma casa (a média bate). Antes, +1 casa a cada
 * 25%, fosse qual fosse o raio (+100% numa forma de 3 casas dava 7; no PoE, 4,24).
 */
export function fatorDaArea(inc = 0, ...mais) {
  return Math.max(0, 1 + (Number(inc) || 0) / 100) * mais.reduce((f, m) => f * Math.max(0, 1 + (Number(m) || 0) / 100), 1);
}
export function casasPelaArea(raio, fator, rng = Math.random) {
  const extra = Math.max(0, Number(raio) || 0) * (Math.sqrt(Math.max(0, Number(fator) || 0)) - 1);
  if (!Number.isFinite(extra) || Math.abs(extra) < 1e-9) return 0;
  return Math.trunc(extra) + (rng() < Math.abs(extra % 1) ? Math.sign(extra) : 0);
}

/**
 * Os projéteis a mais, a perfuração e a Área de Efeito que as PEÇAS dão a uma gema (com as tags `tags`, encaixada na peça do `slot`):
 * `{ projeteis, perfurar, areaInc, areaMais }` (a área em %: o "aumentado" e o "mais" — o raio cresce no uso, pela forma: `casasPelaArea`).
 */
export function alvosDasPecas(estado, ficha, entry, tags, slot) {
  if (!ligado() || !ficha?.afPoe) return null;
  const s = somaPorTags(ficha, tags);
  const base = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  const local = estado?.equipment?.[slot]?.poe?.af ?? {};
  const t = new Set(tags);
  const localPorTag = (stat) => Object.entries(local).reduce((n, [k, v]) => { const p = partir(k); return n + (p.stat === stat && typeof v === 'number' && p.conds.every((c) => t.has(c)) ? v : 0); }, 0);
  const projetil = t.has('projetil');
  const projeteis = projetil ? base('extra_projectiles') + (Number(local.extra_projectiles_local) || 0) : 0;
  const perfurar = projetil ? base('perfurar') : 0;
  const ricochetes = projetil || t.has('magia') ? base('ricochetes') : 0;
  // (11/10, os únicos:) "Flechas Difundem", "Projéteis dos Ataques podem Difundir N vezes adicionais" (`bifurcar`), e "Projéteis param ao
  // colidir com um alvo" (`projeteis_param`: sem Perfurar, Difundir nem Ricochetear).
  const bifurcar = projetil ? base('bifurcar') : 0;
  const param = projetil && base('projeteis_param') > 0;
  // (13/10) "X% mais Área de Efeito" (`area_mais`) multiplica o aumentado (lote 36: os dois em %; o raio no uso — `casasPelaArea`).
  const areaInc = t.has('area') ? base('area_inc') + localPorTag('area_inc_local') : 0;
  const areaMais = t.has('area') ? base('area_mais') : 0;
  return { projeteis: Math.floor(projeteis), perfurar: Math.floor(perfurar), areaInc, areaMais, ricochetes: Math.floor(ricochetes), bifurcar: Math.floor(bifurcar), param };
}

// ---------------------------------------------------------------- o que o personagem RECEBE

/** A ficha do personagem de cada caçada (fora do estado salvo: a caçada registra a cada tique). */
const FICHAS_DA_CACADA = new WeakMap();
export const definirFichaDaCacada = (hunt, fn) => { if (hunt) FICHAS_DA_CACADA.set(hunt, fn); };
export const fichaDa = (hunt) => FICHAS_DA_CACADA.get(hunt)?.() ?? null;

/** O controle do motor (`combate/controle.mjs`) → a afecção do PoE. */
const AFECCAO_DO_CONTROLE = { congelado: { nome: 'congelamento', elemental: true }, lento: { nome: 'resfriamento', elemental: true }, atordoado: { nome: 'atordoamento' } };

/**
 * O CONTROLE de um monstro no personagem (`Controle.tentar`), pelos mods do PoE: evitar (Congelamento, Resfriamento, Atordoamento, Afecções
 * Elementais), imunidade, a duração em você ("Duração do Congelamento em você reduzida", das Afecções), a "Recuperação de Atordoamentos"
 * (encurta o atordoamento) e o efeito do Resfriamento em você (a lentidão). `{ evitou, duracaoFator, pctFator, chanceFator }`.
 */
/** Você já está Congelado, Resfriado ou Eletrizado (as Afecções Não Danificadoras em você)? (dado puro: os dots e o controle da caçada) */
function jaTemNaoDanificadora(hunt) {
  const agora = hunt?.clock ?? 0;
  const c = hunt?.controle ?? {};
  return (c.congelado?.ate ?? 0) > agora || (c.lento?.ate ?? 0) > agora || (hunt?.debuffsDoJogador?.eletrizado?.ate ?? 0) > agora || (hunt?.efeitosDoJogador?.dots ?? []).some((d) => d.falta > 0 && (d.tipo === 'choque' || d.tipo === 'gelo'));
}
/**
 * A IMUNIDADE depois da afecção ("Você não pode ser Incendiado durante N segundos depois de ter sido Incendiado" — `imune_apos_<afecção>` =
 * segundos): marca no mesmo registro das imunidades por tempo dos frascos (`hunt.imunidadesPoe`), que o `dotNoJogador` e o controle leem.
 */
export function imunidadeApos(hunt, ficha, nome, agora = hunt?.clock ?? 0) {
  const s = Number(ficha?.afPoe?.[`imune_apos_${nome}`]) || 0;
  if (!(s > 0) || !hunt) return;
  const im = (hunt.imunidadesPoe ??= {});
  im[nome] = Math.max(im[nome] ?? 0, agora + s * 1000);
}
export function controleNoJogador(ficha, efeito, rng = Math.random, hunt = null, { soFisico = false, estado = null } = {}) {
  const a = AFECCAO_DO_CONTROLE[efeito];
  if (!ligado() || !ficha?.afPoe || !a) return { evitou: false, duracaoFator: 1, pctFator: 1, chanceFator: 1 };
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  // (+ a imunidade por tempo dos frascos: "Concede Imunidade a Congelamento por N segundos se usado enquanto Congelado".)
  const imunePorTempo = (hunt?.imunidadesPoe?.[a.nome] ?? 0) > (hunt?.clock ?? 0) || (efeito === 'lento' && (hunt?.imunidadesPoe?.lento ?? 0) > (hunt?.clock ?? 0));
  // (+ "Você não pode ficar Lento" — a árvore: só a lentidão.)
  if (v(`imune_${a.nome}`) > 0 || imunePorTempo || (efeito === 'lento' && v('imune_lento') > 0)) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 0 };
  // (ciclo 7, lote D) "Não pode ser Atordoado por Acertos que causem apenas Dano Físico".
  if (efeito === 'atordoado' && soFisico && v('imune_atordoamento_so_fisico') > 0) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 0 };
  // "Afecções Não Danificadoras Não Podem ser infligidas em você enquanto você já tiver uma": o Congelamento e o Resfriamento (o Atordoamento
  // não é afecção) não entram se você já está Congelado, Resfriado ou Eletrizado.
  if (a.elemental && v('afeccao_controle_unica') > 0 && hunt && jaTemNaoDanificadora(hunt)) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 0 };
  const evitar = v(`evitar_${a.nome}`) + (a.elemental ? v('avoid_elem_ailments') : 0);
  if (evitar > 0 && rng() * 100 < evitar) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 1 };
  // (+ "X% mais Duração de Afecções em você" — multiplica; o Atordoamento não é afecção.)
  // (lote 30: + "Debuffs em você expiram X% mais rápido" — o Atordoamento não é debuff)
  let duracaoFator = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100) * (a.elemental ? Math.max(0, 1 + v('duracao_afeccoes_propria_mais') / 100) : 1) * (efeito === 'atordoado' ? 1 : fatorDosDebuffs(ficha?.afPoe));
  if (efeito === 'atordoado') duracaoFator /= Math.max(0.1, 1 + v('stun_recovery') / 100);
  const pctFator = efeito === 'lento' ? Math.max(0, 1 + v('efeito_resfriamento_proprio') / 100) : 1;
  // "Ponto de Atordoamento reduzido": mais fácil de ser atordoado.
  // (+ lote D: "Ponto de Atordoamento aumentado" — "Cada Fúria também concede…" — e "X% do seu Escudo de Energia é adicionado ao seu Ponto de
  // Atordoamento": o limiar é a vida máxima; com o escudo somado, a chance cai na mesma proporção.)
  const vidaMax = Math.max(1, estado?.maxHp ?? 0);
  const doEscudo = estado ? (Math.max(0, ficha.energyShield ?? 0) * v('es_no_ponto_atordoamento')) / 100 / vidaMax : 0;
  const chanceFator = efeito === 'atordoado' ? 1 / Math.max(0.1, 1 - v('ponto_atordoamento_proprio_red') / 100) / Math.max(0.1, 1 + v('ponto_atordoamento_inc') / 100) / (1 + doEscudo) : 1;
  return { evitou: false, duracaoFator, pctFator, chanceFator };
}

/**
 * O fator do dano de `elemento` que passa pelas resistências do personagem, com as CONVERSÕES do dano recebido ("X% do Dano de Fogo dos
 * Acertos recebido como Dano de Gelo": essa parte passa pela resistência a Gelo). `protecao`: a da ficha (%). Sem conversão: 1 − res.
 */
export function fatorDaResistenciaRecebida(ficha, elemento, protecao = ficha?.protection ?? {}) {
  // (ciclo 7, lote H: a Inoculação do Caos — "Imune a Dano de Caos".)
  if (elemento === 'chaos' && ligado() && Number(ficha?.afPoe?.imune_caos) > 0) return 0;
  const res = (el) => Math.min(100, protecao[el] ?? 0);
  if (!ligado() || !ficha?.afPoe || !['fire', 'ice', 'energy', 'physical', 'chaos'].includes(elemento)) return 1 - res(elemento) / 100;
  const { convertido, resto } = conversoesRecebidas(ficha, elemento, res);
  return (convertido + resto * (1 - res(elemento) / 100)) * fatorDoDanoRecebido(ficha, elemento);
}
/**
 * As CONVERSÕES do dano recebido de `elemento`: `{ convertido, resto }` — `convertido`: a fração do golpe que vai para outros tipos, já com a
 * resistência de cada um (`res`); `resto`: a fração que continua `elemento`.
 */
function conversoesRecebidas(ficha, elemento, res) {
  let resto = 1;
  let convertido = 0;
  let paraCaos = 0;
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  // (+ os "Elemental … sofrido como Físico/Caos" valem para cada elemento.)
  const elemental = ['fire', 'ice', 'energy'].includes(elemento);
  for (const outro of ['fire', 'ice', 'energy', 'physical', 'chaos']) {
    if (outro === elemento) continue;
    const pct = v(`recebe_${elemento}_como_${outro}`) + (elemental ? v(`recebe_elemental_como_${outro}`) : 0);
    const parte = Math.min(resto, pct / 100);
    if (parte > 0) { convertido += parte * (1 - res(outro) / 100); resto -= parte; if (outro === 'chaos') paraCaos += parte * (1 - res('chaos') / 100); }
  }
  return { convertido, resto, paraCaos };
}
/**
 * (revisão PR2, 21/10) A fração do golpe de `elemento` que CHEGA como Caos (já com a resistência a Caos e o "dano recebido" do tipo, como em
 * `fatorDaResistenciaRecebida`): o Caos que continua Caos e o "X% do Dano … recebido como Dano de Caos" — no PoE a conversão do dano recebido vem antes da
 * divisão entre o Escudo e a Vida, e o que virou Caos atravessa o Escudo (`Defesa.absorverComOCaos`). Sem o PoE: o Caos é Caos, o resto não.
 */
export function parteCaosRecebida(ficha, elemento, protecao = ficha?.protection ?? {}) {
  if (!ligado() || !ficha?.afPoe || !['fire', 'ice', 'energy', 'physical', 'chaos'].includes(elemento)) return elemento === 'chaos' ? fatorDaResistenciaRecebida(ficha, elemento, protecao) : 0;
  if (elemento === 'chaos' && Number(ficha.afPoe.imune_caos) > 0) return 0;
  const res = (el) => Math.min(100, protecao[el] ?? 0);
  const { resto, paraCaos } = conversoesRecebidas(ficha, elemento, res);
  return (elemento === 'chaos' ? resto * (1 - res('chaos') / 100) : paraCaos) * fatorDoDanoRecebido(ficha, elemento);
}
/**
 * (revisão PR2, 21/10) O CAOS dentro das `partes` de um acerto recebido (`{ tipo: dano depois das resistências }`; `brutas`: o de antes): de cada tipo, a parte
 * que chega como Caos — o Físico pelo bruto (a armadura só corta o que continua Físico), os outros na proporção do fator da resistência daquele tipo.
 */
export function caosNasPartes(ficha, brutas = {}, partes = {}) {
  let c = 0;
  for (const [el, v] of Object.entries(partes)) {
    if (!(v > 0)) continue;
    if (el === 'physical') { c += Math.min(v, Math.max(0, brutas[el] ?? 0) * parteCaosRecebida(ficha, el)); continue; }
    c += Math.min(v, v * fracaoCaosDoTipo(ficha, el));
  }
  return c;
}
/** (revisão PR2, 21/10) Do dano de `elemento` que já passou pelas resistências, a fração que é Caos (1 no Caos sem conversão; 0 nos outros sem "recebido como Caos"). */
export function fracaoCaosDoTipo(ficha, elemento) {
  const f = fatorDaResistenciaRecebida(ficha, elemento);
  return f > 0 ? Math.min(1, Math.max(0, parteCaosRecebida(ficha, elemento) / f)) : elemento === 'chaos' ? 1 : 0;
}

// ---------------------------------------------------------------- a DEFESA FÍSICA do PoE 1 (dono, 10/10)

/** A armadura e a redução física adicional SOMAM, com teto (`Limites.reducaoFisicaTotal`): com o PoE ligado e a armadura no modo 'poe'. */
export const somaFisicaDoPoe = () => ligado() && Formulas.PARAMETROS.armadura.modo === 'poe';
/**
 * A redução física ADICIONAL do personagem (em %: Cargas de Tolerância, Adrenalina, peças) inteira — sem o teto de 75% das resistências da
 * ficha (o excedente volta): no PoE só o total, somado à armadura, tem teto.
 */
export const reducaoFisicaAdicional = (ficha, protecao = ficha?.protection ?? {}) => Math.max(0, (Number(protecao.physical) || 0) + (Number(ficha?.excedentes?.protection?.physical) || 0));
/** A fração de um golpe FÍSICO (`golpe`) que passa pela defesa física do personagem: a armadura contra esse golpe + a adicional, no teto. */
// (+ ciclo 7: a Guarda Desequilibrada — "Redução de Dano Máxima para qualquer Tipo de Dano é 50%" — o teto da redução física, `reducao_maxima`.)
// ("Redução de dano físico é zero" — `reducao_fisica_zero`: nem a armadura nem a redução adicional cortam o físico.)
export const fracaoFisicaRecebida = (ficha, golpe, armadura, { overwhelm = 0, protecao = ficha?.protection ?? {} } = {}) => {
  if (Number(ficha?.afPoe?.reducao_fisica_zero) > 0) return 1;
  const r = Limites.reducaoFisicaTotal(Formulas.reducaoDeArmaduraPoe(armadura, golpe), reducaoFisicaAdicional(ficha, protecao), overwhelm);
  const teto = ligado() ? Number(ficha?.afPoe?.reducao_maxima) || 0 : 0;
  return 1 - (teto > 0 ? Math.min(teto, r) : r) / 100;
};
/**
 * O ACERTO FÍSICO recebido no PoE 1, já com a defesa física: as conversões ("X% do Dano Físico sofrido como Dano de Fogo") saem antes, cada
 * parte com a resistência do seu tipo; o que CONTINUA Físico passa pela armadura (calculada sobre essa parte do golpe) e pela redução física
 * adicional SOMADAS, no teto (`fracaoFisicaRecebida`); o `fixo` ("−25 de Dano Físico sofrido dos Acertos") vem depois da defesa, e o "Dano
 * Físico recebido aumentado" por cima de tudo. `bruto`: o golpe antes disso tudo; `armadura`: a do personagem.
 */
export function acertoFisicoRecebido(ficha, bruto, armadura, { fixo = 0, overwhelm = 0, protecao = ficha?.protection ?? {} } = {}) {
  const res = (el) => Math.min(100, protecao[el] ?? 0);
  const { convertido, resto } = ficha?.afPoe ? conversoesRecebidas(ficha, 'physical', res) : { convertido: 0, resto: 1 };
  const fisico = bruto * resto;
  const comDefender = armadura * armaduraDefendida(ficha);
  return (bruto * convertido + Math.max(0, fisico * fracaoFisicaRecebida(ficha, fisico, comDefender, { overwhelm, protecao }) + fixo)) * fatorDoDanoRecebido(ficha, 'physical');
}
/**
 * (11/10) A JANELA DA RETALIAÇÃO (`hunt.retaliacao[gatilho] = { ate, usados }`): bloquear um acerto (`'bloquear'`) ou sofrer um Acerto
 * Selvagem (`'selvagem'` — "Um Acerto que remove ao menos 15% da Vida Máxima") deixa cada gema de Retaliação daquele gatilho usar UMA vez
 * por 2 s ("se tornam Utilizáveis por um tempo X% maior", "por N segundos adicionais").
 */
export const RETALIACAO = { janelaMs: 2000, selvagemPct: 15 };
export function abrirRetaliacao(hunt, gatilho, total, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  const ms = RETALIACAO.janelaMs * Math.max(0.1, 1 + (Number(total?.retaliacao_janela_inc) || 0) / 100) + 1000 * (Number(total?.retaliacao_janela_s) || 0);
  // (lote A5, dono 20/10 — D8: a janela guarda o início e a base — `de`, `msBase`: cada gema lê o seu tempo, com o "X% maior" do suporte dela)
  (hunt.retaliacao ??= {})[gatilho] = { ate: agora + ms, de: agora, msBase: ms, usados: [] };
}
/**
 * A gema de Retaliação `slug` pode ser usada agora? (lote A5, dono 20/10 — D8) `incDaGema`: o "se tornam Utilizáveis por um tempo X% maior" da Retaliação
 * Experiente que a suporta — a janela DESTA gema é a base × (1 + X%), contada do início (as outras gemas seguem com a base).
 */
export const retaliacaoUsavel = (hunt, gatilho, slug, agora = hunt?.clock ?? 0, incDaGema = 0) => {
  const j = hunt?.retaliacao?.[gatilho];
  if (!j || j.usados.includes(slug)) return false;
  const ate = incDaGema > 0 && j.msBase > 0 && j.de != null ? Math.max(j.ate, j.de + j.msBase * (1 + incDaGema / 100)) : j.ate;
  return ate > agora;
};
/**
 * Usou a gema de Retaliação: gasta o uso dela na janela ("X% de chance das Habilidades de Retaliação utilizadas continuarem Utilizáveis e não
 * consumirem um uso") e, com "X% de chance de, ao usar uma Habilidade de Retaliação, que uma Habilidade de Retaliação diferente se torne
 * Utilizável", as OUTRAS voltam a poder (a janela se abre de novo para elas). Conta o uso (a quarta sempre crítica).
 */
export function usarRetaliacao(hunt, gatilho, slug, total, agora = hunt?.clock ?? 0, rng = Math.random) {
  const j = hunt?.retaliacao?.[gatilho];
  hunt.retaliacaoUsos = (hunt.retaliacaoUsos ?? 0) + 1;
  if (j && !(rng() * 100 < (Number(total?.retaliacao_nao_consumir) || 0))) j.usados.push(slug);
  if (rng() * 100 < (Number(total?.retaliacao_outra_chance) || 0)) {
    for (const g of ['bloquear', 'selvagem']) {
      const atual = hunt.retaliacao?.[g];
      abrirRetaliacao(hunt, g, total, agora);
      if (atual?.usados?.includes(slug)) hunt.retaliacao[g].usados = [slug];
    }
  }
}

/**
 * (11/10) A FURTIVIDADE do PoE ("Furtividade aumentada em X%"): o raio em que os monstros notam você encolhe — `base ÷ (1 + X%)`
 * (`hunt/monstros.moverMonstros`, a percepção; quem já persegue segue perseguindo).
 */
export const percepcaoComFurtividade = (base, ficha) => base / Math.max(0.1, 1 + Math.max(0, valor(ficha, 'furtividade')) / 100);

/**
 * (11/10, o Inquisidor) As CARGAS FANÁTICAS: "Ganha 1 Carga Fanática a cada segundo se tiver Atacado no segundo anterior" (o ataque — a gema
 * ou o golpe básico — marca `usou:ataque`); "+N ao Máximo de Cargas Fanáticas"; ao chegar no máximo, "Ganha Fanatismo por N segundos" e "Perde
 * todas as Cargas Fanáticas". Sem ataque no segundo, a carga não vem.
 */
export function tiqueDasCargasFanaticas(hunt, ficha, agora = hunt?.clock ?? 0) {
  const porSegundo = valor(ficha, 'fanaticas_por_segundo');
  const max = valor(ficha, 'fanaticas_max');
  if (!(porSegundo > 0) || !(max > 0)) { delete hunt.fanaticas; return; }
  const f = (hunt.fanaticas ??= { n: 0, ultimo: agora });
  while (agora - f.ultimo >= 1000) {
    f.ultimo += 1000;
    const atacou = hunt.poeRecente?.['usou:ataque'];
    if (atacou == null || atacou < f.ultimo - 1000 || atacou > f.ultimo) continue;
    f.n = Math.min(max, f.n + porSegundo);
    if (f.n >= max) {
      const s = valor(ficha, 'fanatismo_ao_max_s');
      if (s > 0) ganharBuff(hunt, 'fanatismo', s, agora);
      if (valor(ficha, 'fanaticas_perde_no_max') > 0) f.n = 0;
    }
  }
}
/** (11/10, o Deadeye) A FORÇA DOS VENTOS: "Ganha 1 de Força dos Ventos ao usar uma Habilidade" (até 10; "Cada instância dura 4 segundos"). */
export const FORCA_DOS_VENTOS = { maximo: 10, duracaoMs: 4000 };
export function ganharForcaDosVentos(hunt, ficha, agora = hunt?.clock ?? 0) {
  const n = valor(ficha, 'forca_ventos_ao_usar');
  if (!hunt || !ligado() || !(n > 0)) return;
  const atual = hunt.forcaDosVentos?.ate > agora ? hunt.forcaDosVentos.n : 0;
  hunt.forcaDosVentos = { n: Math.min(FORCA_DOS_VENTOS.maximo, atual + n), ate: agora + FORCA_DOS_VENTOS.duracaoMs };
}

/** (ciclo 7) Guarda o Dano Físico NEGADO de um acerto (o bruto − o que passou) para o "Regenerado como Escudo/Vida por segundo". */
export function registrarFisicoNegado(hunt, v, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado() || !(v > 0)) return;
  (hunt.poeFisicoNegado ??= []).push({ t: agora, v });
  if (hunt.poeFisicoNegado.length > 200) hunt.poeFisicoNegado.splice(0, hunt.poeFisicoNegado.length - 200);
}
/** (ciclo 7, lote D) "X% de chance de Defender com Y% de Armadura" (`defender_armadura:<Y>` = X): o fator da armadura neste golpe (o maior que sair). */
export function armaduraDefendida(ficha, rng = Math.random) {
  let f = 1;
  for (const [k, x] of Object.entries(ficha?.afPoe ?? {})) {
    if (!k.startsWith('defender_armadura:') || !(x > 0)) continue;
    const y = Number(k.slice('defender_armadura:'.length)) / 100;
    if (y > f && (x >= 100 || rng() * 100 < x)) f = y;
  }
  return f;
}
/** "Recebe X% de Dano Físico como Dano Extra de um Elemento aleatório": o dano EXTRA (já resistido) a partir do Físico bruto. */
export function extraDoFisicoRecebido(ficha, fisico, rng = Math.random) {
  const pct = ligado() ? Number(ficha?.afPoe?.fisico_recebido_como_elemento) || 0 : 0;
  if (!(pct > 0) || !(fisico > 0)) return 0;
  const el = ['fire', 'ice', 'energy'][Math.floor(rng() * 3)];
  return (fisico * pct) / 100 * fatorDaResistenciaRecebida(ficha, el);
}
/**
 * "Não pode Recuperar Vida fora o Dreno" (o Pacto Vaal — da árvore, `sem_recuperar_vida_fora_dreno`, ou de uma peça, `sempre:`/`keystone:pactoVaal`):
 * a regeneração, os frascos, as curas, o "Recupera X% de Vida ao…" e a recarga aplicada à vida não enchem a vida; o dreno, sim.
 */
export const vidaSoPeloDreno = (af) => Number(af?.sem_recuperar_vida_fora_dreno) > 0 || Number(af?.['sempre:pactoVaal']) > 0 || Number(af?.['keystone:pactoVaal']) > 0;
/** O monstro tem uma maldição sua ativa (`Reforcos.marcar` → `bicho.maldicoes`)? (dado puro: este módulo não importa os reforços) */
export const amaldicoadoPorVoce = (bicho, agora) => Object.values(bicho?.maldicoes ?? {}).some((m) => m && m.ate > agora);
/** (ciclo 7) A SUA Marca ativa no bicho (`bicho.maldicoes` com `marca`), ou null. */
export const marcaNoBicho = (bicho, agora) => Object.values(bicho?.maldicoes ?? {}).find((m) => m && m.marca && m.ate > agora) ?? null;
/** (ciclo 7) Uma regra da árvore guardada na Marca do bicho (`daMarca` — `acoes.efeitosDaMaldicao`): o número, ou 0. */
export const regraDaMarca = (bicho, agora, campo) => Number(marcaNoBicho(bicho, agora)?.daMarca?.[campo]) || 0;
/**
 * (ciclo 7) "Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer": a Marca do `morto` passa ao bicho vivo mais perto
 * (a até 6 casas), com o tempo que faltava. Devolve o novo marcado, ou null.
 */
export function transferirMarca(hunt, morto, agora = hunt?.clock ?? 0) {
  const par = Object.entries(morto?.maldicoes ?? {}).find(([, m]) => m && m.marca && m.ate > agora);
  if (!par) return null;
  let alvo = null;
  for (const m of hunt?.monstros ?? []) {
    if (m === morto || m.hp <= 0 || m.dummy) continue;
    const d = Math.max(Math.abs(m.x - morto.x), Math.abs(m.y - morto.y));
    if (d <= 6 && (!alvo || d < alvo.d)) alvo = { m, d };
  }
  if (!alvo) return null;
  const [id, marca] = par;
  const maldicoes = (alvo.m.maldicoes ??= {});
  for (const [k, x] of Object.entries(maldicoes)) if (x?.marca) delete maldicoes[k];
  maldicoes[id] = { ...marca };
  delete morto.maldicoes[id];
  return alvo.m;
}
/** O crítico do monstro no personagem: a chance × o Cego, e o dano extra × (1 − "Dano Extra recebido de Acertos Críticos reduzido"). */
export function criticoDoBicho(base, bicho, ficha, agora, rng = Math.random) {
  if (!ligado()) return null;
  // "Inimigos Envenenados por você não podem causar Golpes Críticos".
  if (Number(ficha?.afPoe?.envenenados_sem_critico) > 0 && (bicho?.dots ?? []).some((d) => (d.tipo === 'veneno' || d.tipo === 'venenoPoe') && d.falta > 0)) return { critico: false, fator: 1 };
  // (ciclo 7) "Inimigos Marcados não podem causar Golpes Críticos"; (lote D) "Acertos contra você Não podem ser Golpes Críticos se você foi
  // Atordoado Recentemente" (`sem_critico_recebido@atordoadoRecente`).
  if (regraDaMarca(bicho, agora, 'semCritico') > 0 || Number(ficha?.afPoe?.sem_critico_recebido) > 0) return { critico: false, fator: 1 };
  // (lote S2B: o Passe Enfeitiçado — o Feitiço seu suportado no monstro)
  if (semCriticoPeloFeitico(bicho, agora)) return { critico: false, fator: 1 };
  // ("Inimigos Próximos não podem causar Acertos Críticos": a aura põe `semCritico` nos de perto — `mods-poe.aurasProximas`.)
  if (ativo(bicho?.estados?.semCritico, agora)) return { critico: false, fator: 1 };
  // (lote 50, a Defesa Imprudente: "Acertos tem Chance de Acerto Crítico aumentada em X% contra você" — `crit_recebido_inc`)
  const criticoFator = doBicho(bicho, agora).criticoFator * Math.max(0, 1 + (Number(ficha?.afPoe?.crit_recebido_inc) || 0) / 100);
  // (+ "Você sofre Dano Extra dos Golpes Críticos de Inimigos Amaldiçoados reduzido em X%" — só do monstro amaldiçoado por você)
  const red = (Number(ficha?.afPoe?.crit_dmg_taken_red) || 0) + (amaldicoadoPorVoce(bicho, agora) ? Number(ficha?.afPoe?.crit_dmg_taken_red_amaldicoado) || 0 : 0);
  // (o Slayer: "Inimigos Próximos tem -X% de Multiplicador de Acerto Crítico" — a aura põe `critMultMenos` nos de perto, `mods-poe.aurasProximas`)
  const multMenos = ativo(bicho?.estados?.critMultMenos, agora) ? bicho.estados.critMultMenos.pct : 0;
  if (criticoFator === 1 && !red && !multMenos) return null;
  if (!(base.chance > 0) || !(rng() < base.chance * criticoFator)) return { critico: false, fator: 1 };
  return { critico: true, fator: Math.max(1, 1 + (base.fator - 1) * Math.max(0, 1 - red / 100) - multMenos / 100) };
}

// ---------------------------------------------------------------- o dano RECEBIDO (os únicos)

/**
 * O fator do dano que o personagem RECEBE de um tipo (`physical`, `fire`, `ice`, `energy`, `chaos`) e de um golpe (ataque/magia):
 * "Dano recebido aumentado em X%", "Dano Físico/Elemental/de Fogo… recebido aumentado", "Dano Mágico sofrido aumentado", e os "X% menos
 * Dano sofrido" (multiplicam). As condições de estado já entraram na soma.
 */
export function fatorDoDanoRecebido(ficha, elemento, { magia = false } = {}) {
  if (!ligado() || !ficha?.afPoe) return 1;
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  const elemental = ['fire', 'ice', 'energy'].includes(elemento);
  const inc = v('dano_recebido_inc') + v(`dano_${elemento}_recebido_inc`) + (elemental ? v('dano_elemental_recebido_inc') : 0) + (magia ? v('dano_magico_recebido_inc') : 0);
  // ("Ganha Redução de Dano Elemental adicional igual a metade da sua Resistência a Caos": no dano elemental, o "menos" da metade dela.)
  // (lote 32, P035: no teto da redução — 90%, ou o da Guarda Desequilibrada)
  const pelaResCaos = elemental && v('reducao_elemental_meia_res_caos') > 0 ? Math.max(0, 1 - Math.min(tetoDaReducao(ficha), Math.max(0, ficha.protection?.chaos ?? 0) / 2) / 100) : 1;
  // (O Físico do golpe corpo a corpo passa por aqui também: o "Dano Físico recebido aumentado".)
  // (+ o "mais/menos" de UM tipo — "X% menos Dano Físico e de Caos sofrido enquanto São", "10% menos Dano Físico Sofrido enquanto em Escudo
  // de Energia Cheio": `dano_<elemento>_recebido_mais`; lote 30: os cinco tipos.)
  const doTipo = { physical: 'dano_physical_recebido_mais', fire: 'dano_fire_recebido_mais', ice: 'dano_ice_recebido_mais', energy: 'dano_energy_recebido_mais', chaos: 'dano_chaos_recebido_mais' }[elemento];
  return Math.max(0, (1 + inc / 100) * (1 + v('dano_recebido_mais') / 100) * (1 + (doTipo ? v(doTipo) : 0) / 100) * pelaResCaos);
}
/**
 * "Armadura também é aplicada no Dano de Raio sofrido de Acertos", "… se aplica ao Dano de Caos" (`armadura_no_<elemento>`): o fator da
 * armadura do personagem nesse golpe (a conta do PoE, sobre o golpe daquele tipo) — 1 sem o mod.
 */
const ARMADURA_NO = { energy: 'armadura_no_energy', chaos: 'armadura_no_chaos' };
/**
 * (lote 32, P035) O TETO da Redução de Dano de qualquer tipo: 90% (o PoE); a Guarda Desequilibrada ("Redução de Dano Máxima para qualquer Tipo
 * de Dano é 50%") baixa — na física (`fracaoFisicaRecebida`), na da Armadura contra os outros tipos (`armaduraNoElemento`) e na adicional
 * elemental ("metade da sua Resistência a Caos" — `fatorDoDanoRecebido`).
 */
export const tetoDaReducao = (ficha) => { const t = ligado() ? Number(ficha?.afPoe?.reducao_maxima) || 0 : 0; return t > 0 ? Math.min(90, t) : 90; };
export function armaduraNoElemento(ficha, elemento, golpe) {
  // (+ o Juggernaut: "15% de Armadura também é aplicado ao Dano de Caos sofrido dos Acertos" — só essa parte da Armadura.)
  const parteNoCaos = elemento === 'chaos' ? Number(ficha?.afPoe?.armadura_no_caos_pct) || 0 : 0;
  if (!ligado() || !(golpe > 0) || !ARMADURA_NO[elemento] || !(Number(ficha?.afPoe?.[ARMADURA_NO[elemento]]) > 0 || parteNoCaos > 0)) return 1;
  const pct = Number(ficha?.afPoe?.[ARMADURA_NO[elemento]]) > 0 ? 100 : Math.min(100, parteNoCaos);
  return Math.max(0, 1 - Math.min(tetoDaReducao(ficha) / 100, Formulas.reducaoDeArmaduraPoe(((ficha.armor ?? 0) * pct) / 100, golpe)));
}
/** O dano FIXO a menos (ou a mais) por golpe: "-25 de Dano Físico sofrido dos Acertos de Ataques", "+N de Dano de Fogo sofrido quando acertado". */
export function fixoRecebido(ficha, elemento, { ataque = false, magia = false } = {}) {
  if (!ligado() || !ficha?.afPoe) return 0;
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  // (14/10: + o dos Acertos de MAGIA — a Lição das Estações: "-25 de dano sofrido de cada tipo de dano por ataques de magia por casca")
  return v(`${elemento}_sofrido_acerto`) + (ataque ? v(`${elemento}_sofrido_ataque`) : 0) + (magia ? v(`${elemento}_sofrido_magia`) : 0);
}
/** O Caos atravessa o Escudo de Energia (regra do PoE), a menos que um único diga que não. */
export const caosAtravessaOEscudo = (ficha) => ligado() && !((Number(ficha?.afPoe?.caos_nao_atravessa_escudo) || 0) > 0);

// ---------------------------------------------------------------- as PARTES do dano (conversões, ganhos extras, máscara)

const ELS = ['physical', 'fire', 'ice', 'energy', 'chaos'];
const ELEMENTAIS = ['fire', 'ice', 'energy'];
/*
 * (lote A5c, dono 20/10: "regra do PoE, no motor inteiro") As ORIGENS das partes: o dano CONVERTIDO (e o ganho "como Extra") recebe os modificadores de TODOS os
 * tipos por onde passou, sem contar duas vezes — o Físico convertido em Gelo soma o "Dano Físico aumentado" e o "Dano de Gelo aumentado". `origens`:
 * `{ elementoFinal: { 'physical+ice': [min, max], ice: [min, max] } }` — a chave são os tipos do caminho (na ordem de `ELS`); a penetração, a resistência e as
 * afecções seguem o tipo FINAL (a parte continua no elemento final).
 */
export const chaveDosTipos = (tipos) => ELS.filter((t) => tipos.includes(t)).join('+');
export const tiposDaChave = (k) => String(k).split('+').filter(Boolean);
/** Soma `[a, b] × m` na origem `tipos` da parte `el`. */
export function somarOrigem(origens, el, tipos, [a, b], m = 1) {
  if (!origens || !(a > 0 || b > 0) || !(m > 0)) return;
  const k = chaveDosTipos([...tipos, el]);
  const o = (origens[el] ??= {});
  const x = o[k] ?? [0, 0];
  o[k] = [x[0] + a * m, x[1] + b * m];
}
/**
 * (lote A5c) O fator médio da parte pelas origens dela: Σ (média da origem × `f(tipos)`) ÷ Σ médias. Sem origens, `f([final])` — o dano que só foi do
 * próprio tipo. (A faixa da parte rola uma vez com esse fator; a média do golpe é a exata do PoE.)
 */
export function fatorPelasOrigens(subs, final, f) {
  let soma = 0;
  let peso = 0;
  for (const [k, [a, b]] of Object.entries(subs ?? {})) {
    const m = (a + b) / 2;
    if (!(m > 0)) continue;
    soma += m * f(tiposDaChave(k));
    peso += m;
  }
  return peso > 0 ? soma / peso : f([final]);
}
/** (lote A5c) O "X% mais Dano de <tipo>" do golpe (a ficha do golpe; sem ela, o sem condição). */
export const maisDoTipo = (ficha, t) => ficha?.maisDoElemento?.[t] ?? (Number(ficha?.afPoe?.[MAIS_DANO_DO_TIPO[t]]) || 0);
/**
 * (lote A5c) Os "mais" da origem que o acerto não põe: o "mais" de cada tipo do caminho que não é o final (o do final entra no acerto —
 * `fatorRecebidoPeloBicho`) e o "mais Dano Elemental" (`fatorDoDanoElemental`) uma vez só, se algum tipo do caminho for elemental (o final, se for).
 */
export function maisDaOrigem(ficha, hunt, habilidade, tipos, final) {
  let f = 1;
  for (const t of tipos) if (t !== final) f *= Math.max(0, 1 + maisDoTipo(ficha, t) / 100);
  const el = ELEMENTAIS.includes(final) ? final : tipos.find((t) => ELEMENTAIS.includes(t));
  return f * (el ? fatorDoDanoElemental(ficha, hunt, habilidade, el) : 1);
}
/**
 * As partes de dano de um golpe (`{ elemento: [min, max] }`) com os mods do PoE dos únicos: as CONVERSÕES entre elementos ("X% do Dano de
 * Fogo Convertido em Dano de Caos", "Todo o Dano Elemental é Convertido para Dano de Caos"), os GANHOS extras ("Ganha X% de Dano Elemental
 * como Dano Extra de Caos", "X% do Dano de Gelo como Fogo extra") e a MÁSCARA ("Não Causa Dano Elemental", "Causa Somente Dano de Raio").
 * O Físico do golpe já passou pelas conversões dele (`extrasDoFisico`). Devolve outro objeto.
 * (lote A5c: `origens` — as origens das partes, `somarOrigem` — andam junto: o que se converte ou se ganha leva o tipo novo na chave; muda no lugar)
 */
export function transformarPartes(ficha, partes, origens = null) {
  if (!ligado() || !ficha?.afPoe || !partes) return partes;
  const v = (k) => valor(ficha, k);
  const p = Object.fromEntries(ELS.map((el) => [el, [...(partes[el] ?? [0, 0])]]));
  const o = origens ? Object.fromEntries(ELS.map((el) => [el, { ...(origens[el] ?? (p[el][0] > 0 || p[el][1] > 0 ? { [el]: [...p[el]] } : {})) }])) : null;
  const mover = (de, para, pct) => {
    const f = Math.max(0, Math.min(100, pct)) / 100;
    if (!f) return;
    for (const i of [0, 1]) { const x = p[de][i] * f; p[de][i] -= x; p[para][i] += x; }
    if (o) for (const [k, [a, b]] of Object.entries(o[de])) { somarOrigem(o, para, tiposDaChave(k), [a, b], f); o[de][k] = [a * (1 - f), b * (1 - f)]; }
  };
  // (revisão do lote da eficácia, 20/10 — como o PoB, CalcOffence.lua `buildConversionTable`/`calcDamage`) o GANHO como extra de um tipo é sobre o dano dele
  // ANTES de ele se converter (já com o que ele recebeu dos tipos anteriores): o `antes` de cada tipo é guardado logo antes de converter ele — antes, depois de
  // todas as conversões (o Gelo em Fogo: 100 de Gelo, 50% convertido e 29% ganho davam 64,5 de Fogo; no PoB, 79). E a conversão da HABILIDADE (`conv_hab_<de>_<para>`:
  // a do suporte — o Gelo em Fogo, 50%) vem primeiro; as das outras fontes ficam com o que sobrou, proporcionais se passarem dele (antes, uma depois da outra)
  const antes = Object.fromEntries(ELS.map((el) => [el, [...p[el]]]));
  const antesO = o ? Object.fromEntries(ELS.map((el) => [el, Object.fromEntries(Object.entries(o[el]).map(([k, x]) => [k, [...x]]))])) : null;
  for (const de of ['fire', 'ice', 'energy']) {
    antes[de] = [...p[de]];
    if (o) antesO[de] = Object.fromEntries(Object.entries(o[de]).map(([k, x]) => [k, [...x]]));
    const destinos = ['chaos', ...['fire', 'ice', 'energy'].filter((x) => x !== de)];
    const daHab = destinos.map((para) => [para, Math.max(0, v(`conv_hab_${de}_${para}`))]);
    const totalHab = daHab.reduce((t, [, x]) => t + x, 0);
    const escalaHab = totalHab > 100 ? 100 / totalHab : 1;
    const resta = Math.max(0, 100 - totalHab * escalaHab);
    const globais = destinos.map((para) => [para, Math.max(0, para === 'chaos' ? v(`conv_${de}_chaos`) + v('conv_elemental_chaos') : v(`conv_${de}_${para}`))]);
    const totalGlobal = globais.reduce((t, [, x]) => t + x, 0);
    const escalaGlobal = totalGlobal > resta ? (totalGlobal > 0 ? resta / totalGlobal : 0) : 1;
    // as frações sobre o dano de ANTES da conversão deste tipo (cada `mover` tira do que sobrou: a fração equivalente)
    let sobra = 1;
    for (const [para, pct] of [...daHab.map(([x, y]) => [x, y * escalaHab]), ...globais.map(([x, y]) => [x, y * escalaGlobal])]) {
      const frac = pct / 100;
      if (!(frac > 0) || !(sobra > 1e-12)) continue;
      mover(de, para, (Math.min(frac, sobra) / sobra) * 100);
      sobra -= Math.min(frac, sobra);
    }
  }
  // (+ o de UM elemento para Caos — "Receba X% do Dano de Fogo como Dano de Caos Extra".)
  const paraCaos = { fire: 'fire_as_extra_chaos', ice: 'ice_as_extra_chaos', energy: 'energy_as_extra_chaos' };
  for (const de of ['fire', 'ice', 'energy']) { ganharDe(antes, p, de, 'chaos', v('elem_as_extra_chaos') + v(paraCaos[de])); for (const para of ['fire', 'ice', 'energy']) if (para !== de) ganharDe(antes, p, de, para, v(`${de}_as_extra_${para}`)); }
  for (const de of ['physical', 'fire', 'ice', 'energy']) ganharDe(antes, p, de, 'chaos', v('naocaos_as_extra_chaos'));
  // A máscara.
  const so = ELS.find((el) => v(`so_dano:${el}`) > 0);
  for (const el of ELS) {
    const sem = v(`sem_dano:${el}`) > 0 || (v('sem_dano:elemental') > 0 && ['fire', 'ice', 'energy'].includes(el)) || (v('sem_dano:naocaos') > 0 && el !== 'chaos') || (so && el !== so) || (v('sem_dano:naoelemental') > 0 && !['fire', 'ice', 'energy'].includes(el)) || (v('sem_dano:naofisico') > 0 && el !== 'physical');
    if (sem) { p[el] = [0, 0]; if (o) o[el] = {}; }
  }
  // (a Tempestade Turbulenta: "-X% de dano elétrico mínimo", "+X% de dano elétrico máximo" — o mínimo e o máximo da parte de Raio.)
  const rMin = v('raio_min_mais');
  const rMax = v('raio_max_mais');
  if ((rMin || rMax) && (p.energy[0] > 0 || p.energy[1] > 0)) {
    const a = p.energy[0] * Math.max(0, 1 + rMin / 100);
    const b = p.energy[1] * Math.max(0, 1 + rMax / 100);
    p.energy = [Math.min(a, b), Math.max(a, b)];
    if (o) for (const k of Object.keys(o.energy)) o.energy[k] = [o.energy[k][0] * Math.max(0, 1 + rMin / 100), o.energy[k][1] * Math.max(0, 1 + rMax / 100)];
  }
  if (origens) {
    for (const k of Object.keys(origens)) delete origens[k];
    for (const el of ELS) {
      const subs = Object.fromEntries(Object.entries(o[el]).filter(([, [a, b]]) => a > 0 || b > 0));
      if (Object.keys(subs).length && (p[el][0] > 0 || p[el][1] > 0)) origens[el] = subs;
    }
  }
  return Object.fromEntries(Object.entries(p).filter(([, [a, b]]) => a > 0 || b > 0));
  function ganharDe(base, alvo, de, para, pct) {
    const f = pct / 100;
    if (!(f > 0)) return;
    for (const i of [0, 1]) alvo[para][i] += base[de][i] * f;
    if (o) for (const [k, x] of Object.entries(antesO[de])) somarOrigem(o, para, tiposDaChave(k), x, f);
  }
}
/** O Físico do golpe sai (a máscara) — "Não causa Dano Físico", "Causa Somente Dano de Raio"… */
export function semFisico(ficha) {
  if (!ligado() || !ficha?.afPoe) return false;
  const v = (k) => valor(ficha, k);
  const so = ELS.find((el) => v(`so_dano:${el}`) > 0);
  return v('sem_dano:physical') > 0 || v('sem_dano:naocaos') > 0 || v('sem_dano:naoelemental') > 0 || (so && so !== 'physical');
}

/**
 * O dano a MAIS que o bicho recebe pelos estados do PoE: Coberto em Cinzas (+20% de Fogo), Intimidado (+10% de dano de Ataque), Definhado
 * (+6% de Caos por acúmulo, até 15), Eletrizado já está em `Ficha.rolarCritico`. `ficha`: a do golpe (as tags dizem se é ataque).
 */
export function fatorRecebidoPeloBicho(alvo, tipo, ficha, agora) {
  if (!ligado() || !alvo) return 1;
  // (ciclo 7: o monstro sem estados ainda também passa — a Marca dele mora em `maldicoes`)
  const e = alvo.estados ?? {};
  let f = 1;
  // (lote 30, P016/P076) "X% mais Dano de Caos/Gelo/…" — o "mais" de UM tipo, só na parte daquele tipo do golpe (a do golpe, com as condições
  // dele — `fichaDoGolpe` → `maisDoElemento`; sem ela, o sem condição da ficha).
  const maisDoTipo = ficha?.maisDoElemento?.[tipo] ?? (Number(ficha?.afPoe?.[MAIS_DANO_DO_TIPO[tipo]]) || 0);
  if (maisDoTipo) f *= Math.max(0, 1 + maisDoTipo / 100);
  if (tipo === 'fire' && ativo(e.cinzas, agora)) f *= 1.2;
  // (lote 71: + "Inimigos Provocados por seus Clamores são Intimidados" e "Inimigos Amaldiçoados por você são Enervados")
  const intimidado = ativo(e.intimidado, agora) || (Number(ficha?.afPoe?.provocados_clamor_intimidados) > 0 && provocadoPeloClamor(alvo, agora));
  if (intimidado && (ficha?.tagsDoGolpe ?? []).includes('ataque')) f *= 1.1;
  // Inervado (PoE: "Unnerve"): o alvo sofre 10% mais dano de magias.
  const inervado = ativo(e.inervado, agora) || (Number(ficha?.afPoe?.amaldicoados_inervados) > 0 && maldicoesNoAlvo(alvo, agora) > 0);
  if (inervado && (ficha?.tagsDoGolpe ?? []).includes('magia')) f *= 1.1;
  // (lote 72) o Esconjuro: 10% de dano sofrido aumentado (`esconjurado`)
  if (esconjurado(alvo, ficha?.afPoe, agora)) f *= 1 + ESCONJURO.pct / 100;
  if (tipo === 'chaos' && ativo(e.definhado, agora)) f *= 1 + 0.06 * Math.max(0, 1 + (Number(ficha?.afPoe?.efeito_definhamento) || 0) / 100) * Math.min(15, e.definhado.n ?? 1);
  // (lote C4, dono 21/10) o Tolhido pela Praga Vaal: "Inimigos Desacelerados sofrem Dano de Caos aumentado em 30%" (também no pulso do dano contínuo — `fatorRecebidoNoDot`)
  if (tipo === 'chaos' && ativo(e.tolhidoCaos, agora)) f *= 1 + (e.tolhidoCaos.pct ?? 0) / 100;
  // Coberto de Gelo (PoE): +20% de dano de Gelo recebido.
  if (tipo === 'ice' && ativo(e.cobertoGelo, agora)) f *= 1.2;
  // "Inimigos sofrem permanentemente Dano aumentado em X% por cada segundo que passaram Congelados/Resfriados por você, máximo de Y%".
  const p = e.permanente;
  if (p) f *= 1 + (Math.min(p.congeladoMax ?? 0, ((p.congelado ?? 0) * (p.msCongelado ?? 0)) / 1000) + Math.min(p.resfriadoMax ?? 0, ((p.resfriado ?? 0) * (p.msResfriado ?? 0)) / 1000)) / 100;
  // "Inimigos Eletrizados ou Congelados por você sofrem Dano Elemental aumentado em X%" (do atacante).
  if (['fire', 'ice', 'energy'].includes(tipo) && (ativo(e.chocado, agora) || ativo(e.congelado, agora))) f *= 1 + (Number(ficha?.afPoe?.dano_elemental_eletrizado_congelado) || 0) / 100;
  // (ciclo 7) "Inimigo Marcado sofre Dano aumentado em X%".
  const marcado = regraDaMarca(alvo, agora, 'danoSofrido');
  if (marcado) f *= 1 + marcado / 100;
  // (lote E) "Cada Mina aplica Dano sofrido aumentado em X% aos Inimigos próximos a ela, até Y%" (`mods-poe.aoAcertar` acumula no alvo da
  // Mina) e "Inimigos que você Provocar recebem Dano aumentado em X%".
  if (ativo(e.minaFragil, agora)) f *= 1 + (e.minaFragil.pct ?? 0) / 100;
  // (lote E2B, 26/10 — o PoB, BearTrap: TrapMineDamageTaken) "Inimigos recebem 25% de aumento de Dano dos Acertos de Minas ou Armadilhas" — o debuff de Urso, só no acerto
  // de Armadilha ou Mina (as tags do golpe)
  const doUrso = danoDoUrso(alvo, agora);
  if (doUrso > 0 && (ficha?.tagsDoGolpe ?? []).some((t) => t === 'armadilha' || t === 'mina')) f *= 1 + doUrso / 100;
  // (lote D1, decisão do dono 27/10 — o PoB, FleshAndStone: PhysicalDamageTaken MORE, ModFlag.Hit) o Carne e Pedra na Postura de Sangue: o inimigo na aura sofre X% mais
  // Dano Físico dos Acertos — o valor cheio, sem a queda pela distância
  if (tipo === 'physical') f *= fatorDoSangue(alvo, agora);
  // (12/10) "Inimigos sofrem Dano aumentado em X% para cada uma de suas Runas Vinculadas a eles" (`runas-vinculadas.marcarNosInimigos`).
  if (alvo.runasVinculadas > 0) f *= 1 + (alvo.runasVinculadas * (Number(ficha?.afPoe?.dano_por_runa_vinculada) || 0)) / 100;
  // ("Cada Totem aplica Dano aumentado em X% sofrido pelos Inimigos próximos a ele" — `mods-poe.aurasProximas`.)
  if (ativo(e.totemFragil, agora)) f *= 1 + (e.totemFragil.pct ?? 0) / 100;
  // (ciclo 7) a Geada Cortante: "Inimigos esfriados pelos seus ataques sofrem dano de frio aumentado pelo esfriamento" — o efeito do Resfriamento.
  // (lote A5, dono 20/10 — D5) + o do Resfriamento Ósseo: o Resfriamento posto pela habilidade suportada, ou a área fria dela (`fragilGelo` no bicho, com a
  // duração do Resfriamento — `afeccoes.aoAcertar`, `cacadas.resfriarNasAreasFrias`): vale em qualquer Gelo no inimigo (o debuff do PoE), uma vez só com o da árvore
  if (tipo === 'ice' && ativo(e.lento, agora) && (Number(ficha?.afPoe?.resfriado_fragil) > 0 || ativo(e.fragilGelo, agora))) f *= 1 + (e.lento.pct ?? 0) / 100;
  // (lote G) sobre o seu Solo Sagrado; perto do seu Estandarte (`mods-poe.aurasProximas`).
  if (ativo(e.soloFragil, agora)) f *= 1 + (e.soloFragil.pct ?? 0) / 100;
  if (ativo(e.auraFragil, agora)) f *= 1 + (e.auraFragil.pct ?? 0) / 100;
  // (lote F) "Inimigos próximos Sofrem X% de Dano Elemental aumentado" (a aura); "Efeito do Definhamento aumentado" (o atacante).
  if (['fire', 'ice', 'energy'].includes(tipo) && ativo(e.auraElemFragil, agora)) f *= 1 + (e.auraElemFragil.pct ?? 0) / 100;
  // (+ lote H: o provocado pelo Clamor — `Reforcos.provocar` grava `provocadoAte`.) (lote 31, P037: "Inimigos que você Provocar" = o Provocado
  // por você, não pelo totem nem pelo lacaio; "Inimigos Provocados por seus Clamores" = só o do Clamor.)
  if (provocadoPorVoce(alvo, agora)) f *= 1 + (Number(ficha?.afPoe?.provocados_dano_sofrido) || 0) / 100;
  if (provocadoPeloClamor(alvo, agora)) f *= 1 + (Number(ficha?.afPoe?.provocados_clamor_dano_sofrido) || 0) / 100;
  // "Inimigos Resfriados pelos seus Acertos têm Dano sofrido aumentado pelo Efeito do Resfriamento"; "Inimigos sofrem Dano Elemental dos seus
  // Acertos aumentado em X% por cada Definhamento".
  if (Number(ficha?.afPoe?.resfriados_sofrem_mais) > 0 && ativo(e.lento, agora)) f *= 1 + (e.lento.pct ?? 0) / 100;
  if (['fire', 'ice', 'energy'].includes(tipo) && ativo(e.definhado, agora)) f *= 1 + ((Number(ficha?.afPoe?.dano_elemental_por_definhamento) || 0) * Math.min(15, e.definhado.n ?? 1)) / 100;
  // ("Inimigos Amaldiçoados por você sofrem Dano aumentado em X% se Y% da Duração da Maldição expirou" — a maldição guarda `danoApos`.)
  for (const m of Object.values(alvo?.maldicoes ?? {})) if (m?.danoApos && m.ate > agora && agora - (m.desde ?? agora) >= m.danoApos.apos * (m.dur ?? 0)) f *= 1 + m.danoApos.pct / 100;
  // "Inimigos sofrem Dano aumentado em X% por cada tipo de Afecção que você infligiu neles".
  const porAfeccao = Number(ficha?.afPoe?.dano_por_afeccao_no_alvo) || 0;
  if (porAfeccao) f *= 1 + (porAfeccao * afeccoesNoAlvo(alvo, agora)) / 100;
  return f;
}
/**
 * (lote C4, dono 21/10: "o dano sofrido aumentado do alvo vale no dano contínuo, como no PoE") O que o ALVO sofre a mais no PULSO do dano contínuo (`Dot.tique`):
 * os estados dele que o PoB põe como DamageTaken / <Tipo>DamageTaken (sem ModFlag de Acerto, Ataque ou Magia) — o Definhado (+6% de Caos por acúmulo), as Cinzas,
 * o Coberto de Gelo, o Tolhido pela Praga Vaal, a Marca, o Esconjuro, os solos e auras frágeis, o "permanente", a maldição com o `danoApos` — e a ELETRIZAÇÃO (o
 * "increased Damage taken" do Shock). Fica de fora o que é do atacante (a ficha do golpe: o "mais" do tipo, os "contra Inimigos X"), o que é só de Acerto, de Ataque
 * (o Intimidado) ou de Magia (o Inervado). A Exposição já está na resistência (`hunt/resistencia`), que o pulso usa.
 */
const FICHA_DO_DOT = Object.freeze({ afPoe: Object.freeze({}), tagsDoGolpe: Object.freeze([]) });
/*
 * (revisão do C4, 21/10 — o PoB: o Definhado é `6 × (1 + WitherEffect)` no `enemyDB ChaosDamageTaken`, CalcPerform.lua; os "Inimigos … sofrem Dano aumentado" são
 * `EnemyModifier DamageTaken`, ModParser.lua — sem flag de Acerto: valem no dano contínuo, CalcOffence.lua) as chaves do ATACANTE que são dano SOFRIDO pelo inimigo (não
 * o "mais" do tipo, que é dano do atacante, nem as só de Acerto, de Ataque ou de Magia): o dano contínuo as leva na `origem.sofrido` (`sofridoDoAtacante`), e o pulso
 * as usa (`fatorRecebidoNoDot`). Vale o efeito de quem pôs o dano contínuo, na hora em que pôs.
 */
const CHAVES_SOFRIDO_NO_DOT = Object.freeze(['efeito_definhamento', 'dano_elemental_eletrizado_congelado', 'dano_por_runa_vinculada', 'provocados_dano_sofrido', 'provocados_clamor_dano_sofrido', 'resfriado_fragil', 'resfriados_sofrem_mais', 'dano_por_afeccao_no_alvo', 'amaldicoados_esconjuro_apos_pct']);
/** As chaves de dano sofrido do atacante (`afPoe`) que valem no pulso do dano contínuo — um objeto pequeno, que grava e volta com a caçada; null sem nenhuma. */
export function sofridoDoAtacante(afPoe) {
  const r = {};
  for (const k of CHAVES_SOFRIDO_NO_DOT) if (Number(afPoe?.[k]) > 0) r[k] = Number(afPoe[k]);
  return Object.keys(r).length ? r : null;
}
export function fatorRecebidoNoDot(alvo, tipo, agora, sofrido = null) {
  if (!ligado() || !alvo) return 1;
  const e = alvo.estados ?? {};
  const pilha = (e.chocadosPilha ?? []).filter((x) => x.ate > agora);
  const eletrizacao = pilha.length ? 1 + pilha.reduce((t, x) => t + (x.pct ?? 0), 0) / 100 : ativo(e.chocado, agora) ? 1 + (e.chocado.pct ?? 0) / 100 : 1;
  return fatorRecebidoPeloBicho(alvo, tipo, sofrido ? { afPoe: sofrido, tagsDoGolpe: FICHA_DO_DOT.tagsDoGolpe } : FICHA_DO_DOT, agora) * eletrizacao;
}
/** As chaves com escala do ALVO (`resfriamentoNoAlvo:N`, `eletrizacaoNoAlvo:N`), guardadas por soma (`afPoe`). */
const ESCALAS_DO_ALVO = /^(resfriamentoNoAlvo|eletrizacaoNoAlvo)(:|$)/;
const CACHE_DO_ALVO = new WeakMap();
function escaladosPeloAlvo(af) {
  if (!af) return [];
  let l = CACHE_DO_ALVO.get(af);
  if (!l) {
    l = Object.entries(af).filter(([k, v]) => typeof v === 'number' && k.includes('%')).map(([k, valor]) => ({ ...partir(k), valor })).filter((x) => ESCALAS_DO_ALVO.test(x.escala ?? '')).map((x) => ({ stat: x.stat, escala: x.escala, teto: x.teto, valor: x.valor, tags: x.conds }));
    CACHE_DO_ALVO.set(af, l);
  }
  return l;
}
/** O fator de uma escala do ALVO agora: a cada N% de efeito do Resfriamento / da Eletrização nele. */
function fatorDoAlvo(alvo, agora, escala) {
  const [tipo, n] = String(escala).split(':');
  const e = alvo?.estados ?? {};
  const pct = tipo === 'resfriamentoNoAlvo' ? (ativo(e.lento, agora) ? e.lento.pct ?? 0 : 0) : tipo === 'eletrizacaoNoAlvo' ? (ativo(e.chocado, agora) ? e.chocado.pct ?? 0 : 0) : 0;
  return Math.floor(Math.max(0, pct) / Math.max(1, Number(n) || 1));
}
/** O bicho EXCOMUNGADO ("Excomunga inimigos ao Atingir Corpo a Corpo"): não causa dano de Caos. */
export const semCaos = (bicho, agora) => ligado() && ativo(bicho?.estados?.excomungado, agora);
/** Quantas MALDIÇÕES (e marcas) estão no bicho agora. */
export const maldicoesNoAlvo = (alvo, agora) => Object.values(alvo?.maldicoes ?? {}).filter((m) => m && m.ate > agora).length;
/** Quantos TIPOS de afecção estão no bicho agora: Sangramento, Incêndio, Veneno, Eletrização, Resfriamento, Congelamento, Causticado, Exaurido. */
export function afeccoesNoAlvo(alvo, agora) {
  const e = alvo?.estados ?? {};
  const dot = (...t) => (alvo?.dots ?? []).some((d) => t.includes(d.tipo) && d.falta > 0);
  return [dot('sangramento'), dot('queimadura'), dot('veneno', 'venenoPoe'), ativo(e.chocado, agora), ativo(e.lento, agora), ativo(e.congelado, agora), ativo(e.causticado, agora), ativo(e.exaurido, agora)].filter(Boolean).length;
}
/** As resistências a menos que as afecções do personagem deixam no bicho: −X% Elementais (Incendiado/Resfriado), −X% Caos (Envenenado). */
export function resMenosDasAfeccoes(alvo, agora, tipo) {
  const e = alvo?.estados;
  if (!ligado() || !e) return 0;
  const dot = (...t) => (alvo.dots ?? []).some((d) => t.includes(d.tipo) && d.falta > 0);
  // (lote 28: + o Definhado — "têm −X% de todas as Resistências", nos quatro tipos, somado às das afecções)
  const definhado = ['fire', 'ice', 'energy', 'chaos'].includes(tipo) && e.resMenosDefinhado > 0 && ativo(e.definhado, agora) ? e.resMenosDefinhado : 0;
  // (lote 69: + o "−X% de Resistência a Fogo" do Incendiado, somado)
  const doFogo = tipo === 'fire' && e.resMenosFogo > 0 && dot('queimadura') ? e.resMenosFogo : 0;
  if (['fire', 'ice', 'energy'].includes(tipo) && e.resMenosElemental > 0 && (dot('queimadura') || ativo(e.lento, agora))) return e.resMenosElemental + definhado + doFogo;
  if (doFogo) return doFogo + definhado;
  if (tipo === 'chaos' && e.resMenosCaos > 0 && dot('veneno', 'venenoPoe')) return e.resMenosCaos + definhado;
  return definhado;
}
/** A resistência a menos do bicho Exposto (−10% no elemento), além do Causticar. */
// (09/10) A exposição posta pelo "Inflige Exposição a Fogo ao Acertar, aplicando −X%" guarda o X (`exposicaoPct`); a das auras, 10.
/**
 * A Exposição a `tipo` no alvo (o quanto tira da resistência). (lote E) Com a ficha de quem infligiu (`af` — o personagem da caçada):
 * "Exposições infligidas por você aplicam X% extra" (`exposicao_extra`) e "aplicam ao menos X%" (`exposicao_minima`).
 */
const EXTRA_DA_EXPOSICAO = { fire: 'exposicao_extra_fogo', ice: 'exposicao_extra_gelo', energy: 'exposicao_extra_raio' };
/**
 * (lote A5, dono 20/10 — D10: "uma função única para pôr Exposição") PÕE a Exposição a `el` no alvo: −`pct`% por `ms`. Como no PoE, só a mais forte de cada
 * elemento vale: com uma ainda ativa, fica o maior % e a duração que acaba depois; a vencida não conta (antes o Raio Abrasador guardava o % de uma Exposição
 * já vencida). Quem usa: o acerto (`mods-poe.aoAcertar` — a de valor fixo e a com chance), o Raio Abrasador, a Bomba Congelante e a Onda de Convicção.
 */
export function porExposicao(alvo, el, pct, ms, agora) {
  if (!alvo || !['fire', 'ice', 'energy'].includes(el) || !(pct > 0) || !(ms > 0)) return false;
  const e = (alvo.estados ??= {});
  const fim = e.exposicao?.[el] ?? 0;
  const ainda = fim > agora;
  e.exposicao = { ...(e.exposicao ?? {}), [el]: ainda ? Math.max(fim, agora + ms) : agora + ms };
  e.exposicaoPct = { ...(e.exposicaoPct ?? {}), [el]: ainda ? Math.max(e.exposicaoPct?.[el] ?? 10, pct) : pct };
  return true;
}
export function exposicao(alvo, agora, tipo, af = null) {
  if (!((alvo?.estados?.exposicao?.[tipo] ?? 0) > agora)) return 0;
  // (13/10, as Maestrias de Fogo/Gelo/Raio: "Exposição a Fogo infligida por você aplica X% extra" — a Exposição das gemas, das auras e dos
  // Vínculos (os 10% do PoE) também; a do acerto já guarda o extra em `exposicaoPct` — `mods-poe.aoAcertar`.)
  const pct = alvo.estados.exposicaoPct?.[tipo];
  const base = (pct ?? (10 + Math.abs(Number(af?.[EXTRA_DA_EXPOSICAO[tipo]]) || 0))) + Math.abs(Number(af?.exposicao_extra) || 0);
  return Math.max(base, Math.abs(Number(af?.exposicao_minima) || 0));
}
