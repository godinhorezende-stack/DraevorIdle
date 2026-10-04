// VERSÕES APROVADAS da Engine (etapa 3 do plano de publicação): o painel de alterações (original × atual) e o "Aprovar e gerar versão". Aprovar CONGELA um
// conjunto exato de arquivos: guarda uma cópia (snapshot) de cada um e o manifesto com o hash — editar depois NÃO muda a versão aprovada, e o que foi editado
// depois aparece como "fora da versão". Nada aqui faz commit, push ou deploy (etapas seguintes): só lê o Git (`git-local.mjs`) e grava em
// `game/database/dados/versoes/<id>/` (fora do Git). Só funciona onde a gravação está ligada (o ambiente local).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, chmodSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Git from './git-local.mjs';
import * as Validacao from './validacao.mjs';
import * as Auditoria from './auditoria.mjs';
import { diffJson, resumirDiff } from '../engine/diff-json.mjs';

const JOGO = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CAMINHOS = { pasta: process.env.ENGINE_VERSOES || join(JOGO, 'database', 'dados', 'versoes') };
export const ID_DE_VERSAO = /^v\d{4}\.\d{2}\.\d{2}-\d+$/;
const NOME_DO_MODULO = { monstros: 'Monstros', itens: 'Itens', progressao: 'Progressão e loot', conjuntos: 'Conjuntos', sprites: 'Sprites, outfits e montarias', atos: 'Acts', campanha: 'Campanha', encontros: 'Encontros e bosses', hunts: 'Hunts e mapas', 'outros-dados': 'Outros dados', codigo: 'Código do jogo', 'docs-e-testes': 'Docs e testes' };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const raizDoRepo = () => Git.raizDoRepo();
const lerDoDisco = (caminho) => { const f = join(raizDoRepo(), caminho); return existsSync(f) ? readFileSync(f) : null; };

// ------------------------------------------------------------------ painel de alterações
/** Os arquivos alterados que a Engine pode versionar, com módulo, tamanho e hash. */
export function alteracoes() {
  const lista = [];
  let ocultos = 0;
  for (const a of Git.alterados()) {
    if (!Git.caminhoPermitido(a.caminho)) { ocultos++; continue; }
    const b = a.estado === 'apagado' ? null : lerDoDisco(a.caminho);
    lista.push({ ...a, modulo: Git.moduloDe(a.caminho), bytes: b?.length ?? 0, sha256: b ? sha(b) : null, binario: /\.(png|webp|jpg|gif|ico)$/i.test(a.caminho) });
  }
  return { arquivos: lista, ocultos };
}

/** Original (HEAD) × atual de UM arquivo: JSON → diferença estruturada; imagem → tamanhos e hashes; texto → o `git diff`. */
export function diferenca(caminho) {
  if (!Git.caminhoPermitido(caminho)) return { ok: false, erros: ['Caminho não permitido.'] };
  const antes = Git.conteudoNoHead(caminho);
  const depois = lerDoDisco(caminho);
  if (!antes && !depois) return { ok: false, erros: ['Arquivo não encontrado.'] };
  const base = { ok: true, caminho, estado: !antes ? 'novo' : !depois ? 'apagado' : 'modificado' };
  if (/\.(png|webp|jpg|gif|ico)$/i.test(caminho)) return { ...base, tipo: 'binario', antes: antes ? { bytes: antes.length, sha256: sha(antes).slice(0, 16) } : null, depois: depois ? { bytes: depois.length, sha256: sha(depois).slice(0, 16) } : null };
  if (caminho.endsWith('.json')) {
    try {
      const d = diffJson(antes ? JSON.parse(antes.toString('utf8')) : undefined, depois ? JSON.parse(depois.toString('utf8')) : undefined);
      return { ...base, tipo: 'json', mudancas: d.mudancas.slice(0, 300).map((m) => ({ ...m, antes: aparar(m.antes), depois: aparar(m.depois) })), total: d.mudancas.length, cortou: d.cortou };
    } catch (e) { return { ...base, tipo: 'texto', texto: Git.diffDeTexto(caminho) ?? `(não consegui interpretar o JSON: ${e.message})` }; }
  }
  return { ...base, tipo: 'texto', texto: Git.diffDeTexto(caminho) ?? (depois ? depois.toString('utf8').split('\n').slice(0, 200).join('\n') : '') };
}
const aparar = (v) => { const t = JSON.stringify(v); return t && t.length > 400 ? `${t.slice(0, 397)}…` : v; };

/** Arquivos que só fazem sentido JUNTOS (o cadastro de sprites e as imagens dele): faltando um lado, a versão ficaria incoerente. Pura. */
export function dependenciasFaltando(escolhidos, todos) {
  const e = new Set(escolhidos);
  const falta = [];
  const sprites = todos.filter((c) => /gamedata\/overrides\/sprites(\.json|\/)/.test(c));
  if (sprites.some((c) => e.has(c))) for (const c of sprites) if (!e.has(c)) falta.push({ caminho: c, motivo: 'o cadastro de sprites e as imagens dele precisam ir juntos' });
  return falta;
}

// ------------------------------------------------------------------ changelog
/** O changelog em Markdown (pura): resumo, mudanças por módulo (de cada diff JSON) e o resultado da validação. */
export function gerarChangelog({ id, titulo, quando, por, base, itens, validacao = null, testes = null }) {
  const porModulo = Map.groupBy(itens, (i) => i.modulo);
  const l = [`# Versão ${id} — ${titulo}`, '', `Aprovada em ${new Date(quando).toISOString()}${por ? ` por ${por}` : ''}. Base: ${base?.branch ?? '?'}@${base?.head ?? '?'}.`, '', '## Resumo', `- ${itens.length} arquivo(s) em ${porModulo.size} módulo(s): ${[...porModulo.keys()].map((m) => NOME_DO_MODULO[m] ?? m).join(', ')}.`];
  for (const [m, lista] of porModulo) {
    l.push('', `## ${NOME_DO_MODULO[m] ?? m}`);
    for (const i of lista) {
      l.push(`- \`${i.caminho.replace(/^game\//, '')}\` (${i.estado})`);
      for (const linha of i.resumo ?? []) l.push(`  - ${linha}`);
    }
  }
  if (validacao) l.push('', '## Validação', `- Verificações: ${validacao.geral} (${validacao.resumo.aprovado} aprovada(s), ${validacao.resumo.aviso} com aviso, ${validacao.resumo.bloqueante} bloqueante(s)).`);
  if (testes) l.push(`- Testes: ${testes.passaram} passaram, ${testes.falharam} falharam de ${testes.total}${testes.completa ? ' (suíte completa)' : ''}.`);
  return `${l.join('\n')}\n`;
}

// ------------------------------------------------------------------ aprovar
const dirDa = (id) => join(CAMINHOS.pasta, id);
function novoId(agora) {
  const d = new Date(agora);
  const dia = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const existentes = existsSync(CAMINHOS.pasta) ? readdirSync(CAMINHOS.pasta).filter((n) => n.startsWith(`v${dia}-`)).map((n) => Number(n.split('-').pop())) : [];
  return `v${dia}-${Math.max(0, ...existentes) + 1}`;
}
const gravarManifesto = (id, m) => writeFileSync(join(dirDa(id), 'manifesto.json'), `${JSON.stringify(m, null, 2)}\n`);

/**
 * Aprova e gera a versão: congela os `caminhos` escolhidos (cópia + hash de cada um), o changelog e o resultado da validação. Recusa sem validação aprovada, sem
 * título, com arquivo fora da lista de alterações, com dependência faltando, ou se o conteúdo mudou durante a aprovação.
 */
export function aprovar({ caminhos, titulo, por = null }, { agora = Date.now(), aposCopiar = null } = {}) {
  const t = String(titulo ?? '').trim();
  if (t.length < 3 || t.length > 120) return { ok: false, erros: ['Dê um título à versão (3 a 120 caracteres).'] };
  const est = Validacao.estado();
  if (!est.aptaParaAprovar) return { ok: false, erros: ['A versão ainda não pode ser aprovada.', ...est.motivos] };
  const { arquivos } = alteracoes();
  const porCaminho = new Map(arquivos.map((a) => [a.caminho, a]));
  const escolhidos = [...new Set(caminhos ?? [])];
  if (!escolhidos.length) return { ok: false, erros: ['Escolha pelo menos um arquivo alterado.'] };
  const fora = escolhidos.filter((c) => !porCaminho.has(c));
  if (fora.length) return { ok: false, erros: [`Arquivo(s) que não estão na lista de alterações: ${fora.join(', ')}.`] };
  const falta = dependenciasFaltando(escolhidos, arquivos.map((a) => a.caminho));
  if (falta.length) return { ok: false, erros: falta.map((f) => `Falta incluir ${f.caminho}: ${f.motivo}.`) };
  const assinaturaAntes = Validacao.assinaturaDoConteudo();
  const id = novoId(agora);
  const dir = dirDa(id);
  try {
    mkdirSync(join(dir, 'arquivos'), { recursive: true });
    const itens = [];
    for (const c of escolhidos) {
      const a = porCaminho.get(c);
      let hash = null;
      let bytes = 0;
      if (a.estado !== 'apagado') {
        const b = lerDoDisco(c);
        hash = sha(b);
        bytes = b.length;
        const destino = join(dir, 'arquivos', c);
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, b);
        chmodSync(destino, 0o444);
      }
      aposCopiar?.(c);
      const d = diferenca(c);
      itens.push({ caminho: c, estado: a.estado, modulo: a.modulo, sha256: hash, bytes, resumo: d.ok && d.tipo === 'json' ? resumirDiff({ mudancas: d.mudancas, cortou: d.cortou }) : d.tipo === 'binario' ? [`imagem ${d.antes ? `${d.antes.bytes} → ` : 'nova, '}${d.depois?.bytes ?? 0} bytes`] : [] });
    }
    if (Validacao.assinaturaDoConteudo() !== assinaturaAntes) throw new Error('O conteúdo mudou durante a aprovação: nada foi gerado. Valide de novo e aprove.');
    const base = Git.estadoDoRepo();
    const validacao = est.rapida ? { geral: est.rapida.geral, resumo: est.rapida.resumo, quando: est.rapida.quando } : null;
    const testes = est.testes ? { total: est.testes.total, passaram: est.testes.passaram, falharam: est.testes.falharam, completa: est.testes.completa, quando: est.testes.quando } : null;
    const changelog = gerarChangelog({ id, titulo: t, quando: agora, por, base, itens, validacao, testes });
    const manifesto = { id, titulo: t, status: 'aprovada', criadaEm: agora, por, base: { branch: base.branch ?? null, head: base.head ?? null }, arquivos: itens, modulos: [...new Set(itens.map((i) => i.modulo))], validacao, testes, changelog };
    gravarManifesto(id, manifesto);
    writeFileSync(join(dir, 'CHANGELOG.md'), changelog);
    Auditoria.registrar({ tipo: 'versao-aprovada', quem: por, versao: id, titulo: t, arquivos: itens.length, modulos: manifesto.modulos });
    return { ok: true, versao: resumo(manifesto) };
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    return { ok: false, erros: [e.message] };
  }
}

const resumo = (m) => ({ id: m.id, titulo: m.titulo, status: m.status, criadaEm: m.criadaEm, por: m.por, base: m.base, modulos: m.modulos, arquivos: m.arquivos.length, validacao: m.validacao?.geral ?? null, integracao: m.integracao ? { commit: m.integracao.commit?.slice(0, 12) ?? null, modo: m.integracao.modo, verificadaEm: m.integracao.verificadaEm } : null, git: m.git ? { branch: m.git.branch, commit: m.git.commit?.slice(0, 12) ?? null, link: m.git.link ?? null, remoto: m.git.remoto ?? null, enviadoEm: m.git.enviadoEm ?? null, erroDeEnvio: m.git.erroDeEnvio ?? null } : null });

/** As versões, da mais nova para a mais antiga. */
export function listar() {
  if (!existsSync(CAMINHOS.pasta)) return [];
  return readdirSync(CAMINHOS.pasta).filter((n) => ID_DE_VERSAO.test(n) && existsSync(join(CAMINHOS.pasta, n, 'manifesto.json')))
    .map((n) => { try { return resumo(JSON.parse(readFileSync(join(dirDa(n), 'manifesto.json'), 'utf8'))); } catch { return null; } })
    .filter(Boolean).sort((a, b) => b.criadaEm - a.criadaEm || b.id.localeCompare(a.id));
}

/** Uma versão completa + a conferência: o snapshot está íntegro? o que foi editado DEPOIS da aprovação (e portanto não está na versão)? */
export function obter(id) {
  if (!ID_DE_VERSAO.test(String(id))) return null;
  const f = join(dirDa(id), 'manifesto.json');
  if (!existsSync(f)) return null;
  const m = JSON.parse(readFileSync(f, 'utf8'));
  const integridade = [];
  const depois = [];
  for (const a of m.arquivos) {
    if (a.estado === 'apagado') continue;
    const blob = join(dirDa(id), 'arquivos', a.caminho);
    if (!existsSync(blob)) integridade.push({ caminho: a.caminho, problema: 'cópia congelada ausente' });
    else if (sha(readFileSync(blob)) !== a.sha256) integridade.push({ caminho: a.caminho, problema: 'a cópia congelada foi adulterada (hash diferente do manifesto)' });
    const atual = raizDoRepo() ? lerDoDisco(a.caminho) : null;
    if (atual && sha(atual) !== a.sha256) depois.push({ caminho: a.caminho, problema: 'editado depois da aprovação (a versão guarda a cópia aprovada)' });
  }
  return { ...m, integra: integridade.length === 0, problemasDeIntegridade: integridade, editadosDepois: depois };
}
/** O conteúdo congelado de um arquivo da versão (Buffer) — é daqui que a etapa de Git vai montar o commit, nunca do disco atual. */
export function conteudoCongelado(id, caminho) {
  if (!ID_DE_VERSAO.test(String(id)) || !Git.caminhoPermitido(caminho)) return null;
  const blob = join(dirDa(id), 'arquivos', caminho);
  return existsSync(blob) ? readFileSync(blob) : null;
}

/** Atualiza o manifesto (status e dados do Git) — usado pela etapa de envio. Só aceita transições previstas. */
const TRANSICOES = { aprovada: ['commit-local', 'enviada', 'descartada'], 'commit-local': ['commit-local', 'enviada', 'descartada'], enviada: ['enviada', 'integrada'], integrada: ['integrada'], descartada: [] };
export function atualizarStatus(id, patch) {
  const m = obter(id);
  if (!m) throw new Error('Versão não encontrada.');
  if (patch.status && !TRANSICOES[m.status]?.includes(patch.status)) throw new Error(`Transição inválida: ${m.status} → ${patch.status}.`);
  const novo = { ...m, ...patch };
  delete novo.integra; delete novo.problemasDeIntegridade; delete novo.editadosDepois;
  gravarManifesto(id, novo);
  return novo;
}

/** Descarta uma versão ainda não enviada (`aprovada`/`commit-local` → `descartada`); o histórico fica. */
export function descartar(id, { por = null, agora = Date.now() } = {}) {
  const m = obter(id);
  if (!m) return { ok: false, erros: ['Versão não encontrada.'] };
  if (!['aprovada', 'commit-local'].includes(m.status)) return { ok: false, erros: [`Só dá para descartar uma versão "aprovada" ou com o commit só local (esta está "${m.status}").`] };
  const novo = { ...m, status: 'descartada', descartadaEm: agora, descartadaPor: por };
  delete novo.integra; delete novo.problemasDeIntegridade; delete novo.editadosDepois;
  gravarManifesto(id, novo);
  Auditoria.registrar({ tipo: 'versao-descartada', quem: por, versao: id });
  return { ok: true, versao: resumo(novo) };
}
export { statSync };
