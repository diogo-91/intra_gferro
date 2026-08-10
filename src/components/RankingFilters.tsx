import React from 'react';
import { Search, ChevronDown } from 'lucide-react';

export type Periodo = 'dia' | 'semana' | 'mes';

export const periodos: { id: Periodo; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
];

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Opções do seletor de mês específico: mês corrente + 11 anteriores, mais recente primeiro.
function gerarOpcoesMes(): { value: string; label: string }[] {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return { value: chaveMes(d), label: `${NOMES_MES[d.getMonth()]} de ${d.getFullYear()}` };
  });
}

interface SeletorMesEspecificoProps {
  periodo: Periodo;
  mes: string | null;
  setMes: (mes: string | null) => void;
}

// Só aparece quando o "Mês" tá selecionado — deixa escolher um mês específico
// (ex.: Julho) em vez de sempre olhar o mês corrente.
export const SeletorMesEspecifico: React.FC<SeletorMesEspecificoProps> = ({ periodo, mes, setMes }) => {
  if (periodo !== 'mes') return null;

  return (
    <div className="relative">
      <label htmlFor="vendas-mes-especifico" className="sr-only">
        Mês específico
      </label>
      <select
        id="vendas-mes-especifico"
        value={mes ?? ''}
        onChange={(e) => setMes(e.target.value || null)}
        className="appearance-none pl-3.5 pr-8 py-2 rounded-full bg-white border border-neutral-200 text-xs font-bold text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus:border-yellow-400 cursor-pointer transition-all"
      >
        <option value="">Mês atual</option>
        {gerarOpcoesMes().map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
};

interface RankingFiltersProps {
  periodo: Periodo;
  setPeriodo: (periodo: Periodo) => void;
  mes: string | null;
  setMes: (mes: string | null) => void;
  busca: string;
  setBusca: (busca: string) => void;
  somenteComPedidos: boolean;
  setSomenteComPedidos: (valor: boolean) => void;
}

export const RankingFilters: React.FC<RankingFiltersProps> = ({
  periodo,
  setPeriodo,
  mes,
  setMes,
  busca,
  setBusca,
  somenteComPedidos,
  setSomenteComPedidos,
}) => {
  return (
    <div className="p-4 border-b border-neutral-200 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          role="group"
          aria-label="Período do ranking"
          className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-full border border-neutral-200 w-fit"
        >
          {periodos.map((p) => {
            const selecionado = periodo === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selecionado}
                onClick={() => setPeriodo(p.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none ${
                  selecionado
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'text-neutral-500 font-medium hover:text-neutral-900'
                }`}
              >
                {p.label}
                {selecionado && <span className="sr-only"> (selecionado)</span>}
              </button>
            );
          })}
        </div>

        <SeletorMesEspecifico periodo={periodo} mes={mes} setMes={setMes} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          <label htmlFor="ranking-busca-vendedor" className="sr-only">
            Buscar vendedor
          </label>
          <input
            id="ranking-busca-vendedor"
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar vendedor..."
            className="bg-white border border-neutral-200 rounded-full py-2 pl-9 pr-4 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus:border-yellow-400 transition-all motion-reduce:transition-none"
          />
        </div>

        <label
          htmlFor="ranking-somente-com-pedidos"
          className="flex items-center gap-2 text-[11px] text-neutral-500 font-normal cursor-pointer select-none"
        >
          <input
            id="ranking-somente-com-pedidos"
            type="checkbox"
            checked={somenteComPedidos}
            onChange={(e) => setSomenteComPedidos(e.target.checked)}
            className="w-4 h-4 rounded accent-yellow-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-yellow-400"
          />
          Somente com pedidos no período
        </label>
      </div>
    </div>
  );
};
