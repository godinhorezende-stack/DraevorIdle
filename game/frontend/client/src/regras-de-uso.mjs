// A janela das REGRAS DE USO AUTOMÁTICO por tag (etapa 5): "quando [condição],
// [preferir | só usar | não usar] as skills com a tag [X]". Quem decide é o
// servidor (`systems/skills/regras-de-uso.mjs`); aqui só se monta a lista e se
// manda `{t:'regrasDeUso', regras}`.
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const CONDICOES = {
  sempre: 'Sempre',
  perto: 'Bichos por perto ≥',
  vida: 'Minha vida ≤ %',
  mana: 'Minha mana ≤ %',
  boss: 'Sala de boss',
  foraDeBoss: 'Fora de boss',
};
const ACOES = { preferir: 'preferir', somente: 'só usar', bloquear: 'não usar' };
const TAGS = {
  area: 'Área',
  wave: 'Onda',
  single: 'Alvo único',
  projectile: 'Projétil',
  chain: 'Cadeia',
  melee: 'Corpo a corpo',
  ranged: 'À distância',
  fire: 'Fogo',
  ice: 'Gelo',
  energy: 'Energia',
  earth: 'Terra',
  holy: 'Sagrado',
  death: 'Morte',
  physical: 'Físico',
  buff: 'Buff/Reforço',
  summon: 'Familiar',
  rune: 'Runa',
};
// As regras prontas do prompt do dono.
const PRONTAS = [
  { nome: 'Muitos bichos → área', quando: [{ kind: 'perto', op: 'gte', value: 3 }], acao: 'preferir', tags: ['area', 'wave'] },
  { nome: 'Boss → alvo único', quando: [{ kind: 'boss', op: 'sim' }], acao: 'preferir', tags: ['single'] },
  { nome: 'Mana baixa → sem buff', quando: [{ kind: 'stat', who: 'self', stat: 'mana', op: 'lte', value: 20, percent: true }], acao: 'bloquear', tags: ['buff'] },
];

// A condição da regra ↔ o que o seletor mostra.
function tipoDaCondicao(q) {
  const c = q?.[0];
  if (!c) return 'sempre';
  if (c.kind === 'perto') return 'perto';
  if (c.kind === 'boss') return c.op === 'nao' ? 'foraDeBoss' : 'boss';
  if (c.kind === 'stat') return c.stat === 'mana' ? 'mana' : 'vida';
  return 'sempre';
}
function condicaoDoTipo(tipo, valor) {
  if (tipo === 'perto') return [{ kind: 'perto', op: 'gte', value: valor ?? 3 }];
  if (tipo === 'boss') return [{ kind: 'boss', op: 'sim' }];
  if (tipo === 'foraDeBoss') return [{ kind: 'boss', op: 'nao' }];
  if (tipo === 'vida' || tipo === 'mana') return [{ kind: 'stat', who: 'self', stat: tipo === 'mana' ? 'mana' : 'hp', op: 'lte', value: valor ?? 40, percent: true }];
  return [];
}

const select = (opcoes, valor, aoMudar) => {
  const s = document.createElement('select');
  for (const [id, rotulo] of Object.entries(opcoes)) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = rotulo;
    s.append(o);
  }
  s.value = valor;
  s.onchange = () => aoMudar(s.value);
  return s;
};

export function abrirRegrasDeUso(ctx) {
  let rascunho = structuredClone(ctx.state.character?.regrasDeUso ?? []);
  const desenhar = () =>
    ctx.openModal('Regras de uso automático', (body) => {
      body.append(
        el(
          'p',
          'shop-note',
          'Mudam a barra automática pelo TIPO da skill (as tags): quando a condição bate, as skills com a tag são tentadas primeiro (preferir), são as únicas da fileira de ataque (só usar) ou não saem (não usar). Cura e poção nunca são barradas. Sem regra, a barra funciona como sempre.'
        )
      );
      const lista = el('div', 'regras-lista');
      rascunho.forEach((r, i) => {
        const linha = el('div', 'regra-linha');
        const liga = document.createElement('input');
        liga.type = 'checkbox';
        liga.checked = r.ativa !== false;
        liga.title = 'Ligada';
        liga.onchange = () => (r.ativa = liga.checked);
        const tipo = tipoDaCondicao(r.quando);
        const valor = r.quando?.[0]?.value;
        const quando = select(CONDICOES, tipo, (t) => {
          r.quando = condicaoDoTipo(t);
          desenhar();
        });
        linha.append(liga, el('span', null, 'Quando'), quando);
        if (['perto', 'vida', 'mana'].includes(tipo)) {
          const n = document.createElement('input');
          n.type = 'number';
          n.min = '0';
          n.max = tipo === 'perto' ? '25' : '100';
          n.value = String(valor ?? '');
          n.className = 'regra-numero';
          n.oninput = () => (r.quando = condicaoDoTipo(tipo, Number(n.value) || 0));
          linha.append(n);
        }
        linha.append(
          el('span', null, '→'),
          select(ACOES, r.acao ?? 'preferir', (a) => (r.acao = a)),
          select(TAGS, r.tags?.[0] ?? 'area', (t) => (r.tags = t === 'area' ? ['area', 'wave'] : [t]))
        );
        const tirar = el('button', 'danger step', '✕');
        tirar.onclick = () => {
          rascunho.splice(i, 1);
          desenhar();
        };
        linha.append(tirar);
        lista.append(linha);
      });
      if (!rascunho.length) lista.append(el('p', 'empty', 'Nenhuma regra. Use uma pronta abaixo ou crie a sua.'));
      body.append(lista);

      const prontas = el('div', 'regras-prontas');
      for (const p of PRONTAS) {
        const b = el('button', 'ghost', `+ ${p.nome}`);
        b.onclick = () => {
          rascunho.push(structuredClone(p));
          desenhar();
        };
        prontas.append(b);
      }
      const nova = el('button', 'ghost', '+ Regra nova');
      nova.onclick = () => {
        rascunho.push({ ativa: true, quando: [], acao: 'preferir', tags: ['single'] });
        desenhar();
      };
      prontas.append(nova);
      body.append(prontas);

      const salvar = el('button', 'primary', 'Salvar regras');
      salvar.onclick = () => {
        ctx.send({ t: 'regrasDeUso', regras: rascunho });
        ctx.closeModal();
      };
      body.append(salvar);
    });
  desenhar();
}
