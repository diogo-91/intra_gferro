import React, { useState } from 'react';
import { ClipboardList, ExternalLink, RefreshCw } from 'lucide-react';

// Dashboard > Pedidos > Pedidos em aberto (PCP): a tela do projeto "nomus-local" (carteira de pedidos liberados no Nomus com financeiro, material, rota,
// aguardando liberação e assistente de IA), embutida aqui. O servidor da intranet repassa as chamadas (ver pedidosPcpProxy.ts), então o acesso segue o
// login e a permissão do módulo "Dashboard de Pedidos".
const ENDERECO = '/api/pcp-pedidos/';

export const PedidosEmAbertoPcp: React.FC = () => {
  const [versao, setVersao] = useState(0);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[520px] flex-col gap-3 sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-9rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-yellow-200 to-yellow-100 shadow-md shadow-yellow-400/20">
            <ClipboardList className="h-[22px] w-[22px] text-yellow-500" aria-hidden="true" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Dashboard › Pedidos › <b className="text-neutral-900">Em aberto (PCP)</b></span>
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-neutral-900">Pedidos em aberto (PCP)</h1>
            <p className="mt-1 max-w-3xl text-xs leading-snug text-neutral-500">
              Carteira de pedidos liberados no Nomus, com financeiro, material, rota, fila de aguardando liberação e assistente de IA. Os dados se atualizam de hora em hora.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Recarregar
          </button>
          <a
            href={ENDERECO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Tela cheia
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <iframe key={versao} title="Pedidos em aberto (PCP)" src={`${ENDERECO}?embed=1`} className="h-full w-full border-0" />
      </div>
    </div>
  );
};
