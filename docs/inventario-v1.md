# Inventário do LAB V1 (Amicta) para a V2

O código da V1 (commit `c0c2f22`, 24/10/2026) foi lido por completo. Este é o resumo do que vai para a V2. A V1 continua intacta.

## Veredito por módulo

| Módulo V1 | Veredito | Observação |
|---|---|---|
| `lab_objetivos.js` (consistência, cenários, replanejar, distribuir diário, d1–d11, viabilidade, programa) | **Manter**, é núcleo | Puro. Generalizar as etapas fixas (`LPO_TIPO`, `mapaTx`) e os papéis SDR/closer |
| `contingencia_motor.js` (régua 100/90/75%, alvo diário = meta do dia + atraso ÷ dias restantes) | **Manter** | Puro. Hoje há dois "alvos de hoje" (contingência × recuperação do plano do dia); unificar |
| `daily_motor.js` (Fechamento do dia) | **Manter** | Puro. Usar id de pessoa nas chaves de alerta |
| `lab_plan.js` (`LAB_MET`, histórico de taxas, build-up reverso, 4 projeções, sinais, equipe, canais custo/retorno) | **Manter e reescrever a base** | Três caminhos de distribuição divergentes viram um. Visitas técnicas viram pack |
| `lab_metas.js` (meta oficial, desconhecida ≠ zero) | **Manter** | Meta em uma tabela só; registro de encerramento no servidor |
| `lab_quarter.js` (6 fases, bottom-up, gatilhos, reprevisão) | **Manter** | Unificar as três projeções; quarter não precisa ser sempre 3 ciclos mensais |
| `lab_fecho*.js` (retrato imutável, diagnóstico fato/interpretação/hipótese) | **Manter** | Tirar textos que citam menus do CRM |
| `lab_motor.js`, `lab_modelo.js`, `lab_inteligencia.js`, `lab_biblioteca.js` | **Manter** o motor, a condição de 6 parâmetros, as pontes e o forecast | Regras já são dado; o impacto em R$ e o cálculo das métricas são código e serão reescritos |
| `lab_studio_motor.js` (grafo, direto, reverso, monitor) | **Manter** | Puro. Unificar com o construtor |
| `lab_construtor.js` | **Manter** CPL, CAC, ROAS, desconto, conversão elegível e pares | Árvore vira declarativa; kWp e kit viram pack |
| `lab_semana.js`, `lab_projsemana.js` | **Manter** | `SM_ROTEIRO` vira pack. Não inventar comparecimento de 0,75 sem dado |
| `lab_paineis.js` | **Manter** o motor e os widgets | Sem a área financeira e de operação |
| `lab_validacao.js` | **Reaproveitar** como motor de qualidade de dados | A tela de migração não vem |
| `lab.js` (abas) | Funil, vendedores, simulador, gargalos, hipóteses, meta, forecast e produtividade: **manter**. Correlação e tempo: **generalizar** | Operação e Curva de caixa: **descartar** |
| `lab_simulador.js` | **Manter** o snapshot congelado × realizado | Caixa: descartar |
| `lab_trilhas.js` | **Manter** o conceito | Telas novas |
| `worker/daily.mjs` | **Manter** o padrão: tique, idempotência, log, complemento | Não rodar o front-end inteiro no servidor |

## Hipóteses

- **Núcleo de receita:** H-COM-002, 003, 004, 007, 008 e 010; H-SOL-014 (cancelamento pós-venda) e H-SOL-018 (concentração), que sobem para o núcleo.
- **Pack solar:** H-SOL-011, 015, 016, 017 e 019.
- **Descartadas (financeiro e operação):** H-FIN-001, 005 e 006; H-OPE-009; H-SOL-012, 013 e 020; os compostos C-001 a C-003.

## Problemas da V1 que a V2 resolve na base

1. Pessoas identificadas por nome → **ids** (D7).
2. O mesmo número calculado em vários lugares (realizado, ticket, meta, projeção) → **uma função por número** (fase 2).
3. Duas regras de atribuição de venda (dono no ganho × consultor atual) → regra única, explícita na métrica.
4. Conversão por fluxo (painéis) × por coorte (fechamento) → as duas existem, com nomes diferentes.
5. Rotinas automáticas no navegador (foto diária, captura de contingência, meta) → **cron no servidor**.
6. Configuração em documentos chave-valor que crescem sem limite → **tabelas próprias**.
7. Termos solares e "Amicta" fixos no código → **packs**.
