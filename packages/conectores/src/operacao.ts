/* Criar e atualizar operações. Uma operação = um pack + os ajustes dela.
   Os ajustes usam a mesma linguagem do pack (é como um pack filho só daquela operação). */
import { resolverPack, type Catalogo, type PackResolvido } from '@lab/nucleo';
import type { Sql, TransactionSql } from 'postgres';

type Tx = Sql | TransactionSql;

export interface NovaOperacao {
  slug: string;
  nome: string;
  packId: string;
  ajustes?: Record<string, unknown>;
  fuso?: string;
}

/* resolve o pack da operação: o pack escolhido + os ajustes por cima */
export function packDaOperacao(packId: string, ajustes: Record<string, unknown> | undefined, catalogo: Catalogo) {
  if (!ajustes || !Object.keys(ajustes).length) return resolverPack(packId, catalogo);
  const virtual = 'ajustes-da-operacao';
  const r = resolverPack(virtual, { ...catalogo, [virtual]: { versao: '0.0.0', ...ajustes, id: virtual, herda: packId } });
  if (r.pack) {
    const base = resolverPack(packId, catalogo).pack!;
    r.pack = { ...r.pack, id: base.id, versao: base.versao, nome: base.nome, linhagem: ['(ajustes da operação)', ...base.linhagem] };
  }
  return r;
}

export async function criarOperacao(sql: Sql, nova: NovaOperacao, catalogo: Catalogo): Promise<{ id: string; avisos: string[] }> {
  const r = packDaOperacao(nova.packId, nova.ajustes, catalogo);
  if (!r.ok || !r.pack) throw new Error(`pack inválido para a operação "${nova.slug}":\n- ${r.erros.join('\n- ')}`);
  const pack = r.pack;
  return sql.begin(async tx => {
    const [op] = await tx<{ id: string }[]>`
      insert into lab.operacao (slug, nome, pack_id, pack_versao, pack, ajustes, fuso)
      values (${nova.slug}, ${nova.nome}, ${nova.packId}, ${pack.versao}, ${tx.json(pack as never)}, ${tx.json((nova.ajustes ?? {}) as never)}, ${nova.fuso ?? pack.calendario.fuso})
      returning id`;
    await instalarCatalogos(tx, op!.id, pack);
    await registrarPolitica(tx, op!.id, pack, 'política inicial do pack');
    return { id: op!.id, avisos: r.avisos };
  });
}

/* reaplica o pack (nova versão do pack ou ajustes novos): cria o que falta, atualiza nomes,
   inativa o que saiu. Nada é apagado, então o histórico continua apontando para as mesmas etapas. */
export async function atualizarPackDaOperacao(sql: Sql, operacaoId: string, catalogo: Catalogo, ajustes?: Record<string, unknown>) {
  const [op] = await sql<{ pack_id: string; ajustes: Record<string, unknown> }[]>`select pack_id, ajustes from lab.operacao where id = ${operacaoId}`;
  if (!op) throw new Error('operação não encontrada');
  const aj = ajustes ?? op.ajustes;
  const r = packDaOperacao(op.pack_id, aj, catalogo);
  if (!r.ok || !r.pack) throw new Error(`pack inválido:\n- ${r.erros.join('\n- ')}`);
  const pack = r.pack;
  return sql.begin(async tx => {
    await tx`update lab.operacao set pack = ${tx.json(pack as never)}, pack_versao = ${pack.versao}, ajustes = ${tx.json(aj as never)} where id = ${operacaoId}`;
    await instalarCatalogos(tx, operacaoId, pack);
    const [ult] = await tx<{ linhas: unknown; condicoes: unknown; margem_alvo: string | null; margem_minima: string | null; desconto_maximo: string | null }[]>`
      select linhas, condicoes, margem_alvo, margem_minima, desconto_maximo from lab.politica_preco where operacao_id = ${operacaoId} order by versao desc limit 1`;
    const pr = pack.precificacao;
    const mudou = !ult || estavel(ult.linhas) !== estavel(pr.linhas) || estavel(ult.condicoes) !== estavel(pr.condicoes)
      || num(ult.margem_alvo) !== (pr.margemAlvo ?? null) || num(ult.margem_minima) !== (pr.margemMinima ?? null) || num(ult.desconto_maximo) !== (pr.descontoMaximo ?? null);
    if (mudou) await registrarPolitica(tx, operacaoId, pack, 'atualização do pack');
    return { avisos: r.avisos, politicaNova: mudou };
  });
}

const num = (v: string | null) => (v == null ? null : Number(v));
/* JSON com chaves em ordem: o jsonb do Postgres reordena as chaves, então comparar texto cru daria "mudou" sempre */
const estavel = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

async function registrarPolitica(tx: Tx, operacaoId: string, pack: PackResolvido, observacao: string) {
  const pr = pack.precificacao;
  await tx`
    insert into lab.politica_preco (operacao_id, versao, margem_alvo, margem_minima, desconto_maximo, linhas, condicoes, observacao)
    values (${operacaoId},
      (select coalesce(max(versao), 0) + 1 from lab.politica_preco where operacao_id = ${operacaoId}),
      ${pr.margemAlvo ?? null}, ${pr.margemMinima ?? null}, ${pr.descontoMaximo ?? null},
      ${tx.json(pr.linhas as never)}, ${tx.json(pr.condicoes as never)}, ${observacao})`;
}

export async function instalarCatalogos(tx: Tx, operacaoId: string, pack: PackResolvido) {
  const principal = pack.funis.find(f => f.principal)?.chave ?? pack.funis.find(f => f.lado === 'aquisicao')!.chave;
  for (const f of pack.funis) {
    const [fu] = await tx<{ id: string }[]>`
      insert into lab.funil (operacao_id, chave, nome, lado, principal, ativo)
      values (${operacaoId}, ${f.chave}, ${f.nome}, ${f.lado}, ${f.chave === principal}, true)
      on conflict (operacao_id, chave) do update set nome = excluded.nome, lado = excluded.lado, principal = excluded.principal, ativo = true
      returning id`;
    for (const [i, e] of f.etapas.entries()) {
      await tx`
        insert into lab.etapa (operacao_id, funil_id, chave, nome, papel, ordem, prazo_dias, ativa)
        values (${operacaoId}, ${fu!.id}, ${e.chave}, ${e.nome}, ${e.papel}, ${i + 1}, ${e.prazoDias ?? null}, true)
        on conflict (operacao_id, chave) do update set funil_id = excluded.funil_id, nome = excluded.nome, papel = excluded.papel,
          ordem = excluded.ordem, prazo_dias = excluded.prazo_dias, ativa = true`;
    }
    await tx`update lab.etapa set ativa = false where funil_id = ${fu!.id} and chave not in (select jsonb_array_elements_text(${tx.json(f.etapas.map(e => e.chave) as never)}))`;
  }
  await tx`update lab.funil set ativo = false, principal = false where operacao_id = ${operacaoId} and chave not in (select jsonb_array_elements_text(${tx.json(pack.funis.map(f => f.chave) as never)}))`;

  for (const a of pack.atividades) {
    await tx`
      insert into lab.tipo_atividade (operacao_id, chave, nome, papel, unidade, meta_diaria, ativo)
      values (${operacaoId}, ${a.chave}, ${a.nome}, ${a.papel}, ${a.unidade ?? null}, ${a.metaDiaria ?? false}, true)
      on conflict (operacao_id, chave) do update set nome = excluded.nome, papel = excluded.papel, unidade = excluded.unidade, meta_diaria = excluded.meta_diaria, ativo = true`;
  }
  await tx`update lab.tipo_atividade set ativo = false where operacao_id = ${operacaoId} and chave not in (select jsonb_array_elements_text(${tx.json(pack.atividades.map(a => a.chave) as never)}))`;

  for (const c of pack.canais) {
    await tx`
      insert into lab.canal (operacao_id, chave, nome, tipo, origem_de_lead, ativo, a_revisar)
      values (${operacaoId}, ${c.chave}, ${c.nome}, ${c.tipo}, ${c.origemDeLead ?? true}, true, false)
      on conflict (operacao_id, chave) do update set nome = excluded.nome, tipo = excluded.tipo, origem_de_lead = excluded.origem_de_lead, ativo = true, a_revisar = false`;
  }
  for (const c of pack.canais.filter(x => x.pai)) {
    await tx`update lab.canal set pai_id = (select id from lab.canal where operacao_id = ${operacaoId} and chave = ${c.pai!})
             where operacao_id = ${operacaoId} and chave = ${c.chave}`;
  }

  for (const m of pack.motivosPerda) {
    await tx`
      insert into lab.motivo_perda (operacao_id, chave, nome, grupo, ativo, a_revisar)
      values (${operacaoId}, ${m.chave}, ${m.nome}, ${m.grupo}, true, false)
      on conflict (operacao_id, chave) do update set nome = excluded.nome, grupo = excluded.grupo, ativo = true, a_revisar = false`;
  }
  for (const c of pack.precificacao.condicoes) {
    await tx`
      insert into lab.condicao_pagamento (operacao_id, chave, nome, taxa, ativo, a_revisar)
      values (${operacaoId}, ${c.chave}, ${c.nome}, ${c.taxa ?? 0}, true, false)
      on conflict (operacao_id, chave) do update set nome = excluded.nome, taxa = excluded.taxa, ativo = true, a_revisar = false`;
  }
}
