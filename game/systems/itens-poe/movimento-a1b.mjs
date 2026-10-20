// (lote A1b, dono 19/10) A INVESTIDA CARREGADA (o "Avanço Fantasma" e o "Impulso Energizado da Projeção" do poedb — Charged Dash) e o resto das gemas
// de movimento do PoE que o lote A1 deixou parciais. Aqui ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB e do poedb) e
// as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no nível e o status) e `acoes.mjs` (o uso, a miragem no tempo, a fila do
// Teleporte, a Emboscada, a Corrida de Fase).
//
// As decisões do dono (19/10) — a Investida Carregada:
//   - I1: a MIRAGEM libera quando para (o fim da distância, a parede ou os 15 estágios). A opção do slot "Segurar a miragem no alvo"
//     (`action.segurarMiragem`): parada, ela segue pulsando com o "+150%" enquanto houver inimigo vivo na área dela; sem ninguém, libera.
//   - I2: a velocidade da miragem é a do PoE: 3,8 m/s × (1 + a Velocidade de Movimento aumentada) × 1,3 (a da Projeção: × 1,5).
//   - I3: anda rumo ao alvo; em cima dele, contorna o alvo até completar os 6,2 m de caminho; a parede a para.
//   - I4: o pulso cai em volta da miragem, com o raio do estágio.
//   - I5: pulsa nos usos 1, 3, 5…
//   - I6: o raio é o do poedb 3.29 ("AoE Radius 12-22, 2/stage"): 1,2 m + 0,2 m por estágio, até 2,2 m — no pulso e na onda final.
//   - I7: usar outra habilidade no meio libera (a onda final e o teleporte), como no PoE.
//   - Na liberação, a onda final ("75% de dano por estágio") e você teleporta para a miragem, sem marcar "moveu" (o wiki: "você não conta como se
//     movendo"); a da Projeção não teleporta.
// As outras gemas:
//   - D-a: a CARGA que pula a recarga (o Golpe Súbito com Frenesi, o do Poder com Poder, o Caminho Sagrado da Tolerância com Tolerância): na recarga e
//     com a carga, a gema SEMPRE gasta uma e sai, e a recarga em curso não recomeça.
//   - D-b: a EMBOSCADA vale também no golpe básico corpo a corpo, e só com arma de uma mão; ela traz o Impelir, o crítico e a cegueira de 3 s no alvo.
//   - D-c: a FILA do Teleporte Relampejante, até 50: durante a espera, a barra só lança o Teleporte de novo, e a conjuração do próximo corre junto da
//     espera do anterior.
//   - D-d: TRESPASSAR (a Corrida de Fase e o Passo Definhante) no idle: o caminho não desvia de bicho, e o passo que cairia na casa de um bicho pula
//     por cima dele até a próxima casa livre (o "passa por cima" do A1).
//   - D-e: a CORRIDA DE FASE — o próprio uso que encerra o buff de velocidade recebe os 30% (como no PoB); a duração por Frenesi removida (3 Frenesis:
//     1,8 s × 4 = 7,2 s).
//   - D-f: o AVANÇO ARDENTE DO RETORNO usa a Causticação que o jogo já tem (a força e os 4 s da conversão do Incêndio — `afeccoes.mjs`).
//   - O resto pela regra do PoE: a velocidade e a carga no acerto do Golpe Súbito; o Teleporte Gélido da Explosão Invernal (15% mais por cada 5% de
//     Resfriamento — × 1,9 contra 30% no q0 — e o Resfriamento some); o raio por Fúria da Corrente com Gancho (30 de Fúria = 3,0 m); o atordoamento
//     da Investida com Escudo (75% × casas ÷ máximo).
//
// EXCEÇÕES DO DONO (19/10, as escolhas sem fonte do lote A1b, aceitas): (1) a casa da miragem é a do caminho em round(metros ÷ 2) (1 casa = 2 m,
// Chebyshev); o contorno do alvo vai no sentido horário, a partir da casa que segue o rumo; (2) o canalizar novo só começa com o alvo a até 4 casas; (3)
// o pulso e a onda caem numa área quadrada, a fração do raio como chance de uma casa a mais, × √ da Área de Efeito; (4) na liberação, o pulso (no uso
// ímpar) e a onda final saem no mesmo uso; (5) o teleporte vai para a casa livre mais perto no caminho da miragem, de trás para a frente; (6) a
// velocidade de movimento da miragem é a razão da ficha (a velocidade ÷ a do nível, entre 0,25 e 2), como o atraso do Teleporte do A1; (7) o canalizar
// acaba um tique (250 ms) depois do último uso; na troca de andar a miragem some sem onda; (8) a Emboscada conjurada não guarda o alvo: o cegado é o
// bicho colado (o alvo da caçada, ou o mais perto); (9) a fila do Teleporte Relampejante cai inteira se um deles falhar ou a conjuração for
// interrompida; (10) Trespassar vale no passo de perseguir, de seguir a party, no clique e na tecla; pula até 3 casas; (11) a Corrida de Fase usa a base
// de 1,8 s (sem o piso de 2 s dos buffs de guarda: sem Frenesi, 2,0 → 1,8 s); os 30% também valem no golpe básico e, nos 0,2 s, no totem; (12) o
// Resfriamento da Explosão Invernal é o `lento` do bicho (o mesmo campo do Mutilar e do Desacelerar); (13) a carga que pula a recarga é gasta antes do
// golpe.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// ---------------------------------------------------------------- a Investida Carregada (a miragem)

/**
 * Os números da miragem que a gema não escreve: o máximo de estágios (o PoB, act_dex.lua:3906 e :4031 — 15), a distância que ela anda (o wiki: ~62
 * unidades = 6,2 m), a velocidade-base de movimento do PoE (38 unidades/s = 3,8 m/s — o wiki), o raio do poedb 3.29 (I6: 1,2 m + 0,2 m por estágio,
 * até 2,2 m) e o pulso "a cada 2 tempos de ataque" (o PoB — I5: nos usos 1, 3, 5…).
 */
export const MIRAGEM_POE = Object.freeze({ maxEstagios: 15, distanciaM: 6.2, velBaseMps: 3.8, raioBaseM: 1.2, raioPorEstagioM: 0.2, raioMaxM: 2.2, pulsoCada: 2 });
/** As duas Investidas: a normal teleporta você no fim; a da Projeção só solta a miragem (o PoB). O resto vem das linhas. */
export const MIRAGEM = Object.freeze({
  Charged_Dash: { teleporta: true, velMult: 1.3, finalPorEstagioPct: 75, paradaMaisPct: 150 },
  Charged_Dash_of_Projection: { teleporta: false, velMult: 1.5, finalPorEstagioPct: 125, paradaMaisPct: 150 },
});
const LINHA_DA_VELOCIDADE = /^A Ilusão se move com ([\d.]+) % da sua Velocidade de Movimento$/i;
const LINHA_DA_VELOCIDADE_Q = /^A Ilusão se move com um adicional de \+?([\d.]+) % da sua Velocidade de Movimento$/i;
const LINHA_DA_ONDA = /^Acertos da onda final causam? \+?([\d.]+) % de dano por estágio$/i;
const LINHA_DA_PARADA = /^Causa \+ ?([\d.]+) % de dano com ataques ao canalizar, se a Ilusão terminou seu movimento$/i;
/**
 * A miragem da gema no nível e na qualidade: `{ teleporta, velMult, finalPorEstagioPct, paradaMaisPct, ...MIRAGEM_POE }` ou null. A velocidade
 * ("A Ilusão se move com 130% da sua Velocidade de Movimento" + a qualidade "+X%"), a onda final ("Acertos da onda final causam 75% de dano por
 * estágio" + a qualidade da Projeção "Acertos da Onda final causa X% de Dano por estágio") e o "+150% … se a Ilusão terminou seu movimento".
 */
export function miragemDasLinhas(slug, linhas = [], daQualidade = []) {
  const d = MIRAGEM[slug];
  if (!d) return null;
  const vel = achar(linhas, LINHA_DA_VELOCIDADE);
  const final = achar(linhas, LINHA_DA_ONDA);
  const parada = achar(linhas, LINHA_DA_PARADA);
  return {
    ...MIRAGEM_POE, teleporta: d.teleporta,
    velMult: (vel != null ? vel / 100 : d.velMult) + somar(daQualidade, LINHA_DA_VELOCIDADE_Q) / 100,
    finalPorEstagioPct: (final ?? d.finalPorEstagioPct) + somar(daQualidade, LINHA_DA_ONDA),
    paradaMaisPct: parada ?? d.paradaMaisPct,
  };
}
/** (I6) O raio da miragem no estágio, em metros (o do pulso e o da onda final). */
export const raioDaMiragemM = (m, estagio) => Math.min(m.raioMaxM, m.raioBaseM + m.raioPorEstagioM * Math.max(0, estagio));
/** (I2) A velocidade da miragem em m/s: 3,8 × (1 + a Velocidade de Movimento aumentada) × o "% da sua Velocidade de Movimento" da gema. */
export const velocidadeDaMiragem = (m, fatorDeMovimento = 1) => m.velBaseMps * Math.max(0, fatorDeMovimento) * m.velMult;
/** (I5) O uso `n` (1, 2, 3…) do canalizar pulsa? (os ímpares — o primeiro já acerta) */
export const pulsaNoUso = (m, n) => (n - 1) % Math.max(1, m.pulsoCada) === 0;

const ANEL = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
/**
 * (I3) A MIRAGEM ANDA `metros` (o estado `mir` — `{ pos, andadoM, caminho, parou, chegou }` — não é mudado: devolve o novo, com `moveu`). O caminho é
 * pela grade do jogador (1 casa = 2 m, Chebyshev, como o resto do jogo): a casa dela é a do caminho em round(metros andados ÷ 2) — ela é um ponto que
 * anda, a casa é onde ele está mais perto. Rumo ao alvo pela reta; em cima dele, contorna o alvo (as 8 casas em volta, no sentido horário) até
 * completar a distância; sem alvo, segue reto no rumo. A casa que não é andável (a parede) a para ali (`parou`), no meio do caminho até ela.
 */
export function andarMiragem(mir, metros, { alvo = null, andavel = null, distanciaM = MIRAGEM_POE.distanciaM, rumo = [0, 1] } = {}) {
  const novo = { ...mir, pos: { ...mir.pos }, caminho: [...mir.caminho] };
  if (novo.parou || !(metros > 0)) return { ...novo, moveu: false };
  let quer = Math.min(distanciaM, novo.andadoM + metros);
  const indice = Math.round(quer / 2);
  let [ux, uy] = novo.rumo ?? rumo;
  while (novo.caminho.length - 1 < indice) {
    const p = novo.pos;
    let prox = null;
    if (alvo && !novo.chegou && p.x === alvo.x && p.y === alvo.y) novo.chegou = true;
    if (alvo && novo.chegou) {
      // (contorna: o alvo andou para longe — volta a ir até ele)
      if (cheb(p, alvo) > 1) novo.chegou = false;
      else {
        const k = p.x === alvo.x && p.y === alvo.y
          // (em cima dele: a casa do anel que segue o rumo — a reta, não a diagonal)
          ? ANEL.reduce((melhor, [dx, dy], i) => ((dx * ux + dy * uy) / Math.hypot(dx, dy) > (ANEL[melhor][0] * ux + ANEL[melhor][1] * uy) / Math.hypot(...ANEL[melhor]) + 1e-9 ? i : melhor), 0)
          : (ANEL.findIndex(([dx, dy]) => alvo.x + dx === p.x && alvo.y + dy === p.y) + 1) % ANEL.length;
        prox = { x: alvo.x + ANEL[k][0], y: alvo.y + ANEL[k][1] };
      }
    }
    if (!prox && alvo && !novo.chegou) prox = { x: p.x + Math.sign(alvo.x - p.x), y: p.y + Math.sign(alvo.y - p.y) };
    if (!prox) prox = { x: p.x + Math.sign(ux), y: p.y + Math.sign(uy) };
    if (andavel && !andavel(prox.x, prox.y)) {
      // (a parede: para na casa de agora — os metros andados não passam da metade do caminho até a parede)
      novo.parou = true;
      quer = Math.min(quer, (novo.caminho.length - 1) * 2 + 0.999);
      break;
    }
    [ux, uy] = [prox.x - p.x, prox.y - p.y];
    novo.caminho.push(prox);
    novo.pos = prox;
    if (alvo && prox.x === alvo.x && prox.y === alvo.y) novo.chegou = true;
  }
  novo.rumo = [ux, uy];
  const moveu = quer > novo.andadoM + 1e-9;
  novo.andadoM = Math.max(novo.andadoM, quer);
  if (novo.andadoM >= distanciaM - 1e-9) novo.parou = true;
  return { ...novo, moveu };
}

// ---------------------------------------------------------------- D-a: a carga que pula a recarga

/** (D-a) A carga que a gema gasta para pular a recarga (o PoB: "The cooldown can be bypassed by expending a Frenzy Charge";
 * `active_skill_cooldown_bypass_type_override_to_power_charge` no do Poder; o Caminho Sagrado da Tolerância — a descrição da gema). */
// (revisão do A5, dono 20/10: + o Golpe Vigilante — "A recarga pode ser ignorada ao gastar uma Carga de Tolerância", a descrição; o PoB, VigilantStrike em act_str.lua)
// (lote B1, dono 20/10: + os Estalos Gélidos — o PoB: "The cooldown can be bypassed by expending a Frenzy Charge" no Estalo Gélido, "…a Power Charge" no do Poder,
// act_int.lua:2817 e :2906; o Vaal não tem recarga)
export const CARGA_QUE_PULA_A_RECARGA = Object.freeze({ Flicker_Strike: 'frenesi', Flicker_Strike_of_Power: 'poder', Consecrated_Path_of_Endurance: 'tolerancia', Vigilant_Strike: 'tolerancia', Cold_Snap: 'frenesi', Cold_Snap_of_Power: 'poder' });

// ---------------------------------------------------------------- o Golpe Súbito: as cargas no acerto

const LINHA_FRENESI_NO_ACERTO = /^([\d.]+) % de chance de receber uma Carga de Frenesi ao Acertar$/i;
const LINHA_PODER_NO_CRITICO = /^([\d.]+) % de chance de ganhar uma Carga de Poder em Acertos Críticos$/i;
/** As cargas que o acerto da gema dá ("15% de chance de receber uma Carga de Frenesi ao Acertar", "30% de chance de ganhar uma Carga de Poder em Acertos
 * Críticos" — o nível e a qualidade somados): `{ frenesiNoAcertoPct, poderNoCriticoPct }` ou null. */
export function cargasNoAcertoDasLinhas(linhas = [], daQualidade = []) {
  const todas = [...linhas, ...daQualidade];
  const frenesiNoAcertoPct = somar(todas, LINHA_FRENESI_NO_ACERTO);
  const poderNoCriticoPct = somar(todas, LINHA_PODER_NO_CRITICO);
  return frenesiNoAcertoPct || poderNoCriticoPct ? { frenesiNoAcertoPct, poderNoCriticoPct } : null;
}

// ---------------------------------------------------------------- a Emboscada

/**
 * (D-b) A EMBOSCADA (o PoB, act_dex.lua — Ambush): o buff ("Duração base é de 1.5 segundos") Impele o próximo ataque corpo a corpo com arma de uma mão
 * ("Ataques Impelidos têm +25% de Chance de Golpe Crítico" + a qualidade, "+(100 — 138)% de Multiplicador de Dano Crítico") e cega o alvo ("Duração
 * da penalidade base é de 3 segundos"). `{ critPontos, critMultPct, cegueiraMs }` ou null.
 */
export function emboscadaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Ambush') return null;
  const todas = [...linhas, ...daQualidade];
  return {
    critPontos: somar(todas, /^Ataques Impelidos têm \+([\d.]+) % de Chance de Golpe Crítico$/i),
    critMultPct: achar(linhas, /^Ataques Impelidos têm \+([\d.]+) % de Multiplicador de Dano Crítico$/i) ?? 0,
    cegueiraMs: Math.round((achar(linhas, /^Duração da penalidade base é de ([\d.]+) segundos?$/i) ?? 3) * 1000),
  };
}
/** As classes de arma de UMA mão (D-b: a Emboscada só Impele o ataque com uma delas). */
export const ARMA_DE_UMA_MAO = /^(One_Hand_Swords|Thrusting_One_Hand_Swords|One_Hand_Axes|One_Hand_Maces|Sceptres|Claws|Daggers|Rune_Daggers)$/;

// ---------------------------------------------------------------- o Teleporte Gélido da Explosão Invernal

/** (o PoB, act_int.lua — FrostblinkAltX) "15% mais Dano com Acertos por cada 5% de Efeito do Resfriamento no Inimigo" (+ a qualidade, "(0 — 4)%"): o
 * "mais" por degrau; o Resfriamento some depois do acerto e a gema não resfria. `{ porCada5Pct }` ou null. */
export function explosaoInvernalDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Frostblink_of_Wintry_Blast') return null;
  const porCada5Pct = somar([...linhas, ...daQualidade], /^([\d.]+) % mais Dano com Acertos por cada 5 ?% de Efeito do Resfriamento no Inimigo$/i);
  return { porCada5Pct, tiraResfriamento: true, naoResfria: true };
}
/** O "mais" contra o alvo com `resfriadoPct` de Resfriamento: 1 + X × floor(pct ÷ 5) (arredondado para baixo — o PoB). */
export const maisContraResfriado = (d, resfriadoPct) => 1 + ((d?.porCada5Pct ?? 0) * Math.floor(Math.max(0, Number(resfriadoPct) || 0) / 5 + 1e-9)) / 100;

// ---------------------------------------------------------------- a Corrente com Gancho

/** "+0.1 metro ao Raio por 5 de Fúria" (chain_strike_cone_radius_+_per_x_rage 5): os metros a mais com `furia`. */
export function raioPorFuriaDasLinhas(linhas = []) {
  for (const l of linhas) {
    const m = /^\+([\d.]+) metros? ao Raio por (\d+) de Fúria$/i.exec(norm(l));
    if (m) return { metros: Number(m[1]), cada: Number(m[2]) };
  }
  return null;
}
export const raioExtraPelaFuria = (r, furia) => (r ? r.metros * Math.floor(Math.max(0, furia) / Math.max(1, r.cada)) : 0);

// ---------------------------------------------------------------- a Investida com Escudo

/** "Redução do Ponto de Atordoamento aumentada em 75% em inimigos na distância Máxima da investida": o % no máximo (proporcional às casas — como o dano). */
export const atordoamentoDaInvestidaDasLinhas = (linhas = []) => achar(linhas, /^Redução do Ponto de Atordoamento aumentada em ([\d.]+) % em inimigos na distância Máxima da investida$/i) ?? 0;

// ---------------------------------------------------------------- a Corrida de Fase (o Passo Etéreo)

/**
 * (D-e) A CORRIDA DE FASE ANTIGA (o PoB, act_dex.lua — PhaseRun): gasta todas as Cargas de Frenesi no uso ("100% de aumento da Duração da Habilidade
 * por Carga de Frenesi removida"); o próximo uso de qualquer habilidade sua troca o buff pelo de "X% mais Dano Físico Corpo a Corpo" ("Duração Base
 * Secundária é de 0.2 segundos"). `{ duracaoPorFrenesiPct, maisFisicoCorpoPct, segundoMs }` ou null.
 */
export function corridaDeFaseDasLinhas(slug, linhas = []) {
  if (slug !== 'Old_Phase_Run') return null;
  return {
    duracaoPorFrenesiPct: achar(linhas, /^([\d.]+) % de aumento da Duração da Habilidade por Carga de Frenesi removida$/i) ?? 0,
    maisFisicoCorpoPct: achar(linhas, /^([\d.]+) % mais Dano Físico Corpo a Corpo$/i) ?? 0,
    segundoMs: Math.round((achar(linhas, /^Duração Base Secundária é de ([\d.]+) segundos?$/i) ?? 0.2) * 1000),
    // (a duração-base da gema, 1,8 s — o piso de 2 s dos buffs de guarda do jogo não vale nela: o dono quer os 7,2 s com 3 Frenesis)
    duracaoBaseMs: Math.round((achar(linhas, /^Duração base é de ([\d.]+) segundos?$/i) ?? 1.8) * 1000),
  };
}
/** (D-d) As gemas cujo buff concede Trespassar ("Buff concede Trespassar"). */
export const TRESPASSAM = Object.freeze(['Old_Phase_Run', 'Withering_Step']);

// ---------------------------------------------------------------- o Avanço Ardente do Retorno

/** (D-f) "X% de chance de Causticar Inimigos" (a qualidade do Avanço Ardente do Retorno). */
export const chanceDeCausticarDasLinhas = (linhas = []) => somar(linhas, /^([\d.]+) % de chance de Causticar Inimigos$/i);

// ---------------------------------------------------------------- o Teleporte Relampejante

/** (D-c) "Pode aglomerar até 50 usos" (max_number_of_lightning_warp_markers 50). */
export const filaDoTeleporteDasLinhas = (slug, linhas = []) => (/^Lightning_Warp/.test(slug) ? achar(linhas, /^Pode aglomerar até (\d+) usos$/i) ?? 0 : 0);

// ---------------------------------------------------------------- o status

const LINHAS_DA_MIRAGEM = [LINHA_DA_VELOCIDADE, LINHA_DA_VELOCIDADE_Q, LINHA_DA_ONDA, LINHA_DA_PARADA];
const LINHAS_DA_EMBOSCADA = /^Duração base é de [\d.]+ segundos?$|^Buff é removido para Impelir o próximo Ataque Corpo a Corpo que você executar Ataques Impelidos por esta Habilidade não podem ser Impelidos por outras Habilidades$|^Ataques Impelidos têm \+[\d.]+ % de (?:Chance de Golpe Crítico|Multiplicador de Dano Crítico)$|^Duração da penalidade base é de [\d.]+ segundos?$/i;
const LINHAS_DA_EXPLOSAO_INVERNAL = /^Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada$|^Não pode infligir Resfriamento$|^[\d.]+ % mais Dano com Acertos por cada 5 ?% de Efeito do Resfriamento no Inimigo$|^Remove Resfriamentos após Causar Dano$/i;
const LINHAS_DA_CORRIDA = /^[\d.]+ % mais Dano Físico Corpo a Corpo$|^[\d.]+ % de aumento da Duração da Habilidade por Carga de Frenesi removida$|^Buff concede Trespassar$/i;
/** (lote A1b) As linhas que o lote faz, pela gema (saem do "efeito não simulado" — `GemasPoe.statusNoJogo`). */
export function ehLinhaA1b(slug, l) {
  const t = norm(l);
  if (MIRAGEM[slug] && LINHAS_DA_MIRAGEM.some((re) => re.test(t))) return true;
  if (/^Flicker_Strike/.test(slug) && (LINHA_FRENESI_NO_ACERTO.test(t) || LINHA_PODER_NO_CRITICO.test(t))) return true;
  if (slug === 'Ambush' && LINHAS_DA_EMBOSCADA.test(t)) return true;
  if (slug === 'Frostblink_of_Wintry_Blast' && LINHAS_DA_EXPLOSAO_INVERNAL.test(t)) return true;
  if (/^Lightning_Warp$/.test(slug) && /^Pode aglomerar até \d+ usos$/i.test(t)) return true;
  if (slug === 'Chain_Hook' && /^\+[\d.]+ metros? ao Raio por \d+ de Fúria$/i.test(t)) return true;
  if (slug === 'Shield_Charge' && /^Redução do Ponto de Atordoamento aumentada em [\d.]+ % em inimigos na distância Máxima da investida$/i.test(t)) return true;
  if (slug === 'Old_Phase_Run' && LINHAS_DA_CORRIDA.test(t)) return true;
  if (slug === 'Withering_Step' && /^Buff concede Trespassar$/i.test(t)) return true;
  if (slug === 'Flame_Dash_of_Return' && /^[\d.]+ % de chance de Causticar Inimigos$/i.test(t)) return true;
  return false;
}
