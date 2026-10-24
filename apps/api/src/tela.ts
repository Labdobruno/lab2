/* Tela do LAB V2 (fase 4): uma pergunta por tela, detalhe só quando pedido.
   Página estática, sem dados: tudo é buscado na API. Entra com e-mail e senha (Supabase, via /auth/entrar)
   ou, enquanto o login não estiver configurado, com o ADMIN_TOKEN. A sessão fica só na aba (sessionStorage). Todo texto vindo da API entra por textContent. */

export const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

import { TELA_DIA } from './tela_dia.js';
import { TELA_CICLO } from './tela_ciclo.js';

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
select,input,button{max-width:100%;font:inherit;color:inherit;background:var(--cartao);border:1px solid var(--linha);border-radius:8px;padding:10px 12px;min-height:44px}
button{cursor:pointer}button.primario{background:var(--foco);border-color:var(--foco);color:#fff}
:focus-visible{outline:3px solid var(--foco);outline-offset:2px}
.grande{font-size:2.2rem;font-weight:700;line-height:1.1}
.pessoa{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;margin:8px 0}
.chip{display:inline-block;border-radius:999px;padding:2px 10px;font-size:.85rem;font-weight:600;white-space:nowrap}
.no_ritmo{background:var(--ok-f);color:var(--ok)}.atencao{background:var(--at-f);color:var(--at)}.atras{background:var(--ruim-f);color:var(--ruim)}.sem{background:var(--linha);color:var(--suave)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 4px;border-bottom:1px solid var(--linha);font-size:.95rem}
.erro{color:var(--ruim);font-weight:600}.ok{color:var(--ok);font-weight:600}.abas{display:flex;gap:8px;margin:0 0 4px;flex-wrap:wrap}.passo{display:flex;gap:10px;align-items:center;padding:6px 0}.num{display:inline-flex;width:28px;height:28px;border-radius:50%;align-items:center;justify-content:center;font-weight:700;border:2px solid var(--linha);flex:none}.num.feito{background:var(--ok-f);border-color:var(--ok);color:var(--ok)}.num.agora{border-color:var(--foco);color:var(--foco)}.cenarios{display:grid;gap:8px}.mini{font-size:.9rem}.svgbox{overflow-x:auto;border:1px solid var(--linha);border-radius:8px;padding:6px}.svgbox svg{display:block}.svgbox text{fill:var(--texto);font:11px system-ui,sans-serif}details{margin:8px 0}summary{cursor:pointer;min-height:44px;display:flex;align-items:center}textarea,.largo{width:100%;font:inherit;color:inherit;background:var(--cartao);border:1px solid var(--linha);border-radius:8px;padding:10px}.valor{font-size:1.5rem;font-weight:700}ul.ev{margin:6px 0;padding-left:18px}.alta{background:var(--ruim-f);color:var(--ruim)}.media{background:var(--at-f);color:var(--at)}.baixa{background:var(--linha);color:var(--suave)}.abas button[aria-current=page]{border-color:var(--foco);font-weight:700}form.linha{display:flex;gap:8px;flex-wrap:wrap;align-items:end}label{display:block;font-size:.85rem;color:var(--suave)}label.inline{display:inline-flex;align-items:center;gap:6px;color:var(--texto);font-size:.9rem}
.prog{height:10px;border-radius:999px;background:var(--linha);overflow:hidden;margin:8px 0}.prog-f{height:100%;background:var(--foco);border-radius:999px;transition:width .3s}.prog-f.cheia{background:var(--ok)}ul.compromissos{list-style:none;margin:8px 0 0;padding:0}.compromisso{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--linha)}.compromisso>span:nth-child(2){flex:1}.marca{display:inline-flex;width:26px;height:26px;border-radius:50%;align-items:center;justify-content:center;border:2px solid var(--linha);flex:none;font-weight:700;color:var(--suave)}.marca.feita{background:var(--ok-f);border-color:var(--ok);color:var(--ok)}button.mini{min-height:36px;padding:6px 10px;font-size:.88rem}.acao{padding:10px 0;border-top:1px solid var(--linha)}.acao-t{margin:0 0 4px}.acao.justificada{opacity:.75}.just{color:var(--at)}.prod{padding:8px 0;border-top:1px solid var(--linha)}.prod:first-of-type{border-top:0}.critica{background:var(--ruim-f);color:var(--ruim)}.alta{background:var(--at-f);color:var(--at)}.normal{background:var(--linha);color:var(--texto)}.estrategica{background:#e8eefc;color:#2457d6}@media (prefers-color-scheme:dark){.estrategica{background:#1b2740;color:#8aa9ff}}.rituais{margin:4px 0 8px}.rituais button{flex:1}details.mais{margin:0;display:inline-block}details.mais summary{min-height:44px;padding:0 12px;border:1px solid var(--linha);border-radius:8px;background:var(--cartao)}details.mais[open] summary{border-color:var(--foco)}details.mais button{margin:4px 4px 0 0}h3{font-size:1rem;margin:12px 0 4px}td.ok{color:var(--ok);font-weight:600}td.erro{color:var(--ruim)}.pessoa{flex-wrap:wrap}.pessoa>span:first-child{flex:1 1 200px}
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
var estado={ops:null,slug:null,data:null,pessoa:null,aba:'dia',ritual:null,pessoaDia:null,passoQ:null,viuDiag:false,grafoSt:null,stFonte:'observado',stEntrada:null,stTicket:null};
var FUNCOES={sdr:'SDR (prospecta e agenda)',closer:'Closer (fecha)',ambos:'SDR e closer',cs:'Sucesso do cliente',gestor:'Gestor',outro:'Outro'};
function guardar(k,v){try{if(v==null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){}}
function ler(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
function el(tag,attrs,filhos){var n=document.createElement(tag);for(var k in (attrs||{})){if(k==='class')n.className=attrs[k];else if(k==='texto')n.textContent=attrs[k];else if(k.slice(0,2)==='on')n.addEventListener(k.slice(2),attrs[k]);else n.setAttribute(k,attrs[k])}(filhos||[]).forEach(function(f){if(f)n.appendChild(typeof f==='string'?document.createTextNode(f):f)});return n}
function limpar(){estado.gen=(estado.gen||0)+1;try{while(app.firstChild)app.removeChild(app.firstChild)}catch(e){app.textContent=''}}
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
  var geracao=estado.gen;
  var r=await fetch(caminho,o);
  /* a tela foi redesenhada enquanto esta busca andava: a resposta é de uma versão antiga e é descartada (a função que a esperava não continua) */
  if(geracao!==estado.gen)return new Promise(function(){});
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
  var dt=el('input',{type:'date','aria-label':'Dia',value:estado.data||'',onchange:function(){estado.data=dt.value||null;estado.pessoa=null;estado.ritual=null;desenhar()}});
  var hoje=el('button',{type:'button',texto:'Hoje',onclick:function(){estado.data=null;estado.pessoa=null;estado.ritual=null;desenhar()}});
  var sair=el('button',{type:'button',texto:'Sair',onclick:function(){guardar('token',null);guardar('refresh',null);iniciar()}});
  return el('div',{class:'barra'},[estado.ops.length>1?sel:null,dt,hoje,sair]);
}
function abas(){
  function b(id,t){var x=el('button',{type:'button',texto:t,onclick:function(){estado.aba=id;estado.pessoa=null;desenhar()}});if(estado.aba===id)x.setAttribute('aria-current','page');return x}
  var mais=[['equipe','Equipe e metas'],['quarter','Quarter'],['fechamento','Fechar ciclo'],['achados','Achados'],['dados','Dados'],['studio','Studio'],['operacoes','Operações'],['ritmo','Ritmo (antigo)']];
  var atual=mais.filter(function(m){return m[0]===estado.aba})[0];
  var d=el('details',{class:'mais'},[el('summary',{texto:atual?atual[1]+' ▾':'Mais ▾'})].concat(mais.map(function(m){return b(m[0],m[1])})));
  if(atual)d.setAttribute('open','');
  return el('div',{class:'abas'},[b('dia','Dia'),b('ciclo','Meta'),b('semana','Semana'),b('fechdia','Fechamento do dia'),d]);
}
function agrupar(linhas){
  var por={};
  linhas.forEach(function(l){var k=l.pessoaId||'_op';(por[k]=por[k]||{id:k,nome:l.pessoa||'Operação',linhas:[]}).linhas.push(l)});
  return Object.keys(por).map(function(k){var g=por[k];g.status=g.linhas.reduce(function(a,l){return (PIOR[l.status]||0)>(PIOR[a]||0)?l.status:a},null);return g});
}
async function desenhar(){
  limpar();
  if(estado.aba==='dia')return telaDia();
  if(estado.aba==='ciclo')return telaCiclo();
  if(estado.aba==='semana')return telaSemana();
  if(estado.aba==='fechdia')return telaFechamentoDia();
  if(estado.aba==='equipe')return telaEquipe();
  if(estado.aba==='quarter')return telaQuarter();
  if(estado.aba==='fechamento')return telaFechamento();
  if(estado.aba==='achados')return telaAchados();
  if(estado.aba==='dados')return telaDados();
  if(estado.aba==='operacoes')return telaOperacoes();
  if(estado.aba==='studio')return telaStudio();
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
function fmtVal(v,u){if(v==null)return 'sem dado';if(u==='%')return (Math.round(v*1000)/10)+'%';if(u==='R$')return reais(v);return numero(v)}
function evidencias(lista){return el('ul',{class:'ev mini'},lista.map(function(e){return el('li',{texto:e.nome+': '+fmtVal(e.valor,e.unidade)})}))}
async function telaAchados(msg,ok){
  limpar();
  var base='/admin/operacoes/'+encodeURIComponent(estado.slug),a,ex,de;
  try{a=await api(base+'/achados'+qs());ex=await api(base+'/experimentos'+qs());de=await api(base+'/decisoes')}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'O que merece sua atenção?'}));
  app.appendChild(el('p',{class:'suave',texto:'Mostro no máximo '+a.orcamento+' coisas por vez, as que têm mais dinheiro em jogo.'}));
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  if(a.errosDeFormula.length)app.appendChild(el('p',{class:'erro',texto:'Há hipóteses com fórmula quebrada: '+a.errosDeFormula.map(function(x){return x.chave}).join(', ')}));
  if(!a.achados.length)app.appendChild(el('div',{class:'cartao'},[el('p',{texto:'Nada pede atenção agora.'}),el('p',{class:'suave',texto:a.semDados.length?('Mas '+a.semDados.length+' hipótese(s) não puderam ser avaliadas por falta de dados (veja abaixo e a aba Dados).'):'As hipóteses da biblioteca foram avaliadas e nenhuma disparou.'})]));
  a.achados.forEach(function(x){app.appendChild(cartaoAchado(x,base))});
  if(a.emEspera.length)app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Em espera ('+a.emEspera.length+'): ficam para depois que você resolver os de cima'})].concat(a.emEspera.map(function(x){return el('p',{},[el('strong',{texto:x.titulo}),el('span',{class:'suave mini',texto:' · '+(x.impacto==null?'impacto não calculável':reais(x.impacto)+' em jogo')})])}))));
  if(a.semDados.length)app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Sem dados para avaliar ('+a.semDados.length+')'})].concat(a.semDados.map(function(x){return el('p',{},[el('strong',{texto:x.titulo}),el('span',{class:'suave mini',texto:' · falta: '+x.faltam.join(', ')})])}))));
  /* experimentos */
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Experimentos'}),ex.length?null:el('p',{class:'suave',texto:'Nenhum ainda. Comece um a partir de um achado.'})].concat(ex.map(function(e){
    var linha=[el('strong',{texto:e.titulo}),el('p',{class:'mini',texto:e.nome+': partiu de '+fmtVal(e.baseline,e.unidade)+(e.status==='rodando'?(', está em '+fmtVal(e.atual,e.unidade)):(', terminou em '+fmtVal(e.resultado,e.unidade)))+' · alvo '+fmtVal(e.alvo,e.unidade)}),
      el('span',{class:'chip '+(e.status==='rodando'?'atencao':e.status==='concluido'?'no_ritmo':'sem'),texto:e.status==='rodando'?'Rodando':e.status==='concluido'?'Concluído':'Descartado'})];
    if(e.status==='rodando'){
      linha.push(' ');linha.push(el('button',{type:'button',class:'mini',texto:'Concluir e medir',onclick:async function(){if(!confirm('Medir agora e encerrar? Isso vai para a memória e não muda mais.'))return;try{var r=await api(base+'/experimentos/'+e.id+'/concluir'+qs(),{});telaAchados(r.atingiu?'Alvo atingido. Registrado na memória.':'Alvo não atingido. Registrado na memória.',true)}catch(x){telaAchados(x.message)}}}));
      linha.push(' ');linha.push(el('button',{type:'button',class:'mini',texto:'Descartar',onclick:async function(){if(!confirm('Descartar o experimento?'))return;try{await api(base+'/experimentos/'+e.id+'/concluir'+qs(),{descartar:true});telaAchados('Experimento descartado.',true)}catch(x){telaAchados(x.message)}}}));
    }
    return el('div',{class:'passo',style:'display:block'},linha);
  }))));
  /* decisões */
  app.appendChild(el('details',{class:'cartao'},[el('summary',{texto:'Decisões registradas ('+de.length+')'})].concat(de.map(function(d){return el('p',{},[el('strong',{texto:d.pergunta}),el('br'),'Decidido: '+d.escolha+(d.criterioSucesso?' · sucesso se: '+d.criterioSucesso:'')+(d.revisarEm?' · revisar em '+data(d.revisarEm):'')])}))));
}
function cartaoAchado(x,base){
  var caixa=el('div',{});
  var cart=el('div',{class:'cartao'},[
    el('span',{class:'chip '+x.severidade,texto:x.severidade==='alta'?'Alta':x.severidade==='media'?'Média':'Baixa'}),
    el('h2',{texto:x.titulo}),
    x.impacto==null?el('p',{class:'suave',texto:'Impacto em R$ não calculável com os dados de hoje.'}):el('div',{},[el('div',{class:'valor',texto:reais(x.impacto)}),el('p',{class:'suave mini',texto:'em jogo'})]),
    el('p',{},[el('strong',{texto:'O que fazer: '}),x.acao]),
    el('details',{},[el('summary',{texto:'Os números por trás'}),evidencias(x.evidencias)]),
    el('div',{class:'barra'},[
      el('button',{type:'button',texto:'Decidir',onclick:function(){formDecisao(x,base,caixa)}}),
      el('button',{type:'button',texto:'Testar com experimento',onclick:function(){formExperimento(x,base,caixa)}})]),
    caixa]);
  return cart;
}
function formDecisao(x,base,caixa){
  while(caixa.firstChild)caixa.removeChild(caixa.firstChild);
  var per=el('input',{class:'largo',type:'text',maxlength:'300',value:x.titulo+': o que vamos fazer?'});
  var op=el('textarea',{rows:'3',placeholder:'Uma opção por linha'});
  var esc=el('input',{class:'largo',type:'text',maxlength:'500'});
  var por=el('textarea',{rows:'2'});
  var cri=el('input',{class:'largo',type:'text',maxlength:'1000',placeholder:'Ex.: desconto médio abaixo de 10%'});
  var rev=el('input',{type:'date'});
  caixa.appendChild(el('form',{onsubmit:async function(e){e.preventDefault();
    try{await api(base+'/decisoes',{hipoteseId:x.chave,pergunta:per.value,opcoes:op.value.split('\\n').map(function(t){return t.trim()}).filter(Boolean),escolha:esc.value,porque:por.value,criterioSucesso:cri.value,revisarEm:rev.value||null,contexto:{achado:x.titulo,impacto:x.impacto,evidencias:x.evidencias}});telaAchados('Decisão registrada.',true)}catch(err){telaAchados(err.message)}}},[
    el('h3',{texto:'Canvas de decisão'}),
    el('p',{},[el('label',{texto:'A pergunta'}),per]),el('p',{},[el('label',{texto:'Opções que você considerou'}),op]),
    el('p',{},[el('label',{texto:'O que você escolheu'}),esc]),el('p',{},[el('label',{texto:'Por quê'}),por]),
    el('p',{},[el('label',{texto:'Como saber que deu certo'}),cri]),el('p',{},[el('label',{texto:'Revisar em'}),rev]),
    el('button',{class:'primario',type:'submit',texto:'Registrar decisão'})]));
}
function formExperimento(x,base,caixa){
  while(caixa.firstChild)caixa.removeChild(caixa.firstChild);
  var tit=el('input',{class:'largo',type:'text',maxlength:'200',value:'Resolver: '+x.titulo});
  var met=el('select',{},x.evidencias.map(function(e){return el('option',{value:e.variavel,texto:e.nome+' (hoje: '+fmtVal(e.valor,e.unidade)+')'})}));
  var alvo=el('input',{type:'number',step:'any',inputmode:'decimal'});
  var dica=el('p',{class:'suave mini'});
  function atualizar(){var e=x.evidencias.filter(function(z){return z.variavel===met.value})[0];dica.textContent=e.unidade==='%'?'Digite o alvo em %, por exemplo 10 para 10%.':e.unidade==='R$'?'Digite o alvo em reais.':'Digite o alvo como número.'}
  met.addEventListener('change',atualizar);atualizar();
  var fim=el('input',{type:'date'});
  caixa.appendChild(el('form',{onsubmit:async function(e){e.preventDefault();
    var ev=x.evidencias.filter(function(z){return z.variavel===met.value})[0];var v=Number(alvo.value);if(alvo.value===''||!isFinite(v))return telaAchados('Informe o alvo.');
    try{await api(base+'/experimentos'+qs(),{titulo:tit.value,metrica:met.value,alvo:ev.unidade==='%'?v/100:v,fimPrevisto:fim.value||null,hipoteseId:x.chave});telaAchados('Experimento iniciado.',true)}catch(err){telaAchados(err.message)}}},[
    el('h3',{texto:'Novo experimento'}),el('p',{},[el('label',{texto:'O que vai testar'}),tit]),
    el('p',{},[el('label',{texto:'Qual número deve mudar'}),met]),el('p',{},[el('label',{texto:'Alvo'}),alvo]),dica,
    el('p',{},[el('label',{texto:'Terminar até'}),fim]),el('button',{class:'primario',type:'submit',texto:'Começar experimento'})]));
}
async function telaDados(){
  limpar();
  var base='/admin/operacoes/'+encodeURIComponent(estado.slug),q;
  try{q=await api(base+'/qualidade'+qs())}catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'Os dados estão confiáveis?'}));
  app.appendChild(el('p',{class:'suave',texto:q.problemas.length?(q.problemas.length+' ponto(s) para corrigir · '+q.tudoCerto+' checagem(ns) sem problema'):'Todas as '+q.checagens.length+' checagens passaram.'}));
  app.appendChild(controles());
  q.problemas.forEach(function(c){
    app.appendChild(el('div',{class:'cartao'},[el('span',{class:'chip '+c.severidade,texto:c.severidade==='alta'?'Alta':c.severidade==='media'?'Média':'Baixa'}),
      el('h2',{texto:c.nome}),el('p',{texto:c.quantidade+' caso(s). '+c.efeito}),
      c.exemplos.length?el('p',{class:'suave mini',texto:'Exemplos: '+c.exemplos.join(', ')}):null]));
  });
}
var ORDEM_ARQ=['pessoas','contas','negocios','transicoes','atividades','investimentos','recebimentos','contratos','eventos_cs'];
function slugDe(t){return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}
function ordemArq(nome){var n=nome.toLowerCase().replace(/[^a-z_]/g,' ');for(var i=0;i<ORDEM_ARQ.length;i++)if(n.indexOf(ORDEM_ARQ[i].replace('_',' '))===0||n.indexOf(ORDEM_ARQ[i])===0)return i;return 99}
async function conectorDePlanilha(slug){
  var lista=await api('/admin/conectores?operacao='+encodeURIComponent(slug));
  var c=lista.filter(function(x){return x.tipo==='planilha'})[0];
  if(c)return c.id;
  var n=await api('/admin/conectores',{operacao:slug,tipo:'planilha',nome:'planilhas'});
  return n.id;
}
async function telaOperacoes(msg,ok,resultados){
  limpar();
  var packs,ops;
  try{packs=await api('/admin/packs');ops=await api('/admin/operacoes');estado.ops=ops}
  catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'Operações'}));
  app.appendChild(el('p',{class:'suave',texto:'Uma operação é uma empresa ou projeto de receita, com o seu modelo de negócio (pack).'}));
  if(ops.length)app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Suas operações'}),ops.length?null:el('p',{class:'suave',texto:'Nenhuma ainda.'})].concat(ops.map(function(o){
    return el('div',{class:'pessoa'},[el('span',{texto:o.nome+' · '+o.pack_id}),o.slug===estado.slug?el('span',{class:'chip no_ritmo',texto:'Em uso'}):el('button',{type:'button',texto:'Usar',onclick:function(){estado.slug=o.slug;guardar('slug',o.slug);estado.pessoa=null;telaOperacoes()}})]);
  }))));
  var nome=el('input',{class:'largo',type:'text',maxlength:'80',id:'on'});
  var pk=el('select',{id:'op'},packs.filter(function(p){return p.ok}).map(function(p){return el('option',{value:p.id,texto:p.nome||p.id})}));
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Nova operação'}),
    el('form',{onsubmit:async function(e){e.preventDefault();
      var slug=slugDe(nome.value);if(!slug||!nome.value.trim())return telaOperacoes('Dê um nome à operação.');
      try{await api('/admin/operacoes',{slug:slug,nome:nome.value.trim(),packId:pk.value});await conectorDePlanilha(slug);estado.slug=slug;guardar('slug',slug);telaOperacoes('Operação criada e já preparada para importar planilhas.',true)}
      catch(x){telaOperacoes(x.message)}}},
      [el('p',{},[el('label',{for:'on',texto:'Nome'}),nome]),el('p',{},[el('label',{for:'op',texto:'Modelo de negócio (pack)'}),pk]),el('button',{class:'primario',type:'submit',texto:'Criar operação'})])]));
  if(!ops.length)return;
  var arq=el('input',{type:'file',id:'ar',accept:'.csv,text/csv',multiple:'multiple','aria-label':'Planilhas CSV'});
  var atual=ops.filter(function(o){return o.slug===estado.slug})[0];
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Importar planilhas para "'+(atual?atual.nome:'')+'"'}),
    el('p',{class:'suave',texto:'Escolha arquivos CSV. O tipo vem do começo do nome: pessoas, contas, negocios, transicoes, atividades, investimentos, recebimentos, contratos ou eventos_cs (ex.: negocios-outubro.csv). Importo na ordem certa, e reenviar o mesmo arquivo não duplica nada.'}),
    el('p',{},[arq]),
    el('button',{class:'primario',type:'button',texto:'Importar',onclick:async function(){
      var fs=Array.prototype.slice.call(arq.files||[]).sort(function(a,b){return ordemArq(a.name)-ordemArq(b.name)});
      if(!fs.length)return telaOperacoes('Escolha pelo menos um arquivo.');
      var res=[];
      try{
        var cid=await conectorDePlanilha(estado.slug);
        for(var i=0;i<fs.length;i++){
          var texto=await fs[i].text();
          var r=await fetch('/admin/conectores/'+cid+'/importar?nome='+encodeURIComponent(fs[i].name),{method:'POST',headers:{authorization:'Bearer '+(ler('token')||'')},body:texto});
          var j={};try{j=await r.json()}catch(x){}
          if(r.status===401)return telaEntrada('Acesso recusado. Entre de novo.');
          res.push({nome:fs[i].name,ok:r.ok&&j.ok!==false,j:j});
        }
        var erros=[];
        if(res.some(function(x){return x.j&&x.j.erros>0})){var sa=await api('/admin/conectores/'+cid+'/saude');erros=(sa.errosRecentes||[]).slice(0,5)}
        telaOperacoes(res.every(function(x){return x.ok&&!(x.j.erros>0)})?'Importação concluída.':'Importação terminou com avisos. Veja abaixo.',res.every(function(x){return x.ok&&!(x.j.erros>0)}),{res:res,erros:erros});
      }catch(x){telaOperacoes(x.message)}}})]));
  if(resultados){
    app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Resultado da importação'})].concat(resultados.res.map(function(x){
      return el('p',{},[el('span',{class:'chip '+(x.ok&&!(x.j.erros>0)?'no_ritmo':'atras'),texto:x.ok&&!(x.j.erros>0)?'OK':'Atenção'}),' '+x.nome+' · '+(x.j.falha?x.j.falha:(x.j.aplicados||0)+' linha(s) aplicada(s)'+(x.j.erros?', '+x.j.erros+' com erro':'')+(x.j.erro&&!x.j.falha?' · '+x.j.erro:''))])
    })).concat(resultados.erros.map(function(e){return el('p',{class:'erro mini',texto:e.tipo+': '+e.erro})}))));
  }
}
var SVGNS='http://www.w3.org/2000/svg';
function sv(tag,attrs,filhos){var n=document.createElementNS(SVGNS,tag);for(var k in (attrs||{}))n.setAttribute(k,attrs[k]);(filhos||[]).forEach(function(f){n.appendChild(f)});return n}
function desenharGrafo(g,sim){
  var cam=sim.camadas||{},cols={},maxC=0;
  g.nos.forEach(function(n){var c=cam[n.id]||0;(cols[c]=cols[c]||[]).push(n);if(c>maxC)maxC=c});
  var W=110,H=46,pos={};
  Object.keys(cols).forEach(function(c){cols[c].forEach(function(n,i){pos[n.id]={x:Number(c)*(W+34)+6,y:i*H+8}})});
  var altura=Math.max.apply(null,Object.keys(cols).map(function(c){return cols[c].length}))*H+16;
  var vol={};if(sim.simulacao)sim.simulacao.arestas.forEach(function(a){vol[a.de+'>'+a.para]=a.volume});
  var vmax=Math.max.apply(null,[1].concat(Object.keys(vol).map(function(k){return vol[k]})));
  var nos={};if(sim.simulacao)sim.simulacao.nos.forEach(function(n){nos[n.id]=n});
  var filhos=[];
  g.arestas.forEach(function(a){
    var p=pos[a.de],q=pos[a.para];if(!p||!q)return;
    var x1=p.x+W-12,y1=p.y+16,x2=q.x,y2=q.y+16,mx=(x1+x2)/2;
    var v=vol[a.de+'>'+a.para]||0,esp=1+7*Math.sqrt(v/vmax);
    var perd=(g.nos.filter(function(n){return n.id===a.para})[0]||{}).tipo==='perdido';
    filhos.push(sv('path',{d:'M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2,fill:'none',stroke:perd?'#b3261e':'#2457d6','stroke-opacity':perd?'.28':'.45','stroke-width':String(esp)}));
    var t=typeof a.taxa==='number'?Math.round(a.taxa*100)+'%':'ƒ';
    filhos.push(sv('text',{x:String(mx),y:String((y1+y2)/2-3),'text-anchor':'middle'},[document.createTextNode(t)]));
  });
  g.nos.forEach(function(n){
    var p=pos[n.id];if(!p)return;
    var cor=n.tipo==='ganho'?'#0f7b3f':n.tipo==='perdido'?'#b3261e':'#5b6270';
    var r=sv('rect',{x:String(p.x),y:String(p.y),width:String(W-12),height:'32',rx:'6',fill:'none',stroke:cor,'stroke-width':n.id===g.entrada?'3':'1.5'});
    var tt=sv('title',{});tt.appendChild(document.createTextNode(n.nome));r.appendChild(tt);
    filhos.push(r);
    filhos.push(sv('text',{x:String(p.x+6),y:String(p.y+14)},[document.createTextNode(n.nome.length>15?n.nome.slice(0,14)+'…':n.nome)]));
    var vv=nos[n.id]?numero(nos[n.id].volume):'';
    filhos.push(sv('text',{x:String(p.x+6),y:String(p.y+27),style:'opacity:.7'},[document.createTextNode(vv)]));
  });
  var svg=sv('svg',{width:String((maxC+1)*(W+34)),height:String(altura),role:'img','aria-label':'Funil em grafo'},filhos);
  return el('div',{class:'svgbox'},[svg]);
}
function taxaTexto(t){return typeof t==='number'?String(Math.round(t*1000)/10):t}
function lerTaxa(v){v=v.trim();if(/^[0-9]+([.,][0-9]+)?%?$/.test(v)){var n=Number(v.replace('%','').replace(',','.'))/100;return n}return v}
async function telaStudio(msg,ok){
  limpar();
  var base='/admin/operacoes/'+encodeURIComponent(estado.slug),fun,cam,can,sim,obs=null;
  try{
    fun=await api(base+'/studio/funis');cam=await api(base+'/studio/campanhas');can=await api(base+'/canais');
    if(!estado.grafoSt){
      if(estado.stFonte==='observado'){obs=await api(base+'/studio/observado'+qs());estado.grafoSt=obs.grafo;estado.stObs={passagens:obs.passagens,ignoradas:obs.ignoradas}}
      else{var f=fun.filter(function(x){return x.nome===estado.stFonte})[0];if(f)estado.grafoSt=f.grafo;else{estado.stFonte='observado';return telaStudio()}estado.stObs=null}
    }
    sim=await api(base+'/studio/simular'+qs(),{grafo:estado.grafoSt,entrada:estado.stEntrada,ticketMedio:estado.stTicket});
  }catch(e){if(e.message==='401')return telaEntrada('Acesso recusado. Entre de novo.');app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));if(estado.grafoSt){estado.grafoSt=null}return}
  var g=estado.grafoSt;
  function refazer(m,o){telaStudio(m,o)}
  app.appendChild(abas());
  app.appendChild(el('h1',{texto:'Studio'}));
  app.appendChild(el('p',{class:'suave',texto:'Desenhe o funil, mude as passagens e veja o que rende mais. As taxas aceitam número (35) ou fórmula com as mesmas variáveis das hipóteses.'}));
  app.appendChild(controles());
  if(msg)app.appendChild(el('p',{class:ok?'ok':'erro',texto:msg}));
  /* origem */
  var fonte=el('select',{'aria-label':'Funil',onchange:function(){estado.stFonte=fonte.value;estado.grafoSt=null;telaStudio()}},[el('option',{value:'observado',texto:'Observado no histórico'})].concat(fun.map(function(f){return el('option',{value:f.nome,texto:f.nome+' (v'+f.versao+')'})})));
  fonte.value=estado.stFonte;
  var cartao=[el('h2',{texto:'Funil em grafo'}),el('p',{},[fonte])];
  if(estado.stObs)cartao.push(el('p',{class:'suave mini',texto:'Montado de '+estado.stObs.passagens+' passagens reais'+(estado.stObs.ignoradas?'; '+estado.stObs.ignoradas+' tipo(s) de volta a etapa anterior foram ignorados.':'.')}));
  cartao.push(desenharGrafo(g,sim));
  var leads=el('input',{type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Leads que entram',placeholder:sim.entrada==null?'':String(Math.round(sim.entrada)),value:estado.stEntrada==null?'':String(estado.stEntrada)});
  var tick=el('input',{type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Ticket médio',placeholder:sim.ticketMedio==null?'':String(Math.round(sim.ticketMedio)),value:estado.stTicket==null?'':String(estado.stTicket)});
  cartao.push(el('div',{class:'barra'},[el('label',{texto:'Leads que entram'}),leads,el('label',{texto:'Ticket (R$)'}),tick,el('button',{type:'button',texto:'Simular',onclick:function(){estado.stEntrada=leads.value===''?null:Number(leads.value);estado.stTicket=tick.value===''?null:Number(tick.value);telaStudio()}})]));
  if(!sim.ok){sim.avisos.forEach(function(a){cartao.push(el('p',{class:'erro mini',texto:a}))})}
  else{
    cartao.push(el('div',{class:'valor',texto:numero(sim.simulacao.vendas)+' vendas'}));
    cartao.push(el('p',{class:'suave',texto:sim.simulacao.receita==null?'Sem ticket para calcular a receita.':reais(sim.simulacao.receita)+' de receita com '+numero(sim.entrada)+' leads'}));
    if(sim.alavancas.length){
      cartao.push(el('h3',{texto:'Onde mexer rende mais (+5 pontos)'}));
      sim.alavancas.forEach(function(a){var nm={};g.nos.forEach(function(n){nm[n.id]=n.nome});cartao.push(el('p',{class:'mini',texto:nm[a.de]+' → '+nm[a.para]+': de '+Math.round(a.taxa*100)+'% para '+Math.round(a.nova*100)+'% rende +'+numero(a.ganhoVendas)+' vendas'+(a.ganhoReceita==null?'':' (+'+reais(a.ganhoReceita)+')')}))});
    }
  }
  sim.avisos.forEach(function(a){if(sim.ok)cartao.push(el('p',{class:'suave mini',texto:a}))});
  app.appendChild(el('div',{class:'cartao'},cartao));
  /* passagens */
  var nm={};g.nos.forEach(function(n){nm[n.id]=n.nome});
  var vol={};if(sim.simulacao)sim.simulacao.arestas.forEach(function(a){vol[a.de+'>'+a.para]=a.volume});
  var linhas=g.arestas.map(function(a,i){
    var inp=el('input',{type:'text',value:taxaTexto(a.taxa),'aria-label':'Taxa de '+nm[a.de]+' para '+nm[a.para],style:'width:7em',onchange:function(){g.arestas[i].taxa=lerTaxa(inp.value);telaStudio()}});
    return el('tr',{},[el('td',{texto:nm[a.de]+' → '+nm[a.para]}),el('td',{},[inp,typeof a.taxa==='number'?' %':'']),el('td',{texto:vol[a.de+'>'+a.para]==null?'—':numero(vol[a.de+'>'+a.para])}),el('td',{},[el('button',{type:'button',class:'mini',texto:'Tirar',onclick:function(){g.arestas.splice(i,1);telaStudio()}})])]);
  });
  var tab=el('table',{},[el('thead',{},[el('tr',{},['Passagem','Taxa','Volume',''].map(function(t){return el('th',{texto:t})}))]),el('tbody',{},linhas)]);
  var nn=el('input',{type:'text',maxlength:'60','aria-label':'Nome da etapa'});
  var nt=el('select',{'aria-label':'Tipo da etapa'},[el('option',{value:'etapa',texto:'Etapa'}),el('option',{value:'ganho',texto:'Venda (fim bom)'}),el('option',{value:'perdido',texto:'Perdido (fim ruim)'})]);
  var de=el('select',{'aria-label':'De'},g.nos.filter(function(n){return n.tipo==='etapa'}).map(function(n){return el('option',{value:n.id,texto:n.nome})}));
  var pa=el('select',{'aria-label':'Para'},g.nos.map(function(n){return el('option',{value:n.id,texto:n.nome})}));
  var tx=el('input',{type:'text',style:'width:7em','aria-label':'Taxa em % ou fórmula'});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Passagens'}),tab,
    el('h3',{texto:'Adicionar etapa'}),
    el('form',{class:'linha',onsubmit:function(e){e.preventDefault();var nome=nn.value.trim();if(!nome)return;var id=slugDe(nome)||'etapa',k=id,i=2;while(g.nos.some(function(n){return n.id===k}))k=id+'-'+(i++);g.nos.push({id:k,nome:nome,tipo:nt.value});telaStudio()}},[el('div',{},[el('label',{texto:'Nome'}),nn]),el('div',{},[el('label',{texto:'Tipo'}),nt]),el('button',{type:'submit',texto:'Adicionar'})]),
    el('h3',{texto:'Adicionar passagem'}),
    el('form',{class:'linha',onsubmit:function(e){e.preventDefault();if(tx.value.trim()==='')return;g.arestas.push({de:de.value,para:pa.value,taxa:lerTaxa(tx.value)});telaStudio()}},[el('div',{},[el('label',{texto:'De'}),de]),el('div',{},[el('label',{texto:'Para'}),pa]),el('div',{},[el('label',{texto:'Taxa (%) ou fórmula'}),tx]),el('button',{type:'submit',texto:'Adicionar'})])]));
  var nomeSalvar=el('input',{type:'text',maxlength:'80','aria-label':'Nome do funil',value:estado.stFonte==='observado'?'':estado.stFonte});
  app.appendChild(el('div',{class:'cartao'},[el('h2',{texto:'Guardar este funil'}),el('p',{class:'suave mini',texto:'Cada vez que guarda, vira uma versão nova; as antigas ficam.'}),
    el('form',{class:'linha',onsubmit:async function(e){e.preventDefault();try{var r=await api(base+'/studio/funis',{nome:nomeSalvar.value,grafo:g});estado.stFonte=nomeSalvar.value.trim();estado.grafoSt=null;telaStudio('Funil guardado (versão '+r.versao+').',true)}catch(x){telaStudio(x.message)}}},[el('div',{},[el('label',{texto:'Nome'}),nomeSalvar]),el('button',{class:'primario',type:'submit',texto:'Guardar'})])]));
  /* campanhas */
  var cn=el('input',{type:'text',maxlength:'120','aria-label':'Nome da campanha'});
  var cc=el('select',{'aria-label':'Canal'},can.map(function(c){return el('option',{value:c.chave,texto:c.nome})}));
  var cf=el('input',{type:'date','aria-label':'Termina em'});
  var co=el('input',{type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Orçamento'});
  var cp=el('input',{type:'number',min:'0',step:'any',inputmode:'decimal','aria-label':'Custo por lead',placeholder:'usar o do canal'});
  var cfun=el('select',{'aria-label':'Funil da campanha'},[el('option',{value:'',texto:'Observado no histórico'})].concat(fun.map(function(f){return el('option',{value:f.nome,texto:f.nome})})));
  var blocos=[el('h2',{texto:'Campanhas de go-to-market'}),cam.length?null:el('p',{class:'suave',texto:'Nenhuma ainda. A projeção sai do funil acima, do custo por lead e do orçamento.'})];
  cam.forEach(function(c){
    var pl=c.plano;
    var linhasC=[el('strong',{texto:c.nome}),' ',el('span',{class:'chip '+(c.status==='rodando'?'atencao':c.status==='encerrada'?'no_ritmo':'sem'),texto:c.status==='rodando'?'Rodando':c.status==='encerrada'?'Encerrada':'Planejada'}),
      el('p',{class:'mini suave',texto:c.canal+' · '+data(c.inicio)+' a '+data(c.fim)+' · orçamento '+reais(c.orcamento)}),
      el('p',{class:'mini',texto:'Plano: '+numero(pl.leads)+' leads · '+numero(pl.vendas)+' vendas · '+reais(pl.receita)+' · CAC '+reais(pl.cac)+' · ROI '+pct(pl.roi)})];
    if(c.realizado)linhasC.push(el('p',{class:'mini',texto:'Realizado: '+c.realizado.leads+' leads · '+c.realizado.vendas+' vendas · '+reais(c.realizado.receita)+' · CAC '+reais(c.realizado.cac)+' · ROI '+pct(c.realizado.roi)}));
    if(c.desvios){var dv=c.desvios.filter(function(d){return d.pct!=null&&(d.campo==='vendas'||d.campo==='receita')});dv.forEach(function(d){linhasC.push(el('p',{class:'mini '+(d.pct>=0?'ok':'erro'),texto:d.campo+': '+(d.pct>=0?'+':'')+Math.round(d.pct*100)+'% sobre o plano'}))})}
    var bt=[];
    if(c.status==='planejada')bt.push(el('button',{type:'button',class:'mini',texto:'Iniciar',onclick:async function(){try{await api(base+'/studio/campanhas/'+c.id+'/iniciar',{});telaStudio('Campanha iniciada.',true)}catch(x){telaStudio(x.message)}}}));
    if(c.status!=='encerrada')bt.push(el('button',{type:'button',class:'mini',texto:'Encerrar e medir',onclick:async function(){
      var v=prompt('Quanto foi investido de fato (R$)? Deixe vazio para usar os lançamentos do canal.');if(v===null)return;
      try{var r=await api(base+'/studio/campanhas/'+c.id+'/encerrar',v.trim()===''?{}:{investimentoReal:Number(v.replace(',','.'))});telaStudio('Campanha encerrada e registrada na memória.',true)}catch(x){telaStudio(x.message)}}}));
    linhasC.push(el('div',{class:'barra'},bt));
    blocos.push(el('div',{class:'cartao'},linhasC));
  });
  blocos.push(el('h3',{texto:'Nova campanha'}));
  blocos.push(el('p',{class:'suave mini',texto:'A projeção usa o funil escolhido, o custo por lead do canal no histórico (ou o que você informar) e o ticket médio.'}));
  blocos.push(el('form',{onsubmit:async function(e){e.preventDefault();
    var corpo={nome:cn.value,canal:cc.value,fim:cf.value,orcamento:Number(co.value)};if(cfun.value)corpo.funil=cfun.value;if(cp.value!=='')corpo.cpl=Number(cp.value);
    try{await api(base+'/studio/campanhas',corpo);telaStudio('Campanha criada com a projeção.',true)}catch(x){telaStudio(x.message)}}},[
    el('p',{},[el('label',{texto:'Nome'}),cn]),el('p',{},[el('label',{texto:'Canal'}),cc]),el('p',{},[el('label',{texto:'Termina em'}),cf]),
    el('p',{},[el('label',{texto:'Orçamento (R$)'}),co]),el('p',{},[el('label',{texto:'Custo por lead (R$), opcional'}),cp]),el('p',{},[el('label',{texto:'Funil'}),cfun]),
    el('button',{class:'primario',type:'submit',texto:'Criar campanha'})]));
  app.appendChild(el('div',{class:'cartao'},blocos));
}
${TELA_DIA}
${TELA_CICLO}
async function iniciar(){
  if(!ler('token'))return telaEntrada();
  limpar();app.appendChild(el('p',{class:'suave',texto:'Carregando…'}));
  try{estado.ops=await api('/admin/operacoes')}
  catch(e){return telaEntrada(e.message==='401'?'Acesso recusado. Entre de novo.':'Não consegui falar com a API: '+e.message)}
  if(!estado.ops.length){estado.aba='operacoes';return telaOperacoes()}
  var salvo=ler('slug');
  estado.slug=estado.ops.some(function(o){return o.slug===salvo})?salvo:estado.ops[0].slug;
  desenhar();
}
iniciar();
})();
</script>
</body>
</html>`;
