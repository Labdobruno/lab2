/* Onda 3 na tela: o quarter de verdade (uma fase por vez, uma pergunta por fase) e as metas históricas por ciclo.
   JavaScript inserido na PAGINA (sem crases nem "${"). Usa o que a página já tem: el, api, limpar, abas, controles, cabecalho, data, numero, pct, reais, estado, telaEntrada, qs, brlT, n1, lk. */
export const TELA_ESTRATEGIA = `
var FASES_Q=[['visao','Visão'],['revisao','1 · Revisão'],['diagnostico','2 · Prioridades'],['objetivo','3 · Objetivo'],['iniciativas','4 · Iniciativas'],['meses','5 · Meses'],['publicar','6 · Publicar']];
var PERG_Q={visao:'Onde o quarter está?',revisao:'Como foi o quarter anterior?',diagnostico:'O que restringe a receita e o que vira prioridade?',objetivo:'Quanto este quarter precisa gerar, e em que cenário isso cabe?',iniciativas:'O que vamos mudar no mecanismo para chegar lá?',meses:'Como a meta se divide nos três meses e o que cada um entrega?',publicar:'O plano pode ser aprovado?'};
var EST_Q={rascunho:'Rascunho',publicado:'Publicado',encerrado:'Encerrado'};
var DIAG_C={comprovado:'critica',hipotese:'alta',sem_dado:'sem',ok:'no_ritmo'};
var DIAG_N={comprovado:'Comprovado nos dados',hipotese:'Hipótese',sem_dado:'Sem dado',ok:'Sem problema'};
var PRIO_ST=[['aceita','Aceita'],['modificada','Aceita com ajuste'],['rejeitada','Rejeitada'],['propria','Do gestor'],['sugerida','Sugerida']];
var TEND_N={melhorou:'melhorou',piorou:'piorou',estavel:'estável',amostra:'amostra pequena',sem_dado:'sem dado'};
var TEND_C={melhorou:'no_ritmo',piorou:'atras',estavel:'sem',amostra:'sem',sem_dado:'sem'};
var AVAL_N={funcionou:'Funcionou',sem_resultado:'Sem resultado',mal_executada:'Mal executada',resultado_sem_execucao:'Resultado sem execução',resultado_sem_marcos:'Resultado sem marcos',sem_dado:'Sem dado'};
var AVAL_C={funcionou:'no_ritmo',sem_resultado:'atras',mal_executada:'atencao',resultado_sem_execucao:'atencao',resultado_sem_marcos:'atencao',sem_dado:'sem'};
var NIV_C={concluido:'no_ritmo',atrasado:'atras',andamento:'atencao',sem_marcos:'sem',executada:'no_ritmo',em_execucao:'atencao',cancelada:'sem',validada:'no_ritmo',nao_validada:'atras',amostra:'sem',sem_dado:'sem',atingido:'no_ritmo',nao_atingido:'atras'};
var MARCO_ST=[['previsto','Previsto'],['andamento','Em andamento'],['concluido','Concluído'],['atrasado','Atrasado'],['cancelado','Cancelado']];
var FECH_MES=[['concluido','Concluído'],['parcial','Concluído parcialmente'],['pendente','Pendente e válido'],['replanejado','Replanejado'],['bloqueado','Bloqueado'],['cancelado','Cancelado']];
var CRIT_Q=[['impacto','Impacto esperado'],['evidencia','Evidência disponível'],['urgencia','Urgência'],['controle','Controle sobre a variável'],['esforco','Esforço necessário'],['custo','Custo'],['risco','Risco'],['tempo','Tempo até o resultado'],['dependencias','Dependências operacionais']];
var IND_Q=[['receita','Receita'],['vendas','Vendas'],['ticket','Ticket médio'],['leads','Leads'],['agendamento','Reuniões agendadas'],['reuniao_realizada','Reuniões realizadas'],['oportunidades','Oportunidades'],['proposta_enviada','Propostas'],['contato','Contatos'],['tentativa','Tentativas'],['leads>agendamento','Lead → agendada'],['agendamento>reuniao_realizada','Agendada → realizada'],['reuniao_realizada>oportunidades','Realizada → oportunidade'],['oportunidades>vendas','Oportunidade → venda'],['leads>vendas','Lead → venda'],['margem','Margem']];
function nomeInd(k){var x=IND_Q.filter(function(i){return i[0]===k})[0];return x?x[1]:k}
function fmtQ(k,v){if(v==null)return '—';if(k==='receita'||k==='ticket')return reais(v);if(String(k).indexOf('>')>=0||k==='margem')return pct(v);return n1(v)}
function qBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)+'/estrategia'}
async function qSalvar(patch,msg,fase){try{await api(qBase()+qs(),patch);if(fase)estado.faseQ=fase;telaQuarterE(msg||'Salvo.',true)}catch(e){telaQuarterE(e.message)}}
async function qAcao(sub,corpo,msg){try{var r=await api(qBase()+'/'+sub+qs(),corpo||{});telaQuarterE(typeof msg==='function'?msg(r):msg,true)}catch(e){telaQuarterE(e.message)}}
function campo(label,input){return el('p',{},[el('label',{texto:label}),input])}
function inp(attrs){attrs=attrs||{};attrs.class=((attrs.class||'')+' largo').trim();return el('input',attrs)}
function sel(opcoes,valor,attrs){var s=el('select',attrs||{});opcoes.forEach(function(o){var op=el('option',{value:o[0],texto:o[1]});if(String(o[0])===String(valor))op.setAttribute('selected','');s.appendChild(op)});return s}
function num0(v){return v===''||v==null||isNaN(Number(v))?null:Number(v)}
function lista_(o){return Object.keys(o||{}).map(function(k){return Object.assign({id:k},o[k])})}
function sem_(o){var c={};for(var k in o)if(k!=='id')c[k]=o[k];return c}
function qSecao(t,filhos){return el('div',{class:'cartao'},[el('h2',{texto:t})].concat(filhos))}
/* ---------- a tela ---------- */
async function telaQuarterE(msg,ok){
  limpar();
  var E;
  try{E=await api(qBase()+qs())}catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(abas());app.appendChild(el('p',{class:'erro',texto:'Não consegui montar o quarter: '+e.message}));app.appendChild(controles());return}
  app.appendChild(abas());
  var Q=E.quarter,D=E.doc;
  cabecalho('Quarter '+Q.rotulo,data(Q.inicio)+' a '+data(Q.fim)+' · '+Q.duQ+' dias úteis'+(Q.terminou?' · terminou':Q.comecou?' · dia útil '+Q.ddQ+' de '+Q.duQ:' · começa em '+data(Q.inicio))).forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(el('p',{},[el('span',{class:'chip '+(D.status==='publicado'?'no_ritmo':D.status==='encerrado'?'sem':'atencao'),texto:(EST_Q[D.status]||'Rascunho')+(D.versao?' · v'+D.versao:'')}),' ',E.avisos.length?el('span',{class:'chip alta',texto:E.avisos.length+' aviso'+(E.avisos.length>1?'s':'')}):null]));
  var fase=estado.faseQ||E.faseSugerida;
  app.appendChild(el('div',{class:'abas rituais',role:'group','aria-label':'Fase do quarter'},FASES_Q.map(function(f){var b=el('button',{type:'button',texto:f[1],onclick:function(){estado.faseQ=f[0];telaQuarterE()}});if(fase===f[0])b.setAttribute('aria-current','page');return b})));
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  app.appendChild(el('p',{class:'grande',texto:PERG_Q[fase]}));
  var F={visao:qVisao,revisao:qRevisao,diagnostico:qDiagnostico,objetivo:qObjetivo,iniciativas:qIniciativas,meses:qMeses,publicar:qPublicar};
  F[fase](E);
}
function qVisao(E){
  var D=E.doc,Q=E.quarter;
  if(!D.existe){
    app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Este quarter ainda não tem plano. A revisão do quarter anterior e o diagnóstico já estão prontos: comece por eles.'}),
      el('button',{class:'primario',type:'button',texto:'Começar o plano do quarter',onclick:function(){qSalvar({respostas:{}},'Plano criado. Comece pela revisão do quarter anterior.','revisao')}})]));
  } else if(D.status==='rascunho'){
    var A=E.aprovacao;
    app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Plano em rascunho. '+(A.ok?'Pronto para publicar.':A.bloqueios.length+' item(ns) impedem a aprovação.')}),el('button',{class:'primario',type:'button',texto:'Ir para a fase sugerida: '+FASES_Q.filter(function(f){return f[0]===E.faseSugerida})[0][1],onclick:function(){estado.faseQ=E.faseSugerida;telaQuarterE()}})]));
  } else {
    var R=E.reprevisao;
    app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:brlT(R.realizado)+' de '+brlT(R.metaVigente)}),el('p',{class:'suave',texto:'Realizado no quarter até hoje × meta aprovada'+(R.metaOriginal!=null&&R.metaOriginal!==R.metaVigente?' (original '+brlT(R.metaOriginal)+')':'')}),
      R.projecao!=null?el('p',{texto:'Projeção pelo ritmo dos dias úteis: '+brlT(R.projecao)+'. '+R.leitura}):el('p',{class:'suave',texto:R.leitura})]));
    if(E.programa)qPrograma(E.programa);
    if(D.status==='encerrado'&&D.encerramento)qEncerramento(D.encerramento);
  }
  if(E.avisos.length)app.appendChild(qSecao('Avisos',E.avisos.map(function(a){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:a.titulo})]),el('p',{class:'suave mini',texto:a.texto}),lk('Ir para a fase',function(){estado.faseQ=a.fase;telaQuarterE()})])})));
  if(E.gatilhos.length)app.appendChild(qSecao('Gatilhos de decisão',[qTabela(['Indicador','Regra','Hoje','Estado'],E.gatilhos.map(function(g){return [nomeInd(g.ind),(g.op==='acima'?'acima de ':'abaixo de ')+fmtQ(g.ind,num0(g.limite)),fmtQ(g.ind,g.v),g.estado+(g.texto?' · '+g.texto:'')]}))]));
  if(E.marcosAtrasados.length)app.appendChild(qSecao('Marcos atrasados',E.marcosAtrasados.map(function(m){return el('p',{texto:m.txt+' · "'+m.ini+'" · '+data(m.prazo)+(m.resp?' · '+m.resp:'')})})));
  if(E.diario.dias)app.appendChild(el('details',{},[el('summary',{texto:'Fechamentos do dia no quarter: '+E.diario.dias+' dia(s) · '+E.diario.por.critico+' crítico(s) · '+E.diario.diasQuarterRisco+' com o quarter em risco'})].concat(E.diario.recorrentes.map(function(r){return el('p',{class:'mini',texto:r.txt+' · voltou em '+r.n+' dias (última '+data(r.ultima)+')'})}))));
}
function qTabela(cab,linhas){return el('table',{},[el('thead',{},[el('tr',{},cab.map(function(x){return el('th',{texto:x})}))]),el('tbody',{},linhas.map(function(l){return el('tr',{},l.map(function(c){return el('td',typeof c==='string'?{texto:c}:{},typeof c==='string'?null:[c])}))}))])}
function qPrograma(P){
  app.appendChild(qSecao('Programa de ciclos: original × vigente × real',[el('p',{class:'suave mini',texto:'A meta original de cada mês nunca muda. O que sobrou ou faltou num mês passa para os seguintes (vigente).'}),
    qTabela(['Mês','Original','Vigente','Real'],P.ciclos.map(function(c){return [c.key+' ('+c.status+')',brlT(c.original.receita),c.vigente.receita==null?'—':brlT(c.vigente.receita),c.real.receita==null?'—':brlT(c.real.receita)]})),
    el('p',{class:'mini',texto:'Falta no programa: '+brlT(P.falta.receita)+' · realizado '+brlT(P.realizado.receita)})]));
}
function qEncerramento(X){
  var r=X.resultado||{};
  app.appendChild(qSecao('Encerramento',[el('p',{texto:'Meta original '+brlT(r.metaOriginal)+(r.metaFinal!==r.metaOriginal?' · final '+brlT(r.metaFinal):'')+' · realizado '+brlT(r.real)+(r.desvio&&r.desvio.abs!=null?' · '+(r.desvio.abs>=0?'+':'')+brlT(r.desvio.abs):'')}),
    el('p',{class:'mini',texto:'Iniciativas: '+(r.confirmadas||[]).length+' confirmadas · '+(r.rejeitadas||[]).length+' sem resultado · '+(r.falhasExecucao||[]).length+' mal executadas · '+(r.semDado||[]).length+' sem dado · '+(r.abandonadas||[]).length+' abandonadas'})]));
}
/* ---------- 1 · revisão ---------- */
function qRevisao(E){
  var R=E.revisao,res=R.resumo,A=E.anterior;
  var top=[el('p',{class:'suave',texto:A.rotulo+' · '+data(A.inicio)+' a '+data(A.fim)+(A.doc?' · plano '+(EST_Q[A.doc.status]||A.doc.status):' · sem plano registrado')})];
  if(A.vazio)top.push(el('p',{class:'erro',texto:'Nenhum registro no quarter anterior: a revisão não diz nada sobre ele.'}));
  else top.push(el('p',{class:'grande',texto:(res.resultado==null?'Sem dado':brlT(res.resultado))+(res.metaFinal!=null?' de '+brlT(res.metaFinal):'')}),el('p',{class:'suave',texto:res.metaFinal==null?'Sem meta do quarter: '+(R.linhas[0].meta.nota||''):'Receita × meta final'+(res.revisada?' (original '+brlT(res.metaOriginal)+', revisada)':'')+(res.diferenca!=null?' · diferença '+brlT(res.diferenca):'')}));
  app.appendChild(el('div',{class:'cartao'},top));
  var linhas=R.linhas.filter(function(l){return l.v!=null||l.meta.final!=null});
  if(linhas.length)app.appendChild(qSecao('Indicador a indicador',[qTabela(['Indicador','Meta','Realizado','Tendência'],linhas.map(function(l){return [nomeInd(l.ind),l.meta.final==null?'—':fmtQ(l.ind,l.meta.final),fmtQ(l.ind,l.v)+(l.desvio.pct!=null?' ('+(l.desvio.pct>=0?'+':'')+Math.round(l.desvio.pct*100)+'%)':''),el('span',{class:'chip '+TEND_C[l.tendencia.dir],texto:TEND_N[l.tendencia.dir]})]}))]));
  if(R.lacunas.length)app.appendChild(el('details',{},[el('summary',{texto:R.lacunas.length+' lacuna(s): o que a revisão não consegue dizer'})].concat(R.lacunas.map(function(l){return el('p',{class:'mini',texto:nomeInd(l.ind)+': '+l.texto})}))));
  if(E.iniciativasAnteriores.length)app.appendChild(qSecao('Iniciativas do quarter anterior',E.iniciativasAnteriores.map(function(a){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('span',{class:'chip '+AVAL_C[a.aval.k],texto:AVAL_N[a.aval.k]}),' ',el('strong',{texto:a.nome})]),el('p',{class:'suave mini',texto:a.aval.texto})])})));
  var resp=E.doc.respostas||{};
  if(E.perguntas.length){
    var caixas=E.perguntas.map(function(p){var t=el('textarea',{rows:'2','aria-label':p.q});t.value=resp[p.id]||'';return {p:p,t:t}});
    app.appendChild(qSecao('Perguntas da retrospectiva',[el('p',{class:'suave mini',texto:'Só onde os dados deixam lacuna de interpretação. A resposta fica guardada com o plano.'})].concat(caixas.map(function(c){return el('p',{},[el('label',{texto:c.p.q}),c.t])})).concat([el('button',{class:'primario',type:'button',texto:'Guardar respostas e seguir',onclick:function(){var r={};for(var k in resp)r[k]=resp[k];caixas.forEach(function(c){r[c.p.id]=c.t.value.trim()});qSalvar({respostas:r},'Respostas guardadas.','diagnostico')}})])));
  } else app.appendChild(el('p',{},[el('button',{class:'primario',type:'button',texto:'Seguir para as prioridades',onclick:function(){if(!E.doc.existe)return qSalvar({respostas:{}},'Plano criado.','diagnostico');estado.faseQ='diagnostico';telaQuarterE()}})]));
}
/* ---------- 2 · diagnóstico e prioridades ---------- */
function qDiagnostico(E){
  var D=E.doc,prios=D.prioridades||{};
  function salvarPrios(novas,msg){qSalvar({prioridades:novas},msg)}
  var diag=E.diagnostico.filter(function(d){return d.estado!=='ok'});
  app.appendChild(qSecao('Diagnóstico do quarter anterior',[el('p',{class:'suave mini',texto:'Só o que move a receita. "Comprovado" é o desvio medido; a causa continua hipótese.'})].concat(diag.map(function(d){
    var sug=E.sugeridas.filter(function(s){return s.diag===d.k})[0];
    return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('span',{class:'chip '+DIAG_C[d.estado],texto:DIAG_N[d.estado]}),' ',el('strong',{texto:d.dim})]),el('p',{class:'suave mini',texto:d.evidencia}),
      d.impacto?el('p',{class:'mini',texto:brlT(d.impacto.valor)+' · '+d.impacto.texto}):null,
      sug?lk('Aceitar como prioridade',function(){var n={};for(var k in prios)n[k]=prios[k];n['novo'+Date.now()]={titulo:d.dim,st:'aceita',diag:d.k,crit:{},impacto:d.impacto};salvarPrios(n,'Prioridade aceita.')}):null])}))));
  var L=E.prioridades;
  var foco=E.aprovacao.avisos.filter(function(a){return /prioridade/.test(a)})[0];
  var itens=L.map(function(p){
    var st=sel(PRIO_ST,p.st||'aceita',{'aria-label':'Situação de '+p.titulo}),ordem=inp({type:'number',min:'1',step:'1',value:p.ordem==null?'':String(p.ordem),'aria-label':'Ordem','style':'max-width:90px'});
    var crits=CRIT_Q.map(function(c){return {k:c[0],s:sel([['','—'],['1','baixo'],['2','médio'],['3','alto']],p.crit&&p.crit[c[0]]!=null?String(p.crit[c[0]]):'',{'aria-label':c[1]}),n:c[1]}});
    return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:p.titulo}),' ',el('span',{class:'chip '+(p.st==='rejeitada'?'sem':p.st==='sugerida'?'atencao':'no_ritmo'),texto:(PRIO_ST.filter(function(x){return x[0]===p.st})[0]||['','?'])[1]})]),
      el('p',{class:'suave mini',texto:(p.justificativa?p.justificativa+' · ':'')+(p.pt.avaliados?p.pt.pontos+' ponto(s): '+p.pt.porque:'critérios não avaliados')}),
      el('details',{},[el('summary',{texto:'Situação, ordem e critérios'}),campo('Situação',st),campo('Ordem manual (vazio = pela pontuação)',ordem)].concat(crits.map(function(c){return campo(c.n,c.s)})).concat([el('button',{type:'button',texto:'Salvar',onclick:function(){var n={};for(var k in prios)n[k]=prios[k];var x=sem_(p);delete x.pt;x.st=st.value;x.ordem=num0(ordem.value);x.crit={};crits.forEach(function(c){if(c.s.value)x.crit[c.k]=Number(c.s.value)});n[p.id]=x;salvarPrios(n,'Prioridade salva.')}})]))])});
  var tit=inp({'aria-label':'Título da prioridade',placeholder:'Ex.: Tempo de resposta ao lead'}),jus=el('textarea',{rows:'2','aria-label':'Justificativa',placeholder:'Por que isto é prioridade, com o que você observou'});
  app.appendChild(qSecao('Prioridades do quarter'+(L.length?' ('+L.length+')':''),(foco?[el('p',{class:'suave mini',texto:foco})]:[]).concat(itens).concat([el('details',{},[el('summary',{texto:'Prioridade própria (do gestor)'}),campo('Título',tit),campo('Justificativa',jus),el('button',{type:'button',texto:'Adicionar',onclick:function(){if(!tit.value.trim())return;var n={};for(var k in prios)n[k]=prios[k];n['novo'+Date.now()]={titulo:tit.value.trim(),st:'propria',justificativa:jus.value.trim(),crit:{}};salvarPrios(n,'Prioridade adicionada.')}})])])));
  app.appendChild(el('p',{},[el('button',{class:'primario',type:'button',texto:'Seguir para o objetivo',onclick:function(){estado.faseQ='objetivo';telaQuarterE()}})]));
}
/* ---------- 3 · objetivo e metas ---------- */
function qObjetivo(E){
  var D=E.doc,O=D.objetivo||{},P=E.objetivo;
  var txt=inp({'aria-label':'Objetivo do quarter',value:O.texto||'',placeholder:'Em uma frase: o que este quarter muda'}),alvo=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Meta de receita (R$)',value:O.alvo==null?'':String(O.alvo)});
  app.appendChild(el('div',{class:'cartao'},[campo('Objetivo (uma frase)',txt),campo('Meta de receita do quarter (R$)',alvo),el('button',{class:'primario',type:'button',texto:'Salvar objetivo',onclick:function(){qSalvar({objetivo:{texto:txt.value.trim(),ind:'receita',alvo:num0(alvo.value)}},'Objetivo salvo.')}})]));
  var V=P.metaVs;
  if(V&&!V.erro){
    app.appendChild(qSecao('A meta cabe em que cenário?',[el('p',{texto:V.leitura}),qTabela(['Cenário','Receita','Alcança'],V.linhas.map(function(l){return [l.nome,brlT(l.v),l.alcanca==null?'—':l.alcanca?'sim':'não ('+brlT(l.distancia)+' a mais)']})),V.exige?el('p',{class:'mini',texto:V.exige.texto}):null,
      el('details',{},[el('summary',{texto:'Premissas dos cenários'}),el('p',{class:'mini',texto:'Ticket '+brlT(P.premissas.ticket.v)+' ('+P.premissas.ticket.fonte+') · leads por dia útil '+n1(P.premissas.leadsPorDiaUtil)+' · cabem no prazo '+pct(P.premissas.cabe)+' · '+P.premissas.pipelineOportunidades+' negócio(s) em oportunidade/proposta/negociação'})].concat(Object.keys(P.premissas.taxas).map(function(k){var t=P.premissas.taxas[k];return el('p',{class:'mini',texto:nomeInd(k)+': '+pct(t.v)+' ('+t.fonte+(t.n?', n='+t.n:'')+')'})})).concat([el('p',{class:'mini',texto:'Conservador: '+P.cenarios.conservador.premissas.map(function(x){return x.premissa+' '+(x.delta>0?'+':'')+Math.round(x.delta*100)+'%'}).join(', ')+' · Otimista: '+P.cenarios.otimista.premissas.map(function(x){return x.premissa+' '+(x.delta>0?'+':'')+Math.round(x.delta*100)+'%'}).join(', ')})]))]));
  } else if(P.alvo==null)app.appendChild(el('p',{class:'suave',texto:'Informe a meta para ver o que ela exige em cada cenário.'}));
  var krs=D.krs||{};
  var itens=E.krs.map(function(k){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:(k.nome||nomeInd(k.ind))}),' ',el('span',{class:'chip '+(k.tipo==='antecedente'?'estrategica':'normal'),texto:k.tipo==='antecedente'?'antecedente':'resultado'})]),
    el('p',{class:'suave mini',texto:nomeInd(k.ind)+': de '+fmtQ(k.ind,num0(k.partida))+' para '+fmtQ(k.ind,num0(k.alvo))+(k.obs&&k.obs.estado==='ok'?' · hoje '+fmtQ(k.ind,k.obs.v):'')+' · '+(k.resp||'sem responsável')+' · '+(k.freq||'')+(k.criterio?' · '+k.criterio:'')}),
    k.lacunas.length?el('p',{class:'erro mini',texto:'Falta: '+k.lacunas.join(', ')}):null,lk('Remover',function(){var n={};for(var x in krs)if(x!==k.id)n[x]=krs[x];qSalvar({krs:n},'Resultado-chave removido.')})])});
  var kInd=sel(IND_Q,'oportunidades',{'aria-label':'Indicador'}),kPart=inp({type:'number',step:'any',inputmode:'decimal','aria-label':'Valor de partida'}),kAlvo=inp({type:'number',step:'any',inputmode:'decimal','aria-label':'Meta final'}),kResp=inp({'aria-label':'Responsável'}),kCrit=inp({'aria-label':'Critério de sucesso',placeholder:'Ex.: ≥ 30 no quarter'}),kFreq=sel([['semanal','semanal'],['mensal','mensal'],['diaria','diária']],'semanal'),kTipo=sel([['resultado','resultado'],['antecedente','antecedente (avisa antes)']],'antecedente');
  app.appendChild(qSecao('Resultados-chave'+(E.krs.length?' ('+E.krs.length+')':''),itens.concat([el('details',{},[el('summary',{texto:'Adicionar resultado-chave'}),campo('Indicador',kInd),campo('Valor de partida',kPart),campo('Meta final',kAlvo),campo('Responsável',kResp),campo('Critério de sucesso',kCrit),campo('Frequência de acompanhamento',kFreq),campo('Tipo',kTipo),
    el('button',{type:'button',texto:'Adicionar',onclick:function(){var n={};for(var x in krs)n[x]=krs[x];n['novo'+Date.now()]={ind:kInd.value,partida:num0(kPart.value),alvo:num0(kAlvo.value),resp:kResp.value.trim(),criterio:kCrit.value.trim(),freq:kFreq.value,tipo:kTipo.value};qSalvar({krs:n},'Resultado-chave adicionado.')}})])])));
  app.appendChild(el('p',{},[el('button',{class:'primario',type:'button',texto:'Seguir para as iniciativas',onclick:function(){estado.faseQ='iniciativas';telaQuarterE()}})]));
}
/* ---------- 4 · iniciativas ---------- */
function qIniciativas(E){
  var D=E.doc,inis=D.iniciativas||{},prios=E.prioridades.filter(function(p){return ['aceita','modificada','propria'].indexOf(p.st)>=0});
  function salvar(n,msg){qSalvar({iniciativas:n},msg)}
  function copia(){var n={};for(var k in inis)n[k]=inis[k];return n}
  if(!prios.length)app.appendChild(el('p',{class:'erro',texto:'Nenhuma prioridade aceita: toda iniciativa precisa estar ligada a uma prioridade (fase 2).'}));
  E.iniciativas.forEach(function(i){
    var pr=E.prioridades.filter(function(p){return p.id===i.prio})[0],N=i.niveis;
    var marcos=lista_(i.marcos).map(function(m){var st=sel(MARCO_ST,m.st||'previsto',{'aria-label':'Situação do marco '+(m.txt||'')});
      return el('div',{class:'compromisso'},[el('span',{class:'marca'+(m.st==='concluido'?' feita':''),texto:m.st==='concluido'?'✓':String((m.mes||0)+1)}),el('span',{},[el('strong',{texto:m.txt||''}),el('span',{class:'suave mini',texto:' · prazo '+(m.prazo?data(m.prazo):'—')+(m.resp?' · '+m.resp:'')})]),st,lk('Salvar',function(){var n=copia();var x=sem_(i);delete x.lacunas;delete x.niveis;x.marcos=Object.assign({},i.marcos);x.marcos[m.id]=Object.assign({},sem_(m),{st:st.value});n[i.id]=x;salvar(n,'Marco atualizado.')})])});
    var mTxt=inp({'aria-label':'Entregável',placeholder:'O que fica pronto'}),mPrazo=inp({type:'date','aria-label':'Prazo'}),mMes=sel([['0','mês 1'],['1','mês 2'],['2','mês 3']],'0'),mResp=inp({'aria-label':'Responsável do marco (vazio = o da iniciativa)'});
    app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:i.nome||'(sem nome)'}),el('p',{class:'suave mini',texto:(pr?'Prioridade: '+pr.titulo:'sem prioridade ligada')+' · '+(i.resp||'sem responsável')+(i.ind?' · '+nomeInd(i.ind)+' de '+fmtQ(i.ind,num0(i.inicial))+' → mínimo '+fmtQ(i.ind,num0(i.minimo))+' → alvo '+fmtQ(i.ind,num0(i.alvo)):'')+(i.st==='cancelada'?' · CANCELADA':'')}),
      i.hipotese?el('p',{class:'mini',texto:'Hipótese: '+i.hipotese}):null,
      i.lacunas.length?el('p',{class:'erro mini',texto:'Falta: '+i.lacunas.join('; ')}):null,
      el('p',{},[el('span',{class:'chip '+NIV_C[N.entregavel.estado],texto:'entregáveis '+N.entregavel.feitos+'/'+N.entregavel.total}),' ',el('span',{class:'chip '+NIV_C[N.execucao.estado],texto:'execução: '+N.execucao.estado.replace('_',' ')}),' ',el('span',{class:'chip '+NIV_C[N.hipotese.estado],texto:'hipótese: '+N.hipotese.estado.replace('_',' ')}),' ',el('span',{class:'chip '+NIV_C[N.resultado.estado],texto:'resultado: '+N.resultado.estado.replace('_',' ')})]),
      el('ul',{class:'compromissos'},marcos),
      el('details',{},[el('summary',{texto:'Adicionar marco'}),campo('Entregável',mTxt),campo('Prazo',mPrazo),campo('Mês',mMes),campo('Responsável',mResp),el('button',{type:'button',texto:'Adicionar marco',onclick:function(){if(!mTxt.value.trim())return;var n=copia();var x=sem_(i);delete x.lacunas;delete x.niveis;x.marcos=Object.assign({},i.marcos);x.marcos['novo'+Date.now()]={txt:mTxt.value.trim(),prazo:mPrazo.value||null,mes:Number(mMes.value),resp:mResp.value.trim()||undefined,st:'previsto'};n[i.id]=x;salvar(n,'Marco adicionado.')}})]),
      i.st!=='cancelada'?lk('Cancelar iniciativa',function(){if(!confirm('Cancelar a iniciativa "'+i.nome+'"? Ela fica no histórico como abandonada.'))return;var n=copia();var x=sem_(i);delete x.lacunas;delete x.niveis;x.st='cancelada';n[i.id]=x;salvar(n,'Iniciativa cancelada.')}):null]));
  });
  var f={};
  var campos=[['nome','Nome (uma intervenção no mecanismo, não uma intenção)','text'],['resp','Responsável principal','text'],['problema','Problema observado','text'],['hipotese','Hipótese (se fizermos X, Y muda porque…)','text'],['variavel','Variável alterada','text'],['inicial','Valor inicial do indicador','number'],['minimo','Critério mínimo de sucesso','number'],['alvo','Alvo esperado','number'],['continuar','Critério para continuar','text'],['corrigir','Critério para corrigir','text'],['interromper','Critério para interromper','text'],['horas','Horas por mês (carga)','number'],['orcamento','Orçamento (R$)','number']];
  var fPrio=sel(prios.map(function(p){return [p.id,p.titulo]}),prios.length?prios[0].id:'',{'aria-label':'Prioridade ligada'}),fInd=sel(IND_Q,'oportunidades>vendas',{'aria-label':'Indicador de sucesso'});
  var fMeses=[0,1,2].map(function(m){var c=el('input',{type:'checkbox',checked:''});return {m:m,c:c}});
  campos.forEach(function(c){f[c[0]]=inp({type:c[2],step:c[2]==='number'?'any':undefined,inputmode:c[2]==='number'?'decimal':undefined,'aria-label':c[1]})});
  var m0=inp({'aria-label':'Primeiro marco',placeholder:'Primeiro entregável'}),m0p=inp({type:'date','aria-label':'Prazo do primeiro marco'});
  app.appendChild(el('div',{class:'cartao'},[el('details',{},[el('summary',{texto:'Nova iniciativa'}),campo('Prioridade ligada',fPrio)].concat(campos.slice(0,5).map(function(c){return campo(c[1],f[c[0]])})).concat([campo('Indicador de sucesso',fInd)]).concat(campos.slice(5).map(function(c){return campo(c[1],f[c[0]])})).concat([el('p',{},[el('label',{texto:'Meses em que está ativa'})].concat(fMeses.map(function(x){return el('label',{class:'inline'},[x.c,'mês '+(x.m+1)+' '])}))),campo('Primeiro marco',m0),campo('Prazo do primeiro marco',m0p),
    el('button',{class:'primario',type:'button',texto:'Adicionar iniciativa',onclick:function(){var x={prio:fPrio.value,ind:fInd.value,meses:fMeses.filter(function(y){return y.c.checked}).map(function(y){return y.m}),marcos:{}};campos.forEach(function(c){var v=f[c[0]].value;x[c[0]]=c[2]==='number'?num0(v):v.trim()});if(m0.value.trim())x.marcos['novo1']={txt:m0.value.trim(),prazo:m0p.value||null,mes:x.meses[0]||0,st:'previsto'};var n=copia();n['novo'+Date.now()]=x;salvar(n,'Iniciativa adicionada. Confira as lacunas.')}})]))]));
  var C=E.capacidade,S=E.sequencia;
  app.appendChild(el('details',{},[el('summary',{texto:'Capacidade e sequência'}),C.semCapacidade?el('p',{class:'suave mini',texto:'Capacidade da equipe não declarada (declare na fase 5).'}):el('p',{class:'mini',texto:C.sobrecarga?'Sobrecarga: '+C.alternativas.map(function(a){return a.texto}).join(' '):'A carga das iniciativas cabe na capacidade declarada.'})].concat((S.itens||[]).map(function(s){return el('p',{class:'mini',texto:s.nome+': '+s.texto})})).concat(S.erro?[el('p',{class:'erro mini',texto:S.erro})]:[])));
  app.appendChild(el('p',{},[el('button',{class:'primario',type:'button',texto:'Seguir para os meses',onclick:function(){estado.faseQ='meses';telaQuarterE()}})]));
}
/* ---------- 5 · os três meses ---------- */
function qMeses(E){
  var D=E.doc,cards=E.meses.map(function(m){
    var meta=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Meta de receita de '+m.nome,value:m.metaDefinida?String(m.meta):''}),res=inp({'aria-label':'Resultado esperado',value:m.resultado||'',placeholder:'O que estará diferente no fim do mês'}),cri=inp({'aria-label':'Critério de sucesso',value:m.criterio||'',placeholder:'Como saber que deu certo'});
    var B=m.bottomUp,passos=B&&!B.erro?B.passos.map(function(p){return el('p',{class:'mini',texto:p.nome+': '+(p.v==null?'—':n1(p.v))+(p.taxa!=null&&p.k!=='vendas'?' ('+p.como+(p.fonte?', '+p.fonte:'')+')':'')})}):[el('p',{class:'erro mini',texto:B?B.erro:'sem meta'})];
    return {m:m,meta:meta,res:res,cri:cri,card:el('div',{class:'cartao'},[el('h2',{texto:'Mês '+(m.m+1)+' · '+m.nome+' ('+m.du+' dias úteis)'+(m.status==='fechado'?' · fechado':m.status==='atual'?' · em curso':'')}),
      campo('Meta de receita (R$) · sugerida pelos dias úteis: '+brlT(m.sugerida)+(m.metaNoCiclo!=null?' · no ciclo hoje: '+brlT(m.metaNoCiclo):''),meta),campo('Resultado esperado',res),campo('Critério de sucesso',cri),
      m.real!=null?el('p',{class:'mini',texto:'Realizado até hoje: '+brlT(m.real)}):null,
      el('details',{},[el('summary',{texto:'Bottom-up: o que a meta exige'})].concat(passos).concat(B&&B.defasagem?[el('p',{class:'suave mini',texto:B.defasagem.texto})]:[]))])}});
  cards.forEach(function(c){app.appendChild(c.card)});
  var soma=E.meses.reduce(function(a,m){return a+(m.meta||0)},0);
  app.appendChild(el('p',{},[el('button',{class:'primario',type:'button',texto:'Salvar os três meses',onclick:function(){var ms={};cards.forEach(function(c){ms[String(c.m.m)]={meta:num0(c.meta.value),resultado:c.res.value.trim(),criterio:c.cri.value.trim()}});qSalvar({meses:ms},'Meses salvos.')}}),el('span',{class:'suave mini',texto:' soma '+brlT(soma)+(E.objetivo.alvo!=null?' de '+brlT(E.objetivo.alvo):'')})]));
  /* capacidade declarada, decisões, gatilhos, riscos */
  var cap=D.capacidade||{pessoas:{}},pes=cap.pessoas||{},nomes=Object.keys(pes);
  var pNome=inp({'aria-label':'Pessoa'}),pHoras=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Horas por mês para iniciativas'}),opFr=inp({type:'number',min:'0',max:'95',step:'1',inputmode:'numeric','aria-label':'Fração tomada pela rotina (%)',value:cap.operacao!=null?String(Math.round(cap.operacao*100)):''}),orc=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Orçamento disponível (R$)',value:cap.orcamento==null?'':String(cap.orcamento)});
  app.appendChild(el('details',{},[el('summary',{texto:'Capacidade declarada da equipe'+(nomes.length?' ('+nomes.length+' pessoa(s))':' (não declarada)')})].concat(nomes.map(function(n){return el('p',{class:'mini'},[n+': '+pes[n]+' h/mês ',lk('Remover',function(){var c=Object.assign({},cap,{pessoas:Object.assign({},pes)});delete c.pessoas[n];qSalvar({capacidade:c},'Capacidade atualizada.')})])})).concat([campo('Pessoa',pNome),campo('Horas por mês disponíveis para iniciativas',pHoras),campo('% já tomado pela rotina comercial',opFr),campo('Orçamento do quarter para iniciativas (R$)',orc),
    el('button',{type:'button',texto:'Salvar capacidade',onclick:function(){var c=Object.assign({},cap,{pessoas:Object.assign({},pes)});if(pNome.value.trim()&&num0(pHoras.value)!=null)c.pessoas[pNome.value.trim()]=num0(pHoras.value);c.operacao=num0(opFr.value)==null?0:num0(opFr.value)/100;c.orcamento=num0(orc.value);qSalvar({capacidade:c},'Capacidade salva.')}})])));
  if(E.capacidade.sobrecarga){var dec=D.decisoes||{},dTxt=el('textarea',{rows:'2','aria-label':'Decisão sobre a capacidade',placeholder:'O que foi decidido: priorizar, redistribuir, adiar ou reforçar'});
    app.appendChild(el('div',{class:'cartao'},[el('p',{class:'erro',texto:'A carga das iniciativas passa a capacidade declarada.'})].concat(E.capacidade.alternativas.map(function(a){return el('p',{class:'mini',texto:a.texto})})).concat(lista_(dec).filter(function(d){return d.tipo==='capacidade'}).map(function(d){return el('p',{class:'ok mini',texto:'Decisão registrada: '+d.texto})})).concat([campo('Decisão',dTxt),el('button',{type:'button',texto:'Registrar decisão',onclick:function(){if(dTxt.value.trim().length<5)return;var n={};for(var k in dec)n[k]=dec[k];n['novo'+Date.now()]={tipo:'capacidade',texto:dTxt.value.trim(),em:new Date().toISOString()};qSalvar({decisoes:n},'Decisão registrada.')}})])));}
  var gats=D.gatilhos||{},gInd=sel(IND_Q,'oportunidades>vendas',{'aria-label':'Indicador do gatilho'}),gOp=sel([['abaixo','abaixo de'],['acima','acima de']],'abaixo'),gLim=inp({type:'number',step:'any',inputmode:'decimal','aria-label':'Limite (taxas em fração, ex.: 0,2)'}),gAcao=inp({'aria-label':'Ação ao disparar',placeholder:'Ex.: investigar a etapa e revisar o roteiro'});
  app.appendChild(el('details',{},[el('summary',{texto:'Gatilhos de decisão ('+Object.keys(gats).length+')'})].concat(E.gatilhos.map(function(g){return el('p',{class:'mini'},[nomeInd(g.ind)+' '+(g.op==='acima'?'acima de ':'abaixo de ')+fmtQ(g.ind,num0(g.limite))+' → '+(g.acao||'revisar o plano')+' · '+g.estado+' ',lk('Remover',function(){var n={};for(var k in gats)if(k!==g.id)n[k]=gats[k];qSalvar({gatilhos:n},'Gatilho removido.')})])})).concat([campo('Indicador',gInd),campo('Dispara quando',gOp),campo('Limite',gLim),campo('Ação',gAcao),el('button',{type:'button',texto:'Adicionar gatilho',onclick:function(){if(num0(gLim.value)==null)return;var n={};for(var k in gats)n[k]=gats[k];n['novo'+Date.now()]={ind:gInd.value,op:gOp.value,limite:num0(gLim.value),acao:gAcao.value.trim()};qSalvar({gatilhos:n},'Gatilho adicionado.')}})])));
  var riscos=D.riscos||{},rTxt=inp({'aria-label':'Risco',placeholder:'O que pode dar errado'}),rResp=inp({'aria-label':'Plano de resposta',placeholder:'O que fazemos se acontecer'});
  app.appendChild(el('details',{},[el('summary',{texto:'Riscos ('+Object.keys(riscos).length+')'})].concat(lista_(riscos).map(function(r){return el('p',{class:'mini'},[r.txt+(r.resposta?' → '+r.resposta:' (sem plano de resposta)')+' ',lk('Remover',function(){var n={};for(var k in riscos)if(k!==r.id)n[k]=riscos[k];qSalvar({riscos:n},'Risco removido.')})])})).concat([campo('Risco',rTxt),campo('Plano de resposta',rResp),el('button',{type:'button',texto:'Adicionar risco',onclick:function(){if(!rTxt.value.trim())return;var n={};for(var k in riscos)n[k]=riscos[k];n['novo'+Date.now()]={txt:rTxt.value.trim(),resposta:rResp.value.trim()};qSalvar({riscos:n},'Risco adicionado.')}})])));
  app.appendChild(el('p',{},[el('button',{class:'primario',type:'button',texto:'Seguir para a publicação',onclick:function(){estado.faseQ='publicar';telaQuarterE()}})]));
}
/* ---------- 6 · publicação e acompanhamento ---------- */
function qPublicar(E){
  var D=E.doc,A=E.aprovacao,Q=E.quarter;
  app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:A.ok?'Sim: nada impede a aprovação':A.bloqueios.length+' item(ns) impedem a aprovação'})].concat(A.bloqueios.map(function(b){return el('p',{class:'erro mini',texto:b})})).concat(A.avisos.length?[el('details',{},[el('summary',{texto:A.avisos.length+' aviso(s) que não bloqueiam'})].concat(A.avisos.map(function(a){return el('p',{class:'mini',texto:a})})))]:[])));
  if(D.status==='encerrado'){qEncerramento(D.encerramento||{});}
  else if(A.ok){
    var mot=el('textarea',{rows:'2','aria-label':'Motivo da revisão',placeholder:'O que mudou e por quê (a versão anterior fica guardada)'});
    app.appendChild(el('div',{class:'cartao'},[D.status==='publicado'?campo('Motivo da revisão (obrigatório)',mot):el('p',{class:'suave mini',texto:'Publicar congela a versão 1 do plano. Depois disso, cada mudança publicada vira uma nova versão com motivo.'}),
      el('button',{class:'primario',type:'button',texto:D.status==='publicado'?'Publicar revisão (v'+(D.versao+1)+')':'Publicar o plano (v1)',onclick:function(){qAcao('publicar',{motivo:mot.value.trim()},function(r){return 'Publicado: v'+r.versao+'.'})}})]));
  }
  if(D.status==='publicado'||D.status==='encerrado'){
    var prog=D.programa;
    app.appendChild(qSecao('As metas dos meses nos ciclos',[el('p',{class:'suave mini',texto:'Levar a meta é ação sua: grava a meta de receita de cada mês no ciclo (as metas só acrescentam) e congela o programa original.'}),prog?el('p',{class:'ok mini',texto:'Levadas em '+data(prog.levadoEm.slice(0,10))+(prog.por?' por '+prog.por:'')+'.'}):null,
      D.status==='publicado'?el('button',{type:'button',texto:prog?'Levar de novo (só o que mudou)':'Levar as metas dos meses para os ciclos',onclick:function(){qAcao('metas',{},function(r){return r.gravadas.length?'Metas gravadas em: '+r.gravadas.join(', ')+'.':'Nada a gravar: as metas dos ciclos já batem com o plano.'})}}):null]));
    if(E.programa)qPrograma(E.programa);
    var fech=D.fechMes||{};
    E.meses.forEach(function(m){
      if(!(m.status!=='futuro'))return;var f=fech[String(m.m)];
      var marcos=E.iniciativas.filter(function(i){return i.st!=='cancelada'}).reduce(function(a,i){return a.concat(lista_(i.marcos).filter(function(x){return (x.mes||0)===m.m}).map(function(x){return {id:x.id,txt:x.txt,ini:i.nome}}))},[]);
      if(f)app.appendChild(el('details',{},[el('summary',{texto:'Mês '+(m.m+1)+' fechado em '+data(f.em.slice(0,10))+': '+f.total+' compromisso(s), '+(f.seguem||[]).length+' segue(m)'}),f.nota?el('p',{class:'mini',texto:f.nota}):null]));
      else if(D.status==='publicado'){var sels=marcos.map(function(x){return {x:x,s:sel([['','—']].concat(FECH_MES),'',{'aria-label':'Classificação de '+x.txt})}}),nota=el('textarea',{rows:'2','aria-label':'O que muda no mês seguinte'});
        app.appendChild(el('details',{},[el('summary',{texto:'Fechar o mês '+(m.m+1)+' ('+m.nome+'): '+marcos.length+' compromisso(s)'}),el('p',{class:'suave mini',texto:'Classifique cada compromisso. Só "pendente e válido" e "replanejado" seguem para o mês seguinte.'})].concat(sels.map(function(p){return campo(p.x.txt+' · '+p.x.ini,p.s)})).concat([campo('O que muda no mês seguinte',nota),el('button',{type:'button',texto:'Fechar o mês '+(m.m+1),onclick:function(){var c={};sels.forEach(function(p){if(p.s.value)c[p.x.id]=p.s.value});qAcao('fechar-mes',{m:m.m,classif:c,nota:nota.value.trim()},'Mês '+(m.m+1)+' fechado.')}})])));}
    });
    if(D.status==='publicado'&&Q.terminou)app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Encerrar o quarter'}),el('p',{class:'suave mini',texto:'Compara o resultado com o plano original (v1), avalia cada iniciativa (execução × hipótese) e congela. Não pode ser desfeito.'}),
      el('button',{class:'primario',type:'button',texto:'Encerrar o quarter',onclick:function(){if(confirm('Encerrar o quarter '+Q.rotulo+'? Isso não pode ser desfeito.'))qAcao('encerrar',{},'Quarter encerrado.')}})]));
    if(E.aprendizadosSugeridos.length)app.appendChild(el('details',{},[el('summary',{texto:'Aprendizados sugeridos ('+E.aprendizadosSugeridos.length+')'})].concat(E.aprendizadosSugeridos.map(function(a){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:a.contexto})]),el('p',{class:'mini',texto:a.evidencia}),el('p',{class:'mini',texto:a.conclusao+(a.implicacao?' → '+a.implicacao:'')+' · confiança '+a.confianca}),lk('Gravar como aprendizado',function(){qAcao('aprendizado',{tipo:/produziu/.test(a.conclusao)?'funcionou':/perdeu força/.test(a.conclusao)?'nao_funcionou':'hipotese',texto:a.conclusao,dados:a},'Aprendizado gravado.')})])}))));
    var vs=lista_(D.versoes||{});
    if(vs.length)app.appendChild(el('details',{},[el('summary',{texto:vs.length+' versão(ões) publicada(s)'})].concat(vs.map(function(v){return el('p',{class:'mini',texto:'v'+v.n+' · '+(v.em?new Date(v.em).toLocaleString('pt-BR'):'')+(v.por?' · '+v.por:'')+' · '+v.motivo})}))));
  }
  var hist=el('details',{},[el('summary',{texto:'Histórico de decisões do plano'})]);
  hist.addEventListener('toggle',async function(){if(!hist.open||hist.dataset.ok)return;hist.dataset.ok='1';try{var H=await api(qBase()+'/historico'+qs());H.forEach(function(h){hist.appendChild(el('p',{class:'mini',texto:new Date(h.em).toLocaleString('pt-BR')+(h.por?' · '+h.por:'')+' · '+h.acao}))});if(!H.length)hist.appendChild(el('p',{class:'suave mini',texto:'Nada ainda.'}))}catch(e){hist.appendChild(el('p',{class:'erro mini',texto:e.message}))}});
  app.appendChild(hist);
}
/* ---------- metas históricas por ciclo ---------- */
var ESTM_N={conhecida:'Conhecida',desconhecida:'Desconhecida',sem_meta:'Sem meta',estimada:'Estimativa',fora:'Antes da operação'};
var ESTM_C={conhecida:'no_ritmo',desconhecida:'atras',sem_meta:'sem',estimada:'atencao',fora:'sem'};
var FONTE_N={fora:'antes da operação',plano:'plano do ciclo',configuracao:'meta cadastrada',observacao:'meta observada na época',foto_diaria:'Fechamento do dia',revisao:'revisão',estimativa:'estimativa',nenhuma:'—'};
function mhBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)}
async function telaMetasHist(msg,ok){
  limpar();
  var L,A,P;
  try{L=await api(mhBase()+'/metas-historicas?n=13');A=await api(mhBase()+'/metas-historicas/ano');P=await api(mhBase()+'/plano-ciclo'+qs())}catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(abas());app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));app.appendChild(controles());return}
  app.appendChild(abas());
  cabecalho('Metas históricas','A meta oficial de cada ciclo: versão final do plano; ciclo passado sem evidência = desconhecida (nunca zero, nunca a de hoje). O registro do encerramento é imutável; correção é revisão com justificativa.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  async function acao(sub,corpo,msg){try{await api(mhBase()+'/metas-historicas/'+sub,corpo);telaMetasHist(msg,true)}catch(e){telaMetasHist(e.message)}}
  async function plano(sub,corpo,msg){try{await api(mhBase()+'/plano-ciclo/'+sub+qs(),corpo||{});telaMetasHist(msg,true)}catch(e){telaMetasHist(e.message)}}
  /* o ano */
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Quanto o ano '+A.ano+' precisa e quanto já veio?'}),el('p',{class:'grande',texto:brlT(A.realizado)+(A.metaAcum!=null?' de '+brlT(A.metaAcum):'')}),
    el('p',{class:'suave',texto:'Realizado × meta acumulada até hoje'+(A.atingAcum!=null?' ('+pct(A.atingAcum)+')':'')+(A.metaTotal!=null?' · meta final do ano '+brlT(A.metaTotal)+(A.metaTotalEstado==='parcial'?' (incompleta)':''):'')+(A.projecao!=null?' · projeção '+brlT(A.projecao)+(A.atingProj!=null?' ('+pct(A.atingProj)+' da meta final)':''):'')}),
    A.notas.length?el('details',{},[el('summary',{texto:A.notas.length+' nota(s)'})].concat(A.notas.map(function(n){return el('p',{class:'mini',texto:n})}))):null]));
  /* plano do ciclo atual */
  var pl=P.linha,V=P.doc&&P.doc.metas?P.doc.metas['receita:op']:null;
  var planoCard=[el('h2',{texto:'Plano do ciclo de '+data(P.ciclo.inicio)}),el('p',{class:'suave mini',texto:(pl?'Plano '+pl.status+' · versão '+pl.versao+(pl.corte?' · último corte '+data(pl.corte):''):'Sem plano ativo: as metas cadastradas valem como meta vigente, mas não há foto original aprovada.')+(V?' · meta de receita vigente '+brlT(V.alvo):' · sem meta de receita')})];
  if(!pl||pl.status==='rascunho')planoCard.push(el('button',{class:'primario',type:'button',texto:'Ativar o plano (congela a meta original)',onclick:function(){plano('ativar',{},'Plano ativado: a meta original está congelada.')}}));
  if(pl&&pl.status==='ativo'){var corte=inp({type:'date','aria-label':'Data de corte',value:estado.data||hoje()}),mot=el('textarea',{rows:'2','aria-label':'Motivo do replanejamento',placeholder:'O que mudou (a versão anterior fica guardada)'}),nova=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Nova meta de receita da operação (R$)'});
    planoCard.push(el('details',{},[el('summary',{texto:'Replanejar a partir de uma data'}),campo('Data de corte',corte),campo('Motivo',mot),campo('Nova meta de receita da operação (R$)',nova),el('button',{type:'button',texto:'Replanejar',onclick:function(){if(num0(nova.value)==null)return;plano('replanejar',{corte:corte.value,motivo:mot.value.trim(),metas:[{indicador:'receita',valor:num0(nova.value)}]},'Replanejado: nova versão vigente; a original segue guardada.')}})]));
    planoCard.push(el('p',{},[lk('Fechar o plano (registra a meta do ciclo)',function(){if(confirm('Fechar o plano deste ciclo? Ele deixa de mudar e a meta oficial é registrada.'))plano('fechar',{},'Plano fechado e meta registrada.')})]));}
  if(pl&&pl.original)planoCard.push(el('details',{},[el('summary',{texto:'Versões do plano'})].concat((P.doc.versoes?lista_(P.doc.versoes):[]).map(function(v){var r=v.metas&&v.metas['receita:op'];return el('p',{class:'mini',texto:'v'+v.n+' até '+data(v.corte)+': '+brlT(r?r.alvo:null)+' · '+v.motivo+(v.por?' · '+v.por:'')})})).concat([el('p',{class:'mini',texto:'Original aprovada em '+data(pl.original.em.slice(0,10))+(pl.original.por?' por '+pl.original.por:'')+': '+brlT((pl.original.metas.filter(function(m){return m.indicador==='receita'&&!m.pessoaId})[0]||{}).valor)})])));
  app.appendChild(el('div',{class:'cartao'},planoCard));
  /* ciclo a ciclo */
  var pend=L.filter(function(x){return !x.fora&&x.encerrado&&!x.oficial.registrado});
  var linhas=L.map(function(x){var o=x.oficial;
    var acts=[];
    if(!x.fora&&x.encerrado&&!o.registrado)acts.push(lk('Registrar',function(){acao('registrar',{cicloInicio:x.inicio},'Meta de '+x.nome+' registrada.')}));
    if(o.registrado)acts.push(lk('Revisar',function(){estado.mhRev=estado.mhRev===x.inicio?null:x.inicio;telaMetasHist()}));
    if(o.registrado&&o.estado==='desconhecida')acts.push(lk('Estimativa',function(){estado.mhEst=estado.mhEst===x.inicio?null:x.inicio;telaMetasHist()}));
    return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:x.nome}),' ',el('span',{class:'chip '+ESTM_C[o.estado],texto:ESTM_N[o.estado]||o.estado}),o.estado==='conhecida'?el('span',{texto:' '+reais(o.receita)}):null,o.estimativas&&o.estimativas.length?el('span',{class:'suave mini',texto:' · '+o.estimativas.length+' estimativa(s) à parte'}):null]),
      el('p',{class:'suave mini',texto:(x.encerrado?'encerrado':'em andamento')+(x.plano?' · plano '+x.plano.status:'')+' · '+(FONTE_N[o.fonte]||o.fonte||'')+' · '+(o.registrado?'registro '+o.id+' ('+(o.tipo||'')+')':x.encerrado&&!x.fora?'registro pendente':'sem registro')}),
      o.divergencia?el('p',{class:'erro mini',texto:'As fontes mudaram depois do registro: '+(o.divergencia.receita!=null?reais(o.divergencia.receita):ESTM_N[o.divergencia.estado])+'. A meta registrada não muda sozinha: se a mudança for legítima, revise.'}):null,
      el('details',{},[el('summary',{class:'mini',texto:'Por quê'}),el('p',{class:'mini',texto:o.motivo||''})]),el('p',{},acts)])});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Ciclo a ciclo'}),pend.length?el('p',{class:'erro mini',texto:pend.length+' ciclo(s) encerrado(s) sem registro (a rotina registra sozinha; você pode registrar agora).'}):null].concat(linhas)));
  var rev=L.filter(function(x){return x.inicio===estado.mhRev})[0],est=L.filter(function(x){return x.inicio===estado.mhEst})[0];
  if(rev){var rv=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Meta corrigida (R$); vazio = desconhecida'}),rj=el('textarea',{rows:'2','aria-label':'Justificativa',placeholder:'Ex.: meta aprovada na reunião de 02/09, ata no Drive'});
    app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Revisar a meta de '+rev.nome}),el('p',{class:'suave mini',texto:'Cria um registro novo; o atual ('+rev.oficial.id+', '+(ESTM_N[rev.oficial.estado]||'')+(rev.oficial.receita!=null?' '+reais(rev.oficial.receita):'')+') fica guardado. Vazio = registrar como desconhecida.'}),campo('Meta de receita da empresa (R$)',rv),campo('Justificativa (obrigatória, 10+ caracteres)',rj),
      el('button',{class:'primario',type:'button',texto:'Registrar revisão',onclick:function(){estado.mhRev=null;acao('revisar',{cicloInicio:rev.inicio,receita:num0(rv.value),justificativa:rj.value.trim()},'Revisão registrada.')}})]));}
  if(est){var ev=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Estimativa (R$)'}),ej=el('textarea',{rows:'2','aria-label':'Justificativa'}),eo=inp({'aria-label':'Origem da estimativa',placeholder:'Ex.: média dos ciclos vizinhos'}),elim=inp({'aria-label':'Limitações',placeholder:'Ex.: sem ata; sazonalidade não considerada'});
    app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Estimativa para '+est.nome}),el('p',{class:'suave mini',texto:'Fica registrada à parte, identificada como estimativa, e NÃO substitui a meta desconhecida: o atingimento continua sem cálculo.'}),campo('Valor (R$)',ev),campo('Justificativa',ej),campo('Origem',eo),campo('Limitações',elim),
      el('button',{class:'primario',type:'button',texto:'Registrar estimativa',onclick:function(){estado.mhEst=null;acao('revisar',{cicloInicio:est.inicio,tipo:'estimativa',receita:num0(ev.value),justificativa:ej.value.trim(),origem:eo.value.trim(),limitacoes:elim.value.trim()},'Estimativa registrada.')}})]));}
}
`;
