/* Objetivos e critérios: regras puras portadas do LAB V1 (lab_objetivos.js; testes/lab_objetivos.test.js é o contrato).
   O que entra na Onda 2: operadores de objetivo, catálogo de critérios configuráveis, classe do desvio, veredito conjunto dos sinais e a ponte entre previsões.
   (Consistência de metas, cenários por premissa, replanejamento e programa de ciclos ficam para a onda do quarter.) */
const num = (v: unknown): number | null => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
export const brl = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : 'R$ ' + Math.round(v).toLocaleString('pt-BR'));
export const pctTxt = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + '%');

/* tipos de objetivo: o alvo é o resultado desejado; nunca é previsão */
export type OperadorObjetivo = 'atingir' | 'min' | 'max' | 'faixa' | 'maximizar' | 'minimizar';
export const OPERADORES: Record<OperadorObjetivo, string> = { atingir: 'atingir', min: 'pelo menos', max: 'no máximo', faixa: 'ficar entre', maximizar: 'maximizar', minimizar: 'minimizar' };
export interface Avaliacao { estado: 'sem_dado' | 'sem_alvo' | 'ok'; ok: boolean | null; gap: number | null; direcao?: 'subir' | 'descer' | 'manter' }
export function avaliarObjetivo(obj: { op?: OperadorObjetivo; alvo?: number | null; alvo2?: number | null }, valor: unknown): Avaliacao {
  const v = num(valor), a = num(obj.alvo), b = num(obj.alvo2), op = obj.op ?? 'atingir';
  if (v == null) return { estado: 'sem_dado', ok: null, gap: null };
  if (op === 'atingir' || op === 'min') { if (a == null) return { estado: 'sem_alvo', ok: null, gap: null }; return { estado: 'ok', ok: v >= a - 1e-9, gap: Math.max(0, a - v), direcao: 'subir' }; }
  if (op === 'max') { if (a == null) return { estado: 'sem_alvo', ok: null, gap: null }; return { estado: 'ok', ok: v <= a + 1e-9, gap: Math.max(0, v - a), direcao: 'descer' }; }
  if (op === 'faixa') { if (a == null || b == null) return { estado: 'sem_alvo', ok: null, gap: null }; const lo = Math.min(a, b), hi = Math.max(a, b); return { estado: 'ok', ok: v >= lo - 1e-9 && v <= hi + 1e-9, gap: v < lo ? lo - v : v > hi ? v - hi : 0, direcao: v < lo ? 'subir' : v > hi ? 'descer' : 'manter' }; }
  return { estado: 'ok', ok: null, gap: null, direcao: op === 'maximizar' ? 'subir' : 'descer' };
}

/* ---------- catálogo de critérios (D11): cada um com padrão, descrição, unidade e abrangência; o configurado vem do pack ou da operação ---------- */
export interface Criterio { k: string; nome: string; padrao: number; un: '%' | 'eventos' | 'dias úteis' | 'dias' | 'horas'; desc: string; abr: string }
export const CRITERIOS: Criterio[] = [
  { k: 'metaRisco', nome: 'Meta em risco', padrao: 95, un: '%', desc: 'A projeção ajustada abaixo deste % da meta de receita/vendas gera o sinal "meta em risco". A meta pode estar em risco mesmo com o volume de atividade em dia.', abr: 'Sinais, projeção do ciclo' },
  { k: 'trajetoria', nome: 'Indicador atrás da trajetória', padrao: 85, un: '%', desc: 'Um indicador de volume abaixo deste % do esperado até hoje gera o sinal de trajetória.', abr: 'Sinais' },
  { k: 'trajetoriaGrave', nome: 'Trajetória: gravidade alta', padrao: 60, un: '%', desc: 'Abaixo deste % do esperado o sinal de trajetória passa a gravidade alta.', abr: 'Sinais' },
  { k: 'conversao', nome: 'Conversão abaixo do histórico', padrao: 70, un: '%', desc: 'Uma conversão do ciclo abaixo deste % da histórica gera o sinal de conversão. Com amostra menor que a mínima o sinal sai com confiança baixa, nunca some.', abr: 'Sinais' },
  { k: 'volumeOk', nome: 'Volume de atividade em dia', padrao: 90, un: '%', desc: 'Os indicadores de volume acima deste % do esperado contam como "atividade em dia". Atividade em dia não significa resultado em dia.', abr: 'Classe do desvio, veredito, quadrante do plano do dia' },
  { k: 'minN', nome: 'Amostra mínima para taxa', padrao: 10, un: 'eventos', desc: 'Abaixo disso uma taxa é referência de baixa confiança, não base estatística.', abr: 'Plano do dia, sinais, comparações de conversão' },
  { k: 'janelaRecup', nome: 'Janela de recuperação do atraso', padrao: 5, un: 'dias úteis', desc: 'O atraso acumulado é diluído em até N dias úteis (ou menos, quando o ciclo está acabando).', abr: 'Plano do dia, contingência' },
  { k: 'parado', nome: 'Negócio sem atividade registrada', padrao: 5, un: 'dias', desc: 'Dias sem atividade registrada para um negócio entrar na lista de atenção.', abr: 'Plano do dia' },
  { k: 'proposta', nome: 'Proposta sem acompanhamento', padrao: 3, un: 'dias', desc: 'Dias desde a proposta sem acompanhamento para o negócio entrar na lista de atenção.', abr: 'Plano do dia' },
  { k: 'novoLeadHoras', nome: 'Lead novo (crítico) até', padrao: 24, un: 'horas', desc: 'Lead criado há menos de N horas sem contato é ação crítica.', abr: 'Plano do dia' },
  { k: 'diasPadrao', nome: 'Dias para identificar padrão', padrao: 10, un: 'dias úteis', desc: 'Dias de desvio para o LAB chamar de padrão recorrente.', abr: 'Plano do dia' },
  { k: 'janelaConv', nome: 'Conversão por canal: janela da coorte', padrao: 90, un: 'dias', desc: 'Leads criados nesta janela formam a referência histórica de conversão de cada canal.', abr: 'Conversão por canal' },
  { k: 'maturacaoConv', nome: 'Conversão por canal: maturação', padrao: 30, un: 'dias', desc: 'A janela termina N dias atrás, para os leads terem tempo de converter.', abr: 'Conversão por canal' },
];
export function criterio(cfg: Record<string, unknown> | null | undefined, k: string) {
  const c = CRITERIOS.find(x => x.k === k); if (!c) return null;
  const v = cfg && cfg[k] != null && cfg[k] !== '' && isFinite(Number(cfg[k])) ? Number(cfg[k]) : null;
  return { k, nome: c.nome, un: c.un, padrao: c.padrao, valor: v != null ? v : c.padrao, fonte: v != null ? ('configurado' as const) : ('padrão' as const), desc: c.desc, abr: c.abr };
}
export interface Limiares { metaRisco: number; trajetoria: number; trajetoriaGrave: number; conversao: number; volumeOk: number; minN: number; janelaRecup: number; parado: number; proposta: number; novoLeadHoras: number; diasPadrao: number; janelaConv: number; maturacaoConv: number }
/* limiares em fração (os critérios em % viram 0–1) */
export function limiares(cfg?: Record<string, unknown> | null): Limiares {
  const out: Record<string, number> = {};
  for (const c of CRITERIOS) { const x = criterio(cfg, c.k)!; out[c.k] = c.un === '%' ? x.valor / 100 : x.valor; }
  return out as unknown as Limiares;
}

/* ---------- classes de desvio: o tipo do problema decide a investigação; nunca "falta de esforço" quando o volume foi feito ---------- */
export const DESVIOS: Record<string, { nome: string; verificar: string }> = {
  d1: { nome: 'Volume de atividade abaixo do plano', verificar: 'agenda, cadência e capacidade da pessoa; o plano cabia nos dias úteis?' },
  d2: { nome: 'Volume dentro do plano, taxa de sucesso abaixo da referência', verificar: 'amostra de registros/chamadas, abordagem, mix de leads; não é falta de atividade' },
  d3: { nome: 'Qualidade da demanda abaixo do esperado', verificar: 'origem dos leads, critério de qualificação, mudança de campanha' },
  d4: { nome: 'Comparecimento abaixo do esperado', verificar: 'confirmação, intervalo entre agendamento e reunião, canal da reunião' },
  d5: { nome: 'Conversão baixa numa etapa específica', verificar: 'a etapa em questão: critério de passagem, tempo parado, motivo de perda' },
  d6: { nome: 'Pipeline insuficiente para o período', verificar: 'estoque por etapa × maturação; demanda adicional necessária e de onde virá' },
  d7: { nome: 'Maturação atrasada em relação ao ciclo histórico', verificar: 'tempo por etapa, negócios parados, próximos passos sem data' },
  d8: { nome: 'Capacidade insuficiente ou agenda sobrecarregada', verificar: 'redistribuir carteira, aumentar capacidade, rever premissas ou a meta' },
  d9: { nome: 'Ticket inferior ao objetivo', verificar: 'mix de produto/segmento, desconto × política, tamanho dos projetos' },
  d10: { nome: 'Margem ou caixa incompatíveis com as metas', verificar: 'preço × custo, condições de pagamento, exceções de alçada' },
  d11: { nome: 'Falha ou ausência de dados', verificar: 'registro das atividades, agenda e funil; sem dado não há diagnóstico' },
};
export type OrigemSinal = 'meta' | 'trajetoria' | 'demanda' | 'capacidade' | 'comparecimento' | 'conversao' | 'resultado' | 'ticket' | 'margem' | 'dados' | 'protecao' | 'padrao' | 'hip';
const VOLUME = /^(leads|tentativa|contato|agendamento|reuniao_realizada|proposta_enviada|visitas)$/;
export function classeDesvio(s: { origem?: OrigemSinal | string; ind?: string; volOk?: boolean; maturacao?: boolean; padrao?: string }) {
  const o = s.origem ?? '', ind = s.ind ?? '', volume = VOLUME.test(ind);
  let k: string | null = null;
  if (o === 'dados') k = 'd11'; else if (o === 'capacidade') k = 'd8'; else if (o === 'comparecimento') k = 'd4'; else if (o === 'ticket') k = 'd9'; else if (o === 'margem') k = 'd10';
  else if (o === 'conversao' || o === 'resultado') k = s.volOk ? 'd2' : 'd5'; else if (o === 'protecao') k = /lead|agenda/.test(ind) ? 'd3' : 'd2';
  else if (o === 'demanda') k = 'd6'; else if (o === 'meta') k = s.maturacao ? 'd7' : 'd6';
  else if (o === 'trajetoria') k = volume ? 'd1' : ind === 'oportunidades' ? 'd5' : 'd6';
  else if (o === 'padrao') k = s.padrao === 'tend' ? 'd9' : s.padrao === 'gargalo' || s.padrao === 'anom' ? 'd5' : null;
  return k ? { k, ...DESVIOS[k]! } : null;
}

/* ---------- veredito conjunto dos sinais: os limiares são avaliados juntos para não haver alertas contraditórios ---------- */
export interface Veredito { k: 'sem_dados' | 'resultado' | 'atividade' | 'risco' | 'conversao' | 'volume' | 'ok'; titulo: string; texto: string }
export function veredito(s: { metaRisco?: boolean | null; volOk?: boolean | null; convBaixa?: boolean | null; dadosFaltam?: boolean; confBaixa?: boolean }): Veredito {
  if (s.dadosFaltam && s.volOk == null && s.metaRisco == null) return { k: 'sem_dados', titulo: 'Sem dados suficientes para avaliar', texto: 'Falta registro para medir volume e resultado; corrija o registro antes de cobrar.' };
  if (s.metaRisco && s.volOk) return { k: 'resultado', titulo: 'Atividade em dia, resultado em risco', texto: 'O volume está no plano, mas a projeção fica abaixo da meta: o problema é conversão, qualidade da demanda, ticket ou maturação, não falta de atividade.' + (s.confBaixa ? ' A comparação de conversão tem amostra pequena: confiança baixa.' : '') };
  if (s.metaRisco && s.volOk === false) return { k: 'atividade', titulo: 'Atividade abaixo do plano e meta em risco', texto: 'O volume está abaixo do planejado; recuperar a atividade é a primeira alavanca, e a conversão continua sendo acompanhada à parte.' };
  if (s.metaRisco) return { k: 'risco', titulo: 'Meta em risco', texto: 'A projeção fica abaixo da meta' + (s.volOk == null ? ' e não há meta de volume para dizer se é atividade ou conversão' : '') + '.' };
  if (s.convBaixa && s.volOk) return { k: 'conversao', titulo: 'Atividade em dia, conversão abaixo da referência', texto: 'A meta ainda não está em risco, mas a conversão caiu: investigar antes que a projeção caia.' + (s.confBaixa ? ' Amostra pequena: confiança baixa.' : '') };
  if (s.volOk === false) return { k: 'volume', titulo: 'Atividade abaixo do plano, resultado ainda dentro', texto: 'O resultado segue dentro do esperado, mas o volume não: a folga vem de conversão ou de pipeline antigo e tende a acabar.' };
  return { k: 'ok', titulo: 'Dentro do plano', texto: 'Atividade, conversão e projeção dentro das faixas configuradas.' + (s.dadosFaltam ? ' Alguns indicadores estão sem dado.' : '') };
}

/* ---------- ponte entre duas previsões: por que a projeção mudou (novos fechamentos, pipeline, leads que ainda vão entrar, outros) ---------- */
export interface Previsao { receita?: number | null; vendas?: number | null; componentes?: { real?: number | null; pipe?: number | null; novas?: number | null } }
export function ponte(ant: Previsao | null, nova: Previsao | null, extras?: { fechados?: string[]; pipeline?: string[] }) {
  const a = ant ?? {}, b = nova ?? {}, ca = a.componentes ?? {}, cb = b.componentes ?? {}, passos: Array<{ nome: string; valor: number; itens: string[] }> = [];
  const add = (nome: string, v: number, lista?: string[]) => { if (Math.abs(v) > 1e-9) passos.push({ nome, valor: v, itens: lista ?? [] }); };
  add('Novos fechamentos', (num(cb.real) ?? 0) - (num(ca.real) ?? 0), extras?.fechados);
  add('Pipeline (avanços, atrasos, perdas)', (num(cb.pipe) ?? 0) - (num(ca.pipe) ?? 0), extras?.pipeline);
  add('Leads que ainda vão entrar', (num(cb.novas) ?? 0) - (num(ca.novas) ?? 0));
  const total = (num(b.receita) ?? 0) - (num(a.receita) ?? 0), soma = passos.reduce((s, p) => s + p.valor, 0), resto = total - soma;
  if (Math.abs(resto) > 0.005) passos.push({ nome: 'Outros (ticket, premissas)', valor: resto, itens: [] });
  return { de: num(a.receita), para: num(b.receita), total, passos };
}
