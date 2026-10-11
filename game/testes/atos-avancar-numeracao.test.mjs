// O "AVANÇAR SOZINHO" segue a NUMERAÇÃO do mapa do ato (dono, 10/10: "a numeração dos atos no mapa está bugando para avançar sozinho… se
// tiver errado, arrume em todos os atos"). Antes ele seguia só as ligações da fase atual: pulava números (Ato 1: 1 → 2 → 4) e parava no
// beco com o resto do ato aberto (Ato 2: 1 → 2 → 3, com a 4 aberta). E a numeração dos Atos 1, 2, 3 e 5 tinha fase que só abria depois
// de uma de número maior (Ato 1: a 6, Profundezas Inundadas, depois da 7, Passagem Submersa) — renumerada na ordem do PoE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { personagemDeTeste } from './apoio.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const Campanha = await import('../systems/campanha.mjs');
const Modelo = await import('../systems/atos-modelo.mjs');
const ATOS = Array.from({ length: 10 }, (_, i) => i + 1);
const doArquivo = (n) => JSON.parse(readFileSync(new URL(`../gamedata/atos/poe-ato-${n}.json`, import.meta.url), 'utf8'));

test('nos 10 atos do PoE, o "Avançar sozinho" de quem começa do zero vai 1 → 2 → 3… até a última fase, sem pular nem parar', { skip: soNoOficial('os atos do PoE') }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90, campanha: {} });
  e.campanha = {};
  const dif = Campanha.DIFICULDADES[0];
  for (const ato of ATOS) {
    const fases = Campanha.FASES.filter((f) => f.ato === ato && !f.pular);
    assert.ok(fases.length > 0, `Ato ${ato}`);
    let atual = fases.find((f) => Campanha.faseLiberada(e, dif, f.huntId));
    const visitadas = [];
    while (atual && visitadas.length <= fases.length) {
      visitadas.push(Campanha.numeroNoAto(atual.huntId));
      ((e.campanha[dif] ??= {}).completas ??= []).push(atual.huntId);
      atual = Campanha.proximaParaSeguir(e, dif, atual.huntId);
    }
    assert.deepEqual(visitadas, fases.map((_, i) => i + 1), `Ato ${ato}`);
    Campanha.venceuBoss(e, dif, ato);
  }
});

test('a numeração de cada ato do PoE é um caminho (cada número abre com os de antes feitos); o número do mapa é a ordem da lista', () => {
  for (const n of ATOS) {
    const ato = doArquivo(n);
    assert.deepEqual(ato.fases.map((f) => f.ordem), ato.fases.map((_, i) => i + 1), `Ato ${n}: a ordem é 1, 2, 3… na ordem do arquivo`);
    const avisos = Modelo.validarAto(ato).filter((p) => /só abre depois/.test(p.mensagem));
    assert.deepEqual(avisos.map((p) => p.mensagem), [], `Ato ${n}`);
  }
  // Os que estavam fora de ordem, na ordem do PoE:
  const nomes = (n) => doArquivo(n).fases.map((f) => f.id.replace(/^poe-a\d+-/, ''));
  assert.deepEqual(nomes(1).slice(5, 7), ['the-submerged-passage', 'the-flooded-depths'], 'Ato 1: a Passagem Submersa antes das Profundezas Inundadas');
  assert.deepEqual(nomes(2).slice(3, 7), ['the-crossroads', 'the-fellshrine-ruins', 'the-crypt-level-1', 'the-crypt-level-2'], 'Ato 2: as Ruínas do Santuário Caído antes da Cripta');
  assert.deepEqual(nomes(2).slice(13, 16), ['the-wetlands', 'the-vaal-ruins', 'the-northern-forest'], 'Ato 2: as Terras Inundadas antes das Ruínas Vaal e da Floresta do Norte');
  assert.deepEqual(nomes(3).slice(3, 5), ['the-sewers', 'the-marketplace'], 'Ato 3: os Esgotos antes do Mercado');
  assert.deepEqual(nomes(5).slice(3, 7), ['the-templar-courts', 'the-chamber-of-innocence', 'the-torched-courts', 'the-ruined-square'], 'Ato 5');
});

test('a validação do ato avisa a fase que só abre depois de uma de número maior (o editor mostra antes de publicar)', () => {
  const fase = (id, ordem) => ({ id, nome: id, ordem, huntId: `h-${id}`, tipo: 'hunt-normal', conclusao: { tipo: 'limpar' } });
  const ato = { id: 'ato-teste', nome: 'Ato Teste', inicio: 'f-a', fases: [fase('f-a', 1), fase('f-c', 2), fase('f-b', 3)], conexoes: [{ de: 'f-a', para: 'f-b' }, { de: 'f-b', para: 'f-c' }] };
  const avisos = Modelo.validarAto(ato).filter((p) => /só abre depois/.test(p.mensagem));
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'aviso');
  assert.match(avisos[0].mensagem, /A fase 2 \(f-c\) só abre depois de uma de número maior/);
  ato.fases = [fase('f-a', 1), fase('f-b', 2), fase('f-c', 3)];
  assert.deepEqual(Modelo.validarAto(ato).filter((p) => /só abre depois/.test(p.mensagem)), []);
});

// ---- (Dono, 11/10: "o Avançar sozinho ainda não está funcionando, nem na party nem sozinho".) Quem repetia um ato já feito nunca
// avançava: a próxima era "a menor ainda não feita", e num ato feito não sobra nenhuma. Agora: a SEGUINTE na numeração (feita ou não),
// quando a fase é concluída NESTA rodada — completou agora, a instância limpou (os 100%) ou o botão acabou de ser ligado.
const Cacadas = await import('../systems/cacadas.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const { PERSONAGEM } = await import('./apoio.mjs');
const doAto1 = () => Campanha.FASES.filter((f) => f.ato === 1);
function naFase(numero, { completas = [], modo = 'seguir' } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90, campanha: {} });
  e.campanha = { [Campanha.DIFICULDADES[0]]: { completas: [...completas] } };
  e.hp = e.maxHp = 1e9;
  Cacadas.definirAoCompletarFase(e, { value: modo });
  const r = Cacadas.entrar(e, { huntId: doAto1()[numero - 1].huntId, mode: 'auto', dificuldade: Campanha.DIFICULDADES[0] });
  assert.equal(r.ok, true, r.erro);
  return e;
}
function limpar(e) {
  let agora = Date.now();
  for (const m of e.hunt.monstros) m.hp = 0;
  for (let i = 0; i < 8; i++) Cacadas.tique(e, PERSONAGEM, (agora += 250));
}

test('ato já feito: repetindo a fase 3 com "Avançar sozinho", avança para a 4 (feita ou não) quando a instância limpa — não antes', { skip: soNoOficial('os atos do PoE') }, () => {
  const e = naFase(3, { completas: doAto1().map((f) => f.huntId) });
  assert.equal(Cacadas.faseParaSeguir(e), null, 'ao entrar numa fase já feita, não pula (senão atravessaria o ato inteiro, um tique por fase)');
  limpar(e);
  assert.equal(Instancia.daSala(e.hunt)?.status, 'limpa');
  assert.equal(Cacadas.faseParaSeguir(e)?.huntId, doAto1()[3].huntId, 'a seguinte na numeração');
});

test('ligar o "Avançar sozinho" numa fase completa avança na hora; na última fase do ato fica (o chefe é pelo portal); "Ficar na fase" fica', { skip: soNoOficial('os atos do PoE') }, () => {
  const tudo = doAto1().map((f) => f.huntId);
  const e = naFase(5, { completas: tudo, modo: 'repetir' });
  assert.equal(Cacadas.faseParaSeguir(e), null, 'em "Ficar na fase"');
  limpar(e);
  assert.equal(Cacadas.faseParaSeguir(e), null, 'limpou, mas está em "Ficar na fase": repete');
  Cacadas.definirAoCompletarFase(e, { value: 'seguir' });
  assert.equal(Cacadas.faseParaSeguir(e)?.huntId, doAto1()[5].huntId, 'o clique avança na hora');
  const ultima = naFase(doAto1().length, { completas: tudo, modo: 'repetir' });
  Cacadas.definirAoCompletarFase(ultima, { value: 'seguir' });
  assert.equal(Cacadas.faseParaSeguir(ultima), null);
});

test('do zero: a fase que completa agora avança logo (o chefe da fase morreu), sem esperar ligar nada', { skip: soNoOficial('os atos do PoE') }, () => {
  const e = naFase(1);
  assert.equal(Cacadas.faseParaSeguir(e), null, 'incompleta: fica');
  limpar(e);
  assert.equal(Campanha.faseCompleta(e, Campanha.DIFICULDADES[0], doAto1()[0].huntId), true);
  assert.equal(Cacadas.faseParaSeguir(e)?.huntId, doAto1()[1].huntId);
});
