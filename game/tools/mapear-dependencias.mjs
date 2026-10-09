// O GRAFO DE DEPENDÊNCIAS árvore × gemas × itens × combate (dono, 09/10: "construa um mapa de dependências… para cada mecânica, identifique
// quais outros sistemas são necessários para que ela funcione de ponta a ponta"). Gerado dos dados e do código, não de opinião:
//
//   categoria (o tema do editor — `itens-poe/precisa-arvore.mjs`) → os NÓS da árvore com linhas dela → as LINHAS (com efeito, pendentes,
//   inexistentes) → os ATRIBUTOS que as linhas com efeito produzem → os ARQUIVOS que leem cada atributo (o sistema consumidor) → as GEMAS do
//   arquétipo da categoria (o estado delas no jogo e os motivos) → o que FALTA.
//
// Saída: `docs/auditorias/dependencias-arvore-gemas-itens-combate-grafo.md` (o documento principal, ao lado, cita os números daqui).
// Uso (na pasta game/): node tools/mapear-dependencias.mjs
process.env.ITENS_POE ??= '1';
const { writeFileSync } = await import('node:fs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
await iniciarJogoDoPoe();
const Passivas = await import('../systems/passivas/arvore.mjs');
const A = await import('../admin/auditoria-arvore-passivas.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const { TEMAS, temaDaLinha } = await import('../systems/itens-poe/precisa-arvore.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const cobertura = await import('../testes/cobertura-arvore.mjs');

// O SISTEMA de cada arquivo consumidor (o nome que o documento usa).
const SISTEMA = [
  [/passivas\//, 'árvore (motor)'], [/afixos\.mjs$/, 'soma de atributos'], [/ficha\.mjs$/, 'ficha (atributos finais)'], [/ficha-poe\.mjs$/, 'tela da ficha'],
  [/personagem\/defesa\.mjs$/, 'defesa (escudo, esquiva)'], [/personagem\/atributos\.mjs$/, 'atributos For/Des/Int'], [/mods-poe\.mjs$/, 'combate: acerto e eventos'],
  [/condicoes-poe\.mjs$/, 'condições, golpe e tique'], [/lacaios-poe\.mjs$/, 'lacaios e totens'], [/gemas-poe\.mjs$/, 'gemas ativas'], [/suportes-poe\.mjs$/, 'gemas de suporte'],
  [/frascos\.mjs$/, 'frascos'], [/cargas\.mjs$/, 'cargas'], [/afeccoes\.mjs$|combate\/dot\.mjs$|combate\/controle/, 'afecções e dano contínuo'], [/acoes\.mjs$/, 'habilidades (uso)'],
  [/hunt\/combate\.mjs$/, 'golpe básico e dano recebido'], [/poderes\.mjs$/, 'magias dos monstros no jogador'], [/cacadas\.mjs$/, 'caçada (tique)'],
  [/reserva\.mjs$/, 'reserva (auras)'], [/resistencia\.mjs$/, 'resistências'], [/sessao\.mjs$/, 'sessão (WebSocket)'], [/moedas\.mjs$/, 'moedas'],
];
const sistemaDo = (arq) => SISTEMA.find(([re]) => re.test(arq))?.[1] ?? arq.replace(/^systems\//, '');
// As GEMAS (arquétipo do compilador) de cada categoria de gema do editor.
const GEMAS_DO_TEMA = {
  Lacaios: ['lacaio'], Totens: ['totem'], 'Armadilhas e Minas': ['armadilha', 'mina'], 'Marcas e Runas': ['marca'], Clamores: ['clamor'], 'Maldições': ['maldicao'],
  'Auras e Arautos': ['aura', 'arauto'], Guardas: ['guarda'], 'Canalização e repetição': ['canalizacao'], 'Golpes e ataques': ['corpo_a_corpo', 'impacto'],
  'Conjuração': ['projetil', 'area', 'nova', 'orbe', 'chuva', 'ricochete'], 'Oferendas, golens e invocações': ['lacaio'],
};

// As linhas de toda a árvore, por tema (todas — as com efeito também, para ver o que a categoria já tem).
const arv = Passivas.arvore();
const lidos = new Map();
const leitores = (stat) => { if (!lidos.has(stat)) lidos.set(stat, A.arquivosQueLeem(stat)); return lidos.get(stat); };
const temas = new Map();
for (const no of arv.nos) {
  if (no.tipo === 'start') continue;
  const grupos = no.tipo === 'mastery' ? (no.opcoes ?? []).map((o) => o.textos ?? []) : [no.textos ?? []];
  const mecanica = no.tipo === 'keystone' && no.keystone && no.keystone.regra !== 'texto';
  for (const textos of grupos) for (const [i, texto] of textos.entries()) {
    const t = mecanica ? { estado: no.estados?.[i] ?? 'registrado', efeitos: i === 0 ? no.efeitos ?? [] : [] } : traduzirLinha(texto);
    const d = A.DA_LINHA[t.estado] ?? 'pendente';
    if (d === 'lembrete') continue;
    const { grupo, tema, precisa } = temaDaLinha(texto);
    const c = temas.get(tema) ?? { grupo, tema, precisa, nos: new Set(), funciona: 0, pendente: 0, inexiste: 0, atributos: new Map(), exemplos: [], cobertos: 0, efeitos: 0 };
    c.nos.add(no.id);
    c[d]++;
    if (d === 'pendente' && c.exemplos.length < 4) c.exemplos.push(texto);
    if (d === 'funciona') for (const ef of t.efeitos) {
      const chave = ef.add ?? (ef.stat ? `stat:${ef.stat}` : `tag:${ef.tag}`);
      const base = ef.add ? Cond.partir(ef.add).stat : chave;
      c.atributos.set(base, (c.atributos.get(base) ?? 0) + 1);
      c.efeitos++;
      if (A.cobertoPorTeste(cobertura, ef)) c.cobertos++;
    }
    temas.set(tema, c);
  }
}
// As gemas por arquétipo (o estado no jogo e os motivos).
const gemas = {};
for (const [, r] of GemasPoe.REGISTRO) {
  const g = (gemas[r.arquetipo] ??= { total: 0, funciona: 0, parcial: 0, nao: 0, motivos: new Map() });
  g.total++;
  g[r.statusNoJogo]++;
  for (const m of r.motivosNoJogo ?? []) { const k = m.replace(/:.*/, ''); g.motivos.set(k, (g.motivos.get(k) ?? 0) + 1); }
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const L = [];
L.push('# Grafo de dependências árvore × gemas × itens × combate (gerado)');
L.push('');
L.push(`Gerado por \`game/tools/mapear-dependencias.mjs\` em ${new Date().toISOString()} a partir da árvore, das regras de tradução, do código (quem lê cada atributo) e do registro das gemas. Não edite à mão.`);
L.push('');
L.push('## Por categoria (os temas do editor)');
L.push('');
L.push('| Grupo · categoria | Nós | Linhas com efeito | Pendentes | Inexistentes no jogo | Efeito validado por teste | Estado |');
L.push('|---|---:|---:|---:|---:|---:|---|');
const ordem = [...temas.values()].sort((a, b) => (b.pendente + b.inexiste) - (a.pendente + a.inexiste));
for (const c of ordem) {
  const total = c.funciona + c.pendente + c.inexiste;
  const estado = !c.funciona ? 'ausente' : c.pendente + c.inexiste ? 'parcial' : 'completo';
  L.push(`| ${c.grupo} · ${c.tema} | ${c.nos.size} | ${c.funciona} (${pct(c.funciona, total)}) | ${c.pendente} | ${c.inexiste} | ${c.cobertos}/${c.efeitos} | ${estado} |`);
}
L.push('');
L.push('## O grafo de cada categoria');
L.push('');
for (const c of ordem) {
  L.push(`### ${c.grupo} · ${c.tema}`);
  L.push('');
  L.push(`- **Nós da árvore:** ${c.nos.size} (ids no inventário da árvore). **Linhas:** ${c.funciona} com efeito, ${c.pendente} pendentes, ${c.inexiste} inexistentes no jogo.`);
  const atrs = [...c.atributos].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (atrs.length) {
    L.push('- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**');
    for (const [stat, n] of atrs) {
      const arqs = stat.startsWith('stat:') ? ['systems/afixos.mjs', 'systems/ficha.mjs'] : stat.startsWith('ev:') ? ['systems/itens-poe/mods-poe.mjs'] : leitores(stat);
      L.push(`  - \`${stat}\` (${n}) → ${arqs.length ? [...new Set(arqs.map(sistemaDo))].join(', ') : '**ninguém lê**'}`);
    }
  }
  for (const arq of GEMAS_DO_TEMA[c.tema] ?? []) {
    const g = gemas[arq];
    if (!g) continue;
    const motivos = [...g.motivos].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v}× ${k}`).join('; ');
    L.push(`- **Gemas (arquétipo \`${arq}\`):** ${g.total} — funcionam ${g.funciona}, parciais ${g.parcial}, sem comportamento ${g.nao}. Motivos mais comuns: ${motivos || '—'}.`);
  }
  if (c.pendente) L.push(`- **O que falta (pendentes):** ${c.precisa}. Exemplos: ${c.exemplos.map((x) => `"${x}"`).join(' · ')}`);
  L.push('');
}
L.push('## As gemas por arquétipo (o eixo "gema" do grafo)');
L.push('');
L.push('| Arquétipo | Gemas | Funcionam | Parciais | Sem comportamento | Motivos mais comuns |');
L.push('|---|---:|---:|---:|---:|---|');
for (const [arq, g] of Object.entries(gemas).sort((a, b) => b[1].total - a[1].total)) L.push(`| ${arq} | ${g.total} | ${g.funciona} | ${g.parcial} | ${g.nao} | ${[...g.motivos].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v}× ${k}`).join('; ')} |`);
L.push('');
writeFileSync(new URL('../../docs/auditorias/dependencias-arvore-gemas-itens-combate-grafo.md', import.meta.url), L.join('\n'));
console.log(`categorias ${temas.size}, gemas ${GemasPoe.REGISTRO.size} → docs/auditorias/dependencias-arvore-gemas-itens-combate-grafo.md`);
process.exit(0);
