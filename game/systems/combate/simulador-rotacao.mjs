// O SIMULADOR DE ROTAÇÃO (dono, 02/10): roda o MOTOR DE VERDADE — `Cacadas.tique` com o intervalo global, a recarga, a conjuração, a mana, os
// suportes e as condições dos slots — contra bonecos de treino, e mede o que saiu. Nenhuma fórmula própria: o dano, o crítico, a mana e o
// alcance são os do `Acoes.disparar`. Determinístico quando quem chama fixa a semente (`Math.random` é trocado por mulberry32 só durante a corrida).
//
//   vestirBuild(estado, { grupos: [{ skill, supports: [] }], arma })  — encaixa as gemas (cada grupo num slot, ligado) como o jogador faria
//   medirRotacao(estado, personagem, { duracaoMs, alvos, ... })       — corre o tempo e devolve as métricas
//
// O que NÃO mede (limitações): o dano que o personagem recebe (os bonecos não atacam: o cenário de sobrevivência é outro), cura em grupo
// (um personagem só) e gemas de suporte que dependem de equipamento além dos sockets. O boneco tem HP enorme e resistência zero (a escolha
// do boneco pode ser trocada por `resist`), então não morre e o alvo "morre" só quando se pede `hpDoAlvo` menor.
import * as Cacadas from '../cacadas.mjs';
import * as Acoes from '../acoes.mjs';
import * as Ficha from '../ficha.mjs';
import * as Gemas from '../skills/gemas.mjs';
import { criarMonstro } from '../hunt/monstros.mjs';
import { definirNivel, nivelDoRegistro, limparRegistro, ultimosGolpes } from './registro.mjs';
import { ITEM_CATALOG } from '../dados.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome)?.id);
const itemDoSupport = (id) => [...Gemas.DEFS.values()].find((d) => d.tipo === 'support' && d.id === id)?.itemId;
const PECA_BASE = {};
for (const slot of Object.keys(Gemas.CONFIG.sockets.maximo)) {
  PECA_BASE[slot] = Object.values(ITEM_CATALOG).find((i) => i.slot === slot && !i.stackable && !i.vocations?.length && !(i.minLevel > 1) && !i.twoHanded)?.id;
}

/** O gerador com semente (mulberry32) — a mesma do simulador do monstro. */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Encaixa o build: cada grupo `{ skill, supports }` vai num slot de socket com lugar (a arma primeiro), as gemas LIGADAS entre si; as
 * ações de ataque entram nos slots de ataque na ordem dos grupos (a prioridade da rotação). `nivel`: o nível das gemas (padrão 1, como no
 * jogo). `arma`: o nome de uma arma para o slot da arma (wand/rod/espada…); sem ela, a que o personagem já tem.
 * Devolve `{ ok, erro? }`. Os grupos que não cabem (mais gemas que sockets) dão erro, nunca somem calados.
 */
export function vestirBuild(estado, { grupos, arma = null, nivel = 1, raridade = 'comum' } = {}) {
  if (arma) {
    const id = idDe(arma);
    if (!id) return { ok: false, erro: `Arma desconhecida: ${arma}` };
    estado.equipment.weapon = { id, count: 1 };
  }
  for (const slot of Object.keys(Gemas.CONFIG.sockets.maximo)) {
    if (slot === 'weapon' && estado.equipment.weapon) estado.equipment.weapon = { id: estado.equipment.weapon.id, count: 1, ...(estado.equipment.weapon.raridade ? { raridade: estado.equipment.weapon.raridade } : {}) };
    else if (estado.equipment[slot]) estado.equipment[slot] = { id: estado.equipment[slot].id, count: 1 };
  }
  const livres = {};
  const ordem = ['weapon', 'body', 'shield', 'head', 'legs', 'feet', 'ring', 'neck'];
  for (const slot of ordem) {
    if (slot === 'shield' && ITEM_CATALOG[estado.equipment.weapon?.id]?.twoHanded) continue;
    const peca = (estado.equipment[slot] ??= PECA_BASE[slot] ? { id: PECA_BASE[slot], count: 1 } : null);
    if (!peca) continue;
    const max = Gemas.maximoDeSockets(ITEM_CATALOG[peca.id]);
    if (max) livres[slot] = { max, gemas: [], links: [] };
  }
  const nova = (itemId) => ({ ...Gemas.novaGema(itemId, raridade), nivel });
  for (const g of grupos) {
    const itens = [Gemas.ITEM_DA_ACAO.get(g.skill), ...(g.supports ?? []).map(itemDoSupport)];
    if (itens.some((x) => !x)) return { ok: false, erro: `Gema desconhecida em ${g.skill} + ${(g.supports ?? []).join(', ')}` };
    const slot = ordem.find((s) => livres[s] && livres[s].max - livres[s].gemas.length >= itens.length);
    if (!slot) return { ok: false, erro: `Sem sockets para ${g.skill} com ${itens.length - 1} suporte(s).` };
    const L = livres[slot];
    itens.forEach((it, i) => {
      if (L.gemas.length) L.links.push(i > 0); // o primeiro de um grupo NÃO liga ao grupo de antes
      L.gemas.push(nova(it));
    });
  }
  for (const [slot, L] of Object.entries(livres)) {
    if (!L.gemas.length) continue;
    const peca = estado.equipment[slot];
    const gemas = Array.from({ length: L.max }, (_, i) => L.gemas[i] ?? null);
    const links = Array.from({ length: L.max - 1 }, (_, i) => !!L.links[i]);
    estado.equipment[slot] = { ...peca, soquetes: { abertos: L.max, links, gemas } };
  }
  // Os slots de ataque na ordem dos grupos (a prioridade); curas, buffs e suportes de sustento nos slots do papel certo.
  estado.actions = Array(Acoes.SLOTS).fill(null);
  const porPapel = {};
  for (const g of grupos) {
    const entry = Acoes.catalogo(estado).spells.concat(Acoes.catalogo(estado).runes).find((a) => a.id === g.skill);
    const papel = entry?.papeis?.[0] ?? 'attack';
    const slots = Acoes.PAPEL_DO_SLOT.map((p, i) => (p === papel ? i : -1)).filter((i) => i >= 0);
    const i = (porPapel[papel] = (porPapel[papel] ?? -1) + 1);
    if (i >= slots.length) return { ok: false, erro: `Sem slot de ${papel} para ${g.skill}.` };
    const r = Acoes.definir(estado, { slot: slots[i], value: { id: g.skill } });
    if (!r.ok) return { ok: false, erro: `${g.skill}: ${r.erro}` };
  }
  Ficha.invalidar(estado);
  return { ok: true };
}

/**
 * Corre a rotação. Opções: `duracaoMs` (60.000), `tiqueMs` (250, o do servidor), `alvos` (1), `mob` (`{ key: 'troll', resist: {}, hp }`),
 * `semente`, `huntId`. O personagem fica com mana e vida cheias a cada tique (a mana GASTA é medida pela diferença) — assim a rotação
 * nunca para por falta de mana; `manaPorSegundo` contra `regeneracaoDeMana` diz se ela se sustenta sozinha (`sustentavel`).
 */
export function medirRotacao(estado, personagem, { duracaoMs = 60000, tiqueMs = 250, alvos = 1, mob = {}, semente = 1, huntId = 'troll-cave' } = {}) {
  const random = Math.random;
  Math.random = mulberry32(semente);
  try {
    const r = Cacadas.entrar(estado, { huntId, mode: 'auto' });
    if (!r.ok) return { ok: false, erro: r.erro ?? 'Não entrou na caçada.' };
    const h = estado.hunt;
    delete h.instancia;
    h.respawns = [];
    h.outrosAndares = {};
    const bonecos = [];
    for (let i = 0; i < alvos; i++) {
      const m = criarMonstro({ key: mob.key ?? 'troll', x: h.pos.x + 1 + (i % 3), y: h.pos.y + Math.floor(i / 3) - 1 }, null);
      m.hp = m.maxHp = mob.hp ?? 1e12;
      m.forca = 0; // o boneco não ataca: a sobrevivência é outro cenário
      m.resist = { ...(mob.resist ?? {}) };
      delete m.spawn;
      bonecos.push(m);
    }
    h.monstros.splice(0, h.monstros.length, ...bonecos);
    h.alvo = bonecos[0].uid;
    const ficha = Ficha.combate(estado);
    const inicio = 1e6;
    h.ultimoTique = inicio;
    const CHEIO = 1e9;
    let t = inicio;
    const m = { dano: 0, acertos: 0, criticos: 0, execucoes: 0, manaGasta: 0, tiquesSemAtacar: 0, tiques: 0, porOrigem: {}, porHabilidade: {}, golpesDeGemaPorExecucao: 0 };
    const maxManaReal = estado.maxMana;
    const nivelAntes = nivelDoRegistro();
    definirNivel(1);
    limparRegistro();
    const passos = Math.ceil(duracaoMs / tiqueMs);
    for (let i = 0; i < passos; i++) {
      estado.maxMana = estado.mana = CHEIO;
      estado.maxHp = estado.hp = CHEIO;
      t += tiqueMs;
      const ev = Cacadas.tique(estado, personagem, t);
      m.manaGasta += CHEIO - estado.mana;
      m.tiques++;
      for (const x of ev) if (x.t === 'say') m.execucoes++;
      // O dano vem do REGISTRO de golpes do motor (origem: gema, wand, golpe-basico, dot): a conta é a do jogo, só lida aqui.
      const golpes = ultimosGolpes(1e6).filter((g) => g.origem !== 'mob');
      limparRegistro();
      if (!golpes.length) m.tiquesSemAtacar++;
      for (const g of golpes) {
        const v = g.danoFinal ?? 0;
        m.dano += v;
        if (g.origem !== 'gema-dot' && g.origem !== 'dot') {
          m.acertos++;
          if (g.critico) m.criticos++;
        }
        m.porOrigem[g.origem] = (m.porOrigem[g.origem] ?? 0) + v;
        if (g.habilidade) m.porHabilidade[g.habilidade] = (m.porHabilidade[g.habilidade] ?? 0) + v;
      }
    }
    definirNivel(nivelAntes);
    const seg = (passos * tiqueMs) / 1000;
    // A regeneração de mana do personagem: 1 s de `regenerar` a partir de zero (a mesma conta do tique).
    estado.maxMana = maxManaReal;
    estado.mana = 0;
    Cacadas.regenerar(estado, 1000);
    const regeneracaoDeMana = estado.mana;
    const manaPorSegundo = m.manaGasta / seg;
    return {
      ok: true,
      duracaoSegundos: seg,
      alvos,
      dano: Math.round(m.dano),
      dps: Math.round(m.dano / seg),
      // O DPS só das gemas e dos efeitos delas (explosões, dano contínuo; sem o golpe básico/wand que bate entre uma magia e outra): é o que compara habilidades entre si.
      dpsDasGemas: Math.round((m.dano - ['wand', 'wand-2o-golpe', 'golpe-basico', 'golpe-basico-2o-golpe'].reduce((a, o) => a + (m.porOrigem[o] ?? 0), 0)) / seg),
      acertos: m.acertos,
      criticos: m.criticos,
      taxaDeCritico: m.acertos ? Math.round((m.criticos / m.acertos) * 1000) / 1000 : 0,
      danoMedioPorAcerto: m.acertos ? Math.round(m.dano / m.acertos) : 0,
      execucoes: m.execucoes,
      segundosEntreExecucoes: m.execucoes ? Math.round((seg / m.execucoes) * 100) / 100 : null,
      tempoSemGolpe: Math.round((m.tiquesSemAtacar / m.tiques) * 1000) / 1000,
      danoPorOrigem: Object.fromEntries(Object.entries(m.porOrigem).map(([k, v]) => [k, Math.round(v)])),
      danoPorHabilidade: Object.fromEntries(Object.entries(m.porHabilidade).map(([k, v]) => [k, Math.round(v)])),
      manaGasta: Math.round(m.manaGasta),
      manaPorSegundo: Math.round(manaPorSegundo * 10) / 10,
      regeneracaoDeMana: Math.round(regeneracaoDeMana * 10) / 10,
      sustentavel: manaPorSegundo <= regeneracaoDeMana,
      danoPorMana: m.manaGasta ? Math.round((m.dano / m.manaGasta) * 100) / 100 : null,
      critChance: ficha.critChance,
    };
  } finally {
    Math.random = random;
  }
}
