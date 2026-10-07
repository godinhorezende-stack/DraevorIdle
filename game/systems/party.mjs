// Party — o time (`grupo`) e a caçada em grupo (`party`), no formato que o
// client lê (`character.party`, `hunt.party`, `hunt.aliados`,
// `hunt.summonsDoGrupo`, `partyInvite`, `grupoConvite`, `pedidoDeEntrada`) e
// com as regras que ele escreve:
//
// - "Party não é caçada": o grupo se monta primeiro (`grupo convidar/aceitar/
//   recusar/sair/lider/expulsar`); o convite para caçar junto vem depois
//   (`party invite/accept/decline`, ou o contrário: `pedir` + `aceitarPedido`).
// - Tamanho: 2 pessoas + os "Slot de party" da conta (até 5). "A party fica no
//   tamanho da conta com menos slots." E a conta joga com até esse mesmo
//   número de chars ao mesmo tempo (`limiteDeChars`).
// - Na caçada em grupo os bichos são OS MESMOS para todos: quem entrou divide
//   o array de monstros de quem abriu (`Cacadas.entrarNaSala`). Quem abriu é
//   o dono da sala — é ele quem move os bichos e faz renascer; saindo ele, o
//   próximo da sala assume.
// - "Quem vai na frente" (`frente`, escolhido por quem manda na fila, o líder)
//   puxa; os outros seguem a ponta ou quem escolheram ("Andar atrás de"), a
//   `coleira` sqm (1, 2, 3, 5, 7, 9, 12; padrão 5).
// - Level: SEM limite de diferença entre os integrantes (nem para formar a party
//   nem para entrar na caçada de alguém) e SEM exigência de proximidade. A caçada
//   precisa estar LIBERADA para quem entra (o level dela; nas Vip/Instance/Divine,
//   premium e acesso) — exceto na campanha, onde o amigo carrega.
// - Shared Experience: ativa com 2+ na mesma caçada (a mesma sala/instância).
//   A exp do bicho, com o bônus por vocações diferentes ("Mesma vocação +20% ·
//   duas +35% · três +70% · quatro ou mais +100%", criaturas de 20 de exp para
//   cima), é dividida pelo PESO de cada um: nível ^ 1,5 (`party-recompensas.mjs`).
//   O loot: o ouro em partes iguais (o resto roda entre os integrantes) e cada
//   item SORTEADO entre quem pode levar (ver `matarMonstro`, em hunt/combate.mjs);
//   a Boss Task conta para todos, como a task de bicho.
//
// O grupo vive na memória do servidor ("a party dura entre uma caçada e
// outra"); reiniciar o servidor desfaz as parties.
import * as B from '../database/banco.mjs';
import * as Cacadas from './cacadas.mjs';
import * as Promocao from './promocao.mjs';
import * as Amigos from './amigos.mjs';

const CONVITE_MS = 60_000;
const COLEIRAS = [1, 2, 3, 5, 7, 8, 9, 12];
const COLEIRA_MAXIMA = 12;
/** Quanto tempo um chamado de reagrupamento vale, e a que distância se considera que o membro chegou. */
const REAGRUPAR_MS = 60_000;
const REAGRUPAR_PERTO = 2;
/** Um membro INDEPENDENTE parado (sem andar nem ter alvo) por este tempo sai da partilha: seguir ou ficar parado não rende exp (`ativo`). */
const PARADO_MS = 60_000;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const BONUS_POR_VOCACOES = [1, 1.2, 1.35, 1.7, 2];
let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
let varredura = null;
export function ligar(mapa) {
  vivas = mapa;
  if (varredura) return;
  // A cada 30 s: tira quem passou do prazo de desconexão e grava o que mudou (`varrer`).
  varredura = setInterval(() => varrer().catch((e) => console.error('party varrer ->', e.message)), 30_000);
  varredura.unref();
}

/*
 * ---- Desconexão e reinício: a party sobrevive ----
 * Quem sai do jogo NÃO deixa a party na hora: fica `offline` por `GRACE_MS` (volta em qualquer momento do prazo e retoma
 * o lugar, o modo, a coleira e — se era o líder — a liderança). Enquanto isso o próximo online conduz. Passado o prazo, sai.
 * A party é gravada no banco (`parties_salvas`); ao subir o servidor todos voltam como offline por `GRACE_APOS_REINICIO_MS`.
 * A CAÇADA em grupo não sobrevive à queda (cada um segue offline com a cópia dos bichos, como sempre): ao voltar, o
 * convite/pedido de caçada de sempre refaz a sala. Convites e reagrupamentos (curtos, de 60 s) não são gravados.
 */
export const GRACE_MS = 5 * 60_000;
export const GRACE_APOS_REINICIO_MS = 10 * 60_000;
const BIGINT = B.banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER';
const TABELA = process.env.PARTY_TABELA ?? 'parties_salvas'; // (os testes usam uma tabela só deles: vários arquivos de teste dividem o banco)
await B.banco.exec(`CREATE TABLE IF NOT EXISTS ${TABELA} (id INTEGER PRIMARY KEY, dados TEXT NOT NULL, atualizado_em ${BIGINT} NOT NULL);`);
const gravadas = new Map(); // id -> último JSON gravado

const parties = new Map(); // id -> { id, lider, membros:[nome], convites:Map(nome->expira), frente, coleiras:Map, seguir:Map, modo:Map(nome->'seguir'|'independente'), reagrupar:{alvo,ate,cancelou:Set,chegou:Set}|null }
const partyDe = new Map(); // nome -> id
const convitesDeCaca = new Map(); // convidado -> { de, expira }
const pedidos = new Map(); // anfitrião -> { de, expira }
let proximoId = 1;

/** O que vai para o banco de uma party (Maps viram listas; convites e reagrupamento ficam de fora). */
export function serializar(p) {
  return JSON.stringify({ id: p.id, lider: p.lider, liderOriginal: p.liderOriginal ?? null, membros: p.membros, frente: p.frente ?? null, coleiras: [...p.coleiras], seguir: [...p.seguir], modo: [...p.modo], offline: [...p.offline], cartoes: [...p.cartoes] });
}
function novaParty(id, lider) {
  return { id, lider, liderOriginal: null, membros: [lider], convites: new Map(), frente: null, coleiras: new Map(), seguir: new Map(), modo: new Map(), reagrupar: null, offline: new Map(), cartoes: new Map() };
}
/** Grava as que mudaram e apaga as que sumiram. Devolve quantas gravou. */
export async function gravarMudancas(agora = Date.now()) {
  let n = 0;
  for (const p of parties.values()) {
    const json = serializar(p);
    if (gravadas.get(p.id) === json) continue;
    await B.banco.prepare(`INSERT INTO ${TABELA} (id, dados, atualizado_em) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`).run(p.id, json, agora);
    gravadas.set(p.id, json);
    n++;
  }
  for (const id of [...gravadas.keys()]) {
    if (parties.has(id)) continue;
    await B.banco.prepare(`DELETE FROM ${TABELA} WHERE id = ?`).run(id);
    gravadas.delete(id);
    n++;
  }
  return n;
}
let gravando = null;
const agendarGravacao = () => {
  if (gravando) return;
  gravando = setTimeout(() => {
    gravando = null;
    gravarMudancas().catch((e) => console.error('party gravar ->', e.message));
  }, 500);
  gravando.unref();
};

/**
 * No boot: recarrega as parties gravadas. Todos os integrantes voltam OFFLINE, com o prazo de `GRACE_APOS_REINICIO_MS`
 * contado de agora (é o tempo de o servidor ficar fora e as pessoas reconectarem). Party com menos de 2 é descartada.
 */
export async function carregar(agora = Date.now()) {
  const linhas = await B.banco.prepare(`SELECT id, dados FROM ${TABELA} ORDER BY id`).all();
  let n = 0;
  for (const l of linhas) {
    let d;
    try {
      d = JSON.parse(l.dados);
    } catch {
      await B.banco.prepare(`DELETE FROM ${TABELA} WHERE id = ?`).run(l.id);
      continue;
    }
    const membros = (Array.isArray(d.membros) ? d.membros : []).filter((m) => typeof m === 'string' && !partyDe.has(m));
    if (membros.length < 2) {
      await B.banco.prepare(`DELETE FROM ${TABELA} WHERE id = ?`).run(l.id);
      continue;
    }
    const p = novaParty(Number(l.id), membros.includes(d.lider) ? d.lider : membros[0]);
    p.membros = membros;
    p.frente = membros.includes(d.frente) ? d.frente : null;
    for (const [k, v] of d.coleiras ?? []) if (membros.includes(k)) p.coleiras.set(k, v);
    for (const [k, v] of d.seguir ?? []) if (membros.includes(k) && membros.includes(v)) p.seguir.set(k, v);
    for (const [k, v] of d.modo ?? []) if (membros.includes(k) && (v === 'seguir' || v === 'independente')) p.modo.set(k, v);
    for (const [k, v] of d.cartoes ?? []) if (membros.includes(k)) p.cartoes.set(k, v);
    p.liderOriginal = membros.includes(d.liderOriginal) ? d.liderOriginal : null;
    for (const m of membros) p.offline.set(m, agora + GRACE_APOS_REINICIO_MS);
    parties.set(p.id, p);
    for (const m of membros) partyDe.set(m, p.id);
    proximoId = Math.max(proximoId, p.id + 1);
    gravadas.set(p.id, serializar(p));
    n++;
  }
  return n;
}

/** Tira quem passou do prazo de desconexão e grava o que mudou. Chamado a cada 30 s. */
export async function varrer(agora = Date.now()) {
  for (const p of [...parties.values()]) {
    for (const [nome, ate] of [...p.offline]) {
      if (ate > agora || !parties.has(p.id)) continue;
      tirar(p, nome, 'ficou desconectado por muito tempo', { saindoDoJogo: true });
    }
  }
  return gravarMudancas(agora);
}

const sessaoDe = (nome) => vivas.get(nome) ?? [...vivas.values()].find((s) => s.personagem?.nome?.toLowerCase() === String(nome ?? '').toLowerCase()) ?? null;
const nomeDe = (s) => s.personagem?.nome;
const minhaParty = (s) => parties.get(partyDe.get(nomeDe(s))) ?? null;
/*
 * A party mudou: o estado de cada membro e a lista de amigos dele — a janela de
 * Amigos só se redesenha quando chega uma lista nova, e sem isto a linha do
 * amigo que acabou de entrar seguia com o botão "Party" em vez de "na party".
 */
const atualizar = (party) => {
  for (const nome of party?.membros ?? []) {
    if (party.offline?.has(nome)) continue; // offline: não há tela para atualizar
    mandarJa(sessaoDe(nome));
    Amigos.avisar(nome).catch((e) => console.error('amigos avisar', e.message));
  }
};
/** Manda o estado JÁ com o personagem inteiro: a party é campo dele, e sem isto ela chegava até 1 s depois. */
const mandarJa = (s) => {
  if (!s) return;
  s.characterSujo = true;
  s.mandarEstado();
};
const avisar = (s, notice) => s?.enviar({ t: 'notice', notice });

/** Slots comprados pela conta (0 a 3) — do cache síncrono (ver `banco.mjs`'s `melhoriasCache`), não do banco direto: isto roda a cada `mandarEstado`. */
const slotsDaConta = (contaId) => Math.min(3, B.melhoriasCache(contaId)?.slotsDeParty ?? 0);
/** Quantos chars desta conta podem jogar ao mesmo tempo. */
export const limiteDeChars = (contaId) => 2 + slotsDaConta(contaId);
/** O tamanho da party: o da conta com MENOS slots entre os nomes. */
function maximo(nomes) {
  const contas = new Set(nomes.map((n) => sessaoDe(n)?.conta?.id).filter(Boolean));
  return 2 + Math.min(...[...contas].map(slotsDaConta), 3);
}

/** Não há mais limite de diferença de level: sempre `null` (o nome fica porque as chamadas de convite/aceite/entrada passam por aqui). */
const foraDaFaixa = () => null;

// ------------------------------------------------------------------ grupo

export function comandoDoGrupo(s, m) {
  const eu = nomeDe(s);
  const party = minhaParty(s);
  switch (m.action) {
    case 'convidar': {
      const alvo = sessaoDe(m.name);
      if (!alvo) return { ok: false, erro: `${m.name} não está online.` };
      if (alvo === s) return { ok: false, erro: 'Você não pode se convidar.' };
      if (partyDe.has(nomeDe(alvo))) return { ok: false, erro: `${nomeDe(alvo)} já está numa party.` };
      if (party && party.lider !== eu) return { ok: false, erro: 'Só o líder da party convida.' };
      // A faixa de level ANTES de criar a party: recusado, não sobra uma party de um só.
      const longe = foraDaFaixa([...(party?.membros ?? [eu]), nomeDe(alvo)]);
      if (longe) return { ok: false, erro: longe };
      const p = party ?? criar(eu);
      const teto = maximo([...p.membros, nomeDe(alvo)]);
      if (p.membros.length >= teto) return { ok: false, erro: `A party está cheia (${teto} lugares). Mais lugares: "Slot de party", na Store — cada conta precisa ter os seus.` };
      p.convites.set(nomeDe(alvo), Date.now() + CONVITE_MS);
      alvo.enviar({ t: 'grupoConvite', from: eu, expiraEm: Date.now() + CONVITE_MS });
      return { ok: true, notice: `Convite de party enviado para ${nomeDe(alvo)}.` };
    }
    case 'aceitar': {
      if (party) return { ok: false, erro: 'Você já está numa party.' };
      const p = [...parties.values()].find((x) => (x.convites.get(eu) ?? 0) > Date.now());
      if (!p) return { ok: false, erro: 'O convite expirou.' };
      p.convites.delete(eu);
      if (p.membros.length >= maximo([...p.membros, eu])) return { ok: false, erro: 'A party encheu antes de você aceitar.' };
      // Alguém subiu de level entre o convite e o aceite.
      const longe = foraDaFaixa([...p.membros, eu]);
      if (longe) return { ok: false, erro: longe };
      p.membros.push(eu);
      partyDe.set(eu, p.id);
      for (const n of p.membros) if (n !== eu) avisar(sessaoDe(n), `${eu} entrou na party.`);
      atualizar(p);
      return { ok: true, notice: `Você entrou na party de ${p.lider}.` };
    }
    case 'recusar': {
      const p = [...parties.values()].find((x) => x.convites.has(eu));
      if (p) {
        p.convites.delete(eu);
        avisar(sessaoDe(p.lider), `${eu} recusou o convite de party.`);
        if (p.membros.length < 2 && !p.convites.size) desfazer(p);
      }
      return { ok: true };
    }
    case 'sair':
      if (!party) return { ok: false, erro: 'Você não está numa party.' };
      tirar(party, eu, 'saiu da party');
      return { ok: true, notice: 'Você saiu da party.' };
    case 'lider': {
      if (!party || party.lider !== eu) return { ok: false, erro: 'Só o líder passa a liderança.' };
      const novo = party.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase());
      if (!novo) return { ok: false, erro: 'Essa pessoa não está na party.' };
      party.lider = novo;
      for (const n of party.membros) avisar(sessaoDe(n), `${novo} agora lidera a party.`);
      atualizar(party);
      return { ok: true };
    }
    case 'expulsar': {
      if (!party || party.lider !== eu) return { ok: false, erro: 'Só o líder tira alguém da party.' };
      const quem = party.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase());
      if (!quem || quem === eu) return { ok: false, erro: 'Essa pessoa não está na party.' };
      avisar(sessaoDe(quem), `${eu} tirou você da party.`);
      tirar(party, quem, 'foi tirado da party');
      return { ok: true };
    }
    default:
      return { ok: false, erro: 'Ação de party desconhecida.' };
  }
}

function criar(lider) {
  const p = novaParty(proximoId++, lider);
  parties.set(p.id, p);
  agendarGravacao();
  partyDe.set(lider, p.id);
  return p;
}

function desfazer(p) {
  // Sem party não há caçada em grupo: cada um fica com os bichos dele.
  for (const n of p.membros) {
    const h = sessaoDe(n)?.estado?.hunt;
    if (h && Cacadas.salaDe(h) !== h) Cacadas.separar(h);
  }
  for (const n of p.membros) partyDe.delete(n);
  parties.delete(p.id);
  agendarGravacao();
  for (const n of p.membros) {
    mandarJa(sessaoDe(n));
    Amigos.avisar(n).catch((e) => console.error('amigos avisar', e.message));
  }
}

function tirar(p, nome, motivo, { saindoDoJogo = false } = {}) {
  const s = sessaoDe(nome);
  const convidado = s?.estado?.hunt && Cacadas.salaDe(s.estado.hunt) !== s.estado.hunt;
  if (convidado && saindoDoJogo) {
    // Deslogou na caçada de outro: ela segue OFFLINE, só dele, com uma cópia dos bichos.
    Cacadas.separar(s.estado.hunt);
  } else if (convidado) {
    // Saiu da party estando na caçada de outro membro: volta para a cidade.
    s.estado.hunt = null;
    avisar(s, 'Você saiu da caçada da party e voltou para a cidade.');
  } else if (s) {
    antesDeSairDaCacada(s);
  }
  p.membros = p.membros.filter((n) => n !== nome);
  partyDe.delete(nome);
  if (p.frente === nome) p.frente = null;
  // Quem seguia este membro deixa de segui-lo (o follow não anda para uma posição antiga) e é avisado, para escolher outro.
  for (const [seguidor, alvo] of [...p.seguir]) {
    if (seguidor === nome) p.seguir.delete(seguidor);
    else if (alvo === nome) {
      p.seguir.delete(seguidor);
      avisar(sessaoDe(seguidor), `${nome} saiu da party: você deixou de segui-lo. Escolha outro em "Andar atrás de" (por enquanto você segue quem vai na frente).`);
    }
  }
  p.coleiras.delete(nome);
  p.modo.delete(nome);
  p.offline.delete(nome);
  p.cartoes.delete(nome);
  if (p.liderOriginal === nome) p.liderOriginal = null;
  agendarGravacao();
  if (p.reagrupar?.alvo === nome) p.reagrupar = null;
  for (const n of p.membros) avisar(sessaoDe(n), `${nome} ${motivo}.`);
  if (p.lider === nome) p.lider = p.membros[0] ?? null;
  if (!saindoDoJogo) mandarJa(s);
  if (p.membros.length < 2) desfazer(p);
  else atualizar(p);
}

/**
 * Saiu do jogo: sai da caçada em grupo (ela segue offline, só dele, com uma cópia dos bichos) e fica na party como OFFLINE por
 * `GRACE_MS`. Se era o líder, o próximo online conduz até ele voltar.
 */
export function saiuDoJogo(s) {
  const p = minhaParty(s);
  if (!p) {
    if (s.estado?.hunt && Cacadas.salaDe(s.estado.hunt) !== s.estado.hunt) Cacadas.separar(s.estado.hunt);
    return;
  }
  const nome = nomeDe(s);
  const hunt = s.estado?.hunt;
  if (hunt && Cacadas.salaDe(hunt) !== hunt) Cacadas.separar(hunt);
  else antesDeSairDaCacada(s);
  const e = s.estado;
  p.cartoes.set(nome, { level: e?.level ?? 0, vocation: e?.vocation ?? 'none', vocationName: e ? Promocao.nomeDaClasse(e) : null, outfit: e ? olhar(e) : null });
  p.offline.set(nome, Date.now() + GRACE_MS);
  if (p.reagrupar?.alvo === nome) p.reagrupar = null;
  if (p.lider === nome) {
    const proximo = p.membros.find((n) => n !== nome && !p.offline.has(n));
    if (proximo) {
      p.liderOriginal = nome;
      p.lider = proximo;
    }
  }
  for (const n of p.membros) if (n !== nome) avisar(sessaoDe(n), `${nome} desconectou. Se voltar em ${Math.round(GRACE_MS / 60_000)} min, continua na party.`);
  // Todos offline: nada a atualizar na tela de ninguém; o prazo corre e o banco guarda.
  atualizar(p);
  agendarGravacao();
}

/** Entrou (ou reconectou) no jogo: se estava numa party como offline, volta ao lugar dele (e à liderança, se era dele). */
export function entrouNoJogo(s) {
  const nome = nomeDe(s);
  const p = parties.get(partyDe.get(nome));
  if (!p || !p.offline.has(nome)) return false;
  p.offline.delete(nome);
  p.cartoes.delete(nome);
  if (p.liderOriginal === nome) {
    p.lider = nome;
    p.liderOriginal = null;
  }
  for (const n of p.membros) if (n !== nome) avisar(sessaoDe(n), `${nome} voltou para a party.`);
  avisar(s, 'Você voltou para a sua party. Para caçar junto de novo, use o convite de caçada.');
  atualizar(p);
  agendarGravacao();
  return true;
}

// --------------------------------------------------------- caçada em grupo

/**
 * Quem vai deixar a caçada (stopHunt, morte, logout, trocar de hunt): se ele
 * é o dono de uma sala com gente dentro, o próximo da sala assume.
 */
export function antesDeSairDaCacada(s) {
  const hunt = s.estado?.hunt;
  if (!hunt || Cacadas.salaDe(hunt) !== hunt) return;
  const convidados = [...vivas.values()].filter((o) => o !== s && o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === hunt);
  if (!convidados.length) return;
  const [novo, ...resto] = convidados;
  Cacadas.virarDono(novo.estado.hunt);
  for (const o of resto) Cacadas.mudarDeDono(o.estado.hunt, novo.estado.hunt);
  // Quem saiu leva uma CÓPIA dos bichos (a caçada dele segue offline sozinha).
  Cacadas.separar(hunt);
  for (const o of convidados) avisar(o, `${nomeDe(s)} saiu da caçada — ${nomeDe(novo)} segue puxando.`);
}

/**
 * Pode `convidado` entrar na sala de caçada `sala`? `null` = pode; senão, a
 * frase do porquê. Conferido no chamado, no pedido e de novo na entrada (o
 * level muda no meio): a hunt precisa estar LIBERADA para ele — o level dela,
 * e, nas Vip/Instance/Divine, premium e o acesso — e ele precisa caber na
 * faixa de level de quem já está lá.
 */
function motivoParaNaoEntrar(convidado, sala) {
  if (!sala) return 'Essa pessoa não está caçando.';
  if (sala.isBoss) return 'Nessa caçada não dá para entrar.';
  const nome = nomeDe(convidado);
  // A fase da campanha NÃO é conferida aqui: na party, qualquer um entra na
  // caçada do outro (decisão do dono — um amigo pode "carregar" o outro).
  const naSala = [...vivas.values()].filter((o) => o !== convidado && o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala).map(nomeDe);
  return foraDaFaixa([...naSala, nome]);
}

function juntar(convidado, anfitriao) {
  const sala = Cacadas.salaDe(anfitriao.estado?.hunt);
  if (!sala) return { ok: false, erro: `${nomeDe(anfitriao)} não está caçando.` };
  const motivo = motivoParaNaoEntrar(convidado, sala);
  if (motivo) return { ok: false, erro: motivo };
  const naSala = [...vivas.values()].filter((o) => o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala).length;
  const p = minhaParty(convidado);
  if (naSala >= maximo(p?.membros ?? [])) return { ok: false, erro: 'A caçada já está com a party inteira.' };
  // Vip/Instance/Divine: premium, o acesso e o level da porta ANTES de largar a caçada de agora.
  const tranca = Cacadas.podeEntrarNaSala(convidado.estado, sala);
  if (!tranca.ok) return tranca;
  if (convidado.estado.hunt) {
    /*
     * A caçada de antes acaba aqui: o extrato dela vai para ele, como no
     * "Parar". Sem isto o que ela rendeu sumia sem ninguém ver. (Sem aba — um
     * char da conta trazido pela troca de personagem —, quem chamou recebe; ver
     * `chamarOutro`, em sessao.mjs.)
     */
    const h = convidado.estado.hunt;
    if (Cacadas.salaDe(h) !== sala) {
      const report = Cacadas.relatorio(convidado.estado);
      if (report) {
        convidado.enviar({
          t: 'runReport',
          report,
          motivo: `Você saiu de ${Cacadas.nomeDaHunt(h.huntId)} para entrar na caçada de ${nomeDe(anfitriao)}.`,
        });
      }
    }
    antesDeSairDaCacada(convidado);
    convidado.estado.hunt = null;
  }
  // Onde cada um da sala está: quem entra cai numa casa livre (a colisão da caçada em grupo).
  const gente = [...vivas.values()]
    .filter((o) => o !== convidado && o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala)
    .map((o) => ({ ...o.estado.hunt.pos, z: o.estado.hunt.z }));
  const r = Cacadas.entrarNaSala(convidado.estado, sala, gente);
  if (!r.ok) return r;
  for (const o of vivas.values()) if (o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala && o !== convidado) avisar(o, `${nomeDe(convidado)} entrou na caçada.`);
  atualizar(minhaParty(convidado));
  // O líder entrou na caçada de alguém: quem segue o líder vem também.
  if (minhaParty(convidado)?.lider === nomeDe(convidado)) seguirOLider(convidado);
  return { ok: true, notice: `Você entrou na caçada de ${nomeDe(anfitriao)} (${Cacadas.nomeDaHunt(sala.huntId)}).` };
}

export function comandoDaCaca(s, m) {
  const eu = nomeDe(s);
  const p = minhaParty(s);
  const outro = m.name ? sessaoDe(m.name) : null;
  const doMeuGrupo = (o) => o && p && p.membros.includes(nomeDe(o));
  switch (m.action) {
    case 'invite': {
      if (!outro) return { ok: false, erro: `${m.name} não está online.` };
      if (!doMeuGrupo(outro)) return { ok: false, erro: `Chame ${nomeDe(outro)} para a party primeiro (Party → Convidar).` };
      if (!s.estado.hunt) return { ok: false, erro: 'Comece uma caçada para chamar alguém.' };
      const sala = Cacadas.salaDe(s.estado.hunt);
      // Já no chamado: quem chama sabe na hora que o outro não pode vir.
      const motivo = motivoParaNaoEntrar(outro, sala);
      if (motivo) return { ok: false, erro: motivo };
      const tranca = Cacadas.podeEntrarNaSala(outro.estado, sala);
      if (!tranca.ok) return { ok: false, erro: `${nomeDe(outro)}: ${tranca.erro}` };
      convitesDeCaca.set(nomeDe(outro), { de: eu, expira: Date.now() + CONVITE_MS });
      outro.enviar({ t: 'partyInvite', from: eu, hunt: Cacadas.nomeDaHunt(sala.huntId), expiraEm: Date.now() + CONVITE_MS });
      return { ok: true, notice: `Chamado enviado para ${nomeDe(outro)}.` };
    }
    case 'accept': {
      const c = convitesDeCaca.get(eu);
      convitesDeCaca.delete(eu);
      if (!c || c.expira < Date.now()) return { ok: false, erro: 'O chamado expirou.' };
      const host = sessaoDe(c.de);
      if (!host) return { ok: false, erro: `${c.de} saiu do jogo.` };
      return juntar(s, host);
    }
    case 'decline': {
      const c = convitesDeCaca.get(eu);
      convitesDeCaca.delete(eu);
      if (c) avisar(sessaoDe(c.de), `${eu} não quis entrar agora.`);
      return { ok: true };
    }
    case 'pedir': {
      if (!doMeuGrupo(outro)) return { ok: false, erro: 'Essa pessoa não está na sua party.' };
      if (!outro.estado?.hunt) return { ok: false, erro: `${nomeDe(outro)} não está caçando.` };
      const sala = Cacadas.salaDe(outro.estado.hunt);
      const motivo = motivoParaNaoEntrar(s, sala);
      if (motivo) return { ok: false, erro: motivo };
      const tranca = Cacadas.podeEntrarNaSala(s.estado, sala);
      if (!tranca.ok) return tranca;
      pedidos.set(nomeDe(outro), { de: eu, expira: Date.now() + CONVITE_MS });
      outro.enviar({ t: 'pedidoDeEntrada', from: eu, level: s.estado.level, vocation: s.estado.vocation, hunt: Cacadas.nomeDaHunt(outro.estado.hunt.huntId), expiraEm: Date.now() + CONVITE_MS });
      outro.mandarEstado();
      return { ok: true, notice: `Pedido enviado para ${nomeDe(outro)}.` };
    }
    case 'aceitarPedido': {
      const c = pedidos.get(eu);
      pedidos.delete(eu);
      s.mandarEstado();
      if (!c || c.expira < Date.now()) return { ok: false, erro: 'O pedido expirou.' };
      const quem = sessaoDe(c.de);
      if (!quem) return { ok: false, erro: `${c.de} saiu do jogo.` };
      const r = juntar(quem, s);
      if (r.ok) avisar(quem, r.notice);
      return r.ok ? { ok: true } : r;
    }
    case 'recusarPedido': {
      const c = pedidos.get(eu);
      pedidos.delete(eu);
      if (c) avisar(sessaoDe(c.de), `${eu} não deixou entrar agora.`);
      s.mandarEstado();
      return { ok: true };
    }
    case 'entrar': {
      // "Permitir entrar na caçada": quem marcou deixa a party entrar direto, sem pedir.
      if (!doMeuGrupo(outro)) return { ok: false, erro: 'Essa pessoa não está na sua party.' };
      if (!outro.estado?.hunt) return { ok: false, erro: `${nomeDe(outro)} não está caçando.` };
      if (outro.estado.settings?.entrarSemConvite !== true) return { ok: false, erro: `${nomeDe(outro)} não liberou a entrada direta — peça para entrar.` };
      return juntar(s, outro);
    }
    case 'sair':
      return comandoDoGrupo(s, { action: 'sair' });
    case 'frente': {
      if (!p || p.lider !== eu) return { ok: false, erro: 'Só quem manda na fila (o líder) escolhe quem vai na frente.' };
      p.frente = p.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase()) ?? null;
      atualizar(p);
      return { ok: true };
    }
    case 'seguirQuem': {
      if (!p) return { ok: false, erro: 'Você não está numa party.' };
      const alvo = p.membros.find((n) => n.toLowerCase() === String(m.name ?? '').toLowerCase());
      if (alvo === eu) return { ok: false, erro: 'Você não pode seguir a si mesmo.' };
      // Sem ciclo: A→B→C→A deixaria os três parados. Percorre a fila de quem o alvo segue; se voltar a mim, recusa (a regra vale AGORA, na escolha).
      if (alvo) {
        const visto = new Set([eu]);
        for (let n = alvo; n; n = p.seguir.get(n)) {
          if (visto.has(n)) return { ok: false, erro: `Seguir ${alvo} fecharia um círculo (${[...visto, n].join(' → ')}): escolha outra pessoa.` };
          visto.add(n);
        }
        p.seguir.set(eu, alvo);
        p.modo.set(eu, 'seguir');
      } else p.seguir.delete(eu);
      atualizar(p);
      return { ok: true };
    }
    case 'coleira': {
      if (!p) return { ok: false, erro: 'Você não está numa party.' };
      const v = Number(m.valor);
      // Qualquer inteiro de 1 a 12 sqm (Chebyshev, como o resto do jogo); fora disso é recusado, não ajustado em silêncio.
      if (!Number.isInteger(v) || v < 1 || v > COLEIRA_MAXIMA) return { ok: false, erro: `A distância de seguir vai de 1 a ${COLEIRA_MAXIMA} sqm.` };
      p.coleiras.set(eu, v);
      atualizar(p);
      return { ok: true };
    }
    case 'modo': {
      if (!p) return { ok: false, erro: 'Você não está numa party.' };
      if (m.valor !== 'seguir' && m.valor !== 'independente') return { ok: false, erro: 'Modo de movimento inválido.' };
      p.modo.set(eu, m.valor);
      atualizar(p);
      return { ok: true, notice: m.valor === 'independente' ? 'Exploração independente: você não segue ninguém e continua dividindo a exp da party.' : 'Voltou a seguir.' };
    }
    case 'reagrupar': {
      if (!p || p.lider !== eu) return { ok: false, erro: 'Só o líder reagrupa a party.' };
      const ponto = p.membros.find((n) => n.toLowerCase() === String(m.name ?? eu).toLowerCase()) ?? eu;
      const quem = sessaoDe(ponto);
      const minhaSala = s.estado?.hunt ? Cacadas.salaDe(s.estado.hunt) : null;
      if (!minhaSala || !quem?.estado?.hunt || Cacadas.salaDe(quem.estado.hunt) !== minhaSala) return { ok: false, erro: `${ponto} precisa estar na mesma caçada que você.` };
      p.reagrupar = { alvo: ponto, ate: Date.now() + REAGRUPAR_MS, cancelou: new Set(), chegou: new Set() };
      for (const o of naMesmaSala(s)) if (o !== quem && minhaParty(o) === p) avisar(o, `${eu} chamou a party para perto de ${ponto}. Você pode cancelar pelo seu painel.`);
      atualizar(p);
      return { ok: true };
    }
    case 'cancelarReagrupar': {
      if (!p?.reagrupar) return { ok: true };
      if (p.lider === eu) p.reagrupar = null;
      else p.reagrupar.cancelou.add(eu);
      atualizar(p);
      return { ok: true };
    }
    default:
      return { ok: false, erro: 'Ação de party desconhecida.' };
  }
}

// ------------------------------------------------ o que cada tique precisa

/** As sessões na MESMA sala de caçada que `s` (incluindo ele). */
function naMesmaSala(s) {
  const sala = s.estado?.hunt ? Cacadas.salaDe(s.estado.hunt) : null;
  if (!sala) return [];
  return [...vivas.values()].filter((o) => o.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala);
}

/** O membro está jogando de fato? Independente e parado (sem andar nem alvo) por `PARADO_MS` não está; quem segue conta sempre. */
function ativo(o) {
  const p = minhaParty(o);
  if (p?.modo.get(nomeDe(o)) !== 'independente') return true;
  const em = o.estado?.hunt?.atividadeEm;
  return em == null || Date.now() - em <= PARADO_MS;
}

/** Chamado a cada tique da sessão: anda ou tem alvo = atividade (o relógio de `ativo`). Não vai para o banco. */
export function registrarAtividade(s) {
  const h = s.estado?.hunt;
  if (!h) return;
  const antes = h.posAnterior;
  const mexeu = !antes || antes.x !== h.pos.x || antes.y !== h.pos.y || antes.z !== h.z;
  Object.defineProperty(h, 'posAnterior', { value: { x: h.pos.x, y: h.pos.y, z: h.z }, enumerable: false, writable: true, configurable: true });
  if (mexeu || h.alvo != null || h.atividadeEm == null) Object.defineProperty(h, 'atividadeEm', { value: Date.now(), enumerable: false, writable: true, configurable: true });
}

/** A partilha agora: `{ativa, motivo, bonus, vocacoes, faixa, membros:[estado]}`. */
export function partilha(s) {
  // Quem está INDEPENDENTE e parado há `PARADO_MS` (sem andar nem alvo) não entra na partilha: ninguém ganha exp só por estar na sala.
  const juntos = naMesmaSala(s).filter((o) => minhaParty(o) && minhaParty(o) === minhaParty(s) && (o === s || ativo(o)));
  const base = { membros: juntos.map((o) => ({ estado: o.estado, nome: nomeDe(o) })), faixa: null, vocacoes: new Set(juntos.map((o) => o.estado.vocation)).size };
  if (juntos.length < 2) return { ...base, ativa: false, motivo: 'sozinho', bonus: 1 };
  // Sem limite de level e sem proximidade: quem está na mesma sala e ativo participa, esteja onde estiver (a fase é da party inteira).
  return { ...base, ativa: true, motivo: null, bonus: BONUS_POR_VOCACOES[Math.min(4, base.vocacoes)] };
}

/** Quem este membro segue e a quantos sqm (`{pos, coleira}` ou null). */
export function guia(s) {
  const p = minhaParty(s);
  if (!p) return null;
  // Exploração independente: não segue ninguém (nem a ponta).
  if (p.modo.get(nomeDe(s)) === 'independente') return null;
  const juntos = naMesmaSala(s).filter((o) => p.membros.includes(nomeDe(o)));
  if (juntos.length < 2) return null;
  const nomes = juntos.map(nomeDe);
  const ponta = nomes.includes(p.frente) ? p.frente : nomes.includes(p.lider) ? p.lider : Cacadas.salaDe(s.estado.hunt) === s.estado.hunt ? nomeDe(s) : nomes.find((n) => Cacadas.salaDe(sessaoDe(n).estado.hunt) === sessaoDe(n).estado.hunt);
  if (ponta === nomeDe(s)) return null;
  // "Andar atrás de": vale se não fechar círculo; senão, a ponta.
  let alvo = p.seguir.get(nomeDe(s));
  const visto = new Set([nomeDe(s)]);
  for (let n = alvo; n && n !== ponta; n = p.seguir.get(n)) {
    if (visto.has(n) || !nomes.includes(n)) {
      alvo = null;
      break;
    }
    visto.add(n);
  }
  const quem = sessaoDe(alvo && nomes.includes(alvo) ? alvo : ponta);
  return quem?.estado?.hunt ? { pos: quem.estado.hunt.pos, coleira: p.coleiras.get(nomeDe(s)) ?? 5 } : null;
}

/**
 * O reagrupamento que vale para `s` agora: `{ pos, perto }` (a posição VIVA de quem é o ponto de encontro) ou null. Some quando o chamado
 * venceu (`REAGRUPAR_MS`), o líder ou o próprio membro cancelou, ele já chegou (a `REAGRUPAR_PERTO` casas) ou o ponto saiu da sala. Quem
 * anda é o passo de sempre da caçada (mesma BFS, sem teleporte); o combate e as magias seguem como estavam.
 */
export function reagruparDe(s) {
  const p = minhaParty(s);
  const r = p?.reagrupar;
  if (!r) return null;
  if (Date.now() > r.ate) {
    p.reagrupar = null;
    return null;
  }
  const eu = nomeDe(s);
  if (eu === r.alvo || r.cancelou.has(eu) || r.chegou.has(eu)) return null;
  const ponto = sessaoDe(r.alvo);
  const h = s.estado?.hunt;
  if (!h || !ponto?.estado?.hunt || Cacadas.salaDe(ponto.estado.hunt) !== Cacadas.salaDe(h) || (ponto.estado.hunt.z ?? 0) !== (h.z ?? 0)) return null;
  if (cheb(h.pos, ponto.estado.hunt.pos) <= REAGRUPAR_PERTO) {
    r.chegou.add(eu);
    return null;
  }
  return { pos: ponto.estado.hunt.pos, perto: REAGRUPAR_PERTO };
}

const olhar = (e) => ({ type: e.outfit?.type ?? 128, head: e.outfit?.head ?? 78, body: e.outfit?.body ?? 88, legs: e.outfit?.legs ?? 58, feet: e.outfit?.feet ?? 76, mount: e.outfit?.mount ?? 0, addons: e.outfit?.addons ?? 0 });

/** O que entra no retrato da hunt: os outros da sala, os familiares deles e `party`. */
export function extrasDoRetrato(s) {
  const outros = naMesmaSala(s).filter((o) => o !== s);
  const p = minhaParty(s);
  const extras = {
    aliados: outros.map((o) => {
      const e = o.estado;
      const v = olhar(e);
      return { uid: `aliado:${nomeDe(o)}`, name: nomeDe(o), x: e.hunt.pos.x, y: e.hunt.pos.y, dir: e.hunt.pos.dir ?? 2, look: v.type, colors: v, mount: 0, addons: v.addons, hp: e.hp, maxHp: e.maxHp, level: e.level, moveMs: 250 };
    }),
    summonsDoGrupo: outros
      .filter((o) => o.estado.hunt.summon)
      .map((o) => {
        const f = o.estado.hunt.summon;
        return { uid: `${f.uid}:${nomeDe(o)}`, x: f.x, y: f.y, dir: f.dir, look: f.look, name: f.name, nivel: f.nivel, moveMs: f.moveMs ?? 250 };
      }),
  };
  // Sempre presente (null sem party): o quadro em delta (`game/websocket/quadro.mjs`)
  // só manda chave que MUDOU — uma chave que some nunca chegaria ao client, e
  // ele seguiria mostrando a partilha de antes de sair da party.
  extras.party = null;
  // O progresso por setor da instância (null fora de instância): a mesma chave sempre, para o quadro em delta.
  extras.setores = !s.estado.hunt ? null : Cacadas.setoresDaCacada(s.estado.hunt, [s, ...outros].map((o) => ({ nome: nomeDe(o), x: o.estado.hunt.pos.x, y: o.estado.hunt.pos.y, z: o.estado.hunt.z ?? 0 })));
  if (p) {
    const part = partilha(s);
    const nomes = part.membros.map((m) => m.nome);
    extras.party = {
      ativa: part.ativa,
      motivo: part.motivo,
      faixa: part.faixa,
      bonus: part.bonus,
      vocacoes: part.vocacoes,
      lider: p.lider,
      mandaNaFila: p.lider,
      frente: nomes.includes(p.frente) ? p.frente : p.lider,
      seguirQuem: p.seguir.get(nomeDe(s)) ?? null,
      coleira: p.coleiras.get(nomeDe(s)) ?? 5,
      coleiras: COLEIRAS,
      modo: p.modo.get(nomeDe(s)) ?? 'seguir',
      reagrupar: p.reagrupar && Date.now() <= p.reagrupar.ate ? { alvo: p.reagrupar.alvo, resta: Math.max(0, p.reagrupar.ate - Date.now()) } : null,
      membros: part.membros.map((m) => {
        const o = sessaoDe(m.nome);
        const mostrar = o?.estado?.settings?.verAcoesDaParty !== false;
        return {
          name: m.nome,
          coleira: p.coleiras.get(m.nome) ?? 5,
          estado: 'ok',
          modo: p.modo.get(m.nome) ?? 'seguir',
          seguindo: p.seguir.get(m.nome) ?? null,
          emCombate: !!o?.estado?.hunt?.alvo,
          acoes: mostrar ? (o?.estado?.actions ?? []).filter((a) => a?.id).slice(0, 8).map((a) => ({ id: a.id, ...(o.estado.hunt?.cooldowns?.[a.id] ?? {}) })) : null,
        };
      }),
    };
  }
  return extras;
}

/** Os campos do personagem: `party`, `partySlots`, `convitePartyDe`, `pedidoDeEntrada`. */
export function camposDoPersonagem(s) {
  const p = minhaParty(s);
  const eu = nomeDe(s);
  const convite = [...parties.values()].find((x) => (x.convites.get(eu) ?? 0) > Date.now());
  const pedido = pedidos.get(eu);
  const minhaSala = s.estado?.hunt ? Cacadas.salaDe(s.estado.hunt) : null;
  const campos = {
    partySlots: limiteDeChars(s.conta?.id),
    convitePartyDe: convite?.lider ?? null,
    pedidoDeEntrada: pedido && pedido.expira > Date.now() ? { de: pedido.de } : null,
    party: null,
  };
  if (!p) return campos;
  campos.party = {
    lider: p.lider,
    souLider: p.lider === eu,
    maximo: maximo(p.membros),
    membros: p.membros.map((nome) => {
      const o = sessaoDe(nome);
      const e = o?.estado;
      const sala = e?.hunt ? Cacadas.salaDe(e.hunt) : null;
      const naMinha = !!sala && sala === minhaSala;
      const cacando = !!e?.hunt;
      const expDoLevel = e ? Cacadas.progressoDoLevel(e) : 0;
      return {
        name: nome,
        nome,
        eu: nome === eu,
        lider: nome === p.lider,
        online: !!o,
        // Offline: em quantos ms o prazo de volta acaba (a tela mostra "volta em N min").
        voltaEm: p.offline.has(nome) ? Math.max(0, p.offline.get(nome) - Date.now()) : null,
        // O estado de movimento (follow/independente), quem ele segue, a distância e se está em combate — a tabela da party mostra.
        modo: p.modo.get(nome) ?? 'seguir',
        seguindo: p.seguir.get(nome) ?? null,
        coleira: p.coleiras.get(nome) ?? 5,
        emCombate: !!e?.hunt?.alvo,
        vocation: e?.vocation ?? p.cartoes.get(nome)?.vocation ?? 'none',
        // O nome depois da promoção ("Royal Paladin"), para o card do membro.
        vocationName: e ? Promocao.nomeDaClasse(e) : p.cartoes.get(nome)?.vocationName ?? null,
        level: e?.level ?? p.cartoes.get(nome)?.level ?? 0,
        outfit: e ? olhar(e) : p.cartoes.get(nome)?.outfit ?? null,
        hp: e?.hp ?? 0,
        maxHp: e?.maxHp ?? 1,
        mana: e?.mana ?? 0,
        maxMana: e?.maxMana ?? 1,
        progresso: expDoLevel,
        hunt: cacando ? Cacadas.nomeDaHunt(e.hunt.huntId) : null,
        // Em que setor da instância ele está (se a fase tem setores e ele está na MINHA sala).
        setor: naMinha && e?.hunt ? Cacadas.setorDoJogador(e.hunt)?.nome ?? null : null,
        naMinhaCacada: naMinha && nome !== eu,
        cacandoPorFora: cacando && !naMinha,
        podeChamar: !!o && nome !== eu && !!minhaSala && !naMinha,
        // Ele deixou a porta aberta ("Permitir entrar na caçada") e eu posso entrar lá.
        podeEntrarDireto: !!o && nome !== eu && cacando && !naMinha && e.settings?.entrarSemConvite === true && !motivoParaNaoEntrar(s, sala),
        podePedirEntrada: !!o && nome !== eu && cacando && !naMinha,
      };
    }),
  };
  return campos;
}

// ------------------------------------- os chars da MESMA conta (troca de personagem)

/** Está numa party agora? (o char sem aba — ver `Sessao.contaChar` — sai do mundo quando deixa de estar). */
/** Está numa party COM alguém online? (o char sem aba só fica enquanto houver companhia: com todos offline, ele também sai) */
export const naParty = (s) => {
  const p = minhaParty(s);
  return !!p && p.membros.some((n) => n !== nomeDe(s) && !p.offline.has(n) && !!sessaoDe(n));
};

/** Quem decide pelo grupo (encontros que pedem decisão): o líder da party — ou o jogador sozinho, sem party. */
export const decidePeloGrupo = (s) => {
  const p = minhaParty(s);
  return !p || p.lider === nomeDe(s);
};

/**
 * "+ Party" na troca de personagem: põe `outro` (da MESMA conta, já no mundo)
 * na party de `dono`, sem convite para aceitar — é a mesma pessoa dos dois
 * lados. As regras são as do convite normal: só o líder chama, e o teto da party.
 */
export function juntarDaConta(dono, outro) {
  const p = minhaParty(dono);
  if (p && p.membros.includes(nomeDe(outro))) return { ok: true, jaEstava: true };
  const convite = comandoDoGrupo(dono, { action: 'convidar', name: nomeDe(outro) });
  if (!convite.ok) return convite;
  const aceite = comandoDoGrupo(outro, { action: 'aceitar' });
  if (!aceite.ok) return aceite;
  return { ok: true, notice: `${nomeDe(outro)} entrou na sua party.` };
}

/** "➜ Hunt": leva `outro` (já na party) para a caçada de `dono`, sem ele precisar aceitar. */
export function chamarDaConta(dono, outro) {
  if (!dono.estado?.hunt) return { ok: false, erro: 'Entre numa caçada para chamar alguém para ela.' };
  const sala = Cacadas.salaDe(dono.estado.hunt);
  if (outro.estado?.hunt && Cacadas.salaDe(outro.estado.hunt) === sala) return { ok: true, notice: `${nomeDe(outro)} já está na sua caçada.` };
  return juntar(outro, dono);
}

// -------------------------------------------- "Seguir líder em qualquer ocasião"

/*
 * A marca `settings.seguirLider` (⚙ Config da troca de personagem, e a janela de
 * party de quem não é o líder): o membro vai junto quando o líder ENTRA numa
 * caçada (ou troca de hunt, ou entra na caçada de alguém), e volta junto quando
 * ele VOLTA PARA A CIDADE ou MORRE — mesmo sem aba aberta. As portas valem: a
 * hunt liberada, os 10 levels, premium/acesso, o teto da sala (ver `juntar`).
 * Quem não pode seguir fica onde está e recebe o porquê (e o líder também).
 *
 * Sala de boss em grupo não existe: boss o líder faz sozinho, e ninguém segue.
 */
const seguidores = (lider) => {
  const p = minhaParty(lider);
  if (!p || p.lider !== nomeDe(lider)) return [];
  return p.membros
    .filter((n) => n !== p.lider)
    .map(sessaoDe)
    .filter((o) => o?.estado && o.estado.settings?.seguirLider === true);
};

/** O líder acabou de entrar numa caçada: quem segue, vai junto. */
export function seguirOLider(lider) {
  const sala = lider.estado?.hunt ? Cacadas.salaDe(lider.estado.hunt) : null;
  if (!sala || sala.isBoss) return;
  for (const o of seguidores(lider)) {
    if (o.estado.hunt && Cacadas.salaDe(o.estado.hunt) === sala) continue;
    const r = juntar(o, lider);
    if (r.ok) avisar(o, `Seguindo ${nomeDe(lider)}: ${Cacadas.nomeDaHunt(sala.huntId)}.`);
    else {
      avisar(o, `Não deu para seguir ${nomeDe(lider)}: ${r.erro}`);
      avisar(lider, `${nomeDe(o)} não pôde vir: ${r.erro}`);
    }
    mandarJa(o);
  }
}

/*
 * ---- "Avançar sozinho" em grupo ----
 *
 * O dono (29/09): "na party, se eu tiver avançar sozinho e ele também, a gente segue junto para a
 * próxima hunt". Quem completa a fase e tem o "Avançar sozinho" (`settings.aoCompletarFase ===
 * 'seguir'`) vai para a próxima; os da party que estão NA MESMA sala e também marcaram "Avançar
 * sozinho" vão junto. Quem deixou em "Ficar na fase" fica onde está. As portas valem como sempre
 * (`juntar`): a fase liberada para ELE, o teto da sala... — quem não pode ir recebe o porquê.
 *
 * `quemAvancaJunto` roda ANTES de o dono sair da fase (a saída passa a sala para quem fica e muda
 * quem está nela); `avancarJunto` roda depois de ele entrar na próxima.
 */
export function quemAvancaJunto(dono) {
  const p = minhaParty(dono);
  const sala = dono.estado?.hunt ? Cacadas.salaDe(dono.estado.hunt) : null;
  if (!p || !sala || sala.isBoss) return [];
  return p.membros
    .filter((n) => n !== nomeDe(dono))
    .map(sessaoDe)
    .filter((o) => o?.estado?.hunt && Cacadas.salaDe(o.estado.hunt) === sala && o.estado.settings?.aoCompletarFase === 'seguir');
}

export function avancarJunto(dono, membros) {
  const sala = dono.estado?.hunt ? Cacadas.salaDe(dono.estado.hunt) : null;
  if (!sala) return;
  for (const o of membros) {
    if (o.estado.hunt && Cacadas.salaDe(o.estado.hunt) === sala) continue; // já veio (Seguir líder)
    const r = juntar(o, dono);
    if (r.ok) avisar(o, `Avançando com ${nomeDe(dono)}: ${Cacadas.nomeDaHunt(sala.huntId)}.`);
    else {
      avisar(o, `Não deu para avançar com ${nomeDe(dono)}: ${r.erro}`);
      avisar(dono, `${nomeDe(o)} não pôde avançar: ${r.erro}`);
    }
    mandarJa(o);
  }
}

/**
 * O líder vai sair da caçada (voltou para a cidade, ou morreu): quem segue e
 * está na MESMA sala volta junto, com o extrato — chamado ANTES de ele sair.
 */
export function voltarComOLider(lider, motivo) {
  const sala = lider.estado?.hunt ? Cacadas.salaDe(lider.estado.hunt) : null;
  if (!sala) return;
  for (const o of seguidores(lider)) {
    if (!o.estado.hunt || Cacadas.salaDe(o.estado.hunt) !== sala) continue;
    const report = Cacadas.relatorio(o.estado);
    // Se a sala é DELE (o líder entrou na dele), quem fica assume antes de ele sair.
    antesDeSairDaCacada(o);
    o.estado.hunt = null;
    if (report) o.enviar({ t: 'runReport', report, motivo: `${nomeDe(lider)} ${motivo} — você voltou junto (Seguir líder).` });
    avisar(o, `Você voltou para a cidade com ${nomeDe(lider)}.`);
    mandarJa(o);
  }
}

/** SÓ para os testes: esquece as parties da memória (como um reinício do processo), sem tocar no banco. */
export function _esquecerParaTeste() {
  parties.clear();
  partyDe.clear();
  gravadas.clear();
  proximoId = 1;
}


/**
 * Reagrupamento OBRIGATÓRIO antes de um chefe (só nas fases configuradas em `gamedata/instancias.json`): quem ativa o encontro precisa ter a
 * party inteira (os membros ATIVOS da sala, online) a `raio` casas do chefe. Devolve os nomes de quem falta (`[]` = pode começar).
 * Fora de party, ou fase/tipo não configurados, nunca exige nada.
 */
export function faltamParaReagrupar(s, encontro, config) {
  const regra = config?.reagrupamentoObrigatorio;
  const hunt = s.estado?.hunt;
  if (!regra || !hunt || !minhaParty(s) || !(regra.fases ?? []).includes(hunt.huntId) || !(regra.tipos ?? []).includes(encontro?.tipo)) return [];
  const alvo = { x: encontro.x ?? hunt.pos.x, y: encontro.y ?? hunt.pos.y };
  const raio = regra.raio ?? 6;
  return naMesmaSala(s)
    .filter((o) => minhaParty(o) === minhaParty(s) && ativo(o))
    .filter((o) => (o.estado.hunt.z ?? 0) !== (encontro.z ?? hunt.z ?? 0) || cheb(o.estado.hunt.pos, alvo) > raio)
    .map(nomeDe);
}
