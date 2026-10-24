# Frente G — Economia da venda, "fonte única" e classificação dos testes do LAB V1

Base lida: recorte de funções do CRM (precPol, precEcon, margemDe, financeiroDe, orcVigente), `fontes__lab*.js`, SQLs 25 e 36, testes do V1 (receita_liquida, rbt12, fonte_verdade, contrato_valor, producao, producao_credito, comissao, compras_venda, master, cadeia, lab_fonte_unica, reconciliacao, eventos, esforco) e os cabeçalhos de todos os outros. Tudo somente leitura. Onde a função não está no recorte (taxaMaq, condFrac, kitImp, precCapital, precFixos, comissaoDaMargem, margemVenda, custosPrevistos), digo isso e só descrevo o que os testes provam.

---

## 1. Como o LAB V1 enxerga a economia de uma venda

**Ideia central:** uma venda não vale o "valor fechado". Vale o que sobra depois de tirar imposto, taxa de cartão/financiadora, antecipação, comissão, custo da obra e o custo do dinheiro parado até o cliente pagar. O V1 faz essa conta uma vez só, num motor (a Precificação), e todo o resto (Financeiro, Dashboards, LAB) lê dela.

Para o RevOps isso importa por quatro motivos:
- **Vendedor que vende muito pode destruir margem.** O LAB V1 tem a tabela "Margem por vendedor" (desconto médio, vendas abaixo do limite, MC final R$, MC % final, "MC perdida no desconto"). Volume sem margem não é resultado.
- **Canal barato por lead pode ser caro por real de margem.** CAC e retorno do canal são medidos em cima de margem, não de receita ("receita não é lucro", texto do V1).
- **Condição de pagamento muda a venda.** À vista, cartão 12x, financiamento, 60/40, entrada + cartão, em etapas: cada uma tem taxa, antecipação e capital exposto diferentes. O V1 mostra MC % e "capital médio exposto" por condição.
- **O mês precisa pagar a estrutura.** O card "Contribuição necessária no mês" diz quantas vendas faltam para empatar com o custo fixo e para atingir o lucro desejado.

**Vocabulário do V1 (todos no código):**
- **Receita bruta** (`bruta`, `P`): preço de venda.
- **Receita líquida (RL)** = bruta − imposto − taxa − antecipação − comissão. Decisão de 09/10/2026, mesma na Precificação, no DRE do Financeiro e no LAB.
- **MC (margem de contribuição)** = RL − custos − custo financeiro do prazo.
- **MCbruta** = RL − custos (sem o custo financeiro do prazo; este fica em linha própria).
- **MC %** = MC ÷ RL (base única). A % sobre o preço existe, mas é nomeada ao lado (`MCpctPreco`, `pctPreco`).
- **Margem alvo / margem mínima**: duas metas em % da RL (`mcAlvo`, `mcMin`), lidas de `precos()`; exemplo do teste: 24% e 20%.
- **Desconto** = (aprovado − final) ÷ aprovado. "MC perdida no desconto" = MC no preço aprovado − MC no preço final.
- **Preço recomendado → aprovado → final**, mais **limite** (alçada) e **mínimo** (piso gravado no negócio ao aprovar).

**O que vem do CRM e o que o LAB calcula**

| Vem do CRM (dado) | O LAB calcula (ou só lê pronto) |
|---|---|
| Valor fechado, etapa, data do ganho, dono no ganho (`funil.hist[].dono`) | MC aprovada × final por venda (`lbpLinhas` chama `precEcon` duas vezes: no preço aprovado e no final) |
| Orçamento aprovado e suas versões (`orcVigente`, `orcVersoes`, `gestao/fin:orc:<id>.versoes`) | Desconto, MC perdida, abaixo do limite/piso |
| Política de preço (`gestao/fin:politica`, `config/precos`): imposto, comissão, margem alvo/mín., taxas, prazos | Margem agregada (`margemAgregada`), MC média 90 dias |
| Forma de pagamento definida no ganho (`funil.pag`: tipo, n, entrada) | Contribuição necessária no mês, vendas para empatar |
| Contas a pagar pagas ligadas à venda (baixas do Financeiro) = custo real | CAC, CPL, retorno, ROI por canal (investimento lançado à mão no LAB, mês a mês) |
| Custo fixo orçado (`precFixos`, seção 7 da Precificação) | Ponto de equilíbrio de desconto e de entrada (`labBreakEvenDesconto`, `labBreakEvenEntrada`) |

Ou seja: **o LAB quase não tem fórmula econômica própria.** Ele consome o motor do CRM. Duas fontes são digitadas dentro do LAB: investimento por canal/mês e meta do ciclo.

**Payback:** não encontrei "payback" nos fontes do LAB. O que existe é retorno (margem − investimento), ROI sobre margem (margem ÷ investido − 1) e ROAS (receita ÷ investimento) no Construtor. O V2 já calcula payback por canal, então nesse ponto o V2 está à frente.

---

## 2. Regras e fórmulas exatas do recorte

### 2.1 `precPol()` — a política vigente
Devolve um pacote de números lidos, sem calcular nada:
- `v`, `em`, `por`: versão, data e quem publicou a política.
- `mcAlvo = Number(P.margemAlvo)` e `mcMin = Number(P.margemMin)`. Comentário: "uma fonte só: margem alvo e mínima em % da receita líquida (config/precos)".
- `antecip`: taxa de antecipação do cartão (% do valor). `custoCapital`: padrão **1,5** se não houver valor gravado (unidade não aparece no recorte; no motor do LAB o custo de capital padrão é 2% ao mês, `custoCapitalMes`).
- `pag`: prazos em dias do kit, da obra e do imposto (dia do mês, padrão **20**). Vêm do Financeiro (`fn:cfg.integ`). A política "só lê". Texto: "o Financeiro é a realidade".
- `cond`: por condição de pagamento (`vista`, `cartao`, `c6040`, `fin/bel/via`, `entcartao`, `etapas`, `p7030`…): nº de parcelas `n` e `n2`, quem autoriza (`aut`), a divisão do recebimento (`frac`, via `condFrac`) e quando recebe (`receb`, via `condReceb`).
- `cont`: percentuais de contingência por item (`POL_CONT`).
- `cen`: cenário de estresse, padrão `consCustos:10` (custos +10%), `consAtraso:15` (15 dias de atraso), `protMc:3` (proteção de 3 pontos de MC).
- `custosFixos` (ou null) e `historico` das versões.

### 2.2 `precEcon(e, P, pol, condF)` — a economia de uma venda ao preço P
Passo a passo, na ordem do código:
1. **Condição** = `condF` ou `e.cond` ou `vista`. `c = orcCalc('fv', e, 0)` calcula custos e itens do orçamento. Se `e.notaIntegral`, usa os parâmetros com `kitNoCaixa: 1` (kit passa pela empresa; ver RBT12 abaixo).
2. **Imposto (ISS no código)**: `iss = Pp.iss/100`. Comentário: "imposto: só a política (decisão 2 de 08/10/2026)". Ou seja: o orçamento não pode ajustar imposto.
3. **Base do imposto** = `P − kb`, onde `kb = kitImp(kit, Pp)` (parte do kit excluída da base). `imp = (P − kb) × iss`.
4. **Taxa**: `t` depende da condição: cartão = `taxaMaq(n || 12)`; `c6040` = fração1 × `taxaMaq(n)` + fração2 × `taxaMaq(n2)` (frações vêm de `condFrac('c6040')`, não de 0,6/0,4 escritos no código); financiamento (`fin*`, `bel*`, `via*`) = `taxaFinanciadora`; demais = 0. `taxa = P × t`.
5. **Antecipação**: só cartão e 60/40: `antecip = P × pol.antecip/100`.
6. **Líquido antes da comissão**: `liq = P − imp − taxa − antecip`.
7. **Comissão** = `com × liq`, `RL = liq − comissao`. Duas regras:
   - Comissão **digitada no orçamento é fixa** (`comFixa`).
   - Sem ela, a comissão **segue a margem** (`comissaoDaMargem`, ver §4) e isso é circular (a margem depende da comissão). O código resolve por **iteração de ponto fixo**: até 60 voltas, com amortecimento de 0,7, parando quando a diferença for menor que 1e-10.
8. **Custo financeiro do prazo**: `cap = precCapital(P, {kit, custos, imp, taxa, antecip, comissao}, cond, pol)`; `cap.custo` é o custo do dinheiro que a empresa banca até receber (também devolve `cap.maxNeed`, o capital máximo exposto).
9. **Quebra dos custos**: `cont` = item "Contingência…"; `cpv` = soma dos itens que casam com `PREC_CPV`; `csp = custos − cpv − cont`.
10. **Fórmulas finais:**
    - `CV = custos + cap.custo`
    - `MC = RL − CV`
    - `MCpct = MC ÷ RL` (se RL > 0), `MCpctPreco = MC ÷ P`
    - **`MCbruta = RL − custos`** e `MCbrutaPct = MCbruta ÷ RL`. Comentário: "a definição única (sem o custo financeiro do prazo, que fica como linha própria)".
    - `fixo = fixoPct × P` (custo fixo rateado como % do preço, se o fixo estiver orçado) e `lucro = MC − fixo`, `lucroPct = lucro ÷ P`.
    - `deducoes = imp + taxa + antecip + comissao`.

**Fórmula de preço (da Precificação, provada em `fonte_verdade.test.js`):**
`Preço = [Custo ÷ ((1 − m)(1 − c)) − kit] ÷ (1 − t) + kit`, onde m = margem alvo, c = % de comissão, t = % de imposto. O teste garante que um negócio fechado exatamente no preço recomendado tem a margem alvo no Financeiro (ida e volta).

### 2.3 `financeiroDe(d)` — previsto, real e efetiva
Conceito mais importante do recorte. Cada venda ganha tem três leituras:
- **Previsto (`prev`)**: o que o orçamento dizia. **Decisão 3b, 08/10/2026:** o previsto oficial é a **versão aprovada** do orçamento (itens, perdas, contingência, tabela de mão de obra), congelada em `gestao/fin:orc:<id>.versoes`. Sem versão (venda antiga, avulsa, wallbox, manutenção), usa a planilha de custos com os parâmetros atuais e o kit da proposta ou do orçamento.
- **Real (`real`)**: o que foi pago. **Decisão 6, 08/10/2026:** custo real oficial = **baixas do Financeiro** (contas a pagar pagas ligadas à venda, de qualquer origem), **excluindo** comissão, impostos e taxas (naturezas `n_comis`, `n_imp`, `n_taxa`, porque esses são calculados). Entram também os custos internos e as reservas (gerenciamento, acompanhamento, vistoria, garantia, contingência), que não geram conta a pagar mas são custo; sem isso a margem "real" subiria só por falta de título. Sem nenhuma baixa, vale o custo digitado no painel Gestão (legado, `realFonte='lancado'`). `realFonte` diz qual: `'baixas'` ou `'lancado'`.
- **Efetiva (`efetiva`)**: `out.real && !out.realParcial ? out.real : out.prev`. Se ainda há custo da venda **não pago**, o real é **parcial** (`realParcial`) e a margem efetiva **continua sendo a prevista**. Só vira real quando tudo foi pago.

**Receita da venda (`receita`)**, em ordem de prioridade:
1. Se o gestor definiu a forma no ganho (`FF.pag.tipo` e valor > 0): a receita é o **valor da venda** (o que o cliente paga) e a taxa da forma é recalculada (cartão: `taxaCartaoEf(taxaMaq(n))`; financiadora: `taxaFinanciadora`; 60/40: média ponderada pelas frações; entrada + cartão: taxa × parte no cartão, ou seja `(V − entrada)/V`; etapas e 70/30 guardam os vencimentos).
2. Senão, `receitaDaForma(R, forma)` a partir da proposta, e se fechou por outro valor, a receita acompanha proporcionalmente (`rec.R × valor/base`, base = estimativa à vista, total da forma no cartão, investimento sem repasse no financiamento).
3. Sem proposta no sistema (negócio importado): ainda conta pela receita do funil se a etapa for ganho e o valor > 0; os custos entram à mão. Se não for ganho, devolve `null`.

**Política congelada:** venda ganha usa a política **do dia do ganho** (`funil.politica`); vendas anteriores a 10/2026 usam a vigente. A constante `REGRAS_V2_EM` (data de corte das regras v2 de custos) é usada, mas o valor não aparece no recorte. A comissão ajustada no orçamento (`OV.ov.comissao`) vale na venda e no Financeiro e vira comissão fixa; **imposto nunca é ajustado por orçamento**.

### 2.4 `margemDe(d)` (shell.js) — a margem que as telas mostram
Lê `financeiroDe(d).efetiva` e devolve:
- `rl = receita − impostos − taxa − comissao`
- `pct = margem ÷ rl` (base única), `pctPreco = margem ÷ receita`
- `fonte: 'real'` ou `'prevista'` (para a tela dizer de onde veio o número).

### 2.5 `orcVigente(d)`
Devolve o orçamento vigente (`d.orc.vig`) **somente se** `vig.preco > 0`; senão `null`. É a porta de entrada do "preço aprovado" para o LAB.

---

## 3. "Fonte única" / "fonte da verdade" no V1

**Princípio:** cada número tem **um dono** (uma função). Quem precisa dele chama o dono; ninguém recalcula. Os testes **leem o código-fonte** e falham se a duplicação reaparecer.

### 3.1 `fonte_verdade.test.js` (economia) — donos e como a duplicação é barrada
| Número | Dono único | Como o teste impede duplicação |
|---|---|---|
| Preço, margem, comissão, imposto de um negócio | Precificação (`precificar`) = Financeiro (`margemVenda`) | Mesmo negócio nos dois dá o mesmo R$ (margem, comissão, imposto, tolerância 0,01) e a margem % = margem alvo |
| Margem % | `margemDe()` / `margemAgregada()` sobre a **receita líquida** | Procura no código o padrão antigo `margemT/(custoT + margemT)` e `x.margem/(x.custo + x.margem)` e exige que não existam; o LAB Construtor tem de nomear "margem % do preço (receita bruta; a política mede % da receita líquida)" |
| Ticket médio | `ticketMedio` (shell.js) | Exige o uso nos 6 módulos (Dashboards, Gestão, Comercial, LAB, Relatórios, plano) |
| Receita de venda ganha | `valorNegocio` | Proíbe `Number(funilDe(d).valor)` puro em lab.js, aovivo.js, marketing.js, lab_plan.js |
| Meta de receita | Plano do LAB do ciclo (`metaDoCiclo`, `metaPessoaCiclo`); config só como padrão | Exige que Dashboards, LAB e Precificação chamem essas funções |
| Margem mínima | `precos().margemMin` | Alerta da OS e piso da oferta de fechamento leem dela; proíbe "abaixo do piso de 20%" escrito |
| Dias por mês | `DIAS_MES = 30,4375` | Proíbe `30.4375*DIA` e `30.4/` espalhados |
| Condições de pagamento | Tabela única `COND_PAG` + `condFrac()` | Proíbe 60/20/20, 60/40, 0,6 escritos em 6 arquivos (gestao, financeiro, precificacao, shell, comercial, build.py da proposta); exige mínimo 8 condições e que cada divisão some 100% |
| Margem padrão do LAB | Nenhuma própria | Proíbe `margemPadrao` no LAB. Sem vendas com custo, o LAB usa a regra da Precificação aplicada ao projeto-exemplo |
| Projeto-exemplo | `config/precos.exemplo` | Proíbe um segundo exemplo escrito no código |
| Quem grava `config/precos` | **Só a Precificação** (com versão e motivo) | Conta que há exatamente 1 `patchDoc('config/precos'` em toda a base |
| Custo real | Baixas do Financeiro | Exige `realFonte='baixas'` e que parcial não vire efetiva |
| Previsto | Versão aprovada do orçamento | Exige a leitura de `fin:orc` versões |
| Caixa do projeto | `pjCaixa` (uma função, duas telas) | Exige uso na OS e no Financeiro |
| Classificação 🟢🟡🔴 do projeto | `pjClassificar` | Exige uso na OS, na auditoria e no Financeiro |
| Dashboard executivo | Só chama as funções donas, e cada cartão **nomeia a fonte** | Lista 11 funções obrigatórias e proíbe `funilDe(d).valor` direto |

Também há **regras de integridade** nesse teste que um Jarvis precisa: toda edição do valor da venda passa pela alçada e pelo piso (4 caminhos: ganho, negócio, Forecast, "Acertar"); a exceção é registrada com quem, motivo, preço, mínimo e impacto, mostrados **antes** de confirmar; o banco confere o piso (SQL 27); **mudar a política depois não reescreve vendas já feitas** (teste 10: após subir imposto +5 e comissão +3, o previsto da venda nova não muda; a venda antiga sem `precoRef` segue a vigente); aditivos de obra usam a mesma conta; dois lados nunca somam o mesmo dinheiro ("previsão da venda e pedido aprovado não somam duas vezes"); "resultado e caixa lado a lado, nunca somados".

O teste tem um mecanismo útil: verificações **DIVERGÊNCIA** não derrubam o teste, são achados da auditoria que viram falha à medida que as prioridades são entregues.

### 3.2 `lab_fonte_unica.test.js` (planejamento) — decisões D1/D3/D4/D12/D13/D14 de 09/10/2026
- **D12**: a venda é do dono **no momento do ganho** (`vendedorDaVenda`): usa `funil.hist` com `e:'ganho'` e `dono`; sem registro, cai no consultor atual; sem consultor, "Sem consultor".
- **D13**: encaixe de canal por prefixo: "Tráfego Pago" encaixa em "Tráfego Pago - Novos leads"; "Tráfego Pago Meta" encaixa em "Tráfego Pago"; sem par, mantém o nome; automático de dois nomes do mesmo canal soma no canal da meta.
- **D14**: meta do período = **soma das metas dos ciclos** que o período toca (10/jan a 20/mar cobre 3 ciclos: 100 + 200 + 300 mil = **600.000**), não "meta × dias ÷ 30,4". Pessoa sem meta = `null`, nunca zero. Período "tudo" = `null`.
- **D4**: investimento realizado é **rateado pelos dias do mês** dentro do ciclo. Ciclo 05/09–05/10: `3000×26/30 + 3100×4/31`. Mês-calendário inteiro = valor lançado. Canal sem lançamento = 0.

### 3.3 Fonte única de eventos (`eventos.test.js`, `reconciliacao.test.js`)
Outra "fonte única": **`eventos.js`** transforma histórico, tentativas e agenda em **eventos** (cada fato tem id estável, um dono e um crédito). Contagens da Produtividade, do Plano do dia e do LAB leem desses eventos, então **nada é contado duas vezes**. Regras provadas: tentativa de contato = 1 para quem registrou; a movimentação de cadência não é tentativa; ajuste do gestor substitui o original e o crédito continua com quem fez; cancelado não conta; no-show não é realizada; pulo de etapa (lead → SQL) **não** gera reunião nem oportunidade, vira "inferido" listado à parte; automação mudando etapa não é fato comprovado; venda reaberta não conta, ganho de novo conta 1 na data do último fechamento.
`reconciliacao.test.js` compara a regra antiga com a nova e exige que **toda diferença tenha motivo** (`correcao`, `pulo`, `admin`, `autoria`, `revisita`, `digitado`, `congelado`), com `antigo − novo = soma dos motivos` em toda linha; um fato sem explicação "bloqueia" (`pronto=false`).

---

## 4. O que os testes de economia garantem (nomes e valores)

**receita_liquida.test.js** (DRE do Financeiro): com venda 100.000, imposto 10.000, taxa 2.000, comissão 1.760, kit 40.000, marketing 1.000: **receita líquida = 86.240**; a comissão fica nas deduções da receita, **inclusive quando o plano de naturezas salvo a colocou em despesas comerciais**; lucro líquido não muda (**45.240**); marketing continua em despesas comerciais.

**rbt12.test.js** (base do imposto Simples; regra do contador, 09/10/2026): RBT12 = soma das notas emitidas nos últimos 12 meses, só vendas **ganhas**. Nota normal = venda − kit (o kit vai direto do distribuidor): 30.000 − 12.000 = **18.000**. Nota integral (cliente no lucro real) = **140.000**. Kit passando pela empresa (`kitNoCaixa`) = valor inteiro. Se não há proposta, o kit vem do orçamento aprovado: 10.000 − 4.000 = **6.000**. Total **RBT12 = 164.000**; com `kitNoCaixa` = **180.000**. Venda de 400 dias atrás e negócio não ganho ficam fora.

**comissao.test.js** (`comissaoDaMargem`, decisão 09/10/2026 "não há teto"): com comissão alvo 2%, mínima 1%, margem alvo 24%, mínima 20%: margem 24% → **2%**; 20% → **1%**; 22% → **1,5%** (linear); abaixo da mínima (10%) → **1%** (piso); acima da alvo continua subindo: 28% → **3%**, 32% → **4%** (antes parava em 1,5× a alvo); comissão fixa → sempre a alvo. Em palavras: comissão = 1% + 0,25 × (margem − 20%), com piso de 1% e sem teto. É um incentivo para o vendedor defender margem.

**fonte_verdade.test.js**: ver §3.1. Valores concretos: projeto-exemplo 7,44 kWp, 12 placas, kit 10.000, 30 km; condições com divisão que soma 100%.

**contrato_valor.test.js**: venda ganha cujo valor difere do contrato gerado vira alerta (venda 48.000 × contrato 50.000, o contrato guarda centavos: `5000000`); diferença de centavos (50.000,40) não alerta; negócio aberto, sem contrato gerado ou contrato sem total não alertam.

**compras_venda.test.js**: refazer as contas da venda preserva o abatimento feito por uma compra: kit 9.000, compra abateu 3.000, valor refeito **6.000**; se a venda sobe para 9.500, o título fica **6.500**; se o abatimento cobre tudo (5.000 + 4.000), o título é cancelado com o motivo "Substituída pela compra…"; vínculo com a OS preservado. (CRM/operação, mas protege a margem real.)

**master.test.js**: papel Master acima do administrador: a regra de negócio só **avisa** ("Fora do planejado…") e grava nota no histórico; admin, vendedor e técnico continuam barrados; em modo local ninguém é Master. Os 4 bloqueios do movimento de etapa passam por isso. Permissão, não economia; a ideia útil é "gestor sênior pode furar a regra, com rastro".

**producao.test.js** (`prCalcular`): atraso acumula (meta 10/dia, seg 10, ter 5, hoje qua → a fazer 15, atraso 5); adiantado abate; declarado vale por cima quando maior; atraso atravessa semana (herda 20, a fazer 30); **recuperação distribuída (09/10/2026)**: atraso 20, janela 5 → alvo = 10 + ceil(20/5) = **14**, parcela 4/dia; ajuste do administrador soma no total, fora dos canais, e nunca deixa o feito negativo; dia sem trabalho: nada do atraso entra.

**producao_credito.test.js** (quatro decisões de 09/10/2026): reunião agendada é de quem agendou (SDR) e o dono não conta de novo; trocar o vendedor não leva a produção passada (cada etapa conta para o dono **naquele momento**); reunião realizada é de quem conduziu; oportunidade (SQL) é do dono **e** crédito do SDR que agendou. Em todos o total do time é 1, nunca 2.

**cadeia.test.js** (build-up reverso): 150.000 ÷ ticket 30.000 = **5 vendas**; ÷ 50% = **10 oportunidades**; ÷ 80% = **13 realizadas** (ceil); ÷ 70% = **19 agendadas**; ÷ 20% = **95 leads**; contatos = 19 ÷ 30% = **64**. Modo exato sem arredondar: 12,5 realizadas; fatia de 13.917 vira 0,46 venda, não 1. Premissa "2 vendas a cada 5 leads" manda nos leads (13). Canal filho herda premissas do canal-pai ("Indicação clientes" ← "Indicação"), taxa por taxa, marcado como herdado. Falta dado: aponta **o que falta** (`falta: ['ticket']`), não inventa.

**esforco.test.js**: meta 100, esperado 40, feito 30 → saldo 70, progresso 30%, "atrás", tendência 75; coorte com janela de 90 dias que já maturou 30 dias; lead → agendada 3/4 = 75%; lead → venda 1/4; **amostra mínima 3** sinalizada sem esconder o canal.

---

## 5. Classificação dos 139 arquivos de teste

Contagem: 139 arquivos = 48 `*.test.js` na raiz, 65 em `ui/` (inclui README e package-lock/json), 20 entre `sql/` e `sql/completo/`, mais `daily/` (2 scripts e 1 base), `backup/rodar.sh`, `ci_local.sh` e `rodar.js`.

### 5.1 LAB — reproduzir no V2 (economia, planejamento, produtividade, inteligência)
**Economia da venda (frente G, prioridade máxima):** `receita_liquida`, `fonte_verdade` (partes de preço/margem/comissão/imposto/condições), `comissao`, `rbt12` (**só como configuração do pack solar**, ver §8), `correcoes_negocio` (receita da venda no cartão, taxa 60/40 com antecipação, desconto na quitação fora do DRE), `financeiro_refazer` (refazer contas não apaga fatos).
**Fonte única / contagem:** `lab_fonte_unica`, `eventos`, `reconciliacao`, `producao`, `producao_credito`, `esforco`, `responsabilidades`, `metas_dia`, `agenda_realizadas`.
**Planejamento:** `cadeia`, `lab_metas`, `lab_objetivos`, `lab_quarter`, `lab_fecho`, `lab_fecho_acao`, `lab_fecho_diag`, `contingencia`, `plano_dia`, `daily_motor`, `daily_nucleo`, `daily_worker` (fechamento do dia no servidor).
**Inteligência:** `lab_modelo`, `lab_motor`, `lab_inteligencia`, `lab_validacao`, `paineis`, `studio`.
**UI do LAB** (`ui/`): `lab_cadeia_exata`, `lab_fecho*` (5), `lab_fora_curva`, `lab_metas`, `lab_paineis`, `lab_plano`, `lab_plano_produtividade`, `lab_projsemana`, `lab_quarter`, `lab_receita_corte`, `lab_studio`, `lab_trilhas`, `lab_validacao`, `lab_validacao_acesso`, `daily`, `contingencia`, `plano_dia_esforco`, `plano_dia_semana_ciclo`, `closer_pre_propria`, `vendedor_fixo`, `virada`, `indefinidos`, `visita_parcial`, `agenda_drill`, `cadencia_tarefa`.
**SQL do LAB** (`sql/`): `lab_foto`, `lab_studio`, `plano_dia`, `producao`, `eventos`, `reconciliar_eventos.js`, `comissoes` (se a comissão virar dado do pack), `canal_trafego`.

### 5.2 CRM comum — fora de escopo do LAB V2
- **WhatsApp:** `ui/whatsapp_*` (8 arquivos: atribuir, audio, contato, encerrar, erro, lead, midia, pessoas, rolagem, sla), `integracoes` (conector WhatsApp).
- **Propostas, orçamento e contrato:** `ui/proposta_kits`, `ui/orc_sequencia`, `ui/contrato_ganho`, `ui/cartao_sem_juros`, `ui/simulacao_cartao`, `ui/simulacao_busca_negocio`, `contrato_valor`, `compras_venda`.
- **Conta de luz / consultoria solar:** `leitor_conta`, `ui/leitor_conta`, `zero_export`, `ui/zero_export`, `consultoria`, `ui/consultoria_*`, `diligencia`, `ui/diligencia`, `ui/entrega6`, `ui/entrega_contato`. (Específicos da solar; não entram no motor geral.)
- **Permissões e pessoas:** `master`, `permissoes_memo`, `identidade`, `ui/permissoes`, `ui/identidade`, `ui/_ident_main`, `ui/responsabilidades`, `sql/campos_protegidos`, `sql/completo/acessos`.
- **Infraestrutura:** `backup`, `backup_aviso`, `backup_worker`, `backup/rodar.sh`, `fila_gravacao`, `automacoes_claim`, `sintaxe`, `xlsx`, `ci_local.sh`, `rodar.js`, `ui/rodar_ci`, `ui/fumaca`, `ui/zero_export`, `sql/sistema`, `sql/estrutura_minima`, `sql/bi`, `sql/compras_leitura`, `sql/completo/*`, `enablement` + `ui/enablement*` (treinamento da equipe).
- **Fora do corte mas a decidir:** `compras_venda` e `financeiro_refazer` (contas a pagar/OS) pertencem ao módulo Financeiro/Projetos do CRM; o LAB só consome o resultado (custo real). O V2 só precisa deles se decidir ter financeiro próprio.

---

## 6. Comparação com o V2 atual

**O que o V2 tem:** preço de referência/aprovado/fechado, linhas de custo informadas, MC = fechado − custos, desconto, CAC, ROI e payback por canal, MC − CAC.

**O que falta (por impacto):**
1. **Receita líquida.** Sem imposto, taxa, antecipação e comissão, a MC do V2 é a "MCbruta sem deduções" e **superestima** a margem. Para o V1, 10% de imposto + 2% de taxa + ~2% de comissão tiram ~14% do preço antes dos custos.
2. **Política de preço versionada.** Margem alvo, margem mínima, imposto, comissão alvo/mínima, taxas por condição, prazos. Hoje o V2 tem a tabela `politica_preco` mas sem essas regras funcionando. Falta também congelar a política **no dia do ganho** (teste 10 do V1): mudar a política não pode reescrever o passado.
3. **Preço recomendado e piso.** Fórmula inversa que dá o preço para atingir a margem alvo; piso gravado no negócio ao aprovar; alçada (limite do vendedor); exceção registrada com quem, motivo e impacto na MC.
4. **Comissão ligada à margem**, sem teto, com piso (§4). Hoje o V2 nem registra comissão.
5. **Condição de pagamento e custo financeiro do prazo.** Taxa da condição, antecipação, capital exposto e custo do dinheiro (`custoCapital`). Sem isso, o V2 trata cartão 12x igual a à vista.
6. **Previsto × real × efetiva.** O V2 tem um valor de custo só. O V1 diferencia o previsto (versão aprovada), o real (baixas pagas) e a efetiva (previsto até pagar tudo). Isso mede **erro de orçamento por obra** (tabela "Custo estimado × realizado") e alimenta a contingência.
7. **MC por vendedor, por produto, por condição, por faixa de ticket** e **MC perdida no desconto**. O V2 só tem o desconto.
8. **Contribuição necessária no mês** (custo fixo, ponto de equilíbrio, vendas que faltam) e **break-even de desconto/entrada** (`labBreakEvenDesconto`: `volEq = contribAtual / contribNova`).
9. **Custo de aquisição com mês incompleto marcado** (D21): se falta investimento lançado em algum mês do ciclo, CPL/CAC/ROI viram `null`, não um número errado. Convém verificar se o V2 já faz isso.
10. **Fonte única + testes que leem o código** (§3): o V2 precisa de uma regra de dono por número.

### O que o V2 precisa para servir a **qualquer** operação (sem copiar a solar)
- **Deduções como configuração do pack:** lista ordenada de deduções, cada uma `{nome, base (preço | preço − parte excluída), tipo (percentual | tabela por condição), fonte}`. Solar: ISS/Simples sobre `preço − kit`, taxa de maquininha, antecipação. SaaS: imposto sobre receita, taxa de gateway, comissão. Licitação: imposto, retenções, garantia.
- **Condições de pagamento como tabela do pack:** `{id, divisão em partes, dias de recebimento, taxa}`. O motor só sabe somar parcelas e custo do dinheiro; não sabe o que é "cartão 60/40".
- **Custo do dinheiro:** `custoCapital` por operação (V1: 1,5 na política, 2%/mês no motor do LAB).
- **Comissão:** regra do pack entre `fixa`, `faixa por margem` e `nenhuma`.
- **Itens de custo com categoria:** CPV (variável, do produto), serviço, contingência, interno, reserva. O conceito `interno/reserva` do V1 (custo que não gera conta a pagar mas existe) é geral.
- **Margem: um único dono.** MC % sempre sobre RL; MC % do preço sempre ao lado e nomeada.
- **Previsto congelado na aprovação** e **política congelada no ganho**, como campos genéricos no `preco_negocio`.
- **Custo real** vindo do Financeiro quando existir; senão, lançamento manual rotulado (`realFonte`).

---

## 7. O que isso entrega que uma planilha não entrega

1. **Uma conta só, auditável.** Planilha tem N versões da margem; o V1 tem testes que **falham** se alguém reescrever a regra em outro lugar.
2. **Congelamento no tempo.** A venda guarda a política do dia; a planilha recalcula tudo quando você muda uma célula.
3. **Circularidade resolvida.** Comissão depende da margem que depende da comissão: planilha entra em referência circular; o motor itera até convergir.
4. **Rastro de exceção.** Quem baixou abaixo do piso, por que, quanto isso custou de MC, **antes** de confirmar.
5. **Previsto × real automático**, com erro por obra e contingência recalibrada.
6. **Cruzamento que planilha não faz sozinha:** desconto × conversão × MC, vendedor × margem, canal × margem × CAC, condição × capital exposto.
7. **"Não sei" honesto:** `null` quando falta dado (meta de pessoa sem meta, CAC com mês sem investimento, taxa sem amostra), nunca zero.
8. **Reconciliação:** cada diferença entre regra antiga e nova tem motivo, e um fato sem motivo bloqueia a virada.
9. **Memória imutável do ciclo** (retrato assinado, fechamento do dia que só acrescenta), base para aprender com decisões passadas.

---

## 8. Riscos e armadilhas ao portar

1. **Dependência de dados do CRM que o V2 não tem.** `financeiroDe` lê propostas (`resumoDe`), versões de orçamento (`fin:orc`), contas a pagar (`fnTitulos`), funil (`funilDe`), forma de pagamento (`funil.pag`). Se o V2 não tiver contas a pagar, **não existe "real"**. Decidir cedo: o V2 terá financeiro próprio, ou aceitará lançamento manual de custo real (rotulado)?
2. **Regras da solar embutidas no motor.** São configuração do pack solar, **não** do núcleo:
   - Kit como parte do preço que sai da base do imposto (`kitImp`) e a nota que exclui o kit (RBT12 e Simples).
   - Nota integral para cliente no lucro real; `kitNoCaixa`.
   - Cartão 60/40, entrada + cartão, financiadoras Bel/Via, 70/30, em etapas.
   - Tabela de preço por kWp, placas, km de deslocamento, wallbox, manutenção.
   - Contingência por item e `PREC_CPV` por nome ("Contingência…" casado por texto).
   - Dia 20 do imposto; prazo do kit e da obra.
   - Datas de corte (`REGRAS_V2_EM`, "vendas anteriores a 10/2026").
3. **Casamento de itens por nome.** `precEcon` acha contingência e CPV por expressão regular sobre o **nome** do item. Frágil; no V2 use categoria explícita.
4. **Percentual sobre base errada.** O V1 conviveu com duas "margem %" (sobre RL e sobre preço) e só unificou em 08/10/2026. Reproduza as duas, nomeadas, desde o início.
5. **Comissão sem teto** (decisão de 09/10/2026) é política de negócio; no V2 deve ser opção, não regra fixa. Sem teto + piso 1% pode surpreender em margem muito alta.
6. **Iteração de ponto fixo** (60 voltas, 0,7, 1e-10): converge nos casos normais, mas comissão por faixa com descontinuidade pode oscilar. Teste com margens negativas e RL ≤ 0 (o V1 devolve `null` em `MCpct` quando RL ≤ 0).
7. **Fonte da meta.** O V1 vive com duas metas (config padrão e plano do LAB); só em 08/10 elegeu o plano. O V2 já tem `meta` só de acréscimo; manter assim.
8. **Funções fora do recorte** que o port exige ler antes de reimplementar: `margemVenda`, `comissaoDaMargem` (fórmula deduzida dos testes, não vista), `precCapital` (custo do prazo, ainda não visto), `taxaMaq`, `taxaFinanciadora`, `taxaCartaoEf`, `condFrac`, `condReceb`, `kitImp`, `precFixos`, `orcCalc`, `custosPrevistos`, `receitaDaForma`, `politicaFiscal`. Sem `precCapital` não dá para afirmar a fórmula do custo financeiro do prazo.
9. **Marcos de data que explicam bugs antigos:** 08/10/2026 (previsto oficial, custo real por baixas, imposto só pela política, taxonomia única), 09/10/2026 (receita líquida, RBT12, comissão sem teto, recuperação distribuída, crédito de produção), 10/10/2026 (metas oficiais D16–D19), 20/10/2026 (foto diária exclui operações independentes), 23/10/2026 (quarter, backup). O V2 deve começar já com essas decisões incorporadas, não repetir o caminho.
10. **Foto diária (SQL 25/36)** recalcula no banco a receita do ciclo com a mesma regra da tela (dono no ganho, operações independentes, dias úteis pelo calendário do plano). Isso mostra o risco de ter a regra em dois lugares (SQL e JS); no V2 convém a regra viver só no pacote de métricas e o banco apenas guardar.
