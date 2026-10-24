/* Tela do LAB V2 (fase 4): uma pergunta por tela, detalhe só quando pedido.
   Página estática, sem dados: tudo é buscado na API. Entra com e-mail e senha (Supabase, via /auth/entrar)
   ou, enquanto o login não estiver configurado, com o ADMIN_TOKEN. A sessão fica só na aba (sessionStorage). Todo texto vindo da API entra por textContent. */

export const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LAB</title>
<style>
:root{--fundo:#f6f7f9;--cartao:#fff;--texto:#16181d;--suave:#5b6270;--linha:#e3e6ec;--ok:#0f7b3f;--ok-f:#e3f4ea;--at:#8a5a00;--at-f:#fff1d6;--ruim:#b3261e;--ruim-f:#fde8e6;--foco:#2457d6}
@media (prefers-color-scheme:dark){:root{--fundo:#101215;--cartao:#181b20;--texto:#eef0f3;--suave:#9aa3b2;--linha:#2a2f37;--ok:#6fd49a;--ok-f:#12301f;--at:#f2c46b;--at-f:#35280b;--ruim:#ff9a92;--ruim-f:#3a1614;--foco:#8aa9ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--texto);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:1.35rem;margin:0 0 4px}
p{margin:0 0 12px}
.suave{color:var(--suave);font-size:.92rem}
.cartao{background:var(--cartao);border:1px solid var(--linha);border-radius:12px;padding:16px;margin:12px 0}
.barra{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
select,input,button{font:inherit;color:inherit;background:var(--cartao);border:1px solid var(--linha);border-radius:8px;padding:10px 12px;min-height:44px}
button{cursor:pointer}button.primario{background:var(--foco);border-color:var(--foco);color:#fff}
:focus-visible{outline:3px solid var(--foco);outline-offset:2px}
.grande{font-size:2.2rem;font-weight:700;line-height:1.1}
.pessoa{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;margin:8px 0}
.chip{display:inline-block;border-radius:999px;padding:2px 10px;font-size:.85rem;font-weight:600;white-space:nowrap}
.no_ritmo{background:var(--ok-f);color:var(--ok)}.atencao{background:var(--at-f);color:var(--at)}.atras{background:var(--ruim-f);color:var(--ruim)}.sem{background:var(--linha);color:var(--suave)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 4px;border-bottom:1px solid var(--linha);font-size:.95rem}
.erro{color:var(--ruim);font-weight:600}.ok{color:var(--ok);font-weight:600}.abas{display:flex;gap:8px;margin:0 0 4px;flex-wrap:wrap}.passo{display:flex;gap:10px;align-items:center;padding:6px 0}.num{display:inline-flex;width:28px;height:28px;border-radius:50%;align-items:center;justify-content:center;font-weight:700;border:2px solid var(--linha);flex:none}.num.feito{background:var(--ok-f);border-color:var(--ok);color:var(--ok)}.num.agora{border-color:var(--foco);color:var(--foco)}.cenarios{display:grid;gap:8px}.mini{font-size:.9rem}.abas button[aria-current=page]{border-color:var(--foco);font-weight:700}form.linha{display:flex;gap:8px;flex-wrap:wrap;align-items:end}label{display:block;font-size:.85rem;color:var(--suave)}
</style>
</head>
<body>
<main id="app" aria-live="polite"></main>
<script>
(function(){
var app=document.getElementById('app');
var NOMES={receita:'Receita (R$)',vendas:'Vendas',oportunidades:'Oportunidades',reuniao_realizada:'Reuniões feitas',agendamento:'Agendamentos',contato:'Contatos',tentativa:'Tentativas',proposta_enviada:'Propostas enviadas'};
var ROTULO={no_ritmo:'No ritmo',atencao:'Atenção',atras:'Atrás'};
var PIOR={atras:3,atencao:2,no_ritmo:1};
var estado={ops:null,slug:null,data:null,pessoa:null,aba:'ritmo',passoQ:null,viuDiag:false};
var FUNCOES={sdr:'SDR (prospecta e agenda)',closer:'Closer (fecha)',ambos:'SDR e closer',cs:'Sucesso do cliente',gestor:'Gestor',outro:'Outro'};
function guardar(k,v){try{if(v==null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){}}
function ler(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
function el(tag,attrs,filhos){var n=document.createElement(tag);for(var k in (attrs||{})){if(k==='class')n.className=attrs[k];else if(k==='texto')n.textContent=attrs[k];else if(k.slice(0,2)==='on')n.addEventListener(k.slice(2),attrs[k]);else n.setAttribute(k,attrs[k])}(filhos||[]).forEach(function(f){if(f)n.appendChild(typeof f==='string'?document.createTextNode(f):f)});return n}
function limpar(){while(app.firstChild)app.removeChild(app.firstChild)}
function numero(n){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n)}
function data(d){var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function chip(s){return el('span',{class:'chip '+(s||'sem'),texto:s?ROTULO[s]:'Sem meta'})}
async function renovarSessao(){
  var rt=ler('refresh');if(!rt)return false;
  try{var r=await fetch('/auth/renovar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refreshToken:rt})});
    if(!r.ok)return false;var s=await r.json();guardar('token',s.accessToken);guardar('refresh',s.refreshToken);return true}catch(e){return false}
}
async function api(caminho,corpo,tentou){
  var o={headers:{authorization:'Bearer '+(ler('token')||'')}};
  if(corpo){o.method='POST';o.headers['content-type']='application/json';o.body=JSON.stringify(corpo)}
  var r=await fetch(caminho,o);
  if(r.status===401){if(!tentou&&await renovarSessao())return api(caminho,corpo,true);guardar('token',null);guardar('refresh',null);throw new Error('401')}
  if(!r.ok){var c={};try{c=await r.json()}catch(e){}throw new Error(c.erro||('erro '+r.status))}
  return r.json();
}
async function loginAtivo(){try{var r=await fetch('/auth/config');return (await r.json()).login===true}catch(e){return false}}
async function telaEntrada(msg){
  limpar();
  var comEmail=await loginAtivo();
  app.appendChild(el('h1',{texto:'LAB'}));
  if(msg)app.appendChild(el('p',{class:'erro',texto:msg}));
  if(comEmail){
    var em=el('input',{type:'email',id:'em',autocomplete:'username','aria-label':'E-mail'});
    var se=el('input',{type:'password',id:'se',autocomplete:'current-password','aria-label':'Senha'});
    app.appendChild(el('p',{class:'suave',texto:'Entre com seu e-mail e sua senha.'}));
    app.appendChild(el('form',{onsubmit:async function(e){e.preventDefault();
      try{var r=await fetch('/auth/entrar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:em.value.trim(),senha:se.value})});
        if(!r.ok)return telaEntrada('E-mail ou senha incorretos.');
        var s=await r.json();guardar('token',s.accessToken);guardar('refresh',s.refreshToken);iniciar()}
      catch(x){telaEntrada('Não consegui falar com o servidor.')}}},[el('p',{},[em]),el('p',{},[se]),el('button',{class:'primario',type:'submit',texto:'Entrar'})]));
    return;
  }
  var campo=el('input',{type:'password',id:'tk',autocomplete:'current-password','aria-label':'Chave de acesso'});
  app.appendChild(el('p',{class:'suave',texto:'Digite a chave de acesso (o ADMIN_TOKEN). Ela fica guardada só nesta aba do navegador.'}));
  app.appendChild(el('form',{onsubmit:function(e){e.preventDefault();guardar('token',campo.value.trim());iniciar()}},[campo,' ',el('button',{class:'primario',type:'submit',texto:'Entrar'})]));
}
function cabecalho(titulo,sub){
  return [el('h1',{texto:titulo}),sub?el('p',{class:'suave',texto:sub}):null];
}
function controles(){
  var sel=el('select',{'aria-label':'Operação',onchange:function(){estado.slug=sel.value;estado.pessoa=null;guardar('slug',estado.slug);desenhar()}},
    estado.ops.map(function(o){var op=el('option',{value:o.slug,texto:o.nome});if(o.slug===estado.slug)op.selected=true;return op}));
  var dt=el('input',{type:'date','aria-label':'Dia',value:estado.data||'',onchange:function(){estado.data=dt.value||null;estado.pessoa=null;desenhar()}});
  var hoje=el('button',{type:'button',texto:'Hoje',onclick:function(){estado.data=null;estado.pessoa=null;desenhar()}});
  var sair=el('button',{type:'button',texto:'Sair',onclick:function(){guardar('token',null);guardar('refresh',null);iniciar()}});
  return el('div',{class:'barra'},[estado.ops.length>1?sel:null,dt,hoje,sair]);
}
function abas(){
  function b(id,t){var x=el('button',{type:'button',texto:t,onclick:function(){estado.aba=id;estado.pessoa=null;desenhar()}});if(estado.aba===id)x.setAttribute('aria-current','page');return x}
  return el('div',{class:'abas'},[b('ritmo','Ritmo'),b('equipe','Equipe e metas'),b('quarter','Quarter'),b('fechamento','Fechamento')]);
}
function agrupar(linhas){
  var por={};
  linhas.forEach(function(l){var k=l.pessoaId||'_op';(por[k]=por[k]||{id:k,nome:l.pessoa||'Operação',linhas:[]}).linhas.push(l)});
  return Object.keys(por).map(function(k){var g=por[k];g.status=g.linhas.reduce(function(a,l){return (PIOR[l.status]||0)>(PIOR[a]||0)?l.status:a},null);return g});
}
async function desenhar(){
  limpar();
  if(estado.aba==='equipe')return telaEquipe();
  if(estado.aba==='quarter')return telaQuarter();
  if(estado.aba==='fechamento')return telaFechamento();
  app.appendChild(el('p',{class:'suave',texto:'Carregando…'}));
  var q=estado.data?('?data='+encodeURIComponent(estado.data)):'';
  var r;
  try{r=await api('/admin/operacoes/'+encodeURIComponent(estado.slug)+'/ritmo'+q)}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');limpar();app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  estado.data=estado.data||r.hoje;
  limpar();
  var grupos=agrupar(r.linhas);
  if(estado.pessoa){var g=grupos.filter(function(x){return x.id===estado.pessoa})[0];if(g)return detalhe(g,r)}
  tela(grupos,r);
}
function tela(grupos,r){
  var pessoas=grupos.filter(function(g){return g.id!=='_op'});
  var comMeta=pessoas.filter(function(g){return g.status});
  var certos=comMeta.filter(function(g){return g.status==='no_ritmo'}).length;
  app.appendChild(abas());
  cabecalho('O time está no ritmo?','Dia '+data(r.hoje)+' · dia útil '+r.ciclo.diasUteisPassados+' de '+r.ciclo.diasUteis+' do ciclo').forEach(function(n){if(n)app.appendChild(n)});
  app.appendChild(controles());
  if(!grupos.length){
    app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Ainda não há metas neste ciclo.'}),el('p',{class:'suave',texto:'Cadastre as metas (por exemplo, tentativas por pessoa) e esta tela passa a mostrar quem está no ritmo.'})]));
    return;
  }
  app.appendChild(el('div',{class:'cartao'},[
    el('div',{class:'grande',texto:comMeta.length?(certos+' de '+comMeta.length):'—'}),
    el('p',{texto:comMeta.length?(certos===comMeta.length?'pessoas estão no ritmo.':'pessoas estão no ritmo. Toque numa pessoa para ver o porquê.'):'Nenhuma pessoa tem meta neste ciclo.'})
  ]));
  var ordem=pessoas.slice().sort(function(a,b){return (PIOR[b.status]||0)-(PIOR[a.status]||0)||a.nome.localeCompare(b.nome)});
  ordem.forEach(function(g){
    app.appendChild(el('button',{class:'pessoa',type:'button',onclick:function(){estado.pessoa=g.id;desenhar()}},[el('span',{texto:g.nome}),chip(g.status)]));
  });
  var op=grupos.filter(function(g){return g.id==='_op'})[0];
  if(op)app.appendChild(el('button',{class:'pessoa',type:'button',onclick:function(){estado.pessoa='_op';desenhar()}},[el('span',{texto:'Operação inteira'}),chip(op.status)]));
}
function detalhe(g,r){
  app.appendChild(el('button',{type:'button',texto:'← Voltar',onclick:function(){estado.pessoa=null;desenhar()}}));
  cabecalho(g.nome==='operação'?'Operação inteira':g.nome,'Dia '+data(r.hoje)).forEach(function(n){if(n)app.appendChild(n)});
  var linhas=g.linhas.map(function(l){
    return el('tr',{},[el('td',{texto:NOMES[l.indicador]||l.indicador}),el('td',{texto:numero(l.realizadoNoCiclo)+' de '+numero(l.esperadoAteHoje)}),el('td',{},[chip(l.status)]),el('td',{texto:l.planoAmanha==null?'—':numero(l.planoAmanha)})]);
  });
  var tabela=el('table',{},[el('thead',{},[el('tr',{},['O que','Feito / esperado até hoje','Ritmo','Plano p/ amanhã'].map(function(t){return el('th',{texto:t})}))]),el('tbody',{},linhas)]);
  app.appendChild(el('div',{class:'cartao'},[tabela]));
  app.appendChild(el('p',{class:'suave',texto:'“Esperado” divide a meta do ciclo igualmente pelos dias úteis. “Plano p/ amanhã” é quanto fazer por dia, daqui para frente, para ainda bater a meta.'}));
}
async function telaEquipe(msg,ok){
  limpar();
  var pes,ci;
  try{
    var base='/admin/operacoes/'+encodeURIComponent(estado.slug);
    pes=await api(base+'/pessoas');ci=await api(base+'/ciclo'+(estado.data?('?data='+encodeURIComponent(estado.data)):''));
  }catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'Equipe e metas'}));
  app.appendChild(el('p',{class:'suave',texto:'Ciclo de '+data(ci.ciclo.inicio)+' a '+data(ci.ciclo.fim)+' · '+ci.ciclo.diasUteis+' dias úteis'}));
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  /* equipe */
  var lista=pes.map(function(p){
    return el('div',{class:'pessoa'},[el('span',{texto:p.nome+' · '+(FUNCOES[p.funcao]||p.funcao||'—')+(p.ativa?'':' (inativa)')}),
      el('button',{type:'button',texto:p.ativa?'Desativar':'Reativar',onclick:async function(){try{await api(base+'/pessoas/'+p.id,{ativa:!p.ativa});telaEquipe()}catch(e){telaEquipe(e.message)}}})]);
  });
  var nome=el('input',{type:'text',id:'pn',maxlength:'120',autocomplete:'off'});
  var fun=el('select',{id:'pf'},Object.keys(FUNCOES).map(function(k){return el('option',{value:k,texto:FUNCOES[k]})}));
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Quem está no time'}),pes.length?null:el('p',{class:'suave',texto:'Ninguém cadastrado ainda.'})].concat(lista).concat([
    el('form',{class:'linha',onsubmit:async function(e){e.preventDefault();try{await api(base+'/pessoas',{nome:nome.value,funcao:fun.value});telaEquipe('Pessoa adicionada.',true)}catch(x){telaEquipe(x.message)}}},
      [el('div',{},[el('label',{for:'pn',texto:'Nome'}),nome]),el('div',{},[el('label',{for:'pf',texto:'Função'}),fun]),el('button',{class:'primario',type:'submit',texto:'Adicionar'})])])));
  /* metas */
  var nomes={};pes.forEach(function(p){nomes[p.id]=p.nome});
  var ativas=pes.filter(function(p){return p.ativa});
  var ind=el('select',{id:'mi'},Object.keys(NOMES).map(function(k){return el('option',{value:k,texto:NOMES[k]})}));
  var quem=el('select',{id:'mq'},[el('option',{value:'',texto:'Operação inteira'})].concat(ativas.map(function(p){return el('option',{value:p.id,texto:p.nome})})));
  var val=el('input',{type:'number',id:'mv',min:'0',step:'any',inputmode:'decimal'});
  var vig=ci.metas.map(function(m){return el('tr',{},[el('td',{texto:m.pessoaId?(nomes[m.pessoaId]||'—'):'Operação inteira'}),el('td',{texto:NOMES[m.indicador]||m.indicador}),el('td',{texto:numero(m.valor)})])});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Metas do ciclo'}),
    el('p',{class:'suave',texto:'A meta é para o ciclo inteiro. Para mudar, salve outro valor: vale o mais recente e o anterior fica guardado.'}),
    el('form',{class:'linha',onsubmit:async function(e){e.preventDefault();
      var v=Number(val.value);if(!(v>=0)||val.value==='')return telaEquipe('Informe um valor.');
      try{await api(base+'/metas'+(estado.data?('?data='+encodeURIComponent(estado.data)):''),{metas:[{indicador:ind.value,pessoaId:quem.value||null,valor:v}]});telaEquipe('Meta salva.',true)}catch(x){telaEquipe(x.message)}}},
      [el('div',{},[el('label',{for:'mq',texto:'De quem'}),quem]),el('div',{},[el('label',{for:'mi',texto:'O que'}),ind]),el('div',{},[el('label',{for:'mv',texto:'Meta do ciclo'}),val]),el('button',{class:'primario',type:'submit',texto:'Salvar meta'})]),
    vig.length?el('table',{},[el('thead',{},[el('tr',{},['De quem','O que','Meta'].map(function(t){return el('th',{texto:t})}))]),el('tbody',{},vig)]):el('p',{class:'suave',texto:'Nenhuma meta neste ciclo.'})]));
}
function pct(n){return n==null?'—':Math.round(n*100)+'%'}
function reais(n){return n==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n)}
var DEGRAUS=[['vendas','Vendas'],['oportunidades','Oportunidades'],['reuniao_realizada','Reuniões feitas'],['agendamento','Agendamentos'],['contato','Contatos'],['tentativa','Tentativas']];
var CENARIO_NOME={conservador:'Conservador',base:'Base',otimista:'Otimista'};
function qs(){return estado.data?('?data='+encodeURIComponent(estado.data)):''}
function linhasDoPlano(plano,porDia){
  return el('table',{},[el('thead',{},[el('tr',{},['O que','Total','Por dia útil'].map(function(t){return el('th',{texto:t})}))]),el('tbody',{},DEGRAUS.filter(function(d){return plano.totais[d[0]]!=null}).map(function(d){return el('tr',{},[el('td',{texto:d[1]}),el('td',{texto:numero(plano.totais[d[0]])}),el('td',{texto:plano.porDia[d[0]]==null?'—':numero(plano.porDia[d[0]])})])}))]);
}
async function telaQuarter(msg,ok){
  limpar();
  var base='/admin/operacoes/'+encodeURIComponent(estado.slug),d;
  try{d=await api(base+'/quarter'+qs())}catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  async function enviar(sub,corpo,sucesso){try{await api(base+'/quarter/'+sub+qs(),corpo||{});estado.passoQ=null;telaQuarter(sucesso,true)}catch(e){telaQuarter(e.message)}}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'Quarter '+d.rotulo}));
  app.appendChild(el('p',{class:'suave',texto:data(d.inicio)+' a '+data(d.fim)+' · '+d.ciclos.length+' ciclos · '+d.diasUteis+' dias úteis'}));
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var q=d.quarter;
  if(!q){
    app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'O planejamento deste quarter ainda não começou. São 6 passos, um de cada vez.'}),
      el('button',{class:'primario',type:'button',texto:'Começar o planejamento',onclick:function(){enviar('', {},'Planejamento iniciado.')}})]));
    return;
  }
  var agora=Math.min(q.fase+1,6);if(q.status==='travado')agora=7;
  if(q.fase===1&&!estado.viuDiag&&q.status!=='travado'&&!estado.passoQ)agora=1;
  var atual=estado.passoQ&&q.status!=='travado'&&estado.passoQ<=q.fase+1?estado.passoQ:agora;
  var lista=d.passos.map(function(p){
    var feito=p.n<=q.fase,eh=p.n===atual;
    var linha=[el('span',{class:'num '+(feito?'feito':eh?'agora':''),texto:feito?'✓':String(p.n)}),el('span',{texto:p.nome,style:eh?'font-weight:700':''})];
    if(feito&&q.status!=='travado'&&!eh)linha.push(el('button',{type:'button',class:'mini',texto:'Refazer',onclick:function(){estado.passoQ=p.n;telaQuarter()}}));
    return el('div',{class:'passo'},linha);
  });
  app.appendChild(el('div',{class:'cartao'},lista));
  if(q.status==='travado'){
    app.appendChild(el('div',{class:'cartao'},[el('p',{class:'ok',texto:'Plano travado em '+data(q.travadoEm.slice(0,10))+'.'}),el('p',{texto:'Meta do quarter: '+reais(q.receitaMeta)+' · cenário '+CENARIO_NOME[q.cenario]+'. As metas de cada ciclo já foram gravadas e aparecem em "Equipe e metas" e em "Ritmo".'})]));
    if(d.programa)programaCartao(d.programa);
    return;
  }
  var p=d.passos[atual-1];
  var caixa=[el('h2',{texto:p.n+'. '+p.nome}),el('p',{class:'suave',texto:p.pergunta})];
  if(atual===1){
    var alvo=el('div',{});
    caixa.push(el('button',{type:'button',texto:'Ver o quarter anterior',onclick:async function(){
      try{var g=await api(base+'/quarter/diagnostico'+qs());while(alvo.firstChild)alvo.removeChild(alvo.firstChild);
        alvo.appendChild(el('p',{class:'suave',texto:g.quarterAnterior.rotulo+' · '+data(g.quarterAnterior.inicio)+' a '+data(g.quarterAnterior.fim)}));
        alvo.appendChild(el('p',{texto:'Vendas: '+g.vendas.quantidade+' · Receita: '+reais(g.vendas.receita)+' · Taxa de ganho: '+pct(g.taxaDeGanho.taxa)+(g.taxaDeGanho.total&&!g.taxaDeGanho.amostraSuficiente?' (poucos casos)':'')}));
        g.canais.forEach(function(c){alvo.appendChild(el('p',{class:'mini',texto:c.canal+': CAC '+reais(c.cac)+' · '+c.vendas+' vendas · ROI '+(c.roi==null?'—':pct(c.roi))}))});
        if(!g.canais.length&&!g.vendas.quantidade)alvo.appendChild(el('p',{class:'suave',texto:'Sem dados no quarter anterior. Tudo bem: o plano usa só o que você informar.'}));
      }catch(e){telaQuarter(e.message)}}}));
    caixa.push(alvo);
    caixa.push(el('p',{},[el('button',{class:'primario',type:'button',texto:'Seguir para a meta',onclick:function(){estado.viuDiag=true;estado.passoQ=null;telaQuarter()}})]));
  }
  if(atual===2){
    var rec=el('input',{type:'number',id:'qr',min:'0',step:'any',inputmode:'decimal',value:q.receitaMeta==null?'':String(q.receitaMeta)});
    var tk=el('input',{type:'number',id:'qt',min:'0',step:'any',inputmode:'decimal',value:q.premissas.ticketMedio==null?'':String(Math.round(q.premissas.ticketMedio))});
    var TX=[['oportunidades','Vendas ÷ oportunidades'],['reuniao_realizada','Oportunidades ÷ reuniões feitas'],['agendamento','Reuniões feitas ÷ agendamentos'],['contato','Agendamentos ÷ contatos'],['tentativa','Contatos ÷ tentativas']];
    var campos=TX.map(function(t){var v=q.premissas.taxas&&q.premissas.taxas[t[0]];return {k:t[0],i:el('input',{type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':t[1],value:v==null?'':String(Math.round(v*1000)/10)}),n:t[1]}});
    caixa.push(el('form',{onsubmit:function(e){e.preventDefault();
      var corpo={receita:Number(rec.value)};if(tk.value!=='')corpo.ticketMedio=Number(tk.value);
      var taxas={};campos.forEach(function(c){if(c.i.value!=='')taxas[c.k]=Number(c.i.value)/100});if(Object.keys(taxas).length)corpo.taxas=taxas;
      enviar('meta',corpo,'Meta salva.')}},[
      el('p',{},[el('label',{for:'qr',texto:'Receita do quarter (R$)'}),rec]),
      el('p',{},[el('label',{for:'qt',texto:'Ticket médio (R$). Vazio = usar o histórico'}),tk]),
      el('p',{class:'suave',texto:'Taxas de conversão em %. Vazio = usar o histórico da operação; sem histórico, informe aqui.'}),
      el('div',{},campos.map(function(c){return el('p',{},[el('label',{texto:c.n+' (%)'}),c.i])})),
      el('button',{class:'primario',type:'submit',texto:'Salvar meta'})]));
  }
  if(atual===3&&d.cenarios){
    caixa.push(el('div',{class:'cenarios'},['conservador','base','otimista'].map(function(n){
      var c=d.cenarios[n];
      return el('div',{class:'cartao'},[el('strong',{texto:CENARIO_NOME[n]}),el('p',{class:'suave mini',texto:n==='base'?'Usa as taxas como estão.':(n==='conservador'?'Converte 15% menos.':'Converte 15% mais.')}),
        c.ok?el('p',{texto:numero(c.totais.vendas)+' vendas · '+numero(c.porDia.tentativa)+' tentativas por dia útil no total'}):el('p',{class:'erro',texto:c.avisos[0]||'Faltam dados para calcular.'}),
        el('button',{type:'button',class:q.cenario===n?'primario':'',texto:'Assumir este cenário',onclick:function(){enviar('cenario',{cenario:n},'Cenário escolhido.')}})]);
    })));
  }
  if(atual===4&&d.cenarios&&q.cenario){
    var c4=d.cenarios[q.cenario];
    caixa.push(el('p',{texto:'Cenário '+CENARIO_NOME[q.cenario]+' · '+reais(q.receitaMeta)+' no quarter'}));
    caixa.push(linhasDoPlano(c4));
    c4.porPessoa.forEach(function(pp){caixa.push(el('p',{class:'mini',texto:pp.nome+': '+DEGRAUS.filter(function(x){return pp.metas[x[0]]!=null}).map(function(x){return x[1].toLowerCase()+' '+numero(pp.metas[x[0]])}).join(' · ')}))});
    c4.avisos.forEach(function(a){caixa.push(el('p',{class:'erro mini',texto:a}))});
    caixa.push(el('button',{class:'primario',type:'button',texto:'Cabe no time: confirmar',onclick:function(){enviar('confirmar',{},'Esforço confirmado.')}}));
  }
  if(atual===5){
    var pesos=(q.pesos&&q.pesos.length===d.ciclos.length)?q.pesos:d.ciclos.map(function(c){return c.diasUteis/d.diasUteis});
    var ins=d.ciclos.map(function(c,i){return el('input',{type:'number',min:'0',max:'100',step:'any',inputmode:'decimal','aria-label':'Peso do ciclo '+data(c.inicio),value:String(Math.round(pesos[i]*1000)/10)})});
    caixa.push(el('p',{class:'suave',texto:'Quanto da meta cai em cada ciclo, em %. O padrão divide pelos dias úteis.'}));
    caixa.push(el('form',{onsubmit:function(e){e.preventDefault();enviar('programa',{pesos:ins.map(function(x){return Number(x.value)})},'Programa salvo.')}},d.ciclos.map(function(c,i){return el('p',{},[el('label',{texto:'Ciclo de '+data(c.inicio)+' · '+c.diasUteis+' dias úteis (%)'}),ins[i]])}).concat([el('button',{class:'primario',type:'submit',texto:'Salvar programa'})])));
    if(d.programa)programaCartao(d.programa,caixa);
  }
  if(atual===6){
    if(d.programa)programaCartao(d.programa,caixa);
    caixa.push(el('p',{class:'erro',texto:'Atenção: travar não pode ser desfeito. As metas de cada ciclo serão gravadas e o plano deixa de mudar.'}));
    caixa.push(el('button',{class:'primario',type:'button',texto:'Travar o plano e gerar as metas',onclick:function(){if(confirm('Travar o plano do quarter? Isso não pode ser desfeito.'))enviar('travar',{},'Plano travado. Metas dos ciclos geradas.')}}));
  }
  app.appendChild(el('div',{class:'cartao'},caixa));
}
function programaCartao(prog,alvo){
  var linhas=prog.ciclos.map(function(c){return el('tr',{},[el('td',{texto:data(c.inicio)}),el('td',{texto:pct(c.peso)}),el('td',{texto:reais(c.metaReceita)}),el('td',{texto:c.plano.totais.vendas==null?'—':numero(c.plano.totais.vendas)})])});
  var t=el('table',{},[el('thead',{},[el('tr',{},['Ciclo','Peso','Meta de receita','Vendas'].map(function(x){return el('th',{texto:x})}))]),el('tbody',{},linhas)]);
  if(alvo)alvo.push(t);else app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Programa de ciclos'}),t]));
}
var TIPOS_A={funcionou:'Funcionou',nao_funcionou:'Não funcionou',hipotese:'Hipótese',decisao:'Decisão'};
async function telaFechamento(msg,ok){
  limpar();
  var base='/admin/operacoes/'+encodeURIComponent(estado.slug),rs,ap,ci;
  try{rs=await api(base+'/retratos');ap=await api(base+'/aprendizados');ci=await api(base+'/ciclo'+qs())}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'Fechamento do ciclo'}));
  app.appendChild(el('p',{class:'suave',texto:'Ciclo de '+data(ci.ciclo.inicio)+' a '+data(ci.ciclo.fim)}));
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  var jaFechado=rs.some(function(r){return r.cicloInicio===ci.ciclo.inicio});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Fechar este ciclo'}),
    el('p',{class:'suave',texto:'Tira uma fotografia do ciclo (metas, ritmo final e métricas) que nunca mais muda. Só dá para fechar depois do último dia útil, e uma vez só.'}),
    jaFechado?el('p',{class:'ok',texto:'Este ciclo já está fechado.'}):el('button',{class:'primario',type:'button',texto:'Fechar o ciclo',onclick:async function(){
      if(!confirm('Fechar o ciclo? O retrato não poderá ser alterado.'))return;
      try{var r=await api(base+'/fechar-ciclo'+qs(),{});telaFechamento('Ciclo fechado. Assinatura '+r.assinatura.slice(0,12)+'…',true)}catch(e){telaFechamento(e.message)}}})]));
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Ciclos fechados'}),rs.length?null:el('p',{class:'suave',texto:'Nenhum ainda.'})].concat(rs.map(function(r){
    var m=r.dados.metricas;
    return el('div',{class:'passo'},[el('span',{class:'chip '+(r.integro?'no_ritmo':'atras'),texto:r.integro?'Íntegro':'ALTERADO'}),el('span',{texto:data(r.cicloInicio)+' a '+data(r.cicloFim)+' · '+m.vendas.quantidade+' vendas · '+reais(m.vendas.receita)})]);
  }))));
  var tipo=el('select',{id:'at'},Object.keys(TIPOS_A).map(function(k){return el('option',{value:k,texto:TIPOS_A[k]})}));
  var txt=el('textarea',{id:'ax',rows:'3',maxlength:'2000','aria-label':'Texto',style:'width:100%;font:inherit;color:inherit;background:var(--cartao);border:1px solid var(--linha);border-radius:8px;padding:10px'});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Aprendizados e decisões'}),
    el('form',{onsubmit:async function(e){e.preventDefault();try{await api(base+'/aprendizados',{tipo:tipo.value,texto:txt.value,cicloInicio:ci.ciclo.inicio});telaFechamento('Registrado.',true)}catch(x){telaFechamento(x.message)}}},
      [el('p',{},[el('label',{for:'at',texto:'O que é'}),tipo]),el('p',{},[el('label',{for:'ax',texto:'O que aprendeu ou decidiu'}),txt]),el('button',{class:'primario',type:'submit',texto:'Registrar'})]),
    el('p',{class:'suave mini',texto:'Só acrescenta: o que foi escrito fica guardado como memória.'})].concat(ap.map(function(a){return el('p',{},[el('span',{class:'chip sem',texto:TIPOS_A[a.tipo]||a.tipo}),' ',a.texto,a.cicloInicio?el('span',{class:'suave mini',texto:' · ciclo de '+data(a.cicloInicio)}):null])}))));
}
async function iniciar(){
  if(!ler('token'))return telaEntrada();
  limpar();app.appendChild(el('p',{class:'suave',texto:'Carregando…'}));
  try{estado.ops=await api('/admin/operacoes')}
  catch(e){return telaEntrada(e.message==='401'?'Acesso recusado. Entre de novo.':'Não consegui falar com a API: '+e.message)}
  if(!estado.ops.length){limpar();cabecalho('LAB','Ainda não existe nenhuma operação.').forEach(function(n){if(n)app.appendChild(n)});app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Crie a primeira operação (passo 4 do guia de implantação) e volte aqui.'})]));return}
  var salvo=ler('slug');
  estado.slug=estado.ops.some(function(o){return o.slug===salvo})?salvo:estado.ops[0].slug;
  desenhar();
}
iniciar();
})();
</script>
</body>
</html>`;
