// O MOTOR DE DANO DAS GEMAS (pedido do dono, 30/09): quantas gemas existem e
// quanto cada uma bate, medido pelo DISPARO DE VERDADE (`Acoes.disparar`, o
// mesmo do combate — gema, nível, qualidade, raridade, supports, afinidade da
// classe, especialização, `fatorDeDano`), contra um BONECO SEM RESISTÊNCIA.
//
// Usado pelo comando `node game/admin/dano-das-gemas.mjs` e pelos testes
// (`motor-de-dano.test.mjs`). Nada aqui grava nada: o personagem é de teste.
import * as Acoes from '../systems/acoes.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as Treino from '../systems/treino.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const VOCACOES = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'];

/** O catálogo de ações (magias e runas) por id — o que a gema é. */
let catalogo = null;
function entrada(acao) {
  catalogo ??= new Map(Object.values(Acoes.catalogo(personagemDeTeste({ vocacao: 'sorcerer', level: 999 }))).filter(Array.isArray).flat().map((x) => [x.id, x]));
  return catalogo.get(acao) ?? null;
}

/** O que a gema ATIVA faz: `ataque` (causa dano), `cura`, ou `suporte` (buff, escudo, velocidade, familiar...). */
export function funcaoDaGema(def) {
  const x = entrada(def.acao);
  if (!x) return 'suporte';
  if (x.heals) return 'cura';
  return x.damage ? 'ataque' : 'suporte';
}

/** Quantas gemas existem: total, ativas (por função) e supports. */
export function contarGemas() {
  const defs = [...Gemas.DEFS.values()];
  const ativas = defs.filter((d) => d.tipo === 'ativa');
  const porFuncao = { ataque: 0, cura: 0, suporte: 0 };
  for (const d of ativas) porFuncao[funcaoDaGema(d)]++;
  const porTipo = { magia: ativas.filter((d) => d.acao.startsWith('spell-')).length, runa: ativas.filter((d) => d.acao.startsWith('rune-')).length };
  return { total: defs.length, ativas: ativas.length, supports: defs.length - ativas.length, porFuncao, porTipo };
}

// Sorteio com semente: a mesma medida dá o mesmo número (comparar antes/depois de uma mudança).
function comSemente(semente, fn) {
  const original = Math.random;
  let s = semente % 2147483647 || 1;
  Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/**
 * Mede uma gema ativa de ATAQUE. Opções:
 *  - `nivel` da gema (1), `raridade` ('comum'), `qualidade` (0);
 *  - `classe` (a recomendada da gema; runa sem classe: sorcerer), `level` do personagem (o que o nível da gema pede);
 *  - `magicLevel` / `skill` (por cima do que o personagem de teste tem; o mínimo da runa é garantido);
 *  - `usos` (60), `semente` (1).
 * Devolve `{ media, minimo, maximo, alvos, usos }`: o dano POR ALVO por uso (média dos alvos atingidos)
 * contra o boneco sem resistência — um em cada casa a até 2 sqm, para a área pegar os que couber.
 */
export function medirGema(acao, opcoes = {}) {
  const def = Gemas.DEFS.get(Gemas.ITEM_DA_ACAO.get(acao));
  if (!def) throw new Error(`não há gema para "${acao}"`);
  const x = entrada(acao);
  const { nivel = 1, raridade = 'comum', qualidade = 0, usos = 60, semente = 1 } = opcoes;
  const classe = opcoes.classe ?? def.classeRecomendada?.find((c) => VOCACOES.includes(c)) ?? 'sorcerer';
  // O level que o NÍVEL da gema pede (as skills não têm level próprio).
  const level = Math.max(1, opcoes.level ?? Gemas.levelNecessario(def, nivel));
  return comSemente(semente, () => {
    const e = personagemDeTeste({ vocacao: classe, level });
    Treino.garantir(e); // magic level e skills (a runa pede magic level)
    if (e.magic) e.magic.value = Math.max(opcoes.magicLevel ?? e.magic.value ?? 0, x?.magicLevel ?? 0);
    if (opcoes.skill != null) for (const k of Object.keys(e.skills ?? {})) if (k !== 'fishing') e.skills[k].value = opcoes.skill;
    Afixos.sincronizarMaximos(e);
    e.maxHp = e.hp = 1e12;
    e.maxMana = e.mana = 1e12;
    // A gema encaixada na arma (sozinha: sem support).
    const arma = (e.equipment.weapon ??= { id: 3074, count: 1 });
    const max = Math.max(1, Gemas.maximoDeSockets({ slot: 'weapon' }));
    arma.soquetes = { abertos: max, links: Array(max - 1).fill(false), gemas: [{ ...Gemas.novaGema(def.itemId, raridade, qualidade), nivel }, ...Array(max - 1).fill(null)] };
    Ficha.invalidar(e);
    if (!Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok) throw new Error('não entrou na caçada de teste');
    const h = e.hunt;
    delete h.instancia;
    h.respawns = [];
    h.outrosAndares = {};
    h.monstros = [];
    // O boneco: um bicho sem entrada no bestiário = nenhuma resistência (ver `hunt/resistencia.mjs`).
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (!dx && !dy) continue;
        const b = criarMonstro({ key: 'troll', x: h.pos.x + dx, y: h.pos.y + dy }, null);
        Object.assign(b, { key: 'boneco-sem-resistencia', name: 'Boneco de Teste', hp: 1e15, maxHp: 1e15, forca: 0 });
        if (dx === 1 && dy === 0) h.monstros.unshift(b);
        else h.monstros.push(b);
      }
    }
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    const r = Acoes.definir(e, { slot, value: { id: acao } });
    if (!r.ok) return { erro: r.erro };
    const porUso = [];
    let alvos = 0;
    let erro = null;
    for (let i = 0; i < usos; i++) {
      // Cada uso como se fosse o primeiro: sem recarga, sem o intervalo do combo, sem conjuração pendente.
      h.cooldowns = {};
      delete h.ultimoAtaqueEm;
      delete h.conjurando;
      e.mana = e.maxMana;
      const antes = h.monstros.map((b) => b.hp);
      let d = Acoes.disparar(e, h, PERSONAGEM, slot, h.monstros[0]);
      // Conjuração de verdade: termina na hora (o boneco não morre nem sai do alcance).
      if (d?.conjurando && h.conjurando) {
        h.conjurando.fim = 0;
        d = Acoes.concluirConjuracao(e, h, PERSONAGEM);
      }
      if (d?.ok === false) {
        erro = d.motivo ?? d.erro;
        continue;
      }
      const perdas = h.monstros.map((b, k) => antes[k] - b.hp).filter((v) => v > 0);
      if (!perdas.length) continue;
      porUso.push(perdas.reduce((a, b) => a + b, 0) / perdas.length);
      alvos += perdas.length;
    }
    if (!porUso.length) return { erro: erro ?? 'sem dano' };
    return {
      media: Math.round(porUso.reduce((a, b) => a + b, 0) / porUso.length),
      minimo: Math.round(Math.min(...porUso)),
      maximo: Math.round(Math.max(...porUso)),
      alvos: Math.round((alvos / porUso.length) * 10) / 10,
      usos: porUso.length,
    };
  });
}

/**
 * Mede uma gema de CURA: a vida que ela devolve por uso (o personagem com a vida
 * lá embaixo a cada uso). Mesmas opções de `medirGema`.
 */
export function medirCura(acao, opcoes = {}) {
  const def = Gemas.DEFS.get(Gemas.ITEM_DA_ACAO.get(acao));
  if (!def) throw new Error(`não há gema para "${acao}"`);
  const { nivel = 1, raridade = 'comum', qualidade = 0, usos = 60, semente = 1 } = opcoes;
  const classe = opcoes.classe ?? def.classeRecomendada?.find((c) => VOCACOES.includes(c)) ?? 'druid';
  const level = Math.max(1, opcoes.level ?? Gemas.levelNecessario(def, nivel));
  return comSemente(semente, () => {
    const e = personagemDeTeste({ vocacao: classe, level });
    Treino.garantir(e);
    if (opcoes.magicLevel != null) e.magic.value = opcoes.magicLevel;
    Afixos.sincronizarMaximos(e);
    const arma = (e.equipment.weapon ??= { id: 3074, count: 1 });
    const max = Math.max(1, Gemas.maximoDeSockets({ slot: 'weapon' }));
    arma.soquetes = { abertos: max, links: Array(max - 1).fill(false), gemas: [{ ...Gemas.novaGema(def.itemId, raridade, qualidade), nivel }, ...Array(max - 1).fill(null)] };
    Ficha.invalidar(e);
    if (!Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok) throw new Error('não entrou na caçada de teste');
    const h = e.hunt;
    delete h.instancia;
    h.respawns = [];
    h.monstros = [];
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('hp');
    const r = Acoes.definir(e, { slot, value: { id: acao } });
    if (!r.ok) return { erro: r.erro };
    e.maxHp = 1e12;
    e.maxMana = e.mana = 1e12;
    const porUso = [];
    let erro = null;
    for (let i = 0; i < usos; i++) {
      h.cooldowns = {};
      delete h.ultimoAtaqueEm;
      delete h.conjurando;
      e.hp = 1;
      e.mana = e.maxMana;
      let d = Acoes.disparar(e, h, PERSONAGEM, slot, null);
      if (d?.conjurando && h.conjurando) {
        h.conjurando.fim = 0;
        d = Acoes.concluirConjuracao(e, h, PERSONAGEM);
      }
      if (d?.ok === false) {
        erro = d.motivo ?? d.erro;
        continue;
      }
      if (e.hp > 1) porUso.push(e.hp - 1);
    }
    if (!porUso.length) return { erro: erro ?? 'sem cura' };
    return { media: Math.round(porUso.reduce((a, b) => a + b, 0) / porUso.length), minimo: Math.min(...porUso), maximo: Math.max(...porUso), usos: porUso.length };
  });
}

/** Todas as gemas de CURA medidas com as mesmas `opcoes`. */
export function medirTodasAsCuras(opcoes = {}) {
  return [...Gemas.DEFS.values()]
    .filter((d) => d.tipo === 'ativa' && funcaoDaGema(d) === 'cura')
    .map((d) => ({ ...fichaDaGema(d), efetividadeDeCura: d.efetividadeDeCura, ...medirCura(d.acao, opcoes) }));
}

/** A ficha de uma gema ativa para a tabela (sem medir). */
export function fichaDaGema(def) {
  const x = entrada(def.acao) ?? {};
  return {
    acao: def.acao,
    itemId: def.itemId,
    nome: def.nome,
    tipo: def.acao.startsWith('rune-') ? 'runa' : 'magia',
    funcao: funcaoDaGema(def),
    elemento: x.element ?? 'physical',
    tags: def.tags,
    classe: def.classeRecomendada ?? [],
    levelMinimo: def.levelMinimo,
    magicLevel: x.magicLevel ?? 0,
    mana: x.mana ?? 0,
    recargaMs: x.cooldown ?? 0,
    conjuracaoMs: def.castTime ?? 0,
    alcance: x.area ? 'área' : x.cadeia ? 'cadeia' : 'alvo único',
    fatorDeDano: def.fatorDeDano ?? 1,
  };
}

/** Todas as gemas de ATAQUE medidas com as mesmas `opcoes` (nível da gema, level, classe...). */
export function medirTodas(opcoes = {}) {
  return [...Gemas.DEFS.values()]
    .filter((d) => d.tipo === 'ativa' && funcaoDaGema(d) === 'ataque')
    .map((d) => ({ ...fichaDaGema(d), ...medirGema(d.acao, opcoes) }));
}
