// O Histórico da loja — o botão "Histórico" no rodapé da Store (`abrirHistoricoDaLoja`,
// panels.mjs), que manda `{t:'historicoDaLoja'}` e espera `{t:'historicoDaLoja', linhas}`.
//
// O client já existia e o servidor nunca respondeu: o pedido caía no `default`
// silencioso de `Sessao.despachar` e a janela ficava para sempre em "Carregando o
// histórico...". E não havia o que responder: a compra só deixava um contador
// por produto (`estado.compras`), sem data nem preço. Agora cada compra que de
// fato cobrou coins vira uma linha aqui, gravada dentro da MESMA transação da
// compra (`emTransacao`, sessao.mjs) — ou a compra e a linha ficam, ou nenhuma.
//
// O histórico é da CONTA, como as coins que se veem na loja por qualquer
// personagem dela: cada linha diz de qual personagem saiu (a janela mostra
// "Compra na loja · Nome"). Compras feitas antes deste registro existir não
// têm data nem preço guardados em lugar nenhum, então não aparecem — nada é
// reconstruído nem inventado.
import { banco } from '../database/banco.mjs';

const idAuto = banco.dialeto === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const inteiroGrande = banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER';
await banco.exec(`
  CREATE TABLE IF NOT EXISTS loja_historico (
    id ${idAuto}, conta TEXT NOT NULL, personagem TEXT NOT NULL, nome TEXT NOT NULL,
    tipo TEXT NOT NULL, produto TEXT NOT NULL, titulo TEXT NOT NULL, imagem TEXT,
    coins INTEGER NOT NULL, at ${inteiroGrande} NOT NULL
  );
  CREATE INDEX IF NOT EXISTS loja_historico_conta ON loja_historico(conta, at);
`);

/** Quantas linhas a janela recebe: as mais recentes. */
export const LIMITE = 50;

/**
 * Uma compra que cobrou `coins` (positivo: o que saiu do saldo). `titulo` e
 * `imagem` vão gravados como estavam na hora — um produto que saia da loja
 * depois continua com nome no histórico.
 */
export async function registrarCompra({ conta, personagem, nome, produto, titulo, imagem = null, coins, at = Date.now() }) {
  await banco
    .prepare('INSERT INTO loja_historico (conta, personagem, nome, tipo, produto, titulo, imagem, coins, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(conta, personagem, nome, 'compra', produto, titulo, imagem ? JSON.stringify(imagem) : null, -Math.abs(coins), at);
}

/** As últimas `limite` linhas da conta, a mais recente primeiro — no formato que `abrirHistoricoDaLoja` desenha. */
export async function ultimas(conta, limite = LIMITE) {
  const linhas = await banco
    .prepare('SELECT * FROM loja_historico WHERE conta = ? ORDER BY at DESC, id DESC LIMIT ?')
    .all(conta, limite);
  return linhas.map((l) => ({
    tipo: l.tipo,
    titulo: l.titulo,
    produto: l.produto,
    personagem: l.nome,
    imagem: l.imagem ? JSON.parse(l.imagem) : null,
    coins: Number(l.coins),
    em: Number(l.at),
  }));
}
