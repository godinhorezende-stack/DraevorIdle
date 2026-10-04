// As rotas HTTP do editor de conteúdo (`/api/mapas/_conteudo/…`). O prefixo é o do editor de mapas de propósito: o nginx
// de produção já tranca `/api/mapas` ao público (só túnel SSH), então nenhuma rota de ESCRITA nova fica exposta.
import * as Conteudo from './conteudo.mjs';
import * as Biblioteca from './biblioteca.mjs';
import * as Atos from './atos.mjs';
import * as Hunts from './hunts.mjs';
import * as Mapas from './mapas.mjs';
import * as Operacao from './operacao.mjs';
import * as CampanhaEditor from './campanha-editor.mjs';
import * as Overrides from './overrides.mjs';
import * as Auditoria from './auditoria.mjs';
import * as OverridesItens from './overrides-itens.mjs';
import * as OverridesSprites from './overrides-sprites.mjs';
import * as Validacao from './validacao.mjs';
import * as Versoes from './versoes.mjs';
import * as GitEnvio from './git-envio.mjs';
import * as GitIntegracao from './git-integracao.mjs';
import * as OverridesProgressao from './overrides-progressao.mjs';
import * as OverridesConjuntos from './overrides-conjuntos.mjs';
import * as OverridesItemPower from './overrides-item-power.mjs';
import * as AnaliseItemPower from './item-power-analise.mjs';
import * as ItemPower from '../systems/item-power.mjs';
import * as Conjuntos from '../systems/conjuntos.mjs';
import * as Progressao from '../systems/progressao.mjs';
import * as Simulador from '../systems/itens/simulador-de-loot.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const PREFIXO = '/api/mapas/_conteudo/';

/** Atende a rota se for do editor de conteúdo; devolve `true` quando atendeu. */
/** 200 normalmente; 409 quando o salvar foi recusado por conflito de revisão (o corpo explica). */
const status = (r) => (r?.codigo === 'conflito' ? 409 : 200);

// O Hot Reload (systems/hot-reload.mjs) é ligado pelo backend; sem ele (testes, produção) a Engine vê "desligado".
let hot = null;
export const ligarHotReload = (h) => { hot = h; };
const SEM_HOT = { ativo: false, motivoInativo: 'o Hot Reload não foi iniciado neste servidor.', estado: 'desativado', mensagem: 'Hot Reload desligado.', pendentes: [], erros: [], reinicio: [], recarregaveis: [], historico: [] };

export async function atender(req, res, caminho, url, { json, corpoJson }) {
  if (!caminho.startsWith(PREFIXO)) return false;
  const rota = caminho.slice(PREFIXO.length);
  const corpo = async () => {
    const dados = await corpoJson(req).catch((e) => ({ __erro: e.message }));
    if (dados?.__erro) {
      json(res, 400, { ok: false, erros: [dados.__erro] });
      return null;
    }
    return dados;
  };
  if (req.method === 'GET') {
    // A biblioteca (somente leitura): resumo por categoria, lista filtrada, detalhe e auditoria de referências.
    if (rota === 'biblioteca') return json(res, 200, { categorias: Biblioteca.resumo() }), true;
    if (rota === 'biblioteca/lista') return json(res, 200, Biblioteca.listar(Object.fromEntries(url.searchParams))), true;
    if (rota === 'biblioteca/detalhe') {
      const d = Biblioteca.detalhe(url.searchParams.get('categoria'), url.searchParams.get('id'));
      return d ? json(res, 200, d) : json(res, 404, { ok: false, erros: ['Conteúdo não encontrado.'] }), true;
    }
    if (rota === 'biblioteca/auditoria') return json(res, 200, { problemas: Biblioteca.auditarReferencias() }), true;
    if (rota === 'biblioteca/tooltip') {
      const t = Biblioteca.dadosDoTooltip(url.searchParams.get('id'), { itemLevel: url.searchParams.get('itemLevel'), semente: url.searchParams.get('semente') });
      return t ? json(res, 200, t) : json(res, 404, { ok: false, erros: ['Item não encontrado.'] }), true;
    }
    // Hot Reload: o estado, o histórico e o que dá para recarregar (só leitura). Recarregar à mão é POST `hot-reload/recarregar` (só no ambiente local).
    if (rota === 'hot-reload') return json(res, 200, hot?.estadoAtual() ?? SEM_HOT), true;
    // O validador centralizado: o estado (último resultado, o que está rodando, arquivos alterados e se pode aprovar). Executar é POST `validacao/executar` (só lê).
    if (rota === 'validacao') return json(res, 200, Validacao.estado()), true;
    // Progressão e loot por dificuldade: a configuração (original, override, efetiva, distribuições exatas), as bases e os marcos de um Ato (iguais nas três dificuldades) — só leitura.
    if (rota === 'progressao') return json(res, 200, OverridesProgressao.obter()), true;
    if (rota === 'progressao-versoes') return json(res, 200, { versoes: OverridesProgressao.versoes() }), true;
    if (rota.startsWith('progressao/ato/')) {
      const ato = Number(rota.slice('progressao/ato/'.length));
      const b = Progressao.basesDoAto(ato, { slot: url.searchParams.get('slot') || null, vocacao: url.searchParams.get('vocacao') || null, limite: 300 });
      return b ? json(res, 200, { ...b, marcos: OverridesProgressao.marcosDoAto(ato), nivelMaximo: Progressao.nivelMaximo() }) : json(res, 404, { ok: false, erros: ['Ato não encontrado na progressão.'] }), true;
    }
    // Conjuntos (sets de equipamento por classe): a configuração, a busca de itens para os slots e os atributos totais pela ficha real — só leitura.
    if (rota === 'conjuntos') return json(res, 200, OverridesConjuntos.obter()), true;
    if (rota === 'conjuntos/itens') return json(res, 200, OverridesConjuntos.buscarItens(Object.fromEntries(url.searchParams))), true;
    if (rota === 'conjuntos-versoes') return json(res, 200, { versoes: OverridesConjuntos.versoes() }), true;
    if (rota.startsWith('conjuntos/totais/')) {
      const c = Conjuntos.obter(decodeURIComponent(rota.slice('conjuntos/totais/'.length)));
      return c ? json(res, 200, OverridesConjuntos.totais(c, { level: url.searchParams.get('level') })) : json(res, 404, { ok: false, erros: ['Conjunto não encontrado.'] }), true;
    }
    // Item Power Base (indicador de comparação dos atributos base): configuração, lista de itens, detalhe, curva, alertas de distribuição e presentes de marco — só leitura.
    if (rota === 'item-power') return json(res, 200, OverridesItemPower.obter()), true;
    if (rota === 'item-power/versoes') return json(res, 200, { versoes: OverridesItemPower.versoes() }), true;
    if (rota === 'item-power/itens') return json(res, 200, OverridesItemPower.listarItens(Object.fromEntries(url.searchParams))), true;
    if (rota === 'item-power/hunts') return json(res, 200, { hunts: AnaliseItemPower.huntsComMonstros().map((h) => ({ id: h.id, nome: h.nome, categoria: h.categoria, level: h.levelCadastro, ato: h.fase?.ato ?? null, monstros: h.monstros.length })) }), true;
    if (rota === 'item-power/marcos') return json(res, 200, AnaliseItemPower.presentesDeMarco()), true;
    if (rota === 'item-power/alertas') return json(res, 200, AnaliseItemPower.alertasDeDistribuicao(url.searchParams.get('dif') ?? 'facil', ItemPower.EM_USO, { limite: url.searchParams.get('limite') })), true;
    if (rota.startsWith('item-power/item/')) {
      const d = OverridesItemPower.itemDetalhado(decodeURIComponent(rota.slice('item-power/item/'.length)));
      return d ? json(res, 200, { ...d, ondeCai: AnaliseItemPower.ondeCai(d.id, url.searchParams.get('dif') ?? 'facil') }) : json(res, 404, { ok: false, erros: ['Equipamento não encontrado.'] }), true;
    }
    if (rota.startsWith('item-power/curva/')) { const r = OverridesItemPower.curva(decodeURIComponent(rota.slice('item-power/curva/'.length))); return json(res, r.ok ? 200 : 404, r), true; }
    if (rota.startsWith('item-power/hunt/')) {
      const a = AnaliseItemPower.analisarHunt(decodeURIComponent(rota.slice('item-power/hunt/'.length)), url.searchParams.get('dif') ?? 'facil');
      return a ? json(res, 200, a) : json(res, 404, { ok: false, erros: ['Hunt não encontrada.'] }), true;
    }
    // O painel de alterações (original × atual) e as versões aprovadas (somente leitura).
    if (rota === 'alteracoes') return json(res, 200, Versoes.alteracoes()), true;
    if (rota === 'alteracoes/diff') { const d = Versoes.diferenca(url.searchParams.get('caminho') ?? ''); return json(res, d.ok ? 200 : 404, d), true; }
    if (rota === 'versoes') return json(res, 200, { versoes: Versoes.listar() }), true;
    if (rota.startsWith('versoes/')) { const v = Versoes.obter(decodeURIComponent(rota.slice(8))); return v ? json(res, 200, v) : json(res, 404, { ok: false, erros: ['Versão não encontrada.'] }), true; }
    // O registro de alterações administrativas (só leitura; as linhas são escritas pelo guarda de acesso).
    if (rota === 'auditoria') return json(res, 200, { eventos: Auditoria.ler({ limite: url.searchParams.get('limite'), tipo: url.searchParams.get('tipo') }) }), true;
    // Operação do servidor (beta, manutenção, Server Save): estado para as telas "Testes e beta" e "Configurações".
    if (rota === 'operacao/beta') return json(res, 200, Operacao.estadoDoBeta()), true;
    if (rota === 'operacao') return json(res, 200, await Operacao.estadoGeral()), true;
    // Overrides por cima do dado importado (monstros): leitura; a edição é POST `overrides` (grava) e `overrides/validar` (só pré-visualiza).
    // Sprites (monstros, outfits e montarias: o mesmo formato de folha). `overrides/sprites/<look>` é o look inteiro: original, override, quem usa, versões.
    if (rota === 'overrides/sprites') return json(res, 200, OverridesSprites.listar()), true;
    if (rota.startsWith('overrides/sprites/')) {
      const s = OverridesSprites.obter(decodeURIComponent(rota.slice('overrides/sprites/'.length)));
      return s ? json(res, 200, s) : json(res, 404, { ok: false, erros: ['Look não encontrado nos desenhos do jogo.'] }), true;
    }
    if (rota === 'overrides/itens') return json(res, 200, OverridesItens.listar(Object.fromEntries(url.searchParams))), true;
    if (rota.startsWith('overrides/itens/')) {
      const i = OverridesItens.obter(decodeURIComponent(rota.slice('overrides/itens/'.length)));
      return i ? json(res, 200, i) : json(res, 404, { ok: false, erros: ['Item não encontrado.'] }), true;
    }
    if (rota === 'overrides/itens-versoes') return json(res, 200, { versoes: OverridesItens.versoes() }), true;
    if (rota === 'overrides/monstros') return json(res, 200, Overrides.listar(Object.fromEntries(url.searchParams))), true;
    if (rota.startsWith('overrides/monstros/')) {
      const m = Overrides.obter(decodeURIComponent(rota.slice('overrides/monstros/'.length)));
      return m ? json(res, 200, m) : json(res, 404, { ok: false, erros: ['Monstro não encontrado.'] }), true;
    }
    if (rota === 'overrides/versoes') return json(res, 200, { versoes: Overrides.versoes() }), true;
    // Níveis da campanha (balanceamento/progressão): leitura; a edição é POST `campanha` (grava) e `campanha/validar` (só pré-visualiza).
    if (rota === 'campanha') return json(res, 200, CampanhaEditor.ler()), true;
    if (rota === 'campanha/versoes') return json(res, 200, { versoes: CampanhaEditor.versoes() }), true;
    // Painel por hunt (somente leitura): mapa, monstros, distribuição, dificuldade e drops esperados.
    if (rota === 'hunts') return json(res, 200, { hunts: Hunts.listar() }), true;
    if (rota === 'hunts/painel') {
      const p = Hunts.painel(url.searchParams.get('id'), url.searchParams.get('dif') ?? 'facil');
      return p ? json(res, 200, p) : json(res, 404, { ok: false, erros: ['Hunt não encontrada.'] }), true;
    }
    // Atos do editor (rascunhos + legados somente leitura).
    if (rota === 'atos-editor') return json(res, 200, { atos: Atos.listar(), ...Atos.opcoes() }), true;
    if (/^atos-editor\/[a-z0-9-]+\/versoes$/.test(rota)) return json(res, 200, { versoes: Atos.versoes(rota.split('/')[1]) }), true;
    if (/^atos-editor\/[a-z0-9-]+\/versao\/\d+$/.test(rota)) {
      const [, id, , n] = rota.split('/');
      const v = Atos.versao(id, n);
      return v ? json(res, 200, { ato: v }) : json(res, 404, { ok: false, erros: ['Versão não encontrada.'] }), true;
    }
    if (/^atos-editor\/[a-z0-9-]+\/comparar$/.test(rota)) return json(res, 200, Atos.comparar(rota.split('/')[1], Number(url.searchParams.get('de')), url.searchParams.get('para') ? Number(url.searchParams.get('para')) : null)), true;
    if (/^atos-editor\/[a-z0-9-]+\/publicacao$/.test(rota)) {
      const c = Atos.checklistDePublicacao(rota.split('/')[1]);
      return c ? json(res, 200, c) : json(res, 404, { ok: false, erros: ['Ato não encontrado.'] }), true;
    }
    if (rota.startsWith('atos-editor/')) {
      const ato = Atos.obter(rota.slice('atos-editor/'.length));
      return ato ? json(res, 200, { ato, ...Atos.validar(ato) }) : json(res, 404, { ok: false, erros: ['Ato não encontrado.'] }), true;
    }
    if (rota === 'opcoes') return json(res, 200, Conteudo.opcoes()), true;
    if (rota === 'fases') return json(res, 200, { fases: Conteudo.listarFases() }), true;
    if (rota === 'auditoria') return json(res, 200, Conteudo.auditar()), true;
    if (rota === 'mapa') return json(res, 200, Conteudo.lerMapa()), true;
    if (rota === 'atos') return json(res, 200, { atos: Conteudo.lerAtos() }), true;
    if (rota === 'bosses') return json(res, 200, { bosses: Conteudo.listarBosses() }), true;
    if (rota === 'itens') {
      // Busca por nome/ID (`q`) ou consulta por ids (`ids=1,2,3`, para mostrar o sprite de quem já está numa lista); cada item leva o `desenho`.
      const ids = url.searchParams.get('ids');
      const base = ids ? ids.split(',').slice(0, 100).filter((i) => ITEM_CATALOG[i]).map((i) => ({ id: Number(i), name: ITEM_CATALOG[i].name })) : Conteudo.buscarItens(url.searchParams.get('q'));
      return json(res, 200, { itens: base.map((i) => ({ ...i, desenho: Biblioteca.desenhoDoItem(ITEM_CATALOG[i.id]) })) }), true;
    }
    if (rota.startsWith('fase/')) {
      const f = Conteudo.carregarFase(rota.slice('fase/'.length));
      return f ? json(res, 200, f) : json(res, 404, { ok: false, erros: ['Fase não encontrada.'] }), true;
    }
    return json(res, 404, { ok: false, erros: ['Rota desconhecida.'] }), true;
  }
  if (req.method === 'POST') {
    const dados = await corpo();
    if (dados === null) return true;
    if (rota.startsWith('fase/') && rota.endsWith('/encontros')) return json(res, 200, Conteudo.salvarEncontros(rota.slice(5, -'/encontros'.length), dados?.encontros)), true;
    if (rota.startsWith('fase/') && rota.endsWith('/validar')) return json(res, 200, Conteudo.validarFase(rota.slice(5, -'/validar'.length), dados?.encontros ?? [])), true;
    if (rota.startsWith('fase/') && rota.endsWith('/meta')) return json(res, 200, Conteudo.salvarMeta(rota.slice(5, -'/meta'.length), dados ?? {})), true;
    if (rota === 'atos-editor/previa') return json(res, 200, { previa: Atos.previa(dados?.recompensa, { origem: dados?.origem === 'boss' ? 'boss final' : 'fase' }), simulacao: dados?.simular ? Atos.simular(dados.recompensa, { execucoes: dados.execucoes, semente: dados.semente }) : null, problemas: Atos.validarRecompensa(dados?.recompensa, dados?.huntId ?? null) }), true;
    if (/^atos-editor\/[a-z0-9-]+\/restaurar$/.test(rota)) return json(res, 200, Atos.restaurar(rota.split('/')[1], Number(dados?.versao))), true;
    if (rota === 'operacao/beta') return json(res, 200, Operacao.definirBeta(dados?.ativo)), true;
    if (rota === 'operacao/manutencao') return json(res, 200, Operacao.definirManutencao(dados?.ativo, dados?.mensagem ?? null)), true;
    if (rota === 'operacao/server-save') return json(res, 200, await Operacao.executarServerSave()), true;
    if (rota === 'hot-reload/recarregar') {
      if (!hot?.estadoAtual().ativo) return json(res, 409, { ok: false, erros: [`Hot Reload desligado: ${(hot?.estadoAtual() ?? SEM_HOT).motivoInativo}`] }), true;
      const r = await hot.recarregar(String(dados?.tipo ?? ''), dados?.id ?? null);
      return json(res, 200, { ...r, ...(r.ok === false && r.erro ? { erros: [r.erro] } : {}), estado: hot.estadoAtual() }), true;
    }
    // Aprovar congela as alterações escolhidas numa versão (cópia + hash); descartar cancela uma ainda não enviada. Gravam só em `database/dados/versoes` (ambiente local).
    // Item Power: validar/prévia, simular, comparar e avaliar uma regra (só leem); salvar/reverter/restaurar gravam.
    if (rota === 'item-power/validar') return json(res, 200, OverridesItemPower.propor(dados?.override ?? null)), true;
    if (rota === 'item-power/simular') { const r = OverridesItemPower.simular(dados ?? {}); return json(res, r.ok ? 200 : 400, r), true; }
    if (rota === 'item-power/comparar') { const r = OverridesItemPower.comparar(dados?.ids); return json(res, r.ok ? 200 : 400, r), true; }
    if (rota === 'item-power/regra') return json(res, 200, AnaliseItemPower.avaliarRegra(dados?.regra ?? {})), true;
    if (rota === 'item-power') {
      const a = dados?.acao;
      const responder = (r) => (json(res, status(r), r), true);
      if (a === 'salvar') return responder(OverridesItemPower.salvar(dados.override, dados.revisao));
      if (a === 'reverter') return responder(OverridesItemPower.reverter(dados.revisao));
      if (a === 'restaurar') return responder(OverridesItemPower.restaurar(dados.versao, dados.revisao));
      return json(res, 400, { ok: false, erros: ['acao deve ser salvar, reverter ou restaurar.'] }), true;
    }
    // Conjuntos: validar/prévia, totais de um conjunto em edição e modelos iniciais (só leem); salvar/reverter/ativo/restaurar gravam.
    if (rota === 'conjuntos/validar') return json(res, 200, OverridesConjuntos.propor(dados?.override ?? null)), true;
    if (rota === 'conjuntos/totais') return json(res, 200, OverridesConjuntos.totais(dados?.conjunto ?? {}, { level: dados?.level })), true;
    if (rota === 'conjuntos/modelos') return json(res, 200, { conjuntos: Conjuntos.modelosIniciais({ por: dados?.por, de: dados?.de, ate: dados?.ate, ...(Array.isArray(dados?.classes) ? { classes: dados.classes.filter((c) => Conjuntos.CLASSES.includes(c)) } : {}) }) }), true;
    if (rota === 'conjuntos') {
      const a = dados?.acao;
      const responder = (r) => (json(res, status(r), r), true);
      if (a === 'salvar') return responder(OverridesConjuntos.salvar(dados.override, dados.revisao));
      if (a === 'reverter') return responder(OverridesConjuntos.reverter(dados.revisao));
      if (a === 'reverter-conjunto') return responder(OverridesConjuntos.reverterConjunto(String(dados.id ?? ''), dados.revisao));
      if (a === 'ativo') return responder(OverridesConjuntos.definirAtivo(dados.ativo, dados.revisao));
      if (a === 'restaurar') return responder(OverridesConjuntos.restaurar(dados.versao, dados.revisao));
      return json(res, 400, { ok: false, erros: ['acao deve ser salvar, reverter, reverter-conjunto, ativo ou restaurar.'] }), true;
    }
    // Progressão e loot: validar/prévia (só lê), salvar/reverter/ativo/restaurar (gravam), e o simulador (só lê; o gerador REAL com semente, teto de 50 mil sorteios por pedido).
    if (rota === 'progressao/validar') return json(res, 200, OverridesProgressao.propor(dados?.override ?? null)), true;
    if (rota === 'progressao') {
      const a = dados?.acao;
      const responder = (r) => (json(res, status(r), r), true);
      if (a === 'salvar') return responder(OverridesProgressao.salvar(dados.override, dados.revisao));
      if (a === 'reverter') return responder(OverridesProgressao.reverter(dados.revisao));
      if (a === 'ativo') return responder(OverridesProgressao.definirAtivo(dados.ativo, dados.revisao));
      if (a === 'restaurar') return responder(OverridesProgressao.restaurar(dados.versao, dados.revisao));
      return json(res, 400, { ok: false, erros: ['acao deve ser salvar, reverter, ativo ou restaurar.'] }), true;
    }
    if (rota === 'simulador/loot') {
      const d = dados ?? {};
      const n = Math.max(1, Math.min(50000, Math.floor(Number(d.n) || 10000)));
      const base = { ato: Number(d.ato) || 1, n, abates: n, semente: Number(d.semente) || 1 };
      // `override`: simula uma PROPOSTA (o arquivo de override inteiro) com o gerador real, sem aplicá-la.
      const candidata = d.override ? OverridesProgressao.candidataDe(d.override) : null;
      if (d.override && !candidata) return json(res, 409, { ok: false, erros: ['O override proposto é inválido: valide antes de simular.'] }), true;
      const rodar = (fn) => (candidata ? Progressao.comConfiguracao(candidata, fn) : fn());
      if (d.modo === 'monstro') return json(res, 200, rodar(() => Simulador.simularMonstro({ ...base, monstro: String(d.monstro ?? ''), dificuldade: String(d.dificuldade ?? 'facil') }))), true;
      if (d.modo === 'hunt') return json(res, 200, rodar(() => Simulador.simularHunt({ ...base, huntId: String(d.huntId ?? ''), dificuldade: String(d.dificuldade ?? 'facil') }))), true;
      const opc = { ...base, itemId: d.itemId ? Number(d.itemId) : null, slot: d.slot || null, raridadeDoMob: d.raridadeDoMob || null, boss: d.boss === true };
      return json(res, 200, rodar(() => (d.dificuldade && d.dificuldade !== 'todas' ? Simulador.simular({ ...opc, dificuldade: String(d.dificuldade) }) : Simulador.compararDificuldades(opc)))), true;
    }
    if (rota === 'versoes/aprovar') { const r = Versoes.aprovar({ caminhos: dados?.caminhos, titulo: dados?.titulo, por: req.engineQuem ?? null }); return json(res, r.ok ? 200 : 409, r), true; }
    // Envia ao Git (branch `versao/<id>` com um commit das cópias congeladas; sem merge, sem força, sem deploy). Roda assíncrono: o servidor não trava durante o push.
    if (rota === 'versoes/enviar') { const r = await GitEnvio.enviar(String(dados?.id ?? '')); return json(res, r.ok ? 200 : 409, r), true; }
    // Status pós-merge: consulta o remoto (só atualiza `origin/main`) e diz se a versão já está na principal e apta para publicar.
    if (rota === 'versoes/consultar') { const r = await GitIntegracao.consultar(String(dados?.id ?? ''), { buscar: dados?.buscar !== false }); return json(res, r.ok ? 200 : 409, r), true; }
    if (rota === 'versoes/descartar') { const r = Versoes.descartar(String(dados?.id ?? ''), { por: req.engineQuem ?? null }); return json(res, r.ok ? 200 : 409, r), true; }
    if (rota === 'validacao/executar') {
      // As verificações só LEEM; os testes rodam comandos fixos e só fazem sentido no ambiente local (nunca no servidor de produção).
      if (['testes', 'tudo'].includes(dados?.escopo) && !(hot?.estadoAtual().ativo)) return json(res, 409, { ok: false, erros: ['Os testes só rodam no ambiente local de desenvolvimento (o Hot Reload local está desligado aqui).'] }), true;
      const r = Validacao.iniciar({ escopo: dados?.escopo ?? 'rapida', completa: dados?.completa === true });
      return json(res, r.ok ? 200 : 409, { ...r, ...(r.ok ? {} : { erros: [r.erro] }) }), true;
    }
    if (rota === 'overrides/sprites/validar') return json(res, 200, OverridesSprites.propor(String(dados?.look ?? ''), dados ?? {})), true;
    if (rota === 'overrides/sprites') {
      const a = dados?.acao;
      const responder = (r) => (json(res, status(r), r), true);
      const look = String(dados?.look ?? '');
      if (a === 'salvar') return responder(OverridesSprites.salvar(look, dados, dados.revisao));
      if (a === 'reverter') return responder(OverridesSprites.reverter(look, dados.revisao));
      if (a === 'ativo') return responder(look ? OverridesSprites.definirAtivo(look, dados.ativo, dados.revisao) : OverridesSprites.definirAtivoGeral(dados.ativo, dados.revisao));
      if (a === 'restaurar') return responder(OverridesSprites.restaurarVersao(look, dados.versao, dados.revisao));
      return json(res, 400, { ok: false, erros: ['acao deve ser salvar, reverter, ativo ou restaurar.'] }), true;
    }
    if (rota === 'overrides/itens/validar') return json(res, 200, OverridesItens.propor(String(dados?.id ?? ''), dados?.override ?? null)), true;
    if (rota === 'overrides/itens') {
      const a = dados?.acao;
      const responder = (r) => (json(res, status(r), r), true);
      if (a === 'salvar') return responder(OverridesItens.salvar(String(dados.id ?? ''), dados.override ?? null, dados.revisao));
      if (a === 'reverter') return responder(OverridesItens.reverter(String(dados.id ?? ''), dados.revisao));
      if (a === 'ativo') return responder(OverridesItens.definirAtivo(dados.ativo, dados.id ?? null, dados.revisao));
      if (a === 'restaurar') return responder(OverridesItens.restaurar(dados.versao, dados.revisao));
      return json(res, 400, { ok: false, erros: ['acao deve ser salvar, reverter, ativo ou restaurar.'] }), true;
    }
    if (rota === 'overrides/validar') return json(res, 200, Overrides.propor(String(dados?.key ?? ''), dados?.override ?? null)), true;
    if (rota === 'overrides') {
      const a = dados?.acao;
      const responder = (r) => (json(res, status(r), r), true);
      if (a === 'salvar') return responder(Overrides.salvar(String(dados.key ?? ''), dados.override ?? null, dados.revisao));
      if (a === 'reverter') return responder(Overrides.reverter(String(dados.key ?? ''), dados.revisao));
      if (a === 'duplicar') return responder(Overrides.duplicar(String(dados.key ?? ''), String(dados.novaKey ?? ''), dados.novoNome ?? null, dados.revisao));
      if (a === 'ativo') return responder(Overrides.definirAtivo(dados.ativo, dados.key ?? null, dados.revisao));
      if (a === 'restaurar') return responder(Overrides.restaurar(dados.versao, dados.revisao));
      return json(res, 400, { ok: false, erros: ['acao deve ser salvar, reverter, duplicar, ativo ou restaurar.'] }), true;
    }
    if (rota === 'campanha/validar') {
      const r = CampanhaEditor.propor(dados ?? {});
      return json(res, 200, { ok: r.erros.length === 0, erros: r.erros, avisos: r.avisos, mudancas: r.mudancas, semMudancas: r.semMudancas }), true;
    }
    if (rota === 'campanha/restaurar') { const r = CampanhaEditor.restaurar(dados?.versao, dados?.revisao); return json(res, status(r), r), true; }
    if (rota === 'campanha') { const r = CampanhaEditor.salvar(dados ?? {}); return json(res, status(r), r), true; }
    if (rota === 'mapas/validar') return json(res, 200, Mapas.validarSpawns(dados ?? {})), true;
    if (rota === 'atos-editor/validar') return json(res, 200, Atos.validar(dados ?? {})), true;
    if (rota === 'atos-editor') {
      const r = dados?.excluir ? Atos.excluir(String(dados.excluir)) : dados?.duplicar ? Atos.duplicar(String(dados.duplicar), String(dados.novoId ?? ''), dados.novoNome ?? null) : Atos.salvar(dados ?? {});
      return json(res, status(r), r), true;
    }
    if (rota === 'mapa') return json(res, 200, Conteudo.salvarMapa(dados ?? {})), true;
    if (rota === 'mapa/validar') return json(res, 200, Conteudo.salvarMapa(dados ?? {}, { gravar: false })), true;
    if (rota === 'bosses') return json(res, 200, dados?.excluir ? Conteudo.excluirBoss(String(dados.excluir)) : Conteudo.salvarBoss(dados)), true;
    if (rota === 'bosses/validar') return json(res, 200, { erros: (await import('../systems/bosses-unicos/catalogo.mjs')).validar(dados) }), true;
  }
  return json(res, 404, { ok: false, erros: ['Rota desconhecida.'] }), true;
}
