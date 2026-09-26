// O banco de ouro (o Banker da praça e o clique na carteira). Funções puras
// sobre `estado` — quem manda a resposta é `sessao.mjs`. (`nucleo/banco.mjs` é
// o banco de DADOS; este é o do jogo.)
//
// As regras são as que o próprio client do original escreve na tela
// (`renderBank`, panels.mjs — idêntico no site ao vivo em 2026-09-24):
//  - `{t:'bank', action:'deposit'|'withdraw', amount}` move entre o bolso
//    (`gold`, "carregando") e o banco (`bank`, "no banco");
//  - `{t:'bank', action:'transfer', name, amount}` "sai do seu saldo no banco e
//    entra no banco dele" — nunca do bolso;
//  - "a morte não tira nada daqui"; morrer custa 20% do ouro CARREGADO
//    (`ouroFracao: 0.2` no `blessings` real capturado), com bênção ou sem.
//
// As RESPOSTAS foram medidas no servidor original (2026-09-24, comandos
// mandados direto no socket de um personagem de level 400):
//  - toda resposta é um `notice` no `state` — inclusive os erros; o original
//    nunca manda `{t:'error'}` para o banco;
//  - a quantia é truncada (1.5 deposita 1) e LIMITADA ao saldo: pedir mais do
//    que se tem move tudo o que há ("Sacou 25426195 gold"), não dá erro;
//  - zero, negativo, texto que não é número, ou nada a mover depois do limite:
//    "valor inválido". Ação desconhecida também responde "valor inválido";
//  - o número sai cru, sem separador de milhar: "Depositou 25819325 gold";
//  - transferência: a quantia é conferida ANTES do nome (Biro com 0 →
//    "valor inválido"); nome vazio ou inexistente → "personagem não
//    encontrado"; o próprio nome → "você não pode transferir para si mesmo".
//    A mensagem de SUCESSO da transferência não foi capturada (não dava para
//    testar sem mover ouro de verdade para outra conta) — a daqui segue o
//    mesmo molde de "Depositou"/"Sacou".

export const FRACAO_DO_OURO_NA_MORTE = 0.2;

/** O Banker, como o servidor original responde ao `falarComNpc` (capturado em `api-mapeada/servidor/npc-naji.json`). */
export const FALA_DO_BANQUEIRO = 'Bem-vindo ao banco de Ravox. Deposite antes de sair para caçar.';

const INVALIDO = { ok: true, notice: 'valor inválido' };
const aviso = (notice) => ({ ok: true, notice });

/** Inteiro positivo pedido, ou null. */
function quantia(amount) {
  const n = Math.floor(Number(amount));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function depositar(estado, { amount }) {
  const pedido = quantia(amount);
  const n = pedido && Math.min(pedido, estado.gold ?? 0);
  if (!n) return INVALIDO;
  estado.gold -= n;
  estado.bank = (estado.bank ?? 0) + n;
  return aviso(`Depositou ${n} gold`);
}

export function sacar(estado, { amount }) {
  const pedido = quantia(amount);
  const n = pedido && Math.min(pedido, estado.bank ?? 0);
  if (!n) return INVALIDO;
  estado.bank -= n;
  estado.gold = (estado.gold ?? 0) + n;
  return aviso(`Sacou ${n} gold`);
}

/**
 * `destino(nome)` (dado pela sessão) acha o outro personagem e devolve
 * `{ id, nome, estado, gravar }` — o `estado` vivo se ele estiver no jogo, o
 * gravado se não —, ou `null`. Aqui só a regra: conferir e mover o ouro.
 */
export function transferir(estado, { name, amount }, eu, destino) {
  const pedido = quantia(amount);
  if (!pedido) return INVALIDO;
  const nome = String(name ?? '').trim();
  const outro = nome ? destino(nome) : null;
  if (!outro) return aviso('personagem não encontrado');
  if (outro.id === eu.id) return aviso('você não pode transferir para si mesmo');
  if (!outro.estado?.vocation) return aviso('o destinatário precisa ter vocação');
  const n = Math.min(pedido, estado.bank ?? 0);
  if (!n) return INVALIDO;
  estado.bank -= n;
  outro.estado.bank = (outro.estado.bank ?? 0) + n;
  outro.gravar();
  return aviso(`Transferiu ${n} gold para ${outro.nome}`);
}

export function comando(estado, m, eu, destino) {
  if (m.action === 'deposit') return depositar(estado, m);
  if (m.action === 'withdraw') return sacar(estado, m);
  if (m.action === 'transfer') return transferir(estado, m, eu, destino);
  return INVALIDO;
}

/** Morrer custa 20% do ouro carregado — o do banco fica. Devolve quanto saiu. */
export function cobrarMorte(estado) {
  const perdido = Math.round((estado.gold ?? 0) * FRACAO_DO_OURO_NA_MORTE);
  estado.gold = (estado.gold ?? 0) - perdido;
  return perdido;
}
