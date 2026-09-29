// COMPARAR uma peça com a que está vestida no mesmo slot — por TODOS os
// atributos, e pelo impacto no personagem.
//
// O dono: "a comparação precisa considerar todos os atributos do item ... usar
// o mesmo sistema de agregação de atributos do personagem ... e funcionar para
// atributos futuros, sem compare.attack/compare.crit hardcoded".
//
// Duas respostas, as duas SEM lista de campos no código:
//
//   atributos — a diferença, atributo a atributo, entre as duas peças: os
//     campos numéricos do item-base (catálogo), os atributos da peça (`af`,
//     qualquer id de `gamedata/itens/atributos.json`) e o tier. Um atributo
//     novo registrado aparece sozinho.
//
//   personagem — o IMPACTO: o personagem é copiado, veste a peça nova, e a
//     ficha é recalculada pelo MESMO `Ficha.combate` que o combate usa (mais
//     vida/mana máximas e capacidade). A diferença é campo a campo da ficha,
//     achatada — um campo novo na ficha também aparece sozinho.
//
// Os NOMES vêm de registros: `atributos.json` (atributos da peça) e
// `gamedata/itens/campos.json` (item-base e ficha). Campo sem nome aparece
// pela chave, em vez de sumir.
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../dados.mjs';
import * as Ficha from '../ficha.mjs';
import * as Afixos from '../afixos.mjs';
import { ATRIBUTOS } from './config.mjs';

const CAMPOS = JSON.parse(readFileSync(new URL('../../gamedata/itens/campos.json', import.meta.url), 'utf8'));

/** Achata os números de um objeto: `{protection: {fire: 5}}` → `[['protection.fire', 5]]`. */
function achatar(o, prefixo = '', saida = []) {
  if (!o || typeof o !== 'object') return saida;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number' && Number.isFinite(v)) saida.push([prefixo + k, v]);
    else if (v && typeof v === 'object' && !Array.isArray(v)) achatar(v, `${prefixo}${k}.`, saida);
  }
  return saida;
}

/** O nome, a escala e a unidade de um campo, pelo registro (`item` ou `ficha`). */
function rotuloDe(registro, chave) {
  const exato = registro[chave];
  const [pai, sub] = [chave.slice(0, chave.lastIndexOf('.')), chave.slice(chave.lastIndexOf('.') + 1)];
  const curinga = !exato && chave.includes('.') ? registro[`${pai}.*`] : null;
  const def = exato ?? curinga;
  if (!def) return null;
  const nome = def.nome.replace('{sub}', CAMPOS.subchaves?.[sub] ?? sub);
  return { nome, escala: def.escala ?? 1, sufixo: def.sufixo ?? '' };
}

/*
 * Os campos do ITEM-BASE que contam como atributo: os números do catálogo que
 * o registro `campos.json#item` conhece (peso, preço, level mínimo e afins
 * ficam de fora — não são atributo). Um campo novo do catálogo entra com uma
 * linha no registro.
 */
function doItemBase(meta) {
  const saida = new Map();
  for (const [chave, valor] of achatar(meta)) {
    const r = rotuloDe(CAMPOS.item, chave);
    if (r && valor) saida.set(`item:${chave}`, { nome: r.nome, sufixo: r.sufixo, valor: valor * r.escala });
  }
  return saida;
}

/** Todos os atributos de uma peça, numa chave por linha: item-base + `af` + tier. */
export function atributosDaPeca(peca) {
  const meta = ITEM_CATALOG[peca?.id];
  const saida = meta ? doItemBase(meta) : new Map();
  for (const a of peca?.af ?? []) {
    const ficha = ATRIBUTOS[a.id];
    const atual = saida.get(`af:${a.id}`);
    const valor = (atual?.valor ?? 0) + (Number(a.value) || 0);
    saida.set(`af:${a.id}`, { nome: ficha?.nome ?? a.id, sufixo: ficha?.tipo === 'pct' ? '%' : '', valor });
  }
  if (peca?.tier) saida.set('tier', { nome: 'Tier', sufixo: '', valor: peca.tier });
  return saida;
}

/** A diferença entre dois conjuntos de atributos: só o que muda, maior mudança primeiro. */
function diferenca(novos, velhos) {
  const linhas = [];
  for (const chave of new Set([...novos.keys(), ...velhos.keys()])) {
    const n = novos.get(chave);
    const v = velhos.get(chave);
    const de = v?.valor ?? 0;
    const para = n?.valor ?? 0;
    const delta = para - de;
    if (Math.abs(delta) < 1e-9) continue;
    linhas.push({ chave, nome: (n ?? v).nome, sufixo: (n ?? v).sufixo, de, para, delta });
  }
  return linhas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/*
 * O personagem como a comparação vê: a ficha de combate + vida/mana máximas e
 * capacidade (que não passam pela ficha: `Afixos.sincronizarMaximos`). Numa
 * CÓPIA rasa — o estado de verdade não é tocado, e a ficha (cache por objeto)
 * é calculada do zero para a cópia.
 */
function retrato(estado) {
  const copia = { ...estado, afixoMax: { ...(estado.afixoMax ?? { hp: 0, mana: 0 }) } };
  Afixos.sincronizarMaximos(copia);
  const f = Ficha.combate(copia);
  const numeros = new Map();
  const pares = [...achatar(f), ['vidaMaxima', copia.maxHp ?? 0], ['manaMaxima', copia.maxMana ?? 0], ['capacidade', Afixos.capacidade(copia)]];
  for (const [chave, valor] of pares) {
    const r = rotuloDe(CAMPOS.ficha, chave);
    numeros.set(chave, { nome: r?.nome ?? chave, sufixo: r?.sufixo ?? '', valor: valor * (r?.escala ?? 1), conhecido: !!r });
  }
  return numeros;
}

/**
 * Compara `peca` (`{id, af?, tier?, imbu?}`) com o que o personagem veste no
 * slot dela. `{ok, slot, contra, atributos, personagem}` — `contra` é a peça
 * vestida (ou `null`); `atributos` e `personagem` são listas
 * `{chave, nome, sufixo, de, para, delta}`.
 */
export function comparar(estado, peca) {
  const meta = ITEM_CATALOG[peca?.id];
  if (!meta?.slot || meta.stackable) return { ok: false, erro: 'Este item não se veste.' };
  const slot = meta.slot;
  if (slot === 'backpack') return { ok: false, erro: 'Mochila não se compara.' };
  const vestida = estado.equipment?.[slot] ?? null;
  const limpa = { id: meta.id, count: 1, ...(Array.isArray(peca.af) ? { af: peca.af.filter((a) => ATRIBUTOS[a?.id]).map((a) => ({ id: a.id, nivel: a.nivel, value: Number(a.value) || 0 })) } : {}), ...(peca.tier ? { tier: Math.max(0, Math.floor(Number(peca.tier) || 0)) } : {}) };

  const equipamento = { ...(estado.equipment ?? {}), [slot]: limpa };
  // Arma de duas mãos tira o escudo: é uma peça inteira saindo, e a ficha tem de ver isso.
  if (slot === 'weapon' && meta.twoHanded) equipamento.shield = null;
  const antes = retrato(estado);
  const depois = retrato({ ...estado, equipment: equipamento });
  // Só os campos da ficha com nome no registro — os internos (proficiência por
  // golpe, custo de mana...) mudam por dentro sem dizer nada à pessoa.
  const personagem = diferenca(
    new Map([...depois].filter(([, v]) => v.conhecido)),
    new Map([...antes].filter(([, v]) => v.conhecido))
  ).map(({ chave, nome, sufixo, de, para, delta }) => ({ chave, nome, sufixo, de: arredondar(de), para: arredondar(para), delta: arredondar(delta) }));
  const atributos = diferenca(atributosDaPeca(limpa), atributosDaPeca(vestida)).map((l) => ({ ...l, de: arredondar(l.de), para: arredondar(l.para), delta: arredondar(l.delta) }));
  return {
    ok: true,
    slot,
    contra: vestida ? { id: vestida.id, nome: ITEM_CATALOG[vestida.id]?.name ?? String(vestida.id) } : null,
    tiraOEscudo: slot === 'weapon' && !!meta.twoHanded && !!estado.equipment?.shield,
    atributos: atributos.filter((l) => l.delta !== 0),
    personagem: personagem.filter((l) => l.delta !== 0),
  };
}

const arredondar = (v) => Math.round(v * 100) / 100;
