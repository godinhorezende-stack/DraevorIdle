#!/usr/bin/env node
// O HOOK ANTES DO COMMIT do Claude Code (`.claude/settings.json` → PreToolUse, Bash). Só a cola: reconhece o `git commit` e chama o MOTOR
// (`testar.mjs auto --hook`, o mesmo que o pre-commit do git chama — `.githooks/pre-commit`). Toda a decisão é do motor:
//   - só documentação → passa;  cliente/teste → QUICK;  sistemas → SYSTEM;  núcleo → FULL OBRIGATÓRIA (roda a suíte completa);
//   - falhou → o commit é BARRADO (saída 2: o Claude vê o porquê);  FULL recomendada → passa, com o aviso;
//   - o mesmo conteúdo (fingerprint) já aprovado por uma rodada que cobre o que o commit pede → passa sem rodar de novo.
// Qualquer outro comando do Bash passa direto (~0,1 s). Com o pre-commit do git instalado, o commit do Claude passa pelos dois — o segundo
// acha a rodada aprovada pelo primeiro (mesmo fingerprint) e não roda de novo.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const lerEntrada = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const entrada = lerEntrada();
const comando = String(entrada?.tool_input?.command ?? '');
// Só o `git commit` (também `git -C x commit`, depois de `&&`); `git commit-tree`, `git log --grep commit` etc. não.
if (entrada?.tool_name !== 'Bash' || !/(^|[;&|(]\s*|\s)git(\s+-C\s+\S+)?\s+commit(\s|$)/.test(comando)) process.exit(0);

const pasta = entrada.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const topo = spawnSync('git', ['-C', pasta, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
if (topo.status !== 0) process.exit(0);
const testar = join(topo.stdout.trim(), 'game', 'tools', 'testes', 'testar.mjs');
if (!existsSync(testar)) process.exit(0);

const r = spawnSync(process.execPath, [testar, 'auto', '--hook'], { cwd: topo.stdout.trim(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
// O relatório inteiro é longo (uma linha por arquivo): o Claude recebe o plano, o resumo e as falhas.
const essencial = saida
  .split('\n')
  .filter((l) => !/^✔ testes\//.test(l))
  .join('\n')
  .trim();
if (r.status === 0) {
  // Passou: o resumo vai para quem está olhando (systemMessage), sem decidir permissão nenhuma (o commit segue o fluxo normal).
  const ultima = essencial.split('\n').filter((l) => /^(Classificação|✔ Já aprovado|✔ Aprovado|Nada a testar|⚠️|Total|Failed|Duration)/.test(l)).join(' · ');
  process.stdout.write(JSON.stringify({ systemMessage: `Testes antes do commit: ${ultima || 'ok'}` }));
  process.exit(0);
}
process.stderr.write(`Commit barrado pelos testes (game/tools/testes/testar.mjs auto --hook):\n\n${essencial.slice(-12_000)}\n`);
process.exit(2);
