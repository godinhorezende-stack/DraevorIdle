// PRESENTE da equipe para todas as contas (Draevor Coins, gold), uma vez por
// conta e por chave.
//
// O dono: "todas as contas ganham 10000 de Draevor coins" — uma vez por
// CONTA — e depois: "não pode ser nos personagens online e não no mais
// antigo?". Então o presente fica NA CONTA, pendente, e cai no personagem que
// a pessoa estiver usando:
//   - online agora: o relógio daqui (`ligar`, a cada VERIFICAR_MS) credita na
//     hora, avisa no chat e grava o personagem;
//   - offline: no login, no personagem com que ela entrar (`receberNaEntrada`).
// Quem pega o presente o "reivindica" com um UPDATE ... WHERE recebido_em IS
// NULL: dois personagens da mesma conta nunca recebem os dois.
//
// A `chave` (ex.: "coins-10k-2026-09-30") fica anotada por conta em
// `presentes_entregues`: rodar a ferramenta de novo não dá duas vezes.
import { banco } from '../database/banco.mjs';
import './mercado.mjs'; // a tabela `creditos` (com `origem`) — a da primeira versão, migrada abaixo

const BIGINT = banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER';
await banco.exec(`
  CREATE TABLE IF NOT EXISTS presentes_entregues (
    chave TEXT NOT NULL, conta TEXT NOT NULL, personagem TEXT NOT NULL, coins INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, em ${BIGINT} NOT NULL,
    PRIMARY KEY (chave, conta)
  );
`);

/*
 * Colunas da versão "na conta" (nascem em banco que já existe):
 *   modo        'fila' = a primeira versão (crédito na fila do personagem mais
 *               antigo); 'conta' = pendente na conta, para quem estiver jogando.
 *   recebido_em / recebido_por: quando e em qual personagem caiu.
 */
async function coluna(nome, tipo) {
  try {
    if (banco.dialeto === 'sqlite') {
      const tem = (await banco.prepare('PRAGMA table_info(presentes_entregues)').all()).some((c) => c.name === nome);
      if (!tem) await banco.exec(`ALTER TABLE presentes_entregues ADD COLUMN ${nome} ${tipo}`);
    } else {
      await banco.exec(`ALTER TABLE presentes_entregues ADD COLUMN IF NOT EXISTS ${nome} ${tipo}`);
    }
  } catch (e) {
    if (!/duplicate column|already exists/i.test(e?.message ?? '')) throw e;
  }
}
await coluna('modo', "TEXT DEFAULT 'fila'");
await coluna('recebido_em', BIGINT);
await coluna('recebido_por', 'TEXT');

/*
 * ---- A primeira versão (30/09) ia para a fila de créditos do personagem mais antigo ----
 * O que ainda está na fila volta para a conta (pendente); o que a fila já
 * entregou num login fica marcado como recebido. Roda no boot, uma vez por
 * linha (depois dela o `modo` é 'conta').
 */
export async function migrarDaFila(agora = Date.now()) {
  const antigas = await banco.prepare("SELECT chave, conta, personagem, coins, gold, em FROM presentes_entregues WHERE modo = 'fila'").all();
  for (const p of antigas) {
    await banco.transacao(async () => {
      const r = await banco.prepare("DELETE FROM creditos WHERE personagem = ? AND origem = 'presente' AND coins = ? AND gold = ?").run(p.personagem, p.coins, p.gold);
      if (r.changes) {
        await banco.prepare("UPDATE presentes_entregues SET modo = 'conta' WHERE chave = ? AND conta = ?").run(p.chave, p.conta);
      } else {
        // A fila já tinha entregado no login: recebido, no personagem de lá.
        await banco.prepare("UPDATE presentes_entregues SET modo = 'conta', recebido_em = ?, recebido_por = ? WHERE chave = ? AND conta = ?").run(p.em ?? agora, p.personagem, p.chave, p.conta);
      }
    });
  }
  return antigas.length;
}
await migrarDaFila();

/**
 * O plano: uma linha por conta que tem personagem (o nome é só para a lista —
 * quem recebe é o personagem que estiver jogando), e se ela já tem este presente.
 */
export async function plano(chave) {
  const personagens = await banco.prepare('SELECT id, conta, nome, criado_em FROM personagens ORDER BY criado_em ASC, nome ASC').all();
  const jaTem = new Set((await banco.prepare('SELECT conta FROM presentes_entregues WHERE chave = ?').all(chave)).map((r) => r.conta));
  const porConta = new Map();
  for (const p of personagens) {
    const linha = porConta.get(p.conta) ?? { conta: p.conta, nomes: [], jaRecebeu: jaTem.has(p.conta) };
    linha.nomes.push(p.nome);
    porConta.set(p.conta, linha);
  }
  return [...porConta.values()].map((l) => ({ ...l, nome: l.nomes.join(' / ') }));
}

/**
 * Deixa o presente pendente em cada conta (ou só mostra, com `gravar: false`).
 * A entrega é de quem estiver jogando: `receberNaEntrada` e o relógio de `ligar`.
 */
export async function presentear({ chave, coins = 0, gold = 0, gravar = false, agora = Date.now() }) {
  if (!chave || !/^[a-z0-9-]{3,60}$/.test(chave)) throw new Error('chave inválida (use letras minúsculas, números e -)');
  if (!(coins > 0 || gold > 0)) throw new Error('nada para dar (coins ou gold)');
  const linhas = await plano(chave);
  for (const l of linhas) {
    if (l.jaRecebeu || !gravar) continue;
    await banco.prepare("INSERT INTO presentes_entregues (chave, conta, personagem, coins, gold, em, modo) VALUES (?, ?, '', ?, ?, ?, 'conta')").run(chave, l.conta, coins, gold, agora);
    l.entregue = true;
  }
  return linhas;
}

/**
 * Os presentes pendentes da conta, reivindicados para este personagem — cada um
 * uma vez só (o UPDATE só pega o que ainda está sem dono). `{ coins, gold }`.
 */
export async function reivindicar(conta, personagemId, agora = Date.now()) {
  const pendentes = await banco.prepare("SELECT chave, coins, gold FROM presentes_entregues WHERE conta = ? AND modo = 'conta' AND recebido_em IS NULL").all(conta);
  let coins = 0;
  let gold = 0;
  for (const p of pendentes) {
    const r = await banco.prepare('UPDATE presentes_entregues SET recebido_em = ?, recebido_por = ? WHERE chave = ? AND conta = ? AND recebido_em IS NULL').run(agora, personagemId, p.chave, conta);
    if (!r.changes) continue;
    coins += Number(p.coins) || 0;
    gold += Number(p.gold) || 0;
  }
  return { coins, gold };
}

const avisoDe = ({ coins, gold }) => {
  const partes = [coins && `${coins.toLocaleString('pt-BR')} Draevor Coins`, gold && `${gold.toLocaleString('pt-BR')} gold`].filter(Boolean);
  return partes.length ? `Presente do Draevor: você recebeu ${partes.join(' e ')}.` : null;
};

/** No login: os presentes pendentes da conta caem neste personagem. Devolve o aviso, ou null. */
export async function receberNaEntrada(estado, conta, personagemId) {
  if (!conta || !personagemId) return null;
  const ganho = await reivindicar(conta, personagemId);
  estado.coins = (estado.coins ?? 0) + ganho.coins;
  estado.gold = (estado.gold ?? 0) + ganho.gold;
  return avisoDe(ganho);
}

/*
 * ---- Quem já está jogando recebe na hora ----
 * A cada VERIFICAR_MS, cada sessão com personagem aberto reivindica os
 * presentes da conta dela: soma no estado VIVO (a sessão é quem grava — mexer
 * no banco por fora seria sobrescrito), avisa no chat, manda o estado novo e
 * grava o personagem na hora.
 */
export const VERIFICAR_MS = 15_000;
let relogio = null;
let rodando = false;

export async function verificarOnline(vivas) {
  if (rodando) return 0;
  rodando = true;
  let entregues = 0;
  try {
    for (const s of vivas.values()) {
      if (!s?.conta?.id || !s.personagem || !s.estado || s.carregando) continue;
      const ganho = await reivindicar(s.conta.id, s.personagem.id);
      if (!ganho.coins && !ganho.gold) continue;
      s.estado.coins = (s.estado.coins ?? 0) + ganho.coins;
      s.estado.gold = (s.estado.gold ?? 0) + ganho.gold;
      entregues++;
      s.enviar?.({ t: 'chat', aviso: true, channel: 'global', text: avisoDe(ganho) });
      s.mandarEstado?.();
      await s.gravarAgora?.().catch((e) => console.error('presente -> gravar', e.message));
    }
  } catch (e) {
    console.error('presentes ->', e.message);
  } finally {
    rodando = false;
  }
  return entregues;
}

/** Liga à lista de sessões vivas (o servidor chama no boot). */
export function ligar(vivas) {
  if (relogio) return;
  relogio = setInterval(() => verificarOnline(vivas), VERIFICAR_MS);
  relogio.unref();
}
