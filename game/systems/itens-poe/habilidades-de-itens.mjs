// AS HABILIDADES DE ITEM FEITAS À MÃO (07/11, lote 13b das inertes — dono: "Importar e fazer à mão"). As habilidades que só os únicos concedem entram como gemas
// ocultas (`habilidades-de-itens.json`); as que o compilador de gemas não sabe usar ganham o comportamento aqui, pelos números da página do poedb de cada uma:
//
//   USO (a gema usada — da barra, ou disparada pela peça: "Ativa X quando…"): `usar` faz o efeito e devolve os eventos;
//   CONTÍNUO ("Ativa X quando Equipado", "Esta Magia é Ativada quando Ganha"): `tique`, enquanto a peça concede a habilidade (`concede:<nome>` no `afPoe`).
//
// O que o poedb não publica fica na nota (`nota`), e a linha do único que concede a habilidade mostra.
import { criarSoloSagrado, ganharBuff } from './condicoes-poe.mjs';
import * as Dot from '../combate/dot.mjs';
import { tolher, aplicar as aplicarEstados } from '../skills/estados.mjs';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Os monstros vivos a até `casas` de você, no seu andar. */
const perto = (hunt, casas) => (hunt?.pos ? (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0) && dist(m, hunt.pos) <= casas) : []);
/** 1 casa = 2 m (ao menos 1). */
const casas = (metros) => Math.max(1, Math.round(metros / 2));
/** Um golpe de `tipo` em cada monstro de `alvos` (o dano sorteado entre min e max, pela resistência do monstro — `resistir`, de quem chama). */
function golpear(hunt, alvos, { min, max, tipo }, eventos, resistir, cor) {
  for (const m of alvos) {
    const bruto = min + Math.random() * Math.max(0, max - min);
    const dano = Math.max(1, Math.round(resistir ? resistir(m, tipo, bruto) : bruto));
    m.hp -= dano;
    eventos.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, alvo: m.name, color: cor });
  }
}
/** O dano degenerativo (por segundo) nos monstros perto, renovado a cada tique (a chave: um por habilidade). */
function degenEmVolta(hunt, { porS, tipoDot, raio, chave }, agora) {
  for (const m of perto(hunt, raio)) Dot.aplicar(m, { tipo: tipoDot, total: porS, duracaoMs: 1000, chave, origem: { fonte: 'poe' } }, agora);
}

/**
 * Cada habilidade: `usar(ctx)` (o uso) e/ou `continua` (o efeito enquanto concedida); `recargaMs` (a da página, no uso); `nota` (o que é aproximado).
 * `ctx`: `{ estado, hunt, nivel, alvo, eventos, agora, resistir }`.
 */
export const FEITAS = Object.freeze({
  // Consagrar (os Presentes do Céu: "Ativa Consagrar quando você acertar um Crítico"): Solo Sagrado por 5 s onde você está
  Consecrate: { nome: 'Consagrar', recargaMs: 5000, usar: ({ hunt, agora }) => criarSoloSagrado(hunt, 5, agora) },
  // Criar Altar Menor (a Gaivota, ao Matar): um altar Menor ao acaso por 10 s
  Create_Lesser_Shrine: { nome: 'Criar Altar Menor', recargaMs: 10000, usar: ({ hunt, agora }) => ganharBuff(hunt, ['altarMenor', 'altarBrutalMenor', 'altarMassivoMenor'][Math.floor(Math.random() * 3)], 10, agora) },
  // Nevoeiro de Guerra (o Estratagema de Kongming, quando sua Armadilha é ativada): Cega os monstros perto por 3 s (a nuvem — o raio não é publicado: 2 casas)
  Fog_of_War: { nome: 'Nevoeiro de Guerra', recargaMs: 1000, nota: 'a nuvem Cega os monstros a até 2 casas por 3 s (o raio não é publicado)', usar: ({ hunt, agora }) => { for (const m of perto(hunt, 2)) (m.estados ??= {}).cego = { ate: agora + 3000 }; } },
  // Olhar Vazio (a Unificação de Eber, ao usar uma Habilidade): os monstros perto ficam com -20% de Resistência a Caos por 10 s
  Void_Gaze: { nome: 'Olhar Vazio', recargaMs: 2000, nota: 'os monstros a até 3 casas (o raio não é publicado)', usar: ({ hunt, agora }) => { for (const m of perto(hunt, 3)) (m.estados ??= {}).olharVazio = { ate: agora + 10000, pct: 20 }; } },
  // Olhar Fulgente (o Esplendor de Solerai, quando você é Acertado): uma nova de Fogo de 3 m — 15 a 26 de Fogo por nível — que Cega
  Blazing_Glare: { nome: 'Olhar Fulgente', recargaMs: 1000, usar: ({ hunt, nivel, eventos, agora, resistir }) => {
    const alvos = perto(hunt, casas(3));
    golpear(hunt, alvos, { min: 15 * nivel, max: 26 * nivel, tipo: 'fire' }, eventos, resistir, '#ff9000');
    for (const m of alvos) (m.estados ??= {}).cego = { ate: agora + 4000 };
  } },
  // Retribuição Cáustica (a Escuridão de Saresh, quando você é Acertado): nova de Caos de 3 m — 11 a 19 por nível —, Envenena e Desacelera (o Tolhimento: 30%, 4 s)
  Caustic_Retribution: { nome: 'Retribuição Cáustica', recargaMs: 1000, nota: 'o Veneno: 30% do golpe por segundo, 2 s (o do PoE); a Desaceleração: Tolhe 30% por 4 s', usar: ({ hunt, nivel, eventos, agora, resistir }) => {
    const alvos = perto(hunt, casas(3));
    golpear(hunt, alvos, { min: 11 * nivel, max: 19 * nivel, tipo: 'chaos' }, eventos, resistir, '#9c27b0');
    for (const m of alvos) { Dot.aplicar(m, { tipo: 'venenoPoe', total: 15 * nivel * 0.6, origem: { fonte: 'poe' } }, agora); tolher(m, 30, 4000, agora); }
  } },
  // Vislumbre da Eternidade (a Mortalha da Eternidade, quando você é Acertado): os monstros perto têm a Velocidade de Ação reduzida em 40% por 10 s
  Glimpse_of_Eternity: { nome: 'Vislumbre da Eternidade', recargaMs: 5000, nota: 'os monstros a até 3 casas (o raio não é publicado)', usar: ({ hunt, agora }) => { for (const m of perto(hunt, 3)) aplicarEstados(m, { lentidaoPct: 40, lentidaoDuracaoPct: (10000 / 3000 - 1) * 100 }, 1, agora, Math.random, !!hunt.isBoss); } },
  // Banquete de Carne (o Diadema Devorador): consome até 10 cadáveres a até 4 casas; +400 de Vida, +200 de Mana e +400 de Escudo de Energia por cadáver
  Feast_of_Flesh: { nome: 'Banquete de Carne', usar: ({ estado, hunt }) => {
    if (!hunt.pos) return;
    const lista = (hunt.cadaveres ?? []).filter((c) => (c.z == null || c.z === (hunt.z ?? 0)) && dist(c, hunt.pos) <= 4).slice(0, 10);
    if (!lista.length) return;
    hunt.cadaveres = (hunt.cadaveres ?? []).filter((c) => !lista.includes(c));
    const n = lista.length;
    estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + 400 * n);
    estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + 200 * n);
    estado.es = Math.min(Number(estado.maxEsPoe) || 0, (estado.es ?? 0) + 400 * n);
    (hunt.poeRecente ??= {}).consumiuCadaver = hunt.clock ?? 0;
  } },
  // Faminto (a Ambição de Veruso): +15% de Dano e −15% de Dano sofrido — o PoE dá contra os da mesma categoria de monstro (no jogo, a área é de uma categoria só); até
  // sair da caçada
  Ravenous: { nome: 'Faminto', recargaMs: 5000, nota: 'vale contra todos os monstros da caçada (o PoE: os da categoria do primeiro alvo)', usar: ({ hunt, agora }) => ganharBuff(hunt, 'faminto', 24 * 3600, agora) },
  // Forma Sombria (a Mortalha do Obscuro): 3 s de Imunidade a Dano Físico (e Furtividade, que o jogo não tem)
  Shade_Form: { nome: 'Forma Sombria', recargaMs: 40000, nota: 'a Furtividade não existe no jogo', usar: ({ hunt, agora }) => ganharBuff(hunt, 'formaSombria', 3, agora) },
  // Perturbar (o Disfarce do Doppelgänger): Insano por 8 s (o PoE não publica: a duração da Insanidade das gemas de Loucura)
  Unhinge: { nome: 'Perturbar', recargaMs: 5000, nota: 'Insano por 8 s (o PoE não publica a duração)', usar: ({ hunt, agora }) => ganharBuff(hunt, 'insano', 8, agora) },
  // Despedaçar Escudo (o Fragmento Fragmentado, ao Bloquear): nova Física — 326 a 489 por 1% de Qualidade do Escudo (nível 20) — e o buff de 4 s: 15 a 23 de Dano Físico
  // Mágico Adicional por 1% de Qualidade
  Shield_Shatter: { nome: 'Despedaçar Escudo', usar: ({ estado, hunt, eventos, agora, resistir }) => {
    const q = Math.max(0, Math.min(30, Number(estado.equipment?.shield?.poe?.qualidade) || 0));
    if (!(q > 0)) return;
    golpear(hunt, perto(hunt, casas(3)), { min: 326 * q, max: 489 * q, tipo: 'physical' }, eventos, resistir, '#c0c0c0');
    (hunt.poeTemporarios ??= {}).despedacarMin = { stat: 'spell_added_phys_dmg_min', valor: 15 * q, ate: agora + 4000 };
    hunt.poeTemporarios.despedacarMax = { stat: 'spell_added_phys_dmg_max', valor: 23 * q, ate: agora + 4000 };
    hunt.poeFichaMudou = true;
  } },
  // Chamas Próximas (a Abordagem da Aniquilação): Tocado pelas Chamas por 4 s (o PoE não publica) — o que vale enquanto Tocado são as linhas do único
  Approaching_Flames: { nome: 'Chamas Próximas', recargaMs: 5000, nota: 'Tocado pelas Chamas por 4 s (o PoE não publica a duração)', usar: ({ hunt, agora }) => ganharBuff(hunt, 'tocadoPelaChama', 4, agora) },
  // Concentrar (o Hiperbóreo concede): Concentrado por 4 s; a recarga (8 s) não corre durante o efeito — 12 s ao todo, ÷ a "Velocidade da Recuperação da Recarga da
  // Concentração"; o Hiperbóreo: "Resfria Inimigos próximos quando você se Concentra" (os monstros a até 3 casas, 4 s — o PoE não publica o raio nem a duração)
  Focus: { nome: 'Concentrar', recargaMs: (af) => 12000 / Math.max(0.1, 1 + (Number(af?.concentracao_recarga_inc) || 0) / 100), nota: 'o Resfriamento do Hiperbóreo pega os monstros a até 3 casas por 4 s (o PoE não publica)', usar: ({ hunt, agora, af }) => {
    ganharBuff(hunt, 'concentrado', 4, agora);
    const pct = Number(af?.concentrar_resfria_pct) || 0;
    if (pct > 0) for (const m of perto(hunt, 3)) aplicarEstados(m, { lentidaoPct: pct, lentidaoDuracaoPct: (4000 / 3000 - 1) * 100 }, 1, agora, Math.random, !!hunt.isBoss);
  } },
  // Pacificar (o Supressor de Mentes): a maldição sai pelo caminho de sempre das maldições; o amaldiçoado, com 60% da duração passados, não causa dano (`condicoes-poe.doBicho`)
  Pacify: { nome: 'Pacificar', nota: 'a maldição (10 s) pelo caminho de sempre; com 60% dela passados, o amaldiçoado não causa dano' },
  // Gula dos Elementos (o Sangue da Corrupção — Vaal: no jogo, a recarga no lugar das Almas): 5 s imune a Maldições e sem Dano Elemental sofrido
  Gluttony_of_Elements: { nome: 'Gula dos Elementos', recargaMs: 14000, nota: 'o Dano Elemental sofrido é anulado (o PoE: ele cura — o jogo não cura pelo dano); só você (sem os aliados); a recarga de 14 s é a Anulação do Ganho de Almas (as Vaal do jogo usam recarga)', usar: ({ hunt, agora }) => ganharBuff(hunt, 'gulaDosElementos', 5, agora) },
  // AS CONTÍNUAS ("quando Equipado"/"quando Ganha"): o dano por segundo nos monstros perto
  Death_Aura: { nome: 'Aura da Morte', continua: { porS: 1600, tipoDot: 'degenCaos', raio: casas(3) } },
  Cinders: { nome: 'Escórias', nota: 'as Escórias queimam os monstros a até 2 casas (333 de Fogo por segundo — o PoE: as brasas em volta de você atacam os de perto)', continua: { porS: 333.3, tipoDot: 'degenFogo', raio: 2 } },
  Tears_of_Rot: { nome: 'Lágrimas de Podridão', nota: 'as Lágrimas ferem os monstros a até 2 casas (627 de Físico por segundo — o PoE: as gotas caem em volta de você)', continua: { porS: 627, tipoDot: 'degenFisico', raio: 2 } },
});
export const feita = (slug) => FEITAS[slug] ?? null;

/** O USO da habilidade feita à mão (o caminho do uso — `acoes`): a recarga dela e o efeito. Devolve `{ ok, eventos }`. */
export function usar(estado, hunt, slug, { id, nivel = 20, alvo = null, eventos = [], agora = hunt?.clock ?? 0, resistir = null, af = {} } = {}) {
  const h = FEITAS[slug];
  if (!h?.usar || !hunt) return { ok: false, eventos };
  const cds = (hunt.cooldowns ??= {});
  const recarga = typeof h.recargaMs === 'function' ? h.recargaMs(af) : h.recargaMs;
  if (recarga && cds[id]?.ate > agora) return { ok: false, erro: 'Em recarga.', motivo: 'RECARGA', eventos };
  if (recarga) cds[id] = { ate: agora + recarga, total: recarga };
  h.usar({ estado, hunt, nivel, alvo, eventos, agora, resistir, af });
  return { ok: true, eventos };
}

/** O tique das CONTÍNUAS: enquanto a peça concede a habilidade (`concede:<o nome>` no `afPoe`), o dano por segundo em volta. `slugDoNome`: o do jogo. */
export function tique(hunt, af, slugDoNome, agora = hunt?.clock ?? 0) {
  if (!hunt?.pos) return;
  for (const [slug, h] of Object.entries(FEITAS)) {
    if (!h.continua || !(Number(af?.[`concede:${slugDoNome(h.nome)}`]) > 0)) continue;
    degenEmVolta(hunt, { ...h.continua, chave: `habilidade:${slug}` }, agora);
    // (a Chama da Esperança: "Causa Exposição ao Fogo ao atingir inimigos com 5 Escórias" — os monstros nas Escórias ficam com ela)
    if (slug === 'Cinders' && Number(af?.escorias_exposicao_pct) > 0) for (const m of perto(hunt, h.continua.raio)) (m.estados ??= {}).escoriasExposicao = { ate: agora + 1000, pct: Number(af.escorias_exposicao_pct) };
  }
}
