/* Linguagem de fórmulas das hipóteses: "quando" e "impacto" são texto, nunca código.
   Números, variáveis, + - * /, comparações, && || !, parênteses e min, max, abs, se(condição, a, b).
   Dado ausente é null e contamina a conta: nunca vira zero. Divisão por zero também dá null. */

export type Valor = number | boolean | null;
export type Contexto = Record<string, number | null | undefined>;

export class ErroExpressao extends Error { constructor(m: string, readonly pos?: number) { super(m); } }

export type No =
  | { t: 'num'; v: number } | { t: 'var'; n: string; pos: number }
  | { t: 'un'; op: '-' | '!'; a: No } | { t: 'bin'; op: string; a: No; b: No }
  | { t: 'fn'; n: string; args: No[]; pos: number };

const FUNCOES: Record<string, number | 'n'> = { min: 'n', max: 'n', abs: 1, se: 3 };

interface Tok { k: 'num' | 'id' | 'op' | 'fim'; v: string; pos: number }
function tokenizar(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ k: 'num', v: num[0], pos: i }); i += num[0].length; continue; }
    const id = /^[a-z_][a-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ k: 'id', v: id[0], pos: i }); i += id[0].length; continue; }
    const op = /^(<=|>=|==|!=|&&|\|\||[-+*\/(),<>!])/.exec(src.slice(i));
    if (op) { out.push({ k: 'op', v: op[0], pos: i }); i += op[0].length; continue; }
    throw new ErroExpressao(`caractere inesperado "${c}" na posição ${i + 1}`, i);
  }
  out.push({ k: 'fim', v: '', pos: src.length });
  return out;
}

const PREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5 };

export function analisar(src: string): No {
  if (typeof src !== 'string' || !src.trim()) throw new ErroExpressao('fórmula vazia');
  const toks = tokenizar(src);
  let p = 0;
  const ver = () => toks[p]!;
  const comer = () => toks[p++]!;
  const esperar = (v: string) => { const t = comer(); if (t.v !== v) throw new ErroExpressao(`esperava "${v}" na posição ${t.pos + 1}`, t.pos); };

  function primario(): No {
    const t = comer();
    if (t.k === 'num') return { t: 'num', v: Number(t.v) };
    if (t.k === 'id') {
      if (ver().v === '(') {
        const aridade = FUNCOES[t.v];
        if (aridade === undefined) throw new ErroExpressao(`função desconhecida "${t.v}" (use min, max, abs ou se)`, t.pos);
        comer();
        const args: No[] = [];
        if (ver().v !== ')') { do { args.push(expressao(0)); } while (ver().v === ',' && comer()); }
        esperar(')');
        if (aridade !== 'n' && args.length !== aridade) throw new ErroExpressao(`"${t.v}" recebe ${aridade} argumento(s), recebeu ${args.length}`, t.pos);
        if (aridade === 'n' && args.length < 2) throw new ErroExpressao(`"${t.v}" precisa de pelo menos 2 argumentos`, t.pos);
        return { t: 'fn', n: t.v, args, pos: t.pos };
      }
      return { t: 'var', n: t.v, pos: t.pos };
    }
    if (t.v === '(') { const e = expressao(0); esperar(')'); return e; }
    if (t.v === '-' || t.v === '!') return { t: 'un', op: t.v, a: expressao(6) };
    throw new ErroExpressao(t.k === 'fim' ? 'a fórmula termina antes da hora' : `não esperava "${t.v}" na posição ${t.pos + 1}`, t.pos);
  }

  function expressao(minimo: number): No {
    let a = primario();
    for (;;) {
      const t = ver();
      const prec = t.k === 'op' ? PREC[t.v] : undefined;
      if (prec === undefined || prec <= minimo) return a;
      comer();
      a = { t: 'bin', op: t.v, a, b: expressao(prec) };
    }
  }

  const raiz = expressao(0);
  if (ver().k !== 'fim') throw new ErroExpressao(`sobrou "${ver().v}" na posição ${ver().pos + 1}`, ver().pos);
  return raiz;
}

export function variaveisUsadas(no: No, acc = new Set<string>()): Set<string> {
  if (no.t === 'var') acc.add(no.n);
  else if (no.t === 'un') variaveisUsadas(no.a, acc);
  else if (no.t === 'bin') { variaveisUsadas(no.a, acc); variaveisUsadas(no.b, acc); }
  else if (no.t === 'fn') no.args.forEach(a => variaveisUsadas(a, acc));
  return acc;
}

const num = (v: Valor): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: Valor): boolean | null => (typeof v === 'boolean' ? v : v == null ? null : v !== 0);

export function avaliar(no: No, ctx: Contexto): Valor {
  switch (no.t) {
    case 'num': return no.v;
    case 'var': { const v = ctx[no.n]; return v == null || !Number.isFinite(v) ? null : v; }
    case 'un': {
      const a = avaliar(no.a, ctx);
      if (no.op === '-') { const n = num(a); return n == null ? null : -n; }
      const b = bool(a); return b == null ? null : !b;
    }
    case 'fn': {
      if (no.n === 'se') {
        const c = bool(avaliar(no.args[0]!, ctx));
        return c == null ? null : avaliar(no.args[c ? 1 : 2]!, ctx);
      }
      const vs = no.args.map(a => num(avaliar(a, ctx)));
      if (vs.some(v => v == null)) return null;
      const n = vs as number[];
      return no.n === 'min' ? Math.min(...n) : no.n === 'max' ? Math.max(...n) : Math.abs(n[0]!);
    }
    case 'bin': {
      if (no.op === '&&' || no.op === '||') {
        const a = bool(avaliar(no.a, ctx)), b = bool(avaliar(no.b, ctx));
        if (no.op === '&&') return a === false || b === false ? false : a == null || b == null ? null : true;
        return a === true || b === true ? true : a == null || b == null ? null : false;
      }
      const a = num(avaliar(no.a, ctx)), b = num(avaliar(no.b, ctx));
      if (a == null || b == null) return null;
      switch (no.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? null : a / b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '>=': return a >= b;
        case '==': return a === b;
        case '!=': return a !== b;
      }
      return null;
    }
  }
}

/* atalhos: texto → valor */
export const calcular = (src: string, ctx: Contexto): Valor => avaliar(analisar(src), ctx);
