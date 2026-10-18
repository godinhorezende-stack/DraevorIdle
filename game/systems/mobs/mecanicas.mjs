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
import * as Ficha from '../ficha.mjs';
import { criarMonstro, BESTIARY } from '../hunt/monstros.mjs';
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

// A geometria das áreas é a compartilhada (`engine/areas.mjs`): a distância em casas e o quadrado do raio.
const distancia = Areas.distancia;
const relogio = (hunt) => hunt?.clock ?? 0;
const temEscudo = (hunt) => Object.values(hunt?.buffs ?? {}).some((b) => b.tipo === 'shield' && b.ate > relogio(hunt));

/** Um dano de mecânica no jogador (o valor antes da proteção). */
function ferirJogador(estado, hunt, personagem, m, valor, elemento, eventos, golpe) {
  return Poderes.danoDeElementoNoJogador(estado, hunt, personagem, m, valor, elemento, eventos, golpe, Ficha.combate(estado), temEscudo(hunt));
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
        ferirJogador(estado, hunt, personagem, m, (m.maxHp * (mec.danoPctDaVida ?? 5)) / 100, mec.elemento ?? 'fire', eventos, 'Explosão');
      }
    } else if (mec.efeito === 'gerar') gerar(hunt, m, mec, eventos);
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
export function aoReceberDano(estado, hunt, personagem, m, dano, tipo, eventos, { corpoACorpo = false, doTotem = false } = {}) {
  if (!m || !(dano > 0)) return;
  // (lote G20a: `doTotem` — o acerto do totem: os espinhos e o reflexo iriam nele, não em você; o jogo ainda não fere o totem por eles)
  if (corpoACorpo && !doTotem && m.espinhos && ehRaro(m) && estado.hp > 0 && itensPoeLigado()) espinhos(estado, hunt, personagem, m, eventos);
  if (!m.mods?.length) return;
  const agora = relogio(hunt);
  for (const mec of Raridade.mecanicasDe(m)) {
    if (mec.gatilho !== 'aoReceberDano') continue;
    // (PoE: "Ganha N Cargas … por segundo se foi Acertado Recentemente" — o tique lê `acertadoEm`.)
    if (mec.efeito === 'carga') m.acertadoEm = agora;
    else if (mec.efeito === 'buff') {
      Buffs.por(m, { chave: `${mec.modificador}:dano`, ate: agora + (mec.duracaoMs ?? 5000), acumulaAte: mec.acumulaAte, danoPct: mec.danoPct ?? 0, resist: mec.resist }, agora);
    } else if (mec.efeito === 'refletir' && !doTotem && (mec.tipos ?? []).includes(tipo) && estado.hp > 0) {
      const fator = NoJogador.fatorDoReflexo(Ficha.combate(estado), tipo);
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
    ...(e.resist ? { resist: { physical: e.resist, fire: e.resist, ice: e.resist, energy: e.resist } } : {}),
    ...(e.danoPct ? { danoPct: e.danoPct } : {}), ...(e.velocidadeDeAtaquePct ? { velocidadeDeAtaquePct: e.velocidadeDeAtaquePct } : {}), ...(e.critAumentadoPct ? { critAumentadoPct: e.critAumentadoPct } : {}),
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
  if (!efeitos.length && !critico && !hunt.debuffsDoJogador?.empalamentos?.length) return;
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
      if (posto) naTela('sangueCorrompido');
    } else if (mec.efeito === 'drenar') drenar(m, ficha, dano, mec, agora);
    else if (mec.efeito === 'carga' && ganharCarga(m, mec.carga, agora, ficha)) eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: `carga:${mec.carga}` });
  }
  // (+ 12/10: "Inimigos em seus Feixes de Vínculo não podem aplicar Afecções Elementais" — `Vinculos.noFeixe`.)
  if (critico && estado.hp > 0 && !(Number(ficha.afPoe?.critico_recebido_sem_afeccao) > 0) && !Vinculos.noFeixe(hunt, m)) {
    const N = NoJogador.NUMEROS;
    const vidaMax = Math.max(1, estado.maxHp ?? 0);
    if ((brutas.fire ?? 0) > 0) {
      const posto = ModsPoe.dotNoJogador(hunt, { tipo: 'queimadura', total: (brutas.fire * N.incendio.pctDoFogo) / 100, duracaoMs: N.incendio.duracaoMs, origem }, agora, rng);
      if (posto) naTela(posto);
    }
    const msGelo = NoJogador.msDoCongelamento(partes.ice ?? 0, vidaMax);
    if (msGelo > 0 && Controle.congelar(hunt, ficha, msGelo, agora, rng)) naTela('congelado');
    const eletrizou = NoJogador.eletrizar(hunt, ficha, partes.energy ?? 0, vidaMax, { agora, rng });
    if (eletrizou > 0) { naTela('eletrizado', { pct: eletrizou }); mudou = true; }
  }
  if (mudou) Ficha.invalidar(estado);
}
Poderes.definirAoAcertarJogador(aoAcertarJogador);

/** O golpe do mob `m` acertou o jogador: o debuff (dano ao longo do tempo). */
export function aoAtacar(estado, hunt, personagem, m, danoDoGolpe, eventos) {
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
    return m && m.estados?.lento?.ate > agora && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= 3 ? Math.max(0, 1 - lentoMenos / 100) : 1;
  };
  const andando = (tipo) => (afPoe && tipo === 'sangramento' && !(Number(afPoe.sangrar_andando_sem_extra) > 0) && agora - (hunt.poeRecente?.moveu ?? -Infinity) <= Dot.MOVIMENTO.janelaMs ? Dot.MOVIMENTO.fator : 1);
  Dot.tiqueDoJogador(hunt, agora, (origem, valor, elemento, nome, tipo) => {
    if (inafetado(tipo)) return 0;
    const el = doTipo(tipo, elemento);
    const quanto = Math.round(valor * menosDegen * andando(tipo) * doLento(origem));
    if (cura(el)) { if (!ModsPoe.vidaSoPeloDreno(afPoe)) estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + quanto); return 0; }
    return ferirJogador(estado, hunt, personagem, { uid: origem?.uid, name: origem?.mob, key: origem?.key }, quanto, el, eventos, nome);
  }, () => estado.hp > 0);
}

