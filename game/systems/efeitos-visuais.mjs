// O VISUAL das skills, separado do gameplay (dono, 06/10: "Arena de Efeitos" — trocar o sprite, a animação, o impacto e o projétil de uma
// skill sem mexer no dano). O combate continua o mesmo: o servidor marca os eventos de cada skill com o id dela (`sk`) e o CLIENTE
// desenha com o visual configurado aqui (`frontend/client/src/efeitos-visuais.mjs`, o mesmo módulo do jogo e da Arena de Efeitos).
//
// Guardado em `gamedata/overrides/efeitos.json` (o padrão dos overrides: só o que o dono configurou; versões em `_versoes/efeitos`):
//   assets:  { id: { nome, categoria, arquivo, colunas, linhas, fps, inicio, fim, loop, pingpong, reverso } } — spritesheets próprios
//            (o PNG em `gamedata/overrides/efeitos-assets/`);
//   presets: { id: { nome, visual } } — um conjunto de efeitos reutilizável (os de fábrica vêm de `PRESETS_DE_FABRICA`);
//   skills:  { idDaSkill: { preset, override } } — a skill usa o preset e muda o que quiser por cima.
// Um VISUAL tem as PARTES (os eventos do combate a que cada uma responde):
//   lancamento (SKILL_CAST, no personagem), projetil (PROJECTILE_CREATED), impacto (PROJECTILE_HIT/o efeito no alvo), area
//   (AREA_CREATED, cada casa), alvo (DAMAGE_APPLIED, preso ao bicho atingido).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ACTION_CATALOG } from './dados.mjs';
import * as GemasPoe from './itens-poe/gemas-poe.mjs';
import { estiloDaGema } from './itens-poe/estilos-das-gemas.mjs';

export const ARQUIVO = new URL('../gamedata/overrides/efeitos.json', import.meta.url).pathname;
export const PASTA_DOS_ASSETS = new URL('../gamedata/overrides/efeitos-assets/', import.meta.url).pathname;
export const URL_DOS_ASSETS = '/gamedata/overrides/efeitos-assets/';

/** Os SPRITES DE FÁBRICA (tools/gerar-sprites-de-efeitos.mjs): desenhados por código, por elemento — na biblioteca e nos estilos. */
const ARQ_DE_FABRICA = new URL('../gamedata/efeitos-fabrica/assets.json', import.meta.url).pathname;
export const ASSETS_DE_FABRICA = existsSync(ARQ_DE_FABRICA) ? JSON.parse(readFileSync(ARQ_DE_FABRICA, 'utf8')).assets ?? {} : {};
const URL_DE_FABRICA = '/gamedata/efeitos-fabrica/';

export const PARTES = ['lancamento', 'projetil', 'impacto', 'area', 'alvo', 'continuo'];
export const NOME_DA_PARTE = { lancamento: 'Lançamento (no personagem)', projetil: 'Projétil', impacto: 'Impacto (no alvo)', area: 'Área (no chão)', alvo: 'No alvo atingido', continuo: 'Contínuo (enquanto o buff dura)' };
export const EVENTO_DA_PARTE = { lancamento: 'SKILL_CAST', projetil: 'PROJECTILE_CREATED', impacto: 'PROJECTILE_HIT', area: 'AREA_CREATED', alvo: 'DAMAGE_APPLIED', continuo: 'BUFF_ACTIVE' };
export const CATEGORIAS = ['Cast', 'Projectile', 'Trail', 'Impact', 'Explosion', 'Ground', 'Aura', 'Buff', 'Debuff', 'Particle', 'Other'];
export const ANCORAS = ['acima', 'corpo', 'pes'];

/**
 * Os CAMPOS de uma parte: `[tipo, min, max]` dos números, `bool`, `ancora`, `sprite`, `rastro`, `som`. O que a tela edita e o que o
 * cliente aplica (ver `frontend/client/src/efeitos-visuais.mjs`).
 */
const NUMEROS = {
  escala: [0.1, 5], rotacao: [-360, 360], opacidade: [0, 1], dx: [-96, 96], dy: [-96, 96], atraso: [0, 5000], duracao: [0, 10000], velocidade: [10, 500], repetir: [1, 10],
};
const BOOLS = ['flipX', 'flipY', 'loop', 'noImpacto', 'orientar'];

/** Os presets de FÁBRICA (um por elemento): o projétil e o impacto da magia de projétil do Draevor desse elemento. Só leitura (duplicar para mudar). */
const DE_FABRICA = [
  ['fogo', 'Fogo', 'spell-flame-strike'], ['gelo', 'Gelo', 'spell-ice-strike'], ['raio', 'Raio', 'spell-energy-strike'], ['caos', 'Caos / Morte', 'spell-death-strike'],
  ['veneno', 'Veneno / Terra', 'spell-terra-strike'], ['sagrado', 'Sagrado', 'spell-divine-missile'], ['fisico', 'Físico', 'spell-physical-strike'],
];
export const PRESETS_DE_FABRICA = Object.fromEntries(
  DE_FABRICA.map(([id, nome, magia]) => {
    const a = ACTION_CATALOG.spells.find((x) => x.id === magia);
    const visual = {};
    if (a?.projetil) visual.projetil = { sprite: { tipo: 'projetil', id: a.projetil } };
    if (a?.efeito) {
      visual.impacto = { sprite: { tipo: 'efeito', id: a.efeito } };
      visual.area = { sprite: { tipo: 'efeito', id: a.efeito } };
    }
    return [`fabrica:${id}`, { nome, fabrica: true, visual }];
  })
);

let CACHE = { mtime: -1, dados: null };
const VAZIO = () => ({ assets: {}, presets: {}, skills: {} });
/** O override gravado (lido de novo quando o arquivo muda: o Hot Reload da engine local vale sem reiniciar). */
export function ler() {
  if (!existsSync(ARQUIVO)) return (CACHE = { mtime: 0, dados: VAZIO() }).dados;
  const m = statSync(ARQUIVO).mtimeMs;
  if (m !== CACHE.mtime) {
    try {
      CACHE = { mtime: m, dados: { ...VAZIO(), ...JSON.parse(readFileSync(ARQUIVO, 'utf8')) } };
    } catch {
      CACHE = { mtime: m, dados: VAZIO() };
    }
  }
  return CACHE.dados;
}

/** Junta duas partes (o override por cima do preset): campo a campo; `rastro` e `som` também. */
function juntarParte(base, por) {
  if (!por) return base ?? null;
  if (por.sprite?.tipo === 'nenhum') return { ...por };
  return { ...(base ?? {}), ...por, ...(base?.rastro || por.rastro ? { rastro: { ...(base?.rastro ?? {}), ...(por.rastro ?? {}) } } : {}) };
}

/**
 * O ESTILO automático da skill (as gemas do PoE — `itens-poe/estilos-das-gemas.mjs`): `{ visual, motivo }` ou null. Calculado uma vez
 * (só depois que as gemas do PoE ligaram).
 */
const ESTILOS = new Map();
let ACAO_POR_ID = null;
export function estiloDaSkill(skill) {
  if (ESTILOS.has(skill)) return ESTILOS.get(skill);
  if (!GemasPoe.ligadas()) return null;
  if (!ACAO_POR_ID || ACAO_POR_ID.size !== ACTION_CATALOG.spells.length) ACAO_POR_ID = new Map(ACTION_CATALOG.spells.map((e) => [e.id, e]));
  const e = ACAO_POR_ID.get(skill);
  const r = e?.poeGema ? GemasPoe.doSlug(e.poeGema.slug) : null;
  const est = r ? estiloDaGema({ en: r.gema.en, tags: r.gema.tags ?? [], arquetipo: r.arquetipo, elemento: r.elemento, ataque: r.ataque, buff: r.buff }) : null;
  ESTILOS.set(skill, est);
  return est;
}

/**
 * O VISUAL final de uma skill: o estilo automático da gema (se não desligado com `semEstilo`), o preset por cima e o override por cima
 * de tudo — parte a parte, campo a campo. null: a skill usa o desenho de sempre do combate (o molde).
 */
export function visualDaSkill(skill, dados = ler()) {
  const s = dados.skills?.[skill];
  const estilo = s?.semEstilo ? null : estiloDaSkill(skill)?.visual ?? null;
  if (!s && !estilo) return null;
  const preset = s?.preset ? dados.presets?.[s.preset] ?? PRESETS_DE_FABRICA[s.preset] ?? null : null;
  const visual = {};
  for (const p of PARTES) {
    const parte = juntarParte(juntarParte(estilo?.[p], preset?.visual?.[p]), s?.override?.[p]);
    if (parte) visual[p] = parte;
  }
  return Object.keys(visual).length ? visual : null;
}

/** O que o CLIENTE recebe (o jogo e a arena): os assets com a URL, os presets (com os de fábrica) e o visual RESOLVIDO de cada skill. */
export function paraOCliente(dados = ler()) {
  const assets = {
    ...Object.fromEntries(Object.entries(ASSETS_DE_FABRICA).map(([id, a]) => [id, { ...a, url: `${URL_DE_FABRICA}${encodeURIComponent(a.arquivo)}` }])),
    ...Object.fromEntries(Object.entries(dados.assets ?? {}).map(([id, a]) => [id, { ...a, url: `${URL_DOS_ASSETS}${encodeURIComponent(a.arquivo)}` }])),
  };
  const skills = {};
  // As configuradas e as gemas do PoE (todas têm o estilo automático).
  const ids = new Set([...Object.keys(dados.skills ?? {}), ...[...GemasPoe.REGISTRO.values()].map((r) => r.acao)]);
  for (const id of ids) {
    const v = visualDaSkill(id, dados);
    if (v) skills[id] = v;
  }
  return { assets, presets: { ...PRESETS_DE_FABRICA, ...(dados.presets ?? {}) }, skills };
}

// ---------------------------------------------------------------- validação

const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** Valida e LIMPA uma parte (números no intervalo, só os campos conhecidos). `{ parte, erros }`. */
export function limparParte(nome, p, assets = {}) {
  const erros = [];
  if (!ehObjeto(p)) return { parte: null, erros: [`${nome}: precisa ser um objeto.`] };
  const saida = {};
  for (const [k, v] of Object.entries(p)) {
    if (NUMEROS[k]) {
      const n = Number(v);
      if (!Number.isFinite(n)) { erros.push(`${nome}.${k}: precisa ser um número.`); continue; }
      const [min, max] = NUMEROS[k];
      saida[k] = Math.min(max, Math.max(min, n));
    } else if (BOOLS.includes(k)) saida[k] = !!v;
    else if (k === 'ancora') {
      if (!ANCORAS.includes(v)) erros.push(`${nome}.ancora: ${ANCORAS.join(', ')}.`);
      else saida.ancora = v;
    } else if (k === 'sprite') {
      if (!ehObjeto(v) || !['efeito', 'projetil', 'asset', 'nenhum'].includes(v.tipo)) { erros.push(`${nome}.sprite: { tipo: efeito|projetil|asset|nenhum, id }.`); continue; }
      if (v.tipo === 'asset' && !assets[v.id]) { erros.push(`${nome}.sprite: o asset "${v.id}" não existe na biblioteca.`); continue; }
      if ((v.tipo === 'efeito' || v.tipo === 'projetil') && !(Number(v.id) > 0)) { erros.push(`${nome}.sprite: id do ${v.tipo} inválido.`); continue; }
      saida.sprite = v.tipo === 'nenhum' ? { tipo: 'nenhum' } : { tipo: v.tipo, id: v.tipo === 'asset' ? String(v.id) : Number(v.id) };
    } else if (k === 'rastro') {
      if (!ehObjeto(v)) { erros.push(`${nome}.rastro: precisa ser um objeto.`); continue; }
      const r = {};
      if (v.quantidade != null) r.quantidade = Math.min(10, Math.max(0, Math.round(Number(v.quantidade) || 0)));
      if (v.espaco != null) r.espaco = Math.min(0.3, Math.max(0.02, Number(v.espaco) || 0.06));
      if (v.opacidade != null) r.opacidade = Math.min(1, Math.max(0, Number(v.opacidade) || 0));
      if (v.sprite) {
        const s = limparParte(`${nome}.rastro`, { sprite: v.sprite }, assets);
        erros.push(...s.erros);
        if (s.parte?.sprite) r.sprite = s.parte.sprite;
      }
      saida.rastro = r;
    } else if (k === 'som') {
      // Guardado para quando o jogo tiver som de combate (decisão do dono, 06/10: sons depois).
      if (!ehObjeto(v)) { erros.push(`${nome}.som: precisa ser um objeto.`); continue; }
      saida.som = { arquivo: String(v.arquivo ?? '').slice(0, 200), volume: Math.min(1, Math.max(0, Number(v.volume ?? 1))), pitch: Math.min(3, Math.max(0.25, Number(v.pitch ?? 1))), atraso: Math.min(5000, Math.max(0, Number(v.atraso ?? 0))), loop: !!v.loop };
    } else erros.push(`${nome}: o campo "${k}" não existe.`);
  }
  return { parte: saida, erros };
}

/** Valida o override inteiro e devolve a versão LIMPA. `{ ok, erros, avisos, override }`. */
export function validar(ov, { skillsExistentes = null } = {}) {
  const erros = [];
  const avisos = [];
  if (!ehObjeto(ov)) return { ok: false, erros: ['O override precisa ser um objeto { assets, presets, skills }.'], avisos };
  for (const k of Object.keys(ov)) if (!['assets', 'presets', 'skills', '_nota'].includes(k)) erros.push(`O campo "${k}" não existe (permitidos: assets, presets, skills).`);
  const assets = {};
  for (const [id, a] of Object.entries(ov.assets ?? {})) {
    if (!/^[\w-]{1,60}$/.test(id) || id.startsWith('fabrica-')) { erros.push(`asset "${id}": id só com letras, números, _ e - (e sem começar por "fabrica-": esses são os de fábrica).`); continue; }
    if (!ehObjeto(a) || !a.arquivo || !existsSync(join(PASTA_DOS_ASSETS, a.arquivo))) { erros.push(`asset "${id}": o arquivo ${a?.arquivo ?? '(sem nome)'} não existe em gamedata/overrides/efeitos-assets.`); continue; }
    const n = (v, min, max, pad) => Math.min(max, Math.max(min, Math.round(Number(v ?? pad)) || pad));
    const colunas = n(a.colunas, 1, 64, 1);
    const linhas = n(a.linhas, 1, 64, 1);
    assets[id] = {
      nome: String(a.nome ?? id).slice(0, 80), categoria: CATEGORIAS.includes(a.categoria) ? a.categoria : 'Other', arquivo: String(a.arquivo),
      colunas, linhas, fps: n(a.fps, 1, 60, 12), inicio: n(a.inicio, 0, colunas * linhas - 1, 0), fim: n(a.fim, 0, colunas * linhas - 1, colunas * linhas - 1),
      loop: !!a.loop, pingpong: !!a.pingpong, reverso: !!a.reverso,
    };
  }
  const todosOsAssets = { ...ASSETS_DE_FABRICA, ...assets };
  const limparVisual = (onde, v) => {
    const saida = {};
    if (!ehObjeto(v)) { erros.push(`${onde}: o visual precisa ser um objeto.`); return saida; }
    for (const [p, parte] of Object.entries(v)) {
      if (!PARTES.includes(p)) { erros.push(`${onde}: a parte "${p}" não existe (${PARTES.join(', ')}).`); continue; }
      const r = limparParte(`${onde}.${p}`, parte, todosOsAssets);
      erros.push(...r.erros);
      if (r.parte) saida[p] = r.parte;
    }
    return saida;
  };
  const presets = {};
  for (const [id, pr] of Object.entries(ov.presets ?? {})) {
    if (id.startsWith('fabrica:')) { erros.push(`preset "${id}": os de fábrica não se editam (duplique).`); continue; }
    if (!/^[\w-]{1,60}$/.test(id)) { erros.push(`preset "${id}": id só com letras, números, _ e -.`); continue; }
    if (!ehObjeto(pr)) { erros.push(`preset "${id}": precisa ser um objeto.`); continue; }
    presets[id] = { nome: String(pr.nome ?? id).slice(0, 80), visual: limparVisual(`preset ${id}`, pr.visual ?? {}) };
  }
  const skills = {};
  for (const [id, s] of Object.entries(ov.skills ?? {})) {
    if (skillsExistentes && !skillsExistentes.has(id)) avisos.push(`skill "${id}": não existe no catálogo deste servidor (fica guardada).`);
    if (!ehObjeto(s)) { erros.push(`skill "${id}": precisa ser um objeto { preset, override }.`); continue; }
    if (s.preset && !presets[s.preset] && !PRESETS_DE_FABRICA[s.preset]) { erros.push(`skill "${id}": o preset "${s.preset}" não existe.`); continue; }
    const override = s.override ? limparVisual(`skill ${id}`, s.override) : {};
    if (!s.preset && !Object.keys(override).length && !s.semEstilo) continue; // nada configurado: some do arquivo
    skills[id] = { ...(s.preset ? { preset: s.preset } : {}), ...(Object.keys(override).length ? { override } : {}), ...(s.semEstilo ? { semEstilo: true } : {}) };
  }
  return { ok: !erros.length, erros, avisos, override: { assets, presets, skills } };
}
