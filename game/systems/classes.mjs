// AS CLASSES do jogo e os bônus por atributo, editáveis na Engine (Editor de Classes) — sem sistema paralelo: a configuração de FÁBRICA é a que o jogo já tem (`classes.json` = nome, `atributos-principais.json`
// = atributos iniciais, ganho por level e efeitos por ponto, `classes-meta.json` = descrição, ícone e cor) e o dono grava só o que MUDA em `gamedata/overrides/classes.json`. Aplicar um override MUTA, no lugar,
// a mesma tabela que a engine lê (`Atributos.CONFIG.porVocacao` e `.efeitos`): a fórmula continua uma só (`personagem/atributos.mjs` → `Ficha.combate`), e o Hot Reload vale sem reiniciar.
//
// CLASSE × VOCAÇÃO: a vocação (knight, paladin, druid, sorcerer, monk) é a MECÂNICA de que o resto do jogo depende (magias, gemas, equipamento inicial, especializações, sprites). Uma classe criada no editor
// é uma classe nova SOBRE uma vocação-base (`vocacaoBase`): tem id, nome, descrição, ícone, cor, atributos iniciais e ganho por level próprios, e herda a mecânica da base. O personagem guarda as duas
// coisas (`vocation` = mecânica, `classe` = id escolhido); personagem antigo não tem `classe` e vale como a própria vocação.
//
// Atributos: o valor do personagem é DERIVADO (`base da classe + ganho por level × (level − 1) + itens`) a cada cálculo — nunca gravado no personagem —, então o inicial entra uma única vez e a progressão
// não duplica nada. Os bônus por ponto (`efeitos`) são globais, aplicados só em `Atributos.efeitos` e consumidos pela ficha.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as Atributos from './personagem/atributos.mjs';
import { PASTA as PASTA_DE_OVERRIDES } from './overrides.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const lerJson = (c) => JSON.parse(readFileSync(c, 'utf8'));
// Com o sistema de itens do PoE ligado (ITENS_POE=1, só local) as classes do jogo SÃO as 7 do PoE (decisão do dono, 05/10: "o que vale é o PoE"): a fábrica
// vem de `itens-poe/classes.json` e o override do dono fica num arquivo à parte (`classes-poe.json`), sem misturar com o das classes do Draevor.
const POE = itensPoeLigado();
export const ARQUIVO_DE_OVERRIDE = join(PASTA_DE_OVERRIDES, POE ? 'classes-poe.json' : 'classes.json');
/** As vocações (a MECÂNICA: magias, gemas, kit, sprites) sobre as quais uma classe se apoia. */
export const VOCACOES = ['knight', 'paladin', 'druid', 'sorcerer', 'monk'];
export const ATRIBUTOS = ['str', 'dex', 'int'];
export const ROTULO_DO_ATRIBUTO = { str: 'Força', dex: 'Destreza', int: 'Inteligência' };
export const FORMATO_DO_ID = /^[a-z][a-z0-9_-]{2,31}$/;
/** Os bônus por ponto de atributo: chave → { rotulo, atributo, unidade, min, max, padrao }. Os dois últimos (% de Evasion e de Energy Shield) nascem em 0: ligam-se aqui. */
export const EFEITOS = {
  STR_LIFE_PER_POINT: { rotulo: 'Vida por ponto de Força', atributo: 'str', unidade: 'vida', max: 100, padrao: 0 },
  STR_PHYSICAL_DAMAGE_PER_POINT: { rotulo: 'Dano físico (%) por ponto de Força', atributo: 'str', unidade: '%', max: 10, padrao: 0 },
  DEX_ACCURACY_PER_POINT: { rotulo: 'Precisão por ponto de Destreza', atributo: 'dex', unidade: 'precisão', max: 100, padrao: 0 },
  DEX_EVASION_PER_POINT: { rotulo: 'Evasão (rating) por ponto de Destreza', atributo: 'dex', unidade: 'rating', max: 100, padrao: 0 },
  DEX_EVASION_PCT_PER_POINT: { rotulo: 'Evasão (%) por ponto de Destreza', atributo: 'dex', unidade: '%', max: 10, padrao: 0 },
  DEX_ATTACK_SPEED_PER_POINT: { rotulo: 'Velocidade de ataque (%) por ponto de Destreza', atributo: 'dex', unidade: '%', max: 10, padrao: 0 },
  INT_MANA_PER_POINT: { rotulo: 'Mana por ponto de Inteligência', atributo: 'int', unidade: 'mana', max: 100, padrao: 0 },
  INT_MAGIC_DAMAGE_PER_POINT: { rotulo: 'Dano mágico (%) por ponto de Inteligência', atributo: 'int', unidade: '%', max: 10, padrao: 0 },
  INT_ENERGY_SHIELD_PCT_PER_POINT: { rotulo: 'Energy Shield (%) por ponto de Inteligência', atributo: 'int', unidade: '%', max: 10, padrao: 0 },
};
const eNum = (n) => typeof n === 'number' && Number.isFinite(n);
// O OUTFIT INICIAL da classe (Editor de Classes): `{ male: look|null, female: look|null, cores: { head, body, legs, feet }, addons: 0..3 }` — o personagem
// nasce vestido com ele (e o tem para sempre, mesmo trocando de roupa). Sem ele (ou sem o look de um sexo), vale o da vocação.
const LOOKS = JSON.parse(readFileSync(join(RAIZ, 'outfits.json'), 'utf8'));
export const lookExiste = (look) => Object.hasOwn(LOOKS, String(look));
const PARTES_DA_COR = ['head', 'body', 'legs', 'feet'];
export function validarOutfit(o, onde) {
  const erros = [];
  if (o == null) return erros;
  if (typeof o !== 'object') return [`${onde}: o outfit inicial precisa ser um objeto.`];
  for (const sexo of ['male', 'female']) if (o[sexo] != null && !(Number.isInteger(o[sexo]) && lookExiste(o[sexo]))) erros.push(`${onde}: o desenho ${sexo === 'male' ? 'masculino' : 'feminino'} (${o[sexo]}) não existe nos atlas.`);
  for (const p of PARTES_DA_COR) if (o.cores?.[p] != null && !(Number.isInteger(o.cores[p]) && o.cores[p] >= 0 && o.cores[p] <= 132)) erros.push(`${onde}: a cor "${p}" vai de 0 a 132.`);
  if (o.addons != null && !(Number.isInteger(o.addons) && o.addons >= 0 && o.addons <= 3)) erros.push(`${onde}: addons de 0 a 3.`);
  return erros;
}
/** O que vestir ao criar o personagem desta classe neste sexo: `{ type, head, body, legs, feet, addons }` ou null (vale o da vocação). */
export function outfitInicial(classe, sexo) {
  const o = classe?.outfit;
  const look = o?.[sexo];
  if (!look || !lookExiste(look)) return null;
  const c = o.cores ?? {};
  return { type: look, head: c.head ?? 78, body: c.body ?? 88, legs: c.legs ?? 58, feet: c.feet ?? 76, mount: 0, addons: o.addons ?? 0 };
}

// ---------------------------------------------------------------- a fábrica (lida dos arquivos que o jogo já tem)
function montarFabrica() {
  const classesJson = lerJson(join(RAIZ, 'classes.json')).classes;
  const principais = lerJson(join(RAIZ, 'atributos-principais.json'));
  const meta = lerJson(join(RAIZ, 'classes-meta.json'));
  const classes = {};
  for (const id of meta.ordem) {
    const m = meta.classes[id] ?? {};
    classes[id] = { id, nome: classesJson[id]?.nome ?? id, descricao: m.descricao ?? '', icone: m.icone ?? '⚔️', cor: m.cor ?? '#888888', ativo: true, builtin: true, vocacaoBase: id,
      atributosIniciais: { ...principais.porVocacao[id].base }, porLevel: { ...principais.porVocacao[id].porLevel } };
  }
  const efeitos = Object.fromEntries(Object.entries(EFEITOS).map(([k, v]) => [k, principais.efeitos[k] ?? v.padrao]));
  return { classes, efeitos, perfilSugerido: meta.perfilSugerido ?? null };
}
/**
 * A fábrica do PoE: as 7 classes (atributos iniciais do PoE, SEM ganho por level — decisão do dono) sobre a vocação do Draevor que dá a mecânica, e os bônus por ponto
 * do PoE (Força: +0,5 de vida e +0,2% de dano físico; Destreza: +2 de precisão e +0,2% de evasão; Inteligência: +0,5 de mana e +0,2% de escudo de energia).
 */
const VOCACAO_DA_CLASSE_POE = { Marauder: 'knight', Ranger: 'paladin', Witch: 'sorcerer', Templar: 'druid', Duelist: 'monk', Shadow: 'paladin', Scion: 'knight' };
const VISUAL_DA_CLASSE_POE = { Marauder: ['🪓', '#c0392b'], Ranger: ['🏹', '#27ae60'], Witch: ['🔮', '#2e86de'], Templar: ['✝️', '#d4ac0d'], Duelist: ['⚔️', '#e67e22'], Shadow: ['🗡️', '#8e44ad'], Scion: ['👑', '#bdc3c7'] };
export const EFEITOS_DO_POE = Atributos.EFEITOS_DO_POE;
function montarFabricaPoe() {
  const d = lerJson(join(RAIZ, 'itens-poe', 'classes.json'));
  const classes = {};
  for (const slug of d.ordem) {
    const c = d.classes[slug];
    const [icone, cor] = VISUAL_DA_CLASSE_POE[slug] ?? ['⚔️', '#888888'];
    const id = slug.toLowerCase();
    classes[id] = { id, nome: c.nome, descricao: `Classe do Path of Exile (${c.nomeEn}). Ascendências: ${(c.ascendencias ?? []).map((a) => a.nome).join(', ')}.`.slice(0, 300), icone, cor, ativo: true, builtin: true,
      vocacaoBase: VOCACAO_DA_CLASSE_POE[slug] ?? 'knight', atributosIniciais: { ...c.atributos }, porLevel: { str: 0, dex: 0, int: 0 }, poe: slug };
  }
  return { classes, efeitos: { ...EFEITOS_DO_POE }, perfilSugerido: null };
}
export const ORIGINAL = POE ? montarFabricaPoe() : montarFabrica();

// ---------------------------------------------------------------- validação e efetivo
/** O override (`null` se não existe; ignora e avisa se quebrado). */
export function lerOverride(arquivo = ARQUIVO_DE_OVERRIDE, avisar = console.warn) {
  if (!existsSync(arquivo)) return null;
  try { return lerJson(arquivo); } catch (e) { avisar(`[overrides] classes.json ignorado: ${e.message}`); return null; }
}

/** A configuração EFETIVA `{ classes: {id: classe}, efeitos }` (fábrica + override se ativo). Pura. */
export function efetivo(original, override) {
  const classes = Object.fromEntries(Object.entries(original.classes).map(([id, c]) => [id, structuredClone(c)]));
  const efeitos = { ...original.efeitos };
  if (override && override.ativo !== false) {
    for (const [id, ov] of Object.entries(override.classes ?? {})) {
      if (ov === null || ov?.excluido === true) { delete classes[id]; continue; }
      const base = classes[id];
      if (base) classes[id] = { ...base, ...structuredClone(ov), id, builtin: true, vocacaoBase: base.vocacaoBase, ...(base.poe ? { poe: base.poe } : {}), atributosIniciais: { ...base.atributosIniciais, ...(ov.atributosIniciais ?? {}) }, porLevel: { ...base.porLevel, ...(ov.porLevel ?? {}) } };
      else classes[id] = { descricao: '', icone: '⚔️', cor: '#888888', ativo: true, ...structuredClone(ov), id, builtin: false, atributosIniciais: { str: 0, dex: 0, int: 0, ...(ov.atributosIniciais ?? {}) }, porLevel: { str: 0, dex: 0, int: 0, ...(ov.porLevel ?? {}) } };
    }
    Object.assign(efeitos, override.efeitos ?? {});
  }
  return { classes, efeitos };
}

/** Valida uma configuração efetiva. `{ erros, avisos }`. Pura. */
export function validarConfiguracao(cfg, original = ORIGINAL) {
  const erros = []; const avisos = [];
  const vocacoes = VOCACOES;
  for (const [id, c] of Object.entries(cfg.classes)) {
    const onde = `classe ${id}`;
    if (!FORMATO_DO_ID.test(id)) erros.push(`${onde}: o ID precisa ter 3 a 32 caracteres (minúsculas, números, hífen e sublinhado; começa com letra).`);
    if (!(typeof c.nome === 'string' && c.nome.trim().length >= 1 && c.nome.length <= 40)) erros.push(`${onde}: o nome precisa ter de 1 a 40 caracteres.`);
    if (typeof c.descricao !== 'string' || c.descricao.length > 300) erros.push(`${onde}: a descrição pode ter até 300 caracteres.`);
    if (typeof c.icone !== 'string' || c.icone.length < 1 || c.icone.length > 8) erros.push(`${onde}: o ícone precisa ter de 1 a 8 caracteres (um emoji ou símbolo).`);
    if (!/^#[0-9a-f]{6}$/i.test(c.cor ?? '')) erros.push(`${onde}: a cor precisa estar no formato #RRGGBB.`);
    if (typeof c.ativo !== 'boolean') erros.push(`${onde}: "ativo" precisa ser verdadeiro ou falso.`);
    if (!vocacoes.includes(c.vocacaoBase)) erros.push(`${onde}: a vocação-base "${c.vocacaoBase}" não existe (use ${vocacoes.join(', ')}).`);
    for (const a of ATRIBUTOS) {
      const v = c.atributosIniciais?.[a];
      if (!Number.isInteger(v) || v < 0 || v > 1000) erros.push(`${onde}: ${ROTULO_DO_ATRIBUTO[a]} inicial precisa ser um inteiro de 0 a 1000 (veio ${v}).`);
      const g = c.porLevel?.[a];
      if (!eNum(g) || g < 0 || g > 10) erros.push(`${onde}: o ganho de ${ROTULO_DO_ATRIBUTO[a]} por level precisa ser um número de 0 a 10 (veio ${g}).`);
    }
    if (ATRIBUTOS.every((a) => !(c.atributosIniciais?.[a] > 0))) avisos.push(`${onde}: todos os atributos iniciais são 0.`);
    erros.push(...validarOutfit(c.outfit, onde));
  }
  for (const id of Object.keys(original.classes)) if (!cfg.classes[id]) erros.push(`classe ${id}: classes de fábrica não podem ser apagadas (desative-as).`);
  if (!Object.values(cfg.classes).some((c) => c.ativo === true)) erros.push('Ao menos uma classe precisa ficar ativa (senão ninguém cria personagem).');
  for (const [k, v] of Object.entries(cfg.efeitos)) {
    const e = EFEITOS[k];
    if (!e) { erros.push(`efeito "${k}" não existe (use ${Object.keys(EFEITOS).join(', ')}).`); continue; }
    if (!eNum(v) || v < 0 || v > e.max) erros.push(`${e.rotulo}: precisa ser um número de 0 a ${e.max} (veio ${v}).`);
  }
  return { erros, avisos };
}

/** O que cada ponto de atributo rende, pela tabela de efeitos dada: a PRÉVIA do editor e o teste de consistência com a engine. Pura. */
export function previaDeEfeitos(efeitos, { str = 0, dex = 0, int = 0 } = {}) {
  const e = (k) => efeitos[k] ?? 0;
  const r = (n) => Math.round(n * 1000) / 1000;
  return {
    str: { vida: r(str * e('STR_LIFE_PER_POINT')), danoFisicoPct: r(str * e('STR_PHYSICAL_DAMAGE_PER_POINT')) },
    dex: { precisao: r(dex * e('DEX_ACCURACY_PER_POINT')), evasaoRating: r(dex * e('DEX_EVASION_PER_POINT')), evasaoPct: r(dex * e('DEX_EVASION_PCT_PER_POINT')), velocidadeDeAtaquePct: r(dex * e('DEX_ATTACK_SPEED_PER_POINT')) },
    int: { mana: r(int * e('INT_MANA_PER_POINT')), danoMagicoPct: r(int * e('INT_MAGIC_DAMAGE_PER_POINT')), energyShieldPct: r(int * e('INT_ENERGY_SHIELD_PCT_PER_POINT')) },
  };
}

// ---------------------------------------------------------------- aplicar na engine (no lugar) e consultar o estado em uso
export const EM_USO = { classes: {}, efeitos: {} };
export const resultadoDaCarga = { aplicado: false, erros: [], avisos: [] };
const CUSTOM_APLICADAS = new Set();

/** Aplica um override: valida (estrito = Hot Reload: inválido NÃO é aplicado) e atualiza a tabela que a engine lê. `{ ok, erros, avisos }`. */
export function aplicar(override, { estrito = false, avisar = console.warn } = {}) {
  const cfg = efetivo(ORIGINAL, override);
  const v = validarConfiguracao(cfg);
  if (v.erros.length) {
    resultadoDaCarga.erros = v.erros;
    if (!estrito) avisar(`[overrides] classes.json ignorado: ${v.erros.join(' | ')}`);
    return { ok: false, ...v };
  }
  for (const id of CUSTOM_APLICADAS) if (!cfg.classes[id]) { delete Atributos.CONFIG.porVocacao[id]; CUSTOM_APLICADAS.delete(id); }
  for (const [id, c] of Object.entries(cfg.classes)) {
    Atributos.CONFIG.porVocacao[id] = { base: { ...c.atributosIniciais }, porLevel: { ...c.porLevel } };
    if (!c.builtin) CUSTOM_APLICADAS.add(id);
  }
  for (const k of Object.keys(Atributos.CONFIG.efeitos)) delete Atributos.CONFIG.efeitos[k];
  Object.assign(Atributos.CONFIG.efeitos, cfg.efeitos);
  for (const k of Object.keys(EM_USO.classes)) delete EM_USO.classes[k];
  Object.assign(EM_USO.classes, cfg.classes);
  for (const k of Object.keys(EM_USO.efeitos)) delete EM_USO.efeitos[k];
  Object.assign(EM_USO.efeitos, cfg.efeitos);
  resultadoDaCarga.aplicado = !!override && override.ativo !== false && (Object.keys(override.classes ?? {}).length > 0 || Object.keys(override.efeitos ?? {}).length > 0);
  resultadoDaCarga.erros = []; resultadoDaCarga.avisos = v.avisos;
  return { ok: true, ...v };
}
{
  const ov = lerOverride();
  const r = aplicar(ov);
  if (!r.ok) aplicar(null);
  else if (ov && (Object.keys(ov.classes ?? {}).length || Object.keys(ov.efeitos ?? {}).length)) console.log('[overrides] classes: override aplicado.');
}

export const listar = () => Object.values(EM_USO.classes);
export const ativas = () => listar().filter((c) => c.ativo);
/** A classe pelo id; sem id (personagem antigo) vale a vocação. `null` se não existe. */
export const obter = (idOuVocacao) => EM_USO.classes[String(idOuVocacao ?? '').toLowerCase()] ?? null;
/** A classe ATIVA para criar personagem, ou `null` (inexistente ou desativada). O servidor valida por aqui — nunca confia no que o cliente diz. */
// Com o PoE ligado, aceita também o slug do PoE (`Marauder`) e a vocação (`knight` → a classe do PoE padrão dela: a primeira ativa sobre ela, na ordem do PoE).
export const resolverParaCriacao = (idOuVocacao) => {
  const t = String(idOuVocacao ?? '').toLowerCase();
  const c = obter(t) ?? (POE ? listar().find((x) => x.ativo && x.vocacaoBase === t) ?? null : null);
  return c?.ativo ? c : null;
};
/** O que a tela de criação do jogador precisa (só o público): classes ativas, atributos iniciais e o que cada ponto rende. */
export function paraOCliente() {
  return { classes: ativas().map((c) => ({ id: c.id, nome: c.nome, descricao: c.descricao, icone: c.icone, cor: c.cor, vocacaoBase: c.vocacaoBase, atributosIniciais: { ...c.atributosIniciais }, porLevel: { ...c.porLevel }, ...(c.outfit ? { outfit: structuredClone(c.outfit) } : {}) })),
    efeitos: Object.entries(EFEITOS).map(([k, e]) => ({ chave: k, rotulo: e.rotulo, atributo: e.atributo, unidade: e.unidade, valor: EM_USO.efeitos[k] ?? e.padrao })).filter((x) => x.valor > 0) };
}
