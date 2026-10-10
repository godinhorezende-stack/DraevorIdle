// Sprites extraídos do client do Tibia.
// Tudo aqui desenha em 1:1; quem amplia é o CSS (image-rendering: pixelated),
// sempre por um fator inteiro, senão o pixel art vira mingau.
import * as SemFigura from './icone-sem-figura.mjs';
import { desenharGema } from './icones-de-gema.mjs';
import { colorize } from '/packages/shared/src/outfit-color.mjs';
import { resolverOverrides, planejarTrocas } from '/packages/shared/src/sprite-folha.mjs';

const images = new Map();
const outfitCache = new Map();
let outfitMeta = {};
let itemSprites = {};
// Overrides de sprites (`gamedata/overrides/sprites.json`, editor de sprites da Engine): para os looks com override ATIVO, a folha e o cadastro de quadros
// vêm do override; o resto segue o original. `variantes` são folhas avulsas (rascunho do editor, ou o original para comparar) sob uma chave própria.
const urlsDeFolha = {};
// O cadastro ORIGINAL dos looks que têm override (para o Hot Reload devolver o original quando o override sai).
const originaisSobrescritos = {};
const variantes = new Map();
const metaDe = (look) => variantes.get(look)?.meta ?? outfitMeta[look];

/*
 * ---- Os itens que ele inventou, com desenho EMPRESTADO ----
 *
 * O dono viu isto na loja: "bugou algumas sprite da store". Não bugou agora —
 * nunca teve. As sete peças abaixo estão no catálogo do jogo e fora do atlas de
 * desenhos: seis foram criadas no servidor DELE (gamestore e scripts próprios) e
 * a sétima é um item de base que a extração não trouxe. `item-meta.json` diz
 * `hasSprite: true` para as sete, e é o meta que mente — o atlas não tem
 * nenhuma. Ele não é o único caso: cerca de 29 mil ids do catálogo estão nessa
 * situação, e por isso a tabela abaixo cobre só os que a LOJA mostra, que são
 * os que alguém vê e não entende.
 *
 * O resultado é um `<canvas>` de 48px em branco no card, e cinco cards seguidos
 * assim na prateleira de Boosts — que foi o que ele fotografou.
 *
 * A saída é a mesma que as boosted exercise weapons já usam (ver
 * `BOOSTED_A_CRIAR`, no servidor): a peça nova veste o desenho da peça antiga
 * mais parecida. Uma poção de experiência aparece como frasco, o pergaminho
 * como pergaminho, os pacotes como embrulho. Não é o desenho do jogo dele — o
 * dia em que alguém extrair as sete figuras do client dele, esta tabela sai e
 * nada mais precisa mudar —, mas responde a pergunta que um quadrado vazio não
 * responde: o que é isto que eu vou comprar?
 *
 * Aqui e não no `item-meta.json`: mexer no gamedata seria reescrever um arquivo
 * gerado por extração, e a próxima extração apagaria a correção em silêncio.
 */
const DESENHO_EMPRESTADO = {
  55343: 7440, // Exp Potion (50%)      -> mastermind potion
  55345: 7439, // Exp Potion (75%)      -> berserk potion
  55386: 2815, // Scroll Speed Exercise -> scroll
  55591: 906, //  Pacote Treinador      -> present
  55592: 2856, // Pacote Treinador v2   -> present
  55595: 2478, // Boosted Exercise Box  -> treasure chest
  36725: 9660, // Stamina Extension     -> mystical hourglass
  50051: 3036, // Draevor Tier UP         -> violet gem
};

export async function loadSpriteData() {
  const [outfits, sprites] = await Promise.all([
    fetch('/gamedata/outfits.json').then((r) => r.json()),
    fetch('/gamedata/item-sprites.json').then((r) => r.json()),
  ]);
  outfitMeta = outfits;
  itemSprites = sprites;
  await aplicarOverridesDeSprites();
  await aplicarOverridesDeSpritesDeItens();
  /*
   * O empréstimo entra no próprio índice, e não numa consulta à parte: assim
   * TODO lugar que desenha item (a loja, a mochila, o balão, o baú, o chão)
   * pega a figura sem saber que ela é emprestada. Uma segunda tabela consultada
   * só pela loja deixaria a mesma poção desenhada na vitrine e vazia na bolsa.
   *
   * Só empresta o que está faltando: se um dia o atlas trouxer o desenho de
   * verdade, ele manda.
   */
  for (const [id, arte] of Object.entries(DESENHO_EMPRESTADO)) {
    if (!itemSprites[id] && itemSprites[arte]) itemSprites[id] = itemSprites[arte];
  }
  dadosDosSpritesProntos = true;
  // Os ícones pedidos ANTES do índice chegar saíram vazios: refaz os que ainda estão na tela.
  for (const { canvas, id, cssSize, count } of iconesAntesDosDados.splice(0)) {
    if (canvas.isConnected) canvas.replaceWith(itemCanvas(id, cssSize, count));
  }
}

/*
 * ---- O ícone de quem NÃO tem figura (fallback) ----
 *
 * Auditoria de 01/10 (`tools/auditar-icones.mjs`, `docs/auditoria-icones.md`): 96 ids que caem dos
 * bichos não têm figura nenhuma (quase todos nem estão no catálogo de itens), e o ícone era um
 * `<canvas>` vazio — na Bolsa de Loot, um quadrado em branco que ninguém sabia o que era. Agora sai
 * um "?" no tamanho de sempre, marcado (`data-sem-icone`), e o id vai UMA vez para o console: o
 * fallback não esconde o erro, só deixa a tela legível até o ícone de verdade existir.
 * Só nos ícones de interface (`itemCanvas`): no MAPA (`drawItem`) não — os pisos também são itens
 * sem figura própria, e um "?" em cada piso cobriria o chão.
 */
let dadosDosSpritesProntos = false;
const iconesAntesDosDados = [];
// O "?" e o aviso no console moram em `icone-sem-figura.mjs` (puro: testável sem navegador).
const semIconeAvisados = SemFigura.avisados;
/** Os ids que pediram ícone e não têm figura (para conferir no console: `semIcone()`). */
export const semIcone = () => [...semIconeAvisados];
const desenharSemIcone = SemFigura.desenhar;

/*
 * ---- As folhas de sprite precisam SAIR da memória ----
 *
 * `images` guardava toda folha já pedida e nunca soltava nenhuma. Enquanto
 * fossem os atlas do mapa (um punhado) isso era um cache; com os outfits virou
 * um vazamento, e as contas são estas:
 *
 *   1.272 folhas de outfit, 221 MB em disco, 175 KB de média
 *   decodificadas, TODAS elas somam 620 MB de bitmap
 *   só a aba Outfits da loja pede 229 de uma vez — 40 MB
 *
 * Bitmap decodificado é muito maior que o PNG, e o navegador mata a aba quando
 * a conta estoura. Era o "minha página fecha sozinha depois de 2 a 5 minutos".
 *
 * ---- Por que LRU, e por que este teto ----
 *
 * O mapa redesenha todo quadro e toca nas folhas que está usando a cada um
 * deles; a loja toca uma vez e some. Despejando a menos usada recentemente, as
 * folhas do jogo nunca saem e as da vitrine saem sozinhas — que é exatamente a
 * ordem certa.
 *
 * Cento e cinquenta folhas são ~26 MB de bitmap no pior caso e cabem o mapa
 * inteiro, o grupo, a cidade e uma tela cheia de vitrine com folga. Reentrar
 * numa folha despejada custa um pedido que o cache HTTP do navegador responde
 * de graça.
 *
 * ---- Por que o teto não basta sozinho: o MAPA PISCANDO PRETO ----
 *
 * A aba de outfits da loja pede 229 folhas NUM ÚNICO desenho — mais do que o
 * teto inteiro. A ordem de despejo é a de uso, mas dentro daquele mesmo desenho
 * as folhas do mapa são as mais antigas de todas: elas foram tocadas no quadro
 * anterior, e as 229 acabaram de entrar. Resultado: a vitrine expulsava o chão,
 * as criaturas e o boneco, e o mapa aparecia preto até as folhas voltarem da
 * rede. Era o "pisca preto onde é a tela do personagem" ao trocar de aba.
 *
 * A correção é uma carência: folha tocada nos últimos segundos não sai, por
 * mais antiga que esteja na fila. O mapa desenha oito vezes por segundo, então
 * as folhas dele estão sempre dentro da carência e ficam intocáveis enquanto o
 * jogo está à vista; as da vitrine envelhecem sozinhas assim que a janela
 * fecha.
 *
 * Enquanto todas estiverem na carência o cache cresce — é o preço de não piscar
 * —, mas só até o TETO_ABSOLUTO, onde a mais antiga sai de qualquer jeito. Sem
 * esse segundo teto, uma tela que pedisse mil folhas de uma vez traria o
 * vazamento de volta pela porta dos fundos.
 */
const TETO_DE_FOLHAS = 150;
const CARENCIA_MS = 4000;
const TETO_ABSOLUTO = 520;

/*
 * ---- A folha que falhou tem de tentar DE NOVO ----
 *
 * O relato do dono: "às vezes algumas sprites de bicho não aparecem, e só volta
 * com Ctrl+F5".
 *
 * A causa estava aqui, e era uma ausência: havia `onload` e não havia
 * `onerror`. Uma folha cujo download falhasse — a rede piscou, o servidor
 * reiniciou no meio do pedido, a conexão caiu — ficava com `ready: false` para
 * SEMPRE. E ficava no cache: `image()` devolve a entrada guardada e ainda a
 * toca, o que a mantém dentro da carência e a torna eterna. Ninguém pedia
 * aquela folha de novo, então ninguém descobria que ela tinha falhado.
 *
 * O Ctrl+F5 "consertava" porque jogava fora o estado do JavaScript inteiro, e
 * não porque limpava cache do navegador.
 *
 * ---- Por que isto aparece MAIS depois de uma publicação ----
 *
 * Porque publicar reinicia o serviço, e todo pedido de imagem em voo naquele
 * instante falha. Quem estava com a aba aberta fica com aquelas folhas quebradas
 * pelo resto da sessão — e são justamente os bichos da caverna em que ele
 * estava.
 *
 * ---- A espera cresce ----
 *
 * Tentar de novo a cada quadro seria um pedido oito vezes por segundo para um
 * arquivo que talvez não exista mesmo. A espera dobra a cada falha (2s, 4s,
 * 8s...) até um teto de meio minuto: recupera de uma queda curta em segundos,
 * e de uma longa sem transformar o cliente num martelo.
 *
 * E a retentativa leva um sufixo na URL de propósito. Uma resposta cortada ou
 * um 502 podem ter ficado no cache do navegador; pedir a MESMA url devolveria o
 * mesmo erro guardado, sem tocar na rede.
 */
const ESPERA_INICIAL_MS = 2000;
const ESPERA_MAXIMA_MS = 30000;

/*
 * ---- Folha gigante: decodificada UMA vez e para sempre ----
 *
 * "lag na cidade só no celular". Medido (Chromium emulando celular, 25 jogadores
 * na praça): de 456 cópias do atlas da cidade para as tiras, 448 custavam 0 ms e
 * 8 custavam ~340 ms cada — todas a PRIMEIRA leitura depois de o navegador
 * descartar a imagem decodificada. O atlas da cidade tem 4096x4096 (64 MB
 * decodificados, o maior de todos: as caçadas vão até 3200x3200, 41 MB) e o cache
 * de imagens decodificadas do Chrome o joga fora quando outras folhas disputam o
 * espaço (jogadores, itens, brasões) — no celular o limite é bem menor. Cada
 * descarte é uma redecodificação inteira no meio do quadro.
 *
 * O `ImageBitmap` já nasce decodificado e fica com o arquivo: o navegador não
 * descarta, e copiar dele custa o mesmo 0,01 ms de sempre. Só as folhas maiores
 * que a maior caçada: as outras continuam como eram, sem gastar memória à toa.
 */
const PIXELS_DA_FOLHA_GIGANTE = 12_000_000;

function fixarDecodificada(entry, imagem) {
  if (typeof createImageBitmap !== 'function') return;
  if (imagem.naturalWidth * imagem.naturalHeight < PIXELS_DA_FOLHA_GIGANTE) return;
  createImageBitmap(imagem).then(
    (bitmap) => {
      // Se a folha foi pedida de novo enquanto isso, o bitmap é da imagem velha.
      if (entry.image === imagem) entry.image = bitmap;
      else bitmap.close?.();
    },
    () => {} // sem bitmap: segue com a <img>, como antes
  );
}

/** Devolve a memória do bitmap (só ele tem `close`; a `<img>` o navegador coleta). */
const soltar = (entry) => entry.image?.close?.();

function pedir(entry, src) {
  soltar(entry);
  entry.ready = false;
  entry.falhouEm = 0;
  entry.image = new Image();
  const imagem = entry.image;
  entry.image.onload = () => {
    entry.ready = true;
    // Deu certo: a próxima falha recomeça a espera do começo.
    entry.tentativas = 0;
    fixarDecodificada(entry, imagem);
  };
  entry.image.onerror = () => {
    entry.falhouEm = performance.now();
    entry.tentativas = (entry.tentativas ?? 0) + 1;
  };
  entry.image.src = entry.tentativas ? `${src}${src.includes('?') ? '&' : '?'}r=${entry.tentativas}` : src;
}

/** Quanto esperar antes da próxima tentativa desta folha. */
const esperaDe = (entry) =>
  Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** Math.max(0, (entry.tentativas ?? 1) - 1));

/** Imagens desenhadas no próprio cliente (os ícones das gemas), pela chave — `image()` devolve sem buscar nada. */
const imagensGeradas = new Map();

/*
 * Os ÍCONES do PoE (gemas e itens, 64×64, um arquivo cada — `/api/jogo/poe/icone/`) ficam fora do teto de folhas: a loja do Zuma abre
 * ~600 gemas de uma vez, e com o teto (520) os primeiros ícones eram despejados antes de chegar — a lista saía sem figura. São pequenos
 * (64×64): guardar todos custa pouco.
 */
const iconesDoPoe = new Map();
const PREFIXO_DOS_ICONES_DO_POE = '/api/jogo/poe/icone/';

export function image(src) {
  const gerada = imagensGeradas.get(src);
  if (gerada) return gerada;
  if (src.startsWith(PREFIXO_DOS_ICONES_DO_POE)) {
    let icone = iconesDoPoe.get(src);
    if (!icone) {
      icone = { image: null, ready: false, tocadaEm: 0, falhouEm: 0, tentativas: 0 };
      iconesDoPoe.set(src, icone);
      pedir(icone, src);
    } else if (icone.falhouEm && performance.now() - icone.falhouEm >= esperaDe(icone)) pedir(icone, src);
    return icone;
  }
  const agora = performance.now();
  let entry = images.get(src);
  if (entry) {
    entry.tocadaEm = agora;
    // Toca na folha: `Map` mantém a ordem de inserção, então reinserir é o que
    // a põe no fim da fila de despejo.
    images.delete(src);
    images.set(src, entry);
    // A folha quebrada tenta de novo quando a espera dela vence.
    if (entry.falhouEm && agora - entry.falhouEm >= esperaDe(entry)) pedir(entry, src);
    return entry;
  }

  entry = { image: null, ready: false, tocadaEm: agora, falhouEm: 0, tentativas: 0 };
  pedir(entry, src);
  images.set(src, entry);

  if (images.size > TETO_DE_FOLHAS) despejar(agora);
  return entry;
}

/*
 * Uma folha por entrada nova, e só uma: o teto é ultrapassado de um em um.
 *
 * Percorre da mais antiga para a mais nova e tira a PRIMEIRA que já saiu da
 * carência. Estourando o teto absoluto, tira a mais antiga sem perguntar.
 */
function despejar(agora) {
  const estourou = images.size > TETO_ABSOLUTO;
  for (const [chave, folha] of images) {
    if (!estourou && agora - (folha.tocadaEm ?? 0) < CARENCIA_MS) continue;
    images.delete(chave);
    soltar(folha);
    return;
  }
}

/**
 * A imagem já chegou? (E, de quebra, começa a buscá-la se ninguém buscou.)
 *
 * Quem pergunta é a cortina de viagem: ela só pode sair depois que o atlas da
 * hunt chegou, senão o que aparece por baixo dela é um mapa vazio.
 */
export const imagemPronta = (src) => image(src).ready;

export const outfitInfo = (look) => metaDe(look);

/** A URL da folha de um look: a do override, se ele tem um ativo, senão a original. */
export const urlDaFolha = (look) => urlsDeFolha[look] ?? `/gamedata/sprites/outfits/${look}.png`;

/**
 * Lê `gamedata/overrides/sprites.json` e aplica no que o jogo desenha: para cada look com override ativo, o cadastro de quadros novo e a imagem
 * `overrides/sprites/<look>.png` (o `?v=` é o hash, para o navegador não servir a versão velha). Arquivo ausente ou ilegível = sem overrides (nunca trava).
 */
async function aplicarOverridesDeSprites() {
  try {
    const r = await fetch('/gamedata/overrides/sprites.json');
    if (!r.ok) return;
    const d = await r.json();
    const { metas, urls } = resolverOverrides(d, outfitMeta);
    for (const look of Object.keys(metas)) originaisSobrescritos[look] = outfitMeta[look];
    Object.assign(outfitMeta, metas);
    Object.assign(urlsDeFolha, urls);
  } catch { /* sem overrides */ }
}

/**
 * Os overrides de ITENS na Engine (`overrides/itens.json` e `overrides/itens-sprites.json`): (1) um item NOVO (entrada com `base`) usa o sprite do item-base até ganhar o seu; (2) um item com sprite
 * alterado passa a desenhar a imagem do override (`gamedata/overrides/sprites/itens/<id>.png`, `frames` quadros lado a lado). Arquivo ausente ou ilegível = sem overrides (nunca trava).
 */
async function aplicarOverridesDeSpritesDeItens() {
  const ler = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  try {
    const [novos, imagens] = await Promise.all([ler('/gamedata/overrides/itens.json'), ler('/gamedata/overrides/itens-sprites.json')]);
    if (novos && novos.ativo !== false) {
      for (const [id, ov] of Object.entries(novos.itens ?? {})) if (ov && ov.base !== undefined && ov.ativo !== false && !itemSprites[id] && itemSprites[ov.base]) itemSprites[id] = itemSprites[ov.base];
    }
    if (imagens && imagens.ativo !== false) {
      for (const [id, v] of Object.entries(imagens.itens ?? {})) {
        const quadros = Math.max(1, Number(v.frames) || 1);
        itemSprites[id] = { x: 0, y: 0, w: v.w, h: v.h, gerada: `/gamedata/overrides/sprites/itens/${id}.png?v=${v.hash}`, s: Array.from({ length: quadros }, (_, i) => [0, i * v.w, 0]), f: quadros, n: 1, ...(quadros > 1 ? { d: Array(quadros).fill(200) } : {}) };
      }
    }
  } catch { /* sem overrides */ }
}

/** Espera a folha `url` chegar (decodificada) — ou rejeita no prazo. Usada pelo Hot Reload ANTES de trocar, para nunca desenhar com a folha pela metade. */
function folhaPronta(url, prazoMs = 15000) {
  const inicio = performance.now();
  return new Promise((ok, falha) => {
    const olhar = () => {
      const e = image(url);
      if (e.ready) return ok();
      if (performance.now() - inicio > prazoMs) return falha(new Error(`a folha ${url} não carregou`));
      setTimeout(olhar, 40);
    };
    olhar();
  });
}

/**
 * HOT RELOAD (ambiente local): aplica o aviso `contentUpdate` de sprites do servidor SEM recarregar a página. Carrega TODAS as folhas novas primeiro;
 * só então troca, de uma vez e de forma síncrona, o cadastro de quadros + a URL da folha + o cache de quadros compostos de cada look — o renderer nunca
 * mistura quadros antigos com novos. A folha antiga é devolvida (memória do bitmap). Devolve os looks trocados. Folha que não carrega: aquele look
 * continua como estava (o aviso vai ao console).
 */
export async function atualizarSpritesDoJogo(aviso) {
  if (aviso.indice) {
    try {
      const novo = await (await fetch(`/gamedata/outfits.json?v=${Date.now()}`)).json();
      for (const [look, meta] of Object.entries(novo)) { if (look in originaisSobrescritos) originaisSobrescritos[look] = meta; else outfitMeta[look] = meta; }
    } catch (e) { console.warn('[hot-reload] índice dos desenhos:', e.message); }
  }
  const metaOriginal = (look) => originaisSobrescritos[look] ?? (look in urlsDeFolha ? null : outfitMeta[look]);
  const trocas = planejarTrocas(aviso, { metaOriginal, sobrescritos: new Set(Object.keys(urlsDeFolha)) });
  const prontas = [];
  await Promise.all(trocas.map((t) => folhaPronta(t.url).then(() => prontas.push(t), (e) => console.warn('[hot-reload]', e.message))));
  for (const t of prontas) {
    const antiga = urlDaFolha(t.look);
    if (!(t.look in originaisSobrescritos) && !(t.look in urlsDeFolha) && outfitMeta[t.look]) originaisSobrescritos[t.look] = outfitMeta[t.look];
    outfitMeta[t.look] = t.meta;
    urlsDeFolha[t.look] = t.url;
    for (const k of [...outfitCache.keys()]) if (k.startsWith(`${t.look}|`)) outfitCache.delete(k);
    if (antiga !== t.url) { const e = images.get(antiga); if (e) { soltar(e); images.delete(antiga); } }
    if (t.url.startsWith('/gamedata/sprites/outfits/') && !t.url.includes('?')) delete urlsDeFolha[t.look];
  }
  return prontas.map((t) => t.look);
}

/**
 * Para o EDITOR de sprites: registra uma folha avulsa sob uma chave (`rascunho:128`, `original:128`). `fonte` é um canvas/imagem já desenhado ou uma URL.
 * O resto do jogo desenha essa chave como qualquer look (`outfitCanvas`, `drawCreature`), então a pré-visualização usa o MESMO renderer do jogo.
 */
export function registrarVariante(chave, { meta, fonte }) {
  variantes.set(chave, { meta, fonte });
  for (const k of [...outfitCache.keys()]) if (k.startsWith(`${chave}|`)) outfitCache.delete(k);
}
export const removerVariante = (chave) => { variantes.delete(chave); for (const k of [...outfitCache.keys()]) if (k.startsWith(`${chave}|`)) outfitCache.delete(k); };
/** A folha de um look: a variante registrada, ou a imagem (override ou original). `{ ready, image }` como `image()`. */
function folhaDe(look) {
  const v = variantes.get(look);
  if (v) return typeof v.fonte === 'string' ? image(v.fonte) : { ready: true, image: v.fonte };
  return image(urlDaFolha(look));
}
export const itemSprite = (id) => itemSprites[id];

/**
 * Os itens do catálogo que pedem a figura de OUTRO (`spriteDe` — as gemas de
 * skill usam a pedra do elemento). Mesmo empréstimo do `DESENHO_EMPRESTADO`,
 * só que vindo do servidor, no `welcome`.
 */
export function emprestarDoCatalogo(catalogo) {
  for (const [id, meta] of Object.entries(catalogo ?? {})) {
    // A GEMA DO PoE (só com ITENS_POE=1): o ícone dela, da coleção do dono (servido pela engine local).
    if (meta?.poeGema?.icone) {
      // O ícone do suporte vem do CDN oficial do PoE (78×78); o da ativa, da coleção (64×64).
      const lado = meta.poeGema.suporte ? 78 : 64;
      itemSprites[id] = { w: lado, h: lado, x: 0, y: 0, umaCasa: true, gerada: `/api/jogo/poe/icone/${meta.poeGema.suporte ? 'suporte' : 'gema'}/${meta.poeGema.icone.split('/').map(encodeURIComponent).join('/')}` };
      continue;
    }
    // As GEMAS ganham o ícone próprio, desenhado (ver `icones-de-gema.mjs`) — no lugar da pedra emprestada.
    if (meta?.gemaDef) {
      const chave = `gema:${id}`;
      if (!imagensGeradas.has(chave)) imagensGeradas.set(chave, { image: desenharGema(meta.gemaDef, id, 32), ready: true, tocadaEm: 0, falhouEm: 0, tentativas: 0 });
      itemSprites[id] = { w: 32, h: 32, x: 0, y: 0, gerada: chave };
      continue;
    }
    // Os orbes do PoE (Joalheiro, Fusão, Cromático): o ícone do PoE (48×48), no lugar do desenho emprestado.
    if (meta?.poeMoeda?.icone) {
      itemSprites[id] = { w: 48, h: 48, x: 0, y: 0, umaCasa: true, gerada: `/api/jogo/poe/icone/moeda/${encodeURIComponent(meta.poeMoeda.icone)}` };
      continue;
    }
    if (meta?.spriteDe && !itemSprites[id] && itemSprites[meta.spriteDe]) itemSprites[id] = itemSprites[meta.spriteDe];
    // Item do sistema de itens do PoE (só com ITENS_POE=1 no servidor local): o ícone 64×64 da coleção de referência, servido pela engine.
    // (O lado vem do catálogo quando o ícone não é 64×64: as sprites dos MAPAS, do cdn do poedb, são 80×80.)
    if (meta?.poe?.icone && !itemSprites[id]) itemSprites[id] = { w: meta.poe.iconeLado ?? 64, h: meta.poe.iconeLado ?? 64, x: 0, y: 0, umaCasa: true, gerada: `/api/jogo/poe/icone/item/${meta.poe.icone.split('/').map(encodeURIComponent).join('/')}` };
  }
  // Quem saiu com o "?" antes deste empréstimo (gema, `spriteDe`) e agora tem figura: refaz.
  for (const canvas of globalThis.document?.querySelectorAll?.('canvas[data-sem-icone]') ?? []) {
    const id = Number(canvas.dataset.semIcone);
    if (!itemSprites[id]) continue;
    semIconeAvisados.delete(id);
    const novo = itemCanvas(id, parseInt(canvas.style.width, 10) || 32);
    novo.className = canvas.className;
    canvas.replaceWith(novo);
  }
}

// ---------- itens ----------

/**
 * Empilhável no Tibia muda de desenho conforme a quantidade: 1..4 têm sprite
 * próprio, depois vêm as faixas 5, 10, 25 e 50+. É a mesma tabela do otclient.
 */
function countPattern(count) {
  if (count <= 0) return 0;
  if (count < 5) return count - 1;
  if (count < 10) return 4;
  if (count < 25) return 5;
  if (count < 50) return 6;
  return 7;
}

/** Qual das tiras do item desenhar agora. */
function viewOf(sprite, { count = 0, time = 0 } = {}) {
  if (!sprite?.s?.length) return null;

  // Pilha de moedas e afins: a quantidade escolhe o padrão.
  if (count > 1 && sprite.n >= 8) {
    const pattern = countPattern(count);
    return sprite.s[pattern === 0 ? 0 : sprite.f + pattern - 1] ?? sprite.s[0];
  }

  if (sprite.f > 1) {
    const durations = sprite.d ?? [];
    const total = durations.length ? durations.reduce((sum, value) => sum + value, 0) : sprite.f * 200;
    let cursor = time % total;
    for (let frame = 0; frame < sprite.f; frame++) {
      cursor -= durations[frame] ?? 200;
      if (cursor < 0) return sprite.s[frame];
    }
  }
  return sprite.s[0];
}

// O sprite GERADO no cliente (os ícones das gemas) não tem folha: a chave aponta para o canvas dele.
const pageSrc = (sprite, page) => sprite.gerada ?? `/gamedata/sprites/items/${sprite.b ?? 'items32-'}${page}.png`;

/** Desenha um item ancorado no canto inferior direito do tile, como no jogo. */
export function drawItem(ctx, id, x, y, options) {
  const sprite = itemSprites[id];
  if (!sprite) return false;

  const view = viewOf(sprite, options) ?? [0, sprite.x, sprite.y];
  const atlas = image(pageSrc(sprite, view[0]));
  if (!atlas.ready) return false;

  /*
   * ---- O ícone do PoE cabe numa casa ----
   *
   * O sprite do Tibia maior que 32 é grande DE PROPÓSITO (a árvore, o baú grande): ele cresce para cima e para a esquerda a partir da
   * casa. O ícone do PoE (a peça 64×64, a gema 64/78, o orbe 48) é a arte do inventário — desenhado no tamanho dele, a peça no chão
   * ocupava 2×2 casas e ficava muito maior que o personagem (dono, 08/10: "item no chão está absurdamente maior que o personagem, não
   * está em 1 tile"). Ele vai reduzido para dentro da casa.
   */
  if (sprite.umaCasa) {
    ctx.drawImage(atlas.image, view[1], view[2], sprite.w, sprite.h, x, y, 32, 32);
    return true;
  }
  ctx.drawImage(
    atlas.image,
    view[1], view[2], sprite.w, sprite.h,
    x - (sprite.w - 32), y - (sprite.h - 32), sprite.w, sprite.h
  );
  return true;
}

export const isAnimated = (id) => (itemSprites[id]?.f ?? 1) > 1;

/**
 * Canvas isolado com o sprite do item, para ícones de interface.
 * Itens animados continuam animando fora do mapa — é assim no client.
 */
/*
 * ---- Um laço só para todos os ícones animados ----
 *
 * Medido com a Kina caçando (set com tier, mochila cheia): 34 ícones animados
 * visíveis, cada um com o PRÓPRIO `requestAnimationFrame` a cada quadro — e o
 * `paint` deles somava ~48 ms de CPU por segundo, mais que a interface inteira
 * (`renderAll`, ~16 ms/s). E dos 175 ícones da página só 33 estavam à vista: o
 * de janela fechada ou rolado para fora continuava rodando.
 *
 * Agora há UM laço, que percorre os ícones registrados, e cada ícone só
 * desenha quando está visível (`IntersectionObserver`, que o navegador
 * responde sem medir nada no quadro) e quando o quadro da animação dele
 * mudou. Ícone que saiu do documento sai do laço.
 */
const iconesAnimados = new Set();
let lacoDosIcones = 0;
function tiqueDosIcones(time) {
  lacoDosIcones = 0;
  for (const icone of iconesAnimados) if (!icone(time)) iconesAnimados.delete(icone);
  if (iconesAnimados.size) lacoDosIcones = requestAnimationFrame(tiqueDosIcones);
}
function animarIcone(icone) {
  iconesAnimados.add(icone);
  if (!lacoDosIcones) lacoDosIcones = requestAnimationFrame(tiqueDosIcones);
}
const visivelNaTela = new WeakMap();
const vigiaDeVisibilidade =
  typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entradas) => {
        for (const e of entradas) visivelNaTela.set(e.target, e.isIntersecting);
      })
    : null;

export function itemCanvas(id, cssSize = 32, count = 0) {
  const sprite = itemSprites[id];
  const canvas = document.createElement('canvas');
  canvas.className = 'sprite';
  canvas.width = sprite?.w ?? 32;
  canvas.height = sprite?.h ?? 32;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  if (!sprite) {
    // Índice ainda não chegou: fica vazio e é refeito quando chegar. Chegou e não tem: o "?".
    if (!dadosDosSpritesProntos) iconesAntesDosDados.push({ canvas, id, cssSize, count });
    else desenharSemIcone(canvas, id);
    return canvas;
  }

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let last = -1;
  let vigiado = false;
  // Devolve `false` quando o ícone não precisa mais do laço.
  const paint = (time) => {
    if (!canvas.isConnected && last >= 0) {
      vigiaDeVisibilidade?.unobserve(canvas);
      return false; // saiu da tela: para de animar
    }
    if (canvas.isConnected && !vigiado && vigiaDeVisibilidade) {
      vigiaDeVisibilidade.observe(canvas);
      vigiado = true;
    }
    // Já desenhado uma vez e escondido (janela fechada, rolado para fora): espera.
    if (last >= 0 && visivelNaTela.get(canvas) === false) return true;
    const view = viewOf(sprite, { count, time }) ?? [0, sprite.x, sprite.y];
    const atlas = image(pageSrc(sprite, view[0]));
    if (atlas.ready && view[1] !== last) {
      last = view[1];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(atlas.image, view[1], view[2], sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
    }
    return sprite.f > 1 || !atlas.ready;
  };
  animarIcone(paint);
  return canvas;
}

// ---------- outfits ----------

const colorKey = (colors) => (colors ? `${colors.head}-${colors.body}-${colors.legs}-${colors.feet}` : 'x');

/**
 * Cor padrão do outfit, a mesma com que o servidor cria o personagem. A camada
 * base de um outfit de jogador é quase branca de propósito — ela existe para ser
 * tingida pela camada template. Onde a lista mostrava o outfit sem cor nenhuma
 * (loja, escolha de vocação, montaria) o boneco saía manchado de branco; agora
 * ele nasce vestido.
 */
const DEFAULT_COLORS = { head: 78, body: 88, legs: 58, feet: 76 };

/**
 * Frame já colorizado, em cache — recompor camadas todo quadro custa caro.
 *
 * A folha do outfit é uma grade: cada coluna é
 * `((z * addons + addon) * dirs + dir) * layers + layer`, onde z = 0 é a pose
 * em pé e z = 1 a pose montada. Os addons são cumulativos, como no client:
 * desenha a base e por cima cada addon que o personagem tem.
 */
function outfitFrame(look, colors, dir, frame, walking, mounted = false, addons = 0) {
  const meta = metaDe(look);
  if (!meta) return null;

  // Outfit de jogador tem dois frame groups (parado e andando); quase todo
  // monstro tem só um, e é esse mesmo que anima enquanto ele se move.
  const group = (walking && meta.groups[1]) || meta.groups[0];
  const dirs = group.dirs || 1;
  const depth = group.depth || 1;
  const addonCount = group.addons || 1;
  const safeDir = Math.min(dir, dirs - 1);
  const safeFrame = group.frames ? frame % group.frames : 0;
  const z = mounted && depth > 1 ? 1 : 0;
  const wearing = addonCount > 1 ? addons & 3 : 0;

  const key = `${look}|${colorKey(colors)}|${safeDir}|${safeFrame}|${walking ? 1 : 0}|${z}|${wearing}`;
  const cached = outfitCache.get(key);
  if (cached) return cached;

  const sheet = folhaDe(look);
  if (!sheet.ready) return null;

  const { cw, ch } = meta;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;

  const sy = (group.row + safeFrame) * ch;
  const column = (addon, layer) => (((z * addonCount + addon) * dirs + safeDir) * group.layers + layer) * cw;

  // Base (addon 0) e depois cada addon vestido, um por cima do outro.
  const parts = [0];
  if (wearing & 1 && addonCount > 1) parts.push(1);
  if (wearing & 2 && addonCount > 2) parts.push(2);

  const scratch = document.createElement('canvas');
  scratch.width = cw;
  scratch.height = ch;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = false;

  /*
   * ---- Camada que saiu VAZIA não vai para o cache ----
   *
   * O defeito que isto corrige: "as vezes addon encima de montaria
   * desaparecem e so volta ao dar ctrl+f5", e "as vezes troco de aba e
   * desaparece".
   *
   * A composição é guardada para sempre sob a chave dela. Quando o navegador
   * descarta o BITMAP já decodificado de uma folha — o que ele faz para
   * economizar memória, e faz justamente com a aba em segundo plano —, o
   * `Image` continua dizendo que carregou (o `onload` já correu há muito) e o
   * `drawImage` desenha NADA, sem erro nenhum.
   *
   * O quadro composto naquele instante saía incompleto e era gravado. A partir
   * dali ele voltava incompleto para sempre, porque nada nunca o recompunha:
   * só um recarregamento forçado, que joga fora o módulo e o cache inteiro. É
   * exatamente o Ctrl+F5 que ele descreveu.
   *
   * Agora cada camada é conferida. Uma que saiu sem um pixel só derruba a
   * gravação: o quadro é DEVOLVIDO assim mesmo (melhor um boneco incompleto
   * neste sexagésimo de segundo do que um buraco), e o quadro seguinte
   * recompõe do zero. Assim que o bitmap volta, ele conserta sozinho.
   */
  let inteiro = true;
  for (const addon of parts) {
    sctx.clearRect(0, 0, cw, ch);
    sctx.drawImage(sheet.image, column(addon, 0), sy, cw, ch, 0, 0, cw, ch);

    if (group.layers > 1 && colors) {
      const base = sctx.getImageData(0, 0, cw, ch);
      // A leitura já é feita para colorir: conferir aqui não custa nada.
      if (!temPixel(base.data)) inteiro = false;
      sctx.clearRect(0, 0, cw, ch);
      sctx.drawImage(sheet.image, column(addon, 1), sy, cw, ch, 0, 0, cw, ch);
      const template = sctx.getImageData(0, 0, cw, ch);
      colorize(base.data, template.data, colors);
      sctx.putImageData(base, 0, 0);
    } else if (!temPixel(sctx.getImageData(0, 0, cw, ch).data)) {
      inteiro = false;
    }
    ctx.drawImage(scratch, 0, 0);
  }

  // Sem gravar: o próximo quadro tenta de novo. Ver o bloco acima.
  if (!inteiro) return canvas;

  if (outfitCache.size > 900) outfitCache.clear();
  outfitCache.set(key, canvas);
  return canvas;
}

/** Há algum pixel visível aqui? Só o canal alfa importa. */
function temPixel(data) {
  for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
  return false;
}

/*
 * ---- Voltar para a aba refaz os quadros compostos ----
 *
 * A segunda metade do mesmo defeito, e a que o dono descreveu direto: "as
 * vezes troco de aba e desaparece". Com a página em segundo plano o navegador
 * descarta bitmaps decodificados; o primeiro quadro depois da volta é
 * composto enquanto eles ainda estão voltando.
 *
 * A conferência acima já impede que esse quadro seja GRAVADO. Isto joga fora o
 * que ficou gravado ANTES da saída, que é o que pode ter sido composto na
 * mesma condição sem ninguém perceber. Custa uma recomposição por boneco na
 * tela — uma vez, no instante em que a pessoa volta a olhar.
 *
 * `outfitCache` só: as folhas em `images` não são recarregadas, porque o
 * `Image` delas continua válido e o navegador redecodifica sozinho no primeiro
 * uso.
 */
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') outfitCache.clear();
  });
}

/**
 * Criatura ancorada no canto inferior direito do tile.
 *
 * Montaria: a montaria fica no tile e o personagem é desenhado por cima, no
 * MESMO ponto, usando a pose montada — o patternDepth 1, que já vem com as
 * pernas dobradas e o corpo na altura da sela.
 *
 * Nada de deslocamento aqui. Eu subia o boneco pelo `shift` do appearance (8px
 * para cima e para a esquerda) e era isso que o deixava boiando acima do bicho.
 * O `shift` é o deslocamento geral do outfit, que o client aplica no desenho de
 * qualquer thing — e como aqui a âncora já é o canto do tile, ele virava um
 * empurrão a mais. Conferido sprite a sprite contra a folha: sem deslocamento o
 * personagem senta na sela; com -8 ele flutua; com +8 ele afunda no bicho.
 */
export function drawCreature(ctx, { look, colors, dir, frame, walking, mount, addons }, px, py) {
  let mounted = false;
  // Faltou alguma folha para carregar. No mapa, que redesenha sessenta vezes
  // por segundo, isso se resolve sozinho no quadro seguinte; num desenho de uma
  // vez só é quem chamou que precisa saber para tentar de novo.
  let completo = true;

  if (mount) {
    const canvas = outfitFrame(mount, null, dir, frame, walking);
    if (canvas) {
      ctx.drawImage(canvas, px - (canvas.width - 32), py - (canvas.height - 32));
      mounted = true;
    } else {
      completo = false;
    }
  }

  const canvas = outfitFrame(look, colors, dir, frame, walking, mounted, addons ?? 0);
  if (!canvas) return false;
  ctx.drawImage(canvas, px - (canvas.width - 32), py - (canvas.height - 32));
  return completo;
}

/** Retângulo dos pixels visíveis de um canvas — o resto é transparente. */
function contentBounds(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Retrato de uma criatura, para listas e janelas.
 *
 * O sprite é recortado no que ele realmente ocupa e ampliado até encher o
 * quadro: sem isso um rato, que mora num canto de uma célula de 64px, aparecia
 * minúsculo do lado de um dragão. E ele anima, no ritmo do próprio appearance.
 * Com `colors.mount` a montaria entra embaixo, igual ao mapa.
 */
export function outfitCanvas(look, colors, cssSize = 48, dir = 2, animate = false) {
  const meta = metaDe(look);
  // Lista sem cor (loja, escolha de vocação, quadro de tarefas) recebe a paleta
  // padrão: a camada base de um outfit de jogador é quase branca de propósito,
  // e sem tintura o boneco saía manchado de branco. No mapa nada muda — lá a
  // criatura sempre vem com as cores dela e a montaria continua com as suas.
  /*
   * Sem tintura, a paleta padrão.
   *
   * A camada base de um outfit de jogador é quase branca de propósito, e sem
   * tintura o boneco sai manchado. A checagem é pelo campo `head` e não pelo
   * objeto inteiro: a loja passa `{ addons: 3 }` para mostrar o outfit vestido,
   * que é objeto e não tem cor nenhuma — antes isso pulava o padrão e devolvia
   * o boneco branco.
   */
  if (colors?.head == null && (meta?.groups?.[0]?.layers ?? 1) > 1) {
    colors = { ...DEFAULT_COLORS, ...(colors ?? {}) };
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'sprite';
  canvas.width = cssSize;
  canvas.height = cssSize;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  if (!meta) return canvas;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const scratch = document.createElement('canvas');
  scratch.width = meta.cw + 32;
  scratch.height = meta.ch + 32;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = false;

  const group = meta.groups[0];
  const frames = animate ? group.frames ?? 1 : 1;
  let bounds = null;

  const compose = (frame) => {
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    return drawCreature(
      sctx,
      { look, colors, dir, frame, walking: false, mount: colors?.mount ?? 0, addons: colors?.addons ?? 0 },
      scratch.width - 32,
      scratch.height - 32
    );
  };

  const desenhar = () => {
    const scale = Math.min(canvas.width / bounds.w, canvas.height / bounds.h);
    const w = Math.round(bounds.w * scale);
    const h = Math.round(bounds.h * scale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      scratch,
      bounds.x, bounds.y, bounds.w, bounds.h,
      Math.round((canvas.width - w) / 2), Math.round((canvas.height - h) / 2), w, h
    );
  };

  /*
   * ---- A animação entra no mesmo laço dos ícones ----
   *
   * Antes cada boneco animado (retrato do personagem, cartões de outfit, lista
   * de criaturas) tinha o próprio `requestAnimationFrame` e REMONTAVA as camadas
   * (`drawCreature`, com tintura) a cada quadro da tela, ainda que o quadro da
   * animação fosse o mesmo — ela troca poucas vezes por segundo. Agora ele pega
   * carona no laço único, só desenha quando está à vista e só quando o quadro
   * da animação mudou.
   */
  let ultimoQuadro = -1;
  let vigiado = false;
  const passo = (time) => {
    if (!canvas.isConnected) {
      if (!vigiado) return true; // ainda não entrou no documento: espera
      vigiaDeVisibilidade?.unobserve(canvas);
      return false; // saiu da tela: para de animar
    }
    if (!vigiado && vigiaDeVisibilidade) vigiaDeVisibilidade.observe(canvas);
    vigiado = true;
    if (visivelNaTela.get(canvas) === false) return true;
    const frame = idleFrameOf(group, time);
    if (frame === ultimoQuadro || !compose(frame)) return true;
    ultimoQuadro = frame;
    desenhar();
    return true;
  };

  const paint = (time = 0) => {
    if (!canvas.isConnected && bounds) return; // saiu da tela: para de animar
    /*
     * Ainda fora do campo de visão: não desenha e, sobretudo, não PEDE a folha.
     *
     * A aba de outfits da loja monta 229 cartões de uma vez, e cada um pedia a
     * própria folha na hora de nascer — 229 pedidos simultâneos, 40 MB, contra
     * um navegador que atende seis por vez. O que se via era o que o dono
     * descreveu: alguns cartões com boneco, a maioria vazia, e tudo aparecendo
     * "quando reabre a página" — que é quando o cache do navegador já tem tudo.
     *
     * Com esta linha, quem está fora da tela espera. Rolar a lista pede o que
     * entrou no quadro, meia dúzia por vez, e a fila anda.
     *
     * `isConnected` primeiro porque um cartão que ainda não entrou no documento
     * mede 0x0 e seria confundido com "fora da tela" para sempre.
     */
    if (canvas.isConnected && !bounds && foraDoCampoDeVisao(canvas)) {
      return void setTimeout(() => paint(0), 200);
    }
    const frame = frames > 1 ? idleFrameOf(group, time) : 0;
    /*
     * `compose` é falso enquanto FALTA alguma folha — a do boneco ou a da
     * montaria. Antes ele só olhava a do boneco, e quando a da montaria chegava
     * atrasada o desenho já tinha sido feito sem ela: o personagem ficava
     * boiando, sem bicho embaixo. Como um outfit parado não tem animação, não
     * havia segundo quadro para consertar — ficava assim para sempre.
     */
    if (!compose(frame)) return void setTimeout(() => paint(0), 80);

    // A caixa é medida uma vez: ela não muda entre quadros da mesma criatura.
    // Só depois que tudo carregou, senão ela sai do tamanho do boneco sozinho e
    // a montaria, ao chegar, é desenhada fora dela.
    bounds ??= contentBounds(scratch);
    if (!bounds) return;

    desenhar();
    if (frames > 1) {
      ultimoQuadro = frame;
      animarIcone(passo);
    }
  };
  requestAnimationFrame(paint);
  return canvas;
}

/**
 * O elemento está longe do que se vê agora?
 *
 * Uma tela de folga para cada lado: quem está prestes a entrar já começa a
 * carregar, e o desenho chega antes do olho. Elemento sem caixa (`0x0`) conta
 * como fora — ele ainda não foi posicionado.
 */
function foraDoCampoDeVisao(elemento) {
  const caixa = elemento.getBoundingClientRect();
  if (!caixa.width && !caixa.height) return true;
  const folga = window.innerHeight || 800;
  return caixa.bottom < -folga || caixa.top > (window.innerHeight || 800) + folga;
}

/** Quadro da animação parada, no ritmo que o appearance declara. */
function idleFrameOf(group, time) {
  const frames = group.frames ?? 1;
  const durations = group.animation?.durations;
  if (!durations?.length) return Math.floor(time / 200) % frames;

  const step = (index) => {
    const entry = durations[index % durations.length];
    const value = Array.isArray(entry) ? entry[0] : entry;
    return value > 0 ? value : 200;
  };

  let total = 0;
  for (let i = 0; i < frames; i++) total += step(i);
  let cursor = time % total;
  for (let i = 0; i < frames; i++) {
    cursor -= step(i);
    if (cursor < 0) return i;
  }
  return 0;
}

// ---------- efeitos e projéteis ----------

let effectMeta = {};
let missileMeta = {};

export async function loadEffectData() {
  const [effects, missiles] = await Promise.all([
    fetch('/gamedata/effect-sprites.json').then((r) => r.json()),
    fetch('/gamedata/missile-sprites.json').then((r) => r.json()),
  ]);
  effectMeta = effects;
  missileMeta = missiles;
}

export const effectInfo = (id) => effectMeta[id];
export const missileInfo = (id) => missileMeta[id];
/** Os ids de efeito e de projétil que existem (a Arena de Efeitos lista para escolher). */
export const idsDeEfeitos = () => Object.keys(effectMeta).map(Number).sort((a, b) => a - b);
export const idsDeProjeteis = () => Object.keys(missileMeta).map(Number).sort((a, b) => a - b);

/** Quanto tempo a animação inteira do efeito dura. */
export function effectDuration(id) {
  const meta = effectMeta[id];
  if (!meta) return 0;
  const frames = meta.s.length;
  if (!meta.d?.length) return frames * 75;
  return meta.d.reduce((sum, value) => sum + value, 0);
}

/*
 * ---- Qual quadro do efeito, pelo TEMPO de cada quadro ----
 *
 * "a animação do fatal não está correta igual da crystalserver, ela só aparece,
 * sem a animação."
 *
 * O quadro saía de `progress * quadros`: o tempo do efeito dividido em partes
 * IGUAIS. Só que cada quadro tem a duração dele no appearances, e o client
 * toca por ela. O FATAL é o caso em que a diferença salta aos olhos — são
 * quatro quadros de 50, 50, 50 e 1200ms: a palavra CRESCE de um pontinho até
 * "FATAL!" em 150ms, um estalo, e fica parada o resto do tempo. Dividido em
 * quatro partes iguais, cada quadro durava 337ms: os dois primeiros quadros
 * (quase invisíveis) ocupavam meio efeito, e a palavra simplesmente aparecia.
 *
 * Vale para todos os efeitos, e não só para ele: o anel do crítico (173) tem
 * cinco quadros de 20ms e depois quadros de 100 e 200, e também tocava no
 * compasso errado. A duração TOTAL não muda (`effectDuration` já somava os
 * tempos); muda só em que quadro cada instante cai.
 *
 * Sem tempos no manifesto, o efeito volta às partes iguais de sempre.
 */
export function quadroDoEfeito(meta, progress) {
  const frames = meta.s.length;
  const tempos = meta.d;
  if (!tempos?.length || tempos.length !== frames) {
    return Math.min(frames - 1, Math.max(0, Math.floor(progress * frames)));
  }
  const total = tempos.reduce((soma, v) => soma + v, 0);
  let resta = Math.max(0, progress) * total;
  for (let quadro = 0; quadro < frames; quadro++) {
    if (resta < tempos[quadro]) return quadro;
    resta -= tempos[quadro];
  }
  return frames - 1;
}

/**
 * Efeito mágico: a animação toca uma vez e some. `progress` vai de 0 a 1.
 * O sprite é ancorado no canto inferior direito do tile, como no client.
 */
export function drawEffect(ctx, id, x, y, progress) {
  const meta = effectMeta[id];
  if (!meta) return false;

  const view = meta.s[quadroDoEfeito(meta, progress)];
  const atlas = image(`/gamedata/sprites/effects/${meta.b}${view[0]}.png`);
  if (!atlas.ready) return false;

  /*
   * ---- A ancoragem e' a de sempre: canto de BAIXO-DIREITA do tile ----
   *
   * Era `x + 16 - w/2` — o sprite centrado no tile —, e isso e' a unica funcao
   * de desenho do arquivo que fazia diferente: `drawItem` e `drawCreature` usam
   * `x - (w - 32)`, que e' a regra do client (o canto de baixo-direita do sprite
   * encosta no canto de baixo-direita do tile).
   *
   * Para um efeito de 32x32 as duas contas dao no mesmo lugar, e por isso metade
   * deles sempre acertou. Nos outros — 99 dos 207 — a diferenca e' meia casa
   * para baixo e para a direita, sempre. Era o "algumas magias nunca acertam
   * exatamente o alvo".
   *
   * A conta antiga vinha da suposicao de que a arte estava centrada dentro da
   * celula de 64px. Nao esta. Medindo o centro de massa dos pixels opacos de
   * cada efeito, com a ancoragem do client:
   *
   *   40 HOLYDAMAGE  (32x64, o da divine missile) -> (16.3, 15.7) no tile
   *   10 HITAREA     (32x32)                      -> (15.5, 15.1)
   *    6 EXPLOSIONHIT(64x64)                      -> (16.4, 13.5)
   *
   * O centro do tile e' (16, 16): os tres caem em cima dele. O 40 nem sequer
   * desenha nada na metade de cima do proprio sprite (a arte vive nas linhas
   * 31..63), e o 6 mora todo no quadrante de baixo-direita — sao 32x32 guardados
   * num slot maior. Com a conta antiga esses dois saiam 16px abaixo e a direita
   * do bicho, que e' exatamente o desencontro que se via.
   *
   * O 50 HOLYAREA (64x64) preenche a celula inteira e fica com o centro em
   * (4.6, 4.8) — acima e a esquerda do meio do tile. Esse esta certo assim: e'
   * um efeito de area, feito para cobrir o tile MAIS os de cima e da esquerda,
   * como no jogo.
   */
  ctx.drawImage(
    atlas.image,
    view[1] + (meta.cell - meta.w), view[2] + (meta.cell - meta.h), meta.w, meta.h,
    x - (meta.w - 32), y - (meta.h - 32), meta.w, meta.h
  );
  return true;
}

/**
 * Projétil: o sprite tem uma grade de padrões com as direções do tiro
 * (3x3 no client). O sentido do voo escolhe a célula.
 */
export function drawMissile(ctx, id, x, y, dx, dy) {
  const meta = missileMeta[id];
  if (!meta) return false;

  const px = Math.min(meta.pw - 1, Math.max(0, Math.sign(dx) + 1));
  const py = Math.min(meta.ph - 1, Math.max(0, Math.sign(dy) + 1));
  const view = meta.s[py * meta.pw + px] ?? meta.s[0];
  const atlas = image(`/gamedata/sprites/missiles/${meta.b}${view[0]}.png`);
  if (!atlas.ready) return false;

  ctx.drawImage(
    atlas.image,
    view[1] + (meta.cell - meta.w), view[2] + (meta.cell - meta.h), meta.w, meta.h,
    Math.round(x - meta.w / 2), Math.round(y - meta.h / 2), meta.w, meta.h
  );
  return true;
}
