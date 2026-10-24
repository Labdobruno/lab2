/* Pack: tudo o que é específico de um modelo de negócio, escrito como dado (JSON), nunca como código.
   Um pack novo normalmente só declara o que muda em relação a outro ("herda": "base").
   Regras de herança (ver resolver.ts):
   - objetos são mesclados campo a campo;
   - listas com "chave" (atividades, canais, motivos, funis, linhas de preço…) são mescladas pela chave:
     mesma chave sobrescreve, chave nova entra no fim, "remover": true tira o item herdado;
   - a lista de etapas de um funil é substituída inteira quando o filho a declara (a ordem importa). */
import { z } from 'zod';
import {
  BASES_LINHA_PRECO, GRUPOS_LINHA_PRECO, GRUPOS_MOTIVO_PERDA, LADOS, PAPEIS_ATIVIDADE, PAPEIS_ETAPA,
  TIPOS_CANAL, TIPOS_NEGOCIO,
} from '../papeis.js';

const chave = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'use só letras minúsculas, números, _ e - (ex.: "reuniao_ag")');
const nome = z.string().trim().min(1);
const fracao = z.number().min(0).max(1);
const remover = z.boolean().optional();

export const EtapaPack = z.object({
  chave, nome,
  papel: z.enum(PAPEIS_ETAPA),
  prazoDias: z.number().int().positive().optional(),     // tempo esperado na etapa; acima disso o negócio "envelhece"
  descricao: z.string().optional(),
});

export const FunilPack = z.object({
  chave, nome,
  lado: z.enum(LADOS).optional(),                         // padrão: aquisição
  principal: z.boolean().optional(),
  etapas: z.array(EtapaPack).optional(),
  remover,
});

export const AtividadePack = z.object({
  chave, nome,
  papel: z.enum(PAPEIS_ATIVIDADE),
  unidade: z.string().optional(),                         // "ligações", "visitas"…
  metaDiaria: z.boolean().optional(),                     // entra no plano do dia como meta de esforço
  remover,
});

export const CanalPack = z.object({
  chave, nome,
  tipo: z.enum(TIPOS_CANAL),
  origemDeLead: z.boolean().optional(),                   // padrão: sim. Follow-up e base não geram lead novo
  pai: chave.optional(),
  remover,
});

export const MotivoPerdaPack = z.object({ chave, nome, grupo: z.enum(GRUPOS_MOTIVO_PERDA), remover });

export const LinhaPrecoPack = z.object({
  chave, nome,
  grupo: z.enum(GRUPOS_LINHA_PRECO),
  base: z.enum(BASES_LINHA_PRECO),
  valor: z.number().finite().nonnegative().optional(),   // % (0–1) ou R$; "informado" vem de cada venda
  remover,
});

export const CondicaoPagamentoPack = z.object({
  chave, nome,
  taxa: fracao.optional(),                                // custo da condição sobre o preço (maquininha, financeira); padrão 0
  remover,
});

export const PrecificacaoPack = z.object({
  margemAlvo: fracao.optional(),
  margemMinima: fracao.optional(),
  descontoMaximo: fracao.optional(),
  linhas: z.array(LinhaPrecoPack).optional(),
  condicoes: z.array(CondicaoPagamentoPack).optional(),
});

export const CalendarioPack = z.object({
  feriados: z.union([z.literal('BR'), z.literal('nenhum'), z.array(z.string().regex(/^\d{2}-\d{2}$/, 'feriado fixo no formato MM-DD'))]).optional(),
  diasUteis: z.array(z.number().int().min(0).max(6)).optional(),   // 0 = domingo
  inicioCicloDia: z.number().int().min(1).max(28).optional(),       // ciclo comercial começa neste dia do mês
  mesInicioAno: z.number().int().min(1).max(12).optional(),         // ano fiscal / quarters
  fuso: z.string().optional(),
});

export const CSPack = z.object({
  recorrente: z.boolean().optional(),                     // a receita é recorrente (assinatura, honorário mensal)?
  periodicidadeMeses: z.number().int().positive().optional(),
  janelaRenovacaoDias: z.number().int().positive().optional(),
  janelaIndicacaoDias: z.number().int().positive().optional(),
});

export const SEVERIDADES = ['alta', 'media', 'baixa'] as const;
/* Hipótese: "se isto for verdade (quando), isto custa tanto (impacto, em R$); faça aquilo (acao)".
   quando e impacto são fórmulas em texto (ver hipoteses/expr.ts); não há código no pack. */
export const HipotesePack = z.object({
  chave,
  titulo: nome,
  quando: z.string().min(1),
  impacto: z.string().min(1).optional(),
  acao: z.string().min(1),
  severidade: z.enum(SEVERIDADES).optional(),
  remover,
});

export const ParametrosPack = z.object({
  orcamentoAtencao: z.number().int().min(1).max(10).optional(),  // quantos achados aparecem de cada vez
  maturacaoCoorteDias: z.number().int().positive().optional(),  // quanto esperar até uma coorte "amadurecer"
  amostraMinima: z.number().int().positive().optional(),
  janelaHistoricaDias: z.number().int().positive().optional(),
});

/* Um item de lista no arquivo do pack pode ser parcial quando só ajusta um item herdado:
   basta a "chave" e os campos que mudam. A checagem completa roda no pack já resolvido. */
const parcial = <T extends z.ZodObject<{ chave: typeof chave } & z.ZodRawShape>>(item: T) =>
  item.partial().required({ chave: true } as never) as unknown as z.ZodObject<T['shape']>;

const camposPack = (estrito: boolean) => {
  const it = <T extends z.ZodObject<{ chave: typeof chave } & z.ZodRawShape>>(item: T) => (estrito ? item : parcial(item));
  return z.object({
    $schema: z.string().optional(),
    id: chave,
    nome: estrito ? nome : nome.optional(),
    versao: z.string().regex(/^\d+\.\d+\.\d+$/, 'versão no formato 1.0.0'),
    herda: chave.optional(),
    descricao: z.string().optional(),
    modelo: z.enum(['b2b', 'b2c', 'misto']).optional(),
    textos: z.record(z.string(), z.string()).optional(),
    calendario: CalendarioPack.optional(),
    funis: z.array(it(FunilPack)).optional(),
    atividades: z.array(it(AtividadePack)).optional(),
    canais: z.array(it(CanalPack)).optional(),
    motivosPerda: z.array(it(MotivoPerdaPack)).optional(),
    tiposNegocio: z.array(z.enum(TIPOS_NEGOCIO)).optional(),
    precificacao: PrecificacaoPack.extend({
      linhas: z.array(it(LinhaPrecoPack)).optional(),
      condicoes: z.array(it(CondicaoPagamentoPack)).optional(),
    }).optional(),
    hipoteses: z.array(it(HipotesePack)).optional(),
    cs: CSPack.optional(),
    parametros: ParametrosPack.optional(),
  }).strict();
};

/* o que se escreve no arquivo .json */
export const PackArquivo = camposPack(false);
/* o pack depois da herança: todo item completo */
export const Pack = camposPack(true);

export type Pack = z.infer<typeof Pack>;
export type PackArquivo = z.infer<typeof PackArquivo>;
export type EtapaPack = z.infer<typeof EtapaPack>;
export type FunilPack = z.infer<typeof FunilPack>;

/* Pack depois da herança: tudo preenchido, pronto para virar a configuração de uma operação. */
export interface PackResolvido {
  id: string;
  nome: string;
  versao: string;
  linhagem: string[];                       // ["solar-b2c", "base"]
  descricao?: string;
  modelo?: 'b2b' | 'b2c' | 'misto';
  textos: Record<string, string>;
  calendario: Required<Omit<z.infer<typeof CalendarioPack>, 'feriados'>> & { feriados: 'BR' | 'nenhum' | string[] };
  funis: (Omit<FunilPack, 'remover' | 'etapas'> & { lado: 'aquisicao' | 'pos_venda'; etapas: EtapaPack[] })[];
  atividades: Omit<z.infer<typeof AtividadePack>, 'remover'>[];
  canais: Omit<z.infer<typeof CanalPack>, 'remover'>[];
  motivosPerda: Omit<z.infer<typeof MotivoPerdaPack>, 'remover'>[];
  tiposNegocio: z.infer<typeof Pack>['tiposNegocio'] & {};
  precificacao: {
    margemAlvo?: number; margemMinima?: number; descontoMaximo?: number;
    linhas: Omit<z.infer<typeof LinhaPrecoPack>, 'remover'>[];
    condicoes: Omit<z.infer<typeof CondicaoPagamentoPack>, 'remover'>[];
  };
  hipoteses: Omit<z.infer<typeof HipotesePack>, 'remover'>[];
  cs: z.infer<typeof CSPack>;
  parametros: Required<z.infer<typeof ParametrosPack>>;
}
