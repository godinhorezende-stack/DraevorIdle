# Hot Reload de conteúdo (ambiente local)

Salvou na Engine → o jogo local atualiza **sem reiniciar o servidor**. Só em desenvolvimento: desligado em produção, com `HOT_RELOAD=0`, com `ENGINE_MODO=producao` ou com `DATABASE_URL` apontando para um banco que não seja local.

## Como era antes
Tudo que a Engine grava (`gamedata/overrides/*.json`, `gamedata/atos/*.json`, `campanha.json`, overrides de sprites) era lido **no boot**: `dados.mjs` aplicava os overrides por cima do Canary, `poderes.mjs` os ataques, `campanha.mjs` os atos e níveis. O cliente recebia o bestiário uma vez, no `hello`, e os sprites ao abrir a página. Para ver a mudança: reiniciar o servidor e recarregar o navegador. Os estáticos (`estaticos.mjs`) já não tinham cache velho (ETag por tamanho+data).

## Como funciona agora
1. **Entradas**: o evento explícito de salvamento da Engine (`acesso-http.mjs` → `aoGravar` → `hotReload.aposGravacao`) e o `fs.watch` (complemento: edição manual, `git pull`).
2. `classificar(caminho)`: ignora temporários/backups/`_versoes`; recarrega a quente; ou avisa que exige reinício (com o motivo).
3. Debounce (250 ms), fila **serial** (uma recarga por vez, itens → monstros → sprites → campanha → atos) e assinatura do conteúdo: o mesmo salvamento chegando pelas duas entradas recarrega uma vez só.
4. Cada estratégia é **transacional**: valida tudo antes de tocar no jogo; se algo for inválido nada muda (fica a última versão válida), o erro vai ao histórico e à Engine. Um salvamento pela metade tem uma segunda tentativa automática.
5. Sucesso → `contentUpdate` (WebSocket) para os jogadores conectados: tipo, ids, revisão e o payload mínimo; o cliente atualiza só o recurso.

## O que recarrega a quente
| Recurso | Servidor | Cliente |
|---|---|---|
| Monstros (overrides) | bestiário + ataques re-aplicados no mesmo objeto; novos spawns usam o novo valor, bichos já na tela mantêm o estado | `catalog.bestiary` atualizado só nas chaves alteradas |
| Itens (overrides) | `ITEM_CATALOG` re-aplicado; próximas operações usam o novo valor | evento `draevor:conteudo-atualizado` |
| Sprites / outfits / montarias | valida PNG + cadastro + hash | carrega a folha nova **antes** e troca cadastro+URL+cache de uma vez (sem quadros misturados); devolve a folha antiga; `?v=hash` fura o cache |
| Acts (`gamedata/atos`) | ato substituído/registrado/removido com rollback; progresso dos personagens (por `huntId`) intacto | evento |
| Níveis da campanha | níveis das fases/bosses; estrutura diferente → reinício | evento |

## O que ainda exige reinício (e a Engine avisa o sistema afetado)
Hunts e mapas (grades aquecidas no boot, instâncias em andamento), encontros e bosses únicos, habilidades/gemas/árvore/passivas (estado dos personagens depende do catálogo do boot), catálogo original de itens/lojas, bestiário/bosses originais, atlas de itens/efeitos/projéteis/cenário, e qualquer outro `*.json` de `gamedata/`. Os overrides desses recursos (monstros, itens) recarregam a quente; o dado original não.

## Engine
Indicador na barra do topo (Ativo / Aguardando / Recarregando / Atualizado / Erro / Reiniciar) e painel com histórico, erros, sistemas que pedem reinício e botões "Recarregar agora" por recurso. Rotas: `GET hot-reload`, `POST hot-reload/recarregar {tipo}` (a gravação é recusada em produção).

## Módulos
`systems/hot-reload.mjs` (núcleo), `systems/hot-reload-estrategias.mjs`, `systems/overrides.mjs` (`reaplicar*`), `systems/campanha.mjs` (`recarregarAto`, `recarregarNiveis`), `systems/poderes.mjs`, `systems/avisos-globais.mjs` (`transmitir`), `admin/acesso-http.mjs`, `admin/conteudo-http.mjs`, `backend/index.mjs`, `frontend/client/src/{hot-reload-cliente,sprites,main,editor-hot-reload,editor-conteudo}.mjs`.

## Limites conhecidos
- Monstros já na tela (instâncias em andamento) seguem com os valores do spawn.
- Listas calculadas no boot a partir do bestiário (ex.: candidatas de prey) não são refeitas.
- O cliente atualiza o bestiário e os sprites; telas de itens/campanha refrescam na próxima abertura.
- Só valida o que a Engine consegue gravar; arquivos editados à mão passam pela mesma validação.
