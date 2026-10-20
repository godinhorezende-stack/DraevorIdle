// O LOTE A5 das gemas do PoE (dono, 20/10: os suportes simples e as linhas das famílias 1–4 — os atributos, a arma e as duas armas, a Eletrização e o
// Resfriamento, a Exposição e a resistência). Quase tudo virou atributo lido no uso (`linhas-das-gemas.mjs`, `suportes-poe.mjs`); aqui ficam os DADOS
// das linhas que pedem um leitor próprio — o que a linha diz no nível e na qualidade — e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (o
// status e os leitores no nível) e `acoes.mjs` (o uso).
//
// As decisões do dono (20/10), todas as recomendações dos planos:
//   - f34 D1: o Condutor Elétrico conta "por cada 5% de Eletrização" (o PoB divide por 5, act_int.lua:12383-12397; o "1%" é da tradução do poedb);
//   - f34 D2: e tira a Eletrização do alvo depois do acerto (a descrição);
//   - f34 D8: a Onda de Convicção põe a Exposição no elemento que mais causou dano DEPOIS da resistência, depois do acerto;
//   - f34 D9: a Bomba Congelante põe a Exposição antes do dano (os pulsos do PoE vêm antes da explosão), pela duração secundária × a Duração;
//   - f12 D7: a Detonação da Adaga usa o dano da adaga com os locais dela, 60% de cada com duas;
//   - D4 (f34): o raio do Solo Resfriado do Estalo Gélido sai da linha (o mesmo número dos 3 m de antes).
//
// EXCEÇÕES DO DONO (20/10, as escolhas sem fonte do lote A5, aceitas): (1) a Lâmina Mágica e a Detonação da Adaga usam o físico da arma com os locais e a qualidade
// (a secundária também leva a qualidade, que a ficha não dá a ela) e o elemental somado da própria peça; a Detonação, com duas adagas, 60% de cada (o texto; o PoB
// usa 50%); (2) o Golpe Duplo da Ambidestria: o intervalo da ficha × (o da secundária ÷ a média das duas), com o "Mão Secundária aumentada" da ficha; (3) o
// Coursing Current: a Eletrização/o Resfriamento que nasce do outro tem a duração base com os modificadores de sempre, a força do outro no teto dele (30 no
// Resfriamento); (4) a área fria: 10% × (1 + o Efeito aumentado do uso) × (1 + o "mais"), até 30% — só as linhas da gema e dos suportes, não as da árvore; (5) o
// Gelo sofrido do Resfriamento Ósseo (`fragilGelo`) dura o mesmo que o Resfriamento que o pôs; (6) a Exposição da gema soma o "Exposição a <elemento> aplica X%
// extra" da soma; com uma ativa, fica o maior % e o fim mais longe; (7) o abate pelo Empalamento refletido é de quem golpeou (você ou o totem); (8) o Dreno de Vida
// numa gema que é ataque e magia vale nos dois.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- o Condutor Elétrico

/**
 * (f34 D1/D2) O CONDUTOR ELÉTRICO (Lightning Conduit): "20 % mais Dano com Acertos por cada 1% de Efeito de Eletrização no Inimigo" e, na qualidade, "+4 % …
 * por cada 5%" — no PoB os dois são `energy_release_damage_+%_final_per_5%_increased_damage_taken_from_shock_on_target`: X% a cada 5% de Eletrização no
 * alvo. `{ porCada5Pct, tiraEletrizacao }`, ou null fora da gema.
 */
const LINHA_DO_CONDUTOR = /^\+?([\d.]+) % mais Dano com Acertos por cada [15] ?% de Efeito de Eletrização no Inimigo$/i;
export function condutorDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Lightning_Conduit/.test(slug)) return null;
  // (revisão do A5: só a gema BASE tira a Eletrização — "então remove a Eletrização de tais inimigos" está só na descrição dela; a dos Céus Eletriza)
  // (lote B1, dono 20/10: só a BASE acerta só os Eletrizados — o PoB: "Lightning strikes all Shocked enemies around a targeted location", act_int.lua:12378; a dos Céus
  // "strikes a number of enemies around a targeted location", sem Eletrização — o máximo de alvos, `GemasB1.maxAlvosDasLinhas`)
  return { porCada5Pct: somar([...linhas, ...daQualidade], LINHA_DO_CONDUTOR), tiraEletrizacao: slug === 'Lightning_Conduit', soEletrizados: slug === 'Lightning_Conduit', segurarEletrizacao: slug === 'Lightning_Conduit' };
}
/** O "mais" contra o alvo com `eletrizadoPct` de Eletrização: 1 + X × floor(pct ÷ 5) / 100 (o PoB arredonda para baixo). */
export const maisContraEletrizado = (d, eletrizadoPct) => 1 + ((d?.porCada5Pct ?? 0) * Math.floor(Math.max(0, Number(eletrizadoPct) || 0) / 5 + 1e-9)) / 100;

// ---------------------------------------------------------------- o Solo Resfriado do Estalo Gélido

/** (D4) "Raio Base final do Solo Resfriado igual a 3 metros": o raio da área fria em metros (null sem a linha). */
const LINHA_DO_SOLO_RESFRIADO = /^Raio Base final do Solo Resfriado igual a ([\d.]+) metros?$/i;
export const raioDaAreaFriaDasLinhas = (linhas = []) => achar(linhas, LINHA_DO_SOLO_RESFRIADO);

// ---------------------------------------------------------------- a Exposição da gema

/**
 * (f34 D8/D9) A EXPOSIÇÃO que a gema põe: `{ el, pct, duracaoMs, antes }` — a Bomba Congelante ("Exposição a Gelo aplica -15 % de Resistência a Gelo", pela
 * "Duração Base Secundária" — o PoB: base_cold_damage_resistance_% −15, act_int.lua:7769/7788 —, ANTES do dano) e a Onda de Convicção ("Exposição aplica
 * -15 % de Resistência Elemental que combine com o maior Dano sofrido", `el: 'maior'` — o PoB: purge_expose_resist_%_matching_highest_element_damage,
 * act_int.lua:20800-20826 —, DEPOIS do acerto). Null sem a linha.
 */
const LINHA_EXPOSICAO_GELO = /^Exposição a Gelo aplica -?([\d.]+) % de Resistência a Gelo$/i;
const LINHA_EXPOSICAO_MAIOR = /^Exposição aplica -?([\d.]+) % de Resistência Elemental que combine com o maior Dano sofrido$/i;
const LINHA_DURACAO_SECUNDARIA = /^Duração Base Secundária é de ([\d.]+) segundos?$/i;
export function exposicaoDasLinhas(slug, linhas = []) {
  const seg = achar(linhas, LINHA_DURACAO_SECUNDARIA);
  const gelo = achar(linhas, LINHA_EXPOSICAO_GELO);
  if (gelo) return { el: 'ice', pct: gelo, duracaoMs: Math.round((seg ?? 5) * 1000), antes: true };
  const maior = achar(linhas, LINHA_EXPOSICAO_MAIOR);
  if (maior) return { el: 'maior', pct: maior, duracaoMs: Math.round((seg ?? 4) * 1000), antes: false };
  return null;
}
/** (f34 D8) O elemento (Fogo, Gelo ou Raio) que mais causou dano (`{ fire, ice, energy }`, depois da resistência); null sem dano elemental. */
export function elementoDoMaiorDano(porElemento = {}) {
  let el = null;
  for (const k of ['fire', 'ice', 'energy']) if ((Number(porElemento[k]) || 0) > 0 && (!el || porElemento[k] > porElemento[el])) el = k;
  return el;
}

// ---------------------------------------------------------------- a arma

/** (f12 #34) O Golpe Duplo da Ambidestria: "Utiliza o Tempo de Ataque da Arma Secundária" (o PoB: a flag UseOffhandAttackSpeed, act_dex.lua:5949). */
const LINHA_TEMPO_DA_SECUNDARIA = /^Utiliza o Tempo de Ataque da Arma Secundária$/i;
export const usaTempoDaSecundariaDasLinhas = (linhas = []) => linhas.some((l) => LINHA_TEMPO_DA_SECUNDARIA.test(norm(l)));
/**
 * (f12 #36, D7) A Detonação da Adaga: "Causa dano de magia adicional igual a 675 % do dano da adaga equipada Se duas adagas estiverem equipadas, cada uma
 * contribui com até 60% de dano adicional" (o PoB: gainPercentBaseDaggerDamageToSpells, act_dex.lua:1551). `{ pct, comDuasPct }` ou null.
 */
const LINHA_DA_ADAGA = /^Causa dano de magia adicional igual a ([\d.]+) % do dano da adaga equipada(?: Se duas adagas estiverem equipadas, cada uma contribui com até ([\d.]+) % de dano adicional)?$/i;
export function detonacaoDaAdagaDasLinhas(linhas = []) {
  for (const l of linhas) {
    const m = LINHA_DA_ADAGA.exec(norm(l));
    if (m) return { pct: Number(m[1]), comDuasPct: Number(m[2] ?? 60) };
  }
  return null;
}
// ---------------------------------------------------------------- o status

/**
 * (revisão do A5, dono 20/10) O que a gema do lote ainda não faz por depender de outro lote.
 * (lote A5c, dono 20/10: a conversão do Físico das magias entrou nas partes do golpe — `GemasPoe.partesDaMagia` —; a Onda de Convicção sai de parcial: sozinha,
 * ela causa Físico, Fogo e Raio e põe a Exposição no elemento do maior dano)
 */
export const MOTIVOS_A5 = Object.freeze({});

/** A linha da gema é uma das que este lote faz com leitor próprio (sai de "efeito não simulado"). */
export function ehLinhaA5(slug, l) {
  const t = norm(l);
  if (/^Lightning_Conduit/.test(slug) && LINHA_DO_CONDUTOR.test(t)) return true;
  if (/^(Vaal_)?Cold_Snap/.test(slug) && LINHA_DO_SOLO_RESFRIADO.test(t)) return true;
  if (/^Frost_Bomb/.test(slug) && LINHA_EXPOSICAO_GELO.test(t)) return true;
  if (/^Wave_of_Conviction$/.test(slug) && LINHA_EXPOSICAO_MAIOR.test(t)) return true;
  if (slug === 'Dual_Strike_of_Ambidexterity' && LINHA_TEMPO_DA_SECUNDARIA.test(t)) return true;
  if (slug === 'Blade_Blast_of_Dagger_Detonation' && LINHA_DA_ADAGA.test(t)) return true;
  return false;
}
