// A árvore de habilidades (`{t:'arvore', action?}`) — o painel `arvore.mjs` do
// client. Funções puras sobre `estado`; quem responde é `sessao.mjs`.
//
// O CATÁLOGO de cada vocação (nós, posições na arte, vizinhos, custo de cada
// grau, o bônus por grau, as três vias e as três habilidades de medalhão) é o
// REAL: `send({t:'arvore'})` no site original em 2026-09-24, um personagem de
// cada vocação (`api-mapeada/servidor/arvore-<vocacao>.json`), sem o que é do
// personagem. Fica em `gamedata/arvore/<vocacao>.json`.
//
// As REGRAS foram medidas no mesmo servidor:
//  - pontos = ⌊(level − 8) / 2⌋ (level 8 → 0, 10 → 1, 89 → 40, 343 → 167,
//    407 → 199; e a árvore inteira, 1496 pontos, fecha no level 3000 — o
//    `levelCheio` que o original manda);
//  - refazer (tirar grau, zerar) = 100 mil gold por level; tirar habilidade =
//    20 mil por level; trocar para uma montagem que tira = 30 mil por level.
//    Tudo sai da carteira e depois do banco (texto do próprio client);
//  - uma vaga de habilidade a cada 700 levels, no máximo 3;
//  - acrescentar é de graça, e pode caçando; TIRAR só fora da caçada;
//  - os textos de erro abaixo são os do original, palavra por palavra, e na
//    mesma ordem de conferência (o `aplicar` confere o caminho ANTES da caçada;
//    o `tirarHabilidade` confere se está escolhida ANTES da caçada);
//  - ação desconhecida só devolve a vista.
// O que NÃO deu para medir sem gastar ouro/ponto de verdade (as mensagens de
// "faltam pontos" e "falta ouro", e se aplicar com sucesso manda aviso) segue o
// mesmo molde dos outros sistemas e está marcado onde aparece.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as R from './regras.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets_raw', 'gamedata', 'arvore');
const CATALOGOS = {};
for (const voc of ['knight', 'paladin', 'sorcerer', 'druid', 'monk']) {
  const arq = join(RAIZ, `${voc}.json`);
  if (existsSync(arq)) CATALOGOS[voc] = preparar(JSON.parse(readFileSync(arq, 'utf8')));
}

function preparar(cat) {
  cat.porId = new Map(cat.nos.map((no) => [no.id, no]));
  cat.especiais = new Map(cat.nos.filter((no) => no.especial).map((no) => [no.especial.id, no]));
  return cat;
}

export const LEVELS_POR_VAGA = 700;
export const VAGAS_MAXIMAS = 3;
const OURO_POR_LEVEL = { refazer: 100_000, tirarHabilidade: 20_000, usarMontagem: 30_000 };
const VAGAS_DE_MONTAGEM = 2;

export const catalogoDe = (estado) => CATALOGOS[estado.vocation] ?? null;
export const pontosDoLevel = (level) => Math.max(0, Math.floor(((level ?? 1) - 8) / 2));
export const vagasDoLevel = (level) => Math.min(VAGAS_MAXIMAS, Math.floor((level ?? 1) / LEVELS_POR_VAGA));
const preco = (estado, qual) => OURO_POR_LEVEL[qual] * (estado.level ?? 1);

export function garantir(estado) {
  estado.arvore ??= {};
  estado.arvore.graus ??= {};
  estado.arvore.escolhidas ??= [];
  estado.arvore.montagens ??= Array(VAGAS_DE_MONTAGEM).fill(null);
  return estado.arvore;
}

function custoDoPlano(cat, plano) {
  let total = 0;
  for (const [id, g] of Object.entries(plano)) {
    const no = cat.porId.get(id);
    for (let i = 0; i < g; i++) total += no?.custos[i] ?? 0;
  }
  return total;
}

/** Só graus inteiros de nós que existem; zero some. */
function limparPlano(cat, plano) {
  const limpo = {};
  for (const [id, g] of Object.entries(plano ?? {})) {
    const no = cat.porId.get(id);
    const n = Math.floor(Number(g));
    if (no && n > 0) limpo[id] = Math.min(n, no.graus);
  }
  return limpo;
}

/**
 * O primeiro nó do plano que não chega ao brasão (`base`) andando só por nós
 * comprados — é o que o client desfaz em `descer`, e o que o original recusa
 * com "<nome> não tem caminho até o começo".
 */
function semCaminho(cat, plano) {
  const vivos = new Set();
  if (plano[cat.base]) {
    const fila = [cat.base];
    vivos.add(cat.base);
    for (let f = 0; f < fila.length; f++) {
      for (const v of cat.porId.get(fila[f]).vizinhos) {
        if (plano[v] && !vivos.has(v)) {
          vivos.add(v);
          fila.push(v);
        }
      }
    }
  }
  return cat.nos.find((no) => plano[no.id] && !vivos.has(no.id)) ?? null;
}

const tiraGrau = (plano, atual) =>
  Object.keys({ ...plano, ...atual }).some((id) => (plano[id] ?? 0) < (atual[id] ?? 0));

/** Carteira primeiro, o resto do banco. Devolve o erro, ou null se pagou. */
function pagar(estado, valor) {
  const total = (estado.gold ?? 0) + (estado.bank ?? 0);
  // Texto não capturado (não dava para ficar sem ouro no original de propósito).
  if (total < valor) return `Faltam ${(valor - total).toLocaleString('pt-BR')} de ouro (bolso + banco).`;
  const doBolso = Math.min(estado.gold ?? 0, valor);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (valor - doBolso);
  return null;
}

const completo = (a, no) => (a.graus[no.id] ?? 0) >= no.graus;

// -------------------------------------------------------------------- a vista

/** O que a árvore aplicada dá — o mesmo `bonus` do original (skill inteira). */
export function bonus(estado) {
  const cat = catalogoDe(estado);
  if (!cat) return {};
  const a = garantir(estado);
  const soma = {};
  for (const no of cat.nos) {
    const g = a.graus[no.id] ?? 0;
    if (!g) continue;
    const chave = no.alvo ? `${no.tipo}:${no.alvo}` : no.tipo;
    soma[chave] = (soma[chave] ?? 0) + no.por * g;
  }
  for (const chave of Object.keys(soma)) if (chave.startsWith('skill:')) soma[chave] = Math.floor(soma[chave] + 1e-9);
  return soma;
}

/**
 * "Vida" e "Mana" da árvore (% da base do level), aplicadas como DIFERENÇA
 * sobre `maxHp`/`maxMana` — o mesmo jeito de `Afixos.sincronizarMaximos`:
 * `arvoreMax` guarda o quanto já foi posto, e aplicar, zerar e subir de level
 * chamam isto de novo para só a diferença entrar ou sair.
 */
export function recalcularVida(estado) {
  const b = bonus(estado);
  const base = R.statsBase(estado.vocation, estado.level ?? 1);
  const quer = { hp: Math.round(base.maxHp * (b.maxHp ?? 0)), mana: Math.round(base.maxMana * (b.maxMana ?? 0)) };
  const tem = estado.arvoreMax ?? { hp: 0, mana: 0 };
  if (quer.hp === tem.hp && quer.mana === tem.mana) return;
  estado.maxHp = (estado.maxHp ?? 0) + quer.hp - tem.hp;
  estado.maxMana = (estado.maxMana ?? 0) + quer.mana - tem.mana;
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
  estado.arvoreMax = quer;
}

/** As habilidades que valem agora: escolhidas E com o medalhão cheio. */
export function habilidadesAtivas(estado) {
  const cat = catalogoDe(estado);
  if (!cat) return new Set();
  const a = garantir(estado);
  return new Set(a.escolhidas.filter((id) => cat.especiais.has(id) && completo(a, cat.especiais.get(id))));
}

export function pontos(estado) {
  const cat = catalogoDe(estado);
  const total = pontosDoLevel(estado.level);
  const usados = cat ? custoDoPlano(cat, garantir(estado).graus) : 0;
  return { total, usados, livres: Math.max(0, total - usados) };
}

function montagemParaCliente(estado, cat, m) {
  if (!m) return null;
  const a = garantir(estado);
  const tira = tiraGrau(m.plano, a.graus) || a.escolhidas.some((id) => !m.habilidades.includes(id));
  return { nome: m.nome, pontos: custoDoPlano(cat, m.plano), habilidades: [...m.habilidades], plano: { ...m.plano }, tira, preco: tira ? preco(estado, 'usarMontagem') : 0 };
}

export function vista(estado) {
  const cat = catalogoDe(estado);
  if (!cat) return null;
  const a = garantir(estado);
  const grausDaVia = {};
  for (const no of cat.nos) if (no.via) grausDaVia[no.via] = (grausDaVia[no.via] ?? 0) + (a.graus[no.id] ?? 0);
  return {
    vocacao: cat.vocacao,
    pontos: pontos(estado),
    custoDaArvore: cat.custoDaArvore,
    levelCheio: cat.levelCheio,
    precoParaRefazer: preco(estado, 'refazer'),
    habilidades: {
      escolhidas: [...a.escolhidas],
      vagas: vagasDoLevel(estado.level),
      levelsPorVaga: LEVELS_POR_VAGA,
      precoParaTirar: preco(estado, 'tirarHabilidade'),
    },
    montagens: a.montagens.map((m) => montagemParaCliente(estado, cat, m)),
    precoParaUsarMontagem: preco(estado, 'usarMontagem'),
    base: cat.base,
    vinculos: cat.vinculos,
    vias: cat.vias.map((v) => ({ ...v, graus: grausDaVia[v.id] ?? 0 })),
    nos: cat.nos.map((no) => ({ ...no, gasto: a.graus[no.id] ?? 0 })),
    bonus: bonus(estado),
  };
}

// ------------------------------------------------------- no combate (cacadas/acoes)
//
// As 15 habilidades de medalhão, com os números do texto REAL de cada uma
// (`especial.texto` no catálogo). Só valem escolhidas E com o medalhão cheio
// (`habilidadesAtivas`). O tempo é o relógio da caçada (`hunt.clock`, ms), o
// mesmo das recargas — vale igual na caçada offline simulada.
//
// Uma não tem efeito aqui: `julgamento` (paladin, "o crítico ignora a
// resistência elemental do bicho") — este servidor ainda não dá resistência
// elemental aos bichos, então não há o que ignorar. Idem a "Penetração de
// armadura" dos nós: a armadura do bicho não corta o golpe do jogador aqui.

const tem = (estado, id) => habilidadesAtivas(estado).has(id);
const relogio = (estado) => estado.hunt?.clock ?? 0;
const sorte = (p) => Math.random() < p;

/** O multiplicador do dano que o jogador causa neste alvo (fora o "Dano" da ficha). */
export function fatorDasHabilidades(estado, alvo) {
  let f = 1;
  const agora = relogio(estado);
  // Sede de sangue: +5% por bicho morto nos últimos 6s, até 3 vezes.
  const sede = estado.hunt?.arvoreSede;
  if (sede && sede.ate > agora && tem(estado, 'sedeDeSangue')) f *= 1 + 0.05 * sede.n;
  // Vazio pleno: com a vida acima de 90%, 5% mais forte.
  if ((estado.hp ?? 0) > 0.9 * (estado.maxHp ?? 1) && tem(estado, 'vazioPleno')) f *= 1.05;
  // Inverno sem fim: o bicho marcado pelo gelo recebe 10% mais dano de todos.
  if ((alvo?.arvoreGeloAte ?? 0) > agora) f *= 1.1;
  return f;
}

/** Um dano extra num bicho, com o número na tela. */
function ferir(bicho, dano, eventos, cor, rotulo) {
  const v = Math.max(1, Math.round(dano));
  bicho.hp -= v;
  eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v, foe: true, alvo: bicho.name, color: cor, ...(rotulo ? { spell: rotulo } : {}) });
  return v;
}

const vivosPerto = (hunt, de, raio, fora) =>
  hunt.monstros.filter((b) => b.hp > 0 && !b.dummy && b !== fora && Math.max(Math.abs(b.x - de.x), Math.abs(b.y - de.y)) <= raio);

/**
 * Depois do golpe da ARMA (corpo a corpo ou distância). Devolve o dano extra
 * causado, para o leech.
 */
export function depoisDoGolpe(estado, hunt, alvo, golpe, categoria, eventos) {
  let extra = 0;
  // Mil mãos: 15% de acertar de novo, com metade.
  if (categoria === 'corpo' && tem(estado, 'milMaos') && sorte(0.15)) extra += ferir(alvo, golpe * 0.5, eventos, '#ff0000', 'Mil mãos');
  if (categoria === 'distancia') {
    // Flecha que atravessa: a chance da árvore de pegar também quem está atrás do alvo.
    const chance = bonus(estado).flechaAtravessa ?? 0;
    if (chance && sorte(chance)) {
      const dx = Math.sign(alvo.x - hunt.pos.x);
      const dy = Math.sign(alvo.y - hunt.pos.y);
      const atras = hunt.monstros.find((b) => b.hp > 0 && !b.dummy && b.x === alvo.x + dx && b.y === alvo.y + dy);
      if (atras) extra += ferir(atras, golpe, eventos, '#ff0000');
    }
    // Chuva de flechas: a cada 6 tiros, o próximo acerta também os bichos em volta do alvo, com 50%.
    if (tem(estado, 'chuvaDeFlechas')) {
      hunt.arvoreTiros = (hunt.arvoreTiros ?? 0) + 1;
      if (hunt.arvoreTiros > 6) {
        hunt.arvoreTiros = 0;
        for (const b of vivosPerto(hunt, alvo, 1, alvo)) extra += ferir(b, golpe * 0.5, eventos, '#ff0000', 'Chuva de flechas');
      }
    }
  }
  return extra;
}

/** Depois de uma magia/runa de ATAQUE: `danos` é [{bicho, dano}]. Devolve o dano extra. */
export function depoisDaMagia(estado, hunt, elemento, danos, eventos, cor) {
  let extra = 0;
  const agora = relogio(estado);
  for (const { bicho, dano } of danos) {
    if (!(dano > 0)) continue;
    // Cataclismo: magia de fogo, 25% de acertar de novo com metade.
    if (elemento === 'fire' && tem(estado, 'cataclismo') && sorte(0.25) && bicho.hp > 0) extra += ferir(bicho, dano * 0.5, eventos, cor, 'Cataclismo');
    // Arco voltaico: magia de energia, 25% de pular para outro bicho próximo com metade.
    if (elemento === 'energy' && tem(estado, 'arcoVoltaico') && sorte(0.25)) {
      const outro = vivosPerto(hunt, bicho, 3, bicho)[0];
      if (outro) extra += ferir(outro, dano * 0.5, eventos, cor, 'Arco voltaico');
    }
    // Inverno sem fim: gelo deixa o bicho recebendo 10% mais dano, por 4s.
    if (elemento === 'ice' && tem(estado, 'invernoSemFim')) bicho.arvoreGeloAte = agora + 4000;
    // Raiz venenosa: terra, 25% de envenenar com 30% do dano, ao longo de 5s.
    if (elemento === 'earth' && tem(estado, 'raizVenenosa') && sorte(0.25)) {
      bicho.arvoreVeneno = { porSegundo: (dano * 0.3) / 5, restantes: 5, proximo: agora + 1000, cor };
    }
  }
  return extra;
}

/** O veneno da Raiz venenosa, um pulso por segundo. Chamado a cada tique da caçada. */
export function tique(estado, hunt, eventos) {
  const agora = relogio(estado);
  for (const b of hunt.monstros) {
    const v = b.arvoreVeneno;
    if (!v || b.hp <= 0) continue;
    while (v.restantes > 0 && agora >= v.proximo) {
      ferir(b, v.porSegundo, eventos, v.cor, 'Raiz venenosa');
      v.restantes -= 1;
      v.proximo += 1000;
    }
    if (v.restantes <= 0) delete b.arvoreVeneno;
  }
}

/** Matou um bicho. */
export function aoMatar(estado, eventos, pos, quem) {
  const hunt = estado.hunt;
  if (!hunt) return;
  const agora = relogio(estado);
  if (tem(estado, 'sedeDeSangue')) {
    const s = hunt.arvoreSede && hunt.arvoreSede.ate > agora ? hunt.arvoreSede.n : 0;
    hunt.arvoreSede = { n: Math.min(3, s + 1), ate: agora + 6000 };
  }
  // Fonte eterna: cada bicho morto devolve 1% da mana máxima.
  if (tem(estado, 'fonteEterna')) devolverMana(estado, 0.01, eventos, pos, quem);
}

function devolverMana(estado, fracao, eventos, pos, quem) {
  const v = Math.min(Math.round((estado.maxMana ?? 0) * fracao), Math.max(0, (estado.maxMana ?? 0) - (estado.mana ?? 0)));
  if (v <= 0) return;
  estado.mana += v;
  eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v, color: '#4fc3ff' });
}

/** Bloqueou ou desviou de um golpe. */
export function aoBloquear(estado, eventos, pos, quem) {
  // Vento que volta: devolve 2% da mana máxima.
  if (tem(estado, 'ventoQueVolta')) devolverMana(estado, 0.02, eventos, pos, quem);
}

/**
 * O dano que um bicho vai tirar da vida, depois da armadura: "Absorção" e
 * "Dano recebido" da árvore, a Última muralha, o escudo da Fonte viva e o
 * Não cai nunca. Devolve o que sobra para a vida.
 */
export function danoRecebido(estado, final, eventos, pos, quem) {
  if (!(final > 0)) return final;
  const b = bonus(estado);
  let v = final * (1 - Math.min(0.9, b.absorb ?? 0)) * (1 + (b.danoRecebido ?? 0));
  if ((estado.hp ?? 0) < 0.3 * (estado.maxHp ?? 1) && tem(estado, 'ultimaMuralha')) v *= 0.85;
  v = Math.round(v);
  const hunt = estado.hunt;
  const agora = relogio(estado);
  // Fonte viva: o escudo que a cura deixou segura primeiro.
  const escudo = hunt?.arvoreEscudo;
  if (escudo && escudo.ate > agora && escudo.v > 0 && v > 0) {
    const segura = Math.min(escudo.v, v);
    escudo.v -= segura;
    v -= segura;
    eventos.push({ t: 'dmg', uid: 'player', quem, x: pos.x, y: pos.y, v: segura, foe: false, color: '#4fc3ff' });
  }
  // Não cai nunca: o golpe que mataria deixa com 10% da vida, uma vez a cada 120s.
  if (v >= (estado.hp ?? 0) && hunt && tem(estado, 'naoCaiNunca') && agora >= (hunt.arvoreNaoCaiAte ?? 0)) {
    hunt.arvoreNaoCaiAte = agora + 120_000;
    // "deixa você vivo, com 10% da vida" — mesmo quem já estava abaixo disso.
    const resta = Math.max(1, Math.round((estado.maxHp ?? 0) * 0.1));
    if ((estado.hp ?? 0) < resta) estado.hp = resta;
    v = estado.hp - resta;
  }
  return v;
}

/** Uma cura de MAGIA (poção não): Graça e Fonte viva. Devolve a cura final. */
export function aoCurarComMagia(estado, cura) {
  let v = cura;
  // Graça: com menos de 50% de vida, a cura sai 10% maior.
  if ((estado.hp ?? 0) < 0.5 * (estado.maxHp ?? 1) && tem(estado, 'graca')) v = Math.round(v * 1.1);
  // Fonte viva: escudo de mana de 15% do que curou, por 3s.
  if (estado.hunt && tem(estado, 'fonteViva')) estado.hunt.arvoreEscudo = { v: Math.round(v * 0.15), ate: relogio(estado) + 3000 };
  return v;
}

// ------------------------------------------------------------------- as ações

const erro = (texto) => ({ ok: false, erro: texto });
const feito = () => ({ ok: true });

/** Troca a árvore aplicada por `plano` — as regras do `aplicar` e do `usarMontagem`. */
function trocarPara(estado, cat, plano, { emCacada, textoDaCacada }) {
  const a = garantir(estado);
  const sem = semCaminho(cat, plano);
  if (sem) return erro(`${sem.nome} não tem caminho até o começo`);
  const custo = custoDoPlano(cat, plano);
  const total = pontosDoLevel(estado.level);
  // Texto não capturado: o client nunca deixa montar um plano acima dos pontos.
  if (custo > total) return erro(`faltam pontos: o plano custa ${custo} e você tem ${total}`);
  const tira = tiraGrau(plano, a.graus);
  if (tira && emCacada) return erro(textoDaCacada);
  return { ok: true, tira };
}

export function aplicar(estado, { plano }, emCacada) {
  const cat = catalogoDe(estado);
  const a = garantir(estado);
  const novo = limparPlano(cat, plano);
  const r = trocarPara(estado, cat, novo, { emCacada, textoDaCacada: 'para tirar graus, só fora da caçada' });
  if (!r.ok) return r;
  if (r.tira) {
    const falta = pagar(estado, preco(estado, 'refazer'));
    if (falta) return erro(falta);
  }
  a.graus = novo;
  return feito();
}

export function zerar(estado, emCacada) {
  const a = garantir(estado);
  if (!Object.keys(a.graus).length) return feito();
  if (emCacada) return erro('só fora da caçada');
  const falta = pagar(estado, preco(estado, 'refazer'));
  if (falta) return erro(falta);
  a.graus = {};
  return feito();
}

export function escolherHabilidade(estado, { id }) {
  const cat = catalogoDe(estado);
  const a = garantir(estado);
  const no = cat.especiais.get(id);
  if (!no) return erro('essa habilidade não é da sua árvore');
  if (a.escolhidas.includes(id)) return feito();
  if (!completo(a, no)) return erro(`complete o medalhão ${no.nome} antes de escolher ${no.especial.nome}`);
  const vagas = vagasDoLevel(estado.level);
  if (a.escolhidas.length >= vagas) {
    return erro(vagas < VAGAS_MAXIMAS ? `sem vaga livre — a próxima abre no level ${(vagas + 1) * LEVELS_POR_VAGA}` : 'sem vaga livre');
  }
  a.escolhidas.push(id);
  return feito();
}

export function tirarHabilidade(estado, { id }, emCacada) {
  const a = garantir(estado);
  if (!a.escolhidas.includes(id)) return erro('essa habilidade não está escolhida');
  if (emCacada) return erro('só fora da caçada');
  const falta = pagar(estado, preco(estado, 'tirarHabilidade'));
  if (falta) return erro(falta);
  a.escolhidas = a.escolhidas.filter((x) => x !== id);
  return feito();
}

const vagaValida = (vaga) => Number.isInteger(vaga) && vaga >= 0 && vaga < VAGAS_DE_MONTAGEM;

export function guardarMontagem(estado, { vaga, nome, plano }) {
  const cat = catalogoDe(estado);
  const a = garantir(estado);
  if (!vagaValida(vaga)) return erro('essa vaga de montagem não existe');
  // `plano` nulo guarda a árvore aplicada (medido: vira a árvore inteira, 151 pontos).
  const guardado = plano ? limparPlano(cat, plano) : { ...a.graus };
  const limpo = String(nome ?? '').trim().slice(0, 24);
  a.montagens[vaga] = { nome: limpo || `Montagem ${vaga + 1}`, plano: guardado, habilidades: [...a.escolhidas] };
  return feito();
}

export function usarMontagem(estado, { vaga }, emCacada) {
  const cat = catalogoDe(estado);
  const a = garantir(estado);
  const m = vagaValida(vaga) ? a.montagens[vaga] : null;
  if (!m) return erro('essa vaga de montagem está vazia');
  const r = trocarPara(estado, cat, m.plano, { emCacada, textoDaCacada: 'para trocar de montagem, só fora da caçada' });
  if (!r.ok) return r;
  const tira = r.tira || a.escolhidas.some((id) => !m.habilidades.includes(id));
  if (tira) {
    if (emCacada) return erro('para trocar de montagem, só fora da caçada');
    const falta = pagar(estado, preco(estado, 'usarMontagem'));
    if (falta) return erro(falta);
  }
  a.graus = { ...m.plano };
  a.escolhidas = m.habilidades.filter((id) => cat.especiais.has(id)).slice(0, vagasDoLevel(estado.level));
  return feito();
}

export function apagarMontagem(estado, { vaga }) {
  const a = garantir(estado);
  if (!vagaValida(vaga) || !a.montagens[vaga]) return erro('essa vaga já está vazia');
  a.montagens[vaga] = null;
  return feito();
}

/** `{t:'arvore', action?}` — sem ação (ou ação desconhecida), só a vista. */
export function comando(estado, m, emCacada) {
  if (!catalogoDe(estado)) return erro('sua vocação ainda não tem árvore');
  switch (m.action) {
    case 'aplicar': return aplicar(estado, m, emCacada);
    case 'zerar': return zerar(estado, emCacada);
    case 'escolherHabilidade': return escolherHabilidade(estado, m);
    case 'tirarHabilidade': return tirarHabilidade(estado, m, emCacada);
    case 'guardarMontagem': return guardarMontagem(estado, m);
    case 'usarMontagem': return usarMontagem(estado, m, emCacada);
    case 'apagarMontagem': return apagarMontagem(estado, m);
    default: return feito();
  }
}
