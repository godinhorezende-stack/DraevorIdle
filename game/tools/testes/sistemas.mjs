// O MAPA dos sistemas do jogo para a validação por níveis (QUICK / SYSTEM / FULL — `testar.mjs`, `docs/testes-por-nivel.md`).
//
// Cada sistema diz quais ARQUIVOS-FONTE são dele (`fontes`, expressões sobre o caminho relativo a `game/`) e quais TESTES são dele
// (`testes`, expressões sobre o nome do arquivo de teste sem `.test.mjs`; o irmão `.classico` segue o dele). Um teste pode estar em mais
// de um sistema; TODO teste está em pelo menos um (`npm run test:auditoria` confere — teste novo sem sistema aparece lá).
//
// O mapa é a parte curada; o grafo de imports (`grafo.mjs`) completa: o teste que importa DIRETAMENTE o arquivo alterado entra sempre,
// esteja ou não na lista do sistema.

export const SISTEMAS = {
  gemas: {
    nome: 'Gemas e habilidades',
    apelidos: ['gems', 'gema', 'skills', 'habilidades'],
    fontes: [
      /^systems\/skills\//, /^systems\/(acoes|gemas|efeitos-visuais|combo)\.mjs$/,
      /^systems\/itens-poe\/(gemas-poe|suportes-poe|compat-suportes|reserva|missoes-de-gemas|estilos-das-gemas|sockets)\.mjs$/,
      /^systems\/itens-poe\/compilador-de-gemas\//, /^engine\/sockets-de-gema\.mjs$/,
      /^gamedata\/(gemas|skills)\//, /^gamedata\/(gemas|action-catalog[^/]*)\.json$/,
      /^gamedata\/itens-poe\/(gemas|suportes|compat|missoes|origem|estilos)[^/]*$/,
      /^frontend\/client\/src\/(soquetes|gemas|actionbar|forja-poe|icones-de-gema|regras-de-uso|conjuracao|arena-gemas-sprites|missoes-poe)\.mjs$/,
      /^admin\/(arena-efeitos|dano-das-gemas|gemas-poe)\.mjs$/,
    ],
    testes: [
      /^gemas/, /^itens-poe-gemas/, /^itens-poe-sockets/, /^sockets-/, /^supports-etapa4/, /^reforcos/, /^tooltip-(gemas|suportes|dos-buffs)/,
      /^reserva-de-mana/, /^balanceamento-das-gemas/, /^magias-fase-a/, /^modos-das-magias/, /^missoes-de-gemas/, /^orbes-de-socket/, /^combo/,
      /^skills-iguais/, /^regras-de-uso/, /^regras-do-slot/, /^recarga/, /^barra-poe/, /^efeitos-visuais/, /^projeteis/, /^estados/,
      /^poder-da-arma/, /^simulador-de-rotacao/, /^motor-de-dano/,
    ],
  },
  itens: {
    nome: 'Itens, mochila e equipamento',
    apelidos: ['items', 'item', 'inventario', 'equipamento'],
    fontes: [
      /^systems\/itens\//, /^systems\/itens-poe\/(gerar|jogo|mods-poe|traduzir|frascos|moedas|so-itens-do-poe|sockets)\.mjs$/,
      /^systems\/(inventario|bolsa|bau|deposito|troca|forja|craft|desmanche|afixos|conjuntos|item-power|tiers|charms)\.mjs$/,
      /^gamedata\/(itens|itens-poe|armas)\//, /^gamedata\/(item-catalog|catalog-real|conjuntos|item-power|item-sprites|craft-receitas|desmanche|equipamento-por-vocacao)\.json$/,
      /^frontend\/client\/src\/(inventory|itens-poe-balao|tooltip|paperdoll|pilha|loot-do-bicho|sheet|folha)\.mjs$/,
      /^admin\/(itens-poe-|item-power|overrides-itens|overrides-conjuntos|overrides-sprites-itens)/,
    ],
    testes: [
      /^itens-/, /^itens-poe$/, /^item-/, /^implicitos/, /^comparar/, /^conjuntos/, /^defesas-novas/, /^equipamento/, /^arma-base/, /^base-por-raridade/,
      /^preco-de-venda/, /^preco-das-pocoes/, /^pocoes/, /^overrides-itens/, /^icones/, /^so-itens-do-poe/, /^moedas-/, /^forja/, /^pilha-de-/,
      /^mochila-redesenho/, /^bolsa-mover/, /^chao-e-troca/, /^chegadas/, /^atributos-efeito/, /^gemas-raridade/, /^sockets-joias-poe/, /^filtro-/,
    ],
  },
  combate: {
    nome: 'Combate e dano',
    apelidos: ['combat', 'dano', 'damage'],
    fontes: [
      /^systems\/combate\//, /^systems\/armas\//, /^systems\/hunt\/(combate|resistencia)\.mjs$/, /^systems\/(ficha|poderes|summon|buffpower)\.mjs$/, /^systems\/personagem\//,
      /^systems\/mobs\//, /^systems\/itens-poe\/(condicoes-poe|afeccoes|cargas|modificadores-monstro|habilidades|lacaios-poe)\.mjs$/,
      /^engine\/(arma|areas|formulas)\.mjs$/, /^gamedata\/(combate|mobs)\//, /^gamedata\/(boss-poderes|monstro-poderes|atributos-principais)\.json$/,
      /^gamedata\/itens-poe\/(modificadores-monstro|afeccoes|cargas)[^/]*$/,
    ],
    testes: [
      /^combate-/, /^dano-/, /^defesa-poe/, /^ficha-/, /^ataque-do-mob/, /^atributos-do-mob/, /^velocidade-de-ataque/, /^melee/, /^estados/,
      /^controle-do-jogador/, /^itens-poe-(combate|afeccoes|cargas|modificadores-monstro|mods|classes)/, /^modificadores/, /^mobs-/, /^simulador-do-mob/,
      /^poderes/, /^bosses-dos-atos/, /^familiar-combate/, /^prey-combate/, /^podio-combate/, /^especializacoes/, /^areas/, /^projeteis/,
      /^auditoria-modificadores/, /^motor-de-dano/, /^arma-elemental/, /^poder-da-arma/, /^bloqueio/, /^reserva-de-mana/, /^atributos-efeito/,
    ],
  },
  campanha: {
    nome: 'Campanha, atos, chefes e encontros',
    apelidos: ['campaign', 'atos', 'bosses', 'encontros'],
    fontes: [
      /^systems\/(campanha|campanha-conteudo|campanha-mapa|atos-carregar|atos-legado|atos-modelo|bosses|recompensas|promocao|cidades)\.mjs$/,
      /^systems\/itens-poe\/(campanha|monstros|pinaculos|previa-da-area|drops-por-monstro)\.mjs$/, /^systems\/(encontros|bosses-unicos)\//,
      /^gamedata\/(atos|encontros)\//, /^gamedata\/(campanha|campanha-conteudo|encontros|bosses-unicos|instancias|sets-de-marco)\.json$/,
      /^gamedata\/itens-poe\/(campanha|monstros|pinaculos|atos|drops)[^/]*$/,
      /^admin\/(atos|campanha-editor|conteudo|conteudo-http)\.mjs$/, /^frontend\/client\/src\/(world|world-dados|world-arte|editor-atos[^/]*|editor-campanha|encontros-na-tela)\.mjs$/,
    ],
    testes: [
      /^campanha/, /^cidades/, /^chefe-da-fase/, /^itens-poe-(campanha|atos|pinaculos)/, /^atos-/, /^boss-do-ato/, /^bosses/, /^conteudo-dos-atos/, /^encontros/,
      /^captura/, /^decisao/, /^ondas/, /^world/, /^mapa-editor/, /^extrair-poedb-pinaculos/, /^sets-de-marco/, /^raridade-minima-boss-bau/,
      /^site-poe/, /^party-objetivo-da-fase/, /^avancar-em-grupo/, /^missoes-de-gemas/, /^roupa-da-classe/, /^chefe-do-ato-na-fase/,
    ],
  },
  cacada: {
    nome: 'Caçada (tique, movimento, instância, mapa)',
    apelidos: ['hunt', 'cacadas', 'engine', 'motor'],
    fontes: [
      /^systems\/cacadas\.mjs$/, /^systems\/hunt\//, /^systems\/mapa\//, /^systems\/(morte|limpeza-do-chao|limpeza-do-chao-config|treino|sem-treino)\.mjs$/,
      /^engine\/(andar-visivel|prazos)\.mjs$/, /^gamedata\/hunts\//, /^gamedata\/(hunts-spawns-capturados|treino-map|city-map|city-meta)\.json$/,
    ],
    testes: [
      /^percurso/, /^progresso-da-hunt/, /^alvo-mais-perto/, /^kite-parede-diagonal/, /^caminho/, /^andares/, /^agua/, /^moverMonstros/, /^setores/,
      /^escalonamento/, /^familiar-anda/, /^mapa-spawns/, /^aquecer-grades/, /^hunt-gravada/, /^hunts-painel/, /^xp-da-hunt/, /^regen-na-cidade/,
      /^andar/, /^morte/, /^rentabilidade/, /^limpeza-do-chao/, /^item-no-chao/, /^raridade-dos-mapas/, /^loot-/, /^bonus-online/, /^bloqueio/,
      /^chefe-do-ato-na-fase/, /^portal-de-viagem/, /^mapas-endgame/,
    ],
  },
  mapas: {
    nome: 'Mapas do endgame (T1–T16, o Dispositivo de Mapas)',
    apelidos: ['endgame', 'atlas', 'dispositivo'],
    fontes: [
      /^systems\/mapas-dispositivo\.mjs$/, /^systems\/itens-poe\/(mapas|mapas-areas|mapa-aberto)\.mjs$/, /^gamedata\/itens-poe\/mapas\.json$/,
      /^gamedata\/itens-poe\/icones-itens\/poe-itens\/Mapas\//, /^tools\/montar-mapas-poe\.mjs$/, /^frontend\/client\/src\/mapas-dispositivo\.mjs$/,
    ],
    testes: [/^mapas-endgame/, /^mapas-dispositivo/, /^chefe-do-ato-na-fase/, /^itens-poe-frascos/, /^raridade-dos-mapas/],
  },
  offline: {
    nome: 'Caçada offline e Server Save',
    apelidos: ['ausencia', 'server-save'],
    fontes: [
      /^systems\/(consolidacao-offline|simulacao-offline|simulacao-offline-worker|simulador-tique|simulador-tique-worker|server-save|server-save-config|server-save-horario|ausentes|limpeza-de-temporarios|modo-de-manutencao)\.mjs$/,
      /^database\/caca-offline\.mjs$/,
    ],
    testes: [/^consolidacao-offline/, /^simulacao-offline/, /^simulador-tique/, /^server-save/, /^relatorio-da-ausencia/, /^hunt-gravada/, /^limpeza-de-temporarios/],
  },
  party: {
    nome: 'Party',
    apelidos: ['grupo'],
    fontes: [/^systems\/(party|party-recompensas)\.mjs$/, /^systems\/hunt\/(aliados|sala|escalonamento)\.mjs$/],
    testes: [/^party-/, /^avancar-em-grupo/, /^escalonamento/, /^conta-char/, /^bonus-online/, /^setores/, /^portal-de-viagem/, /^chefe-do-ato-na-fase/],
  },
  sessao: {
    nome: 'Sessão e WebSocket',
    apelidos: ['websocket', 'ws', 'session'],
    fontes: [/^websocket\//, /^backend\/(estaticos|privados)\.mjs$/],
    testes: [
      /^limites/, /^quadro/, /^fila-de-transacoes/, /^chat-broadcast/, /^jogadores-na-praca/, /^welcome-cidade/, /^fatias-do-relogio/, /^regen-na-cidade/,
      /^andar/, /^historico-da-loja/, /^economia/, /^conta-char/, /^melhorias-da-conta/, /^chegadas/, /^party-(ver-aliados|volta-na-cacada|persistencia)/,
      /^relatorio-da-ausencia/, /^personagens-legado/, /^estaticos/, /^conteudo-privado/, /^versao-do-cliente/,
    ],
  },
  banco: {
    nome: 'Banco e persistência',
    apelidos: ['database', 'db', 'persistencia'],
    fontes: [/^database\//],
    testes: [
      /^db$/, /^redis/, /^hunt-gravada/, /^party-persistencia/, /^personagens-legado/, /^apagar-arquivados/, /^server-save/, /^economia/,
      /^melhorias-da-conta/, /^fila-de-transacoes/, /^presentes/, /^consolidacao-offline/,
    ],
  },
  cliente: {
    nome: 'Cliente (frontend) e estáticos',
    apelidos: ['frontend', 'ui', 'client'],
    fontes: [/^frontend\//, /^backend\/estaticos\.mjs$/, /^tools\/precomprimir\.mjs$/],
    testes: [
      /^estaticos/, /^precomprimidos-em-dia/, /^artes-em-dia/, /^versao-do-cliente/, /^hot-reload-cliente/, /^mochila-redesenho/, /^minimapa/,
      /^nameplate-do-jogador/, /^world-camera-modo-leve/, /^interpolacao/, /^top5-balao/, /^sockets-toque/, /^tooltip-/, /^andar-por-clique/,
      /^bloqueio-animacao/, /^conteudo-privado/, /^icones/, /^world-dados/, /^item-no-chao/, /^bolsa-mover/,
    ],
  },
  editor: {
    nome: 'Engine (editores), overrides e operação',
    apelidos: ['admin', 'engine-editor', 'overrides'],
    fontes: [
      /^admin\//, /^systems\/(overrides|hot-reload|hot-reload-estrategias|modo-beta|item-power|classes)\.mjs$/,
      /^engine\/(sprite-edicao|sprite-folha|png-minimo|diff-json|tela|remendo|portas-de-acesso)\.mjs$/, /^frontend\/client\/src\/editor/, /^gamedata\/overrides\//,
      /^gamedata\/(engine|modo-beta|classes|classes-meta)\.json$/,
    ],
    testes: [
      /^editor-/, /^infra-editores/, /^sprites-/, /^biblioteca/, /^mapa-editor/, /^mapa-fundo/, /^atos-editor-tela/, /^campanha-editor/, /^item-power/,
      /^itens-poe-(telas|pendencias)/, /^classes/, /^overrides/, /^hot-reload/, /^versoes/, /^validacao/, /^acesso/, /^isolamento-dos-testes/, /^git-/,
      /^publicacao/, /^operacao/, /^modo-beta/, /^itens-novos-sprites/, /^efeitos-visuais/, /^conjuntos/, /^atos-armazem/, /^atos-versoes/,
      /^raridade-dos-mapas/, /^apagar-arquivados/,
    ],
  },
  loot: {
    nome: 'Loot e filtro de loot',
    apelidos: ['drop', 'drops', 'filtro'],
    fontes: [
      /^systems\/(bolsa|afixos|filtro-da-conta|bau|anuncios|drops-do-site)\.mjs$/, /^systems\/itens-poe\/(drops-por-monstro|moedas|gerar)\.mjs$/,
      /^systems\/itens\/(simulador-de-loot|preco-de-venda)\.mjs$/, /^systems\/hunt\/rentabilidade\.mjs$/,
    ],
    testes: [
      /^filtro-/, /^loot-/, /^itens-poe-pools/, /^moedas-pools/, /^anuncios/, /^raridade-minima-boss-bau/, /^rentabilidade/, /^preco-de-venda/,
      /^encontros-bau/, /^mobs-raridade/, /^pilha-de-/, /^bolsa-mover/, /^item-no-chao/,
    ],
  },
  social: {
    nome: 'Site, guildas, chat, arena e loja',
    apelidos: ['site', 'guildas', 'chat', 'arena', 'loja'],
    fontes: [
      /^systems\/(amigos|guildas|arena|chat|site|wiki|tarefas|presentes|ranking|novidades|avisos-globais|entregas|banqueiro|premium|aparencia|loja|mercado|historico-da-loja|versao-do-cliente|drops-do-site)\.mjs$/,
      /^engine\/(brasao-de-guilda|desenhar-brasao|nome-de-guilda|ordem-das-guildas|qrcode|outfit-color|boss-pouch)\.mjs$/,
      /^frontend\/(site\/|client\/src\/(social|guildas|perfil|chat|anuncio-drop|auth)\.mjs$)/, /^gamedata\/(novidades|tarefas|store-real|arenas|patentes-arena|outfits|mounts-real|diario)\.json$/,
    ],
    testes: [
      /^amigos/, /^guildas/, /^arena/, /^chat-broadcast/, /^site/, /^wiki/, /^tarefas/, /^presentes/, /^top5-balao/, /^anuncios/, /^banco$/, /^economia/,
      /^historico-da-loja/, /^roupa-da-classe/, /^jogadores-na-praca/, /^welcome-cidade/,
    ],
  },
  progressao: {
    nome: 'Progressão do personagem (árvore, passivas, classes, XP)',
    apelidos: ['personagem', 'arvore', 'passivas', 'xp'],
    fontes: [
      /^systems\/(arvore|progressao|stamina|boosts|charms|prey|regras-de-xp|recompensas)\.mjs$/, /^systems\/passivas\//, /^systems\/itens-poe\/(arvore|classes)\.mjs$/,
      /^gamedata\/(arvore|passivas)\//, /^gamedata\/(progressao|proficiencia|charms|sets-de-marco)\.json$/, /^frontend\/client\/src\/(arvore|passivas)\.mjs$/,
    ],
    testes: [
      /^arvore/, /^passivas/, /^respec-gratis/, /^itens-poe-arvore/, /^itens-poe-classes/, /^classes/, /^especializacoes/, /^balanceamento-1-100/, /^recompensas-de-nivel/,
      /^sets-de-marco/, /^progressao/, /^skills-iguais/, /^xp-da-hunt/, /^prey/, /^charms/, /^morte/, /^roupa-da-classe/, /^melee/, /^bonus-online/,
    ],
  },
};

/*
 * ---- O NÚCLEO: mexeu, a FULL é obrigatória ----
 * A infraestrutura dos testes, o boot e o modo do jogo, os dados e as regras que todo sistema lê, o laço da caçada, a persistência e a
 * sessão central — o usuário: "alteração arquitetural, na engine, em infraestrutura compartilhada, de persistência, de WebSocket central".
 * Caminhos relativos a `game/` (os de fora, como o package.json da raiz, vêm com `../`).
 */
export const NUCLEO_OBRIGATORIO = [
  /^testes\/apoio[^/]*\.mjs$/, /^tools\/testes\//, /^\.\.\/package(-lock)?\.json$/, /^backend\/index\.mjs$/, /^database\/(banco|db)\.mjs$/,
  /^websocket\/sessao\.mjs$/, /^systems\/(dados|regras|cacadas)\.mjs$/, /^systems\/itens-poe\/(iniciar|catalogo)\.mjs$/,
];
/** Mexeu num módulo do qual ao menos esta fração dos testes depende DIRETAMENTE: a FULL é recomendada (ficha, combate, monstros…). */
export const FRACAO_PARA_RECOMENDAR_FULL = 0.1;
/** Tocou neste número de sistemas (ou mais): a FULL é recomendada. */
export const SISTEMAS_PARA_RECOMENDAR_FULL = 4;

/** Sem teste: documentação, as skills do Claude, imagens soltas. (As skills têm validador próprio — o QUICK roda.) */
export const SEM_TESTE = [/\.md$/i, /^\.\.\/docs\//, /^\.\.\/\.claude\//, /^\.\.\/README/i, /^\.\.\/CLAUDE\.md$/, /^\.\.\/\.gitignore$/, /\/_versoes\//, /\.(br|gz)$/];

/** O sistema pelo nome ou apelido (`gems` → `gemas`). */
export function sistemaPeloNome(nome) {
  const n = String(nome ?? '').trim().toLowerCase();
  for (const [id, s] of Object.entries(SISTEMAS)) if (id === n || s.apelidos.includes(n)) return id;
  return null;
}
/** Os sistemas cujas FONTES casam com o caminho (relativo a `game/`). */
export const sistemasDoArquivo = (caminho) => Object.entries(SISTEMAS).filter(([, s]) => s.fontes.some((re) => re.test(caminho))).map(([id]) => id);
/** O nome-base do teste: `testes/gemas-skill.classico.test.mjs` → `gemas-skill`. */
export const baseDoTeste = (teste) => teste.replace(/^testes\//, '').replace(/(\.classico)?\.test\.mjs$/, '');
/** Os sistemas de um arquivo de teste. */
export const sistemasDoTeste = (teste) => Object.entries(SISTEMAS).filter(([, s]) => s.testes.some((re) => re.test(baseDoTeste(teste)))).map(([id]) => id);
