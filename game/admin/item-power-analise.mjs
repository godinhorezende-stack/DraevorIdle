// AS ANÁLISES do Item Power Base que olham para FORA do item: onde cada equipamento cai (hunts e chefes), os alertas de distribuição, as regras de distribuição planejadas e os
// presentes de marco (níveis 50 e 100). SÓ LEITURA: nada aqui muda chance de drop, item, hunt ou monstro — as probabilidades só mudam por decisão do dono, nos editores próprios.
// O level de uma hunt é o da CAMPANHA na dificuldade pedida (quando ela está na campanha) ou o level do cadastro; a chance é a do bestiário × o fator de drop da dificuldade
// (`Progressao.fatorDeDropDe`, neutro de fábrica). "Categoria do monstro" = a raridade do spawn no mapa (normal, modificado, raro, elite, único, boss).
import { readFileSync } from 'node:fs';
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';
import * as IP from '../systems/item-power.mjs';
import * as P from '../systems/progressao.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import { spawnsDaHunt } from '../systems/hunt/terreno.mjs';
import { desenhoDoItem } from './biblioteca.mjs';

const CATEGORIAS_DE_HUNT = ['hunts', 'vips', 'especiais', 'divinas'];
const arred = (n, c = 3) => (Number.isFinite(n) ? Number(n.toFixed(c)) : null);
const SETS_DE_MARCO = JSON.parse(readFileSync(new URL('../gamedata/sets-de-marco.json', import.meta.url), 'utf8')).vocacoes;

let cacheDeHunts = null;
export const limparCache = () => { cacheDeHunts = null; };

/** Todas as hunts com os monstros que vivem nelas e a categoria (raridade do spawn) de cada um. */
export function huntsComMonstros() {
  if (cacheDeHunts) return cacheDeHunts;
  const saida = [];
  for (const cat of CATEGORIAS_DE_HUNT) {
    for (const h of CATALOGO[cat] ?? []) {
      const monstros = new Map();
      const spawns = spawnsDaHunt(h.id) ?? [];
      for (const s of spawns) {
        const raridade = Raridade.doSpawn(s).raridade;
        for (const c of s.criaturas ?? (s.key ? [{ key: s.key }] : [])) {
          const m = monstros.get(c.key) ?? { key: c.key, categorias: new Set() };
          m.categorias.add(raridade); monstros.set(c.key, m);
        }
      }
      if (!monstros.size) for (const c of h.creatures ?? []) monstros.set(c.key, { key: c.key, categorias: new Set(['normal']) });
      const f = Campanha.faseDe(h.id);
      saida.push({ id: h.id, nome: h.name ?? h.id, categoria: cat, levelCadastro: h.level ?? null, fase: f ? { ato: f.ato, nivel: f.nivel } : null, monstros: [...monstros.values()].map((m) => ({ key: m.key, categorias: [...m.categorias] })) });
    }
  }
  return (cacheDeHunts = saida);
}
const levelDaHunt = (h, dif) => h.fase?.nivel?.[dif] ?? h.levelCadastro;

/** Os equipamentos que um monstro dropa (do bestiário): `[{ id, chance }]`. */
export function equipamentosDoMonstro(key) {
  return (CATALOGO.bestiary[key]?.loot ?? []).filter((l) => { const m = ITEM_CATALOG[l.id]; return m && IP.SLOTS.includes(m.slot) && !m.stackable; }).map((l) => ({ id: l.id, chance: l.chance }));
}

/**
 * A análise de UMA hunt: cada equipamento que cai nela (com a chance, os monstros e as categorias), o IP contra o esperado NO LEVEL DA HUNT e a situação. `dif`: facil/medio/dificil.
 */
export function analisarHunt(huntId, dif = 'facil', cfg = IP.EM_USO) {
  const h = huntsComMonstros().find((x) => x.id === huntId);
  if (!h) return null;
  const lv = levelDaHunt(h, dif);
  const itens = new Map();
  for (const m of h.monstros) {
    for (const e of equipamentosDoMonstro(m.key)) {
      const f = IP.fichaDePoder(e.id, cfg);
      if (!f) continue;
      const it = itens.get(e.id) ?? { id: e.id, nome: f.nome, slot: f.slot, raridade: f.raridade, minLevel: f.minLevel, ip: f.ip, chance: 0, monstros: [], categoriasDoMonstro: new Set() };
      it.chance = Math.max(it.chance, arred(e.chance * P.fatorDeDropDe(dif, e.id), 6));
      it.monstros.push(m.key); m.categorias.forEach((c) => it.categoriasDoMonstro.add(c));
      itens.set(e.id, it);
    }
  }
  const lista = [...itens.values()].map((it) => {
    const exp = lv != null ? IP.esperado(cfg, it.slot, lv) : null;
    const diffPct = exp ? arred((it.ip - exp) / exp, 4) : null;
    const situacao = it.ip === 0 ? 'sem-poder' : diffPct == null ? 'sem-referencia' : IP.classeDaDiferenca(diffPct, cfg);
    return { ...it, categoriasDoMonstro: [...it.categoriasDoMonstro], esperadoNaHunt: exp, diferencaPct: diffPct, situacao, levelAcima: it.minLevel != null && lv != null ? it.minLevel - lv : null, desenho: desenhoDoItem(ITEM_CATALOG[it.id]) };
  }).sort((a, b) => (b.diferencaPct ?? -9) - (a.diferencaPct ?? -9));
  return { id: h.id, nome: h.nome, categoria: h.categoria, dificuldade: dif, level: lv, ato: h.fase?.ato ?? null, monstros: h.monstros.length, itens: lista };
}

/** ONDE um item pode cair: hunts, dificuldades (o level muda na campanha), chance e monstros. */
export function ondeCai(itemId, dif = 'facil') {
  const saida = [];
  for (const h of huntsComMonstros()) {
    const mons = h.monstros.filter((m) => equipamentosDoMonstro(m.key).some((e) => e.id === Number(itemId)));
    if (!mons.length) continue;
    const chance = Math.max(...mons.flatMap((m) => equipamentosDoMonstro(m.key).filter((e) => e.id === Number(itemId)).map((e) => e.chance))) * P.fatorDeDropDe(dif, itemId);
    saida.push({ hunt: h.id, nome: h.nome, level: levelDaHunt(h, dif), ato: h.fase?.ato ?? null, chance: arred(chance, 6), monstros: mons.map((m) => m.key), categoriasDoMonstro: [...new Set(mons.flatMap((m) => m.categorias))] });
  }
  return saida;
}

/**
 * Os ALERTAS de distribuição na dificuldade `dif`: item muito acima/abaixo do esperado para a hunt, item com level mínimo bem acima do level da hunt (monstro fraco dando
 * equipamento forte), item em muitas hunts e as lacunas de poder entre itens da mesma faixa. Devolve contagens e a lista (até `limite`). Não muda nenhuma chance.
 */
export function alertasDeDistribuicao(dif = 'facil', cfg = IP.EM_USO, { limite = 300 } = {}) {
  const alertas = [];
  const emHunts = new Map();
  for (const h of huntsComMonstros()) {
    const a = analisarHunt(h.id, dif, cfg);
    if (!a || a.level == null) continue;
    for (const it of a.itens) {
      const dono = { hunt: h.id, huntNome: h.nome, level: a.level, item: it.id, itemNome: it.nome, slot: it.slot, ip: it.ip, esperadoNaHunt: it.esperadoNaHunt, diferencaPct: it.diferencaPct, chance: it.chance, monstros: it.monstros };
      emHunts.set(it.id, [...(emHunts.get(it.id) ?? []), h.id]);
      if (it.situacao === 'muito-acima') alertas.push({ tipo: 'item-muito-acima', gravidade: 'aviso', ...dono, mensagem: `${it.nome} (IP ${it.ip}) está ${Math.round((it.diferencaPct ?? 0) * 100)}% acima do esperado (${it.esperadoNaHunt}) para ${h.nome} (level ${a.level}).` });
      else if (it.diferencaPct != null && it.diferencaPct < cfg.alertas.itemMuitoAbaixoPct) alertas.push({ tipo: 'item-muito-abaixo', gravidade: 'info', ...dono, mensagem: `${it.nome} (IP ${it.ip}) está ${Math.round(-it.diferencaPct * 100)}% abaixo do esperado (${it.esperadoNaHunt}) para ${h.nome} (level ${a.level}).` });
      if (it.levelAcima != null && it.levelAcima > cfg.alertas.margemDeLevel) alertas.push({ tipo: 'level-acima-da-hunt', gravidade: 'aviso', ...dono, mensagem: `${it.nome} exige level ${it.minLevel}, ${it.levelAcima} acima do level ${a.level} de ${h.nome}: monstro de nível baixo dando equipamento forte.` });
    }
  }
  for (const [id, hs] of emHunts) if (hs.length > cfg.alertas.huntsDemais) alertas.push({ tipo: 'item-em-muitas-hunts', gravidade: 'info', item: id, itemNome: ITEM_CATALOG[id]?.name, hunts: hs.length, mensagem: `${ITEM_CATALOG[id]?.name} cai em ${hs.length} hunts (limite de atenção: ${cfg.alertas.huntsDemais}).` });
  const lacunas = IP.lacunasDePoder(IP.fichasDoCatalogo(cfg, { incluirCraft: false }), P.atos(), cfg.alertas).map((l) => ({ tipo: 'lacuna-de-poder', gravidade: 'info', slot: l.slot, ato: l.ato, de: l.de, ate: l.ate, razao: l.razao, mensagem: `${IP.ROTULO_DO_SLOT[l.slot]}, Ato ${l.ato}: de ${l.de.nome} (IP ${l.de.ip}) para ${l.ate.nome} (IP ${l.ate.ip}) o poder salta ${l.razao}×.` }));
  const todos = [...alertas, ...lacunas];
  const porTipo = {};
  for (const a of todos) porTipo[a.tipo] = (porTipo[a.tipo] ?? 0) + 1;
  return { dificuldade: dif, total: todos.length, porTipo, alertas: todos.slice(0, Math.min(1000, Math.max(1, Number(limite) || 300))), aviso: 'Alertas de leitura: nenhuma chance de drop é alterada sem a sua aprovação.' };
}

/**
 * Avalia uma REGRA de distribuição planejada (`{ levelMin, levelMax, ipMin, ipMax, raridades?, slots?, hunts?, chefes?, dificuldades? }`): quais equipamentos do catálogo CABEM nela
 * (candidatos) e quais drops atuais das hunts/chefes listados FOGEM dela (level, IP ou raridade fora). Só leitura.
 */
export function avaliarRegra(regra, cfg = IP.EM_USO, { limite = 80 } = {}) {
  const fichas = IP.fichasDoCatalogo(cfg, { incluirCraft: false });
  const cabe = (f) => (!regra.slots?.length || regra.slots.includes(f.slot)) && (!regra.raridades?.length || regra.raridades.includes(f.raridade))
    && (regra.levelMin == null || (f.minLevel != null && f.minLevel >= regra.levelMin)) && (regra.levelMax == null || (f.minLevel != null && f.minLevel <= regra.levelMax))
    && (regra.ipMin == null || f.ip >= regra.ipMin) && (regra.ipMax == null || f.ip <= regra.ipMax);
  const candidatos = fichas.filter(cabe);
  const fuga = [];
  const dificuldades = regra.dificuldades?.length ? regra.dificuldades : P.DIFICULDADES;
  const origens = [...(regra.hunts ?? []).map((id) => ({ tipo: 'hunt', id })), ...(regra.chefes ?? []).map((id) => ({ tipo: 'chefe', id }))];
  for (const o of origens) {
    const monstros = o.tipo === 'hunt' ? (huntsComMonstros().find((h) => h.id === o.id)?.monstros ?? []).map((m) => m.key) : [o.id];
    for (const key of monstros) {
      for (const e of equipamentosDoMonstro(key)) {
        const f = IP.fichaDePoder(e.id, cfg);
        if (f && !cabe({ ...f, slot: f.slot }) && !fuga.some((x) => x.item === f.id && x.origem === o.id)) fuga.push({ origem: o.id, tipoDeOrigem: o.tipo, monstro: key, item: f.id, nome: f.nome, ip: f.ip, minLevel: f.minLevel, raridade: f.raridade, chance: arred(e.chance, 6), dificuldades });
      }
    }
  }
  return { regra: regra.id ?? null, candidatos: candidatos.length, exemplos: candidatos.slice(0, limite).map((f) => ({ id: f.id, nome: f.nome, slot: f.slot, ip: f.ip, minLevel: f.minLevel, raridade: f.raridade })), foraDaRegra: fuga.length, fuga: fuga.slice(0, limite), aviso: 'A regra só orienta e mede: não altera drop nenhum.' };
}

/**
 * Os PRESENTES DE MARCO (baú do nível 50 e do 100, por classe): o IP de cada peça, por slot, e o total do conjunto. O baú dá UM item sorteado entre os da lista; então o "total"
 * soma, por slot, a MÉDIA dos itens possíveis (o que o baú entrega em expectativa) e o `totalMaximo` soma o melhor de cada slot. Destaca classes que fogem da média do level.
 */
export function presentesDeMarco(cfg = IP.EM_USO) {
  const linhas = [];
  for (const [classe, marcos] of Object.entries(SETS_DE_MARCO)) {
    for (const [level, lista] of Object.entries(marcos)) {
      const pecas = lista.map(([id, nome]) => { const f = IP.fichaDePoder(id, cfg); return { id, nome, slot: f?.slot ?? null, ip: f?.ip ?? 0, minLevel: f?.minLevel ?? null, contribuicao: f?.contribuicao ?? null, valido: !!f }; });
      const porSlot = {};
      for (const p of pecas.filter((x) => x.slot)) (porSlot[p.slot] ??= []).push(p);
      const slots = Object.entries(porSlot).map(([slot, ps]) => ({ slot, opcoes: ps.length, ipMedio: arred(ps.reduce((n, p) => n + p.ip, 0) / ps.length), ipMaximo: Math.max(...ps.map((p) => p.ip)) }));
      linhas.push({ classe, level: Number(level), pecas, slots, totalMedio: arred(slots.reduce((n, s) => n + s.ipMedio, 0)), totalMaximo: arred(slots.reduce((n, s) => n + s.ipMaximo, 0)), slotsSemPeca: IP.SLOTS.filter((s) => !porSlot[s]) });
    }
  }
  const desequilibrios = [];
  for (const level of [...new Set(linhas.map((l) => l.level))]) {
    const doLevel = linhas.filter((l) => l.level === level);
    const media = doLevel.reduce((n, l) => n + l.totalMedio, 0) / doLevel.length;
    for (const l of doLevel) {
      l.desvioDaMediaPct = media ? arred((l.totalMedio - media) / media, 4) : null;
      if (l.desvioDaMediaPct != null && Math.abs(l.desvioDaMediaPct) > cfg.classificacao.acimaDe) desequilibrios.push({ classe: l.classe, level, totalMedio: l.totalMedio, mediaDasClasses: arred(media), desvioPct: l.desvioDaMediaPct, mensagem: `${l.classe} no level ${level}: IP total ${l.totalMedio}, ${Math.round(l.desvioDaMediaPct * 100)}% da média das classes (${arred(media)}).` });
    }
  }
  return { linhas, desequilibrios, aviso: 'Só atributos base. As classes têm funções diferentes: a diferença é um sinal de discrepância de poder base, não exigência de igualdade por atributo.' };
}
