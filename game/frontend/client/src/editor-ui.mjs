// Os COMPONENTES da Engine (/editor/conteudo), compartilhados pelas abas: criação de elemento, modal (no lugar de
// `confirm`/`prompt`, que travam a página e não seguem o tema), editor JSON avançado com erro localizado, copiar
// referência, ícones e a navegação lateral. Só apresentação: nenhuma regra de jogo mora aqui.

/** Cria um elemento: `props.class`, `on*` viram eventos, `true` vira atributo vazio; filhos podem ser listas (em qualquer profundidade). */
export function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}

// ------------------------------------------------------------------ ícones (traço, 24×24)

const TRACOS = {
  painel: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  mapa: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  mundo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  fase: 'M5 20V5l7-2 7 2v15M5 10h14M9 20v-5h6v5',
  atos: 'M5 6a2 2 0 1 0 0 .01M19 6a2 2 0 1 0 0 .01M12 18a2 2 0 1 0 0 .01M7 6h10M6 8l5 8M18 8l-5 8',
  coroa: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z',
  mobs: 'M12 3c4 0 7 3 7 7v9l-2.5-2-2 2-2.5-2-2.5 2-2-2L5 19v-9c0-4 3-7 7-7zM9.5 10h.01M14.5 10h.01',
  espada: 'M14.5 4H20v5.5L9 20.5 3.5 15 14.5 4zM7 13l4 4M4 20l2.5-2.5',
  outfit: 'M9 3l3 2 3-2 5 3-2 5-2-1v10H8V10l-2 1-2-5 5-3z',
  montaria: 'M4 17v-5l3-4h6l3-3 3 1-1 4-3 2v5M8 17v-4M14 17v-3M4 12h12',
  livros: 'M4 19V5a1 1 0 0 1 1-1h3v16H5a1 1 0 0 1-1-1zM8 4h4v16H8zM14 5l3-1 4 15-3 1z',
  externo: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copiar: 'M9 9h10v11H9zM5 15V4h10',
  fechar: 'M6 6l12 12M18 6 6 18',
};
/** Um ícone de traço (`nome` em `TRACOS`), da cor do texto em volta. */
export function icone(nome) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', TRACOS[nome] ?? TRACOS.painel);
  s.append(p);
  return s;
}

// ------------------------------------------------------------------ mensagens

/** A mensagem da barra superior (`tipo`: ok | erro | aviso). */
export function msg(texto, tipo = 'aviso') {
  const m = document.querySelector('#msg');
  if (!m) return;
  m.textContent = texto;
  m.className = texto ? tipo : '';
}

/** Copia `texto` e avisa na barra (o navegador pode recusar fora de HTTPS/localhost: aí só avisa). */
export async function copiar(texto, rotulo = texto) {
  try {
    await navigator.clipboard.writeText(String(texto));
    msg(`Copiado: ${rotulo}`, 'ok');
  } catch {
    msg(`Não deu para copiar automaticamente — selecione: ${texto}`, 'aviso');
  }
}
/** Botão pequeno "copiar" para um ID ou referência. */
export const botaoCopiar = (texto, rotulo) => el('button', { type: 'button', class: 'eng-copiar', title: `Copiar ${rotulo ?? texto}`, onclick: (e) => { e.stopPropagation(); copiar(texto, rotulo); } }, 'copiar');

// ------------------------------------------------------------------ modal

/**
 * Abre um modal e resolve com a resposta. `campo` (opcional) pede um texto, com `validar(valor)` devolvendo a
 * mensagem de erro (ou nada): o modal não fecha com valor inválido. Sem campo, resolve `true`/`false`.
 */
function abrirModal({ titulo, texto = '', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false, campo = null }) {
  return new Promise((resolver) => {
    const entrada = campo ? el('input', { type: 'text', value: campo.valor ?? '', placeholder: campo.exemplo ?? '', spellcheck: 'false' }) : null;
    const erro = el('div', { class: 'eng-modal-erro', role: 'alert' });
    const botaoOk = el('button', { type: 'submit', class: perigo ? 'perigo' : 'primario' }, ok);
    const dlg = el('dialog', { class: 'eng-modal' },
      el('form', { method: 'dialog' },
        el('h3', {}, titulo),
        texto ? el('p', {}, texto) : null,
        campo ? el('label', { class: 'campo' }, campo.rotulo ?? '', entrada) : null,
        campo ? erro : null,
        el('menu', {}, el('button', { type: 'button', class: 'fantasma', onclick: () => dlg.close('cancelar') }, cancelar), botaoOk)));
    dlg.querySelector('form').addEventListener('submit', (e) => {
      if (!campo) return;
      const problema = campo.validar?.(entrada.value.trim());
      if (problema) {
        e.preventDefault();
        erro.textContent = problema;
        entrada.focus();
      }
    });
    entrada?.addEventListener('input', () => (erro.textContent = ''));
    dlg.addEventListener('close', () => {
      const confirmou = dlg.returnValue !== 'cancelar' && dlg.returnValue !== '';
      dlg.remove();
      resolver(campo ? (confirmou ? entrada.value.trim() : null) : confirmou);
    });
    document.body.append(dlg);
    dlg.showModal();
    // `returnValue` vazio = fechou pelo Esc; o botão de confirmar grava o próprio valor.
    botaoOk.value = 'ok';
    (entrada ?? botaoOk).focus();
    entrada?.select();
  });
}
/** Confirmação (resolve `true`/`false`). `perigo`: o botão de confirmar fica vermelho (excluir, descartar). */
export const confirmar = (titulo, texto = '', opcoes = {}) => abrirModal({ titulo, texto, ...opcoes });
/** Pede um texto (resolve o texto, ou `null` se cancelar). */
export const pedirTexto = (titulo, campo, opcoes = {}) => abrirModal({ titulo, campo, ok: 'Continuar', ...opcoes });
/** O aviso padrão de alterações não salvas. */
export const descartarAlteracoes = (onde = 'Há alterações não salvas') => confirmar(`${onde}.`, 'Se sair agora, elas se perdem.', { ok: 'Descartar e sair', cancelar: 'Continuar editando', perigo: true });

// ------------------------------------------------------------------ JSON avançado

/** Linha e coluna de uma posição no texto (1 = primeira). */
export function linhaColuna(texto, pos) {
  const antes = texto.slice(0, Math.max(0, pos));
  const linhas = antes.split('\n');
  return { linha: linhas.length, coluna: linhas.at(-1).length + 1 };
}

/** Lê JSON e, se falhar, diz ONDE (linha e coluna), com a mensagem do navegador. */
export function lerJson(texto) {
  try {
    return { ok: true, valor: JSON.parse(texto) };
  } catch (e) {
    const m = String(e.message);
    const lc = m.match(/line (\d+) column (\d+)/);
    const pos = m.match(/position (\d+)/);
    const onde = lc ? { linha: Number(lc[1]), coluna: Number(lc[2]) } : pos ? linhaColuna(texto, Number(pos[1])) : null;
    // A posição já vai como linha/coluna: tira o "at position N (line X column Y)" do fim da mensagem do navegador.
    return { ok: false, erro: m.replace(/^JSON\.parse: /, '').replace(/\s*(in JSON )?at position \d+.*$/, '').replace(/\s*\(line \d+ column \d+\)$/, ''), onde };
  }
}

/**
 * O editor JSON dos desenvolvedores: texto em fonte fixa, validação de sintaxe a cada tecla (com linha/coluna),
 * botão de formatar e modelos opcionais para acrescentar. Só grava em `obj[chave]` quando o JSON é válido — o
 * texto inválido fica na tela, nunca é jogado fora nem sobrescrito.
 */
export function editorJson(rotulo, obj, chave, { aoMudar = () => {}, modelos = null, dica = null } = {}) {
  const t = el('textarea', { rows: 8, spellcheck: 'false', 'aria-label': rotulo }, JSON.stringify(obj[chave] ?? [], null, 2));
  const estado = el('span', { class: 'eng-json-estado ok' }, 'JSON válido');
  const mostrar = (r) => {
    t.classList.toggle('invalido', !r.ok);
    estado.className = `eng-json-estado ${r.ok ? 'ok' : 'erro'}`;
    estado.textContent = r.ok ? 'JSON válido' : `Erro${r.onde ? ` na linha ${r.onde.linha}, coluna ${r.onde.coluna}` : ''}: ${r.erro}`;
  };
  t.addEventListener('input', () => {
    const r = lerJson(t.value);
    mostrar(r);
    if (r.ok) {
      obj[chave] = r.valor;
      aoMudar();
    }
  });
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    t.setRangeText('  ', t.selectionStart, t.selectionEnd, 'end');
  });
  const formatar = () => {
    const r = lerJson(t.value);
    if (r.ok) t.value = JSON.stringify(r.valor, null, 2);
    mostrar(r);
  };
  const acrescentar = (m) => {
    const r = lerJson(t.value);
    if (!r.ok) return mostrar(r); // não mexe em texto inválido: o usuário corrige primeiro
    const lista = Array.isArray(r.valor) ? r.valor : [];
    obj[chave] = [...lista, structuredClone(m)];
    t.value = JSON.stringify(obj[chave], null, 2);
    mostrar({ ok: true });
    aoMudar();
  };
  const caixa = el('fieldset', { class: 'eng-json' },
    el('legend', {}, rotulo),
    el('div', { class: 'eng-json-barra' },
      el('button', { type: 'button', onclick: formatar, title: 'Reindenta o JSON (só se for válido)' }, 'Formatar'),
      ...(modelos ? Object.entries(modelos).map(([nome, m]) => el('button', { type: 'button', onclick: () => acrescentar(m), title: 'Acrescenta um exemplo no fim da lista' }, `+ ${nome}`)) : [])),
    t,
    estado,
    dica ? el('div', { class: 'dica' }, dica) : null);
  /**
   * O formulário visual mudou o mesmo dado: reescreve o texto a partir do objeto. NUNCA por cima de um JSON inválido
   * (é o usuário no meio de uma edição) nem enquanto o cursor está no campo — aí só avisa.
   */
  caixa.sincronizar = () => {
    const r = lerJson(t.value);
    if (!r.ok || document.activeElement === t) {
      if (!r.ok) estado.textContent = `${estado.textContent.replace(/ — o formulário.*$/, '')} — o formulário mudou, mas o seu texto com erro foi mantido.`;
      return;
    }
    t.value = JSON.stringify(obj[chave] ?? [], null, 2);
    mostrar({ ok: true });
  };
  return caixa;
}

// ------------------------------------------------------------------ navegação lateral

/**
 * A navegação agrupada: `grupos` = `[{ titulo, itens: [{ id, nome, icone, href? }] }]`. Item com `href` é um
 * link (outra página, ex.: o editor de mapas); os outros chamam `irPara(id)`.
 */
export function navegacao(grupos, ativa, irPara) {
  return grupos.flatMap((g) => [
    el('div', { class: 'eng-nav-grupo' }, g.titulo),
    ...g.itens.map((i) => i.href
      ? el('a', { class: 'eng-nav-item', href: i.href }, icone(i.icone), i.nome, el('span', { class: 'eng-nav-extra' }, icone('externo')))
      : el('button', { type: 'button', class: `eng-nav-item${i.id === ativa ? ' ativa' : ''}`, 'aria-current': i.id === ativa ? 'page' : false, onclick: () => irPara(i.id) }, icone(i.icone), i.nome)),
  ]);
}

/** Cabeçalho de uma tela: título, descrição curta e ações à direita. */
export const cabecalho = (titulo, descricao = null, ...acoes) =>
  el('div', { class: 'eng-cabeca' }, el('div', {}, el('h1', {}, titulo), descricao ? el('p', {}, descricao) : null), acoes.length ? el('div', { class: 'eng-acoes' }, ...acoes) : null);
