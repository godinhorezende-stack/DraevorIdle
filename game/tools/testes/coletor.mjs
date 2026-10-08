// O COLETOR dos testes: um reporter do `node --test` (`--test-reporter=game/tools/testes/coletor.mjs`). Na saída dele sai uma linha por
// ARQUIVO terminado (✔/✖, testes, tempo de parede — o carregamento do jogo incluído); no fim, o JSON da rodada vai para o arquivo de
// `DRAEVOR_TESTES_JSON` (quem lê é `testar.mjs`): o tempo e as contagens de cada arquivo, o de cada teste e as falhas com a mensagem.
// O detalhe completo (o reporter `spec`) vai para o log da rodada.
//
// As contagens de cada arquivo vêm do RESUMO dele (`test:summary` com o arquivo de entrada): o irmão `.classico` declara os testes no
// arquivo que ele importa, e os eventos de cada teste trazem o arquivo da declaração — contando por eles, o irmão ficaria com 0 e o
// outro com o dobro. O resumo do arquivo e o fim dele chegam em qualquer ordem: a linha sai quando os dois chegaram.
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

const relativo = (f) => (f ? relative(process.cwd(), f) : '');
/** O evento é o do ARQUIVO inteiro (o `test:complete` cujo nome é o próprio caminho), não o de um teste dele. */
const ehDoArquivo = (d) => !!d?.file && (d.nesting ?? 0) === 0 && relativo(d.file) === String(d.name ?? '').replace(/^\.\//, '');
const mensagem = (erro) => {
  const e = erro?.cause ?? erro;
  return String(e?.message ?? e ?? '').split('\n').slice(0, 6).join('\n');
};

export default async function* coletor(fonte) {
  const inicio = Date.now();
  const arquivos = {};
  const testes = [];
  const falhas = [];
  let resumo = null;
  const doArquivo = (f) => (arquivos[f] ??= { ms: null, testesMs: 0, testes: 0, passou: 0, falhou: 0, pulou: 0, todo: 0, resumido: false, mostrado: false });
  const linha = (f, a) => {
    a.mostrado = true;
    return `${a.falhou || a.falhaDoArquivo ? '✖' : '✔'} ${f}  (${a.testes} testes${a.falhou ? `, ${a.falhou} falha${a.falhou > 1 ? 's' : ''}` : ''}${a.pulou ? `, ${a.pulou} pulados` : ''}, ${((a.ms ?? 0) / 1000).toFixed(1)} s)\n`;
  };
  for await (const ev of fonte) {
    const d = ev.data ?? {};
    if (ev.type === 'test:complete' && ehDoArquivo(d)) {
      const f = relativo(d.file);
      const a = doArquivo(f);
      a.ms = Math.round(d.details?.duration_ms ?? 0);
      // O arquivo que nem carregou (erro de import, processo que caiu) falha aqui, sem teste nenhum.
      if (d.details?.passed === false) {
        a.falhaDoArquivo = true;
        if (!a.falhou) falhas.push({ arquivo: f, linha: null, nome: '(o arquivo inteiro)', erro: mensagem(d.details?.error) });
      }
      if (a.resumido && !a.mostrado) yield linha(f, a);
      continue;
    }
    // O resumo de UM arquivo: as contagens dele (as do arquivo de entrada).
    if (ev.type === 'test:summary' && (d.entryFile || d.file)) {
      const f = relativo(d.entryFile ?? d.file);
      const a = doArquivo(f);
      const c = d.counts ?? {};
      // `duration_ms` do resumo do arquivo: só os testes (sem a carga do jogo) — o boot é o tempo de parede menos isto.
      Object.assign(a, { testes: c.tests ?? 0, passou: c.passed ?? 0, falhou: c.failed ?? 0, pulou: c.skipped ?? 0, todo: c.todo ?? 0, testesMs: Math.round(d.duration_ms ?? 0), resumido: true });
      if (a.ms != null && !a.mostrado) yield linha(f, a);
      continue;
    }
    // Cada teste: o tempo, o status e, se falhou, a mensagem (com o arquivo e a linha da DECLARAÇÃO).
    if (ev.type === 'test:complete' && d.file && d.details?.type !== 'suite') {
      const status = d.details?.passed === false ? (d.todo ? 'todo' : 'falhou') : d.skip ? 'pulou' : d.todo ? 'todo' : 'passou';
      testes.push({ arquivo: relativo(d.file), nome: d.name, linha: d.line ?? null, ms: Math.round((d.details?.duration_ms ?? 0) * 10) / 10, status, ...(d.skip ? { motivo: String(d.skip) } : {}) });
      if (status === 'falhou') falhas.push({ arquivo: relativo(d.file), linha: d.line ?? null, nome: d.name, erro: mensagem(d.details?.error) });
      continue;
    }
    // O resumo GERAL (o `test:summary` sem arquivo): as contagens do próprio node.
    if (ev.type === 'test:summary' && !d.file && !d.entryFile) resumo = { ...d.counts, ms: Math.round(d.duration_ms ?? 0), sucesso: d.success };
  }
  for (const [f, a] of Object.entries(arquivos)) if (!a.mostrado && a.ms != null) yield linha(f, a);
  for (const a of Object.values(arquivos)) delete a.mostrado, delete a.resumido;
  const destino = process.env.DRAEVOR_TESTES_JSON;
  if (destino) writeFileSync(destino, JSON.stringify({ inicio, fim: Date.now(), resumo, arquivos, testes, falhas }));
}
