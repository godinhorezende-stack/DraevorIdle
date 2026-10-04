// Persistência: contas, sessões, personagens, baú/melhorias da conta.
// Fase 6: banco assíncrono, SQLite (padrão) ou PostgreSQL (`DATABASE_URL`) —
// ver `game/database/db.mjs` para a interface e o porquê de cada escolha.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { isMainThread } from 'node:worker_threads';
import * as Db from './db.mjs';
import * as Cache from './redis.mjs';
import { colunasDaCacaOffline } from './caca-offline.mjs';

const RAIZ = dirname(fileURLToPath(import.meta.url));

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
    -- Há mais de uma conexão no mesmo arquivo: a thread do jogo e a da
    -- simulação offline (game/systems/simulacao-offline.mjs), que anota drops. Sem
    -- isto, uma escrita que encontrasse a outra no meio falhava na hora com
    -- "database is locked" em vez de esperar os poucos milissegundos dela.
    -- ANTES do WAL: ligar o WAL pede a trava do arquivo, e nos testes (um
    -- processo por arquivo, todos abrindo este banco juntos) quem chegava com
    -- ele ocupado falhava na hora, sem esperar.
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;

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

/*
 * ---- As colunas-índice da caçada offline (ver `caca-offline.mjs`) ----
 *
 * Nascem em banco que já existe (`ADD COLUMN`), sem mexer em nada do que há.
 * A thread da simulação offline também abre o banco e passa por aqui ao mesmo
 * tempo que a do jogo: a coluna que a outra acabou de criar não é erro.
 */
const jaExiste = (e) => /duplicate column|already exists/i.test(e?.message ?? '');
for (const coluna of ['caca_offline_desde', 'caca_offline_ate']) {
  try {
    if (banco.dialeto === 'sqlite') {
      const tem = banco.bruto.prepare('PRAGMA table_info(personagens)').all().some((c) => c.name === coluna);
      if (!tem) await banco.exec(`ALTER TABLE personagens ADD COLUMN ${coluna} INTEGER`);
    } else {
      await banco.exec(`ALTER TABLE personagens ADD COLUMN IF NOT EXISTS ${coluna} BIGINT`);
    }
  } catch (e) {
    if (!jaExiste(e)) throw e;
  }
}
// A CLASSE do Editor de Classes (`systems/classes.mjs`): o id da classe escolhida na criação. `vocacao` segue sendo a vocação MECÂNICA (knight, paladin…) de que o jogo depende; personagem antigo fica
// com `classe` NULL e vale como a própria vocação (compatibilidade).
try {
  if (banco.dialeto === 'sqlite') {
    const tem = banco.bruto.prepare('PRAGMA table_info(personagens)').all().some((c) => c.name === 'classe');
    if (!tem) await banco.exec('ALTER TABLE personagens ADD COLUMN classe TEXT');
  } else {
    await banco.exec('ALTER TABLE personagens ADD COLUMN IF NOT EXISTS classe TEXT');
  }
} catch (e) {
  if (!jaExiste(e)) throw e;
}
for (const [indice, coluna] of [['personagens_caca_offline_desde', 'caca_offline_desde'], ['personagens_caca_offline_ate', 'caca_offline_ate']]) {
  try {
    await banco.exec(`CREATE INDEX IF NOT EXISTS ${indice} ON personagens(${coluna})`);
  } catch (e) {
    if (!jaExiste(e)) throw e;
  }
}

/*
 * Quem já estava ausente quando as colunas nasceram: preenchidas UMA vez, a
 * partir do JSON (só a thread do jogo; e só se o estado não mudou no meio).
 * Depois disso toda gravação já leva as colunas, e a consulta volta vazia.
 */
if (isMainThread) {
  const semColuna = await banco.prepare(
    banco.dialeto === 'postgres'
      ? `SELECT id, estado FROM personagens WHERE caca_offline_desde IS NULL AND (estado::jsonb #>> '{hunt,offlineDesde}') IS NOT NULL`
      : `SELECT id, estado FROM personagens WHERE caca_offline_desde IS NULL AND json_extract(estado, '$.hunt.offlineDesde') IS NOT NULL`,
  ).all();
  const preencher = banco.prepare('UPDATE personagens SET caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ? AND estado = ?');
  for (const r of semColuna) {
    const [desde, ate] = colunasDaCacaOffline(JSON.parse(r.estado));
    await preencher.run(desde, ate, r.id, r.estado);
  }
}

/** A transação de verdade (ver `game/database/db.mjs`) — usada pela fila global em `game/websocket/sessao.mjs`. */
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

export async function criarPersonagem({ conta, nome, vocacao, sexo, estadoInicial, classe = null }) {
  const id = randomUUID();
  await banco.prepare(
    `INSERT INTO personagens (id, conta, nome, vocacao, sexo, criado_em, estado, caca_offline_desde, caca_offline_ate, classe)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, conta, nome, vocacao, sexo, Date.now(), JSON.stringify(estadoInicial), ...colunasDaCacaOffline(estadoInicial), classe);
  return { id, conta, nome, vocacao, sexo, classe, estado: estadoInicial };
}

/** Quantos personagens há em cada classe (`{ id: n }`); personagem antigo (sem `classe`) conta na própria vocação. */
export async function contarPersonagensPorClasse() {
  const linhas = await banco.prepare('SELECT COALESCE(classe, vocacao) AS classe, COUNT(*) AS n FROM personagens GROUP BY COALESCE(classe, vocacao)').all();
  return Object.fromEntries(linhas.map((l) => [l.classe, Number(l.n)]));
}

/**
 * MIGRAÇÃO EXPLÍCITA de classe: todos os personagens da classe `de` passam para a classe `para` (com a vocação mecânica `vocacaoPara`), no banco e no estado salvo. Devolve quantos mudaram.
 * É a única forma de esvaziar uma classe antes de apagá-la.
 */
export async function migrarClasse(de, para, vocacaoPara) {
  const lista = await banco.prepare('SELECT id, estado FROM personagens WHERE COALESCE(classe, vocacao) = ?').all(de);
  for (const p of lista) {
    let estado; try { estado = JSON.parse(p.estado); } catch { estado = null; }
    if (estado) { estado.classe = para; estado.vocation = vocacaoPara; }
    await banco.prepare('UPDATE personagens SET classe = ?, vocacao = ?, estado = ? WHERE id = ?').run(para, vocacaoPara, estado ? JSON.stringify(estado) : p.estado, p.id);
  }
  return lista.length;
}

// Toda gravação de estado leva as colunas da caçada offline junto (ver `caca-offline.mjs`).
export const gravarEstadoPersonagem = (id, estado) =>
  banco.prepare('UPDATE personagens SET estado = ?, visto_em = ?, caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ?').run(
    JSON.stringify(estado), Date.now(), ...colunasDaCacaOffline(estado), id,
  );

/** Regrava o estado de um personagem que NÃO está no jogo (ex.: recebeu uma transferência), sem mudar o `visto_em`. */
export const regravarEstadoPersonagem = (id, estado) =>
  banco.prepare('UPDATE personagens SET estado = ?, caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ?').run(
    JSON.stringify(estado), ...colunasDaCacaOffline(estado), id,
  );

/**
 * Regrava SÓ se o estado no banco ainda é `antes` (o texto lido): a rodada da
 * caçada offline pode ter gravado no meio, e passar por cima desfaria o que ela
 * avançou. Devolve `true` se gravou.
 */
export async function regravarSeNaoMudou(id, estado, antes) {
  const r = await banco
    .prepare('UPDATE personagens SET estado = ?, caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ? AND estado = ?')
    .run(JSON.stringify(estado), ...colunasDaCacaOffline(estado), id, antes);
  return !!r.changes;
}

export const excluirPersonagem =(id) => banco.prepare('DELETE FROM personagens WHERE id = ?').run(id);

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
// O que a Store vende para a CONTA (o slot de party: "comprou em um char,
// vale para todos os chars da conta").

/*
 * Lidas toda hora: o tamanho da party (`Party.limiteDeChars`) vai no
 * personagem a cada segundo, de cada jogador — era uma consulta SQL por
 * jogador por segundo, dentro do tique. Só esta função e a de baixo escrevem
 * na tabela, então o Map local nunca fica velho DENTRO deste processo.
 *
 * Camada de baixo (Redis, opcional — `game/database/redis.mjs`): sem ela,
 * nada muda. Com ela, um processo que acabou de subir não bate frio no
 * Postgres para toda conta que já foi lida por OUTRO processo (ou por este
 * mesmo, antes de reiniciar) — e é o primeiro passo para quando houver mais
 * de um processo de jogo de verdade (aí sim o Redis passa a ser necessário,
 * não só útil). TTL de 5 min é rede de segurança; quem grava já invalida na
 * hora (`gravarMelhoriasDaConta`, abaixo).
 */
const melhoriasGuardadas = new Map(); // conta -> texto JSON
const CHAVE_MELHORIAS = (contaId) => `melhoriasDaConta:${contaId}`;
const TTL_MELHORIAS_S = 300;

export async function lerMelhoriasDaConta(contaId) {
  let texto = melhoriasGuardadas.get(contaId);
  if (texto === undefined) {
    const dados = await Cache.obterOuCalcular(CHAVE_MELHORIAS(contaId), TTL_MELHORIAS_S, async () => {
      const linha = await banco.prepare('SELECT dados FROM melhorias_da_conta WHERE conta = ?').get(contaId);
      return linha ? JSON.parse(linha.dados) : {};
    });
    texto = JSON.stringify(dados);
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
  await Cache.atualizar(CHAVE_MELHORIAS(contaId), dados, TTL_MELHORIAS_S);
}
