// Catálogo inicial: demonstração da interface. Substituir por aulas reais futuramente.
export const courses = [
  {id:'sensoriamento',icon:'🛰️',title:'Sensoriamento Remoto',subtitle:'Fotointerpretação Geográfica',color:'#dcecfb',lessons:6},
  {id:'flora',icon:'🌿',title:'Inventariamento de Flora',subtitle:'Métodos e fitossociologia',color:'#e2f3e5',lessons:6},
  {id:'nova',icon:'📚',title:'Próxima disciplina',subtitle:'Aguardando material',color:'#f4e9da',lessons:6}
];
export const sampleQuestions = [
  {id:'demo1',courseId:'sensoriamento',question:'Qual técnica utiliza informações obtidas por sensores sem contato direto com o alvo?',choices:['Sensoriamento remoto','Coleta manual de solo','Entrevista estruturada','Contagem por quadrantes'],answer:0,explanation:'Sensoriamento remoto reúne dados de objetos ou superfícies sem contato físico direto.'},
  {id:'demo2',courseId:'flora',question:'Qual área estuda a composição e estrutura das comunidades vegetais?',choices:['Geodésia','Fitossociologia','Meteorologia','Petrologia'],answer:1,explanation:'A fitossociologia estuda a organização e composição da vegetação.'}
];
