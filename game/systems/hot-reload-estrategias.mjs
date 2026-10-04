// As ESTRATÉGIAS do Hot Reload: uma por tipo de conteúdo, cada uma TRANSACIONAL (valida tudo antes de tocar no jogo; se algo for inválido, lança e o
// jogo segue com a última versão válida). O núcleo (`hot-reload.mjs`) cuida de debounce, fila, histórico e notificação; aqui mora o "como recarregar
// cada coisa sem reiniciar". O que não tem estratégia aqui (hunts, mapas, habilidades, gemas, catálogos originais…) exige reiniciar: ver `classificar`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Overrides from './overrides.mjs';
import { CATALOGO, ITEM_CATALOG, ESTADO_DO_BESTIARIO, ESTADO_DE_ITENS } from './dados.mjs';
import * as Poderes from './poderes.mjs';
import * as Progressao from './progressao.mjs';
import * as Conjuntos from './conjuntos.mjs';
import * as ItemPower from './item-power.mjs';
import * as ClassesDoJogo from './classes.mjs';
import { nivelMaximo as nivelMaximoDaProgressao } from './progressao.mjs';
import * as Campanha from './campanha.mjs';
import { normalizar } from './atos-modelo.mjs';
import { PASTA as PASTA_DOS_ATOS } from './atos-carregar.mjs';
import { assinaturaDe, criarHotReload, podeAtivar, DIRETORIOS_VIGIADOS } from './hot-reload.mjs';
import { transmitir } from './avisos-globais.mjs';
import { decodificarPng } from '../engine/png-minimo.mjs';
import { validarMeta, estruturaDe } from '../engine/sprite-folha.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');

/** Cria as estratégias. Tudo parametrizável (os testes apontam para pastas temporárias e injetam o estado). */
export function criarEstrategias({ raiz = RAIZ, overrides = Overrides.PASTA, atos = PASTA_DOS_ATOS, campanhaArquivo = null } = {}) {
  const arq = (...p) => join(overrides, ...p);
  const lerJsonEstrito = (caminho, nome) => {
    try { return JSON.parse(readFileSync(caminho, 'utf8')); } catch (e) { throw new Error(`${nome} não é um JSON válido: ${e.message}`); }
  };

  // ---------------------------------------------------------------- monstros
  const monstros = {
    assinatura: () => assinaturaDe([arq('monstros.json')]),
    aplicar() {
      const novo = Overrides.lerMonstrosEstrito(overrides);
      const r = Overrides.reaplicarNoBestiario(CATALOGO.bestiary, ESTADO_DO_BESTIARIO, novo, Overrides.contextoDoJogo(ITEM_CATALOG), { estrito: true });
      if (!r.ok) throw new Error(`Overrides de monstros inválidos — ${r.ignorados.map((i) => `${i.key}: ${i.erros.join(' / ')}`).join(' | ')}.`);
      const p = Poderes.recarregarPoderes(novo, [...r.aplicados, ...r.criados]);
      const ids = [...new Set([...r.mudados, ...p.mudados])];
      return { ids, resumo: `${ids.length} monstro(s) (${r.aplicados.length} alterado(s), ${r.criados.length} variação(ões))`, payload: { monstros: Object.fromEntries(ids.map((k) => [k, CATALOGO.bestiary[k] ?? null])) } };
    },
  };

  // ---------------------------------------------------------------- itens
  const itens = {
    assinatura: () => assinaturaDe([arq('itens.json')]),
    aplicar() {
      const novo = Overrides.lerItensEstrito(overrides);
      const r = Overrides.reaplicarNosItens(ITEM_CATALOG, ESTADO_DE_ITENS, novo, { estrito: true });
      if (!r.ok) throw new Error(`Overrides de itens inválidos — ${r.ignorados.map((i) => `${i.id}: ${i.erros.join(' / ')}`).join(' | ')}.`);
      return { ids: r.mudados, resumo: `${r.mudados.length} item(ns)`, payload: { itens: Object.fromEntries(r.mudados.map((id) => [id, ITEM_CATALOG[id] ?? null])) } };
    },
  };

  // ---------------------------------------------------------------- progressão e loot por dificuldade
  const progressao = {
    assinatura: () => assinaturaDe([arq('progressao.json'), join(raiz, 'progressao.json')]),
    aplicar() {
      let ov = null;
      if (existsSync(arq('progressao.json'))) ov = lerJsonEstrito(arq('progressao.json'), 'progressao.json');
      const r = Progressao.aplicar(ov, { estrito: true });
      if (!r.ok) throw new Error(`Overrides de progressão inválidos — ${r.erros.join(' | ')}.`);
      return { ids: ['progressao'], resumo: `configuração de progressão e loot${r.avisos.length ? ` (${r.avisos.length} aviso(s))` : ''}`, payload: {} };
    },
  };

  // ---------------------------------------------------------------- conjuntos (sets de equipamento; só da Engine: não há mecânica de jogo a recarregar)
  const conjuntos = {
    assinatura: () => assinaturaDe([arq('conjuntos.json'), arq('itens.json'), arq('progressao.json')]),
    aplicar() {
      let ov = null;
      if (existsSync(arq('conjuntos.json'))) ov = lerJsonEstrito(arq('conjuntos.json'), 'conjuntos.json');
      const r = Conjuntos.aplicar(ov, { estrito: true });
      if (!r.ok) throw new Error(`Overrides de conjuntos inválidos — ${r.erros.join(' | ')}.`);
      return { ids: Object.keys(Conjuntos.EM_USO), resumo: `${Object.keys(Conjuntos.EM_USO).length} conjunto(s)${r.avisos.length ? ` (${r.avisos.length} aviso(s))` : ''}`, payload: {} };
    },
  };

  // ---------------------------------------------------------------- classes e bônus por atributo (muta a tabela que a engine lê: vale no próximo cálculo da ficha)
  const classes = {
    assinatura: () => assinaturaDe([arq('classes.json'), join(raiz, 'classes.json'), join(raiz, 'atributos-principais.json'), join(raiz, 'classes-meta.json')]),
    aplicar() {
      let ov = null;
      if (existsSync(arq('classes.json'))) ov = lerJsonEstrito(arq('classes.json'), 'classes.json');
      const r = ClassesDoJogo.aplicar(ov, { estrito: true });
      if (!r.ok) throw new Error(`Overrides de classes inválidos — ${r.erros.join(' | ')}.`);
      return { ids: Object.keys(ClassesDoJogo.EM_USO.classes), resumo: `${Object.keys(ClassesDoJogo.EM_USO.classes).length} classe(s)`, payload: {} };
    },
  };

  // ---------------------------------------------------------------- item power (indicador de comparação: só da Engine, sem mecânica de jogo a recarregar)
  const itemPower = {
    assinatura: () => assinaturaDe([arq('item-power.json'), arq('progressao.json')]),
    aplicar() {
      let ov = null;
      if (existsSync(arq('item-power.json'))) ov = lerJsonEstrito(arq('item-power.json'), 'item-power.json');
      const r = ItemPower.aplicar(ov, { estrito: true, nivelMaximo: nivelMaximoDaProgressao() });
      if (!r.ok) throw new Error(`Overrides de item power inválidos — ${r.erros.join(' | ')}.`);
      return { ids: ['item-power'], resumo: `fórmula v${ItemPower.EM_USO.versaoDaFormula}${r.avisos.length ? ` (${r.avisos.length} aviso(s))` : ''}`, payload: {} };
    },
  };

  // ---------------------------------------------------------------- sprites de itens (só a Engine/cliente leem: o servidor valida; o jogador recarrega a página para ver)
  const spritesItens = {
    assinatura: () => assinaturaDe([arq('itens-sprites.json'), arq('itens.json')]),
    async aplicar() {
      const { validarTudo } = await import('../admin/overrides-sprites-itens.mjs');
      const r = validarTudo(overrides);
      if (r.erros.length) throw new Error(`Sprites de itens inválidos — ${r.erros.join(' | ')}.`);
      return { ids: ['sprites-itens'], resumo: 'sprites de itens validados (recarregue a página para ver)', payload: {} };
    },
  };

  // ---------------------------------------------------------------- sprites
  let metas = null;
  const metasOriginais = () => (metas ??= JSON.parse(readFileSync(join(raiz, 'outfits.json'), 'utf8')));
  const aplicadosDeSprites = new Map(); // look → hash do override aplicado
  let globalAtivo = true;
  const hashDoPng = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);
  const sprites = {
    assinatura: (info) => assinaturaDe([arq('sprites.json'), ...info.ids.flatMap((id) => [arq('sprites', `${id}.png`), join(raiz, 'sprites', 'outfits', `${id}.png`)]), join(raiz, 'outfits.json')]),
    aplicar(info) {
      // 1) os overrides (sprites.json + imagens): valida TUDO antes de aceitar
      const arquivo = arq('sprites.json');
      let dados = { ativo: true, sprites: {} };
      if (existsSync(arquivo)) {
        dados = lerJsonEstrito(arquivo, 'sprites.json');
        if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('sprites.json: o conteúdo precisa ser um objeto.');
        dados = { ativo: dados.ativo !== false, sprites: dados.sprites && typeof dados.sprites === 'object' ? dados.sprites : {} };
      }
      const novos = new Map();
      for (const [look, e] of Object.entries(dados.sprites)) {
        if (e?.ativo === false) continue;
        const orig = metasOriginais()[look];
        if (!orig) throw new Error(`sprites.json: o look ${look} não existe nos desenhos do jogo.`);
        const png = arq('sprites', `${look}.png`);
        if (!existsSync(png)) throw new Error(`sprites.json: falta a imagem overrides/sprites/${look}.png.`);
        const buf = readFileSync(png);
        let img;
        try { img = decodificarPng(buf); } catch (err) { throw new Error(`overrides/sprites/${look}.png: ${err.message}`); }
        if (!e.meta?.groups) throw new Error(`sprites.json: o look ${look} está sem o cadastro de quadros (meta).`);
        const velho = validarMeta(orig, orig).erros;
        const v = validarMeta(e.meta, orig).erros.filter((x) => !velho.includes(x));
        if (v.length) throw new Error(`look ${look}: ${v.join(' ')}`);
        const esp = estruturaDe(e.meta);
        if (img.w !== esp.w || img.h !== esp.h) throw new Error(`look ${look}: a imagem tem ${img.w}×${img.h} mas o cadastro pede ${esp.w}×${esp.h}.`);
        if (e.hash && e.hash !== hashDoPng(buf)) throw new Error(`look ${look}: o hash do cadastro (${e.hash}) não bate com a imagem em disco (${hashDoPng(buf)}): a imagem foi trocada fora da Engine ou está corrompida.`);
        novos.set(look, { hash: hashDoPng(buf), meta: e.meta });
      }
      // 2) as imagens ORIGINAIS que mudaram (edição à mão) e o índice (`outfits.json`)
      const originais = {};
      for (const c of info.caminhos) {
        const m = /^sprites\/outfits\/(\d+)\.png$/.exec(c);
        if (!m) continue;
        const f = join(raiz, c);
        if (!existsSync(f)) throw new Error(`${c}: o arquivo original sumiu.`);
        try { decodificarPng(readFileSync(f)); } catch (err) { throw new Error(`${c}: ${err.message}`); }
        const st = statSync(f);
        originais[m[1]] = `${st.size}-${Math.floor(st.mtimeMs)}`;
      }
      let indice = false;
      if (info.caminhos.includes('outfits.json')) { metas = lerJsonEstrito(join(raiz, 'outfits.json'), 'outfits.json'); indice = true; }
      // 3) compromete (síncrono): só o que mudou vai para o cliente
      const mudados = {};
      const todos = new Set([...aplicadosDeSprites.keys(), ...novos.keys()]);
      for (const look of todos) {
        const antes = aplicadosDeSprites.get(look);
        const depois = novos.get(look);
        if (globalAtivo !== dados.ativo || antes !== depois?.hash || !depois !== !antes) mudados[look] = depois && dados.ativo ? { hash: depois.hash, meta: depois.meta } : null;
      }
      aplicadosDeSprites.clear();
      for (const [l, v] of novos) aplicadosDeSprites.set(l, v.hash);
      globalAtivo = dados.ativo;
      const ids = [...new Set([...Object.keys(mudados), ...Object.keys(originais)])];
      return { ids, resumo: `${ids.length} sprite(s)${indice ? ' (índice dos desenhos)' : ''}`, payload: { ativo: dados.ativo, sprites: mudados, originais, indice } };
    },
  };

  // ---------------------------------------------------------------- atos
  const atosDe = (info) => [...new Set([...info.caminhos.filter((c) => /^atos\/[^/]+\.json$/.test(c)).map((c) => c.slice(5, -5)), ...(info.forcar ? info.ids.filter((i) => /^[a-z0-9-]+$/.test(i)) : [])])];
  const assinaturaDeAtos = (info) => assinaturaDe((atosDe(info).length ? atosDe(info) : (existsSync(atos) ? readdirSync(atos).map((n) => n.replace(/\.json$/, '')) : [])).map((id) => join(atos, `${id}.json`)));
  const atosEstrategia = {
    assinatura: assinaturaDeAtos,
    aplicar(info) {
      const feitos = [];
      const falhas = [];
      for (const id of atosDe(info)) {
        const f = join(atos, `${id}.json`);
        try {
          if (!existsSync(f)) { if (Campanha.removerAtoRegistrado(id)) feitos.push(`${id} (removido)`); continue; }
          const bruto = normalizar(lerJsonEstrito(f, `${id}.json`));
          const r = Campanha.recarregarAto(bruto);
          if (!r.ok) { falhas.push(`${id}: ${(r.problemas ?? []).filter((p) => p.nivel === 'erro').map((p) => `[${p.onde}] ${p.mensagem}`).join(' | ') || 'inválido'}`); continue; }
          feitos.push(r.removido ? `${id} (fora do jogo: ${bruto.estado})` : `${id} (${r.substituiu ? 'atualizado' : 'novo'})`);
        } catch (e) { falhas.push(`${id}: ${e.message}`); }
      }
      if (falhas.length) throw new Error(`Ato(s) não recarregado(s) — segue a última versão válida: ${falhas.join(' || ')}${feitos.length ? ` (recarregados: ${feitos.join(', ')})` : ''}`);
      return { ids: atosDe(info), resumo: feitos.join(', ') || 'nada a fazer', payload: { atos: atosDe(info) } };
    },
  };

  // ---------------------------------------------------------------- campanha (níveis)
  const campanha = {
    assinatura: () => assinaturaDe([campanhaArquivo ?? join(raiz, 'campanha.json')]),
    aplicar() {
      const novo = lerJsonEstrito(campanhaArquivo ?? join(raiz, 'campanha.json'), 'campanha.json');
      const r = Campanha.recarregarNiveis(novo);
      if (r.reinicio) return { reinicio: r.motivo };
      return { ids: r.mudadas, resumo: `${r.mudadas.length} fase(s)/boss(es) com nível alterado`, payload: { campanha: true, mudadas: r.mudadas } };
    },
  };
  sprites.semear = () => { try { sprites.aplicar({ caminhos: [], ids: [] }); } catch { /* o boot segue com o que carregou */ } };
  return { progressao, classes, conjuntos, 'item-power': itemPower, 'sprites-itens': spritesItens, itens, monstros, sprites, campanha, atos: atosEstrategia };
}

/**
 * Liga o Hot Reload no servidor: só em desenvolvimento local (`podeAtivar`). Em produção devolve uma instância DESLIGADA (sem estratégias, sem
 * monitoramento): o resto do código chama a mesma API e nada acontece.
 */
export function iniciarHotReload({ producao = false, env = process.env, notificar = transmitir, vigiar = true, log = console.log } = {}) {
  const pode = podeAtivar({ producao, env });
  const hr = criarHotReload({ estrategias: pode.ativo ? criarEstrategias() : {}, notificar, ativo: pode.ativo, motivoInativo: pode.motivo, log });
  if (pode.ativo) {
    hr.semear();
    // A pasta de overrides pode estar noutro lugar (`DRAEVOR_OVERRIDES`): vigia a de verdade, com o nome lógico `overrides/`.
    if (vigiar) hr.vigiar(RAIZ, Overrides.PASTA === join(RAIZ, 'overrides') ? DIRETORIOS_VIGIADOS : [...DIRETORIOS_VIGIADOS.filter((d) => d.dir !== 'overrides'), { dir: Overrides.PASTA, absoluto: true, recursivo: true, prefixo: 'overrides' }]);
    log('[hot-reload] ativo: salvou na Engine, o jogo local atualiza sem reiniciar (monstros, itens, sprites, atos, níveis da campanha).');
  } else log(`[hot-reload] desligado: ${pode.motivo}`);
  return hr;
}
