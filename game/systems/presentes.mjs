// PRESENTE da equipe para todas as contas (Draevor Coins, gold), uma vez por
// conta e por chave.
//
// O dono: "todas as contas ganham 10000 de Draevor coins" — uma vez por
// CONTA, no personagem mais antigo dela (as coins são de cada personagem).
//
// Entra pela mesma fila do Mercado (`creditos`, com `origem = 'presente'`): o
// personagem recebe no próximo login, com o aviso de presente. Mexer no saldo
// direto no banco perderia o de quem está online — a sessão grava o estado da
// memória por cima. A `chave` (ex.: "coins-10k-2026-09-30") fica anotada por
// conta em `presentes_entregues`: rodar de novo não dá duas vezes.
import { banco } from '../database/banco.mjs';
import './mercado.mjs'; // garante a tabela `creditos` com a coluna `origem`

await banco.exec(`
  CREATE TABLE IF NOT EXISTS presentes_entregues (
    chave TEXT NOT NULL, conta TEXT NOT NULL, personagem TEXT NOT NULL, coins INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, em ${banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER'} NOT NULL,
    PRIMARY KEY (chave, conta)
  );
`);

/**
 * O plano: uma linha por conta que tem personagem — o mais antigo dela — e se
 * ela já recebeu este presente (`chave`).
 */
export async function plano(chave) {
  const personagens = await banco.prepare('SELECT id, conta, nome, criado_em FROM personagens ORDER BY criado_em ASC, nome ASC').all();
  const jaReceberam = new Set((await banco.prepare('SELECT conta FROM presentes_entregues WHERE chave = ?').all(chave)).map((r) => r.conta));
  const porConta = new Map();
  for (const p of personagens) if (!porConta.has(p.conta)) porConta.set(p.conta, p);
  return [...porConta.values()].map((p) => ({ conta: p.conta, personagem: p.id, nome: p.nome, jaRecebeu: jaReceberam.has(p.conta) }));
}

/**
 * Entrega (ou só mostra, com `gravar: false`). Numa transação por conta: o
 * crédito e a anotação da chave entram juntos. Devolve o plano com o que foi feito.
 */
export async function presentear({ chave, coins = 0, gold = 0, gravar = false, agora = Date.now() }) {
  if (!chave || !/^[a-z0-9-]{3,60}$/.test(chave)) throw new Error('chave inválida (use letras minúsculas, números e -)');
  if (!(coins > 0 || gold > 0)) throw new Error('nada para dar (coins ou gold)');
  const linhas = await plano(chave);
  for (const l of linhas) {
    if (l.jaRecebeu || !gravar) continue;
    await banco.transacao(async () => {
      // A anotação primeiro: se outra execução já anotou, a chave primária recusa e nada é creditado.
      await banco.prepare('INSERT INTO presentes_entregues (chave, conta, personagem, coins, gold, em) VALUES (?, ?, ?, ?, ?, ?)').run(chave, l.conta, l.personagem, coins, gold, agora);
      await banco.prepare("INSERT INTO creditos (personagem, gold, coins, itens, origem) VALUES (?, ?, ?, '[]', 'presente')").run(l.personagem, gold, coins);
    });
    l.entregue = true;
  }
  return linhas;
}
