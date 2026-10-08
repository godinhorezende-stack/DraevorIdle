// A AUDITORIA da suíte (`npm run test:auditoria`): a matriz de todos os arquivos de teste — sistema, tempo, dependências, se roda
// isolado — em `docs/testes-matriz.md`. As dependências saem do TEXTO do teste (o que ele importa e usa); o tempo, da última rodada
// (`game/testes/.saida/tempos.json`, gravado por qualquer nível); "roda isolado?", da rodada `--isolado` (cada arquivo sozinho, num
// processo, 3 por vez — `game/testes/.saida/isolado.json`). Não muda teste nenhum.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cpus } from 'node:os';
import { todosOsTestes, RAIZ_DO_JOGO } from './grafo.mjs';
import { SISTEMAS, sistemasDoTeste, baseDoTeste } from './sistemas.mjs';

const JOGO = RAIZ_DO_JOGO;
const SAIDA = join(JOGO, 'testes', '.saida');
const DOC = resolve(JOGO, '..', 'docs', 'testes-matriz.md');

/** As dependências que o texto do teste mostra (o irmão `.classico` herda as do arquivo que ele roda, mais o modo clássico). */
export const DEPENDENCIAS = [
  ['jogo inteiro', /apoio\.mjs|iniciarJogoDoPoe/],
  ['SQLite dev', /database\/(banco|db)\.mjs|websocket\/sessao\.mjs|criarConta|criarPersonagem/],
  ['SQLite próprio', /apoio-banco-proprio|DRAEVOR_SQLITE\s*=/],
  ['Postgres', /DATABASE_URL/],
  ['Redis', /REDIS_URL|database\/redis/],
  ['servidor HTTP', /backend\/index\.mjs|\.listen\(|createServer\(|fetch\(\s*[`'"]http/],
  ['sessão/WS', /websocket\/|new Sessao/],
  ['cliente', /frontend\//],
  ['temporários', /mkdtemp|tmpdir\(|DRAEVOR_OVERRIDES/],
  ['git', /git-(envio|integracao|local)|['"]git['"]/],
  ['workers/processos', /worker_threads|new Worker|SimulacaoOffline|simulacao-offline|simulador-tique|child_process|spawnSync|execFileSync/],
  ['shell', /\.sh['"`]|['"]bash['"]/],
  ['estado global', /Math\.random\s*=|Date\.now\s*=|globalThis\.\w+\s*=/],
  ['env', /process\.env\.[A-Z_]+\s*=/],
];

function dependenciasDoTeste(teste) {
  const ler = (t) => (existsSync(join(JOGO, t)) ? readFileSync(join(JOGO, t), 'utf8') : '');
  let texto = ler(teste);
  const extras = [];
  if (teste.includes('.classico.')) {
    texto += ler(teste.replace('.classico.test.mjs', '.test.mjs'));
    extras.push('modo clássico');
  }
  return [...DEPENDENCIAS.filter(([, re]) => re.test(texto)).map(([nome]) => nome), ...extras];
}

const lerJson = (f, padrao) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return padrao;
  }
};

/** Roda cada arquivo SOZINHO (um processo `node --test` por arquivo, `paralelo` por vez): passa isolado? em quanto tempo? */
async function rodarIsolado(testes, paralelo = Math.max(1, Math.min(3, cpus().length - 1))) {
  const resultado = {};
  let proximo = 0;
  let feitos = 0;
  const um = (teste) =>
    new Promise((ok) => {
      const inicio = Date.now();
      // O reporter `spec`: a falha (o nome e a mensagem) sai no stdout — guardamos o fim dele e o do stderr.
      const filho = spawn(process.execPath, ['--test', '--test-reporter=spec', teste], { cwd: JOGO, stdio: ['ignore', 'pipe', 'pipe'] });
      let erro = '';
      const guardar = (d) => (erro = (erro + d).slice(-4000));
      filho.stdout.on('data', guardar);
      filho.stderr.on('data', guardar);
      filho.on('exit', (codigo) => {
        resultado[teste] = { ok: codigo === 0, ms: Date.now() - inicio, ...(codigo === 0 ? {} : { erro: erro.split('\n').filter((l) => /✖|Error|expected|actual|at .*test\.mjs/.test(l)).slice(0, 12).join('\n') }) };
        feitos++;
        if (feitos % 25 === 0 || codigo !== 0) console.log(`  ${feitos}/${testes.length}${codigo === 0 ? '' : ` ✖ ${teste}`}`);
        ok();
      });
    });
  const trabalhador = async () => {
    while (proximo < testes.length) await um(testes[proximo++]);
  };
  await Promise.all(Array.from({ length: paralelo }, trabalhador));
  return resultado;
}

const seg = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}`);

/**
 * Os números de cada arquivo, juntando as rodadas guardadas em `.saida/`: a FULL mais recente que terminou com todos os arquivos (ou, na
 * falta dela, a medição inicial, `base-medicao-inicial.json`) e, por cima, as rodadas QUICK/SYSTEM/FULL mais novas (o boot separado dos
 * testes só existe nas rodadas com o coletor atual). `{ arquivos: {arquivo: {ms, testesMs?, testes}}, fonte, resumo }`.
 */
function dadosDasRodadas(esperados) {
  const nomes = existsSync(SAIDA) ? readdirSync(SAIDA).filter((n) => /^(full|system|quick)-.*\.json$/.test(n)).sort() : [];
  const rodadas = nomes.map((n) => ({ n, j: lerJson(join(SAIDA, n), null) })).filter((x) => x.j?.arquivos);
  const fulls = rodadas.filter((x) => x.n.startsWith('full-') && Object.keys(x.j.arquivos).length >= esperados);
  const baseDeTudo = fulls.at(-1) ?? (existsSync(join(SAIDA, 'base-medicao-inicial.json')) ? { n: 'base-medicao-inicial.json', j: lerJson(join(SAIDA, 'base-medicao-inicial.json'), null) } : null);
  const arquivos = {};
  for (const [f, a] of Object.entries(baseDeTudo?.j?.arquivos ?? {})) arquivos[f] = { ms: a.ms, testes: a.testes, testesMs: a.testesMs ?? null };
  for (const { j } of rodadas.filter((x) => x !== baseDeTudo)) for (const [f, a] of Object.entries(j.arquivos)) if (a.testesMs != null) arquivos[f] = { ms: a.ms, testes: a.testes, testesMs: a.testesMs };
  // O irmão `.classico` roda os MESMOS testes do arquivo que importa (a medição inicial os contava no outro).
  for (const [f, a] of Object.entries(arquivos)) if (f.includes('.classico.') && !a.testes) a.testes = arquivos[f.replace('.classico.test.mjs', '.test.mjs')]?.testes ?? a.testes;
  return { arquivos, fonte: baseDeTudo?.n ?? null, resumo: baseDeTudo?.j?.resumo ?? null };
}

/*
 * ---- Os mais lentos: o motivo (auditoria de 08/10/2026) ----
 * O que pesa em cada um, se dá para otimizar SEM perder cobertura, e se deve continuar pesado (é o propósito dele). Nenhum foi mudado:
 * é o diagnóstico. Arquivo fora desta lista ganha o motivo automático (a carga do jogo ou os testes, pela parte de cada um no tempo).
 */
export const MOTIVOS_DOS_LENTOS = {
  validacao: ['V5 e V6 sobem o validador da Engine de verdade: um processo à parte carrega o jogo do disco e roda `node --test` em arquivos escolhidos', 'sim — o V6 pode reaproveitar a rodada do V5 (as duas carregam o jogo do zero)', 'em parte: é integração de verdade'],
  'itens-poe-jogo': ['um teste gera milhares de peças para provar que o bicho de nível 11 só solta mod de iLvl ≤ 11', 'sim — sorteio com semente (`mulberry32`) e amostra menor com o mesmo rigor', 'não'],
  'server-save': ['carga por desenho: P2 com 5.000 créditos pendentes, P1 com 1.500 ausentes e 400 conectados', 'P1/P2 poderiam rodar só no oficial (o irmão clássico repete a carga) — decisão do dono', 'sim: mede o laço sob carga'],
  'itens-poe-pools': ['"drop de verdade": muitas mortes para provar que nenhum Raro sai sem mod', 'sim — semente fixa e amostra menor', 'não'],
  'party-limite': ['cinco jogadores na mesma caçada, tique a tique (colisão, ninguém preso)', 'pouco', 'sim: é gameplay de party de verdade'],
  'itens-poe-gemas': ['o drop do PoE amostrado (as gemas do Draevor fora) e o catálogo das 562 gemas', 'em parte — amostra com semente', 'em parte'],
  'consolidacao-offline': ['a caçada offline consolidada em worker, com o banco', 'pouco', 'sim: é o offline de verdade'],
  'simulacao-offline': ['a caçada offline numa thread à parte, 30 min tique a tique', 'pouco', 'sim'],
  'git-integracao': ['repositórios git reais numa pasta temporária', 'não', 'sim: é integração com o git'],
  'git-envio': ['repositórios git reais (envio das alterações do dono)', 'não', 'sim'],
  'encontros-etapa6': ['carga: 150 caçadas simultâneas com cinco encontros cada', 'não sem perder a medida', 'sim: mede o custo'],
  'hot-reload-cliente': ['HC2 (o renderer do cliente) leva ~15 s sozinho', 'provável — a investigar (espera de temporizador num teste de renderer)', 'não'],
  progressao: ['as curvas de experiência e as recompensas simuladas nível a nível', 'em parte', 'em parte'],
  biblioteca: ['L5 varre o catálogo inteiro procurando referência quebrada', 'pouco', 'sim: é auditoria do conteúdo inteiro'],
  'personagens-legado': ['contas e personagens no banco, entrada pela sessão de verdade', 'pouco', 'sim'],
  'loot-curva': ['a curva global de loot amostrada por faixa de nível', 'sim — semente fixa', 'não'],
  'party-follow-independente': ['party com sessões reais, follow e reagrupamento tique a tique', 'pouco', 'sim'],
  'conteudo-dos-atos': ['valida todo o conteúdo dos 4 atos (pontos andáveis e alcançáveis, economia)', 'pouco', 'sim: é a validação do conteúdo inteiro'],
  'party-persistencia': ['party gravada e lida do banco, desconexão e reinício', 'pouco', 'sim'],
  'itens-poe-arvore': ['a árvore de passivas do PoE inteira convertida e conferida', 'pouco', 'sim'],
  'party-objetivo-da-fase': ['contas e sessões reais, duas pessoas na mesma instância', 'pouco', 'em parte'],
  'relatorio-da-ausencia': ['caçada offline simulada para montar o relatório', 'pouco', 'em parte'],
  'party-volta-na-cacada': ['personagens no banco, desligamento e volta do servidor', 'pouco', 'sim'],
  'party-ver-aliados': ['duas sessões reais tique a tique', 'pouco', 'em parte'],
};
function motivoDoLento(l) {
  const base = baseDoTeste(l.teste);
  const nota = MOTIVOS_DOS_LENTOS[base];
  const classico = l.teste.includes('.classico.') ? ' (o irmão clássico: o mesmo arquivo no outro modo)' : '';
  if (nota) return [nota[0] + classico, nota[1], nota[2]];
  const boot = l.ms && l.testesMs != null ? (l.ms - l.testesMs) / l.ms : null;
  if (boot != null && boot > 0.7) return [`a carga do jogo domina (${Math.round(boot * 100)}% do tempo é boot)${classico}`, 'só junto com a carga do jogo (é o piso de todo arquivo)', 'não'];
  return [`os testes em si${classico}`, 'a avaliar', 'a avaliar'];
}

export async function auditar({ isolado = false } = {}) {
  mkdirSync(SAIDA, { recursive: true });
  const testes = todosOsTestes();
  if (isolado) {
    console.log(`Rodando cada um dos ${testes.length} arquivos sozinho…`);
    writeFileSync(join(SAIDA, 'isolado.json'), JSON.stringify(await rodarIsolado(testes), null, 1));
  }
  const tempos = lerJson(join(SAIDA, 'tempos.json'), {});
  const isolados = lerJson(join(SAIDA, 'isolado.json'), {});
  const full = dadosDasRodadas(testes.length);
  const linhas = testes.map((t) => {
    const daFull = full.arquivos[t];
    return {
      teste: t,
      sistemas: sistemasDoTeste(t),
      ms: daFull?.ms ?? tempos[t] ?? null,
      testesMs: daFull?.testesMs ?? null,
      nTestes: daFull?.testes ?? null,
      msIsolado: isolados[t]?.ms ?? null,
      deps: dependenciasDoTeste(t),
      isolado: isolados[t] ? (isolados[t].ok ? 'sim' : `intermitente — falhou 1× na rodada isolada${isolados[t].erro ? ` (${isolados[t].erro.split('\n')[0].slice(0, 80)})` : ''}`) : 'não medido',
    };
  });
  const porSistema = Object.keys(SISTEMAS).map((id) => {
    const deles = linhas.filter((l) => l.sistemas.includes(id));
    return { id, nome: SISTEMAS[id].nome, arquivos: deles.length, ms: deles.reduce((a, l) => a + (l.ms ?? 0), 0) };
  });
  const porDependencia = [...DEPENDENCIAS.map(([n]) => n), 'modo clássico'].map((n) => ({ n, q: linhas.filter((l) => l.deps.includes(n)).length }));
  const lentos = [...linhas].filter((l) => l.ms != null).sort((a, b) => b.ms - a.ms).slice(0, 20);
  const total = linhas.reduce((a, l) => a + (l.ms ?? 0), 0);
  const totalTestes = linhas.reduce((a, l) => a + (l.testesMs ?? 0), 0);
  const falhamSozinhos = linhas.filter((l) => l.isolado.startsWith('intermitente'));
  const md = [
    '# Matriz dos testes',
    '',
    `Gerada por \`npm run test:auditoria\` (${new Date().toISOString().slice(0, 16).replace('T', ' ')}). Estratégia: [testes-por-nivel.md](testes-por-nivel.md).`,
    '',
    `- **Arquivos de teste:** ${testes.length} (${testes.filter((t) => !t.includes('.classico.')).length} do jogo oficial + ${testes.filter((t) => t.includes('.classico.')).length} irmãos \`.classico\`).`,
    `- **Soma dos tempos por arquivo:** ${(total / 60_000).toFixed(1)} min (cada arquivo num processo)${full.fonte ? `; base: \`${full.fonte}\` (${full.resumo?.tests} testes, parede ${(full.resumo?.ms / 60_000).toFixed(1)} min)` : ''}. Boot × testes medido em ${linhas.filter((l) => l.testesMs != null).length} arquivos (as rodadas com o coletor atual): BOOT ${(linhas.filter((l) => l.testesMs != null).reduce((a, l) => a + l.ms - l.testesMs, 0) / 60_000).toFixed(1)} min + TESTS ${(totalTestes / 60_000).toFixed(1)} min.`,
    `- **Rodam isolados:** ${Object.keys(isolados).length ? `${linhas.filter((l) => l.isolado === 'sim').length} de ${testes.length} passaram sozinhos na rodada isolada${falhamSozinhos.length ? `; falharam uma vez: ${falhamSozinhos.map((l) => baseDoTeste(l.teste)).join(', ')} (intermitente: passou em todas as repetições seguintes — ver testes-por-nivel.md)` : ''}` : 'não medido (rode `npm run test:auditoria -- --isolado`)'}.`,
    '',
    '## Por sistema',
    '',
    '| Sistema | Arquivos | Tempo somado (s) |',
    '|---|---:|---:|',
    ...porSistema.map((s) => `| \`${s.id}\` — ${s.nome} | ${s.arquivos} | ${seg(s.ms)} |`),
    '',
    '## Por dependência',
    '',
    '| Dependência | Arquivos |',
    '|---|---:|',
    ...porDependencia.map((d) => `| ${d.n} | ${d.q} |`),
    '',
    '## TOP 20 — os arquivos mais lentos',
    '',
    'Tempo = parede do arquivo na FULL (BOOT = carga do jogo no processo; TESTES = os testes em si). Nenhum foi mudado, pulado ou ganhou timeout: é o diagnóstico.',
    '',
    '| # | Arquivo | Total (s) | Boot (s) | Testes (s) | Nº testes | Dependências | Motivo provável | Dá para otimizar? | Deve continuar pesado? |',
    '|---:|---|---:|---:|---:|---:|---|---|---|---|',
    ...lentos.map((l, i) => {
      const [motivo, otimizar, pesado] = motivoDoLento(l);
      return `| ${i + 1} | \`${l.teste.replace('testes/', '')}\` | ${seg(l.ms)} | ${seg(l.testesMs == null ? null : l.ms - l.testesMs)} | ${seg(l.testesMs)} | ${l.nTestes ?? '—'} | ${l.deps.join(', ')} | ${motivo} | ${otimizar} | ${pesado} |`;
    }),
    '',
    '## Todos',
    '',
    '| Teste | Sistema | Tempo (s) | Boot (s) | Testes | Dependências | Pode rodar isolado? |',
    '|---|---|---:|---:|---:|---|---|',
    ...linhas.map((l) => `| \`${baseDoTeste(l.teste)}${l.teste.includes('.classico.') ? '.classico' : ''}\` | ${l.sistemas.join(', ')} | ${seg(l.ms)} | ${seg(l.testesMs == null ? null : l.ms - l.testesMs)} | ${l.nTestes ?? '—'} | ${l.deps.join(', ') || '—'} | ${l.isolado} |`),
    '',
  ].join('\n');
  writeFileSync(DOC, md);
  console.log(`Matriz: ${DOC} (${testes.length} arquivos; ${Object.keys(tempos).length ? 'com' : 'sem'} tempos; ${Object.keys(isolados).length ? 'com' : 'sem'} a rodada isolada)`);
  return 0;
}
