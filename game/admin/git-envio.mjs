// O ENVIO AO GIT de uma versão aprovada (etapa 4 do plano de publicação): cria a branch `versao/<id>` com UM commit feito a partir das cópias CONGELADAS da versão e
// a envia ao remoto. Tudo por comandos fixos do Git (sem shell, sem texto do usuário na linha de comando) e por "encanamento" (plumbing) com um índice temporário:
// o seu diretório de trabalho, o seu índice, o HEAD e a sua branch atual NÃO são tocados — outras alterações suas (inclusive em andamento) nunca entram.
// Não faz merge, não força push (nunca `--force`), não envia nenhuma outra branch e não faz deploy. Falhou o envio: o commit e a versão ficam guardados
// (status `commit-local`) e dá para tentar de novo.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Git from './git-local.mjs';
import * as Versoes from './versoes.mjs';
import * as Auditoria from './auditoria.mjs';

const ZERO = '0'.repeat(40);
export const REMOTO = 'origin';
export const BRANCH_PRINCIPAL = 'main';

/** Tira usuário/senha/token de uma URL (nunca vai para o manifesto, a tela ou a auditoria). Pura. */
export const sanearUrl = (t) => String(t ?? '').replace(/(\w+:\/\/)[^@/\s]+@/g, '$1').replace(/(token|password|senha)=\S+/gi, '$1=***');

/** O link de comparação (para abrir o PR) a partir da URL do remoto — só GitHub; `null` nos outros casos. Pura. */
export function linkDeComparacao(url, branch, base = BRANCH_PRINCIPAL) {
  const m = /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim());
  return m ? `https://github.com/${m[1]}/${m[2]}/compare/${base}...${encodeURI(branch)}?expand=1` : null;
}

/** Roda UM comando do Git (assíncrono: o servidor do jogo não trava durante o push). Rejeita com a mensagem do Git, já sem credenciais. */
function rodar(args, { cwd, input, env = {}, timeout = 60000 } = {}) {
  return new Promise((ok, falha) => {
    const f = spawn('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', ...env } });
    let saida = '';
    let erro = '';
    const limite = setTimeout(() => f.kill('SIGKILL'), timeout);
    f.stdout.on('data', (d) => { saida += d; });
    f.stderr.on('data', (d) => { erro += d; });
    f.on('error', (e) => { clearTimeout(limite); falha(new Error(`git ${args[0]}: ${e.message}`)); });
    f.on('close', (codigo) => { clearTimeout(limite); if (codigo === 0) ok(saida); else falha(new Error(sanearUrl((erro || saida || `git ${args[0]} falhou`).trim().split('\n').slice(0, 4).join(' | ')))); });
    f.stdin.on('error', () => {});
    f.stdin.end(input ?? '');
  });
}
const existe = async (ref, cwd) => { try { await rodar(['rev-parse', '--verify', '-q', ref], { cwd }); return true; } catch { return false; } };

/**
 * Cria o commit da versão (se ainda não existe) e envia a branch. Devolve `{ ok, versao, branch, commit, link }` ou `{ ok: false, erros, preservada }`.
 * `remoto` (só testes) troca o nome do remoto.
 */
export async function enviar(id, { agora = Date.now(), remoto = REMOTO } = {}) {
  const m = Versoes.obter(id);
  if (!m) return { ok: false, erros: ['Versão não encontrada.'] };
  if (!['aprovada', 'commit-local'].includes(m.status)) return { ok: false, erros: [`Só dá para enviar uma versão "aprovada" (ou com o commit local já criado); esta está "${m.status}".`] };
  if (!m.integra) return { ok: false, erros: ['A cópia congelada da versão não está íntegra: não envio. ' + m.problemasDeIntegridade.map((p) => `${p.caminho}: ${p.problema}`).join(' | ')] };
  const raiz = Git.raizDoRepo();
  if (!raiz) return { ok: false, erros: ['Não encontrei um repositório Git aqui.'] };
  const branch = `versao/${id}`;
  const ref = `refs/heads/${branch}`;
  const tmp = mkdtempSync(join(tmpdir(), 'draevor-envio-'));
  try {
    let commit = m.git?.commit ?? null;
    if (commit) {
      // Tentativa nova de uma versão cujo commit já existe: confere que a branch ainda aponta para ele (ninguém mexeu).
      const atual = await rodar(['rev-parse', '--verify', '-q', ref], { cwd: raiz }).then((t) => t.trim(), () => null);
      if (atual !== commit) return { ok: false, erros: [`A branch ${branch} não aponta mais para o commit da versão (${commit.slice(0, 8)}): não envio. Descarte a versão e gere outra.`] };
    } else {
      const nome = (await rodar(['config', 'user.name'], { cwd: raiz }).catch(() => '')).trim(); // `git config` sai com erro quando não há valor
      const email = (await rodar(['config', 'user.email'], { cwd: raiz }).catch(() => '')).trim();
      if (!nome || !email) return { ok: false, erros: ['O Git não tem user.name/user.email configurados: o commit precisa de um autor.'] };
      let base;
      try { base = (await rodar(['rev-parse', '--verify', `${m.base.head}^{commit}`], { cwd: raiz })).trim(); } catch { return { ok: false, erros: [`O commit base da versão (${m.base.head}) não existe neste repositório.`] }; }
      if (await existe(ref, raiz)) return { ok: false, erros: [`A branch ${branch} já existe neste repositório: não sobrescrevo.`] };
      const env = { GIT_INDEX_FILE: join(tmp, 'indice') };
      await rodar(['read-tree', base], { cwd: raiz, env });
      for (const a of m.arquivos) {
        if (!Git.caminhoPermitido(a.caminho)) throw new Error(`caminho não permitido: ${a.caminho}`);
        if (a.estado === 'apagado') { await rodar(['update-index', '--force-remove', '--', a.caminho], { cwd: raiz, env }); continue; }
        const conteudo = Versoes.conteudoCongelado(id, a.caminho);
        if (!conteudo) throw new Error(`falta a cópia congelada de ${a.caminho}`);
        const blob = (await rodar(['hash-object', '-w', '--stdin'], { cwd: raiz, input: conteudo })).trim();
        const modo = /^(\d{6}) /.exec(await rodar(['ls-tree', base, '--', a.caminho], { cwd: raiz }))?.[1] ?? '100644';
        await rodar(['update-index', '--add', '--cacheinfo', `${modo},${blob},${a.caminho}`], { cwd: raiz, env });
      }
      const arvore = (await rodar(['write-tree'], { cwd: raiz, env })).trim();
      if (arvore === (await rodar(['rev-parse', `${base}^{tree}`], { cwd: raiz })).trim()) return { ok: false, erros: ['A versão não muda nada em relação ao commit base: não há o que enviar.'] };
      const mensagem = `versão ${id}: ${m.titulo}\n\n${m.changelog}`;
      commit = (await rodar(['commit-tree', arvore, '-p', base, '-F', '-'], { cwd: raiz, input: mensagem })).trim();
      await rodar(['update-ref', ref, commit, ZERO], { cwd: raiz }); // ZERO = só cria se não existir
      Versoes.atualizarStatus(id, { status: 'commit-local', git: { branch, commit, base, criadoEm: agora } });
    }
    // O envio: só esta branch, sem força.
    let url;
    try { url = (await rodar(['remote', 'get-url', remoto], { cwd: raiz })).trim(); } catch { return semEnvio(id, m, `O remoto "${remoto}" não está configurado neste repositório.`, branch, commit); }
    try { await rodar(['push', remoto, `${ref}:${ref}`], { cwd: raiz, timeout: 180000 }); } catch (e) { return semEnvio(id, m, `O envio falhou: ${e.message}`, branch, commit); }
    const link = linkDeComparacao(url, branch);
    Versoes.atualizarStatus(id, { status: 'enviada', git: { ...(Versoes.obter(id).git ?? {}), branch, commit, remoto: sanearUrl(url), link, enviadoEm: agora, erroDeEnvio: null } });
    Auditoria.registrar({ tipo: 'versao-enviada', versao: id, branch, commit: commit.slice(0, 12) });
    return { ok: true, versao: Versoes.listar().find((v) => v.id === id), branch, commit, link };
  } catch (e) {
    return { ok: false, erros: [sanearUrl(e.message)], preservada: true };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function semEnvio(id, m, erro, branch, commit) {
  const texto = sanearUrl(erro);
  Versoes.atualizarStatus(id, { status: 'commit-local', git: { ...(Versoes.obter(id).git ?? {}), branch, commit, erroDeEnvio: texto } });
  Auditoria.registrar({ tipo: 'versao-envio-falhou', versao: id, branch, erro: texto.slice(0, 200) });
  return { ok: false, erros: [texto, `A versão ${id} continua guardada (commit local ${commit.slice(0, 8)} em ${branch}): corrija o remoto e envie de novo.`], preservada: true };
}
