/* Aba "Dia" da tela: o plano do dia por pessoa e a equipe para o gestor, lidos em três rituais (manhã, tarde, fim do dia).
   Cada tela responde a uma pergunta; o resto fica fechado em "detalhes". É um pedaço de JavaScript inserido na PAGINA (sem crases nem "${" aqui dentro).
   Usa o que a página já tem: el, api, limpar, abas, controles, cabecalho, data, numero, pct, reais, estado, guardar/ler, telaEntrada. */
export const TELA_DIA = `
var CLASSE_N={critica:'Crítica',alta:'Alta',normal:'Normal',estrategica:'Estratégica'};
var RIT_N={manha:'Manhã',tarde:'Tarde',fim:'Fim do dia'};
var RIT_P={manha:'O que fazer hoje para o dia ser um sucesso?',tarde:'Como está o dia até agora?',fim:'O dia foi um sucesso?'};
var EVID={proj:'projeção do plano',hist:'evidência histórica',hip:'hipótese'};
var QUAD_N={em_dia:'Dentro do plano',operacional:'Atraso operacional',resultado:'Insuficiência de resultado',ambos:'Atraso e resultado',sem_dado:'Sem meta'};
var QUAD_C={em_dia:'no_ritmo',operacional:'atencao',resultado:'atencao',ambos:'atras',sem_dado:'sem'};
var ESP_N={em_dia:'no ritmo',atencao:'atenção',atras:'atrás'};
var GRAU_N={4:'Decidir',3:'Cobrar',2:'Acompanhar',1:'Observar'};
function ritualAgora(){var h=new Date().getHours();return h<12?'manha':h<17?'tarde':'fim'}
function hoje(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function hora(iso){var d=new Date(iso);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function inteiro(n){return String(Math.ceil(n-1e-9))}
function barra(f,t){var p=t>0?Math.min(100,Math.round(100*f/t)):0;return el('div',{class:'prog',role:'progressbar','aria-valuenow':String(p),'aria-valuemin':'0','aria-valuemax':'100','aria-label':p+'%'},[el('div',{class:'prog-f'+(p>=100?' cheia':''),style:'width:'+p+'%'})])}
function diaBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)}
function diaQs(extra){var q=[];if(estado.data)q.push('data='+encodeURIComponent(estado.data));q.push('ritual='+estado.ritual);(extra||[]).forEach(function(x){q.push(x)});return '?'+q.join('&')}
function vendedores(pessoas){return pessoas.filter(function(p){return p.ativa&&(p.funcao==='sdr'||p.funcao==='closer'||p.funcao==='ambos')})}
async function telaDia(msg,ok){
  limpar();
  var pessoas;
  try{pessoas=await api(diaBase()+'/pessoas')}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  var time=vendedores(pessoas);
  if(!estado.ritual)estado.ritual=(!estado.data||estado.data===hoje())?ritualAgora():'fim';
  app.appendChild(abas());
  if(!time.length){
    cabecalho('Plano do dia','Cadastre quem vende (SDR, closer) em "Equipe e metas" para montar o plano de cada um.').forEach(function(n){if(n)app.appendChild(n)});
    app.appendChild(controles());return;
  }
  var quem=estado.pessoaDia;
  if(quem!=='equipe'&&!time.some(function(p){return p.id===quem}))quem=estado.pessoaDia=time.length>1?'equipe':time[0].id;
  if(quem==='equipe')return telaDiaEquipe(time,msg,ok);
  return telaDiaPessoa(time,quem,msg,ok);
}
/* quem e qual momento do dia: os dois seletores que mudam a leitura */
function seletoresDia(time,quem){
  var sel=el('select',{'aria-label':'De quem é o plano',onchange:function(){estado.pessoaDia=sel.value;telaDia()}},
    [el('option',{value:'equipe',texto:'Equipe (visão do gestor)'})].concat(time.map(function(p){return el('option',{value:p.id,texto:p.nome})})));
  sel.value=quem;
  var rit=el('div',{class:'abas rituais',role:'group','aria-label':'Momento do dia'},['manha','tarde','fim'].map(function(r){
    var b=el('button',{type:'button',texto:RIT_N[r],onclick:function(){estado.ritual=r;telaDia()}});if(estado.ritual===r)b.setAttribute('aria-current','page');return b}));
  return [el('div',{class:'barra'},[sel]),rit];
}
function fonteEvid(b){return b&&b.e?el('span',{class:'chip sem mini',texto:EVID[b.e]||b.e}):null}
async function telaDiaPessoa(time,quem,msg,ok){
  var D,fotos;
  try{D=await api(diaBase()+'/dia'+diaQs(['pessoa='+quem]));fotos=await api(diaBase()+'/dia/fotos?pessoa='+quem+(estado.data?'&data='+estado.data:''))}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui montar o plano: '+e.message}));return}
  estado.data=estado.data||D.data;
  var util=D.ciclo.uteisPessoa.filter(function(d){return d<=D.data}).length;
  cabecalho(RIT_P[D.ritual],D.pessoa.nome+(D.pessoa.funcaoNome?' · '+D.pessoa.funcaoNome:'')+' · '+data(D.data)+(D.ciclo.trabalhaHoje?' · dia '+util+' de '+D.ciclo.uteisPessoa.length+' do ciclo':' · dia sem trabalho')).forEach(function(n){if(n)app.appendChild(n)});
  seletoresDia(time,quem).forEach(function(n){app.appendChild(n)});
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var temMeta=D.prod.some(function(x){return x.metaTotal>0});
  if(!temMeta){
    app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:'Sem metas neste ciclo'}),el('p',{class:'suave',texto:D.pessoa.nome+' não tem meta cadastrada para o ciclo de '+data(D.ciclo.inicio)+'. Cadastre em "Equipe e metas" ou trave o quarter.'})]));
  }
  /* 1. a resposta: é um dia de sucesso se… */
  var S=D.sucesso,okN=S.filter(function(s){return s.ok}).length;
  if(!D.ciclo.trabalhaHoje)app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:'Hoje não é dia de trabalho de '+D.pessoa.nome}),el('p',{class:'suave',texto:'Sem meta de hoje e sem recuperação de atraso. O atraso em aberto, se houver, continua distribuído nos próximos dias úteis.'})]));
  else if(S.length){
    var tit=D.ritual==='fim'?(okN===S.length?'Sim: dia de sucesso':'Faltou '+(S.length-okN)+' de '+S.length):(D.ritual==='tarde'?okN+' de '+S.length+' cumpridos':'É um dia de sucesso se…');
    app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:tit}),barra(okN,S.length),el('ul',{class:'compromissos'},S.map(function(s){return itemCompromisso(D,s)}))]));
  }
  /* 2. produção: quanto falta hoje */
  var diarios=D.prod.filter(function(x){return x.diario&&x.metaTotal>0}),outros=D.prod.filter(function(x){return !x.diario&&(x.metaTotal>0||x.feitoCiclo>0)});
  if(diarios.length||outros.length){
    var blocos=[el('h2',{texto:'Produção'})];
    diarios.forEach(function(x){blocos.push(linhaProducao(D,x))});
    outros.forEach(function(x){blocos.push(linhaSemana(x))});
    app.appendChild(el('div',{class:'cartao'},blocos));
  }
  /* 3. ações do dia, na ordem crítica → estratégica */
  if(D.acoes.length)app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:D.ritual==='fim'?'O que estava previsto':'Ações de hoje'}),el('p',{class:'suave mini',texto:'Cada ação diz por quê, o que acontece se não fizer e como medir. Abra para ver.'})].concat(D.acoes.map(function(a){return cartaoAcao(D,a)}))));
  /* 4. amanhã (tarde e fim) e ontem (manhã) */
  if(D.ritual!=='manha'&&D.cenario.exec.etapas.length)app.appendChild(cartaoAmanha(D));
  if(D.ritual==='manha'&&D.ontem.prod.length)app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Ontem ('+data(D.ciclo.ontem)+')'})].concat(D.ontem.prod.map(function(o){return el('p',{class:'mini',texto:(NOMES[o.k]||o.k)+': '+Math.round(o.feito)+' de '+Math.round(o.meta)+(o.feito>=o.meta?' · cumprido':' · faltaram '+inteiro(o.meta-o.feito))})}))));
  /* 5. registrar o momento */
  app.appendChild(cartaoFoto(D,fotos));
  /* 6. memória e situação do ciclo: só quando pedido */
  if(D.memoria.length)app.appendChild(el('details',{},[el('summary',{texto:'Plano × executado (últimos dias)'}),tabelaMemoria(D.memoria)]));
  app.appendChild(el('details',{},[el('summary',{texto:'Como está o ciclo de '+D.pessoa.nome})].concat(situacaoCiclo(D))));
  app.appendChild(el('details',{},[el('summary',{texto:'Ajustes do administrador'})].concat(ajustesAdmin(D))));
  var semFonte=Object.keys(D.fontes).filter(function(k){return D.fontes[k]===false});
  if(semFonte.length)app.appendChild(el('p',{class:'suave mini',texto:'Sem fonte na V2 (não entram no plano, não contam como zero): '+semFonte.join(', ')+'. Regras '+D.versaoRegras+'.'}));
}
function itemCompromisso(D,s){
  var marca=el('span',{class:'marca '+(s.ok?'feita':''),texto:s.ok?'✓':'○','aria-hidden':'true'});
  var txt=el('span',{},[el('span',{texto:s.t}),s.s?el('span',{class:'suave mini',texto:' · '+s.s}):null,s.marcado?el('span',{class:'suave mini',texto:' · marcado'+(s.marcado.por?' por '+s.marcado.por:'')+' às '+hora(s.marcado.em)}):null]);
  var btn=null;
  if(!s.ok)btn=el('button',{type:'button',class:'mini',texto:'Marcar feito',onclick:function(){notaDia(D,{chave:s.k,feito:true},'Marcado como feito.')}});
  else if(s.marcado)btn=el('button',{type:'button',class:'mini',texto:'Desmarcar',onclick:function(){notaDia(D,{chave:s.k,feito:false},'Desmarcado.')}});
  return el('li',{class:'compromisso'},[marca,txt,btn]);
}
async function notaDia(D,corpo,msgOk){
  corpo.pessoa=D.pessoa.id;corpo.data=D.data;
  try{await api(diaBase()+'/dia/nota',corpo);telaDia(msgOk,true)}catch(e){telaDia(e.message)}
}
function linhaProducao(D,x){
  var esp=D.esperadoAgora.filter(function(e){return e.k===x.k})[0];
  var cab=x.falta>0?'faltam '+inteiro(x.falta):'cumprido';
  var sub='alvo de hoje '+Math.round(x.alvo)+(x.recup>0?' = '+Math.round(x.metaHoje)+' do plano + '+Math.round(x.recup)+' de recuperação':'')+' · feito '+Math.round(x.feito);
  if(x.adiantado>0)sub+=' · '+Math.round(x.adiantado)+' à frente do plano';
  var topo=[el('span',{class:'valor',texto:cab}),el('span',{class:'suave',texto:' '+(NOMES[x.k]||x.nome).toLowerCase()})];
  if(esp&&esp.status&&D.ritual!=='manha')topo.push(' ',el('span',{class:'chip '+(esp.status==='em_dia'?'no_ritmo':esp.status),texto:ESP_N[esp.status]+' no ciclo'}));
  var det=el('details',{class:'mini'},[el('summary',{texto:'Ciclo: '+Math.round(x.feitoCiclo)+' de '+Math.round(x.metaTotal)+(x.atrasoTotal>0?' · atraso de '+Math.round(x.atrasoTotal)+' (recupera em até '+x.janela+' dias úteis)':'')}),
    el('p',{class:'suave',texto:'Meta do dia inteira: a meta do ciclo distribuída nos '+D.ciclo.uteisPessoa.length+' dias úteis de '+D.pessoa.nome+'. O atraso até ontem é dividido em parcelas iguais nos próximos '+x.janela+' dias úteis, por isso o alvo de hoje muda conforme o que foi feito.'}),
    esp?el('p',{class:'suave',texto:'Esperado até agora no ciclo: '+numero(esp.esperado)+' · feito '+Math.round(esp.feito)+' (o dia de hoje conta '+(D.fracaoHoje*100)+'%).'}):null,
    el('p',{class:'suave',texto:'Amanhã: '+Math.round(x.metaAmanha)+' do plano'+(x.metaRestante?' · restam '+Math.round(x.metaRestante)+' até o fim do ciclo':'')})]);
  return el('div',{class:'prod'},[el('p',{},topo),barra(x.feito,x.alvo),el('p',{class:'suave mini',texto:sub}),det]);
}
function linhaSemana(x){
  var w=x.sem;
  if(!w||!(w.alvo>0))return el('p',{class:'mini suave',texto:(NOMES[x.k]||x.nome)+': '+Math.round(x.feitoCiclo)+' no ciclo'+(x.metaTotal?' de '+Math.round(x.metaTotal):'')});
  var cab=w.falta>0?'faltam '+inteiro(w.falta)+' na semana':'semana cumprida';
  return el('div',{class:'prod'},[el('p',{},[el('span',{class:'valor',texto:cab}),el('span',{class:'suave',texto:' '+(NOMES[x.k]||x.nome).toLowerCase()})]),barra(w.feito,w.alvo),
    el('p',{class:'suave mini',texto:'objetivo da semana '+Math.round(w.alvo)+(w.recup>0?' ('+Math.round(w.meta)+' do plano + '+Math.round(w.recup)+' de recuperação)':'')+' · feito '+Math.round(w.feito)+' · '+w.restantes+' dia(s) útil(eis) restante(s)'+(w.ritmo!=null&&w.falta>0?' · ritmo ≈ '+numero(w.ritmo)+' por dia':'')})]);
}
function cartaoAcao(D,a){
  var j=a.justificativa;
  var cab=el('p',{class:'acao-t'},[el('span',{class:'chip '+a.classe,texto:CLASSE_N[a.classe]||a.classe}),' ',el('strong',{texto:a.tit}),a.qtd?el('span',{class:'suave mini',texto:' · '+a.qtd}):null]);
  var corpo=[el('p',{},[el('strong',{texto:'Por quê. '}),a.porque]),el('p',{},[el('strong',{texto:'O que ganha. '}),a.ben.t,' ',fonteEvid(a.ben)]),el('p',{},[el('strong',{texto:'Se não fizer. '}),a.nao]),
    el('p',{class:'suave mini',texto:'Medir: '+a.medir+' · Prazo: '+a.prazo+(a.conf?' · Confiança: '+a.conf:'')})];
  if(a.origem&&a.origem.length)corpo.push(el('p',{class:'suave mini',texto:'Negócios: '+a.origem.map(function(o){return o.txt}).join(', ')}));
  var rodape;
  if(j)rodape=el('p',{class:'mini just',texto:'Não será feito hoje: '+j.motivo+(j.terceiro?' (motivo de terceiros)':'')+(j.por?' · '+j.por:'')+' · '+hora(j.em)});
  else if(D.ritual!=='fim')rodape=formJustificar(D,a);
  return el('div',{class:'acao '+(j?'justificada':'')},[cab,el('details',{class:'mini'},[el('summary',{texto:'Por quê, o que ganha e se não fizer'})].concat(corpo)),rodape]);
}
function formJustificar(D,a){
  var caixa=el('div',{});
  var abrir=el('button',{type:'button',class:'mini',texto:'Não vou fazer hoje',onclick:function(){
    var txt=el('textarea',{rows:'2',maxlength:'1000','aria-label':'Motivo',placeholder:'Por quê? (fica registrado)'});
    var ter=el('input',{type:'checkbox',id:'t'+a.chave.replace(/[^a-z0-9]/gi,'')});
    var f=el('form',{class:'mini',onsubmit:async function(e){e.preventDefault();await notaDia(D,{chave:a.chave,motivo:txt.value,terceiro:ter.checked},'Justificativa registrada.')}},
      [txt,el('p',{class:'barra'},[el('label',{for:ter.id,class:'inline'},[ter,' motivo de terceiros (cliente, sistema)']),el('button',{type:'submit',class:'mini primario',texto:'Registrar'}),el('button',{type:'button',class:'mini',texto:'Cancelar',onclick:function(){caixa.replaceChildren(abrir)}})])]);
    caixa.replaceChildren(f);txt.focus()}});
  caixa.appendChild(abrir);return caixa;
}
function cartaoAmanha(D){
  var ex=D.cenario.exec,na=D.cenario.nao;
  var linhas=ex.etapas.map(function(e,i){var n=na.etapas[i];var t=(NOMES[e.k]||e.nome)+': '+Math.round(e.amanha)+(e.adicional>0?' ('+Math.round(e.planejado)+' + '+Math.round(e.adicional)+' de recuperação)':'');
    if(n&&n.amanha>e.amanha)t+=' · se não cumprir hoje, vira '+Math.round(n.amanha);return el('p',{class:'mini',texto:t})});
  var aviso=na.sobrecarga?el('p',{class:'erro mini',texto:'Se não cumprir hoje, o alvo de amanhã passa da capacidade de '+D.cap.v+' por dia.'}):null;
  return el('div',{class:'cartao'},[el('h2',{texto:'Amanhã'+(D.ciclo.amanha?' ('+data(D.ciclo.amanha)+')':'')})].concat(linhas,[aviso]));
}
function cartaoFoto(D,fotos){
  var feitas=fotos.map(function(f){return el('span',{class:'chip no_ritmo',texto:RIT_N[f.ritual]+' '+hora(f.criado_em)})});
  var ja=fotos.some(function(f){return f.ritual===D.ritual});
  var btn=el('button',{type:'button',class:'primario',texto:ja?RIT_N[D.ritual]+' já registrada':'Registrar '+RIT_N[D.ritual].toLowerCase(),onclick:async function(){
    try{var r=await api(diaBase()+'/dia/foto',{pessoa:D.pessoa.id,data:D.data,ritual:D.ritual});telaDia(r.gravada?'Registrado. Assinatura '+r.assinatura.slice(0,12)+'…':'Este momento já estava registrado.',true)}catch(e){telaDia(e.message)}}});
  if(ja)btn.disabled=true;
  return el('div',{class:'cartao'},[el('h2',{texto:'Registrar este momento'}),el('p',{class:'suave mini',texto:'Guarda uma foto imutável do plano (alvos, ações, compromissos) neste ritual. A memória plano × executado nasce daqui.'}),el('p',{class:'barra'},[btn].concat(feitas))]);
}
function tabelaMemoria(M){
  return el('table',{},[el('thead',{},[el('tr',{},[el('th',{texto:'Dia'}),el('th',{texto:'Alvo'}),el('th',{texto:'Feito'}),el('th',{texto:'%'}),el('th',{texto:'Just.'})])]),
    el('tbody',{},M.slice().reverse().map(function(m){return el('tr',{},[el('td',{texto:data(m.data)}),el('td',{texto:String(m.alvo)}),el('td',{texto:m.feito==null?'—':String(m.feito)}),el('td',{texto:pct(m.pct)}),el('td',{texto:String(m.justificativas)})])}))]);
}
function situacaoCiclo(D){
  var out=[el('p',{},[el('span',{class:'chip '+(QUAD_C[D.quad.tipo]||'sem'),texto:QUAD_N[D.quad.tipo]||D.quad.tipo}),' ',D.quad.txt])];
  if(D.viab)out.push(el('p',{class:'mini',texto:D.viab.txt}));
  out.push(el('p',{class:'mini suave',texto:'Capacidade: '+(D.cap.v?D.cap.v+' toques por dia ('+D.cap.fonte+(D.cap.obs.v?'; observada '+D.cap.obs.v+' em '+D.cap.obs.n+' dias':'')+')':'não informada')+(D.ticket.v?' · ticket '+reais(D.ticket.v)+' ('+D.ticket.fonte+')':'')}));
  if(D.tx.length)out.push(el('table',{},[el('thead',{},[el('tr',{},[el('th',{texto:'Taxa'}),el('th',{texto:'Real'}),el('th',{texto:'Plano'}),el('th',{texto:'Hist.'}),el('th',{texto:'Equipe'})])]),
    el('tbody',{},D.tx.map(function(t){return el('tr',{},[el('td',{texto:t.nome}),el('td',{texto:t.real==null?'—':pct(t.real)+' ('+t.k+'/'+t.n+')'}),el('td',{texto:pct(t.plano)}),el('td',{texto:pct(t.hist)}),el('td',{texto:pct(t.equipe)})])}))]));
  if(D.garg.length){var g=D.garg[0];out.push(el('p',{class:'mini'},[el('strong',{texto:'Gargalo: '+g.nome+'. '}),g.evid+' Confiança '+g.conf+'.'+(g.prob?' '+g.prob:'')]))}
  if(D.padrao.n>=5)out.push(el('p',{class:'mini suave',texto:'Padrão: '+(NOMES[D.padrao.k]||D.padrao.k).toLowerCase()+' abaixo da meta em '+D.padrao.abaixo+' de '+D.padrao.n+' dias úteis'+(D.padrao.recorrente?' — recorrente':'')+(D.padrao.seguidos?' · '+D.padrao.seguidos+' seguidos':'')+'.'}));
  if(D.cards.length)out.push(el('details',{class:'mini'},[el('summary',{texto:D.cards.length+' negócio(s) em alerta · exposição '+reais(D.exposicao)})].concat(D.cards.map(function(c){return el('p',{},[el('span',{class:'chip '+c.classe,texto:CLASSE_N[c.classe]}),' '+c.nome+' · '+c.etapa+(c.valor?' · '+reais(c.valor):'')+' · '+c.motivos.join('; ')])}))));
  return out;
}
function ajustesAdmin(D){
  var base=diaBase(),ind=el('select',{'aria-label':'Indicador'},D.prod.filter(function(x){return x.metaTotal>0||x.diario}).map(function(x){return el('option',{value:x.k,texto:NOMES[x.k]||x.nome})}).concat(D.prod.length?[]:Object.keys(NOMES).filter(function(k){return k!=='receita'}).map(function(k){return el('option',{value:k,texto:NOMES[k]})})));
  var qt=el('input',{type:'number',step:'1','aria-label':'Quantidade (negativa desconta)',placeholder:'+5 ou -2',required:'required'});
  var mo=el('input',{type:'text',maxlength:'500','aria-label':'Motivo',placeholder:'Motivo (obrigatório)',required:'required',class:'largo'});
  var fl=el('form',{class:'linha',onsubmit:async function(e){e.preventDefault();try{await api(base+'/dia/lancamentos',{pessoa:D.pessoa.id,data:D.data,indicador:ind.value,delta:Number(qt.value),motivo:mo.value});telaDia('Lançamento registrado.',true)}catch(x){telaDia(x.message)}}},
    [el('p',{},[el('label',{texto:'Acrescentar ao realizado de '+data(D.data)}),ind]),el('p',{},[el('label',{texto:'Quantidade'}),qt]),el('p',{style:'flex:1 1 200px'},[el('label',{texto:'Motivo'}),mo]),el('button',{type:'submit',class:'primario',texto:'Lançar'})]);
  var lista=el('div',{class:'mini'});
  api(base+'/dia/lancamentos?pessoa='+D.pessoa.id+'&de='+D.ciclo.inicio+'&ate='+D.data).then(function(L){L.forEach(function(l){
    lista.appendChild(el('p',{class:l.desfeito?'suave':''},[data(l.data)+' · '+(NOMES[l.indicador]||l.indicador)+' '+(l.delta>0?'+':'')+numero(Number(l.delta))+' · '+l.motivo+(l.por?' · '+l.por:''),
      (l.desfeito||l.desfazId)?el('span',{class:'suave',texto:l.desfeito?' · desfeito':''}):el('button',{type:'button',class:'mini',texto:'Desfazer',onclick:async function(){try{await api(base+'/dia/lancamentos/'+l.id+'/desfazer',{});telaDia('Lançamento desfeito.',true)}catch(x){telaDia(x.message)}}})]))})}).catch(function(){});
  var cap=el('input',{type:'number',min:'1',step:'1','aria-label':'Capacidade por dia',value:D.cap.fonte==='apontada'?String(D.cap.v):'',placeholder:D.cap.obs.v?'observada: '+D.cap.obs.v:'toques por dia'});
  var fc=el('form',{class:'linha',onsubmit:async function(e){e.preventDefault();try{await api(base+'/pessoas/'+D.pessoa.id+'/capacidade',{capacidade:cap.value===''?null:Number(cap.value)});telaDia('Capacidade atualizada.',true)}catch(x){telaDia(x.message)}}},
    [el('p',{},[el('label',{texto:'Capacidade de '+D.pessoa.nome+' (toques por dia; vazio = usar a observada)'}),cap]),el('button',{type:'submit',texto:'Guardar'})]);
  var fa=el('button',{type:'button',texto:D.ciclo.trabalhaHoje?'Marcar ausência em '+data(D.data):'Remover ausência de '+data(D.data),onclick:async function(){
    try{await api(base+'/ausencias',{pessoa:D.pessoa.id,data:D.data,motivo:D.ciclo.trabalhaHoje?'ausência':null,remover:!D.ciclo.trabalhaHoje});telaDia('Calendário de '+D.pessoa.nome+' atualizado.',true)}catch(x){telaDia(x.message)}}});
  return [el('p',{class:'suave mini',texto:'Tudo aqui só acrescenta e fica registrado: lançamentos têm motivo e podem ser desfeitos por um lançamento contrário.'}),fl,lista,fc,el('p',{},[fa])];
}
/* ---------- a equipe: quem precisa de mim hoje? ---------- */
async function telaDiaEquipe(time,msg,ok){
  var E;
  try{E=await api(diaBase()+'/dia/equipe'+diaQs())}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui montar a equipe: '+e.message}));return}
  estado.data=estado.data||E.data;
  cabecalho(E.ritual==='fim'?'Como foi o dia da equipe?':'Quem precisa de mim hoje?',data(E.data)+' · '+RIT_N[E.ritual]+' · '+E.pessoas+' pessoa(s) · ciclo de '+data(E.ciclo.inicio)).forEach(function(n){if(n)app.appendChild(n)});
  seletoresDia(time,'equipe').forEach(function(n){app.appendChild(n)});
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var ver=function(id){return function(){estado.pessoaDia=id;telaDia()}};
  if(E.intervencoes.length)app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:E.intervencoes.length+' intervenç'+(E.intervencoes.length===1?'ão':'ões')})].concat(E.intervencoes.map(function(i){
    return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('span',{class:'chip '+(i.g>=4?'critica':i.g===3?'alta':'normal'),texto:GRAU_N[i.g]||''}),' ',el('strong',{texto:i.t})]),
      el('details',{class:'mini'},[el('summary',{texto:'Por quê e como medir'}),el('p',{texto:i.por}),i.med?el('p',{class:'suave',texto:'Medir: '+i.med}):null,i.imp?el('p',{class:'suave',texto:i.imp}):null]),
      el('button',{type:'button',class:'mini',texto:'Ver o plano de '+i.pessoa,onclick:ver(i.pessoaId)})])}))));
  else app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:'Ninguém precisa de intervenção agora'}),el('p',{class:'suave',texto:'Nenhum atraso fora da capacidade, lead parado ou proposta sem resposta no time.'})]));
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Cada pessoa'})].concat(E.quadro.map(function(q){
    var falta=q.faltaHoje.map(function(f){return inteiro(f.n)+' '+(NOMES[f.k]||f.k).toLowerCase()}).join(', ');
    var sub=(falta?'faltam hoje: '+falta:'produção de hoje cumprida')+(q.leadsNovos?' · '+q.leadsNovos+' lead(s) sem contato':'')+(q.criticos?' · '+q.criticos+' crítico(s)':'')+(q.viab==='inviavel'?' · recuperação não cabe':'');
    return el('button',{type:'button',class:'pessoa',onclick:ver(q.pessoaId)},[el('span',{},[el('strong',{texto:q.pessoa}),el('span',{class:'suave mini',texto:q.funcao?' · '+q.funcao:''}),el('br'),el('span',{class:'suave mini',texto:sub})]),
      el('span',{class:'chip '+(QUAD_C[q.situacao.tipo]||'sem'),texto:QUAD_N[q.situacao.tipo]||''})])}))));
  if(E.decisoes.length)app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Decisões do gestor'})].concat(E.decisoes.map(function(d){return el('p',{texto:d.t})}))));
  if(E.sistemico.length)app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Gargalo da equipe (não é de uma pessoa)'})].concat(E.sistemico.map(function(s){return el('p',{texto:s.nome+': '+s.pessoas.join(', ')})}))));
  if(E.oportunidades.length)app.appendChild(el('details',{},[el('summary',{texto:E.oportunidades.length+' negócio(s) em alerta · exposição '+reais(E.exposicao)})].concat(E.oportunidades.map(function(c){return el('p',{class:'mini'},[el('span',{class:'chip '+c.classe,texto:CLASSE_N[c.classe]}),' '+c.nome+' ('+c.pessoa+') · '+c.etapa+(c.valor?' · '+reais(c.valor):'')+' · '+c.acao])}))));
  if(E.semDono)app.appendChild(el('p',{class:'erro mini',texto:E.semDono+' lead(s) do ciclo sem dono: não entram no plano de ninguém.'}));
  app.appendChild(el('p',{class:'suave mini',texto:'Sem fonte na V2: tarefas, agenda e cadência. Regras '+E.versaoRegras+'.'}));
}
`;
