// Gera o INVENTÁRIO VERIFICÁVEL da auditoria da árvore de passivas do PoE (`admin/auditoria-arvore-passivas.mjs`):
// `docs/auditorias/arvore-passivas-poe-inventario.md` — o resumo, as matrizes por forma e por tipo de modificador, as causas técnicas
// agrupadas (com quantos nós cada uma afeta e exemplos) e a lista dos nós parciais/sem efeito por categoria. O relatório
// (`docs/auditorias/arvore-passivas-poe.md`) cita os números daqui; para conferir, rode de novo.
//
// Uso (na pasta game/): ITENS_POE=1 node tools/auditar-arvore-passivas.mjs [--rapido]
//   --rapido: sem alocar nó por nó no motor (só dados e leitura estática).
process.env.ITENS_POE ??= '1';
const { writeFileSync, mkdirSync } = await import('node:fs');
const A = await import('../admin/auditoria-arvore-passivas.mjs');
const { temaDaLinha } = await import('../systems/itens-poe/precisa-arvore.mjs');

const cobertura = await import('../testes/cobertura-arvore.mjs');
const rapido = process.argv.includes('--rapido');
const inicio = Date.now();
const r = A.auditarArvore({ verificar: !rapido, cobertura });
if (r.ok === false) throw new Error(r.erro);
const DESTINO = new URL('../../docs/auditorias/arvore-passivas-poe-inventario.md', import.meta.url);
mkdirSync(new URL('.', DESTINO), { recursive: true });

const SITUACOES = ['funcional', 'funcional-aproximado', 'parcial', 'sem-efeito', 'nao-classificado'];
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const linha = (cols) => `| ${cols.join(' | ')} |`;
const out = [];
out.push('# Inventário da árvore de passivas do PoE (gerado)');
out.push('');
out.push(`Gerado por \`game/tools/auditar-arvore-passivas.mjs\` em ${r.geradoEm}${rapido ? ' (modo rápido: sem a verificação no motor)' : ''}. Não edite à mão: rode de novo.`);
out.push('');
out.push('## Resumo');
out.push('');
const s = r.resumo;
out.push(linha(['Situação', 'Nós', '% dos auditáveis']));
out.push(linha(['---', '---:', '---:']));
for (const k of SITUACOES) out.push(linha([k, s.porSituacao[k] ?? 0, pct(s.porSituacao[k] ?? 0, s.auditaveis)]));
out.push(linha(['**auditáveis** (sem os inícios)', s.auditaveis, '100%']));
out.push('');
out.push(`Verificados no motor (alocar → somar → tirar): ${s.verificadosNoMotor} nós; com falha de alocação/cálculo/remoção: ${s.falhasDeMotor}.`);
out.push('');
out.push('## A escada (onde cada nó chega)');
out.push('');
out.push('Cada nó fica no ÚLTIMO degrau que alcança sem pular nenhum:');
out.push('');
out.push('- **exibido**: está no editor, mas nada dele tem efeito;');
out.push('- **alocavel**: o motor aloca e tira o nó, mas nenhuma linha tem efeito;');
out.push('- **interpretado**: a linha vira modificador tipado com leitor no código, mas não se viu aplicar;');
out.push('- **aplicado**: a ficha efetiva muda, ou o combate lê o valor no acerto/tique;');
out.push('- **validado**: cada efeito tem teste numérico (`testes/cobertura-arvore.mjs` e os testes citados lá).');
out.push('');
out.push(linha(['Degrau', 'Nós', '% dos auditáveis']));
out.push(linha(['---', '---:', '---:']));
for (const k of A.NIVEIS) out.push(linha([k, s.porNivel[k] ?? 0, pct(s.porNivel[k] ?? 0, s.auditaveis)]));
out.push('');
out.push(`Como o "aplicado" foi observado: ${Object.entries(s.porAplicado).map(([k, v]) => `${k} ${v}`).join(' · ')}. Legenda:`);
out.push('');
out.push('- **ficha**: um número da ficha efetiva mudou (vida, armadura, golpe…);');
out.push('- **combate**: o valor está no que o combate lê no acerto/tique (`afPoe`, eventos, golpe por tag);');
out.push('- **condicional**: depende de condição que o cenário automático não monta;');
out.push('- **nao**: interpretado, mas nada mudou (verificar).');
out.push('');
out.push(linha(['Categoria', ...A.NIVEIS]));
out.push(linha(['---', ...A.NIVEIS.map(() => '---:')]));
for (const [cat] of Object.entries(r.porCategoria)) {
  const l = r.nos.filter((n) => n.categoria === cat && n.situacao !== 'inicio');
  if (l.length) out.push(linha([cat, ...A.NIVEIS.map((x) => l.filter((n) => n.nivel === x).length)]));
}
out.push('');
out.push('## Por categoria');
out.push('');
out.push(linha(['Categoria', 'Nós', ...SITUACOES]));
out.push(linha(['---', '---:', ...SITUACOES.map(() => '---:')]));
for (const [k, c] of Object.entries(r.porCategoria)) out.push(linha([k, c.nos, ...SITUACOES.map((x) => c.porSituacao[x] ?? 0)]));
out.push('');
const matriz = (titulo, m) => {
  out.push(`## ${titulo}`);
  out.push('');
  out.push(linha(['Tipo', 'Efeitos', 'Nós', 'Conectados (leitor no código)', 'Alocação ok / verificados', 'Cálculo ok / verificados']));
  out.push(linha(['---', '---:', '---:', '---:', '---:', '---:']));
  for (const [k, x] of Object.entries(m)) out.push(linha([k, x.efeitos, x.nos, `${x.conectados} (${pct(x.conectados, x.efeitos)})`, `${x.alocacaoOk}/${x.verificados}`, `${x.calculoOk}/${x.verificados}`]));
  out.push('');
};
matriz('Matriz por forma do efeito', r.porForma);
matriz('Matriz por tipo de modificador', r.porTipo);

// As causas técnicas: os efeitos sem conexão, agrupados pela falta.
out.push('## Efeitos traduzidos sem efeito real (causa técnica)');
out.push('');
const causas = new Map();
for (const n of r.nos) for (const d of n.desconectados) for (const f of d.faltas) {
  const c = causas.get(f) ?? { nos: new Set(), exemplos: new Set() };
  c.nos.add(n.id);
  if (c.exemplos.size < 4) c.exemplos.add(`${n.nome} (${n.id})`);
  causas.set(f, c);
}
if (!causas.size) out.push('Nenhum: todo efeito traduzido tem leitor no código.');
else {
  out.push(linha(['Causa', 'Nós', 'Exemplos']));
  out.push(linha(['---', '---:', '---']));
  for (const [f, c] of [...causas].sort((a, b) => b[1].nos.size - a[1].nos.size)) out.push(linha([f, c.nos.size, [...c.exemplos].join('; ')]));
}
out.push('');

// As linhas pendentes por tema (o que cada uma precisa — `precisa-arvore.mjs`).
out.push('## Linhas sem tradução com efeito (pendentes), por tema');
out.push('');
const temas = new Map();
for (const n of r.nos) for (const t of n.pendentes) {
  const x = temaDaLinha(t);
  const k = `${x.grupo} · ${x.tema}`;
  const c = temas.get(k) ?? { linhas: 0, nos: new Set(), precisa: x.precisa, exemplos: new Set() };
  c.linhas++;
  c.nos.add(n.id);
  if (c.exemplos.size < 3) c.exemplos.add(t.replace(/\|/g, '/'));
  temas.set(k, c);
}
out.push(linha(['Grupo · tema', 'Linhas', 'Nós', 'O que precisa', 'Exemplos']));
out.push(linha(['---', '---:', '---:', '---', '---']));
for (const [k, c] of [...temas].sort((a, b) => b[1].linhas - a[1].linhas)) out.push(linha([k, c.linhas, c.nos.size, c.precisa, [...c.exemplos].join(' / ')]));
out.push('');

// Os nós parciais e sem efeito, por categoria (id — nome — o que falta).
out.push('## Nós parciais e sem efeito (lista verificável)');
out.push('');
for (const [cat] of Object.entries(r.porCategoria)) {
  const lista = r.nos.filter((n) => n.categoria === cat && ['parcial', 'sem-efeito', 'nao-classificado'].includes(n.situacao));
  if (!lista.length) continue;
  out.push(`### ${cat} (${lista.length})`);
  out.push('');
  for (const n of lista) {
    const falta = [
      ...n.pendentes.map((t) => `pendente: ${t}`),
      ...n.desconectados.map((d) => `${d.efeito}: ${d.faltas.join(', ')}`),
      ...(n.verificacao && n.verificacao !== 'ok' ? [`motor: ${JSON.stringify(n.verificacao)}`] : []),
    ];
    out.push(`- \`${n.id}\` ${n.nome}${n.ascendencia ? ` [${n.ascendencia}]` : ''} — **${n.situacao}**${falta.length ? `: ${falta.join(' · ').replace(/\n/g, ' ')}` : ''}`);
  }
  out.push('');
}
// O INVENTÁRIO RASTREÁVEL por id: todos os nós, com o tipo de modificador, o suporte no motor, a aplicação e a cobertura.
out.push('## Inventário por nó (rastreável por id)');
out.push('');
out.push('A versão completa, com as chaves de cada nó, está em `arvore-passivas-poe-inventario.json`.');
out.push('');
out.push(linha(['id', 'nó', 'categoria', 'tipos de modificador', 'situação', 'degrau', 'aplicado', 'cobertura']));
out.push(linha(['---', '---', '---', '---', '---', '---', '---', '---']));
for (const n of r.nos.filter((x) => x.situacao !== 'inicio')) out.push(linha([`\`${n.id}\``, `${n.nome}${n.ascendencia ? ` [${n.ascendencia}]` : ''}`.replace(/\|/g, '/'), n.categoria, n.tipos.join(', ') || '—', n.situacao, n.nivel, n.aplicado ?? '—', n.cobertura ?? '—']));
out.push('');
writeFileSync(DESTINO, out.join('\n'));
writeFileSync(new URL('../../docs/auditorias/arvore-passivas-poe-inventario.json', import.meta.url), JSON.stringify({ geradoEm: r.geradoEm, resumo: r.resumo, nos: r.nos.map((n) => ({ id: n.id, nome: n.nome, nomeEn: n.nomeEn, categoria: n.categoria, ascendencia: n.ascendencia ?? null, chaves: n.chaves, tipos: n.tipos, situacao: n.situacao, nivel: n.nivel, niveis: n.niveis, aplicado: n.aplicado, cobertura: n.cobertura, linhas: n.linhas, pendentes: n.pendentes, desconectados: n.desconectados })) }, null, 1));
console.log(JSON.stringify(r.resumo), `→ ${DESTINO.pathname} (${Math.round((Date.now() - inicio) / 1000)} s)`);
process.exit(0);
