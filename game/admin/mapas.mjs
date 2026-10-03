// Mapas customizados feitos no /editor. Funções puras — quem fala HTTP é
// `game/backend/index.mjs`; este arquivo não conhece requisição nem resposta.
//
// Mesmo FORMATO que uma hunt real capturada usa
// (`game/gamedata/hunts/<id>-map.json`) — `cacadas.mjs::mapaRealCapturado`
// já sabe carregar esse arquivo, então salvar aqui já deixa a hunt jogável
// na hora, sem tocar em mais nada. Os SPAWNS moram no próprio arquivo, no
// bloco `spawns` (formato e validação em `systems/mapa/spawns.mjs` — o mesmo
// que o jogo lê para montar a instância). O editor antigo ainda manda
// `posicoes` (um bicho por ponto): viram spawns de quantidade 1.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CITY_MAP, CATALOGO } from '../systems/dados.mjs';
import { validar, normalizar } from '../systems/mapa/spawns.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Mobs from '../systems/mobs/atributos.mjs';
import * as Poderes from '../systems/poderes.mjs';
import { montarMob } from '../systems/combate/simulador-mob.mjs';

const RAIZ_HUNTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'hunts');
const ID_VALIDO = /^[a-z0-9-]{3,40}$/;

const caminhoDe = (id) => join(RAIZ_HUNTS, `${id}-map.json`);

/** Lista de ids salvos (arquivo existe em `gamedata/hunts/`, real ou custom — não distinguimos aqui). */
export function listar() {
  return readdirSync(RAIZ_HUNTS)
    .filter((nome) => nome.endsWith('-map.json'))
    .map((nome) => nome.slice(0, -'-map.json'.length));
}

export function carregar(id) {
  if (!ID_VALIDO.test(id) || !existsSync(caminhoDe(id))) return null;
  return JSON.parse(readFileSync(caminhoDe(id), 'utf8'));
}

function erroDeValidacao(dados) {
  if (!dados?.id || !ID_VALIDO.test(dados.id)) return 'Id inválido — só letras minúsculas, números e hífen.';
  if (!Number.isInteger(dados.width) || dados.width < 5 || dados.width > 300) return 'Largura inválida (5 a 300).';
  if (!Number.isInteger(dados.height) || dados.height < 5 || dados.height > 300) return 'Altura inválida (5 a 300).';
  const n = dados.width * dados.height;
  if (!Array.isArray(dados.blocked) || dados.blocked.length !== n) return 'Grade de bloqueio não bate com o tamanho.';
  if (!Array.isArray(dados.stacks) || dados.stacks.length !== n) return 'Grade de chão não bate com o tamanho.';
  const erros = validar(spawnsDoPedido(dados), { largura: dados.width, altura: dados.height });
  return erros[0] ?? null;
}

/**
 * `POST /api/mapas` — recebe só o que o editor pintou (`id`, `width`,
 * `height`, `blocked`, `stacks`, `posicoes`); o resto do formato real
 * (`atlas`/`palette`/`cell`) é sempre o da cidade — a mesma reutilização
 * de sprite real que `cacadas.mjs::construirMapa` já faz pro placeholder
 * de hunt, só que agora o dono escolhe onde cada índice vai.
 */
export function salvar(dados) {
  // Mapa REAL (o capturado, com atlas próprio e andares): o editor só troca os SPAWNS dele.
  // Gravar a grade do editor por cima apagaria o mapa — era o que acontecia antes.
  const atual = dados?.id && ID_VALIDO.test(dados.id) ? carregar(dados.id) : null;
  if (dados?.soSpawns || (atual && ehMapaReal(atual))) return salvarSpawns(dados);
  const erro = erroDeValidacao(dados);
  if (erro) return { ok: false, erro };

  const completo = {
    width: dados.width,
    height: dados.height,
    cell: CITY_MAP.cell,
    atlas: CITY_MAP.atlas,
    palette: CITY_MAP.palette,
    z: 7,
    levels: [7],
    floors: { 7: { stacks: dados.stacks } },
    fundos: {},
    stacks: dados.stacks,
    blocked: dados.blocked,
    opaque: dados.blocked,
    avoid: dados.blocked,
    custom: true,
    spawns: spawnsDoPedido(dados).map((s, i) => normalizar(s, 7, i)),
  };
  writeFileSync(caminhoDe(dados.id), JSON.stringify(completo), 'utf8');
  return { ok: true };
}

/**
 * Mapa real = não foi pintado aqui: atlas próprio (não o da cidade) ou mais de
 * um andar. O editor desenha com as sprites dele, mas não mexe no chão.
 */
export const ehMapaReal = (mapa) => !!mapa && (mapa.atlas !== CITY_MAP.atlas || (mapa.levels?.length ?? 1) > 1);

/**
 * Valida os spawns SEM gravar (a validação ao vivo da aba Mapas): a mesma régua do salvar. Devolve `{ ok, erros: [texto] }` — TODOS os erros,
 * não só o primeiro (o editor lista quais spawns estão errados).
 */
export function validarSpawns({ spawns, width, height }) {
  if (!Array.isArray(spawns)) return { ok: false, erros: ['Sem spawns no pedido.'] };
  if (!Number.isInteger(width) || !Number.isInteger(height)) return { ok: false, erros: ['Largura e altura são obrigatórias.'] };
  const erros = validar(spawns, { largura: width, altura: height });
  return { ok: erros.length === 0, erros };
}

/** Grava SÓ o bloco `spawns` de um mapa que já existe (o resto do arquivo fica como está). */
export function salvarSpawns(dados) {
  const atual = dados?.id && ID_VALIDO.test(dados.id) ? carregar(dados.id) : null;
  if (!atual) return { ok: false, erro: 'Mapa não encontrado para gravar os spawns.' };
  if (!Array.isArray(dados.spawns)) return { ok: false, erro: 'Sem spawns no pedido.' };
  const erros = validar(dados.spawns, { largura: atual.width, altura: atual.height });
  if (erros.length) return { ok: false, erro: erros[0] };
  const spawns = dados.spawns.map((s, i) => normalizar(s, atual.z ?? 7, i));
  try {
    writeFileSync(caminhoDe(dados.id), JSON.stringify({ ...atual, spawns }), 'utf8');
  } catch (e) {
    return { ok: false, erro: `Não deu para gravar (${e.code ?? e.message}) — o editor grava no servidor de desenvolvimento.` };
  }
  return { ok: true, soSpawns: true };
}

/** Os spawns do pedido: `spawns` (formato do mapa) ou, do editor antigo, `posicoes` (um bicho por ponto). */
function spawnsDoPedido(dados) {
  if (Array.isArray(dados.spawns)) return dados.spawns;
  return (dados.posicoes ?? []).map((p, i) => ({
    id: `s${i + 1}`, x: p.x, y: p.y, raio: 0, quantidade: 1, criaturas: [{ key: p.key, peso: 1 }],
    ...(p.raridade ? { raridade: p.raridade } : {}),
    ...(Array.isArray(p.modificadores) && p.modificadores.length ? { modificadores: p.modificadores } : {}),
  }));
}

/** Índices de paleta reais e seguros pro editor oferecer — ver `cacadas.mjs` linhas 42-67. */
export const PALETA_DO_EDITOR = [40, 579, 571, 569, 555, 713, 718, 554];

/** Bicho + nome, pro seletor de spawn — nunca um monstro inventado. */
export function bestiarioParaEditor() {
  // `look`/`colors` para o editor desenhar a criatura com a sprite do jogo; `boss` e `class` para a lista.
  return Object.entries(CATALOGO.bestiary).map(([key, b]) => ({ key, name: b.name, hp: b.hp, look: b.look, colors: b.colors, boss: !!b.boss, classe: b.class ?? null }));
}

/** As criaturas de cada hunt do catálogo (o editor lista primeiro as do mapa aberto). */
export function criaturasPorHunt() {
  const r = {};
  for (const h of CATALOGO.hunts ?? []) if (h.creatures?.length) r[h.id] = h.creatures.map((c) => c.key).filter((k) => CATALOGO.bestiary[k]);
  return r;
}

/** O atlas e a paleta da cidade: o chão de um mapa NOVO do editor (os índices do pincel são desta paleta). */
export const cidadeParaEditor = () => ({ atlas: CITY_MAP.atlas, cell: CITY_MAP.cell, palette: CITY_MAP.palette });

/** As raridades e os modificadores que o editor oferece por spawn (dados de `gamedata/mobs/`). */
export const raridadesParaEditor = () => Raridade.opcoesParaEditor();

/**
 * O detalhamento de um monstro para o editor (`GET /api/mapas/atributos-do-mob`): os atributos finais com a ORIGEM de cada parcela, os ataques
 * que ele tem e os erros e avisos das regras de combinação. `level`: o do mob (a fase); a raridade soma o `levelExtra` dela.
 */
export function atributosDoMob({ key, level = 100, raridade = 'normal', modificadores = [] } = {}) {
  if (!CATALOGO.bestiary?.[key]) return { ok: false, erro: 'Criatura desconhecida.' };
  const nivel = Math.max(1, Math.min(2000, Math.round(Number(level) || 100)));
  const spawn = { key, raridade, modificadores };
  const { raridade: r, modificadores: mods } = Raridade.doSpawn(spawn);
  const m = montarMob({ key, raridade: r, modificadores: mods });
  return {
    ok: true,
    nome: m.name,
    raridade: r,
    modificadores: mods,
    level: nivel + (m.levelExtra ?? 0),
    atributos: Mobs.atributosFinais(m, nivel + (m.levelExtra ?? 0)),
    ataques: Poderes.ataquesParaFicha(key),
    erros: Raridade.errosDoSpawn(spawn),
    avisos: Raridade.avisosDoSpawn(spawn),
  };
}
