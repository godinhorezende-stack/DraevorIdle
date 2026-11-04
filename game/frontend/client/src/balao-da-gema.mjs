// O BALÃO DA GEMA DO PoE, a parte PURA (dono, 02/11: "atualize o tooltip de todas"): da ficha do servidor (`GemasPoe.fichaNoNivel` /
// `SuportesPoe.fichaNoNivel` — o `poeFicha` do catálogo da barra e o `/api/jogo/poe/gema` do item) para as partes do balão, sem DOM. O desenho é de
// `tooltip.mjs` (`corpoDaGemaPoe`), o MESMO no inventário, nos encaixes, na barra e na tela "Configurar ação" — por isso o texto é um só nos três lugares.
// Um teste percorre todas as gemas por aqui (`testes/tooltip-gemas-poe.test.mjs`).

/**
 * O status no balão: a gema que FUNCIONA não leva marca (como no PoE — todas as gemas estão feitas desde a rodada 4); a que não se aplica leva a nota curta;
 * a parcial e a sem efeito seguem com o aviso de antes (nenhuma hoje).
 */
const STATUS = { parcial: ['◐ Funciona em parte no jogo', 'parcial'], nao: ['✕ Ainda não funciona no jogo', 'nao'] };

const seg = (ms) => `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`;
const pctTxt = (v) => `${Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
// (02/11, dono: "atualize o tooltip de todas") todo gatilho dos suportes diz QUANDO sai, em português — antes só o crítico, o abate e o dano recebido; os outros
// mostravam a chave crua ('canalizar', 'morte'…). O da Salvaguarda (o Conjurar ao Perder Salvaguarda) com a recarga pela Salvaguarda máxima.
const QUANDO = (g) => ({
  critico: 'quando o ataque ligado acerta um crítico',
  abate: 'quando o ataque corpo a corpo ligado mata',
  danoRecebido: `a cada ${g.limiar ?? '?'} de dano que você recebe`,
  canalizar: 'a cada intervalo, enquanto você canaliza a habilidade ligada',
  atordoado: `${pctTxt(g.chance ?? 100)} de chance quando você é atordoado`,
  morte: 'quando você morre',
  acertoRaro: 'quando um ataque seu acerta um inimigo Raro ou Único',
  manaForjada: `quando a mana gasta em outros ataques de arco passa de ${pctTxt(g.limiarPct)} do custo deles`,
  salvaguarda: `quando a sua Salvaguarda quebra${g.porSalvaguardaPct ? ` (recarga ${pctTxt(g.porSalvaguardaPct)} mais rápida por 100 de Salvaguarda máxima, até ${pctTxt(g.porSalvaguardaMaxPct)})` : ''}`,
});
const ROTULO_DA_RECARGA = { canalizar: 'intervalo' };

/**
 * As PARTES do balão de uma gema do PoE. `entry`: `{ poeFicha, tempoPoe?, ativadaPor?, damage?, element? }` (o do catálogo; no item, só `{ poeFicha }`).
 * Devolve null sem ficha, ou `{ tags, props, nivelReq, desc, mods, qualidade, status, tempos, dano, notas }`:
 * - `mods` e `qualidade.linhas`: `[{ texto, fora, naoSeAplica }]` — `fora`: a linha que o jogo ainda não faz (riscada); `naoSeAplica`: a que não se aplica ao jogo;
 * - `status`: `{ texto, classe }` ou null (a gema que funciona); `notas`: as notas curtas (o "não se aplica", as escolhas do dono, o que é riscado).
 */
export function partesDoBalaoDaGema(entry) {
  const f = entry?.poeFicha;
  if (!f) return null;
  const naoFeitas = new Set(f.naoFeitas ?? []);
  const naoSeAplicam = new Set(f.naoSeAplicam ?? []);
  const linha = (texto) => ({ texto, fora: naoFeitas.has(texto), naoSeAplica: naoSeAplicam.has(texto) });
  const mods = (f.mods ?? []).map(linha);
  const qualidade = f.modsDaQualidade?.length ? { rotulo: `Qualidade +${f.qualidade ?? 0}%`, linhas: f.modsDaQualidade.map(linha) } : null;
  // ---- o que vale no jogo ----
  let status = null;
  const notas = [];
  if (f.naoSeAplica) {
    status = { texto: 'Não se aplica ao jogo', classe: 'nao' };
    notas.push(f.naoSeAplica);
  } else if (f.status !== 'funciona') {
    const [texto, classe] = STATUS[f.status] ?? STATUS.nao;
    status = { texto, classe };
  }
  // Os TEMPOS no jogo (os do PoE): o de uso (conjuração com a sua velocidade, ou o golpe da sua arma × a velocidade da gema) e a recarga.
  const tempos = [];
  const t = entry.tempoPoe;
  const tb = f.tempos ?? {};
  if (t) tempos.push([t.ataque ? 'Tempo de ataque' : 'Tempo de conjuração', `${seg(t.uso)} ${t.ataque ? `(a sua arma × ${t.velAtaqueBase}%)` : '(com a sua velocidade)'}`]);
  else if (f.ataque) tempos.push(['Tempo de ataque', `o da arma × ${tb.velAtaqueBase ?? 100}%`]);
  else if (tb.conjuracaoMs != null) tempos.push(['Tempo de conjuração', tb.conjuracaoMs ? seg(tb.conjuracaoMs) : 'instantânea']);
  const recarga = t ? t.recarga : tb.recargaMs ?? 0;
  const cargas = t?.cargas ?? tb.cargas ?? 1;
  if (!f.suporte) tempos.push(['Recarga', recarga ? `${seg(recarga)}${cargas > 1 ? ` (${cargas} usos)` : ''}` : 'sem recarga (como no PoE)']);
  // O suporte de GATILHO: quando as magias ligadas saem sozinhas e a recarga do gatilho.
  if (f.gatilho) {
    const g = f.gatilho;
    tempos.push(['Ativa as magias ligadas', `${QUANDO(g)[g.quando] ?? g.quando} · ${ROTULO_DA_RECARGA[g.quando] ?? 'recarga'} ${seg(g.recargaMs ?? 0)}`]);
  }
  if (entry.ativadaPor) tempos.push(['Ativada por', `${entry.ativadaPor} (não se conjura à mão)`]);
  const dano = entry.damage ? { texto: `Dano agora: ${Math.round(Math.abs(entry.damage.min))} a ${Math.round(Math.abs(entry.damage.max))} (com os seus bônus)`, classe: entry.element ? `el-${entry.element}` : 'atk' } : null;
  if (!f.naoSeAplica && [...mods, ...(qualidade?.linhas ?? [])].some((l) => l.fora)) notas.push('Riscado: o efeito ainda não age no jogo.');
  // (o que falta e não é uma linha do balão — a mecânica da descrição; a gema que funciona não tem nenhum hoje)
  if (!f.naoSeAplica) for (const m of (f.motivos ?? []).slice(0, 2)) notas.push(m);
  // (as notas do registro: as escolhas do dono e as linhas que não se aplicam)
  for (const n of f.notas ?? []) notas.push(n);
  return { tags: f.tags ?? [], props: f.props ?? [], nivelReq: f.nivelReq ?? 1, desc: f.desc ?? '', mods, qualidade, status, tempos, dano, notas };
}

/** Todo o TEXTO do balão de uma gema, linha a linha (o que o jogador lê) — para conferir que os três lugares mostram o mesmo. */
export function textoDoBalaoDaGema(entry) {
  const p = partesDoBalaoDaGema(entry);
  if (!p) return [];
  return [
    ...(p.tags.length ? [p.tags.join(', ')] : []),
    ...p.props.map(([r, v]) => (v ? `${r}: ${v}` : r)), `Requer Nível ${p.nivelReq}`,
    ...(p.desc ? [p.desc] : []),
    ...p.mods.map((l) => l.texto),
    ...(p.qualidade ? [p.qualidade.rotulo, ...p.qualidade.linhas.map((l) => l.texto)] : []),
    ...(p.status ? [p.status.texto] : []),
    ...p.tempos.map(([r, v]) => `${r}: ${v}`),
    ...(p.dano ? [p.dano.texto] : []),
    ...p.notas,
  ];
}
