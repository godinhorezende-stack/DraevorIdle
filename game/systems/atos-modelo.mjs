// O MODELO de um Ato configurável (editor de Acts) e a validação do grafo de fases. Funções PURAS, sem importar o jogo: tudo que
// precisa consultar o cadastro (a hunt existe? o boss? o item?) entra por `ctx`, então os testes usam cadastros falsos e o editor usa
// os reais (`admin/atos.mjs`). Nada aqui roda no jogo — o runtime por grafo é a Etapa 6; isto só descreve e confere.
//
// Um ato referencia os cadastros pelo ID (hunt, boss, item): nunca copia o cadastro. O que é do ato fica no ato (nome, ordem, ligações,
// requisitos, recompensas, sobrescritas da fase).
//
//   ato = { id, nome, descricao, imagem?, nivelRecomendado, ordem, anterior, seguinte, requisitos:{exige:[atoId]}, progressao:{...},
//           estado: 'rascunho'|'beta'|'publicado'|'desativado', versao,
//           inicio: faseId,
//           fases: [{ id, nome, descricao, ordem, huntId, tipo, nivel:{facil,medio,dificil}, obrigatoria, requisitos:{exige:[faseId]},
//                     objetivos, conclusao:{tipo}, recompensas, eventos, sobrescritas, posicao:{x,y} }],
//           conexoes: [{ de, para, requisito:{exige:[faseId]}|null, rotulo }],
//           bossFinal: { bossId, faseAnterior, arena, recompensas } | null }
//
// RECOMPENSAS (fase e boss final): o MESMO formato dos encontros (`systems/encontros/recompensas.mjs`), entregue pelo loot de sempre:
//   { drops: [{ id, chance (%) }],   // cada item sorteia por conta própria (chance INDIVIDUAL por item) a cada rolagem
//     rolagens: 1..5,                // quantas vezes a lista inteira é sorteada
//     moedasMedia,                   // média das moedas de ouro por rolagem
//     primeiraConclusao: { gold, exp, itens: [{ id, count }] } }   // paga UMA vez por personagem (fase: 1ª limpeza; boss: 1ª vitória)
// Nada de peso, quantidade mín./máx. por drop nem condição: o loot do jogo não tem esses modelos, então o editor não os oferece.

export const ESTADOS = ['rascunho', 'beta', 'publicado', 'desativado'];
export const ID_VALIDO = /^[a-z0-9-]{3,40}$/;

/**
 * Tipos de fase que o editor conhece. `suportado`: o runtime de hoje sabe executá-lo (uma hunt de campanha: limpar a instância completa a
 * fase). Os outros ficam registrados, mas NÃO publicam: "não implementar tipo sem suporte real no runtime" — antes de ligar um, o suporte
 * é criado e testado (cada um tem a sua razão abaixo).
 */
export const TIPOS_DE_FASE = {
  'hunt-normal': { suportado: true, exigeHunt: true, nome: 'Hunt normal' },
  'fase-final-do-ato': { suportado: true, exigeHunt: true, nome: 'Fase final do ato (abre o portal do boss)' },
  // VIP/Instance/Divine como fase: a instância sai dos pontos da sala gerada (`Cacadas.spawnsDaSalaGerada`) e a entrada segue a regra de acesso
  // da hunt (premium, pergaminho e level — com o modo beta ligado o acesso é livre). A fase só abre para quem pode entrar nela.
  'hunt-vip': { suportado: true, exigeHunt: true, nome: 'Hunt VIP (exige premium)', categoria: 'vips' },
  'hunt-especial': { suportado: true, exigeHunt: true, nome: 'Hunt especial (Instance/Divine: exige acesso)', categoria: 'especial' },
  'fase-com-bau': { suportado: false, exigeHunt: true, nome: 'Fase com baú', motivo: 'o baú é um encontro da hunt (aba Fase), não um tipo de fase' },
  'fase-com-evento': { suportado: false, exigeHunt: true, nome: 'Fase com evento', motivo: 'o evento é um encontro da hunt (aba Fase), não um tipo de fase' },
  'boss-opcional': { suportado: false, exigeHunt: true, nome: 'Fase com boss opcional', motivo: 'o boss opcional é um encontro da hunt (aba Fase)' },
  'boss-obrigatorio': { suportado: false, exigeHunt: true, nome: 'Fase com boss obrigatório', motivo: 'sem condição de conclusão por boss no runtime' },
  transicao: { suportado: false, exigeHunt: false, nome: 'Fase de transição', motivo: 'sem tela/estado de transição no runtime' },
};

/**
 * Como a fase CONCLUI (`fase.conclusao.tipo`), todas com suporte no runtime (`Campanha.limpou` / `Campanha.matou`):
 *   limpar-hunt     — limpar a instância inteira (o de sempre);
 *   matar-chefe     — matar um monstro da área (`monstro`: a chave do bestiário ou o slug do monstro do PoE);
 *   matar-n         — matar `quantidade` monstros da área (`monstro` opcional: só daquele);
 *   item-de-missao  — o monstro alvo (`monstro`) solta o item da missão (`item`: id do item) e pegá-lo conclui.
 */
export const TIPOS_DE_CONCLUSAO = {
  'limpar-hunt': { nome: 'Limpar a área (todos os bichos)' },
  'matar-chefe': { nome: 'Matar o chefe/único da área', exigeMonstro: true },
  'matar-n': { nome: 'Matar N monstros', exigeQuantidade: true },
  'item-de-missao': { nome: 'Missão: item de um monstro', exigeMonstro: true, exigeItem: true },
};

const erro = (onde, mensagem) => ({ nivel: 'erro', onde, mensagem });
const aviso = (onde, mensagem) => ({ nivel: 'aviso', onde, mensagem });
const lista = (v) => (Array.isArray(v) ? v : []);

/** Completa um ato bruto com os padrões (sem inventar conteúdo): o que o editor grava sempre tem esta forma. */
export function normalizar(bruto = {}) {
  return {
    id: bruto.id ?? '',
    nome: bruto.nome ?? '',
    descricao: bruto.descricao ?? '',
    imagem: bruto.imagem ?? null,
    nivelRecomendado: bruto.nivelRecomendado ?? null,
    ordem: bruto.ordem ?? null,
    anterior: bruto.anterior ?? null,
    seguinte: bruto.seguinte ?? null,
    requisitos: { exige: lista(bruto.requisitos?.exige) },
    progressao: bruto.progressao ?? {},
    estado: ESTADOS.includes(bruto.estado) ? bruto.estado : 'rascunho',
    versao: Number.isInteger(bruto.versao) && bruto.versao > 0 ? bruto.versao : 1,
    inicio: bruto.inicio ?? null,
    fases: lista(bruto.fases).map((f) => ({
      id: f.id ?? '',
      nome: f.nome ?? '',
      descricao: f.descricao ?? '',
      ordem: f.ordem ?? null,
      huntId: f.huntId ?? null,
      tipo: f.tipo ?? 'hunt-normal',
      nivel: f.nivel ?? null,
      obrigatoria: f.obrigatoria !== false,
      requisitos: { exige: lista(f.requisitos?.exige) },
      objetivos: lista(f.objetivos),
      conclusao: f.conclusao ?? { tipo: 'limpar-hunt' },
      recompensas: f.recompensas ?? null,
      eventos: lista(f.eventos),
      sobrescritas: f.sobrescritas ?? {},
      posicao: f.posicao ?? null,
    })),
    conexoes: lista(bruto.conexoes).map((c) => ({ de: c.de, para: c.para, requisito: c.requisito ?? null, rotulo: c.rotulo ?? '' })),
    bossFinal: bruto.bossFinal ?? null,
  };
}

// ------------------------------------------------------------------ o grafo

/** Mapa `id → [ids]` das saídas (só as ligações com os dois lados existentes). */
export function saidas(ato) {
  const ids = new Set(ato.fases.map((f) => f.id));
  const m = new Map(ato.fases.map((f) => [f.id, []]));
  for (const c of ato.conexoes) if (ids.has(c.de) && ids.has(c.para)) m.get(c.de).push(c.para);
  return m;
}

/** Os ids alcançáveis a partir de `inicio` (inclui ele). */
export function alcancaveis(ato) {
  const s = saidas(ato);
  const visto = new Set();
  if (!s.has(ato.inicio)) return visto;
  const pilha = [ato.inicio];
  while (pilha.length) {
    const id = pilha.pop();
    if (visto.has(id)) continue;
    visto.add(id);
    for (const p of s.get(id) ?? []) pilha.push(p);
  }
  return visto;
}

/** Um ciclo (lista de ids) se houver, senão `null` — DFS com cores. */
export function acharCiclo(ato) {
  const s = saidas(ato);
  const cor = new Map(); // 1 = no caminho, 2 = pronto
  const caminho = [];
  const visita = (id) => {
    cor.set(id, 1);
    caminho.push(id);
    for (const p of s.get(id) ?? []) {
      if (cor.get(p) === 1) return [...caminho.slice(caminho.indexOf(p)), p];
      if (!cor.has(p)) {
        const c = visita(p);
        if (c) return c;
      }
    }
    caminho.pop();
    cor.set(id, 2);
    return null;
  };
  for (const f of ato.fases) if (!cor.has(f.id)) {
    const c = visita(f.id);
    if (c) return c;
  }
  return null;
}

/**
 * Quais fases estão ABERTAS dado o conjunto de completas — a regra do grafo: a fase inicial está sempre aberta; as outras abrem quando
 * alguma ligação que chega nela tem a origem completa e o requisito da ligação (e o da fase) cumprido. É a definição que o runtime por
 * grafo (Etapa 6) vai usar; o importador dos atos legados prova que, num ato linear, ela dá o mesmo que o runtime atual.
 */
export function fasesAbertas(ato, completas) {
  const feitas = completas instanceof Set ? completas : new Set(completas);
  const entradas = new Map(ato.fases.map((f) => [f.id, []]));
  for (const c of ato.conexoes) entradas.get(c.para)?.push(c);
  const exigeOk = (ids) => lista(ids).every((id) => feitas.has(id));
  const abertas = new Set();
  for (const f of ato.fases) {
    if (!exigeOk(f.requisitos.exige)) continue;
    if (f.id === ato.inicio) abertas.add(f.id);
    else if (entradas.get(f.id).some((c) => feitas.has(c.de) && exigeOk(c.requisito?.exige))) abertas.add(f.id);
  }
  return abertas;
}

// ------------------------------------------------------------------ validação

/**
 * Confere um ato. `ctx`: `{ huntExiste(huntId), bossExiste(bossId), huntsEmUso: Map<huntId, atoId> (outros atos), atos: [{id}] }`
 * (tudo opcional: o que não vier não é conferido). Devolve `[{nivel:'erro'|'aviso', onde, mensagem}]`: `onde` aponta a fase ou o campo.
 * Para estados `beta`/`publicado` os avisos de "sem suporte no runtime" viram ERRO.
 */
export function validarAto(bruto, ctx = {}) {
  const a = normalizar(bruto);
  const r = [];
  const exige = a.estado === 'beta' || a.estado === 'publicado';
  if (!ID_VALIDO.test(a.id)) r.push(erro('ato.id', 'ID de 3 a 40 caracteres: letras minúsculas, números e hífen.'));
  if (!a.nome.trim() || a.nome.length > 60) r.push(erro('ato.nome', 'Nome obrigatório, até 60 caracteres.'));
  if (a.descricao.length > 600) r.push(erro('ato.descricao', 'Descrição de até 600 caracteres.'));
  if (a.nivelRecomendado != null && !(Number.isFinite(a.nivelRecomendado) && a.nivelRecomendado >= 1)) r.push(erro('ato.nivelRecomendado', 'Nível recomendado precisa ser um número ≥ 1.'));
  for (const campo of ['anterior', 'seguinte']) {
    if (a[campo] == null) continue;
    if (a[campo] === a.id) r.push(erro(`ato.${campo}`, 'Um ato não pode apontar para si mesmo.'));
    else if (ctx.atos && !ctx.atos.some((x) => x.id === a[campo])) r.push(erro(`ato.${campo}`, `O ato "${a[campo]}" não existe.`));
  }
  for (const e of a.requisitos.exige) if (ctx.atos && !ctx.atos.some((x) => x.id === e)) r.push(erro('ato.requisitos', `O ato exigido "${e}" não existe.`));

  // Para o jogo executar o ato (beta/publicado): o `ordem` é o NÚMERO do ato no jogo (os legados são 1–4), único e inteiro.
  if (exige && !/^legado-\d+$/.test(a.id)) {
    const min = ctx.ordemMinima ?? 5;
    if (!(Number.isInteger(a.ordem) && a.ordem >= min)) r.push(erro('ato.ordem', `Para beta/publicado, a ordem é o número do ato no jogo: inteiro, ${min} ou mais (1 a ${min - 1} são dos atos legados).`));
    else if (ctx.ordensEmUso?.has(a.ordem)) r.push(erro('ato.ordem', `A ordem ${a.ordem} já é do ato "${ctx.ordensEmUso.get(a.ordem)}".`));
  }
  // ---- fases
  if (!a.fases.length) r.push(erro('ato.fases', 'O ato não tem nenhuma fase.'));
  const ids = new Set();
  const ordens = new Set();
  for (const f of a.fases) {
    const onde = `fase ${f.id || '(sem id)'}`;
    if (!ID_VALIDO.test(f.id)) r.push(erro(onde, 'ID da fase inválido (3 a 40: minúsculas, números, hífen).'));
    if (ids.has(f.id)) r.push(erro(onde, 'ID de fase repetido.'));
    ids.add(f.id);
    if (!f.nome.trim()) r.push(erro(onde, 'A fase precisa de nome.'));
    if (f.ordem != null) {
      if (ordens.has(f.ordem)) r.push(aviso(onde, `A ordem ${f.ordem} se repete.`));
      ordens.add(f.ordem);
    }
    const tipo = TIPOS_DE_FASE[f.tipo];
    if (!tipo) r.push(erro(onde, `Tipo de fase "${f.tipo}" desconhecido.`));
    else {
      if (!tipo.suportado) r.push(exige ? erro(onde, `O tipo "${f.tipo}" ainda não tem suporte no runtime (${tipo.motivo}).`) : aviso(onde, `O tipo "${f.tipo}" ainda não tem suporte no runtime (${tipo.motivo}); só como rascunho.`));
      if (tipo.exigeHunt && !f.huntId) r.push(erro(onde, 'Escolha a hunt (da Biblioteca) desta fase.'));
      if (f.huntId && ctx.huntExiste && !ctx.huntExiste(f.huntId)) r.push(erro(onde, `A hunt "${f.huntId}" não existe no cadastro.`));
      // O tipo da fase precisa dizer a verdade sobre a hunt: VIP/especial exigem acesso, e o jogador precisa saber disso antes de entrar.
      const cat = f.huntId && ctx.categoriaDaHunt?.(f.huntId);
      if (cat) {
        const esperado = cat === 'vips' ? 'hunt-vip' : ['especiais', 'divinas'].includes(cat) ? 'hunt-especial' : null;
        if (esperado && !['fase-final-do-ato'].includes(f.tipo) && f.tipo !== esperado) r.push(erro(onde, `A hunt "${f.huntId}" é ${cat === 'vips' ? 'VIP' : 'especial'} (exige acesso): use o tipo "${esperado}".`));
        if (!esperado && ['hunt-vip', 'hunt-especial'].includes(f.tipo)) r.push(erro(onde, `A hunt "${f.huntId}" é uma hunt normal: use o tipo "hunt-normal".`));
        if (esperado && f.tipo === 'fase-final-do-ato') r.push(aviso(onde, `Fase final com hunt ${cat === 'vips' ? 'VIP' : 'especial'}: só quem tem acesso chega ao boss final.`));
      }
      if (f.huntId && ctx.huntsEmUso?.has(f.huntId)) r.push(erro(onde, `A hunt "${f.huntId}" já é usada no ato "${ctx.huntsEmUso.get(f.huntId)}": o progresso é por hunt e os dois atos compartilhariam a conclusão.`));
    }
    if (exige && f.nivel == null && tipo?.suportado) r.push(erro(onde, 'Defina o nível da fase nas 3 dificuldades: a força dos bichos é escalada para ele.'));
    if (f.nivel != null) for (const d of ['facil', 'medio', 'dificil']) if (!(Number.isFinite(f.nivel[d]) && f.nivel[d] >= 1)) r.push(erro(onde, `Nível "${d}" precisa ser um número ≥ 1.`));
    const conc = TIPOS_DE_CONCLUSAO[f.conclusao?.tipo];
    if (!conc) r.push(erro(onde, `Condição de conclusão "${f.conclusao?.tipo}" desconhecida.`));
    else {
      if (conc.exigeMonstro && !f.conclusao.monstro) r.push(erro(onde, `"${conc.nome}": escolha o monstro.`));
      if (conc.exigeQuantidade && !(Number.isInteger(f.conclusao.quantidade) && f.conclusao.quantidade >= 1)) r.push(erro(onde, `"${conc.nome}": a quantidade precisa ser um inteiro ≥ 1.`));
      if (conc.exigeItem && !(ctx.itemExiste ? ctx.itemExiste(f.conclusao.item) : f.conclusao.item)) r.push(erro(onde, `"${conc.nome}": o item ${f.conclusao.item ?? '(nenhum)'} não existe no catálogo.`));
    }
    for (const e of f.requisitos.exige) {
      if (e === f.id) r.push(erro(onde, 'A fase não pode exigir a si mesma.'));
      else if (!a.fases.some((x) => x.id === e)) r.push(erro(onde, `O requisito "${e}" não é uma fase deste ato.`));
    }
  }
  for (const f of a.fases) if (f.huntId && a.fases.filter((x) => x.huntId === f.huntId).length > 1 && f.id === a.fases.find((x) => x.huntId === f.huntId).id) r.push(erro(`fase ${f.id}`, `A hunt "${f.huntId}" aparece em mais de uma fase do ato (o progresso é por hunt).`));

  // ---- recompensas (fase e boss final)
  const conferirRecompensa = (rec, onde, huntId = null) => {
    if (rec == null) return;
    const vazia = !lista(rec.drops).length && !rec.tabela && !rec.primeiraConclusao;
    if (vazia) return r.push(aviso(onde, 'Recompensa vazia (nada será pago).'));
    for (const msg of ctx.validarRecompensa?.(rec, 'recompensa') ?? []) r.push(erro(onde, msg));
    const ids = lista(rec.drops).map((d) => d?.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const id of new Set(repetidos)) r.push(aviso(onde, `O item ${id} aparece mais de uma vez nos drops: cada linha sorteia à parte e a chance se soma.`));
    for (const it of lista(rec.primeiraConclusao?.itens)) if (ids.includes(it?.id)) r.push(aviso(onde, `O item ${it.id} está nos drops E na primeira conclusão: o jogador pode receber o mesmo item pelas duas fontes.`));
    for (const x of ctx.avaliarEconomia?.(huntId, rec) ?? []) r.push(x.nivel === 'erro' ? erro(onde, x.mensagem) : aviso(onde, x.mensagem));
  };
  for (const f of a.fases) conferirRecompensa(f.recompensas, `fase ${f.id}`, f.huntId);
  if (a.bossFinal) conferirRecompensa(a.bossFinal.recompensas, 'boss final');

  // ---- ligações
  const pares = new Set();
  for (const c of a.conexoes) {
    const onde = `ligação ${c.de} → ${c.para}`;
    if (!ids.has(c.de)) r.push(erro(onde, `A fase de origem "${c.de}" não existe.`));
    if (!ids.has(c.para)) r.push(erro(onde, `A fase de destino "${c.para}" não existe.`));
    if (c.de === c.para) r.push(erro(onde, 'A fase não pode se ligar a si mesma.'));
    const chave = `${c.de}>${c.para}`;
    if (pares.has(chave)) r.push(aviso(onde, 'Ligação repetida.'));
    pares.add(chave);
    for (const e of lista(c.requisito?.exige)) if (!ids.has(e)) r.push(erro(onde, `O requisito do caminho "${e}" não é uma fase deste ato.`));
  }
  if (a.fases.length) {
    if (!a.inicio || !ids.has(a.inicio)) r.push(erro('ato.inicio', 'Defina a fase inicial (precisa ser uma fase do ato).'));
    const ciclo = acharCiclo(a);
    if (ciclo) r.push(erro('ato.conexoes', `Ciclo entre fases: ${ciclo.join(' → ')}.`));
    if (ids.has(a.inicio)) {
      const vivas = alcancaveis(a);
      for (const f of a.fases) if (!vivas.has(f.id)) r.push(erro(`fase ${f.id}`, 'Fase isolada: nenhum caminho chega nela a partir da fase inicial.'));
    }
  }

  // ---- boss final
  const b = a.bossFinal;
  const s = saidas(a);
  const terminais = a.fases.filter((f) => !(s.get(f.id)?.length));
  if (!b) {
    r.push(exige ? erro('ato.bossFinal', 'Defina o boss final do ato.') : aviso('ato.bossFinal', 'O ato ainda não tem boss final.'));
    if (a.fases.length && !terminais.length && !acharCiclo(a)) r.push(aviso('ato.conexoes', 'Nenhuma fase termina o ato.'));
  } else {
    if (!b.bossId) r.push(erro('boss final', 'Escolha o boss (da Biblioteca).'));
    else if (ctx.bossExiste && !ctx.bossExiste(b.bossId)) r.push(erro('boss final', `O boss "${b.bossId}" não existe no cadastro.`));
    else if (ctx.bossesEmUso?.has(b.bossId)) r.push(erro('boss final', `O boss "${b.bossId}" já fecha o ato "${ctx.bossesEmUso.get(b.bossId)}": o boss de ato identifica o ato (um boss, um ato).`));
    if (!b.faseAnterior || !ids.has(b.faseAnterior)) r.push(erro('boss final', 'Escolha a fase anterior ao boss (a que, limpa, abre o portal).'));
    else {
      if (s.get(b.faseAnterior)?.length) r.push(erro('boss final', `A fase "${b.faseAnterior}" tem saídas: o portal do boss final nasce da ÚLTIMA fase do ato.`));
      for (const f of terminais) if (f.id !== b.faseAnterior && f.obrigatoria) r.push(erro(`fase ${f.id}`, `Fim de caminho sem chegar ao boss: só "${b.faseAnterior}" pode encerrar o ato.`));
      const tf = a.fases.find((f) => f.id === b.faseAnterior);
      if (tf && !['hunt-normal', 'fase-final-do-ato', 'hunt-vip', 'hunt-especial'].includes(tf.tipo)) r.push(erro('boss final', 'A fase anterior ao boss precisa ser uma hunt (o portal abre ao limpar a instância).'));
    }
  }
  return r;
}

/** Só os erros bloqueiam; avisos não. */
export const temErro = (problemas) => problemas.some((p) => p.nivel === 'erro');

// ------------------------------------------------------------------ comparação entre versões

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const CAMPOS_DO_ATO = ['nome', 'descricao', 'imagem', 'nivelRecomendado', 'ordem', 'anterior', 'seguinte', 'requisitos', 'progressao', 'estado', 'inicio'];
const CAMPOS_DA_FASE = ['nome', 'descricao', 'ordem', 'huntId', 'tipo', 'nivel', 'obrigatoria', 'requisitos', 'objetivos', 'conclusao', 'recompensas', 'eventos', 'sobrescritas'];
const chaveDaLigacao = (c) => `${c.de}>${c.para}`;

/**
 * As DIFERENÇAS entre dois atos (`antes` → `depois`), para a tela de versões. Pura. Posições no canvas (`posicao`) não contam como mudança
 * de conteúdo (só arrastar uma fase não é uma versão diferente de verdade, mas fica registrada em `soPosicao`).
 * Devolve `{ iguais, ato: [{campo, antes, depois}], fasesNovas, fasesRemovidas, fasesAlteradas: [{id, campos: [{campo, antes, depois}]}],
 * ligacoesNovas, ligacoesRemovidas, ligacoesAlteradas, bossFinal: [{campo, antes, depois}], soPosicao }`.
 */
export function diffDeAtos(antes, depois) {
  const a = normalizar(antes);
  const b = normalizar(depois);
  const campos = (x, y, lista) => lista.filter((c) => !igual(x[c], y[c])).map((campo) => ({ campo, antes: x[campo] ?? null, depois: y[campo] ?? null }));
  const idsA = new Map(a.fases.map((f) => [f.id, f]));
  const idsB = new Map(b.fases.map((f) => [f.id, f]));
  const fasesAlteradas = [];
  let soPosicao = 0;
  for (const [id, fb] of idsB) {
    const fa = idsA.get(id);
    if (!fa) continue;
    const c = campos(fa, fb, CAMPOS_DA_FASE);
    if (c.length) fasesAlteradas.push({ id, nome: fb.nome, campos: c });
    else if (!igual(fa.posicao, fb.posicao)) soPosicao++;
  }
  const ligA = new Map(a.conexoes.map((c) => [chaveDaLigacao(c), c]));
  const ligB = new Map(b.conexoes.map((c) => [chaveDaLigacao(c), c]));
  const bossA = a.bossFinal ?? {};
  const bossB = b.bossFinal ?? {};
  const bossCampos = ['bossId', 'faseAnterior', 'arena', 'recompensas', 'nivel'].filter((c) => !igual(bossA[c], bossB[c])).map((campo) => ({ campo, antes: bossA[campo] ?? null, depois: bossB[campo] ?? null }));
  const r = {
    ato: campos(a, b, CAMPOS_DO_ATO),
    fasesNovas: [...idsB.keys()].filter((id) => !idsA.has(id)),
    fasesRemovidas: [...idsA.keys()].filter((id) => !idsB.has(id)),
    fasesAlteradas,
    ligacoesNovas: [...ligB.keys()].filter((k) => !ligA.has(k)),
    ligacoesRemovidas: [...ligA.keys()].filter((k) => !ligB.has(k)),
    ligacoesAlteradas: [...ligB.keys()].filter((k) => ligA.has(k) && !igual(ligA.get(k), ligB.get(k))),
    bossFinal: bossCampos,
    soPosicao,
  };
  r.iguais = !r.ato.length && !r.fasesNovas.length && !r.fasesRemovidas.length && !r.fasesAlteradas.length && !r.ligacoesNovas.length && !r.ligacoesRemovidas.length && !r.ligacoesAlteradas.length && !r.bossFinal.length;
  return r;
}
