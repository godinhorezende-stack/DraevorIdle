// A FICHA DO PERSONAGEM no estilo do PoE (dono, 07/10: "melhore a ficha do personagem para algo assim, com todos os atributos importantes
// e de onde vem" — a tela de personagem do PoE: https://www.poewiki.net/wiki/Character_screen). Só com ITENS_POE=1.
//
// Monta, a partir da ficha de combate (`ficha.mjs → combate`) e do estado, o que a tela desenha: o cabeçalho (classe, ascendência, área,
// atributos), os números grandes (Vida, Escudo de Energia, Mana; Armadura, Evasão, Bloqueio; as resistências com o valor sem limite entre
// parênteses) e as SEÇÕES em lista (Vida, Escudo de Energia, Mana, Ataque, Magia, Defesa, Cargas, Diversos) — como as abas Ofensa, Defesa,
// Diversos e Cargas do PoE. Cada linha pode trazer `fontes` (`[{ fonte, valor }]`): DE ONDE vem o número (classe, nível, atributo,
// equipamento, árvore, especialização...), que a tela mostra ao passar o mouse.
import * as R from '../regras.mjs';
import * as Afixos from '../afixos.mjs';
import * as Atributos from './atributos.mjs';
import * as Especializacoes from './especializacoes.mjs';
import * as Passivas from '../passivas/arvore.mjs';
import * as ClassesPoe from '../itens-poe/classes.mjs';
import { esperaDaRecarga } from './defesa.mjs';
import { nomeDaHunt } from '../hunt/terreno.mjs';
import * as CargasPoe from '../itens-poe/cargas.mjs';
import { MANA_REGEN_BASE_POE, LEECH_POE, tetoDoRouboPct, APS_DESARMADO_POE } from '../ficha.mjs';
import * as AfeccoesPoe from '../itens-poe/afeccoes.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';

const ES = Atributos.CONFIG.energyShield ?? {};
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const fonte = (nome, valor, extra = {}) => (valor ? [{ fonte: nome, valor: r2(valor), ...extra }] : []);
const linha = (rotulo, valor, { fontes = null, dica = null, destaque = false } = {}) => ({ rotulo, valor, ...(fontes?.length ? { fontes } : {}), ...(dica ? { dica } : {}), ...(destaque ? { destaque: true } : {}) });
const pct = (v, casas = 1) => `${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;
const num = (v, casas = 0) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });
/** A redução da Armadura contra um golpe físico de `dano` (a fórmula do PoE 1: A / (A + 5 × dano), até 90%). */
export const reducaoDaArmadura = (armadura, dano) => Math.min(0.9, armadura > 0 ? armadura / (armadura + 5 * Math.max(1, dano)) : 0);

/** Um número que é soma de partes: as partes que somam e um "outros" com o que sobra para fechar o total (buffs, auras, cargas...). */
function partes(total, lista, resto = 'Outros (buffs, auras, frascos, cargas)') {
  const somado = lista.reduce((n, f) => n + (f.pct ? 0 : f.valor), 0);
  const falta = Math.round((total - somado) * 100) / 100;
  return [...lista, ...(Math.abs(falta) >= 0.5 ? [{ fonte: resto, valor: falta }] : [])];
}

export function montar(estado, ficha, extras = {}) {
  const itens = Afixos.somaDeItens(estado);
  const arv = Passivas.efeitos(estado);
  const total = Afixos.soma(estado);
  const outros = (k) => (total[k] ?? 0) - (itens[k] ?? 0) - (arv.adds[k] ?? 0);
  const esp = Especializacoes.efeitos(estado);
  const p = Atributos.principais(estado, total);
  const doAtributo = Atributos.efeitos(p, total);
  const classe = ClassesPoe.classeDe(estado);
  const asc = estado.passivas?.ascendencia ? Passivas.arvore()?.ascendencias?.[estado.passivas.ascendencia] ?? null : null;
  const o = ficha.origens ?? {};
  const daOrigem = (chave) => (o[chave] ?? []).map((f) => ({ fonte: f.fonte, valor: f.valor, ...(f.pct ? { pct: true } : {}) }));
  const base = R.statsBase(estado.vocation, estado.level ?? 1);

  // ---- os atributos (Força, Destreza, Inteligência): a classe, o equipamento, a árvore e o resto
  const atributo = (k) => partes(p[k], [...fonte(`Classe${classe ? ` (${classe.nome})` : ''}`, p.daVocacao[k]), ...fonte('Equipamento', itens[k]), ...fonte('Árvore de passivas', arv.adds[k]), ...fonte('Outros (frascos, auras)', outros(k))], 'Outros');

  // ---- Vida e Mana: o nível, o atributo, o equipamento, a árvore, os "aumentada em %" e o resto
  const pctDe = (stat) => (esp.fontes[stat] ?? []).map((f) => ({ fonte: f.especializacao, valor: f.pct, pct: true }));
  // O "aumentada em %" (a especialização da classe do Draevor e os nós da árvore) em PONTOS, com o nome e a %: é o que ele soma de fato
  // (antes saía a % numa linha e o resultado num "Outros" — dono, 07/10: "de onde está vindo?").
  const nomeDaVocacao = Especializacoes.CONFIG.classes?.[Especializacoes.classeDe(estado)]?.nome ?? estado.vocation;
  const emPontos = (stat, semPct) => (esp.fontes[stat] ?? []).map((f) => ({
    fonte: /^Árvore: /.test(f.especializacao) ? `${f.especializacao} (+${num(f.pct, 1)}%)` : `Especialização do ${nomeDaVocacao} — ${f.especializacao} (+${num(f.pct, 1)}%)`,
    valor: r2((semPct * f.pct) / 100),
  }));
  const vidaSemPct = base.maxHp + (total.life ?? 0) + doAtributo.vida;
  const manaSemPct = base.maxMana + (total.mana ?? 0) + doAtributo.mana;
  const vida = partes(estado.maxHp ?? 0, [
    ...fonte(`Nível ${estado.level ?? 1} (base)`, base.maxHp),
    ...fonte(`Força (${p.str})`, doAtributo.vida),
    ...fonte('Equipamento', itens.life),
    ...fonte('Árvore de passivas', arv.adds.life),
    ...emPontos('life', vidaSemPct),
    ...fonte('Gem Atelier (gemas do Draevor)', estado.gemasMax?.hp ?? 0),
    ...fonte('Árvore antiga do Draevor', estado.arvoreMax?.hp ?? 0),
    ...fonte('Buff Power', estado.buffVida ? 3000 : 0),
  ]);
  const mana = partes(estado.maxMana ?? 0, [
    ...fonte(`Nível ${estado.level ?? 1} (base)`, base.maxMana),
    ...fonte(`Inteligência (${p.int})`, doAtributo.mana),
    ...fonte('Equipamento', itens.mana),
    ...fonte('Árvore de passivas', arv.adds.mana),
    ...emPontos('mana', manaSemPct),
    ...fonte('Gem Atelier (gemas do Draevor)', estado.gemasMax?.mana ?? 0),
    ...fonte('Árvore antiga do Draevor', estado.arvoreMax?.mana ?? 0),
    ...fonte('Buff Power', estado.buffVida ? 3000 : 0),
  ]);
  const vidaPct = (esp.stats.life ?? 0);
  const manaPct = (esp.stats.mana ?? 0);

  // ---- Escudo de Energia: a base das peças, o "+N" e o "aumentado em %" (equipamento, árvore e a Inteligência)
  const esDasPecas = Object.values(estado.equipment ?? {}).reduce((n, pc) => n + (pc?.base?.es ? (pc.base.es[0] + pc.base.es[1]) / 2 : 0), 0);
  const esPct = (total.es_pct ?? 0) + (doAtributo.energyShieldPct ?? 0);
  const es = [
    ...fonte('Base das peças vestidas', esDasPecas),
    ...fonte('Equipamento (+N)', itens.energy_shield),
    ...fonte('Árvore de passivas (+N)', arv.adds.energy_shield),
    ...fonte('Equipamento (aumentado)', itens.es_pct, { pct: true }),
    ...fonte('Árvore de passivas (aumentado)', arv.adds.es_pct, { pct: true }),
    ...fonte(`Inteligência (${p.int})`, doAtributo.energyShieldPct, { pct: true }),
    // (o aumento de UMA peça: "Escudo de Energia do Elmo Equipado", "Defesas do Escudo equipado" — só na base dela)
    ...fonte('Só na base do Escudo (aumentado)', (total.es_pct_escudo ?? 0) + (total.defesas_pct_escudo ?? 0), { pct: true }),
    ...fonte('Só na base do Elmo (aumentado)', total.es_pct_elmo, { pct: true }),
    ...fonte('Só na base do Peitoral (aumentado)', total.es_pct_peitoral, { pct: true }),
  ];
  const esMax = Math.round(ficha.energyShield ?? 0);
  const esRecarga = esMax * (ES.RECARGA_POR_SEGUNDO ?? 0) * (1 + (ficha.esRecargaPct ?? 0) / 100);

  // ---- resistências: a final (limitada) e a sem limite (o PoE mostra as duas)
  const teto = ficha.limites?.resistenciaDoJogador ?? 75;
  const RESIST = [['fire', 'Fogo'], ['ice', 'Gelo'], ['energy', 'Raio'], ['chaos', 'Caos']];
  const resistencias = RESIST.map(([el, nome]) => {
    const final = ficha.protection?.[el] ?? 0;
    const bruta = final + (ficha.excedentes?.protection?.[el] ?? 0);
    return { id: el, nome, final, bruta, maximo: teto, penalidade: ficha.penalidadeDeResistencia ?? 0, fontes: daOrigem(`protection.${el}`) };
  });

  // ---- números grandes
  const ataquesPorSegundo = ficha.intervaloDoGolpeMs ? 1000 / ficha.intervaloDoGolpeMs : 0;
  // De onde vêm: os Ataques por Segundo da BASE da arma (o catálogo do PoE), a Velocidade de Ataque LOCAL dela (`atk_speed_local`) e os
  // aumentos globais (a mesma conta de `ficha.intervaloDoGolpeMs`). Sem arma, os 1,2 por segundo do desarmado.
  const apsDaArma = ficha.arma?.aps;
  const fontesDosAtaques = [
    ...fonte('Base da arma', apsDaArma?.base),
    ...fonte('Desarmado', ficha.arma ? 0 : APS_DESARMADO_POE),
    ...fonte('Velocidade de Ataque local da arma', ficha.arma?.locais?.pctVelocidade, { pct: true }),
    ...daOrigem('velocidadeDeAtaque').map((f) => ({ ...f, pct: true })),
    ...fonte('Velocidade de Ataque mais/menos', ficha.velocidadeDeAtaqueMais, { pct: true }),
  ];
  // ("20% menos Velocidade de Ataque": multiplica por cima dos aumentos — `Ficha.fatorDeVelocidadeMais`.)
  const maisMenos = ficha.velocidadeDeAtaqueMais ? `; ${pct(Math.abs(ficha.velocidadeDeAtaqueMais), 0)} ${ficha.velocidadeDeAtaqueMais > 0 ? 'mais' : 'menos'} (multiplica)` : '';
  const dicaDosAtaques = apsDaArma
    ? `a arma: ${num(apsDaArma.base, 2)} por segundo${apsDaArma.aposLocal !== apsDaArma.base ? ` × local = ${num(apsDaArma.aposLocal, 2)}` : ''}${ficha.duasArmas ? ' (duas armas: a média dos tempos das duas, 10% mais rápido)' : ''}${ficha.velocidadeDeAtaque ? `; velocidade de ataque global +${pct(ficha.velocidadeDeAtaque, 0)}` : ''}${maisMenos}`
    : `desarmado: ${num(APS_DESARMADO_POE, 2)} por segundo${ficha.velocidadeDeAtaque ? `; velocidade de ataque global +${pct(ficha.velocidadeDeAtaque, 0)}` : ''}${maisMenos}`;
  const danoMedio = ((ficha.damage?.min ?? 0) + (ficha.damage?.max ?? 0)) / 2;
  const cg = ficha.cargas ?? {};
  const maxCarga = (k) => 3 + (cg[`max_${k}`] ?? 0);
  const chances = extras.chancesNoLevel ?? {};
  // A regeneração do PoE (a mesma conta do jogo — `ficha.regenPoe`, usada em `cacadas.regenerar`).
  const rp = ficha.regenPoe ?? { vidaPorSegundo: 0, manaPorSegundo: 0, vidaPctDoMax: 0, vidaAumentada: 0, manaAumentada: 0, vidaFixa: 0, manaFixa: 0 };
  const regenVida = rp.vidaPorSegundo;
  const regenMana = rp.manaPorSegundo;
  const fontesDaRegenVida = [
    ...fonte('Fixa (+N por segundo)', rp.vidaFixa),
    ...fonte(`${num(rp.vidaPctDoMax, 2)}% da vida máxima por segundo`, ((estado.maxHp ?? 0) * rp.vidaPctDoMax) / 100),
    ...fonte('Velocidade de regeneração aumentada', rp.vidaAumentada, { pct: true }),
  ];
  const fontesDaRegenMana = [
    ...fonte(`Base do PoE (${num(MANA_REGEN_BASE_POE, 1)}% da mana máxima)`, ((estado.maxMana ?? 0) * MANA_REGEN_BASE_POE) / 100),
    ...fonte('Fixa (+N por segundo)', rp.manaFixa),
    ...fonte('Regeneração de mana aumentada', rp.manaAumentada, { pct: true }),
  ];
  const cargasAtivas = CargasPoe.ativas(estado);
  const pen = ficha.penalidadeDeResistencia ?? 0;
  const dano = Object.entries(ficha.danoDoElemento ?? {}).filter(([, v]) => v);
  const NOME_DO_ELEMENTO = { physical: 'Físico', fire: 'de Fogo', ice: 'de Gelo', energy: 'de Raio', chaos: 'de Caos', earth: 'de Veneno', death: 'de Morte', holy: 'Sagrado' };

  // ---- a OFENSA do golpe da arma, como a aba Ofensa do PoE: o Físico e o total do acerto (com os "aumentado" — a mesma conta de
  // `hunt/combate`: a parte da Força só no corpo a corpo), a chance de acertar, o DPS (média × ataques por segundo × chance de acertar) e o
  // dano por segundo do Sangramento e do Veneno que o acerto aplica (`itens-poe/afeccoes`: 70% e 30% do dano por segundo, os multiplicadores
  // e os "aumentado" das afecções).
  const corpoACorpo = !['distance', 'magic'].includes(ficha.armaEquipada?.familia);
  // (+ a Empunhadura de Ferro: a Força também no ataque de projétil — `Ficha.forcaNoGolpe`)
  const forcaVale = corpoACorpo || Number(ficha.afPoe?.forca_em_projeteis) > 0;
  const pctDo = (el) => (ficha.danoDoElemento?.[el] ?? 0) - (el === 'physical' && !forcaVale ? ficha.danoFisicoDaForca ?? 0 : 0);
  const fisico = [ficha.damage?.min ?? 0, ficha.damage?.max ?? 0].map((v) => v * (1 + pctDo('physical') / 100));
  const partesDoAcerto = { physical: fisico };
  for (const [el, [a0, b0]] of Object.entries(ficha.danoSomado ?? {})) {
    const x = partesDoAcerto[el] ?? [0, 0];
    partesDoAcerto[el] = [x[0] + a0 * (1 + pctDo(el) / 100), x[1] + b0 * (1 + pctDo(el) / 100)];
  }
  const totalDoAcerto = Object.values(partesDoAcerto).reduce((s, [a0, b0]) => [s[0] + a0, s[1] + b0], [0, 0]);
  const chanceDeAcertar = chances.acerto ?? 1;
  const dps = ((totalDoAcerto[0] + totalDoAcerto[1]) / 2) * ataquesPorSegundo * chanceDeAcertar;
  const af = AfeccoesPoe.daSoma(ficha.afPoe ?? {});
  const porSegundo = (base, porS, multi, aumentado) => base * porS * (1 + multi / 100) * (1 + ((af.danoAumentado ?? 0) + aumentado) / 100);
  const faixa = ([a0, b0], casas = 1) => `${num(a0, casas)} – ${num(b0, casas)}`;
  const sangra = (partesDoAcerto.physical ?? [0, 0]).map((v) => porSegundo(v, AfeccoesPoe.BASE.sangramento.porSegundo, af.multiplicador + (af.multiplicadorSangramento ?? 0), af.danoSangramento ?? 0));
  const baseDoVeneno = [0, 1].map((i) => (partesDoAcerto.physical?.[i] ?? 0) + (partesDoAcerto.chaos?.[i] ?? 0));
  const veneno = baseDoVeneno.map((v) => porSegundo(v, AfeccoesPoe.BASE.veneno.porSegundo, af.multiplicador + (af.multiplicadorVeneno ?? 0), af.danoVeneno ?? 0));
  const doCritico = 1 + AfeccoesPoe.BASE.criticoMaisPct / 100;
  const DO_CRITICO = `posto por um golpe crítico: ${pct(AfeccoesPoe.BASE.criticoMaisPct, 0)} mais (como no PoE)`;
  // ---- o ROUBO (aba Diversos do PoE): o máximo por instância e o total por segundo, em pontos e em % do máximo
  const instPct = LEECH_POE.porInstanciaPct * Math.max(0, 1 + ModsPoe.valor(ficha, 'roubo_instancia_inc') / 100);
  const tetoPct = tetoDoRouboPct(ficha, 'vida');
  const tetoEsPct = tetoDoRouboPct(ficha, 'es');
  const doMax = (max, p0) => `${num((max * p0) / 100, 1)} (${pct(p0, 0)})`;
  // ---- as CARGAS: o que cada uma dá (os números do combate — `CargasPoe.porCarga`)
  const pc = CargasPoe.porCarga(cg);

  const secoes = [
    { id: 'vida', titulo: 'Vida', linhas: [
      linha('Vida máxima', num(estado.maxHp), { fontes: vida, destaque: true }),
      ...(vidaPct ? [linha('Vida máxima aumentada', pct(vidaPct), { fontes: pctDe('life') })] : []),
      linha('Regeneração de vida por segundo', num(regenVida, 1), { fontes: fontesDaRegenVida, dica: 'no PoE a vida não regenera de base: só pelo equipamento e pela árvore' }),
      linha('Roubo de vida', pct(ficha.lifeLeech), { dica: 'do dano causado volta como vida' }),
      ...(ficha.vidaPorAcerto ? [linha('Vida por acerto', num(ficha.vidaPorAcerto))] : []),
      ...(ficha.vidaPorAbate ? [linha('Vida por inimigo morto', num(ficha.vidaPorAbate))] : []),
    ] },
    { id: 'es', titulo: 'Escudo de Energia', linhas: [
      linha('Escudo de Energia máximo', num(esMax), { fontes: es, destaque: true }),
      linha('Escudo de Energia máximo aumentado', pct(esPct), { fontes: es.filter((f) => f.pct) }),
      linha('Recarga por segundo', num(esRecarga, 1), { dica: `${pct((ES.RECARGA_POR_SEGUNDO ?? 0) * 100, 0)} do máximo por segundo${ficha.esRecargaPct ? `, +${pct(ficha.esRecargaPct, 0)}` : ''}` }),
      linha('A recarga começa depois de', `${num(esperaDaRecarga(ficha) / 1000, 2)} s`, { dica: 'sem levar dano' }),
    ] },
    { id: 'mana', titulo: 'Mana', linhas: [
      linha('Mana máxima', num(estado.maxMana), { fontes: mana, destaque: true }),
      ...(manaPct ? [linha('Mana máxima aumentada', pct(manaPct), { fontes: pctDe('mana') })] : []),
      linha('Regeneração de mana por segundo', num(regenMana, 1), { fontes: fontesDaRegenMana, dica: `${num(MANA_REGEN_BASE_POE, 1)}% da mana máxima por segundo, como no PoE` }),
      linha('Roubo de mana', pct(ficha.manaLeech)),
      ...(ficha.manaPorAbate ? [linha('Mana por inimigo morto', num(ficha.manaPorAbate))] : []),
      ...(ficha.manaPorAcerto ? [linha('Mana por acerto', num(ficha.manaPorAcerto))] : []),
      ...(ficha.custoDeMana ? [linha('Custo de mana das habilidades', pct(-ficha.custoDeMana, 0))] : []),
    ] },
    { id: 'ataque', titulo: 'Ataque', linhas: [
      linha('Arma', ficha.armaEquipada?.nome ?? 'nenhuma'),
      linha('Dano por segundo', num(dps, 2), { destaque: true, dica: 'média do acerto × ataques por segundo × chance de acertar (como na tela do PoE)' }),
      linha('Chance de acertar', pct(chanceDeAcertar * 100, 0), { dica: 'contra um monstro do seu nível' }),
      ...(chances.acertoEvasivo != null ? [linha('Chance de acertar monstros evasivos', pct(chances.acertoEvasivo * 100, 0), { dica: 'contra um monstro do seu nível com o modificador Evasivo (+100% de evasão)' })] : []),
      linha('Ataques por segundo', num(ataquesPorSegundo, 2), { fontes: fontesDosAtaques, dica: dicaDosAtaques }),
      linha('Dano total do acerto', faixa(totalDoAcerto, 0), { dica: 'todos os tipos de dano do golpe, com os "aumentado", antes da resistência do monstro' }),
      linha('Dano físico do acerto', faixa(partesDoAcerto.physical ?? [0, 0], 0), { dica: `${ficha.arma ? 'o dano da arma' : 'o soco (desarmado)'} ${num(ficha.damage?.min)}–${num(ficha.damage?.max)} × ${num(1 + pctDo('physical') / 100, 2)} (dano físico aumentado)` }),
      linha('Precisão', num(ficha.accuracy), { fontes: daOrigem('accuracy') }),
      linha('Sangramento por segundo (acerto)', faixa(sangra), { dica: `${pct(AfeccoesPoe.BASE.sangramento.porSegundo * 100, 0)} do dano físico do acerto por segundo, por ${num(AfeccoesPoe.BASE.sangramento.duracaoMs / 1000)} s` }),
      linha('Sangramento por segundo (crítico)', faixa(sangra.map((v) => v * doCritico)), { dica: DO_CRITICO }),
      linha('Veneno por segundo (acerto)', faixa(veneno), { dica: `${pct(AfeccoesPoe.BASE.veneno.porSegundo * 100, 0)} do dano físico e de caos do acerto por segundo, por ${num(AfeccoesPoe.BASE.veneno.duracaoMs / 1000)} s` }),
      linha('Veneno por segundo (crítico)', faixa(veneno.map((v) => v * doCritico)), { dica: DO_CRITICO }),
      linha('Chance de crítico', pct((ficha.critChance ?? 0) * 100, 2), { fontes: daOrigem('critChance') }),
      // (Duas armas: cada mão rola o crítico da arma dela — `Ficha.fichaDaMao`.)
      ...(ficha.critChanceSecundaria != null ? [linha('Chance de crítico (mão secundária)', pct(ficha.critChanceSecundaria * 100, 2), { dica: 'os golpes da arma da mão secundária usam o crítico dela (a base × o crítico local dela); a linha de cima é o da principal' })] : []),
      linha('Multiplicador de crítico', pct((ficha.critMultiplier ?? 1.5) * 100, 0), { fontes: daOrigem('critMultiplier') }),
      ...dano.map(([el, v]) => linha(`Dano ${NOME_DO_ELEMENTO[el] ?? el} aumentado`, `+${pct(v)}`, { fontes: daOrigem(`dano.${el}`) })),
      ...Object.entries(ficha.danoSomado ?? {}).map(([el, [a, b]]) => linha(`Dano ${NOME_DO_ELEMENTO[el] ?? el} adicionado aos ataques`, `${num(a)}–${num(b)}`)),
      ...(ficha.penetracao?.elemental ? [linha('Penetração elemental', pct(ficha.penetracao.elemental, 0))] : []),
      ...(ficha.penetracao?.fisica ? [linha('Penetração física', pct(ficha.penetracao.fisica, 0))] : []),
      ...(ficha.ataqueDuplo ? [linha('Chance de ataque duplo', pct(ficha.ataqueDuplo * 100, 0), { fontes: daOrigem('ataqueDuplo') })] : []),
    ] },
    { id: 'magia', titulo: 'Magia', linhas: [
      linha('Velocidade de conjuração', `+${pct(ficha.castSpeed, 0)}`, { fontes: daOrigem('castSpeed') }),
      linha('Chance de crítico com magias', ficha.critMagiaPoe ? `base da gema × ${num(1 + ficha.critMagiaPoe.aumentada / 100, 2)}` : pct((ficha.critChanceMagia ?? ficha.critChance ?? 0) * 100, 2), { dica: 'como no PoE, a chance-base de crítico de cada magia é a da gema (ex.: Bola de Fogo 6%), somada aos "+% de chance" e multiplicada pelo "aumentada"' }),
      linha('Roubo de vida e mana', 'só ataques', { dica: 'como no PoE: as magias não roubam; cada acerto cria uma instância de até 10% da máxima, que recupera a 2% por segundo; todas juntas recuperam no máximo 20% da máxima por segundo' }),
      linha('Dano de magia aumentado', `+${pct((ficha.danoDeMagiaDoPoe ?? 0) + (ficha.danoDeMagia ?? 0))}`, { fontes: daOrigem('dano.spell') }),
      ...Object.entries(ficha.danoSomadoMagia ?? {}).map(([el, [a, b]]) => linha(`Dano ${NOME_DO_ELEMENTO[el] ?? el} adicionado às magias`, `${num(a)}–${num(b)}`)),
    ] },
    { id: 'defesa', titulo: 'Defesa', linhas: [
      linha('Armadura', num(ficha.armor), { fontes: daOrigem('armour'), dica: `reduz ${pct(reducaoDaArmadura(ficha.armor ?? 0, 100) * 100, 0)} de um golpe físico de 100` }),
      linha('Evasão', num(ficha.evasion), { fontes: daOrigem('evasion'), dica: chances.esquiva != null ? `${pct(chances.esquiva * 100, 0)} de chance de evitar o ataque de um monstro do seu nível` : null }),
      linha('Chance de bloquear ataques', pct((ficha.blockChance ?? 0) * 100, 1)),
      linha('Chance de bloquear magias', pct((ficha.bloqueioDeMagia ?? 0) * 100, 1)),
      linha('Chance de suprimir dano de magia', pct((ficha.supressaoDeMagia ?? 0) * 100, 0), { dica: 'a magia suprimida causa 50% menos dano' }),
      ...(pen ? [linha('Penalidade de resistência da campanha', `−${pen}%`, { dica: pen >= 60 ? 'depois dos chefes dos Atos 5 e 10' : 'depois do chefe do Ato 5 (mais 30% depois do Ato 10)' })] : []),
      ...(ficha.protection?.physical ? [linha('Redução de dano físico', pct(ficha.protection.physical, 0))] : []),
      ...resistencias.map((r) => linha(`Resistência a ${r.nome}`, `${pct(r.final, 0)}${r.bruta !== r.final ? ` (${pct(r.bruta, 0)})` : ''}`, { fontes: r.fontes, dica: `máximo ${r.maximo}%` })),
      linha('Velocidade de movimento', num(extras.speed ?? ficha.speed), { fontes: daOrigem('speed') }),
    ] },
    { id: 'cargas', titulo: 'Cargas', linhas: [
      linha('Cargas de Tolerância', `${cargasAtivas.tolerancia} / ${maxCarga('tolerancia')}`, { dica: 'ativas agora / máximo' }),
      linha('Redução de dano físico por Carga de Tolerância', pct(pc.tolerancia.reducaoFisica, 1)),
      linha('Redução de dano elemental por Carga de Tolerância', pct(pc.tolerancia.resElemental, 1), { dica: 'soma às resistências elementais' }),
      linha('Cargas de Frenesi', `${cargasAtivas.frenesi} / ${maxCarga('frenesi')}`, { dica: 'ativas agora / máximo' }),
      linha('Velocidade de ataque por Carga de Frenesi', `+${pct(pc.frenesi.velAtaque, 1)}`),
      linha('Velocidade de conjuração por Carga de Frenesi', `+${pct(pc.frenesi.velConjuracao, 1)}`),
      linha('Dano por Carga de Frenesi', `${pct(pc.frenesi.danoMais, 1)} mais`),
      linha('Cargas de Poder', `${cargasAtivas.poder} / ${maxCarga('poder')}`, { dica: 'ativas agora / máximo' }),
      linha('Chance de crítico por Carga de Poder', `+${pct(pc.poder.critAumentado, 1)}`, { dica: 'aumentada (multiplica a chance de crítico)' }),
    ] },
    { id: 'roubo', titulo: 'Roubo', linhas: [
      linha('Recuperação máxima por instância de roubo de vida', doMax(estado.maxHp ?? 0, instPct), { dica: `cada acerto cria uma instância que recupera ${pct(LEECH_POE.taxaDaInstanciaPct, 0)} da vida máxima por segundo` }),
      linha('Recuperação total por segundo do roubo de vida', doMax(estado.maxHp ?? 0, tetoPct), { dica: 'a soma de todas as instâncias ativas' }),
      linha('Recuperação máxima por instância de roubo de mana', doMax(estado.maxMana ?? 0, instPct)),
      linha('Recuperação total por segundo do roubo de mana', doMax(estado.maxMana ?? 0, tetoPct)),
      linha('Recuperação máxima por instância de roubo de escudo', doMax(esMax, instPct)),
      linha('Recuperação total por segundo do roubo de escudo', doMax(esMax, tetoEsPct)),
    ] },
    { id: 'diversos', titulo: 'Diversos', linhas: [
      linha('Quantidade de itens encontrados', `+${pct(ficha.lootRate, 0)}`),
      linha('Ouro encontrado', `+${pct(ficha.goldFind, 0)}`),
      linha('Experiência ganha', `+${pct(ficha.experiencia, 0)}`),
      ...(ficha.danoContra?.boss ? [linha('Dano contra chefes', `+${pct(ficha.danoContra.boss, 0)}`)] : []),
      ...(ficha.danoContra?.elite ? [linha('Dano contra monstros raros', `+${pct(ficha.danoContra.elite, 0)}`)] : []),
    ] },
  ];

  return {
    cabecalho: {
      classe: classe?.nome ?? null,
      ascendencia: asc?.nome ?? null,
      area: estado.hunt?.huntId ? nomeDaHunt(estado.hunt.huntId) : 'Cidade',
      atributos: [
        { id: 'str', nome: 'Força', valor: p.str, fontes: atributo('str'), dica: `+${num(doAtributo.vida)} de vida · +${pct(doAtributo.danoFisicoPct)} de dano físico corpo a corpo` },
        { id: 'dex', nome: 'Destreza', valor: p.dex, fontes: atributo('dex'), dica: `+${num(doAtributo.precisao)} de precisão · +${pct(doAtributo.evasaoPct)} de evasão` },
        { id: 'int', nome: 'Inteligência', valor: p.int, fontes: atributo('int'), dica: `+${num(doAtributo.mana)} de mana · +${pct(doAtributo.energyShieldPct)} de escudo de energia` },
      ],
    },
    grandes: [
      { id: 'vida', nome: 'Vida', valor: estado.maxHp ?? 0, fontes: vida },
      { id: 'es', nome: 'Escudo de Energia', valor: esMax, fontes: es },
      { id: 'mana', nome: 'Mana', valor: estado.maxMana ?? 0, fontes: mana },
    ],
    defesas: [
      { id: 'armadura', nome: 'Armadura', valor: num(ficha.armor), sub: pct(reducaoDaArmadura(ficha.armor ?? 0, 100) * 100, 0), dica: 'redução contra um golpe físico de 100', fontes: daOrigem('armour') },
      { id: 'evasao', nome: 'Evasão', valor: num(ficha.evasion), sub: chances.esquiva != null ? pct(chances.esquiva * 100, 0) : null, dica: 'chance de evitar o ataque de um monstro do seu nível', fontes: daOrigem('evasion') },
      { id: 'bloqueio', nome: 'Bloqueio', valor: pct((ficha.blockChance ?? 0) * 100, 0), sub: ficha.bloqueioDeMagia ? `magia ${pct(ficha.bloqueioDeMagia * 100, 0)}` : null, dica: 'chance de bloquear um ataque' },
      { id: 'critico', nome: 'Crítico', valor: pct((ficha.critChance ?? 0) * 100, 1), sub: `×${num(ficha.critMultiplier ?? 1.5, 2)}`, dica: 'chance de crítico e multiplicador', fontes: daOrigem('critChance') },
    ],
    resistencias,
    secoes,
  };
}
