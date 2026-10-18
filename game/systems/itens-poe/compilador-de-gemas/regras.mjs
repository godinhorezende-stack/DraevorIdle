// Veio da coleção do dono (poe-gemas-poedb/engine/src/gemas/regras.mjs) para o repositório em 08/10/2026: agora é código do jogo — mude aqui.
// Catálogo de regras: cada linha de modificador (já no nível escolhido) é testada
// contra estas regex. A primeira que casar aplica o efeito no objeto de stats.
// Linhas que não casam com nada viram "não implementado" no relatório de status —
// é assim que a engine sabe dizer honestamente o que funciona e o que não.
//
// Uma regra que devolve `false` reconheceu a linha (guarda o texto para exibir) mas a
// mecânica não é simulada na arena -> também conta como não implementada.

const N = String.raw`(-?\d+(?:\.\d+)?)`;
const r = (s) => new RegExp(s, "i");
const num = (x) => parseFloat(x);
const sinal = (m) => (/menos|redu/i.test(m) ? -1 : 1);

export const ELEMENTO = {
  físico: "fisico", fisico: "fisico", fogo: "fogo", gelo: "gelo", frio: "gelo", raio: "raio", caos: "caos",
};
const el = (s) => ELEMENTO[String(s).toLowerCase()] || null;
const EL = "(Físico|Fogo|Gelo|Frio|Raio|Caos)";
const TODOS = ["fogo", "gelo", "raio"];

export function statsVazios() {
  return {
    dano: {}, // {fogo:[min,max]} acerto da habilidade
    adicional: {}, // dano adicionado a ataques
    dot: [], // [{el, dps}] dano degenerativo por segundo
    dotPctVida: null, // Fogo Justo: % da vida do conjurador por segundo
    conversao: [], // [{para, pct}]
    chances: {}, // incendiar, congelar, eletrizar, envenenar, sangrar, empalar
    raio: null,
    raioBonus: 0,
    areaMais: 0,
    duracao: null,
    duracao2: null,
    duracaoObjeto: null,
    projeteis: null,
    projeteisExtra: 0,
    circulo: false,
    perfura: 0,
    ricochetes: 0,
    alvosAdicionais: 0,
    repeticoes: null,
    maximo: null,
    lacaioDano: 0,
    lacaioDanoBase: 100,
    lacaioVida: 0,
    lacaioVelAtaque: 0,
    lacaioVelMov: 0,
    critico: 0,
    // (17/10, lote G18) o "até X% mais Dano com Acertos aos alvos próximos" (`maisPertoNoNivel`), o "Projéteis causam X% …" dos projéteis
    // secundários e o quinto ataque do Golpe Vulcânico do Zênite (`projeteisDaGema`) — lidos no `disparar`
    maisPertoPct: 0,
    maisProjetilPct: 0,
    quintoMaisPct: 0,
    quintoProjeteis: 0,
    velRecarga: 0,
    tempoAtaqueExtra: 0,
    // (17/10, lote G18) o "mais/menos" só das afecções da própria gema (lido no `acertar` — `GemasPoe.maisNasAfeccoesDaGema`)
    maisAfeccaoPct: 0,
    maisSangramentoPct: 0,
    cull: false,
    sempreAtordoa: false,
    estagios: null,
    raioPorEstagio: 0,
    lentidaoAcerto: 0,
    danoRecebidoAcerto: 0,
    maldicao: { resist: {}, danoRecebido: 0, lentidao: 0, menosDano: 0, textos: [] },
    buff: {
      adicional: {}, extra: [], maisDano: 0, velAtaque: 0, velConj: 0, velMov: 0, critico: 0, resist: {},
      armadura: 0, evasao: 0, escudo: 0, regen: 0, regenMana: 0, menosDanoRecebido: 0, absorve: 0, imuneAfeccoes: false, textos: [],
    },
    flags: new Set(),
  };
}

// [regex, aplicar(stats, match)]
export const REGRAS = [
  // ---------------- dano ----------------
  [r(`Causa (?:de )?${N} a ${N} de Dano (?:de |De )?${EL}(?! adicional)`), (s, m) => (s.dano[el(m[3])] ??= [num(m[1]), num(m[2])])],
  [r(`Causa ${N} (?:de |do )?Dano (?:de )?${EL} Base por segundo`), (s, m) => s.dot.push({ el: el(m[2]), dps: num(m[1]) })],
  [r(`Causa ${N} % de sua Vida Máxima como Dano Base de ${EL} por segundo`), (s, m) => (s.dotPctVida = { el: el(m[2]), pct: num(m[1]) })],
  [r(`(?:Causa ${N} % do seu Escudo de Energia|Você Queima por)`), () => false],
  // (17/10, lote G4: "… de Dano Físico Adicional por cada 15 de Armadura ou Evasão no escudo" é por defesa do escudo — `GemasPoe.escudoDaGema` —,
  // não o adicional fixo; antes o Golpe de Escudo somava os 3–8 a 5–12 a todo ataque, com ou sem escudo)
  [r(`^${N} a ${N} de Dano (?:de )?${EL} Adicional(?! por)`), (s, m) => (s.adicional[el(m[3])] = [num(m[1]), num(m[2])])],
  [r(`^${N} a ${N} de dano ${EL} adicionado$`), (s, m) => (s.adicional[el(m[3])] = [num(m[1]), num(m[2])])],
  [r(`${N} % (?:do|de) Dano Físico Convertido (?:em|para) Dano de ${EL}`), (s, m) => s.conversao.push({ para: el(m[2]), pct: num(m[1]) })],
  [r(`Converte[m]? ${N} % do Dano Físico (?:para|em) Dano de ${EL}`), (s, m) => s.conversao.push({ para: el(m[2]), pct: num(m[1]) })],
  [r(`${N} % de Dano Físico Convertido em Dano de Fogo, Gelo ou Raio`), (s, m) => s.conversao.push({ para: "aleatorio", pct: num(m[1]) })],
  // (17/10, lote G18) o "mais Dano" das ativas: antes ia a `stats.maisDano`, que ninguém lia (as linhas sumiam do status como "aplicadas"):
  // - "Concede X% mais Dano Mágico" (o Fogo Justo) é linha de BUFF (`linhas-das-gemas`, `mais_dano_acerto@magia` — só no acerto das magias);
  // - "Causa X% mais Dano" (a coluna do Impacto Sísmico Vaal no nível 1 — não é do PoE 1) fica não feita;
  // - "Projéteis causam X% …" vale nos projéteis secundários (o golpe direto é o corpo a corpo do PoB) e o quinto ataque do Zênite;
  // - "até X% mais Dano com Acertos aos alvos próximos" vale só no acerto, no alvo perto.
  [r(`^Concede ${N} % mais Dano Mágico$`), () => false],
  [r(`^Causa ${N} % mais Dano$`), () => false],
  [r(`^A cada cinco Ataques, Projéteis causam \\+?${N} % mais Dano com Acertos e Afecções$`), (s, m) => (s.quintoMaisPct += num(m[1]))],
  [r(`^Cada quinto Ataque dispara ${N} Projéteis adicionais$`), (s, m) => (s.quintoProjeteis = num(m[1]))],
  [r(`^Projéteis causam \\+?${N} % (mais|menos) Dano com Acertos e Afecções$`), (s, m) => (s.maisProjetilPct += num(m[1]) * sinal(m[2]))],
  [r(`^Causa até \\+?${N} % mais Dano com Acertos aos alvos próximos$`), (s, m) => (s.maisPertoPct += num(m[1]))],
  [r(`^\\+${N} % à Chance de Crítico`), (s, m) => (s.critico += num(m[1]))],
  // (17/10, lote G18: o "mais/menos" só das afecções de dano — o Punho Esmagador, a Descarga… — e o só do Sangramento — a Punctura, a Laceração…;
  // o da qualidade, "+20 % mais dano com sangramento", soma no mesmo, como no PoE. Antes iam a `afeccaoMais`, que ninguém lia.)
  [r(`^${N} % (mais|menos) Dano (?:de|com) Afecções$`), (s, m) => (s.maisAfeccaoPct += num(m[1]) * sinal(m[2]))],
  [r(`^\\+?${N} % (mais|menos) Dano com Sangramento$`), (s, m) => (s.maisSangramentoPct += num(m[1]) * sinal(m[2]))],
  [r(`Golpe de Misericórdia`), (s) => (s.cull = true)],
  // (17/10, lote G18) o "por cada Ricochete restante" é feito por `GemasPoe.alvosNoNivel` (`pctPorRestante`) → `Acoes.atacar`; o "por estágio"
  // pelos estágios de canalização (`GemasPoe.estagiosDaGema`) — a linha vai para `naoImplementadas` e o status a tira só onde há estágios (antes
  // ia a `danoPorEstagio`, que ninguém lia: a Ira Divina, o Snipe e a Rajada Vaal pareciam feitos)
  [r(`${N} % mais Dano com Acertos e Afecções por cada Ricochete restante`), () => {}],
  [r(`${N} % mais Dano(?: Mágico| com Acertos e Afecções| com Afecções| com Acertos)? por (?:estágio|Estágio)`), () => false],

  // ---------------- afecções no acerto ----------------
  [r(`${N} % de chance de Congelar, Eletrizar e Incendiar`), (s, m) => (s.chances.congelar = s.chances.eletrizar = s.chances.incendiar = num(m[1]))],
  [r(`${N} % de chance de Incendiar`), (s, m) => (s.chances.incendiar = num(m[1]))],
  [r(`${N} % de chance de Congelar`), (s, m) => (s.chances.congelar = num(m[1]))],
  [r(`${N} % de chance de Eletrizar`), (s, m) => (s.chances.eletrizar = num(m[1]))],
  [r(`${N} % de chance de Envenenar`), (s, m) => (s.chances.envenenar = num(m[1]))],
  [r(`${N} % de chance de (?:causar|infligir) Sangramento`), (s, m) => (s.chances.sangrar = num(m[1]))],
  [r(`${N} % de chance de Empalar`), (s, m) => (s.chances.empalar = num(m[1]))],
  [r(`^Sempre Congela`), (s) => (s.chances.congelar = 100)],
  [r(`^Sempre Incendeia`), (s) => (s.chances.incendiar = 100)],
  [r(`^Sempre Eletriza`), (s) => (s.chances.eletrizar = 100)],
  [r(`^Causa Sangramento`), (s) => (s.chances.sangrar = 100)],
  [r(`^Não Pode aplicar Eletrizar`), (s) => (s.chances.eletrizar = -1)],
  // (17/10, lote G18: o "como se causasse", o Efeito e a Duração das afecções de Gelo/Eletrização são linhas LOCAIS da gema — `linhas-das-gemas`,
  // `*_como_mais`, `efeito_*`, `duracao_*` lidos em `afeccoes.daSoma`; antes iam a chaves que ninguém lia, com divisores inventados)
  [r(`(?:Eletriza|Resfria|Congela|Incendeia) Inimigos como se causasse ${N} % mais Dano`), () => false],
  [r(`Efeito de (?:Eletrização|Afecções de Gelo) aumentado em ${N}`), () => false],
  [r(`Duração de Afecções de Gelo aumentada em ${N}`), () => false],
  [r(`Acertos que Causam Dano sempre Atordoam`), (s) => (s.sempreAtordoa = true)],
  [r(`Atordoamento`), (s) => s.flags.add("atordoa")],
  [r(`^Velocidade de Movimento reduzida em ${N} %`), (s, m) => (s.lentidaoAcerto = num(m[1]))],
  [r(`Inimigos possuem ${N} % menos Velocidade de Movimento`), (s, m) => (s.lentidaoAcerto = num(m[1]))],
  [r(`Trava o inimigo no lugar`), (s) => (s.lentidaoAcerto = 100)],
  [r(`Dano de ${EL} sofrido aumentado em ${N}`), (s, m) => (s.danoRecebidoAcerto = num(m[2]))],
  [r(`Definhado dura ${N} segundos`), (s, m) => (s.duracao2 = num(m[1]))],
  [r(`Inimigos recebem ${N} % de aumento de Dano dos Acertos de Minas ou Armadilhas`), (s, m) => (s.maldicao.danoRecebido += num(m[1]))],

  // ---------------- área / duração ----------------
  [r(`O raio Base é de ${N} metros?`), (s, m) => (s.raio = num(m[1]))],
  // (lote G10: as transfiguradas da Rajada de Chamas escrevem sem o "O": "Raio Base é de 3 metros")
  [r(`^Raio Base é de ${N} metros?$`), (s, m) => (s.raio = num(m[1]))],
  [r(`^-${N} metros ao raio por Estágio$`), (s, m) => (s.raioPorEstagio = -num(m[1]))],
  [r(`Raio Base da (?:explos[aã]o|Aura) igual a ${N}`), (s, m) => (s.raio = num(m[1]))],
  [r(`Raio do Estouro é de ${N}`), (s, m) => (s.raio = num(m[1]))],
  [r(`Raio de (?:implosão|alcance base do impacto do martelo) (?:base )?é de ${N}`), (s, m) => (s.raio = num(m[1]))],
  [r(`Raio de alcance secundário base é de ${N}`), (s, m) => (s.raio2 = num(m[1]))],
  [r(`^\\+?${N} metros? (?:de|ao) raio$`), (s, m) => (s.raioBonus += num(m[1]))],
  [r(`^${N} % (mais|menos) Área de Efeito$`), (s, m) => (s.areaMais += num(m[1]) * sinal(m[2]))],
  // (17/10, lote G2: o "aumentada" é aditivo com o das peças e dos suportes — `areaInc`; o "mais/menos" multiplica — `areaMais`)
  // (lote G10: "… aumentada em 15% por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional" — o Ciclone do Tumulto — é por alcance, não
  // fixo; segue "não simulado")
  [r(`^Área de Efeito aumentada em ${N} ?%?$`), (s, m) => (s.areaInc = (s.areaInc ?? 0) + num(m[1]))],
  [r(`\\+${N} metros ao raio por (?:estágio|Estágio)`), (s, m) => (s.raioPorEstagio = num(m[1]))],
  [r(`${N} % mais Área de Efeito por cada estágio`), (s, m) => (s.raioPorEstagio = num(m[1]) / 100)],
  // (lote G18: os ESPOROS da Flecha Flagelante não existem no jogo — o máximo vale, a linha fica não feita)
  [r(`^Máximo de ${N} Estágios Deixa \\d+ Esporos? por Estágio$`), (s, m) => { s.estagios = num(m[1]); return false; }],
  [r(`^Cada Esporo dispara`), () => false],
  [r(`^Máximo de ${N} Estágios`), (s, m) => (s.estagios = num(m[1]))],
  [r(`^\\+?${N} ao máximo de Estágios`), (s, m) => (s.estagios = (s.estagios || 0) + num(m[1]))],
  [r(`Duração base é de ${N} segundos?`), (s, m) => (s.duracao = num(m[1]))],
  // (lote G2: a qualidade — "+(0 — 2) segundos à duração base": soma na duração base, depois de lida)
  [r(`^\\+${N} segundos? à duração base$`), (s, m) => (s.duracaoBonus = (s.duracaoBonus ?? 0) + num(m[1]))],
  [r(`Duração Base Secundária é de ${N}`), (s, m) => (s.duracao2 = num(m[1]))],
  [r(`(?:Armadilha|Totem|Mina) dura ${N}`), (s, m) => (s.duracaoObjeto = num(m[1]))],
  [r(`Tempo Base de Detonação de Mina é de ${N}`), (s, m) => (s.detonacao = num(m[1]))],

  // ---------------- projéteis / alvos ----------------
  [r(`^Dispara ${N} Projéteis adicionais`), (s, m) => (s.projeteisExtra += num(m[1]))],
  [r(`Dispara ${N} (?:projéteis|Flechas|Projéteis)`), (s, m) => (s.projeteis = num(m[1]))],
  [r(`Dispara Projéteis em um círculo`), (s) => (s.circulo = true)],
  [r(`Projéteis Perfuram todos Alvos`), (s) => (s.perfura = 99)],
  [r(`Perfura ${N} alvos? adiciona`), (s, m) => (s.perfura += num(m[1]))],
  [r(`Ricocheteia \\+${N} Vezes`), (s, m) => (s.ricochetes = num(m[1]))],
  [r(`Acerta até ${N} inimigos adicionais`), (s, m) => (s.alvosAdicionais = num(m[1]))],
  [r(`Projéteis se Partem na direção de ${N} alvos`), (s, m) => (s.alvosAdicionais = num(m[1]))],
  [r(`${N} % mais Velocidade de Projétil`), (s, m) => (s.velProjetilMais = num(m[1]))],
  [r(`^\\+${N} metros ao Alcance de Golpes Corpo a Corpo`), (s, m) => (s.alcanceExtra = num(m[1]))],
  [r(`(?:Cria ${N} fissuras|Golpeia ${N} Áreas|Onda causa Dano em ${N} Áreas|^${N} Rajadas)`), (s, m) => (s.repeticoes = num(m[1] || m[2] || m[3] || m[4]))],
  [r(`^Máximo de ${N} `), (s, m) => (s.maximo = num(m[1]))],
  [r(`^Máximno de ${N} `), (s, m) => (s.maximo = num(m[1]))],
  [r(`^Convoca ${N} `), (s, m) => (s.maximo = Math.max(s.maximo || 0, num(m[1])))],

  // ---------------- lacaios / totens / cadáveres ----------------
  [r(`Lacaios? (?:causam|causa) ${N} % (mais|menos) Dano$`), (s, m) => (s.lacaioDano += num(m[1]) * sinal(m[2]))],
  [r(`^Lacaios causam ${N} % de Dano$`), (s, m) => (s.lacaioDanoBase = num(m[1]))],
  [r(`Lacaios (?:têm|tem) ${N} % mais Vida Máxima`), (s, m) => (s.lacaioVida += num(m[1]))],
  [r(`Lacaios (?:têm|tem) ${N} % mais Velocidade de Ataque`), (s, m) => (s.lacaioVelAtaque += num(m[1]))],
  [r(`${N} % mais Velocidade de Movimento dos Lacaios`), (s, m) => (s.lacaioVelMov += num(m[1]))],
  [r(`Ataques de Lacaios causam ${N} a ${N} de Dano ${EL} adicional`), (s, m) => (s.lacaioAdicional = [num(m[1]), num(m[2])])],
  [r(`Invoca um Totem`), (s) => s.flags.add("totem")],
  [r(`^\\+${N} ao número máximo de Totens`), (s, m) => (s.totensExtra = num(m[1]))],
  [r(`Explosão causa Dano de ${EL} base igual a ${N} % da Vida Máxima do Cadáver`), (s, m) => (s.cadaver = { el: el(m[1]), pct: num(m[2]) })],
  [r(`Consome até ${N} cadáveres`), (s, m) => (s.cadaveres = num(m[1]))],

  // ---------------- maldições / debuffs em inimigos ----------------
  [r(`Inimigos Amaldiçoados (?:possuem|têm|tem) ${N} % (?:de|em) Resistência a ${EL}`), (s, m) => (s.maldicao.resist[el(m[2])] = num(m[1]))],
  [r(`Inimigos Amaldiçoados (?:possuem|têm|tem) ${N} % (?:de|em|a todas as) Resistências? Elementa`), (s, m) => TODOS.forEach((e) => (s.maldicao.resist[e] = num(m[1])))],
  [r(`Inimigos Amaldiçoados (?:recebem|sofrem) ${N} % (?:de aumento de |mais )?Dano`), (s, m) => (s.maldicao.danoRecebido += num(m[1]))],
  [r(`Inimigos (?:Normais e Mágicos )?Amaldiçoados (?:têm|tem|possuem) ${N} % menos Velocidade de Ação`), (s, m) => (s.maldicao.lentidao = Math.max(s.maldicao.lentidao, num(m[1])))],
  [r(`Inimigos Raros e Únicos Amaldiçoados (?:têm|tem) ${N} % menos`), () => {}],
  [r(`Inimigos (?:Normais e Mágicos )?Amaldiçoados causam ${N} % menos Dano`), (s, m) => (s.maldicao.menosDano = num(m[1]))],
  [r(`Inimigos Amaldiçoados (?:têm|possuem) Velocidade de (?:Ação|Movimento) reduzida em ${N}`), (s, m) => (s.maldicao.lentidao = num(m[1]))],
  [r(`Inimigos Próximos sofrem ao menos ${N} % mais Dano Físico`), (s, m) => (s.maldicao.danoRecebido += num(m[1]))],
  [r(`Aura faz com que os Inimigos sofram até ${N} % mais Dano`), (s, m) => (s.maldicao.danoRecebido += num(m[1]))],
  [r(`Inimigos (?:próximos )?(?:na Aura )?(?:têm|possuem|tem) ${N} % (?:de|em) Resistência a ${EL}`), (s, m) => (s.maldicao.resist[el(m[2])] = num(m[1]))],
  [r(`Amaldiçoad`), (s, m) => (s.maldicao.textos.push(m.input), false)],

  // ---------------- buffs / auras ----------------
  [r(`(?:Você e aliados próximos causam|Aura concede|Buff concede|Concede) ${N} a ${N} de Dano (?:de |De )?${EL} adicional`), (s, m) => (s.buff.adicional[el(m[3])] = [num(m[1]), num(m[2])])],
  [r(`(?:recebem|Buff concede|concede) ${N} % (?:do seu |de )?Dano Físico como Dano (?:Extra de ${EL}|de ${EL} Extra)`), (s, m) => s.buff.extra.push({ para: el(m[2] || m[3]), pct: num(m[1]) })],
  [r(`(?:Você e aliados próxim\\w+ causam|Concede) ${N} % mais Dano(?: Mágico)?(?: de ${EL})?`), (s, m) => (s.buff.maisDano += num(m[1]))],
  [r(`(?:recebem|Buff concede) ${N} % de aumento de Velocidade de Ataque`), (s, m) => (s.buff.velAtaque += num(m[1]))],
  [r(`(?:recebem|Buff concede) ${N} % de aumento de Velocidade de Conjuração`), (s, m) => (s.buff.velConj += num(m[1]))],
  [r(`(?:recebem ${N} % de aumento de Velocidade de Movimento|Velocidade de Movimento aumentada em ${N})`), (s, m) => (s.buff.velMov += num(m[1] || m[2]))],
  [r(`(?:recebem ${N} % de aumento da Chance de Acerto Crítico|Chance de Acerto Crítico(?: com Magias)? aumentad[oa] em ${N})`), (s, m) => (s.buff.critico += num(m[1] || m[2]))],
  [r(`ganham \\+?${N} % (?:em todas Resistências Elementais|de Resistência a todos os Elementos)`), (s, m) => TODOS.forEach((e) => (s.buff.resist[e] = num(m[1])))],
  [r(`ganham ${N} % de Resistência a ${EL} adicional`), (s, m) => (s.buff.resist[el(m[2])] = num(m[1]))],
  [r(`ganham ${N} % de Resistência máxima`), () => false],
  [r(`(?:ganham|Buff concede) \\+?${N} (?:de )?Armadura`), (s, m) => (s.buff.armadura += num(m[1]))],
  [r(`ganham ${N} (?:%? ?mais |de )?Evasão`), (s, m) => (s.buff.evasao += num(m[1]))],
  [r(`ganham ${N} de Escudo de Energia adicional`), (s, m) => (s.buff.escudo += num(m[1]))],
  [r(`Regeneram ${N} de Vida por segundo`), (s, m) => (s.buff.regen += num(m[1]))],
  [r(`^${N} de Vida Regenerada por segundo`), (s, m) => (s.buff.regen += num(m[1]))],
  [r(`regeneram ${N} de Mana por segundo`), (s, m) => (s.buff.regenMana += num(m[1]))],
  [r(`${N} % menos Dano ${EL}? ?(?:Elemental )?sofrido`), (s, m) => (s.buff.menosDanoRecebido += num(m[1]))],
  [r(`(?:Buff concede|Buff faz com que você sofra até) ${N} % menos Dano`), (s, m) => (s.buff.menosDanoRecebido += num(m[1]))],
  [r(`${N} % do Dano de Acertos é tirado do Buff`), (s, m) => (s.buff.absorve = num(m[1]))],
  [r(`Imunes a todas as Afecções Elementais`), (s) => (s.buff.imuneAfeccoes = true)],
  [r(`^(?:Você e aliados próxim|Buff concede|Aura concede|Estandarte)`), (s, m) => (s.buff.textos.push(m.input), false)],

  // ---------------- tempo ----------------
  [r(`Velocidade de Recarga aumentada em ${N}`), (s, m) => (s.velRecarga += num(m[1]))],
  // (17/10, lote G2) a "Velocidade de Clamor aumentada" dos clamores encurta o TEMPO DE USO do clamor (Warcry Speed), não a recarga — antes
  // virava recuperação da recarga (o Clamor Resistente nível 20 saía com 5,8 s de recarga no lugar dos 8 s do PoE)
  [r(`^Velocidade de Clamor aumentada em ${N}`), (s, m) => (s.velClamor = (s.velClamor ?? 0) + num(m[1]))],
  [r(`^\\+${N} segundos ao Tempo de Ataque`), (s, m) => (s.tempoAtaqueExtra += num(m[1]))],
  [r(`É Ativado a cada ${N} segundos`), (s, m) => (s.intervalo = num(m[1]))],
  [r(`Ataca a cada ${N} segundos`), (s, m) => (s.intervalo = num(m[1]))],
];

// Linhas que descrevem interação com sistemas que a arena não tem (suportes, almas
// Vaal, itens, escudos). Não são "efeitos da gema" no combate — ficam como informativo
// e não derrubam o status.
export const INFORMATIVO = [
  /^Modificadores /i, /^Aumentos e Reduções/i, /Almas/i, /^Pode usar Itens que exigem/i,
  /desta Habilidade não pode ser modificada/i, /A Recarga desta Habilidade não é recuperada/i,
  /^Habilidades Suportadas/i, /Armadilhas não são Ativadas no fim/i, /Lacaios não podem Provocar/i,
  /Velocidade de Posicionamento de Totem/i, /Quando em Dupla Empunhadura/i, /^Não pode ser Evadido/i,
  /Modificadores do número de Projéteis/i, /Modificadores à quantidade de Projéteis/i,
  /Dispara Projéteis em sequência/i, /Coloque em um encaixe/i, /contra Jogadores/i,
];

export function interpretar(linhas, stats = statsVazios()) {
  const aplicadas = [], informativas = [], naoImplementadas = [];
  for (const bruto of linhas) {
    // "#%" e "# %" aparecem misturados entre colunas e modificadores; o PoEDB também
    // deixa um "\b" literal em algumas linhas.
    const texto = bruto.replace(/(\d)%/g, "$1 %").replace(/\\b/g, " ").replace(/\s+/g, " ").trim();
    let ok = false;
    for (const [re, fn] of REGRAS) {
      const m = texto.match(re);
      if (m) {
        ok = fn(stats, m) !== false;
        break;
      }
    }
    if (ok) aplicadas.push(texto);
    else if (INFORMATIVO.some((re) => re.test(texto))) informativas.push(texto);
    else naoImplementadas.push(texto);
  }
  return { stats, aplicadas, informativas, naoImplementadas };
}
