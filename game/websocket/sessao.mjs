// Uma sessão = uma conexão WebSocket. Antes do `hello`+login não há sessão de
// conta; depois do `play` ela também carrega um personagem.
//
// Contrato lido do cliente recuperado (ver `api-mapeada/protocolo.md`):
//   servidor -> cliente : hello | account | authError | welcome | state | released | error
//   cliente -> servidor : register | login | resume | logout | createCharacter |
//                         deleteCharacter | play | release | walk | virar | pedirMapa |
//                         diario | diarioEscolher | marco | presente |
//                         largar | destroy | pegar | mounts | outfit | mount |
//                         delta | jaTenhoCatalogo | oculta
import * as B from '../../game/database/banco.mjs';
import * as R from '../systems/regras.mjs';
import { CITY_MAP, CITY_META, ITEM_CATALOG, CATALOGO, CHARACTER_TEMPLATE, bloqueado, gradeDaCidade } from '../systems/dados.mjs';
import { proximoPassoAte, temCaminho } from '../systems/hunt/caminho.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Recompensas from '../systems/recompensas.mjs';
import * as Aparencia from '../systems/aparencia.mjs';
import * as Loja from '../systems/loja.mjs';
import * as HistoricoDaLoja from '../systems/historico-da-loja.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Bolsa from '../systems/bolsa.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Deposito from '../systems/deposito.mjs';
import * as Bau from '../systems/bau.mjs';
import * as Mercado from '../systems/mercado.mjs';
import * as Boosts from '../systems/boosts.mjs';
import * as Stamina from '../systems/stamina.mjs';
import * as Exercicio from '../systems/exercicio.mjs';
import * as Treinos from '../systems/treinos.mjs';
import * as Premium from '../systems/premium.mjs';
import * as BuffPower from '../systems/buffpower.mjs';
import * as Tiers from '../systems/tiers.mjs';
import * as Summon from '../systems/summon.mjs';
import * as Bosses from '../systems/bosses.mjs';
import * as Party from '../systems/party.mjs';
import * as ItensPoeJogo from '../systems/itens-poe/jogo.mjs';
import * as Quadro from './quadro.mjs';
import * as Gemas from '../systems/gemas.mjs';
import * as Charms from '../systems/charms.mjs';
import * as Proficiencia from '../systems/proficiencia.mjs';
import * as Imbuements from '../systems/imbuements.mjs';
import * as Morte from '../systems/morte.mjs';
import * as Promocao from '../systems/promocao.mjs';
import * as Tarefas from '../systems/tarefas.mjs';
import * as Entregas from '../systems/entregas.mjs';
import * as Amigos from '../systems/amigos.mjs';
import * as Ausentes from '../systems/ausentes.mjs';
import * as Chat from '../systems/chat.mjs';
import * as Novidades from '../systems/novidades.mjs';
import * as Ranking from '../systems/ranking.mjs';
import * as Guildas from '../systems/guildas.mjs';
import * as Arena from '../systems/arena.mjs';
import * as SimuladorTique from '../systems/simulador-tique.mjs';
import { descerDeLevel, tirarEventosDaParty, fichaDoBicho } from '../systems/hunt/combate.mjs';
import * as InstanciaDaHunt from '../systems/hunt/instancia.mjs';
import * as EstadoDosEncontros from '../systems/encontros/estado.mjs';
import * as TiposDosEncontros from '../systems/encontros/tipos.mjs';
import { registrarGrandes, jsonComGrandes } from './json.mjs';
import * as Forja from '../systems/forja.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Prey from '../systems/prey.mjs';
import * as Arvore from '../systems/arvore.mjs';
import * as Passivas from '../systems/passivas/arvore.mjs';
import * as ComandosDasPassivas from '../systems/passivas/comandos.mjs';
import * as FiltroDaConta from '../systems/filtro-da-conta.mjs';
import * as Troca from '../systems/troca.mjs';
import * as Combo from '../systems/combo.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Banqueiro from '../systems/banqueiro.mjs';
import * as Craft from '../systems/craft.mjs';
import * as Desmanche from '../systems/desmanche.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { VERSAO_DO_CLIENTE } from '../systems/versao-do-cliente.mjs';
import * as ItensDoJogo from '../systems/itens/item.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Comparar from '../systems/itens/comparar.mjs';
import * as Atributos from '../systems/personagem/atributos.mjs';
import * as Defesa from '../systems/personagem/defesa.mjs';
import * as Anuncios from '../systems/anuncios.mjs';
import * as Manutencao from '../systems/modo-de-manutencao.mjs';
import * as Presentes from '../systems/presentes.mjs';
import * as GemasDeSkill from '../systems/skills/gemas.mjs';
import * as RegrasDeUso from '../systems/skills/regras-de-uso.mjs';
import { readFileSync } from 'node:fs';
const TASK_TOKEN_REAL = JSON.parse(readFileSync(new URL('../gamedata/task-token-real.json', import.meta.url), 'utf8'));

Inventario.semearChao(CITY_META.chao);

/** Todas as sessões vivas, por nome de personagem — para quando o mapa tiver mais de um jogador. */
export const vivas = new Map();
/** Quem está entrando num personagem e esperando a simulação offline (por nome do personagem). */
const carregandoAgora = new Map();
/**
 * O personagem está no jogo — conectado, ou entrando (a simulação da volta
 * rodando)? A consolidação em segundo plano (`consolidacao-offline.mjs`) não
 * mexe em quem está: o estado dele é o da sessão, não o do banco.
 */
export const estaNoJogo = (nome) => !!vivas.get(nome)?.personagem || carregandoAgora.has(nome);
/** A fila global de transações (Fase 6) — ver `emTransacao`. */
let filaDeTransacoes = Promise.resolve();
Party.ligar(vivas);
ItensPoeJogo.ligar(vivas); // a engine local entrega peças do PoE a quem está online (só com ITENS_POE=1)
Amigos.ligar(vivas);
Chat.ligar(vivas);
Anuncios.ligar(vivas); // o drop Épico+ para o servidor inteiro
Ranking.ligar(vivas);
Guildas.ligar(vivas);
Arena.ligar(vivas);
Troca.ligar(vivas); // a troca entre jogadores (o outro lado é achado pelo nome)
const AUTOSAVE_MS = 30_000;
// Um "socket" que nunca está aberto: o char da conta trazido para o mundo sem aba (ver `contaChar`).
const SEM_ABA = { readyState: 3, bufferedAmount: 0, send() {} };
// O tempo para o char trazido sem aba entrar na party antes de o tique conferir se ele ainda tem motivo para ficar.
const SEM_ABA_CARENCIA_MS = 10_000;
// O que a ⚙ Config da troca de personagem pode mudar num char da conta.
const CONFIG_DE_OUTRO = {
  strategy: (e, m) => Cacadas.definirEstrategia(e, m),
  distance: (e, m) => Cacadas.definirDistancia(e, m),
  aoCompletarFase: (e, m) => Cacadas.definirAoCompletarFase(e, m),
  lure: (e, m) => Cacadas.definirLure(e, m),
  settings: (e, m) => Bolsa.definirSettings(e, m),
  huntAssist: (e, m) => Cacadas.definirAssistencia(e, m),
  modoDasMagias: (e, m) => Combo.definirModo(e, m),
  actions: (e, m) =>
    m.action === 'set' ? Acoes.definir(e, m) :
    m.action === 'key' ? Acoes.trocarTecla(e, m) :
    m.action === 'swap' ? Acoes.trocar(e, m) :
    { ok: false, erro: 'Ação de barra desconhecida.' },
};
/*
 * O personagem INTEIRO (~60 KB: inventário, bolsa, ficha, tarefas...) era
 * montado e comparado chave a chave em todo quadro — 4 vezes por segundo por
 * jogador, a maior conta do `mandarEstado` no teste de carga. Agora ele é
 * comparado uma vez a cada QUADROS_POR_PERSONAGEM quadros (1 s), ou na hora
 * depois de qualquer ação do jogador (`aplicar`); nos quadros do meio vão só
 * as barras que precisam ser imediatas (`CAMPOS_DE_TODO_QUADRO`).
 */
/** Campos do `character` que devolvem o MESMO objeto enquanto não mudam (ver `Entregas.paraCliente`). */
const CAMPOS_MEMORIZADOS = new Set(['entregas']);
const QUADROS_POR_PERSONAGEM = 4;
const INTERVALO_DO_PEDIDO_DE_MAPA = 2000;
/*
 * Comandos que mexem ao mesmo tempo no personagem (em memória) e em algo
 * gravado na hora no banco — oferta do mercado, baú da conta, baú e ouro da
 * guilda, transferência do banco, melhorias da conta. Rodam dentro de
 * `emTransacao`. `LEITURAS` são as ações desses comandos que só olham.
 */
// (`trade`: a troca entre jogadores grava os DOIS personagens na mesma transação — ver `Troca.comando`.)
const COMANDOS_DE_ECONOMIA = new Set(['market', 'coinMarket', 'bank', 'guilda', 'depot', 'store', 'trade']);
const COMANDOS_DE_CAIXA = new Set(['split', 'juntar', 'trocar', 'organizar']);
const LEITURAS = new Set(['offers', 'historico']);
const PASSAM_CARREGANDO = new Set(['release', 'logout', 'login', 'resume', 'register', 'delta', 'jaTenhoCatalogo', 'oculta']);
const CAMPOS_DE_TODO_QUADRO = ['hp', 'mana'];

// Catálogo, itens e mapa da cidade: fixos e enormes, viram texto uma vez só (ver `json.mjs`).
registrarGrandes(CATALOGO, ITEM_CATALOG, CITY_MAP);

const enviar = (ws, msg) => {
  if (ws.readyState !== 1) return;
  // O mapa de uma hunt também é fixo (o objeto guardado por `Cacadas`).
  if (msg.hunt?.map) registrarGrandes(msg.hunt.map);
  const grande = msg.t === 'hello' || msg.t === 'welcome' || msg.city?.map || msg.hunt?.map;
  ws.send(grande ? jsonComGrandes(msg) : JSON.stringify(msg));
};

/*
 * Mesma mensagem para várias sessões (chat Global/Mercado/Local) — quem chama
 * já sabe que não é `hello`/`welcome`/mapa (nunca é: chat não carrega nenhum
 * dos dois), então o texto pode virar UMA vez e ir pronto para cada um, em vez
 * de `JSON.stringify` repetido por destinatário (Fase 4.3 — 200 na praça
 * falando no Global eram 200 stringifies do mesmo objeto).
 */
const enviarPronto = (ws, texto) => {
  if (ws.readyState === 1) ws.send(texto);
};

const DOMINIO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cartaoDaConta(personagens) {
  return personagens.map((p) => {
    const e = JSON.parse(p.estado);
    return {
      name: p.nome,
      level: e.level,
      vocation: p.vocacao,
      // "Elite Knight · level 639" na lista, depois da promoção.
      vocationName: Promocao.nomeDaClasse({ ...e, vocation: e.vocation ?? p.vocacao }),
      outfit: e.outfit,
      // "Caçando offline em Troll Cave" na lista, como no original (a hunt
      // segue sozinha com a aba fechada — ver `Cacadas.simularAusencia`).
      fazendo: e.hunt
        ? { tipo: 'offline', onde: `Caçando offline em ${Cacadas.nomeDaHunt(e.hunt.huntId)}` }
        : Treinos.fazendo(e),
      lastSeen: p.visto_em ?? null,
    };
  });
}

function estadoInicialPersonagem(vocacao, sexo) {
  const look = R.LOOK_DA_VOCACAO[vocacao][sexo];
  const { maxHp, maxMana } = R.statsBase(vocacao, R.NIVEL_INICIAL);
  return {
    // As gemas iniciais da classe: entregues no primeiro login (`GemasDeSkill.darGemasIniciais`).
    gemasIniciais: true,
    level: R.NIVEL_INICIAL,
    // A exp REAL de um level 8 (o personagem de teste capturado nasceu com
    // 4200). Com 0 a barra ficava em 0% e o level não subia nunca.
    xp: R.expForLevel(R.NIVEL_INICIAL),
    vocation: vocacao,
    sex: sexo,
    outfit: { type: look, head: 78, body: 88, legs: 58, feet: 76, mount: 0, addons: 0 },
    hp: maxHp,
    maxHp,
    mana: maxMana,
    maxMana,
    // Ouro, capacidade e fôlego iniciais são os REAIS — capturados criando uma
    // conta de teste no servidor original (`api-mapeada/character-real-example.json`).
    gold: 500,
    bank: 0,
    coins: 0,
    stamina: 2520,
    maxStamina: 2520,
    equipment: Inventario.equipamentoInicial(vocacao),
    inventory: Inventario.inventarioInicial(vocacao),
    pos: { ...R.POSICAO_INICIAL },
    // Barra de ações: vazia (22 slots), teclas 1-9/0/-/= de fábrica (o mesmo
    // molde de `CHARACTER_TEMPLATE.hotkeys`), sem arranjo salvo. Ver `acoes.mjs`.
    actions: Array(Acoes.SLOTS).fill(null),
    hotkeys: [...CHARACTER_TEMPLATE.hotkeys],
    actionPresets: [],
    settings: { ...CHARACTER_TEMPLATE.settings },
    ...Recompensas.estadoInicial(),
    ...Loja.estadoInicial(),
  };
}

/*
 * O `city` que vai em `welcome`/`state`: a cidade real + a posição do próprio
 * jogador. `comMapa` só é `true` na primeira vez (welcome) e em resposta a um
 * `pedirMapa` — igual ao original: `applyState`, no cliente, guarda o mapa
 * recebido (`this.mapData`) e reusa enquanto o `mapId` não mudar
 * (`payload.map = payload.map ?? this.mapData`, em `map.mjs`). Mandar os 3,7MB
 * do mapa em TODO tique de 100ms seria 37MB/s por jogador conectado — o
 * `city.map` só viaja de novo se o mapa mudar (nunca muda aqui) ou se o
 * cliente perder o que já tinha e pedir de volta.
 */
function snapshotDaPraca(estado, comMapa, sessao = null) {
  return {
    mapId: 'city',
    z: estado.pos.z ?? R.POSICAO_INICIAL.z,
    ...(comMapa ? { map: CITY_MAP } : {}),
    player: { x: estado.pos.x, y: estado.pos.y, dir: estado.pos.dir ?? 2, moveMs: R.PASSO_MS },
    monsters: [],
    // Os outros jogadores na tela, como no original (até 25) — ver `Chat.jogadoresNaPraca`.
    ...(() => {
      const players = sessao ? Chat.jogadoresNaPraca(sessao) : [];
      return { players, brasoes: Chat.brasoesDaPraca(players) };
    })(),
    npcs: CITY_META.npcs,
    objetos: CITY_META.objetos,
    chao: Inventario.chaoParaCliente(),
  };
}

/*
 * Migração de posição antiga: personagens criados enquanto a praça ainda era
 * o placeholder 15×11 (ou qualquer posição salva que caia fora do andar
 * capturado, `z:7`, ou em água/bloqueio) voltam para o spawn real. Sem isto,
 * quem já tinha personagem quando o mapa real entrou aparecia boiando no meio
 * do oceano — a coordenada antiga (x:7,y:5) é literalmente mar na cidade de
 * verdade, que é 187×108 e não 15×11.
 */
function corrigirPosicaoAntiga(pos) {
  if (pos.z === R.POSICAO_INICIAL.z && !bloqueado(pos.x, pos.y)) return pos;
  return { ...R.POSICAO_INICIAL };
}

function characterParaCliente(personagem, estado) {
  return {
    // O molde primeiro: todo campo que este servidor ainda não calcula sai
    // dele, no formato real (skills todos em 10, wildcards:5, etc.) — ver o
    // comentário de `CHARACTER_TEMPLATE`, em `dados.mjs`. As chaves abaixo
    // SOBRESCREVEM as dele com o que é de fato deste personagem.
    ...CHARACTER_TEMPLATE,
    name: personagem.nome,
    vocation: estado.vocation,
    sex: estado.sex,
    level: estado.level,
    exp: estado.xp,
    outfit: estado.outfit,
    hp: estado.hp,
    mana: estado.mana,
    derived: {
      ...CHARACTER_TEMPLATE.derived,
      maxHp: estado.maxHp,
      maxMana: estado.maxMana,
      capacity: Afixos.capacidade(estado),
      speed: R.baseSpeed(estado.level),
      // Real (fórmula, não o valor fixo do molde): 48% no level 8 é a MESMA
      // conta, mas fixo ele ficaria errado no primeiro level up.
      expBonus: R.levelBonus(estado.level),
      // Armadura, defesa, dano, crítico, bloqueio, leech, proteção, alcance,
      // regeneração do equipamento e velocidade — do equipamento REAL.
      ...Ficha.combate(estado),
      // A promoção (o original: "Elite Knight", promoted, regen e hpRegen/manaRegen
      // já multiplicados) — o card do HUD, a ficha e o balão de regeneração leem daqui.
      ...Promocao.derivados(estado, Ficha.combate(estado).regenDaArvore),
      // A Coleção (outfits e montarias que ele tem) — a faixa da aba Aparência. Ver `Aparencia.colecao`.
      collection: Aparencia.colecao(estado),
      // Quantos sqm a arma alcança — o seletor "Distância" marca "máx N" acima disso.
      attackRange: Cacadas.alcanceDaArma(Cacadas.armaDoPersonagem(estado)),
      // Accuracy e Evasion viram chance contra um bicho do MESMO level (a ficha mostra o que elas valem).
      chancesNoLevel: {
        acerto: Atributos.chanceDeAcerto(Ficha.combate(estado).accuracy, estado.level ?? 1),
        esquiva: Atributos.chanceDeEsquiva(Ficha.combate(estado).evasion, estado.level ?? 1),
      },
    },
    // O Energy Shield ATUAL (o máximo é `derived.energyShield`).
    es: Defesa.esAtual(estado, Ficha.combate(estado)),
    marca: null,
    gold: estado.gold ?? 0,
    bank: estado.bank ?? 0,
    coins: estado.coins ?? 0,
    // O bestiary (mortes por criatura) e os pontos de charm — ver `game/systems/charms.mjs`.
    ...Charms.paraCliente(estado),
    // A proficiência da arma na mão (null sem arma com proficiência) — ver `game/systems/proficiencia.mjs`.
    proficiency: Proficiencia.vistaDaMao(estado),
    // Os imbuements vestidos e os encaixes de cada peça — ver `game/systems/imbuements.mjs`.
    ...Imbuements.paraCliente(estado),
    // A promoção de verdade (o molde trazia a do personagem capturado) — ver `game/systems/promocao.mjs`.
    promotion: Promocao.paraCliente(estado),
    // As entregas de outfit/montaria e as tasks de montaria — de cada personagem
    // (o molde trazia as do capturado para todo mundo). Ver `entregas.mjs`/`tarefas.mjs`.
    entregas: Entregas.paraCliente(estado),
    mountTasks: Tarefas.mountTasks(estado),
    // O alerta do botão da Árvore (ponto parado) e o balão dele (o que ela dá).
    // Voltas completas no percurso de cada hunt ("Você já completou este percurso Nx").
    huntLaps: estado.huntLaps ?? {},
    arvorePontos: Arvore.pontos(estado),
    arvoreBonus: Arvore.bonus(estado),
    // A árvore de passivas única: os pontos (o alerta do botão) e o que está alocado.
    passivas: Passivas.vista(estado, !!estado.hunt),
    // Stamina de verdade: gasta caçando, volta na cidade (ver game/systems/stamina.mjs).
    ...Stamina.paraCliente(estado),
    ...Exercicio.paraCliente(estado),
    treinoStamina: Treinos.tanqueParaCliente(estado),
    training: estado.training ?? null,
    weight: Inventario.pesoDoInventario(estado),
    deposito: [...Deposito.garantir(estado), ...(estado.bauDaConta ? [estado.bauDaConta] : [])],
    ...Bau.paraCliente(estado),
    storeInbox: estado.storeInbox ?? [],
    storeInboxSlots: Loja.VAGAS_DA_INBOX,
    bossCooldownsAte: { ...CHARACTER_TEMPLATE.bossCooldownsAte, ...(estado.bossCooldownsAte ?? {}) },
    progress: R.progressoDoLevel(estado.level, estado.xp),
    ...Treino.paraCliente(estado),
    totals: { ...Ficha.totais(estado), time: Math.floor(Ficha.totais(estado).time) },
    ...Bolsa.paraCliente(estado, Cacadas.faltaParaVender(estado)),
    equipment: estado.equipment ?? {},
    inventory: estado.inventory ?? [],
    // Estes três são MUTÁVEIS por personagem (ver `estadoInicialPersonagem`) —
    // por isso vêm de `estado`, e não ficam para trás no molde compartilhado.
    // `?? CHARACTER_TEMPLATE.X`: personagens salvos ANTES deste sistema
    // existir (o Zoros, entre outros — ver a conversa) não têm estas chaves
    // no `estado` gravado; sem o fallback, `diarioParaCliente` quebraria em
    // `estado.diario.ultimoColetadoEm` de um `diario` que é `undefined`.
    wildcards: estado.wildcards ?? CHARACTER_TEMPLATE.wildcards,
    presentes: Recompensas.presentesParaCliente(estado),
    // Idem: a barra de ações é mutável por personagem (ver `acoes.mjs`) e
    // ficava para trás no molde — todo personagem via sempre os 22 slots
    // vazios do `character-template.json`, nunca o que de fato configurou.
    actions: estado.actions ?? CHARACTER_TEMPLATE.actions,
    // As regras de uso automático por tag (etapa 5): a tela lista e edita.
    regrasDeUso: estado.regrasDeUso ?? [],
    hotkeys: estado.hotkeys ?? CHARACTER_TEMPLATE.hotkeys,
    actionPresets: estado.actionPresets ?? [],
    settings: { ...CHARACTER_TEMPLATE.settings, ...(estado.settings ?? {}) },
    diario: Recompensas.diarioParaCliente(estado.diario ?? CHARACTER_TEMPLATE.diario),
    // Mesma razão das três de cima: mutáveis por personagem, vêm da Store.
    preyThirdSlot: estado.preyThirdSlot ?? false,
    // Os três slots de prey e o preço da lista nova (200 x level) — ver `game/systems/prey.mjs`.
    ...Prey.paraCliente(estado),
    blessings: estado.blessings ?? [],
    ...Premium.paraCliente(estado), // premiumAte + os acessos `instance`/`divina`
    ...Tiers.paraCliente(estado), // tiers, tierMax, proximoTier
    summon: Summon.paraCliente(estado),
    // Auto Boss e Boss Tasks são do personagem (ver `game/systems/bosses.mjs`); o
    // molde trazia o progresso do personagem capturado para todo mundo.
    autoBoss: Bosses.autoParaCliente(estado),
    bossTasks: Bosses.tasks(estado),
    autoTask: estado.autoTask ?? { passe: false, passeAte: 0 },
    efeitos: {
      ...CHARACTER_TEMPLATE.efeitos,
      // Os boosts de exp ligados (XP Boost da loja, Exp Potions) — a janelinha
      // com o relógio no alto e a linha na ficha. Ver `game/systems/boosts.mjs`.
      exp: Boosts.paraCliente(estado),
      // O Scroll Speed Exercise guardado: com saldo, a faixa do treino mostra
      // "Scroll Speed x2" com o tempo em vez da oferta (hud.mjs, `efeitos.exerciseSpeed`).
      exerciseSpeed: (estado.scrollExercise ?? 0) > 0 ? { fator: 2, restante: estado.scrollExercise } : null,
      // Os três Buff Power com o relógio de cada um (ver `game/systems/buffpower.mjs`).
      buffPower: BuffPower.paraCliente(estado),
    },
  };
}

export class Sessao {
  constructor(ws) {
    this.ws = ws;
    this.conta = null;
    this.personagem = null; // linha do banco
    this.estado = null; // estado quente (JSON já parseado)
    // 100ms: rápido o bastante para o passo (R.PASSO_MS) parecer contínuo, sem
    // mandar `state` mais rápido do que o jogo original (~4x/s).
    /*
     * O tick do original é 250ms (4 por segundo — `R.TICKS_POR_SEGUNDO`; é o
     * tick que faz `duracaoDoPasso` dar os 250ms reais do jogador level 8).
     * Aqui era 100ms: 10 `state` por segundo, e o client redesenha HUD, barra,
     * janelas e mapa a cada um — o FPS caía. Todo ritmo do jogo já é múltiplo
     * de 250ms (passo, troll 750, golpe 2000, poção 1000).
     */
    sessoesNoRelogio.add(this);
  }

  enviar(msg) {
    enviar(this.ws, msg);
  }

  /** Um texto já serializado (ver `enviarPronto`) — para broadcast, não mensagem individual. */
  enviarPronto(texto) {
    enviarPronto(this.ws, texto);
  }

  erroDeAuth(mensagem) {
    this.enviar({ t: 'authError', message: mensagem });
  }

  /** Erro de AÇÃO de jogo (fora do portão) — vira um aviso de 3s na tela, não a caixa de login. */
  erro(mensagem) {
    this.enviar({ t: 'error', message: mensagem });
  }

  /**
   * Roda uma função de `game/systems/*` (que devolve `{ok, erro}` e nunca fala
   * com a rede) e traduz o resultado: erro vira aviso na tela, sucesso vira
   * `state` atualizado. Toda ação de jogo que só muda `estado` passa por
   * aqui — é o único lugar que sabe que `erro`/`mandarEstado` existem.
   */
  /**
   * Operação que pode ser numa caixa do depósito (`from: 'depot:<n>'`): se for
   * no Baú da Conta, relê do banco antes e grava depois (ele é da conta).
   */
  async naCaixa(m, operacao) {
    const daConta = String(m.from ?? '') === `depot:${Deposito.INDICE_DA_CONTA}`;
    if (daConta) this.estado.bauDaConta = Deposito.caixaDaConta(await B.lerBauDaConta(this.conta.id));
    const r = operacao();
    if (daConta && r.ok) await B.gravarBauDaConta(this.conta.id, this.estado.bauDaConta);
    for (const c of [...(this.estado.deposito ?? []), this.estado.bauDaConta]) if (c) c.tipos = c.itens.length;
    return this.aplicar(r);
  }

  /** `send({t:'depot', ...})` — o Baú da Conta é da CONTA: lido do banco agora (outro personagem da conta pode ter mexido) e gravado de volta na hora. */
  async despacharDepot(m) {
    const daConta = Deposito.caixaDaConta(await B.lerBauDaConta(this.conta.id));
    const r = Deposito.comando(this.estado, m, daConta);
    if (r.ok) await B.gravarBauDaConta(this.conta.id, daConta);
    this.estado.bauDaConta = daConta;
    this.aplicar(r);
    /*
     * O nome da caixa não entra na assinatura que faz a janela aberta se
     * redesenhar (`renderAll`, main.mjs: só os ITENS das caixas) — o nome
     * mudava no servidor e a tela ficava com o antigo. Uma mensagem que o
     * client trata com `panelCtx.redraw()` força o redesenho, DEPOIS do
     * state com o nome novo. É a `taskToken`, com a loja real dela, para
     * não estragar o que ela guarda.
     */
    if (r.renomeou) this.enviar({ t: 'taskToken', loja: TASK_TOKEN_REAL.loja });
  }

  /** `send({t:'training', action, mode, itemId})` — por enquanto o Exercise (ver game/systems/exercicio.mjs). */
  /**
   * `send({t:'arvore', action?})` — como o original: erro vira `{t:'error'}`;
   * todo o resto responde com a vista inteira (`{t:'arvore', view, emCacada}`),
   * e o `state` segue junto porque o ouro e os pontos podem ter mudado.
   */
  despacharArvore(m) {
    const r = Arvore.comando(this.estado, m, !!this.estado.hunt);
    if (!r.ok) return this.erro(r.erro);
    Arvore.recalcularVida(this.estado);
    // A árvore enche os vessels: a vida/mana das gemas acesas pode ter mudado.
    Gemas.sincronizarMaximos(this.estado);
    this.enviar({ t: 'arvore', view: Arvore.vista(this.estado), emCacada: !!this.estado.hunt });
    if (m.action) this.mandarEstado();
  }

  /**
   * `send({t:'passivas', action?, id?, ids?, tudo?, junto?})` — a árvore de
   * passivas única (`systems/passivas/`). Erro vira `{t:'error'}`; o resto
   * responde `{t:'passivas', view, plano?, arvore?}` — `arvore` (os nós, grande)
   * só quando pedida (`action:'arvore'`) — e o `state` segue quando algo mudou.
   */
  despacharPassivas(m) {
    const emCacada = !!this.estado.hunt;
    const r = ComandosDasPassivas.comando(this.estado, m, emCacada);
    if (!r.ok) return this.erro(r.erro);
    this.enviar({
      t: 'passivas',
      view: Passivas.vista(this.estado, emCacada),
      ...(r.plano ? { plano: r.plano } : {}),
      ...(m.action === 'arvore' ? { arvore: Passivas.arvoreParaCliente() } : {}),
      ...(r.aviso ? { aviso: r.aviso } : {}),
    });
    if (r.mudou) this.mandarEstado();
  }

  /**
   * O filtro de loot e a caixinha "Toda a conta" (`systems/filtro-da-conta.mjs`):
   * ligar publica o filtro deste char na conta e põe nos outros chars online;
   * com ela ligada, cada mudança no filtro vale para todos; desligar deixa cada
   * um com a sua cópia.
   */
  async despacharFiltro(m, resultado) {
    this.aplicar(resultado);
    if (!resultado.ok || !this.conta?.id) return;
    const ligou = m.t === 'lootFiltro' && m.paraTodos === true;
    const desligou = m.t === 'lootFiltro' && m.paraTodos === false;
    if (!ligou && !desligou && !(this.estado.lootFiltro?.paraTodos && FiltroDaConta.mudaOFiltro(m))) return;
    const dados = await B.lerMelhoriasDaConta(this.conta.id);
    const filtro = FiltroDaConta.copia(this.estado);
    dados.filtroDeLoot = desligou ? { ...(dados.filtroDeLoot ?? {}), ativo: false } : { ativo: true, ...filtro };
    await B.gravarMelhoriasDaConta(this.conta.id, dados);
    for (const o of vivas.values()) {
      if (o === this || o.conta?.id !== this.conta.id || !o.estado) continue;
      if (desligou) o.estado.lootFiltro = { ...(o.estado.lootFiltro ?? {}), paraTodos: false };
      else FiltroDaConta.aplicar(o.estado, filtro);
      o.characterSujo = true;
      try {
        o.mandarEstado();
      } catch {
        /* sessão sem aba (char trazido para a party) */
      }
    }
  }

  /** `send({t:'gemas', action?})` — o Gem Atelier: responde com a vista inteira, como a árvore. */
  despacharProficiencia(m) {
    const r = Proficiencia.comando(this.estado, m);
    if (!r.ok) return this.erro(r.erro);
    this.enviar({ t: 'proficiency', view: r.view, ...(r.list ? { list: r.list } : {}) });
    if (m.action) this.aplicar(r);
  }

  despacharCharms(m) {
    const r = Charms.comando(this.estado, m);
    if (!r.ok) return this.erro(r.erro);
    this.enviar({ t: 'charms', view: Charms.vista(this.estado) });
    if (m.action) this.aplicar(r);
  }

  despacharGemas(m) {
    const r = Gemas.comando(this.estado, m);
    if (!r.ok) return this.erro(r.erro);
    this.enviar({ t: 'gemas', view: Gemas.vista(this.estado) });
    if (m.action) this.aplicar(r);
  }

  async despacharTreino(m) {
    if (m.action === 'stop') {
      // O pátio (treino online) e o Exercise têm cada um o seu fim; "Você não
      // está treinando." só quando NENHUM dos dois está ligado.
      const r = this.estado.hunt?.huntId === 'treino' ? Cacadas.sairDoPatio(this.estado) : Exercicio.parar(this.estado);
      if (r.relatorio) this.enviar(r.relatorio);
      if (!r.ok) return this.aplicar(r);
      this.estado.rumo = null;
      this.characterSujo = true;
      // A posição nova (a da cidade) vai para o banco agora, e o cliente recebe
      // o quadro INTEIRO — com o mapa da cidade, se ele voltou do pátio.
      if (r.notice) this.avisoPendente = r.notice;
      this.mandarEstado(true);
      return this.gravarAgora().catch((e) => console.error('gravar ao parar o treino', e.message));
    }
    if ((m.action === 'start' && m.mode === 'exercise') || (m.action === 'start' && m.mode === 'online')) {
      if (m.mode === 'online' && this.estado.exercicio?.treinando) {
        const r = Exercicio.parar(this.estado);
        if (r.relatorio) this.enviar(r.relatorio);
      }
      // O servidor põe o personagem no posto (1 SQM do boneco), grava a posição
      // e só então o treino começa a valer — com o movimento já bloqueado.
      const r = m.mode === 'exercise' ? Exercicio.comecar(this.estado, m) : Cacadas.entrarNoPatio(this.estado);
      if (!r.ok) return this.aplicar(r);
      this.estado.rumo = null;
      this.aplicar(r);
      return this.gravarAgora().catch((e) => console.error('gravar ao começar o treino', e.message));
    }
    if (m.action === 'start' && m.mode === 'offline') {
      // "Ao confirmar, você sai deste personagem e volta para a lista."
      const r = Treinos.comecarOffline(this.estado, m);
      if (!r.ok) return this.erro(r.erro);
      this.soltarPersonagem();
      return this.enviar({ t: 'released', notice: 'Treino offline começou — o personagem treina enquanto você está fora.' });
    }
    return this.erro('Modo de treino desconhecido.');
  }

  /** O estado de outro personagem que esteja no jogo agora (para o mercado creditar na hora). */
  estadoAoVivo(personagemId) {
    for (const s of vivas.values()) {
      if (s.personagem?.id === personagemId && s.estado) {
        setTimeout(() => s.mandarEstado(), 0);
        // Numa transação (`emTransacao`), o outro também é gravado antes do COMMIT.
        this.tocadas?.add(s);
        return s.estado;
      }
    }
    return null;
  }

  /**
   * O outro lado de uma transferência do banco: o `estado` vivo se ele estiver
   * no jogo (a sessão dele grava sozinha), senão o gravado — que é regravado
   * aqui mesmo, sem mexer no "visto por último" dele.
   */
  async destinoDaTransferencia(nome) {
    const linha = await B.personagemPorNome(nome);
    if (!linha) return null;
    const vivo = this.estadoAoVivo(linha.id);
    if (vivo) return { id: linha.id, nome: linha.nome, estado: vivo, gravar: () => {} };
    const estado = JSON.parse(linha.estado);
    return { id: linha.id, nome: linha.nome, estado, gravar: () => B.regravarEstadoPersonagem(linha.id, estado) };
  }

  /** `send({t:'party', action, ...})` — `comandoDaCaca` pode ter que tirar o anfitrião de um worker de simulação (Fase 5) antes de juntar a sala. */
  async despacharParty(m) {
    return this.aplicar(await Party.comandoDaCaca(this, m));
  }

  /** `send({t:'bank', action, ...})` — depósito/saque são síncronos; transferência lê o destinatário do banco. */
  async despacharBank(m) {
    return this.aplicar(await Banqueiro.comando(this.estado, m, this.personagem, (nome) => this.destinoDaTransferencia(nome)));
  }

  /** `send({t:'arena', action?, ...})` — sem `action`, só o lobby; com ela, o comando (a vista nova vai para quem foi tocado). */
  async despacharArena(m) {
    if (!m.action) return this.enviar(await Arena.vista(this));
    const erro = await Arena.comando(this, m);
    if (erro) this.enviar(await Arena.vista(this, erro));
    return this.aplicar({ ok: true });
  }

  /** `send({t:'guilda', action?, ...})` — sem `action`, só a vista; com ela, o comando e a vista atualizada. */
  async despacharGuilda(m) {
    if (!m.action) return this.enviar(await Guildas.vista(this.personagem.nome));
    const r = await Guildas.comando(this, m);
    this.enviar(await Guildas.vista(this.personagem.nome, r.ok ? null : r.erro));
    return this.aplicar(r.ok ? r : { ok: true });
  }

  /**
   * `falarComNpc` — o clique direito no NPC da praça. O Banker responde como o
   * original (`npcFala` com `tipo:'banco'`, capturado em
   * `api-mapeada/servidor/npc-naji.json`), e o client abre o banco.
   */
  falarComNpc({ id }) {
    const npc = CITY_META.npcs.find((n) => n.id === id);
    if (!npc) return this.erro('Ninguém para conversar aqui.');
    // A Zuma Magehide vende as GEMAS DE SKILL (decisão do dono) — o balcão de NPC do cliente.
    if (npc.id === GemasDeSkill.CONFIG.loja.npc) return this.mandarLojaDeGemas(npc);
    if (npc.tipo !== 'banco') return this.erro(`${npc.name} ainda não atende neste servidor.`);
    this.enviar({ t: 'npcFala', id: npc.id, nome: npc.name, tipo: 'banco', fala: Banqueiro.FALA_DO_BANQUEIRO, catalogo: null, gold: this.estado.gold ?? 0 });
  }

  /** A loja de gemas (`npcFala`, `tipo: 'loja'`), no formato do balcão de NPC do cliente. */
  mandarLojaDeGemas(npc = CITY_META.npcs.find((n) => n.id === GemasDeSkill.CONFIG.loja.npc)) {
    this.enviar({
      t: 'npcFala',
      id: npc.id,
      nome: npc.name,
      tipo: 'loja',
      fala: 'Gemas de skill: a skill é da gema encaixada num socket do que você veste. Supports ligadas a ela a fortalecem.',
      catalogo: GemasDeSkill.catalogoDaLoja(this.estado),
      gold: (this.estado.gold ?? 0) + (this.estado.bank ?? 0),
    });
  }

  /** `send({t:'npcComprar', id, count})` — comprar no balcão do NPC (a Zuma: gemas). */
  comprarNoNpc(m) {
    // O mesmo pedido (o `pedido` que a tela gera a cada clique) chegando de novo — duplo clique, reenvio da
    // rede — não compra duas vezes. Só se lembra dos últimos 50; pedido sem id (cliente antigo) passa como antes.
    if (m.pedido != null) {
      this.pedidosDeCompra ??= new Set();
      if (this.pedidosDeCompra.has(String(m.pedido))) return this.erro('Esse pedido já foi processado.');
      this.pedidosDeCompra.add(String(m.pedido));
      if (this.pedidosDeCompra.size > 50) this.pedidosDeCompra.delete(this.pedidosDeCompra.values().next().value);
    }
    const r = GemasDeSkill.comprarNaLoja(this.estado, m);
    this.aplicar(r);
    if (r.ok) this.mandarLojaDeGemas();
  }

  /** `send({t:'market', action?})` — o balcão de itens (ver `game/systems/mercado.mjs`). */
  async despacharMercado(m) {
    const p = this.personagem;
    if (!p) return;
    const aoVivo = (id) => this.estadoAoVivo(id);
    if (m.action === 'historico') return this.enviar({ t: 'marketHistorico', dados: await Mercado.extrato(p.id) });
    if (m.action === 'offers') return this.enviar({ t: 'marketOffers', dados: await Mercado.ofertas(p.id, m.filtros) });
    let r = null;
    if (m.action === 'offer') r = await Mercado.anunciar(this.estado, p, m);
    else if (m.action === 'accept') r = await Mercado.aceitar(this.estado, p, m, aoVivo);
    else if (m.action === 'cancel') r = await Mercado.cancelar(this.estado, p, m);
    if (r && !r.ok) return this.erro(r.erro);
    // Anúncio novo: sai também na aba Mercado do chat (ver Chat.anunciarOferta).
    if (m.action === 'offer' && r.anuncio) Chat.anunciarOferta(this, r.anuncio);
    this.enviar({ t: 'market', market: await Mercado.balcao(this.estado, p.id), ...(r?.notice ? { notice: r.notice } : {}) });
    if (r) {
      this.enviar({ t: 'marketOffers', dados: await Mercado.ofertas(p.id, m.filtros ?? { kind: m.kind, moeda: m.moeda }) });
      this.aplicar({ ok: true });
    }
  }

  /** `send({t:'coinMarket', action?, pagina})` — o balcão de Draevor Coins. */
  async despacharCoins(m) {
    const p = this.personagem;
    if (!p) return;
    const aoVivo = (id) => this.estadoAoVivo(id);
    let r = null;
    if (m.action === 'order') r = await Mercado.ordemDeCoins(this.estado, p, m);
    else if (m.action === 'accept') r = await Mercado.aceitarCoins(this.estado, p, m, aoVivo);
    else if (m.action === 'cancel') r = await Mercado.cancelarCoins(this.estado, p, m);
    if (r && !r.ok) return this.erro(r.erro);
    this.enviar({ t: 'coinMarket', dados: await Mercado.balcaoDeCoins(this.estado, p.id, m.pagina), ...(r?.notice ? { notice: r.notice } : {}) });
    if (r) this.aplicar({ ok: true });
  }

  /** Um comando que não muda nada visível na hora: só o erro volta (o passo aparece no próximo quadro). */
  aplicarSoErro(resultado) {
    if (resultado && !resultado.ok) return this.erro(resultado.erro);
  }

  aplicar(resultado) {
    if (!resultado.ok) return this.erro(resultado.erro);
    if (resultado.notice) this.avisoPendente = resultado.notice;
    // O peso NUNCA passa da capacidade: qualquer ação que tenha trazido item
    // demais (compra, presente de level, ...) manda o excesso para o depósito.
    const excesso = Deposito.avisoDoExcesso(Deposito.excessoParaODeposito(this.estado));
    if (excesso) this.avisoPendente = excesso;
    this.characterSujo = true;
    this.mandarEstado();
  }

  /**
   * `aplicar` + o catálogo de ações de novo: vestir/tirar peça e encaixar/tirar
   * gema mudam as skills disponíveis (a Action Bar só mostra as gemas encaixadas).
   */
  aplicarComSkills(resultado) {
    // A barra segue as gemas encaixadas: tira a skill que perdeu a gema, põe a nova (antes do estado ir).
    if (resultado?.ok) Acoes.sincronizarBarraComGemas(this.estado);
    this.aplicar(resultado);
    if (resultado?.ok) {
      Ficha.invalidar(this.estado);
      this.enviar({ t: 'actionCatalog', catalog: Acoes.catalogo(this.estado) });
    }
  }

  /** `send({t:'mounts'})` — consulta pura, não muda `estado`: manda direto, sem passar por `aplicar`. */
  mandarMontarias() {
    const { outfits, mounts } = Aparencia.montariasEOutfits(this.estado);
    this.enviar({ t: 'mounts', outfits, mounts });
  }

  /**
   * `send({t:'store'})` (só olhar) ou `send({t:'store', action:'buy', id})`
   * (comprar). Não há um `ok` separado para a compra — a confirmação É a
   * prateleira voltando atualizada (coins descontado, `owned`/`ativoAte`
   * novos). Erro de compra (sem saldo, produto que não existe) vira aviso
   * pelo canal de sempre, e a prateleira volta do mesmo jeito que estava.
   */
  async despacharLoja(m) {
    const coinsAntes = this.estado.coins ?? 0;
    if (m.action === 'buy' && m.id === 'cofre-vagas') {
      // Vagas do Baú da Conta: a caixa é da conta, gravada na tabela própria.
      const daConta = Deposito.caixaDaConta(await B.lerBauDaConta(this.conta.id));
      const r = Deposito.comprarVagas(this.estado, daConta);
      if (r.ok) await B.gravarBauDaConta(this.conta.id, daConta);
      if (r.ok) await this.anotarCompraNaLoja(m.id, coinsAntes);
      this.estado.bauDaConta = daConta;
      this.aplicar(r.ok ? { ...r, notice: `Caixa compartilhada: ${daConta.teto} vagas.` } : r);
      // A prateleira volta com o "Agora X → Y" novo.
      return this.enviar({ t: 'store', store: Loja.catalogoDaLoja(this.estado, await B.lerMelhoriasDaConta(this.conta.id)) });
    }
    // As melhorias da CONTA (slot de party) vêm do banco a cada vez: outro
    // personagem da conta pode ter comprado.
    const daConta = await B.lerMelhoriasDaConta(this.conta.id);
    if (m.action === 'buy') {
      const resultado = Loja.comprar(this.estado, m, daConta);
      if (!resultado.ok) return this.erro(resultado.erro);
      if (resultado.conta) await B.gravarMelhoriasDaConta(this.conta.id, daConta);
      await this.anotarCompraNaLoja(m.id, coinsAntes);
      if (resultado.notice) this.avisoPendente = resultado.notice;
      this.mandarEstado();
    }
    this.enviar({ t: 'store', store: Loja.catalogoDaLoja(this.estado, daConta) });
  }

  /**
   * A compra vai para o Histórico da loja (`historico-da-loja.mjs`) com o que
   * de fato saiu do saldo — a diferença das coins, e não o preço de tabela.
   * Roda dentro da transação da compra (`store` com `action` é comando de
   * economia): se a gravação falhar, a compra inteira volta (ROLLBACK).
   */
  async anotarCompraNaLoja(id, coinsAntes) {
    const coins = coinsAntes - (this.estado.coins ?? 0);
    if (!(coins > 0)) return;
    await HistoricoDaLoja.registrarCompra({
      conta: this.conta.id,
      personagem: this.personagem.id,
      nome: this.personagem.nome,
      produto: String(id),
      ...Loja.descricaoDaCompra(String(id)),
      coins,
    });
  }

  /**
   * `send({t:'historicoDaLoja'})` → `{t:'historicoDaLoja', linhas}` — as últimas
   * compras da conta, a mais recente primeiro. Se o banco falhar, a resposta
   * vai assim mesmo, com `erro`: a janela não pode ficar presa em "Carregando".
   */
  async mandarHistoricoDaLoja() {
    if (!this.conta || !this.personagem) return;
    try {
      this.enviar({ t: 'historicoDaLoja', linhas: await HistoricoDaLoja.ultimas(this.conta.id) });
    } catch (e) {
      console.error('historicoDaLoja ->', e.message);
      this.enviar({ t: 'historicoDaLoja', linhas: [], erro: 'Não deu para carregar o histórico agora. Tente de novo em instantes.' });
    }
  }

  /**
   * `send({t:'entrarNaArena'})` — pisou na placa "Boss Diarios" da praça
   * (`city-meta.json`, `acao:'boss-diarios'`). O sistema de boss É o de hunt
   * (mesmo `Cacadas.entrar`, mesma sala/cooldown/level) — só decide QUAL boss
   * pela escala do dia (`Bosses.bossDeHoje`) em vez de deixar a pessoa escolher.
   */
  entrarNaArena() {
    if (this.estado.exercicio?.treinando) {
      const r = Exercicio.parar(this.estado);
      if (r.relatorio) this.enviar(r.relatorio);
    }
    const hoje = Bosses.bossDeHoje();
    if (!hoje.boss) {
      return this.erro(`Hoje (${hoje.dia}) é dia de ${hoje.nome} na área de Boss Diários, mas esse boss ainda não foi capturado do original.`);
    }
    Party.antesDeSairDaCacada(this);
    return this.aplicar(Cacadas.entrar(this.estado, { huntId: hoje.boss.id, mode: 'online', strategy: this.estado.settings?.strategy }));
  }

  /**
   * `send({t:'actions'})` (só olhar o catálogo) ou `{action:'set'|'key'|'swap',
   * ...}` (mudar um slot). Mesmo padrão do `despacharLoja`: sem catálogo
   * separado, a resposta ao `set`/`key`/`swap` já É o `state` com a barra nova.
   */
  despacharAcoes(m) {
    // Resposta ao pedido de catálogo é `actionCatalog` (com `catalog` dentro),
    // não `actions` — é o que `setActionCatalog(message.catalog)` já espera
    // no client (`main.mjs`); mandar `actions` de volta deixava `catalog`
    // sempre `undefined` e a tela travada em "carregando...".
    if (!m.action) return this.enviar({ t: 'actionCatalog', catalog: Acoes.catalogo(this.estado) });
    const resultado =
      m.action === 'set' ? Acoes.definir(this.estado, m) :
      m.action === 'key' ? Acoes.trocarTecla(this.estado, m) :
      m.action === 'swap' ? Acoes.trocar(this.estado, m) :
      { ok: false, erro: 'Ação de barra desconhecida.' };
    return this.aplicar(resultado);
  }

  /** `send({t:'actionPreset', action:'save'|'apply'|'delete', name})`. */
  despacharPreset(m) {
    const resultado =
      m.action === 'save' ? Acoes.salvarPreset(this.estado, m) :
      m.action === 'apply' ? Acoes.aplicarPreset(this.estado, m) :
      m.action === 'delete' ? Acoes.apagarPreset(this.estado, m) :
      { ok: false, erro: 'Arranjo desconhecido.' };
    return this.aplicar(resultado);
  }

  /**
   * `send({t:'huntAction', slot, x?, y?})` — clique ou tecla, fora da barra
   * automática. Tem eventos (dano/cura/fx) igual ao `tique`, por isso não
   * passa por `aplicar` (que só manda `state`, sem eventos).
   */
  dispararAcaoManual({ slot, x, y }) {
    // `x, y`: a casa da mira (o cliente manda quando a runa/magia de área foi armada e o jogador clicou no chão).
    const resultado = Cacadas.disparoManual(this.estado, this.personagem, slot, { x, y });
    if (!resultado.ok) return this.erro(resultado.erro);
    // Ação do jogador, como em `aplicar`: o personagem vai inteiro já neste
    // quadro — senão a cura aparecia na hora e a poção só saía da mochila da
    // tela no quadro inteiro seguinte, até 1 s depois.
    this.characterSujo = true;
    this.mandarEstado(false, resultado.eventos);
  }

  // ------------------------------------------------------------- handshake

  ola() {
    // A versão do jogo já na conexão: depois de um deploy, a aba aberta se reconecta
    // e fica sabendo aqui, antes de escolher personagem (ver `versao-do-cliente.mjs`).
    this.enviar({ t: 'hello', catalog: CATALOGO, versao: VERSAO_DO_CLIENTE });
  }

  // -------------------------------------------------------------- receber

  receber(m) {
    try {
      // Login, cadastro e exclusão esperam o scrypt (assíncrono): o erro deles
      // chega pela promessa, não pelo `catch` daqui. `return r`: quem chama
      // (o `ws.on('message', ...)` de verdade nunca espera; os testes, que
      // precisam saber quando um comando assíncrono terminou, podem `await`.
      const r = this.precisaDeTransacao(m) ? this.emTransacao(() => this.despachar(m)) : this.despachar(m);
      if (r && typeof r.catch === 'function') r.catch((e) => console.error('sessao', m?.t, '->', e.message));
      return r;
    } catch (e) {
      console.error('sessao', m?.t, '->', e.message);
    }
  }

  /*
   * ---- Economia: as duas pontas gravadas juntas ----
   *
   * O personagem vivo só ia para o banco no autosave (até 30 s depois), mas a
   * outra ponta destes comandos era gravada na hora: a oferta do mercado, o baú
   * da conta, o baú da guilda, o destinatário de uma transferência. Se o
   * processo caísse no meio, o item guardado no baú voltava para a mochila E
   * ficava no baú; a oferta comprada sumia com o ouro do comprador intacto.
   *
   * Aqui o comando roda numa transação do SQLite e, antes do COMMIT, grava o
   * personagem de quem mandou e o de todo outro jogador ONLINE que ele tocou
   * (o vendedor que recebeu o ouro — ver `estadoAoVivo`). Ou tudo fica no
   * banco, ou nada fica.
   */
  precisaDeTransacao(m) {
    if (!this.personagem || this.carregando) return false;
    if (COMANDOS_DE_CAIXA.has(m?.t)) return true;
    return COMANDOS_DE_ECONOMIA.has(m?.t) && !!m.action && !LEITURAS.has(m.action);
  }

  /*
   * ---- A fila global de transações (Fase 6) ----
   *
   * Antes do banco virar assíncrono, isto rodava tudo de forma SÍNCRONA:
   * BEGIN → o comando inteiro → COMMIT, sem `await` no meio — e como nada
   * mais roda no meio de um trecho síncrono em JS, a exclusão mútua vinha de
   * graça. Assim que `fn()` pode conter um `await` de verdade (rede, no
   * Postgres), essa garantia desaparece: OUTRA mensagem — de outra sessão, ou
   * o próximo tique — podia entrar no meio e mexer no mesmo ouro/item antes
   * do COMMIT. `filaDeTransacoes` restaura isso: toda transação do servidor
   * INTEIRO (não só desta sessão) espera a vez, uma de cada vez, na ordem em
   * que chegou. `B.transacao` (game/database/db.mjs) cuida da outra metade — prender
   * a transação numa única conexão, no Postgres.
   */
  emTransacao(fn) {
    if (this.tocadas) return fn(); // já dentro de uma (reentrância, mesma sessão)
    const tocadas = (this.tocadas = new Set([this]));
    const minhaVez = filaDeTransacoes.then(() =>
      B.transacao(async () => {
        try {
          const r = await fn();
          for (const s of tocadas) await s.gravarAgora();
          return r;
        } finally {
          this.tocadas = null;
        }
      }),
    );
    // A fila anda mesmo se esta transação falhar — senão uma falha trava
    // para sempre todo mundo que vier depois.
    filaDeTransacoes = minhaVez.then(
      () => {},
      () => {},
    );
    return minhaVez;
  }

  despachar(m) {
    // O medidor de ping do client (`medidor.mjs`): `{t:'ping', at}` → `{t:'pong', at}`.
    // Sem resposta, o número mostrava há quanto tempo o ping saiu — só subia.
    if (m.t === 'ping') return this.enviar({ t: 'pong', at: m.at });
    // A ficha de combate (Ficha.combate) fica guardada entre uma invalidação e
    // outra (ver o comentário em game/systems/ficha.mjs); um comando pode equipar,
    // forjar ou imbuir SEM passar por `aplicar()` (forja e craft respondem
    // direto), então a invalidação mora aqui, antes do `switch`, e não lá.
    Ficha.invalidar(this.estado);
    // Entrando no personagem (simulação offline rodando): comando de jogo ainda
    // não tem personagem para agir. Sair, trocar de conta e o handshake passam.
    if (this.carregando && !PASSAM_CARREGANDO.has(m.t)) return;
    switch (m.t) {
      case 'register':
        return this.registrar(m);
      case 'login':
        return this.login(m);
      case 'resume':
        return this.resumir(m);
      case 'logout':
        return this.logout(m);
      case 'createCharacter':
        return this.criarPersonagem(m);
      case 'deleteCharacter':
        return this.excluirPersonagem(m);
      case 'play':
        return this.entrarNoPersonagem(m);
      case 'release':
        return this.soltarPersonagem();
      // A ficha do monstro pede o que ele paga a mim e como ele bate — a conta é do servidor (`fichaDoBicho`).
      case 'fichaDoBicho':
        if (this.estado && typeof m.key === 'string') this.enviar({ t: 'fichaDoBicho', ...fichaDoBicho(this.estado, this.estado.hunt, m.key, { huntId: typeof m.huntId === 'string' ? m.huntId : null, dificuldade: typeof m.dificuldade === 'string' ? m.dificuldade : null }) });
        return;
      // Interagir com um encontro da fase (abrir o baú, ativar o altar...): o servidor valida tudo.
      case 'interagir':
        return this.interagirComEncontro(m);
      case 'decidir':
        return this.decidirEncontro(m);
      // O jogador leu o relatório da ausência (OK): só agora ele deixa de ser entregue.
      case 'ackAusencia':
        return this.confirmarRelatorioDaAusencia();
      case 'deixarOffline':
        return this.deixarOffline();
      case 'contaChar':
        return this.contaChar(m);
      // A campanha inteira (as dificuldades, as 48 fases com o progresso e os bosses dos atos): a lista de hunts pede ao abrir.
      case 'campanha':
        return this.enviar({ t: 'campanha', campanha: Campanha.paraCliente(this.estado) });
      case 'walk':
        return this.andar(m);
      case 'walkTo':
        return this.andarAte(m);
      case 'huntWalkTo':
        return this.aplicarSoErro(Cacadas.andarAte(this.estado, m));
      case 'virar':
        return this.virar(m);
      case 'pedirMapa': {
        // O mapa da cidade tem 3,7 MB: o cliente pede no máximo a cada 3 s
        // (`ultimoPedidoDeMapa`, main.mjs); mais que isso é repetição, não perda.
        const agora = Date.now();
        if (agora - (this.mapaPedidoEm ?? 0) < INTERVALO_DO_PEDIDO_DE_MAPA) return;
        this.mapaPedidoEm = agora;
        return this.mandarEstado(true);
      }
      case 'diario':
        return this.aplicar(Recompensas.coletarDiario(this.estado));
      case 'diarioEscolher':
        return this.aplicar(Recompensas.escolherDiario(this.estado, m));
      case 'marco':
        return this.aplicar(Recompensas.coletarMarco(this.estado, m));
      case 'presente':
        return this.aplicar(Recompensas.coletarPresente(this.estado, m));
      case 'largar':
        return this.aplicar(Inventario.largar(this.estado, m));
      // A troca entre jogadores (convite, oferta, ouro, confirmar, cancelar) — `systems/troca.mjs`.
      case 'trade':
        return this.aplicar(Troca.comando(this, m));
      case 'destroy':
        return this.aplicar(Inventario.destruir(this.estado, m));
      case 'clearBackpack':
        return this.aplicar(Inventario.limparMochila(this.estado, m));
      case 'equip':
        return this.aplicarComSkills(Inventario.equipar(this.estado, m));
      case 'unequip':
        return this.aplicarComSkills(Inventario.desequipar(this.estado, m));
      // As GEMAS DE SKILL nos sockets das peças vestidas (`skills/gemas.mjs`): encaixar, tirar.
      case 'gema':
        return this.aplicarComSkills(
          m.action === 'encaixar' ? GemasDeSkill.encaixar(this.estado, m) :
          m.action === 'tirar' ? GemasDeSkill.tirar(this.estado, m) :
          m.action === 'lapidar' ? GemasDeSkill.lapidar(this.estado, m) :
          m.action === 'fundir' ? GemasDeSkill.fundir(this.estado, m) :
          // Os orbes de socket: abrir um socket e ligar/desligar um elo (ver `GemasDeSkill.abrirSocket`).
          m.action === 'abrirSocket' ? GemasDeSkill.abrirSocket(this.estado, m) :
          m.action === 'ligarElo' ? GemasDeSkill.ligarElo(this.estado, m) :
          { ok: false, erro: 'Ação de gema desconhecida.' }
        );
      // A Forja: tier (subir com chance, passar) e afixos (rerroll, transferir,
      // retirar, inserir, fundir) — cada resposta é o retrato inteiro de novo.
      case 'forja':
        return this.enviar(Forja.viewDoTier(this.estado));
      case 'forjaSubir':
      case 'forjaTransferir': {
        const r = m.t === 'forjaSubir' ? Forja.subirTier(this.estado, m) : Forja.transferirTier(this.estado, m);
        if (r.erro) this.erro(r.erro);
        else if (r.notice) this.avisoPendente = r.notice;
        Afixos.sincronizarMaximos(this.estado);
        this.mandarEstado();
        return this.enviar(Forja.viewDoTier(this.estado, r.forjou));
      }
      // As outras duas abas da Forja: o Craft (sets Craftado e V2) e a Máquina
      // de Desmanche — mesma regra: a resposta é a ficha inteira de novo.
      case 'craft':
        return this.enviar(Craft.view(this.estado, m));
      case 'craftFazer': {
        const r = Craft.craftar(this.estado, m);
        if (!r.ok) this.erro(r.erro);
        else this.avisoPendente = r.notice;
        Afixos.sincronizarMaximos(this.estado);
        this.mandarEstado();
        // A aba Tier só pede a ficha dela ao abrir a Forja: sem esta, ela
        // mostraria o ouro e as peças de ANTES do craft até alguém reabrir.
        this.enviar(Forja.viewDoTier(this.estado));
        return this.enviar(Craft.view(this.estado, m, r.craftou));
      }
      case 'desmanche':
        return this.enviar(Desmanche.view(this.estado));
      case 'desmancharPeca': {
        const r = Desmanche.desmanchar(this.estado, m);
        if (!r.ok) this.erro(r.erro);
        else this.avisoPendente = r.notice;
        this.mandarEstado();
        this.enviar(Forja.viewDoTier(this.estado)); // mesma razão do craft: as peças mudaram
        return this.enviar(Desmanche.view(this.estado));
      }
      case 'forjaAfixos':
        return this.enviar(Forja.viewDosAfixos(this.estado));
      case 'forjaAfixoPrevia':
        return this.enviar(Forja.previaTransferir(this.estado, m));
      case 'forjaAfixoPreviaRetirar':
        return this.enviar(Forja.previaRetirar(this.estado, m));
      case 'forjaAfixoPreviaInserir':
        return this.enviar(Forja.previaInserir(this.estado, m));
      case 'forjaAfixoPreviaFundir':
        return this.enviar(Forja.previaFundir(this.estado, m));
      case 'forjaAfixoReroll':
      case 'forjaAfixoTransferir':
      case 'forjaAfixoRetirar':
      case 'forjaAfixoInserir':
      case 'forjaAfixoFundir': {
        const faz = { forjaAfixoReroll: Forja.rerrolar, forjaAfixoTransferir: Forja.transferir, forjaAfixoRetirar: Forja.retirar, forjaAfixoInserir: Forja.inserir, forjaAfixoFundir: Forja.fundir }[m.t];
        const r = faz(this.estado, m);
        if (r.erro) this.erro(r.erro);
        Afixos.sincronizarMaximos(this.estado);
        this.mandarEstado();
        return this.enviar(Forja.viewDosAfixos(this.estado, r.fez));
      }
      case 'grupo':
        return this.aplicar(Party.comandoDoGrupo(this, m));
      case 'party':
        return this.despacharParty(m);
      case 'bank':
        return this.despacharBank(m);
      case 'falarComNpc':
        return this.falarComNpc(m);
      case 'npcComprar':
        return this.comprarNoNpc(m);
      // `send({t:'regrasDeUso', regras:[...]})` — as regras de uso automático por tag (limpas no servidor).
      case 'regrasDeUso':
        this.estado.regrasDeUso = RegrasDeUso.sanear(m.regras);
        return this.aplicar({ ok: true, notice: `${this.estado.regrasDeUso.length} regra(s) de uso salvas.` });
      case 'prey':
        return this.aplicar(Prey.comando(this.estado, m));
      case 'arvore':
        return this.despacharArvore(m);
      case 'passivas':
        return this.despacharPassivas(m);
      case 'gemas':
        return this.despacharGemas(m);
      case 'charms':
        return this.despacharCharms(m);
      case 'proficiency':
        return this.despacharProficiencia(m);
      // Abrir a oficina: a resposta é o próprio personagem (o cliente lê `imbuements`/`imbuementSlots` dele).
      case 'blessings':
        return this.enviar(Morte.vista(this.estado));
      case 'bless': {
        const r = Morte.comprar(this.estado, m);
        if (r.ok) this.enviar(Morte.vista(this.estado));
        return this.aplicar(r);
      }
      // Amigos (lista, pedir, aceitar, recusar, tirar) e o perfil de alguém — ver `game/systems/amigos.mjs`.
      // O chat (Local, Global, Privado, áudio) e a presença — ver `game/systems/chat.mjs`.
      case 'chat': {
        const erro = Chat.falar(this, m);
        return erro ? this.erro(erro) : undefined;
      }
      case 'chatAudio': {
        const erro = Chat.falarAudio(this, m);
        return erro ? this.erro(erro) : undefined;
      }
      case 'ouvirAudio':
        return this.enviar(Chat.ouvirAudio(m.id));
      case 'presenca':
        return this.enviar(Chat.presenca(m.nomes));
      // Highscores: o top 25 da categoria — ver `game/systems/ranking.mjs`.
      case 'ranking':
        return Ranking.topo(m.category).then((ranking) => this.enviar({ t: 'ranking', ranking }));
      // A guilda: sem `action`, a vista; com, a ação e a vista nova — ver `game/systems/guildas.mjs`.
      // A Arena x1: sem `action`, o lobby; com, a ação (a vista nova vai para quem foi tocado).
      case 'arena':
        return this.despacharArena(m);
      case 'guilda':
        return this.despacharGuilda(m);
      case 'friends':
        return Amigos.comando(this.personagem.nome, m).then((r) => this.enviar(r));
      case 'perfil':
        return Amigos.perfil(m.name).then((r) => this.enviar(r));
      case 'tasksDeBicho': {
        const r = Tarefas.comando(this.estado, m);
        if (!r.ok) return this.erro(r.erro);
        this.enviar({ t: 'tasksDeBicho', ficha: Tarefas.ficha(this.estado) });
        return m.action ? this.aplicar(r) : undefined;
      }
      case 'taskToken':
        return this.enviar({ t: 'taskToken', loja: Tarefas.loja(this.estado) });
      case 'entrega':
        return this.aplicar(Entregas.entregar(this.estado, m));
      case 'promote':
        return this.aplicar(Promocao.promover(this.estado));
      case 'imbuements':
        return this.aplicar({ ok: true });
      case 'imbue':
        return this.aplicar(Imbuements.comando(this.estado, m));
      case 'tierUp':
        return this.aplicar(Tiers.subir(this.estado, m));
      case 'usar':
        return this.aplicar(Inventario.usar(this.estado, m));
      case 'split':
        return this.naCaixa(m, () => Inventario.dividir(this.estado, m));
      case 'juntar':
        return this.naCaixa(m, () => Inventario.juntar(this.estado, m));
      case 'trocar':
        return this.naCaixa(m, () => Inventario.trocar(this.estado, m));
      case 'organizar':
        return this.naCaixa(m, () => Inventario.organizar(this.estado, m));
      case 'pouch':
        return this.aplicar(Bolsa.moverBolsa(this.estado, m));
      case 'clearPouch':
        return this.aplicar(Bolsa.limparBolsa(this.estado, m));
      case 'market':
        return this.despacharMercado(m);
      case 'coinMarket':
        return this.despacharCoins(m);
      case 'training':
        return this.despacharTreino(m);
      case 'storeInbox':
        return this.aplicar(Loja.moverDaInbox(this.estado, m, Inventario.cabeNoPeso));
      case 'depot':
        return this.despacharDepot(m);
      case 'venderMochila': {
        const r = Bolsa.vendaDaMochila(this.estado, m);
        this.enviar(r.previa);
        return this.aplicar(r);
      }
      // `venderSacolas` é a venda das SACOLAS DE BOSS (o baú), não da bolsa de loot.
      case 'venderSacolas': {
        const r = Bau.venderSacolas(this.estado, m);
        this.enviar(r.previa);
        return this.aplicar(r);
      }
      case 'reward':
        return this.aplicar(Bau.comandoDoBau(this.estado, m));
      case 'autoBoss':
        return this.aplicar(Bosses.comandoDoAuto(this.estado, m));
      case 'bossToken': {
        const r = m.action === 'buy' ? Bosses.comprar(this.estado, m) : { ok: true };
        this.enviar(Bosses.lojaParaCliente(this.estado));
        return this.aplicar(r);
      }
      case 'bossPouch': {
        const r = Bau.comandoDaBossPouch(this.estado, m);
        if (r.ok) this.enviar(r.previa);
        return this.aplicar(r);
      }
      case 'itemRule':
        return this.despacharFiltro(m, Bolsa.regraDeItem(this.estado, m));
      case 'lootPreset':
        return this.despacharFiltro(m, Bolsa.presetDeLoot(this.estado, m));
      case 'lootFiltro':
        return this.despacharFiltro(m, Bolsa.definirLootFiltro(this.estado, m));
      case 'lootRegras':
        return this.despacharFiltro(m, Bolsa.definirRegrasDeLoot(this.estado, m));
      case 'settings':
        return this.despacharFiltro(m, Bolsa.definirSettings(this.estado, m));
      case 'resetAnalyzer':
        return this.aplicar(Cacadas.zerarAnalisador(this.estado));
      case 'pegar':
        return this.aplicar(Inventario.pegar(this.estado, m));
      case 'mounts':
        return this.mandarMontarias();
      case 'outfit':
        return this.aplicar(Aparencia.salvarAparencia(this.estado, m));
      case 'mount':
        return this.aplicar(Aparencia.equiparMontaria(this.estado, m));
      case 'store':
        return this.despacharLoja(m);
      case 'historicoDaLoja':
        return this.mandarHistoricoDaLoja();
      case 'startHunt': {
        // Treinando no boneco? Para o treino (com o relatório) antes de sair caçando.
        if (this.estado.exercicio?.treinando) {
          const r = Exercicio.parar(this.estado);
          if (r.relatorio) this.enviar(r.relatorio);
        }
        Party.antesDeSairDaCacada(this);
        const entrou = Cacadas.entrar(this.estado, m);
        this.aplicar(entrou);
        // Líder de party: quem marcou "Seguir líder" vem junto.
        if (entrou.ok) Party.seguirOLider(this);
        return;
      }
      // O portal do boss do ato (aberto na última fase concluída): valida no servidor e leva para a arena, sem recarga.
      case 'portalDoBoss':
        return this.entrarNoPortalDoBoss();
      case 'entrarNaArena':
        return this.entrarNaArena();
      case 'stopHunt': {
        if (this.estado?.hunt?.huntId === 'treino') return this.despacharTreino({ action: 'stop' });
        // "Caçada encerrada": o relatório da sessão, antes de a hunt sumir.
        const report = this.estado?.hunt ? Cacadas.relatorio(this.estado) : null;
        // Quem segue o líder volta junto (antes de ele sair: é pela sala dele que se acha quem estava junto).
        Party.voltarComOLider(this, 'voltou para a cidade');
        Party.antesDeSairDaCacada(this);
        const resultado = this.aplicar(Cacadas.sair(this.estado));
        if (report) this.enviar({ t: 'runReport', report });
        return resultado;
      }
      case 'huntTarget':
        return this.aplicar(Cacadas.definirAlvo(this.estado, m));
      case 'huntWalk':
        // Recusado no pátio (`Cacadas.andar`); sem aviso, porque a tecla presa repete isto a cada 100ms.
        return void Cacadas.andar(this.estado, m);
      case 'huntEscada':
        return this.aplicar(Cacadas.usarEscada(this.estado, m));
      case 'huntAssist':
        return this.aplicar(Cacadas.definirAssistencia(this.estado, m));
      // `send({t:'modoDasMagias', modo, limite?})` — a ordem das magias de ataque (prioridade | limite | rotação).
      case 'modoDasMagias':
        return this.aplicar(Combo.definirModo(this.estado, m));
      case 'lure':
        return this.aplicar(Cacadas.definirLure(this.estado, m));
      case 'strategy':
        return this.aplicar(Cacadas.definirEstrategia(this.estado, m));
      case 'distance':
        return this.aplicar(Cacadas.definirDistancia(this.estado, m));
      case 'compararPeca': {
        // A comparação do balão (ver `systems/itens/comparar.mjs`): por TODOS os
        // atributos e pelo impacto na ficha. Só leitura — nada do estado muda.
        const r = Comparar.comparar(this.estado, m.peca);
        return this.enviar({ t: 'comparacao', chave: String(m.chave ?? '').slice(0, 2000), ...r });
      }
      case 'aoCompletarFase': {
        const r = Cacadas.definirAoCompletarFase(this.estado, m);
        this.aplicar(r);
        // O painel da campanha mostra a escolha: vai a campanha de novo.
        if (r.ok) this.enviar({ t: 'campanha', campanha: Campanha.paraCliente(this.estado) });
        return;
      }
      case 'actions':
        return this.despacharAcoes(m);
      case 'actionPreset':
        return this.despacharPreset(m);
      case 'huntAction':
        return this.dispararAcaoManual(m);
      // O aperto de mão do cliente (main.mjs, na conexão): como ele quer os quadros.
      case 'delta':
        // "Sei juntar o que mudou." Pedido de novo = um remendo falhou lá: o
        // próximo quadro vai inteiro, e o delta recomeça dele.
        this.delta = m.on !== false;
        this.recomecarQuadros();
        return;
      case 'jaTenhoCatalogo':
        // Os itens (1 MB) vão uma vez por conexão, não em todo `welcome`.
        this.guardaCatalogo = true;
        return;
      case 'oculta':
        // Aba no fundo: efeito de tela é desenho para ninguém (o cliente nem desenha).
        this.oculta = m.on === true;
        return;
      default:
        // Comando ainda não implementado nesta restauração — ver
        // api-mapeada/protocolo.md. Silencioso de propósito: um comando
        // desconhecido não pode derrubar a conexão.
        return;
    }
  }

  // ------------------------------------------ os outros chars da conta

  /*
   * ---- "+ Party", "➜ Hunt" e "⚙ Config" na troca de personagem ----
   *
   * `send({t:'contaChar', name, op})` — o cliente mandava isto desde a
   * restauração, e o servidor não tinha o comando: os três botões não faziam
   * nada, em silêncio. `op`:
   *
   * - `dados`: a configuração do outro char (`contaCharDados`).
   * - `cmd`: muda alvo, distância, lure, ajustes, a barra de ações ou a
   *   formação da party dele (`cmd` é o mesmo comando da barra do rodapé).
   *   Com ele no mundo, vale na hora; caçando offline, vai direto para o banco.
   * - `party`: põe ele na sua party, sem convite — é a mesma pessoa dos dois lados.
   * - `hunt`: põe na party (se preciso) e leva para a sua caçada.
   *
   * Party e caçada em grupo são de quem está NO MUNDO. O char que está caçando
   * offline é trazido de volta "sem aba" (`trazerParaOMundo`): a ausência dele
   * é consolidada como num login, e ele caça junto ao vivo. Sem aba ele só
   * fica enquanto estiver numa party — saiu dela (ou a party acabou), sai do
   * mundo como quem fecha a aba, e a caçada segue offline (ver `tique`).
   */
  async contaChar(m) {
    if (!this.conta || !this.personagem) return;
    const linha = await B.personagemPorNome(String(m.name ?? '').trim());
    if (!linha || linha.conta !== this.conta.id) return this.erro('Esse personagem não é desta conta.');
    if (linha.nome === this.personagem.nome) return this.erro('Esse é o personagem em que você está.');
    if (carregandoAgora.has(linha.nome)) return this.erro(`${linha.nome} está entrando agora — tente de novo em instantes.`);
    const vivo = vivas.get(linha.nome)?.personagem ? vivas.get(linha.nome) : null;
    switch (m.op) {
      case 'dados':
        return this.mandarDadosDoOutro(linha, vivo);
      case 'cmd':
        return this.configurarOutro(linha, vivo, m.cmd);
      case 'party':
      case 'hunt':
        return this.chamarOutro(linha, vivo, m.op);
      default:
        return this.erro('Ação desconhecida.');
    }
  }

  /** `contaCharDados`: o personagem (ajustes, barra, party) e o catálogo de ações dele. */
  mandarDadosDoOutro(linha, vivo) {
    const estado = vivo ? vivo.estado : JSON.parse(linha.estado);
    const character = { ...characterParaCliente(linha, estado), ...(vivo ? Party.camposDoPersonagem(vivo) : { party: null }) };
    // A formação (quem vai na frente, seguir quem) só existe caçando em grupo.
    const grupo = vivo?.estado?.hunt ? Party.extrasDoRetrato(vivo).party : null;
    this.enviar({ t: 'contaCharDados', name: linha.nome, character, catalog: Acoes.catalogo(estado), grupo });
  }

  async configurarOutro(linha, vivo, cmd) {
    const t = cmd?.t;
    // `{t:'actions'}` sem ação é o editor pedindo o catálogo: vai junto dos dados.
    if (t === 'actions' && !cmd.action) return this.mandarDadosDoOutro(linha, vivo);
    const partyDele = t === 'party' && ['frente', 'seguirQuem', 'coleira', 'modo', 'reagrupar', 'cancelarReagrupar'].includes(cmd.action);
    if (!CONFIG_DE_OUTRO[t] && !partyDele) return this.erro('Isso não dá para mudar daqui.');
    if (vivo) {
      const r = partyDele ? Party.comandoDaCaca(vivo, cmd) : CONFIG_DE_OUTRO[t](vivo.estado, cmd);
      if (!r.ok) this.erro(r.erro);
      else {
        vivo.characterSujo = true;
        vivo.mandarEstado();
      }
      return this.mandarDadosDoOutro(linha, vivo);
    }
    if (partyDele) return this.erro(`${linha.nome} não está caçando em grupo.`);
    // Fora do mundo: lê, muda e regrava — só se ninguém gravou no meio (a rodada
    // da caçada offline); se gravou, relê e tenta de novo.
    let atual = linha;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const estado = JSON.parse(atual.estado);
      const r = CONFIG_DE_OUTRO[t](estado, cmd);
      if (!r.ok) {
        this.erro(r.erro);
        return this.mandarDadosDoOutro(atual, null);
      }
      if (await B.regravarSeNaoMudou(atual.id, estado, atual.estado)) {
        return this.mandarDadosDoOutro({ ...atual, estado: JSON.stringify(estado) }, null);
      }
      atual = await B.personagemPorNome(linha.nome);
      // Entrou no jogo no meio: a mudança vai pela sessão dele.
      const agoraVivo = vivas.get(linha.nome);
      if (agoraVivo?.personagem) return this.configurarOutro(atual, agoraVivo, cmd);
      if (!atual) return this.erro('Esse personagem não existe mais.');
    }
    return this.erro(`${linha.nome} está sendo atualizado agora — tente de novo em instantes.`);
  }

  async chamarOutro(linha, vivo, op) {
    if (op === 'hunt' && !this.estado.hunt) return this.erro('Entre numa caçada para chamar alguém para ela.');
    let outro = vivo;
    let jaMandouOExtrato = false;
    if (!outro) {
      const r = await this.trazerParaOMundo(linha);
      if (!r.ok) return this.erro(r.erro);
      outro = r.sessao;
      // O que ele rendeu caçando offline até agora (ou como morreu), para quem chamou.
      if (r.andamento) {
        // Quem chamou recebeu o relatório dele: não fica pendente para a próxima entrada.
        delete outro.estado?.relatorioDaAusencia;
        this.enviar({ t: 'runReport', report: r.andamento, titulo: `${linha.nome}: enquanto esteve fora`, motivo: r.andamento.motivo ?? null });
        // A caçada dele de agora começou nesta entrada: o extrato dela seria de
        // segundos — e a janela dele cobriria esta, que é a que conta.
        jaMandouOExtrato = true;
      }
      // Enquanto ele entrava, esta sessão pode ter saído do personagem.
      if (!this.personagem) return outro.desconectar();
    }
    const desistir = (erro) => {
      // Veio só para isto e não deu: volta para onde estava (offline).
      if (outro.semAba && !Party.naParty(outro)) outro.desconectar();
      return this.erro(erro);
    };
    const party = Party.juntarDaConta(this, outro);
    if (!party.ok) return desistir(party.erro);
    let notice = party.notice ?? `${linha.nome} já está na sua party.`;
    if (op === 'hunt') {
      /*
       * Ele estava caçando em OUTRO lugar: aquela caçada acaba aqui. O extrato
       * dela é tirado antes (depois, a hunt já é a sua) e vai para quem chamou
       * — sem aba, não teria ninguém para ver o que ela rendeu.
       */
      const deOutraCacada = outro.estado.hunt && outro.estado.hunt.huntId !== 'treino' && Cacadas.salaDe(outro.estado.hunt) !== Cacadas.salaDe(this.estado.hunt);
      const extrato = deOutraCacada ? { report: Cacadas.relatorio(outro.estado), onde: Cacadas.nomeDaHunt(outro.estado.hunt.huntId) } : null;
      const r = Party.chamarDaConta(this, outro);
      if (!r.ok) return desistir(r.erro);
      notice = r.notice?.startsWith('Você entrou') ? `${linha.nome} entrou na sua caçada.` : r.notice ?? notice;
      if (extrato?.report && !jaMandouOExtrato) {
        const msg = { t: 'runReport', report: extrato.report, titulo: `Extrato de ${linha.nome}`, motivo: `${linha.nome} saiu de ${extrato.onde} para vir para a sua caçada. Isto é o que aquela caçada rendeu.` };
        // (Com aba aberta nele, quem está lá recebe o dele pela entrada — ver `juntar`, em party.mjs.)
        this.enviar(msg);
      }
    }
    outro.characterSujo = true;
    outro.mandarEstado();
    return this.aplicar({ ok: true, notice });
  }

  /**
   * Põe um char da conta no mundo SEM aba: a mesma entrada de um login (a
   * ausência offline é consolidada, a morte offline acontece, o teto de chars
   * da conta vale), numa sessão cujo "socket" nunca está aberto.
   */
  async trazerParaOMundo(linha) {
    const sessao = new Sessao(SEM_ABA);
    sessao.conta = this.conta;
    sessao.semAba = { desde: Date.now(), dono: this.personagem.nome };
    let motivo = null;
    let andamento = null;
    sessao.erroDeAuth = (mensagem) => void (motivo = mensagem);
    // O "enquanto você esteve fora" vai no `welcome` — que, sem aba, ninguém lê.
    // Ele é guardado aqui e entregue a quem chamou (ver `chamarOutro`).
    sessao.enviar = (msg) => {
      if (msg?.t === 'welcome') andamento = msg.andamento ?? null;
    };
    try {
      await sessao.entrarNoPersonagem({ name: linha.nome });
    } catch (e) {
      motivo = e.message;
    } finally {
      delete sessao.enviar;
    }
    if (!sessao.personagem) {
      sessao.desconectar();
      return { ok: false, erro: motivo ?? `Não deu para trazer ${linha.nome} agora.` };
    }
    return { ok: true, sessao, andamento };
  }

  // ------------------------------------------------------------------ auth

  async registrar({ email, password, confirm }) {
    const mail = String(email ?? '').trim().toLowerCase();
    if (!DOMINIO_EMAIL.test(mail)) return this.erroDeAuth('E-mail inválido.');
    if (!password || password.length < 6) return this.erroDeAuth('A senha precisa de 6 caracteres ou mais.');
    if (password !== confirm) return this.erroDeAuth('As senhas não conferem.');
    if (await B.contaPorEmail(mail)) return this.erroDeAuth('Este e-mail já tem conta.');

    const conta = await B.criarConta({ email: mail, senha: password });
    // Enquanto o hash rodava, outra aba pode ter criado a mesma conta.
    if (!conta) return this.erroDeAuth('Este e-mail já tem conta.');
    this.conta = await B.contaPorId(conta.id);
    const token = await B.abrirSessao(conta.id);
    await this.mandarConta(token);
  }

  async login({ email, password }) {
    const conta = await B.contaPorEmail(email);
    if (!conta || !(await B.conferirSenha(password, conta.senha))) {
      return this.erroDeAuth('E-mail ou senha incorretos.');
    }
    this.conta = conta;
    const token = await B.abrirSessao(conta.id);
    await this.mandarConta(token);
  }

  async resumir({ token }) {
    const conta = await B.contaDaSessao(token);
    if (!conta) return this.erroDeAuth('sessão expirada');
    this.conta = conta;
    await this.mandarConta(token);
  }

  async logout({ token }) {
    if (token) await B.encerrarSessao(token);
    this.soltarPersonagem();
    this.conta = null;
  }

  async mandarConta(token) {
    const personagens = await B.personagensDaConta(this.conta.id);
    this.enviar({
      t: 'account',
      token,
      account: {
        email: this.conta.email,
        pelaGoogle: false,
        temGoogle: false,
        doisFatores: false,
        reservasRestantes: 0,
        characters: cartaoDaConta(personagens),
      },
    });
  }

  // ------------------------------------------------------------ personagem

  async criarPersonagem({ name, vocation, sex }) {
    if (!this.conta) return this.erroDeAuth('sem sessão');
    const problema = R.problemaNoNomeDePersonagem(name);
    if (problema) return this.erroDeAuth(problema);
    if (!R.VOCACOES_VALIDAS.has(vocation)) return this.erroDeAuth('Vocação inválida.');
    if (sex !== 'male' && sex !== 'female') return this.erroDeAuth('Escolha inválida.');
    if (await B.personagemPorNome(name)) return this.erroDeAuth('Já existe um personagem com esse nome.');
    const existentes = await B.personagensDaConta(this.conta.id);
    if (existentes.length >= R.MAXIMO_DE_PERSONAGENS) return this.erroDeAuth('Limite de personagens atingido.');

    await B.criarPersonagem({
      conta: this.conta.id,
      nome: name,
      vocacao: vocation,
      sexo: sex,
      estadoInicial: estadoInicialPersonagem(vocation, sex),
    });
    // O cliente trata `account` como "a lista mudou, redesenhe" também fora do
    // login — ver `auth.mjs`'s `handle`.
    await this.mandarConta(null);
  }

  /*
   * A tela de exclusão só manda `password` neste backup (sem OAuth Google —
   * ver `criarConta`/`registrar`, a conta só existe com senha). O cliente
   * espera `characterDeleted` seguido de um `account` atualizado — ver
   * `auth.mjs`'s `handle`, caso `characterDeleted`.
   */
  async excluirPersonagem({ name, password }) {
    if (!this.conta) return this.erroDeAuth('sem sessão');
    if (!(await B.conferirSenha(password, this.conta.senha))) return this.erroDeAuth('Senha incorreta.');
    const personagem = await B.personagemPorNome(name);
    if (!personagem || personagem.conta !== this.conta.id) return this.erroDeAuth('Personagem não encontrado.');

    const viva = vivas.get(personagem.nome);
    if (viva) {
      viva.personagem = null;
      viva.estado = null;
      vivas.delete(personagem.nome);
      if (viva !== this) enviar(viva.ws, { t: 'released', notice: 'Este personagem foi excluído.' });
    }
    await B.excluirPersonagem(personagem.id);
    this.enviar({ t: 'characterDeleted', name: personagem.nome });
    await this.mandarConta(null);
  }

  async entrarNoPersonagem({ name }) {
    if (!this.conta) return this.erroDeAuth('sem sessão');
    // Já entrando num personagem (a simulação offline está rodando): o cliente
    // manda `play` uma vez só; outro no meio é repetição.
    if (this.carregando) return;
    // Manutenção com indisponibilidade (desligada por padrão): ninguém NOVO entra; a caçada offline segue correndo.
    if (Manutencao.bloqueada()) return this.erro(Manutencao.mensagemDeBloqueio());
    let personagem = await B.personagemPorNome(name);
    if (!personagem || personagem.conta !== this.conta.id) return this.erroDeAuth('Personagem não encontrado.');

    // Aquece o cache síncrono das melhorias da conta (`Party.limiteDeChars`
    // lê dele, não do banco — ver `B.melhoriasCache`) ANTES do primeiro
    // tique deste personagem: sem isto, o tamanho da party ficaria "sem
    // nenhum slot comprado" até a próxima vez que algo lesse do banco.
    await B.lerMelhoriasDaConta(this.conta.id);
    // "Sem [o Slot de party], a conta joga e caça com até 2 chars" ao mesmo tempo.
    // Quem ainda está carregando (simulação offline) já conta.
    const limite = Party.limiteDeChars(this.conta.id);
    const jogando = (s) => s.personagem?.nome ?? s.carregando?.nome;
    const daConta = [...vivas.values(), ...carregandoAgora.values()].filter((s) => s !== this && s.conta?.id === this.conta.id && jogando(s) && jogando(s) !== personagem.nome);
    if (daConta.length >= limite) {
      return this.erroDeAuth(`Sua conta já está com ${daConta.length} personagens jogando — o limite é ${limite}. Mais: "Slot de party", na Store.`);
    }
    // O mesmo personagem aberto (ou ainda carregando) em outra aba: esta ganha.
    const carregandoLa = carregandoAgora.get(personagem.nome);
    if (carregandoLa && carregandoLa !== this) {
      carregandoLa.cancelarCarregamento();
      enviar(carregandoLa.ws, { t: 'released', notice: 'Você entrou neste personagem em outra aba.' });
    }
    const antiga = vivas.get(personagem.nome);
    if (antiga && antiga !== this) {
      antiga.soltarPersonagem();
      enviar(antiga.ws, { t: 'released', notice: 'Você entrou neste personagem em outra aba.' });
      // A outra aba acabou de gravar: a linha lida lá em cima já está velha.
      personagem = await B.personagemPorNome(name);
    }

    const estado = JSON.parse(personagem.estado);
    // Os bichos da caçada voltam completos (ver `Cacadas.huntParaGravar`).
    Cacadas.huntAoCarregar(estado.hunt);
    estado.pos = corrigirPosicaoAntiga(estado.pos);
    // Migração: personagens salvos antes do sistema de recompensas existir
    // não têm `wildcards`/`presentes`/`diario` no `estado` gravado — sem
    // isto, COLETAR (não só exibir) quebraria em silêncio para eles.
    if (!estado.diario) Object.assign(estado, Recompensas.estadoInicial());
    // Os sets de marco da VOCAÇÃO dele (os ainda não pegos vinham com os itens de knight).
    Recompensas.marcosDaVocacao(estado);
    // As peças de antes do sistema de itens: nível, valor reescalado e raridade (uma vez).
    ItensDoJogo.converterPersonagem(estado);
    // O personagem novo ganha as gemas iniciais da classe (uma vez).
    GemasDeSkill.darGemasIniciais(estado);
    // A barra segue as gemas encaixadas (a migração v5 encaixa as magias que estavam nela).
    Acoes.sincronizarBarraComGemas(estado);
    // O filtro de loot da conta ("Toda a conta" ligado em algum char): vale neste também.
    const filtroDaConta = B.melhoriasCache(this.conta.id).filtroDeLoot;
    if (filtroDaConta?.ativo) FiltroDaConta.aplicar(estado, filtroDaConta);
    // A árvore de passivas única: garante o início da classe e, para quem tinha a árvore
    // ANTIGA por vocação, devolve todos os pontos (com um respec grátis) — uma vez.
    const passivas = Passivas.garantir(estado);
    if (passivas.migrou) estado.avisoDaHunt = 'A árvore de passivas mudou: agora é uma árvore só para todas as classes. Seus pontos voltaram — monte a nova (você tem um respec completo grátis).';
    else if (passivas.arvoreMudou) estado.avisoDaHunt = 'A árvore de passivas ganhou caminhos de atributo (STR/DEX/INT) entre os clusters. Os nós que perderam o caminho saíram e os pontos voltaram — você tem um respec completo grátis para remontar.';
    // Vida/mana dos adds e do STR/INT (que crescem com o level): sempre acerta ao entrar.
    Afixos.sincronizarMaximos(estado);
    // Mesma migração, agora para os campos que a Store passou a usar.
    if (!estado.autoBoss) Object.assign(estado, Loja.estadoInicial());
    // Migração: quem nasceu com `xp: 0` no level 8 (antes da correção acima)
    // ganha a exp base do level que já tem, somada ao que caçou.
    if ((estado.xp ?? 0) < R.expForLevel(estado.level)) estado.xp = (estado.xp ?? 0) + R.expForLevel(estado.level);
    Treino.garantir(estado);
    // A vida/mana das gemas acesas (quem entrou antes delas existirem acerta aqui).
    Gemas.sincronizarMaximos(estado);
    Inventario.moedasParaOBolso(estado);
    // Peça vestida no slot errado (de antes de o servidor validar o slot): volta para a mochila, sem perda.
    const noSlotErrado = Inventario.recolherPecasNoSlotErrado(estado);
    if (noSlotErrado.length) estado.avisoDaHunt = `${noSlotErrado.join(', ')} não ${noSlotErrado.length > 1 ? 'pertencem' : 'pertence'} ao slot em que ${noSlotErrado.length > 1 ? 'estavam' : 'estava'} e ${noSlotErrado.length > 1 ? 'voltaram' : 'voltou'} para a mochila.`;
    // Arma de duas mãos com escudo vestido (de antes da regra): o escudo volta para a mochila.
    Inventario.corrigirDuasMaos(estado);
    // Peça vestida que pede um level acima do dele (a arma agora define o dano): volta para a mochila, sem perda.
    const acimaDoLevel = Inventario.devolverPecasAcimaDoLevel(estado);
    if (acimaDoLevel.length) estado.avisoDaHunt = `${acimaDoLevel.join(', ')} ${acimaDoLevel.length > 1 ? 'pedem' : 'pede'} um level acima do seu e ${acimaDoLevel.length > 1 ? 'voltaram' : 'voltou'} para a mochila.`;
    // Munição/arremessável em pilha (de antes de deixarem de empilhar): uma peça, o resto vendido.
    const desempilhada = Bolsa.desempilharMunicao(estado);
    if (desempilhada.pecas) estado.avisoDaHunt = `Munição e armas de arremesso não empilham mais: ficou uma de cada pilha, e ${desempilhada.pecas.toLocaleString('pt-BR')} a mais viraram ${desempilhada.ouro.toLocaleString('pt-BR')} de ouro.`;
    // Treino offline / Exercise que ficou rodando com o jogador fora.
    const treinoPendente = Treinos.voltaDoTreino(estado, personagem.visto_em);
    // Deslogado fora de caçada: a stamina voltou nesse tempo (na caçada offline ela gasta — ver `simularAusencia`).
    if (!estado.hunt && personagem.visto_em) Stamina.recuperar(estado, Date.now() - personagem.visto_em);
    // Um duelo da Arena x1 que o servidor não terminou (caiu no meio): o level de verdade volta.
    Arena.aoEntrar(estado);

    /*
     * ---- Caçou com a aba fechada? A simulação roda FORA da thread do jogo ----
     *
     * Até aqui nada foi gravado nem tirado do banco: se a pessoa sair, fechar
     * a aba ou entrar neste personagem em outra aba enquanto a simulação roda,
     * o resultado é só jogado fora (`cancelarCarregamento`) e a próxima entrada
     * simula de novo a partir do mesmo estado gravado — nada se perde e nada
     * se ganha duas vezes. Enquanto isso a sessão não tem personagem: o tique
     * e os comandos de jogo passam por ela sem fazer nada.
     */
    const agora = Date.now();
    if (!Cacadas.temAusenciaParaSimular(estado, agora)) {
      return this.concluirEntrada(personagem, estado, Cacadas.simularAusencia(estado, personagem, agora), treinoPendente);
    }
    const pedido = { nome: personagem.nome };
    this.carregando = pedido;
    carregandoAgora.set(personagem.nome, this);
    const quem = { id: personagem.id, nome: personagem.nome, conta: personagem.conta, vocacao: personagem.vocacao };
    const ida = { ...estado, hunt: Cacadas.huntParaGravar(estado.hunt) };
    return SimulacaoOffline.simular(ida, quem, agora).then(
      ({ estado: simulado, ausencia }) => {
        if (this.carregando !== pedido) return;
        this.pararDeCarregar();
        // Trocou de conta no meio (login em outra): este personagem não é mais dela.
        if (this.conta?.id !== personagem.conta) return;
        Cacadas.huntAoCarregar(simulado.hunt);
        // Devolvida: quem espera a entrada (ver `trazerParaOMundo`) espera ela INTEIRA.
        return this.concluirEntrada(personagem, simulado, ausencia, treinoPendente);
      },
      (e) => {
        if (this.carregando !== pedido) return;
        // A thread falhou: simula aqui mesmo (trava, mas o jogador entra).
        console.error('simulação offline ->', e.message);
        this.pararDeCarregar();
        if (this.conta?.id !== personagem.conta) return;
        return this.concluirEntrada(personagem, estado, Cacadas.simularAusencia(estado, personagem, agora), treinoPendente);
      },
    );
  }

  /** "Seguir" da campanha (ver `Cacadas.faseParaSeguir`): entra na próxima fase e traz quem segue o líder. */
  seguirParaAProximaFase() {
    const proxima = Cacadas.faseParaSeguir(this.estado);
    if (!proxima) return;
    const h = this.estado.hunt;
    // Quem da party também marcou "Avançar sozinho" e está nesta sala vai junto (antes de a sala mudar de mão).
    const juntos = Party.quemAvancaJunto(this);
    Party.antesDeSairDaCacada(this);
    const r = Cacadas.entrar(this.estado, { huntId: proxima.huntId, mode: h.modo, strategy: h.strategy, dificuldade: proxima.dificuldade });
    if (!r.ok) {
      this.avisoPendente = r.erro;
      return;
    }
    this.avisoPendente = [this.avisoPendente, `Seguindo para a próxima fase: ${proxima.nome}.`].filter(Boolean).join(' ');
    Party.seguirOLider(this);
    Party.avancarJunto(this, juntos);
  }

  pararDeCarregar() {
    if (this.carregando && carregandoAgora.get(this.carregando.nome) === this) carregandoAgora.delete(this.carregando.nome);
    this.carregando = null;
  }

  /** A entrada foi abandonada no meio da simulação offline: o resultado dela é descartado. */
  cancelarCarregamento() {
    this.pararDeCarregar();
  }

  /**
   * `{t:'interagir', id}`: o jogador (ou alguém da party) ativa um encontro da instância. Quem pode, a distância, os
   * requisitos e o "uma vez só" são do servidor: o clique duplo e dois membros pedindo juntos caem no MESMO encontro
   * (`Estado.ativar` é idempotente) e a recompensa é paga uma vez, na conclusão.
   */
  /**
   * Caça Automática (`hunt.modo === 'auto'`): o portal do boss de ato abriu para ESTE personagem → entra, validado pelo servidor
   * (`entrarNoPortalDoBoss`). Uma tentativa por portal (`tentouEntrar`): se falhar, o personagem segue caçando e o botão do portal continua
   * lá — sem laço. Não leva a party: cada sessão em Caça Automática decide por si, com os próprios requisitos.
   */
  entrarAutomaticoNoPortal() {
    const hunt = this.estado?.hunt;
    if (!hunt || hunt.modo !== 'auto' || hunt.campanha?.bossDoAto || this.estado.exercicio?.treinando) return;
    const portal = Cacadas.portalParaCliente(this.estado, hunt);
    if (!portal) return;
    if (hunt.tentouEntrarNoPortal === portal.abertoEm) return;
    hunt.tentouEntrarNoPortal = portal.abertoEm;
    this.entrarNoPortalDoBoss();
  }

  /** `{t:'portalDoBoss'}` (ou `interagir` no marcador do portal): entra na arena do boss do ato. Só a sessão que pediu entra. */
  entrarNoPortalDoBoss() {
    if (!this.estado?.hunt) return this.erro('Você não está numa fase.');
    if (this.estado.exercicio?.treinando) return this.erro('Pare o treino antes.');
    const r = Cacadas.entrarNoPortalDoBoss(this.estado, { antes: () => Party.antesDeSairDaCacada(this) });
    this.aplicar(r);
    // Líder de party: quem marcou "Seguir líder" vem junto (a regra de sempre; ninguém é levado sem ter escolhido seguir).
    if (r.ok) Party.seguirOLider(this);
    return undefined;
  }

  interagirComEncontro(m) {
    // O marcador do portal do boss é um "encontro" só para o cliente: aqui vai para a entrada na arena (sem a regra de distância).
    if (String(m?.id) === 'portal-do-boss') return this.entrarNoPortalDoBoss();
    const hunt = this.estado?.hunt;
    const inst = hunt ? InstanciaDaHunt.daSala(hunt) : null;
    const e = inst?.encontros?.[String(m.id)];
    if (!e) return this.erro('Não há nada para interagir aqui.');
    if (e.x != null) {
      const longe = Math.max(Math.abs(hunt.pos.x - e.x), Math.abs(hunt.pos.y - e.y)) > 2 || (e.z != null && e.z !== hunt.z);
      if (longe) return this.erro('Chegue mais perto.');
    }
    // Fase com reagrupamento obrigatório: o chefe só começa com a party reunida (opcional por padrão — ver `gamedata/instancias.json`).
    const faltam = Party.faltamParaReagrupar(this, e, InstanciaDaHunt.CONFIG);
    if (faltam.length) return this.erro(`Reagrupe antes do chefe: faltam ${faltam.join(', ')}.`);
    // Os que pedem DECISÃO (área secreta, escolta) são do LÍDER da party — ou de quem está sozinho.
    if (TiposDosEncontros.tipoDe(e.tipo)?.decisaoDoLider && !Party.decidePeloGrupo(this)) return this.erro('Só o líder da party decide isso.');
    const agora = (hunt.anfitriao ?? hunt).clock ?? 0;
    const r = EstadoDosEncontros.ativar(inst, e.id, { quem: this.personagem?.nome ?? null, agora, hunt, estado: this.estado, personagem: this.personagem });
    if (r.ok) return;
    const texto = { 'ja-ativo': 'Já está em andamento.', 'ja-concluido': 'Já foi aberto.' }[r.motivo] ?? (r.motivo?.startsWith('requisito:') ? `Você ${r.motivo.slice(10)}.` : 'Ainda não dá para fazer isso.');
    return this.erro(texto);
  }

  /** `{t:'decidir', id, aceitar}`: a resposta do líder à janela de decisão (aceitar = o mesmo que interagir; recusar descarta o encontro). */
  decidirEncontro(m) {
    if (m.aceitar !== false) return this.interagirComEncontro(m);
    const hunt = this.estado?.hunt;
    const inst = hunt ? InstanciaDaHunt.daSala(hunt) : null;
    const e = inst?.encontros?.[String(m.id)];
    if (!e) return this.erro('Não há nada para decidir aqui.');
    if (!TiposDosEncontros.tipoDe(e.tipo)?.decisaoDoLider) return this.erro('Isso não pede decisão.');
    if (!Party.decidePeloGrupo(this)) return this.erro('Só o líder da party decide isso.');
    EstadoDosEncontros.recusar(inst, e.id, { agora: (hunt.anfitriao ?? hunt).clock ?? 0, quem: this.personagem?.nome ?? null });
  }

  /** `{t:'ackAusencia'}`: o OK do relatório da ausência. Idempotente (um OK repetido não faz nada). */
  confirmarRelatorioDaAusencia() {
    if (!this.estado?.relatorioDaAusencia) return;
    delete this.estado.relatorioDaAusencia;
    this.gravarAgora().catch((e) => console.error('gravar ack da ausência', e.message));
  }

  /** O resto da entrada, com o estado já com a ausência simulada (`ausencia`: o que `simularAusencia` devolveu). */
  async concluirEntrada(personagem, estado, ausencia, treinoPendente) {
    this.personagem = personagem;
    this.estado = estado;
    // Caçada de antes da campanha: vira a fase (barra e progresso), ou termina se a fase está fechada.
    const daCampanha = Cacadas.adotarNaCampanha(this.estado);
    // Os bosses de fim de ato não têm mais recarga: o carimbo antigo (ex.: 72 h do The Primal Menace) não bloqueia mais nada (só o relógio some; progresso e vitórias ficam).
    Bosses.limparRecargasDeAto(this.estado);
    this.estado.bauDaConta = Deposito.caixaDaConta(await B.lerBauDaConta(this.conta.id));
    // O que o mercado entregou enquanto estava fora (venda, compra por anúncio).
    const doMercado = await Mercado.receberCreditos(this.estado, personagem.id);
    // Os presentes da equipe pendentes NA CONTA caem no personagem que entrou (ver `presentes.mjs`).
    const doPresente = await Presentes.receberNaEntrada(this.estado, this.conta?.id, personagem.id);
    // Personagem que já estava acima da capacidade (loot de antes da regra):
    // o excesso vai para o depósito, com aviso no primeiro `state`.
    this.avisoPendente = Deposito.avisoDoExcesso(Deposito.excessoParaODeposito(this.estado)) ?? ([doPresente, doMercado].filter(Boolean).join(' ') || null) ?? daCampanha;
    vivas.set(personagem.nome, this);
    // Reconexão: volta ao lugar na party (se estava como offline) — ver `Party.entrouNoJogo`.
    Party.entrouNoJogo(this);

    /*
     * "Progresso enquanto você esteve fora" — `andamento`, no client — e, se
     * morreu, a conta da morte (`morte`) NO MESMO relatório: uma janela só, com
     * o que a caçada rendeu até a morte e o que a morte custou.
     *
     * O relatório fica gravado no personagem (`relatorioDaAusencia`) até o
     * jogador dar OK (`ackAusencia`). O loot e a morte já foram aplicados ao
     * estado aqui; o que fica pendente é só o AVISO — então reconectar,
     * atualizar a página ou perder a rede antes do OK mostra o mesmo relatório
     * de novo, sem refazer nem duplicar nenhuma recompensa.
     */
    let andamento = null;
    let morteDaAusencia = null;
    if (ausencia) {
      andamento = ausencia.report;
      if (ausencia.morreu) {
        const morte = this.morrerNaHunt();
        morteDaAusencia = morte;
        andamento.motivo =
          `Você morreu caçando enquanto estava fora e perdeu ${morte.lost.toLocaleString('pt-BR')} de experiência` +
          `${morte.goldLost ? ` e ${morte.goldLost.toLocaleString('pt-BR')} de ouro` : ''}` +
          `${morte.levelPerdido ? ` (caiu ${morte.levelPerdido} level)` : ''}.`;
      }
      this.estado.relatorioDaAusencia = { report: andamento, morte: morteDaAusencia, em: Date.now() };
      // Grava já: o aviso e o estado já mexido vão juntos para o banco, e a janela de perder o aviso encolhe.
      this.gravarAgora().catch((e) => console.error('gravar relatório da ausência', e.message));
    } else if (this.estado.relatorioDaAusencia) {
      // Entrou de novo sem ter dado OK: o mesmo relatório, como estava.
      andamento = this.estado.relatorioDaAusencia.report;
      morteDaAusencia = this.estado.relatorioDaAusencia.morte ?? null;
    }

    const completo = characterParaCliente(personagem, this.estado);
    this.lembrarCharacter(completo);
    const itensNesteWelcome = !(this.guardaCatalogo && this.itensJaForam);
    this.itensJaForam = true;
    const rankingDeExp = await Ranking.topo('exp');
    this.enviar({
      t: 'welcome',
      versao: VERSAO_DO_CLIENTE,
      novidades: Novidades.novidades(),
      character: completo,
      /*
       * ---- Caçando, a cidade vai SEM o mapa ----
       * O mapa da cidade são 2,7 MB de JSON, e o cliente, com ele na mão,
       * desenhava a cidade no primeiro quadro — o que pedia o `city.png`
       * (3,8 MB, 64 MB decodificado) para uma tela que o jogador nem vê: o
       * primeiro `state` troca para a hunt logo depois. Sem o mapa, o cliente
       * pede quando voltar para a cidade (`pedirMapa`, main.mjs), que é o mesmo
       * caminho de quando uma hunt termina — o `state` de saída já vem sem ele.
       */
      city: snapshotDaPraca(this.estado, !this.estado.hunt, this),
      // O catálogo real (nome/peso/raridade de 6178 itens) — mandado uma vez
      // por entrada, exatamente como o `welcome` de verdade faz. Sem isto o
      // cliente sabe DESENHAR cada item (os atlas já vieram no passo 1/2 da
      // extração) mas não sabe o NOME de nenhum — todo balão de item ficaria
      // em branco.
      ...(itensNesteWelcome ? { items: ITEM_CATALOG } : {}),
      // As cores do nome por raridade do mob (gamedata/mobs/raridades.json) — a tela pinta o nome com elas.
      mobRaridades: Raridade.coresParaCliente(),
      // O texto de cada modificador, pelo nome (o tooltip do mob — fase 3).
      mobModificadores: Raridade.modificadoresParaCliente(),
      // O top 25 de experiência, como no welcome do original.
      ranking: rankingDeExp,
      // Conectados + quem caça de aba fechada (ver `ausentes.mjs`).
      online: vivas.size + Ausentes.contagem(),
      ...(andamento ? { andamento } : {}),
      ...(morteDaAusencia ? { morte: morteDaAusencia } : {}),
      ...(treinoPendente ? { treinoPendente } : {}),
    });
    // A lista de amigos logo depois do welcome, como o original; e os amigos
    // online veem a bolinha dele acender.
    this.enviar(await Amigos.lista(personagem.nome));
    Amigos.mudouPresenca(personagem.nome).catch((e) => console.error('amigos mudouPresenca', e.message));
  }

  /*
   * ---- Salvamento automático ----
   *
   * O personagem só era gravado ao sair do jogo: um servidor derrubado (uma
   * reinicialização, um travamento) perdia tudo desde o login — compras, itens
   * usados, level. A cada `AUTOSAVE_MS` quem está online é gravado. Numa hunt,
   * a cópia gravada leva `offlineDesde` = agora, então se o servidor cair a
   * volta simula a caçada a partir dali (ver `Cacadas.simularAusencia`); o
   * estado vivo não é tocado.
   */
  async gravarAgora() {
    if (!this.personagem || !this.estado) return;
    const { rumo, rumoValidoAte, proximoPassoEm, destino, bauDaConta, ...estadoPersistido } = this.estado;
    const copia = estadoPersistido.hunt ? { ...estadoPersistido, hunt: { ...Cacadas.huntParaGravar(estadoPersistido.hunt), offlineDesde: Date.now() } } : estadoPersistido;
    // ANTES do `await`: sem isto, o autosave do próximo tique (250ms depois)
    // veria `gravadoEm` ainda velho enquanto esta gravação está em voo (rede,
    // no Postgres) e disparava outra em cima, empilhando escritas.
    this.gravadoEm = Date.now();
    await B.gravarEstadoPersonagem(this.personagem.id, copia);
  }

  soltarPersonagem() {
    // Saiu no meio da simulação offline: nada foi gravado ainda, só descarta.
    if (this.carregando) this.cancelarCarregamento();
    if (!this.personagem) return;
    // Campos de movimento são de ida (calculados a cada tique a partir do
    // último `walk`); gravá-los faria o personagem "lembrar" um rumo vencido
    // — inofensivo (a validade já expirou até a próxima sessão), mas sujo.
    // "O pátio de treino para quando você sai."
    if (this.estado.hunt?.huntId === 'treino') this.estado.hunt = null;
    // Arena x1: sair no meio do duelo é derrota (e o level de verdade volta).
    Arena.saiuDoJogo(this);
    // Party: sai do grupo; a caçada em grupo vira uma cópia só dele (segue offline).
    Party.saiuDoJogo(this);
    // Uma troca aberta é cancelada (e os convites dele somem) — nada fica pela metade.
    Troca.saiuDoJogo(this);
    // Numa hunt, ela segue "offline": grava de quando, e a volta simula o resto.
    if (this.estado.hunt) this.estado.hunt.offlineDesde = Date.now();
    // `bauDaConta` é da conta (tabela própria), não do personagem.
    const { rumo, rumoValidoAte, proximoPassoEm, destino, bauDaConta, ...estadoPersistido } = this.estado;
    if (estadoPersistido.hunt) estadoPersistido.hunt = Cacadas.huntParaGravar(estadoPersistido.hunt);
    // Devolvida (não `await`ada aqui): quem só quer sair rápido (fechar aba,
    // trocar de personagem) ignora o retorno e segue — mesmo fogo-e-esquece
    // de sempre. Quem precisa saber que o disco já tem o dado novo antes de
    // reler (`deixarOffline`, abaixo) pode dar `await` nela.
    const gravando = B.gravarEstadoPersonagem(this.personagem.id, estadoPersistido).catch((e) =>
      console.error('gravar ao sair', this.personagem?.nome, '->', e.message),
    );
    if (vivas.get(this.personagem.nome) === this) vivas.delete(this.personagem.nome);
    // Os amigos online veem a bolinha apagar.
    Amigos.mudouPresenca(this.personagem.nome).catch((e) => console.error('amigos mudouPresenca', e.message));
    this.personagem = null;
    this.estado = null;
    // Sem aba, ninguém vai chamar `desconectar`: sai do relógio aqui.
    if (this.semAba) sessoesNoRelogio.delete(this);
    return gravando;
  }

  /** O mesmo que o cliente confere antes de acender o botão — ver `porQueNaoDaParaDeixarOffline` em main.mjs. */
  motivoParaNaoDeixarOffline() {
    const hunt = this.estado.hunt;
    if (hunt) {
      if (hunt.huntId === 'treino') return 'o pátio de treino para quando você sai; use o exercise.';
      if (hunt.manual) return 'na Caça Online o personagem só anda com você na tela.';
      return null;
    }
    if (this.estado.exercicio?.treinando) return null;
    return 'na cidade não há nada para continuar.';
  }

  /**
   * `send({t:'deixarOffline'})` — o botão "Deixar caçando offline": o mesmo
   * que fechar a aba, só que sem precisar fechar. Sem handler nenhum, o
   * cliente mandava o comando e nunca ouvia `released` de volta — o botão
   * fechava o modal e não acontecia mais nada.
   */
  async deixarOffline() {
    if (!this.estado) return this.erro('Nenhum personagem em jogo.');
    const motivo = this.motivoParaNaoDeixarOffline();
    if (motivo) return this.erro(`Não dá para deixar offline: ${motivo}`);
    // Espera o disco ter o `hunt` novo ANTES de reler a lista — senão
    // `mandarConta` (que lê `personagens` do banco) tinha chance de pegar o
    // personagem ainda "parado", e o cartão na lista não mostrava "Caçando
    // offline em X" até a próxima vez que a conta fosse recarregada.
    await this.soltarPersonagem();
    this.enviar({ t: 'released' });
    await this.mandarConta(null);
  }

  // -------------------------------------------------------------- mundo

  /*
   * O cliente não manda "ande um passo": ele manda o RUMO que o WASD segurado
   * aponta agora (`{dx,dy}`, cada um -1/0/1 — ver `mandarRumo` em main.mjs) e
   * repete a cada 100ms enquanto a tecla estiver presa. Quem decide o RITMO do
   * passo é o servidor — este aqui anda uma casa a cada `R.PASSO_MS` enquanto
   * o rumo mais recente continuar apontando para algum lado. `{dx:0,dy:0}` é o
   * aviso explícito de "soltei a tecla".
   */
  andar({ dx, dy }) {
    if (!this.estado) return;
    // Treinando (pátio ou Exercise), o servidor recusa o passo: o personagem fica no posto.
    if (Treinos.emTreino(this.estado)) {
      this.estado.rumo = null;
      this.estado.destino = null;
      return;
    }
    if (!dx && !dy) {
      this.estado.rumo = null;
      return;
    }
    // A tecla manda mais que o clique: apertou uma direção, larga o destino.
    this.estado.destino = null;
    this.estado.rumo = { dx: Math.sign(dx), dy: Math.sign(dy) };
    this.estado.rumoValidoAte = Date.now() + 500;
  }

  /*
   * ---- `send({t:'walkTo', x, y})` — clique ou toque no mapa da cidade ----
   *
   * O client mandava (clique esquerdo, toque, "Ir até lá") e o servidor não
   * tinha handler: caía no `default` silencioso e o personagem nunca saía do
   * lugar. Aqui só se VALIDA e guarda o destino (`estado.destino`); quem anda é
   * o mesmo `processarMovimento` do teclado — uma casa por `PASSO_MS`, a mesma
   * colisão —, pedindo o passo à busca da caçada (`proximoPassoAte`) sobre a
   * grade da cidade. Um clique novo troca o destino; uma tecla o larga.
   */
  andarAte({ x, y }) {
    if (!this.estado || this.estado.hunt) return;
    const destino = { x: Math.trunc(Number(x)), y: Math.trunc(Number(y)) };
    if (!Number.isFinite(destino.x) || !Number.isFinite(destino.y)) return;
    if (Treinos.emTreino(this.estado)) {
      this.estado.destino = null;
      return this.erro('Treinando: você fica ao lado do boneco até parar o treino.');
    }
    const pos = this.estado.pos;
    if (destino.x === pos.x && destino.y === pos.y) {
      this.estado.destino = null;
      return;
    }
    if (bloqueado(destino.x, destino.y) || !temCaminho(gradeDaCidade(), pos, destino)) {
      this.estado.destino = null;
      return this.erro('Não dá para chegar lá.');
    }
    this.estado.rumo = null;
    this.estado.destino = destino;
  }

  /*
   * Ctrl+WASD: vira sem andar (`main.mjs`'s Ctrl handler manda `{dx,dy}`, a
   * mesma tabela `KEYS` do rumo — não `{dir}`, que nunca chega e deixava isto
   * sempre inerte).
   */
  virar({ dx, dy }) {
    if (!this.estado) return;
    if (dy < 0) this.estado.pos.dir = 0;
    else if (dy > 0) this.estado.pos.dir = 2;
    else if (dx > 0) this.estado.pos.dir = 1;
    else if (dx < 0) this.estado.pos.dir = 3;
  }

  /** Avança um passo, se houver rumo válido e o passo anterior já tiver acabado. */
  processarMovimento() {
    const estado = this.estado;
    if (!estado?.rumo && !estado?.destino) return;
    // Nenhum rumo (ou destino de clique) antigo sobrevive ao começo do treino.
    if (Treinos.emTreino(estado)) {
      estado.rumo = null;
      estado.destino = null;
      return;
    }
    const agora = Date.now();
    if (estado.rumo && agora > (estado.rumoValidoAte ?? 0)) estado.rumo = null;
    if (!estado.rumo && !estado.destino) return;
    if (!R.jaPode(agora, estado.proximoPassoEm)) return;

    const pos = estado.pos;
    let dx;
    let dy;
    if (estado.rumo) ({ dx, dy } = estado.rumo);
    else {
      // O destino do clique/toque: o próximo passo pela busca de sempre, recalculado a cada passo.
      const passo = proximoPassoAte(gradeDaCidade(), pos, estado.destino);
      if (!passo) {
        estado.destino = null;
        return;
      }
      dx = passo.x - pos.x;
      dy = passo.y - pos.y;
    }
    if (dy < 0) pos.dir = 0;
    else if (dy > 0) pos.dir = 2;
    else if (dx > 0) pos.dir = 1;
    else if (dx < 0) pos.dir = 3;
    // Colisão real: `CITY_MAP.blocked` é o mesmo mapa de bloqueio que o
    // servidor original manda (ver `bloqueado`, em `dados.mjs`). Sem o `if`,
    // o personagem atravessava parede — o placeholder antigo só clampava
    // numa caixa, e uma cidade de verdade não é uma caixa.
    const destino = { x: pos.x + dx, y: pos.y + dy };
    if (!bloqueado(destino.x, destino.y)) {
      pos.x = destino.x;
      pos.y = destino.y;
    }
    // Chegou onde clicou.
    if (estado.destino && pos.x === estado.destino.x && pos.y === estado.destino.y) estado.destino = null;
    estado.proximoPassoEm = agora + R.PASSO_MS;
  }

  /**
   * ---- O dano/cura do balão da skill sempre em dia ----
   * O catálogo de ações leva o dano e a cura que cada skill faz AGORA (`Acoes.danoMostrado`,
   * a mesma conta do `disparar`) e a gema dela (nível, XP, supports). Ele vai de novo quando
   * muda o que entra na conta: level, magic level, skills, as gemas (nível, raridade,
   * qualidade), as peças vestidas; e a XP das gemas no máximo a cada 5 s.
   */
  catalogoSeMudou() {
    const e = this.estado;
    const gemas = [];
    for (const p of Object.values(e.equipment ?? {})) for (const g of p?.soquetes?.gemas ?? []) if (g) gemas.push(`${g.id}.${g.nivel}.${g.raridade}.${g.qualidade}`);
    const pecas = Object.entries(e.equipment ?? {}).map(([s, p]) => `${s}:${p?.id ?? ''}:${p?.tier ?? ''}:${p?.af?.length ?? ''}`);
    const assinatura = [e.level, e.magic?.value, e.skills?.melee?.value, e.skills?.distance?.value, gemas.join(','), pecas.join(','), Object.keys(e.hunt?.buffs ?? {}).join(',')].join('|');
    const xp = gemas.length ? Object.values(e.equipment ?? {}).flatMap((p) => (p?.soquetes?.gemas ?? []).map((g) => g?.xp ?? 0)).join(',') : '';
    const agora = Date.now();
    const mudouXp = xp !== this.xpDoCatalogo && agora - (this.catalogoEm ?? 0) >= 5000;
    if (assinatura === this.assinaturaDoCatalogo && !mudouXp) return;
    const primeira = this.assinaturaDoCatalogo == null;
    this.assinaturaDoCatalogo = assinatura;
    this.xpDoCatalogo = xp;
    this.catalogoEm = agora;
    // Na primeira vez o catálogo já foi no welcome/pedido: só guarda a assinatura.
    if (primeira) return;
    Ficha.invalidar(e);
    this.enviar({ t: 'actionCatalog', catalog: Acoes.catalogo(e) });
  }

  mandarEstado(comMapa = false, eventos = []) {
    // A cortina de carregamento da hunt nova vai UMA vez (ver `Cacadas.entrar`).
    const viagem = this.estado?.hunt?.viagem ?? null;
    if (viagem) delete this.estado.hunt.viagem;
    if (!this.personagem) return;
    // Sem aba, não há quem desenhe: montar o quadro seria trabalho para ninguém.
    if (this.semAba) return;
    this.catalogoSeMudou();
    const naHunt = !!this.estado.hunt;
    /*
     * ---- Só o que MUDOU ----
     *
     * O LAG: cada `state` levava o personagem inteiro (~60 KB — o molde real
     * tem `entregas`, `diario`, `mountTasks`...) dez vezes por segundo, e o
     * client relia e redesenhava tudo a cada 100ms. O original manda
     * `charDelta` (capturado ao vivo): só as chaves que mudaram, que o client
     * mescla por cima do que já tem (`applyState`, em main.mjs). `city`/`hunt`
     * iguais ao último envio nem vão — o client mantém o anterior quando a
     * chave falta. Um `state` sem nada novo é pulado, com um envio de
     * garantia por segundo.
     */
    // A troca e o convite de troca (o cliente lê os dois em todo `state`; sem eles, a mesa fecha).
    const msg = { t: 'state', ...Troca.paraCliente(this) };
    const cache = (this.cacheDoCharacter ??= {});
    this.quadrosSemPersonagem = (this.quadrosSemPersonagem ?? 0) + 1;
    const inteiro = !this.characterJaFoi || comMapa || this.characterSujo || this.quadrosSemPersonagem >= QUADROS_POR_PERSONAGEM;
    let completo = null;
    const delta = {};
    if (inteiro) {
      this.quadrosSemPersonagem = 0;
      this.characterSujo = false;
      completo = characterParaCliente(this.personagem, this.estado);
      Object.assign(completo, Party.camposDoPersonagem(this));
      const refs = (this.refDoCharacter ??= {});
      for (const [k, v] of Object.entries(completo)) {
        // ---- O mesmo objeto de antes ----
        // Campo MEMORIZADO (`CAMPOS_MEMORIZADOS`) que voltou como o mesmo objeto não
        // mudou: nem vira texto para comparar (as entregas são ~26 KB por jogador
        // por segundo). Só para esses — a mochila, por exemplo, é o mesmo array
        // mexido no lugar, e pular pela referência esconderia a mudança.
        if (CAMPOS_MEMORIZADOS.has(k) && refs[k] === v) continue;
        if (CAMPOS_MEMORIZADOS.has(k)) refs[k] = v;
        const s = JSON.stringify(v) ?? 'undefined';
        if (cache[k] !== s) {
          delta[k] = v;
          cache[k] = s;
        }
      }
    } else {
      for (const k of CAMPOS_DE_TODO_QUADRO) {
        const v = this.estado[k];
        const s = JSON.stringify(v) ?? 'undefined';
        if (cache[k] !== s) {
          delta[k] = v;
          cache[k] = s;
        }
      }
    }
    // O relógio da auto-venda anda sozinho no cliente (main.mjs, "O relógio da
    // auto-venda, sozinho"): o `pouchValue` (~3 KB) só vai quando a bolsa muda.
    if (!completo && !this.characterJaFoi) completo = characterParaCliente(this.personagem, this.estado);
    if (!this.characterJaFoi) {
      msg.character = completo;
      this.characterJaFoi = true;
    } else if (Object.keys(delta).length) {
      msg.character = delta;
      msg.charDelta = true;
    }
    const city = naHunt ? null : snapshotDaPraca(this.estado, comMapa, this);
    const hunt = naHunt ? Cacadas.snapshotDaHunt(this.estado, comMapa) : null;
    if (hunt) Object.assign(hunt, Party.extrasDoRetrato(this), Arena.extrasDoRetrato(this));
    /*
     * ---- A praça por delta ----
     *
     * Com os outros jogadores na praça, ela muda todo quadro (alguém sempre
     * anda). Mandar a praça INTEIRA de novo — objetos, NPCs, chão — a cada passo
     * de outro jogador seria ~6 KB por quadro à toa. Com o delta ligado vai só a
     * chave que mudou (`cityDelta`, que o cliente mescla — `aplicar`, main.mjs).
     */
    if (!city) this.cacheDaCity = null;
    else if (comMapa || !this.delta || !this.cacheDaCity) {
      msg.city = city;
      this.cacheDaCity = {};
      Quadro.deltaRaso(city, this.cacheDaCity, Quadro.SO_NO_PRIMEIRO_QUADRO);
    } else {
      const mudou = Quadro.deltaRaso(city, this.cacheDaCity, Quadro.SO_NO_PRIMEIRO_QUADRO);
      if (Object.keys(mudou).length) {
        msg.city = mudou;
        msg.cityDelta = true;
      }
    }
    this.quadroDaCacada(msg, hunt, comMapa);
    // Onde ele está no laço da hunt. Vai em TODO quadro, como no original
    // (`run: {passo}`): o client zera o `state.run` quando a chave falta.
    const run = naHunt ? Cacadas.runParaCliente(this.estado) : null;
    if (run) msg.run = run;
    const centro = hunt?.player ?? this.estado.pos;
    const visiveis = Quadro.eventosDoQuadro(eventos, this.delta ? centro : null, this.oculta);
    if (visiveis?.length) msg.events = visiveis;
    if (viagem) msg.viagem = viagem;
    // A faixa de vitória do boss (`mostrarVitoria` no client) vai UMA vez.
    const vitoria = this.estado.hunt?.vitoria;
    if (vitoria) {
      delete this.estado.hunt.vitoria;
      this.enviar({ t: 'victory', ...vitoria });
    }
    if (this.avisoPendente) {
      msg.notice = this.avisoPendente;
      this.avisoPendente = null;
    }
    const agora = Date.now();
    if (Object.keys(msg).length === 1 && agora - (this.ultimoEnvio ?? 0) < 1000) return;
    this.ultimoEnvio = agora;
    this.enviar(msg);
  }

  /** Depois de um envio COMPLETO (`welcome`), o próximo `state` pode ir só com a diferença. */
  lembrarCharacter(completo) {
    this.cacheDoCharacter = {};
    // Recomeça junto: o objeto que acabou de ir inteiro é o "de antes" dos memorizados.
    this.refDoCharacter = {};
    for (const [k, v] of Object.entries(completo)) {
      this.cacheDoCharacter[k] = JSON.stringify(v) ?? 'undefined';
      if (CAMPOS_MEMORIZADOS.has(k)) this.refDoCharacter[k] = v;
    }
    this.characterJaFoi = true;
    this.cacheDaCity = null;
    this.huntNoCliente = null;
  }

  /** O cliente pediu tudo de novo (ou acabou de ligar o delta): o próximo quadro vai inteiro. */
  recomecarQuadros() {
    this.characterJaFoi = false;
    this.cacheDaCity = null;
    this.huntNoCliente = null;
  }

  /*
   * ---- A caçada no quadro: só a tela, e só o que mudou ----
   *
   * Para o cliente que pediu delta (o jogo de verdade), `Quadro` recorta os
   * bichos para a tela e tira a mobília dos que ele já tem, e a caçada vai com
   * `huntDelta`: só as chaves que mudaram. O primeiro quadro de cada caçada (o
   * que leva o `map`) vai inteiro. Quem não pediu delta (as ferramentas, os
   * testes vivos) recebe a caçada inteira, como antes.
   */
  quadroDaCacada(msg, hunt, comMapa) {
    if (!hunt) {
      if (this.huntNoCliente !== undefined && this.huntNoCliente !== 'nenhuma') msg.hunt = null;
      this.huntNoCliente = 'nenhuma';
      this.ultimaHuntInteira = undefined;
      return;
    }
    if (!this.delta) {
      const texto = JSON.stringify(hunt);
      if (comMapa || texto !== this.ultimaHuntInteira) msg.hunt = hunt;
      this.ultimaHuntInteira = texto;
      this.huntNoCliente = null;
      return;
    }
    const base = this.huntNoCliente;
    const inteira = comMapa || 'map' in hunt || !base || base === 'nenhuma' || base.mapId !== hunt.mapId;
    // O radar do minimapa (todos os bichos do andar), ANTES do recorte da tela. Ver `Quadro.radarDosBichos`.
    const radar = Quadro.radarDosBichos(hunt.monsters, hunt.boss?.uid ?? null, hunt.isBoss);
    const agora = Date.now();
    if (!inteira && this.radarAnterior && agora - this.radarEm < Quadro.RADAR_MS && radar.length === this.radarAnterior.length) {
      hunt.radar = this.radarAnterior; // o mesmo de antes: o delta não o leva de novo
    } else {
      hunt.radar = radar;
      this.radarAnterior = radar;
      this.radarEm = agora;
    }
    const { lista, uids } = Quadro.bichosDoQuadro(hunt.monsters, hunt.player, inteira ? null : base.uids);
    hunt.monsters = lista;
    if (inteira) {
      msg.hunt = hunt;
      const textos = {};
      Quadro.deltaRaso(hunt, textos, Quadro.SO_NO_PRIMEIRO_QUADRO);
      this.huntNoCliente = { mapId: hunt.mapId, textos, uids };
      return;
    }
    const d = Quadro.deltaRaso(hunt, base.textos, Quadro.SO_NO_PRIMEIRO_QUADRO);
    if (Object.keys(d).length) {
      msg.hunt = d;
      msg.huntDelta = true;
    }
    base.uids = uids;
  }

  /*
   * `setInterval` não tem quem apare uma exceção — sem este try/catch, um
   * bug em QUALQUER hunt de QUALQUER jogador (aconteceu uma vez com um
   * mapa recém-salvo no `/editor`, `TypeError` em `gradeDaHunt`) derruba o
   * processo Node inteiro e desconecta todo mundo online, não só quem
   * estava na hunt quebrada. Erro aqui só tira ESSE personagem da hunt.
   */
  async tique() {
    if (!this.personagem) return;
    // O char trazido sem aba (ver `contaChar`) só fica no mundo enquanto está
    // numa party; fora dela, sai como quem fecha a aba (a caçada segue offline).
    if (this.semAba && !Party.naParty(this) && Date.now() - this.semAba.desde > SEM_ABA_CARENCIA_MS) return this.desconectar();
    // Um tique novo: a ficha de combate guardada é de antes dele (talvez de um
    // comando, talvez do tique anterior) — pode ter vencido um buff/gema
    // temporária desde então. Sem isto, quem fica tiques parado sem mandar
    // nada (a caçada automática é assim) veria o crítico/dano de um Buff Power
    // que já acabou até o próximo comando chegar. Ver game/systems/ficha.mjs.
    Ficha.invalidar(this.estado);
    // Fogo e esquece, de propósito: o tique não pode esperar a gravação (rede,
    // no Postgres) — o erro só é logado; a próxima passagem por aqui tenta de novo.
    if (Date.now() - (this.gravadoEm ?? Date.now()) >= AUTOSAVE_MS) this.gravarAgora().catch((e) => console.error('autosave', this.personagem?.nome, '->', e.message));
    this.gravadoEm ??= Date.now();
    if (this.estado.hunt) {
      // O destino de um clique na cidade não sobrevive a entrar numa caçada.
      this.estado.destino = null;
      try {
        // Party: quem seguir e a partilha da exp (não-enumeráveis — não vão para o banco).
        const h = this.estado.hunt;
        Object.defineProperty(h, 'guia', { value: Party.guia(this), enumerable: false, writable: true, configurable: true });
        // Reagrupar (o líder chamou a party para perto de alguém) e a atividade (exp só de quem joga) — como o guia, não vão para o banco.
        Object.defineProperty(h, 'reagrupar', { value: Party.reagruparDe(this), enumerable: false, writable: true, configurable: true });
        Party.registrarAtividade(this);
        Object.defineProperty(h, 'partilha', { value: Party.partilha(this), enumerable: false, writable: true, configurable: true });
        // Bônus de pódio da Arena (mesmo padrão de guia/partilha): calculado aqui,
        // uma vez por tique, para `matarMonstro` (game/systems/hunt/combate.mjs) não
        // precisar importar `arena.mjs` (sessão, vivas, banco) — isso é o que deixa a
        // simulação da hunt pura o bastante para rodar num worker_thread (Fase 5).
        Object.defineProperty(h, 'podio', { value: Arena.bonusDoPodio(this.personagem.nome), enumerable: false, writable: true, configurable: true });
        if (h.isBoss) this.ultimoBoss = h.bossId;
        // Arena x1: a largada, o degrau dos bichos e o golpe no adversário.
        Arena.antesDoTique(this);
        if (!this.estado.hunt) return this.mandarEstado();
        // Fase 5: hunt SOLO (sem grupo, sem arena) pode rodar num worker —
        // decidido de novo a cada tique, porque quem entra/sai de grupo muda
        // isso na hora. `h.partilha.membros.length > 1` é o mesmo sinal que
        // `matarMonstro` já usa para saber se `hunt.monstros` é a MESMA
        // referência de outro jogador (ver o comentário no topo de
        // `game/systems/simulador-tique.mjs`) — level/distância só desligam o
        // bônus de exp (`partilha.ativa`), não a partilha do array, por isso o
        // teste é no tamanho de `membros`, não em `ativa`.
        //
        // Janela conhecida, não fechada: se alguém entra na sala bem no
        // instante em que ESTE tique já está em voo dentro do worker, a
        // resposta troca `this.estado` (e a referência de `hunt.monstros`)
        // por uma nova depois que a sala já capturou a antiga — poucos
        // milissegundos de janela, e o próximo tique já volta a rodar aqui
        // (elegibilidade é recalculada sempre), então não se acumula; só pode
        // deixar os bichos daquela sala visivelmente errados até alguém sair
        // e entrar de novo. Fechar isso de vez pede o dono da sala nunca ir
        // para worker enquanto ainda pode ser convidado — fora do escopo
        // desta fase (ver o plano, "fora do escopo").
        const eSolo = !h.pvp && !(h.partilha && h.partilha.membros.length > 1);
        const agoraDoTique = Date.now();
        let eventos;
        if (SimuladorTique.ligado && eSolo) {
          // `hunt.guia`/`hunt.partilha`/`hunt.podio` são não-enumeráveis (de
          // propósito: não vão para o banco) — `postMessage` faz clone
          // estruturado, que só leva propriedade ENUMERÁVEL. `guia`/`partilha`
          // não fazem falta do outro lado (`eSolo` já garante ninguém junto;
          // ausentes, o código de combate toma o mesmo caminho de "sozinho"
          // que tomaria com eles presentes e vazios). `podio` é diferente —
          // vale mesmo sozinho (bônus semanal da Arena) — por isso vai à parte.
          const r = await SimuladorTique.tique(this.estado, this.personagem, agoraDoTique, h.podio);
          this.estado = r.estado;
          eventos = r.eventos;
        } else {
          eventos = Cacadas.tique(this.estado, this.personagem, agoraDoTique);
        }
        // Itens que o rodízio da party deu a ESTE char nos golpes dos outros: o "Loot of a ..." no chat dele.
        const daParty = tirarEventosDaParty(this.estado);
        if (daParty) eventos = [...(eventos ?? []), ...daParty];
        if (this.estado.avisoDaHunt) {
          this.avisoPendente = this.estado.avisoDaHunt;
          delete this.estado.avisoDaHunt;
        }
        // "Seguir" ligado e a fase completa: a próxima fase, no mesmo modo.
        // Só com a aba aberta: o char trazido sem aba (party) é offline, fica em loop.
        if (!this.semAba && this.estado.hp > 0) this.seguirParaAProximaFase();
        // Caça Automática + portal do boss aberto (limpeza confirmada pelo servidor): entra sozinha, uma tentativa só por portal.
        if (!this.semAba && this.estado.hp > 0) this.entrarAutomaticoNoPortal();
        // A caixa "Você morreu" do client (`mostrarMorte`), no formato do `death` original.
        // Cair no duelo não é morte: é derrota, sem perder nada (ver `Arena.caiu`).
        if (this.estado.hp <= 0 && !Arena.caiu(this)) this.enviar({ t: 'death', ...this.morrerNaHunt() });
        if (!this.estado.hunt) return this.mandarEstado(false, eventos);
        this.mandarEstado(false, eventos);
      } catch (e) {
        console.error('tique hunt', this.estado.hunt?.huntId, '->', e.message);
        this.morrerNaHunt({ real: false });
        this.mandarEstado();
      }
      return;
    }
    const agora = Date.now();
    // Saiu de uma sala de boss (vitória, 25 min, teleporte): a rotação espera a pausa.
    if (this.ultimoBoss) {
      Bosses.depoisDoBoss(this.estado, agora);
      this.ultimoBoss = null;
    }
    const proximoBoss = Bosses.proximoDoAuto(this.estado, agora);
    if (proximoBoss) {
      const r = Cacadas.entrar(this.estado, { huntId: proximoBoss, mode: 'auto', strategy: this.estado.settings?.strategy });
      if (!r.ok) this.avisoPendente = r.erro;
    }
    if (this.estado.avisoDaHunt) {
      this.avisoPendente = this.estado.avisoDaHunt;
      delete this.estado.avisoDaHunt;
    }
    /*
     * ---- Regeneração e stamina: uma vez por segundo, não quatro ----
     *
     * As duas são só matemática proporcional ao tempo (`ms/1000 * taxa`, com
     * o resto fracionário guardado — `regenResto`, em `Cacadas.regenerar` —
     * para não perder nada arredondando): chamar com 1000ms de uma vez dá
     * exatamente o mesmo resultado que chamar 4 vezes com 250ms. Na cidade
     * (sem golpe, sem bicho) é praticamente todo o custo do tique de quem só
     * está parado ali — medido, tools/carga.mjs 200 "na cidade": CPU 35%->29%
     * só com o cache da ficha (ver Ficha.combate), e regenerar ainda pesava
     * tanto quanto ele no perfil.
     *
     * `ultimaRegen` seguiu por tique, sem represar: `processarMovimento` (uma
     * casa por PASSO_MS, bem menor que 1s) e `Exercicio.tique` (o efeito de
     * CADA golpe no boneco, que ficaria represado e apareceria tudo de golpe
     * no cliente se esperasse 1s) precisam do intervalo de verdade.
     */
    const desdeARegen = agora - (this.regenadoEm ?? agora);
    // `??=` FORA do `if`: sem isto, antes do 1º segundo `regenadoEm` continua
    // undefined, o `?? agora` do próximo tique cai de novo em "agora" (o
    // `agora` DAQUELE tique, sempre mais novo) e a conta nunca sai de zero —
    // o regen represava para sempre, e é exatamente o bug que o teste
    // "não regenera antes de 1s, regenera ao completar" pegou.
    this.regenadoEm ??= agora;
    if (desdeARegen >= 1000) {
      Cacadas.regenerar(this.estado, desdeARegen);
      Stamina.recuperar(this.estado, desdeARegen);
      this.regenadoEm = agora;
    }
    // Os golpes no boneco (o efeito de cada carga gasta) vão junto com o estado.
    const golpes = [];
    const doTreino = Exercicio.tique(this.estado, agora - (this.ultimaRegen ?? agora), golpes);
    if (doTreino) this.enviar(doTreino);
    this.ultimaRegen = agora;
    this.processarMovimento();
    // Treinando no Exercise, a posição é a do posto (movimento é recusado em
    // `andar`); a distância NÃO encerra mais o treino — isto só garante a
    // integridade, devolvendo ao posto se algo o tirou de lá.
    Exercicio.manterNoPosto(this.estado);
    this.mandarEstado(false, golpes);
  }

  /**
   * A morte do original (`Morte.morrer`): experiência pela curva do Tibia com
   * teto de 80% de um level e o desconto das bênçãos/promoção, 20% do ouro
   * carregado, e as bênçãos queimadas. Volta pra cidade com a vida cheia.
   * `real: false` é a saída por erro do servidor (o `catch` do tique): um bug
   * nosso não pode custar nada. Devolve os campos do `death`.
   */
  morrerNaHunt({ real = true } = {}) {
    if (real) Party.voltarComOLider(this, 'morreu');
    Party.antesDeSairDaCacada(this);
    // "Morrer para a rotação" do Auto Boss.
    if (real) Bosses.pararPorMorte(this.estado);
    const morte = real ? Morte.morrer(this.estado, descerDeLevel) : { lost: 0, goldLost: 0 };
    if (real) Ficha.totais(this.estado).deaths += 1;
    this.estado.hunt = null;
    this.estado.hp = this.estado.maxHp;
    this.estado.es = null; // Energy Shield cheio de novo
    this.estado.pos = { ...R.POSICAO_INICIAL };
    return morte;
  }

  desconectar() {
    sessoesNoRelogio.delete(this);
    this.soltarPersonagem();
  }
}

/*
 * ---- Um relógio para todos — em FATIAS ----
 *
 * Cada sessão tinha o seu `setInterval` de 250 ms. No Windows o timer tem
 * granulação de ~15 ms e o intervalo escorregava: os quadros saíam a cada
 * ~262 ms (medido, tools/carga.mjs), e com mais jogadores cada um escorregava
 * de um jeito. Um relógio só roda todas as sessões e marca o PRÓXIMO quadro
 * pela hora certa (`proximo += PASSO`), não "250 ms depois de agora": o
 * atraso de um quadro é descontado do seguinte, e a média fica em 250 ms.
 *
 * Isso resolveu o RITMO — mas com muita gente, "todo mundo de uma vez" ainda
 * é um laço só, síncrono: 200 jogadores caçando levavam ~167 ms de cada
 * 250 ms rodando (medido, docs/auditoria-performance.md), e QUALQUER
 * mensagem que chegasse nesse meio-tempo — um clique, um `ping` — esperava
 * atrás do laço inteiro. Daí as `FATIAS`: em vez de tocar todo mundo a cada
 * 250 ms, cada sessão entra numa fatia FIXA (sorteada uma vez, na conexão) e
 * só ela é tocada a cada passo de 50 ms — um quinto da gente, cinco vezes
 * mais rápido. Em 250 ms (5 passos de 50 ms) todo mundo foi tocado UMA vez,
 * exatamente como antes; o que muda é que nenhuma pausa síncrona passa de um
 * quinto do tamanho de hoje.
 *
 * Quem liga é o `index.mjs` (`ligarRelogio`); os testes criam sessões sem
 * ele e tocam `tique()` à mão — o relógio nunca entra no meio de um teste.
 */
export const FATIAS = 5;
const sessoesPorFatia = Array.from({ length: FATIAS }, () => new Set());
let proximaFatiaLivre = 0;

/** As sessões vivas, para quem soma (`vivas.size` no `welcome`/`hello` continua por `vivas`, não por aqui). */
const sessoesNoRelogio = {
  add(sessao) {
    // Round-robin: cada conexão nova cai na fatia que está há mais tempo sem
    // receber ninguém, então mesmo com gente entrando e saindo o tempo todo
    // as cinco continuam de tamanho parecido.
    sessao.fatia = proximaFatiaLivre;
    proximaFatiaLivre = (proximaFatiaLivre + 1) % FATIAS;
    sessoesPorFatia[sessao.fatia].add(sessao);
  },
  delete(sessao) {
    if (sessao.fatia != null) sessoesPorFatia[sessao.fatia].delete(sessao);
  },
};

const PASSO_DO_RELOGIO = 1000 / R.TICKS_POR_SEGUNDO;
const PASSO_DA_FATIA = PASSO_DO_RELOGIO / FATIAS;
let proximoQuadro = 0;
let relogioLigado = false;
let fatiaAtual = 0;

function rodarRelogio() {
  // O índice espacial da praça (Chat.jogadoresNaPraca, Fase 4.1) é bom para
  // este passo inteiro: refazê-lo aqui, uma vez, é MUITO mais barato que
  // deixar cada sessão tocada reconstruir a varredura de todo mundo sozinha.
  Chat.invalidarIndice();
  for (const s of sessoesPorFatia[fatiaAtual]) {
    // `tique()` é async agora (Fase 5: pode esperar um worker de simulação) —
    // `try/catch` em volta de uma chamada async NUNCA pega o erro (vira
    // sempre rejeição da Promise, mesmo o que estoura antes do 1º `await`),
    // daí o `.catch()` na Promise em vez de `try/catch` ao redor da chamada.
    s.tique().catch((e) => console.error('tique', s.personagem?.nome, '->', e.message));
  }
  fatiaAtual = (fatiaAtual + 1) % FATIAS;
  const agora = performance.now();
  // Atrasou mais de uma fatia inteira (servidor engasgado): recomeça da hora
  // atual em vez de disparar vários passos seguidos para "alcançar".
  proximoQuadro = Math.max(proximoQuadro + PASSO_DA_FATIA, agora);
  setTimeout(rodarRelogio, proximoQuadro - agora);
}

export function ligarRelogio() {
  if (relogioLigado) return;
  relogioLigado = true;
  proximoQuadro = performance.now() + PASSO_DA_FATIA;
  setTimeout(rodarRelogio, PASSO_DA_FATIA);
}
