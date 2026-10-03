/*
 * A WIKI do Draevor (`/wiki`, `/wiki/<artigo>`).
 *
 * O texto explicativo mora aqui; os NÚMEROS (chances de raridade, tiers, faixas de cada modificador, poderes) vêm do servidor
 * (`/api/wiki/itens`, montado de `gamedata/itens/*.json` por `systems/wiki.mjs`), então a wiki nunca diverge do jogo: mudou o valor
 * no JSON, a tabela muda junto. Tudo é escrito com `textContent` (nada de HTML montado a partir de dado).
 *
 * Artigos: cada um é `{ slug, titulo, resumo, desenhar(corpo, dados) }`. Para escrever um artigo novo, acrescente um item em `ARTIGOS`.
 */
import { aplicarIdioma } from '/client/site/idiomas.mjs';

const el = (tag, classe, texto) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto != null) n.textContent = texto;
  return n;
};
const p = (texto) => el('p', null, texto);
/** Título de seção com âncora (`#id`). */
const h2 = (texto, id) => { const n = el('h2', null, texto); n.id = id; return n; };
/** Parágrafo com trechos em negrito: `**assim**`. */
function rico(tag, texto, classe = null) {
  const n = el(tag, classe);
  String(texto).split(/(\*\*[^*]+\*\*)/).forEach((parte) => {
    if (!parte) return;
    if (parte.startsWith('**')) n.append(el('b', null, parte.slice(2, -2)));
    else n.append(document.createTextNode(parte));
  });
  return n;
}
const lista = (itens) => {
  const ul = el('ul');
  for (const i of itens) ul.append(rico('li', i));
  return ul;
};
const aviso = (texto, verde = false) => rico('div', texto, `wiki-aviso${verde ? ' verde' : ''}`);
// Chances pequenas (0,000219%) precisam de mais casas: dois algarismos significativos abaixo de 0,01.
const pct = (v) => `${String(v > 0 && v < 0.01 ? Number(v.toPrecision(2)) : Math.round(v * 1000) / 1000).replace('.', ',')}%`;
const num = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function tabela(cabecalhos, linhas, { numericas = [] } = {}) {
  const caixa = el('div', 'tabela-caixa wiki-tabela');
  const t = el('table', 'tabela');
  const cab = el('tr');
  cabecalhos.forEach((c, i) => cab.append(el('th', numericas.includes(i) ? 'num' : null, c)));
  const cabeca = el('thead');
  cabeca.append(cab);
  t.append(cabeca);
  const corpo = el('tbody');
  for (const linha of linhas) {
    const tr = el('tr');
    linha.forEach((celula, i) => {
      const td = el('td', numericas.includes(i) ? 'num' : null);
      if (celula instanceof Node) td.append(celula);
      else td.textContent = celula;
      tr.append(td);
    });
    corpo.append(tr);
  }
  t.append(corpo);
  caixa.append(t);
  return caixa;
}
const nomeDaRaridade = (r) => el('span', `r-nome r-${semAcento(r.id)}`, r.nome);

// ------------------------------------------------------------------------------------------------ o artigo dos itens

/** Os pesos de tier de uma raridade num Item Level (a MESMA conta do servidor: peso × viés^(tier−1), o amuleto com viés extra). */
function chancesDoTier(dados, raridadeId, itemLevel, amuleto) {
  const faixa = dados.tiers.porItemLevel.find((f) => f.ate == null || itemLevel <= f.ate);
  const vies = (dados.tiers.viesDaRaridade[raridadeId] ?? 1) * (amuleto ? dados.tiers.viesDoAmuleto ?? 1 : 1);
  const pesos = faixa.tiers.map((t) => [t, dados.tiers.peso[String(t)] * vies ** (t - 1)]);
  const soma = pesos.reduce((a, [, w]) => a + w, 0);
  return pesos.map(([t, w]) => [t, (100 * w) / soma]);
}

function faixaDoMod(m, t) {
  const [lo, hi] = m.faixas[t - 1];
  const un = m.tipo === 'pct' ? '%' : '';
  if (m.proporcaoDoMaximo) return `${num(lo)}–${num(lo * m.proporcaoDoMaximo)}`;
  return lo === hi ? `${num(lo)}${un}` : `${num(lo)}–${num(hi)}${un}`;
}

function desenharItens(corpo, d) {
  const nomeDe = Object.fromEntries(d.raridades.map((r) => [r.id, r.nome]));
  const IDS = d.raridades.map((r) => r.id);

  corpo.append(
    (() => {
      const s = el('div', 'wiki-sumario');
      s.append(el('b', null, 'Neste artigo'));
      for (const [id, texto] of [['visao', 'Visão geral'], ['raridade', 'Raridades'], ['chance', 'Chance de cada raridade'], ['itemlevel', 'Item Level'], ['tiers', 'Tiers (T1 a T5)'], ['mods', 'Modificadores'], ['poderes', 'Poderes lendários e míticos'], ['faq', 'Perguntas rápidas']]) {
        const a = el('a', null, texto);
        a.href = `#${id}`;
        s.append(a);
      }
      return s;
    })(),
  );

  // ---- visão geral
  corpo.append(h2('Visão geral', 'visao'));
  corpo.append(
    rico('p', 'Todo equipamento que cai no Draevor (de criaturas, baús e bosses) sai com uma **raridade**. A raridade decide **quantos modificadores** a peça tem e se ela pode ter um **poder especial**. Cada modificador tem um **tier** de T1 a T5, que decide o quanto ele vale.'),
    rico('p', 'Os três conceitos são independentes, e é útil não misturar:'),
    lista(['**Raridade** — a "qualidade" da peça (Comum, Incomum, Raro, Épico, Lendário, Mítico).', '**Modificador** — uma linha de bônus da peça (ex.: Life, Fire Resistance, Dano adicional).', '**Tier** — a força de UM modificador, de T1 (mais fraco) a T5 (mais forte).']),
    aviso('**Não existe prefixo nem sufixo** no Draevor: a peça recebe uma lista de modificadores diferentes, sem repetir o mesmo na mesma peça.'),
  );

  // ---- raridades
  corpo.append(h2('Raridades', 'raridade'));
  corpo.append(
    p('São seis, da mais comum à mais rara. Quanto mais rara, mais modificadores a peça tem (e maior a faixa de ataque/defesa da base e a quantidade de sockets para gemas).'),
  );
  corpo.append(
    tabela(
      ['Raridade', 'Modificadores', 'Poder especial'],
      d.raridades.map((r) => {
        const qs = r.quantidadeDeModificadores;
        const mods = qs.length === 1 && qs[0].quantos === 0 ? 'nenhum' : qs.length === 1 ? String(qs[0].quantos) : `${qs[0].quantos} ou ${qs[qs.length - 1].quantos} (${qs.map((q) => `${q.quantos}: ${num(q.chance)}%`).join(' · ')})`;
        const poder = !r.poder ? '—' : r.chanceDoPoder >= 1 ? 'sempre (poder supremo)' : `${num(r.chanceDoPoder * 100)}% de chance`;
        return [nomeDaRaridade(r), mods, poder];
      }),
    ),
  );
  corpo.append(p('A peça Comum pode vir sem nenhum modificador — é só o item base.'));

  // ---- chance de cada raridade
  corpo.append(h2('Chance de cada raridade', 'chance'));
  corpo.append(
    rico('p', 'A chance de a peça cair em cada raridade depende do **Ato** e da **dificuldade** de onde ela caiu. O Ato vem do level da fase:'),
    lista(d.atoPorLevel.map((f, i) => `**Ato ${f.ato}** — ${i === 0 ? 'até' : f.ate == null ? 'acima do' : 'até'} level ${f.ate ?? d.atoPorLevel[i - 1].ate}`)),
  );
  const filtro = el('div', 'wiki-filtros');
  const caixaChance = el('div');
  const atos = Object.keys(d.chancesDeRaridade);
  let atoAtual = atos[0];
  const desenharChance = () => {
    caixaChance.replaceChildren(
      tabela(
        ['Raridade', ...Object.values(d.dificuldades)],
        IDS.map((id) => [nomeDaRaridade({ id, nome: nomeDe[id] }), ...Object.keys(d.dificuldades).map((dif) => pct(d.chancesDeRaridade[atoAtual][dif][id]))]),
        { numericas: [1, 2, 3] },
      ),
    );
    for (const b of filtro.children) b.setAttribute('aria-pressed', String(b.dataset.ato === atoAtual));
  };
  for (const ato of atos) {
    const b = el('button', null, `Ato ${ato}`);
    b.type = 'button';
    b.dataset.ato = ato;
    b.onclick = () => { atoAtual = ato; desenharChance(); };
    filtro.append(b);
  }
  corpo.append(filtro, caixaChance);
  desenharChance();
  corpo.append(
    lista([
      '**A raridade do monstro empurra a chance para cima**: criaturas raras, elite, únicas e bosses dão peças de raridade mais alta.',
      '**O boss de Ato conta como a dificuldade de cima** (e dá equipamento garantido), e no Merciless ele nunca dá peça abaixo de Raro.',
    ]),
  );

  // ---- item level
  corpo.append(h2('Item Level', 'itemlevel'));
  corpo.append(
    rico('p', 'Toda peça tem um **Item Level**: é o level-alvo da fase onde ela caiu (o boss de Ato dá **+10%**). Ele não é o level para equipar — é ele que **libera os tiers** e alguns modificadores mais fortes (ver abaixo). Fases de level mais alto dão peças de Item Level mais alto.'),
  );

  // ---- tiers
  corpo.append(h2('Tiers (T1 a T5)', 'tiers'));
  corpo.append(
    aviso('**T1 é o tier MAIS FRACO e T5 o MAIS FORTE.** No Path of Exile é o contrário — aqui, quanto maior o número, melhor o modificador.', true),
    p('Cada modificador de uma peça sorteia o seu próprio tier, e depois um valor dentro da faixa daquele tier (cada modificador tem a sua tabela, na seção seguinte). O Item Level da peça decide até que tier pode sair:'),
  );
  corpo.append(
    tabela(
      ['Item Level', 'Tiers possíveis'],
      d.tiers.porItemLevel.map((f, i, l) => [`${(l[i - 1]?.ate ?? 0) + 1}${f.ate == null ? ' ou mais' : `–${f.ate}`}`, f.tiers.map((t) => `T${t}`).join(', ')]),
    ),
  );
  corpo.append(
    rico('p', `Entre os tiers liberados, o sorteio favorece os mais fracos: cada tier tem um **peso** (${Object.entries(d.tiers.peso).map(([t, w]) => `T${t} = ${w}`).join(', ')}). A **raridade** da peça empurra o sorteio para cima — o peso de cada tier é multiplicado pelo "viés" da raridade elevado ao tier menos 1 (${IDS.map((id) => `${nomeDe[id]} ${num(d.tiers.viesDaRaridade[id])}`).join(', ')}). **Amuletos** têm um viés extra de ×${num(d.tiers.viesDoAmuleto)}.`),
  );
  // calculadora
  corpo.append(el('h3', null, 'Calculadora de tier'));
  const calc = el('div', 'wiki-calc');
  const selRar = el('select');
  for (const r of d.raridades) selRar.append(new Option(r.nome, r.id));
  selRar.value = 'raro';
  const inIl = el('input');
  inIl.type = 'number';
  inIl.min = '1';
  inIl.max = '3000';
  inIl.value = '700';
  const selAmu = el('select');
  selAmu.append(new Option('Não', '0'), new Option('Sim', '1'));
  const rotulo = (texto, campo) => { const l = el('label', null, texto); l.append(campo); return l; };
  calc.append(rotulo('Raridade da peça', selRar), rotulo('Item Level', inIl), rotulo('É um amuleto?', selAmu));
  const barra = el('div', 'wiki-barra');
  const legenda = el('div', 'wiki-legenda');
  const atualizar = () => {
    const il = Math.max(1, Math.min(3000, Number(inIl.value) || 1));
    const chances = chancesDoTier(d, selRar.value, il, selAmu.value === '1');
    barra.replaceChildren(...chances.map(([, c]) => { const i = el('i'); i.style.width = `${c}%`; return i; }));
    legenda.replaceChildren(...chances.map(([t, c]) => el('span', null, `T${t}: ${num(Math.round(c * 10) / 10)}%`)));
  };
  for (const c of [selRar, inIl, selAmu]) c.addEventListener('input', atualizar);
  corpo.append(calc, barra, legenda, p('A cor de cada trecho da barra segue a ordem T1 → T5. A conta é a mesma que o servidor usa para sortear.'));
  atualizar();

  // ---- modificadores
  corpo.append(h2('Modificadores', 'mods'));
  corpo.append(
    rico('p', `Hoje existem **${d.modificadores.length} modificadores** que podem cair. Cada um tem um tipo de valor (número fixo ou porcentagem), uma tabela de **T1 a T5**, um **Item Level mínimo** para aparecer, as **raridades** em que pode sair e os **tipos de equipamento** onde pode cair.`),
    lista([
      '**A mesma peça nunca repete um modificador.** Uma peça Mítica tem 5 ou 6 modificadores, todos diferentes.',
      '**Alguns só saem em peças mais raras ou de Item Level alto** — por exemplo, Damage Reduction exige Item Level 301 e raridade Épico ou acima; Damage vs Boss, Item Level 101 e Raro ou acima.',
      '**Defesas fixas só saem em peça que tenha aquela defesa**: Armour, Evasion e Energy Shield dependem do que a base da peça tem (anéis e amuletos são livres).',
      '**O Nível das gemas encaixadas (gem_level) não usa tier**: o valor vem da raridade da peça (+1 em Incomum e Raro, +2 em Épico, Lendário e Mítico).',
      '**Dano adicional** soma um dano mínimo e um máximo ao ataque da arma; a tabela mostra o par "mínimo–máximo" de cada tier.',
    ]),
  );

  const estado = { categoria: 'todas', onde: 'todos', texto: '' };
  const filtros = el('div');
  const f1 = el('div', 'wiki-filtros');
  const f2 = el('div', 'wiki-filtros');
  const busca = el('input');
  busca.type = 'search';
  busca.placeholder = 'buscar modificador...';
  busca.className = 'wiki-busca';
  const resultado = el('div');
  const botoes = (alvo, itens, chave) => {
    for (const [valor, nome] of itens) {
      const b = el('button', null, nome);
      b.type = 'button';
      b.dataset.valor = valor;
      b.onclick = () => { estado[chave] = valor; desenharMods(); };
      alvo.append(b);
    }
  };
  botoes(f1, [['todas', 'Todos'], ...Object.entries(d.categorias)], 'categoria');
  botoes(f2, [['todos', 'Qualquer equipamento'], ...d.gruposDeEquipamento.map((g) => [g.id, g.nome])], 'onde');
  busca.addEventListener('input', () => { estado.texto = busca.value.trim().toLowerCase(); desenharMods(); });
  filtros.append(el('div', 'wiki-rotulo', 'Categoria'), f1, el('div', 'wiki-rotulo', 'Onde pode cair'), f2, el('div', 'wiki-rotulo', 'Busca'), busca);

  function desenharMods() {
    for (const b of f1.children) b.setAttribute('aria-pressed', String(b.dataset.valor === estado.categoria));
    for (const b of f2.children) b.setAttribute('aria-pressed', String(b.dataset.valor === estado.onde));
    const visiveis = d.modificadores.filter((m) => (estado.categoria === 'todas' || m.categoria === estado.categoria) && (estado.onde === 'todos' || m.onde.includes(estado.onde)) && (!estado.texto || `${m.nome} ${m.id}`.toLowerCase().includes(estado.texto)));
    const nomesDeOnde = Object.fromEntries(d.gruposDeEquipamento.map((g) => [g.id, g.nome]));
    resultado.replaceChildren(
      el('div', 'wiki-rotulo', `${visiveis.length} modificador${visiveis.length === 1 ? '' : 'es'}`),
      tabela(
        ['Modificador', 'T1', 'T2', 'T3', 'T4', 'T5', 'Item Level mín.', 'Raridades', 'Frequência', 'Onde cai'],
        visiveis.map((m) => [
          m.nome,
          ...(m.valorPorRaridade
            ? [1, 2, 3, 4, 5].map(() => '—')
            : [1, 2, 3, 4, 5].map((t) => faixaDoMod(m, t))),
          String(m.itemLevelMinimo),
          m.raridades.length === d.raridades.length ? 'todas' : m.raridades.map((r) => nomeDe[r]).join(', '),
          m.frequencia,
          m.onde.length === d.gruposDeEquipamento.length ? 'qualquer' : m.onde.map((o) => nomesDeOnde[o]).join(', '),
        ]),
        { numericas: [1, 2, 3, 4, 5, 6] },
      ),
    );
  }
  corpo.append(filtros, resultado);
  desenharMods();
  corpo.append(rico('p', 'Os valores "—" são de modificadores cujo valor vem da raridade e não do tier. As porcentagens são somadas entre as peças vestidas; resistências, chance de crítico, penetração e ataque duplo têm teto no combate (resistência do jogador: 75%).'));

  // ---- poderes
  corpo.append(h2('Poderes lendários e míticos', 'poderes'));
  corpo.append(p('Além dos modificadores, as peças Lendárias (às vezes) e Míticas (sempre) trazem **um poder especial**, sorteado entre os da lista. O poder é separado dos modificadores e não conta no limite deles.'));
  for (const grupo of d.poderes) {
    corpo.append(el('h3', null, grupo.grupo === 'lendario' ? 'Poderes Lendários' : 'Poderes Míticos'));
    corpo.append(tabela(['Poder', 'O que faz'], grupo.lista.map((x) => [x.nome, x.texto])));
  }

  // ---- faq
  corpo.append(h2('Perguntas rápidas', 'faq'));
  for (const [q, a] of [
    ['T1 é o melhor tier?', 'Não. No Draevor T1 é o mais fraco e T5 o mais forte.'],
    ['Por que não vejo T5 nas minhas peças?', 'O T5 só é liberado com Item Level acima de 1200 (e o sorteio ainda favorece os tiers baixos). Em fases de level baixo saem T1 e T2.'],
    ['Uma peça rara sempre tem tier alto?', 'Não. A raridade só inclina o sorteio para cima; cada modificador sorteia o seu tier, então uma peça pode ter T1 e T4 juntos.'],
    ['Quantos modificadores tem uma peça Mítica?', '5 ou 6, todos diferentes, mais um poder supremo.'],
    ['Existe prefixo e sufixo?', 'Não. A peça tem uma lista de modificadores diferentes, e é só isso.'],
  ]) corpo.append(el('h3', null, q), p(a));
}

// ------------------------------------------------------------------------------------------------ os artigos

const ARTIGOS = [
  {
    slug: 'itens',
    titulo: 'Itens: raridade, tiers e modificadores',
    resumo: 'Como a raridade, o tier e os modificadores de um item funcionam, com as tabelas reais do jogo.',
    dados: '/api/wiki/itens',
    desenhar: desenharItens,
  },
];

function slugDoCaminho() {
  const m = /^\/wiki\/([a-z0-9-]+)\/?$/.exec(location.pathname);
  return m ? m[1] : null;
}

async function iniciar() {
  const indice = document.getElementById('wiki-indice');
  const artigoEl = document.getElementById('wiki-artigo');
  const slug = slugDoCaminho();
  const inicio = el('a', null, 'Início');
  inicio.href = '/wiki';
  if (!slug) inicio.setAttribute('aria-current', 'page');
  indice.append(inicio);
  for (const a of ARTIGOS) {
    const l = el('a', null, a.titulo);
    l.href = `/wiki/${a.slug}`;
    if (a.slug === slug) l.setAttribute('aria-current', 'page');
    indice.append(l);
  }
  artigoEl.replaceChildren();
  if (!slug) {
    document.title = 'Wiki — Draevor Idle';
    artigoEl.append(el('h1', null, 'Wiki do Draevor Idle'));
    artigoEl.append(el('p', 'wiki-resumo', 'Tudo sobre o jogo, escrito com os números reais. A wiki está começando: os artigos entram aos poucos.'));
    const cartoes = el('div', 'wiki-cartoes');
    for (const a of ARTIGOS) {
      const c = el('a', 'wiki-cartao');
      c.href = `/wiki/${a.slug}`;
      c.append(el('b', null, a.titulo), el('span', null, a.resumo));
      cartoes.append(c);
    }
    artigoEl.append(cartoes);
    return;
  }
  const artigo = ARTIGOS.find((a) => a.slug === slug);
  if (!artigo) {
    artigoEl.append(el('h1', null, 'Artigo não encontrado'), p('Esse artigo não existe (ainda).'));
    const volta = el('a', null, 'Voltar para a wiki');
    volta.href = '/wiki';
    artigoEl.append(volta);
    return;
  }
  document.title = `${artigo.titulo} — Wiki — Draevor Idle`;
  artigoEl.append(el('h1', null, artigo.titulo), el('p', 'wiki-resumo', artigo.resumo));
  try {
    const dados = await (await fetch(artigo.dados)).json();
    artigo.desenhar(artigoEl, dados);
  } catch {
    artigoEl.append(aviso('Não consegui carregar os dados agora. Tente de novo em instantes.'));
  }
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

aplicarIdioma?.();
iniciar();
