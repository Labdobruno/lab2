import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mesclar, resolverPack, type Catalogo } from '@lab/nucleo';

const PASTA = join(import.meta.dirname, '../../../packs');
const catalogoReal = (): Catalogo => Object.fromEntries(
  readdirSync(PASTA).filter(f => f.endsWith('.json') && f !== 'pack.schema.json')
    .map(f => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(PASTA, f), 'utf8'))]),
);

describe('packs do repositório', () => {
  for (const id of Object.keys(catalogoReal())) {
    it(`${id} resolve sem erros`, () => {
      const r = resolverPack(id, catalogoReal());
      expect(r.erros).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }

  it('solar herda da base e substitui as etapas do funil de aquisição', () => {
    const r = resolverPack('solar-b2c', catalogoReal());
    const p = r.pack!;
    expect(p.linhagem).toEqual(['solar-b2c', 'base']);
    const aq = p.funis.find(f => f.chave === 'aquisicao')!;
    expect(aq.etapas.map(e => e.chave)).toContain('visita_ok');
    expect(aq.etapas.map(e => e.chave)).not.toContain('contato');
    expect(aq.principal).toBe(true);                         // herdado da base
    expect(p.funis.find(f => f.chave === 'carteira')!.lado).toBe('pos_venda');
    expect(p.atividades.map(a => a.chave)).toEqual(expect.arrayContaining(['tentativa', 'visita']));
    expect(p.canais.find(c => c.chave === 'base')!.origemDeLead).toBe(false);
    expect(p.textos.vendedor).toBe('Consultor');
    expect(p.textos.receita).toBe('Receita');
    expect(p.calendario.inicioCicloDia).toBe(1);
  });
});

describe('herança', () => {
  const base = {
    id: 'base', nome: 'Base', versao: '1.0.0',
    funis: [{ chave: 'f', nome: 'F', lado: 'aquisicao', etapas: [
      { chave: 'lead', nome: 'Lead', papel: 'lead' }, { chave: 'ganho', nome: 'Venda', papel: 'ganho' }, { chave: 'perdido', nome: 'Perdido', papel: 'perdido' }] }],
    atividades: [{ chave: 'lig', nome: 'Ligação', papel: 'tentativa', metaDiaria: true }, { chave: 'msg', nome: 'Mensagem', papel: 'tentativa' }],
    canais: [{ chave: 'a', nome: 'A', tipo: 'pago' }],
  };

  it('ajusta um item herdado só com a chave e o campo que muda', () => {
    const r = resolverPack('filho', { base, filho: { id: 'filho', nome: 'Filho', versao: '1.0.0', herda: 'base', atividades: [{ chave: 'lig', nome: 'Discagem' }] } });
    expect(r.erros).toEqual([]);
    const lig = r.pack!.atividades.find(a => a.chave === 'lig')!;
    expect(lig).toMatchObject({ nome: 'Discagem', papel: 'tentativa', metaDiaria: true });
  });

  it('remove item herdado com "remover"', () => {
    const r = resolverPack('filho', { base, filho: { id: 'filho', nome: 'Filho', versao: '1.0.0', herda: 'base', atividades: [{ chave: 'msg', remover: true }] } });
    expect(r.pack!.atividades.map(a => a.chave)).toEqual(['lig']);
  });

  it('item novo incompleto vira erro legível, apontado pela chave', () => {
    const r = resolverPack('filho', { base, filho: { id: 'filho', nome: 'Filho', versao: '1.0.0', herda: 'base', canais: [{ chave: 'novo', nome: 'Novo' }] } });
    expect(r.ok).toBe(false);
    expect(r.erros.join('\n')).toMatch(/canais\[novo\]\.tipo/);
  });

  it('detecta herança circular e pack inexistente', () => {
    expect(resolverPack('a', { a: { id: 'a', nome: 'A', versao: '1.0.0', herda: 'b' }, b: { id: 'b', nome: 'B', versao: '1.0.0', herda: 'a' } }).erros[0]).toMatch(/circular/);
    expect(resolverPack('a', { a: { id: 'a', nome: 'A', versao: '1.0.0', herda: 'zzz' } }).erros[0]).toMatch(/não existe/);
  });

  it('funil sem ganho/perdido e chave inválida são erros', () => {
    const r = resolverPack('x', { x: { id: 'x', nome: 'X', versao: '1.0.0', funis: [{ chave: 'f', nome: 'F', etapas: [{ chave: 'Lead X', nome: 'L', papel: 'lead' }] }] } });
    expect(r.ok).toBe(false);
    expect(r.erros.join('\n')).toMatch(/letras minúsculas/);
    const r2 = resolverPack('x', { x: { id: 'x', nome: 'X', versao: '1.0.0', funis: [{ chave: 'f', nome: 'F', etapas: [{ chave: 'lead', nome: 'L', papel: 'lead' }] }] } });
    expect(r2.erros.join('\n')).toMatch(/"ganho"/);
    expect(r2.erros.join('\n')).toMatch(/"perdido"/);
  });

  it('avisa etapas fora da ordem canônica e falta de meta diária', () => {
    const r = resolverPack('x', { x: { id: 'x', nome: 'X', versao: '1.0.0', funis: [{ chave: 'f', nome: 'F', etapas: [
      { chave: 'lead', nome: 'L', papel: 'lead' }, { chave: 'prop', nome: 'P', papel: 'proposta' }, { chave: 'reu', nome: 'R', papel: 'agendada' },
      { chave: 'ganho', nome: 'G', papel: 'ganho' }, { chave: 'perdido', nome: 'P', papel: 'perdido' }] }] } });
    expect(r.ok).toBe(true);
    expect(r.avisos.join('\n')).toMatch(/confira a ordem/);
    expect(r.avisos.join('\n')).toMatch(/metaDiaria/);
  });

  it('mesclar trata objetos aninhados e listas sem chave', () => {
    expect(mesclar({ a: { b: 1, c: 2 }, l: [1, 2] }, { a: { c: 3 }, l: [9] })).toEqual({ a: { b: 1, c: 3 }, l: [9] });
  });
});
