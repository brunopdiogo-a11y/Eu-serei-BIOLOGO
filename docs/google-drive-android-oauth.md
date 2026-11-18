# Sincronização Google Drive: Web + APK Android

O aplicativo usa **a mesma conta Google e o mesmo projeto Google Cloud**, com clientes OAuth distintos:

- Web (GitHub Pages): Client ID do tipo **Aplicativo Web**, origin `https://brunopdiogo-a11y.github.io`.
- APK: Client OAuth **Android**, com pacote `br.com.eusereibiologo.app` e SHA-1 do certificado que assina o APK de produção.

O APK usa **Google Play Services AuthorizationClient** para solicitar o escopo `https://www.googleapis.com/auth/drive.appdata`. Não utiliza a página de login do Google dentro de WebView, nem armazena client secrets ou tokens persistentes.

## 1. Descobrir SHA-1 correto

Acesse [Construir APK — GitHub Actions](https://github.com/brunopdiogo-a11y/Eu-serei-BIOLOGO/actions/workflows/build-apk.yml), escolha a execução concluída mais recente e abra a etapa **Nomear e verificar APK assinado**.

O log apresenta a linha `Signer #1 certificate SHA-1 digest:`. Copie apenas os 40 caracteres hexadecimais. Coloque dois-pontos entre pares caso o console Google exija o formato `AA:BB:...`.

**Nunca use o SHA-1 do computador/debug para registrar o APK de produção.** A assinatura de produção é lida do APK final compilado e usa os segredos já existentes `ANDROID_KEYSTORE_B64` e `ANDROID_SIGNING_PASSWORD`. Não compartilhe nem substitua a chave privada.

## 2. Criar cliente OAuth Android

1. Acesse [Google Auth Platform — Clients](https://console.cloud.google.com/auth/clients).
2. Selecione **o mesmo projeto Google Cloud do cliente Web**. Isso é importante para que o `appDataFolder` do Google Drive seja o mesmo.
3. Crie **Cliente OAuth → Android** com o pacote `br.com.eusereibiologo.app`.
4. Preencha o **SHA-1 do APK de produção** obtido na etapa anterior.
5. Garanta que a API Google Drive esteja ativada e que sua conta de testes seja autorizada na configuração OAuth, se a publicação estiver em testes.
6. Não informe nem publique qualquer **client secret**. O APK não exige digitar ID OAuth Web.

## 3. Sincronização segura

1. Salve um backup JSON no APK e mantenha uma cópia.
2. Instale o novo APK **por cima** do existente, sem limpar seus dados. Se o Android pedir desinstalação, pare e verifique assinatura.
3. Em **Configurações → Google Drive**, toque em **Conectar Google no Android**, escolha sua conta e autorize.
4. Toque em **Sincronizar agora** e confira disciplinas, planejamento, sessões e notas.
5. No computador, conecte com o Client ID Web, usando a mesma conta Google, e sincronize.
6. Faça testes pequenos (uma etapa concluída ou uma anotação) antes de depender apenas da nuvem.

O token do Android é temporário e não é guardado em disco. Se expirar ou o app reiniciar, basta conectar novamente; o Google poderá reaproveitar consentimento anterior. A sincronização automática ocorre apenas durante a sessão autorizada e ativa.

## Problemas

- **origin_mismatch:** ocorre ao tentar OAuth Web dentro do APK antigo. Instale o novo APK com o plugin nativo.
- **API_EXCEPTION / developer error:** confira mesmo projeto Google, pacote e SHA-1 reais, e a configuração OAuth.
- **Versão antiga do APK:** caso não haja botão `Conectar Google no Android`, a atualização não foi instalada.
- **Não sincronizou:** não desinstale, não limpe dados nem apague o JSON. Confira mensagens de erro e teste a conta Google correta.

Não publique backups JSON pessoais nem dados de estudo em repositórios públicos.
