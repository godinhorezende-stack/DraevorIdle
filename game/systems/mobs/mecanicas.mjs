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
//   aoAtacar      → debuff (dano ao longo do tempo no jogador)   — no golpe do mob
//
// O dano no jogador vai pelo MESMO caminho das magias dos bosses
// (`Poderes.danoDeElementoNoJogador`: proteção, Energy Shield, magic shield,
// árvore, charms). Os buffs vão para `buffs.mjs`, que as contas de força,
// intervalo e resistência já leem. Nenhum nome de mob ou modificador aqui.
import * as Raridade from './raridade.mjs';
import * as Buffs from './buffs.mjs';
import * as Poderes from '../poderes.mjs';
import * as Ficha from '../ficha.mjs';
import { criarMonstro, BESTIARY } from '../hunt/monstros.mjs';
import { gradeDaHunt, huntOuMapaCustom } from '../hunt/terreno.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';
import { daSala } from '../hunt/instancia.mjs';

const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const relogio = (hunt) => hunt?.clock ?? 0;
const temEscudo = (hunt) => Object.values(hunt?.buffs ?? {}).some((b) => b.tipo === 'shield' && b.ate > relogio(hunt));

/** Um dano de mecânica no jogador (o valor antes da proteção). */
function ferirJogador(estado, hunt, personagem, m, valor, elemento, eventos, golpe) {
  return Poderes.danoDeElementoNoJogador(estado, hunt, personagem, m, valor, elemento, eventos, golpe, Ficha.combate(estado), temEscudo(hunt));
}

/** As casas livres em volta de (x, y), andáveis e sem bicho vivo. */
function casasLivres(hunt, x, y, quantas) {
  let grade = null;
  try {
    grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(hunt.huntId)), hunt.z);
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
      eventos.push({ t: 'fx', id: 6, x: m.x, y: m.y });
      if (distancia(hunt.pos, m) <= (mec.raio ?? 1)) {
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

/** O mob `m` levou `dano` do `tipo`: buffs que empilham e o reflexo. */
export function aoReceberDano(estado, hunt, personagem, m, dano, tipo, eventos) {
  if (!m?.mods?.length || !(dano > 0)) return;
  const agora = relogio(hunt);
  for (const mec of Raridade.mecanicasDe(m)) {
    if (mec.gatilho !== 'aoReceberDano') continue;
    if (mec.efeito === 'buff') {
      Buffs.por(m, { chave: `${mec.modificador}:dano`, ate: agora + (mec.duracaoMs ?? 5000), acumulaAte: mec.acumulaAte, danoPct: mec.danoPct ?? 0, resist: mec.resist }, agora);
    } else if (mec.efeito === 'refletir' && (mec.tipos ?? []).includes(tipo) && estado.hp > 0) {
      ferirJogador(estado, hunt, personagem, m, (dano * (mec.pct ?? 10)) / 100, tipo, eventos, 'Reflexo');
    }
  }
}

/** O golpe do mob `m` acertou o jogador: o debuff (dano ao longo do tempo). */
export function aoAtacar(estado, hunt, personagem, m, danoDoGolpe, eventos) {
  if (!m?.mods?.length || !(danoDoGolpe > 0)) return;
  const agora = relogio(hunt);
  for (const mec of Raridade.mecanicasDe(m)) {
    if (mec.gatilho !== 'aoAtacar' || mec.efeito !== 'debuff') continue;
    if (Math.random() * 100 >= (mec.chance ?? 100)) continue;
    const pulsos = Math.max(1, Math.round((mec.duracaoMs ?? 4000) / 1000));
    const total = (danoDoGolpe * (mec.danoPctDoGolpe ?? 30)) / 100;
    (hunt.danoNoTempo ??= []).push({ uid: m.uid, de: m.name, key: m.key, elemento: mec.elemento ?? 'earth', porPulso: total / pulsos, restantes: pulsos, proximo: agora + 1000 });
  }
}

/** Um tique da caçada: enrage, aura e os pulsos do dano ao longo do tempo no jogador. */
export function tique(estado, hunt, personagem, eventos) {
  const agora = relogio(hunt);
  for (const m of hunt.monstros) {
    if (m.hp <= 0 || !m.mods?.length) continue;
    for (const mec of Raridade.mecanicasDe(m)) {
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
  // O dano ao longo do tempo (o debuff do golpe), um pulso por segundo.
  const lista = hunt.danoNoTempo ?? [];
  for (const d of lista) {
    while (d.restantes > 0 && agora >= d.proximo && estado.hp > 0) {
      ferirJogador(estado, hunt, personagem, { uid: d.uid, name: d.de, key: d.key }, d.porPulso, d.elemento, eventos, 'Veneno');
      d.restantes -= 1;
      d.proximo += 1000;
    }
  }
  if (lista.length) hunt.danoNoTempo = lista.filter((d) => d.restantes > 0);
}

