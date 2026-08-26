import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, CalendarDays, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { LOJAS } from '../data/vendedorLoja';

interface MetaLojaMensal {
  id: string;
  nome: string;
  meta: number;
  totalRealizado: number;
  realizadoPorDia: Record<string, number>;
}

interface RespostaMetasMensais {
  mes: string;
  lojas: MetaLojaMensal[];
  atualizadoEm: string;
}

interface SemanaMes {
  inicio: number;
  fim: number;
  diasTrabalhados: number;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const moeda = (valor: number) => valor.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numero = (valor: number) => valor.toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentual = (valor: number) => `${valor.toLocaleString('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})}%`;

function semanasDoMes(ano: number, mes: number): SemanaMes[] {
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const semanas: SemanaMes[] = [];
  let inicio = 1;
  while (inicio <= ultimoDia) {
    const diaSemana = new Date(ano, mes, inicio).getDay();
    const ateDomingo = diaSemana === 0 ? 0 : 7 - diaSemana;
    const fim = Math.min(ultimoDia, inicio + ateDomingo);
    let diasTrabalhados = 0;
    for (let dia = inicio; dia <= fim; dia += 1) {
      if (new Date(ano, mes, dia).getDay() !== 0) diasTrabalhados += 1;
    }
    semanas.push({ inicio, fim, diasTrabalhados });
    inicio = fim + 1;
  }
  return semanas;
}

const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, '0')}`;
const nomeLoja = (nome: string) => `LOJA ${nome.split('—').at(-1)?.trim().toLocaleUpperCase('pt-BR') || nome.toLocaleUpperCase('pt-BR')}`;

export const GestaoMetasMensais: React.FC = () => {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [dados, setDados] = useState<RespostaMetasMensais | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const referencia = chaveMes(ano, mes);
  const chaveCache = `gferro:gestao-metas:${referencia}`;
  const semanas = useMemo(() => semanasDoMes(ano, mes), [ano, mes]);
  const diasTrabalhados = semanas.reduce((total, semana) => total + semana.diasTrabalhados, 0);

  useEffect(() => {
    let cancelado = false;
    let cacheEncontrado = false;
    setErro(null);
    try {
      const salvo = localStorage.getItem(chaveCache);
      if (salvo) {
        const cache = JSON.parse(salvo) as RespostaMetasMensais;
        if (cache?.mes === referencia && Array.isArray(cache.lojas)) {
          setDados(cache);
          cacheEncontrado = true;
        }
      }
    } catch {
      // Continua com a consulta ao servidor.
    }
    if (!cacheEncontrado) setDados(null);

    const carregar = async () => {
      setAtualizando(true);
      try {
        const resposta = await fetch(`/api/vendas/gestao-metas?mes=${referencia}`);
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo?.error || 'Não foi possível consultar as metas mensais.');
        if (cancelado) return;
        setDados(corpo as RespostaMetasMensais);
        setErro(null);
        localStorage.setItem(chaveCache, JSON.stringify(corpo));
      } catch (error: any) {
        if (!cancelado && !cacheEncontrado) setErro(error.message || 'Não foi possível consultar as metas mensais.');
      } finally {
        if (!cancelado) setAtualizando(false);
      }
    };

    void carregar();
    const timer = window.setInterval(carregar, 3 * 60 * 1000);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
    };
  }, [chaveCache, referencia]);

  const lojas: MetaLojaMensal[] = LOJAS.map((loja) => {
    const carregada = dados?.lojas.find((item) => item.id === loja.id);
    return carregada ?? {
      id: loja.id,
      nome: loja.nome,
      meta: loja.metaVendas ?? 0,
      totalRealizado: 0,
      realizadoPorDia: {},
    };
  });

  const realizadoNaSemana = (loja: MetaLojaMensal, semana: SemanaMes) => {
    let total = 0;
    for (let dia = semana.inicio; dia <= semana.fim; dia += 1) {
      const chave = `${referencia}-${String(dia).padStart(2, '0')}`;
      total += loja.realizadoPorDia[chave] ?? 0;
    }
    return total;
  };

  const metaTotal = lojas.reduce((total, loja) => total + loja.meta, 0);
  // Fonte única para toda a parte inferior: soma exatamente as mesmas
  // células semanais exibidas no quadro superior. Assim não existe risco de
  // o resumo mensal divergir por usar outro campo ou outra consulta.
  const realizadoMensalPorLoja = Object.fromEntries(
    lojas.map((loja) => [
      loja.id,
      semanas.reduce((total, semana) => total + realizadoNaSemana(loja, semana), 0),
    ])
  ) as Record<string, number>;
  const realizadoDaLoja = (loja: MetaLojaMensal) => realizadoMensalPorLoja[loja.id] ?? 0;
  const realizadoTotal = lojas.reduce((total, loja) => total + realizadoDaLoja(loja), 0);

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-600">Dashboard • Gestão</span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-neutral-950 sm:text-3xl">
            <Target className="h-7 w-7 text-yellow-500" aria-hidden="true" />
            Metas Mensais
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Planejamento semanal das unidades e acompanhamento do realizado no Nomus.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2">
            <span className="block text-[9px] font-black uppercase tracking-wider text-neutral-400">Meta anual</span>
            <strong className="text-sm text-neutral-900">{moeda(metaTotal * 12)}</strong>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2">
            <span className="block text-[9px] font-black uppercase tracking-wider text-yellow-700">Meta do mês</span>
            <strong className="text-sm text-yellow-900">{moeda(metaTotal)}</strong>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-neutral-50 p-2">
          {MESES.map((nome, indice) => (
            <button
              key={nome}
              type="button"
              onClick={() => setMes(indice)}
              className={`min-w-24 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                indice === mes
                  ? 'border-yellow-500 bg-yellow-400 text-black shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-yellow-300 hover:text-neutral-950'
              }`}
            >
              {nome}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2 text-white">
              <CalendarDays className="h-4 w-4 text-yellow-400" />
              <div><span className="block text-[9px] uppercase text-neutral-400">Total dias úteis</span><strong>{diasTrabalhados}</strong></div>
            </div>
            <div className="rounded-xl border border-neutral-200 px-4 py-2">
              <span className="block text-[9px] font-bold uppercase text-neutral-400">Mês</span>
              <strong className="text-sm">{MESES[mes]}</strong>
            </div>
            <label className="rounded-xl border border-neutral-200 px-4 py-2">
              <span className="block text-[9px] font-bold uppercase text-neutral-400">Ano</span>
              <select value={ano} onChange={(event) => setAno(Number(event.target.value))} className="bg-transparent text-sm font-black outline-none">
                {[ano - 1, ano, ano + 1].filter((valor, indice, lista) => lista.indexOf(valor) === indice).map((valor) => <option key={valor}>{valor}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-400">
            <RefreshCw className={`h-3.5 w-3.5 text-yellow-600 ${atualizando ? 'animate-spin' : ''}`} />
            {atualizando && dados ? 'Atualizando em segundo plano' : dados?.atualizadoEm ? `Atualizado em ${new Date(dados.atualizadoEm).toLocaleString('pt-BR')}` : 'Aguardando dados'}
          </div>
        </div>

        {erro && !dados && <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700">{erro}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-950 text-white">
                <th rowSpan={3} className="w-12 border-r border-neutral-700 px-2 py-3 text-center">#</th>
                <th rowSpan={3} className="min-w-40 border-r border-neutral-700 px-4 py-3 text-left">Unidades</th>
                {semanas.map((semana, indice) => (
                  <th key={semana.inicio} colSpan={2} className="border-r border-neutral-700 px-3 py-2 text-center">
                    <span className="block text-[9px] font-semibold uppercase text-neutral-400">Semana {String(indice + 1).padStart(2, '0')}</span>
                    {String(semana.inicio).padStart(2, '0')} a {String(semana.fim).padStart(2, '0')}
                  </th>
                ))}
                <th colSpan={3} className="bg-yellow-400 px-3 py-2 text-center text-black">{MESES[mes]} • {ano}</th>
              </tr>
              <tr className="bg-neutral-800 text-neutral-200">
                {semanas.map((semana) => <th key={semana.inicio} colSpan={2} className="border-r border-neutral-600 px-2 py-1.5 text-center">{semana.diasTrabalhados} dias trabalhados</th>)}
                <th rowSpan={2} className="bg-yellow-50 px-3 py-2 text-right text-neutral-700">Realizado</th>
                <th rowSpan={2} className="bg-yellow-50 px-3 py-2 text-right text-neutral-700">Meta</th>
                <th rowSpan={2} className="bg-yellow-50 px-3 py-2 text-right text-neutral-700">% Crescimento</th>
              </tr>
              <tr className="bg-neutral-100 text-[9px] uppercase tracking-wider text-neutral-500">
                {semanas.map((semana) => (
                  <React.Fragment key={semana.inicio}>
                    <th className="border-r border-neutral-200 px-3 py-2 text-right">Planejado</th>
                    <th className="border-r border-neutral-300 px-3 py-2 text-right">Realizado</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {lojas.map((loja, indice) => {
                const realizadoLoja = realizadoDaLoja(loja);
                const crescimento = loja.meta > 0 ? ((realizadoLoja / loja.meta) - 1) * 100 : 0;
                return (
                  <tr key={loja.id} className="border-b border-neutral-200 odd:bg-white even:bg-neutral-50/70 hover:bg-yellow-50/60">
                    <td className="border-r border-neutral-200 px-2 py-3 text-center"><span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-yellow-400 font-black text-black">{indice + 1}</span></td>
                    <td className="border-r border-neutral-200 px-4 py-3 font-black text-neutral-900">{nomeLoja(loja.nome)}</td>
                    {semanas.map((semana) => (
                      <React.Fragment key={semana.inicio}>
                        <td className="border-r border-neutral-200 px-3 py-3 text-right font-bold tabular-nums text-neutral-700">{numero(diasTrabalhados ? loja.meta * semana.diasTrabalhados / diasTrabalhados : 0)}</td>
                        <td className="border-r border-neutral-300 px-3 py-3 text-right font-black tabular-nums text-emerald-700">{dados ? numero(realizadoNaSemana(loja, semana)) : '—'}</td>
                      </React.Fragment>
                    ))}
                    <td className="bg-yellow-50/70 px-3 py-3 text-right font-black tabular-nums text-emerald-700">{dados ? numero(realizadoLoja) : '—'}</td>
                    <td className="bg-yellow-50/70 px-3 py-3 text-right font-black tabular-nums">{numero(loja.meta)}</td>
                    <td className={`bg-yellow-50/70 px-3 py-3 text-right font-black tabular-nums ${crescimento >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{dados ? percentual(crescimento) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="font-black">
              <tr className="border-t-2 border-yellow-400 bg-neutral-100">
                <td colSpan={2} className="border-r border-neutral-300 px-4 py-3 text-right">Total Semana</td>
                {semanas.map((semana) => (
                  <React.Fragment key={semana.inicio}>
                    <td className="border-r border-neutral-200 px-3 py-3 text-right tabular-nums">{numero(diasTrabalhados ? metaTotal * semana.diasTrabalhados / diasTrabalhados : 0)}</td>
                    <td className="border-r border-neutral-300 px-3 py-3 text-right tabular-nums text-emerald-700">{dados ? numero(lojas.reduce((total, loja) => total + realizadoNaSemana(loja, semana), 0)) : '—'}</td>
                  </React.Fragment>
                ))}
                <td className="bg-yellow-100 px-3 py-3 text-right text-emerald-800">{dados ? numero(realizadoTotal) : '—'}</td>
                <td className="bg-yellow-100 px-3 py-3 text-right">{numero(metaTotal)}</td>
                <td className="bg-yellow-100 px-3 py-3 text-right">{dados && metaTotal ? percentual(((realizadoTotal / metaTotal) - 1) * 100) : '—'}</td>
              </tr>
              <tr className="bg-neutral-950 text-white">
                <td colSpan={2} className="border-r border-neutral-700 px-4 py-3 text-right">Total Acumulado</td>
                {semanas.map((semana, indice) => {
                  const anteriores = semanas.slice(0, indice + 1);
                  const diasAcumulados = anteriores.reduce((total, item) => total + item.diasTrabalhados, 0);
                  const realizadoAcumulado = lojas.reduce((total, loja) => total + anteriores.reduce((soma, item) => soma + realizadoNaSemana(loja, item), 0), 0);
                  return <React.Fragment key={semana.inicio}><td className="border-r border-neutral-700 px-3 py-3 text-right text-yellow-400">{numero(diasTrabalhados ? metaTotal * diasAcumulados / diasTrabalhados : 0)}</td><td className="border-r border-neutral-700 px-3 py-3 text-right text-emerald-400">{dados ? numero(realizadoAcumulado) : '—'}</td></React.Fragment>;
                })}
                <td colSpan={3} className="px-3 py-3 text-right text-yellow-400">Meta mensal {moeda(metaTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-4"><BarChart3 className="h-5 w-5 text-yellow-500" /><div><h2 className="font-black">Distribuição da meta mensal</h2><p className="text-[10px] text-neutral-400">Resultado consolidado diretamente das semanas da tabela acima</p></div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead className="bg-neutral-50 text-[9px] uppercase tracking-wider text-neutral-500"><tr><th className="px-5 py-3 text-left">Unidade</th><th className="px-4 py-3 text-right">Meta mensal</th><th className="px-4 py-3 text-right">% representa</th><th className="px-4 py-3 text-right">Realizado</th><th className="px-5 py-3 text-right">Atual %</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">{lojas.map((loja) => { const realizadoLoja = realizadoDaLoja(loja); return <tr key={loja.id}><td className="px-5 py-3 font-bold">{nomeLoja(loja.nome)}</td><td className="px-4 py-3 text-right tabular-nums">{moeda(loja.meta)}</td><td className="px-4 py-3 text-right tabular-nums">{metaTotal ? percentual(loja.meta / metaTotal * 100) : '—'}</td><td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">{dados ? moeda(realizadoLoja) : '—'}</td><td className="px-5 py-3 text-right font-black tabular-nums">{dados && loja.meta ? percentual(realizadoLoja / loja.meta * 100) : '—'}</td></tr>; })}</tbody>
              <tfoot className="bg-yellow-400 font-black text-black"><tr><td className="px-5 py-3">TOTAL</td><td className="px-4 py-3 text-right">{moeda(metaTotal)}</td><td className="px-4 py-3 text-right">100,0%</td><td className="px-4 py-3 text-right">{dados ? moeda(realizadoTotal) : '—'}</td><td className="px-5 py-3 text-right">{dados && metaTotal ? percentual(realizadoTotal / metaTotal * 100) : '—'}</td></tr></tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-neutral-950 p-5 text-white shadow-sm">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400">Resumo executivo</span>
          <div className="mt-4 space-y-4">
            <div><span className="text-[10px] text-neutral-400">Meta corporativa</span><strong className="block text-xl">{moeda(metaTotal)}</strong></div>
            <div><span className="text-[10px] text-neutral-400">Realizado no mês</span><strong className="block text-xl text-emerald-400">{dados ? moeda(realizadoTotal) : '—'}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(100, metaTotal ? realizadoTotal / metaTotal * 100 : 0)}%` }} /></div>
            <div className="flex items-center justify-between"><span className="text-xs text-neutral-300">Atingimento</span><span className="flex items-center gap-1 text-lg font-black text-yellow-400"><TrendingUp className="h-4 w-4" />{dados && metaTotal ? percentual(realizadoTotal / metaTotal * 100) : '—'}</span></div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[10px] text-neutral-300"><Building2 className="h-4 w-4 text-yellow-400" />{lojas.length} unidades no planejamento de {MESES[mes]}</div>
          </div>
        </div>
      </section>
    </div>
  );
};
