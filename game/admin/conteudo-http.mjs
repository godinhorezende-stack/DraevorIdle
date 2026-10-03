// As rotas HTTP do editor de conteúdo (`/api/mapas/_conteudo/…`). O prefixo é o do editor de mapas de propósito: o nginx
// de produção já tranca `/api/mapas` ao público (só túnel SSH), então nenhuma rota de ESCRITA nova fica exposta.
import * as Conteudo from './conteudo.mjs';
import * as Biblioteca from './biblioteca.mjs';
import * as Atos from './atos.mjs';

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
    // Atos do editor (rascunhos + legados somente leitura).
    if (rota === 'atos-editor') return json(res, 200, { atos: Atos.listar(), ...Atos.opcoes() }), true;
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
    if (rota === 'atos-editor/validar') return json(res, 200, Atos.validar(dados ?? {})), true;
    if (rota === 'atos-editor') return json(res, 200, dados?.excluir ? Atos.excluir(String(dados.excluir)) : dados?.duplicar ? Atos.duplicar(String(dados.duplicar), String(dados.novoId ?? ''), dados.novoNome ?? null) : Atos.salvar(dados ?? {})), true;
    if (rota === 'mapa') return json(res, 200, Conteudo.salvarMapa(dados ?? {})), true;
    if (rota === 'mapa/validar') return json(res, 200, Conteudo.salvarMapa(dados ?? {}, { gravar: false })), true;
    if (rota === 'bosses') return json(res, 200, dados?.excluir ? Conteudo.excluirBoss(String(dados.excluir)) : Conteudo.salvarBoss(dados)), true;
    if (rota === 'bosses/validar') return json(res, 200, { erros: (await import('../systems/bosses-unicos/catalogo.mjs')).validar(dados) }), true;
  }
  return json(res, 404, { ok: false, erros: ['Rota desconhecida.'] }), true;
}
