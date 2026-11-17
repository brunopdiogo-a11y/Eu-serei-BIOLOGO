# Tutor de IA — EU SEREI BIOLOGO (Cloudflare Workers AI)

A IA funciona **dentro do aplicativo** usando Cloudflare Workers AI, sem precisar de `OPENAI_API_KEY` nem Gemini API. O modelo atual é `@cf/meta/llama-3.1-8b-instruct-fp8-fast`, sujeito às condições e à franquia gratuita do Cloudflare Workers AI.

## Como ativar pelo GitHub (sem computador)

1. Na conta Cloudflare, crie o token de API de publicação e copie o **Account ID**. Você já adicionou estes Secrets ao GitHub:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
2. Crie um código **aleatório e privado, com no mínimo 24 caracteres**, que será a senha de acesso ao tutor. Não use seu login, senha do Google, nem a chave da OpenAI.
3. No repositório GitHub, entre em **Settings → Secrets and variables → Actions → New repository secret** e cadastre:
   - **Name:** `STUDY_ACCESS_TOKEN`
   - **Secret:** o código criado no passo anterior.
4. Entre em **Actions → Publicar Tutor IA EU SEREI BIOLOGO → Run workflow**. O GitHub enviará o código do Worker e o Secret para o Cloudflare.
5. No painel **Cloudflare → Workers & Pages → eu-serei-biologo-tutor**, localize a URL HTTPS `.workers.dev` publicada. O Worker só terá endereço público depois que a publicação funcionar.
6. Abra o APK atualizado, acesse Ecologia Vegetal, toque em **? → Configurar conexão com a IA**. Informe a URL do Worker e o **mesmo código** do passo 2. Toque em **Testar conexão e salvar** e faça uma pergunta.

**O Secret `OPENAI_API_KEY` que aparece no GitHub NÃO é usado nesta versão.** Você pode excluí-lo caso não tenha outra finalidade. Nunca compartilhe segredos na conversa, nos prints ou em arquivos públicos.

## Como funciona

- O conteúdo das aulas continua privado no aparelho. Somente um trecho selecionado, a pergunta e as últimas mensagens da conversa são enviados ao Worker quando você toca em **Perguntar à IA**.
- O Worker autentica o pedido com `STUDY_ACCESS_TOKEN` e consulta o binding `env.AI` do Cloudflare. As respostas retornam para a janela no próprio app.
- A chave do Cloudflare usada para implantar o Worker fica apenas no GitHub Actions. Nenhum token do Cloudflare ou chave de API da OpenAI é colocado no APK.
- O código de acesso do tutor fica guardado apenas durante a sessão do aplicativo (sessionStorage), e a URL pode ser reutilizada.

## Custos e proteção

Workers AI tem franquia gratuita diária sujeita a limites, atualmente **10.000 Neurons/dia** no plano Free. O modelo escolhido consome parte dessa franquia a cada consulta. Quando o limite for atingido, o app mostrará uma mensagem em vez de prometer acesso ilimitado. Confira os limites e planos em https://developers.cloudflare.com/workers-ai/platform/pricing/.

**A franquia gratuita não é garantia de custo zero para sempre**: mantenha sua conta no plano gratuito se não desejar cobranças além da franquia. Não habilite pagamento automático ou plano pago sem avaliar.

A segurança por token é adequada para testar individualmente, mas **não é autenticação multiusuário** nem estabelece limite rígido por pessoa. Antes de disponibilizar publicamente, é preciso criar usuários individuais, revogação de tokens e controle de volume/rate limiting.

## Diagnóstico

Abra `https://SEU-WORKER.workers.dev/health` e confira o campo `configured`: ele fica `true` quando o binding de IA e o código de acesso estão configurados.

Na raiz do repositório, os testes são executados com `node --test ai-worker/test/worker.test.mjs`. São executados também no processo de compilação do APK e na publicação do Worker.
