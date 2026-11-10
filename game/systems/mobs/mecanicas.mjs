// As MECÂNICAS dos modificadores dos mobs (fase 2, pedido do dono, 01/10):
// o modificador não é só texto — ele muda o comportamento do mob. Cada mecânica
// é DADO (`gamedata/mobs/modificadores.json`: `{ gatilho, efeito, ...}`), lida
// pelos ids que o mob guarda (`m.mods`, ver `raridade.mjs`). Gatilhos:
//
//   aoMorrer      → explosao (dano no jogador perto), gerar (novos mobs NA MESMA
//                   instância — entram na limpeza)            — em `matarMonstro`
//   aliadoMorreu  → buff nos mobs com a mecânica, perto de quem morreu
//   vidaBaixa     → enrage (uma vez: mais dano e velocidade de ataque)  — no tique
//   aura          → areaDeDano no jogador perto, de tempo em tempo       — no tique
//   aoReceberDano → buff (empilha), refletir (parte do dano volta)  — no acerto
//   aoAtacar      → debuff (dano ao longo do tempo no jogador), maldicao (PoE: o "Amaldiçoa" — uma das maldições do monstro, sempre a
//                   mesma para cada monstro, em você por 6 s: `condicoes-poe.MALDICOES_DOS_MONSTROS`)   — no golpe do mob
//                 + (PoE, 12/10) cegar, exposicao, sangueCorrompido, drenar, carga — no golpe E na magia do mob que acerta você
//                   (`aoAcertarJogador`, com o que o MAPA põe nos monstros — `m.noAcerto` — e a afecção inerente do Golpe Crítico)
//   aoReceberDano → + (PoE) carga: "Ganha N Cargas de Tolerância por segundo se foi Acertado Recentemente" (o tique dá as cargas)
//
// O dano no jogador vai pelo MESMO caminho das magias dos bosses
// (`Poderes.danoDeElementoNoJogador`: proteção, Energy Shield, magic shield,
// árvore, charms). Os buffs vão para `buffs.mjs`, que as contas de força,
// intervalo e resistência já leem. Nenhum nome de mob ou modificador aqui.
import * as Raridade from './raridade.mjs';
import * as Areas from '../../engine/areas.mjs';
import * as Buffs from './buffs.mjs';
import * as Poderes from '../poderes.mjs';
import * as R from '../regras.mjs';
import * as Ficha from '../ficha.mjs';
import { criarMonstro, BESTIARY } from '../hunt/monstros.mjs';
import { definirRacaDoBicho } from '../itens-poe/condicoes-poe.mjs';
// (07/11, lote 20 das inertes) a raça do monstro pela chave do bestiário (o Animal da Rainha da Floresta — `condicoes-poe.ehAnimal`)
definirRacaDoBicho((key) => BESTIARY[key]?.race ?? null);
import { gradeDaHunt, huntOuMapaCustom } from '../hunt/terreno.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';
import { daSala } from '../hunt/instancia.mjs';
import * as Dot from '../combate/dot.mjs';
import * as ModsPoe from '../itens-poe/mods-poe.mjs';
import * as Protecao from '../protecao.mjs';
import * as Controle from '../combate/controle.mjs';
import * as NoJogador from '../itens-poe/monstros-no-jogador.mjs';
import * as Vinculos from '../itens-poe/vinculos.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';
// (100% — combate, 02/11: o Solo Congelado dos monstros — `itens-poe/combate-100.mjs`)
import * as Combate100 from '../itens-poe/combate-100.mjs';

// A geometria das áreas é a compartilhada (`engine/areas.mjs`): a distância em casas e o quadrado do raio.
const distancia = Areas.distancia;
const relogio = (hunt) => hunt?.clock ?? 0;
const temEscudo = (hunt) => Object.values(hunt?.buffs ?? {}).some((b) => b.tipo === 'shield' && b.ate > relogio(hunt));

/** Um dano de mecânica no jogador (o valor antes da proteção). */
// (02/11: `opcoes.acerto` — o dano que é acerto passa pela Salvaguarda, `Poderes.danoDeElementoNoJogador`)
function ferirJogador(estado, hunt, personagem, m, valor, elemento, eventos, golpe, opcoes = {}) {
  return Poderes.danoDeElementoNoJogador(estado, hunt, personagem, m, valor, elemento, eventos, golpe, Ficha.combate(estado), temEscudo(hunt), opcoes);
}

/** As casas livres em volta de (x, y), andáveis e sem bicho vivo (nunca numa Safe Zone — `protecao.mjs`). */
function casasLivres(hunt, x, y, quantas) {
  let grade = null;
  try {
    grade = Protecao.gradeDosBichos(andarDaGrade(gradeDaHunt(huntOuMapaCustom(hunt.huntId)), hunt.z));
  } catch {
    grade = null;
  }
  const ocupada = new Set(hunt.monstros.filter((b) => b.hp > 0).map((b) => `${b.x},${b.y}`));
  ocupada.add(`${hunt.pos.x},${hunt.pos.y}`);
  const casas = [];
  for (let r = 0; r <= 2 && casas.length < quantas; r++) {
    for (let dy = -r; dy <= r && casas.length < quantas; dy++) {
      for (let dx = -r; dx <= r && casas.length < quantas; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const k = `${x + dx},${y + dy}`;
        if (ocupada.has(k) || (grade && !grade.andavel.has(k))) continue;
        ocupada.add(k);
        casas.push({ x: x + dx, y: y + dy });
      }
    }
  }
  return casas;
}

/**
 * (07/11, lote 17 das inertes — o PoB, PenanceMarkPhantasm) os 2 FANTASMAS ACORRENTADOS da Marca da Penitência: o inimigo marcado, acertado, cria dois monstros HOSTIS
 * a você em volta dele (o PoB: o nível do monstro, 1,3 × a vida e 0,9 × o dano da tabela, uma magia de projétil Físico — no jogo, o Arqueiro Espectral do PoE, o
 * monstro de ataque Físico à distância), sem experiência e sem loot, fora da conta da limpeza. A vida: 130% da média dos monstros normais vivos da área (sem eles, a do
 * marcado ÷ 3). Devolve os criados.
 */
export const FANTASMA_ACORRENTADO = Object.freeze({ key: 'poe-spectral-bowman-12', nome: 'Fantasma Acorrentado', quantos: 2, vidaPct: 130, forca: 0.9 });
export function fantasmasDaPenitencia(hunt, alvo, eventos = []) {
  if (!hunt || !alvo || !BESTIARY[FANTASMA_ACORRENTADO.key]) return [];
  const normais = hunt.monstros.filter((b) => b.hp > 0 && !b.dummy && !b.gerado && (b.raridade ?? 'normal') === 'normal');
  const base = normais.length ? normais.reduce((t, b) => t + (b.maxHp ?? 0), 0) / normais.length : (alvo.maxHp ?? 0) / 3;
  const novos = [];
  for (const casa of casasLivres(hunt, alvo.x, alvo.y, FANTASMA_ACORRENTADO.quantos)) {
    const f = criarMonstro({ key: FANTASMA_ACORRENTADO.key, x: casa.x, y: casa.y }, null);
    if (!f) continue;
    f.maxHp = f.hp = Math.max(1, Math.round((base * FANTASMA_ACORRENTADO.vidaPct) / 100));
    f.forca = FANTASMA_ACORRENTADO.forca;
    f.exp = 0;
    f.loot = [];
    f.gerado = true;
    f.name = FANTASMA_ACORRENTADO.nome;
    f.fantasmaAcorrentado = true;
    delete f.spawn;
    hunt.monstros.push(f);
    novos.push(f);
    eventos.push({ t: 'fx', id: 13, uid: f.uid, x: f.x, y: f.y });
  }
  return novos;
}

/**
 * (07/11, lote 20 das inertes — o dono: "Criar as mecânicas") os VERMES que os únicos soltam (o Verme de Sangue do PoE): o Verme Retorcido do Terror Irrequieto ("Um
 * Verme Retorcido inimigo surge a cada N segundos" — a vida de um monstro normal da área) e os Vermes Contorcidos do Jarro Contorcido ("escapam do Frasco quando utilizado
 * … são destruídos quando Acertados" — `frageis`: 1 de vida). Hostis, sem experiência e sem loot, fora da conta da limpeza. Devolve os criados.
 */
export const VERME = Object.freeze({ key: 'poe-blood-worm-40', retorcido: 'Verme Retorcido', contorcido: 'Verme Contorcido' });
export function vermesDoItem(hunt, quantos, { frageis = false, eventos = [] } = {}) {
  if (!hunt?.pos || !(quantos > 0) || !BESTIARY[VERME.key]) return [];
  const normais = hunt.monstros.filter((b) => b.hp > 0 && !b.dummy && !b.gerado && (b.raridade ?? 'normal') === 'normal');
  const vida = frageis ? 1 : Math.max(1, Math.round(normais.length ? normais.reduce((t, b) => t + (b.maxHp ?? 0), 0) / normais.length : BESTIARY[VERME.key].hp ?? 100));
  const novos = [];
  for (const casa of casasLivres(hunt, hunt.pos.x, hunt.pos.y, quantos)) {
    const v = criarMonstro({ key: VERME.key, x: casa.x, y: casa.y }, null);
    if (!v) continue;
    Object.assign(v, { maxHp: vida, hp: vida, exp: 0, loot: [], gerado: true, name: frageis ? VERME.contorcido : VERME.retorcido, ...(frageis ? { vermeContorcido: true } : { vermeRetorcido: true }) });
    delete v.spawn;
    hunt.monstros.push(v);
    novos.push(v);
    eventos.push({ t: 'fx', id: 13, uid: v.uid, x: v.x, y: v.y });
  }
  return novos;
}

/** "Gerar": os mobs novos nascem em volta, NA MESMA instância, e entram na conta da limpeza. */
function gerar(hunt, m, mec, eventos) {
  const key = mec.mesmaCriatura === false && mec.key ? mec.key : m.key;
  if (!BESTIARY[key]) return [];
  const novos = [];
  for (const casa of casasLivres(hunt, m.x, m.y, Math.max(1, mec.quantidade ?? 1))) {
    const filho = criarMonstro({ key, x: casa.x, y: casa.y }, null);
    if (!filho) continue;
    // Um pedaço do pai (vida, força), sem os modificadores dele (não gera em cadeia) e sem loot.
    filho.maxHp = filho.hp = Math.max(1, Math.round(m.maxHp * (mec.vidaPct ?? 50) / 100));
    filho.forca = m.forca ?? 1;
    filho.exp = Math.max(0, Math.round(((m.exp ?? 0) / (m.expMult ?? 1)) * (mec.vidaPct ?? 50) / 100));
    filho.loot = [];
    filho.gerado = true;
    delete filho.spawn;
    if (m.instancia) {
      filho.instancia = m.instancia;
      filho.objetivo = 1;
      const inst = daSala(hunt);
      if (inst?.id === m.instancia) inst.objetivos.total += 1;
    }
    hunt.monstros.push(filho);
    novos.push(filho);
    eventos.push({ t: 'fx', id: 13, uid: filho.uid, x: filho.x, y: filho.y });
  }
  return novos;
}

/** Quando `m` morre: as mecânicas `aoMorrer` dele e as `aliadoMorreu` dos vizinhos. */
export function aoMorrer(estado, hunt, personagem, m, eventos) {
  const agora = relogio(hunt);
  for (const mec of Raridade.mecanicasDe(m)) {
    if (mec.gatilho !== 'aoMorrer') continue;
    if (mec.efeito === 'explosao') {
      // Na tela, o quadrado INTEIRO que ela pega (antes: um efeito só, na casa do mob).
      const raio = mec.raio ?? 1;
      eventos.push({ t: 'area', id: 6, x: m.x, y: m.y, casas: Areas.paraTela(Areas.quadrado(m, raio), m) });
      if (distancia(hunt.pos, m) <= raio) {
        ferirJogador(estado, hunt, personagem, m, (m.maxHp * (mec.danoPctDaVida ?? 5)) / 100, mec.elemento ?? 'fire', eventos, 'Explosão', { acerto: true });
      }
    } else if (mec.efeito === 'gerar') gerar(hunt, m, mec, eventos);
    else if (mec.efeito === 'solo') criarSolo(hunt, m, mec, agora, eventos);
  }
  // (09/11, lote 4 dos modificadores de monstro) a UNIÃO DAS ALMAS: ao morrer, os do MESMO bando (o mesmo spawn — `spawnId`; sem ele, os de perto) ganham
  // "+X% de Vida Máxima" (a vida que falta continua faltando) e "+X% de Tamanho" (o desenho — `iluminacao.tamanhoDoMonstro`)
  if (m.packVidaPct > 0 || m.packEscalaPct > 0) {
    for (const o of hunt.monstros) {
      if (o === m || o.hp <= 0 || o.dummy || (m.spawnId != null ? o.spawnId !== m.spawnId : distancia(o, m) > 6)) continue;
      if (m.packVidaPct > 0) {
        const novo = Math.round((o.maxHp ?? o.hp) * (1 + m.packVidaPct / 100));
        o.hp += novo - (o.maxHp ?? o.hp);
        o.maxHp = novo;
      }
      if (m.packEscalaPct > 0) o.escalaExtraPct = (o.escalaExtraPct ?? 0) + m.packEscalaPct;
      eventos.push({ t: 'fx', id: 14, uid: o.uid, x: o.x, y: o.y });
    }
  }
  for (const o of hunt.monstros) {
    if (o === m || o.hp <= 0) continue;
    for (const mec of Raridade.mecanicasDe(o)) {
      if (mec.gatilho !== 'aliadoMorreu' || distancia(o, m) > (mec.raio ?? 4)) continue;
      Buffs.por(o, { chave: `${mec.modificador}:aliado`, ate: agora + (mec.duracaoMs ?? 5000), danoPct: mec.danoPct ?? 0, velocidadeDeAtaquePct: mec.velocidadeDeAtaquePct ?? 0 }, agora);
      eventos.push({ t: 'fx', id: 14, uid: o.uid, x: o.x, y: o.y });
    }
  }
}

/**
 * (lote 70 — dono, 17/10: "Implementar os 2 solos") O SOLO que o monstro deixa ao morrer ("Solo Ardente ao Morrer", "Solo Eletrizado ao Morrer"
 * — os mods do Raro do PoE): na casa dele, com o raio em metros (1 casa = 2 m, ao menos 1 — o poedb: raio 16 = 1,6 m), pela duração (6 s). O
 * ARDENTE queima quem está nele: 62,5% do golpe máximo do monstro por segundo (o poedb: "3750% do dano máximo por minuto"), de Fogo — não é
 * Incêndio; o ELETRIZADO Eletriza (`monstros-no-jogador.eletrizarPeloSolo`). "Inafetado por Solo Ardente/Eletrizado" (`imune_solo_<tipo>`).
 */
function criarSolo(hunt, m, mec, agora, eventos) {
  const raio = Math.max(1, Math.round((mec.raioMetros ?? 1.6) / 2));
  const golpe = (Poderes.golpeMaximoDoBicho(m) ?? 0) * (m.forca ?? 1);
  (hunt.solosDosMonstros ??= []).push({ tipo: mec.solo, x: m.x, y: m.y, z: hunt.z ?? 0, raio, ate: agora + (mec.duracaoMs ?? 6000), proximo: agora, ...(mec.solo === 'ardente' || mec.solo === 'profanado' ? { dps: (golpe * (mec.dpsPctDoGolpe ?? 62.5)) / 100 } : {}), ...(mec.solo === 'eletrizado' ? { pct: mec.danoRecebidoPct ?? 20 } : {}), ...(mec.solo === 'congelado' ? { pct: mec.resfriamentoPct ?? 10 } : {}), de: m });
  eventos.push({ t: 'area', id: 6, x: m.x, y: m.y, casas: Areas.paraTela(Areas.quadrado(m, raio), m) });
}
/** (lote 70) Os solos dos monstros a cada tique: o que vale em você agora (e os que acabaram saem). */
function tiqueDosSolos(estado, hunt, personagem, eventos, agora, ficha) {
  tiqueDosSolosDoMapa(estado, hunt, personagem, eventos, agora, ficha);
  if (!hunt.solosDosMonstros?.length) return;
  hunt.solosDosMonstros = hunt.solosDosMonstros.filter((s) => s.ate > agora);
  for (const s of hunt.solosDosMonstros) {
    if (s.z !== (hunt.z ?? 0) || !hunt.pos || distancia(hunt.pos, s) > s.raio || estado.hp <= 0) continue;
    if (Number(ficha?.afPoe?.[`imune_solo_${s.tipo}`]) > 0) continue;
    if (s.tipo === 'eletrizado') NoJogador.eletrizarPeloSolo(hunt, ficha, s.pct, agora);
    // (100% — combate, 02/11) o SOLO CONGELADO ("Solo Resfriado ao Morrer"): Resfria você enquanto está nele (`Combate100.resfriarPeloSolo`)
    else if (s.tipo === 'congelado') Combate100.resfriarPeloSolo(hunt, ficha, agora, { pct: s.pct ?? Combate100.SOLO_CONGELADO.pct });
    // (07/11, lote 20 das inertes) o SOLO PROFANADO (o Profanador do jogo): Caos por segundo, como o Ardente (`imune_solo_profanado` — o Passo Natal)
    else if (s.tipo === 'profanado' && s.dps > 0 && agora >= s.proximo) {
      s.proximo = agora + 1000;
      ferirJogador(estado, hunt, personagem, s.de, s.dps, 'chaos', eventos, 'Solo Profanado');
    } else if (s.tipo === 'ardente' && s.dps > 0 && agora >= s.proximo) {
      s.proximo = agora + 1000;
      ferirJogador(estado, hunt, personagem, s.de, s.dps, 'fire', eventos, 'Solo Ardente');
    }
  }
}

/** Os NOMES de quem fere nos solos do mapa (a caixa da morte diz "Solo Ardente"). */
const DO_SOLO_DO_MAPA = { ardente: { name: 'Solo Ardente', key: null }, profanado: { name: 'Solo Profano', key: null } };
/**
 * (08/11) Os TRECHOS DE SOLO do mapa único (`instancia.solosDoMapa` — `itens-poe/mapas-areas.porSolosNaInstancia`): o mesmo efeito dos solos dos
 * monstros em quem está neles (o Ardente e o Profano, por segundo, sem passar pela Salvaguarda; o Congelado Resfria), com o "Inafetado por Solo X".
 * O segundo de cada um é de cada jogador (`hunt.poeSoloDoMapaEm`), e a tela vê os trechos perto de você a cada 2 s.
 */
function tiqueDosSolosDoMapa(estado, hunt, personagem, eventos, agora, ficha) {
  const solos = daSala(hunt)?.solosDoMapa;
  if (!solos?.length || !hunt.pos || estado.hp <= 0) return;
  const z = hunt.z ?? 0;
  if (agora - (hunt.poeSolosDoMapaVistosEm ?? -Infinity) >= 2000) {
    hunt.poeSolosDoMapaVistosEm = agora;
    for (const s of solos) if (s.z === z && distancia(hunt.pos, s) <= s.raio + 8) eventos.push({ t: 'area', id: s.efeito, x: s.x, y: s.y, casas: Areas.paraTela(Areas.quadrado(s, s.raio), s) });
  }
  const em = (hunt.poeSoloDoMapaEm ??= {});
  solos.forEach((s, i) => {
    if (s.z !== z || distancia(hunt.pos, s) > s.raio || estado.hp <= 0) return;
    const tipo = s.tipo === 'profanado' ? 'profanado' : s.tipo;
    if (Number(ficha?.afPoe?.[`imune_solo_${tipo}`]) > 0) return;
    if (s.tipo === 'congelado') return Combate100.resfriarPeloSolo(hunt, ficha, agora, { pct: s.pct ?? Combate100.SOLO_CONGELADO.pct });
    if (!(s.dps > 0) || agora < (em[i] ?? -Infinity)) return;
    em[i] = agora + 1000;
    ferirJogador(estado, hunt, personagem, DO_SOLO_DO_MAPA[s.tipo], s.dps, s.tipo === 'ardente' ? 'fire' : 'chaos', eventos, DO_SOLO_DO_MAPA[s.tipo].name);
  });
}

/** O monstro é Raro no PoE? (o Elite do Draevor conta como Raro — `modificadores-monstro.RARIDADE_DO_POE`) */
const ehRaro = (m) => m?.raridade === 'raro' || m?.raridade === 'elite';

/**
 * (PoE, 12/10) Os ESPINHOS dos monstros raros do mapa ("Monstros raros têm espinhos físicos/elementais que refletem N de dano" — `m.espinhos`,
 * `itens-poe/mapas-areas.aplicarEfeitos`): o acerto corpo a corpo num Raro devolve o dano em você, × o "Evita X% do dano refletido" e com o
 * "Não pode sofrer Dano Refletido" (`monstros-no-jogador.fatorDoReflexo`). O elemental: um terço de Fogo, de Gelo e de Raio (o PoE não diz).
 */
function espinhos(estado, hunt, personagem, m, eventos) {
  const ficha = Ficha.combate(estado);
  const partes = [['physical', Number(m.espinhos.physical) || 0], ...['fire', 'ice', 'energy'].map((el) => [el, (Number(m.espinhos.elemental) || 0) / 3])];
  for (const [tipo, valor] of partes) {
    if (!(valor > 0) || estado.hp <= 0) continue;
    const fator = NoJogador.fatorDoReflexo(ficha, tipo);
    if (fator > 0) ferirJogador(estado, hunt, personagem, m, valor * fator, tipo, eventos, 'Espinhos');
  }
}

/**
 * O mob `m` levou `dano` do `tipo`: buffs que empilham e o reflexo. `corpoACorpo`: o acerto foi um ataque corpo a corpo seu (os espinhos).
 * (PoE: o reflexo também passa pelo "Evita X% do dano refletido" — `monstros-no-jogador.fatorDoReflexo`; fora do PoE, 1.)
 */
// (lote A5, dono 20/10: `ficha` — a ficha do GOLPE da gema, com as linhas do uso e dos suportes: o "não pode ser Refletido" do suporte vale no reflexo)
export function aoReceberDano(estado, hunt, personagem, m, dano, tipo, eventos, { corpoACorpo = false, doTotem = false, ficha = null } = {}) {
  if (!m || !(dano > 0)) return;
  // (lote G20a: `doTotem` — o acerto do totem: os espinhos e o reflexo iriam nele, não em você; o jogo ainda não fere o totem por eles)
  if (corpoACorpo && !doTotem && m.espinhos && ehRaro(m) && estado.hp > 0 && itensPoeLigado()) espinhos(estado, hunt, personagem, m, eventos);
  if (!m.mods?.length) return;
  const agora = relogio(hunt);
  // (09/11, lote 6) "Inflige Sangue Corrompido em quem o Acerta" (o Corrompedor — `sangueAoSerAcertadoPct`: % da média de dano DELE por minuto, por acúmulo, 4 s): o seu
  // acerto nele (não o do totem) põe um acúmulo em você e renova os outros, como o Sangue Corrompido do acerto dele
  if (m.sangueAoSerAcertadoPct > 0 && !doTotem && estado.hp > 0 && itensPoeLigado()) {
    const media = (Poderes.golpeMedioDoBicho(m) ?? R.ataqueDoMonstro(m)) * (m.forca ?? 1);
    const total = ((media * m.sangueAoSerAcertadoPct) / 100 / 60) * 4;
    if (ModsPoe.dotNoJogador(hunt, { tipo: 'sangueCorrompido', total, duracaoMs: 4000, origem: { fonte: 'mob', mob: m.name, uid: m.uid, key: m.key } }, agora)) {
      renovarSangueCorrompido(hunt);
      eventos?.push({ t: 'estado', uid: 'player', quem: personagem?.nome, x: hunt.pos?.x, y: hunt.pos?.y, estado: 'sangueCorrompido', de: m.name });
    }
  }
  for (const mec of Raridade.mecanicasDe(m)) {
    if (mec.gatilho !== 'aoReceberDano') continue;
    // (PoE: "Ganha N Cargas … por segundo se foi Acertado Recentemente" — o tique lê `acertadoEm`.)
    if (mec.efeito === 'carga') m.acertadoEm = agora;
    else if (mec.efeito === 'buff') {
      Buffs.por(m, { chave: `${mec.modificador}:dano`, ate: agora + (mec.duracaoMs ?? 5000), acumulaAte: mec.acumulaAte, danoPct: mec.danoPct ?? 0, resist: mec.resist }, agora);
    } else if (mec.efeito === 'refletir' && !doTotem && (mec.tipos ?? []).includes(tipo) && estado.hp > 0) {
      const fator = NoJogador.fatorDoReflexo(ficha ?? Ficha.combate(estado), tipo);
      if (fator > 0) ferirJogador(estado, hunt, personagem, m, ((dano * (mec.pct ?? 10)) / 100) * fator, tipo, eventos, 'Reflexo');
    }
  }
}

/**
 * (PoE, 12/10) O monstro `m` ganha uma CARGA (`tolerancia`, `frenesi`, `poder`): um buff dele que acumula até 3 e renova a duração de todas
 * (10 s), com o efeito por carga do PoE (`monstros-no-jogador.NUMEROS.cargas`). "Monstros Inimigos não podem ganhar Cargas de Poder, Frenesi
 * ou Tolerância" (a sua árvore — `ficha`) impede. Devolve se ganhou.
 */
export function ganharCarga(m, tipo, agora, ficha = null) {
  const C = NoJogador.NUMEROS.cargas;
  const e = C[tipo];
  if (!e || !m || !(m.hp > 0) || Number(ficha?.afPoe?.inimigos_sem_cargas) > 0) return false;
  Buffs.por(m, {
    chave: `carga:${tipo}`, ate: agora + C.duracaoMs, acumulaAte: C.maximo, carga: tipo,
    ...(e.fisicoPct || e.elementalPct ? { resist: { physical: e.fisicoPct ?? 0, fire: e.elementalPct ?? 0, ice: e.elementalPct ?? 0, energy: e.elementalPct ?? 0 } } : {}),
    ...(e.danoMaisPct ? { danoMaisPct: e.danoMaisPct } : {}), ...(e.velocidadeDeAtaquePct ? { velocidadeDeAtaquePct: e.velocidadeDeAtaquePct } : {}), ...(e.critAumentadoPct ? { critAumentadoPct: e.critAumentadoPct } : {}),
    ...(e.velocidadeDeConjuracaoPct ? { velocidadeDeConjuracaoPct: e.velocidadeDeConjuracaoPct } : {}), ...(e.velocidadePct ? { velocidadePct: e.velocidadePct } : {}),
  }, agora);
  return true;
}
/** As cargas ativas do monstro (`{ tolerancia, frenesi, poder }`). */
export const cargasDe = (m, agora) => Object.fromEntries(['tolerancia', 'frenesi', 'poder'].map((t) => [t, (m?.buffsDeMob ?? []).find((b) => b.chave === `carga:${t}` && b.ate > agora)?.pilhas ?? 0]));

/**
 * (PoE, 12/10) O DRENO DE VIDA do monstro ("X% do Dano é Drenado como Vida"): do dano que o acerto causou em você, a vida volta ao longo do
 * tempo (2% da vida máxima dele por segundo, × a "Recuperação total por segundo do Dreno de Vida aumentada" — o tique). "Inimigos Não Podem
 * Drenar Vida De Você" (a sua árvore) impede.
 */
function drenar(m, ficha, dano, mec, agora) {
  if (!(dano > 0) || !(m.hp > 0) || Number(ficha?.afPoe?.inimigos_nao_drenam_vida) > 0) return false;
  const total = (dano * (mec.pct ?? 0)) / 100;
  if (!(total > 0)) return false;
  (m.drenoPoe ??= []).push({ restante: total, porSeg: ((m.maxHp ?? 0) * NoJogador.NUMEROS.dreno.taxaPct) / 100 * (1 + (mec.velocidadePct ?? 0) / 100), ...(mec.naoParaNaVidaCheia ? { naoPara: true } : {}) });
  m.drenoPoeEm ??= agora;
  // ("Dano enquanto Drenando Vida aumentado em X%" — o Vampírico: um buff dele enquanto o dreno corre; o tique tira quando acaba.)
  if (mec.danoDrenandoPct > 0) Buffs.por(m, { chave: 'drenando', ate: Infinity, danoPct: mec.danoDrenandoPct }, agora);
  return true;
}
function tiqueDoDreno(m, agora) {
  const segundos = Math.max(0, agora - (m.drenoPoeEm ?? agora)) / 1000;
  m.drenoPoeEm = agora;
  for (const d of m.drenoPoe) {
    // (PoE: o dreno para na vida cheia — menos o do "Efeitos do Dreno de Vida não são removidos quando a Vida … estiver Cheia".)
    if (m.hp >= m.maxHp && !d.naoPara) { d.restante = 0; continue; }
    const cura = Math.min(d.restante, d.porSeg * segundos);
    m.hp = Math.min(m.maxHp, m.hp + cura);
    d.restante -= cura;
  }
  m.drenoPoe = m.drenoPoe.filter((d) => d.restante > 0);
  if (!m.drenoPoe.length) {
    delete m.drenoPoe;
    delete m.drenoPoeEm;
    if (m.buffsDeMob) m.buffsDeMob = m.buffsDeMob.filter((b) => b.chave !== 'drenando');
  }
}
/**
 * (PoE) "Inimigos Não Podem Drenar Escudo de Energia De Você" (o Vampírico — a mecânica `aoReceberDano`/`semDrenoDeEs`): o seu dreno de
 * Escudo de Energia não pega neste monstro (`Ficha.aplicarLeech`, `semDrenoDeEs`).
 */
export const semDrenoDeEs = (m) => !!m?.mods?.length && Raridade.mecanicasDe(m).some((x) => x.efeito === 'semDrenoDeEs');

/** Os efeitos do PoE no acerto do monstro (gatilho `aoAtacar`; o `debuff` e a `maldicao` de sempre ficam com `aoAtacar`, só no golpe). */
const DO_ACERTO = new Set(['cegar', 'mutilar', 'empalar', 'exposicao', 'sangueCorrompido', 'drenar', 'carga']);

/** Estende os acúmulos de Sangue Corrompido no jogador até o fim do mais novo, com o dano a mais do tempo a mais (o mesmo por pulso). */
export function renovarSangueCorrompido(hunt) {
  const pulsoMs = Dot.CONFIG.tipos.sangueCorrompido?.pulsoMs ?? 1000;
  const lista = (hunt.efeitosDoJogador?.dots ?? []).filter((d) => d.tipo === 'sangueCorrompido' && d.falta > 0);
  const ate = Math.max(0, ...lista.map((d) => d.ate ?? 0));
  for (const d of lista) {
    if (d.tipo !== 'sangueCorrompido' || !(d.falta > 0) || !(ate > d.ate)) continue;
    d.falta += (d.porPulso ?? 0) * Math.floor((ate - d.ate) / pulsoMs);
    d.ate = ate;
  }
}

/** O que o MAPA pôs nos monstros para o acerto (`m.noAcerto` — `itens-poe/mapas-areas.aplicarEfeitos`), no formato das mecânicas. */
function doMapa(m) {
  const n = m?.noAcerto;
  if (!n) return [];
  const saida = [];
  if (n.cegar > 0) saida.push({ efeito: 'cegar', chance: n.cegar });
  // ("Monstros Mutilam com Ataques", "Ataques dos Monstros têm X% de chance de Empalar ao Acertar": só o golpe — o Ataque.)
  if (n.mutilar > 0) saida.push({ efeito: 'mutilar', chance: n.mutilar, soAtaque: true });
  if (n.empalar > 0) saida.push({ efeito: 'empalar', chance: n.empalar, soAtaque: true });
  for (const carga of ['tolerancia', 'frenesi', 'poder']) if (n[carga] > 0) saida.push({ efeito: 'carga', carga, chance: n[carga] });
  return saida;
}

/**
 * (PoE, 12/10 — dono: "ligar os modificadores" de monstro e de mapa) O ACERTO do monstro `m` em você — o golpe (`ataque`) ou a magia —, o
 * que ele faz além do dano: solta os Empalamentos já em você; Cega, Mutila, Empala, Expõe, põe Sangue Corrompido, drena vida e ganha cargas
 * (os modificadores do monstro — gatilho `aoAtacar`, os efeitos de `DO_ACERTO` — e os do mapa); e a afecção INERENTE do Golpe Crítico (Fogo incendeia, Gelo congela,
 * Raio eletriza — "Golpes Críticos contra você não infligem Afecções Elementais de forma Inerente" a tira). Só no modo PoE.
 * `dano`: o que o acerto causou antes do Escudo de Energia (o dreno); `bruto`: o golpe antes das suas defesas (a "média de dano" do Sangue
 * Corrompido); `partes`/`brutas`: o dano de cada tipo depois/antes das suas resistências (`{ physical, fire, ice, energy }`).
 */
export function aoAcertarJogador(estado, hunt, personagem, m, { dano = 0, bruto = 0, partes = {}, brutas = {}, critico = false, ataque = true, eventos = [], rng = Math.random } = {}) {
  if (!itensPoeLigado() || !m || !hunt || !(estado.hp > 0)) return;
  const agora = relogio(hunt);
  const mecs = m.mods?.length ? Raridade.mecanicasDe(m).filter((x) => x.gatilho === 'aoAtacar' && DO_ACERTO.has(x.efeito)) : [];
  const efeitos = [...mecs, ...doMapa(m)];
  // (lote 2: + o Resfriamento do Gelo, o "Sempre Eletriza" e o "Todo o Dano pode Resfriar" — valem em todo acerto, ver o fim)
  if (!efeitos.length && !critico && !hunt.debuffsDoJogador?.empalamentos?.length && !((brutas.ice ?? 0) > 0) && !m.sempreEletriza && !m.todoDanoResfria && !(m.chanceCongelar > 0) && !m.sempreAtordoa && !m.equilibrioElemental && !(Number(Ficha.combate(estado).afPoe?.todo_dano_resfria_voce) > 0)) return;
  const ficha = Ficha.combate(estado);
  const naTela = (nome, extra = {}) => eventos.push({ t: 'estado', uid: 'player', quem: personagem?.nome, x: hunt.pos?.x, y: hunt.pos?.y, estado: nome, de: m.name, ...extra });
  const origem = { fonte: 'mob', mob: m.name, uid: m.uid, key: m.key };
  let mudou = false;
  // Os EMPALAMENTOS já em você: cada um causa o guardado de novo (Físico, pela sua redução física) e gasta um dos 5 acertos.
  const doEmpalamento = NoJogador.dispararEmpalamentos(hunt, agora);
  if (doEmpalamento > 0) ferirJogador(estado, hunt, personagem, m, doEmpalamento, 'physical', eventos, 'Empalamento');
  for (const mec of efeitos) {
    if (estado.hp <= 0) return;
    if (mec.soAtaque && !ataque) continue;
    if (rng() * 100 >= (mec.chance ?? 100)) continue;
    if (mec.efeito === 'cegar') {
      if (NoJogador.cegar(hunt, ficha, { efeitoPct: mec.efeitoPct ?? 0, agora, rng })) { naTela('cego'); mudou = true; }
    } else if (mec.efeito === 'mutilar') {
      if (NoJogador.mutilar(hunt, ficha, { agora })) { naTela('mutilado'); mudou = true; }
    } else if (mec.efeito === 'empalar') {
      if (NoJogador.empalar(hunt, ficha, partes.physical ?? 0, { agora, rng })) naTela('empalado');
    } else if (mec.efeito === 'exposicao') {
      if (NoJogador.expor(hunt, ficha, mec.elemento, mec.pct ?? NoJogador.NUMEROS.exposicao.pct, { agora })) { naTela('exposto', { elemento: mec.elemento }); mudou = true; }
    } else if (mec.efeito === 'sangueCorrompido') {
      // ("% da média de dano por minuto, por acúmulo": a média é o golpe dele antes das suas defesas; cada acúmulo paga isso na duração.)
      const total = ((bruto * (mec.pctPorMinuto ?? 0)) / 100 / 60) * ((mec.duracaoMs ?? 4000) / 1000);
      let posto = null;
      for (let i = 0; i < Math.max(1, mec.pilhas ?? 1); i++) posto = ModsPoe.dotNoJogador(hunt, { tipo: 'sangueCorrompido', total, duracaoMs: mec.duracaoMs ?? null, origem }, agora, rng) ?? posto;
      // (09/11, lote 1 dos modificadores de monstro) como no PoE, o acerto RENOVA a duração de todos os acúmulos que já estão em você (cada um
      // segue pagando o mesmo por segundo até o fim novo)
      if (posto) renovarSangueCorrompido(hunt);
      if (posto) naTela('sangueCorrompido');
    } else if (mec.efeito === 'drenar') drenar(m, ficha, dano, mec, agora);
    else if (mec.efeito === 'carga' && ganharCarga(m, mec.carga, agora, ficha)) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: `carga:${mec.carga}` });
  }
  // (+ 12/10: "Inimigos em seus Feixes de Vínculo não podem aplicar Afecções Elementais" — `Vinculos.noFeixe`.)
  // (lote 50, a Réplica: Defesa Imprudente: "+X% de chance de ser Congelado, Eletrizado e Incendiado" — `chance_ser_afetado`: o acerto que não
  // é crítico também aplica a afecção do elemento dele, na chance; o crítico segue inerente, sem sortear de novo.)
  const inerente = critico && !(Number(ficha.afPoe?.critico_recebido_sem_afeccao) > 0);
  const chanceExtra = Number(ficha.afPoe?.chance_ser_afetado) || 0;
  if ((inerente || chanceExtra > 0 || Number(ficha.afPoe?.chance_ser_incendiado) > 0) && estado.hp > 0 && !Vinculos.noFeixe(hunt, m)) {
    const N = NoJogador.NUMEROS;
    const vidaMax = Math.max(1, estado.maxHp ?? 0);
    const pega = () => inerente || rng() * 100 < chanceExtra;
    // (06/11, o Abraço de Mokou: "+X% de chance de ser Incendiado" — só o Incêndio — e "Todo o Dano Sofrido de Acertos pode te Incendiar" — o Incêndio do
    // dano todo do acerto, não só o de Fogo)
    const chanceDoFogo = chanceExtra + (Number(ficha.afPoe?.chance_ser_incendiado) || 0);
    const fogoDoIncendio = Number(ficha.afPoe?.todo_dano_incendeia_voce) > 0 ? Object.values(brutas).reduce((t, x) => t + (Number(x) || 0), 0) : brutas.fire ?? 0;
    if (fogoDoIncendio > 0 && (inerente || rng() * 100 < chanceDoFogo)) {
      const posto = ModsPoe.dotNoJogador(hunt, { tipo: 'queimadura', total: (fogoDoIncendio * N.incendio.pctDoFogo) / 100, duracaoMs: N.incendio.duracaoMs, origem }, agora, rng);
      if (posto) naTela(posto);
    }
    // (06/11, o Auxium: "Efeito de Resfriamento e Duração de Congelamento em você são baseados em X% do seu Escudo de Energia" — o limiar do Congelamento é o
    // Escudo de Energia máximo × X%, não a Vida)
    const peloEscudo = Number(ficha.afPoe?.congelamento_pelo_escudo_pct) || 0;
    const msGelo = NoJogador.msDoCongelamento(partes.ice ?? 0, peloEscudo > 0 ? Math.max(1, ((Number(ficha.energyShield) || 0) * peloEscudo) / 100) : vidaMax);
    if (msGelo > 0 && pega() && Controle.congelar(hunt, ficha, msGelo, agora, rng)) naTela('congelado');
    if ((partes.energy ?? 0) > 0 && pega() && !m.sempreEletriza) {
      const eletrizou = NoJogador.eletrizar(hunt, ficha, partes.energy ?? 0, vidaMax, { agora, rng });
      if (eletrizou > 0) { naTela('eletrizado', { pct: eletrizou }); mudou = true; }
    }
  }
  // (09/11, lote 2 dos modificadores de monstro) o RESFRIAMENTO do PoE: todo acerto com Gelo te Resfria (inerente, sem chance nem crítico), pela força do
  // Gelo sobre o limiar; com "Todo o Dano pode Resfriar" do monstro (o Prismático) ou o "Todo o Dano Sofrido de Acertos pode te Resfriar" (o Chamado do Vazio),
  // o dano todo do acerto; × o "Efeito do Resfriamento aumentado" do monstro (o Andarilho Gélido)
  if (estado.hp > 0 && !Vinculos.noFeixe(hunt, m)) {
    const N = NoJogador.NUMEROS;
    const peloEscudo = Number(ficha.afPoe?.congelamento_pelo_escudo_pct) || 0;
    const limiar = peloEscudo > 0 ? Math.max(1, ((Number(ficha.energyShield) || 0) * peloEscudo) / 100) : Math.max(1, estado.maxHp ?? 0);
    const todoResfria = m.todoDanoResfria || Number(ficha.afPoe?.todo_dano_resfria_voce) > 0;
    const frio = todoResfria ? Object.values(brutas).reduce((t, x) => t + (Number(x) || 0), 0) : brutas.ice ?? 0;
    const pctFrio = Math.min(N.resfriamento.maximoPct, Math.round(NoJogador.pctDoResfriamento(frio, limiar) * Math.max(0, 1 + (Number(m.efeitoResfriamentoPct) || 0) / 100) * 10) / 10);
    if (pctFrio > 0 && Controle.resfriar(hunt, ficha, pctFrio, agora, rng, N.resfriamento.duracaoMs)) naTela('enregelado', { pct: pctFrio });
    // "Sempre Eletriza" (o Prismático): todo acerto com Raio te Eletriza — com "Todo o Dano pode Eletrizar", o dano todo
    // (o Eletrocutante: + o "Efeito/Duração da Eletrização em Inimigos aumentado" dele)
    if (m.sempreEletriza) {
      const raio = m.todoDanoEletriza ? Object.values(partes).reduce((t, x) => t + (Number(x) || 0), 0) : partes.energy ?? 0;
      const eletrizou = raio > 0 ? NoJogador.eletrizar(hunt, ficha, raio, Math.max(1, estado.maxHp ?? 0), { agora, rng, efeitoPct: Number(m.efeitoEletrizacaoPct) || 0, duracaoPct: Number(m.duracaoEletrizacaoPct) || 0 }) : 0;
      if (eletrizou > 0) { naTela('eletrizado', { pct: eletrizou }); mudou = true; }
    }
    // "X% de chance de Congelar" (o Congelamento Permanente): o Congelamento pelo Gelo do acerto — com "Todo Dano pode Congelar", o dano todo —, × a
    // "Duração do Congelamento em Inimigos aumentada"
    // (09/11, lote 6) o EQUILÍBRIO ELEMENTAL do monstro: o acerto com dano elemental deixa você com +25% de Resistência aos elementos dele e −50% aos outros, por 5 s
    // (o PoE — a keystone nos inimigos que você acerta; aqui, em você)
    if (m.equilibrioElemental) {
      const els = ['fire', 'ice', 'energy'].filter((el) => (partes[el] ?? 0) > 0);
      if (els.length) { (hunt.debuffsDoJogador ??= {}).equilibrio = { ate: agora + NoJogador.NUMEROS.equilibrio.duracaoMs, els }; mudou = true; }
    }
    // (lote 3) "Sempre Atordoa Inimigos ao Acertar" (o Quebra-ossos), com o "25% de chance de dobrar a Duração de Atordoamentos"
    if (m.sempreAtordoa && Controle.atordoarJogador(hunt, ficha, agora, rng, { dobrarChance: Number(m.dobrarAtordoamentoPct) || 0 })) naTela('atordoado');
    if (m.chanceCongelar > 0 && rng() * 100 < m.chanceCongelar) {
      const gelo = m.todoDanoCongela ? Object.values(partes).reduce((t, x) => t + (Number(x) || 0), 0) : partes.ice ?? 0;
      const ms = Math.round(NoJogador.msDoCongelamento(gelo, limiar) * Math.max(0, 1 + (Number(m.duracaoCongelamentoPct) || 0) / 100));
      if (ms > 0 && Controle.congelar(hunt, ficha, ms, agora, rng)) naTela('congelado');
    }
  }
  if (mudou) Ficha.invalidar(estado);
}
Poderes.definirAoAcertarJogador(aoAcertarJogador);

/** O golpe do mob `m` acertou o jogador: o debuff (dano ao longo do tempo). */
export function aoAtacar(estado, hunt, personagem, m, danoDoGolpe, eventos) {
  // (08/11, o Vórtice do Caos: "Ataques Corpo a Corpo dos Monstros aplicam Feitiços aleatórios ao Acertar" — `m.noAcerto.maldicaoAleatoria`, a chance;
  // cada golpe sorteia uma das maldições que os monstros põem em você — `MALDICOES_DOS_MONSTROS`)
  if (m?.noAcerto?.maldicaoAleatoria > 0 && danoDoGolpe > 0 && itensPoeLigado() && Math.random() * 100 < m.noAcerto.maldicaoAleatoria) {
    const ids = Object.keys(ModsPoe.MALDICOES_DOS_MONSTROS);
    const id = ids[Math.floor(Math.random() * ids.length)];
    const def = ModsPoe.MALDICOES_DOS_MONSTROS[id];
    ModsPoe.amaldicoarJogador(hunt, `${id}:${m.uid}`, { nome: def.nome, af: def.af, ms: ModsPoe.DURACAO_DA_MALDICAO_DO_MONSTRO_MS }, relogio(hunt));
    eventos?.push({ t: 'estado', uid: 'player', quem: personagem?.nome, x: hunt.pos?.x, y: hunt.pos?.y, estado: 'amaldicoado', nome: def.nome, de: m.name });
    Ficha.invalidar(estado);
  }
  if (!m?.mods?.length || !(danoDoGolpe > 0)) return;
  const agora = relogio(hunt);
  for (const mec of Raridade.mecanicasDe(m)) {
    if (mec.gatilho !== 'aoAtacar' || !['debuff', 'maldicao'].includes(mec.efeito)) continue;
    if (Math.random() * 100 >= (mec.chance ?? 100)) continue;
    if (mec.efeito === 'maldicao') {
      // (cada monstro tem a SUA maldição — a primeira sorteada fica: no PoE o monstro amaldiçoa sempre com a mesma)
      const lista = (mec.maldicoes ?? []).filter((k) => ModsPoe.MALDICOES_DOS_MONSTROS[k]);
      if (!lista.length) continue;
      m.maldicaoDoMonstro ??= lista[Math.floor(Math.random() * lista.length)];
      const def = ModsPoe.MALDICOES_DOS_MONSTROS[m.maldicaoDoMonstro];
      // (06/11, a Reflecção de Atziri: "Reflete Feitiços" — a Maldição volta para quem a pôs)
      ModsPoe.refletirMaldicao(hunt, m, def.nome, Ficha.combate(estado), agora);
      ModsPoe.amaldicoarJogador(hunt, `${m.maldicaoDoMonstro}:${m.uid}`, { nome: def.nome, af: def.af, ms: mec.duracaoMs ?? ModsPoe.DURACAO_DA_MALDICAO_DO_MONSTRO_MS }, agora);
      eventos?.push({ t: 'estado', uid: 'player', quem: personagem?.nome, x: hunt.pos?.x, y: hunt.pos?.y, estado: 'amaldicoado', nome: def.nome, de: m.name });
      Ficha.invalidar(estado);
      continue;
    }
    const pulsos = Math.max(1, Math.round((mec.duracaoMs ?? 4000) / 1000));
    const total = (danoDoGolpe * (mec.danoPctDoGolpe ?? 30)) / 100;
    // O dano contínuo no JOGADOR passa pelo motor de efeitos (`combate/dot.mjs`): acumulação por tipo, relógio da caçada, resistência no pulso.
    const tipo = Dot.tipoDoElemento(mec.elemento ?? 'earth');
    if (tipo) ModsPoe.dotNoJogador(hunt, { tipo, total, duracaoMs: pulsos * 1000, origem: { fonte: 'mob', mob: m.name, uid: m.uid, key: m.key } }, agora);
  }
}

/** Um tique da caçada: enrage, aura e os pulsos do dano ao longo do tempo no jogador. */
export function tique(estado, hunt, personagem, eventos) {
  const agora = relogio(hunt);
  const fichaDoJogador = ModsPoe.fichaDa?.(hunt) ?? null;
  tiqueDosSolos(estado, hunt, personagem, eventos, agora, fichaDoJogador);
  for (const m of hunt.monstros) {
    // (PoE, 12/10) A vida que o monstro drenou de você volta ao longo do tempo.
    if (m.drenoPoe && m.hp > 0) tiqueDoDreno(m, agora);
    if (m.hp <= 0 || !m.mods?.length) continue;
    for (const mec of Raridade.mecanicasDe(m)) {
      // (PoE) "Ganha N Cargas de Tolerância por segundo se foi Acertado Recentemente" (4 s desde o seu último acerto nele).
      if (mec.gatilho === 'aoReceberDano' && mec.efeito === 'carga') {
        if (agora - (m.acertadoEm ?? -Infinity) > NoJogador.NUMEROS.cargas.recentementeMs) continue;
        m.proximaCarga ??= {};
        if (agora < (m.proximaCarga[mec.modificador] ?? 0)) continue;
        m.proximaCarga[mec.modificador] = agora + 1000;
        for (let i = 0; i < Math.max(1, mec.porSegundo ?? 1); i++) ganharCarga(m, mec.carga, agora, fichaDoJogador);
        continue;
      }
      if (mec.gatilho === 'vidaBaixa' && mec.efeito === 'enrage' && !m.enfurecido && (100 * m.hp) / m.maxHp <= (mec.limitePct ?? 30)) {
        m.enfurecido = true;
        Buffs.por(m, { chave: `${mec.modificador}:enrage`, ate: Infinity, danoPct: mec.danoPct ?? 0, velocidadeDeAtaquePct: mec.velocidadeDeAtaquePct ?? 0 }, agora);
        eventos.push({ t: 'say', uid: m.uid, quem: m.name, text: 'Enfurecido!', x: m.x, y: m.y, color: '#ff5b4f' });
      } else if (mec.gatilho === 'aura' && mec.efeito === 'areaDeDano' && estado.hp > 0) {
        const chave = `aura:${mec.modificador}`;
        m.proximaAura ??= {};
        if (agora < (m.proximaAura[chave] ?? 0)) continue;
        m.proximaAura[chave] = agora + (mec.intervaloMs ?? 1000);
        if (distancia(hunt.pos, m) <= (mec.raio ?? 1)) ferirJogador(estado, hunt, personagem, m, (m.maxHp * (mec.danoPctDaVida ?? 0.5)) / 100, mec.elemento ?? 'fire', eventos, 'Aura');
      }
    }
  }
  // O dano ao longo do tempo no JOGADOR (o debuff do golpe: veneno, queimadura, sangramento...), um pulso por segundo, pelo motor `combate/dot.mjs`.
  // ("X% menos Dano Sofrido de Dano Degenerativo" — a árvore do PoE.)
  const afPoe = ModsPoe.fichaDa?.(hunt)?.afPoe;
  // ("Sofre X% menos Dano Degenerativo se você começou a sofrer Dano Degenerativo no último segundo" — a Sombra Fluvial: o primeiro segundo
  // de dano contínuo em você, contado de quando ele começou sem nenhum antes.)
  const comDot = (hunt.efeitosDoJogador?.dots ?? []).some((d) => d.falta > 0);
  if (comDot && !hunt.degenAtivo) hunt.degenDesde = agora;
  hunt.degenAtivo = comDot;
  const noInicio = comDot && agora - (hunt.degenDesde ?? -Infinity) <= 1000 ? Number(afPoe?.degen_menos_no_inicio) || 0 : 0;
  // (+ o Chefe Tribal: "Dano Degenerativo é -X% enquanto você estiver Parado" — `dano_degen_recebido_pct@parado`, negativo.)
  const menosDegen = Math.max(0, 1 - (Number(afPoe?.dano_degen_recebido_menos) || 0) / 100) * Math.max(0, 1 - noInicio / 100) * Math.max(0, 1 + (Number(afPoe?.dano_degen_recebido_pct) || 0) / 100);
  // (PoE, "Inafetado por Sangramento" — "enquanto Drenando", o Carrasco: o sangramento corre em você, mas não fere.)
  const inafetado = (tipo) => tipo === 'sangramento' && Number(afPoe?.inafetado_sangramento) > 0;
  // (PoE: "Você sofre Dano de Caos ao invés de Dano Físico do Sangramento"; "Sofrer Dano de Caos Degenerativo te cura ao invés enquanto
  // Drenando Vida" — o pulso de Caos vira cura enquanto um dreno de vida corre.)
  const doTipo = (tipo, elemento) => (tipo === 'sangramento' && Number(afPoe?.sangramento_em_caos) > 0 ? 'chaos' : elemento);
  const cura = (elemento) => elemento === 'chaos' && Number(afPoe?.caos_degen_cura_drenando) > 0 && (hunt.roubos ?? []).some((x) => x.recurso === 'vida' && x.restante > 0);
  // (PoE, 11/10 — dono: "como no PoE") O Sangramento EM VOCÊ triplica enquanto você anda (o lembrete: "O Dano é 200% maior enquanto em
  // movimento" — você andou no último segundo, `poeRecente.moveu`); "Mover enquanto Sangrando faz com que você não sofra Dano extra" o tira.
  // (o Ocultista: "Inimigos Próximos Desacelerados causam X% de Dano Degenerativo reduzido" — o dano contínuo do bicho lento, a até 3 casas.)
  const lentoMenos = Number(afPoe?.proximos_lentos_degen_menos) || 0;
  const doLento = (origem) => {
    if (!(lentoMenos > 0) || origem?.uid == null || !hunt.pos) return 1;
    const m = (hunt.monstros ?? []).find((x) => x.uid === origem.uid);
    // (lote C4, dono 21/10: + o Tolhido — o "Desacelerado" do PoE é o Hinder, `estados.tolhido`; o `lento` segue valendo como antes)
    return m && (m.estados?.lento?.ate > agora || m.estados?.tolhido?.ate > agora) && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= 3 ? Math.max(0, 1 - lentoMenos / 100) : 1;
  };
  const andando = (tipo) => (afPoe && tipo === 'sangramento' && !(Number(afPoe.sangrar_andando_sem_extra) > 0) && agora - (hunt.poeRecente?.moveu ?? -Infinity) <= Dot.MOVIMENTO.janelaMs ? Dot.MOVIMENTO.fator : 1);
  // (lote 72, a Terapia de Exposição) "+X% de Resistência a Caos contra Dano Degenerativo": no dano contínuo de Caos, a resistência a Caos + X,
  // até o máximo dela (a do golpe: `protection.chaos`, já no máximo).
  const resCaosDegen = Number(afPoe?.chaos_res_contra_degen) || 0;
  const doCaosDegen = (el) => {
    if (el !== 'chaos' || !(resCaosDegen > 0)) return 1;
    const f = Ficha.combate(estado);
    const res = Math.min(100, f.protection?.chaos ?? 0);
    if (res >= 100) return 1;
    const comX = Math.min(Ficha.maximoDaResistencia(f.afPoe, 'chaos'), res + resCaosDegen);
    return Math.max(0, 1 - comX / 100) / (1 - res / 100);
  };
  Dot.tiqueDoJogador(hunt, agora, (origem, valor, elemento, nome, tipo) => {
    if (inafetado(tipo)) return 0;
    const el = doTipo(tipo, elemento);
    const quanto = Math.round(valor * menosDegen * andando(tipo) * doLento(origem) * doCaosDegen(el));
    if (cura(el)) { if (!ModsPoe.vidaSoPeloDreno(afPoe)) estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + quanto); return 0; }
    return ferirJogador(estado, hunt, personagem, { uid: origem?.uid, name: origem?.mob, key: origem?.key }, quanto, el, eventos, nome);
  }, () => estado.hp > 0);
}

