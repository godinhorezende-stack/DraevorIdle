# Editor universal de sprites — auditoria e arquitetura

Escopo: monstros, outfits de personagem e montarias. Os três usam **o mesmo formato de folha**, então o editor é um só.

## 1. Como os sprites funcionam hoje (auditado em 1307 desenhos)

- **Uma imagem por `look`**: `gamedata/sprites/outfits/<look>.png` (PNG 8 bits RGBA, sem entrelaçamento, nos 1307 casos) + o cadastro de quadros em `gamedata/outfits.json` (`{ w, h, cw, ch, shift, groups[] }`).
- **Quadros em linhas, resto em colunas**: cada LINHA é um quadro da animação (`groups[g].row` + quadro). Cada COLUNA é `(((z * addons + addon) * dirs + dir) * layers + layer)`:
  - `z`: 0 em pé, 1 pose **montada** (só outfits de personagem, `depth` 2);
  - `addon`: 0..2 (cumulativos);
  - `dir`: 0 norte, 1 leste, 2 sul, 3 oeste;
  - `layer`: 0 desenho, 1 **máscara de cores** (amarelo = cabeça, vermelho = corpo, verde = pernas, azul = pés). O jogo tinge o desenho pela máscara (`engine/outfit-color.mjs`, paleta de 133 cores): as cores do personagem **não** estão gravadas nos pixels.
- **Dois grupos**: 0 = parado, 1 = caminhada (20 looks têm só o 0). `animation.durations[i]` = `[mín, máx]` ms por quadro.
- **Tamanhos**: 1225 looks com quadro 64×64, 81 com 32×32, 1 com 32×64. `shift` varia (0, 3, 4, 5, 8).
- **Renderer** (`frontend/client/src/sprites.mjs`): `outfitFrame` recorta a célula pela fórmula acima, tinge com `colorize`, guarda em cache; `drawCreature` ancora o desenho no canto inferior direito do tile de 32. **Montaria**: desenha a montaria no tile e o personagem por cima, **no mesmo ponto**, na pose montada do outfit dele (`z = 1`). Não há deslocamento do cavaleiro por montaria.
- **Quem usa o look**: monstros (`bestiary[...].look` + `colors`), `mounts-real.json` (`mounts[].look`, `outfits[].look`). Monstros e outfits compartilham o mesmo `outfits.json`.
- **Um dado original inconsistente**: o look 1882 declara 32 quadros (2048 px) mas a imagem tem 576 px. O editor trata erros que o original já tem como avisos (não bloqueia).

## 2. Categorias integradas

| Categoria | Como entra | Específico |
|---|---|---|
| Monstros | Biblioteca → "Editar sprite", aba Sprite do editor de Mobs, menu "Editor de sprites" | alinhamento no tile, cenário, comparação |
| Outfits | idem | máscara de cores, addons, pose montada, cores dinâmicas (visualização), personagem de teste |
| Montarias | idem | cavaleiro de teste montado (outfit, addons e cores escolhidos) |

**Não integrados** (formato diferente, atlas compartilhado por páginas, não uma folha por look): efeitos (`effect-sprites.json`), projéteis (`missile-sprites.json`) e ícones de itens (`item-sprites.json`). Ficam como próxima etapa.

## 3. Como as alterações são guardadas

O original **nunca** é editado. Salvar grava:

- `game/gamedata/overrides/sprites/<look>.png` — a folha editada (mesmo formato do original);
- `game/gamedata/overrides/sprites.json` — `{ ativo, sprites: { "<look>": { ativo, hash, bytes, atualizadoEm, nota?, meta } } }`, com o cadastro de quadros novo (quantidade de quadros, tempos, tamanho).

O cliente do jogo lê `sprites.json` ao carregar (`resolverOverrides` em `engine/sprite-folha.mjs`) e, para os looks com override ativo, usa a imagem (`?v=<hash>`, cache imutável) e o cadastro novos. Sem arquivo, tudo segue como antes. Versões anteriores da imagem e do arquivo ficam em `overrides/_versoes/` (só de acréscimo). Revisão do arquivo → conflito 409; auditoria registra `look`.

Fluxo: editar (na tela) → validar (navegador + servidor) → salvar (arquivo local) → publicar (commit + deploy; em produção a gravação continua desligada).

## 4. Módulos

- `engine/sprite-folha.mjs` — geometria, desmontar/montar, validação (meta e pixels), `resolverOverrides`. Puro, usado pelo navegador e pelo servidor.
- `engine/sprite-edicao.mjs` — ferramentas de pixel, quadros/animação, histórico, importação (grade, sugestão, regiões, modos), exportação. Puro, imutável.
- `engine/png-minimo.mjs` — leitor/escritor de PNG sem dependências.
- `admin/overrides-sprites.mjs` — propor/salvar/reverter/ativo/restaurar versão; rotas `overrides/sprites*` em `admin/conteudo-http.mjs`.
- `frontend/client/src/editor-sprites-editor.mjs` (tela), `editor-sprites-preview.mjs` (isolado, contextual, comparação, paleta), `editor-sprites-io.mjs` (PNG ⇄ bitmap, download).
- `frontend/client/src/sprites.mjs` — `urlDaFolha`, `registrarVariante`/`removerVariante` (a pré-visualização usa o mesmo renderer do jogo).

## 5. Limitações técnicas que permanecem

1. **Criar um look novo** (ID novo) não é suportado: o editor altera os existentes. Um monstro novo usa um look existente (editor de Mobs).
2. **O renderer atual ignora** `animation.loop/start/random` e `shift`: o editor os guarda no cadastro, mas não têm efeito no jogo sem mudança de runtime. O renderer usa só a duração mínima de cada quadro.
3. **Todas as direções compartilham a quantidade de quadros** (o formato guarda uma linha por quadro). Reordenar/duplicar/remover vale para as quatro.
4. **Deslocamento do cavaleiro por montaria** não existe no jogo. A altura do personagem montado é a pose "montada" do outfit dele (vale para todas as montarias): edite-a no outfit. Oferecer offset por montaria exige mudar o `drawCreature` (dependência de runtime), não implementada.
5. **Cenário contextual é de teste** (tiles gerados), não o atlas real do mapa.
6. A estrutura de colunas (direções, camadas, addons, poses) **não pode mudar**: o jogo e o sistema de cores dependem dela.
7. As **cores dinâmicas são só visualização**: o editor nunca grava a cor final nos pixels; para mudar onde a cor cai, edite a máscara.
8. Overrides de imagem são servidos como PNG (sem o par `.webp` que os originais têm); é mais pesado, funciona igual.
9. Não testado em navegador real nesta sessão: os testes automatizados cobrem o modelo, o servidor e a fiação; a tela foi exercitada com jsdom + canvas simulado.
