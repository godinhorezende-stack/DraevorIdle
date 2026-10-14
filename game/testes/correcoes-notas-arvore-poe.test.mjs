// AS CORREÇÕES DAS NOTAS da árvore do PoE (dono, 13/10: "siga na 1" — o relatório do que falta: notas e regras que não batiam com o jogo):
// o Efeito do Buff do Arauto Trovejante (valia em todos os Arautos), a Eficácia da Reserva dele (a gema existe — o montador não carregava as
// gemas), A Apóstata (o Escudo de Energia das armaduras vira Vida; "Itens de Proteção" não é a Proteção/Ward), a Arte do Gladiador (as
// armaduras do jogo tiram movimento), a Magia Sanguínea (o "10% mais Vida" e a nota da reserva) e o "Sem Dano Físico" que refazer a peça devolvia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
const { faixaDoCampo } = await import('../systems/itens/item.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const gerar = (base, unico = null) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: unico ? 'unico' : 'normal', ilvl: 84, rng: () => 0.5, unico }));
/** Um personagem do PoE numa caçada, com `equipamento` vestido. */
function personagem(equipamento = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  e.equipment = { ...(e.equipment ?? {}), ...equipamento };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
/** Aloca o nó (principal, keystone ou ascendência) com um efeito cuja chave casa `re` (o caminho até ele junto). */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos)) ?? arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
  assert.ok(no, `há nó com ${re}`);
  if (no.ascendencia) {
    e.classePoe = arv.ascendencias[no.ascendencia].classe;
    P.garantir(e);
    e.passivas.ascendencia = no.ascendencia;
    Comandos.depoisDeMudar(e);
    // (a opção de escolha — os "Mostruários" da Caçadora de Relíquias: o nó-pai primeiro, depois a opção, sem gastar ponto)
    assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.opcaoDe ?? no.id) }).ok);
    if (no.opcaoDe != null) assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  } else {
    const caminho = P.caminhoAte(e, no.id);
    if (caminho.length > 1) assert.equal(Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) }).feitos, caminho.length - 1);
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
}
/** As linhas da árvore com o texto que casa `re`: `{ t, estado, nota, efeitos }`. */
const linhas = (re) => P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? null, efeitos: o.efeitos, no: n })))).filter((l) => re.test(l.t));
const buffDoArauto = (slug, afPoe) => [G.doSlug(slug).acao, { afPoe, ate: Number.MAX_SAFE_INTEGER, tipo: 'poe-arauto' }];

test('o EFEITO DO BUFF do Arauto Trovejante (o Cravo de Fidelitas e a Espigão de Fidelitas): só nele — antes valia em todos os Arautos', { skip: SEM }, () => {
  const cravo = gerar('Thrusting_One_Hand_Swords/Jagged_Foil', 'Fidelitas_Spike');
  const v = cravo.poe.af['efeito_buff_gema:arauto-trovejante'];
  assert.ok(v > 0, 'a linha do único vai para a gema');
  assert.equal(cravo.poe.af['efeito_buff_gema:arauto'], undefined, 'e não para o grupo dos Arautos');
  const e = personagem({ weapon: cravo });
  e.hunt.buffs = Object.fromEntries([buffDoArauto('Herald_of_Thunder', { energy_dmg: 10 }), buffDoArauto('Herald_of_Ash', { fire_dmg: 10 })]);
  const a = G.adds(e);
  assert.ok(Math.abs(a.energy_dmg - 10 * (1 + v / 100)) < 1e-9, `o Trovejante: ${a.energy_dmg}`);
  assert.equal(a.fire_dmg, 10, 'o Flamejante fica como está');
  // (a ascendência: a mesma linha no nó da Caçadora de Relíquias)
  const [l] = linhas(/^Arauto Trovejante tem o Efeito do Buff aumentado/);
  assert.ok(l.efeitos.some((x) => x.add === 'efeito_buff_gema:arauto-trovejante') && !l.efeitos.some((x) => x.add === 'efeito_buff_gema:arauto'));
});

test('a EFICÁCIA DA RESERVA do Arauto Trovejante (Espigão de Fidelitas): a gema está no jogo — a reserva dele cai à metade, a dos outros não', { skip: SEM }, () => {
  const [l] = linhas(/^Arauto Trovejante tem Eficácia da Reserva de Mana aumentada em/);
  assert.equal(l.estado, 'novo', `${l.estado}: ${l.nota}`);
  const e = personagem();
  alocar(e, /^eficiencia_reserva_gema:arauto-trovejante$/);
  const ficha = Ficha.combate(e);
  const fator = (slug) => Reserva.pedida(e, Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao), { nivel: 1 }, ficha).fator;
  assert.ok(Math.abs(fator('Herald_of_Thunder') - 0.5) < 1e-9, `${fator('Herald_of_Thunder')}`);
  assert.equal(fator('Herald_of_Ash'), 1);
});

test('A APÓSTATA (o único e o nó): o Escudo de Energia das peças de armadura vira Vida (antes dos aumentos de Vida) e sai do Escudo; o peitoral não tem Escudo na base', { skip: SEM }, () => {
  const apostata = gerar('Body_Armours/Cabalist_Regalia', 'The_Apostate');
  assert.equal(apostata.poe.af.es_das_armaduras_em_vida, 1);
  assert.equal(apostata.poe.af.sem_es_da_base, 1, '"Has no Attribute Requirements or Energy Shield (Hidden)" é mod, não lembrete');
  assert.equal(apostata.base?.es, undefined, 'sem o Escudo de Energia da base');
  assert.ok(apostata.poe.estados.every((x) => x !== 'inerte'), `${apostata.poe.estados}`);
  const elmo = gerar('Helmets/Iron_Circlet');
  const [a, b] = faixaDoCampo(elmo, 'es');
  const doElmo = Math.round((a + b) / 2);
  assert.ok(doElmo > 0);
  const com = personagem({ head: elmo, body: apostata });
  // (o mesmo, sem a linha — e com a Vida do elmo como "+N de Vida" fixa: a Vida tem de bater, com os mesmos aumentos)
  const semLinha = structuredClone(apostata);
  delete semLinha.poe.af.es_das_armaduras_em_vida;
  const elmoComVida = structuredClone(elmo);
  elmoComVida.poe.af = { ...elmoComVida.poe.af, life: doElmo };
  const igual = personagem({ head: elmoComVida, body: semLinha });
  assert.equal(Afixos.vidaDasArmaduras(com, Afixos.soma(com)), doElmo);
  assert.equal(com.maxHp, igual.maxHp, 'a Vida do Escudo do elmo, aumentada como o "+N de Vida"');
  // (sem elmo nenhum: o personagem de teste vem com um elmo próprio)
  const semElmo = personagem({ head: null, body: apostata });
  assert.equal(Ficha.combate(com).energyShield, Ficha.combate(semElmo).energyShield, 'o Escudo do elmo não entra no Escudo');
  const semApostata = personagem({ head: elmo, body: semLinha });
  assert.ok(Ficha.combate(semApostata).energyShield > Ficha.combate(com).energyShield, 'sem a linha, o elmo dá Escudo');
  // (a linha da árvore: era a nota da Proteção/Ward)
  const [l] = linhas(/Itens de Proteção Equipados$/);
  assert.equal(l.estado, 'novo');
  assert.ok(l.efeitos.some((x) => x.add === 'es_das_armaduras_em_vida'));
});

test('a ARTE DO GLADIADOR: as armaduras tiram movimento (a base do peitoral e do escudo) e "Penalidades de Movimento das Armaduras são Ignoradas" tira a penalidade', { skip: SEM }, () => {
  const placa = gerar('Body_Armours/Chestplate');
  assert.equal(placa.poe.af.move_speed_armadura, -5, 'a penalidade da base, à parte');
  assert.equal(placa.poe.af.move_speed, undefined);
  const mov = (e) => Afixos.soma(e).move_speed ?? 0;
  const nu = personagem();
  const vestido = personagem({ body: placa });
  assert.equal(mov(vestido) - mov(nu), -5, 'sem o nó, a penalidade vale');
  assert.equal(Afixos.soma(vestido).move_speed_armadura, undefined, 'e entra no movimento');
  const nuComNo = personagem();
  alocar(nuComNo, /^ignora_penalidade_armadura$/);
  const vestidoComNo = personagem({ body: placa });
  alocar(vestidoComNo, /^ignora_penalidade_armadura$/);
  assert.equal(mov(vestidoComNo), mov(nuComNo), 'com a Arte do Gladiador, a penalidade some');
  const [l] = linhas(/^Penalidades de Movimento das Armaduras são Ignoradas$/);
  assert.equal(l.estado, 'novo', `${l.nota}`);
});

test('o "SEM DANO FÍSICO" do único continua depois de refazer a peça (a qualidade, as moedas, a versão da tradução) — antes, o dano físico da base voltava', { skip: SEM }, () => {
  const cravo = gerar('Thrusting_One_Hand_Swords/Jagged_Foil', 'Fidelitas_Spike');
  assert.equal(cravo.poe.af.arma_sem_fisico, 1);
  assert.deepEqual(cravo.base.attack, [0, 0]);
  cravo.poe.qualidade = 20;
  J.recalcular(cravo);
  assert.deepEqual(cravo.base.attack, [0, 0], 'refeita, sem o físico da base');
  // (uma arma comum, refeita com qualidade: o físico × 1,2)
  const foil = gerar('Thrusting_One_Hand_Swords/Jagged_Foil');
  const [a, b] = foil.base.attack;
  foil.poe.qualidade = 20;
  J.recalcular(foil);
  assert.deepEqual(foil.base.attack, [Math.round(a * 1.2), Math.round(b * 1.2)]);
});

test('a MAGIA SANGUÍNEA igual ao PoE: o "10% mais Vida Máxima" multiplica (`life_more`), a mana some, e as linhas sem a nota errada da reserva', { skip: SEM }, () => {
  const [no] = P.arvore().nos.filter((n) => n.tipo === 'keystone' && n.nomeEn === 'Blood Magic');
  assert.ok(no.efeitos.some((x) => x.add === 'life_more' && x.valor === 10), JSON.stringify(no.efeitos));
  assert.ok(!no.efeitos.some((x) => x.stat === 'life'), 'não mais como "aumentada"');
  assert.ok(no.estados.filter((x) => x !== 'nota').every((x) => x === 'equivalente'), `${no.estados}`);
  assert.equal(no.notas, undefined, 'a keystone decide as linhas: sem a nota da regra larga da reserva');
  assert.equal(no.keystone.nota, undefined);
  const e = personagem();
  alocar(e, /^life_more$/);
  assert.equal(P.efeitos(e).adds.life_more, 10);
  assert.equal(e.maxMana, 0, 'Remove toda a mana');
});

test('as NOTAS que não batiam: as gemas que estão no catálogo (sem combate) e as que não criam cadáveres; o mod oculto não é lembrete', { skip: SEM }, () => {
  const nota = (re) => linhas(re)[0]?.nota ?? '';
  assert.match(nota(/^Portador da Praga/), /Infestador .* está no catálogo, mas ainda não tem comportamento de combate/);
  assert.match(nota(/Suportadas por Feiticeiro/), /Feiticeiro .* está no catálogo, mas ainda não tem comportamento de combate/);
  assert.match(nota(/^Profanar e Desenterrar/), /estão no jogo, mas ainda não criam cadáveres/);
  const oculto = traduzirParte('Has no Attribute Requirements or Energy Shield (Hidden)', []);
  assert.deepEqual(oculto.efeitos.map((x) => x.stat), ['sem_es_da_base']);
  assert.equal(traduzirParte('(Recentemente se refere aos últimos 4 segundos)', []).estado, 'lembrete', 'o lembrete continua lembrete');
});
