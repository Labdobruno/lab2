/* Onda 5 na tela: o construtor "E se…?" (uma pergunta em português, uma condição por vez) e o Studio (o modelo da operação em blocos e conexões,
   simulação direta e reversa, cenários, publicação com validade, monitor planejado × realizado e prontidão da campanha).
   JavaScript inserido na PAGINA (sem crases nem "${"). Usa o que a página já tem: el, api, limpar, abas, controles, cabecalho, data, estado, telaEntrada, brlT, n1, lk, campo, inp, sel, num0, qTabela, qSecao, numero, pct1. */
export const TELA_CONSTRUTOR = `
var CS_RES=[['R','a receita'],['V','as vendas'],['margem','a margem de contribuição'],['mm','a margem após marketing'],['ro','o resultado operacional'],['pe','as vendas para empatar'],['caixa','o caixa no mês da venda'],['cac','o CAC'],['roas','o ROAS'],['tpm','o ticket que preserva a margem'],['vnec','as vendas para manter a margem']];
var CS_OPS=[['maior','fosse maior em'],['menor','fosse menor em'],['chegasse','chegasse a'],['igual','fosse igual']];
var CS_REFS=[['anterior','ao período anterior'],['mediana','à mediana dos pares'],['p75','ao quartil superior dos pares'],['media','à média dos pares'],['melhor','ao melhor par'],['pior','ao pior par']];
var TIPO_NO_N={entrada:'Entrada',etapa:'Etapa',decisao:'Decisão',acao:'Ação',compromisso:'Compromisso',resultado:'Resultado',perda:'Perda',pos:'Pós-venda'};
var FONTE_N={historico:'histórico',premissa:'premissa',benchmark:'benchmark',estimativa:'estimativa',hipotese:'hipótese'};
var EST_MON={dentro:'dentro',atencao:'atenção',fora:'fora',bloqueado:'bloqueado',insuficiente:'sem dado'};
var EST_MON_C={dentro:'no_ritmo',atencao:'atencao',fora:'critica',bloqueado:'alta',insuficiente:'sem'};
var PAPEIS_ETAPA=['lead','contato','qualificado','agendada','realizada','oportunidade','proposta','negociacao','ganho','perdido'];
function csBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)+'/construtor'}
function stBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)+'/studio'}
function qsData(){return estado.data?'?data='+encodeURIComponent(estado.data):''}
function limparNo(n){while(n.firstChild)n.removeChild(n.firstChild)}
function optgrupos(cat,valor){var s=el('select',{'aria-label':'Indicador'});var areas=[];cat.forEach(function(x){if(areas.indexOf(x.area)<0)areas.push(x.area)});areas.forEach(function(a){var g=el('optgroup',{label:a});cat.filter(function(x){return x.area===a}).forEach(function(x){var o=el('option',{value:x.k,texto:x.t});if(x.k===valor)o.setAttribute('selected','');g.appendChild(o)});s.appendChild(g)});return s}
function csFmt(k,v,R){if(v==null||!isFinite(v))return '—';var I=(R.catalogo||[]).filter(function(x){return x.k===k})[0];var tipo=I?I.tipo:(k==='V'||k==='pe'||k==='vnec'||k==='L'?'volume':k==='roas'?'mult':'valor');if(tipo==='taxa')return pct1(v);if(tipo==='volume')return n1(v);if(tipo==='mult')return (Math.round(v*100)/100).toLocaleString('pt-BR')+'×';return brlT(v)}
/* ---------- E se…? ---------- */
async function telaConstrutor(msg,ok){
  limpar();
  if(!estado.csCls)estado.csCls=[];
  var R,S,PG;
  try{
    R=await api(csBase()+qsData(),{sujeito:estado.csSuj||'equipe',de:estado.csDe,ate:estado.csAte,clausulas:estado.csCls,res:estado.csRes||'R',tempo:estado.csTempo||'passado',meta:estado.csMeta});
    S=await api(csBase()+'/sujeitos?de='+R.periodo.de+'&ate='+R.periodo.ate);PG=await api(csBase()+'/perguntas');
  }catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(abas());app.appendChild(el('p',{class:'erro',texto:'Não consegui montar a pergunta: '+e.message}));if(/condição|operador|sujeito/.test(e.message)){estado.csCls=[];estado.csSuj='equipe';app.appendChild(el('p',{},[lk('Recomeçar',function(){telaConstrutor()})]))}app.appendChild(controles());return}
  var res=R.res;
  app.appendChild(abas());
  cabecalho('E se…?','O que acontece com o resultado se uma coisa mudar, tudo o mais constante. '+R.sujeito.nome+' · '+data(R.periodo.de)+' a '+data(R.periodo.ate)+' · '+R.M.n+' leads na amostra').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  /* quem e quando */
  var sSuj=sel(S.map(function(s){return [s.id,s.t.charAt(0).toUpperCase()+s.t.slice(1)]}),R.sujeito.id,{'aria-label':'Sujeito'});
  var dDe=inp({type:'date','aria-label':'De',value:R.periodo.de}),dAte=inp({type:'date','aria-label':'Até',value:R.periodo.ate});
  var sRes=sel(CS_RES.filter(function(r){var k=r[0];if((k==='ro'||k==='pe')&&R.M.fixos==null)return false;if((k==='cac'||k==='roas'||k==='mm')&&!R.M.mk)return false;return true}),res,{'aria-label':'Resultado'});
  var sTempo=sel([['passado','já aconteceu (se fosse… qual seria)'],['futuro','vai acontecer (se for… qual será)']],estado.csTempo||'passado',{'aria-label':'Tempo'});
  app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Quem, quando e o que medir: '+R.sujeito.nome+' · '+data(R.periodo.de)+' a '+data(R.periodo.ate)+' · '+(CS_RES.filter(function(r){return r[0]===res})[0]||['',res])[1]}),
    campo('De quem é a conta',sSuj),campo('De',dDe),campo('Até',dAte),campo('Qual resultado olhar',sRes),campo('A pergunta é sobre o que',sTempo),
    el('p',{},[el('button',{type:'button',class:'primario',texto:'Aplicar',onclick:function(){estado.csSuj=sSuj.value;estado.csDe=dDe.value||null;estado.csAte=dAte.value||null;estado.csRes=sRes.value;estado.csTempo=sTempo.value;estado.csMeta=null;telaConstrutor()}})])]));
  /* a pergunta */
  var cat=R.catalogo,linhas=estado.csCls.map(function(cl,i){return csLinha(cl,i,R,S)});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Se…'}),el('p',{class:'suave mini',texto:'Uma condição por linha. Cada uma muda só o que diz; o resto fica como está hoje. "Mantendo" diz o que fica constante quando o indicador puxa outros.'})].concat(linhas).concat([
    el('div',{class:'barra'},[el('button',{type:'button',texto:estado.csCls.length?'+ E':'Escolher o que mudar',onclick:function(){estado.csCls.push({ind:'ticket',op:'maior',num:10,un:'%'});telaConstrutor()}}),
      estado.csCls.length?el('button',{type:'button',class:'primario',texto:'Calcular',onclick:function(){telaConstrutor()}}):null,
      estado.csCls.length?el('button',{type:'button',class:'mini',texto:'Limpar',onclick:function(){estado.csCls=[];estado.csMeta=null;telaConstrutor()}}):null])])));
  /* o resultado */
  if(estado.csCls.length){
    var a=R.S[res],b=R.M[res],card=[el('p',{class:'grande',texto:R.frase})];
    if(R.erros.length)R.erros.forEach(function(e){card.push(el('p',{class:'erro',texto:e}))});
    else{
      var df=a!=null&&b!=null?a-b:null,I=CS_RES.filter(function(r){return r[0]===res})[0];
      card.push(el('p',{class:'grande',texto:csFmt(res,b,R)+' → '+csFmt(res,a,R)}));
      card.push(el('p',{class:'suave',texto:(I?I[1].charAt(0).toUpperCase()+I[1].slice(1):res)+' hoje × simulado'+(df!=null&&Math.abs(df)>1e-9?' · diferença '+(df>0?'+':'−')+csFmt(res,Math.abs(df),R)+(b?' ('+(df>0?'+':'')+(Math.round(df/b*1000)/10).toLocaleString('pt-BR')+'%)':''):' · sem diferença')}));
    }
    R.alertas.forEach(function(x){card.push(el('p',{class:'mini '+(/Capacidade|Amostra/.test(x)?'erro':'suave'),texto:x}))});
    app.appendChild(el('div',{class:'cartao'},card));
    if(!R.erros.length){
      /* como chegou */
      app.appendChild(el('details',{},[el('summary',{texto:'Como o LAB chegou aqui'})].concat(R.linhas.map(function(l,i){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:(i+1)+'ª '+l.I.t+': '+csFmt(l.cl.ind,l.antes,R)+' → '+csFmt(l.cl.ind,l.alvo.v,R)+(l.alvo.rot?' ('+l.alvo.rot+(l.alvo.n!=null?', n '+l.alvo.n:'')+')':'')})])].concat(l.passos.map(function(p){return el('p',{class:'suave mini',texto:p})})))})).concat([
        el('h3',{texto:'Ordem das contas'}),el('p',{class:'mini',texto:R.ordem.join(' → ')}),
        el('h3',{texto:'Premissas (tudo o que ficou constante)'}),qTabela(['Premissa','Valor de hoje'],R.premissasL),
        Object.keys(R.fontes).length?el('p',{class:'suave mini',texto:'Fontes: '+Object.keys(R.fontes).map(function(k){return k+' = '+R.fontes[k]}).join(' · ')}):null])));
      /* antes × depois */
      var ks=Object.keys(R.formatos).filter(function(k){return R.formatos[k][0]!=='—'||R.formatos[k][1]!=='—'});
      app.appendChild(el('details',{},[el('summary',{texto:'Antes × depois, linha a linha'}),qTabela(['Indicador','Hoje','Simulado'],ks.map(function(k){var I=cat.filter(function(x){return x.k===k})[0]||CS_RES.filter(function(r){return r[0]===k})[0];return [I?(I.t||I[1]):k,R.formatos[k][0],R.formatos[k][1]]}))]));
      /* sensibilidade */
      if(R.sensibilidade&&R.sensibilidade.pontos.length)app.appendChild(el('details',{},[el('summary',{texto:'Sensibilidade: '+R.sensibilidade.indicador.t+' de −30% a +30%'}),el('p',{class:'suave mini',texto:'Cada linha muda só este indicador (a partir de hoje); o resto fica igual.'}),
        qTabela(['Variação',R.sensibilidade.indicador.t,CS_RES.filter(function(r){return r[0]===res})[0][1]],R.sensibilidade.pontos.map(function(p){return [p.p===0?'hoje':(p.p>0?'+':'−')+Math.round(Math.abs(p.p)*100)+'%',csFmt(R.sensibilidade.ind,p.v,R),csFmt(res,p.r,R)]}))]));
      /* quanto precisa */
      var mi=optgrupos(cat.filter(function(x){return !x.grupo}),estado.csMeta?estado.csMeta.ind:'ticket'),ma=inp({type:'text',inputmode:'decimal','aria-label':'Alvo do resultado',value:estado.csMeta?String(estado.csMeta.alvo):'',placeholder:csFmt(res,a,R)});
      var qp=[el('summary',{texto:'Quanto precisa?'}),el('p',{class:'suave mini',texto:'Para '+CS_RES.filter(function(r){return r[0]===res})[0][1]+' chegar a um valor, quanto um indicador precisaria ser, partindo do cenário acima e mantendo o resto.'}),campo('Para o resultado chegar a',ma),campo('quanto precisaria ser',mi),
        el('p',{},[el('button',{type:'button',texto:'Procurar',onclick:function(){estado.csMeta={ind:mi.value,alvo:ma.value.replace(',','.')};telaConstrutor()}})])];
      if(R.meta){var Mt=R.meta;qp.push(Mt.erro==='inalcançável'?el('p',{class:'erro',texto:'Só com '+Mt.indicador.t+' não chega: mesmo em '+csFmt(Mt.ind,Mt.limite,R)+' o resultado fica em '+csFmt(res,Mt.valLim,R)+'. Combine com outra alavanca (+ E).'}):Mt.erro?el('p',{class:'erro',texto:Mt.indicador.t+' não tem caminho até esse resultado.'}):el('p',{class:'ok',texto:Mt.indicador.t.charAt(0).toUpperCase()+Mt.indicador.t.slice(1)+' precisaria ser '+csFmt(Mt.ind,Mt.v,R)+' (hoje '+csFmt(Mt.ind,Mt.atual,R)+').'+(Mt.indicador.tipo==='taxa'&&Mt.v>0.999?' Na prática é o teto: combine com outra alavanca.':'')}))}
      app.appendChild(el('details',estado.csMeta?{open:''}:{},qp));
      /* nos pares */
      if(R.comparacao.length)app.appendChild(el('details',{},[el('summary',{texto:'A mesma pergunta em cada par'}),qTabela(['Quem','n','Hoje','Simulado'],R.comparacao.map(function(c){return [c.nome,String(c.n),csFmt(res,c.antes,R),csFmt(res,c.depois,R)]}))]));
      /* guardar e virar experimento */
      var nomeP=inp({'aria-label':'Nome da pergunta',placeholder:'ex.: fechamento +10 p.p.'}),fimX=inp({type:'date','aria-label':'Fim previsto do experimento'});
      app.appendChild(el('details',{},[el('summary',{texto:'Guardar a pergunta ou virar experimento'}),campo('Nome',nomeP),
        el('p',{},[el('button',{type:'button',texto:'Guardar pergunta',onclick:async function(){try{await api(csBase()+'/perguntas',{nome:nomeP.value,sujeito:R.sujeito.id,periodo:estado.csDe&&estado.csAte?{de:estado.csDe,ate:estado.csAte}:{ciclos:R.periodo.meses},clausulas:estado.csCls,res:res});telaConstrutor('Pergunta guardada.',true)}catch(e){telaConstrutor(e.message)}}})]),
        el('p',{class:'suave mini',texto:'Virar experimento: a 1ª condição vira a métrica acompanhada e o alvo; o LAB mede hoje (baseline) e, ao concluir, registra na memória.'}),campo('Fim previsto',fimX),
        el('p',{},[el('button',{type:'button',texto:'Virar experimento',onclick:async function(){try{var x=await api(csBase()+'/experimento'+qsData(),{titulo:nomeP.value||null,sujeito:R.sujeito.id,de:R.periodo.de,ate:R.periodo.ate,clausulas:estado.csCls,fimPrevisto:fimX.value||null});telaConstrutor('Experimento iniciado: '+x.experimento.titulo+' (métrica '+x.metrica+', alvo '+csFmt(estado.csCls[0].ind,x.alvo,R)+'). Acompanhe em Achados.',true)}catch(e){telaConstrutor(e.message)}}})])]));
    }
  } else {
    app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:csFmt(res,R.M[res],R)}),el('p',{class:'suave',texto:(CS_RES.filter(function(r){return r[0]===res})[0]||['',res])[1]+' hoje, medido no período. Escolha o que mudar para ver o impacto.'}),
      el('p',{class:'suave mini',texto:'Leads '+n1(R.M.L)+' · conversão lead → venda '+pct1(R.M.totalEf)+' · vendas '+n1(R.M.V)+' · ticket '+brlT(R.M.ticket)+(R.M.mPct!=null?' · margem '+pct1(R.M.mPctEf!=null?R.M.mPctEf:R.M.mPct)+(R.M.margemEstimada?' (estimada pela política)':''):' · sem margem')+(R.M.mk?' · investimento '+brlT(R.M.inv):'')})]));
    if(R.alertas.length)app.appendChild(el('div',{class:'cartao'},R.alertas.map(function(x){return el('p',{class:'suave mini',texto:x})})));
  }
  /* perguntas salvas */
  if(PG.length)app.appendChild(qSecao('Perguntas guardadas',PG.map(function(p){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:p.nome}),el('span',{class:'suave mini',texto:' · '+p.sujeito+' · '+(p.periodo.de?data(p.periodo.de)+' a '+data(p.periodo.ate):p.periodo.ciclos+' ciclo(s)')})]),
    el('p',{},[lk('Perguntar de novo',function(){estado.csCls=p.clausulas.map(function(c){return Object.assign({},c)});estado.csSuj=p.sujeito;estado.csRes=p.res;if(p.periodo.de){estado.csDe=p.periodo.de;estado.csAte=p.periodo.ate}estado.csMeta=null;telaConstrutor()}),' ',lk('Apagar',async function(){try{await api(csBase()+'/perguntas/'+p.id+'/apagar',{});telaConstrutor('Pergunta apagada.',true)}catch(e){telaConstrutor(e.message)}})])])})));
}
function csLinha(cl,i,R,S){
  var cat=R.catalogo.filter(function(x){return !x.grupo}),ind=optgrupos(cat,cl.ind);
  if(!cat.some(function(x){return x.k===cl.ind})){var ex=el('option',{value:cl.ind,texto:(R.linhas.filter(function(l){return l.cl===cl||l.cl.ind===cl.ind})[0]||{I:{t:cl.ind}}).I.t});ex.setAttribute('selected','');ind.appendChild(ex)}
  ind.addEventListener('change',function(){cl.ind=ind.value;cl.mant=null;telaConstrutor()});
  var op=sel(CS_OPS,cl.op,{'aria-label':'Operador'});op.addEventListener('change',function(){cl.op=op.value;telaConstrutor()});
  var partes=[el('span',{class:'suave',texto:(i?'e ':'')}),ind,op];
  if(cl.op==='igual'){
    var refs=CS_REFS.concat(S.filter(function(s){return s.id!=='equipe'&&s.id!==R.sujeito.id}).map(function(s){return [s.id,(s.tipo==='canal'?'ao canal ':'a ')+s.t.replace(/^o canal /,'')]}));
    var rf=sel(refs,cl.ref||'mediana',{'aria-label':'Referência'});if(!cl.ref)cl.ref='mediana';rf.addEventListener('change',function(){cl.ref=rf.value});partes.push(rf);
  } else {
    var I=cat.filter(function(x){return x.k===cl.ind})[0]||{tipo:'taxa'};
    var nu=inp({type:'text',inputmode:'decimal','aria-label':'Número',value:cl.num==null?'':String(cl.num).replace('.',','),style:'width:6em'});nu.addEventListener('change',function(){cl.num=nu.value===''?null:Number(nu.value.replace(',','.'))});partes.push(nu);
    if(cl.op==='chegasse')partes.push(el('span',{class:'suave',texto:I.tipo==='taxa'?'%':I.tipo==='valor'?'R$':''}));
    else{var uns=I.tipo==='taxa'?[['pp','p.p.'],['%','%']]:I.tipo==='valor'?[['%','%'],['rs','R$']]:[['%','%'],['q','unidades']];if(!uns.some(function(u){return u[0]===cl.un}))cl.un=uns[0][0];var un=sel(uns,cl.un,{'aria-label':'Unidade'});un.addEventListener('change',function(){cl.un=un.value});partes.push(un)}
  }
  var mo=R.mantendo[cl.ind];
  if(mo){if(!cl.mant)cl.mant=mo[0][0];var mt=sel(mo,cl.mant,{'aria-label':'Mantendo'});mt.addEventListener('change',function(){cl.mant=mt.value});partes.push(el('span',{class:'suave',texto:', mantendo'}));partes.push(mt)}
  partes.push(el('button',{type:'button',class:'mini',texto:'Tirar',onclick:function(){estado.csCls.splice(i,1);estado.csMeta=null;telaConstrutor()}}));
  return el('div',{class:'barra'},partes);
}
/* ---------- Studio: o modelo em blocos ---------- */
async function telaStudioM(msg,ok){
  limpar();
  var L,det=null,sim=null;
  try{
    L=await api(stBase()+'/modelos');
    if(estado.stmNome&&!estado.stmNovo){det=await api(stBase()+'/modelos/'+encodeURIComponent(estado.stmNome)+qsData());if(!estado.stmDoc)estado.stmDoc=det.doc}
    if(estado.stmDoc)sim=await api(stBase()+'/simular-modelo'+qsData(),{doc:estado.stmDoc,cenario:estado.stmCen||'base',alvo:estado.stmAlvo,meta:estado.stmMeta,medida:estado.stmMedida||'volume',comPipeline:true});
  }catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(abas());app.appendChild(el('p',{class:'erro',texto:'Não consegui montar o Studio: '+e.message}));app.appendChild(el('p',{},[lk('Fechar o modelo',function(){estado.stmNome=null;estado.stmDoc=null;estado.stmNovo=false;telaStudioM()})]));app.appendChild(controles());return}
  app.appendChild(abas());
  cabecalho('Studio','Como o resultado é gerado: blocos, conexões e taxas. Desenhe, simule, publique e compare com o realizado.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  if(!estado.stmDoc){
    app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Modelos'}),L.length?null:el('p',{class:'suave',texto:'Nenhum modelo ainda. Comece pelo histórico: o funil principal vira blocos com as taxas da coorte.'})].concat(L.map(function(m){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:m.nome}),el('span',{class:'suave mini',texto:' · v'+m.versao+' · '+m.status+' · '+m.blocos+' blocos, '+m.conexoes+' conexões'+(m.erros?' · '+m.erros+' erro(s)':'')+(m.publicacoes?' · '+m.publicacoes+' publicação(ões)'+(m.validadeAte?' até '+data(m.validadeAte):''):'')})]),el('p',{},[lk('Abrir',function(){estado.stmNome=m.nome;estado.stmDoc=null;estado.stmNovo=false;estado.stmVista='blocos';telaStudioM()})])])}))));
    var nn=inp({'aria-label':'Nome do modelo',placeholder:'ex.: Funil inbound 2027'});
    app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Novo modelo'}),campo('Nome',nn),el('div',{class:'barra'},[
      el('button',{type:'button',class:'primario',texto:'A partir do histórico',onclick:async function(){if(!nn.value.trim())return telaStudioM('Dê um nome ao modelo.');try{var o=await api(stBase()+'/modelo-observado'+qsData());estado.stmNome=nn.value.trim();estado.stmDoc=o.modelo;estado.stmNovo=true;estado.stmVista='blocos';telaStudioM('Modelo montado de '+o.coorte+' negócios criados de '+data(o.janela.de)+' a '+data(o.janela.ate)+'. Guarde para ficar.',true)}catch(e){telaStudioM(e.message)}}}),
      el('button',{type:'button',texto:'Em branco',onclick:function(){if(!nn.value.trim())return telaStudioM('Dê um nome ao modelo.');estado.stmNome=nn.value.trim();estado.stmDoc={nos:{entrada:{tipo:'entrada',nome:'Leads',un:'lead',vol:100,x:40,y:40},venda:{tipo:'resultado',nome:'Vendas',un:'contrato',x:270,y:40}},arestas:{a0:{de:'entrada',para:'venda',taxa:null}},cenarios:{},dir:'LR',diasPeriodo:30};estado.stmNovo=true;estado.stmVista='blocos';telaStudioM()}})])]));
    return;
  }
  var D=estado.stmDoc,P=sim.parametros,V=sim.validacao,erros=V.filter(function(x){return x.grav==='erro'});
  app.appendChild(el('div',{class:'cartao'},[el('p',{},[el('strong',{texto:estado.stmNome}),el('span',{class:'suave mini',texto:det?' · v'+det.versao+' · '+det.status+(det.vigente?' · publicação vigente nº '+det.vigente:''):' · ainda não guardado'}),' ',erros.length?el('span',{class:'chip critica',texto:erros.length+' erro(s)'}):el('span',{class:'chip no_ritmo',texto:'sem erros'}),' ',V.length-erros.length?el('span',{class:'chip atencao',texto:(V.length-erros.length)+' aviso(s)'}):null]),
    el('div',{class:'barra'},[el('button',{type:'button',class:'primario',texto:'Guardar',onclick:async function(){try{var r=await api(stBase()+'/modelos',{nome:estado.stmNome,doc:estado.stmDoc});estado.stmNovo=false;estado.stmDoc=null;telaStudioM('Modelo guardado (versão '+r.versao+').',true)}catch(e){telaStudioM(e.message)}}}),
      el('button',{type:'button',texto:'Preencher pelo histórico',onclick:async function(){try{var r=await api(stBase()+'/preencher'+qsData(),{doc:estado.stmDoc});estado.stmDoc=r.modelo;telaStudioM(r.mudou.length?r.mudou.length+' valor(es) preenchidos pela coorte de '+data(r.janela.de)+' a '+data(r.janela.ate)+'. Guarde para ficar.':'Nenhum bloco com vínculo às etapas: nada para preencher.',!!r.mudou.length)}catch(e){telaStudioM(e.message)}}}),
      el('button',{type:'button',class:'mini',texto:'Fechar',onclick:function(){estado.stmNome=null;estado.stmDoc=null;estado.stmNovo=false;telaStudioM()}})])]));
  var vistas=[['blocos','Blocos'],['conexoes','Conexões'],['simular','Simular'],['cenarios','Cenários'],['publicar','Publicar'],['monitor','Monitor'],['prontidao','Prontidão']];
  var vista=estado.stmVista||'blocos';
  app.appendChild(el('div',{class:'abas rituais',role:'group','aria-label':'Parte do modelo'},vistas.map(function(v){var b=el('button',{type:'button',texto:v[1],onclick:function(){estado.stmVista=v[0];telaStudioM()}});if(vista===v[0])b.setAttribute('aria-current','page');return b})));
  var F={blocos:stmBlocos,conexoes:stmConexoes,simular:stmSimular,cenarios:stmCenarios,publicar:stmPublicar,monitor:stmMonitor,prontidao:stmProntidao};
  await F[vista](D,P,V,sim,det);
}
function stmValid(V){return V.length?el('details',{open:''},[el('summary',{texto:V.length+' aviso(s) e erro(s) de validação'})].concat(V.map(function(x){return el('p',{class:'mini '+(x.grav==='erro'?'erro':'suave'),texto:(x.grav==='erro'?'Erro: ':x.grav==='aviso'?'Aviso: ':'')+x.msg})}))):el('p',{class:'ok mini',texto:'Modelo válido.'})}
function stmIdNovo(D,base){var k=base,i=2;while(D.nos[k]||D.arestas[k])k=base+i++;return k}
function stmBlocos(D,P,V){
  var ids=Object.keys(P.nos);
  app.appendChild(stmValid(V));
  app.appendChild(qSecao('Blocos',[qTabela(['Bloco','Tipo','Volume · limite · capacidade','Vínculo',''],ids.map(function(id){var n=P.nos[id];return [n.nome||id,TIPO_NO_N[n.tipo]||n.tipo,[n.vol!=null?'vol '+n1(n.vol):'',n.limite!=null?'limite '+n1(n.limite):'',n.cap&&n.cap.v!=null?'cap '+n1(n.cap.v):'',n.ticket!=null?'ticket '+brlT(n.ticket):'',n.margem!=null?'margem '+pct1(n.margem):'',n.prazo!=null?'prazo '+n.prazo+'d':''].filter(Boolean).join(' · ')||'—',n.bind&&n.bind.etapa?n.bind.etapa:'—',el('span',{},[lk('Editar',function(){estado.stmEd=id;telaStudioM()}),' ',lk('Tirar',function(){delete D.nos[id];Object.keys(D.arestas).forEach(function(a){if(D.arestas[a].de===id||D.arestas[a].para===id)delete D.arestas[a]});telaStudioM()})])]}))]));
  var ed=estado.stmEd&&D.nos[estado.stmEd]?estado.stmEd:null,n=ed?D.nos[ed]:{tipo:'etapa'};
  var f={nome:inp({'aria-label':'Nome do bloco',value:n.nome||''}),tipo:sel(Object.keys(TIPO_NO_N).map(function(k){return [k,TIPO_NO_N[k]]}),n.tipo,{'aria-label':'Tipo do bloco'}),un:inp({'aria-label':'Unidade',value:n.un||'',placeholder:'lead, reuniao, contrato, brl…'}),vol:inp({type:'number',step:'any','aria-label':'Volume de entrada no período',value:n.vol==null?'':String(n.vol)}),limite:inp({type:'number',step:'any','aria-label':'Limite da fonte',value:n.limite==null?'':String(n.limite)}),cap:inp({type:'number',step:'any','aria-label':'Capacidade no período',value:n.cap&&n.cap.v!=null?String(n.cap.v):''}),ticket:inp({type:'number',step:'any','aria-label':'Ticket (R$)',value:n.ticket==null?'':String(n.ticket)}),margem:inp({type:'number',step:'any','aria-label':'Margem (fração)',value:n.margem==null?'':String(n.margem)}),prazo:inp({type:'number',step:'1','aria-label':'Prazo na etapa (dias)',value:n.prazo==null?'':String(n.prazo)}),bind:sel([['','sem vínculo']].concat(PAPEIS_ETAPA.map(function(p){return [p,p]})),n.bind&&n.bind.etapa||'',{'aria-label':'Vínculo com a etapa'})};
  app.appendChild(el('details',{open:''},[el('summary',{texto:ed?'Editar bloco: '+(n.nome||ed):'Adicionar bloco'}),campo('Nome',f.nome),campo('Tipo',f.tipo),campo('Unidade',f.un),campo('Volume de entrada no período (só entradas)',f.vol),campo('Quanto a fonte entrega no máximo (só entradas)',f.limite),campo('Capacidade de processamento no período',f.cap),campo('Ticket por unidade (R$, só resultados)',f.ticket),campo('Margem (fração, ex.: 0,3)',f.margem),campo('Prazo esperado na etapa (dias)',f.prazo),campo('Vínculo com a etapa do funil (papel)',f.bind),
    el('div',{class:'barra'},[el('button',{type:'button',class:'primario',texto:ed?'Aplicar':'Adicionar',onclick:function(){var id=ed||stmIdNovo(D,(f.nome.value.trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'bloco').slice(0,30));var o=Object.assign({},D.nos[id]||{},{tipo:f.tipo.value,nome:f.nome.value.trim()||id,un:f.un.value.trim()||null,vol:num0(f.vol.value),limite:num0(f.limite.value),ticket:num0(f.ticket.value),margem:num0(f.margem.value),prazo:num0(f.prazo.value),cap:num0(f.cap.value)!=null?{v:num0(f.cap.value),por:'periodo'}:null,bind:f.bind.value?{tipo:f.bind.value==='lead'?'lead':f.bind.value==='ganho'?'ganho':f.bind.value==='perdido'?'perda':'etapa',etapa:f.bind.value}:null});if(!ed){var xs=Object.keys(D.nos).map(function(k){return D.nos[k].x||0});o.x=(xs.length?Math.max.apply(null,xs):0)+230;o.y=40}D.nos[id]=o;estado.stmEd=null;telaStudioM()}}),ed?el('button',{type:'button',class:'mini',texto:'Cancelar',onclick:function(){estado.stmEd=null;telaStudioM()}}):null])]));
}
function stmConexoes(D,P,V){
  var ids=Object.keys(P.nos),nm=function(id){return (P.nos[id]&&P.nos[id].nome)||id};
  app.appendChild(stmValid(V));
  app.appendChild(qSecao('Conexões',[el('p',{class:'suave mini',texto:'A taxa é a fração que passa de um bloco ao outro. A fonte diz de onde ela veio; n é a amostra. Retorno é um ciclo controlado (limite de voltas).'}),
    qTabela(['De → Para','Taxa','Fonte · n','Dias','Retorno','',''],Object.keys(P.arestas).map(function(a){var e=P.arestas[a];return [nm(e.de)+' → '+nm(e.para),e.taxa==null?'—':pct1(e.taxa),(FONTE_N[e.fonte]||e.fonte||'premissa')+(e.n!=null?' · n '+e.n:''),e.dias!=null?String(e.dias):'—',e.retorno?'sim ('+(e.maxVoltas||1)+' volta(s))':(e.exclusiva?'exclusiva':'—'),el('span',{},[lk('Editar',function(){estado.stmEdA=a;telaStudioM()})]),el('span',{},[lk('Tirar',function(){delete D.arestas[a];telaStudioM()})])]}))]));
  var ed=estado.stmEdA&&D.arestas[estado.stmEdA]?estado.stmEdA:null,e=ed?D.arestas[ed]:{};
  var f={de:sel(ids.map(function(i){return [i,nm(i)]}),e.de||ids[0],{'aria-label':'De'}),para:sel(ids.map(function(i){return [i,nm(i)]}),e.para||ids[ids.length-1],{'aria-label':'Para'}),taxa:inp({type:'text',inputmode:'decimal','aria-label':'Taxa (%)',value:e.taxa==null?'':String(Math.round(e.taxa*10000)/100).replace('.',',')}),fonte:sel(Object.keys(FONTE_N).map(function(k){return [k,FONTE_N[k]]}),e.fonte||'premissa',{'aria-label':'Fonte da taxa'}),n:inp({type:'number',step:'1','aria-label':'Amostra (n)',value:e.n==null?'':String(e.n)}),dias:inp({type:'number',step:'any','aria-label':'Dias da passagem',value:e.dias==null?'':String(e.dias)}),ret:el('input',{type:'checkbox','aria-label':'Conexão de retorno'}),mv:inp({type:'number',step:'1',min:'1',max:'10','aria-label':'Limite de voltas',value:e.maxVoltas==null?'':String(e.maxVoltas)}),exc:el('input',{type:'checkbox','aria-label':'Exclusiva'})};
  if(e.retorno)f.ret.checked=true;if(e.exclusiva)f.exc.checked=true;
  app.appendChild(el('details',{open:''},[el('summary',{texto:ed?'Editar conexão':'Adicionar conexão'}),campo('De',f.de),campo('Para',f.para),campo('Taxa (%)',f.taxa),campo('Fonte',f.fonte),campo('Amostra (n)',f.n),campo('Dias até a passagem (defasagem)',f.dias),el('label',{class:'inline'},[f.ret,' é retorno (volta para um bloco anterior)']),campo('Limite de voltas (1 a 10)',f.mv),el('label',{class:'inline'},[f.exc,' exclusiva (a taxa já conta só quem não passou pelo outro caminho)']),
    el('div',{class:'barra'},[el('button',{type:'button',class:'primario',texto:ed?'Aplicar':'Adicionar',onclick:function(){var t=f.taxa.value.trim()===''?null:Number(f.taxa.value.replace(',','.'))/100;var id=ed||stmIdNovo(D,'a');var o={de:f.de.value,para:f.para.value,taxa:t,fonte:f.fonte.value,n:num0(f.n.value),dias:num0(f.dias.value)};if(f.ret.checked){o.retorno=true;o.maxVoltas=num0(f.mv.value)||1}if(f.exc.checked)o.exclusiva=true;D.arestas[id]=o;estado.stmEdA=null;telaStudioM()}}),ed?el('button',{type:'button',class:'mini',texto:'Cancelar',onclick:function(){estado.stmEdA=null;telaStudioM()}}):null])]));
}
function stmSimular(D,P,V,sim){
  var nm=function(id){return (P.nos[id]&&P.nos[id].nome)||id},res=Object.keys(P.nos).filter(function(n){return P.nos[n].tipo==='resultado'});
  var cen=sel([['base','Base']].concat(Object.keys(D.cenarios||{}).map(function(k){return [k,D.cenarios[k].nome||k]})),sim.cenario,{'aria-label':'Cenário'});cen.addEventListener('change',function(){estado.stmCen=cen.value;telaStudioM()});
  app.appendChild(el('div',{class:'cartao'},[el('div',{class:'barra'},[el('label',{texto:'Cenário'}),cen]),sim.direto&&sim.direto.ok?null:el('p',{class:'erro',texto:'O modelo tem erros: corrija nos blocos e conexões para simular.'})]));
  if(!sim.direto||!sim.direto.ok)return;
  var d=sim.direto,alvo=sim.alvo,r=alvo&&d.resultado[alvo];
  app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:r?n1(r.vol)+' '+nm(alvo).toLowerCase():'sem bloco de resultado'}),r?el('p',{class:'suave',texto:'esperado no período com as taxas de hoje'+(r.contratado!=null?' · '+brlT(r.contratado)+' contratados':'')+(r.margem!=null?' · margem '+brlT(r.margem):'')+(r.fracPeriodo!=null&&r.fracPeriodo<0.999?' · defasagem média '+Math.round(r.lag)+' dias: só '+pct1(r.fracPeriodo)+' cai no período ('+n1(r.noPeriodo)+')':'')}):null,
    qTabela(['Bloco','Chega','Processa','Fila','Não avança'],Object.keys(P.nos).map(function(n){return [nm(n),n1(d.v[n]),n1(d.proc[n]),d.fila[n]>1e-9?n1(d.fila[n]):'—',d.perdaImpl[n]>1e-9?n1(d.perdaImpl[n]):'—']}))]));
  /* reverso */
  var al=sel(res.map(function(n){return [n,nm(n)]}),alvo,{'aria-label':'Bloco da meta'}),mt=inp({type:'text',inputmode:'decimal','aria-label':'Meta',value:estado.stmMeta==null?'':String(estado.stmMeta)}),md=sel([['volume','unidades'],['receita','R$']],estado.stmMedida||'volume',{'aria-label':'Medida'});
  var rv=[el('h2',{texto:'De trás para a frente: quanto precisa entrar?'}),el('div',{class:'barra'},[el('label',{texto:'Meta de'}),al,mt,md,el('button',{type:'button',texto:'Calcular',onclick:function(){estado.stmAlvo=al.value;estado.stmMeta=mt.value===''?null:Number(mt.value.replace(',','.'));estado.stmMedida=md.value;telaStudioM()}})])];
  if(sim.reverso){var R=sim.reverso;if(!R.ok)rv.push(el('p',{class:'erro',texto:R.erro}));else{
    rv.push(el('p',{class:'grande',texto:Object.keys(R.entradas).map(function(n){return n1(R.entradas[n].inteiro)+' '+nm(n).toLowerCase()}).join(' + ')}));
    rv.push(el('p',{class:'suave',texto:'para '+R.alvoInteiro+' '+nm(alvo).toLowerCase()+(R.alvoReceita?' ('+brlT(R.alvoReceita)+' ÷ ticket '+brlT(R.ticket)+')':'')+(R.contrib>0?' · o pipeline aberto já contribui ≈ '+n1(R.contrib)+'; faltam '+n1(R.falta):'')+' · rendimento '+(Math.round((R.rendimento[Object.keys(R.entradas)[0]]||0)*10000)/100).toLocaleString('pt-BR')+'% por entrada'}));
    rv.push(qTabela(['Bloco','Precisa (exato)','Inteiro'],Object.keys(R.nos).map(function(n){return [nm(n),n1(R.nos[n].exato),String(R.nos[n].inteiro)]})));
    R.impossiveis.forEach(function(x){rv.push(el('p',{class:'erro',texto:'Não cabe: '+x.msg}))});R.avisos.forEach(function(a){rv.push(el('p',{class:'suave mini',texto:a}))});
    if(Object.keys(sim.estoque).length)rv.push(el('p',{class:'suave mini',texto:'Pipeline aberto considerado: '+Object.keys(sim.estoque).map(function(n){return sim.estoque[n]+' em '+nm(n)}).join(', ')}));}}
  app.appendChild(el('div',{class:'cartao'},rv));
  /* sensibilidade */
  if(sim.sensibilidade&&sim.sensibilidade.ok){var S=sim.sensibilidade;app.appendChild(el('details',{},[el('summary',{texto:'O que mais mexe no resultado (sensibilidade)'}),el('p',{class:'suave mini',texto:'Cada taxa ±5 p.p. (ou a banda informada) e cada entrada ±10%; "para +1" é o esforço para uma unidade a mais no resultado.'}),
    qTabela(['Alavanca','Hoje','Resultado de … a …','Para +1','Evidência'],S.L.map(function(x){return [x.nome,x.tipo==='taxa'?pct1(x.base):n1(x.base),n1(x.rLo)+' a '+n1(x.rHi),x.ppPorUm!=null?(Math.round(x.ppPorUm*100)/100).toLocaleString('pt-BR')+' p.p.':x.porUm!=null?'+'+n1(x.porUm):'—',x.incerta?'sem evidência ('+(FONTE_N[x.fonte]||x.fonte)+')':FONTE_N[x.fonte]||x.fonte]})),
    S.alerta&&S.alerta.length?el('p',{class:'erro mini',texto:'Premissas sem evidência com grande efeito: '+S.alerta.map(function(x){return x.nome}).join(', ')+'. O resultado é condicional a elas.'}):null]))}
  /* comparação */
  if(sim.comparacao.length>1)app.appendChild(el('details',{},[el('summary',{texto:'Cenários lado a lado'}),qTabela(['Cenário','Resultado','Precisa entrar','Viável?','Lacunas'],sim.comparacao.map(function(c){return [c.nome,c.erros?'erro':c.resultado?n1(c.resultado.vol):'—',c.entradas?Object.keys(c.entradas).map(function(n){return n1(c.entradas[n].inteiro)}).join(' + '):'—',c.viavel===null?(c.condicoes[0]||'—'):c.viavel?'sim':'não: '+c.condicoes.join(' '),c.lacunas.length?c.lacunas.join('; '):'—']}))]));
}
function stmCenarios(D,P){
  D.cenarios=D.cenarios||{};
  var nm=function(id){return (P.nos[id]&&P.nos[id].nome)||id};
  var lista=Object.keys(D.cenarios).map(function(k){var c=D.cenarios[k],regras=Object.keys(c.regras||{});return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('strong',{texto:c.nome||k}),el('span',{class:'suave mini',texto:' · '+regras.length+' regra(s)'}),' ',lk('Tirar cenário',function(){delete D.cenarios[k];telaStudioM()})])].concat(regras.map(function(rk){var r=c.regras[rk],m=/^([na]):([^.]+)\\.(\\w+)$/.exec(rk);return el('p',{class:'mini'},[(m?(m[1]==='a'&&P.arestas[m[2]]?nm(P.arestas[m[2]].de)+' → '+nm(P.arestas[m[2]].para):nm(m[2]))+' · '+m[3]:rk)+' = '+(m&&m[3]==='taxa'?pct1(r.v):n1(r.v))+' ('+(FONTE_N[r.fonte]||r.fonte||'hipótese')+(r.nota?': '+r.nota:'')+')',' ',lk('Tirar',function(){delete c.regras[rk];telaStudioM()})])})))});
  app.appendChild(qSecao('Cenários',[el('p',{class:'suave mini',texto:'Um cenário é um conjunto de regras por cima do modelo base (o base nunca muda): outra taxa numa conexão, outro volume numa entrada, outra capacidade.'})].concat(lista.length?lista:[el('p',{class:'suave',texto:'Só o cenário base por enquanto.'})])));
  var ck=inp({'aria-label':'Chave do cenário',placeholder:'conservador'}),cn=inp({'aria-label':'Nome do cenário',placeholder:'Conservador'});
  app.appendChild(el('details',{},[el('summary',{texto:'Novo cenário'}),campo('Chave (letras minúsculas)',ck),campo('Nome',cn),el('p',{},[el('button',{type:'button',texto:'Criar',onclick:function(){var k=ck.value.trim().toLowerCase();if(!/^[a-z0-9_-]{1,40}$/.test(k)||k==='base')return telaStudioM('Chave inválida.');D.cenarios[k]={nome:cn.value.trim()||k,regras:{}};telaStudioM()}})])]));
  var cens=Object.keys(D.cenarios);
  if(cens.length){
    var rc=sel(cens.map(function(k){return [k,D.cenarios[k].nome||k]}),cens[0],{'aria-label':'Cenário da regra'});
    var alvos=Object.keys(P.arestas).map(function(a){return ['a:'+a+'.taxa','taxa '+nm(P.arestas[a].de)+' → '+nm(P.arestas[a].para)]}).concat(Object.keys(P.nos).filter(function(n){return P.nos[n].tipo==='entrada'}).map(function(n){return ['n:'+n+'.vol','volume de '+nm(n)]})).concat(Object.keys(P.nos).map(function(n){return ['n:'+n+'.cap','capacidade de '+nm(n)]})).concat(Object.keys(P.nos).filter(function(n){return P.nos[n].tipo==='resultado'}).map(function(n){return ['n:'+n+'.ticket','ticket de '+nm(n)]}));
    var ra=sel(alvos,alvos[0]?alvos[0][0]:'',{'aria-label':'O que muda'}),rv=inp({type:'text',inputmode:'decimal','aria-label':'Valor da regra',placeholder:'taxa em %, o resto em unidades'}),rf=sel(Object.keys(FONTE_N).map(function(k){return [k,FONTE_N[k]]}),'hipotese',{'aria-label':'Fonte da regra'}),rn=inp({'aria-label':'Nota da regra',placeholder:'ex.: banda inferior de Wilson'});
    app.appendChild(el('details',{open:''},[el('summary',{texto:'Adicionar regra a um cenário'}),campo('Cenário',rc),campo('O que muda',ra),campo('Valor',rv),campo('Fonte',rf),campo('Nota',rn),el('p',{},[el('button',{type:'button',class:'primario',texto:'Adicionar regra',onclick:function(){var v=Number(rv.value.replace(',','.'));if(!isFinite(v))return telaStudioM('Informe o valor.');var k=ra.value;if(/\\.taxa$/.test(k))v=v/100;D.cenarios[rc.value].regras[k]={v:v,fonte:rf.value,nota:rn.value.trim()};telaStudioM()}})])]));
  }
}
async function stmPublicar(D,P,V,sim,det){
  if(!det){app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Guarde o modelo antes de publicar.'})]));return}
  var res=Object.keys(P.nos).filter(function(n){return P.nos[n].tipo==='resultado'}),nm=function(id){return (P.nos[id]&&P.nos[id].nome)||id};
  var f={cen:sel([['base','Base']].concat(Object.keys(D.cenarios||{}).map(function(k){return [k,D.cenarios[k].nome||k]})),estado.stmCen||'base',{'aria-label':'Cenário publicado'}),alvo:sel(res.map(function(n){return [n,nm(n)]}),sim.alvo,{'aria-label':'Bloco da meta publicada'}),meta:inp({type:'text',inputmode:'decimal','aria-label':'Meta publicada',value:estado.stmMeta==null?'':String(estado.stmMeta)}),de:inp({type:'date','aria-label':'Vale de'}),ate:inp({type:'date','aria-label':'Vale até'}),motivo:el('textarea',{rows:'2','aria-label':'Motivo da publicação',placeholder:'o que mudou e por quê (obrigatório a partir da 2ª publicação)'})};
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Publicar: a fotografia que vale no período'}),el('p',{class:'suave mini',texto:'Publicar congela o modelo guardado (com o cenário escolhido) para um período. O monitor compara essa fotografia com o realizado. Publicações não mudam; republicar cria outra, com motivo.'}),
    campo('Cenário',f.cen),campo('Bloco da meta',f.alvo),campo('Meta (unidades do bloco)',f.meta),campo('Vale de',f.de),campo('Vale até',f.ate),campo('Motivo',f.motivo),
    el('p',{},[el('button',{type:'button',class:'primario',texto:'Publicar',onclick:async function(){try{var p=await api(stBase()+'/modelos/'+encodeURIComponent(estado.stmNome)+'/publicar',{cenario:f.cen.value,alvo:f.alvo.value,meta:f.meta.value===''?null:Number(f.meta.value.replace(',','.')),validadeDe:f.de.value,validadeAte:f.ate.value,motivo:f.motivo.value});estado.stmDoc=null;estado.stmVista='monitor';telaStudioM('Publicação nº '+p.n+' válida de '+data(p.validadeDe)+' a '+data(p.validadeAte)+'.',true)}catch(e){telaStudioM(e.message)}}})])]));
  if(det.publicacoes.length)app.appendChild(qSecao('Publicações',[qTabela(['Nº','Cenário','Meta','Validade','Por · motivo'],det.publicacoes.map(function(p){return [String(p.n)+(p.n===det.vigente?' (vigente)':''),p.cenario,p.meta==null?'—':n1(p.meta)+' '+nm(p.alvo),data(p.validadeDe)+' a '+data(p.validadeAte),(p.por||'')+(p.motivo?' · '+p.motivo:'')]})),
    el('p',{},[el('button',{type:'button',texto:'Levar as premissas ao plano do quarter',onclick:async function(){try{var r=await api(stBase()+'/modelos/'+encodeURIComponent(estado.stmNome)+'/premissas'+qsData(),{});telaStudioM('Premissas levadas ao quarter: '+(r.premissas.ticket!=null?'ticket '+brlT(r.premissas.ticket)+'; ':'')+Object.keys(r.premissas.taxas).map(function(k){return k+' '+pct1(r.premissas.taxas[k])}).join(', ')+(r.faltam.length?'. Sem vínculo para: '+r.faltam.join(', '):'.'),true)}catch(e){telaStudioM(e.message)}}})]),
    el('p',{class:'suave mini',texto:'As taxas do modelo publicado viram as premissas do objetivo do quarter (Quarter › Objetivo), com a origem registrada.'})]));
}
async function stmMonitor(D,P,V,sim,det){
  if(!det||!det.publicacoes.length){app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'O monitor compara a publicação vigente com o realizado. Publique o modelo com a validade primeiro.'})]));return}
  var M;try{M=await api(stBase()+'/modelos/'+encodeURIComponent(estado.stmNome)+'/monitor'+qsData())}catch(e){app.appendChild(el('p',{class:'erro',texto:e.message}));return}
  var nm=function(id){return (P.nos[id]&&P.nos[id].nome)||id},mon=M.monitor;
  var est=function(e){return el('span',{class:'chip '+(EST_MON_C[e]||'sem'),texto:EST_MON[e]||e})};
  app.appendChild(el('div',{class:'cartao'},[el('p',{class:'suave mini',texto:'Publicação nº '+M.publicacao.n+' ('+M.publicacao.cenario+') · '+data(M.periodo.de)+' a '+data(M.periodo.ate)+' · dia '+M.periodo.decorridos+' de '+M.periodo.dias}),
    mon.gargalo?el('p',{class:'grande',texto:mon.gargalo.titulo}):el('p',{class:'grande',texto:mon.diags.length?mon.diags[0].titulo:'Dentro do esperado'}),
    mon.gargalo?el('p',{class:'suave',texto:'Principal gargalo · '+mon.gargalo.evidencia}):null,
    mon.meta?el('p',{texto:'Meta '+n1(mon.meta.alvo)+': realizado '+n1(mon.meta.realizado)+' + pipeline ≈ '+n1(mon.meta.pipeline)+' + entradas que ainda vêm ≈ '+n1(mon.meta.futuro)+' = projeção '+n1(mon.meta.projecao)+(mon.meta.gap>0.5?' · faltam ≈ '+n1(mon.meta.gap):' · a meta cabe')}):null]));
  app.appendChild(qSecao('Blocos: planejado × realizado',[qTabela(['Bloco','Plano','Esperado até hoje','Real','Estado'],Object.keys(mon.nos).map(function(n){var r=mon.nos[n];return [nm(n),r.plano==null?'—':n1(r.plano),r.esperado==null?'—':n1(r.esperado),r.real==null?'—':n1(r.real),est(r.estado)]})),stmMotivos(mon.nos,nm)]));
  app.appendChild(qSecao('Conexões: taxa planejada × observada (coorte)',[qTabela(['Conexão','Plano','Real (k de n)','Intervalo 95%','Estado'],Object.keys(mon.arestas).map(function(a){var r=mon.arestas[a],e=P.arestas[a]||{};return [nm(e.de)+' → '+nm(e.para),r.plano==null?'—':pct1(r.plano),r.real==null?'—':pct1(r.real)+' ('+r.k+' de '+r.n+')',r.ic?Math.round(r.ic[0]*100)+'% a '+Math.round(r.ic[1]*100)+'%':'—',est(r.estado)]})),stmMotivos(mon.arestas,function(a){var e=P.arestas[a]||{};return nm(e.de)+' → '+nm(e.para)})]));
  if(mon.diags.length)app.appendChild(qSecao('Diagnósticos',mon.diags.map(function(d){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[est(d.estado),' ',el('strong',{texto:d.titulo})]),el('p',{class:'mini',texto:d.evidencia}),d.consequencia?el('p',{class:'suave mini',texto:d.consequencia}):null,el('details',{},[el('summary',{class:'mini',texto:'O que investigar'})].concat(d.investigar.map(function(x){return el('p',{class:'mini',texto:'• '+x})})))])})));
}
function stmMotivos(o,nm){var L=Object.keys(o).filter(function(k){return o[k].motivo});return L.length?el('details',{},[el('summary',{class:'mini',texto:'Por que '+L.length+' sem conclusão'})].concat(L.map(function(k){return el('p',{class:'mini',texto:nm(k)+': '+o[k].motivo})}))):null}
async function stmProntidao(D,P,V,sim){
  var B=estado.stmBrief||(estado.stmBrief={publico:{},oferta:{},canais:{lista:[]},financeiro:{},experimento:{}});
  var t=function(o,k,label,ph){var i=inp({'aria-label':label,value:o[k]||'',placeholder:ph||''});i.addEventListener('change',function(){o[k]=i.value});return campo(label,i)};
  var canais=inp({'aria-label':'Canais da campanha',value:(B.canais.lista||[]).join(', '),placeholder:'separados por vírgula'});canais.addEventListener('change',function(){B.canais.lista=canais.value.split(',').map(function(x){return x.trim()}).filter(Boolean)});
  var meta=inp({type:'text',inputmode:'decimal','aria-label':'Meta da campanha',value:estado.stmMeta==null?'':String(estado.stmMeta)});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'A campanha está pronta para ser testada?'}),el('p',{class:'suave mini',texto:'Critérios explícitos, sem nota mágica: público, oferta, demanda, processo, evidência, volume, capacidade, entrega, financeiro, medição e decisão.'}),
    el('h3',{texto:'Público'}),t(B.publico,'icp','Perfil de cliente ideal'),t(B.publico,'criterios','Critérios de elegibilidade'),
    el('h3',{texto:'Oferta'}),t(B.oferta,'produto','Produto'),t(B.oferta,'valor','Proposta de valor'),t(B.oferta,'condicoes','Condições comerciais'),
    el('h3',{texto:'Demanda'}),campo('Canais',canais),
    el('h3',{texto:'Financeiro'}),t(B.financeiro,'ticket','Ticket (R$)'),t(B.financeiro,'orcamento','Orçamento (R$)'),t(B.financeiro,'margem','Margem (fração)'),t(B.financeiro,'pagamento','Condição de pagamento'),
    el('h3',{texto:'Decisão depois do teste'}),t(B.experimento,'metrica','Métrica de avaliação'),t(B.experimento,'amostra','Amostra ou duração'),t(B.experimento,'continuar','Continuar se'),t(B.experimento,'corrigir','Corrigir se'),t(B.experimento,'encerrar','Encerrar se'),
    campo('Meta da campanha (unidades do resultado)',meta),
    el('p',{},[el('button',{type:'button',class:'primario',texto:'Avaliar prontidão',onclick:async function(){estado.stmMeta=meta.value===''?null:Number(meta.value.replace(',','.'));try{var r=await api(stBase()+'/prontidao'+qsData(),{brief:B,doc:D,cenario:estado.stmCen||'base',alvo:sim.alvo,meta:estado.stmMeta});estado.stmPront=r;telaStudioM()}catch(e){telaStudioM(e.message)}}})])]));
  var R=estado.stmPront;
  if(R)app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande '+(R.pronto?'ok':'erro'),texto:R.leitura})].concat(R.L.map(function(x){return el('div',{class:'acao'},[el('p',{class:'acao-t'},[el('span',{class:'chip '+(x.st==='completo'?'no_ritmo':x.st==='fragil'?'atencao':x.st==='bloqueador'?'critica':'sem'),texto:x.st}),' ',el('strong',{texto:x.nome}),x.essencial?el('span',{class:'suave mini',texto:' · essencial'}):null]),el('p',{class:'mini',texto:x.porque})])}))));
}
`;
