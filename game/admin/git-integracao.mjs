// O STATUS PÓS-MERGE (etapa 5 do plano de publicação): depois que VOCÊ faz o merge, a Engine consulta o remoto e responde se a versão já está na branch principal
// e se está apta para a publicação. Só LÊ o Git (buscar o estado da principal, comparar commits e arquivos): não faz merge, não faz checkout, não mexe no seu
// diretório, no índice nem na sua branch, e não publica. O único comando que escreve é `git fetch origin main`, que só atualiza a referência `origin/main` (o espelho
// local da principal do remoto).
//
// Como reconhece o merge:
//   - "merge" (merge commit, fast-forward): o commit da versão é ANCESTRAL de `origin/main`;
//   - "conteudo" (squash ou rebase, que reescrevem o commit): todos os arquivos da versão têm, em `origin/main`, exatamente o conteúdo congelado (e os apagados não existem).
import { spawn } from 'node:child_process';
import * as Git from './git-local.mjs';
import * as Versoes from './versoes.mjs';
import * as Auditoria from './auditoria.mjs';
import { sanearUrl, REMOTO, BRANCH_PRINCIPAL } from './git-envio.mjs';

/** Roda UM comando do Git e devolve `{ codigo, saida, erro }` (nunca rejeita por código ≠ 0: quem chama decide). */
function rodar(args, { cwd, input, timeout = 60000 } = {}) {
  return new Promise((ok, falha) => {
    const f = spawn('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
    let saida = '';
    let erro = '';
    const limite = setTimeout(() => f.kill('SIGKILL'), timeout);
    f.stdout.on('data', (d) => { saida += d; });
    f.stderr.on('data', (d) => { erro += d; });
    f.on('error', (e) => { clearTimeout(limite); falha(new Error(`git ${args[0]}: ${e.message}`)); });
    f.on('close', (codigo) => { clearTimeout(limite); ok({ codigo, saida: saida.trim(), erro: sanearUrl(erro.trim().split('\n').slice(0, 3).join(' | ')) }); });
    f.stdin.on('error', () => {});
    f.stdin.end(input ?? '');
  });
}

/** O blob que o arquivo tem num commit (`null` se não existe lá). */
async function blobEm(commit, caminho, cwd) {
  const r = await rodar(['ls-tree', commit, '--', caminho], { cwd });
  return /^\d{6} blob ([0-9a-f]{40})\t/.exec(r.saida)?.[1] ?? null;
}

/**
 * Compara os arquivos da versão com `commit` (a ponta da principal): `{ iguais, diferentes: [caminho] }`. Para cada arquivo, o blob esperado é o do conteúdo CONGELADO.
 */
async function compararComPrincipal(m, id, tip, cwd) {
  const diferentes = [];
  for (const a of m.arquivos) {
    const no = await blobEm(tip, a.caminho, cwd);
    if (a.estado === 'apagado') { if (no) diferentes.push(a.caminho); continue; }
    const conteudo = Versoes.conteudoCongelado(id, a.caminho);
    const esperado = conteudo ? (await rodar(['hash-object', '--stdin'], { cwd, input: conteudo })).saida : null;
    if (!no || no !== esperado) diferentes.push(a.caminho);
  }
  return { iguais: diferentes.length === 0, diferentes };
}

/**
 * Consulta a situação da versão no remoto. `buscar` (padrão) atualiza `origin/main` antes. Devolve
 * `{ ok, situacao: 'pendente' | 'integrada', modo, commitIntegrador, principal: { commit }, apta, motivos, avisos, alteradosDepois }`.
 * Versão `integrada` é gravada no manifesto; `pendente` não muda nada.
 */
export async function consultar(id, { buscar = true, agora = Date.now(), remoto = REMOTO, principal = BRANCH_PRINCIPAL } = {}) {
  const m = Versoes.obter(id);
  if (!m) return { ok: false, erros: ['Versão não encontrada.'] };
  if (!['enviada', 'integrada'].includes(m.status)) return { ok: false, erros: [m.status === 'descartada' ? 'Esta versão foi descartada.' : `A versão está "${m.status}": envie-a ao Git antes de consultar o merge.`] };
  const cwd = Git.raizDoRepo();
  if (!cwd) return { ok: false, erros: ['Não encontrei um repositório Git aqui.'] };
  const commit = m.git?.commit;
  if (!commit) return { ok: false, erros: ['A versão não tem commit registrado.'] };
  if (buscar) {
    const f = await rodar(['fetch', remoto, principal], { cwd, timeout: 180000 });
    if (f.codigo !== 0) return { ok: false, erros: [`Não consegui consultar o remoto: ${f.erro || 'falha no fetch'}. O status anterior foi mantido.`] };
  }
  const ref = `refs/remotes/${remoto}/${principal}`;
  const tipR = await rodar(['rev-parse', '--verify', '-q', ref], { cwd });
  if (tipR.codigo !== 0) return { ok: false, erros: [`Não há ${remoto}/${principal} neste repositório (busque o remoto).`] };
  const tip = tipR.saida;
  const existe = (await rodar(['cat-file', '-e', `${commit}^{commit}`], { cwd })).codigo === 0;
  let modo = null;
  let integrador = null;
  if (existe && (await rodar(['merge-base', '--is-ancestor', commit, tip], { cwd })).codigo === 0) {
    modo = 'merge';
    // o commit que trouxe a versão para a principal: o primeiro merge no caminho, ou o próprio commit (fast-forward)
    const primeiro = (await rodar(['rev-list', '--ancestry-path', '--merges', '--reverse', `${commit}..${tip}`], { cwd })).saida.split('\n')[0];
    integrador = primeiro || commit;
  }
  const cmp = await compararComPrincipal(m, id, tip, cwd);
  if (!modo && cmp.iguais) {
    modo = 'conteudo';
    const caminhos = m.arquivos.map((a) => a.caminho);
    integrador = (await rodar(['log', '-1', '--format=%H', tip, '--', ...caminhos], { cwd })).saida || tip;
  }
  const principalInfo = { ref: `${remoto}/${principal}`, commit: tip };
  if (!modo) {
    return { ok: true, situacao: 'pendente', versao: id, status: m.status, principal: principalInfo, apta: false, motivos: [`A versão ainda não está em ${remoto}/${principal}: faça o merge (a branch ${m.git.branch} e o PR) e consulte de novo.`], avisos: [], alteradosDepois: [] };
  }
  const avisos = [];
  const alteradosDepois = modo === 'merge' ? cmp.diferentes : [];
  if (alteradosDepois.length) avisos.push(`${alteradosDepois.length} arquivo(s) da versão foram alterados na principal depois do merge (normal se houve outra versão depois).`);
  const integracao = { commit: integrador, modo, principal: tip, verificadaEm: agora };
  if (m.status === 'enviada') {
    Versoes.atualizarStatus(id, { status: 'integrada', integracao });
    Auditoria.registrar({ tipo: 'versao-integrada', versao: id, commit: integrador.slice(0, 12), modo });
  } else Versoes.atualizarStatus(id, { status: 'integrada', integracao });
  return { ok: true, situacao: 'integrada', versao: id, status: 'integrada', modo, commitIntegrador: integrador, principal: principalInfo, apta: true, motivos: [], avisos, alteradosDepois,
    paraPublicar: { commit: tip, observacao: 'A publicação leva a ponta da principal (todas as versões já integradas), não só esta.' } };
}
