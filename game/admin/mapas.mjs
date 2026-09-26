// Mapas customizados feitos no /editor. Funções puras — quem fala HTTP é
// `server/index.mjs`; este arquivo não conhece requisição nem resposta.
//
// Mesmo FORMATO que uma hunt real capturada usa
// (`assets_raw/gamedata/hunts/<id>-map.json`) — `cacadas.mjs::mapaRealCapturado`
// já sabe carregar esse arquivo, então salvar aqui já deixa a hunt jogável
// na hora, sem tocar em mais nada. `posicoes` (spawn de monstro) mora no
// próprio arquivo — sem entrada no `catalog.hunts` real, não tem outro
// lugar pra guardar isso.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CITY_MAP, CATALOGO } from '../systems/dados.mjs';

const RAIZ_HUNTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets_raw', 'gamedata', 'hunts');
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
  const spawns = dados.posicoes ?? [];
  if (!spawns.length) return 'Marque ao menos um spawn de monstro real antes de salvar.';
  for (const s of spawns) {
    if (!CATALOGO.bestiary[s.key]) return `"${s.key}" não é um monstro do bestiary real.`;
    if (!Number.isInteger(s.x) || !Number.isInteger(s.y)) return 'Spawn com posição inválida.';
    if (s.x < 0 || s.y < 0 || s.x >= dados.width || s.y >= dados.height) return 'Spawn fora da grade.';
  }
  return null;
}

/**
 * `POST /api/mapas` — recebe só o que o editor pintou (`id`, `width`,
 * `height`, `blocked`, `stacks`, `posicoes`); o resto do formato real
 * (`atlas`/`palette`/`cell`) é sempre o da cidade — a mesma reutilização
 * de sprite real que `cacadas.mjs::construirMapa` já faz pro placeholder
 * de hunt, só que agora o dono escolhe onde cada índice vai.
 */
export function salvar(dados) {
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
    posicoes: dados.posicoes,
  };
  writeFileSync(caminhoDe(dados.id), JSON.stringify(completo), 'utf8');
  return { ok: true };
}

/** Índices de paleta reais e seguros pro editor oferecer — ver `cacadas.mjs` linhas 42-67. */
export const PALETA_DO_EDITOR = [40, 579, 571, 569, 555, 713, 718, 554];

/** Bicho + nome, pro seletor de spawn — nunca um monstro inventado. */
export function bestiarioParaEditor() {
  return Object.entries(CATALOGO.bestiary).map(([key, b]) => ({ key, name: b.name, hp: b.hp }));
}
