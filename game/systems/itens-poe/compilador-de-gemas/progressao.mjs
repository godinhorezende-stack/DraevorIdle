// Veio da coleção do dono (poe-gemas-poedb/engine/src/gemas/progressao.mjs) para o repositório em 08/10/2026: agora é código do jogo — mude aqui.
// Monta o texto de cada modificador da gema NUM nível específico.
// A tabela "Level Effect" do PoEDB só traz colunas para alguns modificadores; os
// demais aparecem só em `mods` como faixa "(a — b)" do nível 1 ao 20, então são
// interpolados. Linhas sem faixa são constantes.

export const COLUNAS_PADRAO = new Set(["Nível", "RequerNível", "Experiência", "Base Damage", "Mana", "For", "Des", "Int"]);
const NUM = /-?\d+(?:[.,]\d+)?/g;
const FAIXA = /\((-?\d+(?:\.\d+)?)\s*—\s*(-?\d+(?:\.\d+)?)\)/g;

export function molde(texto) {
  return texto.replace(FAIXA, "#").replace(/\+?#/g, "#").replace(NUM, "#").replace(/\s+/g, "").replace(/\+/g, "").replace(/metros/g, "metro").toLowerCase();
}

export function numero(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// "Causa 9 a 14 de Dano de Fogo" + "1883, 2825" -> "Causa 1883 a 2825 de Dano de Fogo"
function substituir(cabecalho, celula) {
  const valores = String(celula).split(/,\s*/).filter((v) => v !== "");
  if (!valores.length) return null;
  let i = 0;
  if (cabecalho.includes("#")) return cabecalho.replace(/#/g, () => valores[Math.min(i++, valores.length - 1)]);
  return cabecalho.replace(NUM, (orig) => (i < valores.length ? valores[i++] : orig));
}

function interpolar(texto, nivel) {
  const t = Math.min(Math.max((nivel - 1) / 19, 0), 1);
  return texto.replace(FAIXA, (_, a, b) => {
    const v = parseFloat(a) + (parseFloat(b) - parseFloat(a)) * t;
    return String(Math.round(v * 10) / 10);
  });
}

export function linhaDoNivel(gema, nivel) {
  const idx = Math.min(Math.max(nivel, 1), gema.linhas.length) - 1;
  return gema.linhas[idx] || [];
}

export function nivelMaximo(gema) {
  return gema.linhas.length || 1;
}

// Valores numéricos padrão da linha (custo, efetividade de ataque, requisito).
export function basicosDoNivel(gema, nivel) {
  const linha = linhaDoNivel(gema, nivel);
  const col = (nome) => gema.colunas.indexOf(nome);
  const get = (nome) => (col(nome) >= 0 ? linha[col(nome)] : undefined);
  const base = get("Base Damage");
  return {
    nivelReq: numero(get("RequerNível")),
    custo: numero(get("Mana")),
    efetividade: base ? numero(base.split(",")[0].replace("%", "")) / 100 : 1,
  };
}

export function textosDoNivel(gema, nivel) {
  const linha = linhaDoNivel(gema, nivel);
  const porMolde = new Map();
  gema.colunas.forEach((c, i) => {
    if (!COLUNAS_PADRAO.has(c)) porMolde.set(molde(c), { cab: c, valor: linha[i] });
  });
  const usados = new Set();
  const out = [];
  const add = (t) => {
    if (t && !out.includes(t)) out.push(t);
  };
  for (const mod of gema.mods) {
    const m = molde(mod);
    const col = porMolde.get(m);
    if (col) {
      usados.add(m);
      // célula vazia = valor 0 naquele nível (o stat não existe ainda)
      if (col.valor !== undefined && col.valor !== "") add(substituir(col.cab, col.valor));
    } else if (mod.includes("—")) {
      add(interpolar(mod, nivel));
    } else {
      add(mod);
    }
  }
  for (const [m, col] of porMolde) {
    if (!usados.has(m) && col.valor !== undefined && col.valor !== "") add(substituir(col.cab, col.valor));
  }
  return out;
}

// Propriedades do cabeçalho (tempo de conjuração, recarga, raio...) — constantes ou faixas.
export function propsDoNivel(gema, nivel) {
  return gema.props.map((p) => interpolar(p, nivel));
}
