/* Contrato do motor do Studio: os mesmos casos e números do studio.test.js da V1. */
import { describe, expect, it } from 'vitest';
import { antesDepois, comparar, direto, layout, monitorar, parametros, prontidao, reverso, sensibilidade, teto, temErro, validar, wilson, type Modelo, type Observado } from '../src/index.js';

const cods = (V: { cod: string }[]) => V.map(x => x.cod);

/* modelo do exemplo do briefing: 1.000 leads → 30% agendam → 70% comparecem → 50% viram oportunidade → 25% compram */
const linear = (): Modelo => ({
  nos: { L: { tipo: 'entrada', nome: 'Leads', un: 'lead', vol: 1000, fonte: 'premissa' }, A: { tipo: 'etapa', nome: 'Agendamento', un: 'reuniao' }, R: { tipo: 'etapa', nome: 'Reunião realizada', un: 'reuniao' }, O: { tipo: 'etapa', nome: 'Oportunidade', un: 'oportunidade' }, V: { tipo: 'resultado', nome: 'Vendas', un: 'contrato', ticket: 30000 } },
  arestas: { a1: { de: 'L', para: 'A', taxa: 0.3, fonte: 'historico', n: 400 }, a2: { de: 'A', para: 'R', taxa: 0.7, fonte: 'historico', n: 120 }, a3: { de: 'R', para: 'O', taxa: 0.5, fonte: 'premissa' }, a4: { de: 'O', para: 'V', taxa: 0.25, fonte: 'hipotese' } },
});

describe('cálculo direto', () => {
  it('1.000 → 300 → 210 → 105 → 26,25 vendas e R$ 787.500', () => {
    const D = direto(parametros(linear()));
    expect(D.v.A).toBeCloseTo(300); expect(D.v.R).toBeCloseTo(210); expect(D.v.O).toBeCloseTo(105);
    expect(D.resultado.V!.vol).toBeCloseTo(26.25); expect(D.resultado.V!.contratado).toBeCloseTo(787500);
    expect(D.perdaImpl.L).toBeCloseTo(700);          // perda implícita: o que não avança
    expect(D.fluxo.a2).toBeCloseTo(210);
    expect(temErro(validar(parametros(linear())))).toBe(false);
  });
  it('premissa nova recalcula tudo e não altera o modelo original', () => {
    const M = linear(); M.arestas!.a1!.taxa = 0.4;
    const D = direto(parametros(M));
    expect(D.v.A).toBeCloseTo(400); expect(D.resultado.V!.vol).toBeCloseTo(35);
  });
  it('teto arredonda para cima sem transformar 105,0000000001 em 106', () => { expect(teto(105.0000000001)).toBe(105); expect(teto(104.2)).toBe(105); expect(teto(null)).toBeNull(); });
});

describe('cálculo reverso com inteiros', () => {
  const P = parametros(linear());
  it('20 vendas pedem 762 leads (761,9 arredondado para cima) e 229/160/80 por etapa', () => {
    const R = reverso(P, 'V', 20);
    expect(R.ok).toBe(true);
    expect(R.entradas.L!.inteiro).toBe(762); expect(R.entradas.L!.exato).toBeCloseTo(20 / (0.3 * 0.7 * 0.5 * 0.25));
    expect(R.nos.A!.inteiro).toBe(229); expect(R.nos.R!.inteiro).toBe(160); expect(R.nos.O!.inteiro).toBe(80);
    expect(R.resultadoComInteiros!).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(R.rendimento!.L).toBeCloseTo(0.02625);
    expect(R.avisos.some(a => /não têm evidência/.test(a))).toBe(true);
  });
  it('meta em R$: 600 mil ÷ 30 mil = 20 vendas; 610 mil pedem 21 (nunca fração de venda)', () => {
    const R = reverso(P, 'V', 600000, { medida: 'receita' });
    expect(R.ok && R.alvoInteiro === 20 && R.entradas.L!.inteiro === 762).toBe(true);
    expect(reverso(P, 'V', 610000, { medida: 'receita' }).alvoInteiro).toBe(21);
  });
  it('pipeline aberto contribui: 40 oportunidades × 25% = 10 vendas; faltam 10 → 381 leads', () => {
    const R = reverso(P, 'V', 20, { estoque: { O: 40 } });
    expect(R.contrib).toBeCloseTo(10); expect(R.falta).toBeCloseTo(10); expect(R.entradas.L!.inteiro).toBe(381);
  });
  it('em R$ sem ticket explica e não calcula; sem taxa no caminho diz qual falta', () => {
    const semTicket = linear(); delete semTicket.nos!.V!.ticket;
    const R1 = reverso(parametros(semTicket), 'V', 100000, { medida: 'receita' });
    expect(R1.ok).toBe(false); expect(R1.erro).toMatch(/ticket/);
    const semTx = linear(); semTx.arestas!.a3!.taxa = null;
    const R2 = reverso(parametros(semTx), 'V', 20);
    expect(R2.ok).toBe(false); expect(R2.erro).toMatch(/Reunião realizada → Oportunidade/);
    expect(cods(validar(parametros(semTx)))).toContain('sem_taxa');
    expect(direto(parametros(semTx)).v.O).toBe(0);
  });
});

describe('ramificações (decisão)', () => {
  const ram = (): Modelo => ({
    nos: { L: { tipo: 'entrada', nome: 'Leads', vol: 100 }, Q: { tipo: 'decisao', nome: 'Qualificação' }, S: { tipo: 'etapa', nome: 'Qualificado' }, X: { tipo: 'perda', nome: 'Desqualificado' }, F: { tipo: 'etapa', nome: 'Retomada futura' }, V: { tipo: 'resultado', nome: 'Venda' } },
    arestas: { a: { de: 'L', para: 'Q', taxa: 1 }, b: { de: 'Q', para: 'S', taxa: 0.6 }, c: { de: 'Q', para: 'X', taxa: 0.3 }, d: { de: 'Q', para: 'F', taxa: 0.1 }, e: { de: 'S', para: 'V', taxa: 0.5 } },
  });
  it('100 → 60 qualificados, 30 desqualificados, 10 retomada; decisão que fecha 100% sem aviso', () => {
    const M = ram(), P = parametros(M), D = direto(P);
    expect(D.v.S).toBeCloseTo(60); expect(D.v.X).toBeCloseTo(30); expect(D.v.F).toBeCloseTo(10); expect(D.resultado.V!.vol).toBeCloseTo(30);
    expect(cods(validar(P)).some(c => /decisao|distribuicao/.test(c))).toBe(false);
  });
  it('saídas somando 120%: erro; distribuindo 90%: aviso', () => {
    const M = ram(); M.arestas!.c!.taxa = 0.5;
    expect(cods(validar(parametros(M)))).toContain('distribuicao'); expect(temErro(validar(parametros(M)))).toBe(true);
    M.arestas!.c!.taxa = 0.2;
    expect(cods(validar(parametros(M)))).toContain('decisao_aberta'); expect(temErro(validar(parametros(M)))).toBe(false);
  });
  it('layout: camadas da esquerda para a direita, sem sobrepor', () => {
    const pos = layout(parametros(ram()), 'LR');
    expect(pos.L!.x).toBeLessThan(pos.Q!.x); expect(pos.Q!.x).toBeLessThan(pos.S!.x); expect(pos.S!.x).toBeLessThan(pos.V!.x);
    expect(new Set(Object.values(pos).map(p => p.x + ',' + p.y)).size).toBe(6);
  });
});

describe('convergência e dupla contagem', () => {
  const conv = (): Modelo => ({ nos: { A: { tipo: 'entrada', nome: 'Leads', vol: 100 }, B: { tipo: 'etapa', nome: 'Reunião' }, C: { tipo: 'resultado', nome: 'Oportunidade' } }, arestas: { ac: { de: 'A', para: 'C', taxa: 0.2 }, ab: { de: 'A', para: 'B', taxa: 0.5 }, bc: { de: 'B', para: 'C', taxa: 0.4 } } });
  it('C recebe 20 direto + 20 via B = 40, com aviso de dupla contagem; exclusiva silencia', () => {
    const M = conv(), P = parametros(M);
    expect(direto(P).v.C).toBeCloseTo(40);
    expect(validar(P).some(x => x.cod === 'convergencia' && x.alvo === 'a:ac')).toBe(true);
    M.arestas!.ac!.exclusiva = true;
    expect(cods(validar(parametros(M)))).not.toContain('convergencia');
  });
});

describe('ciclos e retornos', () => {
  const ciclo = (): Modelo => ({ nos: { L: { tipo: 'entrada', nome: 'Leads', vol: 100 }, N: { tipo: 'etapa', nome: 'Negociação' }, P2: { tipo: 'etapa', nome: 'Proposta revisada' }, V: { tipo: 'resultado', nome: 'Venda' } }, arestas: { a: { de: 'L', para: 'N', taxa: 1 }, b: { de: 'N', para: 'V', taxa: 0.3 }, c: { de: 'N', para: 'P2', taxa: 0.5 }, d: { de: 'P2', para: 'N', taxa: 0.6 } } });
  it('ciclo sem regra de retorno: erro e nenhum número', () => {
    const P = parametros(ciclo());
    expect(temErro(validar(P))).toBe(true); expect(cods(validar(P))).toContain('ciclo'); expect(direto(P).ok).toBe(false);
  });
  it('retorno com 1 volta: 100 entram, 30 retornam; vendas 30 + 9 = 39', () => {
    const M = ciclo(); M.arestas!.d!.retorno = true; M.arestas!.d!.maxVoltas = 1;
    const P = parametros(M), D = direto(P);
    expect(temErro(validar(P))).toBe(false);
    expect(D.novo.N).toBeCloseTo(100); expect(D.ret.N).toBeCloseTo(30); expect(D.v.N).toBeCloseTo(130);
    expect(D.resultado.V!.vol).toBeCloseTo(39); expect(D.novo.L).toBeCloseTo(100); expect(D.ret.L).toBeCloseTo(0);
  });
  it('3 voltas: 30 + 9 + 2,7 + 0,81; limite inválido é erro; reverso considera os que voltam', () => {
    const M = ciclo(); M.arestas!.d!.retorno = true; M.arestas!.d!.maxVoltas = 3;
    expect(direto(parametros(M)).resultado.V!.vol).toBeCloseTo(30 * (1 + 0.3 + 0.09 + 0.027));
    M.arestas!.d!.maxVoltas = 0; expect(cods(validar(parametros(M)))).toContain('retorno_regra');
    M.arestas!.d!.maxVoltas = 2;
    const R = reverso(parametros(M), 'V', 40);
    expect(R.ok).toBe(true); expect(R.resultadoComInteiros!).toBeGreaterThanOrEqual(40 - 1e-9); expect(R.entradas.L!.inteiro).toBeLessThan(Math.ceil(40 / 0.3));
  });
});

describe('capacidade e limite da fonte', () => {
  it('chegam 210, a etapa processa 150 e 60 ficam na fila; meta acima da capacidade é impossível', () => {
    const M = linear(); M.nos!.R!.cap = { v: 150, por: 'periodo' };
    const P = parametros(M), D = direto(P);
    expect(D.v.R).toBeCloseTo(210); expect(D.proc.R).toBeCloseTo(150); expect(D.fila.R).toBeCloseTo(60); expect(D.v.O).toBeCloseTo(75);
    const R = reverso(P, 'V', 30);
    expect(R.ok).toBe(true); expect(R.impossiveis.some(x => x.no === 'R' && x.tipo === 'capacidade')).toBe(true);
  });
  it('acima do que a fonte entrega: impossível pela fonte', () => {
    const M = linear(); M.nos!.L!.limite = 800;
    expect(reverso(parametros(M), 'V', 30).impossiveis.some(x => x.tipo === 'fonte' && x.no === 'L')).toBe(true);
  });
});

describe('validações diversas', () => {
  it('taxa 140%, unidade R$ × contagem, órfão, sem entrada, duplicada, capacidade negativa', () => {
    let M = linear(); M.arestas!.a2!.taxa = 1.4; expect(cods(validar(parametros(M)))).toContain('taxa_invalida');
    M = linear(); M.nos!.X = { tipo: 'etapa', nome: 'Receita', un: 'brl' }; M.arestas!.ax = { de: 'V', para: 'X', taxa: 1 }; expect(cods(validar(parametros(M)))).toContain('unidade');
    M = linear(); M.nos!.Z = { tipo: 'etapa', nome: 'Solta' }; expect(validar(parametros(M)).some(x => x.cod === 'orfao' && x.alvo === 'n:Z')).toBe(true);
    expect(cods(validar(parametros({ nos: { a: { tipo: 'etapa', nome: 'x' } }, arestas: {} })))).toContain('sem_entrada');
    M = linear(); M.arestas!.dup = { de: 'L', para: 'A', taxa: 0.1 }; expect(cods(validar(parametros(M)))).toContain('duplicada');
    M = linear(); M.nos!.R!.cap = { v: -3 }; expect(cods(validar(parametros(M)))).toContain('capacidade');
  });
});

describe('cenários isolados', () => {
  const M = linear();
  M.cenarios = { conservador: { nome: 'Conservador', regras: { 'a:a1.taxa': { v: 0.2, fonte: 'historico', nota: 'banda inferior de Wilson' }, 'n:L.vol': { v: 800, fonte: 'premissa' } } } };
  it('conservador: 800 × 20% … = 14 vendas; base continua 26,25; o modelo não muda', () => {
    const Pc = parametros(M, 'conservador');
    expect(direto(Pc).resultado.V!.vol).toBeCloseTo(800 * 0.2 * 0.7 * 0.5 * 0.25); expect(direto(parametros(M, 'base')).resultado.V!.vol).toBeCloseTo(26.25);
    expect(M.arestas!.a1!.taxa).toBe(0.3); expect(M.nos!.L!.vol).toBe(1000);
    expect(Pc.alterados.length).toBe(2); expect(Pc.alterados.find(x => x.chave === 'a:a1.taxa')!.fonte).toBe('historico'); expect(Pc.arestas.a1!.fonte).toBe('historico');
  });
  it('cenário altera capacidade sem perder o resto do bloco', () => {
    M.cenarios!.otimista = { nome: 'Otimista', regras: { 'n:R.cap': { v: 100, fonte: 'premissa' } } };
    expect(parametros(M, 'otimista').nos.R!.cap!.v).toBe(100); expect(parametros(M, 'otimista').nos.R!.nome).toBe('Reunião realizada');
  });
  it('comparação: resultado, reverso, lacunas e viabilidade só com limite declarado', () => {
    const cmp = comparar(M, ['base', 'conservador'], 'V', { meta: 20 });
    expect(cmp.length).toBe(2); expect(cmp[1]!.resultado!.vol).toBeCloseTo(14); expect(cmp[1]!.reverso!.ok).toBe(true);
    expect(cmp[0]!.lacunas.some(x => /hipótese/.test(x))).toBe(true);
    expect(cmp[0]!.viavel).toBeNull(); expect(cmp[0]!.condicoes[0]).toMatch(/não avaliada/);
    M.nos!.L!.limite = 700;
    expect(comparar(M, ['base'], 'V', { meta: 20 })[0]!.viavel).toBe(false);   // 762 leads > 700
  });
});

describe('sensibilidade', () => {
  it('uma linha por taxa e por volume; taxa menor alavanca mais; esforço para +1 venda', () => {
    const S = sensibilidade(parametros(linear()), 'V', { pp: 0.05 });
    expect(S.ok).toBe(true); expect(S.L.length).toBe(5);
    const a4 = S.L.find(x => x.alvo === 'a:a4')!, a1 = S.L.find(x => x.alvo === 'a:a1')!;
    expect(a4.amp).toBeGreaterThan(a1.amp);
    expect(a4.ppPorUm!).toBeCloseTo(100 / 105, 3);                       // ≈ 0,95 p.p. em oportunidade→venda
    expect(S.L.find(x => x.tipo === 'volume')!.porUm!).toBeCloseTo(1000 / 26.25, 6);
    expect(S.alerta!.some(x => x.alvo === 'a:a4')).toBe(true);        // hipótese com grande efeito vira alerta
  });
  it('banda informada (histórico) substitui o ±p.p.', () => {
    const S = sensibilidade(parametros(linear()), 'V', { bandas: { a1: [0.25, 0.36] } });
    const a1 = S.L.find(x => x.alvo === 'a:a1')!;
    expect(a1.banda).toBe(true); expect(a1.lo).toBeCloseTo(0.25);
  });
});

describe('tempo e período', () => {
  it('defasagem de 30 dias num período de 30: nada cai no período; com 15, metade', () => {
    const M = linear(); M.arestas!.a1!.dias = 3; M.arestas!.a2!.dias = 4; M.arestas!.a3!.dias = 2; M.arestas!.a4!.dias = 21; M.diasPeriodo = 30;
    let D = direto(parametros(M));
    expect(D.lag.V).toBeCloseTo(30); expect(D.resultado.V!.fracPeriodo).toBeCloseTo(0);
    M.arestas!.a4!.dias = 6; D = direto(parametros(M));
    expect(D.resultado.V!.fracPeriodo).toBeCloseTo(0.5); expect(D.resultado.V!.noPeriodo).toBeCloseTo(26.25 / 2);
  });
});

describe('prontidão da campanha', () => {
  const ML = linear(); ML.nos!.L!.bind = { tipo: 'lead' }; ML.nos!.V!.bind = { tipo: 'ganho' }; ML.nos!.L!.limite = 2000; ML.nos!.R!.cap = { v: 400 };
  ML.nos!.I = { tipo: 'pos', nome: 'Entrega concluída', cap: { v: 30 } }; ML.arestas!.vi = { de: 'V', para: 'I', taxa: 1, fonte: 'historico', n: 50 };
  const camp = { brief: { publico: { icp: 'Empresas com mais de 50 pessoas', criterios: 'Faturamento > R$ 5 mi; decisor acessível' }, oferta: { produto: 'Plataforma', valor: 'Reduz 30% do custo', condicoes: 'Anual, 12x' }, canais: { lista: ['Tráfego Pago'] }, financeiro: { ticket: 30000, orcamento: 15000, margem: 0.25, pagamento: '30/70' }, experimento: { metrica: 'Oportunidade → venda', amostra: '40 oportunidades', continuar: '≥ 25%', corrigir: '15% a 25%', encerrar: '< 15%' } } };
  it('campanha vazia: não está pronta, com bloqueadores', () => {
    const PR = prontidao({}, null, {});
    expect(PR.pronto).toBe(false); expect(PR.bloq).toBeGreaterThanOrEqual(3); expect(PR.leitura).toMatch(/bloqueador/);
  });
  it('campanha completa: pronta, taxas sem evidência frágeis, entrega suficiente', () => {
    const PR = prontidao(camp, parametros(ML), { reverso: reverso(parametros(ML), 'V', 20) });
    expect(PR.pronto).toBe(true); expect(PR.bloq).toBe(0);
    expect(PR.L.find(x => x.k === 'evidencia')!.st).toBe('fragil');
    expect(PR.L.find(x => x.k === 'entrega')!.st).toBe('completo');
    expect('nota' in PR || 'probabilidade' in PR).toBe(false);
  });
  it('meta acima da fonte e da capacidade: bloqueadores com a conta', () => {
    const PR = prontidao(camp, parametros(ML), { reverso: reverso(parametros(ML), 'V', 80) });
    expect(PR.pronto).toBe(false); expect(PR.L.find(x => x.k === 'volume')!.st).toBe('bloqueador'); expect(PR.L.find(x => x.k === 'capacidade')!.st).toBe('bloqueador');
  });
});

describe('monitor', () => {
  const obs = (): Observado => ({
    nos: { L: { estado: 'ok', entradas: 480, saldo: 20, porCanal: { 'Tráfego Pago': 400, Indicação: 80 } }, A: { estado: 'ok', entradas: 150, saldo: 30, prazo: 2 }, R: { estado: 'ok', entradas: 100, saldo: 5 }, O: { estado: 'ok', entradas: 2 }, V: { estado: 'ok', entradas: 2 } },
    arestas: { a1: { estado: 'ok', k: 140, n: 480, porCanal: { 'Tráfego Pago': { k: 90, n: 400 }, Indicação: { k: 50, n: 80 } } }, a2: { estado: 'ok', k: 100, n: 140 }, a3: { estado: 'ok', k: 20, n: 100, imaturo: true }, a4: { estado: 'ok', k: 1, n: 3 } },
  });
  const P = parametros(linear()), D = direto(P);
  const MO = monitorar(P, D, obs(), { diasPeriodo: 30, decorridos: 15, minN: 5, meta: 20 });
  it('estados por bloco e conexão', () => {
    expect(MO.nos.L!.estado).toBe('dentro'); expect(MO.nos.L!.esperado).toBeCloseTo(500);
    expect(MO.nos.O!.estado).toBe('fora');
    expect(MO.arestas.a4!.estado).toBe('insuficiente'); expect(MO.arestas.a4!.motivo).toMatch(/amostra/);
    expect(MO.arestas.a3!.estado).toBe('atencao'); expect(MO.arestas.a3!.motivo).toMatch(/amadurecendo/);
    expect(MO.arestas.a1!.estado).toBe('dentro');
    expect(MO.arestas.a3!.perdidos).toBeCloseTo(30); expect(MO.arestas.a3!.impactoVol).toBeCloseTo(7.5); expect(MO.arestas.a3!.impactoRec).toBeCloseTo(225000);
  });
  it('diagnósticos: conversão sem atribuir causa, acúmulo (Little), dependência, canal, meta, gargalo', () => {
    expect(MO.diags.some(d => d.tipo === 'conversao_baixa' && /causa precisa de evidência/.test(d.consequencia) && !/SDR/.test(d.titulo))).toBe(true);
    expect(MO.diags.some(d => d.tipo === 'acumulo' && d.alvo === 'n:A')).toBe(true);
    expect(MO.diags.some(d => d.tipo === 'dependencia')).toBe(true);
    expect(MO.diags.some(d => d.tipo === 'canal_qualidade' && /Tráfego Pago/.test(d.titulo))).toBe(true);
    expect(MO.meta!.gap).toBeGreaterThan(0); expect(MO.diags.some(d => d.tipo === 'volume_meta')).toBe(true);
    expect(MO.gargalo!.chave).toMatch(/conv|entrada/);
    const dq = monitorar(P, D, obs(), { diasPeriodo: 30, decorridos: 15, minN: 5, meta: 6.2 * 3.3 }).diags.find(d => d.tipo === 'volume_meta')!;
    expect(dq.evidencia).toMatch(/contra a meta 20,5\./);
  });
  it('início do período, bloco sem vínculo e capacidade estourada', () => {
    const o = obs(); o.nos!.L!.entradas = 10;
    const m1 = monitorar(P, D, o, { diasPeriodo: 30, decorridos: 0.1, minN: 5 });
    expect(['insuficiente', 'dentro']).toContain(m1.nos.L!.estado);
    expect(monitorar(P, D, { nos: {}, arestas: {} }, { diasPeriodo: 30, decorridos: 10 }).nos.A!.motivo).toBe('bloco sem vínculo com o CRM');
    const M = linear(); M.nos!.R!.cap = { v: 100 }; const o2 = obs(); o2.nos!.R!.entradas = 90;
    expect(monitorar(parametros(M), direto(parametros(M)), o2, { diasPeriodo: 30, decorridos: 15 }).nos.R!.estado).toBe('bloqueado');
  });
  it('antes × depois e Wilson', () => {
    expect(antesDepois({ k: 20, n: 100 }, { k: 45, n: 100 }).st).toBe('melhorou');
    expect(antesDepois({ k: 20, n: 100 }, { k: 26, n: 100 }).st).toBe('igual');
    expect(antesDepois({ k: 1, n: 3 }, { k: 3, n: 4 }).st).toBe('amostra');
    const w = wilson(5, 10)!; expect(w[0]).toBeCloseTo(0.2366, 3); expect(w[1]).toBeCloseTo(0.7634, 3);
  });
});
