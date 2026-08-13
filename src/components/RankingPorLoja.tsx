import React, { useEffect, useRef, useState } from 'react';
import { Camera, Store } from 'lucide-react';
import { VendedorRanking } from '../types';
import { LOJAS, lojaDoVendedor } from '../data/vendedorLoja';
import { RankingPodium } from './RankingPodium';
import { RankingTable } from './RankingTable';

interface RankingComPosicao extends VendedorRanking {
  posicao: number;
}

interface RankingPorLojaProps {
  vendedores: RankingComPosicao[];
}

// Agrupa o ranking (já filtrado por busca/checkbox) por loja — mapeamento
// fixo em src/data/vendedorLoja.ts, já que o Nomus não tem esse conceito.
// Cada loja tem seu próprio pódio (1º/2º/3º DENTRO da loja, não da empresa
// toda) — escolha confirmada com o usuário. A ordem de entrada já vem do
// maior pro menor valor vendido (herdada da lista global), então filtrar
// por loja preserva essa ordem sem precisar reordenar.
export const RankingPorLoja: React.FC<RankingPorLojaProps> = ({ vendedores }) => {
  const [fotos, setFotos] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/vendas/lojas/fotos')
      .then((res) => res.json())
      .then((data) => setFotos(data))
      .catch(() => {});
  }, []);

  async function enviarFoto(lojaId: string, arquivo: File) {
    const form = new FormData();
    form.append('foto', arquivo);
    const res = await fetch(`/api/vendas/lojas/${lojaId}/foto`, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Falha ao enviar a foto');
    setFotos((atual) => ({ ...atual, [lojaId]: data.url }));
  }

  const semLoja = vendedores.filter((v) => !lojaDoVendedor(v.nome));

  return (
    <div className="space-y-8">
      {LOJAS.map((loja) => {
        const doGrupo = vendedores.filter((v) => lojaDoVendedor(v.nome) === loja.id);
        const comPosicaoLocal = doGrupo.map((v, index) => ({ ...v, posicao: index + 1 }));
        const top3 = comPosicaoLocal.filter((v) => v.posicao <= 3);
        const restante = comPosicaoLocal.filter((v) => v.posicao > 3);

        return (
          <div key={loja.id} className="space-y-4">
            <FotoLoja lojaId={loja.id} nome={loja.nome} url={fotos[loja.id]} onEnviar={enviarFoto} />
            {doGrupo.length === 0 ? (
              <p className="text-neutral-500 text-xs px-1">Nenhum vendedor com pedidos nesta loja no período.</p>
            ) : (
              <>
                <RankingPodium top3={top3} />
                <RankingTable vendedores={restante} />
              </>
            )}
          </div>
        );
      })}

      {semLoja.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-neutral-100">
          <h2 className="text-sm font-bold text-neutral-900">Sem loja definida</h2>
          <RankingTable vendedores={semLoja.map((v, index) => ({ ...v, posicao: index + 1 }))} />
        </div>
      )}
    </div>
  );
};

interface FotoLojaProps {
  lojaId: string;
  nome: string;
  url?: string;
  onEnviar: (lojaId: string, arquivo: File) => Promise<void>;
}

const FotoLoja: React.FC<FotoLojaProps> = ({ lojaId, nome, url, onEnviar }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await onEnviar(lojaId, arquivo);
    } catch (err: any) {
      setErro(err.message || 'Falha ao enviar a foto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-white">
      <div className="relative h-40 sm:h-48 bg-neutral-100">
        {url ? (
          <img src={url} alt={`Fachada — ${nome}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-neutral-400">
            <Store className="w-6 h-6" aria-hidden="true" />
            <span className="text-[11px]">Sem foto</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-[11px] font-semibold hover:bg-black/85 disabled:opacity-50 transition-all"
        >
          <Camera className="w-3.5 h-3.5" aria-hidden="true" />
          {enviando ? 'Enviando...' : url ? 'Alterar foto' : 'Adicionar foto'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-neutral-900">{nome}</h2>
        {erro && <span className="text-red-600 text-[11px] font-semibold">{erro}</span>}
      </div>
    </div>
  );
};
