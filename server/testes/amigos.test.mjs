// Amigos e perfil, no formato do original (api-mapeada/captura-social-0926/):
// a lista `{amigos, pedidos, enviados, max, notice}` e o perfil de alguém.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../nucleo/banco.mjs';
import * as Amigos from '../sistemas/amigos.mjs';

const ler = (n) => JSON.parse(readFileSync(new URL(`../../api-mapeada/captura-social-0926/${n}`, import.meta.url), 'utf8'));
const CONTA = 'conta-teste-amigos';
const NOMES = ['Amigotesteum', 'Amigotestedois'];

B.db.prepare('INSERT OR IGNORE INTO contas (id, email, senha, criada_em) VALUES (?, ?, ?, ?)').run(CONTA, 'amigos@teste.local', 'x', Date.now());
for (const [i, nome] of NOMES.entries()) {
  B.db.prepare('DELETE FROM personagens WHERE nome = ?').run(nome);
  const estado = { vocation: i ? 'druid' : 'knight', level: 50 + i, outfit: { type: 131, head: 78, body: 88, legs: 58, feet: 76, addons: 0, mount: 0 } };
  B.db.prepare('INSERT INTO personagens (id, conta, nome, vocacao, sexo, criado_em, estado) VALUES (?, ?, ?, ?, ?, ?, ?)').run(`id-${nome}`, CONTA, nome, estado.vocation, 'male', Date.now(), JSON.stringify(estado));
}
after(() => {
  for (const n of NOMES) B.db.prepare('DELETE FROM amizades WHERE de = ? OR para = ?').run(n, n);
  B.db.prepare('DELETE FROM personagens WHERE conta = ?').run(CONTA);
  B.db.prepare('DELETE FROM contas WHERE id = ?').run(CONTA);
});

test('lista vazia: igual à do original', async () => {
  const { t, amigos, pedidos, enviados, max, notice } = ler('friends-list.json');
  assert.deepEqual(await Amigos.lista(NOMES[0]), { t, amigos, pedidos, enviados, max, notice });
});

test('pedir, aceitar, tirar — e os erros', async () => {
  const [um, dois] = NOMES;
  let r = await Amigos.comando(um, { action: 'add', name: dois.toLowerCase() });
  assert.deepEqual(r.enviados.map((p) => p.name), [dois]);
  assert.deepEqual((await Amigos.lista(dois)).pedidos.map((p) => p.name), [um]);
  assert.match((await Amigos.comando(um, { action: 'add', name: dois })).message, /já pediu/);
  assert.match((await Amigos.comando(um, { action: 'add', name: um })).message, /si mesmo/);
  assert.match((await Amigos.comando(um, { action: 'add', name: 'Ninguemaqui' })).message, /não existe ninguém chamado/);
  r = await Amigos.comando(dois, { action: 'accept', name: um });
  assert.deepEqual(r.amigos, [{ name: um, online: false, vocation: 'knight', vocationName: 'Knight', level: 50, hunt: null }]);
  assert.deepEqual((await Amigos.lista(um)).amigos.map((p) => p.name), [dois]);
  r = await Amigos.comando(um, { action: 'remove', name: dois });
  assert.deepEqual([r.amigos, (await Amigos.lista(dois)).amigos], [[], []]);
});

test('pedir a quem já te pediu vira amizade; recusar apaga o pedido', async () => {
  const [um, dois] = NOMES;
  await Amigos.comando(um, { action: 'add', name: dois });
  assert.equal((await Amigos.comando(dois, { action: 'add', name: um })).amigos.length, 1);
  await Amigos.comando(um, { action: 'remove', name: dois });
  await Amigos.comando(um, { action: 'add', name: dois });
  await Amigos.comando(dois, { action: 'decline', name: um });
  assert.deepEqual([(await Amigos.lista(um)).enviados, (await Amigos.lista(dois)).pedidos], [[], []]);
});

test('perfil: os campos do original (Biro, offline: sem hunt, Bronze, sem guilda)', async () => {
  const original = ler('perfil-Biro.json').perfil;
  const nosso = (await Amigos.perfil(NOMES[1])).perfil;
  assert.deepEqual(Object.keys(nosso).sort(), Object.keys(original).sort());
  assert.deepEqual(nosso.patente, original.patente);
  assert.deepEqual([nosso.online, nosso.cacando, nosso.hunt, nosso.guilda], [false, false, null, null]);
  assert.equal((await Amigos.perfil('Ninguemaqui')).message, 'não existe ninguém chamado Ninguemaqui');
});
