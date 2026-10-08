// APAGAR OS PERSONAGENS ARQUIVADOS (dono, 08/10: "apague todos personagens arquivados") — revoga a decisão de 07/10 de deixá-los guardados.
// Arquivado = personagem do Draevor clássico no jogo oficial (`personagem/legado.mjs`: nem `sistema: 'poe'` nem o cinto de frascos do PoE).
// Apaga o PERSONAGEM inteiro (com o ouro, os itens e as coins que estavam nele), pelo mesmo `DELETE` do botão "Excluir personagem" do jogo.
// As CONTAS ficam. Os personagens do PoE não são tocados.
//
// Quem roda é o DONO, em produção, de dentro do container do jogo (o banco é o Postgres de lá):
//   1. /srv/draevor/bin/backup.sh                                   (backup antes — sempre)
//   2. ... exec -T game node game/admin/apagar-arquivados.mjs       (SÓ LISTA: quantos, de quantas contas, quem)
//   3. ... exec -T game node game/admin/apagar-arquivados.mjs --apagar --confirmo=N
//      N = o número que o passo 2 mostrou. Se não bater (alguém virou arquivado ou saiu da lista no meio), nada é apagado.
import { ligado } from '../systems/itens-poe/catalogo.mjs';
import { sqlDoPoe } from '../systems/personagem/legado.mjs';

const args = process.argv.slice(2);
const apagar = args.includes('--apagar');
const confirmo = Number(args.find((a) => a.startsWith('--confirmo='))?.split('=')[1]);

function sair(codigo, texto) {
  console.log(texto);
  process.exit(codigo);
}

if (!ligado()) sair(1, 'O jogo está no Draevor clássico (DRAEVOR_CLASSICO=1) ou sem os dados do PoE: aí ninguém é arquivado. Nada foi feito.');

const B = await import('../database/banco.mjs');
const banco = B.banco;
const lerArquivados = async () => {
  // NÃO é `NOT (regra do PoE)`: sem `sistema` e sem `frascos` (justamente o arquivado) a regra dá NULL, e `NOT NULL` também — a linha sumiria.
  const linhas = await banco.prepare(`SELECT id, nome, conta, estado FROM personagens WHERE (CASE WHEN ${sqlDoPoe(banco.dialeto)} THEN 1 ELSE 0 END) = 0 ORDER BY nome`).all();
  return linhas.map((l) => {
    let e = {};
    try { e = JSON.parse(l.estado); } catch { /* estado ilegível: lista assim mesmo */ }
    return { id: l.id, nome: l.nome, conta: l.conta, level: e.level ?? '?', ouro: e.gold ?? 0 };
  });
};

const lista = await lerArquivados();
const contas = new Set(lista.map((p) => p.conta)).size;
console.log(`Personagens arquivados: ${lista.length}, de ${contas} conta(s). Banco: ${banco.dialeto}.`);
for (const p of lista) console.log(`  ${p.nome} · level ${p.level} · ouro ${p.ouro} · conta ${String(p.conta).slice(0, 8)}`);

if (!apagar) sair(0, `\nNada foi apagado (só a lista). Para apagar: faça o backup e rode de novo com --apagar --confirmo=${lista.length}`);
if (!lista.length) sair(0, 'Nenhum arquivado: nada a apagar.');
if (confirmo !== lista.length) sair(1, `\nRecusado: --confirmo=${Number.isFinite(confirmo) ? confirmo : '(faltou)'} não é ${lista.length}, o número da lista de agora. Nada foi apagado.`);

let apagados = 0;
await banco.transacao(async () => {
  for (const p of lista) {
    await B.excluirPersonagem(p.id);
    apagados++;
  }
});
const sobraram = (await lerArquivados()).length;
sair(0, `\nApagados: ${apagados} personagem(ns) arquivado(s). Arquivados que sobraram: ${sobraram}. As contas continuam.`);
