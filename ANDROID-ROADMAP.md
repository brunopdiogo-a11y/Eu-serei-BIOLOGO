# EU SEREI BIOLOGO — Android v0.5 (inicial)
O Android funciona como um acesso seguro à mesma **origem Web** utilizada no notebook: https://brunopdiogo-a11y.github.io/Eu-serei-BIOLOGO/.

## Arquitetura
- Conteúdo, navegação, planejamento, questões e progresso são mantidos na pasta pública `www/`, sem divergências entre versões.
- O APK empacota apenas uma página inicial enxuta em `android-launcher/`, que abre a plataforma hospedada pelo navegador de sistema (Chrome Custom Tabs via Capacitor Browser).
- O login Google OAuth ocorre na origem HTTPS autorizada, e não em WebView embutida.
- A tela inicial Android não contém material acadêmico nem credenciais.
- O progresso é **local por navegador** até que o usuário faça login e sincronize manualmente via Google Drive; não confundir sincronização com publicação da Web.
- Os PDFs e o HTML integral de Ecologia Vegetal **não são incluídos no APK nem no repositório público**. O usuário importa o conteúdo privado em cada navegador.

## Organização da informação
1. Início: avisos e próxima ação.
2. Disciplinas: cursos, aulas e etapas.
3. Planejamento: meta diária calculada e cronograma.
4. Estudo: relógio manual, pausa e histórico.
5. Questões: recuperação ativa e simulados (em desenvolvimento).
6. Progresso: tempo e conclusões por matéria.
7. Configurações: Google Drive, autenticação, backup, importação.

## Como testar
1. Na plataforma Web, exporte backup em Configurações antes de instalar qualquer APK.
2. No GitHub Actions, execute `Construir APK EU SEREI BIOLOGO`.
3. Baixe o artefato do workflow; o arquivo APK é um build **debug de teste**, não um pacote assinado para distribuição.
4. Se a instalação falhar por assinatura incompatível com uma versão antiga, faça backup e remova o APK antigo antes de instalar este.
5. Abra a plataforma pelo botão dentro do APK.
6. Verifique a importação privada de Ecologia Vegetal, a contagem de tempo e a sincronização manual com Google Drive no navegador.

## Limitações
- É necessário ter internet para acessar a versão Web, salvo recursos já em cache (offline completo não implementado).
- O Chrome Custom Tab não transforma a Web em armazenamento local nativo do APK; arquivos privados ficam no armazenamento do navegador.
- As atualizações do conteúdo seguem as publicações GitHub Pages, dispensando novo APK para alterações comuns da interface.
- Para notificações Android persistentes e modo offline completo, precisaremos implementar recursos nativos/PWA em etapas futuras.
