// Gera o PACOTE DE CONTEÚDO dos 4 Atos: descrição e ambiente de cada fase, e encontros (baús, altares, minibosses, boss
// secreto) com os bosses cadastrados — tudo gravado pelo MESMO caminho do editor (`admin/conteudo.mjs`), então cada peça
// passa pela validação do jogo, pelo ponto andável/alcançável no mapa e pelo teto de economia (soma dos encontros ≤ 25%
// do valor de limpar a fase; o aviso é a partir de 30%).
//
//   node tools/gerar-conteudo-dos-atos.mjs          → grava gamedata/bosses-unicos.json, gamedata/encontros/*.json
//                                                     e gamedata/campanha-conteudo.json
//   node tools/gerar-conteudo-dos-atos.mjs --seco   → só imprime o resumo (não grava)
//
// É determinístico (sem sorteio): rodar de novo dá o mesmo conteúdo. Depois de gerado, o dono ajusta tudo em
// `/editor/conteudo` — este script é o ponto de partida, não uma trava.
import * as Campanha from '../game/systems/campanha.mjs';
import * as Conteudo from '../game/admin/conteudo.mjs';
import * as Eco from '../game/systems/encontros/economia.mjs';
import { BESTIARY } from '../game/systems/hunt/monstros.mjs';
import { spawnsDaHunt, gradeDaHunt, huntOuMapaCustom } from '../game/systems/hunt/terreno.mjs';
import { andarDaGrade } from '../game/systems/hunt/andares.mjs';
import { casasAlcancaveis } from '../game/systems/hunt/instancia.mjs';
import { ataquesParaFicha } from '../game/systems/poderes.mjs';
import { precoNpc } from '../game/systems/hunt/rentabilidade.mjs';
import { CONFIG } from '../game/systems/encontros/config.mjs';
import { FICHAS } from '../game/systems/afixos.mjs';
import * as Catalogo from '../game/systems/bosses-unicos/catalogo.mjs';

const SECO = process.argv.includes('--seco');
const ALVO_DA_FASE = 0.2; // a soma dos encontros da fase, em fração do valor de limpá-la

/** [ambiente, descrição] de cada fase — texto original do Draevor. */
const TEMAS = {
  'troll-cave': ['caverna', 'Uma caverna úmida onde os trolls guardam, sem saber, a entrada de uma cripta esquecida sob a colina.'],
  'amazon-camp': ['acampamento', 'Um acampamento de guerreiras entre as árvores: lanças, feitiços de bruxa e leões domados vigiam cada trilha.'],
  'dark-pyramid': ['pirâmide', 'Corredores de pedra escura onde minotauros de todas as castas defendem câmaras que ninguém lembra de ter construído.'],
  'port-hope-corym-dungeons': ['masmorra', 'Túneis sob o porto, roídos por corym engenhosos que escondem o que roubam atrás de portas frágeis.'],
  'mistrock-cyclops': ['montanha', 'Forjas de ciclopes encravadas na rocha: o martelar não para, e quem entra sem ser convidado vira sucata.'],
  'hive-surface': ['colmeia', 'A superfície de uma colmeia viva, zumbindo de insetos que defendem a rainha sem nunca terem visto o sol.'],
  'mother-of-scarabs-lair': ['tumba', 'Uma tumba de areia e ossos onde a Mãe dos Escaravelhos cria sua ninhada à sombra de bonebeasts famintos.'],
  'cults-carlin': ['catacumba', 'Sob as ruas de Carlin, um culto de capas negras sussurra rituais proibidos para quem ainda acredita na superfície.'],
  'drefia-wyrm-caves': ['caverna', 'Cavernas frias de Drefia, onde wyrms antigos descansam sobre ossos e ceifadores rondam os túneis laterais.'],
  'edron-were-mobs': ['floresta', 'Uma floresta que muda de dono à noite: lobisomens de várias formas caçam em bando ao lado de orcs desertores.'],
  'old-fortress-hero-cave': ['fortaleza', 'Os porões da velha fortaleza, onde cavaleiros renegados e grão-mestres vis disputam um tesouro que já perdeu o dono.'],
  'putrid-mummies': ['tumba', 'Uma câmara fúnebre apodrecida: múmias putrefatas, aranhas gigantes e ossos que não aceitam o descanso.'],
  'black-serpent-dungeon': ['masmorra', 'Uma masmorra de pedra negra onde os Escolhidos Lagarto montam guarda ao redor de um altar de serpentes.'],
  'ghastly-dragon-lair': ['covil', 'O covil de um dragão espectral: o ar pesa, o chão é de ossos e o calor vem de nenhum fogo visível.'],
  'feyrist-nightmare': ['pesadelo', 'Um canto da Feyrist que sonha mal: silenciadores e criaturas devoradoras vagam por trilhas que se desfazem ao olhar.'],
  'medusa-cave': ['caverna', 'A caverna da Medusa, fria e úmida, tomada por serpentes de olhar vazio e estátuas que já foram viajantes.'],
  'oramond-hydras': ['pântano', 'Pântanos de Oramond onde as hidras brotam da lama: cada cabeça cortada deixa o ar mais denso e o chão mais fundo.'],
  'werehyaenna-north': ['savana', 'Ruínas ao norte onde hienas-lobisomens e suas xamãs uivam à lua, marcando território com ossos pintados.'],
  'haunted-temple': ['templo', 'Um templo assombrado, com olhares espectrais pelos corredores e thanatursus tecendo véus de morte entre as colunas.'],
  'glooth-bandits-east': ['mina', 'O leste da mina de glooth, tomado por bandidos mecanizados que aprenderam a roubar com mais ferro que vergonha.'],
  'zaoan-draken-walls': ['muralha', 'Muralhas de Zao onde dракen warmasters e tecelões de feitiços protegem a passagem com disciplina de legião.'],
  'deeper-banuta-8': ['ruínas', 'As profundezas de Banuta, oito andares abaixo: medusas, guardiões eternos e comedores de almas disputam o silêncio.'],
  'golems-catacombs': ['catacumba', 'Catacumbas de golens e demônios menores, onde torturadores sombrios cuidam do que o fogo da terra deixou para trás.'],
  'medusa-tower': ['torre', 'Uma torre de barro e veneno, guardada por guardiões de argila e aranhas que tecem em tons de verde-doente.'],
  'wild-life-raid-oramond': ['selva', 'Uma incursão selvagem em Oramond: vermes de perfuração, wyrms anciões e anêmonas de glooth num mesmo vale.'],
  'winter-dream-court': ['corte gélida', 'A corte do sonho de inverno, onde vanguardas enlouquecidas guardam um trono de gelo que ninguém lembra de ter visto vazio.'],
  'burster-spectres': ['abismo', 'Um abismo onde espectros estouram em luz fria ao morrer, deixando para trás ecos que ainda sabem lutar.'],
  'roshamuul-cave': ['caverna', 'Cavernas de Roshamuul: mandíbulas, silêncios e horrores que reviram a terra à procura de quem ainda sonha.'],
  'werelions-1': ['savana', 'Um território de leões-lobisomem, onde o sol queima a pele e a noite devolve a forma errada.'],
  'abandoned-sewers': ['esgoto', 'Esgotos abandonados da cidade, cheios de demônios foragidos, gárgulas de metal e glooth que ainda se mexe.'],
  'asura-palace': ['palácio', 'Salões de espelho e fogo onde asuras da meia-noite e do amanhecer dançam uma guerra que nunca termina.'],
  deathlings: ['necrópole', 'Uma necrópole de deathlings: batedores e cantores de feitiço que ainda treinam para um cerco que já aconteceu.'],
  falcons: ['fortaleza', 'A fortaleza dos Falcões, onde cavaleiros e paladinos juraram defender uma coroa que se desfez em cinzas.'],
  netherworld: ['plano sombrio', 'O Mundo Inferior: almas frágeis e almas más vagam entre névoas, sem saber qual das duas é a própria.'],
  'poi-dt-seal': ['vale de fogo', 'Diante do selo dos torturadores, banshees e demônios guardam o fim do caminho, e todos sabem o que vem depois.'],
  'spike-8': ['gruta', 'Oito andares abaixo, almas arremessadoras e silenciadoras se escondem entre estalagmites e magma vulcânico.'],
  'summer-court': ['corte solar', 'A corte do verão: sirenes insanas e vanguardas inebriadas por um calor que não deveria existir tão fundo.'],
  'prison-2': ['prisão', 'O segundo nível da prisão, onde demônios banidos, ferreiros da peste e cães do inferno guardam celas sem prisioneiros.'],
  'sphinx-issavi': ['deserto', 'Sob a esfinge de Issavi, guardiães de cripta, gladiadores em chamas e sacerdotisas do sol selvagem.'],
  'cobra-bastion-1': ['bastião', 'O Bastião da Cobra, primeiro nível: assassinas, vizires e batedoras que atacam antes de se deixarem ver.'],
  'dt-seal-inq': ['santuário', 'Um selo sombrio da Inquisição, onde torturadores, espectros traídos e mãos do destino amaldiçoado montam guarda.'],
  'feru-way': ['caminho infernal', 'O caminho de Feru, onde sanguessugas, garras e demônios rasgam o ar em disputas por nada.'],
  'flimsy-lost-souls-venore': ['pântano', 'Pântanos de Venore, onde almas perdidas e ceifadores seguem um cortejo que ninguém ousa interromper.'],
  'warzone-2': ['campo de guerra', 'A segunda zona de guerra: lava, golens de magma e berserkers perdidos entre trincheiras que ainda queimam.'],
  'infernatil-seal': ['inferno', 'O selo de Infernatil, onde garras, sanguessugas e fúrias protegem um portal que ninguém deveria cruzar.'],
  'jaded-roots': ['floresta corrompida', 'Raízes jade e corrompidas, tomadas por besouros micobiontes, comedores de cadáver e massas que se movem sem vontade.'],
  'walking-pillar': ['coluna viva', 'O Pilar Caminhante e sua corte de luz escura: matéria, fonte e golpeadores da escuridão que gira ao redor.'],
};

// ------------------------------------------------------------------ ajudantes

const nomeDo = (key) => BESTIARY[key]?.name ?? key;
const SINAIS = ['Guardião', 'Capataz', 'Sentinela', 'Carrasco', 'Vigia', 'Senhor', 'Matriarca', 'Arauto'];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Os bichos da fase por quantidade (e o mais forte entre os comuns). */
function bichosDaFase(huntId) {
  const cont = {};
  for (const s of spawnsDaHunt(huntId) ?? []) for (const c of s.criaturas) cont[c.key] = (cont[c.key] ?? 0) + s.quantidade * c.peso;
  const chaves = Object.keys(cont).filter((k) => BESTIARY[k]);
  const porFrequencia = chaves.sort((a, b) => cont[b] - cont[a]);
  const maisForte = [...chaves].sort((a, b) => (BESTIARY[b].hp ?? 0) - (BESTIARY[a].hp ?? 0))[0];
  return { porFrequencia, maisForte };
}

/** Itens com preço de NPC que os bichos da fase dropam (para os baús serem da fase), do mais frequente ao menos. */
function dropsDaFase(chaves, max = 3) {
  const vistos = new Set();
  const lista = [];
  for (const k of chaves) for (const d of BESTIARY[k].loot ?? []) {
    if (d.id == null || d.id === 3031 || vistos.has(d.id) || !(precoNpc(d.id) > 0)) continue;
    vistos.add(d.id);
    lista.push({ id: d.id, chance: d.chance, preco: precoNpc(d.id) });
  }
  return lista.sort((a, b) => b.chance - a.chance).slice(0, max);
}

/** Casas alcançáveis do andar da entrada, por distância a pé da entrada (o BFS do mapa). */
function casasPorDistancia(huntId) {
  const grade = gradeDaHunt(huntOuMapaCustom(huntId));
  const ini = grade.percurso?.[0] ?? grade.inicioReal;
  const g = andarDaGrade(grade, grade.z);
  const alc = casasAlcancaveis(grade).get(grade.z) ?? new Set();
  const dist = new Map([[`${ini.x},${ini.y}`, 0]]);
  const fila = [[ini.x, ini.y]];
  for (let i = 0; i < fila.length; i++) {
    const [x, y] = fila[i];
    const d = dist.get(`${x},${y}`);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const k = `${x + dx},${y + dy}`;
      if ((dx || dy) && g.andavel.has(k) && alc.has(k) && !dist.has(k)) {
        dist.set(k, d + 1);
        fila.push([x + dx, y + dy]);
      }
    }
  }
  const ordenadas = [...dist.entries()].map(([k, d]) => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]), d })).sort((a, b) => a.d - b.d);
  return { ordenadas, z: grade.z };
}

/** `n` pontos espalhados (quantis da distância da entrada), a pelo menos 6 casas uns dos outros. */
function pontosDaFase(huntId, n) {
  const { ordenadas, z } = casasPorDistancia(huntId);
  const escolhidos = [];
  const quantis = Array.from({ length: n }, (_, i) => 0.3 + (0.6 * i) / Math.max(1, n - 1));
  for (const q of quantis) {
    const alvo = Math.min(ordenadas.length - 1, Math.floor(ordenadas.length * q));
    for (let delta = 0; delta < ordenadas.length; delta++) {
      const c = ordenadas[Math.min(ordenadas.length - 1, alvo + delta)] ?? ordenadas[alvo];
      if (!escolhidos.some((p) => Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) < 6)) {
        escolhidos.push({ x: c.x, y: c.y, z });
        break;
      }
    }
  }
  while (escolhidos.length < n) escolhidos.push({ ...escolhidos.at(-1) });
  return escolhidos;
}

// ------------------------------------------------------------------ bosses

function desenharBoss({ id, nome, categoria, base, fase, tema }) {
  const b = BESTIARY[base];
  const ataques = ataquesParaFicha(base) ?? [];
  const melee = ataques.find((a) => a.tipo === 'melee');
  const maiorGolpe = Math.max(40, ...ataques.map((a) => a.max));
  const secreto = categoria === 'secreto';
  const loot = (b.loot ?? []).filter((d) => d.id != null && (d.id === 3031 || precoNpc(d.id) > 0)).slice(0, 6).map((d) => ({ id: d.id, chance: Math.min(100, Math.max(1, Math.round(d.chance * 100 * (secreto ? 4 : 2) * 100) / 100)) }));
  const invocar = (qtd, vivos) => ({ tipo: 'invocar', criaturas: [{ key: tema.comuns[0], qtd }], maxVivos: vivos, intervaloMs: 18000, chance: 100, fala: 'Venham!' });
  return {
    id, nome, categoria, base,
    descricao: `${secreto ? 'Um segredo' : 'Um chefe menor'} de ${fase.nome}.`,
    lore: tema.lore,
    nivel: fase.nivel.facil,
    atributos: { vidaMult: secreto ? 9 : 5, danoMult: secreto ? 1.5 : 1.25, expMult: secreto ? 8 : 4, armadura: Math.round((b.armor ?? 0) * 1.3) },
    melee: melee ? { min: Math.round(melee.max * 0.2), max: Math.round(melee.max * 0.8), intervaloMs: 2000 } : null,
    usaPoderesDoBase: true,
    comportamentos: [{ tipo: 'area-telegrafada', nome: secreto ? 'Ruptura' : 'Pancada no chão', elemento: 'physical', min: Math.round(maiorGolpe * 0.4), max: Math.round(maiorGolpe * 0.9), raio: secreto ? 3 : 2, avisoMs: 1800, intervaloMs: secreto ? 9000 : 12000, chance: 100, alcance: 7 }],
    fases: secreto
      ? [
          { nome: 'Ferido', ate: 60, mods: { danoMult: 1.25 }, aoEntrar: { fala: 'Vocês não deviam ter achado este lugar.', escudo: { pctVida: 12, duracaoMs: 8000, vulnerabilidade: { pct: 25, ms: 5000 } } }, comportamentos: [invocar(2, 4)] },
          { nome: 'Enfurecido', ate: 30, mods: { danoMult: 1.5, velocidadeDeAtaque: 1.2 }, aoEntrar: { fala: 'Chega!' }, comportamentos: [] },
        ]
      : [{ nome: 'Enfurecido', ate: 50, mods: { danoMult: 1.3 }, aoEntrar: { fala: 'Não passarão!' }, comportamentos: [] }],
    recompensas: { loot, primeiraVitoria: { gold: Math.max(200, Math.round(tema.valorDaFase * (secreto ? 0.5 : 0.25))) } },
  };
}

// ------------------------------------------------------------------ geração

const AFIXOS_DO_ATO = [
  [{ afixo: 'phys_dmg', valor: 8 }, { afixo: 'armour_pct', valor: 10 }],
  [{ afixo: 'atk_speed', valor: 6 }, { afixo: 'avoid_damage', valor: 2 }],
  [{ afixo: 'spell_dmg', valor: 2 }, { afixo: 'protect_all', valor: 0.6 }],
  [{ afixo: 'crit_chance', valor: 3 }, { afixo: 'dmg_reduction', valor: 3 }],
];
for (const l of AFIXOS_DO_ATO) for (const e of l) if (!FICHAS[e.afixo]) throw new Error(`afixo desconhecido: ${e.afixo}`);

const fases = Campanha.FASES.map((f, indice) => ({ ...f, indice })).filter((f) => !f.pular);
const bossesGerados = [];
const encontrosPorFase = {};
const resumo = [];

for (const f of fases) {
  const tema = TEMAS[f.huntId];
  if (!tema) throw new Error(`sem tema para ${f.huntId}`);
  const iNoAto = f.indice % 12;
  const { porFrequencia, maisForte } = bichosDaFase(f.huntId);
  const valorDaFase = Eco.valorDaInstancia(f.huntId, 'facil').valor;
  const drops = dropsDaFase(porFrequencia);
  const nBaus = 1 + (iNoAto % 3 === 1 ? 1 : 0) + (iNoAto % 4 === 3 ? 1 : 0) + (iNoAto % 2 === 0 ? 1 : 0) + (iNoAto % 3 === 2 ? 1 : 0) + (iNoAto === 7 ? 1 : 0);
  const pontos = pontosDaFase(f.huntId, nBaus);
  let k = 0;
  const proximo = () => pontos[k++ % pontos.length];
  const moeda = Math.max(20, Math.round(valorDaFase * 0.03));
  const baseDrops = [{ id: 3031, chance: 100 }, ...drops.map((d) => ({ id: d.id, chance: Math.min(25, Math.max(1, Math.round(d.chance * 100 * 5 * 100) / 100)) }))];
  const sinal = SINAIS[(f.indice * 3) % SINAIS.length];
  const temaBoss = { comuns: porFrequencia, valorDaFase, lore: `Dizem que ${tema[1].charAt(0).toLowerCase()}${tema[1].slice(1, -1)} — e que alguém continua lá dentro, esperando.` };
  const enc = [];
  // Baú comum: sempre, disponível desde o início.
  enc.push({ id: 'bau-1', tipo: 'bau-comum', nome: `Baú esquecido de ${f.nome}`, ...proximo(), recompensa: { drops: baseDrops, moedasMedia: moeda } });
  if (iNoAto % 2 === 0) {
    enc.push({
      id: 'altar-1', tipo: 'altar', nome: `Altar de ${f.nome}`, ...proximo(),
      efeitos: AFIXOS_DO_ATO[f.ato - 1], duracaoMs: 90_000,
      ...(iNoAto % 4 === 0 ? { penalidade: { efeitos: [{ afixo: 'armour_pct', valor: -8 }], invocacao: { criaturas: [{ key: porFrequencia[0], qtd: 2 }] } } } : {}),
    });
  }
  if (iNoAto % 3 === 1) {
    enc.push({ id: 'bau-raro-1', tipo: 'bau-raro', nome: `Cofre vigiado de ${f.nome}`, ...proximo(), guardioes: { criaturas: [{ key: maisForte, qtd: 2 }], raridade: 'elite' }, recompensa: { drops: baseDrops, rolagens: 2, moedasMedia: moeda * 2 } });
  }
  if (iNoAto % 4 === 3) {
    enc.push({ id: 'bau-maldito-1', tipo: 'bau-amaldicoado', nome: `Baú maldito de ${f.nome}`, ...proximo(), invocacao: { criaturas: [{ key: porFrequencia[0], qtd: 3 }], raridade: 'modificado' }, armadilha: { chance: 30, elemento: 'physical', min: 20, max: 60 }, recompensa: { drops: baseDrops, rolagens: 2, moedasMedia: moeda * 2 } });
  }
  if (iNoAto % 3 === 2) {
    const id = `mini-${slug(f.huntId)}`;
    bossesGerados.push(desenharBoss({ id, nome: `${sinal} de ${f.nome}`, categoria: 'miniboss', base: maisForte, fase: f, tema: temaBoss }));
    enc.push({ id: 'miniboss-1', tipo: 'miniboss', nome: `${sinal} de ${f.nome}`, bossId: id, probabilidade: 20, condicao: { tipo: 'monstros-limpos' } });
  }
  if (iNoAto === 7) {
    const id = `segredo-${slug(f.huntId)}`;
    bossesGerados.push(desenharBoss({ id, nome: `A Sombra de ${f.nome}`, categoria: 'secreto', base: maisForte, fase: f, tema: temaBoss }));
    enc.push({ id: 'segredo-1', tipo: 'boss-secreto', nome: `A Sombra de ${f.nome}`, bossId: id, probabilidade: 5, condicao: { tipo: 'apos-encontro', encontro: 'bau-raro-1' } });
  }
  encontrosPorFase[f.huntId] = { enc, tema, valorDaFase, moeda };
}

// ------------------------------------------------------------------ gravação (pelo editor) e conferência da economia

let falhas = 0;
// No modo seco os bosses só entram na memória (para os encontros validarem), sem gravar arquivo.
if (SECO) for (const b of bossesGerados) Catalogo.registrar(b);
if (!SECO) for (const b of bossesGerados) {
  const r = Conteudo.salvarBoss(b);
  if (!r.ok) { falhas++; console.error('BOSS', b.id, r.erros.join(' | ')); }
}
const ids = new Set(bossesGerados.map((b) => b.id));
for (const f of fases) {
  const { enc, tema, valorDaFase } = encontrosPorFase[f.huntId];
  const modelado = (lista) => Conteudo.validarFase(f.huntId, lista);
  // Ajusta as moedas dos baús para a soma dos encontros ficar em ALVO_DA_FASE do valor da fase.
  let tentativas = 0;
  let v = modelado(enc);
  const acimaDoTeto = (r) => r.erros.some((m) => /valor esperado .* acima do teto/.test(m)) || (r.economia && r.economia.fracao > ALVO_DA_FASE);
  while (acimaDoTeto(v) && tentativas++ < 20) {
    // Baixa as moedas E a chance dos itens (nas fases ricas, os itens é que pesam), até caber no teto do baú e na fração da fase.
    for (const e of enc.filter((x) => x.recompensa)) {
      if (e.recompensa.moedasMedia) e.recompensa.moedasMedia = Math.max(5, Math.round(e.recompensa.moedasMedia * 0.7));
      for (const d of e.recompensa.drops) if (d.id !== 3031) d.chance = Math.max(0.5, Math.round(d.chance * 70) / 100);
    }
    v = modelado(enc);
  }
  const bossesFaltando = enc.filter((e) => e.bossId && SECO && !ids.has(e.bossId));
  void bossesFaltando;
  if (!SECO) {
    const r = Conteudo.salvarEncontros(f.huntId, enc);
    if (!r.ok) { falhas++; console.error('FASE', f.huntId, r.erros.join(' | ')); }
    const m = Conteudo.salvarMeta(f.huntId, { ambiente: tema[0], descricao: tema[1] });
    if (!m.ok) { falhas++; console.error('META', f.huntId, m.erros.join(' | ')); }
  }
  if (v.erros.length) console.error('VALIDAÇÃO', f.huntId, v.erros.join(' | '));
  resumo.push({ fase: f.huntId, encontros: enc.length, valorDaFase, fracao: v.economia?.fracao ?? 0, erros: v.erros.length });
}
console.log(`${fases.length} fases, ${bossesGerados.length} bosses (${bossesGerados.filter((b) => b.categoria === 'miniboss').length} minibosses, ${bossesGerados.filter((b) => b.categoria === 'secreto').length} secretos), ${resumo.reduce((n, r) => n + r.encontros, 0)} encontros`);
console.log(`economia: encontros = ${Math.round(Math.min(...resumo.map((r) => r.fracao)) * 100)}% a ${Math.round(Math.max(...resumo.map((r) => r.fracao)) * 100)}% do valor da fase (alvo ≤ ${ALVO_DA_FASE * 100}%, aviso > ${CONFIG.limites.fracaoDaFaseAviso * 100}%)`);
if (falhas) {
  console.error(`${falhas} falha(s)`);
  process.exit(1);
}
