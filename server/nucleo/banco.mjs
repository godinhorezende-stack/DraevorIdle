// Persistência: contas, sessões, personagens, baú/melhorias da conta.
// Fase 6: banco assíncrono, SQLite (padrão) ou PostgreSQL (`DATABASE_URL`) —
// ver `nucleo/db.mjs` para a interface e o porquê de cada escolha.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import * as Db from './db.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export const banco = await Db.abrir(join(RAIZ, 'dados', 'jogo.db'));

/*
 * `db` cru: o `node:sqlite` de sempre, só em modo SQLite — todo o jogo (Fase 6)
 * já fala com o repositório assíncrono (`banco`/`Db.abrir`), então isto só
 * sobrevive como atalho dos testes (limpeza direta de tabelas entre casos).
 * Em modo Postgres ele não existe: nenhum teste que dependa dele roda com
 * `DATABASE_URL` ligado.
 */
export const db = banco.dialeto === 'sqlite' ? banco.bruto : undefined;

if (banco.dialeto === 'sqlite') {
  await banco.exec(`
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
} else {
  // Mesmas tabelas, tipos do Postgres: `citext` para nome/email (busca sem
  // `lower()`/`COLLATE NOCASE` espalhado pelo código) e `BIGINT` para os
  // carimbos de tempo em epoch-ms (`INTEGER` do Postgres é 32 bits — estoura
  // em 2038, e as datas aqui já são ms, não segundos).
  await banco.exec('CREATE EXTENSION IF NOT EXISTS citext');
  await banco.exec(`
    CREATE TABLE IF NOT EXISTS contas (
      id        TEXT PRIMARY KEY,
      email     CITEXT UNIQUE NOT NULL,
      senha     TEXT NOT NULL,
      criada_em BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      token  TEXT PRIMARY KEY,
      conta  TEXT NOT NULL REFERENCES contas(id),
      criada BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personagens (
      id        TEXT PRIMARY KEY,
      conta     TEXT NOT NULL REFERENCES contas(id),
      nome      CITEXT UNIQUE NOT NULL,
      vocacao   TEXT NOT NULL,
      sexo      TEXT NOT NULL,
      criado_em BIGINT NOT NULL,
      visto_em  BIGINT,
      estado    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS personagens_conta ON personagens(conta);

    CREATE TABLE IF NOT EXISTS bau_da_conta (
      conta TEXT PRIMARY KEY REFERENCES contas(id),
      caixa TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS melhorias_da_conta (
      conta TEXT PRIMARY KEY REFERENCES contas(id),
      dados TEXT NOT NULL
    );
  `);
}

/** A transação de verdade (ver `nucleo/db.mjs`) — usada pela fila global em `nucleo/sessao.mjs`. */
export const transacao = (fn) => banco.transacao(fn);

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
  await banco.prepare('INSERT INTO contas (id, email, senha, criada_em) VALUES (?, ?, ?, ?)').run(
    id, email, hash, Date.now(),
  );
  return { id, email };
}

export const contaPorEmail = (email) =>
  email ? banco.prepare('SELECT * FROM contas WHERE email = ?').get(String(email).trim().toLowerCase()) : Promise.resolve(undefined);

export const contaPorId = (id) => banco.prepare('SELECT * FROM contas WHERE id = ?').get(id);

export async function abrirSessao(contaId) {
  const token = randomBytes(24).toString('hex');
  await banco.prepare('INSERT INTO sessoes (token, conta, criada) VALUES (?, ?, ?)').run(token, contaId, Date.now());
  return token;
}

export async function contaDaSessao(token) {
  if (!token) return null;
  const s = await banco.prepare('SELECT conta FROM sessoes WHERE token = ?').get(token);
  return s ? contaPorId(s.conta) : null;
}

export const encerrarSessao = (token) => banco.prepare('DELETE FROM sessoes WHERE token = ?').run(token);

// ------------------------------------------------------------- personagens

export const personagensDaConta = (contaId) =>
  banco.prepare('SELECT * FROM personagens WHERE conta = ? ORDER BY criado_em ASC').all(contaId);

/*
 * `nome` é `CITEXT` no Postgres (busca sem diferenciar maiúsculas sozinha);
 * no SQLite, o `COLLATE NOCASE` faz o mesmo — a coluna já nasce assim
 * (`UNIQUE NOT NULL`, sem precisar repetir `COLLATE` em toda consulta:
 * SQLite aplica a collation do UNIQUE também nas buscas por `=`).
 */
export const personagemPorNome = (nome) =>
  nome ? banco.prepare('SELECT * FROM personagens WHERE nome = ?').get(nome) : Promise.resolve(undefined);

export async function criarPersonagem({ conta, nome, vocacao, sexo, estadoInicial }) {
  const id = randomUUID();
  await banco.prepare(
    `INSERT INTO personagens (id, conta, nome, vocacao, sexo, criado_em, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, conta, nome, vocacao, sexo, Date.now(), JSON.stringify(estadoInicial));
  return { id, conta, nome, vocacao, sexo, estado: estadoInicial };
}

export const gravarEstadoPersonagem = (id, estado) =>
  banco.prepare('UPDATE personagens SET estado = ?, visto_em = ? WHERE id = ?').run(
    JSON.stringify(estado), Date.now(), id,
  );

/** Regrava o estado de um personagem que NÃO está no jogo (ex.: recebeu uma transferência), sem mudar o `visto_em`. */
export const regravarEstadoPersonagem = (id, estado) =>
  banco.prepare('UPDATE personagens SET estado = ? WHERE id = ?').run(JSON.stringify(estado), id);

export const excluirPersonagem = (id) => banco.prepare('DELETE FROM personagens WHERE id = ?').run(id);

// ------------------------------------------------------------ baú da conta

export async function lerBauDaConta(contaId) {
  const linha = await banco.prepare('SELECT caixa FROM bau_da_conta WHERE conta = ?').get(contaId);
  return linha ? JSON.parse(linha.caixa) : null;
}

export function gravarBauDaConta(contaId, caixa) {
  return banco.prepare('INSERT INTO bau_da_conta (conta, caixa) VALUES (?, ?) ON CONFLICT(conta) DO UPDATE SET caixa = excluded.caixa').run(
    contaId,
    JSON.stringify(caixa),
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

export async function lerMelhoriasDaConta(contaId) {
  let texto = melhoriasGuardadas.get(contaId);
  if (texto === undefined) {
    texto = (await banco.prepare('SELECT dados FROM melhorias_da_conta WHERE conta = ?').get(contaId))?.dados ?? '{}';
    melhoriasGuardadas.set(contaId, texto);
  }
  return JSON.parse(texto);
}

/*
 * A versão SÍNCRONA, só do cache — para o único lugar que não pode esperar
 * um banco de verdade: `Party.limiteDeChars`, lido a cada `mandarEstado` (até
 * 4x por segundo por jogador). `entrarNoPersonagem` chama `lerMelhoriasDaConta`
 * (a de cima) UMA vez, no login, para aquecer o cache antes de qualquer
 * tique — enquanto não aqueceu (nunca deveria acontecer fora de um teste que
 * pule o login), `{}` é o mesmo "sem melhoria nenhuma" de antes de comprar.
 */
export function melhoriasCache(contaId) {
  const texto = melhoriasGuardadas.get(contaId);
  return texto ? JSON.parse(texto) : {};
}

export async function gravarMelhoriasDaConta(contaId, dados) {
  const texto = JSON.stringify(dados);
  await banco.prepare('INSERT INTO melhorias_da_conta (conta, dados) VALUES (?, ?) ON CONFLICT(conta) DO UPDATE SET dados = excluded.dados').run(
    contaId,
    texto,
  );
  melhoriasGuardadas.set(contaId, texto);
}
