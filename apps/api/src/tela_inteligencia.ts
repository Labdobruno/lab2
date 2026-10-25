/* Onda 6 na tela: Inteligência. Uma pergunta por vez: "O que merece sua atenção?" (achados v3 dentro do orçamento de atenção, cada um abre
   um canvas de decisão em 10 blocos), "Quem precisa de quê?" (pessoas: benchmark, receita potencial, matriz, transferência, drill-down),
   "Dá para confiar?" (saúde da inteligência, acurácia do forecast, waterfall do ciclo) e o diário de contexto.
   JavaScript inserido na PAGINA (sem crases nem "${"). Usa o que a página já tem: el, api, limpar, abas, controles, cabecalho, data, estado, telaEntrada, brlT, n1, lk, campo, inp, sel, qTabela, qSecao, pct1, reais, fmtVal, qs. */
export const TELA_INTELIGENCIA = `
var IN_ESTADO={ativo:'Ativo',parcial:'Parcial',inativo:'Inativo',nao_avaliavel:'Não avaliável',sem_regra:'Sem regra'};
var IN_ESTADO_C={ativo:'critica',parcial:'atencao',inativo:'no_ritmo',nao_avaliavel:'sem',sem_regra:'sem'};
var IN_CONF_C={alta:'no_ritmo',media:'atencao',baixa:'critica',nao:'sem'};
var IN_DIM={contribuicao:'contribuição',receita:'receita',caixa:'caixa',capacidade:'capacidade'};
var IN_COND={verdadeiro:'✔',falso:'✘',ausente:'?',insuficiente:'n'};
var IN_MARCA={tratamento:'Em tratamento',aceito:'Aceito como está',naoprocede:'Não procede'};
function inBase(){return '/admin/operacoes/'+encodeURIComponent(estado.slug)+'/inteligencia'}
function inPct(v){return v==null||!isFinite(v)?'—':(Math.round(v*1000)/10).toLocaleString('pt-BR')+'%'}
function inPP(v){return v==null||!isFinite(v)?'—':(v>0?'+':'')+(Math.round(v*10)/10).toLocaleString('pt-BR')+' p.p.'}
function inSub(){var f=function(id,t){var b=el('button',{type:'button',class:'mini',texto:t,onclick:function(){estado.inSub=id;estado.inAchado=null;telaInteligencia()}});if((estado.inSub||'achados')===id)b.setAttribute('aria-current','page');return b};return el('div',{class:'barra'},[f('achados','O que merece atenção?'),f('pessoas','Quem precisa de quê?'),f('saude','Dá para confiar?'),f('contexto','Diário de contexto')])}
async function telaInteligencia(msg,ok){
  limpar();
  var sub=estado.inSub||'achados';
  app.appendChild(abas());
  try{
    if(sub==='pessoas')return await inPessoas(msg,ok);
    if(sub==='saude')return await inSaude(msg,ok);
    if(sub==='contexto')return await inContexto(msg,ok);
    return await inAchados(msg,ok);
  }catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));app.appendChild(controles())}
}
/* ---------- O que merece atenção? ---------- */
function inCartao(a,R){
  var imp=a.impacto;
  var c=el('div',{class:'cartao',role:'button',tabindex:'0',onclick:function(){estado.inAchado=a.codigo;telaInteligencia()},onkeydown:function(e){if(e.key==='Enter'){estado.inAchado=a.codigo;telaInteligencia()}}},[
    el('div',{class:'barra'},[el('span',{class:'chip '+IN_ESTADO_C[a.estado],texto:(R.tipos[a.tipo]||a.tipo).split(' (')[0]}),a.composto?el('span',{class:'chip alta',texto:'Composto'}):null,a.novo?el('span',{class:'chip atencao',texto:'Novo'}):null,el('span',{class:'chip '+IN_CONF_C[a.confianca.nivel],texto:'Confiança '+a.confianca.nome.toLowerCase()})]),
    el('h2',{texto:a.nome}),
    imp?el('div',{},[el('div',{class:'valor',texto:reais(imp.valor)}),el('p',{class:'suave mini',texto:'em '+(IN_DIM[imp.dimensao]||imp.dimensao)+' · '+imp.texto})]):el('p',{class:'suave',texto:a.estado==='nao_avaliavel'?'Falta dado: '+a.faltando.join(', '):'Impacto em R$ não calculável.'}),
    a.mecanismo?el('p',{class:'mini',texto:a.mecanismo}):null,
    a.rivais.length?el('p',{class:'mini suave',texto:'Explicações rivais ativas: '+a.rivais.map(function(r){return r.nome}).join('; ')}):null,
    el('p',{class:'mini suave',texto:'Toque para abrir o canvas de decisão'})]);
  return c;
}
async function inAchados(msg,ok){
  var R=await api(inBase()+qs());
  if(estado.inAchado){var A=R.achados.filter(function(x){return x.codigo===estado.inAchado})[0];if(A)return inCanvas(A,R,msg,ok)}
  cabecalho('O que merece sua atenção?','Mostro até '+R.orcamentoN+' achados por vez, por impacto em reais × confiança ÷ esforço. '+R.biblioteca+' hipóteses avaliadas · '+(R.saude.ativas||0)+' ativas · dados de '+data(R.data)).forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(inSub());app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  R.avisos.forEach(function(a){app.appendChild(el('p',{class:'suave mini',texto:'⚠ '+a}))});
  var O=R.orcamento;
  if(!O.visiveis.length)app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Nada pede atenção agora.'}),el('p',{class:'suave',texto:O.naoAvaliaveis.length?(O.naoAvaliaveis.length+' hipótese(s) não puderam ser avaliadas por falta de fonte (veja abaixo).'):'Todas as hipóteses foram avaliadas e nenhuma está ativa.'})]));
  O.visiveis.forEach(function(a){app.appendChild(inCartao(a,R))});
  if(O.resto.length)app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Em espera ('+O.resto.length+'): entram quando você tratar os de cima'})].concat(O.resto.map(function(a){return el('p',{},[lk(a.nome,function(){estado.inAchado=a.codigo;telaInteligencia()}),el('span',{class:'suave mini',texto:' · '+(a.impacto?reais(a.impacto.valor)+' em jogo':'sem impacto calculável')})])}))));
  if(O.tratados.length)app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Marcados por você ('+O.tratados.length+'): somem até o impacto crescer 1,5×'})].concat(O.tratados.map(function(a){var m=R.marcas[a.codigo]||{};return el('p',{},[lk(a.nome,function(){estado.inAchado=a.codigo;telaInteligencia()}),el('span',{class:'suave mini',texto:' · '+(IN_MARCA[m.estado]||m.estado)+(m.motivo?': '+m.motivo:'')})])}))));
  if(O.naoAvaliaveis.length)app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Sem fonte para avaliar ('+O.naoAvaliaveis.length+')'})].concat(O.naoAvaliaveis.map(function(a){return el('p',{},[el('strong',{texto:a.nome}),el('span',{class:'suave mini',texto:' · falta: '+a.faltando.join(', ')})])}))));
  var ina=R.achados.filter(function(a){return !a.composto&&a.estado==='inativo'});
  if(ina.length)app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Avaliadas e tranquilas ('+ina.length+')'})].concat(ina.map(function(a){return el('p',{class:'mini'},[lk(a.nome,function(){estado.inAchado=a.codigo;telaInteligencia()}),el('span',{class:'suave',texto:' · '+a.conds.filter(function(c){return c.estado==='verdadeiro'}).length+' de '+a.conds.length+' condições'})])}))));
  if(O.sombra.length)app.appendChild(el('p',{class:'suave mini',texto:'Em sombra (rodam sem aparecer): '+O.sombra.map(function(a){return a.nome}).join(', ')}));
}
function inCondLinha(c){
  var n=c.met||(c.cond&&c.cond.met)||'';
  return [IN_COND[c.estado]+' '+n,c.cond?(c.cond.op||'')+' '+(c.cond.ref!=null?String(c.cond.ref):(c.cond.limiar!=null?c.cond.limiar+(c.un==='pp'||/^tx|margem|desconto|custo|comissao/.test(n)?' p.p.':'%'):''))+' · janela '+(c.cond.janela||30)+' d':'',c.texto||c.motivo||'',c.n!=null?String(c.n):'—'];
}
function inCanvas(a,R,msg,ok){
  cabecalho(a.nome,(R.tipos[a.tipo]||a.tipo)+' · '+(IN_DIM[a.dimensao]||a.dimensao)+' · '+IN_ESTADO[a.estado]+(a.ligada?' · ligada desde '+(a.hist&&a.hist.desde?data(new Date(a.hist.desde).toISOString().slice(0,10)):'hoje'):'')).forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(el('div',{class:'barra'},[lk('← Voltar aos achados',function(){estado.inAchado=null;telaInteligencia()})]));
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var k=0;function bloco(t,filhos){k++;return el('div',{class:'cartao'},[el('h2',{texto:k+'. '+t})].concat(filhos))}
  /* 1 Problema */
  app.appendChild(bloco('Problema',[el('p',{texto:a.mecanismo||a.texto||a.acao||'—'}),a.composto?el('p',{class:'suave mini',texto:'Composto de: '+(a.componentes||[]).join(' + ')+(a.relacao?' · '+a.relacao:'')}):null,a.cobertoPor?el('p',{class:'suave mini',texto:'Faz parte do achado composto "'+a.cobertoPor+'".'}):null]));
  /* 2 Evidência */
  app.appendChild(bloco('Evidência',[a.conds.length?qTabela(['Condição','Regra','Observado','n'],a.conds.map(inCondLinha)):el('p',{class:'suave',texto:'Hipótese simples: avaliada pela fórmula do pack sobre o contexto de hoje.'}),a.faltando.length?el('p',{class:'erro mini',texto:'Sem dado: '+a.faltando.join(', ')}):null,el('p',{class:'suave mini',texto:'Aderência '+inPct(a.aderencia)+'. Variações entre percentuais em p.p.; demais em % relativo. Coortes terminam 30 dias antes de hoje.'})]));
  /* 3 Hipótese e confiança */
  app.appendChild(bloco('Hipótese e confiança',[el('p',{},[el('span',{class:'chip '+IN_CONF_C[a.confianca.nivel],texto:'Confiança '+a.confianca.nome.toLowerCase()})]),el('ul',{},a.confianca.criterios.map(function(c){return el('li',{class:'mini',texto:c})})),a.confianca.subir.length?el('p',{class:'suave mini',texto:'Para subir: '+a.confianca.subir.join('; ')}):null,el('p',{class:'suave mini',texto:'Isto é associação observada nos dados; o mecanismo é a hipótese. Associação não é causa.'})]));
  /* 4 Rivais */
  app.appendChild(bloco('Explicações rivais',[a.rivais.length?el('ul',{},a.rivais.map(function(r){return el('li',{},[lk(r.nome,function(){estado.inAchado=r.codigo;telaInteligencia()}),el('span',{class:'suave mini',texto:' · '+IN_ESTADO[r.estado]})])})):el('p',{class:'suave',texto:'Nenhuma explicação rival está ativa agora.'}),a.distingue?el('p',{class:'mini'},[el('strong',{texto:'O que distingue: '}),a.distingue]):null]));
  /* 5 Consequências */
  var imp=a.impacto;
  app.appendChild(bloco('Consequências',[imp?el('div',{},[el('div',{class:'valor',texto:reais(imp.valor)}),el('p',{class:'suave mini',texto:'em '+(IN_DIM[imp.dimensao]||imp.dimensao)+' · '+imp.texto}),imp.receitaBruta!=null?el('p',{class:'mini',texto:'Receita bruta envolvida '+reais(imp.receitaBruta)+' × margem '+inPct(imp.margemUsada)+' = contribuição.'}):null,el('ul',{},(imp.premissas||[]).map(function(p){return el('li',{class:'mini suave',texto:p})}))]):el('p',{class:'suave',texto:'Impacto em R$ não calculável com os dados de hoje.'}),a.contexto.length?el('p',{class:'mini'},[el('strong',{texto:'Contexto registrado no período: '}),a.contexto.map(function(e){return data(e.data)+' '+e.desc}).join(' · ')]):null]));
  /* 6 Restrições */
  app.appendChild(bloco('Restrições',[el('p',{class:'mini',texto:'Amostra mínima por condição: '+a.conds.map(function(c){return (c.met||'')+' n='+(c.n!=null?c.n:'—')}).join(', ')+'.'}),el('p',{class:'suave mini',texto:'A histerese segura o achado ligado até a condição voltar com folga por 14 dias; sem dado o estado é mantido.'})]));
  /* 7 Intervenções */
  app.appendChild(bloco('Intervenções',[a.intervencoes.length?qTabela(['Intervenção','Efeitos','Esforço','Elegibilidade'],a.intervencoes.map(function(i){return [i.nome,Object.keys(i.impacto||{}).map(function(d){return d+' '+i.impacto[d]}).join(' · '),String(i.esforco||2),R.elegibilidade[i.elegibilidade]||i.elegibilidade]})):el('p',{class:'suave',texto:'O pack não liga intervenções a esta hipótese.'}),el('p',{class:'mini'},[el('strong',{texto:'Ação sugerida: '}),a.acao||'—'])]));
  /* 8 Simulação */
  app.appendChild(bloco('Simulação',[el('p',{class:'suave',texto:'Leve o número para o "E se…?" para ver o efeito no resultado, tudo o mais constante.'}),el('div',{class:'barra'},[lk('Abrir o E se…?',function(){estado.aba='construtor';desenhar()}),lk('Ver as pessoas',function(){estado.inSub='pessoas';estado.inAchado=null;telaInteligencia()})])]));
  /* 9 Decisão */
  var m=R.marcas[a.codigo];
  var motivo=inp({placeholder:'por quê (opcional)'});
  function marcar(est){return async function(){try{await api(inBase()+'/marcas',{codigo:a.codigo,estado:est,motivo:motivo.value,ref:imp?imp.valor:null});telaInteligencia(est==='limpa'?'Marca removida.':'Marcado: '+IN_MARCA[est]+'.',true)}catch(e){telaInteligencia(e.message)}}}
  app.appendChild(bloco('Decisão',[m?el('p',{},[el('span',{class:'chip atencao',texto:IN_MARCA[m.estado]||m.estado}),el('span',{class:'suave mini',texto:' '+(m.motivo||'')+(m.por?' · '+m.por:'')+' · referência '+(m.ref!=null?reais(m.ref):'—')})]):el('p',{class:'suave',texto:'Sem marca. Marcar tira o achado da lista até o impacto crescer 1,5× em relação a hoje.'}),campo('Motivo',motivo),el('div',{class:'barra'},[lk('Em tratamento',marcar('tratamento')),lk('Aceito como está',marcar('aceito')),lk('Não procede',marcar('naoprocede')),m?lk('Limpar marca',marcar('limpa')):null]),
    el('div',{class:'barra'},[lk('Criar tarefa a partir deste achado',async function(){var t=prompt('Título da tarefa:',a.acao||a.nome);if(!t)return;var pz=prompt('Prazo (AAAA-MM-DD):',(function(){var x=new Date();x.setUTCDate(x.getUTCDate()+7);return x.toISOString().slice(0,10)})());if(!pz)return;try{await api('/admin/operacoes/'+encodeURIComponent(estado.slug)+'/tarefas',{titulo:t,prazo:pz,prioridade:imp&&imp.valor>0?'alta':'normal',descricao:(a.mecanismo||'')+(imp?' Impacto estimado: '+reais(imp.valor)+' em '+(IN_DIM[imp.dimensao]||imp.dimensao)+'.':''),origem:{tipo:'achado',chave:a.codigo}});telaInteligencia('Tarefa criada para o gestor. Para o time, atribua no Dia da pessoa.',true)}catch(e){telaInteligencia(e.message)}})]),
    el('details',{},[el('summary',{texto:'Calibrar esta regra'}),el('p',{class:'suave mini',texto:'Sombra: roda e registra, mas não aparece. Aposentada: deixa de ser avaliada.'}),el('div',{class:'barra'},[lk('Ativa',inRegra(a,{estado:'ativa'})),lk('Sombra',inRegra(a,{estado:'sombra'})),lk('Aposentar',inRegra(a,{estado:'aposentada'}))])])]));
  /* 10 Resultado e aprendizado */
  app.appendChild(bloco('Resultado e aprendizado',[el('p',{class:'suave',texto:'Registrar como experimento mede o antes e o depois e guarda na memória comercial.'}),el('div',{class:'barra'},[lk('Registrar decisão no canvas',function(){estado.aba='achados';desenhar()}),lk('Registrar como experimento',async function(){var mt=prompt('Métrica do experimento (uma variável do dicionário, ex.: taxa_ganho, desconto_medio, receita):','taxa_ganho');if(!mt)return;var v=prompt('Alvo (número; taxas em decimal, ex.: 0,25):');if(v==null)return;v=Number(String(v).replace(',','.'));if(!isFinite(v))return telaInteligencia('Alvo inválido.');try{await api('/admin/operacoes/'+encodeURIComponent(estado.slug)+'/experimentos'+qs(),{titulo:a.nome,metrica:mt,alvo:v,hipoteseId:a.codigo});telaInteligencia('Experimento iniciado.',true)}catch(e){telaInteligencia(e.message)}})])]));
}
function inRegra(a,b){return async function(){try{await api(inBase()+'/regras/'+encodeURIComponent(a.codigo),b);telaInteligencia('Regra atualizada: '+b.estado+'.',true)}catch(e){telaInteligencia(e.message)}}}
/* ---------- Quem precisa de quê? ---------- */
function inPer(){var q=qs();var p=[];if(estado.inDe)p.push('de='+estado.inDe);if(estado.inAte)p.push('ate='+estado.inAte);if(estado.inMinN)p.push('minN='+estado.inMinN);return q+(p.length?(q?'&':'?')+p.join('&'):'')}
async function inPessoas(msg,ok){
  var P=await api(inBase()+'/pessoas'+inPer());
  cabecalho('Quem precisa de quê?','Coorte de '+P.coorte+' negócios criados entre '+data(P.periodo.de)+' e '+data(P.periodo.ate)+'. Benchmark = quartil superior dos vendedores com n ≥ '+P.minN+' na etapa. Receita potencial simulada: não é receita garantida.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(inSub());app.appendChild(controles());
  var de=el('input',{type:'date',value:estado.inDe||P.periodo.de}),ate=el('input',{type:'date',value:estado.inAte||P.periodo.ate}),mn=inp({inputmode:'numeric',value:String(estado.inMinN||P.minN),style:'max-width:5em'});
  app.appendChild(el('div',{class:'barra'},[el('label',{texto:'De '}),de,el('label',{texto:'até '}),ate,el('label',{texto:'n mínimo '}),mn,lk('Aplicar',function(){estado.inDe=de.value;estado.inAte=ate.value;estado.inMinN=mn.value;estado.inPessoa=null;telaInteligencia()})]));
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  if(!P.pessoas.length){app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Nenhum negócio com dono na coorte.'}),el('p',{class:'suave',texto:P.semDono?P.semDono+' negócio(s) sem dono: a análise por pessoa precisa do responsável em cada negócio (conector ou planilha).':'Amplie o período ou confira a fonte de negócios.'})]));return}
  if(estado.inPessoa)return inPessoa(P,estado.inPessoa);
  var E=P.etapas.map(function(e){return e.nome});
  /* principal gargalo */
  var g=P.principal;
  app.appendChild(qSecao('Principal gargalo',[g?el('div',{},[el('p',{},[el('strong',{texto:g.de+' → '+g.para}),' em '+inPct(g.conv)+' · benchmark '+inPct(g.bench)+' · volume '+g.volume]),el('div',{class:'valor',texto:reais(g.total)}),el('p',{class:'suave mini',texto:'receita potencial simulada se quem está abaixo chegasse ao quartil superior nesta etapa'}),g.afetados.length?el('p',{class:'mini',texto:'Abaixo do benchmark: '+g.afetados.map(function(x){return x.v+' ('+inPct(x.de)+', +'+reais(x.ganho)+')'}).join(', ')}):null,lk('Ver de onde vem',function(){inDrill(P,g.i)})]):el('p',{class:'suave',texto:'Sem gargalo mensurável: ou todos estão no benchmark, ou falta amostra (mínimo n='+P.minN+' por etapa).'})]));
  /* alertas */
  var AL={gargalo:'Gargalo',oport:'Oportunidade',anom:'Anomalia',tend:'Tendência'};
  app.appendChild(qSecao('Alertas de inteligência',[P.alertas.length?el('ul',{},P.alertas.slice(0,8).map(function(a){return el('li',{},[el('span',{class:'chip '+(a.t==='oport'?'no_ritmo':a.t==='tend'?'sem':'atencao'),texto:AL[a.t]}),' ',a.pessoa?lk(a.txt,function(){estado.inPessoa=a.pessoa;telaInteligencia()}):el('span',{texto:a.txt})])})):el('p',{class:'suave',texto:'Nenhum desvio relevante com a amostra atual.'}),el('p',{class:'suave mini',texto:'Desvios calculados sobre os dados; associação não é causa.'})]));
  /* funil da equipe com benchmark e potencial */
  app.appendChild(qSecao('Funil da equipe, etapa por etapa',[qTabela(['Etapa','Volume','Conversão','Benchmark (p75 · mediana)','Receita potencial'],E.map(function(e,i){var c=i?P.equipe.conv[i-1]:null,b=i?P.bench[i-1]:null,gg=i?P.gargalos.filter(function(x){return x.i===i-1})[0]:null;return [i?lk(e,function(){inDrill(P,i-1)}):e,String(P.equipe.N[i]),i?inPct(c):'—',b&&b.p75!=null?inPct(b.p75)+' · '+inPct(b.mediana):'—',gg&&gg.total>0?reais(gg.total):'—']})),el('p',{class:'suave mini',texto:'Total potencial (soma de efeitos isolados): '+reais(P.potencialTotal)+'. Toque numa etapa para ver por pessoa, canal, mês e segmento.'})]));
  /* pessoas */
  app.appendChild(qSecao('Pessoas',[qTabela(['Pessoa','Entradas','Vendas','Conversão total','Ticket','Potencial','Pontos fortes'],P.pessoas.map(function(p){return [lk(p.nome,function(){estado.inPessoa=p.nome;telaInteligencia()}),String(p.funil.N[0]),String(p.funil.vendas),inPct(p.funil.total),brlT(p.funil.ticket),p.potencialTotal>0?'+'+reais(p.potencialTotal):'—',p.fortes.length?p.fortes.join('; '):'—']}))]));
  /* matriz */
  var M=P.matriz;
  app.appendChild(qSecao('Matriz volume × eficiência',[el('p',{class:'suave mini',texto:'Volume = entradas na coorte (mediana '+(M.mX!=null?M.mX:'—')+'); eficiência = conversão entrada → venda (mediana '+inPct(M.mY)+'). Cada quadrante sugere uma investigação, não um julgamento.'}),qTabela(['Pessoa','Volume','Eficiência','Quadrante','Hipótese de investigação'],M.pts.map(function(p){return [p.v,String(p.x),inPct(p.y),p.quadrante,p.hipotese]}))]));
  /* sensibilidade */
  var S=P.sensibilidade;
  app.appendChild(qSecao('Qual variável mais impacta a receita?',[el('p',{class:'suave mini',texto:'Cada variável +10% (relativo), as demais fixas. Base '+reais(S.base)+'. Numa multiplicação, +10% em qualquer taxa dá o mesmo efeito; a diferença real está em quanto cada taxa ainda pode subir.'}),qTabela(['Variável','Atual','+10%','Se chegar ao benchmark'],S.linhas.map(function(l){return [l.nome,l.k==='tk'?brlT(l.atual):l.k==='vol'?String(l.atual):inPct(l.atual),'+'+reais(l.impacto),l.bench!=null?'+'+reais(l.bench):'—']}))]));
}
async function inDrill(P,i){
  var D=await api(inBase()+'/pessoas/drill'+inPer()+'&i='+i+(estado.inPessoa?'&foco='+encodeURIComponent(estado.inPessoa):''));
  limpar();app.appendChild(abas());
  cabecalho(D.de+' → '+D.para,inPct(D.conv)+' de '+D.n+' que chegaram em "'+D.de+'" avançaram. Benchmark (quartil superior) '+inPct(D.bench)+'. Receita potencial simulada '+reais(D.potencial)+'.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(el('div',{class:'barra'},[lk('← Voltar',function(){telaInteligencia()}),lk('Ver os leads por trás',function(){inLeads(i)})]));
  var tab=function(t,L){return qSecao(t,[qTabela([t,'Entraram','Avançaram','Conversão','IC 95%'],L.map(function(l){return [l.chave,String(l.n),String(l.avancaram),inPct(l.conv),l.ic?inPct(l.ic.baixo)+'–'+inPct(l.ic.alto):'—']}))])};
  if(D.grupos.pessoa)app.appendChild(tab('Pessoa',D.grupos.pessoa));app.appendChild(tab('Canal',D.grupos.canal));app.appendChild(tab('Mês de entrada',D.grupos.mes));app.appendChild(tab('Segmento',D.grupos.segmento));
}
async function inLeads(i){
  var L=await api(inBase()+'/pessoas/leads'+inPer()+'&i='+i+(estado.inPessoa?'&foco='+encodeURIComponent(estado.inPessoa):''));
  limpar();app.appendChild(abas());
  cabecalho(L.etapa+': '+L.total+' lead'+(L.total===1?'':'s'),'Da coorte do período, chegaram em "'+L.etapa+'" ou passaram dela. Estão nela agora: '+L.nela+'.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(el('div',{class:'barra'},[lk('← Voltar',function(){telaInteligencia()})]));
  app.appendChild(qTabela(['Lead','Etapa atual','Pessoa','Canal','Entrou','Chegou na etapa'],L.leads.map(function(l){return [l.nome||l.id.slice(0,8),l.status==='ganho'?'Ganho':l.status==='perdido'?'Perdido':(l.etapaAtual||'—'),l.pessoa||'—',l.canal||'—',data(new Date(l.criadoEm).toISOString().slice(0,10)),l.chegouEm?data(new Date(l.chegouEm).toISOString().slice(0,10)):'—']})));
}
async function inPessoa(P,v){
  var cmp=estado.inCmp||'equipe';
  var C=await api(inBase()+'/pessoas/comparar'+inPer()+'&v='+encodeURIComponent(v)+'&cmp='+encodeURIComponent(cmp));
  var E=C.E;
  app.appendChild(el('div',{class:'barra'},[lk('← Todas as pessoas',function(){estado.inPessoa=null;telaInteligencia()})]));
  app.appendChild(el('h2',{texto:v}));
  var s=sel(P.comparacoes.filter(function(x){return x!==v}).map(function(x){return [x,x==='equipe'?'Equipe':x==='mediana'?'Mediana dos vendedores':x==='p75'?'Quartil superior':x]}),cmp,{'aria-label':'Comparar com',onchange:function(){estado.inCmp=s.value;telaInteligencia()}});
  app.appendChild(el('div',{class:'barra'},[el('label',{texto:'Comparar com '}),s]));
  app.appendChild(qSecao('Pontos fortes',[C.fortes.length?el('ul',{},C.fortes.map(function(f){return el('li',{texto:f})})):el('p',{class:'suave',texto:'Nenhuma etapa no quartil superior com amostra.'})]));
  app.appendChild(qSecao('Funil contra '+C.fonte.nome,[qTabela(['Etapa','Volume','Conversão','Fonte','Diferença','Potencial'],E.map(function(e,i){var c=i?C.funil.conv[i-1]:null,f=i?C.fonte.conv[i-1]:null,p=i?C.potencial[i-1]:null;return [i?lk(e,function(){inDrill(P,i-1)}):e,String(C.funil.N[i])+(i&&C.fonte.N[i]!=null?' / '+n1(C.fonte.N[i]):''),i?inPct(c):'—',i?inPct(f):'—',i&&c!=null&&f!=null?inPP((c-f)*100):'—',p&&p.ganho>0?'+'+reais(p.ganho):'—']})),el('p',{class:'suave mini',texto:'Ticket '+brlT(C.funil.ticket)+' contra '+brlT(C.fonte.ticket)+' · ciclo '+n1(C.funil.ciclo)+' d contra '+n1(C.fonte.ciclo)+' d.'})]));
  var S=C.sensibilidade;
  app.appendChild(qSecao('Impacto potencial',[el('p',{texto:'Se todas as etapas abaixo do benchmark chegassem ao quartil superior: +'+reais(C.potencial.reduce(function(a,p){return a+p.ganho},0))+' de receita potencial simulada.'}),qTabela(['Variável','Atual','+10%','Se chegar ao benchmark'],S.linhas.map(function(l){return [l.nome,l.k==='tk'?brlT(l.atual):l.k==='vol'?String(l.atual):inPct(l.atual),'+'+reais(l.impacto),l.bench!=null?'+'+reais(l.bench):'—']}))]));
  /* transferência */
  var fonte=estado.inTrB||P.comparacoes.filter(function(x){return x!==v&&x!=='equipe'})[0]||'p75';
  var T=await api(inBase()+'/pessoas/transferir'+inPer(),{a:v,b:fonte,marcadas:estado.inTrV||[]});
  var sb=sel(P.comparacoes.filter(function(x){return x!==v&&x!=='equipe'}).map(function(x){return [x,x==='mediana'?'Mediana dos vendedores':x==='p75'?'Quartil superior':x]}),fonte,{'aria-label':'Performance de',onchange:function(){estado.inTrB=sb.value;telaInteligencia()}});
  var marc=estado.inTrV||[];
  app.appendChild(qSecao('E se '+v+' tivesse a performance de outro?',[el('div',{class:'barra'},[el('label',{texto:'Performance de '}),sb]),qTabela(['Aplicar','Variável',v,'Fonte','Receita simulada','Incremento'],T.linhas.map(function(l){var cb=el('input',{type:'checkbox','aria-label':l.nome,onchange:function(){var m=(estado.inTrV||[]).slice();if(cb.checked)m.push(l.k);else m=m.filter(function(x){return x!==l.k});estado.inTrV=m;telaInteligencia()}});if(marc.indexOf(l.k)>=0)cb.setAttribute('checked','');var f=function(x){return l.k==='vol'?n1(x):l.k==='tk'?brlT(x):inPct(x)};return [cb,l.nome,f(l.de),f(l.para),reais(l.receita),(l.incremento>=0?'+':'−')+reais(Math.abs(l.incremento))+(l.pct!=null?' ('+inPP(l.pct*100).replace(' p.p.','%')+')':'')]})),el('p',{},[el('strong',{texto:'Combinação marcada ('+marc.length+'): '}),reais(T.combinacao.receita)+' contra '+reais(T.base)+' atual ('+(T.combinacao.incremento>=0?'+':'−')+reais(Math.abs(T.combinacao.incremento))+')'])]));
  /* meta reversa */
  var meta=inp({inputmode:'decimal',placeholder:'meta de receita',value:estado.inMeta||''});
  var caixa=el('div',{});
  app.appendChild(qSecao('Como '+v+' atinge uma meta?',[el('div',{class:'barra'},[meta,lk('Calcular',async function(){estado.inMeta=meta.value;var R=await api(inBase()+'/pessoas/meta'+inPer()+'&meta='+encodeURIComponent(meta.value)+'&foco='+encodeURIComponent(v));while(caixa.firstChild)caixa.removeChild(caixa.firstChild);if(!R)return caixa.appendChild(el('p',{class:'suave',texto:'Precisa de meta maior que zero e ao menos uma venda para existir ticket.'}));caixa.appendChild(el('p',{texto:reais(R.meta)+' ÷ ticket '+reais(R.ticket)+' = '+R.vendas+' vendas'}));caixa.appendChild(qTabela(['Etapa','Necessário','Tem','Faltam'],R.necessarios.map(function(n){return [n.etapa,n.necessario==null?'impossível: taxa 0%':String(n.necessario),String(n.tem),n.faltam==null?'—':String(n.faltam)]})))})]),caixa]));
}
/* ---------- Dá para confiar? ---------- */
async function inSaude(msg,ok){
  var R=await api(inBase()+qs()),A=await api(inBase()+'/acuracia'+qs()),W=await api(inBase()+'/waterfall'+qs());
  cabecalho('Dá para confiar?','Saúde da inteligência, acurácia do forecast e de onde veio a mudança de resultado.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(inSub());app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var S=R.saude;
  app.appendChild(qSecao('Saúde da inteligência',[qTabela(['Indicador','Valor','Leitura'],[['Regras avaliadas',String(S.regras),S.ativas+' ativas · '+S.naoAvaliaveis+' sem fonte'],['Cobertura',inPct(S.cobertura),'regras que conseguem ser avaliadas com as fontes de hoje'],['Utilidade',S.utilidade==null?'—':inPct(S.utilidade),'achados marcados como úteis ÷ (úteis + não procede)'],['Taxa de intervenção',S.taxaIntervencao==null?'—':inPct(S.taxaIntervencao),'disparos que viraram experimento'],['Ciclos completos',String(S.ciclosCompletos||0),'experimentos concluídos'],['Confirmação',S.taxaConfirmacao==null?'—':inPct(S.taxaConfirmacao),'experimentos que confirmaram a hipótese']]),el('p',{class:'suave mini',texto:'Marque os achados (em tratamento, aceito, não procede) para a utilidade ter base.'})]));
  var G=A.geral;
  app.appendChild(qSecao('Acurácia do forecast',[G?el('div',{},[el('p',{},[el('strong',{texto:'Erro médio '+inPct(G.erroAbs)}),' · viés '+(G.vies!=null?(G.vies>0?'+':'')+inPct(G.vies):'—')+' ('+G.direcao+') · '+(G.confiavel?'confiável (erro < 15%)':'ainda não confiável')]),qTabela(['Antecedência','Erro médio'],[['30 dias',G.a30!=null?inPct(G.a30):'—'],['15 dias',G.a15!=null?inPct(G.a15):'—'],['7 dias',G.a7!=null?inPct(G.a7):'—']])]):el('p',{class:'suave',texto:A.nota||'Sem ciclos encerrados com fotos.'}),A.ciclos.length?qTabela(['Ciclo','Fotos','Real','Erro médio','Viés'],A.ciclos.map(function(c){return [data(c.ciclo.inicio),String(c.fotos),reais(c.real),c.acuracia.erroAbs!=null?inPct(c.acuracia.erroAbs):'—',c.acuracia.vies!=null?(c.acuracia.vies>0?'+':'')+inPct(c.acuracia.vies):'—']})):null,el('p',{class:'suave mini',texto:'Cada Fechamento do dia guarda a projeção ajustada; no fim do ciclo comparamos com o realizado. Viés positivo = otimista.'})]));
  var r=W.receita;
  app.appendChild(qSecao('De onde veio a mudança de receita? ('+data(W.anterior.ciclo.inicio)+' → '+data(W.atual.ciclo.inicio)+')',[qTabela(['','Anterior','Atual'],[['Vendas',String(W.anterior.vendas),String(W.atual.vendas)],['Ticket',brlT(W.anterior.ticket),brlT(W.atual.ticket)],['Receita',reais(W.anterior.receita),reais(W.atual.receita)]]),el('p',{texto:'Efeito volume '+(r.volume>=0?'+':'−')+reais(Math.abs(r.volume))+' · efeito ticket '+(r.ticket>=0?'+':'−')+reais(Math.abs(r.ticket))+' · total '+(r.total>=0?'+':'−')+reais(Math.abs(r.total))}),W.margem?qTabela(['Efeito na margem','Valor'],[['Preço',reais(W.margem.efeitos.preco)],['Custo',reais(W.margem.efeitos.custo)],['Comissão',reais(W.margem.efeitos.comissao)],['Impostos',reais(W.margem.efeitos.imposto)],['Taxas',reais(W.margem.efeitos.taxa)],['Margem: de → para',reais(W.margem.de)+' → '+reais(W.margem.para)]]):el('p',{class:'suave mini',texto:W.nota||''})]));
}
/* ---------- Diário de contexto ---------- */
async function inContexto(msg,ok){
  var C=await api(inBase()+'/contexto'+qs());
  cabecalho('O que aconteceu fora dos números?','Campanha, feriado, troca no time, reajuste, promoção: registre aqui. Os achados da área mostram o contexto do período e a confiança leva em conta.').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(inSub());app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var dt=el('input',{type:'date',value:estado.data||new Date().toISOString().slice(0,10)}),desc=inp({placeholder:'o que aconteceu',maxlength:'500'});
  var chks=C.areas.map(function(a){var cb=el('input',{type:'checkbox',value:a});return el('label',{class:'mini'},[cb,' '+a])});
  app.appendChild(qSecao('Registrar',[campo('Quando',dt),campo('O que aconteceu',desc),el('div',{class:'barra'},chks),el('div',{class:'barra'},[lk('Registrar',async function(){var areas=chks.map(function(l){return l.firstChild}).filter(function(c){return c.checked}).map(function(c){return c.value});try{await api(inBase()+'/contexto',{data:dt.value,areas:areas,descricao:desc.value});telaInteligencia('Registrado.',true)}catch(e){telaInteligencia(e.message)}})])]));
  app.appendChild(qSecao('Últimos 120 dias',[C.eventos.length?qTabela(['Data','Áreas','O que aconteceu','Por',''],C.eventos.map(function(e){return [data(e.data),(e.areas||[]).join(', ')||'—',e.desc,e.por||'—',lk('Apagar',async function(){if(!confirm('Apagar este registro?'))return;try{await api(inBase()+'/contexto/'+e.id+'/apagar',{});telaInteligencia('Apagado.',true)}catch(x){telaInteligencia(x.message)}})]})):el('p',{class:'suave',texto:'Nenhum registro ainda.'})]));
}
`;
