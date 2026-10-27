# Famosodle

Jogo diário de adivinhar figuras históricas, no estilo Wordle e Narutodle. A interface é toda em português do Brasil. É um site estático (HTML, CSS e JavaScript puro, sem framework) publicado na Vercel em https://famosodle.vercel.app/. Este documento explica o projeto para quem for continuar o trabalho, seja uma pessoa ou o Claude Code. A auditoria completa de outubro de 2026 está em `AUDITORIA.md` e o passo a passo de publicação em `DEPLOY.md`.

## Como começar

```bash
npm install        # dependências de build e de teste (nada disso vai para o site)
npm run build      # gera dados/data.json e a pasta dist/
npm test           # roda o build e os testes automáticos no Chrome instalado
```

Para jogar na hora, abra `dist/famosodle.html` direto no navegador. Para ver a versão de site com os mesmos cabeçalhos da Vercel, rode `npm run servir` e abra http://127.0.0.1:4173.

Se o PowerShell bloquear o `npm` por política de execução, use `npm.cmd` ou um terminal do Prompt de Comando.

Comandos:

- `npm run dados` lê as listas de figuras, valida tudo e grava `dados/data.json`, marcando quem tem foto no pacote.
- `npm run empacotar` junta dados, código, fontes, imagens fixas e fotos, minifica e grava `dist/` e os dois `vercel.json`.
- `npm run build` faz os dois passos acima.
- `npm test` roda o build e depois os testes do Playwright (pasta `testes/`).
- `npm run servir` serve `dist/famosodle` como a Vercel serviria.
- `npm run baixar-fotos` baixa as fotos da Wikipedia para `fotos/` e grava os créditos.
- `npm run baixar-bandeiras` baixa do Wikimedia Commons a bandeira de cada país das figuras para `bandeiras/` e grava os créditos. Rode depois de incluir figuras de um país novo.
- `npm run verificar-fotos` confere os títulos da Wikipedia (artigo inexistente, redirecionamento, desambiguação, sem foto livre).
- `npm run verificar-dados` compara nascimento, morte e gênero com o Wikidata (serve para descobrir quem morreu).
- `npm run imagens` gera de novo `og.png`, os ícones e o `favicon.ico` em `src/estaticos/`.
- `npm run lighthouse` mede o site com o Lighthouse (perfil de celular, 3 rodadas, relatórios em `lighthouse/`).

## Estrutura

```
CLAUDE.md                 este guia
AUDITORIA.md              auditoria de outubro de 2026: problemas, correções, mudanças nos dados, Lighthouse
DEPLOY.md                 como publicar no GitHub e na Vercel
package.json              scripts e dependências de build e teste, todas com versão exata
vercel.json               gerado pelo empacotar; não edite à mão, mas faça commit dele
playwright.config.js      configuração dos testes
dados/figuras.txt         primeira lista de figuras (160)
dados/figuras-extra.txt   segunda lista (215), inclui as figuras brasileiras e políticas
dados/data.json           gerado; não edite à mão
src/index.html            página do jogo, com marcadores que o build troca (ícones, fontes, CSS e JS)
src/404.html              página de erro no mesmo estilo, sem JavaScript
src/estilo.css            todo o CSS (cores, fontes de reserva, layout)
src/app.js                toda a lógica do jogo. Marcadores /*__DATA__*/{}, /*__SITE__*/"" e /*__FLAGS__*/null recebem os dados, o endereço e (só no arquivo único) as bandeiras
src/estaticos/            favicon, ícones, og.png, robots.txt, sitemap.xml e site.webmanifest (__SITE__ vira o endereço)
scripts/gerar-dados.js    valida as listas e gera data.json
scripts/empacotar.js      monta dist/, minifica, põe hash nos nomes e escreve os cabeçalhos de segurança
scripts/wikimedia.js      funções comuns dos scripts que falam com a Wikimedia (User-Agent, pausas, lotes)
scripts/baixar-fotos.js   baixa as fotos e grava fotos/fotos-1/creditos.json
scripts/baixar-bandeiras.js baixa as bandeiras e grava bandeiras/creditos.json
scripts/verificar-fotos.js, scripts/verificar-dados.js   conferências dos dados (não mudam arquivos)
scripts/gerar-imagens.js  gera og.png, ícones e favicon.ico no Chrome
scripts/calibrar-fontes.js mede o size-adjust das fontes de reserva
scripts/servir.js         servidor local com os cabeçalhos do vercel.json (testes, Lighthouse, npm run servir)
scripts/medir-lighthouse.js roda o Lighthouse por npx, na versão fixa 13.5.0
testes/                   testes do Playwright
fotos/                    fotos-1 a fotos-4 com as fotos do site e o creditos.json (vai para o git)
bandeiras/                xx.png de cada país (código ISO em minúsculas) e o creditos.json (vai para o git)
dist/famosodle/           o site: index.html, 404.html, assets/, fotos, bandeiras, ícones e vercel.json
dist/famosodle.html       versão em arquivo único, sem minificar, com fontes e script embutidos
```

As pastas `node_modules/`, `dist/`, `test-results/`, `playwright-report/` e `lighthouse/` ficam fora do git. As pastas `fotos/` e `bandeiras/` **vão** para o git, porque a Vercel monta o site a partir delas.

## Formato das listas de figuras

Uma figura por linha, campos separados por `|`, sempre 10 colunas. Linhas vazias e linhas que começam com `#` são ignoradas.

```
nome|tituloWikipedia|gênero|país|áreas|nascimento|morte|dica1|dica2|frase
Albert Einstein|Albert_Einstein|M|DE|cie|1879|1955|Físico teórico|Formulou a teoria da relatividade|A imaginação é mais importante que o conhecimento.
Paulo Freire|Paulo_Freire|M|BR|fil|1921|1997|Educador e filósofo|Escreveu Pedagogia do Oprimido|
```

- **nome**: como aparece no jogo, em português.
- **tituloWikipedia**: título exato do artigo na Wikipedia em inglês, com `_` no lugar de espaço. É dele que vem a foto. Use o título final, não um redirecionamento (`npm run verificar-fotos` aponta os que redirecionam).
- **gênero**: `M` ou `F`.
- **país**: código ISO de duas letras (BR, US, DE...). O continente sai do país, pela base `world-countries`. Os nomes de país em português vêm da mesma base, com correções em `nomeBR` dentro de `gerar-dados.js`.
- **áreas**: um ou mais códigos separados por vírgula: `pol` Política, `cie` Ciência, `art` Artes, `mus` Música, `lit` Literatura, `esp` Esporte, `ati` Ativismo, `exp` Exploração, `mil` Militar, `fil` Filosofia, `neg` Negócios, `cin` Cinema e TV, `rel` Religião.
- **nascimento** e **morte**: ano. Negativo é antes de Cristo (`-356`). `~` na frente marca data aproximada (`~1225`). Morte `-` significa que a pessoa está viva.
- **dica1**: ocupação curta. Aparece depois de 5 erros.
- **dica2**: um feito marcante. Aparece depois de 10 erros.
- **frase**: opcional, até 140 caracteres. Só quem tem frase entra no modo Frase.

Apelidos que o jogador pode digitar (Lula, JK, FHC, Jango, Evita, MLK...) ficam no objeto `ALIAS` em `gerar-dados.js`. A busca ignora acentos e maiúsculas, e o nome exato digitado sempre vem primeiro nas sugestões.

O `gerar-dados.js` para o build com erro se encontrar: número errado de colunas, espaço sobrando no começo ou no fim de um campo, país inexistente, área ou gênero inválido, ano em formato errado ou no futuro, morte antes do nascimento, dica vazia, frase longa demais, nome repetido, título da Wikipedia repetido, apelido para figura que não existe, apelido igual ao nome de outra figura ou travessão em qualquer campo. Ele avisa (sem parar) quando alguém marcado como vivo teria mais de 105 anos.

### Regra importante dos ids

Cada figura recebe um id pela posição (`p001`, `p002`...), contando só as linhas válidas, primeiro de `figuras.txt` e depois de `figuras-extra.txt`. Por isso:

- Figuras novas entram sempre **no fim de `dados/figuras-extra.txt`**.
- Nunca apague, mova ou reordene linhas existentes. Para corrigir uma figura, edite a linha dela no lugar. Para tirar alguém, troque a linha por outra figura em vez de apagar.
- Mudar ids quebra os jogos salvos dos jogadores e o mapa de fotos (`fotos-1/creditos.json`).

Depois do lançamento, qualquer figura nova também muda a sequência das respostas dos próximos dias, porque o sorteio embaralha a lista inteira. O mesmo vale para o modo Foto quando o pacote de fotos ganha ou perde alguém. Publique essas mudanças logo depois da meia-noite de Brasília, para não trocar a resposta no meio de um dia.

### Conferir os dados

- `npm run verificar-fotos` antes de publicar figuras novas.
- `npm run verificar-dados` de tempos em tempos: lista diferenças com o Wikidata. Duas diferenças são conhecidas e estão certas nos dados: Castelo Branco nasceu em 1897 (o Wikidata diz 1900; a Wikipedia diz 1897) e Amelia Earhart desapareceu em 1937 (o Wikidata usa 1939, ano da declaração de morte).

## Regras do jogo (src/app.js)

Modos, com o id usado no código e no armazenamento:

- Clássicos: `g` Global, `af` África, `am` América, `as` Ásia, `eu` Europa, `oc` Oceania. Cada modo continental só aceita figuras do próprio continente.
- `foto`: foto da figura borrada, que fica mais nítida a cada erro (níveis em `BLUR`).
- `frase`: uma frase da figura.

Resposta do dia (função `answer()`):

- O dia vira à meia-noite de Brasília (UTC menos 3), em `spKey()`. A virada é conferida a cada segundo e quando a aba volta do segundo plano.
- `LAUNCH` (hoje `2026-10-26`) é o dia 1 da contagem. Cada modo tem uma semente em `SEEDS`, e a lista do modo é embaralhada uma vez com `mulberry32`; a resposta é a posição do dia nessa ordem. Pergunte à pessoa dona do projeto antes de mudar `SEEDS`, o embaralhamento ou essa lógica.
- O Global evita repetir as respostas dos continentes no mesmo dia. Foto e Frase evitam a resposta do Global.
- O modo Foto sorteia só entre as figuras com `ph: 1` em `data.json`, isto é, as que têm foto no pacote `fotos/`. Assim a resposta é igual para todo mundo e não depende da rede. Se o build não tiver fotos, o Foto sorteia entre todas.
- Há modo treino com figura aleatória (Fisher-Yates com `Math.random`), que não conta nas estatísticas. Ele aparece depois de resolver o dia.

Comparação do modo clássico, coluna por coluna: Pessoa (foto e nome), Gênero, País, Área, Nascimento, Morte, Idade.

- País fica amarelo quando faz fronteira com o país certo nos modos continentais, e quando é do mesmo continente no Global. País sem fronteira terrestre nunca fica amarelo nos continentes.
- Área fica amarela quando divide pelo menos uma área.
- Nascimento e Morte ficam amarelos a até 10 anos, e Idade a até 5. As setas dizem se o valor certo é maior ou menor. A idade desconta um ano quando a vida cruza o ano 1 (não existe ano zero).
- Além da cor, cada quadro tem um sinal no canto (✓ igual, ≈ perto, ✕ diferente) e um texto escondido para leitores de tela.

Nos modos Foto e Frase, cada palpite mostra etiquetas curtas (mesmo país, mesmo continente, área parecida, nasceu antes ou depois). As dicas desses modos são "Dica 1" (país e ocupação) e "Dica 2" (feito).

Cada palpite é anunciado numa região `aria-live` (`#announce`). Ao acertar, o foco vai para o nome da figura no cartão do resultado. As abas respondem às setas, Home e End. Os diálogos devolvem o foco a quem os abriu.

O progresso fica no `localStorage` do jogador, na chave `famosodle:v1` (formato `{ v: 1, stats, games }`, o mesmo desde o início). A aba escolhida fica em `famosodle:v1:ui`, a ajuda vista em `famosodle:v1:help` e o cache das fotos da Wikipedia em `famosodle:fotos:v1`, por 14 dias. Tudo que volta do `localStorage` passa por `readState()`, que só aceita números, datas e ids conhecidos. Se o `localStorage` estiver desligado ou cheio, o jogo funciona e avisa uma vez que não vai salvar. Duas abas abertas se mantêm em dia pelo evento `storage`. Não existe servidor nem conta.

## Fotos

O jogo procura a foto de cada figura nesta ordem:

- **Embutida**: só na cópia offline gerada pelo botão "Salvar cópia com as fotos". As fotos ficam dentro do próprio HTML (`PHOTO_EMBED`).
- **Do próprio site**: as fotos vêm de `fotos-N/pXXX.jpg` ao lado do `index.html`, com os créditos em `fotos-1/creditos.json`. Esse arquivo só é baixado quando a primeira foto é pedida. Figuras que faltarem no pacote são buscadas na Wikipedia.
- **Wikipedia**: a API da Wikipedia em inglês devolve a imagem principal do artigo (miniatura de 500 px), só se tiver licença livre (`pilicense=free`), e os créditos (autor, licença e página do arquivo) vêm do Wikimedia Commons. Os pedidos são agrupados: até 50 títulos por consulta de imagem e 25 por consulta de créditos, com tempo limite de 10 segundos.

Toda foto mostra o crédito (autor, licença e link para a página do arquivo no Commons ou na Wikipedia). No modo Foto, durante a partida, aparece só a licença e um botão "ver autor e fonte", porque o autor e o nome do arquivo podem entregar a resposta; o crédito completo aparece ao acertar ou ao clicar no botão. Use apenas imagens com licença livre e mantenha os créditos.

As imagens externas são carregadas com `crossOrigin = "anonymous"` e `referrerPolicy = "no-referrer"`, e as miniaturas com `loading = "lazy"`.

### Como gerar o pacote de fotos do site

O caminho principal é `npm run baixar-fotos`:

- Para cada figura, pega a imagem principal livre do artigo, numa miniatura de 500 px de largura (um dos tamanhos padrão da Wikimedia; as miniaturas vêm de `thumb.wikimedia.org` e arquivos menores vêm inteiros de `upload.wikimedia.org`).
- PNG vira JPEG (com pngjs e jpeg-js, pintando a transparência com a cor do quadro). GIF e WebP ficam de fora e o jogo busca na Wikipedia.
- Recomprime todas com o codificador JPEG do Chrome, pelo Playwright, na qualidade 0,8. Sem Chrome, as fotos ficam como vieram (maiores).
- Tira o HTML do campo de autor, corta textos longos e grava `fotos/fotos-1/creditos.json` com `f` (caminho), `file`, `a` (autor), `l` (licença), `u` (página do arquivo), `r` (`c` Commons ou `w` Wikipedia), `v` (hash do arquivo, vai na URL da foto para furar o cache quando ela muda) e `n` (nome, só para leitura humana).
- Quando a imagem principal do artigo não é livre, mas o Commons tem um retrato livre da pessoa, ponha o arquivo em `ALTERNATIVAS` no começo do script (hoje só Darcy Ribeiro). Eddie Mabo não tem retrato livre e fica sem foto (e fora do modo Foto).
- Segue a política de User-Agent da Wikimedia (`FamosodleBuild/1.0 (https://famosodle.vercel.app/)`), um pedido por vez com pausa de 300 ms, e respeita 429, Retry-After e maxlag. Se o endereço do site mudar, troque `SITE` em `scripts/wikimedia.js` também.
- As pastas só são trocadas no fim; se algo falhar no meio, `fotos/` fica como estava.

Em outubro de 2026 o pacote tem 374 fotos e cerca de 23,5 MB.

Cada pasta tem no máximo 100 arquivos (99 fotos, mais o `creditos.json` na primeira). O envio pelo site do GitHub aceita **menos** de 100 arquivos por vez, então a `fotos-1`, que tem 100, precisa ir em duas vezes. Pelo git (VS Code ou terminal) esse limite não existe. Depois de adicionar figuras, rode `npm run baixar-fotos` e `npm run build` de novo.

O caminho alternativo continua funcionando: na versão em arquivo único (`dist/famosodle.html`), os botões "Gerar pacote de fotos para o site" e "Salvar cópia com as fotos" fazem o pacote e a cópia offline pelo navegador. Eles dependem do `PRISTINE` e do texto exato `const PHOTO_EMBED = null; /*__EMBED__*/`, por isso o arquivo único não é minificado e o build para se o marcador sumir.

## Build e cache

- O site (`dist/famosodle/`) tem o JavaScript e o CSS minificados com esbuild e salvos em `assets/` com hash do conteúdo no nome (`app.<hash>.js`, `famosodle.<hash>.css`, `fonts/<fonte>.<hash>.woff2`). Esses arquivos têm cache `immutable` de um ano. A regra do `vercel.json` só casa com nomes nesse formato (10 dígitos hexadecimais antes da extensão), para um 404 em `/assets/` não ficar em cache. Se mudar o tamanho do hash, mude a regra também.
- `index.html`, `404.html`, ícones, `og.png`, `robots.txt`, `sitemap.xml` e `site.webmanifest` usam o cache padrão da Vercel (revalida sempre).
- Fotos têm um dia de cache com `stale-while-revalidate` de uma semana; o hash `v` do `creditos.json` muda a URL quando a foto muda. As bandeiras têm o mesmo cache, sem hash, porque quase nunca mudam.
- O empacotar apaga `dist/famosodle` no começo, para não publicar arquivos velhos.
- O HTML do site é minificado de forma leve (comentários e espaços entre tags); o modelo não tem `<pre>` nem `<textarea>`.
- O endereço público fica na constante `SITE` de `scripts/empacotar.js` e entra na URL canônica, em `og:url`, `og:image`, `robots.txt`, `sitemap.xml` e no texto de compartilhar (no site, o texto usa o endereço da própria página).

## Segurança

O site foi preparado para ser público. Ao mexer no código, mantenha estas regras:

- **Cabeçalhos**: definidos em `scripts/empacotar.js` e escritos no `vercel.json` da raiz e em `dist/famosodle/vercel.json`. A Vercel lê o `vercel.json` da raiz **antes** de rodar o build, então depois de mudar cabeçalhos rode `npm run build` e faça commit do `vercel.json` (o build avisa quando ele muda).
- **CSP**: `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org; connect-src 'self' https://en.wikipedia.org; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Não há `'unsafe-inline'` nem `data:`: nada de `<script>` ou `<style>` no HTML do site, nada de atributo `style` nem `onclick`, e ajustes de estilo pelo JavaScript só via CSSOM (`el.style.filter = ...`). As setas e os sinais dos quadros são SVG no próprio HTML. Qualquer domínio novo precisa entrar no CSP.
- **CSP do arquivo único**: aberto por `file://`, ele não recebe cabeçalhos, então leva o CSP numa `<meta>` (`cspSingle` em `empacotar.js`), que vai junto para a cópia offline. Ele permite script e estilo inline (estão embutidos), fontes e imagens em `data:`, imagens e conexões só com a Wikipedia e a Wikimedia. Domínio novo entra nos dois CSPs.
- **Fotos publicadas**: o empacotar copia de `fotos/fotos-N/` só os arquivos `pXXX.jpg` e o `creditos.json` da `fotos-1`, e ignora atalhos. Qualquer outro arquivo nessas pastas fica fora do site. De `bandeiras/` ele copia só o `xx.png` dos países que estão nos dados, e para o build se faltar o crédito (licença e página do arquivo no Commons) de alguma.
- **Outros cabeçalhos**: HSTS de dois anos, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` em `/assets/`, nas pastas de fotos e em `/bandeiras/` (não em `og.png` nem nos ícones, que outros sites mostram) e `Permissions-Policy` para câmera, microfone, localização, pagamento e USB. Não use `interest-cohort` (o Chrome registra erro) nem COEP `require-corp` (bloquearia as imagens da Wikimedia).
- **Texto de fora**: dados da Wikipedia entram com `textContent` ou passam por `textOnly()` (remove script, style e caracteres invisíveis ou de controle bidirecional, com limite de tamanho) e `esc()`. Ao montar HTML com `innerHTML`, passe todo valor variável por `esc()`, inclusive bandeiras.
- **localStorage e creditos.json**: tudo que é lido de volta é tratado como não confiável. Ids precisam ter o formato `p000` e existir nos dados (`isId`); os índices usam objetos sem protótipo, para `__proto__` e `constructor` não passarem. Endereços de foto em cache só valem se forem dos domínios da Wikimedia (`IMG_HOST`), com data finita e no passado; caminhos locais precisam bater com `LOCAL_PATH`, páginas de arquivo com `PAGE_URL`, e fotos embutidas na cópia offline precisam ser JPEG em `data:` (`embedded()`).
- **Rede**: o site só fala com a própria origem, `en.wikipedia.org`, `upload.wikimedia.org` e `thumb.wikimedia.org`, sempre com `credentials: "omit"`. Links externos usam `rel="noopener noreferrer"` e só `https`.
- **Dependências**: só de build e teste, com versão exata e `package-lock.json` no git. O esbuild tem um `postinstall` que só confere o binário da plataforma (o binário vem do pacote opcional `@esbuild/<plataforma>`). Ele não é necessário e fica negado em `allowScripts` no `package.json` (o npm 11 bloqueia scripts de instalação por padrão e respeita essa lista; versões mais antigas do npm ignoram o campo e rodam o script, o que é inofensivo). Rode `npm audit` de vez em quando.
- **Sem dados pessoais**: o jogo não coleta nada, não tem formulário, nem cookies, nem análise de terceiros. Se um dia entrar analytics, atualize o aviso de privacidade no diálogo de créditos.
- As respostas ficam no código do navegador, então quem souber olhar consegue descobrir. Para um jogo casual isso é aceitável.

## Design

Paleta preto e creme inspirada no modelo "History Project" do Canva. As cores ficam em variáveis no topo de `src/estilo.css`:

```
--paper #efe3c8   fundo
--card  #f7efdd   cartões
--sand  #e3d3b1
--ink   #1f1b1d   texto e faixas pretas
--ink-2 #2b2629
--muted #655a4b   --muted-d #bcae93
--line  #cdbb98   --line-d #4a4144
--ok    #56744a   verde (certo)
--near  #c39a3e   dourado (perto)
--bad   #8b3a31   vermelho (errado)
```

`--muted` era `#6e6253` e ficou um pouco mais escuro para passar no contraste AA também sobre `--sand`.

Fontes:

- Títulos: Perandory, se estiver instalada no computador do jogador (`local()`). Ela não vem junto com o projeto, então a reserva é Instrument Serif. Só embuta a Perandory se a licença dela permitir uso em sites.
- Texto: Open Sauce Sans.
- Instrument Serif e Open Sauce Sans vêm dos pacotes `@fontsource` (licença OFL). O site usa os arquivos em `assets/fonts/`, com `preload` das três do primeiro desenho (Open Sauce 400 e 600, Instrument Serif 400) e `font-display: swap`; o arquivo único leva as fontes embutidas em base64.
- O `.woff2` do peso 400 da Open Sauce vem corrompido no pacote 5.3.0, então esse peso usa o `.woff`. O empacotar confere a assinatura de cada fonte e para o build se alguma estiver quebrada.
- Enquanto as fontes carregam, o texto usa fontes de reserva com `size-adjust` calibrado (Arial para a Open Sauce, Times New Roman para a Instrument Serif), para nada mudar de lugar quando elas chegam. Se as fontes mudarem, rode `node scripts/calibrar-fontes.js` e atualize os valores no topo de `src/estilo.css`.

As bandeiras são imagens, não emoji, porque o Windows desenha o emoji de bandeira como duas letras ("BR"). Elas vêm do Wikimedia Commons: o `baixar-bandeiras` pega no Wikidata o arquivo da bandeira (P41) do país com o código ISO (P297) e baixa a miniatura PNG de 120 px que a Wikimedia gera do SVG. O `gerar-dados` grava o tamanho em `countries[c].fl`; sem imagem, o jogo mostra o emoji (`countries[c].f`). No site elas ficam em `bandeiras/`; no arquivo único vão embutidas em `FLAG_EMBED`. O crédito de cada uma (autor, licença e link) aparece numa lista dentro do diálogo "Sobre as imagens", montada pelo empacotar no marcador `<!--__BANDEIRAS__-->`. Quando o Wikidata não indicar um arquivo só, ponha o arquivo em `ARQUIVOS` no começo do script.

Na linha de palpites, a sugestão mostra a bandeira e o nome; depois do Enter, o primeiro quadro mostra a foto com o nome por cima (`.tile-person`). Sem foto, aparecem as iniciais. Em telas estreitas o tabuleiro rola de lado e a coluna da pessoa fica fixa.

O HTML já traz os botões de região, as dicas e o cabeçalho do tabuleiro, e reserva altura para as linhas preenchidas pelo JavaScript, para a página não pular quando o script roda.

Acessibilidade: áreas de toque com pelo menos 44 px, contorno de foco preto nas áreas claras e dourado nas escuras, rótulos escondidos nos campos de busca, tabuleiro com papéis de tabela e `prefers-reduced-motion` respeitado também na rolagem.

## Convenções de conteúdo

- Todo texto da interface em português do Brasil.
- Nunca use travessão (os caracteres U+2014 e U+2013) no meio de frases, nem na interface nem nos dados. O build para se encontrar. Nos scripts que procuram esses caracteres, a expressão é montada com `String.fromCharCode`, para o próprio código não conter o caractere. A única exceção são os nomes de arquivo do Commons no campo `file` do `creditos.json` (dois têm travessão): são identificadores, servem só para montar links e nunca aparecem na tela.
- Não numere títulos nem parágrafos.
- Dicas de políticos são neutras e factuais (cargo, período, feito), para figuras de qualquer lado político.
- Frases são curtas, bem atribuídas, traduzidas para o português e de domínio amplo. Nada de letras de música ou trechos longos de obras protegidas. Frase duvidosa ou mal atribuída sai ou é trocada (veja as trocas em `AUDITORIA.md`).
- Só imagens com licença livre, sempre com crédito. Nada de imagens de personagens ou obras protegidas.

## Testes

`npm test` roda o build e 26 testes do Playwright em `testes/`, usando o Chrome instalado (`channel: "chrome"`). Sem Chrome, rode `npx playwright install chromium` e defina `PW_CHROMIUM=1`. O servidor de teste é o `scripts/servir.js`, com os mesmos cabeçalhos do `vercel.json`. A Wikipedia é sempre simulada; nenhum teste depende da internet. Os testes cobrem:

- carga sem erros no console e sem violações de CSP;
- um palpite em cada modo, com cores, sinais e setas; vitória no dia, compartilhar, treino com vitória e com derrota;
- dicas com 5 e 10 erros (no modo Frase, com figuras sem frase, que nunca são a resposta);
- progresso depois de recarregar, `localStorage` corrompido, desligado ou cheio;
- Wikipedia fora do ar (iniciais no lugar das fotos) e fotos locais com créditos de um `creditos.json` de teste;
- teclado (busca, abas e diálogos) e virada da meia-noite com a página aberta (relógio simulado);
- ausência de rolagem lateral e áreas de toque em 360, 390 e 430 px, página 404 e cabeçalhos servidos;
- o arquivo único aberto por `file://`, com os dois botões gerando o `.zip` e a cópia offline, que funciona sem rede.

## Publicar na Vercel

Veja o passo a passo em `DEPLOY.md`. Resumo:

- Envie o projeto para um repositório no GitHub com git (as pastas `node_modules/` e `dist/` ficam de fora pelo `.gitignore`; `fotos/` e `vercel.json` vão junto).
- Na Vercel, importe o repositório com Root Directory na raiz do projeto. O `vercel.json` já define `npm ci`, `npm run build`, a pasta de saída `dist/famosodle` e os cabeçalhos.
- Alternativa: publicar só a pasta pronta com `npx vercel --prod` dentro de `dist/famosodle` (ela leva o próprio `vercel.json` com os cabeçalhos).
- Depois do deploy, confira os cabeçalhos em securityheaders.com, as fotos e os créditos e o console sem erros.

## Checklist antes de publicar

- `npm ci`, `npm run build` e `npm test` terminam sem erros nem avisos.
- `npm run verificar-fotos` sem títulos para corrigir.
- `vercel.json` da raiz atualizado no commit.
- `npm run lighthouse` com pelo menos 95 nas quatro notas.

## Pendências e ideias

- Uma melhoria possível é tornar a ordem das respostas estável quando figuras novas entram no fim da lista, para não precisar reembaralhar a sequência. Isso muda a lógica do sorteio e precisa de aprovação.
- Os dados foram conferidos com o Wikidata em 26/10/2026. Rode `npm run verificar-dados` antes de cada leva de mudanças para pegar mortes recentes.
