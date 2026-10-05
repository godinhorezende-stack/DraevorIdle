// O EDITOR DE SPRITE DE ITEM por override: troca a figura de um item EXISTENTE (ou criado no editor) por um PNG, sem tocar nos atlas originais (`gamedata/sprites/items/*`, `item-sprites.json`).
// Cadastro em `gamedata/overrides/itens-sprites.json` (`{ ativo, itens: { id: { w, h, frames, hash } } }`: `w`×`h` é UM quadro; `frames` quadros lado a lado na imagem) e a imagem em
// `gamedata/overrides/sprites/itens/<id>.png`. O cliente aplica por cima do índice (`frontend/client/src/sprites.mjs`). Um item NOVO usa o sprite do item-base até ganhar o seu aqui.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as O from '../systems/overrides.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { decodificarPng } from '../engine/png-minimo.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';
import * as Itens from './overrides-itens.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
export const CAMINHOS = { arquivo: join(O.PASTA, 'itens-sprites.json'), versoes: join(O.PASTA, '_versoes', 'itens-sprites'), pasta: join(O.PASTA, 'sprites', 'itens') };
export const LIMITES = { quadroMax: 128, quadroMin: 8, quadrosMax: 32, bytesMax: 600_000 };
const NOTA = 'Overrides de sprites de itens: a imagem de cada item fica em overrides/sprites/itens/<id>.png e o cadastro dela aqui. O atlas original nunca é editado. Editado em /editor/conteudo (Itens › Sprite).';
const COMO_PUBLICAR = 'A imagem e o cadastro foram gravados neste servidor. O jogo carrega os sprites ao abrir a página: recarregue (F5) para ver. Para valer na produção: commit dos arquivos de overrides e deploy.';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true, itens: {} }) });
export const lerDados = () => { const d = arq().ler(); return { ...d, ativo: d.ativo !== false, itens: d.itens ?? {} }; };
const gravar = (d) => arq().gravar({ _nota: NOTA, ativo: d.ativo, itens: Object.fromEntries(Object.entries(d.itens).sort(([a], [b]) => Number(a) - Number(b))) });
const caminhoDoPng = (id) => join(CAMINHOS.pasta, `${id}.png`);
const indiceOriginal = () => JSON.parse(readFileSync(join(RAIZ, 'item-sprites.json'), 'utf8'));
let INDICE = null;
const entradaOriginal = (id) => (INDICE ??= indiceOriginal())[id] ?? null;
const baseDoNovo0 = (id) => (Itens.ehItemNovo(id) ? Itens.lerDados().itens[id]?.base ?? null : null);
const existeItem = (id) => !!Itens.originalDe(id) || !!ITEM_CATALOG[id];

/** O estado do sprite de um item: o original (índice do atlas), o override e a URL (com o hash, para o navegador não servir a versão velha). */
export function obter(id) {
  if (!existeItem(id)) return null;
  const d = lerDados(); const ov = d.itens[id] ?? null; const orig = entradaOriginal(id) ?? (baseDoNovo0(id) != null ? entradaOriginal(baseDoNovo0(id)) : null);
  const baseDoNovo = Itens.ehItemNovo(id) ? Itens.lerDados().itens[id]?.base ?? null : null;
  return {
    id: String(id), original: orig ? { w: orig.w, h: orig.h, quadros: orig.f ?? 1, tiras: orig.n ?? 1 } : null, herdaDoItemBase: baseDoNovo ?? null,
    override: ov, url: ov ? `/gamedata/overrides/sprites/itens/${id}.png?v=${ov.hash}` : null, ativoGlobal: d.ativo, revisao: revisaoDe(CAMINHOS.arquivo), limites: LIMITES, comoPublicar: COMO_PUBLICAR,
  };
}

/** Valida uma proposta `{ png (base64), frames }` sem gravar: `{ ok, erros, avisos, quadro: {w,h}, frames, hash, buffer }`. */
export function analisar(id, proposta) {
  const erros = []; const avisos = [];
  if (!existeItem(id)) return { ok: false, erros: [`O item ${id} não existe.`], avisos };
  const base64 = typeof proposta?.png === 'string' ? proposta.png.replace(/^data:image\/png;base64,/, '') : '';
  if (!base64) return { ok: false, erros: ['Falta a imagem (PNG em base64).'], avisos };
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > LIMITES.bytesMax) return { ok: false, erros: [`A imagem passa de ${Math.round(LIMITES.bytesMax / 1000)} KB.`], avisos };
  let bitmap;
  try { bitmap = decodificarPng(buffer); } catch (e) { return { ok: false, erros: [e.message], avisos }; }
  const frames = proposta.frames === undefined ? 1 : Number(proposta.frames);
  if (!Number.isInteger(frames) || frames < 1 || frames > LIMITES.quadrosMax) erros.push(`frames precisa ser um inteiro de 1 a ${LIMITES.quadrosMax}.`);
  else if (bitmap.w % frames !== 0) erros.push(`A largura da imagem (${bitmap.w}px) precisa ser divisível por ${frames} quadro(s).`);
  const w = frames >= 1 ? bitmap.w / frames : bitmap.w; const h = bitmap.h;
  if (!erros.length && (w < LIMITES.quadroMin || h < LIMITES.quadroMin || w > LIMITES.quadroMax || h > LIMITES.quadroMax)) erros.push(`Cada quadro precisa ter de ${LIMITES.quadroMin} a ${LIMITES.quadroMax}px (veio ${w}×${h}).`);
  const orig = entradaOriginal(id);
  if (!erros.length && orig && (orig.w !== w || orig.h !== h)) avisos.push(`O quadro original é ${orig.w}×${orig.h}px; este é ${w}×${h}px (o jogo desenha pelo tamanho da imagem, mas confira o alinhamento no mapa e nos ícones).`);
  const vazio = bitmap.data && !bitmap.data.some((v, i) => i % 4 === 3 && v > 0);
  if (!erros.length && vazio) avisos.push('A imagem é totalmente transparente.');
  return { ok: !erros.length, erros, avisos, quadro: { w, h }, frames, hash: createHash('sha1').update(buffer).digest('hex').slice(0, 12), buffer };
}

export function salvar(id, proposta, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const a = analisar(id, proposta);
  if (!a.ok) return { ok: false, erros: a.erros, avisos: a.avisos };
  mkdirSync(CAMINHOS.pasta, { recursive: true });
  writeFileSync(caminhoDoPng(id), a.buffer);
  const d = lerDados();
  d.itens[id] = { w: a.quadro.w, h: a.quadro.h, frames: a.frames, hash: a.hash };
  gravar(d);
  return { ok: true, avisos: a.avisos, override: d.itens[id], url: `/gamedata/overrides/sprites/itens/${id}.png?v=${a.hash}`, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}

/** Remove o override do item (volta ao sprite original / do item-base). */
export function reverter(id, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const d = lerDados();
  if (!d.itens[id]) return { ok: false, erros: ['Este item não tem sprite alterado.'] };
  delete d.itens[id];
  gravar(d);
  if (existsSync(caminhoDoPng(id))) rmSync(caminhoDoPng(id));
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export const versoes = () => arq().versoes();
export const listar = () => { const d = lerDados(); return { ativo: d.ativo, itens: Object.entries(d.itens).map(([id, v]) => ({ id, ...v })) }; };

/** Para a validação central: cada entrada precisa da imagem, com o hash que o cadastro diz. */
export function validarTudo(pasta = O.PASTA) {
  const erros = []; const avisos = [];
  const arquivo = join(pasta, 'itens-sprites.json');
  if (!existsSync(arquivo)) return { erros, avisos };
  let d;
  try { d = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) { return { erros: [`overrides/itens-sprites.json: JSON inválido: ${e.message}`], avisos }; }
  for (const [id, v] of Object.entries(d.itens ?? {})) {
    const png = join(pasta, 'sprites', 'itens', `${id}.png`);
    if (!existeItem(id)) { erros.push(`sprite de item ${id}: o item não existe.`); continue; }
    if (!existsSync(png)) { erros.push(`sprite de item ${id}: falta a imagem overrides/sprites/itens/${id}.png.`); continue; }
    const h = createHash('sha1').update(readFileSync(png)).digest('hex').slice(0, 12);
    if (h !== v.hash) erros.push(`sprite de item ${id}: o hash do cadastro não bate com a imagem (${v.hash} × ${h}).`);
  }
  return { erros, avisos };
}
