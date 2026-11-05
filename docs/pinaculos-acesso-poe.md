# Entrada dos pináculos igual ao PoE (05/11/2026)

Pedido do dono: "quero igual do poe". Até aqui, o painel de Bosses pedia **level 250** para os 11 pináculos. Só que no modo PoE o level máximo é 100, então ninguém entrava, a não ser pelo modo beta, que dispensa o level.

## Como é no PoE

Nenhum pináculo pede level. Cada um abre no **Dispositivo de Mapas** com um conjunto de itens, que sai de uma cadeia de chefes nos mapas T14+.

| Pináculo | Item que abre | De onde sai |
|---|---|---|
| The Shaper | 4 fragmentos (Hidra, Fênix, Minotauro, Quimera) | Guardiões do Criador, cada um no seu mapa T16 |
| The Elder | 4 fragmentos (Escravizador, Erradicador, Constritor, Purificador) | Guardiões do Ancião, em mapas "ocupados" |
| Sirus | 4 Coroas (Baran, Veritania, Al-Hezmin, Drox) | Conquistadores, nas Cidadelas |
| The Maven | A Citação de Maven (10 Lascas Crescentes) | Convites da Maven (ela testemunha 10 chefes) |
| Searing Exarch / Eater of Worlds | Convite Incandescente / Gritante | Estrela Negra / Fome Infinita, e depois 28 mapas T14+ com influência |
| Venarius | O mapa Córtex | Chefes de mapa T14+ |
| Encarnações | Ecos (fragmentos) | As linhas de Memória (3.26) |

Fontes:
- as páginas do poedb, guardadas em `/home/deploy/scrapling/saida/html` e `.../html/pinaculos`;
- o guia da Steam [3038953793](https://steamcommunity.com/sharedfiles/filedetails/?id=3038953793);
- a poewiki ficou de fora porque bloqueia o acesso automático.

## Decisões do dono (05/11)

- **Chefes novos:** os 14 chefes intermediários são feitos "como os pináculos". Cada um usa a criatura de um chefe do Draevor para o desenho, os golpes e os poderes, e recebe do poedb a vida, o dano e as resistências.
- **Em etapas,** um PR por etapa:
  1. **(esta etapa)** os itens, a entrada pelo Dispositivo, a trava de level fora, e Shaper, Elder e Sirus com os guardiões e os conquistadores;
  2. Exarca e Devorador;
  3. Maven;
  4. Venarius e as Encarnações.
- **Testes antigos:** três testes entravam direto na arena, só com level 300. Com o aval do dono, eles agora abrem o pináculo pelo Dispositivo com os itens:
  - `itens-poe-pinaculos`;
  - `boss-so-itens-do-poe`;
  - `so-itens-do-poe`.

  Como a Maven só abre na Etapa 3, os três usam o Shaper. O que cada teste confere continua o mesmo.
- **Modo beta** (ligado em produção): continua dispensando level, task e recarga, mas o pináculo **pede os itens mesmo no beta**.

## O que entrou (Etapa 1)

| Parte | Onde |
|---|---|
| Os dados: 12 fragmentos e coroas, os 4 mapas dos Guardiões do Criador, os 12 chefes (vida, dano, exp, resistências e a criatura-base) e o que cada pináculo pede | `tools/montar-pinaculos-acesso.mjs` → `gamedata/itens-poe/pinaculos-acesso.json` |
| Os ícones (PNG 64×64, do CDN oficial do PoE) | `gamedata/itens-poe/icones-itens/poe-itens/Pinaculos/` |
| O sistema: os chefes como bosses únicos, os itens no catálogo, o drop dos mapas com encontro e o pináculo aberto (6 portais) | `systems/itens-poe/pinaculos-acesso.mjs` |
| A trava da entrada (sem level nem recarga; só com o pináculo aberto) e o chefe do encontro nascendo no mapa | `systems/cacadas.mjs` |
| O drop: os mapas com encontro dos chefes T14+, o fragmento garantido e a Quantidade de Itens dos fragmentos na sacola | `systems/hunt/combate.mjs` |
| O Dispositivo: abrir, voltar, abandonar e a lista dos pináculos | `systems/mapas-dispositivo.mjs`, `websocket/sessao.mjs` |
| A tela: a seção Pináculos no Dispositivo, a linha do encontro no cartão do mapa, o balão do fragmento e os pináculos fora do painel de Bosses e da rotação | `frontend/client/src/mapas-dispositivo.mjs`, `tooltip.mjs`, `panels.mjs`, `world.css` |
| Teste | `testes/pinaculos-acesso-poe.test.mjs` |

### Como funciona

- **Os mapas com encontro:** o chefe de um mapa T14+ tem 8% de chance para cada grupo (Criador, Ancião, Conquistador) de soltar um mapa a mais com o encontro. O poedb não dá essa taxa, então o número é do jogo e se ajusta em `drop.chancePorChefe`.
  - **Guardião do Criador:** um mapa T16 com o nome e o desenho do mapa ("Covil da Hidra"…) e o implícito "Área é influenciada pelo Criador". O guardião é o chefe do mapa.
  - **Guardião do Ancião / Conquistador:** um mapa comum do tier do drop, com o implícito "Mapa ocupado pelo Escravizador" ou "Mapa contém a Cidadela de Baran". O chefe do tier continua, e o do encontro nasce a mais no fundo do mapa.
  - Um mapa Único não leva encontro.
- **O fragmento:** sai garantido do chefe do encontro e vai para a bolsa de quem matou. O poedb diz "It is guaranteed to drop upon killing the map's unique boss".
- **Abrir o pináculo:**
  - o Dispositivo confere um de cada item na mochila, na bolsa ou no depósito do personagem;
  - entra na arena, e os itens só saem depois de a arena nascer;
  - são 6 portais, e cada morte gasta um;
  - vencer ou gastar o último portal fecha o pináculo;
  - com um mapa aberto não se abre um pináculo, e vice-versa.
- **A Quantidade de Itens dos fragmentos:** cada linha do item vale na sacola do pináculo. O Shaper soma +20% (4 × 5%) e o Sirus +40% (4 × 10%).
- **Os chefes intermediários:**
  - Guardiões do Criador: Hidra e Quimera têm 1000% de vida e 200% de dano; Fênix e Minotauro têm 1300% de vida e 140% e 184% de dano;
  - Guardiões do Ancião: 1200% de vida e 150% de dano;
  - Conquistadores: 1300% de vida e 150% de dano;
  - resistências 50/50/50/30 em todos;
  - a vida é relativa ao pináculo mais fraco, como nos pináculos (Venarius 400% = 1×).

## Etapa 2: Exarca e Devorador (05/11)

Fonte: o guia da Steam ("the 14th grants the Polaric Invitation", "the 28th grants the Incandescent Invitation") e o Maxroll (Atlas Questlines).

- **A influência:** o Dispositivo escolhe a influência dos próximos mapas: nenhuma, O Exarca Cauterizado ou O Devorador de Mundos. Ela fica gravada no mapa ao abrir, e vale também no loop. Mora em `estado.atlas`.
- **A contagem:** cada chefe de mapa T14+ vencido num mapa com a influência conta para os convites dela, só para quem matou.
  - A cada 14 cai o **Convite Polarizado** (Exarca) ou o **Contorcido** (Devorador).
  - A cada 28 cai o **Incandescente** ou o **Gritante**, mas esse só começa a contar depois de vencer a arena anterior uma vez, como na ordem da missão do PoE.
- **As arenas intermediárias:** **A Estrela Negra** (1400% de vida, 160% de dano) e **A Fome Infinita** (1800% de vida, 280% de dano). São feitas como os pináculos: boss único, arena da criatura-base e a tabela exclusiva de Únicos do poedb.
  - Estrela Negra: Devastação Polar, Amanhecer Repentino e A Eterna Batalha.
  - Fome Infinita: Zenith Negro e Banquete Sem Fim.
  - Abrem no Dispositivo com o convite delas, com 6 portais.
- **O pináculo:** The Searing Exarch abre com o Convite Incandescente, e The Eater of Worlds com o Gritante.
- **Os convites:** é a variante "moeda" do poedb, a que se usa de novo. Os 4 têm ícone, e o balão diz o que abrem e quando caem.
- **Onde está no código:**
  - `pinaculos-acesso.json` → `influencias`, `arenas` e os 4 convites em `itens` (`convite`, `aCada`, `abre`, `depoisDe`);
  - `pinaculos.mjs` → `arena`, `arenas` e `doDispositivo`;
  - `pinaculos-acesso.mjs` → `definirInfluencia`, `aoVencerChefeDeMapa` e `influenciaParaTela`.
- **Ainda não existe no jogo:** os altares eldritch e os monstros influenciados dos mapas. A influência, por enquanto, só conta para os convites.

## Pontos em aberto

- **A taxa dos mapas com encontro** (8% por grupo por chefe T14+) não tem fonte. Ajustar se ficar raro ou frequente demais.
- **Arena de novo a cada entrada:** voltar pelo portal começa a luta do zero, porque a arena é uma caçada nova. No PoE a vida do chefe se mantém na mesma instância.
- **As Cidadelas:** no PoE, o Conquistador é enfrentado numa área própria (a Cidadela). Aqui ele aparece dentro do mapa.
- **Etapas 3–4:** Maven, Venarius e as Encarnações continuam fechados. A tela os lista como "próximas etapas".
- **Altares eldritch:** os mapas com influência ainda não têm os altares nem os monstros influenciados do PoE.
