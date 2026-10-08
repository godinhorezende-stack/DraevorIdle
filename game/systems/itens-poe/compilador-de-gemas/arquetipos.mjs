// Veio da coleção do dono (poe-gemas-poedb/engine/src/gemas/arquetipos.mjs) para o repositório em 08/10/2026: agora é código do jogo — mude aqui.
// Classifica a gema no "arquétipo" de comportamento que a engine sabe executar.
// Usa os tipos internos do jogo (atributos.Type) e, quando faltam (99 gemas vêm sem
// Type no PoEDB), as tags em português.

const TAG_TIPO = {
  Ataque: "Attack", Magia: "Spell", Projétil: "Projectile", Área: "Area", "Corpo a Corpo": "Melee",
  Duração: "Duration", Lacaio: "Minion", Aura: "Aura", Canalização: "Channel", Movimento: "Movement",
  Armadilha: "Trapped", Mina: "RemoteMined", Totem: "SummonsTotem", Maldição: "Hex", Feitiço: "Hex",
  Clamor: "Warcry", Golem: "Golem", Orbe: "Orb", Nova: "Nova", Ricochete: "Chains", Marca: "Brand",
  Runa: "Brand", Arauto: "Herald", Impacto: "Slam", Golpear: "MeleeSingleTarget", Viajar: "Travel",
  Guarda: "Guard", Postura: "Stance", Arco: "RangedAttack",
};

export const ARQUETIPOS = {
  projetil: "Projétil",
  area: "Área no alvo",
  nova: "Nova (ao redor)",
  corpo_a_corpo: "Golpe corpo a corpo",
  impacto: "Impacto (slam)",
  ricochete: "Raio em cadeia",
  chuva: "Chuva de impactos",
  orbe: "Orbe pulsante",
  canalizacao: "Canalização",
  marca: "Marca (gruda no alvo)",
  movimento: "Movimento",
  lacaio: "Invocar lacaios",
  totem: "Totem",
  armadilha: "Armadilha",
  mina: "Mina",
  aura: "Aura",
  arauto: "Arauto",
  maldicao: "Maldição",
  clamor: "Clamor",
  guarda: "Guarda / buff",
  generico: "Sem comportamento",
};

export function tiposDaGema(g) {
  const t = new Set(g.tipos);
  for (const tag of g.tags) if (TAG_TIPO[tag]) t.add(TAG_TIPO[tag]);
  if (t.has("Hex") || t.has("Warcry")) t.delete("Projectile");
  return t;
}

// `semObjeto` = classifica a carga útil de um totem/armadilha/mina (o que ele dispara).
export function classificar(t, stats, semObjeto = false) {
  if (!semObjeto) {
    // Absolvição & cia: magia de dano que só invoca lacaio como efeito secundário
    const danoProprio = Object.keys(stats.dano).length && !t.has("Golem");
    if ((t.has("Minion") || t.has("CreatesMinion") || t.has("Golem")) && !danoProprio) return "lacaio";
    if (t.has("SummonsTotem") || stats.flags.has("totem")) return "totem";
    if (t.has("Trapped")) return "armadilha";
    if (t.has("RemoteMined")) return "mina";
  }
  if (t.has("Hex")) return "maldicao";
  // Fogo Justo: queima tudo em volta do conjurador enquanto ativo -> aura de dano
  if (stats.dotPctVida) return "aura";
  if (stats.cadaver) return "area";
  if (t.has("Herald")) return "arauto";
  if (t.has("Aura") && !t.has("RemoteMined")) return "aura";
  if (t.has("Warcry")) return "clamor";
  if (t.has("Brand")) return "marca";
  if (t.has("Channel")) return "canalizacao";
  if (t.has("Movement") || t.has("Travel") || t.has("Blink")) return "movimento";
  if (t.has("Orb")) return "orbe";
  if (t.has("Rain")) return "chuva";
  if (t.has("Chains") && !t.has("Projectile")) return "ricochete";
  if (t.has("Projectile")) return "projetil";
  if (t.has("Melee")) return t.has("Slam") ? "impacto" : "corpo_a_corpo";
  if (t.has("Nova")) return "nova";
  const temDano = Object.keys(stats.dano).length || stats.dot.length;
  if (t.has("Area") && (temDano || t.has("Attack"))) return "area";
  if (t.has("Guard") || t.has("Stance") || t.has("Buff")) return "guarda";
  if (temDano) return "area";
  if (t.has("Attack")) return "corpo_a_corpo";
  return "generico";
}

export function elementoPrincipal(t, stats, tags) {
  const ks = Object.keys(stats.dano);
  if (ks.length) return ks.sort((a, b) => stats.dano[b][1] - stats.dano[a][1])[0];
  if (stats.dot.length) return stats.dot[0].el;
  if (stats.conversao.length) return stats.conversao[0].para === "aleatorio" ? "raio" : stats.conversao[0].para;
  const ad = Object.keys(stats.buff.adicional);
  if (ad.length) return ad[0];
  for (const [tag, e] of [["Fogo", "fogo"], ["Gelo", "gelo"], ["Raio", "raio"], ["Caos", "caos"], ["Físico", "fisico"]]) if (tags.includes(tag)) return e;
  return "fisico";
}
