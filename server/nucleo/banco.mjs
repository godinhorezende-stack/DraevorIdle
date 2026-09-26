// Persistência. `node:sqlite` é nativo no Node 22+, sem dependência binária.
// O arquivo do banco fica em `server/dados/jogo.db`.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(RAIZ, 'dados'), { recursive: true });

export const db = new DatabaseSync(join(RAIZ, 'dados', 'jogo.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  -- Há mais de uma conexão no mesmo arquivo: a thread do jogo e a da
  -- simulação offline (nucleo/simulacao-offline.mjs), que anota drops. Sem
  -- isto, uma escrita que encontrasse a outra no meio falhava na hora com
  -- "database is locked" em vez de esperar os poucos milissegundos dela.
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS contas (
    id        TEXT PRIMARY KEY,
    email     TEXT UNIQUE NOT NULL,
    senha     TEXT NOT NULL,
    criada_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    token  TEXT PRIMARY KEY,
    conta  TEXT NOT NULL REFERENCES contas(id),
    criada INTEGER NOT NULL
  );

  -- Um personagem = uma linha. A coluna estado guarda tudo que muda a cada
  -- tique (posição, hp/mana, hunt) como JSON, igual ao projeto pokeidle-restore:
  -- dá para separar em colunas próprias depois, se a leitura/escrita virar gargalo.
  CREATE TABLE IF NOT EXISTS personagens (
    id        TEXT PRIMARY KEY,
    conta     TEXT NOT NULL REFERENCES contas(id),
    nome      TEXT UNIQUE NOT NULL,
    vocacao   TEXT NOT NULL,
    sexo      TEXT NOT NULL,
    criado_em INTEGER NOT NULL,
    visto_em  INTEGER,
    estado    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS personagens_conta ON personagens(conta);

  -- O "Baú da Conta": uma caixa do depósito dividida por todos os personagens
  -- da conta (a caixa com compartilhada: true que o client mostra na aba própria).
  CREATE TABLE IF NOT EXISTS bau_da_conta (
    conta TEXT PRIMARY KEY REFERENCES contas(id),
    caixa TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS melhorias_da_conta (
    conta TEXT PRIMARY KEY REFERENCES contas(id),
    dados TEXT NOT NULL
  );
`);

// ------------------------------------------------------------------ senhas

/*
 * O scrypt é de propósito caro (~90ms por senha). Na versão síncrona ele
 * parava o servidor inteiro a cada login: com 30 pessoas caçando, quem
 * entrava travava a caçada de todo mundo (medido no teste de carga,
 * tools/carga.mjs). Assíncrono, ele roda na fila de trabalho do Node, fora do
 * laço do jogo.
 */
const scryptAsync = promisify(scrypt);

const hashSenha = async (senha, sal = randomBytes(16).toString('hex')) =>
  sal + ':' + (await scryptAsync(senha, sal, 64)).toString('hex');

export async function conferirSenha(senha, guardada) {
  if (!guardada || typeof senha !== 'string') return false;
  const [sal, hash] = guardada.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = await scryptAsync(senha, sal, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------------ contas

export async function criarConta({ email, senha }) {
  const id = randomUUID();
  const hash = await hashSenha(senha);
  db.prepare('INSERT INTO contas (id, email, senha, criada_em) VALUES (?, ?, ?, ?)').run(
    id, email, hash, Date.now(),
  );
  return { id, email };
}

export const contaPorEmail = (email) =>
  email ? db.prepare('SELECT * FROM contas WHERE email = ?').get(String(email).trim().toLowerCase()) : undefined;

export const contaPorId = (id) => db.prepare('SELECT * FROM contas WHERE id = ?').get(id);

export function abrirSessao(contaId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessoes (token, conta, criada) VALUES (?, ?, ?)').run(token, contaId, Date.now());
  return token;
}

export function contaDaSessao(token) {
  if (!token) return null;
  const s = db.prepare('SELECT conta FROM sessoes WHERE token = ?').get(token);
  return s ? contaPorId(s.conta) : null;
}

export const encerrarSessao = (token) => db.prepare('DELETE FROM sessoes WHERE token = ?').run(token);

// ------------------------------------------------------------- personagens

export const personagensDaConta = (contaId) =>
  db.prepare('SELECT * FROM personagens WHERE conta = ? ORDER BY criado_em ASC').all(contaId);

export const personagemPorNome = (nome) =>
  nome ? db.prepare('SELECT * FROM personagens WHERE nome = ? COLLATE NOCASE').get(nome) : undefined;

export function criarPersonagem({ conta, nome, vocacao, sexo, estadoInicial }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO personagens (id, conta, nome, vocacao, sexo, criado_em, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, conta, nome, vocacao, sexo, Date.now(), JSON.stringify(estadoInicial));
  return { id, conta, nome, vocacao, sexo, estado: estadoInicial };
}

export const gravarEstadoPersonagem = (id, estado) =>
  db.prepare('UPDATE personagens SET estado = ?, visto_em = ? WHERE id = ?').run(
    JSON.stringify(estado), Date.now(), id,
  );

/** Regrava o estado de um personagem que NÃO está no jogo (ex.: recebeu uma transferência), sem mudar o `visto_em`. */
export const regravarEstadoPersonagem = (id, estado) =>
  db.prepare('UPDATE personagens SET estado = ? WHERE id = ?').run(JSON.stringify(estado), id);

export const excluirPersonagem = (id) => db.prepare('DELETE FROM personagens WHERE id = ?').run(id);

// ------------------------------------------------------------ baú da conta

export function lerBauDaConta(contaId) {
  const linha = db.prepare('SELECT caixa FROM bau_da_conta WHERE conta = ?').get(contaId);
  return linha ? JSON.parse(linha.caixa) : null;
}

export function gravarBauDaConta(contaId, caixa) {
  db.prepare('INSERT INTO bau_da_conta (conta, caixa) VALUES (?, ?) ON CONFLICT(conta) DO UPDATE SET caixa = excluded.caixa').run(
    contaId,
    JSON.stringify(caixa)
  );
}

// ------------------------------------------------------ melhorias da conta
// O que a Ravox Store vende para a CONTA (o slot de party: "comprou em um char,
// vale para todos os chars da conta").

/*
 * Lidas toda hora: o tamanho da party (`Party.limiteDeChars`) vai no
 * personagem a cada segundo, de cada jogador — era uma consulta SQL por
 * jogador por segundo, dentro do tique. Só esta função e a de baixo escrevem
 * na tabela, então o texto guardado aqui nunca fica velho (com mais de um
 * processo escrevendo, isto vira cache invalidado por aviso — ver
 * docs/auditoria-performance.md). Guarda o TEXTO e devolve um objeto novo a
 * cada leitura: quem lê pode mexer no objeto (a Loja mexe antes de gravar)
 * sem sujar o que está guardado.
 */
const melhoriasGuardadas = new Map(); // conta -> texto JSON

export function lerMelhoriasDaConta(contaId) {
  let texto = melhoriasGuardadas.get(contaId);
  if (texto === undefined) {
    texto = db.prepare('SELECT dados FROM melhorias_da_conta WHERE conta = ?').get(contaId)?.dados ?? '{}';
    melhoriasGuardadas.set(contaId, texto);
  }
  return JSON.parse(texto);
}

export function gravarMelhoriasDaConta(contaId, dados) {
  const texto = JSON.stringify(dados);
  db.prepare('INSERT INTO melhorias_da_conta (conta, dados) VALUES (?, ?) ON CONFLICT(conta) DO UPDATE SET dados = excluded.dados').run(
    contaId,
    texto
  );
  melhoriasGuardadas.set(contaId, texto);
}
