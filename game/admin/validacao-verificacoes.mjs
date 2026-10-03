// AS VERIFICAÇÕES do validador centralizado. Cada uma devolve uma lista de achados `{ nivel: 'erro' | 'aviso', onde, mensagem }` sobre UM aspecto do conteúdo
// editável; o orquestrador (`validacao.mjs`) soma, classifica (aprovado / aviso / bloqueante) e guarda. Rodam num PROCESSO À PARTE (`validacao-runner.mjs`) que
// carrega o jogo do disco como ele subiria — assim também provam que o conteúdo CARREGA — e não pesam no servidor da Engine. Reaproveitam os validadores dos
// próprios editores (nenhuma regra nova de jogo aqui): `validarMonstro`, `validarItem`, `Overrides-sprites.analisar`, `Atos.validar`, a auditoria dos encontros…
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const erro = (onde, mensagem) => ({ nivel: 'erro', onde, mensagem });
const aviso = (onde, mensagem) => ({ nivel: 'aviso', onde, mensagem });
const json = (...p) => JSON.parse(readFileSync(join(RAIZ, ...p), 'utf8'));
const jsonsDe = (pasta) => (existsSync(join(RAIZ, pasta)) ? readdirSync(join(RAIZ, pasta)).filter((n) => n.endsWith('.json')).map((n) => `${pasta}/${n}`) : []);

/** Os arquivos de conteúdo editáveis (os que a Engine grava ou que o jogo lê do dono). */
export function arquivosEditaveis(overrides) {
  const ov = overrides ? (existsSync(overrides) ? readdirSync(overrides).filter((n) => n.endsWith('.json')).map((n) => join(overrides, n)) : []) : jsonsDe('overrides').map((c) => join(RAIZ, c));
  return [
    ...ov,
    ...[...jsonsDe('atos'), ...jsonsDe('encontros'), ...jsonsDe('hunts')].map((c) => join(RAIZ, c)),
    ...['campanha.json', 'campanha-conteudo.json', 'bosses-unicos.json', 'encontros.json', 'outfits.json', 'engine.json'].map((n) => join(RAIZ, n)).filter(existsSync),
  ];
}

/** `{ id, modulo, titulo, rodar(ctx) }` — `ctx`: `{ overrides, avisosDeCarga }`. */
export function criarVerificacoes() {
  return [
    {
      id: 'json', modulo: 'geral', titulo: 'Integridade dos arquivos (JSON válido)',
      async rodar(ctx) {
        const achados = [];
        const arquivos = arquivosEditaveis(ctx.overrides);
        for (const a of arquivos) {
          try { JSON.parse(readFileSync(a, 'utf8')); } catch (e) { achados.push(erro(a.replace(`${RAIZ}/`, ''), `JSON inválido: ${e.message}`)); }
        }
        return { achados, detalhe: `${arquivos.length} arquivo(s) conferidos` };
      },
    },
    {
      id: 'carga', modulo: 'geral', titulo: 'Carga do jogo (o que o servidor ignoraria no boot)',
      async rodar(ctx) {
        // `dados.mjs`, `poderes.mjs` e `campanha.mjs` avisam no console o que ignoram ao subir: entrada inválida de override, ato que não entrou.
        const achados = ctx.avisosDeCarga.filter((l) => /\[(overrides|atos)\]/.test(l)).map((l) => erro('boot', l.replace(/^\s+/, '')));
        return { achados, detalhe: achados.length ? 'o servidor ignoraria entradas ao subir' : 'o jogo carrega todo o conteúdo editável' };
      },
    },
    {
      id: 'monstros', modulo: 'monstros', titulo: 'Monstros (overrides): campos, loot, ataques, sprite e variações',
      async rodar(ctx) {
        const O = await import('../systems/overrides.mjs');
        const achados = [];
        let dados;
        try { dados = O.lerMonstrosEstrito(ctx.overrides ?? O.PASTA); } catch (e) { return { achados: [erro('overrides/monstros.json', e.message)] }; }
        const original = json('catalog-real.json').bestiary;
        const itens = json('item-catalog.json');
        const contexto = O.contextoDoJogo(itens);
        const criados = new Set();
        let n = 0;
        for (const [key, ov] of Object.entries(dados.monstros)) {
          n++;
          const r = O.validarMonstro(key, ov, { ...contexto, original: ov?.base != null ? null : original[key] ?? null, existeMonstro: (k) => !!original[k] || criados.has(k) });
          for (const m of r.erros) achados.push(erro(`monstro ${key}`, m));
          for (const m of r.avisos) achados.push(aviso(`monstro ${key}`, m));
          if (ov?.base != null) criados.add(key);
          if (ov?.ativo === false) achados.push(aviso(`monstro ${key}`, 'override desligado (não vale no jogo).'));
        }
        if (!dados.ativo && n) achados.push(aviso('overrides/monstros.json', 'a camada de overrides de monstros está DESLIGADA: nenhuma alteração vale.'));
        return { achados, detalhe: `${n} override(s) de monstro` };
      },
    },
    {
      id: 'itens', modulo: 'itens', titulo: 'Itens (overrides): campos, preços e raridade',
      async rodar(ctx) {
        const O = await import('../systems/overrides.mjs');
        let dados;
        try { dados = O.lerItensEstrito(ctx.overrides ?? O.PASTA); } catch (e) { return { achados: [erro('overrides/itens.json', e.message)] }; }
        const catalogo = json('item-catalog.json');
        const achados = [];
        let n = 0;
        for (const [id, ov] of Object.entries(dados.itens)) {
          n++;
          const r = O.validarItem(id, ov, { original: catalogo[id] ?? null });
          for (const m of r.erros) achados.push(erro(`item ${id}`, m));
          for (const m of r.avisos) achados.push(aviso(`item ${id}`, m));
        }
        if (!dados.ativo && n) achados.push(aviso('overrides/itens.json', 'a camada de overrides de itens está DESLIGADA: nenhuma alteração vale.'));
        return { achados, detalhe: `${n} override(s) de item` };
      },
    },
    {
      id: 'sprites', modulo: 'sprites', titulo: 'Sprites, outfits e montarias (overrides): imagem, quadros e cadastro',
      async rodar(ctx) {
        const S = await import('./overrides-sprites.mjs');
        const { createHash } = await import('node:crypto');
        const arquivo = join(ctx.overrides ?? join(RAIZ, 'overrides'), 'sprites.json');
        const achados = [];
        if (!existsSync(arquivo)) return { achados, detalhe: 'sem overrides de sprites' };
        let dados;
        try { dados = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) { return { achados: [erro('overrides/sprites.json', `JSON inválido: ${e.message}`)] }; }
        const entradas = Object.entries(dados.sprites ?? {});
        const pastaPng = join(ctx.overrides ?? join(RAIZ, 'overrides'), 'sprites');
        for (const [look, e] of entradas) {
          const png = join(pastaPng, `${look}.png`);
          if (!existsSync(png)) { achados.push(erro(`look ${look}`, `falta a imagem overrides/sprites/${look}.png.`)); continue; }
          const buf = readFileSync(png);
          if (e.hash && e.hash !== createHash('sha1').update(buf).digest('hex').slice(0, 12)) achados.push(erro(`look ${look}`, 'o hash do cadastro não bate com a imagem em disco (a imagem foi trocada fora da Engine ou está corrompida).'));
          const r = S.analisar(look, { png: buf.toString('base64'), meta: e.meta });
          for (const m of r.erros) achados.push(erro(`look ${look}`, m));
          for (const m of r.avisos) achados.push(aviso(`look ${look}`, m));
          if (e.ativo === false) achados.push(aviso(`look ${look}`, 'override desligado (o jogo usa o original).'));
        }
        if (existsSync(pastaPng)) for (const n of readdirSync(pastaPng).filter((x) => x.endsWith('.png'))) if (!dados.sprites?.[n.slice(0, -4)]) achados.push(aviso(`overrides/sprites/${n}`, 'imagem sem entrada no cadastro (órfã): o jogo não a usa.'));
        if (dados.ativo === false && entradas.length) achados.push(aviso('overrides/sprites.json', 'a camada de overrides de sprites está DESLIGADA: nenhuma alteração vale.'));
        return { achados, detalhe: `${entradas.length} sprite(s) com override` };
      },
    },
    {
      id: 'atos', modulo: 'atos', titulo: 'Acts e fases: estrutura, referências, ids e ordens duplicados',
      async rodar() {
        const Atos = await import('./atos.mjs');
        const achados = [];
        const salvos = Atos.todos().filter((a) => !a.somenteLeitura);
        const vistos = new Map();
        for (const a of salvos) {
          const executa = a.estado === 'beta' || a.estado === 'publicado';
          if (vistos.has(a.id)) achados.push(erro(`ato ${a.id}`, `id duplicado (também em ${vistos.get(a.id)}).`));
          vistos.set(a.id, a.id);
          const r = Atos.validar(a);
          for (const p of r.problemas) {
            // Rascunho/desativado não executa: seus erros são aviso (aparecem na validação do editor, mas não impedem uma versão).
            if (p.nivel === 'erro') achados.push(executa ? erro(`ato ${a.id} · ${p.onde ?? ''}`, p.mensagem) : aviso(`ato ${a.id} (${a.estado}) · ${p.onde ?? ''}`, p.mensagem));
            else if (p.nivel === 'aviso') achados.push(aviso(`ato ${a.id} · ${p.onde ?? ''}`, p.mensagem));
          }
        }
        const ordens = new Map();
        for (const a of salvos.filter((x) => x.estado === 'beta' || x.estado === 'publicado')) { if (ordens.has(a.ordem)) achados.push(erro(`ato ${a.id}`, `a ordem ${a.ordem} já é do ato ${ordens.get(a.ordem)}.`)); ordens.set(a.ordem, a.id); }
        return { achados, detalhe: `${salvos.length} ato(s) do editor` };
      },
    },
    {
      id: 'campanha', modulo: 'campanha', titulo: 'Campanha: fases, níveis e bosses',
      async rodar() {
        const { CATALOGO } = await import('../systems/dados.mjs');
        const c = json('campanha.json');
        const achados = [];
        const hunts = new Set([...(CATALOGO.hunts ?? []), ...(CATALOGO.vips ?? []), ...(CATALOGO.especiais ?? []), ...(CATALOGO.divinas ?? [])].map((h) => h.id));
        const bosses = new Set((CATALOGO.bosses ?? []).map((b) => b.id));
        const vistas = new Set();
        const dif = Object.keys(c.dificuldades ?? {});
        for (const f of c.fases ?? []) {
          if (vistas.has(f.huntId)) achados.push(erro(f.huntId, 'hunt repetida na campanha (o progresso é por hunt).'));
          vistas.add(f.huntId);
          if (!hunts.has(f.huntId)) achados.push(erro(f.huntId, 'a hunt não existe no catálogo.'));
          for (const d of dif) {
            const v = f.nivel?.[d];
            const faixa = c.dificuldades[d].faixa;
            if (!Number.isInteger(v) || v < 1) achados.push(erro(f.huntId, `nível ${d} inválido (${v}).`));
            else if (faixa && (v < faixa[0] || v > faixa[1])) achados.push(aviso(f.huntId, `nível ${d} (${v}) fora da faixa ${faixa[0]}–${faixa[1]} da dificuldade.`));
          }
          if (f.nivel && !(f.nivel.facil <= f.nivel.medio && f.nivel.medio <= f.nivel.dificil)) achados.push(aviso(f.huntId, 'os níveis não crescem de Fácil para Difícil.'));
        }
        for (const [ato, b] of Object.entries(c.bosses ?? {})) {
          if (!bosses.has(b.bossId)) achados.push(erro(`boss do ato ${ato}`, `o boss "${b.bossId}" não existe no catálogo.`));
          for (const d of dif) if (!Number.isInteger(b.nivel?.[d]) || b.nivel[d] < 1) achados.push(erro(`boss do ato ${ato}`, `nível ${d} inválido.`));
        }
        return { achados, detalhe: `${c.fases?.length ?? 0} fase(s), ${Object.keys(c.bosses ?? {}).length} boss(es)` };
      },
    },
    {
      id: 'encontros', modulo: 'encontros', titulo: 'Fases, encontros, bosses únicos e mapa do mundo',
      async rodar() {
        const Conteudo = await import('./conteudo.mjs');
        const a = Conteudo.auditar();
        return { achados: a.problemas.map((p) => ({ nivel: p.nivel === 'erro' ? 'erro' : 'aviso', onde: p.onde, mensagem: p.mensagem })), detalhe: `${a.totais.fases} fase(s) auditadas` };
      },
    },
    {
      id: 'referencias', modulo: 'geral', titulo: 'Referências entre módulos (itens, monstros, drops)',
      async rodar() {
        const B = await import('./biblioteca.mjs');
        const p = B.auditarReferencias();
        // Itens que o Canary referencia e o catálogo importado não tem existem desde a importação: aviso, não impedimento.
        return { achados: p.map((x) => aviso(`${x.categoria} ${x.id}`, `referencia item(ns) que não existem no catálogo: ${x.itensInexistentes.slice(0, 6).join(', ')}${x.itensInexistentes.length > 6 ? '…' : ''}`)), detalhe: `${p.length} referência(s) quebrada(s) no catálogo (preexistentes do Canary são aviso)` };
      },
    },
  ];
}
