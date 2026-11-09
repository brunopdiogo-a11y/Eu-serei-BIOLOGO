# EU SEREI BIOLOGO

Aplicativo Android offline-first para organizar disciplinas universitárias, exercícios e progresso. **Versão 0.1: interface demonstrativa.** Nenhum PDF foi importado ainda.

## Conteúdo incluído
- Dashboard responsivo e biblioteca com três disciplinas exemplificativas (6 aulas cada).
- Marcação de aulas concluídas; questões demonstrativas; planejamento com data inicial.
- Persistência local no WebView via localStorage e backup JSON manual.
- `www/js/sync.js`: interface para sincronização futura; **não existe backend, login nem sincronização real ainda**.
- GitHub Actions para construir APK debug a partir dos arquivos web.

## Estrutura
```text
www/
  index.html           Interface
  styles.css           Estilos
  js/app.js            Navegação e interações
  js/data.js           Catálogo e questões demonstrativas
  js/storage.js        Progresso local + exportação/importação
  js/sync.js           Contrato para sincronização futura
.github/workflows/build-apk.yml
capacitor.config.json
package.json
```

## No GitHub (criar repositório novo)
1. Usar repositório **Eu-serei-BIOLOGO** separado de `As-aventuras-do-Aprendizado`.
2. Enviar os arquivos desta pasta à raiz do repositório na branch `main` (incluindo pasta `.github`).
3. Ir a **Actions → Construir APK de estudos → Run workflow**.
4. Quando o workflow terminar, abrir o run e baixar **EU_SEREI_BIOLOGO** na seção Artifacts.
5. Extrair o ZIP de artifact, instalar `EU_SEREI_BIOLOGO.apk` no Android e autorizar instalação pelo navegador/gerenciador se necessário.

> O workflow cria a pasta `android` temporariamente no runner por `npx cap add android`. Não é necessário versionar `android` nesta fase. O APK de debug pode ter assinatura de depuração diferente a cada build: para atualizações instaláveis sem remover o app, configurar uma chave de assinatura estável, armazenada como GitHub Actions Secrets, antes da distribuição contínua. **Não salvar chaves privadas no repositório.**

## Testar no computador
- Node 22+ instalado.
- `npm install`
- `npm run dev` (abra http://localhost:4173)

## Próxima etapa: sincronização real
Escolher e configurar fornecedor (ex.: Supabase ou Firebase), autenticação por usuário, tabelas de aulas/progresso/respostas e regras de acesso. Recomenda-se IDs estáveis por registro, timestamps, fila de operações offline, sincronização incremental, controle de conflitos e exportação de dados. Não adicionar credenciais de servidor sensíveis ao código cliente.

## Observações
- `localStorage` não substitui backup e pode ser removido quando dados do aplicativo forem apagados ou quando o app for desinstalado.
- Perguntas e conteúdos presentes são **exemplos**, não transcrições dos PDFs.
- O APK ainda não foi compilado: o ZIP contém os fontes e workflow para compilação no GitHub Actions.
