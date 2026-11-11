# 🌿 EU SEREI BIOLOGO — Web 0.3.0
Plataforma responsiva de estudos, com navegação separada (Início, Disciplinas, Planejamento, Questões, Progresso e Configurações).

## Implementado
- Página inicial minimalista, com avisos calculados a partir das metas salvas.
- Planejamento por disciplina: início, prazo, dias por semana, tempo por sessão, meta de aulas e horário opcional de lembrete.
- Registro manual de sessões e cronômetro com pausa automática quando a página perde visibilidade.
- Histórico de tempo por disciplina, indicadores semanais e progresso baseado em dados reais.
- Backup JSON local e migração compatível com registros anteriores (schemaVersion 1).
- Lembretes dentro do site e notificações do navegador **somente com permissão e com a página aberta**.
- Biblioteca preparada para Ecologia Vegetal, ainda sem textos e questões definitivos.

## Limitações importantes
- **Não há sincronização online nem login**, portanto os dados do notebook não aparecem automaticamente no celular.
- A publicação Web pelo GitHub Pages não executa tarefas em segundo plano. Notificações automáticas com o app fechado requerem PWA/service worker + infraestrutura apropriada ou implementação nativa Android.
- Os cálculos de ritmo de estudo são estimativas: não mudam prazos sem autorização.
- Ao limpar dados do navegador, o progresso local pode ser perdido; exporte backups periodicamente.
- O material de Ecologia Vegetal será importado numa etapa futura, após validação desta estrutura.

## Publicação
A pasta www é publicada pelo GitHub Pages via .github/workflows/deploy-web.yml e empacotada em APK por .github/workflows/build-apk.yml.
