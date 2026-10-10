// O MAPA ABERTO de cada personagem (o Dispositivo de Mapas — `systems/mapas-dispositivo.mjs`) e as ESTATÍSTICAS do endgame. Mora no
// estado do personagem (`estado.mapas`, gravado com ele — nenhuma tabela nova):
//
//   estado.mapas = {
//     aberto: null | {
//       id, tier, nivel, nome, peca,            // a peça CONSUMIDA ao abrir (o resumo dela vai na caçada: `hunt.mapa`)
//       portais, portaisMax, mortes, abertoEm,  // 6 portais, como no PoE: cada morte gasta um; sem portal, o mapa acaba
//       cacada: null | { monstros, outrosAndares, instancia, z, salvoEm },  // o mapa como ficou quando você saiu (para voltar)
//     },
//     concluidos, falhos, mortes, maiorTier, porTier: { [tier]: n }, ultimo: null | { tier, resultado, em, duracaoMs, mortes },
//   }
//
// Saiu do mapa (parou, trocou de caçada, morreu com portal sobrando): os monstros VIVOS ficam guardados (compactados, como a caçada no
// banco) e a volta continua de onde parou — o chefe do mapa se cura quando você morre, como no PoE. Morreu no último portal: o mapa acaba
// (falhou). Limpou 100%: concluído.
import { compactarMonstro, completarMonstro, garantirUidAcimaDe } from '../hunt/monstros.mjs';
import * as Mapas from './mapas.mjs';

/** Os portais de cada mapa aberto (mapas.json → dispositivo.portais; 6, como no PoE). */
export const portaisPorMapa = () => Math.max(1, Number(Mapas.DADOS.dispositivo?.portais) || 6);

/** O registro do endgame do personagem (criado na primeira vez). */
export function doPersonagem(estado) {
  const m = (estado.mapas ??= {});
  m.aberto ??= null;
  m.concluidos ??= 0;
  m.falhos ??= 0;
  m.mortes ??= 0;
  m.maiorTier ??= 0;
  m.porTier ??= {};
  m.ultimo ??= null;
  return m;
}

/** Um id para o mapa aberto (não precisa ser global: só não pode repetir no mesmo personagem). */
const novoId = () => `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** Registra o mapa aberto (a peça já validada; quem consome a peça é o dispositivo, DEPOIS de a instância nascer). */
export function abrir(estado, peca, { agora = Date.now() } = {}) {
  const st = doPersonagem(estado);
  const tier = Mapas.tierDaBase(peca?.poe?.base);
  st.aberto = {
    id: novoId(),
    tier,
    nivel: Mapas.nivelDoTier(tier),
    nome: peca.poe?.nome ?? `Mapa (Nível ${tier})`,
    peca,
    portais: portaisPorMapa(),
    portaisMax: portaisPorMapa(),
    mortes: 0,
    abertoEm: agora,
    cacada: null,
  };
  return st.aberto;
}

/** A caçada do mapa aberto deste personagem (a dele, como dono da sala), ou null. */
export function cacadaDoAberto(estado) {
  const a = estado?.mapas?.aberto;
  const h = estado?.hunt;
  return a && h && !h.anfitriao && h.mapa?.id === a.id ? h : null;
}

/** Fecha o mapa aberto com o `resultado` (`concluido` | `falhou` | `abandonado`) e anota nas estatísticas. Devolve o `ultimo`. */
export function encerrar(estado, resultado, agora = Date.now()) {
  const st = doPersonagem(estado);
  const a = st.aberto;
  if (!a) return null;
  if (resultado === 'concluido') contarConclusao(estado, a.tier);
  else st.falhos++;
  st.ultimo = { tier: a.tier, resultado, em: agora, duracaoMs: Math.max(0, agora - (a.abertoEm ?? agora)), mortes: a.mortes ?? 0 };
  st.aberto = null;
  return st.ultimo;
}

/** Um mapa do tier concluído por este personagem (o dono ou alguém da party que estava na sala). */
export function contarConclusao(estado, tier) {
  const st = doPersonagem(estado);
  st.concluidos++;
  st.porTier[tier] = (st.porTier[tier] ?? 0) + 1;
  st.maiorTier = Math.max(st.maiorTier, Number(tier) || 0);
}

/**
 * Você saiu da caçada do SEU mapa aberto (parou, trocou de caçada, caiu o servidor, morreu): guarda os monstros vivos e a instância para a
 * volta. `morreu`: gasta um portal (e o chefe do mapa se cura); sem portal sobrando o mapa acaba (`falhou`). Outra caçada: nada.
 * Devolve `{ portais, falhou }` ou null.
 */
export function guardarAoSair(estado, { morreu = false, agora = Date.now() } = {}) {
  const a = estado?.mapas?.aberto;
  const h = cacadaDoAberto(estado);
  if (!a || !h) return null;
  if (morreu) {
    a.portais = Math.max(0, (a.portais ?? 0) - 1);
    a.mortes = (a.mortes ?? 0) + 1;
    doPersonagem(estado).mortes++;
  }
  if (a.portais <= 0) {
    encerrar(estado, 'falhou', agora);
    return { portais: 0, falhou: true };
  }
  const guardar = (lista) =>
    (Array.isArray(lista) ? lista : [])
      .filter((m) => m.hp > 0)
      .map((m) => {
        if (morreu && m.chefeDoMapa) m.hp = m.maxHp;
        return compactarMonstro(m);
      });
  const porAndar = { [h.z ?? 0]: guardar(h.monstros) };
  for (const [z, lista] of Object.entries(h.outrosAndares ?? {})) porAndar[z] = [...(porAndar[z] ?? []), ...guardar(lista)];
  a.cacada = { porAndar, instancia: h.instancia ?? null, salvoEm: agora };
  return { portais: a.portais, falhou: false };
}

/**
 * A volta ao mapa: põe os monstros guardados e a instância na caçada NOVA (`hunt`, recém-criada por `Cacadas.entrar` no mesmo tier) — os
 * do andar onde ela nasce em `monstros`, os outros em `outrosAndares`; o que estiver na casa de entrada sai do caminho. Uma vez só (a
 * cópia guardada é apagada). Devolve true se havia o que retomar.
 */
export function retomar(estado, hunt) {
  const a = estado?.mapas?.aberto;
  const c = a?.cacada;
  if (!c || !hunt) return false;
  let maior = 0;
  const andares = {};
  for (const [z, lista] of Object.entries(c.porAndar ?? {})) {
    andares[z] = lista.map((m) => {
      completarMonstro(m);
      if (Number(m.uid) > maior) maior = Number(m.uid);
      return m;
    });
  }
  garantirUidAcimaDe(maior);
  const z = String(hunt.z ?? 0);
  hunt.monstros = (andares[z] ?? []).filter((m) => !(m.x === hunt.pos.x && m.y === hunt.pos.y));
  delete andares[z];
  hunt.outrosAndares = andares;
  if (c.instancia) hunt.instancia = c.instancia;
  a.cacada = null;
  return true;
}

/** O mapa aberto para a tela (sem os monstros guardados). */
export function abertoParaTela(estado) {
  const a = estado?.mapas?.aberto;
  if (!a) return null;
  const naCacada = !!cacadaDoAberto(estado);
  return { id: a.id, tier: a.tier, nivel: a.nivel, nome: a.nome, peca: a.peca, portais: a.portais, portaisMax: a.portaisMax, mortes: a.mortes ?? 0, abertoEm: a.abertoEm, naCacada, guardado: !!a.cacada };
}
