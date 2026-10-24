/* Tela do LAB V2 (fase 4): uma pergunta por tela, detalhe só quando pedido.
   Página estática, sem dados: tudo é buscado na API com o ADMIN_TOKEN que a pessoa digita
   (guardado só na aba, em sessionStorage). Todo texto vindo da API entra por textContent. */

export const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LAB · Produtividade do time</title>
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
.erro{color:var(--ruim);font-weight:600}
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
var estado={ops:null,slug:null,data:null,pessoa:null};
function guardar(k,v){try{if(v==null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){}}
function ler(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
function el(tag,attrs,filhos){var n=document.createElement(tag);for(var k in (attrs||{})){if(k==='class')n.className=attrs[k];else if(k==='texto')n.textContent=attrs[k];else if(k.slice(0,2)==='on')n.addEventListener(k.slice(2),attrs[k]);else n.setAttribute(k,attrs[k])}(filhos||[]).forEach(function(f){if(f)n.appendChild(typeof f==='string'?document.createTextNode(f):f)});return n}
function limpar(){while(app.firstChild)app.removeChild(app.firstChild)}
function numero(n){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n)}
function data(d){var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function chip(s){return el('span',{class:'chip '+(s||'sem'),texto:s?ROTULO[s]:'Sem meta'})}
async function api(caminho){
  var r=await fetch(caminho,{headers:{authorization:'Bearer '+(ler('token')||'')}});
  if(r.status===401){guardar('token',null);throw new Error('401')}
  if(!r.ok){var c={};try{c=await r.json()}catch(e){}throw new Error(c.erro||('erro '+r.status))}
  return r.json();
}
function telaEntrada(msg){
  limpar();
  var campo=el('input',{type:'password',id:'tk',autocomplete:'current-password','aria-label':'Chave de acesso'});
  app.appendChild(el('h1',{texto:'LAB'}));
  app.appendChild(el('p',{class:'suave',texto:'Digite a chave de acesso (o ADMIN_TOKEN). Ela fica guardada só nesta aba do navegador.'}));
  if(msg)app.appendChild(el('p',{class:'erro',texto:msg}));
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
  var sair=el('button',{type:'button',texto:'Sair',onclick:function(){guardar('token',null);iniciar()}});
  return el('div',{class:'barra'},[estado.ops.length>1?sel:null,dt,hoje,sair]);
}
function agrupar(linhas){
  var por={};
  linhas.forEach(function(l){var k=l.pessoaId||'_op';(por[k]=por[k]||{id:k,nome:l.pessoa||'Operação',linhas:[]}).linhas.push(l)});
  return Object.keys(por).map(function(k){var g=por[k];g.status=g.linhas.reduce(function(a,l){return (PIOR[l.status]||0)>(PIOR[a]||0)?l.status:a},null);return g});
}
async function desenhar(){
  limpar();
  app.appendChild(el('p',{class:'suave',texto:'Carregando…'}));
  var q=estado.data?('?data='+encodeURIComponent(estado.data)):'';
  var r;
  try{r=await api('/admin/operacoes/'+encodeURIComponent(estado.slug)+'/ritmo'+q)}
  catch(e){if(e.message==='401')return telaEntrada('Chave recusada. Confira e tente de novo.');limpar();app.appendChild(el('p',{class:'erro',texto:'Não consegui carregar: '+e.message}));return}
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
async function iniciar(){
  if(!ler('token'))return telaEntrada();
  limpar();app.appendChild(el('p',{class:'suave',texto:'Carregando…'}));
  try{estado.ops=await api('/admin/operacoes')}
  catch(e){return telaEntrada(e.message==='401'?'Chave recusada. Confira e tente de novo.':'Não consegui falar com a API: '+e.message)}
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
