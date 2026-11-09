// Contrato de sincronização preparado. Nenhuma transferência remota ocorre nesta versão.
// Futuro: implementar autenticação, pull/push incremental, regras de segurança e conflitos por registro.
export const syncProvider = {
  status(){return {configured:false,authenticated:false,provider:'none'};},
  async signIn(){throw new Error('Sincronização ainda não configurada');},
  async push(_state){throw new Error('Sincronização ainda não configurada');},
  async pull(){throw new Error('Sincronização ainda não configurada');}
};
