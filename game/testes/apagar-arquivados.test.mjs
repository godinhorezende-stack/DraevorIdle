// O script do dono para apagar os personagens arquivados (admin/apagar-arquivados.mjs). Roda num SQLite PRÓPRIO, novo a cada vez: o script
// apaga TODO arquivado do banco a que aponta, e o de desenvolvimento tem personagens de verdade.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const pasta = mkdtempSync(join(tmpdir(), 'arquivados-'));
process.env.DRAEVOR_SQLITE = join(pasta, 'jogo.db');
after(() => rmSync(pasta, { recursive: true, force: true }));
// O banco e o jogo só DEPOIS do desvio (ver isolamento-dos-testes).
const B = await import('../database/banco.mjs');
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !Catalogo.ligado() && 'jogo oficial desligado nesta máquina';

const SCRIPT = new URL('../admin/apagar-arquivados.mjs', import.meta.url).pathname;
const rodar = (...args) => {
  try {
    return { codigo: 0, saida: execFileSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env }, encoding: 'utf8' }) };
  } catch (e) {
    return { codigo: e.status, saida: String(e.stdout ?? '') };
  }
};

test('lista por padrão; apaga só com --apagar e o --confirmo certo; só os arquivados; as contas ficam', { skip: SEM }, async () => {
  const conta = await B.criarConta({ email: `arq-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const nome = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const antigo1 = await B.criarPersonagem({ conta: conta.id, nome: nome('Ant'), vocacao: 'knight', sexo: 'male', estadoInicial: { level: 300, vocation: 'knight', gold: 5000 } });
  const antigo2 = await B.criarPersonagem({ conta: conta.id, nome: nome('Bnt'), vocacao: 'druid', sexo: 'male', estadoInicial: { level: 80, vocation: 'druid' } });
  const doPoe = await B.criarPersonagem({ conta: conta.id, nome: nome('Poe'), vocacao: 'knight', sexo: 'male', estadoInicial: { level: 5, sistema: 'poe' } });
  const existe = async (id) => !!(await B.banco.prepare('SELECT 1 AS x FROM personagens WHERE id = ?').get(id));

  const lista = rodar();
  assert.equal(lista.codigo, 0);
  assert.match(lista.saida, /Personagens arquivados: 2, de 1 conta/);
  assert.match(lista.saida, /Nada foi apagado/);
  assert.ok((await existe(antigo1.id)) && (await existe(antigo2.id)), 'listar não apaga');

  assert.equal(rodar('--apagar').codigo, 1, 'sem --confirmo: recusa');
  assert.equal(rodar('--apagar', '--confirmo=3').codigo, 1, '--confirmo errado: recusa');
  // O `N` do texto copiado ao pé da letra: recusa e diz o número a digitar.
  const literal = rodar('--apagar', '--confirmo=N');
  assert.equal(literal.codigo, 1);
  assert.match(literal.saida, /--confirmo=N não é um número\. Troque pelo número da lista: --apagar --confirmo=2\./);
  assert.ok((await existe(antigo1.id)) && (await existe(antigo2.id)), 'recusado não apaga');

  const r = rodar('--apagar', '--confirmo=2');
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /Apagados: 2 .* Arquivados que sobraram: 0/);
  assert.equal(await existe(antigo1.id), false);
  assert.equal(await existe(antigo2.id), false);
  assert.equal(await existe(doPoe.id), true, 'o personagem do PoE fica');
  assert.ok(await B.banco.prepare('SELECT 1 AS x FROM contas WHERE id = ?').get(conta.id), 'a conta fica');
});
