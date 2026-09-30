// Presente da equipe para TODAS as contas: uma vez por conta, pendente NA
// CONTA — cai no personagem que estiver jogando (na hora, se estiver online;
// senão no login), com o aviso "Presente do Draevor". Ver `systems/presentes.mjs`.
//
//   node game/admin/presentear.mjs --chave coins-10k-2026-09-30 --coins 10000            # só mostra
//   node game/admin/presentear.mjs --chave coins-10k-2026-09-30 --coins 10000 --gravar   # entrega
//
// A mesma `--chave` nunca entrega duas vezes para a mesma conta.
import { presentear } from '../systems/presentes.mjs';

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const chave = arg('chave');
const coins = Math.floor(Number(arg('coins') ?? 0));
const gold = Math.floor(Number(arg('gold') ?? 0));
const gravar = process.argv.includes('--gravar');

const linhas = await presentear({ chave, coins, gold, gravar });
const novas = linhas.filter((l) => !l.jaRecebeu);
for (const l of linhas) console.log(`${l.jaRecebeu ? 'já tem      ' : gravar ? 'PENDENTE    ' : 'vai receber '}  conta de ${l.nome}`);
console.log(`\n${gravar ? 'Deixado na conta' : 'Seria deixado na conta'}: ${novas.length} conta(s) × ${coins.toLocaleString('pt-BR')} coins${gold ? ` + ${gold.toLocaleString('pt-BR')} gold` : ''}` +
  ` = ${(novas.length * coins).toLocaleString('pt-BR')} coins · já tinham recebido: ${linhas.length - novas.length}` +
  (gravar ? '' : '\n(nada foi gravado — rode com --gravar para entregar)'));
process.exit(0);
