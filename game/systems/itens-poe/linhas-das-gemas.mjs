// As LINHAS LOCAIS das gemas ativas do PoE (dono, 17/10: "zero efeitos ausentes … arquitetura reutilizável, mas com comportamento
// específico"). Muitas linhas de gema são um modificador que vale SÓ nos usos daquela gema — "200% de Poder Arcano" (Raio Cinético), "X% mais
// Velocidade de Ataque por Carga de Frenesi" (Frenesi), "X% mais Dano com a Arma Principal" (Golpe Duplo da Ambidestria), "Chance de Crítico
// aumentada em X% contra Inimigos Eletrizados" (Armadilha de Raio) — e o jogo já calcula esse modificador quando ele vem da árvore ou de uma
// peça (`poder_arcano`, `atk_speed_mais`, `mais_dano@maoPrincipal`, `crit_chance_inc@alvoEletrizado`…). Aqui cada linha vira os ATRIBUTOS do
// PoE no formato da soma (`stat%escala@condições` — `condicoes-poe.partir`), e no uso da gema eles entram na ficha DAQUELE uso como
// condicionais de golpe (`ficha.porTag`, com a tag `habilidade`, que todo uso tem): o dano, o crítico, a área, a velocidade e os eventos do
// acerto os leem pelo caminho de sempre (`somaPorTags`/`valor`). Nada vale fora da gema.
//
//   REGRAS: as frases próprias das gemas (o "mais"/"menos" e os "por Carga" que as peças não escrevem assim) e, sem regra própria, o tradutor
//   dos mods das peças e da árvore (`traduzir.traduzirParte`) — a mesma frase, a mesma chave. Só entra a linha cujos atributos têm efeito no
//   combate (`traduzir.atributoTemEfeito`): o resto segue "efeito não simulado" no status da gema.
import { ligado } from './catalogo.mjs';
import { partir, ehCondDeEstado, condicoesDe, vale, fatorDaEscala, comTeto, ESCALAS_DA_FICHA } from './condicoes-poe.mjs';
import { traduzirParte, atributoTemEfeito } from './traduzir.mjs';

const N = String.raw`(\d+(?:[.,]\d+)?)`;
const num = (x) => Number(String(x).replace(',', '.'));
/**
 * [regex, (m) => { atributo: valor }]. O valor é o número da linha no nível (o PoE escreve "menos" com o número positivo: o sinal sai aqui).
 * As condições são as do jogo (`CONDICOES_DE_ESTADO` e `TAGS_DE_GOLPE`); a escala "por Carga de X" é `%carga:<x>` (`fatorDaEscala`).
 */
const CARGA = { Frenesi: 'frenesi', Poder: 'poder', Tolerância: 'tolerancia' };
const REGRAS = [
  // "200 % de Poder Arcano": os aumentos de Dano Mágico também valem no dano de ataque desta gema, a X% do valor (`fichaDoGolpe`).
  [new RegExp(`^${N} ?% de Poder Arcano$`), (m) => ({ poder_arcano: num(m[1]) })],
  // "X% de chance de causar Dano Dobrado" (Golpe Pesado) e "2% de chance de causar dano dobrado para cada 10 de inteligência" (o de Trarthus).
  [new RegExp(`^${N} ?% de chance de causar Dano Dobrado$`, 'i'), (m) => ({ chance_dano_dobrado: num(m[1]) })],
  [new RegExp(`^${N} ?% de chance de causar dano dobrado para cada ${N} de inteligência$`, 'i'), (m) => ({ [`chance_dano_dobrado%atr:int:${num(m[2])}`]: num(m[1]) })],
  // O crítico com condição do alvo.
  [new RegExp(`^${N} ?% de aumento da Chance de Acerto Crítico contra Inimigos Eletrizados$`), (m) => ({ 'crit_chance_inc@alvoEletrizado': num(m[1]) })],
  [new RegExp(`^${N} ?% mais Chance de Acerto Crítico contra Inimigos que estejam em Vida Cheia$`), (m) => ({ 'crit_mais_pct@alvoVidaCheia': num(m[1]) })],
  // Por Carga (de Frenesi, Poder, Tolerância).
  [new RegExp(`^${N} ?% mais Change? de Golpe Crítico por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`crit_mais_pct%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^\\+${N} ?% de Multiplicador de Acerto Crítico por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`crit_dmg%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Dano com Ataques por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`mais_dano%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Velocidade de Ataque por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`atk_speed_mais%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  [new RegExp(`^${N} ?% mais Área de Efeito por Carga de (Frenesi|Poder|Tolerância)$`), (m) => ({ [`area_mais%carga:${CARGA[m[2]]}`]: num(m[1]) })],
  // A Postura (Sangue e Areia) e a mão do ataque.
  [new RegExp(`^${N} ?% mais Área de Efeito enquanto na Postura da Areia$`), (m) => ({ 'area_mais@posturaAreia': num(m[1]) })],
  [new RegExp(`^${N} ?% menos Dano na Postura de Sangue$`), (m) => ({ 'mais_dano@posturaSangue': -num(m[1]) })],
  [new RegExp(`^${N} ?% mais Dano com a Arma Principal$`), (m) => ({ 'mais_dano@maoPrincipal': num(m[1]) })],
  // As frases de gema que as peças escrevem de outro jeito: a duração da habilidade, a velocidade de conjuração (a da gema soma como a "com
  // Habilidades de X" — `cast_speed_tag`), o efeito do Empalamento.
  [new RegExp(`^Duração do Efeito de Habilidades? aumentada em ${N} ?%$`), (m) => ({ duracao_habilidades: num(m[1]) })],
  [new RegExp(`^Velocidade de Conjuração aumentada em ${N} ?%$`), (m) => ({ cast_speed_tag: num(m[1]) })],
  [new RegExp(`^Efeito do Empalamento aumentado em ${N} ?%$`), (m) => ({ efeito_empalamento: num(m[1]) })],
  // "mais Dano com Acertos e Afecções" contra um alvo (o golpe inteiro — as afecções do jogo saem do acerto).
  [new RegExp(`^\\+?${N} ?% mais Dano com Acertos e Afecções contra Inimigos em Vida Cheia$`), (m) => ({ 'mais_dano@alvoVidaCheia': num(m[1]) })],
  [new RegExp(`^${N} ?% mais Dano com Acertos e Afecções contra Inimigos Incendiados$`), (m) => ({ 'mais_dano@alvoIncendiado': num(m[1]) })],
];

/**
 * Os atributos que o USO de uma gema lê da ficha do golpe (com as tags dele — `condicoes-poe.fichaDoGolpe`, `valor`, `alvosDasPecas`,
 * `acoes.temposDaGemaPoe`). Um atributo fora daqui (o máximo de zumbis, a resistência dos lacaios…) vale na ficha do PERSONAGEM, não num
 * uso: a linha local com ele segue "efeito não simulado" até alguém o ler no uso — o balão não promete o que o golpe não faz.
 */
const LIDOS_NO_USO = /^(dmg_inc|crit_chance_inc|crit_chance|crit_dmg|crit_mais_pct|elem_pen|phys_pen|fire_pen|ice_pen|energy_pen|phys_dmg|fire_dmg|ice_dmg|energy_dmg|chaos_dmg|mais_dano|mais_dano_(fisico|fogo|gelo|raio|caos|elemental)|life_leech|mana_leech|poder_arcano|chance_dano_dobrado|chance_dano_triplo|ignora_reducao_fisica|nunca_critico|added_(fire|ice|energy|chaos|physical)_dmg_(min|max)|area_inc|area_mais|atk_speed|atk_speed_mais|cast_speed_tag|furia_por_acerto|(chance|dot|dano_dot|ailment|poison|bleed|ignite|duracao|efeito)_[a-z_]+)$/;
const lidoNoUso = (k) => LIDOS_NO_USO.test(partir(k).stat) && atributoTemEfeito(k);

/** Os atributos de UMA linha (com os números do nível): `{ stat: valor }`, ou null se nenhuma regra tem efeito no uso da gema. */
export function atributosDaLinha(linha) {
  const l = String(linha).trim();
  // (a qualidade escreve "+(0 — 50) % de Poder Arcano": o "+" na frente não muda a regra)
  const semMais = l.replace(/^\+\s*/, '');
  for (const [re, f] of REGRAS) {
    const m = re.exec(l) ?? re.exec(semMais);
    if (m) { const af = f(m); return Object.keys(af).every(lidoNoUso) ? af : null; }
  }
  // O tradutor das peças e da árvore: a linha como modelo (cada número vira `{i}`).
  const valores = [];
  const modelo = l.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, x) => `${x}%`).replace(/\d+(?:[.,]\d+)?/g, (x) => { valores.push(num(x)); return `{${valores.length - 1}}`; });
  const t = traduzirParte(modelo, valores);
  if (!['equivalente', 'aproximado', 'novo'].includes(t.estado) || !t.efeitos.length) return null;
  const af = {};
  for (const e of t.efeitos) {
    if (typeof e.valor !== 'number' || !lidoNoUso(e.stat)) return null;
    af[e.stat] = (af[e.stat] ?? 0) + e.valor;
  }
  return af;
}
/** A linha é uma linha local que o jogo faz (sai de "efeito não simulado"). */
export const ehLinhaLocalDaGema = (linha) => !!atributosDaLinha(linha);

/** Os atributos locais de uma lista de linhas: `{ af, feitas: [linha] }`. */
export function atributosDasLinhas(linhas = []) {
  const af = {};
  const feitas = [];
  for (const l of linhas) {
    const x = atributosDaLinha(l);
    if (!x) continue;
    feitas.push(l);
    for (const [k, v] of Object.entries(x)) af[k] = (af[k] ?? 0) + v;
  }
  return { af, feitas };
}

/**
 * A ficha DESTE uso com as linhas locais da gema (`af`, de `atributosDasLinhas`): cada atributo entra em `ficha.porTag` com a tag
 * `habilidade` (mais as tags de golpe da chave), já com as condições de estado conferidas e a escala ("por Carga") resolvida — como
 * `condicoes-poe.porTag` faz com a soma do personagem (o total para os máximos e as escalas é o do personagem: `ficha.afPoe`). A mesma
 * ficha volta se nada vale. `marca`: para não somar duas vezes no mesmo uso (o `disparar` e o `contaDoDano` passam pela mesma ficha).
 */
export function fichaComAsLinhas(estado, ficha, af, marca) {
  if (!ligado() || !ficha?.afPoe || !af || !Object.keys(af).length || ficha.linhasDaGema === marca) return ficha;
  const extra = [];
  let conds = null;
  for (const [k, v] of Object.entries(af)) {
    if (typeof v !== 'number' || !v || String(k).startsWith('ev:')) continue;
    const { stat, escala, conds: c, teto } = partir(k);
    if (escala && ESCALAS_DA_FICHA.test(escala)) continue;
    const deEstado = c.filter((x) => ehCondDeEstado(x));
    if (deEstado.length) {
      conds ??= condicoesDe(estado, ficha.afPoe, null);
      if (!deEstado.every((x) => vale(conds, x))) continue;
    }
    const m = escala ? fatorDaEscala(estado, ficha.afPoe, null, escala) : 1;
    if (m) extra.push({ stat, tags: ['habilidade', ...c.filter((x) => !ehCondDeEstado(x))], valor: comTeto(v, m, teto) });
  }
  if (!extra.length) return { ...ficha, linhasDaGema: marca };
  return { ...ficha, porTag: [...(ficha.porTag ?? []), ...extra], linhasDaGema: marca };
}

/**
 * (17/10, lote G8) As linhas de BUFF das gemas de aura, arauto, guarda e clamor ("Buff concede…"): o que o buff dá a quem o tem, como os
 * atributos da soma (`GemasPoe.buffNoNivel` → `afPoe` do buff → a ficha). Primeiro as frases próprias (o dano adicionado dos Arautos — aos
 * ataques e às magias), depois o tradutor das peças com o "Buff concede" tirado ("Buff concede Imunidade a Sangramento" → `imune_sangramento`).
 * Só entra o atributo com efeito no combate. `{ stat: valor }` ou null.
 */
const EL_DO_BUFF = { Gelo: 'ice', Fogo: 'fire', Raio: 'energy', Caos: 'chaos', Físico: 'physical' };
const BUFF_PROPRIO = [
  [new RegExp(`^Buff concede (?:de )?${N} a ${N} de Dano (?:de Ataque de (Gelo|Fogo|Raio|Caos|Físico)|de (Gelo|Fogo|Raio|Caos|Físico) com Ataques) Adicional$`, 'i'), (m) => { const e = EL_DO_BUFF[m[3] ?? m[4]]; return { [`added_${e}_dmg_min`]: num(m[1]), [`added_${e}_dmg_max`]: num(m[2]) }; }],
  [new RegExp(`^Buff concede (?:de )?${N} a ${N} de Dano (?:Mágico de (Gelo|Fogo|Raio|Caos|Físico) Adicional|de (Gelo|Fogo|Raio|Caos|Físico) Mágico)$`, 'i'), (m) => { const e = EL_DO_BUFF[m[3] ?? m[4]]; return { [`spell_added_${e}_dmg_min`]: num(m[1]), [`spell_added_${e}_dmg_max`]: num(m[2]) }; }],
  // (as auras: "Você e aliados próximos ganham 49 % mais Armadura", "… 4 % de Resistência máxima a Fogo adicional", "… são Imunes à Incêndio")
  [new RegExp(`^(?:Buff concede |Você e aliados próximos ganham )${N} ?% mais Armadura$`, 'i'), (m) => ({ armour_mais: num(m[1]) })],
  [new RegExp(`^(?:Buff concede |Você e aliados próximos ganham )${N} ?% de Resistência máxima a (Fogo|Frio|Gelo|Raio|Caos) adicional$`, 'i'), (m) => ({ [`${{ Fogo: 'fire', Frio: 'ice', Gelo: 'ice', Raio: 'energy', Caos: 'chaos' }[m[2]]}_res_max`]: num(m[1]) })],
  [new RegExp(`^Você e (?:seus )?aliados próxim\\S* (?:ganham|têm|tem) Duração do Efeito de Habilidades aumentada em ${N} ?%$`, 'i'), (m) => ({ duracao_habilidades: num(m[1]) })],
  [/^(?:Buff concede Imunidade a|Você e (?:seus )?aliados próxim\S* são Imunes [àa]) (Incêndio|Resfriamento|Congelamento|Eletrização|Sangramento|Veneno|Envenenamento)$/i, (m) => ({ [`imune_${{ Incêndio: 'incendio', Resfriamento: 'resfriamento', Congelamento: 'congelamento', Eletrização: 'eletrizacao', Sangramento: 'sangramento', Veneno: 'veneno', Envenenamento: 'veneno' }[m[1]]}`]: 1 })],
  // (Sangue e Areia: "Habilidades Corpo a Corpo causam 27 % mais Efeito em Área enquanto na Postura de Areia" — a condição `posturaAreia`)
  // (só a de AREIA: no jogo o buff ligado É a Postura de Areia — `condicoes-poe.posturaDe` —, e o atributo do buff só vale com ele ligado; a de
  // Sangue, que valeria com ele desligado, segue "não simulada")
  [new RegExp(`^Habilidades Corpo a Corpo (?:causam|têm) ${N} ?% (mais|menos) (Dano|Efeito) em Área enquanto na Postura de Areia$`, 'i'),
    (m) => ({ [`${m[3] === 'Dano' ? 'mais_dano' : 'area_mais'}@corpo+area+posturaAreia`]: (m[2] === 'menos' ? -1 : 1) * num(m[1]) })],
  [new RegExp(`^Estandarte concede \\+${N} ?% de chance de Suprimir o Dano Mágico a Você e Aliados$`, 'i'), (m) => ({ spell_suppression: num(m[1]) })],
  [new RegExp(`^Buff concede ${N} ?% mais Dano (Físico|de Fogo|de Gelo|de Raio|de Caos)$`, 'i'), (m) => ({ [{ Físico: 'mais_dano_fisico', 'de Fogo': 'mais_dano_fogo', 'de Gelo': 'mais_dano_gelo', 'de Raio': 'mais_dano_raio', 'de Caos': 'mais_dano_caos' }[m[2]]]: num(m[1]) })],
];
export function atributosDoBuff(linha) {
  const l = String(linha).trim();
  for (const [re, f] of BUFF_PROPRIO) { const m = re.exec(l); if (m) { const af = f(m); return Object.keys(af).every(atributoTemEfeito) ? af : null; } }
  // (lote G13: "Estandarte concede Precisão aumentada em 8% a Você e Aliados" — o buff do Estandarte vale em você e nos aliados na área)
  const sem = l.replace(/^Estandarte concede (.+?) a Você e Aliados$/i, '$1').replace(/^Buff concede /i, '').replace(/^Você e (?:seus )?aliados próxim\S* (?:ganham|têm|tem|possuem) /i, '').replace(/^Você e (?:seus )?aliados próxim\S* são /i, 'Você é ');
  if (sem === l && !/^Dano não pode ser Refletido$/i.test(l) && !/^Você é /i.test(sem)) return null;
  const t0 = sem.charAt(0).toUpperCase() + sem.slice(1);
  const valores = [];
  const modelo = t0.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, x) => `${x}%`).replace(/\d+(?:[.,]\d+)?/g, (x) => { valores.push(num(x)); return `{${valores.length - 1}}`; });
  const t = traduzirParte(modelo, valores);
  if (!['equivalente', 'aproximado', 'novo'].includes(t.estado) || !t.efeitos.length) return null;
  const af = {};
  for (const e of t.efeitos) {
    if (typeof e.valor !== 'number' || !atributoTemEfeito(e.stat)) return null;
    af[e.stat] = (af[e.stat] ?? 0) + e.valor;
  }
  return af;
}
export const ehLinhaDoBuff = (l) => !!atributosDoBuff(l);
