// A revisão do LOOP DE MAPAS (27/10, commit 2e200c69): os achados corrigidos.
//   - a caçada trocada sem passar pela saída (o juntar da party): o loop não fica "pendente" para sempre (`MapasDispositivo.conferirLoop`,
//     que a sessão chama a cada tique) — você em outra caçada, o loop para; a pausa do concluído acabou na cidade, o próximo abre;
//   - a saída que não é decisão do jogador (o mapa não carregou, o erro do servidor) não para o loop;
//   - a tela aberta redesenha quando o loop muda (`assinaturaDoDispositivo`, na assinatura da mensagem `campanha`);
//   - a ausência que acaba num pedaço da consolidação (a fila do loop terminou offline) chega ao login com o relatório;
//   - a pausa do último da fila não diz "Abrindo o próximo mapa…"; o "Abrir mapa" trava com o loop rodando; o aviso do fim se dispensa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

// ---------------------------------------------------------------- um DOM mínimo (o mesmo de `mapas-abas-loop.test.mjs`)
class No {
  constructor(tag) {
    this.tag = tag;
    this.filhos = [];
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.attrs = {};
    this.hidden = false;
    this.disabled = false;
    this.texto = '';
    this.classList = { add: (c) => (this.className = `${this.className} ${c}`.trim()), remove: () => {}, toggle: () => {} };
  }
  append(...fs) {
    for (const f of fs) this.filhos.push(f);
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  get firstChild() {
    return this.filhos[0] ?? null;
  }
  set textContent(t) {
    this.filhos = [];
    this.texto = String(t);
  }
  get textContent() {
    return this.texto + this.filhos.map((f) => (f instanceof No ? f.textContent : f.data ?? '')).join('');
  }
  todos() {
    return [this, ...this.filhos.filter((f) => f instanceof No).flatMap((f) => f.todos())];
  }
  achar(classe) {
    return this.todos().filter((n) => ` ${n.className} `.includes(` ${classe} `));
  }
}
No.prototype.nodeType = 1;
globalThis.document = {
  createElement: (tag) => new No(tag),
  createElementNS: (_, tag) => new No(tag),
  createTextNode: (data) => ({ data, nodeType: 3 }),
};

const { assinaturaDoDispositivo } = await import('../frontend/client/src/mapas-grupos.mjs');
const { desenharDispositivo, esquecerMemoria } = await import('../frontend/client/src/mapas-dispositivo.mjs');

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const MapaAberto = await import('../systems/itens-poe/mapa-aberto.mjs');
const MapasLoop = await import('../systems/itens-poe/mapas-loop.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

/** O personagem dos testes de mapas: a campanha até o Ato 10, vida que não acaba e um Machado Vaal. */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  return e;
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
const normal = (tier) => Jogo.mapaSorteado(tier, { raridade: 'normal' });
const chave = (peca) => MapasLoop.chaveDoMapa(peca);
const semDrops = (e) => (e.pouch = e.pouch.filter((p) => !Mapas.ehMapa(p)));
/** Limpa o mapa da caçada e anda uns tiques: o loop fica na PAUSA do concluído (o próximo ainda não abriu). */
function ate_a_pausa(e, relogio) {
  for (const m of todos(e)) m.hp = 0;
  for (let i = 0; i < 3; i++) Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
  semDrops(e);
}
/** A caçada de outra pessoa, como a party a põe no lugar (`juntar`: `estado.hunt` trocado direto, sem `guardarAoSair`). */
const outraCacada = () => ({ huntId: 'a-de-outro', modo: 'auto', z: 7, pos: { x: 1, y: 1, dir: 2 }, monstros: [] });

// ---------------------------------------------------------------- a caçada trocada sem passar pela saída (média)

test('loop: na pausa do concluído, a party troca a caçada (juntar) — o loop para no próximo tique e não trava o "Iniciar loop"', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  const relogio = { agora: Date.now() };
  ate_a_pausa(e, relogio);
  assert.equal(e.mapas.loop.pendente, true, 'na pausa do concluído');
  // O líder entra numa caçada e o "seguir o líder" puxa este: a caçada da pausa some sem chegar ao fim dela.
  e.hunt = outraCacada();
  assert.equal(MapasLoop.semCacada(e), 'parar');
  const aviso = Dispositivo.conferirLoop(e);
  assert.match(aviso, /outra caçada: o loop de mapas parou/);
  assert.equal(e.mapas.loop, null, 'o loop não fica "pendente" para sempre');
  assert.match(e.mapas.loopFim.motivo, /outra caçada/);
  assert.equal(e.mapas.loopFim.feitos, 1);
  assert.equal(Dispositivo.conferirLoop(e), null, 'uma vez só');
  // De volta à cidade, um loop novo começa (antes: "O loop de mapas já está rodando").
  e.hunt = null;
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  assert.equal(e.hunt?.mapa?.id, e.mapas.loop.atual.mapaId);
});

test('loop: puxado pela party NO MEIO do mapa do loop — o loop para (antes ficava "esperando a volta" sem aviso); morrer não', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  assert.equal(Dispositivo.conferirLoop(e), null, 'no mapa do loop: tudo no lugar');
  // Morreu com portal sobrando: na cidade, o loop espera a volta (nada muda).
  MapaAberto.guardarAoSair(e, { morreu: true });
  e.hunt = null;
  assert.equal(Dispositivo.conferirLoop(e), null);
  assert.ok(e.mapas.loop);
  // Voltou ao mapa e a party o puxou para a caçada de outro.
  assert.ok(Dispositivo.voltar(e, { mode: 'auto' }).ok);
  assert.equal(Dispositivo.conferirLoop(e), null);
  e.hunt = outraCacada();
  assert.match(Dispositivo.conferirLoop(e), /outra caçada/);
  assert.equal(e.mapas.loop, null);
  assert.ok(e.mapas.aberto, 'o mapa continua aberto (a volta é pelo Dispositivo)');
});

test('loop: a pausa do concluído acabou na CIDADE antes da hora (voltou com o líder) — o próximo da fila abre', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  const relogio = { agora: Date.now() };
  const primeiro = e.hunt.mapa.id;
  ate_a_pausa(e, relogio);
  // `voltarComOLider`: `estado.hunt = null` direto, sem a saída e sem o fim da pausa.
  e.hunt = null;
  assert.equal(MapasLoop.semCacada(e), 'seguir');
  assert.match(Dispositivo.conferirLoop(e), /Loop de mapas: .*\(2 de 3\)/);
  assert.ok(e.hunt?.mapa && e.hunt.mapa.id !== primeiro, 'o segundo abriu');
  assert.equal(e.mapas.loop.atual.mapaId, e.hunt.mapa.id);
  assert.equal(e.mapas.loop.seguir, true, 'a sessão traz a party que segue o líder');
});

// ---------------------------------------------------------------- a saída que não é decisão do jogador (baixa)

test('loop: o mapa que não carregou a tempo e a saída por erro do servidor não param o loop (ele espera a volta)', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2)];
  e.inventory.push(...p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  // `desistirDaEntrada` → `Cacadas.sair(estado, { manterLoop: true })`.
  Cacadas.sair(e, { manterLoop: true });
  assert.ok(e.mapas.loop, 'o loop continua');
  assert.equal(e.mapas.aberto.portais, 6, 'sem gastar portal');
  assert.equal(Dispositivo.conferirLoop(e), null, 'fora do mapa, esperando a volta');
  // O erro do servidor (`morrerNaHunt({ real: false })` → `guardarAoSair({ morreu: false, manterLoop: true })`).
  assert.ok(Dispositivo.voltar(e, { mode: 'auto' }).ok);
  MapaAberto.guardarAoSair(e, { morreu: false, manterLoop: true });
  e.hunt = null;
  assert.ok(e.mapas.loop);
  assert.equal(e.mapas.aberto.portais, 6);
  // Sair por conta própria continua parando.
  assert.ok(Dispositivo.voltar(e, { mode: 'auto' }).ok);
  Cacadas.sair(e);
  assert.equal(e.mapas.loop, null);
  assert.match(e.mapas.loopFim.motivo, /saiu do mapa/);
});

// ---------------------------------------------------------------- a tela redesenha quando o loop muda (média)

test('tela: a assinatura da mensagem "campanha" muda com o loop (parar, o N de M, o fim) e com o mapa aberto', { skip: SEM }, () => {
  const e = personagem();
  const p = [normal(2), normal(2), normal(2)];
  e.inventory.push(...p);
  const assinar = () => JSON.stringify(assinaturaDoDispositivo(Dispositivo.paraTela(e)));
  const antes = assinar();
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  const rodando = assinar();
  assert.notEqual(rodando, antes, 'o loop começou (e o mapa abriu)');
  assert.equal(assinar(), rodando, 'nada mudou: a mesma assinatura (sem redesenho à toa)');
  // O "Parar loop": o mapa aberto continua, só o loop muda — antes a tela ficava com "Loop: 1 de 3" e o botão travado.
  assert.ok(Dispositivo.pararLoop(e).ok);
  const parado = assinar();
  assert.notEqual(parado, rodando);
  // O aviso do fim dispensado também redesenha.
  assert.ok(Dispositivo.dispensarFimDoLoop(e).ok);
  assert.notEqual(assinar(), parado);
  assert.equal(assinaturaDoDispositivo(null), null);
  // O progresso: concluir um mapa do loop muda a assinatura.
  Dispositivo.abandonar(e);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p[0]) }] }).ok);
  const um = assinar();
  ate_a_pausa(e, { agora: Date.now() });
  assert.notEqual(assinar(), um, 'concluído: o "N de M" muda');
});

test('tela: com o loop na pausa do concluído (sem mapa aberto), o "Abrir mapa" trava; na pausa do último não diz "Abrindo o próximo"', () => {
  esquecerMemoria();
  const naTela = { onde: 'inventory', indice: 0, assinatura: 'a3', chave: 'b', id: 7_700_003, tier: 3, nivel: 70, raridade: 'normal', nome: 'Mapa (Nível 3)', peca: { id: 7_700_003, poe: { mapa: { linhas: [] } } } };
  const TIERS = Array.from({ length: 16 }, (_, i) => ({ tier: i + 1, nivel: 68 + i }));
  const desenhar = (mapas) => {
    const enviados = [];
    const body = new No('div');
    desenharDispositivo(body, {
      mapas: { liberado: true, ato: 10, portais: 6, aberto: null, estatisticas: {}, tiers: TIERS, ...mapas },
      h: { send: (m) => enviados.push(m), itemCanvas: (id) => Object.assign(new No('canvas'), { idDoItem: id }), tipFor: () => {}, voltarParaCampanha: () => {}, fechar: () => {} },
    });
    return { body, enviados };
  };
  const pausa = { ativo: true, feitos: 3, total: 8, numero: 4, atual: null, pendente: true, restam: 5, grupos: [{ chave: 'b', rotulo: 'T3 Normal ×8' }], fim: null };
  const t = desenhar({ mapas: [naTela], loop: pausa });
  const abrir = t.body.achar('mp-abrir')[0];
  assert.equal(abrir.disabled, true, 'abrir à mão encerraria o loop');
  assert.match(abrir.textContent, /Loop rodando/);
  assert.match(t.body.achar('mp-loop')[0].textContent, /Abrindo o próximo mapa/);
  const ultimo = desenhar({ mapas: [naTela], loop: { ...pausa, feitos: 3, total: 3, numero: 3, restam: 0 } });
  assert.doesNotMatch(ultimo.body.achar('mp-loop')[0].textContent, /Abrindo o próximo/);
  assert.match(ultimo.body.achar('mp-loop')[0].textContent, /Último mapa concluído/);
  // Sem loop, o "Abrir mapa" volta.
  assert.equal(desenhar({ mapas: [naTela] }).body.achar('mp-abrir')[0].disabled, false);
  // O aviso do fim: com quando e o "×" que dispensa.
  const fim = desenhar({ mapas: [naTela], loop: { ativo: false, fim: { motivo: 'Você parou o loop.', feitos: 2, concluiu: false, em: Date.now() - 90_000 } } });
  assert.match(fim.body.achar('mp-loop-fim')[0].textContent, /Você parou o loop\.há 1min 30s/);
  fim.body.achar('mp-loop-fim-x')[0].onclick();
  assert.deepEqual(fim.enviados.at(-1), { t: 'dispensarFimDoLoop' });
  esquecerMemoria();
});

test('servidor: na pausa do último da fila, `restam` é 0 e o aviso não promete o próximo; o fim se dispensa', { skip: SEM }, () => {
  const e = personagem();
  const p = normal(2);
  e.inventory.push(p);
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p) }] }).ok);
  assert.equal(Dispositivo.paraTela(e).loop.restam, 0, 'o aberto é o último');
  ate_a_pausa(e, { agora: Date.now() });
  const tela = Dispositivo.paraTela(e).loop;
  assert.deepEqual([tela.pendente, tela.restam, tela.feitos, tela.total], [true, 0, 1, 1]);
  assert.doesNotMatch(e.avisoDaHunt ?? '', /abre o próximo/);
  // A chave é curta (vai à tela e volta inteira: `criar` corta em 64).
  assert.ok(chave(p).length <= 64);
  Dispositivo.pararLoop(e);
  assert.ok(e.mapas.loopFim);
  Dispositivo.dispensarFimDoLoop(e);
  assert.equal(e.mapas.loopFim, null);
  assert.equal(Dispositivo.paraTela(e).loop, null);
});

// ---------------------------------------------------------------- a ausência que acaba num pedaço da consolidação (baixa)

test('loop offline: a fila acaba num pedaço da consolidação — o login ainda entrega o relatório da ausência', { skip: SEM }, () => {
  const e = personagem();
  const p = normal(1);
  e.inventory.push(p);
  // (com número: "todos" usaria o mapa igual que o chefe derrubar)
  assert.ok(Dispositivo.iniciarLoop(e, { grupos: [{ chave: chave(p), quantos: 1 }] }).ok);
  // Sobram dois monstros de um golpe: offline, ele limpa o mapa (como em `mapas-abas-loop.test.mjs`).
  const sobram = todos(e).filter((m) => m.hp > 0).slice(0, 2);
  for (const m of todos(e)) if (!sobram.includes(m)) m.hp = 0;
  for (const m of sobram) m.hp = m.maxHp = 1;
  semDrops(e);
  const inicio = Date.now();
  e.hunt.offlineDesde = inicio;
  Cacadas.consolidarAusencia(e, PERSONAGEM, inicio + 3 * 3_600_000);
  assert.equal(e.mapas.loop, null, 'a fila acabou offline');
  assert.equal(e.mapas.loopFim?.concluiu, true);
  assert.equal(e.hunt, null, 'sem caçada');
  assert.ok(e.ausenciaSemCacada?.ausencia, 'o fio da ausência ficou guardado');
  // Gravado e lido (como a consolidação faz), e o login fecha a ausência.
  const lido = JSON.parse(JSON.stringify(e));
  Cacadas.consolidarAusencia(lido, PERSONAGEM, inicio + 3 * 3_600_000 + 600_000);
  const volta = Cacadas.simularAusencia(lido, PERSONAGEM, inicio + 4 * 3_600_000);
  assert.ok(volta?.report, 'o relatório da ausência');
  assert.ok(volta.report.kills >= 2, 'com os abates do mapa');
  assert.equal(lido.ausenciaSemCacada, undefined, 'entregue uma vez só');
  assert.equal(Cacadas.simularAusencia(lido, PERSONAGEM, inicio + 4 * 3_600_000), null);
});
