// As rotas HTTP do editor de conteúdo (`/api/mapas/_conteudo/…`). O prefixo é o do editor de mapas de propósito: o nginx
// de produção já tranca `/api/mapas` ao público (só túnel SSH), então nenhuma rota de ESCRITA nova fica exposta.
import * as Conteudo from './conteudo.mjs';
import * as Biblioteca from './biblioteca.mjs';
import * as Atos from './atos.mjs';
import * as Hunts from './hunts.mjs';
import * as Mapas from './mapas.mjs';
import * as Operacao from './operacao.mjs';
import * as CampanhaEditor from './campanha-editor.mjs';

const PREFIXO = '/api/mapas/_conteudo/';

/** Atende a rota se for do editor de conteúdo; devolve `true` quando atendeu. */
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
    // Operação do servidor (beta, manutenção, Server Save): estado para as telas "Testes e beta" e "Configurações".
    if (rota === 'operacao/beta') return json(res, 200, Operacao.estadoDoBeta()), true;
    if (rota === 'operacao') return json(res, 200, await Operacao.estadoGeral()), true;
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
    if (rota === 'itens') return json(res, 200, { itens: Conteudo.buscarItens(url.searchParams.get('q')) }), true;
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
    if (rota === 'campanha/validar') {
      const r = CampanhaEditor.propor(dados ?? {});
      return json(res, 200, { ok: r.erros.length === 0, erros: r.erros, avisos: r.avisos, mudancas: r.mudancas, semMudancas: r.semMudancas }), true;
    }
    if (rota === 'campanha/restaurar') return json(res, 200, CampanhaEditor.restaurar(dados?.versao)), true;
    if (rota === 'campanha') return json(res, 200, CampanhaEditor.salvar(dados ?? {})), true;
    if (rota === 'mapas/validar') return json(res, 200, Mapas.validarSpawns(dados ?? {})), true;
    if (rota === 'atos-editor/validar') return json(res, 200, Atos.validar(dados ?? {})), true;
    if (rota === 'atos-editor') return json(res, 200, dados?.excluir ? Atos.excluir(String(dados.excluir)) : dados?.duplicar ? Atos.duplicar(String(dados.duplicar), String(dados.novoId ?? ''), dados.novoNome ?? null) : Atos.salvar(dados ?? {})), true;
    if (rota === 'mapa') return json(res, 200, Conteudo.salvarMapa(dados ?? {})), true;
    if (rota === 'mapa/validar') return json(res, 200, Conteudo.salvarMapa(dados ?? {}, { gravar: false })), true;
    if (rota === 'bosses') return json(res, 200, dados?.excluir ? Conteudo.excluirBoss(String(dados.excluir)) : Conteudo.salvarBoss(dados)), true;
    if (rota === 'bosses/validar') return json(res, 200, { erros: (await import('../systems/bosses-unicos/catalogo.mjs')).validar(dados) }), true;
  }
  return json(res, 404, { ok: false, erros: ['Rota desconhecida.'] }), true;
}
