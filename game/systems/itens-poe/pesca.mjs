// A PESCA do PoE (08/11, balão 0 sem efeito — o dono: "Pescar na água da caçada": a Vara de Pescar, parado perto da água, o botão Pescar; o peixe
// vai para a mochila e vende por ouro, o raro com chance de moeda; os atributos de pesca valem como no PoE; Corrompido só com o Laço).
//
// Como no PoE: com a Vara vestida, lança a linha na água ao alcance (`alcanceCasas` × "Alcance da Pesca"); um tempo depois o peixe MORDE e há uma
// JANELA para puxar ("Sensibilidade da Fisgada" a aumenta); puxou a tempo, a linha pode ARREBENTAR ("Força da Linha de Pesca" diminui a chance);
// senão vêm os peixes — "Quantidade de Peixes Pescados" (a chance de mais um, ou de nenhum, se reduzida), "Raridade de Peixes Pescados" (o raro);
// cada área tem uma RESERVA de peixes, e o "Consumo da Reserva de Pesca" gasta mais (ou menos) dela por peixe. O Laço do Pescador ("Você pode
// pescar Peixes Corrompidos") e a Canção das Sereias ("Peixes Exóticos") abrem os peixes deles; a área pode ter um PEIXE ÚNICO, que faz a
// Perdição do Recife brilhar. As iscas e o anzol das varas raras (o PoE não dá número): a isca apressa a mordida, o anzol alarga a janela.
//
// A pesca é da Caça Online (o jogador parado; andar recolhe a linha). Os números moram em `regras.json → pesca`.
import { ITEM_CATALOG } from '../dados.mjs';
import { ligado, REGRAS } from './catalogo.mjs';
import * as ModsPoe from './mods-poe.mjs';
import * as MoedasPoe from './moedas.mjs';
import * as Ficha from '../ficha.mjs';
import * as Inventario from '../inventario.mjs';
import { gradeDaHunt, acharHunt, CHAO_LIQUIDO } from '../hunt/terreno.mjs';
import { daSala } from '../hunt/instancia.mjs';
import * as Eventos from '../encontros/eventos.mjs';
import * as Monstros from './monstros.mjs';

/** A Vara de Pescar: id FIXO (fora da sequência das bases — `jogo.mjs`). */
export const ID_DA_VARA = 7_900_001;
export const BASE_DA_VARA = 'Fishing_Rods/Fishing_Rod';
/** Os peixes (ids fixos 7.900.101+; o desenho é o de um peixe do Draevor — `spriteDe`). `venda`: o ouro do vendedor. */
export const PEIXES = Object.freeze([
  { id: 7_900_101, nome: 'Peixe', tipo: 'comum', spriteDe: 3578, venda: 40 },
  { id: 7_900_102, nome: 'Camarão', tipo: 'comum', spriteDe: 3581, venda: 25 },
  { id: 7_900_103, nome: 'Perca-verde', tipo: 'comum', spriteDe: 7159, venda: 60 },
  { id: 7_900_104, nome: 'Salmão', tipo: 'comum', spriteDe: 3579, venda: 90 },
  { id: 7_900_111, nome: 'Lúcio-do-norte', tipo: 'raro', spriteDe: 3580, venda: 400 },
  { id: 7_900_112, nome: 'Truta-arco-íris', tipo: 'raro', spriteDe: 7158, venda: 600 },
  { id: 7_900_121, nome: 'Peixe Corrompido', tipo: 'corrompido', spriteDe: 3125, venda: 1500 },
  { id: 7_900_131, nome: 'Peixe Exótico das Sereias', tipo: 'exotico', spriteDe: 5895, venda: 2500 },
  { id: 7_900_141, nome: 'Peixe Único do Abismo das Águas', tipo: 'unico', spriteDe: 3580, venda: 10000 },
]);
const DO_TIPO = (tipo) => PEIXES.filter((p) => p.tipo === tipo);
const CFG = () => REGRAS?.pesca ?? {};
const erro = (e) => ({ ok: false, erro: e });
const v = (estado, stat) => ModsPoe.valor(Ficha.combate(estado), stat);
const pct = (estado, stat) => 1 + v(estado, stat) / 100;

/** Põe os peixes no catálogo de itens (uma vez; só no PoE). A Vara entra com as bases (`jogo.mjs`, o id fixo `ID_DA_VARA`). */
export function iniciar() {
  if (!ligado()) return 0;
  for (const p of PEIXES) {
    ITEM_CATALOG[p.id] ??= {
      id: p.id, name: p.nome, weight: 0.5, stackable: true, type: 'food', rarity: p.tipo === 'comum' ? 'comum' : 'raro', hasSprite: true, spriteDe: p.spriteDe,
      sell: p.venda, peixe: p.tipo, descricao: `Pescado na água da caçada. Vende por ${p.venda} de ouro.`,
    };
  }
  return PEIXES.length;
}

/** A Vara de Pescar está vestida? */
export const temVara = (estado) => estado?.equipment?.weapon?.poe?.classe === 'Fishing_Rods';

/** O alcance da pesca em casas ("Alcance da Pesca aumentado"). */
export const alcance = (estado) => Math.max(1, Math.round((Number(CFG().alcanceCasas) || 3) * Math.max(0.1, pct(estado, 'pesca_alcance_pct'))));

/**
 * Há água para pescar? Nas áreas do PoE, a da própria área: a tag `area_with_water` do PoE (o mapa da área é desenhado com a paleta do PoE, sem o
 * nome do chão); nos mapas do Draevor, uma casa de água (não lava nem piche) a até `r` casas de você.
 */
export function aguaPerto(hunt, r) {
  const dados = acharHunt(hunt?.huntId);
  if (dados?.poeArea) return !!Monstros.CAMPANHA.areas[hunt.huntId]?.tags?.includes('area_with_water');
  const grade = gradeDaHunt(dados ?? { id: hunt?.huntId });
  const real = grade?.mapa;
  if (!real || !hunt?.pos) return false;
  const andar = real.floors?.[hunt.z] ?? (hunt.z === real.z || hunt.z == null ? real : null);
  if (!andar?.stacks) return false;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = hunt.pos.x + dx;
      const y = hunt.pos.y + dy;
      if (x < 0 || y < 0 || x >= real.width || y >= real.height) continue;
      const nome = ITEM_CATALOG[real.palette?.[andar.stacks[y * real.width + x]?.[0]]?.id]?.name ?? '';
      if (CHAO_LIQUIDO.test(nome) && !/lava|tar/.test(nome)) return true;
    }
  }
  return false;
}

/** A reserva de peixes da área (da instância; sem instância, da própria caçada): `{ reserva, unico }`. */
function reservaDa(hunt, rng) {
  const dono = daSala(hunt) ?? hunt;
  return (dono.reservaDePesca ??= { reserva: Number(CFG().reservaPorArea) || 12, unico: rng() * 100 < (Number(CFG().unicoNaAreaPct) || 0) });
}

/** O tempo até a próxima mordida (a isca apressa). */
function proximaMordida(estado, hunt, rng) {
  const [min, max] = CFG().mordidaMs ?? [4000, 10000];
  const isca = v(estado, 'pesca_isca') > 0 ? 1 - (Number(CFG().iscaPct) || 20) / 100 : 1;
  return (hunt.clock ?? 0) + Math.round((min + rng() * (max - min)) * isca);
}

/** Por que não dá para pescar aqui agora (ou null). */
export function motivo(estado, hunt = estado?.hunt) {
  if (!ligado()) return 'A pesca é do modo PoE.';
  if (!hunt) return 'Entre numa caçada com água.';
  if (!temVara(estado)) return 'Vista uma Vara de Pescar.';
  if (hunt.modo === 'auto') return 'Pare a Caça Automática para pescar (Caça Online).';
  if (!(estado.hp > 0)) return 'Você está morto.';
  if (!aguaPerto(hunt, alcance(estado))) return acharHunt(hunt.huntId)?.poeArea ? 'Esta área não tem água para pescar.' : `Chegue perto da água (até ${alcance(estado)} casas).`;
  return null;
}

/** `{t:'pescar'}`: lança a linha; com a linha na água, recolhe; com o peixe mordendo, PUXA. */
export function pescar(estado, rng = Math.random) {
  const hunt = estado?.hunt;
  if (hunt?.pesca?.fase === 'mordida') return puxar(estado, rng);
  if (hunt?.pesca) {
    delete hunt.pesca;
    return { ok: true, notice: 'Você recolheu a linha.' };
  }
  const m = motivo(estado, hunt);
  if (m) return erro(m);
  if (reservaDa(hunt, rng).reserva <= 0) return erro('Os peixes desta área acabaram.');
  hunt.pesca = { fase: 'esperando', pos: { x: hunt.pos.x, y: hunt.pos.y }, mordidaEm: proximaMordida(estado, hunt, rng) };
  return { ok: true, notice: 'Você lançou a linha.' };
}

/** A cada tique: a mordida, a janela que passa, e andar recolhe a linha. */
export function tique(estado, hunt, rng = Math.random) {
  const p = hunt?.pesca;
  if (!p) return;
  const agora = hunt.clock ?? 0;
  if (hunt.pos.x !== p.pos.x || hunt.pos.y !== p.pos.y || !temVara(estado) || hunt.modo === 'auto' || !(estado.hp > 0)) {
    delete hunt.pesca;
    return;
  }
  if (p.fase === 'esperando' && agora >= p.mordidaEm) {
    const janela = (Number(CFG().janelaMs) || 1200) * Math.max(0.1, pct(estado, 'pesca_sensibilidade_pct')) * (v(estado, 'pesca_anzol') > 0 ? 1 + (Number(CFG().anzolPct) || 20) / 100 : 1);
    Object.assign(p, { fase: 'mordida', janelaAte: agora + Math.round(janela) });
    Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: 'Fisgou! Puxe!', x: hunt.pos.x, y: hunt.pos.y, color: '#7fd6ff' }]);
  } else if (p.fase === 'mordida' && agora > p.janelaAte) {
    Object.assign(p, { fase: 'esperando', mordidaEm: proximaMordida(estado, hunt, rng) });
    delete p.janelaAte;
    Eventos.empurrar(hunt, [{ t: 'say', uid: 'player', text: 'O peixe escapou.', x: hunt.pos.x, y: hunt.pos.y, color: '#9aa0a8' }]);
  }
}

/** O tipo do peixe pescado. */
function tipoDoPeixe(estado, area, rng) {
  const c = CFG();
  const rar = Math.max(0, pct(estado, 'pesca_raridade_pct'));
  if (area.unico && rng() * 100 < (Number(c.unicoPct) || 0) * rar) {
    area.unico = false;
    return 'unico';
  }
  if (v(estado, 'pesca_exoticos') > 0 && rng() * 100 < (Number(c.exoticoPct) || 0) * rar) return 'exotico';
  if (v(estado, 'pesca_corrompidos') > 0 && rng() * 100 < (Number(c.corrompidoPct) || 0)) return 'corrompido';
  return rng() * 100 < (Number(c.raroPct) || 0) * rar ? 'raro' : 'comum';
}

/** Puxar na janela: a linha pode arrebentar; senão, os peixes (e as moedas dos raros). */
export function puxar(estado, rng = Math.random) {
  const hunt = estado?.hunt;
  const p = hunt?.pesca;
  if (!p) return erro('Lance a linha antes (Pescar).');
  if (p.fase !== 'mordida') {
    // (no PoE, puxar antes da mordida espanta o peixe)
    p.mordidaEm = proximaMordida(estado, hunt, rng);
    return erro('Cedo demais: o peixe se assustou.');
  }
  const c = CFG();
  const recomecar = () => {
    Object.assign(p, { fase: 'esperando', mordidaEm: proximaMordida(estado, hunt, rng) });
    delete p.janelaAte;
  };
  if (rng() * 100 < (Number(c.quebraPct) || 0) / Math.max(0.1, pct(estado, 'pesca_linha_pct'))) {
    recomecar();
    return { ok: true, notice: 'A linha arrebentou!' };
  }
  const area = reservaDa(hunt, rng);
  const q = Math.max(0, pct(estado, 'pesca_quantidade_pct'));
  const n = Math.floor(q) + (rng() < q % 1 ? 1 : 0);
  if (n < 1) {
    recomecar();
    return { ok: true, notice: 'O peixe escapou do anzol.' };
  }
  const pescados = [];
  const moedas = [];
  for (let i = 0; i < n; i++) {
    const tipo = tipoDoPeixe(estado, area, rng);
    const lista = DO_TIPO(tipo);
    const peixe = lista[Math.floor(rng() * lista.length)];
    Inventario.darItem(estado, peixe.id, 1);
    pescados.push(peixe.nome);
    const chance = { raro: c.moedaDoRaroPct, exotico: c.moedaDoExoticoPct, corrompido: c.moedaDoCorrompidoPct, unico: 100 }[tipo];
    if (chance && rng() * 100 < Number(chance)) {
      const ids = tipo === 'corrompido' ? [{ id: MoedasPoe.idDa('Vaal_Orb'), count: 1 }] : MoedasPoe.moedasAvulsas(tipo === 'unico' ? 3 : 1, rng);
      for (const m of ids) if (m.id) { Inventario.darItem(estado, m.id, m.count); moedas.push(ITEM_CATALOG[m.id]?.name ?? 'moeda'); }
    }
  }
  area.reserva -= n * Math.max(0.1, pct(estado, 'pesca_consumo_pct'));
  if (area.reserva > 0) recomecar();
  else delete hunt.pesca;
  return { ok: true, notice: `Você pescou: ${pescados.join(', ')}${moedas.length ? ` (e ${moedas.join(', ')})` : ''}.${area.reserva > 0 ? '' : ' Os peixes desta área acabaram.'}` };
}

/** O que a tela precisa (só com a Vara vestida): a fase, se pode pescar aqui e por quê não, e o brilho da Perdição do Recife. */
export function paraCliente(estado) {
  const hunt = estado?.hunt;
  if (!ligado() || !hunt || !temVara(estado)) return null;
  const p = hunt.pesca;
  const m = p ? null : motivo(estado, hunt);
  const area = (daSala(hunt) ?? hunt).reservaDePesca ?? null;
  return { pesca: { fase: p?.fase ?? 'parado', pode: !m, ...(m ? { motivo: m } : {}), ...(area ? { reserva: Math.max(0, Math.ceil(area.reserva)) } : {}) } };
}

/** A Perdição do Recife: "Brilha enquanto estiver em uma área contendo um Peixe Único". */
export function brilha(estado, hunt = estado?.hunt) {
  if (!hunt || !(v(estado, 'visual:brilho_peixe') > 0)) return false;
  return !!reservaDa(hunt, Math.random).unico;
}
