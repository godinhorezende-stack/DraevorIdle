// Os FRASCOS do PoE (sistema de itens do PoE — só com ITENS_POE=1): de Vida, de Mana e de Utilidade, com os atributos da base, os
// modificadores (prefixos/sufixos) e os únicos do catálogo importado.
//
//   O CINTO: 5 vagas (`estado.frascos`), fora do equipamento — o frasco vai da mochila para o cinto e volta (`por`/`tirar`).
//   CARGAS: cada frasco guarda as dele (`peca.poe.cargas`); usar gasta `cargasPorUso`; matar dá cargas a TODOS os frascos do cinto pela
//           raridade do monstro (`regras.frascos.cargasPorMorte`, × a Recuperação de Cargas do frasco). Entrar numa caçada enche todos
//           (no PoE eles enchem na cidade).
//   USO: automático na caçada (é um jogo idle): o de Vida com a vida abaixo de `vidaAbaixoPct`, o de Mana com a mana abaixo de
//        `manaAbaixoPct`, os de Utilidade sempre que há monstro vivo e o efeito acabou. Um frasco não é usado de novo enquanto o efeito
//        dele dura.
//   EFEITO: Vida/Mana recuperam `quantidade` ao longo de `segundos` (ou na hora, com "Recuperação Instantânea"); Utilidade dá o efeito
//           da base (`regras.frascos.utilidade`: o Rubi +50% de resistência a fogo...) e as linhas "... durante o Efeito" dos mods, como
//           atributos somados na ficha enquanto dura (`adds`, juntado em `Afixos.soma`).
// O que o Draevor ainda não tem (imunidades a sangramento/congelamento, lentidão em inimigos, solo consagrado...) fica REGISTRADO: aparece
// no frasco, mas não faz nada ainda (`parametros(...).registrados`).
import { ligado, REGRAS } from './catalogo.mjs';
import * as Aliados from './aliados.mjs';
import { traduzirParte } from './traduzir.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { darPeca, cabeNaMochila, erroDeEspaco } from '../inventario.mjs';
import { camposDaPeca } from '../itens/item.mjs';
import * as Dot from '../combate/dot.mjs';
import { vidaSoPeloDreno, marcar, reservadoAgora, criarSoloCongelado, ganharBuff, empurrar, ganharAlmaVaal } from './condicoes-poe.mjs';
import * as CargasPoe from './cargas.mjs';
import * as Tinturas from './tinturas.mjs';
import * as Salvaguarda from '../personagem/salvaguarda.mjs';
import { quebrarGelo, porLento } from './gemas-gbd.mjs';

// (12/10: + as TINTURAS — `itens-poe/tinturas.mjs`: vão no mesmo cinto, sem cargas; ativam e desativam.)
// (04/11: + os FRASCOS HÍBRIDOS — recuperam Vida E Mana no mesmo uso, cada um com a quantidade da base: `recupera` e `recupera_mana`.)
export const CLASSES = ['Life_Flasks', 'Mana_Flasks', 'Utility_Flasks', Tinturas.CLASSE, 'Hybrid_Flasks'];
const TIPO_DA_CLASSE = { Life_Flasks: 'vida', Mana_Flasks: 'mana', Utility_Flasks: 'utilidade', [Tinturas.CLASSE]: 'tintura', Hybrid_Flasks: 'hibrido' };
/**
 * O frasco conta como de `tipo` ('vida', 'mana', 'utilidade')? O HÍBRIDO conta como de Vida E de Mana, como no PoE (o PoB: `flask.life` e
 * `flask.mana` na base do híbrido — a recuperação de cada um, as condições "durante o efeito de um Frasco de Vida/Mana" e os usos).
 */
export const contaComo = (peca, tipo) => {
  const t = TIPO_DA_CLASSE[peca?.poe?.classe ?? ITEM_CATALOG[peca?.id]?.poe?.classe];
  return t === tipo || (t === 'hibrido' && (tipo === 'vida' || tipo === 'mana'));
};
const ehTinturaDoCinto = (p) => Tinturas.ehTintura(p?.poe);
const F = () => REGRAS.frascos ?? {};
export const VAGAS = () => F().vagas ?? 5;

/** É um frasco do PoE (a peça do jogo ou o item do catálogo)? */
export const ehFrasco = (p) => CLASSES.includes(p?.poe?.classe ?? ITEM_CATALOG[p?.id]?.poe?.classe);

/** O cinto do personagem: sempre `VAGAS()` posições (null = vaga livre). */
export function cinto(estado) {
  const c = (estado.frascos ??= []);
  while (c.length < VAGAS()) c.push(null);
  return c;
}

// ---------------------------------------------------------------- os números de um frasco

/** O texto de um mod com os valores no lugar de `{n}`. */
const preencher = (modelo, valores) => String(modelo ?? '').replace(/\{(\d+)\}/g, (_, i) => String(valores?.[Number(i)] ?? '?'));

const ADIVINHACOES = Object.freeze(['adivinhacaoDano', 'adivinhacaoVelocidade', 'adivinhacaoResistencia', 'adivinhacaoMovimento']);
/** As regras das linhas que mexem no FRASCO (e não no personagem). `p` = os parâmetros sendo montados; `v` = o número da linha. */
const REGRAS_DO_FRASCO = [
  // (07/11, lote 14, o Colhedor de Almas) "Ganha Almas Vaal igual às Cargas Consumidas ao usar" (as Almas viram a recarga das Vaal — `acoes.ganharAlmasVaal`)
  [/^Ganha Almas Vaal igual às Cargas Consumidas ao usar$/, (p) => (p.almasPorCarga = true)],
  // (07/11, lote 19 das inertes — sem fonte, o Vinho do Profeta) "Ao usar, concede um bônus de Adivinhação aleatório por N segundos": um de quatro (Dano, Velocidade,
  // Resistências, Movimento — `condicoes-poe.BUFFS.adivinhacao*`), sorteado no uso
  [/^Ao usar, concede um bônus de Adivinhação aleatório por \{\d+\} segundos$/, (p, v) => (p.adivinhacaoS = v)],
  // (06/11, lote 11 das inertes, a Fé Engarrafada) "Solo Sagrado criado por este Frasco possui Raio Triplicado" e "Solo Sagrado criado durante o Efeito aplica Dano sofrido
  // aumentado em X% aos Inimigos" (os monstros nele — `solos-seus.tique`)
  [/^Solo Sagrado criado por este Frasco possui Raio Triplicado$/, (p) => (p.soloRaioMult = 3)],
  [/^Solo Sagrado criado durante o Efeito aplica Dano sofrido aumentado em \{\d+\}% aos Inimigos$/, (p, v) => (p.duranteExtra.solo_sagrado_dano_sofrido = (p.duranteExtra.solo_sagrado_dano_sofrido ?? 0) + v)],
  // (02/11, dono: a Salvaguarda como o PoE) o Frasco de Ferro: "Restaura Proteção ao usar" — a Salvaguarda volta inteira no uso (`usar` → `Salvaguarda.restaurar`)
  [/^Restaura Proteção ao usar$/, (p) => (p.restauraSalvaguarda = true)],
  // (02/11, a Preparação de Vorana) "Efeito é removido quando a Proteção Quebrar": o efeito acaba na quebra (`personagem/salvaguarda.quebrar`)
  [/^Efeito é removido quando a Proteção Quebrar$/, (p) => (p.saiNaQuebra = true)],
  [/^Velocidade de Recuperação aumentada em \{\d+\}%$/, (p, v) => (p.velocidadePct += v)],
  [/^Velocidade de Recuperação reduzida em \{\d+\}%$/, (p, v) => (p.velocidadePct -= v)],
  [/^Quantidade Recuperada aumentada em \{\d+\}%$/, (p, v) => (p.quantidadePct += v)],
  [/^Quantidade Recuperada reduzida em \{\d+\}%$/, (p, v) => (p.quantidadePct -= v)],
  // ("Vida Recuperada…" só na Vida, "Mana Recuperada…" só na Mana — no Frasco Híbrido faz diferença; nos outros é a quantidade dele.)
  [/^(Vida|Mana) Recuperada aumentada em \{\d+\}%$/, (p, v, m) => (p[m[1] === 'Mana' ? 'quantidadeManaPct' : 'quantidadeVidaPct'] += v)],
  [/^(Vida|Mana) Recuperada reduzida em \{\d+\}%$/, (p, v, m) => (p[m[1] === 'Mana' ? 'quantidadeManaPct' : 'quantidadeVidaPct'] -= v)],
  [/^Recuperação Instantânea$/, (p) => (p.instantaneo = true)],
  [/^Recuperação de Cargas aumentada em \{\d+\}%$/, (p, v) => (p.recargaPct += v)],
  [/^Recuperação de Cargas reduzida em \{\d+\}%$/, (p, v) => (p.recargaPct -= v)],
  [/^\+\{\d+\} ao Máximo de Cargas$/, (p, v) => (p.cargasMaximas += v)],
  [/^Cargas reduzidas em \{\d+\}% por uso$/, (p, v) => (p.custoPct -= v)],
  [/^Cargas aumentadas em \{\d+\}% por uso$/, (p, v) => (p.custoPct += v)],
  [/^Duração aumentada em \{\d+\}%$/, (p, v) => (p.duracaoPct += v)],
  [/^Duração reduzida em \{\d+\}%$/, (p, v) => (p.duracaoPct -= v)],
  [/^\{\d+\}% menos Duração$/, (p, v) => (p.duracaoMenos *= 1 - v / 100)],
  [/^\{\d+\}% mais Duração$/, (p, v) => (p.duracaoMenos *= 1 + v / 100)],
  [/^Efeito aumentado em \{\d+\}%$/, (p, v) => (p.efeitoPct += v)],
  [/^Efeito reduzido em \{\d+\}%$/, (p, v) => (p.efeitoPct -= v)],
  [/^\{\d+\}% mais Recuperação se usado enquanto em Vida Baixa$/, (p, v) => (p.maisNaVidaBaixaPct += v)],
  [/^Recupera um adicional de \{\d+\}% da Quantidade de Recuperação do Frasco em \{\d+\} segundos se usado enquanto não estiver em Vida Cheia$/, (p, v) => (p.quantidadePct += v)],
  // (07/10 — "colocando igual no PoE": os que ficavam só registrados.)
  [/^\{\d+\}% da Recuperação aplicada Instantaneamente$/, (p, v) => (p.instantaneoPct += v)],
  [/^Recuperação Instantânea quando em Vida Baixa$/, (p) => (p.instantaneoNaVidaBaixa = true)],
  [/^Recuperação de Mana ocorre instantaneamente no término do Efeito$/, (p) => (p.instantaneoNoFim = true)],
  [/^Efeito não é removido quando a Mana Não Reservada Encher$/, (p) => (p.naoParaNoCheio = true)],
  [/^Efeito não se Acumula$/, (p) => (p.naoAcumula = true)],
  [/^Efeito é removido quando Acertado por um Jogador$/, (p) => (p.saiNoPvp = true)],
  [/^Retira \{\d+\}% de (?:Vida|Mana) Recuperada da (Mana|Vida) quando utilizado$/, (p, v) => (p.custoDaOutraPct += v)],
  [/^Repassa \{\d+\}% da Recuperação de Vida para Lacaios$/, (p, v) => (p.lacaiosPct += v)],
  [/^\{\d+\}% de chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico$/, (p, v) => (p.cargaNoCriticoPct += v)],
  [/^Ganhe \{\d+\} Cargas a[io] ser Acertado por um Inimigo$/, (p, v) => (p.cargasAoSerAcertado += v)],
  [/^Remove Maldições ao usar$/, (p) => (p.aoUsar.removerMaldicao = true)],
  [/^Remove todos os Incêndios quando usado$/, (p) => (p.aoUsar.removerIncendio = true)],
  [/^Concede Imunidade a (Desaceleração|Mutilação|Sangramento|Sangue Corrompido|Eletrização|Resfriamento|Congelamento|Incêndio|Envenenamento) por \{\d+\} segundos se usado enquanto .+$/, (p, v, m) => p.aoUsar.imunidades.push({ afeccao: IMUNIDADE[m[1]], ms: v * 1000 })],
  [/^Desacelera Inimigos próximos com Velocidade de Movimento reduzida em \{\d+\}% se usado enquanto não estiver em (?:Vida|Mana) Cheia$/, (p, v) => (p.aoUsar.desacelerarPct = v)],
  [/^Provoca Inimigos próximos ao usar$/, (p) => (p.aoUsar.provocar = true)],
  [/^Cria Solo Congelado ao Utilizar$/, (p) => (p.aoUsar.solo = 'congelado')],
  [/^Cria uma Nuvem de Fumaça ao ser Utilizado$/, (p) => (p.aoUsar.fumaca = true)],
  [/^Cria Solo Sagrado ao ser Utilizado$/, (p) => (p.aoUsar.solo = 'sagrado')],
  // (05/11, lote 1 dos únicos — dono: "resolver as linhas sem efeito dos Únicos") o que os frascos únicos fazem AO SER USADOS e NO TÉRMINO do efeito
  [/^Ganha \{\d+\} Cargas? de (Tolerância|Frenesi|Poder) ao usar$/, (p, v, m) => p.aoUsar.cargas.push({ tipo: CARGA[m[1]], n: v })],
  [/^Remove \{\d+\}% do seu Escudo de Energia máximo quando usado$/, (p, v) => (p.aoUsar.perdeEsPct = v)],
  [/^Você recebe \{\d+\}% da sua Vida máxima como Dano de Caos quando usado$/, (p, v) => (p.aoUsar.danoCaosVidaPct = v)],
  [/^Remove \{\d+\}% de vida quando usado$/i, (p, v) => (p.aoUsar.perdeVidaPct = v)],
  [/^Inicia recarga do escudo de energia quando usado$/i, (p) => (p.aoUsar.recargaEs = true)],
  [/^Recupera \{\d+\}% de Vida ao usar$/, (p, v) => (p.aoUsar.vidaPct += v)],
  [/^Remove toda Vida deixando sobrar \{\d+\}$/, (p, v) => (p.aoUsar.vidaAte = Math.max(1, v))],
  [/^Vida Removida é regenerada como Escudo de Energia durante \{\d+\} segundos$/, (p, v) => (p.aoUsar.vidaRemovidaComoEsS = v)],
  [/^Inimigos são Empurrados em uma Área ao usar o Frasco$/, (p) => (p.aoUsar.empurrar = true)],
  [/^\{\d+\}% de chance de fazer Inimigos Fugirem quando usado$/, (p, v) => (p.aoUsar.fugaPct = v)],
  [/^Inflige Exposição a Fogo, Gelo e Raio em Inimigos próximos quando usado$/, (p) => (p.aoUsar.exposicao = true)],
  [/^Consome Cargas de Frenesi com o uso$/, (p) => (p.aoUsar.consomeFrenesi = true)],
  [/^Ganhe Agressividade por \{\d+\} segundos por Carga de Frenesi consumida ao usar$/, (p, v) => (p.aoUsar.agressividadePorFrenesiS = v)],
  [/^Recupera \{\d+\}% da Vida por Carga de Tolerância ao usar$/, (p, v) => (p.aoUsar.vidaPorToleranciaPct = v)],
  [/^Perde todas as Cargas de Tolerância ao usar$/, (p) => (p.aoUsar.perdeTolerancias = true)],
  [/^Recupera Toda a Vida ao término do Efeito$/, (p) => (p.noFim.vidaPct = 100)],
  [/^Debilita os Inimigos próximos por \{\d+\} Segundos no término do Efeito$/, (p, v) => (p.noFim.debilitarS = v)],
  // (o Colhedor de Almas: "70 ao Máximo de Cargas" — sem o "+" — e "Consome o Máximo de Cargas ao usar")
  [/^\{\d+\} ao Máximo de Cargas$/, (p, v) => (p.cargasMaximas += v)],
  [/^Consome o Máximo de Cargas ao usar$/, (p) => (p.consomeTudo = true)],
  [/^Perde todas as Cargas ao entrar em uma nova área$/, (p) => (p.perdeAoEntrar = true)],
  // (o Sabor Proibido: o Caos por segundo é do efeito do frasco)
  [/^\{\d+\}% da Vida máxima sofrida como Dano de Caos por segundo$/, (p, v) => (p.duranteExtra.perde_vida_pct_s = (p.duranteExtra.perde_vida_pct_s ?? 0) + v)],
  // (O Sábio Carvalho: o elemento é o da sua Resistência total mais baixa / mais alta — escolhido no uso, `usar`)
  [/^Durante o Efeito, Dano sofrido é reduzido em \{\d+\}% de cada Elemento para o qual sua Resistência Elemental Total for menor$/, (p, v) => (p.sabio.reducao = v)],
  [/^Durante o Efeito, Dano Penetra \{\d+\}% da Resistência de cada Elemento para o qual sua Resistência Elemental Total for maior$/, (p, v) => (p.sabio.penetra = v)],
  // (os "durante o Efeito" escritos no meio da frase: entram nos atributos do efeito, como os do fim)
  [/^Inimigos Incendiados por você durante o Efeito sofrem Dano aumentado em \{\d+\}%$/, (p, v) => (p.duranteExtra['dmg_inc@alvoIncendiado'] = (p.duranteExtra['dmg_inc@alvoIncendiado'] ?? 0) + v)],
  [/^Inimigos Mortos por você durante o Efeito têm \{\d+\}% de chance de Explodirem, causando um décimo de sua Vida máxima como Dano de um Elemento Aleatório$/, (p, v) => (p.duranteExtra['ev:matar:explodirChance:10:aleatorio'] = v)],
  [/^Eletriza Inimigos próximos durante o Efeito, causando \{\d+\}% de Dano sofrido aumentado$/, (p, v) => (p.eletrizaProximosPct = v)],
  // (06/11, os Únicos — lote 5) a Progênese (a Vida perdida adiada — `mods-poe.adiarDano`), o Cálice Transbordante (sem Cargas de Frasco durante o efeito), o
  // Último Suspiro de Zerphi (a Vida pelo custo de Mana, durante o efeito) e a Urna Come-Cinzas (as Cargas ao consumir um cadáver — `aoConsumirCadaver`)
  [/^Quando Acertado durante o Efeito, \{\d+\}% da Vida perdida do Dano sofrido ocorre durante \{\d+\} segundos ao invés$/, (p, v) => (p.duranteExtra.dano_adiado_pct = (p.duranteExtra.dano_adiado_pct ?? 0) + v)],
  [/^Não Recebe Cargas durante o Efeito de qualquer Frasco Cálice Transbordante$/, (p) => (p.duranteExtra.sem_cargas_de_frasco = 1)],
  [/^Concede Último Suspiro quando você Usa uma Habilidade durante o Efeito, por \{\d+\}% do Custo de Mana$/, (p, v) => (p.duranteExtra['ev:gastarMana:vidaPorMana'] = (p.duranteExtra['ev:gastarMana:vidaPorMana'] ?? 0) + v)],
  [/^Recarrega \{\d+\} Cargas ao consumir um Corpo Incendiado$/, (p, v) => (p.cargasAoConsumirCadaver = (p.cargasAoConsumirCadaver ?? 0) + v)],
  [/^Você fica Eletrizado durante o Efeito, recebendo um aumento de \{\d+\}% do Dano sofrido$/, (p, v) => (p.duranteExtra.dano_recebido_inc = (p.duranteExtra.dano_recebido_inc ?? 0) + v)],

];
// (05/11) "durante o Efeito" no fim em qualquer caixa ("durante o efeito" da Promessa de Atziri e do Sabor do Ódio) e "Durante o Efeito, …" no começo
// (O Sábio Carvalho): antes só a forma com E maiúsculo no fim casava, e essas linhas ficavam sem efeito
const CARGA = { Tolerância: 'tolerancia', Frenesi: 'frenesi', Poder: 'poder' };
const DURANTE = /(?: durante o (?:efeito(?: do frasco)?)$|^durante o efeito, )/i;
// (07/11, lote 14, o Apanhador de Almas) o "durante o efeito" no MEIO da frase das Vaal: "Habilidades Vaal utilizadas durante o efeito possuem…" (a regra é da frase inteira)
const DURANTE_NO_MEIO = /^Habilidades Vaal utilizadas durante o efeito /i;
/** "Concede Imunidade a X … se usado enquanto X": a afecção do PoE → o efeito do jogo que ela tira (e de que fica imune). */
const IMUNIDADE = { Desaceleração: 'lento', Mutilação: 'lento', Sangramento: 'sangramento', 'Sangue Corrompido': 'sangramento', Eletrização: 'eletrizacao', Resfriamento: 'resfriamento', Congelamento: 'congelamento', Incêndio: 'incendio', Envenenamento: 'veneno' };
/** Os mods do PERSONAGEM que mexem nos frascos ("Recuperação de Vida do Frasco aumentada", "Duração do efeito do Frasco"…): quem lê é a ficha. */
// (`var` + declaração de função: a ficha registra o leitor enquanto os módulos ainda carregam — o ciclo ficha ↔ frascos.)
// eslint-disable-next-line no-var
var leitorDoPersonagem;
export function definirLeitor(fn) { leitorDoPersonagem = fn; }
const doPersonagem = (estado) => (estado && leitorDoPersonagem ? leitorDoPersonagem(estado) ?? {} : {});

/**
 * Os parâmetros de um frasco (a base + os mods): `{ tipo, recurso, quantidade, ms, instantaneo, cargasPorUso, cargasMaximas, duracaoMs,
 * efeitoPct, recargaPct, durante: { af }, linhas: [{ texto, estado }] }`. As linhas que não casam com nada ficam `registrado`.
 */
export function parametros(peca, afDoPersonagem = null) {
  const poe = peca?.poe ?? {};
  // (a Tintura tem os parâmetros dela: a Queima de Mana, a recarga, o Efeito — `tinturas.parametros`)
  if (Tinturas.ehTintura(poe)) return Tinturas.parametros(peca, afDoPersonagem);
  const a = poe.atributos ?? {};
  const tipo = TIPO_DA_CLASSE[poe.classe] ?? null;
  const p = { velocidadePct: 0, quantidadePct: 0, quantidadeVidaPct: 0, quantidadeManaPct: 0, instantaneo: false, recargaPct: 0, cargasMaximas: Number(a.cargas_maximas) || 0, custoPct: 0, duracaoPct: 0, duracaoMenos: 1, efeitoPct: 0, maisNaVidaBaixaPct: 0,
    instantaneoPct: 0, instantaneoNaVidaBaixa: false, instantaneoNaManaBaixa: false, instantaneoNoFim: false, naoParaNoCheio: false, naoAcumula: false, saiNoPvp: false, custoDaOutraPct: 0, lacaiosPct: 0, cargaNoCriticoPct: 0, cargasAoSerAcertado: 0,
    aoUsar: { imunidades: [], cargas: [], vidaPct: 0 }, noFim: {}, duranteExtra: {}, consomeTudo: false, eletrizaProximosPct: 0, perdeAoEntrar: false, sabio: {} };
  // Os mods do PERSONAGEM (cinto, anéis…): recuperação de vida/mana dos frascos, duração e efeito dos de Utilidade, cargas usadas.
  const pp = afDoPersonagem ?? {};
  const n = (k) => Number(pp[k]) || 0;
  // (o Híbrido: a de Vida na Vida dele e a de Mana na Mana — o PoB, `FlaskLifeRecovery`/`FlaskManaRecovery` por recurso)
  p.quantidadeVidaPct += tipo === 'vida' || tipo === 'hibrido' ? n('frasco_vida_rec') : 0;
  p.quantidadeManaPct += tipo === 'mana' || tipo === 'hibrido' ? n('frasco_mana_rec') : 0;
  if (tipo === 'utilidade') { p.duracaoPct += n('frasco_duracao'); p.efeitoPct += n('frasco_efeito'); }
  // (13/10, a Dádiva da Natureza: "Frascos Utilitários Mágicos aplicados em você têm Efeito aumentado em X%" — só os Mágicos)
  if (tipo === 'utilidade' && poe.raridade === 'magico') p.efeitoPct += n('frasco_efeito_magico');
  p.custoPct -= n('frasco_cargas_usadas_red');
  // (ciclo 7, lote F) "Velocidade de Recuperação dos Frascos aumentada em X%".
  p.velocidadePct += n('frasco_velocidade');
  // ("Frascos de Vida usados enquanto em Vida Baixa aplicam sua Recuperação Instantaneamente", o mesmo da Mana em Mana Baixa.)
  if (tipo && n(`frasco_instantaneo_baixa:${tipo}`) > 0) p.instantaneoNaVidaBaixa = true;
  // (o Híbrido é de Vida e de Mana: na Vida Baixa pela de Vida, na Mana Baixa pela de Mana — o PoB soma as duas no frasco)
  if (tipo === 'hibrido' && n('frasco_instantaneo_baixa:vida') > 0) p.instantaneoNaVidaBaixa = true;
  if (tipo === 'hibrido' && n('frasco_instantaneo_baixa:mana') > 0) p.instantaneoNaManaBaixa = true;
  const durante = {};
  const linhas = [];
  // A QUALIDADE do frasco (a Bolha do Vidreiro — poedb › Quality): vida/mana recuperada +qualidade%; no frasco de Utilidade, a duração +qualidade%.
  const qualidade = Math.max(0, Math.min(30, Number(poe.qualidade) || 0));
  if (qualidade) {
    if (tipo === 'utilidade') p.duracaoPct += qualidade;
    else p.quantidadePct += qualidade;
    linhas.push({ texto: `Qualidade: +${qualidade}% (${tipo === 'utilidade' ? 'duração' : 'recuperação'})`, estado: 'efeito' });
  }
  // O estado de cada MOD (o balão marca por mod, na ordem implícitos, prefixos, sufixos, mods do único): o pior das partes.
  const estadosPorMod = [];
  // (06/11) a NOTA de cada mod inerte (o motivo no balão, como nas peças — `jogo.notasDe`)
  const notasPorMod = [];
  for (const mod of [...(poe.implicitos ?? []), ...(poe.prefixos ?? []), ...(poe.sufixos ?? []), ...(poe.modificadores ?? [])]) {
    const antes = linhas.length;
    for (const parte of String(mod.modelo ?? mod.texto ?? '').split(' / ')) {
      const nums = [...parte.matchAll(/\{(\d+)\}/g)].map((m) => Number(mod.valores?.[Number(m[1])]));
      const regra = REGRAS_DO_FRASCO.find(([re]) => re.test(parte));
      const texto = preencher(parte, mod.valores);
      if (regra) {
        regra[1](p, nums[0] ?? 0, parte.match(regra[0]));
        linhas.push({ texto, estado: 'efeito' });
        continue;
      }
      if (DURANTE.test(parte) || DURANTE_NO_MEIO.test(parte)) {
        // (05/11) a frase sem o "durante o Efeito"; se ela não tiver regra, a frase inteira (há regras escritas com ele: "Habilidades não Custam
        // Mana durante o Efeito", as das Habilidades Vaal "… durante o efeito")
        const semDurante = traduzirParte(parte.replace(DURANTE, ''), mod.valores ?? []);
        const t = semDurante.estado === 'registrado' ? traduzirParte(parte, mod.valores ?? []) : semDurante;
        const vale = t.estado !== 'registrado';
        if (vale) for (const e of t.efeitos) if (typeof e.valor === 'number') durante[e.stat] = (durante[e.stat] ?? 0) + e.valor;
        linhas.push({ texto, estado: vale ? 'efeito' : 'registrado' });
        continue;
      }
      // O resto passa pela tradução (o que ela marca como inerte, como na peça). (02/11: o "Restaura Proteção ao usar" tem efeito — a regra acima.)
      const tr = traduzirParte(parte, mod.valores ?? []);
      // (05/11) o texto de LEMBRETE do PoE (entre parênteses: "(Efeitos de Frascos de Vida ainda são removidos…)") é nota, como na peça —
      // antes ficava "registrado" (sem efeito) no balão do frasco único
      linhas.push({ texto, estado: tr.estado === 'inerte' ? 'inerte' : tr.estado === 'lembrete' ? 'lembrete' : 'registrado', nota: tr.estado === 'inerte' ? tr.nota ?? null : null });
    }
    const minhas = linhas.slice(antes).filter((l) => l.estado !== 'lembrete');
    notasPorMod.push(minhas.length && minhas.every((l) => l.estado === 'inerte') ? minhas.find((l) => l.nota)?.nota ?? null : null);
    estadosPorMod.push(!minhas.length ? 'lembrete' : minhas.every((l) => l.estado === 'efeito') ? 'equivalente' : minhas.some((l) => l.estado === 'efeito') ? 'aproximado' : minhas.every((l) => l.estado === 'inerte') ? 'inerte' : 'registrado');
  }
  // O efeito da BASE do frasco de Utilidade (o Rubi, o Mercúrio...): `regras.frascos.utilidade[slug]`.
  const slug = String(poe.base ?? '').split('/')[1];
  const daBase = tipo === 'utilidade' ? F().utilidade?.[slug] : null;
  const fatorDoEfeito = Math.max(0, 1 + p.efeitoPct / 100);
  const af = {};
  for (const [k, v] of Object.entries(daBase?.af ?? {})) af[k] = Math.round(v * fatorDoEfeito * 100) / 100;
  for (const [k, v] of Object.entries(durante)) af[k] = Math.round(((af[k] ?? 0) + v * fatorDoEfeito) * 100) / 100;
  // (05/11) os "durante o Efeito" do meio da frase (as regras acima) — sem o Efeito do frasco: são números da linha, não do efeito da base
  for (const [k, v] of Object.entries(p.duranteExtra)) af[k] = Math.round(((af[k] ?? 0) + v) * 100) / 100;
  const rec = a.recupera ?? null;
  const duracaoDe = (r) => (r ? Math.max(100, Math.round((Number(r.segundos) * 1000) / Math.max(0.1, 1 + p.velocidadePct / 100))) : 0);
  const ms = duracaoDe(rec);
  // (13/10) "X% menos Vida Recuperada de Frascos" (a Mestre Cirurgiã): multiplica — antes entrava somado ao aumentado.
  const maisRecuperada = tipo === 'vida' || tipo === 'hibrido' ? Math.max(0, 1 + n('frasco_vida_rec_mais') / 100) : 1;
  const recursoDe = rec?.recurso === 'mana' ? 'mana' : rec ? 'vida' : null;
  const pctDoRecurso = recursoDe === 'mana' ? p.quantidadeManaPct : p.quantidadeVidaPct;
  // (04/11) a MANA do Frasco Híbrido (`recupera_mana`): a mesma conta, com o aumentado da Mana; `quantidadeMana`/`msMana` só nele.
  const recMana = tipo === 'hibrido' ? a.recupera_mana ?? null : null;
  return {
    tipo,
    recurso: recursoDe,
    quantidade: rec ? Math.round(Number(rec.quantidade) * Math.max(0, 1 + (p.quantidadePct + pctDoRecurso) / 100) * (recursoDe === 'vida' ? maisRecuperada : 1)) : 0,
    ms,
    ...(recMana ? { quantidadeMana: Math.round(Number(recMana.quantidade) * Math.max(0, 1 + (p.quantidadePct + p.quantidadeManaPct) / 100)), msMana: duracaoDe(recMana), instantaneoNaManaBaixa: p.instantaneoNaManaBaixa } : {}),
    instantaneo: p.instantaneo,
    maisNaVidaBaixaPct: p.maisNaVidaBaixaPct,
    cargasPorUso: p.consomeTudo ? Math.max(1, p.cargasMaximas) : Math.max(1, Math.round((Number(a.cargas_por_uso) || 1) * Math.max(0, 1 + p.custoPct / 100))),
    cargasMaximas: Math.max(1, p.cargasMaximas),
    duracaoMs: a.duracao_segundos ? Math.round(Number(a.duracao_segundos) * 1000 * Math.max(0, 1 + p.duracaoPct / 100) * p.duracaoMenos) : 0,
    recargaPct: p.recargaPct,
    efeitoPct: p.efeitoPct,
    instantaneoPct: Math.min(100, p.instantaneoPct), instantaneoNaVidaBaixa: p.instantaneoNaVidaBaixa, instantaneoNoFim: p.instantaneoNoFim, naoParaNoCheio: p.naoParaNoCheio,
    naoAcumula: p.naoAcumula, saiNoPvp: p.saiNoPvp, custoDaOutraPct: p.custoDaOutraPct, lacaiosPct: p.lacaiosPct, cargaNoCriticoPct: p.cargaNoCriticoPct, cargasAoSerAcertado: p.cargasAoSerAcertado, aoUsar: p.aoUsar,
    ...(Object.keys(p.noFim).length ? { noFim: p.noFim } : {}), ...(p.perdeAoEntrar ? { perdeAoEntrar: true } : {}), ...(Object.keys(p.sabio).length ? { sabio: p.sabio } : {}), ...(p.eletrizaProximosPct ? { eletrizaProximosPct: p.eletrizaProximosPct } : {}),
    ...(p.restauraSalvaguarda ? { restauraSalvaguarda: true } : {}),
    ...(p.saiNaQuebra ? { saiNaQuebra: true } : {}),
    ...(p.cargasAoConsumirCadaver ? { cargasAoConsumirCadaver: p.cargasAoConsumirCadaver } : {}),
    // (07/11, lotes 14 e 19 das inertes: o Colhedor de Almas e o Vinho do Profeta)
    ...(p.almasPorCarga ? { almasPorCarga: true } : {}),
    ...(p.adivinhacaoS > 0 ? { adivinhacaoS: p.adivinhacaoS } : {}),
    af,
    efeitoDaBase: daBase?.texto ?? null,
    linhas,
    estadosPorMod,
    notasPorMod,
  };
}

/** O resumo para o balão (com os mods já aplicados): recupera, cargas, duração, o efeito da base e os atributos enquanto dura. */
export function resumo(peca) {
  if (ehTinturaDoCinto(peca)) return Tinturas.resumo(peca);
  const par = parametros(peca);
  return {
    tipo: par.tipo, recurso: par.recurso, quantidade: par.quantidade, segundos: par.ms / 1000, instantaneo: par.instantaneo,
    ...(par.quantidadeMana != null ? { quantidadeMana: par.quantidadeMana, segundosMana: par.msMana / 1000 } : {}),
    cargasPorUso: par.cargasPorUso, cargasMaximas: par.cargasMaximas, duracao: par.duracaoMs / 1000, efeitoDaBase: par.efeitoDaBase, af: par.af,
  };
}

/** As cargas atuais de um frasco (começa cheio). */
export const cargasDe = (peca, par = parametros(peca)) => Math.max(0, Math.min(par.cargasMaximas, peca?.poe?.cargas ?? par.cargasMaximas));

// ---------------------------------------------------------------- o cinto: pôr e tirar

/** Põe o frasco da mochila (`pilha`: índice; `vaga`: a posição no cinto, ou a primeira livre). O que estava na vaga volta à mochila. */
export function por(estado, { pilha, vaga = null }) {
  if (!ligado()) return { ok: false, erro: 'Frascos do PoE desligados.' };
  const inv = estado.inventory ?? [];
  const i = Number(pilha);
  const peca = inv[i];
  if (!peca || !ehFrasco(peca)) return { ok: false, erro: 'Isso não é um frasco.' };
  // O frasco inicial (a Recompensa do level 1) pede level 3 no PoE, mas é de todo exilado desde o começo: o cinto aceita.
  const minimo = peca.poe?.inicial ? 0 : ITEM_CATALOG[peca.id]?.minLevel ?? 0;
  if (minimo > (estado.level ?? 0)) return { ok: false, erro: `Precisa do level ${minimo}.` };
  const c = cinto(estado);
  const v = vaga == null ? c.findIndex((x) => !x) : Number(vaga);
  if (!(v >= 0 && v < c.length)) return { ok: false, erro: 'O cinto de frascos está cheio: tire um antes.' };
  inv.splice(i, 1);
  const antes = c[v];
  c[v] = { id: peca.id, count: 1, ...structuredClone(camposDaPeca(peca)) };
  if (antes) darPeca(estado, antes);
  return { ok: true, notice: `${peca.poe?.nome ?? 'Frasco'} no cinto (vaga ${v + 1}).` };
}

/** Tira o frasco da vaga `vaga` do cinto, de volta para a mochila. */
export function tirar(estado, { vaga }) {
  const c = cinto(estado);
  const v = Number(vaga);
  const peca = c[v];
  if (!peca) return { ok: false, erro: 'Essa vaga do cinto está vazia.' };
  if (!cabeNaMochila(estado, peca.id, 1)) return { ok: false, erro: erroDeEspaco(estado, peca.id, 1) };
  c[v] = null;
  darPeca(estado, peca);
  if (estado.hunt?.frascosPoe) delete estado.hunt.frascosPoe.ativos?.[v];
  // (a Tintura tirada do cinto deixa de valer — ativa ou na recarga)
  if (estado.hunt?.frascosPoe?.tinturas) delete estado.hunt.frascosPoe.tinturas[v];
  return { ok: true, notice: `${peca.poe?.nome ?? 'Frasco'} de volta à mochila.` };
}

/**
 * Troca a ORDEM no cinto (dono, 07/10: "arrastar no inventário a ordem dos flasks"): o frasco da vaga `de` vai para `para` e o de lá (ou a
 * vaga vazia) vem para `de`. As cargas e a regra de uso vão junto (moram na peça); o efeito ativo na caçada também troca de vaga.
 */
export function mover(estado, { de, para }) {
  const c = cinto(estado);
  const a = Number(de);
  const b = Number(para);
  if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < c.length && b < c.length)) return { ok: false, erro: 'Vaga do cinto inválida.' };
  if (!c[a]) return { ok: false, erro: 'Essa vaga do cinto está vazia.' };
  if (a === b) return { ok: true };
  [c[a], c[b]] = [c[b] ?? null, c[a]];
  // (o efeito ativo — e a Tintura ativa ou na recarga — vai junto com a peça)
  for (const ativos of [estado.hunt?.frascosPoe?.ativos, estado.hunt?.frascosPoe?.tinturas]) {
    if (!ativos) continue;
    const [xa, xb] = [ativos[a], ativos[b]];
    if (xb === undefined) delete ativos[a]; else ativos[a] = xb;
    if (xa === undefined) delete ativos[b]; else ativos[b] = xa;
  }
  return { ok: true };
}

// ---------------------------------------------------------------- na caçada

const estadoDaCacada = (hunt) => (hunt.frascosPoe ??= { ativos: {} });

/** Usa o frasco da vaga `v` agora (gasta as cargas e liga o efeito). Devolve true se usou. */
export function usar(estado, v, eventos = null, quem = null) {
  const hunt = estado.hunt;
  const peca = cinto(estado)[v];
  if (!hunt || !peca) return false;
  const afp = doPersonagem(estado);
  // "Não pode usar Frascos no Quinto Espaço" (o cinto do PoE); "Não pode usar frascos de vida/mana"; "Frascos não são aplicados em Você".
  if (v === 4 && Number(afp.sem_quinto_frasco) > 0) return false;
  // A TINTURA: usar ATIVA (ou DESATIVA a que está ativa) — `tinturas.mjs`.
  if (ehTinturaDoCinto(peca)) return alternarTintura(estado, v, peca, afp);
  // (06/11, o Umbilicus Immortalis: "Frascos que você Usar se aplicam aos seus Zumbis e Espectros Convocados" — `frascos_em_zumbis`) com "Frascos não são aplicados em
  // Você", o frasco de Vida (e o Híbrido) gasta as cargas e cura cada Zumbi e Espectro vivo pela quantidade dele; o de Utilidade não tem efeito nos lacaios do jogo
  if (Number(afp.frascos_nao_aplicam) > 0 && Number(afp.frascos_em_zumbis) > 0) return usarNosZumbis(estado, peca, afp);
  if (Number(afp[`sem_frasco:${TIPO_DA_CLASSE[peca.poe?.classe]}`]) > 0 || Number(afp.frascos_nao_aplicam) > 0) return false;
  // (06/11, o Sangue Mágico: "Frascos Utilitários Mágicos não podem ser Usados" — os dois mais à esquerda ficam sempre ligados: `constantesDoSangueMagico`)
  if (Number(afp.sangue_magico) > 0 && TIPO_DA_CLASSE[peca.poe?.classe] === 'utilidade' && peca.poe?.raridade === 'magico') return false;
  // (o Híbrido conta como de Vida e de Mana: "Não pode usar Frascos de Vida" ou "…de Mana" também o barram)
  if (TIPO_DA_CLASSE[peca.poe?.classe] === 'hibrido' && (Number(afp['sem_frasco:vida']) > 0 || Number(afp['sem_frasco:mana']) > 0)) return false;
  const par = parametros(peca, afp);
  const cargas = cargasDe(peca, par);
  if (cargas < par.cargasPorUso) return false;
  const st = estadoDaCacada(hunt);
  const agora = hunt.clock ?? 0;
  // (o Pathfinder: "Efeitos do Frasco de Vida não se Enfileram" — o frasco de vida usado de novo troca o efeito que corre pelo novo.)
  // (06/11, o Gêiser de Khatal: "Efeitos do frasco de mana não se enfileiram" — o mesmo, no de Mana)
  if (st.ativos[v]?.ate > agora && !(contaComo(peca, 'vida') && Number(afp.frasco_vida_sem_fila) > 0) && !(contaComo(peca, 'mana') && Number(afp.frasco_mana_sem_fila) > 0)) return false;
  // (ciclo 7, lote F) "X% de chance de Frascos usados por você não consumirem Cargas".
  if (!(Math.random() * 100 < (Number(afp.frasco_sem_consumo) || 0))) peca.poe.cargas = cargas - par.cargasPorUso;
  if (par.almasPorCarga) ganharAlmaVaal(estado, hunt, par.cargasPorUso);
  // (o Vinho do Profeta: a linha do frasco — `adivinhacaoS` — ou o atributo traduzido na peça, `adivinhacao_frasco_s`)
  const adivinhacaoS = par.adivinhacaoS || Number(peca.poe?.af?.adivinhacao_frasco_s) || 0;
  if (adivinhacaoS > 0) ganharBuff(hunt, ADIVINHACOES[Math.floor(Math.random() * ADIVINHACOES.length)], adivinhacaoS, hunt.clock ?? 0);
  aoUsarOFrasco(estado, par, eventos, quem, afp);
  // (02/11) "Restaura Proteção ao usar" (o Frasco de Ferro): a Salvaguarda volta inteira
  if (par.restauraSalvaguarda) Salvaguarda.restaurar(estado);
  // (12/10, a Tintura: "…se você usou um Frasco de Vida Recentemente")
  if (par.tipo === 'vida' || par.tipo === 'hibrido') marcar(hunt, 'usouFrascoVida', agora);
  if (par.tipo === 'utilidade') {
    // ("Frascos adjacentes às Tinturas aplicadas têm Efeito aumentado em 10% quando utilizados se você Acertou um inimigo com uma Arma
    // Recentemente" — a Maestria de Tinturas: o frasco ao lado de uma Tintura ativa.)
    const adjacente = Number(afp.tintura_frasco_adjacente_efeito) || 0;
    const ao = adjacente > 0 && (hunt.poeRecente?.acertou ?? -Infinity) >= agora - 4000 && Tinturas.ativas(st).some(([w]) => Math.abs(Number(w) - v) === 1);
    const af = { ...(ao ? parametros(peca, { ...afp, frasco_efeito: (Number(afp.frasco_efeito) || 0) + adjacente }).af : par.af), ...doSabio(par, afp) };
    st.ativos[v] = { ate: agora + par.duracaoMs, af, nome: peca.poe.nome, ...(par.saiNoPvp ? { saiNoPvp: true } : {}), ...(par.saiNaQuebra ? { saiNaQuebra: true } : {}), ...extrasDoEfeito(par, false) };
    // (06/11, lote 9 das inertes) o efeito também nos aliados: o Voo de Victario ("Frascos de Mercúrio que você Usar também se aplicam aos Aliados próximos" — os
    // companheiros da party a até 3 casas) e a Central da Benevolência ("Frascos Utilitários Não Únicos que você Usar se aplicam aos Alvos Vinculados")
    const mercurio = String(peca.poe.base ?? '').split('/')[1] === 'Quicksilver_Flask' && Number(afp.frasco_mercurio_aliados) > 0;
    const vinculados = Number(afp.frasco_utilidade_vinculados) > 0 && peca.poe.raridade !== 'unico';
    const outros = new Set([...(mercurio ? Aliados.companheirosPerto(estado) : []), ...(vinculados ? alvosVinculados(hunt) : [])]);
    for (const o of outros) if (o?.hunt) (estadoDaCacada(o.hunt).extras ??= []).push({ ate: (o.hunt.clock ?? agora) + par.duracaoMs, af, nome: peca.poe.nome });
    return true;
  }
  if (par.tipo === 'hibrido') return usarHibrido(estado, v, peca, par, st, agora, eventos, quem, afp);
  // (05/11) os atributos "durante o Efeito" dos frascos de Vida e de Mana (o Espírito de Lavianga, o Vaso de Vinktar…) — antes só os de Utilidade os
  // aplicavam — e o que ele faz no término
  const doEfeito = extrasDoEfeito(par);
  // Vida/Mana: na vida baixa (abaixo de 50%), o "mais Recuperação se usado enquanto em Vida Baixa" (o de mana olha a Mana Baixa).
  const vidaBaixa = par.recurso === 'mana' && Number(afp['frasco_instantaneo_baixa:mana']) > 0 ? (estado.mana ?? 0) <= (estado.maxMana ?? 1) * 0.5 : (estado.hp ?? 0) < (estado.maxHp ?? 1) * 0.5;
  const total = par.quantidade * (vidaBaixa ? 1 + par.maisNaVidaBaixaPct / 100 : 1);
  // (o Pacto Vaal — "Não pode Recuperar Vida fora o Dreno": o frasco de vida não enche a vida; o repasse aos lacaios segue)
  const extras = { custoDaOutraPct: par.custoDaOutraPct, lacaiosPct: par.lacaiosPct, ...(par.recurso !== 'mana' && vidaSoPeloDreno(afp) ? { semVida: true } : {}) };
  // "Recuperação Instantânea" (ou "quando em Vida Baixa", na vida baixa): tudo na hora.
  if (par.instantaneo || (par.instantaneoNaVidaBaixa && vidaBaixa)) {
    recuperar(estado, par.recurso, total, eventos, quem, extras);
    st.ativos[v] = { ate: agora + 250, recurso: par.recurso, nome: peca.poe.nome, ...doEfeito };
    return true;
  }
  // "X% da Recuperação aplicada Instantaneamente": essa parte na hora, o resto ao longo do tempo.
  const naHora = (total * (par.instantaneoPct ?? 0)) / 100;
  if (naHora > 0) recuperar(estado, par.recurso, naHora, eventos, quem, extras);
  const resto = total - naHora;
  // "Recuperação de Mana ocorre instantaneamente no término do Efeito": nada ao longo do tempo, tudo no fim.
  if (par.instantaneoNoFim) st.ativos[v] = { ate: agora + par.ms, recurso: par.recurso, nome: peca.poe.nome, noFim: resto, extras, ...doEfeito };
  else st.ativos[v] = { ate: agora + par.ms, de: agora, ultimo: agora, porMs: resto / par.ms, recurso: par.recurso, nome: peca.poe.nome, extras, ...(par.naoParaNoCheio ? { naoParaNoCheio: true } : {}), ...doEfeito };
  return true;
}

/** (lote 9) Os jogadores que os seus Vínculos ligam agora (os estados deles, pela party). */
function alvosVinculados(hunt) {
  const agora = hunt?.clock ?? 0;
  const saida = [];
  for (const lk of hunt?.vinculos ?? []) if (lk.ate > agora) for (const a of lk.alvos ?? []) if (a.tipo === 'jogador') { const o = hunt.partilha?.membros?.find((m) => m.nome === a.nome)?.estado; if (o) saida.push(o); }
  return saida;
}
/** (06/11, o Umbilicus Immortalis) o frasco de Vida usado nos seus Zumbis e Espectros: gasta as cargas e cura cada um pela quantidade do frasco. */
function usarNosZumbis(estado, peca, afp) {
  const par = parametros(peca, afp);
  if (!(par.tipo === 'vida' || par.tipo === 'hibrido') || cargasDe(peca, par) < par.cargasPorUso) return false;
  const alvos = (estado.hunt?.lacaios ?? []).filter((l) => l.hp > 0 && (l.espectro || /zumbi|zombie|espectro|spectre/i.test(l.nome ?? '')));
  if (!alvos.length) return false;
  peca.poe.cargas = cargasDe(peca, par) - par.cargasPorUso;
  for (const l of alvos) l.hp = Math.min(l.maxHp ?? l.hp, l.hp + (par.quantidade ?? 0));
  return true;
}

/**
 * (06/11, o Sangue Mágico: "Frascos Utilitários Mágicos 2 mais à Esquerda aplicam seu Efeito de Frasco constantemente em você") os efeitos dos dois primeiros frascos
 * de Utilidade Mágicos do cinto (da esquerda), sempre ligados — guardados no tique (`st.constantes`), que `adds` soma.
 */
function constantesDoSangueMagico(estado, st, afp) {
  if (!(Number(afp.sangue_magico_constantes) > 0)) { if (st.constantes) { delete st.constantes; return true; } return false; }
  const n = Math.round(Number(afp.sangue_magico_constantes));
  const lista = cinto(estado).filter((p) => p && !ehTinturaDoCinto(p) && TIPO_DA_CLASSE[p.poe?.classe] === 'utilidade' && p.poe?.raridade === 'magico').slice(0, n);
  const novas = lista.map((p) => ({ nome: p.poe.nome, af: parametros(p, afp).af ?? {} }));
  const mudou = JSON.stringify(novas) !== JSON.stringify(st.constantes ?? []);
  st.constantes = novas;
  return mudou;
}

/**
 * (04/11) O FRASCO HÍBRIDO: a Vida e a Mana da base no mesmo uso, cada uma ao longo do tempo dela (`ms`/`msMana`). Como no PoB: o "mais
 * Recuperação se usado enquanto em Vida Baixa" vale só na Vida; a Recuperação Instantânea (a do mod, a da Vida Baixa e a da Mana Baixa)
 * vale no frasco inteiro; "Recuperação de Mana ocorre instantaneamente no término do Efeito" só na Mana. O repasse aos lacaios, o "Retira…"
 * e o Pacto Vaal ficam na parte da Vida. O efeito acaba quando a Vida e a Mana (não reservadas) estão cheias — `tique`.
 */
function usarHibrido(estado, v, peca, par, st, agora, eventos, quem, afp) {
  const vidaBaixa = (estado.hp ?? 0) < (estado.maxHp ?? 1) * 0.5;
  const manaBaixa = (estado.mana ?? 0) <= (estado.maxMana ?? 1) * 0.5;
  const vida = par.quantidade * (vidaBaixa ? 1 + par.maisNaVidaBaixaPct / 100 : 1);
  const mana = par.quantidadeMana ?? 0;
  const extras = { custoDaOutraPct: par.custoDaOutraPct, lacaiosPct: par.lacaiosPct, ...(vidaSoPeloDreno(afp) ? { semVida: true } : {}) };
  if (par.instantaneo || (par.instantaneoNaVidaBaixa && vidaBaixa) || (par.instantaneoNaManaBaixa && manaBaixa)) {
    recuperar(estado, 'vida', vida, eventos, quem, extras);
    recuperar(estado, 'mana', mana, eventos, quem);
    st.ativos[v] = { ate: agora + 250, recurso: 'vida', mana: { ate: agora + 250 }, nome: peca.poe.nome, ...extrasDoEfeito(par) };
    return true;
  }
  const naHora = (par.instantaneoPct ?? 0) / 100;
  if (naHora > 0) { recuperar(estado, 'vida', vida * naHora, eventos, quem, extras); recuperar(estado, 'mana', mana * naHora, eventos, quem); }
  const restoVida = vida * (1 - naHora);
  const restoMana = mana * (1 - naHora);
  const msMana = par.msMana || par.ms;
  const daMana = par.instantaneoNoFim ? { ate: agora + msMana, noFim: restoMana } : { ate: agora + msMana, porMs: restoMana / msMana };
  st.ativos[v] = { ate: agora + Math.max(par.ms, msMana), de: agora, ultimo: agora, porMs: restoVida / par.ms, vidaAte: agora + par.ms, recurso: 'vida', mana: daMana, nome: peca.poe.nome, extras, ...(par.naoParaNoCheio ? { naoParaNoCheio: true } : {}), ...extrasDoEfeito(par) };
  return true;
}

/** A TINTURA da vaga `v`: ativa se está parada (e pronta), desativa se está ativa. Devolve true se mudou. */
function alternarTintura(estado, v, peca, afp) {
  const hunt = estado.hunt;
  const st = estadoDaCacada(hunt);
  const agora = hunt.clock ?? 0;
  if (Tinturas.registro(st)[v]?.ativa) return Tinturas.desativar(st, v, peca, afp, agora);
  return Tinturas.ativar(estado, st, v, peca, afp, agora);
}

/**
 * (05/11) O Sábio Carvalho: no uso, o elemento da sua Resistência total MAIS BAIXA recebe o dano reduzido e o da MAIS ALTA é penetrado (Fogo, Gelo e
 * Raio; empate: o primeiro). `afp`: os atributos do personagem (as resistências somadas).
 */
function doSabio(par, afp) {
  const s = par.sabio;
  if (!s) return {};
  const res = ['fire', 'ice', 'energy'].map((e) => [e, Number(afp[`${e}_res`]) || 0]);
  const menor = res.reduce((a, b) => (b[1] < a[1] ? b : a));
  const maior = res.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { ...(s.reducao ? { [`dano_${menor[0]}_recebido_inc`]: -s.reducao } : {}), ...(s.penetra ? { [`${maior[0]}_pen`]: s.penetra } : {}) };
}

/**
 * (05/11) O que o efeito ativo leva além da recuperação: os atributos "durante o Efeito" (`af` — os de Vida e de Mana não os levavam; `comAf`
 * false: o de Utilidade já põe os dele), o que ele faz no término (`noFimAcoes`) e a Eletrização em volta (`eletriza`, o Vaso de Vinktar).
 */
function extrasDoEfeito(par, comAf = true) {
  return {
    ...(comAf && par.af && Object.keys(par.af).length ? { af: par.af } : {}),
    ...(par.noFim ? { noFimAcoes: par.noFim } : {}),
    ...(par.eletrizaProximosPct ? { eletriza: par.eletrizaProximosPct } : {}),
  };
}

/** O que o frasco faz AO SER USADO (PoE): tirar Maldições/Incêndios, as imunidades "se usado enquanto…", desacelerar/provocar em volta e os solos. */
const RAIO_DO_FRASCO = 3;
const SOLO_MS = 5000;
// (03/11: + `afp` — os atributos do personagem: o "Efeito do Solo Congelado aumentado" no solo do frasco)
function aoUsarOFrasco(estado, par, eventos, quem, afp = {}) {
  const hunt = estado.hunt;
  const u = par.aoUsar ?? {};
  const agora = hunt.clock ?? 0;
  if (u.removerMaldicao) Dot.removerDoJogador(hunt, 'maldicao');
  // (05/11, os frascos únicos) as Cargas ao usar (o Elixir de Doedre, o Composto de Rumi Réplica); a Agressividade por Frenesi consumida (a Entranha
  // Pútrida); a Vida por Tolerância (o Elixir do Círculo Não Quebrado)
  for (const c of u.cargas ?? []) CargasPoe.ganhar(estado, c.tipo, afp, c.n);
  if (u.consomeFrenesi) {
    const gastas = CargasPoe.gastar(estado, 'frenesi', Infinity);
    if (gastas && u.agressividadePorFrenesiS) ganharBuff(hunt, 'agressividade', gastas * u.agressividadePorFrenesiS, agora);
  }
  if (u.vidaPorToleranciaPct || u.perdeTolerancias) {
    const c = hunt.cargasPoe?.tolerancia;
    const tem = c && c.ate > agora ? Number(c.n) || 0 : 0;
    const n = u.perdeTolerancias ? CargasPoe.gastar(estado, 'tolerancia', Infinity) : tem;
    if (u.vidaPorToleranciaPct && n) recuperar(estado, 'vida', ((estado.maxHp ?? 0) * u.vidaPorToleranciaPct * n) / 100, eventos, quem);
  }
  if (u.vidaPct) recuperar(estado, 'vida', ((estado.maxHp ?? 0) * u.vidaPct) / 100, eventos, quem);
  // o que tira de você: o Escudo de Energia (Doedre), a Vida (o Filactério), o Caos em % da Vida (Doedre — não mata: fica em 1), e o Elixir Coruscante
  // ("Remove toda Vida deixando sobrar 1 / Vida Removida é regenerada como Escudo de Energia durante 2 segundos")
  if (u.perdeEsPct) estado.es = Math.max(0, Math.round((estado.es ?? 0) - ((Number(estado.maxEsPoe) || estado.es || 0) * u.perdeEsPct) / 100));
  if (u.perdeVidaPct) estado.hp = Math.max(1, Math.round((estado.hp ?? 0) - ((estado.maxHp ?? 0) * u.perdeVidaPct) / 100));
  if (u.danoCaosVidaPct) estado.hp = Math.max(1, Math.round((estado.hp ?? 0) - ((estado.maxHp ?? 0) * u.danoCaosVidaPct) / 100));
  if (u.vidaAte) {
    const tirada = Math.max(0, (estado.hp ?? 0) - u.vidaAte);
    estado.hp = Math.min(estado.hp ?? 0, u.vidaAte);
    const ms = Math.max(100, (u.vidaRemovidaComoEsS || 1) * 1000);
    if (tirada > 0 && u.vidaRemovidaComoEsS) (hunt.recuperacoes ??= []).push({ recurso: 'es', porMs: tirada / ms, desde: agora, ate: agora + ms });
  }
  // ("Inicia recarga do escudo de energia quando usado")
  if (u.recargaEs) estado.esEspera = 0;
  if (u.removerIncendio) Dot.removerDoJogador(hunt, 'queimadura');
  for (const im of u.imunidades ?? []) {
    // Só "se usado enquanto" afetado: tira o efeito e fica imune pelo tempo.
    const tipos = { sangramento: ['sangramento'], incendio: ['queimadura'], veneno: ['veneno', 'venenoPoe'], eletrizacao: ['choque'], resfriamento: ['gelo'] }[im.afeccao] ?? [];
    const temDot = tipos.some((t) => (hunt.efeitosDoJogador?.dots ?? []).some((d) => d.tipo === t && d.falta > 0));
    const c = hunt.controle ?? {};
    const temControle = (im.afeccao === 'congelamento' && c.congelado?.ate > agora) || ((im.afeccao === 'lento' || im.afeccao === 'resfriamento') && c.lento?.ate > agora);
    if (!temDot && !temControle) continue;
    for (const t of tipos) Dot.removerDoJogador(hunt, t);
    // (revisão G, 26/10) o gelo da Armadura Ártica Vaal: "When the ice breaks, the buff is also removed" (o PoB) — o frasco que tira o Congelado quebra o gelo e o buff sai
    if (im.afeccao === 'congelamento' && c.congelado?.geloVaal) quebrarGelo(hunt, agora);
    if (im.afeccao === 'congelamento') delete c.congelado;
    if (im.afeccao === 'lento' || im.afeccao === 'resfriamento') delete c.lento;
    (hunt.imunidadesPoe ??= {})[im.afeccao] = Math.max(hunt.imunidadesPoe[im.afeccao] ?? 0, agora + im.ms);
  }
  const perto = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) <= RAIO_DO_FRASCO);
  const ev = (m, st) => eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: st });
  for (const m of perto) {
    const e = (m.estados ??= {});
    const lento = (pct, ms) => { porLento(e, agora + ms, pct, agora); ev(m, 'lento'); };
    if (u.desacelerarPct) lento(u.desacelerarPct, par.ms || 4000);
    if (u.provocar) { e.provocado = { ate: agora + 3000 }; ev(m, 'provocado'); }
    // Nuvem de Fumaça: Cega quem está em volta.
    if (u.fumaca) { e.cego = { ate: agora + 4000 }; ev(m, 'cego'); }
    // (05/11) o Rugido do Leão: Empurra em volta e a chance de Fugir (o Raro, o Único e o chefe não fogem; o Mágico evita metade — a regra da Fuga)
    if (u.empurrar) empurrar(hunt, m);
    if (u.fugaPct && fogeDoFrasco(m, u.fugaPct)) { e.fugindo = { ate: agora + FUGA_MS }; ev(m, 'fugindo'); }
    // o Cálice da Luz Estelar: Exposição a Fogo, Gelo e Raio (4 s, a do PoE)
    if (u.exposicao) { e.exposicao = { ...(e.exposicao ?? {}), fire: agora + EXPOSICAO_MS, ice: agora + EXPOSICAO_MS, energy: agora + EXPOSICAO_MS }; ev(m, 'exposicao'); }
  }
  // (03/11) Solo Congelado: o SOLO de verdade no chão onde você está (antes: só 10% de lentidão nos monstros perto, na hora do uso) — uma das suas áreas frias
  // (`condicoes-poe.criarSoloCongelado`): Resfria os monstros que estão nele ou entram (10% × "Efeito do Solo Congelado aumentado"); conta para o "sobre Solo
  // Congelado". O raio e a duração de antes (o PoE não publica os do frasco): as 3 casas em volta e os 5 s
  if (u.solo === 'congelado' && hunt.pos) criarSoloCongelado(hunt, { afPoe: afp }, { x: hunt.pos.x, y: hunt.pos.y, raioM: RAIO_DO_FRASCO * 2, segundos: SOLO_MS / 1000, agora });
  // Solo Sagrado: regenera 6% da vida por segundo enquanto o personagem está nele.
  if (u.solo === 'sagrado') (hunt.frascosPoe.extras ??= []).push({ ate: agora + SOLO_MS, af: { life_regen_max_pct: 6 }, nome: 'Solo Sagrado' });
  // (06/11, lote 11) o lugar do Solo Sagrado do frasco, para os monstros nele (o raio: o do Solo Sagrado, × o "Raio Triplicado" da Fé Engarrafada)
  if (u.solo === 'sagrado' && hunt.pos) hunt.poeSoloDoFrasco = { x: hunt.pos.x, y: hunt.pos.y, z: hunt.z ?? 0, raio: (par.soloRaioMult ?? 1) * 1, ate: agora + SOLO_MS };
}

/** A Fuga do frasco (a mesma regra da Chance de Fugir — `acoes.fugir`): o Raro, o Único e o chefe não fogem; o Mágico evita metade. */
const FUGA_MS = 2000;
const EXPOSICAO_MS = 4000;
function fogeDoFrasco(m, chance, rng = Math.random) {
  const raridade = String(m?.raridade ?? '');
  if (m.boss || m.chefe || m.isBoss || /raro|elite|unico|único|boss/i.test(raridade)) return false;
  if (!(rng() * 100 < chance)) return false;
  return !(/modificado|magic|mágic/i.test(raridade) && rng() < 0.5);
}

/** (05/11) O que o frasco faz NO TÉRMINO do efeito: recuperar a Vida (o Sangue dos Karui), Debilitar em volta (a Preparação de Vorana). */
function noFimDoFrasco(estado, a, eventos, quem) {
  const f = a.noFimAcoes;
  const hunt = estado.hunt;
  if (!f || !hunt) return;
  if (f.vidaPct) recuperar(estado, 'vida', ((estado.maxHp ?? 0) * f.vidaPct) / 100, eventos, quem);
  if (f.debilitarS && hunt.pos) {
    const agora = hunt.clock ?? 0;
    for (const m of hunt.monstros ?? []) {
      if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > RAIO_DO_FRASCO) continue;
      const e = (m.estados ??= {});
      e.debilitado = { ate: agora + f.debilitarS * 1000 };
      porLento(e, agora + f.debilitarS * 1000, 20, agora);
      eventos?.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'debilitado' });
    }
  }
}

function recuperar(estado, recurso, valor0, eventos, quem, extras = null) {
  const [campo, maximo, cor] = recurso === 'mana' ? ['mana', 'maxMana', '#4fc3ff'] : ['hp', 'maxHp', '#00ff66'];
  // (06/11, lote 9 das inertes, A Drogaria: "100% da Recuperação de Vida dos Frascos é aplicada aos Aliados próximos ao invés de Você" — os companheiros da party a até 3 casas
  // recebem a parte; você, o resto)
  const aosAliados = recurso !== 'mana' ? Math.min(100, Number(doPersonagem(estado).frasco_vida_aliados_pct) || 0) : 0;
  if (aosAliados > 0 && valor0 > 0) for (const o of Aliados.companheirosPerto(estado)) o.hp = Math.min(o.maxHp ?? 0, (o.hp ?? 0) + (valor0 * aosAliados) / 100);
  const valor = valor0 * (1 - aosAliados / 100);
  const ganho = Math.min(Math.max(0, valor), Math.max(0, (estado[maximo] ?? 0) - (estado[campo] ?? 0)));
  // "Repassa X% da Recuperação de Vida para Lacaios" (o que o frasco recupera, mesmo com a vida cheia).
  if (extras?.lacaiosPct > 0 && recurso !== 'mana') for (const l of estado.hunt?.lacaios ?? []) if (l.hp > 0) l.hp = Math.min(l.maxHp, l.hp + (valor * extras.lacaiosPct) / 100);
  // (05/11, O Sofrimento do Divino) "Recuperação de Vida de Frascos também se aplica ao Escudo de Energia": a mesma quantidade enche o escudo
  if (recurso !== 'mana' && valor > 0 && Number(doPersonagem(estado).frasco_vida_tambem_es) > 0) estado.es = Math.min(Number(estado.maxEsPoe) || 0, (estado.es ?? 0) + valor);
  if (!(ganho > 0) || (extras?.semVida && campo === 'hp')) return 0;
  estado[campo] = (estado[campo] ?? 0) + ganho;
  // "Retira X% de Vida Recuperada da Mana" (e o contrário): a outra barra paga.
  if (extras?.custoDaOutraPct > 0) {
    const outra = recurso === 'mana' ? 'hp' : 'mana';
    estado[outra] = Math.max(outra === 'hp' ? 1 : 0, (estado[outra] ?? 0) - (ganho * extras.custoDaOutraPct) / 100);
  }
  const pos = estado.hunt?.pos;
  if (eventos && ganho >= 1) eventos.push({ t: 'heal', uid: 'player', quem, x: pos?.x, y: pos?.y, v: Math.round(ganho), color: cor, frasco: true });
  return ganho;
}

/**
 * Um tique da caçada: enche o cinto ao entrar, recupera vida/mana dos frascos ativos, vence os de Utilidade e usa os frascos sozinho
 * (`usoAutomatico`). Devolve true se o conjunto de efeitos de Utilidade mudou (quem chama refaz a ficha).
 */
export function tique(estado, eventos = null, quem = null) {
  const hunt = estado.hunt;
  if (!ligado() || !hunt) return false;
  const c = cinto(estado);
  if (!c.some(Boolean)) return false;
  const st = estadoDaCacada(hunt);
  const agora = hunt.clock ?? 0;
  // Entrou na caçada: todos cheios (no PoE, a cidade enche os frascos).
  if (!st.cheios) {
    // (05/11, o Colhedor de Almas: "Perde todas as Cargas ao entrar em uma nova área")
    for (const p of c) if (p && !ehTinturaDoCinto(p)) { const par = parametros(p); p.poe.cargas = par.perdeAoEntrar ? 0 : par.cargasMaximas; }
    st.cheios = true;
  }
  let mudou = false;
  // (do personagem: "A Mana não-instantânea recuperada dos Frascos também recupera Vida"; "Efeitos do frasco de mana não são removidos quando o
  // mana não reservado é preenchido")
  const doDono = doPersonagem(estado);
  if (constantesDoSangueMagico(estado, st, doDono)) mudou = true;
  // A recuperação ao longo do tempo e o vencimento.
  for (const [v, a] of Object.entries(st.ativos)) {
    // (04/11) o HÍBRIDO: a Vida e a Mana, cada uma até o fim dela; acaba quando as duas (não reservadas) estão cheias.
    if (a.mana) {
      const ate = Math.min(agora, a.ate);
      if (ate > a.ultimo) {
        const dtVida = Math.max(0, Math.min(ate, a.vidaAte ?? a.ate) - a.ultimo);
        const dtMana = Math.max(0, Math.min(ate, a.mana.ate ?? a.ate) - a.ultimo);
        if (a.porMs && dtVida > 0) recuperar(estado, 'vida', a.porMs * dtVida, eventos, quem, a.extras);
        if (a.mana.porMs && dtMana > 0) {
          recuperar(estado, 'mana', a.mana.porMs * dtMana, eventos, quem);
          if (Number(doDono.mana_frasco_tambem_vida) > 0 && !vidaSoPeloDreno(doDono)) recuperar(estado, 'vida', a.mana.porMs * dtMana, eventos, quem);
        }
      }
      a.ultimo = Math.max(a.ultimo ?? ate, ate);
      const vidaCheia = Number(doDono.frasco_vida_nao_para) > 0 ? false : (estado.hp ?? 0) >= (estado.maxHp ?? 0) - reservadoAgora(estado, 'vida');
      const manaCheia = a.naoParaNoCheio || Number(doDono.frasco_mana_nao_para) > 0 ? false : (estado.mana ?? 0) >= (estado.maxMana ?? 0) - reservadoAgora(estado, 'mana');
      if (a.de != null && vidaCheia && manaCheia) a.ate = Math.min(a.ate, agora);
    } else if (a.porMs) {
      const ate = Math.min(agora, a.ate);
      if (ate > a.ultimo) {
        recuperar(estado, a.recurso, a.porMs * (ate - a.ultimo), eventos, quem, a.extras);
        if (a.recurso === 'mana' && Number(doDono.mana_frasco_tambem_vida) > 0 && !vidaSoPeloDreno(doDono)) recuperar(estado, 'vida', a.porMs * (ate - a.ultimo), eventos, quem);
      }
      a.ultimo = ate;
      // PoE: o frasco de MANA para quando a Mana NÃO RESERVADA enche (o "Efeito não é removido quando a Mana Não Reservada Encher" segue) —
      // (13/10) antes comparava com a máxima, e com uma aura reservando a mana nunca chegava lá; e o de VIDA, quando a Vida Não Reservada
      // enche ("Efeitos dos Frascos de Vida não são removidos quando a Vida Não Reservada é Preenchida" — a Mestre Cirurgiã — segue).
      if (a.recurso === 'mana' && !a.naoParaNoCheio && !(Number(doDono.frasco_mana_nao_para) > 0) && (estado.mana ?? 0) >= (estado.maxMana ?? 0) - reservadoAgora(estado, 'mana')) a.ate = Math.min(a.ate, agora);
      if (a.recurso === 'vida' && !(Number(doDono.frasco_vida_nao_para) > 0) && (estado.hp ?? 0) >= (estado.maxHp ?? 0) - reservadoAgora(estado, 'vida')) a.ate = Math.min(a.ate, agora);
    }
    // (05/11, o Vaso de Vinktar) "Eletriza Inimigos próximos durante o Efeito": quem está em volta fica Eletrizado enquanto dura
    if (a.eletriza && a.ate > agora && hunt.pos) {
      for (const m of hunt.monstros ?? []) {
        if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > RAIO_DO_FRASCO) continue;
        const e = (m.estados ??= {});
        e.chocado = { ate: Math.max(e.chocado?.ate ?? 0, agora + 500), pct: Math.max(e.chocado?.ate > agora ? e.chocado.pct ?? 0 : 0, a.eletriza) };
      }
    }
    if (a.ate <= agora) {
      noFimDoFrasco(estado, a, eventos, quem);
      if (a.noFim > 0) recuperar(estado, a.recurso, a.noFim, eventos, quem, a.extras);
      if (a.mana?.noFim > 0) recuperar(estado, 'mana', a.mana.noFim, eventos, quem);
      if (a.af) mudou = true;
      delete st.ativos[v];
    }
  }
  if (st.extras?.length) {
    const antes = st.extras.length;
    st.extras = st.extras.filter((x) => x.ate > agora);
    if (st.extras.length !== antes) mudou = true;
  }
  // As CARGAS dos frascos pelo tempo e pelos acontecimentos (PoE): "Frascos Utilitários ganham N Cargas a cada S segundos" (personagem),
  // "X% de chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico" e "Ganhe N Cargas ao ser Acertado" (o frasco).
  const afp = doPersonagem(estado);
  // (+ "Frascos de Vida/Mana ganham N Cargas a cada S segundos", "Em vida baixa, frascos de vida ganham…" — `frasco_regen_n:<tipo>`.)
  const regens = [['utilidade', Number(afp.frasco_util_regen_n) || 0, Number(afp.frasco_util_regen_s) || 0], ...['vida', 'mana', 'utilidade', 'todos'].map((t) => [t, Number(afp[`frasco_regen_n:${t}`]) || 0, Number(afp[`frasco_regen_s:${t}`]) || 0])];
  for (const [tipoR, quantas, cadaS] of regens) {
    if (!(cadaS > 0 && quantas > 0)) continue;
    const chave = `proximaRegen:${tipoR}:${cadaS}`;
    st[chave] ??= agora + cadaS * 1000;
    while (agora >= st[chave]) {
      st[chave] += cadaS * 1000;
      for (const p of c) if (p && !ehTinturaDoCinto(p) && (tipoR === 'todos' || contaComo(p, tipoR))) { const par = parametros(p, afp); p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + quantas); }
    }
  }
  const criticos = hunt.poeCriticosParaFrascos ?? 0;
  const acertos = hunt.poeAcertosParaFrascos ?? 0;
  if (criticos || acertos) {
    for (const p of c) {
      if (!p || ehTinturaDoCinto(p)) continue;
      const par = parametros(p, afp);
      let ganho = acertos * par.cargasAoSerAcertado;
      for (let k = 0; k < criticos; k++) if (par.cargaNoCriticoPct > 0 && Math.random() * 100 < par.cargaNoCriticoPct) ganho++;
      if (ganho > 0) p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + ganho);
    }
    hunt.poeCriticosParaFrascos = 0;
    hunt.poeAcertosParaFrascos = 0;
  }
  // As TINTURAS: a Queima de Mana, a mana que ela tira, as desativações e as cargas dos frascos adjacentes (`tinturas.tique`).
  const acertosDaTintura = hunt.tinturaAcertos ?? 0;
  hunt.tinturaAcertos = 0;
  if (c.some(ehTinturaDoCinto) || st.tinturas) {
    const cargasNoFrasco = (w, quantas) => { const p = c[w]; const par = parametros(p, afp); p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + quantas); };
    if (Tinturas.tique(estado, st, c, afp, agora, { acertos: acertosDaTintura, cargasNoFrasco })) mudou = true;
  }
  if (estado.hp <= 0) return mudou;
  // O uso automático.
  const emCombate = (hunt.monstros ?? []).some((m) => m.hp > 0);
  const recuperando = (r) => Object.values(st.ativos).some((a) => (a.recurso === r || (r === 'mana' && a.mana)) && a.ate > agora);
  for (let v = 0; v < c.length; v++) {
    const p = c[v];
    if (p && ehTinturaDoCinto(p)) {
      if (automaticoDaTintura(estado, st, v, p, afp, emCombate, agora)) mudou = true;
      continue;
    }
    if (!p || st.ativos[v]?.ate > agora || (v === 4 && Number(afp.sem_quinto_frasco) > 0)) continue;
    const tipo = TIPO_DA_CLASSE[p.poe?.classe];
    // A regra de CADA frasco (dono, 07/10: configurada clicando nele na barra): vida/mana abaixo de X%; utilidade em combate.
    const r = regraDe(p);
    const precisa = tipo === 'vida' ? (estado.hp ?? 0) < (estado.maxHp ?? 0) * (r.abaixoPct / 100) : tipo === 'mana' ? (estado.mana ?? 0) < (estado.maxMana ?? 0) * (r.abaixoPct / 100) : false;
    // (o Híbrido: a Vida OU a Mana abaixo do X% da regra, e aquela que está baixa sem outro frasco recuperando)
    const hibrido = tipo === 'hibrido' && (((estado.hp ?? 0) < (estado.maxHp ?? 0) * (r.abaixoPct / 100) && !recuperando('vida')) || ((estado.mana ?? 0) < (estado.maxMana ?? 0) * (r.abaixoPct / 100) && !recuperando('mana')));
    const quer = tipo === 'utilidade' ? emCombate && r.emCombate : tipo === 'hibrido' ? hibrido : precisa && !recuperando(tipo === 'mana' ? 'mana' : 'vida');
    // (05/11: o de Vida e de Mana com atributos "durante o Efeito" também muda a ficha)
    if (quer && usar(estado, v, eventos, quem) && (tipo === 'utilidade' || st.ativos[v]?.af)) mudou = true;
  }
  return mudou;
}

/**
 * O automático da TINTURA (a regra dela — `regraDe`): "usar sozinha em combate" ATIVA com monstro vivo, pronta e com mana; DESATIVA fora de
 * combate e com a mana abaixo de `abaixoPct`% (0 = só quando a mana acabar, como no PoE — `tinturas.tique`). Devolve true se mudou.
 */
function automaticoDaTintura(estado, st, v, p, afp, emCombate, agora) {
  const r = regraDe(p);
  if (!r.emCombate || (v === 4 && Number(afp.sem_quinto_frasco) > 0)) return false;
  const t = Tinturas.registro(st)[v];
  if (t?.ativa) {
    const pouca = r.abaixoPct > 0 && (estado.mana ?? 0) < (estado.maxMana ?? 0) * (r.abaixoPct / 100);
    return !emCombate || pouca ? Tinturas.desativar(st, v, p, afp, agora) : false;
  }
  if (!emCombate || (r.abaixoPct > 0 && (estado.mana ?? 0) < (estado.maxMana ?? 0) * (r.abaixoPct / 100))) return false;
  return Tinturas.ativar(estado, st, v, p, afp, agora);
}

// ---------------------------------------------------------------- a regra de uso de cada frasco (dono, 07/10)

/** A regra de uso do frasco: `abaixoPct` (vida/mana abaixo de X% usa) ou `emCombate` (utilidade); o padrão vem de `regras.frascos.usoAutomatico`. */
export function regraDe(peca) {
  const U = F().usoAutomatico ?? {};
  const tipo = TIPO_DA_CLASSE[peca?.poe?.classe];
  // (a Tintura: em combate, e a mana abaixo da qual ela desativa — 0 = só quando a mana acabar)
  if (tipo === 'tintura') {
    const pct = Number(peca?.poe?.usarAbaixoPct);
    return { tipo, abaixoPct: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? Math.round(pct) : Tinturas.PADRAO.regra.abaixoPct, emCombate: peca?.poe?.usarEmCombate !== false };
  }
  const padrao = tipo === 'mana' ? U.manaAbaixoPct ?? 30 : U.vidaAbaixoPct ?? 50;
  const pct = Number(peca?.poe?.usarAbaixoPct);
  return { tipo, abaixoPct: Number.isFinite(pct) && pct >= 1 && pct <= 100 ? Math.round(pct) : padrao, emCombate: peca?.poe?.usarEmCombate !== false && U.utilidadeEmCombate !== false };
}

/** `send({t:'frasco', action:'configurar', vaga, abaixoPct | emCombate})`: a regra do frasco da vaga. */
export function configurar(estado, { vaga, abaixoPct, emCombate } = {}) {
  const peca = cinto(estado)[Number(vaga)];
  if (!peca) return { ok: false, erro: 'Essa vaga do cinto está vazia.' };
  const tipo = TIPO_DA_CLASSE[peca.poe?.classe];
  if (tipo === 'tintura') {
    if (typeof emCombate === 'boolean') peca.poe.usarEmCombate = emCombate;
    if (abaixoPct != null) {
      const pct = Math.round(Number(abaixoPct));
      if (!(pct >= 0 && pct <= 100)) return { ok: false, erro: 'A porcentagem vai de 0 a 100.' };
      peca.poe.usarAbaixoPct = pct;
    }
    if (typeof emCombate !== 'boolean' && abaixoPct == null) return { ok: false, erro: 'Diga "usar em combate" ou a mana para desativar.' };
    const r = regraDe(peca);
    return { ok: true, notice: `${peca.poe.nome}: ${r.emCombate ? `ativa sozinha em combate e desativa ${r.abaixoPct ? `com a mana abaixo de ${r.abaixoPct}%` : 'quando a mana acabar'}` : 'só na tecla'}.` };
  }
  if (tipo === 'utilidade') {
    if (typeof emCombate !== 'boolean') return { ok: false, erro: 'O frasco de Utilidade só tem a regra "usar em combate".' };
    peca.poe.usarEmCombate = emCombate;
    return { ok: true, notice: `${peca.poe.nome}: ${emCombate ? 'usa sozinho em combate' : 'só na tecla'}.` };
  }
  const pct = Math.round(Number(abaixoPct));
  if (!(pct >= 1 && pct <= 100)) return { ok: false, erro: 'A porcentagem vai de 1 a 100.' };
  peca.poe.usarAbaixoPct = pct;
  return { ok: true, notice: `${peca.poe.nome}: usa quando a ${tipo === 'hibrido' ? 'vida ou a mana' : tipo} estiver abaixo de ${pct}%.` };
}

/** Enche todos os frascos do cinto (a cidade). Só no jogo do PoE: no clássico o cinto nem existe — e criá-lo (`cinto`) marcava o
 *  personagem do Draevor como "do PoE" (`personagem/legado.mjs`; `morrerNaHunt` chamava isto também no clássico, 9cc51225). */
export function encherNaCidade(estado) {
  if (!ligado()) return;
  for (const p of cinto(estado)) if (p?.poe && !ehTinturaDoCinto(p)) p.poe.cargas = parametros(p).cargasMaximas;
}

/** Matou um monstro: cargas para todos os frascos do cinto, pela raridade dele (× a Recuperação de Cargas de cada frasco). */
export function aoMatar(estado, tipoDoMonstro = 'normal', morto = null) {
  if (!ligado()) return;
  const base = Number(F().cargasPorMorte?.[tipoDoMonstro] ?? F().cargasPorMorte?.normal ?? 1) || 0;
  // (+ a "Recarga de Frasco recebida aumentada" do personagem; + ciclo 7, lote E: "Inimigos que você Matar sob efeito de Afecções Elementais
  // concedem X% de Cargas de Frascos aumentadas" — o morto Incendiado, Congelado, Eletrizado ou Resfriado; + "Inimigos nos quais você infligiu
  // Sangramento concedem X% de aumento das Cargas de Frasco" — o morto sangrando.)
  const afp = doPersonagem(estado);
  if (Number(afp.sem_cargas_de_frasco) > 0) return;
  const agora = estado?.hunt?.clock ?? 0;
  const e = morto?.estados ?? {};
  const elemental = !!morto && (['congelado', 'chocado', 'lento'].some((k) => e[k]?.ate > agora) || (morto.dots ?? []).some((d) => d.tipo === 'queimadura' && d.falta > 0));
  // (+ lote F: "Inimigo Marcado concede Cargas de Frasco aumentadas em X% a Você" — a sua Marca no morto.)
  const marcado = !!morto && Object.values(morto.maldicoes ?? {}).some((m) => m?.marca && m.ate > agora);
  const sangrando = (morto?.dots ?? []).some((d) => d.tipo === 'sangramento' && d.falta > 0);
  const doPersonagemPct = (Number(afp.frasco_cargas_recebidas) || 0) + (elemental ? Number(afp.frasco_cargas_morto_elemental) || 0 : 0) + (marcado ? Number(afp.frasco_cargas_marcado) || 0 : 0) + (sangrando ? Number(afp.frasco_cargas_sangrando) || 0 : 0);
  for (const p of cinto(estado)) {
    if (!p || ehTinturaDoCinto(p)) continue;
    const par = parametros(p, afp);
    p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + base * Math.max(0, 1 + (par.recargaPct + doPersonagemPct) / 100));
  }
  // (12/10, A Lâmina Viva: "X% de chance de remover N Queima de Mana ao Matar" — na Tintura ativa.)
  const chance = Number(afp.tintura_remover_queima_chance) || 0;
  if (chance > 0 && estado?.hunt?.frascosPoe && Math.random() * 100 < chance) Tinturas.removerQueimas(estado.hunt.frascosPoe, Number(afp.tintura_remover_queima_n) || 1);
}

/**
 * (lote G-A, dono 25/10) As CARGAS DE FRASCO ganhas por fora do abate (a Marca do Alquimista: "Ganha 1 Cargas de Frasco quando você Acertar um Inimigo Amaldiçoado"): `n` em
 * cada frasco do cinto (as Tinturas não), × a "Recarga de Frasco recebida aumentada" do frasco e do personagem, até o máximo de cada um. Devolve se algum ganhou.
 */
/**
 * (06/11, a Lamúria de Khatal: "Ao realizar um ataque não canalizador, define um frasco de vida com mais de 50% das cargas máximas restantes para 50%") o primeiro
 * frasco de Vida do cinto acima da metade volta à metade; devolve quantas cargas saíram (o "+2% ao multiplicador de dano degenerativo" por carga — `mods-poe`).
 */
export function cargasDaLamuria(estado) {
  for (const p of cinto(estado)) {
    if (!p?.poe || ehTinturaDoCinto(p) || !contaComo(p, 'vida')) continue;
    const max = parametros(p).cargasMaximas;
    const atual = cargasDe(p, parametros(p));
    if (!(max > 0) || !(atual > max / 2)) continue;
    const metade = Math.floor(max / 2);
    p.poe.cargas = metade;
    return atual - metade;
  }
  return 0;
}

/** (06/11, a Urna Come-Cinzas: "Recarrega N Cargas ao consumir um Corpo Incendiado") os frascos com a linha ganham as cargas ao consumir um cadáver (qualquer: o jogo não guarda o Incêndio no cadáver). */
export function aoConsumirCadaver(estado) {
  for (const p of cinto(estado)) {
    if (!p?.poe || ehTinturaDoCinto(p)) continue;
    const par = parametros(p);
    if (par.cargasAoConsumirCadaver > 0) p.poe.cargas = Math.min(par.cargasMaximas, cargasDe(p, par) + par.cargasAoConsumirCadaver);
  }
}

export function ganharCargas(estado, n = 1) {
  if (!ligado() || !(n > 0)) return false;
  const afp = doPersonagem(estado);
  // (06/11, o Cálice Transbordante: "Não Recebe Cargas durante o Efeito de qualquer Frasco Cálice Transbordante" — `sem_cargas_de_frasco`, durante o efeito)
  if (Number(afp.sem_cargas_de_frasco) > 0) return false;
  let mudou = false;
  for (const p of cinto(estado)) {
    if (!p || ehTinturaDoCinto(p)) continue;
    const par = parametros(p, afp);
    const antes = cargasDe(p, par);
    p.poe.cargas = Math.min(par.cargasMaximas, antes + n * Math.max(0, 1 + (par.recargaPct + (Number(afp.frasco_cargas_recebidas) || 0)) / 100));
    if (p.poe.cargas !== antes) mudou = true;
  }
  return mudou;
}

/** PoE: o personagem foi acertado por OUTRO JOGADOR (o duelo): os frascos com "Efeito é removido quando Acertado por um Jogador" acabam. */
export function aoSerAcertadoPorJogador(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return false;
  let mudou = false;
  for (const [v, a] of Object.entries(st.ativos)) if (a.saiNoPvp) { delete st.ativos[v]; mudou = true; }
  return mudou;
}

/** Os atributos dos frascos de Utilidade ativos agora (somados em `Afixos.soma`). null: nenhum. */
export function adds(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return null;
  const agora = estado.hunt.clock ?? 0;
  const total = {};
  for (const a of [...Object.values(st.ativos), ...(st.extras ?? [])]) if (a.af && a.ate > agora) for (const [k, v] of Object.entries(a.af)) total[k] = (total[k] ?? 0) + v;
  // (06/11, o Sangue Mágico: os frascos Mágicos sempre ligados — `constantesDoSangueMagico`)
  for (const a of st.constantes ?? []) for (const [k, v] of Object.entries(a.af ?? {})) total[k] = (total[k] ?? 0) + v;
  // + as TINTURAS ativas (e as que perduram) — a foto do tique (`tinturas.adds`).
  for (const [k, v] of Object.entries(Tinturas.adds(st, agora) ?? {})) total[k] = (total[k] ?? 0) + v;
  return Object.keys(total).length ? total : null;
}

/** Os frascos ativos como cartões de buff da caçada. */
export function buffs(estado) {
  const st = estado?.hunt?.frascosPoe;
  if (!st) return [];
  const agora = estado.hunt.clock ?? 0;
  // (a Tintura ativa não tem tempo: o cartão mostra a Queima de Mana dela)
  const tinturas = Tinturas.ativas(st).map(([v, t]) => ({ icone: null, nome: t.nome, resta: null, tipo: 'tinturaPoe', vaga: Number(v), tintura: { queimas: t.queimas ?? 0 } }));
  return [...Object.entries(st.ativos).filter(([, a]) => a.ate > agora && (a.af || a.porMs)).map(([v, a]) => ({ icone: null, nome: a.nome, resta: a.ate - agora, tipo: 'frascoPoe', vaga: Number(v) })), ...tinturas];
}

/** O cinto para a tela: cada vaga com o frasco (a peça), as cargas, o custo e se está ativo. */
export function paraCliente(estado) {
  if (!ligado()) return null;
  // Na cidade (fora da caçada) os frascos estão sempre cheios (dono, 07/10: "voltando para a cidade recupera na hora a carga").
  if (!estado.hunt) encherNaCidade(estado);
  const agora = estado.hunt?.clock ?? 0;
  const ativos = estado.hunt?.frascosPoe?.ativos ?? {};
  const tinturas = estado.hunt?.frascosPoe?.tinturas ?? {};
  return cinto(estado).map((p, v) => {
    if (!p) return null;
    // (a Tintura: ativa, as Queimas de Mana, a recarga que falta e a regra)
    if (ehTinturaDoCinto(p)) {
      const t = tinturas[v] ?? null;
      const regra = regraDe(p);
      const recarga = t && !t.ativa ? Math.max(0, (t.recargaAte ?? 0) - agora) : 0;
      return { peca: p, tipo: 'tintura', ativa: !!t?.ativa, queimas: t?.ativa ? t.queimas ?? 0 : 0, recargaMs: recarga, recargaTotalMs: recarga ? t.recargaTotal ?? recarga : 0, ativoAte: t?.ativa ? 1 : 0, regra: { abaixoPct: regra.abaixoPct, emCombate: regra.emCombate } };
    }
    const par = parametros(p, doPersonagem(estado));
    const regra = regraDe(p);
    return { peca: p, cargas: Math.floor(cargasDe(p, par)), cargasMaximas: par.cargasMaximas, cargasPorUso: par.cargasPorUso, tipo: par.tipo, ativoAte: ativos[v]?.ate > agora ? ativos[v].ate - agora : 0, regra: { abaixoPct: regra.abaixoPct, emCombate: regra.emCombate } };
  });
}
