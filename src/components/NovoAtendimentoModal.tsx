import React, { useState } from 'react';
import { X, Send, Plus, Trash2, AlertTriangle, Paperclip, Headphones } from 'lucide-react';
import { SacAtendimento, SacProdutoReclamado, User } from '../types';
import { SAC_TIPOS_ATENDIMENTO, SAC_PRIORIDADES, SAC_CANAIS } from '../data/sacOpcoes';

interface NovoAtendimentoModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onCriado: (atendimento: SacAtendimento) => void;
}

const CLIENTE_INICIAL = { cliente: '', nomeFantasia: '', cnpjCpf: '', contato: '', telefone: '', whatsapp: '', email: '', cidade: '', estado: '' };
const COMERCIAL_INICIAL = { vendedor: '', numeroPedido: '', numeroNF: '', dataVenda: '', dataEmissaoNF: '', dataEntrega: '', transportadora: '', numeroOC: '' };
const ATENDIMENTO_INICIAL = {
  tipo: SAC_TIPOS_ATENDIMENTO[0],
  assunto: '',
  descricao: '',
  prioridade: 'Normal' as const,
  canal: SAC_CANAIS[0],
  responsavelSac: '',
  prazo: '',
};

function produtoVazio(): SacProdutoReclamado {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    produto: '',
    descricao: '',
    codigo: '',
    bitola: '',
    espessura: '',
    largura: '',
    comprimento: '',
    quantidadeVendida: '',
    quantidadeReclamada: '',
    unidadeMedida: '',
    peso: '',
    lote: '',
    corrida: '',
    certificado: false,
    numeroCertificado: '',
  };
}

export const NovoAtendimentoModal: React.FC<NovoAtendimentoModalProps> = ({ isOpen, user, onClose, onCriado }) => {
  const [cliente, setCliente] = useState(CLIENTE_INICIAL);
  const [comercial, setComercial] = useState(COMERCIAL_INICIAL);
  const [produtos, setProdutos] = useState<SacProdutoReclamado[]>([produtoVazio()]);
  const [dadosAtendimento, setDadosAtendimento] = useState(ATENDIMENTO_INICIAL);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetar() {
    setCliente(CLIENTE_INICIAL);
    setComercial(COMERCIAL_INICIAL);
    setProdutos([produtoVazio()]);
    setDadosAtendimento(ATENDIMENTO_INICIAL);
    setArquivos([]);
    setErro(null);
  }

  function fechar() {
    resetar();
    onClose();
  }

  function atualizarProduto(id: string, patch: Partial<SacProdutoReclamado>) {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function adicionarProduto() {
    setProdutos((prev) => [...prev, produtoVazio()]);
  }

  function removerProduto(id: string) {
    setProdutos((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente.cliente.trim()) {
      setErro('Informe o cliente / razão social.');
      return;
    }
    if (!dadosAtendimento.assunto.trim() || !dadosAtendimento.descricao.trim()) {
      setErro('Informe o assunto e a descrição do atendimento.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const produtosPreenchidos = produtos.filter((p) => p.produto.trim() || p.lote?.trim() || p.corrida?.trim());
      const res = await fetch('/api/sac/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: user.name,
          ...cliente,
          ...comercial,
          produtos: produtosPreenchidos,
          ...dadosAtendimento,
          prazo: dadosAtendimento.prazo ? new Date(dadosAtendimento.prazo).toISOString() : undefined,
        }),
      });
      const criado = await res.json();
      if (!res.ok) throw new Error(criado?.error || 'Falha ao criar atendimento.');

      for (const arquivo of arquivos) {
        const form = new FormData();
        form.append('arquivo', arquivo);
        form.append('usuario', user.name);
        await fetch(`/api/sac/atendimentos/${criado.id}/anexos`, { method: 'POST', body: form }).catch(() => {});
      }

      resetar();
      onCriado(criado);
    } catch (err: any) {
      setErro(err.message || 'Falha ao criar atendimento.');
    } finally {
      setSalvando(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all';
  const labelCls = 'block text-neutral-600 font-semibold mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={fechar}>
      <div
        className="bg-white border border-neutral-200 rounded-[2rem] w-full max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4 sticky -top-8 sm:-top-8 bg-white z-10">
          <h2 className="text-base font-extrabold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <Headphones className="w-5 h-5 text-yellow-600" aria-hidden="true" />
            Novo Atendimento
          </h2>
          <button type="button" onClick={fechar} className="p-2 rounded-full text-neutral-500 hover:text-yellow-600 hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 text-xs">
          {/* 8.1 Dados do Cliente */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-extrabold text-yellow-600 uppercase tracking-widest">Dados do Cliente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>Cliente / Razão Social *</label>
                <input className={inputCls} required value={cliente.cliente} onChange={(e) => setCliente((c) => ({ ...c, cliente: e.target.value }))} placeholder="Ex: Metalúrgica ABC Ltda" />
              </div>
              <div>
                <label className={labelCls}>Nome Fantasia</label>
                <input className={inputCls} value={cliente.nomeFantasia} onChange={(e) => setCliente((c) => ({ ...c, nomeFantasia: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>CNPJ / CPF</label>
                <input className={inputCls} value={cliente.cnpjCpf} onChange={(e) => setCliente((c) => ({ ...c, cnpjCpf: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className={labelCls}>Contato</label>
                <input className={inputCls} value={cliente.contato} onChange={(e) => setCliente((c) => ({ ...c, contato: e.target.value }))} placeholder="Nome de quem falou com o SAC" />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input className={inputCls} value={cliente.telefone} onChange={(e) => setCliente((c) => ({ ...c, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input className={inputCls} value={cliente.whatsapp} onChange={(e) => setCliente((c) => ({ ...c, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" className={inputCls} value={cliente.email} onChange={(e) => setCliente((c) => ({ ...c, email: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Cidade</label>
                <input className={inputCls} value={cliente.cidade} onChange={(e) => setCliente((c) => ({ ...c, cidade: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <input className={inputCls} maxLength={2} value={cliente.estado} onChange={(e) => setCliente((c) => ({ ...c, estado: e.target.value.toUpperCase() }))} placeholder="SP" />
              </div>
            </div>
          </section>

          {/* 8.2 Dados Comerciais */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-extrabold text-yellow-600 uppercase tracking-widest">Dados Comerciais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Vendedor Responsável</label>
                <input className={inputCls} value={comercial.vendedor} onChange={(e) => setComercial((c) => ({ ...c, vendedor: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Número do Pedido</label>
                <input className={inputCls} value={comercial.numeroPedido} onChange={(e) => setComercial((c) => ({ ...c, numeroPedido: e.target.value }))} placeholder="PV-0000" />
              </div>
              <div>
                <label className={labelCls}>Número da Nota Fiscal</label>
                <input className={inputCls} value={comercial.numeroNF} onChange={(e) => setComercial((c) => ({ ...c, numeroNF: e.target.value }))} placeholder="NF-00000" />
              </div>
              <div>
                <label className={labelCls}>Número da OC do Cliente</label>
                <input className={inputCls} value={comercial.numeroOC} onChange={(e) => setComercial((c) => ({ ...c, numeroOC: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Data da Venda</label>
                <input type="date" className={inputCls} value={comercial.dataVenda} onChange={(e) => setComercial((c) => ({ ...c, dataVenda: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Data de Emissão da NF</label>
                <input type="date" className={inputCls} value={comercial.dataEmissaoNF} onChange={(e) => setComercial((c) => ({ ...c, dataEmissaoNF: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Data da Entrega</label>
                <input type="date" className={inputCls} value={comercial.dataEntrega} onChange={(e) => setComercial((c) => ({ ...c, dataEntrega: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Transportadora</label>
                <input className={inputCls} value={comercial.transportadora} onChange={(e) => setComercial((c) => ({ ...c, transportadora: e.target.value }))} />
              </div>
            </div>
          </section>

          {/* 8.3 Dados do Produto */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold text-yellow-600 uppercase tracking-widest">Produtos Envolvidos</h3>
              <button type="button" onClick={adicionarProduto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all">
                <Plus className="w-3.5 h-3.5" />
                Adicionar produto
              </button>
            </div>

            {produtos.map((produto, indice) => (
              <div key={produto.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Produto {indice + 1}</span>
                  <button type="button" onClick={() => removerProduto(produto.id)} disabled={produtos.length <= 1} title="Remover produto" className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-neutral-200 text-neutral-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <input className={inputCls} value={produto.produto} onChange={(e) => atualizarProduto(produto.id, { produto: e.target.value })} placeholder="Produto" />
                  <input className={inputCls} value={produto.codigo} onChange={(e) => atualizarProduto(produto.id, { codigo: e.target.value })} placeholder="Código" />
                  <input className={inputCls} value={produto.descricao} onChange={(e) => atualizarProduto(produto.id, { descricao: e.target.value })} placeholder="Descrição" />
                  <input className={inputCls} value={produto.bitola} onChange={(e) => atualizarProduto(produto.id, { bitola: e.target.value })} placeholder="Bitola" />
                  <input className={inputCls} value={produto.espessura} onChange={(e) => atualizarProduto(produto.id, { espessura: e.target.value })} placeholder="Espessura" />
                  <input className={inputCls} value={produto.largura} onChange={(e) => atualizarProduto(produto.id, { largura: e.target.value })} placeholder="Largura" />
                  <input className={inputCls} value={produto.comprimento} onChange={(e) => atualizarProduto(produto.id, { comprimento: e.target.value })} placeholder="Comprimento" />
                  <input className={inputCls} value={produto.quantidadeVendida} onChange={(e) => atualizarProduto(produto.id, { quantidadeVendida: e.target.value })} placeholder="Qtd. vendida" />
                  <input className={inputCls} value={produto.quantidadeReclamada} onChange={(e) => atualizarProduto(produto.id, { quantidadeReclamada: e.target.value })} placeholder="Qtd. reclamada" />
                  <input className={inputCls} value={produto.unidadeMedida} onChange={(e) => atualizarProduto(produto.id, { unidadeMedida: e.target.value })} placeholder="Unidade" />
                  <input className={inputCls} value={produto.peso} onChange={(e) => atualizarProduto(produto.id, { peso: e.target.value })} placeholder="Peso" />
                  <input className={inputCls} value={produto.lote} onChange={(e) => atualizarProduto(produto.id, { lote: e.target.value })} placeholder="Lote" />
                  <input className={inputCls} value={produto.corrida} onChange={(e) => atualizarProduto(produto.id, { corrida: e.target.value })} placeholder="Corrida" />
                  <input className={inputCls} value={produto.numeroCertificado} onChange={(e) => atualizarProduto(produto.id, { numeroCertificado: e.target.value })} placeholder="Nº do certificado" />
                  <label className="flex items-center gap-2 px-4 py-2.5 text-neutral-600 font-semibold">
                    <input type="checkbox" checked={!!produto.certificado} onChange={(e) => atualizarProduto(produto.id, { certificado: e.target.checked })} className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400" />
                    Possui certificado
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* 8.4 Dados do Atendimento */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-extrabold text-yellow-600 uppercase tracking-widest">Dados do Atendimento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tipo de Atendimento *</label>
                <select className={inputCls} value={dadosAtendimento.tipo} onChange={(e) => setDadosAtendimento((d) => ({ ...d, tipo: e.target.value as any }))}>
                  {SAC_TIPOS_ATENDIMENTO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Canal de Atendimento *</label>
                <select className={inputCls} value={dadosAtendimento.canal} onChange={(e) => setDadosAtendimento((d) => ({ ...d, canal: e.target.value as any }))}>
                  {SAC_CANAIS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Assunto *</label>
                <input className={inputCls} required value={dadosAtendimento.assunto} onChange={(e) => setDadosAtendimento((d) => ({ ...d, assunto: e.target.value }))} placeholder="Resumo do atendimento" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição Detalhada *</label>
                <textarea required rows={4} value={dadosAtendimento.descricao} onChange={(e) => setDadosAtendimento((d) => ({ ...d, descricao: e.target.value }))} placeholder="Detalhe o que o cliente relatou..." className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all" />
              </div>
              <div>
                <label className={labelCls}>Prioridade *</label>
                <div className="flex gap-2">
                  {SAC_PRIORIDADES.map((p) => (
                    <button key={p} type="button" onClick={() => setDadosAtendimento((d) => ({ ...d, prioridade: p }))} className={`flex-1 py-2 rounded-full border font-bold text-[11px] transition-all ${dadosAtendimento.prioridade === p ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20' : 'bg-white text-neutral-500 border-neutral-200 hover:text-neutral-900'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Prazo Previsto para Resolução</label>
                <input type="datetime-local" className={inputCls} value={dadosAtendimento.prazo} onChange={(e) => setDadosAtendimento((d) => ({ ...d, prazo: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Responsável SAC</label>
                <input className={inputCls} value={dadosAtendimento.responsavelSac} onChange={(e) => setDadosAtendimento((d) => ({ ...d, responsavelSac: e.target.value }))} placeholder={user.name} />
              </div>
            </div>
          </section>

          {/* 8.5 Evidências */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-extrabold text-yellow-600 uppercase tracking-widest">Evidências</h3>
            <label className="flex items-center justify-center gap-2 px-4 py-6 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-500 hover:border-yellow-400 hover:text-yellow-600 cursor-pointer transition-all">
              <Paperclip className="w-4 h-4" />
              <span className="font-semibold">Anexar fotos, PDFs, vídeos, nota fiscal, certificado...</span>
              <input type="file" multiple className="hidden" onChange={(e) => setArquivos((prev) => [...prev, ...Array.from(e.target.files || [])])} />
            </label>
            {arquivos.length > 0 && (
              <ul className="space-y-1.5">
                {arquivos.map((arquivo, indice) => (
                  <li key={indice} className="flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="truncate text-neutral-700 font-semibold">{arquivo.name}</span>
                    <button type="button" onClick={() => setArquivos((prev) => prev.filter((_, i) => i !== indice))} className="text-neutral-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {erro && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button type="button" onClick={fechar} className="px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="px-6 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold hover:bg-yellow-300 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{salvando ? 'Salvando...' : 'Registrar Atendimento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
