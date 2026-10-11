// A AUDITORIA DOS ÚNICOS contra o poedb (dono, 11/10: "extraia pelo scraping todas as abas de https://poedb.tw/pt/Unique_item, verifique se
// tem no jogo, e os atributos implícitos/únicos — se está funcionando o sorteio"). Lê o que o Scrapling extraiu (/home/deploy/scrapling:
// `extrair/unicos_lista.py` e `extrair/unicos.py` → saida/unicos/{unicos,foulborn,receitas}.json) e compara com o catálogo do jogo.
//
// Uso (em game/): node tools/auditar-unicos-poedb.mjs <pasta saida/unicos> [--gravar]
//   Sem --gravar: só o resumo. Com --gravar: os dados do poedb vão para o repositório (gamedata/itens-poe/poedb-unicos.json — os únicos
//   das abas Weapon/Armour/Other, as variantes Foulborn e as receitas) e o relatório para ../docs/auditoria-unicos-poedb.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import { gerarPeca, sortearNaFaixa } from '../systems/itens-poe/gerar.mjs';
import { molde, canonico, interna, lembrete, marcador, emPortugues } from '../systems/itens-poe/comparar-unicos.mjs';

const [pasta, ...flags] = process.argv.slice(2);
if (!pasta) throw new Error('uso: node tools/auditar-unicos-poedb.mjs <pasta saida/unicos> [--gravar]');
const ler = (n) => JSON.parse(readFileSync(join(pasta, n), 'utf8'));
const LISTA = ler('lista.json');
const PAGINAS = ler('unicos.json');
const FOULBORN = ler('foulborn.json');
const RECEITAS = ler('receitas.json');

const mesmaFaixa = (a, b) => a.length === b.length && a.every((f, i) => Math.min(...f) === Math.min(...b[i]) && Math.max(...f) === Math.max(...b[i]));
const fx = (fs) => fs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ') || '—';

// Para GERAR as correções, o catálogo CRU (o importado, sem `unicos-correcoes.json`); para o relatório, o do jogo (já corrigido).
const cat = flags.includes('--corrigir') ? JSON.parse(readFileSync(Catalogo.ARQUIVO, 'utf8')) : Catalogo.catalogo();
const DO_JOGO = new Map();
for (const c of Object.values(cat.classes)) for (const u of c.unicos ?? []) if (!DO_JOGO.has(u.slug)) DO_JOGO.set(u.slug, { u, classe: c });
const porNome = new Map([...DO_JOGO.values()].map((x) => [x.u.nome, x]));

const ABAS = { WeaponÚnicos: 'Armas', ArmourÚnicos: 'Armaduras', OtherÚnicos: 'Outros' };
// Fora da correção automática: os mapas únicos (o poedb dá os stats internos; o jogo tem o texto certo), as joias (as Conquistadas pelo
// Abismo não existem no jogo) e os únicos de mecânica própria (a Pérola de Tsoatha e a Engenhosidade de Zana sorteiam mods de uma lista; o
// Gancho de Poço é de pesca).
const CLASSES_FORA = new Set(['Maps', 'Jewels', 'Abyss_Jewels']);
// (O Escudeiro: o "Somente Encaixes Brancos" do catálogo é a mecânica dele — o poedb mostra como propriedade, não como mod.)
const FORA_DA_CORRECAO = new Set(['Pearl_of_Tsoatha', 'Zanas_Ingenuity', 'The_Wellhook', 'The_Squire']);
const correcoes = { unicos: {}, novos: [] };
// A base que o único guarda com OUTRO NOME (o catálogo tem as duas traduções com o mesmo id): o sorteio acha a base pelo id e procura o
// único pelo nome dela — com o nome antigo, o único nunca cai.
const BASE_COM_OUTRO_NOME = { 'Talismã do Grande Lobo': 'Talismã do Lobo Grandioso' };
const achados = { faltando: [], base: [], linhas: [], semPagina: [] };
const resumo = { poedb: 0, noJogo: 0, iguais: 0, comDiferenca: 0, linhasConferidas: 0 };
const dados = { unicos: {}, foulborn: FOULBORN, receitas: RECEITAS };

for (const [aba, rotulo] of Object.entries(ABAS)) {
  for (const slug of LISTA[aba] ?? []) {
    resumo.poedb++;
    const pag = PAGINAS[slug];
    // Único com VÁRIAS versões no poedb (o Emblema do Precursor em 7 anéis, as Grevas de Doryani...): compara com a da base do jogo.
    const doJogo0 = DO_JOGO.get(slug);
    const v = pag?.versoes?.find((x) => doJogo0 && x.base === doJogo0.u.base) ?? pag?.versoes?.[0];
    if (!v) {
      achados.semPagina.push({ slug, aba: rotulo });
      continue;
    }
    const linhas = v.linhas
      .filter((l) => (l.tipo === 'implicit' || l.tipo === 'explicit') && !interna(l.texto) && !marcador(l.texto))
      .map((l) => ({ ...l, jogo: emPortugues(l.jogo) }))
      .map((l) => (l.jogo.texto !== l.texto && /\bto\b/.test(l.texto) ? { ...l, texto: l.jogo.texto } : l));
    dados.unicos[slug] = { aba: rotulo, nome: v.nome, base: v.base, linhas: linhas.map(({ tipo, jogo: j }) => ({ tipo, texto: j.texto, modelo: j.modelo, faixas: j.faixas })) };
    const jogo = DO_JOGO.get(slug) ?? porNome.get(v.nome);
    if (!jogo) {
      achados.faltando.push({ slug, nome: v.nome, base: v.base, aba: rotulo });
      const dona = Object.entries(cat.classes).find(([id, c]) => !CLASSES_FORA.has(id) && c.bases.some((b) => b.nome === v.base));
      if (dona) correcoes.novos.push({ classe: dona[0], slug, nome: v.nome, base: v.base, modificadores: linhas.map((l) => ({ tipo: l.tipo, texto: l.jogo.texto, modelo: l.jogo.modelo, faixas: l.jogo.faixas })) });
      continue;
    }
    resumo.noJogo++;
    const { u } = jogo;
    let diferente = false;
    if (v.base && u.base !== v.base) {
      achados.base.push({ slug, nome: v.nome, poedb: pag.versoes.map((x) => x.base).filter((b, i, l) => b && l.indexOf(b) === i).join(' / '), jogo: u.base });
      diferente = true;
    }
    // Linha a linha: cada linha do poedb procura no jogo a de texto IGUAL (com os números); sem ela, a do mesmo molde (o texto sem números
    // — aí o valor ou a faixa é diferente); sem as duas, falta no jogo. O que sobra no jogo é "a mais".
    const sobra = [...u.modificadores];
    for (const l of linhas) {
      resumo.linhasConferidas++;
      let j = sobra.findIndex((m) => canonico(m.texto) === canonico(l.texto));
      if (j >= 0) {
        const m = sobra.splice(j, 1)[0];
        if (m.tipo !== l.tipo) {
          achados.linhas.push({ slug, nome: v.nome, problema: `tipo: poedb ${l.tipo}, jogo ${m.tipo}`, tipo: l.tipo, poedb: l.texto, jogo: m.texto });
          diferente = true;
        }
        continue;
      }
      j = sobra.findIndex((m) => molde(m.modelo ?? m.texto) === molde(l.texto));
      if (j >= 0) {
        const m = sobra.splice(j, 1)[0];
        achados.linhas.push({ slug, nome: v.nome, problema: 'valor diferente', tipo: l.tipo, poedb: l.texto, faixa: fx(l.faixas), jogo: m.texto });
        diferente = true;
        continue;
      }
      if (lembrete(l.texto)) continue;
      achados.linhas.push({ slug, nome: v.nome, problema: 'falta no jogo', tipo: l.tipo, poedb: l.texto, faixa: fx(l.faixas) });
      diferente = true;
    }
    // O que o jogo tem a mais (fora o texto de lembrete entre parênteses, que o poedb mostra junto da linha).
    for (const m of sobra) {
      // (Fora o lembrete entre parênteses e a linha interna do próprio catálogo — "local six linked sockets [1]": pode dar a mecânica.)
      if (lembrete(m.texto) || interna(m.texto) || marcador(m.texto)) continue;
      achados.linhas.push({ slug, nome: v.nome, problema: 'a mais no jogo', tipo: m.tipo, jogo: m.texto, faixa: fx(m.faixas ?? []) });
      diferente = true;
    }
    if (diferente) resumo.comDiferenca++;
    else resumo.iguais++;
    const classeId = jogo.classe.id ?? Object.entries(cat.classes).find(([, c]) => c === jogo.classe)?.[0];
    if (diferente && !FORA_DA_CORRECAO.has(slug) && !CLASSES_FORA.has(classeId)) {
      correcoes.unicos[slug] = {
        classe: classeId,
        ...(u.base && pag.versoes.some((x) => x.base === u.base) ? {} : jogo.classe.bases.some((b) => b.nome === v.base) ? { base: v.base } : {}),
        // As linhas do poedb e, no fim, as internas que o catálogo já tinha (elas podem ligar a mecânica: 6 encaixes ligados, gatilho…).
        modificadores: [...linhas.map((l) => ({ tipo: l.tipo, texto: l.jogo.texto, modelo: l.jogo.modelo, faixas: l.jogo.faixas })), ...u.modificadores.filter((m) => interna(m.texto) || marcador(m.texto))],
      };
    }
  }
}

for (const { u, classe } of DO_JOGO.values()) {
  const nome = BASE_COM_OUTRO_NOME[u.base];
  // (O nome antigo pode até existir no catálogo — com o MESMO id do novo, e o sorteio acha a base pelo id: cai na do outro nome.)
  if (!nome || !classe.bases.some((b) => b.nome === nome)) continue;
  const classeId = Object.entries(cat.classes).find(([, c]) => c === classe)?.[0];
  correcoes.unicos[u.slug] = { ...(correcoes.unicos[u.slug] ?? { classe: classeId, modificadores: u.modificadores }), base: nome };
  achados.base.push({ slug: u.slug, nome: u.nome, poedb: nome, jogo: `${u.base} (outro nome da mesma base: o sorteio não acha o único)` });
}

// O SORTEIO: cada único do jogo, 40 vezes — todo valor dentro da faixa, as duas pontas alcançáveis, todas as linhas presentes, e (o achado
// de 11/10) o implícito da base não soma com o implícito próprio do único.
const sorteio = { unicos: 0, foraDaFaixa: [], linhasFaltando: [], implicitoEmDobro: [], naoGera: [] };
let semente = 1;
const rng = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const { u, classe } of DO_JOGO.values()) {
  const base = classe.bases.find((b) => b.nome === u.base);
  if (!base) continue;
  sorteio.unicos++;
  for (let k = 0; k < 40; k++) {
    const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng, unico: u.slug });
    if (g.erro) {
      if (!sorteio.naoGera.includes(u.slug)) sorteio.naoGera.push(u.slug);
      break;
    }
    if (g.modificadores.length !== u.modificadores.length) {
      sorteio.linhasFaltando.push(u.slug);
      break;
    }
    g.modificadores.forEach((m, i) =>
      (u.modificadores[i].faixas ?? []).forEach((f, n) => {
        const v = m.valores[n];
        if (!(v >= Math.min(...f) && v <= Math.max(...f)) && sorteio.foraDaFaixa.length < 50) sorteio.foraDaFaixa.push(`${u.slug}: ${m.texto} (${fx([f])})`);
      })
    );
    if (u.modificadores.some((m) => m.tipo === 'implicit') && g.implicitos.length && !sorteio.implicitoEmDobro.includes(u.slug)) sorteio.implicitoEmDobro.push(u.slug);
  }
}
// As pontas: a faixa inteira é alcançável (o mínimo e o máximo saem).
const pontas = [[1, 3], [-10, -5], [0.2, 0.4], [7, 7]].every((f) => {
  const vistos = new Set();
  for (let k = 0; k < 400; k++) vistos.add(sortearNaFaixa(f, rng));
  return vistos.has(Math.min(...f)) && vistos.has(Math.max(...f));
});

const foulbornNoJogo = 0; // o jogo ainda não tem a variante Foulborn (mutated) de único nenhum
if (process.env.DETALHE) writeFileSync(process.env.DETALHE, JSON.stringify({ achados, sorteio }, null, 1));
console.log(JSON.stringify({ resumo, faltando: achados.faltando.length, base: achados.base.length, linhas: achados.linhas.length, semPagina: achados.semPagina.length, sorteio: { unicos: sorteio.unicos, naoGera: sorteio.naoGera, foraDaFaixa: sorteio.foraDaFaixa.length, linhasFaltando: sorteio.linhasFaltando.length, implicitoEmDobro: sorteio.implicitoEmDobro.length, pontas }, foulborn: FOULBORN.length, receitas: RECEITAS.length }, null, 1));

if (flags.includes('--gravar')) {
  writeFileSync(
    new URL('../gamedata/itens-poe/poedb-unicos.json', import.meta.url),
    JSON.stringify({ geradoEm: new Date().toISOString(), fonte: 'poedb.tw/pt/Unique_item e a página de cada único — extraídos com o Scrapling (tools/auditar-unicos-poedb.mjs)', foraDaComparacao: { classes: [...CLASSES_FORA], unicos: [...FORA_DA_CORRECAO] }, ...dados })
  );
  const porProblema = (p) => achados.linhas.filter((l) => l.problema === p);
  const tab = (linhas, cols) => [`| ${cols.map((c) => c[0]).join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...linhas.map((l) => `| ${cols.map((c) => String(l[c[1]] ?? '').replace(/\|/g, '/')).join(' | ')} |`)].join('\n');
  const md = [
    '# Auditoria dos únicos — jogo × poedb',
    '',
    `Gerado por \`game/tools/auditar-unicos-poedb.mjs\` em ${new Date().toISOString().slice(0, 10)}, a partir de https://poedb.tw/pt/Unique_item (abas Weapon, Armour, Other, Item Recipe e Foulborn) e da página de cada único.`,
    '',
    '## Resumo',
    '',
    `- Únicos no poedb (Weapon + Armour + Other): **${resumo.poedb}**; no jogo: **${resumo.noJogo}**; faltando no jogo: **${achados.faltando.length}**${achados.semPagina.length ? `; sem página baixada: ${achados.semPagina.length}` : ''}.`,
    `- Iguais linha a linha (implícitos e explícitos, com as faixas): **${resumo.iguais}**; com alguma diferença: **${resumo.comDiferenca}** (${resumo.linhasConferidas} linhas conferidas).`,
    `- Diferenças: base ${achados.base.length}; linha que falta no jogo ${porProblema('falta no jogo').length}; valor/faixa diferente ${porProblema('valor diferente').length}; linha a mais no jogo ${porProblema('a mais no jogo').length}; tipo (implícito × explícito) ${achados.linhas.filter((l) => l.problema.startsWith('tipo')).length}.`,
    `- Sorteio (${sorteio.unicos} únicos do jogo × 40): não geram ${sorteio.naoGera.length}${sorteio.naoGera.length ? ` (${sorteio.naoGera.join(', ')})` : ''}; valores fora da faixa ${sorteio.foraDaFaixa.length}; únicos com linha perdida ${sorteio.linhasFaltando.length}; implícito da base somado ao do único ${sorteio.implicitoEmDobro.length}; mínimo e máximo alcançáveis: ${pontas ? 'sim' : 'NÃO'}.`,
    `- Foulborn: ${FOULBORN.length} variantes no poedb (${FOULBORN.filter((f) => f.foraDoJogo).length} marcadas "Not in game" lá); o jogo ainda não tem a variante Foulborn.`,
    `- Receitas de único (Item Recipe): ${RECEITAS.length} no poedb; o jogo ainda não tem.`,
    '',
    '## Corrigido (unicos-correcoes.json, aplicado por cima do catálogo)',
    '',
    (() => {
      const c = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/unicos-correcoes.json', import.meta.url), 'utf8'));
      const nomes = (slug) => dados.unicos[slug]?.nome ?? slug;
      return [
        `- **${Object.keys(c.unicos).length} únicos** com as linhas da versão atual do poedb: ${Object.keys(c.unicos).map((s) => `${nomes(s)}${c.unicos[s].base ? ` (base ${c.unicos[s].base})` : ''}`).join(', ')}.`,
        `- **${c.novos.length} novo(s)**: ${c.novos.map((n) => `${n.nome} (${n.base})`).join(', ')}.`,
        '- O implícito do único não soma mais com o da base (655 únicos tinham o implícito em dobro; as peças antigas são refeitas na entrada).',
        `- Ficaram de fora de propósito: os mapas únicos e as joias (${'`'}foraDaComparacao${'`'} em poedb-unicos.json) e os de mecânica própria — Pérola de Tsoatha, Engenhosidade de Zana, Gancho de Poço, O Escudeiro.`,
      ].join('\n');
    })(),
    '',
    '## Faltando no jogo',
    '',
    achados.faltando.length ? tab(achados.faltando, [['Único', 'nome'], ['Slug', 'slug'], ['Base', 'base'], ['Aba', 'aba']]) : 'Nenhum.',
    '',
    '## Base diferente',
    '',
    achados.base.length ? tab(achados.base, [['Único', 'nome'], ['poedb', 'poedb'], ['Jogo', 'jogo']]) : 'Nenhuma.',
    '',
    '## Linhas diferentes',
    '',
    achados.linhas.length ? tab(achados.linhas, [['Único', 'nome'], ['Problema', 'problema'], ['Tipo', 'tipo'], ['poedb', 'poedb'], ['Faixa poedb', 'faixa'], ['Jogo', 'jogo']]) : 'Nenhuma.',
    '',
    '## Sorteio',
    '',
    sorteio.foraDaFaixa.length ? sorteio.foraDaFaixa.map((x) => `- ${x}`).join('\n') : 'Nenhum valor fora da faixa.',
    '',
  ].join('\n');
  writeFileSync(new URL('../../docs/auditoria-unicos-poedb.md', import.meta.url), md);
  console.log('gravado: gamedata/itens-poe/poedb-unicos.json e docs/auditoria-unicos-poedb.md');
}
if (flags.includes('--corrigir')) {
  writeFileSync(
    new URL('../gamedata/itens-poe/unicos-correcoes.json', import.meta.url),
    JSON.stringify({ _nota: 'As CORREÇÕES dos únicos pelo poedb (tools/auditar-unicos-poedb.mjs --corrigir): o catálogo (catalogo-itens.json, gerado da coleção) aplica isto por cima ao carregar (systems/itens-poe/catalogo.mjs). `unicos`: as linhas do poedb no lugar das do catálogo (a versão atual do único; a base, quando o catálogo não tinha). `novos`: os que faltavam e têm base no jogo.', ...correcoes }, null, 1)
  );
  console.log(`correções: ${Object.keys(correcoes.unicos).length} únicos, ${correcoes.novos.length} novos`);
}
