# Como publicar o Famosodle

Este guia leva o projeto do seu computador até o endereço https://famosodle.vercel.app. São três etapas: conferir, enviar para o GitHub e importar na Vercel. Leva uns 20 minutos na primeira vez.

## O que você precisa

- Uma conta no GitHub (https://github.com) e uma na Vercel (https://vercel.com). Na Vercel, entre com a própria conta do GitHub, que facilita tudo.
- Node.js, que já está instalado.
- Git para Windows. Ele ainda **não** está instalado neste computador:
  - Baixe em https://git-scm.com/download/win e instale com as opções padrão.
  - Feche e abra o VS Code de novo.
  - No terminal do VS Code, diga ao git quem você é (só uma vez):

```
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

Se o PowerShell reclamar de "execução de scripts" ao rodar `npm` ou `npx`, use `npm.cmd` e `npx.cmd` no lugar, ou abra um terminal do tipo Prompt de Comando (no VS Code, a setinha ao lado do + do terminal).

## Etapa 1: conferir

No terminal do VS Code, dentro da pasta do projeto:

```
npm ci
npm run build
npm test
```

Os três precisam terminar sem erro. O `npm test` abre o Chrome escondido e joga sozinho por uns 20 segundos.

## Etapa 2: enviar para o GitHub

O jeito mais fácil é pelo próprio VS Code:

- Abra a pasta do projeto no VS Code.
- Clique no ícone de Controle do Código-Fonte na barra da esquerda (ou aperte Ctrl+Shift+G).
- Clique em **Inicializar Repositório** (Initialize Repository).
- Escreva uma mensagem, por exemplo `Primeira versão do Famosodle`, e clique em **Confirmar** (Commit). Se ele perguntar se quer incluir todas as alterações, responda que sim.
- Clique em **Publicar Branch** (Publish Branch). O VS Code pede para entrar no GitHub; autorize.
- Escolha se o repositório será privado ou público. Os dois funcionam com a Vercel.
- Espere o envio. São uns 25 MB, quase tudo fotos.

Confira no site do GitHub: devem aparecer as pastas `bandeiras`, `dados`, `fotos`, `scripts`, `src` e `testes` e os arquivos `package.json`, `package-lock.json` e `vercel.json`. As pastas `node_modules` e `dist` **não** devem aparecer (o `.gitignore` deixa elas de fora de propósito).

Se preferir o terminal, crie antes um repositório vazio no GitHub (sem README) chamado `famosodle` e rode:

```
git init
git add .
git commit -m "Primeira versão do Famosodle"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/famosodle.git
git push -u origin main
```

## Etapa 3: importar na Vercel

- Em https://vercel.com, clique em **Add New...** e depois em **Project**.
- Em **Import Git Repository**, escolha o repositório `famosodle`. Se ele não aparecer, clique para dar acesso da Vercel ao GitHub.
- Na tela de configuração:
  - **Project Name**: `famosodle`. É esse nome que vira o endereço `famosodle.vercel.app`.
  - **Framework Preset**: Other.
  - **Root Directory**: deixe como está, na raiz do projeto.
  - Não mexa nos comandos de build: o `vercel.json` já manda a Vercel rodar `npm ci` e `npm run build` e publicar a pasta `dist/famosodle`, com os cabeçalhos de segurança.
- Clique em **Deploy** e espere um ou dois minutos.

Se o nome `famosodle` já estiver ocupado, a Vercel dá outro endereço (algo como `famosodle-abc.vercel.app`). Nesse caso, troque o endereço na constante `SITE` de `scripts/empacotar.js` e de `scripts/wikimedia.js`, rode `npm run build` e envie de novo (veja "Atualizar o site").

## Conferir o site publicado

- Abra o endereço e jogue um palpite em cada modo (Clássico, Foto e Frase).
- Aperte F12, abra a aba **Console** e recarregue a página: não pode aparecer nada em vermelho, principalmente mensagens sobre Content Security Policy.
- As fotos devem aparecer nos palpites. No modo Foto, o botão "ver autor e fonte" mostra o crédito com link para o Wikimedia Commons.
- Abra um endereço que não existe, como `famosodle.vercel.app/teste`: deve aparecer a página "Esta página sumiu da história".
- Em https://securityheaders.com, digite o endereço do site e clique em **Scan**. A nota deve ser A ou A+.
- Mande o link para você mesmo no WhatsApp: a prévia deve mostrar a imagem preta e creme com o nome Famosodle. O WhatsApp guarda a prévia em cache, então a primeira pode demorar.

## Atualizar o site

Toda mudança segue o mesmo caminho:

- Rode `npm run build` e `npm test`.
- No VS Code, em Controle do Código-Fonte, escreva uma mensagem, clique em **Confirmar** e depois em **Sincronizar** (ou `git push` no terminal).
- A Vercel percebe o envio e publica sozinha em um ou dois minutos.

Cuidados:

- Sempre envie o `vercel.json` junto. A Vercel lê esse arquivo antes de montar o site, e o build às vezes muda ele (o terminal avisa).
- Mudanças nas figuras e no pacote de fotos trocam a sequência das respostas dos próximos dias. Publique essas mudanças logo depois da meia-noite de Brasília.
- Figuras novas entram sempre no fim de `dados/figuras-extra.txt`, e cada uma precisa de uma linha com o nível em `dados/fama.txt`. Depois rode `npm run dados`, `npm run verificar-fotos`, `npm run baixar-fotos`, `npm run visitas` e `npm run build`. Se a figura for de um país que ainda não estava no jogo, rode também `npm run baixar-bandeiras` antes do build.

### Atualizar pelo site do GitHub, sem git

Também dá para atualizar sem o git, enviando pelo site do GitHub só os arquivos que mudaram:

- Na página principal do repositório, clique em **Add file** e depois em **Upload files**, e arraste os arquivos e pastas mantendo a estrutura do projeto. O GitHub troca os arquivos de mesmo nome.
- O site aceita **menos de 100 arquivos** por envio. Se forem mais, divida em partes.
- Cada envio vira um deploy na Vercel. Mande primeiro as fotos novas, que não mudam nada no site sozinhas, e por último o código e os dados. Assim o site só muda uma vez.

## Alternativa: publicar só a pasta pronta

Se não quiser usar o GitHub, dá para mandar só o site montado, direto do computador:

```
npm run build
cd dist/famosodle
npx vercel --prod
```

Na primeira vez, o `npx vercel` pede para entrar na Vercel e faz algumas perguntas: confirme que quer publicar (**Y**), escolha sua conta, responda que **não** quer ligar a um projeto existente, dê o nome `famosodle` e aceite a pasta atual. A pasta `dist/famosodle` leva o próprio `vercel.json` com os cabeçalhos. Nesse modo a Vercel não roda o build: ela publica os arquivos exatamente como estão, então rode `npm run build` antes de cada envio. Não misture os dois jeitos no mesmo projeto da Vercel.

## Se algo der errado

- **O deploy falhou na Vercel**: abra o projeto na Vercel, clique em **Deployments**, depois no deploy com erro e em **Build Logs**. A mensagem de erro do `npm run build` aparece ali.
- **`npm test` diz que não achou o Chrome**: instale o Google Chrome, ou rode `npx playwright install chromium` e depois, no PowerShell, `$env:PW_CHROMIUM = "1"` antes de `npm test`.
- **As fotos não aparecem no site**: confira se a pasta `fotos` está no GitHub com as pastas `fotos-1` a `fotos-6`.
- **As bandeiras aparecem como letras ("BR")**: confira se a pasta `bandeiras` está no GitHub, com os arquivos `.png` e o `creditos.json`.
- **O GitHub diz "Yowza, that's a lot of files"**: o envio pelo site aceita menos de 100 arquivos por vez. Mande em partes menores.
