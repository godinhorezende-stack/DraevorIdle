// Os MODS do PoE com efeito (dono, 07/10: "vários efeitos das armas não estão funcionando, estão como bolinha … n é só arma mas tbm
// equipamentos … colocando igual no PoE"): nenhum afixo, implícito ou mod de frasco das classes que caem fica só "registrado"; as condições
// do PoE (empunhando, recentemente, tags do golpe, anel do lado); os efeitos no acerto, no que o personagem recebe, nos frascos, nas gemas
// e na geração da peça; e as peças antigas refeitas na entrada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');
const { traduzirParte, traduzirMod, NOVOS } = await import('../systems/itens-poe/traduzir.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Controle = await import('../systems/combate/controle.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const FORA_DO_JOGO = new Set(['Trinkets', 'Fishing_Rods', 'Jewels', 'Abyss_Jewels', 'Tinctures']);

/** Um personagem do PoE com uma peça do PoE (com estes atributos já traduzidos) no anel e a arma de uma classe. */
function personagem({ af = {}, arma = 'One_Hand_Swords/Rusted_Sword', escudo = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 40 }), { classePoe: 'Duelist' });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 40, rng: semente(2) })) };
  if (escudo) e.equipment.shield = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: escudo, raridade: 'normal', ilvl: 40, rng: semente(3) }));
  e.equipment.ring = { id: Jogo.idDaBase('Rings/Iron_Ring'), count: 1, poe: { base: 'Rings/Iron_Ring', classe: 'Rings', af, tv: Jogo.VERSAO_DA_TRADUCAO } };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('cobertura: nenhum afixo, implícito ou mod de frasco das classes que caem fica só registrado (o que não existe no jogo é "inerte", com o porquê)', { skip: SEM }, () => {
  const registrados = [];
  for (const [cls, c] of Object.entries(Catalogo.catalogo().classes)) {
    if (FORA_DO_JOGO.has(cls)) continue;
    const ver = (m) => {
      if (/Flasks/.test(cls)) {
        const par = Fr.parametros({ poe: { classe: cls, base: `${cls}/x`, atributos: {}, implicitos: [], prefixos: [{ modelo: m.modelo, valores: (m.faixas ?? []).map((f) => f[0]) }], sufixos: [] } });
        for (const l of par.linhas) if (l.estado === 'registrado') registrados.push(`${cls}: ${l.texto}`);
        return;
      }
      for (const p of String(m.modelo ?? '').split(' / ')) {
        if (!p) continue;
        const r = traduzirParte(p, (m.faixas ?? []).map((f) => f[0]));
        if (r.estado === 'registrado') registrados.push(`${cls}: ${p}`);
        if (r.estado === 'inerte') assert.ok(r.nota, `${p}: o inerte explica por quê`);
      }
    };
    for (const pool of Object.values(c.paginas)) for (const g of [...pool.prefixos, ...pool.sufixos]) for (const t of g.tiers) ver(t);
    for (const b of c.bases ?? []) for (const im of b.implicitos ?? []) ver(im);
  }
  assert.deepEqual(registrados, []);
});

test('todo atributo novo com "combate: true" é lido por algum sistema (nada marcado como efeito sem gancho)', () => {
  const arquivos = [];
  const andar = (d) => { for (const f of readdirSync(d)) { const c = join(d, f); if (statSync(c).isDirectory()) andar(c); else if (f.endsWith('.mjs')) arquivos.push(readFileSync(c, 'utf8')); } };
  andar(new URL('../systems', import.meta.url).pathname);
  const codigo = arquivos.join('\n');
  // Os que o código monta pelo nome (`${el}_res_max`, `frasco_${tipo}`…): o pedaço fixo tem de estar no código.
  const montado = (k) => [/_res_max$/, /^recebe_\w+_como_/, /^(evitar|imune|duracao|efeito)_\w+?(_propria|_proprio)?$/, /^minion_added_/, /^minion_chance_/, /^(added|spell_added)_\w+_dmg_(min|max)$/, /_pen$/, /^phys_conv_/, /^phys_as_extra_/, /^(max|min|duracao|carga)_/, /^(str|dex|int)_inc$/, /^bloqueio_/, /^frasco_/, /^gem_(level|quality)/, /^magnitude_/, /^chance_/, /^dot_multi/, /^(ignite|bleed|poison)_dmg_inc$/].some((re) => re.test(k));
  // As regras da BASE (prefixos/sufixos permitidos, magnitude, um dano só, sem Conjuração, implícitos fixos) o gerador lê do TEXTO do implícito
  // (`gerar.regrasDaBase`), não pelo atributo.
  const peloTexto = new Set(['implicitos_fixos', 'prefixos_permitidos', 'sufixos_permitidos', 'so_dano_de', 'sem_mods_de_conjuracao']);
  const semGancho = Object.entries(NOVOS).filter(([k, a]) => a.combate && !peloTexto.has(k) && !codigo.includes(`'${k}'`) && !codigo.includes(`.${k}`) && !codigo.includes(`"${k}"`) && !montado(k)).map(([k]) => k);
  assert.deepEqual(semGancho, []);
});

test('tradução: condicionais, "reduzida", sinal, lembrete e inerte', () => {
  assert.deepEqual(traduzirParte('Dano Corpo a Corpo aumentado em {0}%', [20]).efeitos, [{ stat: 'dmg_inc@corpo', valor: 20 }]);
  assert.equal(traduzirParte('Dano Corpo a Corpo aumentado em {0}%', [20]).estado, 'novo');
  assert.deepEqual(traduzirParte('Velocidade de Ataque reduzida em {0}%', [10]).efeitos, [{ stat: 'atk_speed', valor: -10 }]);
  assert.deepEqual(traduzirParte('Espaço esquerdo de anel: Efeito de Maldições em Você reduzido em {0}%', [20]).efeitos, [{ stat: 'efeito_maldicao_proprio@anelEsquerdo', valor: -20 }]);
  assert.equal(traduzirParte('(Atributos são Força, Destreza e Inteligência)', []).estado, 'lembrete');
  const luz = traduzirParte('{1}% de aumento do Raio de Iluminação', [0, 10]);
  assert.equal(luz.estado, 'inerte');
  assert.ok(/tela inteira/.test(luz.nota));
  assert.equal(traduzirMod({ modelo: 'Armadura aumentada em {0}% / Recuperação de Atordoamentos e Bloqueios aumentada em {1}%', valores: [20, 11] }).estado, 'novo');
  assert.deepEqual(traduzirParte('+{0} Modificador Prefixo permitido', [1]).efeitos, [{ stat: 'prefixos_permitidos', valor: 1 }]);
});

test('condições de ESTADO na soma: "segurando um Escudo", o anel do lado certo e "Matou Recentemente"', { skip: SEM }, () => {
  const semEscudo = personagem({ af: { 'atk_speed@comEscudo': 30, 'efeito_maldicao_proprio@anelDireito': -20 } });
  assert.equal(Afixos.soma(semEscudo).atk_speed ?? 0, 0);
  assert.equal(Afixos.soma(semEscudo).efeito_maldicao_proprio ?? 0, 0, 'a peça está no anel ESQUERDO: o do lado direito não vale');
  const comEscudo = personagem({ af: { 'atk_speed@comEscudo': 30 }, escudo: 'Shields/Splintered_Tower_Shield' });
  assert.equal(Afixos.soma(comEscudo).atk_speed, 30);
  const e = personagem({ af: { 'dmg_inc@matouRecente': 25 } });
  e.hunt = { clock: 10_000, monstros: [] };
  assert.equal(Afixos.soma(e).dmg_inc ?? 0, 0);
  ModsPoe.marcar(e.hunt, 'matou', 9000);
  Ficha.invalidar(e);
  assert.equal(Afixos.soma(e).dmg_inc, 25);
  e.hunt.clock = 20_000;
  assert.equal(Afixos.soma(e).dmg_inc ?? 0, 0, 'passou de 4 s: não é mais "recentemente"');
});

test('a ficha do golpe: "Dano Corpo a Corpo" só no corpo a corpo, "Crítico com Habilidades de Fogo" só nas de fogo, dano dobrado', { skip: SEM }, () => {
  const e = personagem({ af: { 'dmg_inc@corpo': 40, 'crit_chance_inc@fogo': 100, crit_chance_inc: 0 } });
  const f = Ficha.combate(e);
  const corpo = ModsPoe.fichaDoGolpe(f, ['ataque', 'corpo', 'fisico']);
  const magia = ModsPoe.fichaDoGolpe(f, ['magia', 'fogo', 'elemental']);
  assert.equal(corpo.danoDoElemento.physical - (f.danoDoElemento.physical ?? 0), 40);
  assert.equal(magia.danoDoElemento.physical, f.danoDoElemento.physical);
  assert.ok(Math.abs(magia.critChance - f.critChance * 2) < 1e-9 || magia.critChance === f.critTeto, 'chance × (1 + 100%)');
  assert.equal(corpo.critChance, f.critChance);
  const dobrado = personagem({ af: { chance_dano_dobrado: 100 } });
  assert.equal(ModsPoe.fichaDoGolpe(Ficha.combate(dobrado), ['ataque']).fatorDasCargas, 2 * (Ficha.combate(dobrado).fatorDasCargas ?? 1));
});

test('no acerto: o atordoamento do PoE pelo tamanho do golpe, Mutilar, Cegar, Empalar (solta nos próximos acertos) e a Fúria', { skip: SEM }, () => {
  const e = personagem({ af: { chance_mutilar: 100, chance_cegar: 100, chance_empalar: 100, 'furia_por_acerto@corpo': 2, stun_duration: 100 } });
  e.hunt = { clock: 1000, monstros: [] };
  const f = ModsPoe.fichaDoGolpe(Ficha.combate(e), ['ataque', 'corpo', 'fisico']);
  const bicho = { uid: 'b', name: 'b', hp: 1000, maxHp: 1000, x: 1, y: 1, estados: {} };
  const r = ModsPoe.aoAcertar(e, e.hunt, bicho, f, { dano: 500, fisico: 500, eventos: [], rng: () => 0 });
  assert.ok(r.atordoou, '200 × 500 ÷ 1000 = 100% de chance');
  assert.equal(bicho.estados.atordoado.ate - 1000, 700, '0,35 s × (1 + 100%)');
  assert.ok(bicho.estados.mutilado && bicho.estados.lento.pct === 30 && bicho.estados.cego);
  assert.equal(bicho.estados.empalado.length, 1);
  assert.equal(ModsPoe.furiaAtual(e), 2);
  const r2 = ModsPoe.aoAcertar(e, e.hunt, bicho, f, { dano: 1, fisico: 0, eventos: [], rng: () => 0.99 });
  assert.equal(r2.extra, 50, 'o empalamento solta 10% de 500');
  // Um golpe pequeno (menos de 15% de chance) não atordoa.
  const outro = { uid: 'c', name: 'c', hp: 1000, maxHp: 1000, x: 1, y: 1, estados: {} };
  assert.equal(ModsPoe.aoAcertar(e, e.hunt, outro, f, { dano: 50, fisico: 50, eventos: [], rng: () => 0 }).atordoou, false);
});

test('o que o personagem recebe: conversão do dano recebido, imunidade e duração das afecções, recuperação de atordoamento, Reflexo e Recoup', { skip: SEM }, () => {
  const e = personagem({ af: { recebe_fire_como_ice: 50, imune_congelamento: 1, stun_recovery: 100, evitar_incendio: 100, reflect_phys_melee: 30, recoup_life: 40 } });
  const f = Ficha.combate(e);
  const prot = { fire: 0, ice: 75 };
  assert.equal(ModsPoe.fatorDaResistenciaRecebida(f, 'fire', prot), 0.5 * 0.25 + 0.5 * 1);
  assert.equal(ModsPoe.controleNoJogador(f, 'congelado').evitou, true);
  assert.equal(ModsPoe.controleNoJogador(f, 'atordoado', () => 0.99).duracaoFator, 0.5);
  e.hunt = { clock: 0, monstros: [], efeitosDoJogador: {} };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  assert.equal(ModsPoe.dotNoJogador(e.hunt, { tipo: 'queimadura', total: 100 }, 0), null, '100% de evitar Incêndio');
  const bicho = { uid: 'b', name: 'b', hp: 100, maxHp: 100, x: 0, y: 0 };
  e.maxHp = 1000; e.hp = 500;
  ModsPoe.aoSerAcertado(e, e.hunt, bicho, f, { dano: 100, corpoACorpo: true });
  assert.equal(bicho.hp, 70, 'reflete 30');
  e.hunt.clock = 4000;
  ModsPoe.tique(e, e.hunt, f, 4000, 4000);
  assert.equal(e.hp, 540, 'recupera 40% de 100 em 4 s');
});

test('os frascos: parte instantânea, "Remove Maldições ao usar", recuperação do cinto e o 5º espaço', { skip: SEM }, () => {
  const e = personagem({ af: { frasco_vida_rec: 50 } });
  const base = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Life_Flasks/Small_Life_Flask', raridade: 'normal', ilvl: 10, rng: semente(4) }));
  base.poe.prefixos = [{ modelo: '{2}% da Recuperação aplicada Instantaneamente', valores: [0, 0, 50], texto: '' }, { modelo: 'Remove Maldições ao usar', valores: [], texto: '' }];
  const par = Fr.parametros(base, Ficha.combate(e).afPoe);
  assert.equal(par.instantaneoPct, 50);
  assert.equal(par.aoUsar.removerMaldicao, true);
  assert.equal(par.quantidade, Math.round(Fr.parametros(base).quantidade * 1.5), '+50% da "Recuperação de Vida do Frasco"');
  assert.ok(par.linhas.every((l) => l.estado === 'efeito'));
  e.frascos = [base, null, null, null, null];
  e.maxHp = 1000; e.hp = 100;
  e.hunt = { clock: 0, monstros: [], efeitosDoJogador: {}, pos: { x: 0, y: 0 } };
  Dot.aplicarNoJogador(e.hunt, { tipo: 'maldicao', total: 50 }, 0);
  assert.ok(Fr.usar(e, 0));
  assert.equal(Dot.ativosNoJogador(e.hunt, 0).length, 0, 'a maldição saiu');
  assert.ok(e.hp > 100, 'metade da recuperação na hora');
});

test('a geração respeita as regras da base: Anel Composto (+3 prefixos, −3 sufixos) e anel de um dano só', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  for (let s = 1; s < 40; s++) {
    const p = Gerar.gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: 'Rings/Composite_Ring', raridade: 'raro', ilvl: 84, rng: semente(s) });
    assert.equal(p.sufixos.length, 0);
    assert.ok(p.prefixos.length <= 6);
  }
  const rb = Gerar.regrasDaBase([{ modelo: 'Não gera modificadores de dano que não sejam de fogo', valores: [] }]);
  assert.equal(rb.soDano, 'Fogo');
});

test('as gemas: "+1 ao Nível de todas as Gemas Habilidades de Magias de Fogo" sobe só as magias de fogo; "+N Encaixes" fixos', { skip: SEM }, () => {
  const e = personagem({ af: {} });
  e.equipment.ring.poe.af = { 'gem_level@magia+fogo': 2 };
  const fogo = { tipo: 'ativa', tags: ['poe:Magia', 'poe:Fogo', 'poe:Projétil'] };
  const gelo = { tipo: 'ativa', tags: ['poe:Magia', 'poe:Gelo'] };
  assert.equal(Gemas.extrasDaGemaPoe(e, e.equipment.weapon, fogo).nivel, 2);
  assert.equal(Gemas.extrasDaGemaPoe(e, e.equipment.weapon, gelo).nivel, 0);
  const desmontado = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Unset_Ring', raridade: 'normal', ilvl: 60, rng: semente(5) }));
  assert.equal(desmontado.soquetes?.abertos, 1);
  assert.equal(Gemas.maximoDeSockets(ITEM_CATALOG[desmontado.id], desmontado), 1);
});

test('as peças antigas são refeitas na entrada: o mod que era só registrado ganha o atributo (mods e valores ficam)', { skip: SEM }, () => {
  const e = personagem();
  const p = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Iron_Ring', raridade: 'magico', ilvl: 60, rng: semente(6) }));
  p.poe.sufixos = [{ modelo: 'Duração de Atordoamentos em Inimigos aumentada em {0}%', valores: [20], texto: 'Duração de Atordoamentos em Inimigos aumentada em 20%' }];
  p.poe.af = { 'poe.velho': 1 };
  p.poe.estados = ['registrado'];
  delete p.poe.tv;
  e.inventory = [p];
  assert.equal(Jogo.refazerPecasAntigas(e), 1);
  assert.equal(p.poe.af.stun_duration, 20);
  assert.equal(p.poe.tv, Jogo.VERSAO_DA_TRADUCAO);
  assert.equal(p.poe.sufixos[0].valores[0], 20);
  assert.equal(Jogo.refazerPecasAntigas(e), 0, 'a segunda entrada não mexe mais');
});

test('Vida máxima aumentada em X% (peça) entra no máximo', { skip: SEM }, () => {
  const sem = personagem();
  const com = personagem({ af: { life_inc: 10 } });
  assert.ok(com.maxHp > sem.maxHp);
});
