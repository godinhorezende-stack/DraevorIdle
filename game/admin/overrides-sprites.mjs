// O EDITOR DE SPRITES por overrides: monstros, outfits e montarias usam o MESMO formato de folha (`engine/sprite-folha.mjs`: uma imagem por `look` +
// o cadastro de quadros em `gamedata/outfits.json`). O original NUNCA é editado: a versão editada vai para `gamedata/overrides/sprites/<look>.png` e o
// cadastro de quadros dela (quantidade de quadros, tempos da animação, deslocamento) para `gamedata/overrides/sprites.json`. O cliente do jogo lê esse
// arquivo ao carregar (`frontend/client/src/sprites.mjs`) e, para os looks que têm override ATIVO, usa a imagem e o cadastro novos. Mesmo fluxo dos
// outros editores: propor (valida, sem gravar) → salvar (arquivo + versão anterior) → publicar (commit + deploy). Reverter apaga a entrada e a imagem.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as O from '../systems/overrides.mjs';
import { CATALOGO, MONTARIAS_REAIS } from '../systems/dados.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';
import { decodificarPng } from '../engine/png-minimo.mjs';
import { validarMeta, validarPixels, estruturaDe, LIMITES } from '../engine/sprite-folha.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
export const CAMINHOS = {
  arquivo: join(O.PASTA, 'sprites.json'),
  versoes: join(O.PASTA, '_versoes', 'sprites'),
  pasta: join(O.PASTA, 'sprites'),
  historico: join(O.PASTA, '_versoes', 'sprites-png'),
};
const NOTA = 'Overrides de sprites: a imagem editada de cada look fica em overrides/sprites/<look>.png e o cadastro de quadros dela aqui. O original (outfits.json + sprites/outfits) nunca é alterado. Editado em /editor/conteudo.';
const COMO_PUBLICAR = 'A imagem e o cadastro foram gravados neste servidor (gamedata/overrides/sprites.json e gamedata/overrides/sprites/<look>.png). O jogo carrega no cliente: faça commit e publique pelo deploy. Nada muda na produção antes disso.';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true, sprites: {} }) });
const dados = () => { const d = arq().ler(); return { ...d, ativo: d.ativo !== false, sprites: d.sprites ?? {} }; };
const gravar = (d) => arq().gravar({ _nota: NOTA, ativo: d.ativo, sprites: d.sprites });
const caminhoDoPng = (look) => join(CAMINHOS.pasta, `${look}.png`);

// ---------- o original (do disco, nunca o objeto do jogo) ----------
let META = null;
const todosOsMetas = () => (META ??= JSON.parse(readFileSync(join(RAIZ, 'outfits.json'), 'utf8')));
export const metaOriginal = (look) => todosOsMetas()[String(look)] ?? null;
export const pngOriginal = (look) => { const c = join(RAIZ, 'sprites', 'outfits', `${look}.png`); return existsSync(c) ? readFileSync(c) : null; };
const LOOK = /^\d{1,6}$/;

/** Só as chaves que o jogo lê (o resto que vier no meta é descartado). */
export function normalizarMeta(meta) {
  const grupo = (g) => ({ row: g.row, frames: g.frames, layers: g.layers, dirs: g.dirs, addons: g.addons, depth: g.depth, animation: g.animation ? { loop: g.animation.loop, start: g.animation.start ?? 0, random: !!g.animation.random, durations: g.animation.durations } : null });
  return { w: meta.w, h: meta.h, cw: meta.cw, ch: meta.ch, shift: meta.shift, groups: (meta.groups ?? []).map(grupo) };
}

// ---------- quem usa o look ----------
export function usosDoLook(look) {
  const l = String(look);
  const monstros = Object.entries(CATALOGO.bestiary ?? {}).filter(([, m]) => String(m.look) === l).map(([key, m]) => ({ key, nome: m.name ?? key }));
  const montarias = (MONTARIAS_REAIS.mounts ?? []).filter((m) => String(m.look) === l).map((m) => ({ id: m.id, nome: m.name }));
  const outfits = (MONTARIAS_REAIS.outfits ?? []).filter((o) => String(o.look) === l).map((o) => ({ look: o.look, nome: o.name }));
  return { monstros, montarias, outfits, total: monstros.length + montarias.length + outfits.length };
}
/** A categoria principal do look (para a tela escolher os controles): montaria, outfit de personagem ou monstro. */
export const categoriaDoLook = (look) => {
  const u = usosDoLook(look);
  if (u.montarias.length) return 'montarias';
  if (u.outfits.length) return 'outfits';
  if (u.monstros.length) return 'monstros';
  return 'outros';
};

// ---------- consulta ----------
export function listar() {
  const d = dados();
  const itens = Object.entries(d.sprites).map(([look, e]) => ({ look, categoria: categoriaDoLook(look), ativo: e.ativo !== false, hash: e.hash, atualizadoEm: e.atualizadoEm ?? null, usos: usosDoLook(look).total }));
  return { ativo: d.ativo, total: itens.length, itens, revisao: revisaoDe(CAMINHOS.arquivo) };
}

export function obter(look) {
  const l = String(look);
  const original = LOOK.test(l) ? metaOriginal(l) : null;
  if (!original) return null;
  const d = dados();
  const ov = d.sprites[l] ?? null;
  return { look: l, categoria: categoriaDoLook(l), usos: usosDoLook(l), original, override: ov, globalAtivo: d.ativo, revisao: revisaoDe(CAMINHOS.arquivo), limites: LIMITES, versoes: versoesDoLook(l) };
}

// ---------- validação ----------
/** Os erros que o ORIGINAL já tem (dado importado) viram avisos: o dono não é culpado por eles e não pode ficar sem salvar por causa deles. */
function rebaixarOsDoOriginal(resultado, doOriginal) {
  const antigos = new Set(doOriginal.erros);
  const erros = [];
  const avisos = [...resultado.avisos];
  for (const e of resultado.erros) (antigos.has(e) ? avisos.push(`(já existe no original) ${e}`) : erros.push(e));
  return { erros, avisos };
}

/** Analisa uma proposta `{ meta?, png (base64) }` para o `look`, sem gravar. Devolve `{ erros, avisos, estatisticas, meta, buffer, bitmap }`. */
export function analisar(look, proposta) {
  const l = String(look);
  const erros = [];
  const original = LOOK.test(l) ? metaOriginal(l) : null;
  if (!original) return { erros: [`O look "${look}" não existe nos desenhos do jogo (outfits.json). Criar um look novo ainda não é suportado pelo editor.`], avisos: [], estatisticas: null };
  const base64 = typeof proposta?.png === 'string' ? proposta.png.replace(/^data:image\/png;base64,/, '') : '';
  if (!base64) return { erros: ['Falta a imagem (PNG em base64).'], avisos: [], estatisticas: null };
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > LIMITES.bytes) return { erros: [`A imagem tem ${(buffer.length / 1048576).toFixed(1)} MB; o limite é ${LIMITES.bytes / 1048576} MB. Reduza o tamanho do quadro ou a quantidade de quadros.`], avisos: [], estatisticas: null };
  let bitmap;
  try { bitmap = decodificarPng(buffer); } catch (e) { return { erros: [e.message], avisos: [], estatisticas: null }; }
  if (bitmap.w > LIMITES.lado || bitmap.h > LIMITES.lado) return { erros: [`A imagem tem ${bitmap.w}×${bitmap.h}; o limite é ${LIMITES.lado}×${LIMITES.lado}.`], avisos: [], estatisticas: null };
  const meta = normalizarMeta(proposta.meta ?? original);
  const orig = pngOriginal(l);
  const origBitmap = orig ? decodificarPng(orig) : null;
  const refOriginal = origBitmap ? { folha: origBitmap, meta: original } : null;
  const m = rebaixarOsDoOriginal(validarMeta(meta, original), validarMeta(original, original));
  if (m.erros.length) return { erros: m.erros, avisos: m.avisos, estatisticas: null, meta };
  const doOriginal = origBitmap ? validarPixels(origBitmap, original, refOriginal) : { erros: [], avisos: [] };
  const pixels = validarPixels(bitmap, meta, refOriginal);
  const p = rebaixarOsDoOriginal(pixels, doOriginal);
  erros.push(...p.erros);
  return { erros, avisos: [...m.avisos, ...p.avisos], estatisticas: pixels.estatisticas, meta, buffer, bitmap };
}

const camposDoMetaQueMudaram = (a, b) => {
  const lista = [];
  for (const c of ['cw', 'ch']) if (a[c] !== b[c]) lista.push(`${c === 'cw' ? 'largura' : 'altura'} do quadro: ${a[c]} → ${b[c]}`);
  if (JSON.stringify(a.shift) !== JSON.stringify(b.shift)) lista.push(`deslocamento: ${a.shift} → ${b.shift}`);
  b.groups.forEach((g, i) => {
    const o = a.groups[i];
    if (!o) { lista.push(`grupo ${i}: novo`); return; }
    if (o.frames !== g.frames) lista.push(`grupo ${i === 0 ? 'parado' : 'caminhada'}: ${o.frames} → ${g.frames} quadros`);
    if (JSON.stringify(o.animation) !== JSON.stringify(g.animation)) lista.push(`grupo ${i === 0 ? 'parado' : 'caminhada'}: tempos/loop da animação`);
  });
  return lista;
};

/** Valida e mostra o que MUDARIA (sem gravar): erros, avisos, o que muda no cadastro, os arquivos que serão gravados e quem usa o look. */
export function propor(look, proposta) {
  const r = analisar(look, proposta);
  const l = String(look);
  const original = LOOK.test(l) ? metaOriginal(l) : null;
  const d = dados();
  const atual = d.sprites[l] ?? null;
  const base = { ok: r.erros.length === 0, erros: r.erros, avisos: r.avisos, estatisticas: r.estatisticas ?? null };
  if (!original || !r.meta) return base;
  return {
    ...base,
    mudancasNoCadastro: camposDoMetaQueMudaram(original, r.meta),
    arquivosAfetados: [`game/gamedata/overrides/sprites/${l}.png`, 'game/gamedata/overrides/sprites.json'],
    jaTinhaOverride: !!atual,
    bytes: r.buffer?.length ?? null,
    dimensoes: r.bitmap ? { w: r.bitmap.w, h: r.bitmap.h } : null,
    usos: usosDoLook(l),
    comoPublicar: COMO_PUBLICAR,
  };
}

// ---------- gravação ----------
function guardarVersao(look, d) {
  const atual = d.sprites[look];
  if (!atual || !existsSync(caminhoDoPng(look))) return;
  const pasta = join(CAMINHOS.historico, look);
  mkdirSync(pasta, { recursive: true });
  const n = (readdirSync(pasta).filter((f) => /^\d+\.png$/.test(f)).map((f) => Number(f.slice(0, -4))).sort((a, b) => b - a)[0] ?? 0) + 1;
  writeFileSync(join(pasta, `${n}.png`), readFileSync(caminhoDoPng(look)));
  writeFileSync(join(pasta, `${n}.json`), `${JSON.stringify(atual, null, 2)}\n`);
}
/** As versões anteriores guardadas da imagem deste look (mais nova primeiro). */
export function versoesDoLook(look) {
  const pasta = join(CAMINHOS.historico, String(look));
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter((f) => /^\d+\.json$/.test(f)).map((f) => Number(f.slice(0, -5))).sort((a, b) => b - a).map((n) => {
    const e = JSON.parse(readFileSync(join(pasta, `${n}.json`), 'utf8'));
    return { versao: n, hash: e.hash, atualizadoEm: e.atualizadoEm ?? null, quadros: e.meta?.groups?.map((g) => g.frames) ?? [] };
  });
}

export function salvar(look, proposta, revisao, { agora = Date.now() } = {}) {
  const l = String(look);
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = analisar(l, proposta);
  if (r.erros.length) return { ok: false, erros: r.erros, avisos: r.avisos };
  const d = dados();
  guardarVersao(l, d);
  mkdirSync(CAMINHOS.pasta, { recursive: true });
  writeFileSync(caminhoDoPng(l), r.buffer);
  const hash = createHash('sha1').update(r.buffer).digest('hex').slice(0, 12);
  d.sprites[l] = { ativo: true, hash, bytes: r.buffer.length, atualizadoEm: agora, ...(typeof proposta.nota === 'string' && proposta.nota.trim() ? { nota: proposta.nota.trim().slice(0, 200) } : {}), meta: r.meta };
  gravar(d);
  return { ok: true, avisos: r.avisos, hash, override: d.sprites[l], revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}

/** Apaga o override (a imagem e a entrada): o jogo volta ao original. A versão apagada fica no histórico. */
export function reverter(look, revisao) {
  const l = String(look);
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const d = dados();
  if (!d.sprites[l]) return { ok: false, erros: [`O look ${l} não tem override.`] };
  guardarVersao(l, d);
  delete d.sprites[l];
  if (existsSync(caminhoDoPng(l))) unlinkSync(caminhoDoPng(l));
  gravar(d);
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}

/** Liga/desliga UM override sem apagar nada (desligado, o jogo usa o original). */
export function definirAtivo(look, ativo, revisao) {
  const l = String(look);
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const d = dados();
  if (!d.sprites[l]) return { ok: false, erros: [`O look ${l} não tem override.`] };
  d.sprites[l].ativo = !!ativo;
  gravar(d);
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}

/** Volta uma versão anterior da imagem (a atual vai para o histórico: restaurar é uma gravação nova). */
export function restaurarVersao(look, n, revisao) {
  const l = String(look);
  const pasta = join(CAMINHOS.historico, l);
  const png = join(pasta, `${Number(n)}.png`);
  if (!Number.isInteger(Number(n)) || !existsSync(png)) return { ok: false, erros: ['Versão não encontrada.'] };
  const e = JSON.parse(readFileSync(join(pasta, `${Number(n)}.json`), 'utf8'));
  return salvar(l, { meta: e.meta, png: readFileSync(png).toString('base64'), nota: e.nota }, revisao);
}

/** O interruptor geral: desligado, o jogo ignora todos os overrides de sprites. */
export function definirAtivoGeral(ativo, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const d = dados();
  d.ativo = !!ativo;
  gravar(d);
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export { estruturaDe };
