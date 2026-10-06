// O ESTILO VISUAL de cada gema do PoE (dono, 06/10: "tem muito efeito repetido — verifique o estilo condizente com os efeitos"). As 562
// gemas usavam 5 formatos × 5 elementos de molde (25 visuais para tudo). Aqui cada gema ganha, pelo que ela É (o nome em inglês, as tags,
// o arquétipo e o elemento), o projétil, o impacto, a área e o lançamento da biblioteca do jogo (`effect-sprites.json`,
// `missile-sprites.json` — os números conferidos na folha de efeitos): flecha de fogo para arco de fogo, faca para lâminas, lança etérea,
// rocha, golpe com garras, pancada no chão com pedras, nova de gelo com o gelo da área, raio com o relâmpago, aura com o redemoinho do
// elemento, teleporte no deslocamento...
// É o visual de FÁBRICA da gema: a Arena de Efeitos mostra o motivo e o dono troca o que quiser por cima (preset/override), ou desliga.

// ---- a biblioteca (números do client) ----
const P = {
  lanca: 1, flecha: 3, bolaDeFogo: 4, energiaRoxa: 5, flechaVeneno: 6, flechaExplosiva: 7, estrela: 8, faca: 9, morte: 11, rocha: 12, veneno: 15,
  espada: 25, machado: 26, maca: 27, lancaEterea: 28, gelo: 29, sagrado: 31, flechaRaio: 33, flechaFogo: 34, flechaGelo: 35, bolaDeEnergia: 36, geloPequeno: 37,
};
const E = {
  sangue: 1, fumaca: 3, golpeBloqueado: 4, poeira: 6, explosaoDeFogo: 7, nuvemVerde: 9, golpe: 10, teleporte: 11, faisca: 12, brilhoAzul: 13, brilhoVermelho: 14,
  brilhoVerde: 15, chamas: 16, acertoVeneno: 17, caveira: 18, nuvemVenenosa: 21, anelDourado: 35, fogoPequeno: 37, energia: 38, sagrado: 40, tempestade: 41,
  areaDeGelo: 42, tornadoDeGelo: 43, estilhacoDeGelo: 44, pedras: 45, roxo: 48, faiscaAmarela: 49, areaSagrada: 50, cristaisDeGelo: 53, agua: 54,
  raioAzul: 176, raioBranco: 180, raioAmarelo: 181, poeiraGirando: 189, verdeBrilho: 196, garrasVermelhas: 215, corteAzul: 216, redemoinhoRoxo: 222,
  redemoinhoVermelho: 223, redemoinhoLaranja: 224, redemoinhoBranco: 225, redemoinhoAzul: 226, explosaoDeGelo: 243, explosaoDourada: 245, cruzDourada: 246,
  runaVerde: 272, explosaoVerde: 280, garrasBrancas: 282,
};
const ef = (id, extra = {}) => ({ sprite: { tipo: 'efeito', id }, ...extra });
/** Um sprite de FÁBRICA do Draevor (gamedata/efeitos-fabrica — desenhado por código, por elemento). */
const fx = (id, extra = {}) => ({ sprite: { tipo: 'asset', id: `fabrica-${id}` }, ...extra });
const EL_PT = { fire: 'fogo', ice: 'gelo', energy: 'raio', chaos: 'caos', physical: 'fisico', holy: 'sagrado' };
const pj = (id, extra = {}) => ({ sprite: { tipo: 'projetil', id }, ...extra });

/** Por ELEMENTO (o do jogo: fire, ice, energy, chaos, physical, holy): o projétil, o acerto, a área e o redemoinho (auras). */
const DO_ELEMENTO = {
  fire: { proj: P.bolaDeFogo, acerto: E.chamas, area: E.explosaoDeFogo, aura: E.redemoinhoVermelho, flecha: P.flechaFogo, raio: E.redemoinhoLaranja },
  ice: { proj: P.geloPequeno, acerto: E.estilhacoDeGelo, area: E.areaDeGelo, aura: E.redemoinhoAzul, flecha: P.flechaGelo, raio: E.explosaoDeGelo },
  energy: { proj: P.bolaDeEnergia, acerto: E.raioAzul, area: E.tempestade, aura: E.redemoinhoRoxo, flecha: P.flechaRaio, raio: E.raioAzul },
  chaos: { proj: P.veneno, acerto: E.acertoVeneno, area: E.nuvemVenenosa, aura: E.runaVerde, flecha: P.flechaVeneno, raio: E.verdeBrilho },
  physical: { proj: P.rocha, acerto: E.golpe, area: E.pedras, aura: E.redemoinhoBranco, flecha: P.flecha, raio: E.poeira },
  holy: { proj: P.sagrado, acerto: E.sagrado, area: E.cruzDourada, aura: E.explosaoDourada, flecha: P.flecha, raio: E.areaSagrada },
};

/**
 * As REGRAS pelo nome (inglês) — a primeira que casa. `(el) → { visual, motivo }` (`el` = a tabela do elemento da gema). As partes que a
 * regra não diz vêm do elemento e do formato (`completar`).
 */
const REGRAS = [
  [/^vaal /i, null], // a Vaal usa o estilo da base (tratada em `estiloDaGema`)
  [/purif|holy|divine|smite|consecrat|penance|sacred|righteous|absolution|sanctify|hallow/i, () => ({ motivo: 'sagrado', visual: { projetil: fx('esfera-sagrado'), impacto: fx('cruz-sagrada', { noImpacto: true }), area: ef(E.cruzDourada) } })],
  [/blade vortex|bladefall|blade blast|blade trap|ethereal knives|cyclone|bladestorm|whirling/i, () => ({ motivo: 'lâminas', visual: { projetil: pj(P.faca), area: ef(E.corteAzul), impacto: ef(E.corteAzul) } })],
  [/fireball/i, () => ({ motivo: 'bola de fogo', visual: { projetil: pj(P.bolaDeFogo), impacto: ef(E.chamas, { noImpacto: true }), area: ef(E.explosaoDeFogo, { noImpacto: true }) } })],
  [/magma|meteor|volcanic|fissure|firestorm|armageddon/i, () => ({ motivo: 'magma/meteoro', visual: { projetil: pj(P.bolaDeFogo, { escala: 1.25 }), impacto: ef(E.explosaoDeFogo), area: ef(E.chamas) } })],
  [/flameblast|incinerate|scorching|flamethrower|searing|cremation|blazing|fire trap|flame wall|wave of conviction/i, () => ({ motivo: 'chamas', visual: { area: ef(E.explosaoDeFogo), impacto: ef(E.chamas) } })],
  [/frostbolt|ice spear|freezing pulse|frost blades|ice shot|frost(?:blink)? ?bolt/i, () => ({ motivo: 'estilhaço de gelo', visual: { projetil: pj(P.gelo, { orientar: false }), impacto: fx('estilhaco-de-gelo', { noImpacto: true }) } })],
  [/glacial cascade|ice crash|glacial hammer|ice trap|cold snap/i, () => ({ motivo: 'cristais de gelo', visual: { area: ef(E.cristaisDeGelo), impacto: ef(E.cristaisDeGelo) } })],
  [/vortex|arctic breath|winter orb|frost bomb|creeping frost|frostblink|hydrosphere/i, () => ({ motivo: 'redemoinho de gelo', visual: { area: ef(E.tornadoDeGelo), impacto: ef(E.explosaoDeGelo), projetil: pj(P.geloPequeno) } })],
  [/ice nova|glacial|frost/i, () => ({ motivo: 'gelo', visual: { area: ef(E.areaDeGelo), impacto: ef(E.estilhacoDeGelo) } })],
  [/\barc\b|lightning tendrils|crackling lance|shock nova|static strike|lightning strike|storm burst|galvanic|lightning conduit|stormbind|storm rain/i, () => ({ motivo: 'relâmpago', visual: { projetil: pj(P.bolaDeEnergia), impacto: ef(E.raioAzul), area: ef(E.raioAzul) } })],
  [/spark|ball lightning|orb of storms|storm call|storm brand|lightning warp|stormblast|storm/i, () => ({ motivo: 'esfera de energia', visual: { projetil: fx('esfera-raio'), impacto: fx('explosao-raio', { noImpacto: true }), area: ef(E.tempestade) } })],
  [/kinetic|power siphon|blast rain/i, () => ({ motivo: 'energia de varinha', visual: { projetil: pj(P.energiaRoxa), impacto: ef(E.roxo), area: ef(E.roxo) } })],
  [/essence drain|soulrend|bane|dark pact|forbidden rite|despair|exsanguinate|reap|corrupting|death/i, () => ({ motivo: 'morte', visual: { projetil: fx('esfera-caos'), impacto: fx('explosao-caos', { noImpacto: true }), area: ef(E.caveira) } })],
  [/contagion|blight|wither|toxic|caustic|poison|viper|pestilent|plague|venom|cobra/i, () => ({ motivo: 'veneno', visual: { projetil: pj(P.veneno), impacto: ef(E.acertoVeneno), area: fx('nuvem-de-veneno') } })],
  [/explosive arrow/i, () => ({ motivo: 'flecha explosiva', visual: { projetil: pj(P.flechaExplosiva), impacto: ef(E.explosaoDeFogo, { noImpacto: true }), area: ef(E.explosaoDeFogo, { noImpacto: true }) } })],
  [/spectral (?:throw|helix|shield throw)|ethereal/i, () => ({ motivo: 'arma etérea', visual: { projetil: pj(P.lancaEterea, { orientar: false }), impacto: ef(E.corteAzul) } })],
  [/cleave|reave|sweep|lacerate|perforate|double strike|dual strike|frenzy|viper strike|flicker|riposte|counter/i, () => ({ motivo: 'corte', visual: { impacto: fx('corte'), area: fx('corte') } })],
  [/slam|earthquake|earthshatter|sunder|tectonic|boneshatter|leap|shockwave|ground|heavy strike|ancestral|rage vortex|shield crush|shield charge/i, () => ({ motivo: 'pancada no chão', visual: { area: ef(E.pedras), impacto: ef(E.golpe), lancamento: ef(E.poeira) } })],
  [/dash|blink|whirling blades|bodyswap|smoke mine|withering step|phase run|charged dash/i, () => ({ motivo: 'deslocamento', visual: { lancamento: ef(E.teleporte), area: ef(E.fumaca) } })],
];

/** O formato (arquétipo da arena) → que partes o visual usa por padrão. */
function completar(v, el, h) {
  const arco = h.tags.includes('Arco');
  const corpo = h.tags.includes('Corpo a Corpo');
  const pt = EL_PT[h.elemento] ?? 'fisico';
  const magia = !h.ataque;
  if (arco && !v.projetil) v.projetil = pj(el.flecha);
  // A magia de projétil: a ESFERA do elemento (o sprite de fábrica); o fogo segue com a bola de fogo do jogo. Ataque sem arco: a rocha.
  if (!v.projetil) v.projetil = magia && h.elemento !== 'fire' ? fx(`esfera-${pt}`) : pj(h.ataque && !arco ? P.rocha : el.proj);
  // O impacto da magia: a EXPLOSÃO do elemento quando o projétil chega; o golpe/ataque: o acerto de sempre.
  if (!v.impacto) v.impacto = magia && !corpo && h.arquetipo === 'projetil' ? fx(`explosao-${pt}`, { noImpacto: true }) : ef(corpo && h.elemento === 'physical' ? E.golpe : el.acerto);
  // A NOVA: o anel do elemento saindo do personagem (o efeito de área segue em cada casa).
  if (h.arquetipo === 'nova') v.lancamento ??= fx(`nova-${pt}`, { escala: 3 });
  if (!v.area) v.area = ef(el.area);
  if (['aura', 'arauto', 'guarda'].includes(h.arquetipo) && !v.lancamento) v.lancamento = h.elemento === 'chaos' ? fx('redemoinho-arcano', { escala: 1.4 }) : h.arquetipo === 'arauto' && h.elemento === 'fire' ? fx('chamas', { escala: 1.3 }) : ef(h.arquetipo === 'arauto' ? el.raio : el.aura);
  // A AURA LIGADA: o redemoinho do lançamento em loop sob o personagem, enquanto o buff dura (auras, arautos e guardas).
  if (['aura', 'arauto', 'guarda'].includes(h.arquetipo) && v.lancamento && !v.continuo) v.continuo = { ...structuredClone(v.lancamento), loop: true, opacidade: 0.6, ancora: 'pes', escala: (v.lancamento.escala ?? 1) * 2 };
  if (h.arquetipo === 'clamor' && !v.lancamento) v.lancamento = ef(E.anelDourado, { escala: 1.4 });
  if (h.arquetipo === 'maldicao') {
    v.lancamento ??= ef(E.roxo);
    v.alvo ??= ef(h.elemento === 'chaos' || h.elemento === 'physical' ? E.caveira : el.aura, { ancora: 'acima', escala: 0.8 });
  }
  if (['lacaio', 'totem'].includes(h.arquetipo)) v.lancamento ??= ef(E.teleporte);
  if (h.arquetipo === 'movimento') v.lancamento ??= ef(E.teleporte);
  return v;
}

/** O elemento do VISUAL: o da gema (fire, ice, energy, chaos, physical) — "sagrado" quando a regra diz. */
const elementoVisual = (h) => DO_ELEMENTO[h.elemento] ?? DO_ELEMENTO.physical;

/**
 * O estilo de uma gema: `{ visual, motivo }`. `h` = `{ en, tags, arquetipo, elemento, ataque, buff }`. `base`: o estilo da gema de base
 * (as Vaal e as transfiguradas usam o da base quando o nome delas não diz outra coisa).
 */
export function estiloDaGema(h) {
  const en = String(h.en ?? '');
  const semVaal = en.replace(/^Vaal /i, '');
  for (const [re, fazer] of REGRAS) {
    if (!fazer || !re.test(semVaal)) continue;
    const r = fazer();
    const v = completar(structuredClone(r.visual), elementoVisual(h), h);
    if (/^vaal /i.test(en)) v.lancamento ??= ef(E.redemoinhoRoxo);
    return { visual: v, motivo: r.motivo };
  }
  const el = elementoVisual(h);
  const v = completar({}, el, h);
  if (/^vaal /i.test(en)) v.lancamento ??= ef(E.redemoinhoRoxo);
  const NOME = { fire: 'fogo', ice: 'gelo', energy: 'raio', chaos: 'caos', physical: 'físico' };
  return { visual: v, motivo: `${h.tags.includes('Arco') ? 'flecha de ' : ''}${NOME[h.elemento] ?? 'físico'} (${h.arquetipo ?? 'genérico'})` };
}
