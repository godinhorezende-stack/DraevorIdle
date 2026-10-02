// O boss único em AÇÃO: nascer (sem duplicar), lutar (comportamentos e fases) e morrer (recompensa uma vez).
//
// Tudo que é do boss mora no próprio monstro (`m.boss`, JSON puro): grava e carrega junto da caçada, então reconectar,
// salvar e a volta de quem estava offline não reiniciam fase, escudo nem recargas. O custo por tique é só o dos
// bosses vivos perto do jogador (nada de laço próprio): `combate.golpesDosMonstros` chama `tique` no lugar onde já
// chamava as magias dos bichos.
//
//   m.boss = { id, categoria, fase, proximo:{}, escudo, vulnerabilidade, telegrafos:[], vidaBase, forcaBase,
//              melee, semPoderesDoBase, encontro, pago }
import { criarMonstro } from '../hunt/monstros.mjs';
import { aplicarEscala } from '../campanha.mjs';
import { salaDe } from '../hunt/sala.mjs';
import { gradeDaHunt, huntOuMapaCustom } from '../hunt/terreno.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';
import { casaLivrePerto } from '../hunt/caminho.mjs';
import * as Poderes from '../poderes.mjs';
import * as Areas from '../../engine/areas.mjs';
import * as Estado from '../encontros/estado.mjs';
import * as Entrega from '../encontros/entrega.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { bossUnico } from './catalogo.mjs';

const MAX_TELEGRAFOS = 4;
const REPETE_AVISO_MS = 500;

/** Todos os bichos da sala, em todos os andares. */
const bichosDaSala = (hunt) => {
  const sala = salaDe(hunt);
  return sala ? [...sala.monstros, ...Object.values(sala.outrosAndares ?? {}).flat()] : [];
};

/** A lista de bichos do andar `z` da sala (a do andar atual é `sala.monstros`). */
const listaDoAndar = (hunt, z) => {
  const sala = salaDe(hunt);
  if (z == null || z === sala.z) return sala.monstros;
  return (sala.outrosAndares ??= {})[z] ?? (sala.outrosAndares[z] = []);
};

/** Uma casa livre perto de `p` no andar `z` (a do ponto, se estiver livre). `null` = sem lugar. */
function casaLivre(hunt, p, z) {
  const sala = salaDe(hunt);
  const grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(sala.huntId)), z ?? sala.z);
  const lista = listaDoAndar(hunt, z);
  return casaLivrePerto(grade, p, (c) => lista.some((m) => m.hp > 0 && m.x === c.x && m.y === c.y) || (sala.pos.x === c.x && sala.pos.y === c.y));
}

// ---------------------------------------------------------------- nascer

/** Há um boss vivo deste encontro na sala? */
export const vivoDoEncontro = (hunt, encontro) => bichosDaSala(hunt).some((m) => m.boss && m.encontro === encontro && m.hp > 0);

/** A vida do boss SEM o escudo (é ela que manda nas fases). */
export const vidaReal = (m) => (m.boss?.escudo ? Math.min(m.hp, m.boss.escudo.base) : m.hp);

/** O monstro do boss único (`def`), ainda fora da caçada. `null` se a criatura-base não existe. */
export function criarBossUnico(def, ponto, { escala = null, instanciaId = null, encontro = null, opcional = false } = {}) {
  const m = criarMonstro({ key: def.base, x: ponto.x, y: ponto.y, z: ponto.z }, null);
  if (!m) return null;
  delete m.spawn; // sem respawn: ele nasce quando o encontro diz
  const a = def.atributos;
  m.name = def.nome;
  m.maxHp = Math.max(1, Math.round(a.vida ?? m.maxHp * (a.vidaMult ?? 1)));
  m.hp = m.maxHp;
  // A escala da fase (vida/dano/exp da campanha) vale para o chefe também, como para todo bicho dela.
  if (def.usaEscalaDaFase && escala) aplicarEscala(m, escala);
  if (a.danoMult && a.danoMult !== 1) m.forca = (m.forca ?? 1) * a.danoMult;
  if (a.armadura != null) m.armor = a.armadura;
  if (a.expMult && a.expMult !== 1) m.exp = Math.round(m.exp * a.expMult);
  if (a.resistencias && Object.keys(a.resistencias).length) m.resist = { ...a.resistencias };
  if (def.recompensas.loot.length) m.loot = def.recompensas.loot.map((d) => ({ id: d.id, name: ITEM_CATALOG[d.id]?.name, chance: d.chance / 100 }));
  m.chefe = true;
  m.raridade = 'boss';
  m.objetivo = 1;
  if (instanciaId) m.instancia = instanciaId;
  if (opcional) m.opcional = true; // conta para a limpeza só quando o encontro é obrigatório
  if (encontro) m.encontro = encontro;
  m.boss = {
    id: def.id,
    categoria: def.categoria,
    fase: -1,
    proximo: {},
    escudo: null,
    vulnerabilidade: null,
    telegrafos: [],
    vidaBase: m.maxHp,
    forcaBase: m.forca ?? 1,
    melee: def.melee,
    semPoderesDoBase: !def.usaPoderesDoBase,
    encontro: encontro ?? null,
    pago: false,
  };
  return m;
}

/**
 * Faz o boss aparecer na caçada — UMA vez. Recusa (`ja-existe`) se já há um vivo do mesmo encontro, ou (fora de
 * encontro) do mesmo boss: comando repetido, reconexão e dois jogadores não geram cópias.
 * `ponto`: onde (casa livre mais perto); sem ele, ao lado do jogador.
 */
export function aparecer(hunt, def, ponto = null, opcoes = {}) {
  const vivos = bichosDaSala(hunt).filter((m) => m.hp > 0 && m.boss);
  const repetido = opcoes.encontro ? vivos.some((m) => m.encontro === opcoes.encontro && m.instancia === (opcoes.instanciaId ?? m.instancia)) : vivos.some((m) => m.boss.id === def.id);
  if (repetido) return { ok: false, motivo: 'ja-existe' };
  const sala = salaDe(hunt);
  let alvo = ponto ?? { x: sala.pos.x + 3, y: sala.pos.y, z: sala.z };
  let z = alvo.z ?? sala.z;
  let casa = casaLivre(hunt, alvo, z);
  // O ponto do cadastro não tem casa livre perto (parede, ocupado): o boss nasce perto do jogador — nunca deixa de aparecer.
  if (!casa && ponto) {
    alvo = { x: sala.pos.x + 3, y: sala.pos.y, z: sala.z };
    z = sala.z;
    casa = casaLivre(hunt, alvo, z);
  }
  if (!casa) return { ok: false, motivo: 'sem-lugar' };
  const m = criarBossUnico(def, { x: casa.x, y: casa.y, z }, { escala: sala.escala ?? null, ...opcoes });
  if (!m) return { ok: false, motivo: 'base-invalida' };
  listaDoAndar(hunt, z).push(m);
  return { ok: true, monstro: m };
}

// ---------------------------------------------------------------- escudo e vulnerabilidade

function ativarEscudo(m, { pctVida, duracaoMs, vulnerabilidade = null }, agora, eventos) {
  const b = m.boss;
  if (b.escudo) return false; // um escudo por vez
  const S = Math.max(1, Math.round((b.vidaBase * pctVida) / 100));
  // O escudo é VIDA EXTRA por cima da vida: o dano que o combate já aplica o consome sozinho, sem gancho em cada golpe.
  b.escudo = { base: m.hp, S, ate: agora + duracaoMs, vulnerabilidade };
  m.hp += S;
  m.maxHp += S;
  eventos.push({ t: 'say', uid: m.uid, text: 'Escudo!', x: m.x, y: m.y, color: '#4fc3ff' });
  return true;
}

function manterEscudo(m, agora, eventos) {
  const e = m.boss.escudo;
  if (!e) return;
  const quebrou = m.hp <= e.base;
  if (!quebrou && agora < e.ate) return;
  m.maxHp -= e.S;
  m.hp = Math.min(m.hp, m.maxHp, e.base);
  m.boss.escudo = null;
  if (quebrou && e.vulnerabilidade) {
    m.boss.vulnerabilidade = { ate: agora + e.vulnerabilidade.ms, pct: e.vulnerabilidade.pct };
    eventos.push({ t: 'say', uid: m.uid, text: 'Vulnerável!', x: m.x, y: m.y, color: '#ff9a3c' });
  }
}

// ---------------------------------------------------------------- invocação

function invocar(ctx, c) {
  const { hunt, bicho, eventos } = ctx;
  const vivos = bichosDaSala(hunt).filter((x) => x.hp > 0 && x.lacaioDe === bicho.uid).length;
  let livres = Math.max(0, c.maxVivos - vivos);
  if (!livres) return 0;
  const escala = salaDe(hunt).escala ?? null;
  let nasceram = 0;
  for (const { key, qtd } of c.criaturas) {
    for (let i = 0; i < qtd && livres > 0; i++) {
      const casa = casaLivre(hunt, bicho, hunt.z);
      if (!casa) return nasceram;
      const m = criarMonstro({ key, x: casa.x, y: casa.y }, null);
      if (!m) continue;
      delete m.spawn;
      if (escala) aplicarEscala(m, escala);
      m.lacaioDe = bicho.uid; // não é objetivo da fase e some com o chefe
      listaDoAndar(hunt, hunt.z).push(m);
      livres--;
      nasceram++;
    }
  }
  if (nasceram) eventos.push({ t: 'say', uid: bicho.uid, text: c.fala ?? 'Venham!', x: bicho.x, y: bicho.y, color: '#f36500' });
  return nasceram;
}

// ---------------------------------------------------------------- magias

const ataqueDe = (c, extra = {}) => ({
  tipo: 'magia', elemento: c.elemento, min: Number(c.min), max: Number(c.max), forma: c.forma ?? 'alvo',
  raio: c.raio ?? 0, comprimento: c.comprimento ?? 0, espalha: c.espalha ?? 0, alcance: c.alcance ?? 7, noAlvo: !!c.noAlvo,
  efeito: c.efeito ?? null, tiro: c.tiro ?? null, golpe: c.nome ?? null, ...extra,
});

function telegrafar(ctx, c) {
  const { hunt, bicho, eventos, agora } = ctx;
  const b = bicho.boss;
  if (b.telegrafos.length >= MAX_TELEGRAFOS) return;
  const centro = { x: hunt.pos.x, y: hunt.pos.y };
  const casas = Areas.circulo(centro, Number(c.raio));
  const a = ataqueDe(c, { forma: 'area', noAlvo: true });
  b.telegrafos.push({ resolveEm: agora + Number(c.avisoMs), casas, a, ultimoAviso: agora, efeitoDoAviso: c.efeitoDoAviso ?? null });
  const efeito = c.efeitoDoAviso ?? c.efeito ?? 7;
  eventos.push({ t: 'area', id: efeito, x: bicho.x, y: bicho.y, casas: Areas.paraTela(casas, bicho) });
}

function resolverTelegrafos(ctx) {
  const { hunt, bicho, eventos, agora } = ctx;
  const b = bicho.boss;
  if (!b.telegrafos.length) return;
  b.telegrafos = b.telegrafos.filter((t) => {
    // Venceu há muito (o jogador estava longe e o boss parado): descarta — não acerta quem volta depois, em área velha.
    if (agora - t.resolveEm > 1500) return false;
    if (agora < t.resolveEm) {
      // O aviso fica na tela até a hora (o efeito dura menos de um segundo).
      if (agora - t.ultimoAviso >= REPETE_AVISO_MS) {
        t.ultimoAviso = agora;
        eventos.push({ t: 'area', id: t.efeitoDoAviso ?? t.a.efeito ?? 7, x: bicho.x, y: bicho.y, casas: Areas.paraTela(t.casas, bicho) });
      }
      return true;
    }
    if ((ctx.estado.hp ?? 0) <= 0) return false;
    const dentro = t.casas.some((c) => c.x === hunt.pos.x && c.y === hunt.pos.y);
    // Quem saiu da área a tempo não leva nada (o golpe cai no vazio, e a tela mostra isso).
    if (dentro) Poderes.dispararMagia(ctx, t.a, { casas: t.casas });
    else eventos.push({ t: 'area', id: t.a.efeito ?? 7, x: bicho.x, y: bicho.y, casas: Areas.paraTela(t.casas, bicho) });
    return false;
  });
}

// ---------------------------------------------------------------- fases e comportamentos

/** Os comportamentos que valem AGORA: os base do boss + os da fase atual. */
function comportamentosAtuais(def, b) {
  const lista = def.comportamentos.map((c, i) => [`b${i}`, c]);
  const f = def.fases[b.fase];
  if (f) f.comportamentos.forEach((c, i) => lista.push([`f${b.fase}.${i}`, c]));
  return lista;
}

function entrarNaFase(ctx, def, indice) {
  const { bicho, eventos, agora } = ctx;
  const b = bicho.boss;
  const f = def.fases[indice];
  b.fase = indice;
  // Cada fase começa com as recargas zeradas: a luta muda de ritmo de verdade.
  for (const k of Object.keys(b.proximo)) if (k.startsWith('f')) delete b.proximo[k];
  if (f.mods.danoMult != null) bicho.forca = b.forcaBase * Number(f.mods.danoMult);
  if (f.mods.velocidadeDeAtaque != null) bicho.velocidadeDeAtaque = Number(f.mods.velocidadeDeAtaque);
  if (f.aoEntrar.fala) eventos.push({ t: 'say', uid: bicho.uid, text: f.aoEntrar.fala, x: bicho.x, y: bicho.y, color: '#ff4040' });
  if (f.aoEntrar.escudo) ativarEscudo(bicho, f.aoEntrar.escudo, agora, eventos);
  if (f.aoEntrar.invocar) invocar(ctx, { maxVivos: 4, ...f.aoEntrar.invocar });
}

function executar(ctx, c) {
  const { hunt, bicho, agora, eventos } = ctx;
  switch (c.tipo) {
    case 'magia': {
      const a = ataqueDe(c);
      if (Poderes.alcanca(a, bicho, hunt.pos)) Poderes.dispararMagia(ctx, a);
      break;
    }
    case 'area-telegrafada':
      if (Poderes.distanciaAte(bicho, hunt.pos) <= (c.alcance ?? 7)) telegrafar(ctx, c);
      break;
    case 'invocar':
      invocar(ctx, c);
      break;
    case 'escudo':
      ativarEscudo(bicho, c, agora, eventos);
      break;
    default:
  }
}

/** A cada tique em que o boss está perto: escudo, troca de fase, avisos vencidos e os comportamentos no ritmo. */
export function tique(ctx) {
  const { bicho, agora } = ctx;
  const b = bicho.boss;
  const def = b && bossUnico(b.id);
  if (!def) return;
  manterEscudo(bicho, agora, ctx.eventos);
  if (b.vulnerabilidade && agora >= b.vulnerabilidade.ate) b.vulnerabilidade = null;
  // As fases, da vida cheia para a vazia (uma pancada grande pode cruzar mais de uma).
  const pct = (100 * vidaReal(bicho)) / b.vidaBase;
  while (def.fases[b.fase + 1] && pct <= def.fases[b.fase + 1].ate) entrarNaFase(ctx, def, b.fase + 1);
  resolverTelegrafos(ctx);
  for (const [chave, c] of comportamentosAtuais(def, b)) {
    // A primeira vez só marca o relógio (num ponto sorteado do intervalo): nada solta tudo junto ao entrar.
    if (b.proximo[chave] == null) {
      b.proximo[chave] = agora + Math.random() * c.intervaloMs;
      continue;
    }
    if (agora < b.proximo[chave]) continue;
    b.proximo[chave] = agora + c.intervaloMs;
    if (Math.random() * 100 >= c.chance) continue;
    if ((ctx.estado.hp ?? 0) <= 0) break;
    executar(ctx, c);
  }
}

// ---------------------------------------------------------------- morrer

/**
 * O boss caiu: leva os lacaios junto, conclui o encontro dele e devolve as recompensas de PRIMEIRA vitória de quem
 * estava na luta — uma vez por personagem (e nunca duas pelo mesmo boss: `pago`). Quem aplica (ouro, exp, itens) é
 * o combate. `quem`: os estados dos que levam a recompensa (quem matou + a partilha).
 */
export function aoMorrer(hunt, boss, { quem = [], agora = 0 } = {}) {
  const b = boss.boss;
  if (!b || b.pago) return [];
  b.pago = true;
  b.telegrafos = [];
  for (const lista of [salaDe(hunt).monstros, ...Object.values(salaDe(hunt).outrosAndares ?? {})]) {
    for (let i = lista.length - 1; i >= 0; i--) if (lista[i].lacaioDe === boss.uid) lista.splice(i, 1);
  }
  const inst = salaDe(hunt).instancia;
  if (b.encontro && inst) Estado.concluir(inst, b.encontro, { agora });
  const def = bossUnico(b.id);
  const premio = def?.recompensas.primeiraVitoria;
  const entregas = [];
  for (const estado of new Set(quem)) {
    const { primeira } = Entrega.registrarConclusao(estado, 'boss', b.id);
    // A mesma morte nunca paga duas vezes ao mesmo personagem (`reivindicar`), nem as vitórias seguintes.
    if (!primeira || !premio || !Entrega.reivindicar(estado, inst?.id ?? hunt.huntId, `boss:${b.id}`).ok) continue;
    entregas.push({ estado, gold: Number(premio.gold ?? 0), exp: Number(premio.exp ?? 0), itens: (premio.itens ?? []).map((i) => ({ id: i.id, count: i.count })), nome: def.nome });
  }
  return entregas;
}
