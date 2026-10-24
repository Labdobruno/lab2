/* Aplicador: grava comandos canônicos no banco. É o único código que escreve dados de negócio.
   Regras que valem para qualquer fonte:
   - referências pelo id externo da fonte (tabela lab.vinculo), nunca por nome;
   - idempotente: aplicar o mesmo lote duas vezes dá o mesmo resultado;
   - um dado mais velho da fonte nunca sobrescreve um mais novo (fonte_atualizado_em);
   - mudança de etapa sem evento explícito vira transição "inferida", para o histórico não ter buracos. */
import { chaveDe, ordenarComandos, type Comando, type ComandoDe } from '@lab/nucleo';
import type { Sql, TransactionSql } from 'postgres';
import { ErroDeEntrada, type Mapa } from './tipos.js';

type Tx = Sql | TransactionSql;

export interface ContextoAplicacao {
  operacaoId: string;
  conectorId: string;
  mapa?: Mapa | undefined;
}

interface Etapa { id: string; chave: string; papel: string; funil_id: string; ordem: number }
interface Funil { id: string; chave: string; lado: string; principal: boolean }

export class Aplicador {
  private etapas = new Map<string, Etapa>();
  private etapaPorId = new Map<string, Etapa>();
  private funis = new Map<string, Funil>();
  private carregado = false;

  constructor(private readonly tx: Tx, private readonly ctx: ContextoAplicacao) {}

  private async carregar() {
    if (this.carregado) return;
    const op = this.ctx.operacaoId;
    for (const e of await this.tx<Etapa[]>`select id, chave, papel, funil_id, ordem from lab.etapa where operacao_id = ${op}`) {
      this.etapas.set(e.chave, e); this.etapaPorId.set(e.id, e);
    }
    for (const f of await this.tx<Funil[]>`select id, chave, lado, principal from lab.funil where operacao_id = ${op} and ativo`) this.funis.set(f.chave, f);
    this.carregado = true;
  }

  /* aplica os comandos de UMA entrada bruta; quem chama cuida da transação/savepoint */
  async aplicar(comandos: readonly Comando[]): Promise<{ aplicados: number }> {
    await this.carregar();
    const ordenados = ordenarComandos(comandos);
    const comTransicaoExplicita = new Set(ordenados.filter(c => c.tipo === 'negocio.transicao').map(c => (c as ComandoDe<'negocio.transicao'>).negocioRef));
    let aplicados = 0;
    for (const c of ordenados) {
      switch (c.tipo) {
        case 'pessoa.upsert': await this.pessoa(c); break;
        case 'canal.upsert': await this.canal(c); break;
        case 'conta.upsert': await this.conta(c); break;
        case 'negocio.upsert': await this.negocio(c, comTransicaoExplicita.has(c.ref)); break;
        case 'negocio.transicao': await this.transicao(c); break;
        case 'atividade.registrar': await this.atividade(c); break;
        case 'preco.registrar': await this.preco(c); break;
        case 'recebimento.upsert': await this.recebimento(c); break;
        case 'contrato.upsert': await this.contrato(c); break;
        case 'evento_cs.registrar': await this.eventoCS(c); break;
        case 'investimento.upsert': await this.investimento(c); break;
      }
      aplicados++;
    }
    return { aplicados };
  }

  // ------------------------------------------------------------------ vínculos
  private async vinculo(entidade: string, ref: string): Promise<string | null> {
    const [v] = await this.tx<{ interno_id: string }[]>`
      select interno_id from lab.vinculo where conector_id = ${this.ctx.conectorId} and entidade = ${entidade} and ref = ${ref}`;
    return v?.interno_id ?? null;
  }
  private async vincular(entidade: string, ref: string, id: string) {
    await this.tx`insert into lab.vinculo (conector_id, entidade, ref, interno_id) values (${this.ctx.conectorId}, ${entidade}, ${ref}, ${id})
                  on conflict (conector_id, entidade, ref) do update set interno_id = excluded.interno_id`;
  }

  // ------------------------------------------------------------------ resolvedores (criam o mínimo quando a fonte ainda não mandou)
  private async idPessoa(ref: string | undefined): Promise<string | null> {
    if (!ref) return null;
    return (await this.vinculo('pessoa', ref)) ?? this.pessoa({ tipo: 'pessoa.upsert', ref, nome: ref });
  }
  private async idConta(ref: string | undefined): Promise<string | null> {
    if (!ref) return null;
    return (await this.vinculo('conta', ref)) ?? this.conta({ tipo: 'conta.upsert', ref, nome: ref });
  }
  private async idCanal(ref: string | undefined): Promise<string | null> {
    if (!ref) return null;
    return (await this.vinculo('canal', ref)) ?? this.canal({ tipo: 'canal.upsert', ref, nome: ref });
  }
  private async idNegocio(ref: string | undefined, obrigatorio: boolean): Promise<string | null> {
    if (!ref) return null;
    const id = await this.vinculo('negocio', ref);
    if (!id && obrigatorio) throw new ErroDeEntrada(`o negócio "${ref}" ainda não chegou ao LAB`, true);
    return id;
  }
  private etapa(chaveFonte: string): Etapa {
    const chave = this.ctx.mapa?.etapas?.[chaveFonte] ?? chaveFonte;
    const e = this.etapas.get(chave);
    if (!e) throw new ErroDeEntrada(`a etapa "${chaveFonte}" não existe nesta operação: crie no pack ou mapeie em config.mapa.etapas`);
    return e;
  }
  private funilPrincipal(): Funil {
    const fs = [...this.funis.values()];
    return fs.find(f => f.principal) ?? fs.find(f => f.lado === 'aquisicao')!;
  }
  private async idMotivo(texto: string | null | undefined): Promise<string | null> {
    if (!texto) return null;
    const op = this.ctx.operacaoId;
    const chave = this.ctx.mapa?.motivosPerda?.[texto] ?? chaveDe(texto);
    const [m] = await this.tx<{ id: string }[]>`select id from lab.motivo_perda where operacao_id = ${op} and (chave = ${chave} or lower(nome) = lower(${texto})) order by (chave = ${chave}) desc limit 1`;
    if (m) return m.id;
    const [n] = await this.tx<{ id: string }[]>`insert into lab.motivo_perda (operacao_id, chave, nome, grupo, a_revisar) values (${op}, ${chave}, ${texto}, 'outro', true)
      on conflict (operacao_id, chave) do update set ativo = true returning id`;
    return n!.id;
  }
  private async idCondicao(texto: string | undefined): Promise<string | null> {
    if (!texto) return null;
    const op = this.ctx.operacaoId;
    const chave = this.ctx.mapa?.condicoes?.[texto] ?? chaveDe(texto);
    const [c] = await this.tx<{ id: string }[]>`select id from lab.condicao_pagamento where operacao_id = ${op} and chave = ${chave}`;
    if (c) return c.id;
    const [n] = await this.tx<{ id: string }[]>`insert into lab.condicao_pagamento (operacao_id, chave, nome, a_revisar) values (${op}, ${chave}, ${texto}, true)
      on conflict (operacao_id, chave) do update set ativo = true returning id`;
    return n!.id;
  }

  // ------------------------------------------------------------------ comandos
  private async pessoa(c: ComandoDe<'pessoa.upsert'>): Promise<string> {
    const op = this.ctx.operacaoId;
    let id = await this.vinculo('pessoa', c.ref);
    if (!id && c.email) {
      const [p] = await this.tx<{ id: string }[]>`select id from lab.pessoa where operacao_id = ${op} and lower(email) = lower(${c.email}) limit 1`;
      id = p?.id ?? null;      // a mesma pessoa vinda de outra fonte
    }
    if (id) {
      await this.tx`update lab.pessoa set nome = ${c.nome}, email = coalesce(${c.email ?? null}, email),
        funcao = coalesce(${c.funcao ?? null}, funcao), ativa = coalesce(${c.ativa ?? null}, ativa) where id = ${id}`;
    } else {
      const [p] = await this.tx<{ id: string }[]>`insert into lab.pessoa (operacao_id, nome, email, funcao, ativa)
        values (${op}, ${c.nome}, ${c.email ?? null}, ${c.funcao ?? null}, ${c.ativa ?? true}) returning id`;
      id = p!.id;
    }
    await this.vincular('pessoa', c.ref, id);
    return id;
  }

  private async canal(c: ComandoDe<'canal.upsert'>): Promise<string> {
    const op = this.ctx.operacaoId;
    let id = await this.vinculo('canal', c.ref);
    if (!id) {
      const chaves = [chaveDe(c.ref), chaveDe(c.nome)];
      const [x] = await this.tx<{ id: string }[]>`select id from lab.canal where operacao_id = ${op}
        and (chave in (select jsonb_array_elements_text(${this.tx.json(chaves as never)})) or lower(nome) = lower(${c.nome})) order by (chave = ${chaves[0]!}) desc limit 1`;
      id = x?.id ?? null;
    }
    if (id) {
      if (c.tipoCanal || c.origemDeLead != null) {
        await this.tx`update lab.canal set tipo = coalesce(${c.tipoCanal ?? null}, tipo), origem_de_lead = coalesce(${c.origemDeLead ?? null}, origem_de_lead),
          a_revisar = case when ${c.tipoCanal ?? null}::text is not null then false else a_revisar end where id = ${id}`;
      }
    } else {
      const [x] = await this.tx<{ id: string }[]>`insert into lab.canal (operacao_id, chave, nome, tipo, origem_de_lead, a_revisar)
        values (${op}, ${chaveDe(c.nome)}, ${c.nome}, ${c.tipoCanal ?? 'outro'}, ${c.origemDeLead ?? true}, ${!c.tipoCanal})
        on conflict (operacao_id, chave) do update set ativo = true returning id`;
      id = x!.id;
    }
    await this.vincular('canal', c.ref, id);
    return id;
  }

  private async conta(c: ComandoDe<'conta.upsert'>): Promise<string> {
    const op = this.ctx.operacaoId;
    let id = await this.vinculo('conta', c.ref);
    const donoCs = c.donoCsRef ? await this.idPessoa(c.donoCsRef) : null;
    if (id) {
      await this.tx`update lab.conta set nome = ${c.nome}, tipo_pessoa = coalesce(${c.tipoPessoa ?? null}, tipo_pessoa),
        segmento = coalesce(${c.segmento ?? null}, segmento), cidade = coalesce(${c.cidade ?? null}, cidade), uf = coalesce(${c.uf ?? null}, uf),
        dono_cs_id = coalesce(${donoCs}, dono_cs_id), atributos = atributos || ${this.tx.json((c.atributos ?? {}) as never)} where id = ${id}`;
    } else {
      const [x] = await this.tx<{ id: string }[]>`insert into lab.conta (operacao_id, nome, tipo_pessoa, segmento, cidade, uf, dono_cs_id, criado_em, atributos)
        values (${op}, ${c.nome}, ${c.tipoPessoa ?? null}, ${c.segmento ?? null}, ${c.cidade ?? null}, ${c.uf ?? null}, ${donoCs},
          ${c.criadoEm ?? new Date().toISOString()}, ${this.tx.json((c.atributos ?? {}) as never)}) returning id`;
      id = x!.id;
    }
    await this.vincular('conta', c.ref, id);
    return id;
  }

  private async negocio(c: ComandoDe<'negocio.upsert'>, temTransicaoExplicita: boolean): Promise<string> {
    const op = this.ctx.operacaoId;
    const etapa = c.etapa ? this.etapa(c.etapa) : null;
    let funil: Funil | undefined;
    if (etapa) funil = [...this.funis.values()].find(f => f.id === etapa.funil_id);
    else if (c.funil) {
      const chave = this.ctx.mapa?.funis?.[c.funil] ?? c.funil;
      funil = this.funis.get(chave);
      if (!funil) throw new ErroDeEntrada(`o funil "${c.funil}" não existe nesta operação: mapeie em config.mapa.funis`);
    }
    const status = etapa ? (etapa.papel === 'ganho' ? 'ganho' : etapa.papel === 'perdido' ? 'perdido' : 'aberto') : null;
    const fechadoEm = c.fechadoEm !== undefined ? c.fechadoEm
      : status && status !== 'aberto' ? (c.etapaDesde ?? c.atualizadoEm ?? null) : undefined;

    const campos: Record<string, unknown> = {};
    if (c.contaRef !== undefined) campos.conta_id = await this.idConta(c.contaRef);
    if (c.canalRef !== undefined) campos.canal_id = await this.idCanal(c.canalRef);
    if (c.donoRef !== undefined) campos.dono_id = await this.idPessoa(c.donoRef);
    if (c.tipoNegocio) campos.tipo = c.tipoNegocio;
    if (c.valorEstimado !== undefined) campos.valor_estimado = c.valorEstimado;
    if (c.valorFechado !== undefined) campos.valor_fechado = c.valorFechado;
    if (fechadoEm !== undefined) campos.fechado_em = status === 'aberto' ? null : fechadoEm;
    if (c.motivoPerda !== undefined) campos.motivo_perda_id = await this.idMotivo(c.motivoPerda);
    if (c.atualizadoEm) campos.fonte_atualizado_em = c.atualizadoEm;

    const id = await this.vinculo('negocio', c.ref);
    if (id) {
      const [atual] = await this.tx<{ etapa_id: string; fonte_atualizado_em: Date | null; dono_id: string | null }[]>`
        select etapa_id, fonte_atualizado_em, dono_id from lab.negocio where id = ${id}`;
      if (atual?.fonte_atualizado_em && c.atualizadoEm && new Date(c.atualizadoEm) < atual.fonte_atualizado_em) return id;   // dado velho
      if (etapa && atual && etapa.id !== atual.etapa_id) {
        campos.etapa_id = etapa.id;
        campos.etapa_desde = c.etapaDesde ?? c.atualizadoEm ?? new Date().toISOString();
        campos.status = status;
        if (funil) campos.funil_id = funil.id;
        if (!temTransicaoExplicita) {
          await this.tx`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, dono_id, origem)
            values (${op}, ${id}, ${atual.etapa_id}, ${etapa.id}, ${campos.etapa_desde as string}, ${(campos.dono_id as string | null | undefined) ?? atual.dono_id}, 'inferida')
            on conflict (negocio_id, para_etapa_id, em) do nothing`;
        }
      } else if (etapa && c.etapaDesde) campos.etapa_desde = c.etapaDesde;
      if (Object.keys(campos).length) await this.tx`update lab.negocio set ${this.tx(campos as never)} where id = ${id}`;
      return id;
    }

    const f = funil ?? this.funilPrincipal();
    const et = etapa ?? [...this.etapas.values()].filter(e => e.funil_id === f.id).sort((a, b) => a.ordem - b.ordem)[0];
    if (!et) throw new ErroDeEntrada(`o funil "${f.chave}" não tem etapas`);
    const st = et.papel === 'ganho' ? 'ganho' : et.papel === 'perdido' ? 'perdido' : 'aberto';
    const desde = c.etapaDesde ?? c.criadoEm;
    const novo = {
      operacao_id: op, funil_id: f.id, etapa_id: et.id, etapa_desde: desde, status: st, criado_em: c.criadoEm,
      tipo: c.tipoNegocio ?? 'novo', atributos: this.tx.json((c.atributos ?? {}) as never),
      fechado_em: st === 'aberto' ? null : (c.fechadoEm ?? desde),
      ...campos,
    };
    const [n] = await this.tx<{ id: string }[]>`insert into lab.negocio ${this.tx(novo as never)} returning id`;
    await this.vincular('negocio', c.ref, n!.id);
    if (!temTransicaoExplicita) {
      await this.tx`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, dono_id, origem)
        values (${op}, ${n!.id}, null, ${et.id}, ${desde}, ${(campos.dono_id as string | null | undefined) ?? null}, 'inferida')
        on conflict (negocio_id, para_etapa_id, em) do nothing`;
    }
    return n!.id;
  }

  private async transicao(c: ComandoDe<'negocio.transicao'>) {
    const op = this.ctx.operacaoId;
    const negId = (await this.idNegocio(c.negocioRef, true))!;
    const para = this.etapa(c.para);
    let de: string | null = null;
    if (c.de) { try { de = this.etapa(c.de).id; } catch { de = null; } }
    const dono = await this.idPessoa(c.donoRef);
    await this.tx`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, dono_id, origem)
      values (${op}, ${negId}, ${de}, ${para.id}, ${c.em}, ${dono}, 'evento')
      on conflict (negocio_id, para_etapa_id, em) do nothing`;
    const status = para.papel === 'ganho' ? 'ganho' : para.papel === 'perdido' ? 'perdido' : 'aberto';
    /* o estado atual do negócio acompanha a transição mais recente */
    await this.tx`update lab.negocio set etapa_id = ${para.id}, etapa_desde = ${c.em}, status = ${status}, funil_id = ${para.funil_id},
        fechado_em = case when ${status} = 'aberto' then null else coalesce(fechado_em, ${c.em}::timestamptz) end
      where id = ${negId} and (etapa_desde is null or etapa_desde <= ${c.em}::timestamptz)`;
  }

  private async atividade(c: ComandoDe<'atividade.registrar'>) {
    const op = this.ctx.operacaoId;
    if (await this.vinculo('atividade', c.ref)) return;      // já contada
    const chave = this.ctx.mapa?.atividades?.[c.atividade] ?? c.atividade;
    const [tipo] = await this.tx<{ id: string }[]>`select id from lab.tipo_atividade where operacao_id = ${op} and chave = ${chave}`;
    if (!tipo) throw new ErroDeEntrada(`a atividade "${c.atividade}" não existe nesta operação: crie no pack ou mapeie em config.mapa.atividades`);
    const [a] = await this.tx<{ id: string }[]>`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, negocio_id, conta_id, em, quantidade, resultado, atributos)
      values (${op}, ${tipo.id}, ${await this.idPessoa(c.pessoaRef)}, ${await this.idNegocio(c.negocioRef, false)}, ${c.contaRef ? await this.vinculo('conta', c.contaRef) : null},
        ${c.em}, ${c.quantidade ?? 1}, ${c.resultado ?? null}, ${this.tx.json((c.atributos ?? {}) as never)}) returning id`;
    await this.vincular('atividade', c.ref, a!.id);
  }

  private async preco(c: ComandoDe<'preco.registrar'>) {
    const negId = (await this.idNegocio(c.negocioRef, true))!;
    await this.tx`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, limite, condicao_id, linhas, em)
      values (${this.ctx.operacaoId}, ${negId}, ${c.momento}, ${c.valor}, ${c.limite ?? null}, ${await this.idCondicao(c.condicao)},
        ${this.tx.json((c.linhas ?? []) as never)}, ${c.em})
      on conflict (negocio_id, momento, em) do update set valor = excluded.valor, limite = excluded.limite, condicao_id = excluded.condicao_id, linhas = excluded.linhas`;
  }

  private async recebimento(c: ComandoDe<'recebimento.upsert'>) {
    const negId = await this.idNegocio(c.negocioRef, false);
    const contaId = c.contaRef ? await this.idConta(c.contaRef)
      : negId ? ((await this.tx<{ conta_id: string | null }[]>`select conta_id from lab.negocio where id = ${negId}`)[0]?.conta_id ?? null) : null;
    const dados = {
      negocio_id: negId, conta_id: contaId, descricao: c.descricao ?? null, valor_previsto: c.valorPrevisto ?? null,
      previsto_em: c.previstoEm?.slice(0, 10) ?? null, valor_recebido: c.valorRecebido ?? null, recebido_em: c.recebidoEm?.slice(0, 10) ?? null, status: c.status,
    };
    const id = await this.vinculo('recebimento', c.ref);
    if (id) { await this.tx`update lab.recebimento set ${this.tx(dados as never)} where id = ${id}`; return; }
    const [r] = await this.tx<{ id: string }[]>`insert into lab.recebimento ${this.tx({ operacao_id: this.ctx.operacaoId, ...dados } as never)} returning id`;
    await this.vincular('recebimento', c.ref, r!.id);
  }

  private async contrato(c: ComandoDe<'contrato.upsert'>) {
    const dados = {
      conta_id: await this.idConta(c.contaRef), negocio_origem_id: await this.idNegocio(c.negocioOrigemRef, false),
      recorrente: c.recorrente, valor_periodo: c.valorPeriodo, periodicidade_meses: c.periodicidadeMeses ?? null,
      inicio: c.inicio.slice(0, 10), fim: c.fim?.slice(0, 10) ?? null, renovacao_em: c.renovacaoEm?.slice(0, 10) ?? null,
      status: c.status, motivo_cancelamento: c.motivoCancelamento ?? null,
    };
    const id = await this.vinculo('contrato', c.ref);
    if (id) { await this.tx`update lab.contrato set ${this.tx(dados as never)} where id = ${id}`; return; }
    const [r] = await this.tx<{ id: string }[]>`insert into lab.contrato ${this.tx({ operacao_id: this.ctx.operacaoId, ...dados } as never)} returning id`;
    await this.vincular('contrato', c.ref, r!.id);
  }

  private async eventoCS(c: ComandoDe<'evento_cs.registrar'>) {
    if (await this.vinculo('evento_cs', c.ref)) return;
    const [r] = await this.tx<{ id: string }[]>`insert into lab.evento_cs (operacao_id, conta_id, tipo, em, valor, pessoa_id, atributos)
      values (${this.ctx.operacaoId}, ${await this.idConta(c.contaRef)}, ${c.evento}, ${c.em}, ${c.valor ?? null}, ${await this.idPessoa(c.pessoaRef)},
        ${this.tx.json((c.atributos ?? {}) as never)}) returning id`;
    await this.vincular('evento_cs', c.ref, r!.id);
  }

  private async investimento(c: ComandoDe<'investimento.upsert'>) {
    await this.tx`insert into lab.investimento_canal (operacao_id, canal_id, mes, valor, impressoes, cliques, leads_plataforma)
      values (${this.ctx.operacaoId}, ${await this.idCanal(c.canalRef)}, ${c.mes + '-01'}, ${c.valor}, ${c.impressoes ?? null}, ${c.cliques ?? null}, ${c.leadsPlataforma ?? null})
      on conflict (canal_id, mes) do update set valor = excluded.valor, impressoes = excluded.impressoes, cliques = excluded.cliques, leads_plataforma = excluded.leads_plataforma`;
  }
}
