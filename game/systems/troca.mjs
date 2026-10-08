// A TROCA entre jogadores (o "trade"). O cliente sempre teve a mesa de troca
// (social.mjs: convite, as duas ofertas, ouro, confirmar, cancelar) e mandava
// `{t:'trade', action}` — mas o servidor nunca teve este lado: a mensagem caía no
// `default` silencioso da sessão e nada acontecia ("o trade não funciona").
//
// O servidor é a autoridade:
//   - um jogador numa troca por vez (o mesmo item nunca está em duas);
//   - só da MOCHILA, nunca equipado nem item fixo; ninguém caçando;
//   - a oferta guarda a cópia EXATA (`camposDaPeca`: raridade, afixos, tier...),
//     e a entrega move essa cópia — nada é recriado pelo id do item-base;
//   - qualquer mudança na mesa (item, quantidade, ouro) desmarca as DUAS confirmações;
//   - na confirmação final tudo é conferido de novo (os itens ainda estão lá, o
//     ouro, o peso de quem recebe) e a troca é aplicada de uma vez, em cópias das
//     mochilas — ou passa inteira, ou nada muda;
//   - os dois personagens são gravados na MESMA transação do banco (a da sessão,
//     `emTransacao`: a sessão do outro entra em `tocadas`);
//   - fechada a troca, confirmar de novo não faz nada (sem entrega dupla).
import { ITEM_CATALOG } from './dados.mjs';
import { camposDaPeca } from './itens/item.mjs';
import { pilhaMaxima } from './itens/pilha.mjs';
import { pesoDoInventario, VALOR_DA_MOEDA, pilhaDoAlvo } from './inventario.mjs';
import * as Afixos from './afixos.mjs';
import { podeEntrar, MENSAGEM as SO_ITENS_DO_POE } from './itens-poe/so-itens-do-poe.mjs';

/** Quantos itens diferentes cabem em cada lado da mesa (as casas do quadro). */
export const LIMITE_DE_ITENS = 8;
/** Quanto tempo um convite fica de pé. */
export const CONVITE_MS = 30_000;

let vivas = new Map();
/** As sessões vivas (`Map` da sessão), para achar o outro lado pelo nome. */
export function ligar(mapa) {
  vivas = mapa;
}
const sessaoDe = (nome) => vivas.get(nome) ?? [...vivas.values()].find((s) => s.personagem?.nome?.toLowerCase() === String(nome ?? '').toLowerCase()) ?? null;

/** Convites pendentes: quem foi convidado → `{ de, expiraEm }`. */
const convites = new Map();
/** A troca de cada jogador (o MESMO objeto para os dois): nome → troca. */
const trocas = new Map();

const nomeDe = (s) => s?.personagem?.nome ?? null;
const lado = () => ({ itens: [], gold: 0, confirmou: false });
const assinatura = (p) => JSON.stringify(camposDaPeca(p));
/** A mesma cópia: mesmo id e os mesmos dados de instância (raridade, afixos, tier...). */
const mesmaCopia = (p, id, chave) => p?.id === id && assinatura(p) === chave;

function avisar(s, notice) {
  if (!s?.estado) return;
  s.characterSujo = true;
  if (notice) s.enviar?.({ t: 'notice', notice });
  s.mandarEstado?.();
}

function fechar(troca, motivo = null) {
  for (const n of [troca.a, troca.b]) {
    if (trocas.get(n) === troca) trocas.delete(n);
  }
  troca.fechada = true;
  for (const n of [troca.a, troca.b]) avisar(sessaoDe(n), motivo);
}

/** A outra pessoa da troca de `nome`. */
const outroDe = (troca, nome) => (troca.a === nome ? troca.b : troca.a);

/** Mexeu na mesa: as duas confirmações caem. */
function desconfirmar(troca) {
  for (const l of Object.values(troca.lados)) l.confirmou = false;
  troca.versao = (troca.versao ?? 0) + 1;
}

/** Por que `s` não pode trocar agora (ou `null`). */
function impedimento(s) {
  if (!s?.estado || !s.personagem) return 'não está no jogo';
  if (s.estado.hunt) return 'está caçando';
  if ((s.estado.hp ?? 1) <= 0) return 'está morto';
  return null;
}

/** Quanto de uma cópia (id + instância) há na mochila. */
const quantoTem = (mochila, id, chave) => mochila.filter((p) => mesmaCopia(p, id, chave)).reduce((s, p) => s + (p.count ?? 1), 0);

/** O que vai para a tela (`state.troca` e `state.conviteDeTroca` do cliente). */
export function paraCliente(s) {
  const eu = nomeDe(s);
  const out = {};
  const c = eu ? convites.get(eu) : null;
  if (c && c.expiraEm > Date.now()) out.conviteDeTroca = { de: c.de, expiraEm: c.expiraEm };
  else if (c) convites.delete(eu);
  const troca = eu ? trocas.get(eu) : null;
  if (troca) {
    const vista = (l) => ({
      itens: l.itens.map((x) => ({ id: x.id, count: x.count, ...x.campos })),
      gold: l.gold,
      confirmou: l.confirmou,
    });
    out.troca = { com: outroDe(troca, eu), minha: vista(troca.lados[eu]), dele: vista(troca.lados[outroDe(troca, eu)]), limite: LIMITE_DE_ITENS };
  }
  return out;
}

/**
 * Aplica a troca nas CÓPIAS das duas mochilas e confere tudo; devolve
 * `{ ok, erro? , aplicar() }`. Só `aplicar()` mexe nos personagens — e de uma vez.
 */
function montarEntrega(troca, sa, sb) {
  const estados = { [troca.a]: sa.estado, [troca.b]: sb.estado };
  const novas = { [troca.a]: structuredClone(sa.estado.inventory ?? []), [troca.b]: structuredClone(sb.estado.inventory ?? []) };
  const ouro = { [troca.a]: sa.estado.gold ?? 0, [troca.b]: sb.estado.gold ?? 0 };
  // 1. Sai de cada um o que ele ofereceu (a cópia exata, ainda na mochila).
  const saindo = { [troca.a]: [], [troca.b]: [] };
  for (const dono of [troca.a, troca.b]) {
    const l = troca.lados[dono];
    if (l.gold > ouro[dono]) return { ok: false, erro: `${dono} não tem mais ${l.gold.toLocaleString('pt-BR')} de ouro.` };
    for (const x of l.itens) {
      let falta = x.count;
      const mochila = novas[dono];
      for (let i = mochila.length - 1; i >= 0 && falta > 0; i--) {
        if (!mesmaCopia(mochila[i], x.id, x.chave)) continue;
        const tira = Math.min(mochila[i].count ?? 1, falta);
        mochila[i].count = (mochila[i].count ?? 1) - tira;
        falta -= tira;
        if (mochila[i].count <= 0) mochila.splice(i, 1);
      }
      if (falta > 0) return { ok: false, erro: `${dono} não tem mais ${ITEM_CATALOG[x.id]?.name ?? 'um item'} da oferta.` };
      saindo[dono].push({ id: x.id, count: x.count, ...structuredClone(x.campos) });
    }
  }
  // 2. Entra no outro: a mesma cópia, inteira.
  for (const dono of [troca.a, troca.b]) {
    const para = outroDe(troca, dono);
    for (const peca of saindo[dono]) {
      const meta = ITEM_CATALOG[peca.id];
      const limpa = !Object.keys(camposDaPeca(peca)).length;
      if (!(meta?.stackable && limpa)) {
        novas[para].push(peca);
        continue;
      }
      // O empilhável limpo completa as pilhas de quem recebe e abre outras, de até `pilhaMaxima`.
      const max = pilhaMaxima(peca.id);
      let falta = peca.count ?? 1;
      for (const p of novas[para]) {
        if (falta <= 0) break;
        if (p.id !== peca.id || Object.keys(camposDaPeca(p)).length) continue;
        const cabe = Math.min(max - (p.count ?? 1), falta);
        if (cabe > 0) {
          p.count = (p.count ?? 1) + cabe;
          falta -= cabe;
        }
      }
      for (; falta > 0; falta -= max) novas[para].push({ ...peca, count: Math.min(max, falta) });
    }
  }
  // 3. O peso de quem recebe (o ouro vai para o bolso, sem peso).
  for (const dono of [troca.a, troca.b]) {
    const e = estados[dono];
    const peso = pesoDoInventario({ ...e, inventory: novas[dono] });
    if (peso > Afixos.capacidade(e) && peso > pesoDoInventario(e)) return { ok: false, erro: `${dono} não tem capacidade para carregar a troca.` };
  }
  return {
    ok: true,
    aplicar() {
      for (const dono of [troca.a, troca.b]) {
        const e = estados[dono];
        e.inventory = novas[dono];
        e.gold = ouro[dono] - troca.lados[dono].gold + troca.lados[outroDe(troca, dono)].gold;
      }
    },
  };
}

/** `{t:'trade', action, ...}` da sessão `s`. Devolve `{ok, erro?, notice?}`. */
export function comando(s, m) {
  const eu = nomeDe(s);
  if (!eu) return { ok: false, erro: 'Entre com um personagem primeiro.' };
  const action = m?.action;

  if (action === 'invite') {
    const alvo = sessaoDe(m.name);
    const ele = nomeDe(alvo);
    if (!ele) return { ok: false, erro: `${m.name ?? 'Esse jogador'} não está no jogo.` };
    if (ele === eu) return { ok: false, erro: 'Não dá para trocar com você mesmo.' };
    const meu = impedimento(s);
    if (meu) return { ok: false, erro: `Você ${meu}.` };
    const dele = impedimento(alvo);
    if (dele) return { ok: false, erro: `${ele} ${dele}.` };
    if (trocas.has(eu)) return { ok: false, erro: 'Você já está numa troca.' };
    if (trocas.has(ele)) return { ok: false, erro: `${ele} já está numa troca.` };
    convites.set(ele, { de: eu, expiraEm: Date.now() + CONVITE_MS });
    avisar(alvo);
    return { ok: true, notice: `Convite de troca enviado para ${ele}.` };
  }

  if (action === 'accept') {
    const c = convites.get(eu);
    convites.delete(eu);
    if (!c || c.expiraEm <= Date.now()) return { ok: false, erro: 'O convite expirou.' };
    const outra = sessaoDe(c.de);
    const ele = nomeDe(outra);
    if (!ele) return { ok: false, erro: `${c.de} saiu do jogo.` };
    for (const [quem, sx] of [['Você', s], [ele, outra]]) {
      const motivo = impedimento(sx);
      if (motivo) return { ok: false, erro: `${quem} ${motivo}.` };
    }
    if (trocas.has(eu) || trocas.has(ele)) return { ok: false, erro: 'Um dos dois já está noutra troca.' };
    const troca = { a: ele, b: eu, lados: { [ele]: lado(), [eu]: lado() }, versao: 0 };
    trocas.set(ele, troca);
    trocas.set(eu, troca);
    avisar(outra, `${eu} aceitou a troca.`);
    return { ok: true };
  }

  if (action === 'decline') {
    const c = convites.get(eu);
    convites.delete(eu);
    if (c) avisar(sessaoDe(c.de), `${eu} recusou a troca.`);
    return { ok: true };
  }

  const troca = trocas.get(eu);
  if (!troca) return { ok: false, erro: 'Você não está numa troca.' };
  const meuLado = troca.lados[eu];
  const outra = sessaoDe(outroDe(troca, eu));

  if (action === 'cancel') {
    fechar(troca, `${eu} cancelou a troca.`);
    return { ok: true };
  }

  if (action === 'offer') {
    const id = Number(m.id);
    const count = Math.max(0, Math.floor(Number(m.count) || 0));
    const mochila = s.estado.inventory ?? [];
    if (count === 0) {
      // Tira da oferta (o clique na casa): a entrada apontada, ou a última desse id.
      const i = meuLado.itens.map((x) => x.id).lastIndexOf(id);
      if (i < 0) return { ok: false, erro: 'Isso não está na sua oferta.' };
      meuLado.itens.splice(i, 1);
      desconfirmar(troca);
      avisar(outra);
      return { ok: true };
    }
    if (VALOR_DA_MOEDA[id]) return { ok: false, erro: 'O ouro vai pelo campo de ouro da mesa.' };
    if (ITEM_CATALOG[id]?.fixo) return { ok: false, erro: `${ITEM_CATALOG[id].name} é fixa no personagem — não entra na troca.` };
    const i = pilhaDoAlvo(mochila, id, m.alvo);
    if (i < 0) return { ok: false, erro: 'Esse item não está na sua mochila.' };
    if (!podeEntrar(id, mochila[i])) return { ok: false, erro: SO_ITENS_DO_POE };
    const chave = assinatura(mochila[i]);
    const ja = meuLado.itens.find((x) => x.id === id && x.chave === chave);
    const ofertado = ja?.count ?? 0;
    if (ofertado + count > quantoTem(mochila, id, chave)) return { ok: false, erro: 'Você não tem tudo isso na mochila.' };
    if (!ja && meuLado.itens.length >= LIMITE_DE_ITENS) return { ok: false, erro: `A mesa aceita até ${LIMITE_DE_ITENS} itens diferentes.` };
    if (ja) ja.count += count;
    else meuLado.itens.push({ id, count, chave, campos: structuredClone(camposDaPeca(mochila[i])) });
    desconfirmar(troca);
    avisar(outra);
    return { ok: true };
  }

  if (action === 'gold') {
    const v = Math.floor(Number(m.value));
    if (!Number.isFinite(v) || v < 0) return { ok: false, erro: 'Valor de ouro inválido.' };
    if (v > (s.estado.gold ?? 0)) return { ok: false, erro: 'Você não tem esse ouro.' };
    if (meuLado.gold !== v) {
      meuLado.gold = v;
      desconfirmar(troca);
      avisar(outra);
    }
    return { ok: true };
  }

  if (action === 'confirm') {
    if (!outra) {
      fechar(troca, 'A outra pessoa saiu do jogo.');
      return { ok: false, erro: 'A outra pessoa saiu do jogo.' };
    }
    meuLado.confirmou = true;
    const outroLado = troca.lados[outroDe(troca, eu)];
    if (!outroLado.confirmou) {
      avisar(outra, `${eu} confirmou a troca.`);
      return { ok: true };
    }
    // As duas confirmaram: confere tudo de novo e entrega de uma vez.
    for (const [quem, sx] of [['Você', s], [outroDe(troca, eu), outra]]) {
      const motivo = impedimento(sx);
      if (motivo) {
        desconfirmar(troca);
        avisar(outra);
        return { ok: false, erro: `${quem} ${motivo}.` };
      }
    }
    const sa = troca.a === eu ? s : outra;
    const sb = troca.a === eu ? outra : s;
    const entrega = montarEntrega(troca, sa, sb);
    if (!entrega.ok) {
      desconfirmar(troca);
      avisar(outra, entrega.erro);
      return { ok: false, erro: entrega.erro };
    }
    entrega.aplicar();
    // Os dois são gravados na mesma transação do banco (a da sessão — ver `emTransacao`).
    s.tocadas?.add(outra);
    fechar(troca, 'Troca concluída.');
    return { ok: true };
  }

  return { ok: false, erro: 'Ação de troca desconhecida.' };
}

/** O personagem saiu do jogo: a troca dele é cancelada e os convites dele somem. */
export function saiuDoJogo(s) {
  const eu = nomeDe(s);
  if (!eu) return;
  convites.delete(eu);
  for (const [para, c] of convites) if (c.de === eu) convites.delete(para);
  const troca = trocas.get(eu);
  if (troca) fechar(troca, `${eu} saiu do jogo — a troca foi cancelada.`);
}

/** Para os testes: esquece tudo. */
export function limpar() {
  convites.clear();
  trocas.clear();
}
