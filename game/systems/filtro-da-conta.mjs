// O FILTRO DE LOOT DA CONTA — a caixinha "Toda a conta" do Filtro de loot
// ("usar as configurações deste loot filter para todos os chares da conta").
//
// Ela era gravada (`lootFiltro.paraTodos`) e ninguém lia (relato, 30/09:
// "parece que tá vendendo tudo independente do que eu marque"). Na caçada em
// grupo com os outros chars da MESMA conta, o loot cai em rodízio — e o que
// caía para os outros era vendido pelo filtro DELES, vazio.
//
// Agora: ligar a caixinha publica o filtro deste personagem nos dados da conta
// (`melhorias_da_conta.filtroDeLoot`), e TODOS os chars da conta passam a usá-lo
// — os online na hora, os outros ao entrar. Com ela ligada, mudar o filtro em
// qualquer um muda em todos. Desligar deixa cada um com a sua cópia (nada se
// perde). O filtro = as três listas por item (não coletar, não vender, afixo só
// nestes) e as regras de guardar da venda automática (raridade, nível e
// quantidade do atributo). Puro: quem lê/grava a conta e avisa as sessões é a sessão.
import * as Bolsa from './bolsa.mjs';

// (As seções do filtro do PoE — `Afixos.regraDasSecoesPoe` — também: sem elas, "Toda a conta" no jogo oficial não levava nada das seções.)
export const CHAVES_DE_GUARDAR = [
  'guardarRaridade', 'guardarNivel', 'guardarQuantos', 'guardarAfixo', 'guardarEstrelas', 'guardarSockets', 'guardarLigados', 'guardarAtributos', 'guardarNivelMinimo',
  'guardarRaridadePoe', 'guardarModsPoe', 'guardarTierPoe', 'guardarIlvlPoe', 'guardarRgbPoe',
  // (As abas por tipo de item do filtro do PoE — `Afixos.CHAVE_DA_RARIDADE_DO_TIPO`.)
  'guardarRaridadePoeArmas', 'guardarRaridadePoeArmaduras', 'guardarRaridadePoeAcessorios', 'guardarRaridadePoeFrascos',
];
const LISTAS = ['noLoot', 'noSell', 'soAfixo'];

/** Este pedido do cliente muda o filtro? (listas por item ou as regras de guardar) */
export const mudaOFiltro = (m) => m?.t === 'itemRule' || m?.t === 'lootPreset' || m?.t === 'lootRegras' || (m?.t === 'settings' && Object.keys(m).some((k) => CHAVES_DE_GUARDAR.includes(k)));

/** O filtro deste personagem, copiado (o que vai para a conta). */
export function copia(estado) {
  Bolsa.garantir(estado);
  return {
    itemRules: Object.fromEntries(LISTAS.map((k) => [k, [...(estado.itemRules[k] ?? [])]])),
    guardar: Object.fromEntries(CHAVES_DE_GUARDAR.filter((k) => estado.settings?.[k] != null).map((k) => [k, estado.settings[k]])),
    regras: structuredClone(estado.lootRegras ?? []),
  };
}

/** Põe o filtro da conta neste personagem (e marca "Toda a conta"). */
export function aplicar(estado, filtro) {
  Bolsa.garantir(estado);
  for (const k of LISTAS) estado.itemRules[k] = [...(filtro?.itemRules?.[k] ?? [])].map(Number).filter(Number.isFinite);
  for (const k of CHAVES_DE_GUARDAR) {
    if (filtro?.guardar?.[k] != null) estado.settings[k] = filtro.guardar[k];
    else delete estado.settings[k];
  }
  if (Array.isArray(filtro?.regras)) estado.lootRegras = structuredClone(filtro.regras);
  estado.lootFiltro.paraTodos = true;
}
