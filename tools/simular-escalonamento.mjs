// Compara os modelos de escalonamento da dificuldade (`game/systems/hunt/escalonamento.mjs`) com um modelo de tempo de limpeza:
// 4 setores de trabalho W cada; jogadores iguais (dano 1/s por jogador); o tempo para limpar um setor com `k` jogadores nele é
// (vida do bicho × W) / k. Quanto MENOR o tempo relativo ao jogador solo (4 W), mais a party ganha de cooperar.
//   node tools/simular-escalonamento.mjs
import { ESCALONAMENTO, fatoresPara, jogadoresQueOBichoSente } from '../game/systems/hunt/escalonamento.mjs';

const W = 100;
const modelos = ['setor', 'ativos', 'total'];
const cenarios = [
  ['todos juntos (1 grupo)', (N) => [N, 0, 0, 0]],
  ['dois grupos', (N) => [Math.ceil(N / 2), Math.floor(N / 2), 0, 0]],
  ['um por setor', (N) => [1, 1, 1, 1].map((v, i) => (i < N ? v : 0))],
];
console.log('Tempo para limpar os 4 setores (W=100 cada), relativo ao SOLO (=1,00). Vida +30%/jogador extra nos normais (o dano não escala).\n');
for (const N of [2, 3, 4, 5]) {
  console.log(`== ${N} jogadores ==`);
  for (const [nome, distribui] of cenarios) {
    const linha = [];
    for (const modelo of modelos) {
      const grupos = distribui(N).filter((k) => k > 0);
      // Cada grupo limpa o(s) seu(s) setor(es) em paralelo; os setores sobrando são limpos depois pelo grupo todo.
      let tempo = 0;
      const ocupados = grupos.length;
      for (const k of grupos) {
        const n = jogadoresQueOBichoSente({ modelo, tipo: 'normal', noSetor: k, ativos: N, total: N, pesoDeFora: ESCALONAMENTO.pesoDeFora });
        tempo = Math.max(tempo, (fatoresPara('normal', n).vida * W) / k);
      }
      const restantes = 4 - ocupados;
      for (let r = 0; r < restantes; r++) {
        const n = jogadoresQueOBichoSente({ modelo, tipo: 'normal', noSetor: N, ativos: N, total: N, pesoDeFora: ESCALONAMENTO.pesoDeFora });
        tempo += (fatoresPara('normal', n).vida * W) / N;
      }
      linha.push(`${modelo} ${(tempo / (4 * W)).toFixed(2)}`);
    }
    console.log(`  ${nome.padEnd(24)} ${linha.join('   ')}`);
  }
}
console.log('\nChefe (vida × dano) com a party ativa inteira, por número de jogadores:');
for (const N of [1, 2, 3, 4, 5]) {
  const f = fatoresPara('boss', N);
  console.log(`  ${N}: vida ×${f.vida.toFixed(2)}  dano ×${f.dano.toFixed(2)}  (dano do chefe não muda; dano da party ×${N} ⇒ chefe morre em ${(f.vida / N).toFixed(2)} do tempo solo)`);
}
