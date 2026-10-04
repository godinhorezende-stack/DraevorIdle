# Engine do Draevor — Fase C: arquitetura do núcleo de configuração e plano do piloto (04/10/2026)

Proposta para aprovação. **Nada disto foi implementado ainda.** Princípios: evoluir o que existe (não reconstruir), uma fonte de
verdade por dado, a mesma conta no jogo, no simulador e no editor, e nenhuma mudança chega à produção sem passar por git → PR → deploy.

## 1. O núcleo: um registro de "módulos de configuração"

Cada sistema configurável se declara UMA vez num registro do servidor (`game/engine-config/modulos/<id>.mjs`):

```js
export default {
  id: 'itens-modificadores',
  nome: 'Modificadores de item',
  arquivos: ['itens/atributos.json', 'itens/pools.json', 'itens/tiers.json', 'itens/raridades.json'], // a fonte de verdade (gamedata)
  validar: (dados) => [...],          // o validador do PRÓPRIO sistema, recebendo os dados (sem ler disco)
  dependentes: ['afixos', 'ficha', 'gerar', 'tooltip'],   // o que precisa reagir
  recarga: 'quente' | 'reinicio' | 'migracao',            // como a mudança entra num servidor rodando
  recarregar: (dados) => {...},       // só quando 'quente' e seguro (troca atômica)
  testes: ['itens-geracao', 'atributos-efeito', 'auditoria-modificadores', 'itens-compat'], // a suíte pertinente
  simular: (dadosAtuais, dadosPropostos, opcoes) => relatorio, // reaproveita os simuladores existentes
};
```

O editor não conhece regra nenhuma: ele lista, edita e manda o rascunho; quem valida, simula, testa e grava é o módulo.

## 2. Fluxo de uma mudança (o mesmo para todo módulo)

```
Rascunho ─► Validação ─► Simulação ─► Testes ─► Aprovação ─► Versão (arquivo + histórico) ─► commit na branch ─► PR ─► deploy
```

| Passo | O que acontece | Onde fica |
|---|---|---|
| Rascunho | Cópia editável dos arquivos do módulo | `game/engine-config/rascunhos/<modulo>/` (fora do git: `.gitignore`) |
| Validação | `modulo.validar(rascunho)` — a mesma função que o boot usa | resposta da rota |
| Simulação | Antes × depois com as funções reais (ex.: 20 mil peças geradas com cada versão, DPS/vida efetiva por raridade) | relatório anexado à mudança |
| Testes | A suíte pertinente rodando com o rascunho por cima (`ENGINE_SOBREPOR=<pasta>`), num processo separado | relatório anexado |
| Aprovação | Só com validação limpa e testes verdes; o dono aprova na tela | registro da mudança |
| Versão | Grava em `gamedata/`, acrescenta a entrada no histórico, gera o diff | `gamedata/_historico/<modulo>.jsonl` (no git) |
| Publicação | Commit na branch de trabalho; o resto é o fluxo de sempre (PR, merge, `deploy.sh`) | git |

Cada entrada do histórico: `id`, autor, data, módulo, valores anteriores e novos (diff por caminho JSON), motivo, resultado da
validação, testes executados, status (`rascunho → validado → testado → aprovado → versionado`/`rejeitado`) e a versão.

**Por que arquivo e não banco:** o `gamedata` já é a fonte de verdade lida no boot; a produção já o trata como somente leitura; o git já é
o versionamento e o deploy. Uma tabela no Postgres criaria uma segunda verdade. (Decisão a confirmar.)

## 3. Hot reload

- `quente` só quando o módulo sabe trocar a configuração inteira de uma vez (nunca pela metade) e quando o cliente não guarda cópia — ou
  quando o módulo reenviar o catálogo às sessões abertas.
- `reinicio`: a engine avisa "aplica no próximo reinício" (o dev local reinicia sozinho; produção, no deploy).
- `migracao`: muda dado salvo de personagem (ex.: renomear um mod) — exige conversão versionada (o padrão `renomearAdds`) e nunca é quente.
- Rascunho nunca entra no servidor que você está jogando: o teste com rascunho roda num processo à parte; "aplicar localmente" só depois
  de aprovado.

## 4. Biblioteca de referência do PoE e comparação

- **Importador** (Fase B): lê a pasta local `/home/deploy/referencias-poe/original` (fora do repositório), indexa por arquivo, categoria,
  fonte (a URL do PoEDB/Wiki que cada documento declara) e hash; detecta duplicatas; reimportar compara hashes e registra o que mudou.
  O índice fica fora do git; o repositório só guarda o **mapeamento** (qual documento embasa qual decisão).
- **Comparação PoE × Draevor**: uma ficha por mecânica (`docs/poe-comparacao/<id>.json`, no git) com referência, fonte, fórmula,
  implementação atual (arquivo:linha), diferenças, compatibilidade, impacto, proposta e status (`não analisado` … `aprovado`/`rejeitado`).
  A ficha **não muda regra nenhuma**: aprovar uma proposta abre um rascunho no módulo de configuração correspondente.
- **Assets visuais de referência**: catálogo (formato, dimensões, hash, origem) visível só na engine local, com o selo
  "referência — não distribuível"; não servido pela produção; não associado a entidade do jogo publicada (ver decisão no fim).

## 5. Piloto recomendado (Fase D): modificadores de item

**Por que este:** é o melhor par impacto × risco que a auditoria encontrou —
- dados 100% em JSON e já validados no boot (`itens/config.mjs`); nenhuma regra duplicada (teste M3);
- testes fortes que provam geração e efeito real (`itens-geracao`, `atributos-efeito` com 57 sondas, `auditoria-modificadores`);
- não tem editor hoje (o próprio relatório pede um);
- risco contido: peças já existentes guardam seus valores; a mudança vale para drops novos;
- a referência é a parte mais rica da coleção (`modificadores-tiers.json` do PoEDB: família, prefixo/sufixo, tier, iLvl, peso).

**Entregas do piloto, de ponta a ponta:**
1. Refatorar a validação de `itens/config.mjs` para receber os dados (`validarDados(arquivos)`), com o boot chamando a mesma função.
2. Módulo `itens-modificadores` no registro (arquivos, validar, dependentes, recarga, testes, simular).
3. Rotas da engine (sob `/api/mapas/_engine/`): ler, salvar rascunho, validar, simular, testar, aprovar, histórico, diff.
4. Editor "Modificadores de item": lista com busca e filtros, edição das faixas T1–T5, pesos, nível mínimo, raridades e pools; diff
   com a versão atual; avisos de sobreposição de faixas (as recomendações do relatório de modificadores).
5. Simulação: N peças por raridade/Item Level com a versão atual e a proposta (as mesmas funções de `gerar.mjs`), distribuição de tiers,
   média de valores, e o efeito na ficha de um personagem de teste (simulador existente).
6. Testes rodando com o rascunho sobreposto; histórico versionado; aprovação; aplicação local (reinício controlado).
7. Ficha de comparação PoE × Draevor do sistema de mods (prefixo/sufixo, famílias, tiers, iLvl, pesos), apontando os documentos.

**Fora do piloto (decisão de design separada):** adotar prefixo/sufixo e famílias do PoE muda o modelo da peça e a geração — é uma
proposta para a ficha de comparação, a ser aprovada depois do piloto, não algo que o piloto troca sozinho.

## 6. Migração incremental

1. Piloto (modificadores de item) — validar o padrão com você.
2. Fórmulas e limites do combate (`combate/*.json`) — já têm `modo`; ganham editor + simulador de DPS/vida efetiva.
3. Gemas (ativas/suporte, regras de uso), monstros (raridades, mods, distribuição), passivas.
4. Os editores que já existem (encontros, bosses únicos, atos) passam a usar o mesmo histórico e o mesmo fluxo de aprovação.
5. Catálogo de assets (próprios e de referência) e a ficha de comparação para o restante dos sistemas.

Rollback: cada versão é um commit; voltar é reverter o commit (e, se houver migração de dado salvo, a conversão inversa versionada).
