# Tutor de IA — EU SEREI BIOLOGO

A aula continua privada no dispositivo. Apenas o **trecho selecionado**, a **pergunta** e as últimas mensagens da conversa são enviados ao serviço de IA após confirmação.

## Implantação inicial (uma vez)

1. Crie uma conta Cloudflare em https://dash.cloudflare.com/ (Workers & Pages).
2. Instale Node.js e abra um terminal na pasta `ai-worker` do repositório.
3. Execute `npx wrangler login` e `npx wrangler deploy`.
4. No mesmo diretório, execute `npx wrangler secret put OPENAI_API_KEY` e informe sua chave da plataforma OpenAI (https://platform.openai.com/api-keys).
5. Crie um código **aleatório de pelo menos 24 caracteres**, distinto da chave OpenAI, e execute `npx wrangler secret put STUDY_ACCESS_TOKEN`. Guarde esse código em um gerenciador de senhas.
6. Copie o endereço HTTPS exibido pelo Wrangler (por exemplo, `https://eu-serei-biologo-tutor.<sua-conta>.workers.dev`). Não há URL pronta antes da implantação.
7. Abra Ecologia Vegetal no APK, toque em **?**, configure **Endereço da API** com a URL do passo 6 e **Código de acesso** com o token do passo 5. Use **Testar conexão**.

**Atenção:** sua assinatura ChatGPT Plus não paga a API. A API é faturada separadamente. Configure orçamento e alertas de uso na plataforma OpenAI.

### Segurança e limites

- A chave `OPENAI_API_KEY` fica exclusivamente nos Secrets do Worker e jamais é inserida no HTML, APK ou GitHub.
- O token `STUDY_ACCESS_TOKEN` limita acesso ao endpoint; não é a senha do ChatGPT. Guarde-o como segredo. O APK mantém o token somente na sessão aberta; você precisará inseri-lo novamente depois de fechar a sessão.
- O endpoint aceita uma pergunta de até 1.500 caracteres, trecho de 2.500 caracteres, até 8 mensagens anteriores e resposta limitada a 800 tokens. As requisições não são armazenadas pelo código do Worker (`store:false` na API).
- A proteção por token reduz o acesso indevido, mas **não constitui limitação rígida de gastos**; configure orçamento e limites na OpenAI antes de compartilhar o app. Para vários usuários, implementar autenticação individual, cotas/rate limiting com Durable Objects ou Cloudflare Rate Limiting e mecanismos antiabuso antes de expandir o acesso.
- Não registre prompts, tokens ou chaves nos logs.
- Para verificar se o Worker está pronto: abra `/health` no endereço implantado; deve retornar `configured:true`.

### Testes

Na pasta raiz do repositório: `node --test ai-worker/test/worker.test.mjs`.
