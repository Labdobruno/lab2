/* Onda 4 na tela: "Quanto sobra de cada venda?" (economia da venda), política de preço versionada, precificador, preço e custo real por negócio.
   JavaScript inserido na PAGINA (sem crases nem "${"). Usa o que a página já tem: el, api, limpar, abas, controles, cabecalho, data, pct, reais, estado, telaEntrada, brlT, n1, lk, campo, inp, sel, num0, qTabela, qSecao. */
export const TELA_ECONOMIA = `
var GRUPO_N={deducao:'Dedução',custo_variavel:'Custo',comissao:'Comissão'};
var BASE_N={percentual_preco:'% do preço',percentual_liquido:'% do líquido',fixo:'R$ fixo',informado:'informado na venda'};
var CAT_N={cpv:'produto',servico:'serviço',contingencia:'contingência',interno:'interno',reserva:'reserva'};
var COM_N={nenhuma:'nenhuma',fixa:'fixa',por_margem:'por margem (sem teto)'};
function ecBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)+'/economia'}
function ecQs(){return estado.data?'?data='+encodeURIComponent(estado.data):''}
function pct1(v){return v==null||!isFinite(v)?'—':(Math.round(v*1000)/10).toLocaleString('pt-BR')+'%'}
function custosDeTexto(t){return String(t||'').split(/\\n|;/).map(function(l){var p=l.split(/[=:]/);if(p.length<2)return null;var v=Number(String(p[1]).replace(/\\./g,'').replace(',','.'));return p[0].trim()&&isFinite(v)?{chave:p[0].trim().toLowerCase().replace(/\\s+/g,'_'),valor:v}:null}).filter(Boolean)}
async function telaEconomia(msg,ok){
  limpar();
  var P,POL;
  try{P=await api(ecBase()+ecQs());POL=await api(ecBase()+'/politica')}catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(abas());app.appendChild(el('p',{class:'erro',texto:'Não consegui montar a economia: '+e.message}));app.appendChild(controles());return}
  app.appendChild(abas());
  cabecalho('Quanto sobra de cada venda?','Vendas fechadas de '+data(P.periodo.de)+' a '+data(P.periodo.ate)+' · política v'+P.politica.versao+(P.politica.margemAlvo!=null?' · margem alvo '+pct1(P.politica.margemAlvo)+' · mínima '+pct1(P.politica.margemMinima):' · sem margem alvo')).forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var R=P.resumo;
  app.appendChild(el('div',{class:'cartao'},[el('p',{class:'grande',texto:R.comEconomia?pct1(R.mcPct)+' de margem':'Sem venda com economia'}),
    el('p',{class:'suave',texto:R.comEconomia?brlT(R.mc)+' de contribuição sobre '+brlT(R.receitaLiquida)+' de receita líquida ('+brlT(R.receita)+' brutos) · '+R.vendas+' venda(s)'+(R.semEconomia?' · '+R.semEconomia+' sem preço nem custo registrados':''):'Registre o preço fechado e os custos das vendas (ou publique a política) para o LAB calcular o que sobra.'}),
    el('p',{},[R.excecoes?el('span',{class:'chip critica',texto:R.excecoes+' exceção(ões) de alçada'}):null,' ',R.abaixoDoPiso?el('span',{class:'chip alta',texto:R.abaixoDoPiso+' abaixo do piso'}):null,' ',R.mcPerdida>0?el('span',{class:'chip atencao',texto:'MC perdida no desconto '+brlT(R.mcPerdida)}):null,' ',R.reais?el('span',{class:'chip no_ritmo',texto:R.reais+' com custo real completo'}):null,' ',R.parciais?el('span',{class:'chip sem',texto:R.parciais+' com custo real parcial'}):null]),
    P.contribuicao&&P.contribuicao.texto?el('p',{class:P.contribuicao.estado==='abaixo'?'erro':P.contribuicao.estado==='sem_fixo'?'suave mini':'ok',texto:P.contribuicao.texto}):null]));
  /* vendas do período */
  if(P.vendas.length)app.appendChild(qSecao('Venda a venda',[el('p',{class:'suave mini',texto:'Abra uma venda para ver a conta inteira, registrar preço ou lançar o custo real.'})].concat(P.vendas.map(function(v){return ecVendaItem(v)}))));
  /* registrar preço de um negócio (ganho sem preço, ou aberto em proposta/negociação) */
  app.appendChild(ecRegistrar(P));
  /* agregados */
  var tab=function(t,L,extra){if(!L.length)return null;return qSecao(t,[qTabela(['Quem','Vendas','Receita','MC','MC %','Desconto','Abaixo do piso','MC perdida'].concat(extra?extra.cab:[]),L.map(function(g){return [g.nome,String(g.n),brlT(g.receita),brlT(g.mc),pct1(g.mcPct),pct1(g.descontoMedio),String(g.abaixoDoPiso),brlT(g.mcPerdida)].concat(extra?extra.cel(g):[])}))])};
  var pv=tab('Por vendedor: volume sem margem não é resultado',P.porVendedor);if(pv)app.appendChild(pv);
  var pc=tab('Por canal: receita não é lucro',P.porCanal,{cab:['Investimento','CAC','Retorno (MC − inv.)','ROI s/ margem'],cel:function(g){return [g.investimento==null?(g.mesesSemLancamento&&g.mesesSemLancamento.length?'falta '+g.mesesSemLancamento.join(', '):'—'):brlT(g.investimento),brlT(g.cac),brlT(g.retorno),pct1(g.roiSobreMargem)]}});if(pc)app.appendChild(pc);
  if(P.porCondicao.length>1)app.appendChild(qSecao('Por condição de pagamento',[qTabela(['Condição','Vendas','MC %','Capital exposto (média)','Custo do prazo'],P.porCondicao.map(function(g){return [g.nome,String(g.n),pct1(g.mcPct),brlT(g.capitalExposto),brlT(g.custoFinanceiro)]}))]));
  if(P.porFaixa.length)app.appendChild(qSecao('Por faixa de ticket',[qTabela(['Faixa','Vendas','MC %','Desconto'],P.porFaixa.map(function(g){return [g.nome,String(g.n),pct1(g.mcPct),pct1(g.descontoMedio)]}))]));
  if(P.erroOrcamento.n)app.appendChild(qSecao('Custo previsto × real',[el('p',{texto:P.erroOrcamento.n+' venda(s) com custo real completo: previsto '+brlT(P.erroOrcamento.previsto)+' · real '+brlT(P.erroOrcamento.real)+' · erro '+(P.erroOrcamento.previsto?pct1((P.erroOrcamento.real-P.erroOrcamento.previsto)/P.erroOrcamento.previsto):'—')+(P.erroOrcamento.pendentes?' · '+P.erroOrcamento.pendentes+' com custo parcial (valem pelo previsto)':'')})]));
  if(P.breakEven.length)app.appendChild(el('details',{},[el('summary',{texto:'Quanto volume um desconto exige? (venda típica '+brlT(P.tipica.preco)+')'})].concat(P.breakEven.map(function(b){return el('p',{class:'mini',texto:b.texto})}))));
  app.appendChild(ecPrecificador(POL));
  app.appendChild(ecPolitica(POL));
}
function ecVendaItem(v){
  var d=el('details',{},[el('summary',{},[el('strong',{texto:v.nome}),el('span',{class:'suave mini',texto:' · '+v.dono+' · '+brlT(v.preco)+(v.mc!=null?' → MC '+brlT(v.mc)+' ('+pct1(v.mcPct)+')':' · sem economia')}),' ',v.excecao?el('span',{class:'chip critica',texto:'exceção'}):v.abaixoDoPiso?el('span',{class:'chip alta',texto:'abaixo do piso'}):null,' ',v.fonte==='real'?el('span',{class:'chip no_ritmo',texto:'real'}):v.parcial?el('span',{class:'chip sem',texto:'real parcial'}):null])]);
  d.addEventListener('toggle',async function(){if(!d.open||d.dataset.ok)return;d.dataset.ok='1';try{var E=await api(ecBase()+'/negocios/'+v.id);ecDetalhe(d,E)}catch(e){d.appendChild(el('p',{class:'erro mini',texto:e.message}))}});
  return d;
}
function ecLinhas(e){
  if(!e)return [el('p',{class:'suave mini',texto:'sem conta'})];
  var L=[el('p',{class:'mini',texto:'Preço '+brlT(e.preco)+' · condição '+e.condicao+' · política v'+e.politicaVersao})];
  e.deducoes.filter(function(x){return x.valor>0}).forEach(function(x){L.push(el('p',{class:'mini',texto:'− '+x.nome+': '+brlT(x.valor)+(x.pct!=null?' ('+pct1(x.pct)+' de '+brlT(x.base)+')':'')}))});
  if(e.taxa)L.push(el('p',{class:'mini',texto:'− taxa da condição: '+brlT(e.taxa)}));if(e.antecipacao)L.push(el('p',{class:'mini',texto:'− antecipação: '+brlT(e.antecipacao)}));
  if(e.comissao)L.push(el('p',{class:'mini',texto:'− comissão ('+pct1(e.comissaoPct)+' do líquido, '+e.comissaoOrigem+'): '+brlT(e.comissao)}));
  L.push(el('p',{class:'mini'},[el('strong',{texto:'= receita líquida '+brlT(e.receitaLiquida)})]));
  Object.keys(e.custosPorCategoria).forEach(function(k){L.push(el('p',{class:'mini',texto:'− custo '+(CAT_N[k]||k)+': '+brlT(e.custosPorCategoria[k])}))});
  if(e.custoFinanceiro)L.push(el('p',{class:'mini',texto:'− custo do dinheiro até receber ('+n1(e.diasMedioRecebimento)+' dias): '+brlT(e.custoFinanceiro)}));
  L.push(el('p',{},[el('strong',{texto:'= MC '+brlT(e.mc)+' · '+pct1(e.mcPct)+' da receita líquida'}),el('span',{class:'suave mini',texto:' ('+pct1(e.mcPctPreco)+' do preço)'})]));
  return L;
}
function ecDetalhe(d,E){
  var N=E.negocio;
  d.appendChild(el('p',{class:'suave mini',texto:(N.dono||'sem vendedor')+' · '+(N.canal||'sem canal')+(N.fechadoEm?' · fechada em '+data(N.fechadoEm.slice(0,10)):' · '+N.status)+(E.recomendado!=null?' · recomendado '+brlT(E.recomendado)+' · piso '+brlT(E.piso):'')}));
  if(E.excecao)d.appendChild(el('p',{class:'erro mini',texto:'Exceção de alçada: '+E.excecao.texto+' · impacto na MC '+brlT(E.excecao.impactoMc)+' · motivo: '+E.excecao.motivo+(E.excecao.por?' ('+E.excecao.por+')':'')}));
  if(E.desconto.desconto!=null)d.appendChild(el('p',{class:'mini',texto:'Desconto sobre o aprovado '+pct1(E.desconto.desconto)+' · MC perdida '+brlT(E.desconto.mcPerdida)}));
  d.appendChild(el('h3',{texto:E.fonte==='real'?'Conta efetiva (custo real completo)':'Conta prevista'+(E.parcial?' (custo real ainda parcial)':'')}));
  ecLinhas(E.efetiva).forEach(function(n){d.appendChild(n)});
  if(E.fonte==='real'&&E.fechado)d.appendChild(el('details',{},[el('summary',{class:'mini',texto:'Conta prevista (custos informados na venda): MC '+brlT(E.fechado.mc)+' · erro de orçamento '+brlT(E.erroOrcamento)})].concat(ecLinhas(E.fechado))));
  if(E.custosReais.length)d.appendChild(el('details',{},[el('summary',{class:'mini',texto:E.custosReais.length+' lançamento(s) de custo real'})].concat(E.custosReais.map(function(c){return el('p',{class:'mini',texto:data(c.em)+' · '+c.chave+' '+brlT(c.valor)+(c.categoria?' ('+CAT_N[c.categoria]+')':'')+(c.completo?' · completo':'')+(c.nota?' · '+c.nota:'')+(c.por?' · '+c.por:'')})}))));
  /* lançar custo real */
  var cChave=inp({'aria-label':'Custo (chave)',placeholder:'ex.: kit, instalacao'}),cValor=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Valor (R$)'}),cCat=sel([['cpv','produto'],['servico','serviço'],['contingencia','contingência'],['interno','interno'],['reserva','reserva']],'cpv',{'aria-label':'Categoria'}),cNota=inp({'aria-label':'Nota'}),cComp=el('input',{type:'checkbox'});
  d.appendChild(el('details',{},[el('summary',{class:'mini',texto:'Lançar custo real'}),campo('Custo',cChave),campo('Valor (R$)',cValor),campo('Categoria',cCat),campo('Nota',cNota),el('label',{class:'inline'},[cComp,' todo o custo desta venda está lançado (a conta efetiva passa a ser a real)']),
    el('p',{},[el('button',{type:'button',texto:'Lançar',onclick:async function(){try{await api(ecBase()+'/negocios/'+N.id+'/custo',{chave:cChave.value,valor:num0(cValor.value),categoria:cCat.value,nota:cNota.value,completo:cComp.checked});telaEconomia('Custo lançado.',true)}catch(e){telaEconomia(e.message)}}})])]));
  /* registrar preço (aprovado/fechado) */
  d.appendChild(ecFormPreco(N.id,E));
}
function ecFormPreco(id,E,aberto){
  var mom=sel([['fechado','fechado'],['aprovado','aprovado'],['referencia','referência']],'fechado',{'aria-label':'Momento'}),val=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Valor (R$)'}),cond=inp({'aria-label':'Condição (chave)',value:(E&&E.condicao)||'vista'}),cus=el('textarea',{rows:'2','aria-label':'Custos da venda',placeholder:'um por linha: chave = valor (ex.: kit = 10000)'}),mot=inp({'aria-label':'Motivo (se fora da alçada)'});
  if(E&&E.custosPrevistos&&E.custosPrevistos.length)cus.value=E.custosPrevistos.map(function(c){return c.chave+' = '+c.valor}).join('\\n');
  var dd=el('details',aberto?{open:''}:{},[el('summary',{class:'mini',texto:'Registrar preço'}),campo('Momento',mom),campo('Valor (R$)',val),campo('Condição de pagamento',cond),campo('Custos previstos (vazio = os já registrados)',cus),campo('Motivo (obrigatório fora da alçada)',mot),
    el('p',{},[el('button',{type:'button',texto:'Registrar',onclick:async function(){try{var corpo={momento:mom.value,valor:num0(val.value),condicao:cond.value.trim()||null,motivo:mot.value.trim()};var c=custosDeTexto(cus.value);if(c.length)corpo.custos=c;await api(ecBase()+'/negocios/'+id+'/preco',corpo);telaEconomia('Preço registrado.',true)}catch(e){telaEconomia(e.message)}}})])]);
  return dd;
}
function ecRegistrar(P){
  var d=el('details',{},[el('summary',{texto:'Registrar preço de um negócio'})]);
  d.addEventListener('toggle',async function(){if(!d.open||d.dataset.ok)return;d.dataset.ok='1';try{var L=await api(ecBase()+'/negocios'+ecQs());if(!L.length){d.appendChild(el('p',{class:'suave mini',texto:'Nenhum negócio ganho no período nem aberto em proposta/negociação.'}));return}
    var s=sel(L.map(function(n){return [n.id,n.nome+' · '+(n.dono||'')+' · '+(n.status==='ganho'?'ganho '+brlT(n.valor)+(n.comPreco?' (com preço)':' (sem preço)'):n.papel)]}),L[0].id,{'aria-label':'Negócio'}),alvo=el('div',{});
    var mostrar=async function(){while(alvo.firstChild)alvo.removeChild(alvo.firstChild);try{var E=await api(ecBase()+'/negocios/'+s.value);alvo.appendChild(ecFormPreco(s.value,E,true))}catch(e){alvo.appendChild(el('p',{class:'erro mini',texto:e.message}))}};
    s.addEventListener('change',mostrar);d.appendChild(campo('Negócio',s));d.appendChild(alvo);mostrar()}catch(e){d.appendChild(el('p',{class:'erro mini',texto:e.message}))}});
  return d;
}
function ecPrecificador(POL){
  var cus=el('textarea',{rows:'3','aria-label':'Custos',placeholder:'um por linha: chave = valor (ex.: kit = 10000)'}),alvo=el('div',{});
  return el('details',{},[el('summary',{texto:'Precificador: qual preço entrega a margem alvo?'}),el('p',{class:'suave mini',texto:'Informe os custos da venda. O LAB inverte a política inteira (deduções, comissão, condição) e devolve o preço recomendado (margem alvo) e o piso (margem mínima) em cada condição.'}),campo('Custos',cus),
    el('p',{},[el('button',{type:'button',texto:'Calcular',onclick:async function(){while(alvo.firstChild)alvo.removeChild(alvo.firstChild);try{var r=await api(ecBase()+'/precificar',{custos:custosDeTexto(cus.value)});if(r.aviso)alvo.appendChild(el('p',{class:'erro mini',texto:r.aviso}));
      alvo.appendChild(qTabela(['Condição','Recomendado','Piso','MC no recomendado'],r.porCondicao.map(function(c){return [c.nome,brlT(c.recomendado),brlT(c.piso),c.economia?brlT(c.economia.mc)+' ('+pct1(c.economia.mcBrutaPct)+')':'—']})))}catch(e){alvo.appendChild(el('p',{class:'erro mini',texto:e.message}))}}})]),alvo]);
}
function ecPolitica(POL){
  var V=POL.vigente;
  var f={margemAlvo:inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Margem alvo (%)',value:V.margemAlvo==null?'':String(Math.round(V.margemAlvo*1000)/10)}),margemMinima:inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Margem mínima (%)',value:V.margemMinima==null?'':String(Math.round(V.margemMinima*1000)/10)}),descontoMaximo:inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Desconto máximo (%)',value:V.descontoMaximo==null?'':String(Math.round(V.descontoMaximo*1000)/10)}),
    custoCapitalMes:inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Custo do dinheiro ao mês (%)',value:String(Math.round((V.custoCapitalMes||0)*10000)/100)}),custosFixosMes:inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Custos fixos do mês (R$)',value:V.custosFixosMes==null?'':String(V.custosFixosMes)}),lucroDesejadoMes:inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Lucro desejado no mês (R$)',value:V.lucroDesejadoMes==null?'':String(V.lucroDesejadoMes)})};
  var cTipo=sel([['nenhuma','nenhuma'],['fixa','fixa (sempre a alvo)'],['por_margem','por margem (sobe com a margem, sem teto)']],V.comissao.tipo,{'aria-label':'Tipo'}),cAlvo=inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Comissão alvo (%)',value:V.comissao.alvo==null?'':String(Math.round(V.comissao.alvo*1000)/10)}),cMin=inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Comissão mínima (%)',value:V.comissao.minima==null?'':String(Math.round(V.comissao.minima*1000)/10)});
  var linhas=V.linhas.map(function(l){return Object.assign({},l)}),conds=V.condicoes.map(function(c){return Object.assign({},c)});
  var lista=el('div',{}),listaC=el('div',{});
  function desenharLinhas(){while(lista.firstChild)lista.removeChild(lista.firstChild);linhas.forEach(function(l,i){lista.appendChild(el('p',{class:'mini'},[l.nome+' ('+l.chave+') · '+(GRUPO_N[l.grupo]||l.grupo)+' · '+(BASE_N[l.base]||l.base)+(l.valor!=null?' '+(l.base==='fixo'?brlT(l.valor):pct1(l.valor)):'')+(l.excluir&&l.excluir.length?' · base exclui '+l.excluir.join(', '):'')+(l.categoria?' · '+CAT_N[l.categoria]:'')+' ',lk('Remover',function(){linhas.splice(i,1);desenharLinhas()})]))})}
  function desenharConds(){while(listaC.firstChild)listaC.removeChild(listaC.firstChild);conds.forEach(function(c,i){listaC.appendChild(el('p',{class:'mini'},[c.nome+' ('+c.chave+') · taxa '+pct1(c.taxa||0)+(c.antecipacao?' · antecipação '+pct1(c.antecipacao):'')+' · recebe '+(c.partes||[{fracao:1,dias:0}]).map(function(p){return Math.round(p.fracao*100)+'% em '+p.dias+' d'}).join(', ')+' ',lk('Remover',function(){conds.splice(i,1);desenharConds()})]))})}
  desenharLinhas();desenharConds();
  var lChave=inp({'aria-label':'Chave da linha',placeholder:'imposto'}),lNome=inp({'aria-label':'Nome da linha'}),lGrupo=sel([['deducao','dedução (imposto, taxa)'],['custo_variavel','custo informado na venda'],['comissao','comissão extra (% do líquido)']],'deducao',{'aria-label':'Grupo'}),lBase=sel([['percentual_preco','% do preço'],['percentual_liquido','% do líquido'],['fixo','R$ fixo'],['informado','informado na venda']],'percentual_preco',{'aria-label':'Base'}),lValor=inp({type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Valor (% ou R$)'}),lExcl=inp({'aria-label':'Custos fora da base (chaves separadas por vírgula)'}),lCat=sel([['','—'],['cpv','produto'],['servico','serviço'],['contingencia','contingência'],['interno','interno'],['reserva','reserva']],'');
  var kChave=inp({'aria-label':'Chave da condição',placeholder:'cartao'}),kNome=inp({'aria-label':'Nome da condição'}),kTaxa=inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Taxa (%)'}),kAnt=inp({type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Antecipação (%)'}),kPartes=inp({'aria-label':'Recebimento',placeholder:'60:0, 40:30 (= 60% no ato, 40% em 30 dias)'});
  var motivo=el('textarea',{rows:'2','aria-label':'Motivo da nova versão',placeholder:'O que muda e por quê (a versão anterior fica guardada; vendas feitas continuam com a dela)'});
  var pc=function(x){var v=num0(x.value);return v==null?null:v/100};
  return el('details',{},[el('summary',{texto:'Política de preço (v'+V.versao+(V.publicadaEm?', '+data(V.publicadaEm.slice(0,10)):'')+(V.por?', '+V.por:'')+')'}),
    el('p',{class:'suave mini',texto:'A conta de toda venda sai daqui: deduções, condições, comissão, custo do dinheiro e as margens. Publicar cria uma versão nova; a venda guarda a versão do dia.'}),
    campo('Margem alvo (% da receita líquida)',f.margemAlvo),campo('Margem mínima (%)',f.margemMinima),campo('Desconto máximo sobre o aprovado (%)',f.descontoMaximo),campo('Custo do dinheiro ao mês (%)',f.custoCapitalMes),campo('Custos fixos do mês (R$)',f.custosFixosMes),campo('Lucro desejado no mês (R$)',f.lucroDesejadoMes),
    el('h3',{texto:'Comissão'}),campo('Tipo',cTipo),campo('Comissão alvo (% do líquido)',cAlvo),campo('Comissão mínima (%)',cMin),
    el('h3',{texto:'Deduções e custos'}),lista,el('details',{},[el('summary',{class:'mini',texto:'Adicionar linha'}),campo('Chave',lChave),campo('Nome',lNome),campo('Grupo',lGrupo),campo('Base',lBase),campo('Valor (fração para %, ex.: 0,06; ou R$)',lValor),campo('Custos fora da base (ex.: kit)',lExcl),campo('Categoria (custo informado)',lCat),el('button',{type:'button',texto:'Adicionar linha',onclick:function(){if(!lChave.value.trim()||!lNome.value.trim())return;var l={chave:lChave.value.trim(),nome:lNome.value.trim(),grupo:lGrupo.value,base:lBase.value};if(num0(lValor.value)!=null)l.valor=num0(lValor.value);if(lExcl.value.trim())l.excluir=lExcl.value.split(',').map(function(x){return x.trim()}).filter(Boolean);if(lCat.value)l.categoria=lCat.value;linhas.push(l);desenharLinhas()}})]),
    el('h3',{texto:'Condições de pagamento'}),listaC,el('details',{},[el('summary',{class:'mini',texto:'Adicionar condição'}),campo('Chave',kChave),campo('Nome',kNome),campo('Taxa (%)',kTaxa),campo('Antecipação (%)',kAnt),campo('Recebimento (fração:dias, separados por vírgula)',kPartes),el('button',{type:'button',texto:'Adicionar condição',onclick:function(){if(!kChave.value.trim()||!kNome.value.trim())return;var c={chave:kChave.value.trim(),nome:kNome.value.trim(),taxa:pc(kTaxa)||0,antecipacao:pc(kAnt)||0};var ps=kPartes.value.split(',').map(function(x){var p=x.split(':');return p.length===2?{fracao:Number(p[0])/100,dias:Number(p[1])}:null}).filter(Boolean);if(ps.length)c.partes=ps;conds.push(c);desenharConds()}})]),
    campo('Motivo da nova versão',motivo),
    el('button',{class:'primario',type:'button',texto:'Publicar nova versão (v'+(V.versao+1)+')',onclick:async function(){try{var corpo={motivo:motivo.value.trim(),margemAlvo:pc(f.margemAlvo),margemMinima:pc(f.margemMinima),descontoMaximo:pc(f.descontoMaximo),custoCapitalMes:pc(f.custoCapitalMes)||0,custosFixosMes:num0(f.custosFixosMes.value),lucroDesejadoMes:num0(f.lucroDesejadoMes.value),comissao:{tipo:cTipo.value,alvo:pc(cAlvo),minima:pc(cMin)},linhas:linhas,condicoes:conds};await api(ecBase()+'/politica',corpo);telaEconomia('Política v'+(V.versao+1)+' publicada.',true)}catch(e){telaEconomia(e.message)}}}),
    POL.versoes.length>1?el('details',{},[el('summary',{class:'mini',texto:POL.versoes.length+' versões'})].concat(POL.versoes.slice().reverse().map(function(v){return el('p',{class:'mini',texto:'v'+v.versao+' · '+(v.publicadaEm?data(v.publicadaEm.slice(0,10)):'')+(v.por?' · '+v.por:'')+' · '+(v.motivo||'')+(v.margemAlvo!=null?' · alvo '+pct1(v.margemAlvo):'')})}))):null]);
}
`;
