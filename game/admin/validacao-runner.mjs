// O PROCESSO DAS VERIFICAÇÕES: carrega o jogo do disco (o que o servidor carregaria no boot), roda cada verificação de `validacao-verificacoes.mjs` e imprime o
// resultado como JSON depois de um marcador. Roda à parte do servidor da Engine (não trava o laço do jogo e não vê o estado em memória: vê o ARQUIVO).
import { criarVerificacoes } from './validacao-verificacoes.mjs';

const MARCADOR = '@@VALIDACAO@@';
const avisosDeCarga = [];
const aviso = console.warn;
console.warn = (...a) => { avisosDeCarga.push(a.join(' ')); };
const log = console.log;
console.log = () => {}; // o boot dos módulos é falante; só o marcador interessa
const falhas = [];
for (const m of ['../systems/dados.mjs', '../systems/poderes.mjs', '../systems/campanha.mjs']) {
  try { await import(m); } catch (e) { falhas.push(`${m}: ${e.message}`); }
}
console.warn = aviso;
const verificacoes = [];
for (const v of criarVerificacoes()) {
  const t0 = Date.now();
  let r;
  try { r = await v.rodar({ overrides: process.env.DRAEVOR_OVERRIDES || null, avisosDeCarga }); } catch (e) { r = { achados: [{ nivel: 'erro', onde: v.id, mensagem: `a verificação falhou ao executar: ${e.message}` }] }; }
  verificacoes.push({ id: v.id, modulo: v.modulo, titulo: v.titulo, achados: r.achados ?? [], detalhe: r.detalhe ?? null, ms: Date.now() - t0 });
}
if (falhas.length) verificacoes.unshift({ id: 'carga-falhou', modulo: 'geral', titulo: 'Carga dos módulos do jogo', achados: falhas.map((m) => ({ nivel: 'erro', onde: 'boot', mensagem: `o jogo não carregou: ${m}` })), detalhe: null, ms: 0 });
console.log = log;
process.stdout.write(`\n${MARCADOR}${JSON.stringify(verificacoes)}\n`);
process.exit(0);
