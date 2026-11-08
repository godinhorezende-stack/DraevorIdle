// Os CATALISADORES do PoE (08/11, balão 0 sem efeito — o dono: "Criar os Catalisadores", pela Tentação de Ixchel: "Qualidade Máxima é 200%"). A qualidade
// numa JOIA (anel, amuleto, cinto) não mexe na base: ela aumenta em qualidade% os modificadores do TIPO do catalisador (o Abrasivo, os de Ataque; o Fértil,
// os de Vida e Mana…), implícitos e explícitos — poedb › Catalyst. Outro tipo de catalisador troca o tipo e zera a qualidade de antes.
//   - O TIPO de cada linha sai do texto dela (as tags do poedb — Ataque, Conjurador, Defesas, resource… — pelo que a linha fala), igual em peça rara e única.
//   - O ganho por uso é o das outras moedas de qualidade (+5 normal, +2 mágica, +1 rara/única — `moedas.subirQualidade`), até 20% ou o da peça.
//   - O Maculado (só em joia corrompida): tipo e porcentagem aleatórios.
import { comMagnitude } from './gerar.mjs';

export const JOIAS = new Set(['Rings', 'Amulets', 'Belts']);
/** O tipo de qualidade de cada catalisador. */
export const DO_CATALISADOR = Object.freeze({
  Abrasive_Catalyst: 'ataque', Accelerating_Catalyst: 'velocidade', Fertile_Catalyst: 'vidaMana', Imbued_Catalyst: 'conjuracao', Intrinsic_Catalyst: 'atributo',
  Noxious_Catalyst: 'fisicoCaos', Prismatic_Catalyst: 'resistencia', Tempering_Catalyst: 'defesa', Turbulent_Catalyst: 'elemental', Unstable_Catalyst: 'critico',
});
/** O nome do tipo no balão ("Qualidade (Modificadores de Ataque)"). */
export const NOME_DO_TIPO = Object.freeze({
  ataque: 'Modificadores de Ataque', velocidade: 'Modificadores de Velocidade', vidaMana: 'Modificadores de Vida e Mana', conjuracao: 'Modificadores de Conjuração',
  atributo: 'Modificadores de Atributos', fisicoCaos: 'Modificadores de Dano Físico e de Caos', resistencia: 'Modificadores de Resistências',
  defesa: 'Modificadores de Defesa', elemental: 'Modificadores de Dano Elemental', critico: 'Modificadores Críticos',
});
/** O tipo da linha pelo texto (as tags do poedb, pelo que a linha fala). */
const DO_TEXTO = {
  ataque: /Ataque|Precisão|com Armas?\b/,
  velocidade: /Velocidade/,
  vidaMana: /\bVida\b|\bMana\b/,
  conjuracao: /Magia|Conjura|Feitiço/,
  atributo: /Força|Destreza|Inteligência|Atributos/,
  fisicoCaos: /Dano.*(?:Físic|Caos)|(?:Físic|Caos).*Dano/,
  resistencia: /Resistência/,
  defesa: /Armadura|Evasão|Escudo de Energia|Bloque|Suprimir/,
  elemental: /Dano.*(?:Fogo|Gelo|Raio|Elementa)|(?:Fogo|Gelo|Raio|Elementa).*Dano/,
  critico: /Crític/,
};
export const linhaDoTipo = (modelo, tipo) => !!DO_TEXTO[tipo]?.test(String(modelo ?? ''));

/** A peça com as linhas do tipo da qualidade já aumentadas (para a tradução). Sem catalisador, a própria peça. */
export function comCatalisador(p) {
  const q = Number(p?.qualidade) || 0;
  const tipo = p?.qualidadeTipo;
  if (!q || !tipo || !JOIAS.has(p.classe)) return p;
  const subir = (lista) => (lista ?? []).map((m) => (m?.valores?.length && linhaDoTipo(m.modelo, tipo) ? comMagnitude(m, q) : m));
  return { ...p, implicitos: subir(p.implicitos), prefixos: subir(p.prefixos), sufixos: subir(p.sufixos), modificadores: subir(p.modificadores) };
}
