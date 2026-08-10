import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  Send,
  Plus,
  Paperclip,
  Undo2,
  Ban,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
} from 'lucide-react';
import { SacAtendimento, User } from '../types';
import {
  SAC_STATUS,
  SAC_PRIORIDADES,
  SAC_PROCEDENCIAS,
  SAC_DEPARTAMENTOS,
  SAC_CANAIS,
  SAC_TIPOS_SOLUCAO,
  SAC_TIPOS_SOLUCAO_SENSIVEIS,
} from '../data/sacOpcoes';
import { SAC_STATUS_BADGE, SAC_PRIORIDADE_BADGE, SAC_PROCEDENCIA_BADGE, situacaoPrazo, corBadgePrazo, statusEhEncerrado } from '../utils/sacHelpers';
import type { AlertaReincidencia } from '../../sac';
import type { SacAbaDetalhe } from './SacListaAtendimentos';

interface SacAtendimentoDetalheProps {
  id: string;
  user: User;
  abaInicial?: SacAbaDetalhe;
  onVoltar: () => void;
}

const ABAS: { chave: SacAbaDetalhe; label: string }[] = [
  { chave: 'geral', label: 'Visão Geral' },
  { chave: 'interacoes', label: 'Interações' },
  { chave: 'analise', label: 'Análise Interna' },
  { chave: 'produtos', label: 'Produtos' },
  { chave: 'anexos', label: 'Anexos' },
  { chave: 'solucao', label: 'Solução' },
  { chave: 'historico', label: 'Histórico' },
];

const inputCls = 'w-full px-4 py-2 bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all text-xs';
const labelCls = 'block text-neutral-600 font-semibold mb-1.5 text-xs';
const cardCls = 'p-5 rounded-[1.5rem] bg-white border border-neutral-200 shadow-sm space-y-3';

export const SacAtendimentoDetalhe: React.FC<SacAtendimentoDetalheProps> = ({ id, user, abaInicial, onVoltar }) => {
  const [atendimento, setAtendimento] = useState<SacAtendimento | null>(null);
  const [alertas, setAlertas] = useState<AlertaReincidencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<SacAbaDetalhe>(abaInicial || 'geral');
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  function carregar() {
    setCarregando(true);
    setErroCarregar(null);
    Promise.all([
      fetch(`/api/sac/atendimentos/${id}`).then((r) => r.json()),
      fetch(`/api/sac/atendimentos/${id}/alertas`).then((r) => r.json()),
    ])
      .then(([a, alertasData]) => {
        if (a?.error) throw new Error(a.error);
        setAtendimento(a);
        setAlertas(Array.isArray(alertasData) ? alertasData : []);
      })
      .catch((err) => setErroCarregar(err.message || 'Falha ao carregar atendimento.'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function chamarAcao(url: string, method: string, body?: Record<string, unknown>, isForm?: FormData) {
    setProcessando(true);
    setErroAcao(null);
    try {
      const res = await fetch(url, {
        method,
        headers: isForm ? undefined : { 'Content-Type': 'application/json' },
        body: isForm || (body ? JSON.stringify({ usuario: user.name, ...body }) : JSON.stringify({ usuario: user.name })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao processar ação.');
      setAtendimento(data);
      return data as SacAtendimento;
    } catch (err: any) {
      setErroAcao(err.message || 'Falha ao processar ação.');
      throw err;
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) return <p className="text-xs text-neutral-500 py-10 text-center">Carregando...</p>;
  if (erroCarregar || !atendimento) {
    return (
      <div className="space-y-4">
        <VoltarBtn onVoltar={onVoltar} />
        <p className="text-xs text-red-600 py-10 text-center">{erroCarregar || 'Atendimento não encontrado.'}</p>
      </div>
    );
  }

  const sit = situacaoPrazo(atendimento.prazo, atendimento.status);
  const tempoAberto = Math.round((Date.now() - new Date(atendimento.criadoEm).getTime()) / (1000 * 60 * 60));

  return (
    <div className="space-y-6 pb-12">
      <VoltarBtn onVoltar={onVoltar} />

      {/* Resumo do topo */}
      <div className="p-6 rounded-[2rem] bg-white border border-yellow-400/30 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono font-black text-xl text-neutral-900">{atendimento.protocolo}</span>
            <h2 className="text-lg font-extrabold text-neutral-900">{atendimento.cliente}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_STATUS_BADGE[atendimento.status]}`}>{atendimento.status}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_PRIORIDADE_BADGE[atendimento.prioridade]}`}>{atendimento.prioridade}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_PROCEDENCIA_BADGE[atendimento.procedencia]}`}>{atendimento.procedencia}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${corBadgePrazo(sit.cor)}`}>{sit.label}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-neutral-500 shrink-0">
            <span>Responsável:</span>
            <span className="font-bold text-neutral-800">{atendimento.responsavelSac || '—'}</span>
            <span>Aberto em:</span>
            <span className="font-bold text-neutral-800">{new Date(atendimento.criadoEm).toLocaleString('pt-BR')}</span>
            <span>Prazo:</span>
            <span className="font-bold text-neutral-800">{atendimento.prazo ? new Date(atendimento.prazo).toLocaleString('pt-BR') : '—'}</span>
            <span>Tempo em aberto:</span>
            <span className="font-bold text-neutral-800">{tempoAberto < 24 ? `${tempoAberto}h` : `${Math.floor(tempoAberto / 24)}d ${tempoAberto % 24}h`}</span>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-100">
          <QuickSelect label="Status" value={atendimento.status} opcoes={SAC_STATUS} disabled={processando} onChange={(v) => chamarAcao(`/api/sac/atendimentos/${id}/status`, 'POST', { status: v }).catch(() => {})} />
          <QuickSelect label="Prioridade" value={atendimento.prioridade} opcoes={SAC_PRIORIDADES} disabled={processando} onChange={(v) => chamarAcao(`/api/sac/atendimentos/${id}/prioridade`, 'POST', { prioridade: v }).catch(() => {})} />
          <QuickTextoInline label="Responsável" valorAtual={atendimento.responsavelSac || ''} disabled={processando} onSalvar={(v) => chamarAcao(`/api/sac/atendimentos/${id}/responsavel`, 'POST', { responsavel: v }).catch(() => {})} />
          {!statusEhEncerrado(atendimento.status) && (
            <AcaoComMotivo label="Cancelar atendimento" icone={Ban} cor="text-red-600 hover:bg-red-50 border-red-200" disabled={processando} onConfirmar={(motivo) => chamarAcao(`/api/sac/atendimentos/${id}/cancelar`, 'POST', { motivo }).catch(() => {})} />
          )}
          {statusEhEncerrado(atendimento.status) && (
            <AcaoComMotivo label="Reabrir atendimento" icone={Undo2} cor="text-yellow-700 hover:bg-yellow-50 border-yellow-300" disabled={processando} onConfirmar={(motivo) => chamarAcao(`/api/sac/atendimentos/${id}/reabrir`, 'POST', { motivo }).catch(() => {})} />
          )}
        </div>

        {erroAcao && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{erroAcao}</span>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{a.mensagem}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-neutral-50 p-1.5 rounded-full border border-neutral-200 w-fit max-w-full">
        {ABAS.map((aba) => (
          <button
            key={aba.chave}
            type="button"
            onClick={() => setAbaAtiva(aba.chave)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              abaAtiva === aba.chave ? 'bg-yellow-400 text-black shadow-md' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {abaAtiva === 'geral' && <AbaVisaoGeral atendimento={atendimento} disabled={processando} onSalvar={(patch) => chamarAcao(`/api/sac/atendimentos/${id}`, 'PATCH', patch).catch(() => {})} />}
      {abaAtiva === 'interacoes' && <AbaInteracoes atendimento={atendimento} disabled={processando} onAdicionar={(dados) => chamarAcao(`/api/sac/atendimentos/${id}/interacoes`, 'POST', dados).catch(() => {})} />}
      {abaAtiva === 'analise' && (
        <AbaAnaliseInterna
          atendimento={atendimento}
          disabled={processando}
          onSolicitar={(dados) => chamarAcao(`/api/sac/atendimentos/${id}/solicitacoes`, 'POST', dados).catch(() => {})}
          onResponder={(solicitacaoId, resposta) => chamarAcao(`/api/sac/atendimentos/${id}/solicitacoes/${solicitacaoId}/resposta`, 'POST', resposta).catch(() => {})}
        />
      )}
      {abaAtiva === 'produtos' && <AbaProdutos atendimento={atendimento} />}
      {abaAtiva === 'anexos' && (
        <AbaAnexos
          atendimento={atendimento}
          disabled={processando}
          onEnviar={(form) => chamarAcao(`/api/sac/atendimentos/${id}/anexos`, 'POST', undefined, form).catch(() => {})}
        />
      )}
      {abaAtiva === 'solucao' && (
        <AbaSolucao
          atendimento={atendimento}
          disabled={processando}
          onDefinirSolucao={(dados) => chamarAcao(`/api/sac/atendimentos/${id}/solucao`, 'POST', dados).catch(() => {})}
          onAprovacao={(aprovado, aprovador) => chamarAcao(`/api/sac/atendimentos/${id}/solucao/aprovacao`, 'POST', { aprovado, aprovador }).catch(() => {})}
          onAbrirNC={(dados) => chamarAcao(`/api/sac/atendimentos/${id}/nao-conformidade`, 'POST', dados).catch(() => {})}
          onAtualizarNC={(patch) => chamarAcao(`/api/sac/atendimentos/${id}/nao-conformidade`, 'PATCH', patch).catch(() => {})}
          onDefinirProcedencia={(dados) => chamarAcao(`/api/sac/atendimentos/${id}/procedencia`, 'POST', dados).catch(() => {})}
          onEncerrar={(dados) => chamarAcao(`/api/sac/atendimentos/${id}/encerrar`, 'POST', dados).catch(() => {})}
        />
      )}
      {abaAtiva === 'historico' && <AbaHistorico atendimento={atendimento} />}
    </div>
  );
};

const VoltarBtn: React.FC<{ onVoltar: () => void }> = ({ onVoltar }) => (
  <button type="button" onClick={onVoltar} className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-yellow-600 hover:border-yellow-400 text-xs font-semibold transition-all">
    <ArrowLeft className="w-3.5 h-3.5" />
    Voltar aos atendimentos
  </button>
);

const QuickSelect: React.FC<{ label: string; value: string; opcoes: readonly string[]; disabled?: boolean; onChange: (v: string) => void }> = ({ label, value, opcoes, disabled, onChange }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] text-neutral-500 font-bold">{label}:</span>
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] font-bold text-neutral-700 focus:outline-none focus:border-yellow-400 cursor-pointer disabled:opacity-50">
      {opcoes.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

const QuickTextoInline: React.FC<{ label: string; valorAtual: string; disabled?: boolean; onSalvar: (v: string) => void }> = ({ label, valorAtual, disabled, onSalvar }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(valorAtual);

  if (!editando) {
    return (
      <button type="button" onClick={() => { setValor(valorAtual); setEditando(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] font-bold text-neutral-700 hover:border-yellow-400 transition-all">
        {label}: {valorAtual || 'definir'}
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(valor);
        setEditando(false);
      }}
    >
      <input autoFocus disabled={disabled} value={valor} onChange={(e) => setValor(e.target.value)} className="px-3 py-1.5 rounded-full bg-white border border-yellow-400 text-[11px] font-bold text-neutral-700 focus:outline-none w-32" />
      <button type="submit" className="text-[10px] font-bold text-yellow-600">Salvar</button>
      <button type="button" onClick={() => setEditando(false)} className="text-[10px] font-bold text-neutral-400">Cancelar</button>
    </form>
  );
};

const AcaoComMotivo: React.FC<{ label: string; icone: React.FC<{ className?: string }>; cor: string; disabled?: boolean; onConfirmar: (motivo: string) => void }> = ({ label, icone: Icone, cor, disabled, onConfirmar }) => {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} disabled={disabled} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border text-[11px] font-bold transition-all disabled:opacity-50 ${cor}`}>
        <Icone className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!motivo.trim()) return;
        onConfirmar(motivo.trim());
        setAberto(false);
        setMotivo('');
      }}
    >
      <input autoFocus required placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="px-3 py-1.5 rounded-full bg-white border border-yellow-400 text-[11px] w-40 focus:outline-none" />
      <button type="submit" className="text-[10px] font-bold text-yellow-600">Confirmar</button>
      <button type="button" onClick={() => setAberto(false)} className="text-[10px] font-bold text-neutral-400">Cancelar</button>
    </form>
  );
};

// ---- Aba Visão Geral ----
const AbaVisaoGeral: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onSalvar: (patch: Record<string, unknown>) => void }> = ({ atendimento, disabled, onSalvar }) => {
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState({
    cliente: atendimento.cliente,
    nomeFantasia: atendimento.nomeFantasia || '',
    cnpjCpf: atendimento.cnpjCpf || '',
    contato: atendimento.contato || '',
    telefone: atendimento.telefone || '',
    email: atendimento.email || '',
    assunto: atendimento.assunto,
    descricao: atendimento.descricao,
  });

  function iniciarEdicao() {
    setCampos({
      cliente: atendimento.cliente,
      nomeFantasia: atendimento.nomeFantasia || '',
      cnpjCpf: atendimento.cnpjCpf || '',
      contato: atendimento.contato || '',
      telefone: atendimento.telefone || '',
      email: atendimento.email || '',
      assunto: atendimento.assunto,
      descricao: atendimento.descricao,
    });
    setEditando(true);
  }

  if (editando) {
    return (
      <form
        className={`${cardCls}`}
        onSubmit={(e) => {
          e.preventDefault();
          onSalvar(campos);
          setEditando(false);
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Cliente</label><input className={inputCls} value={campos.cliente} onChange={(e) => setCampos((c) => ({ ...c, cliente: e.target.value }))} /></div>
          <div><label className={labelCls}>Nome Fantasia</label><input className={inputCls} value={campos.nomeFantasia} onChange={(e) => setCampos((c) => ({ ...c, nomeFantasia: e.target.value }))} /></div>
          <div><label className={labelCls}>CNPJ/CPF</label><input className={inputCls} value={campos.cnpjCpf} onChange={(e) => setCampos((c) => ({ ...c, cnpjCpf: e.target.value }))} /></div>
          <div><label className={labelCls}>Contato</label><input className={inputCls} value={campos.contato} onChange={(e) => setCampos((c) => ({ ...c, contato: e.target.value }))} /></div>
          <div><label className={labelCls}>Telefone</label><input className={inputCls} value={campos.telefone} onChange={(e) => setCampos((c) => ({ ...c, telefone: e.target.value }))} /></div>
          <div><label className={labelCls}>E-mail</label><input className={inputCls} value={campos.email} onChange={(e) => setCampos((c) => ({ ...c, email: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Assunto</label><input className={inputCls} value={campos.assunto} onChange={(e) => setCampos((c) => ({ ...c, assunto: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Descrição</label><textarea rows={3} className="w-full p-3 bg-white border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" value={campos.descricao} onChange={(e) => setCampos((c) => ({ ...c, descricao: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
          <button type="button" onClick={() => setEditando(false)} className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 font-bold text-xs">Cancelar</button>
          <button type="submit" disabled={disabled} className="px-4 py-2 rounded-full bg-yellow-400 text-black font-bold text-xs disabled:opacity-50">Salvar</button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Dados do Cliente</h3>
          <button type="button" onClick={iniciarEdicao} className="text-[11px] font-bold text-yellow-600 hover:underline">Editar</button>
        </div>
        <CampoLinha label="Cliente" valor={atendimento.cliente} />
        <CampoLinha label="Nome Fantasia" valor={atendimento.nomeFantasia} />
        <CampoLinha label="CNPJ/CPF" valor={atendimento.cnpjCpf} />
        <CampoLinha label="Contato" valor={atendimento.contato} />
        <CampoLinha label="Telefone" valor={atendimento.telefone} />
        <CampoLinha label="WhatsApp" valor={atendimento.whatsapp} />
        <CampoLinha label="E-mail" valor={atendimento.email} />
        <CampoLinha label="Cidade/UF" valor={atendimento.cidade ? `${atendimento.cidade}/${atendimento.estado || ''}` : undefined} />
      </div>

      <div className={cardCls}>
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Dados Comerciais</h3>
        <CampoLinha label="Vendedor" valor={atendimento.vendedor} />
        <CampoLinha label="Pedido" valor={atendimento.numeroPedido} />
        <CampoLinha label="Nota Fiscal" valor={atendimento.numeroNF} />
        <CampoLinha label="OC do Cliente" valor={atendimento.numeroOC} />
        <CampoLinha label="Transportadora" valor={atendimento.transportadora} />
        <CampoLinha label="Data da Venda" valor={atendimento.dataVenda} />
        <CampoLinha label="Data de Entrega" valor={atendimento.dataEntrega} />
      </div>

      <div className={`${cardCls} lg:col-span-2`}>
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Atendimento</h3>
        <CampoLinha label="Tipo" valor={atendimento.tipo} />
        <CampoLinha label="Assunto" valor={atendimento.assunto} />
        <CampoLinha label="Descrição" valor={atendimento.descricao} />
        <CampoLinha label="Canal" valor={atendimento.canal} />
        <CampoLinha label="Procedência" valor={atendimento.procedencia} />
        {atendimento.procedenciaMotivo && <CampoLinha label="Motivo da Procedência" valor={atendimento.procedenciaMotivo} />}
      </div>
    </div>
  );
};

const CampoLinha: React.FC<{ label: string; valor?: string }> = ({ label, valor }) => (
  <div className="flex items-start justify-between gap-3 text-xs py-1 border-b border-neutral-50 last:border-0">
    <span className="text-neutral-500 shrink-0">{label}</span>
    <span className="font-semibold text-neutral-800 text-right">{valor || '—'}</span>
  </div>
);

// ---- Aba Interações ----
const AbaInteracoes: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onAdicionar: (dados: Record<string, unknown>) => void }> = ({ atendimento, disabled, onAdicionar }) => {
  const [formAberto, setFormAberto] = useState(false);
  const [canal, setCanal] = useState(SAC_CANAIS[0]);
  const [tipo, setTipo] = useState<'Ligação' | 'WhatsApp' | 'E-mail' | 'Reunião' | 'Retorno ao cliente' | 'Informação recebida' | 'Observação'>('Ligação');
  const [descricao, setDescricao] = useState('');

  const ordenadas = [...atendimento.interacoes].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Linha do Tempo</h3>
        <button type="button" onClick={() => setFormAberto((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all">
          <Plus className="w-3.5 h-3.5" />
          Nova interação
        </button>
      </div>

      {formAberto && (
        <form
          className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!descricao.trim()) return;
            onAdicionar({ canal, tipo, descricao: descricao.trim() });
            setDescricao('');
            setFormAberto(false);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value as any)}>
              {SAC_CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
              {['Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Retorno ao cliente', 'Informação recebida', 'Observação'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <textarea required rows={3} placeholder="Descreva a interação..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full p-3 bg-white border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormAberto(false)} className="px-4 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 font-bold text-xs">Cancelar</button>
            <button type="submit" disabled={disabled} className="px-4 py-2 rounded-full bg-yellow-400 text-black font-bold text-xs disabled:opacity-50">Registrar</button>
          </div>
        </form>
      )}

      {ordenadas.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">Nenhuma interação registrada ainda.</p>
      ) : (
        <div className="space-y-3 pt-1">
          {ordenadas.map((i) => (
            <div key={i.id} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
              <div className="flex-1 pb-3 border-b border-neutral-50 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-neutral-800">{i.usuario} · {i.canal} · {i.tipo}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">{new Date(i.data).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-xs text-neutral-600 mt-1">{i.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Aba Análise Interna ----
const AbaAnaliseInterna: React.FC<{
  atendimento: SacAtendimento;
  disabled: boolean;
  onSolicitar: (dados: Record<string, unknown>) => void;
  onResponder: (solicitacaoId: string, resposta: Record<string, unknown>) => void;
}> = ({ atendimento, disabled, onSolicitar, onResponder }) => {
  const [formAberto, setFormAberto] = useState(false);
  const [departamento, setDepartamento] = useState(SAC_DEPARTAMENTOS[0]);
  const [solicitacao, setSolicitacao] = useState('');
  const [prazo, setPrazo] = useState('');
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Normal' | 'Alta' | 'Urgente'>('Normal');

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Solicitações Internas</h3>
        <button type="button" onClick={() => setFormAberto((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 transition-all">
          <Plus className="w-3.5 h-3.5" />
          Solicitar análise interna
        </button>
      </div>
      <p className="text-[11px] text-neutral-400 -mt-1.5">O SAC continua responsável pelo cliente — isso só pede um parecer do setor.</p>

      {formAberto && (
        <form
          className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!solicitacao.trim()) return;
            onSolicitar({ departamento, solicitacao: solicitacao.trim(), prioridade, prazo: prazo ? new Date(prazo).toISOString() : undefined });
            setSolicitacao('');
            setPrazo('');
            setFormAberto(false);
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className={inputCls} value={departamento} onChange={(e) => setDepartamento(e.target.value as any)}>
              {SAC_DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={inputCls} value={prioridade} onChange={(e) => setPrioridade(e.target.value as any)}>
              {SAC_PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="datetime-local" className={inputCls} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <textarea required rows={3} placeholder="O que precisa ser analisado..." value={solicitacao} onChange={(e) => setSolicitacao(e.target.value)} className="w-full p-3 bg-white border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormAberto(false)} className="px-4 py-2 rounded-full bg-white border border-neutral-200 text-neutral-600 font-bold text-xs">Cancelar</button>
            <button type="submit" disabled={disabled} className="px-4 py-2 rounded-full bg-yellow-400 text-black font-bold text-xs disabled:opacity-50">Enviar solicitação</button>
          </div>
        </form>
      )}

      {atendimento.solicitacoesInternas.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">Nenhuma solicitação interna registrada ainda.</p>
      ) : (
        <div className="space-y-3 pt-1">
          {atendimento.solicitacoesInternas.map((s) => (
            <SolicitacaoCard key={s.id} solicitacao={s} disabled={disabled} onResponder={(resposta) => onResponder(s.id, resposta)} />
          ))}
        </div>
      )}
    </div>
  );
};

const SolicitacaoCard: React.FC<{ solicitacao: SacAtendimento['solicitacoesInternas'][number]; disabled: boolean; onResponder: (resposta: Record<string, unknown>) => void }> = ({ solicitacao, disabled, onResponder }) => {
  const [respondendo, setRespondendo] = useState(false);
  const [parecer, setParecer] = useState('');
  const [responsavel, setResponsavel] = useState('');

  const statusCor: Record<string, string> = {
    Pendente: 'bg-amber-50 text-amber-700 border-amber-200',
    'Em análise': 'bg-amber-50 text-amber-700 border-amber-200',
    Respondido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelado: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  };

  return (
    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-neutral-800">{solicitacao.departamento}</span>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SAC_PRIORIDADE_BADGE[solicitacao.prioridade]}`}>{solicitacao.prioridade}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCor[solicitacao.status]}`}>{solicitacao.status}</span>
        </div>
      </div>
      <p className="text-xs text-neutral-600">{solicitacao.solicitacao}</p>
      {solicitacao.prazo && <p className="text-[10px] text-neutral-400">Prazo: {new Date(solicitacao.prazo).toLocaleString('pt-BR')}</p>}

      {solicitacao.resposta ? (
        <div className="mt-2 p-3 rounded-xl bg-white border border-emerald-200 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {solicitacao.resposta.responsavel} respondeu
          </div>
          <p className="text-xs text-neutral-700">{solicitacao.resposta.parecer}</p>
          {solicitacao.resposta.descricaoTecnica && <p className="text-[11px] text-neutral-500">{solicitacao.resposta.descricaoTecnica}</p>}
          <p className="text-[10px] text-neutral-400">{new Date(solicitacao.resposta.data).toLocaleString('pt-BR')}</p>
        </div>
      ) : respondendo ? (
        <form
          className="mt-2 p-3 rounded-xl bg-white border border-neutral-200 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!parecer.trim() || !responsavel.trim()) return;
            onResponder({ parecer: parecer.trim(), responsavel: responsavel.trim() });
            setRespondendo(false);
          }}
        >
          <input required placeholder="Seu nome" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inputCls} />
          <textarea required rows={2} placeholder="Parecer..." value={parecer} onChange={(e) => setParecer(e.target.value)} className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRespondendo(false)} className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 font-bold text-[11px]">Cancelar</button>
            <button type="submit" disabled={disabled} className="px-3 py-1.5 rounded-full bg-yellow-400 text-black font-bold text-[11px] disabled:opacity-50">Enviar resposta</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setRespondendo(true)} className="text-[11px] font-bold text-yellow-600 hover:underline">Responder</button>
      )}
    </div>
  );
};

// ---- Aba Produtos ----
const AbaProdutos: React.FC<{ atendimento: SacAtendimento }> = ({ atendimento }) => (
  <div className={cardCls}>
    <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Produtos Envolvidos</h3>
    {atendimento.produtos.length === 0 ? (
      <p className="text-xs text-neutral-500 py-6 text-center">Nenhum produto vinculado a este atendimento.</p>
    ) : (
      <div className="space-y-3">
        {atendimento.produtos.map((p) => (
          <div key={p.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
            <CampoLinha label="Produto" valor={p.produto} />
            <CampoLinha label="Código" valor={p.codigo} />
            <CampoLinha label="Lote" valor={p.lote} />
            <CampoLinha label="Corrida" valor={p.corrida} />
            <CampoLinha label="Bitola" valor={p.bitola} />
            <CampoLinha label="Espessura" valor={p.espessura} />
            <CampoLinha label="Qtd. Vendida" valor={p.quantidadeVendida} />
            <CampoLinha label="Qtd. Reclamada" valor={p.quantidadeReclamada} />
            <CampoLinha label="Certificado" valor={p.certificado ? (p.numeroCertificado || 'Sim') : 'Não'} />
          </div>
        ))}
      </div>
    )}
  </div>
);

// ---- Aba Anexos ----
const AbaAnexos: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onEnviar: (form: FormData) => void }> = ({ atendimento, disabled, onEnviar }) => {
  const [descricao, setDescricao] = useState('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('descricao', descricao);
    onEnviar(form);
    setDescricao('');
    e.target.value = '';
  }

  return (
    <div className={cardCls}>
      <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Anexos</h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <input placeholder="Descrição do anexo (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={`${inputCls} flex-1`} />
        <label className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-neutral-200 bg-white text-[11px] font-bold text-neutral-600 hover:border-yellow-400 hover:text-yellow-600 cursor-pointer transition-all ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <Paperclip className="w-3.5 h-3.5" />
          Anexar arquivo
          <input type="file" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {atendimento.anexos.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">Nenhum anexo enviado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {atendimento.anexos.map((anexo) => (
            <a key={anexo.id} href={anexo.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200 hover:border-yellow-400 transition-all">
              <Download className="w-4 h-4 text-neutral-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-neutral-800 block truncate">{anexo.nome}</span>
                <span className="text-[10px] text-neutral-400 block">{anexo.enviadoPor} · {new Date(anexo.criadoEm).toLocaleDateString('pt-BR')}</span>
                {anexo.descricao && <span className="text-[10px] text-neutral-500 block">{anexo.descricao}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Aba Solução ----
const AbaSolucao: React.FC<{
  atendimento: SacAtendimento;
  disabled: boolean;
  onDefinirSolucao: (dados: Record<string, unknown>) => void;
  onAprovacao: (aprovado: boolean, aprovador: string) => void;
  onAbrirNC: (dados: Record<string, unknown>) => void;
  onAtualizarNC: (patch: Record<string, unknown>) => void;
  onDefinirProcedencia: (dados: Record<string, unknown>) => void;
  onEncerrar: (dados: Record<string, unknown>) => void;
}> = ({ atendimento, disabled, onDefinirSolucao, onAprovacao, onAbrirNC, onAtualizarNC, onDefinirProcedencia, onEncerrar }) => {
  return (
    <div className="space-y-5">
      <SecaoProcedencia atendimento={atendimento} disabled={disabled} onDefinir={onDefinirProcedencia} />
      <SecaoSolucao atendimento={atendimento} disabled={disabled} onDefinir={onDefinirSolucao} onAprovacao={onAprovacao} />
      {atendimento.tipo === 'Reclamação de qualidade' && <SecaoNaoConformidade atendimento={atendimento} disabled={disabled} onAbrir={onAbrirNC} onAtualizar={onAtualizarNC} />}
      {!statusEhEncerrado(atendimento.status) && <SecaoEncerramento atendimento={atendimento} disabled={disabled} onEncerrar={onEncerrar} />}
    </div>
  );
};

const SecaoProcedencia: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onDefinir: (dados: Record<string, unknown>) => void }> = ({ atendimento, disabled, onDefinir }) => {
  const [editando, setEditando] = useState(false);
  const [procedencia, setProcedencia] = useState<string>(SAC_PROCEDENCIAS[1]);
  const [motivo, setMotivo] = useState('');
  const [responsavel, setResponsavel] = useState('');

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Procedência da Reclamação</h3>
        {!editando && <button type="button" onClick={() => setEditando(true)} className="text-[11px] font-bold text-yellow-600 hover:underline">{atendimento.procedencia === 'Não analisado' ? 'Analisar' : 'Reanalisar'}</button>}
      </div>
      {!editando ? (
        <>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SAC_PROCEDENCIA_BADGE[atendimento.procedencia]}`}>{atendimento.procedencia}</span>
          {atendimento.procedenciaMotivo && <p className="text-xs text-neutral-600">{atendimento.procedenciaMotivo}</p>}
          {atendimento.procedenciaResponsavel && <p className="text-[10px] text-neutral-400">Analisado por {atendimento.procedenciaResponsavel}{atendimento.procedenciaData && ` em ${new Date(atendimento.procedenciaData).toLocaleDateString('pt-BR')}`}</p>}
        </>
      ) : (
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!responsavel.trim()) return;
            onDefinir({ procedencia, motivo: motivo.trim() || undefined, responsavel: responsavel.trim() });
            setEditando(false);
          }}
        >
          <select className={inputCls} value={procedencia} onChange={(e) => setProcedencia(e.target.value)}>
            {SAC_PROCEDENCIAS.filter((p) => p !== 'Não analisado').map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <textarea rows={2} placeholder="Motivo da decisão" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
          <input required placeholder="Responsável pela análise" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inputCls} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 font-bold text-xs">Cancelar</button>
            <button type="submit" disabled={disabled} className="px-4 py-2 rounded-full bg-yellow-400 text-black font-bold text-xs disabled:opacity-50">Salvar</button>
          </div>
        </form>
      )}
    </div>
  );
};

const SecaoSolucao: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onDefinir: (dados: Record<string, unknown>) => void; onAprovacao: (aprovado: boolean, aprovador: string) => void }> = ({ atendimento, disabled, onDefinir, onAprovacao }) => {
  const [tipo, setTipo] = useState(SAC_TIPOS_SOLUCAO[0]);
  const [descricao, setDescricao] = useState('');
  const [quantidadeEnvolvida, setQuantidadeEnvolvida] = useState('');
  const [valorFinanceiro, setValorFinanceiro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [aprovador, setAprovador] = useState('');

  const necessitaAprovacaoSugerido = (SAC_TIPOS_SOLUCAO_SENSIVEIS as string[]).includes(tipo);

  if (!atendimento.solucao) {
    return (
      <div className={cardCls}>
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Solução</h3>
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!descricao.trim()) return;
            onDefinir({
              tipo,
              descricao: descricao.trim(),
              quantidadeEnvolvida: quantidadeEnvolvida.trim() || undefined,
              valorFinanceiro: valorFinanceiro ? Number(valorFinanceiro) : undefined,
              necessitaAprovacao: necessitaAprovacaoSugerido,
              observacoes: observacoes.trim() || undefined,
            });
          }}
        >
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            {SAC_TIPOS_SOLUCAO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea required rows={3} placeholder="Descreva a solução proposta..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Quantidade envolvida" value={quantidadeEnvolvida} onChange={(e) => setQuantidadeEnvolvida(e.target.value)} className={inputCls} />
            <input type="number" step="0.01" placeholder="Valor financeiro (R$)" value={valorFinanceiro} onChange={(e) => setValorFinanceiro(e.target.value)} className={inputCls} />
          </div>
          <textarea rows={2} placeholder="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
          {necessitaAprovacaoSugerido && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">Esse tipo de solução envolve valor — vai ficar aguardando aprovação antes de poder encerrar o atendimento.</p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={disabled} className="px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs disabled:opacity-50">Definir Solução</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Solução</h3>
      <CampoLinha label="Tipo" valor={atendimento.solucao.tipo} />
      <CampoLinha label="Descrição" valor={atendimento.solucao.descricao} />
      {atendimento.solucao.quantidadeEnvolvida && <CampoLinha label="Quantidade" valor={atendimento.solucao.quantidadeEnvolvida} />}
      {typeof atendimento.solucao.valorFinanceiro === 'number' && <CampoLinha label="Valor" valor={atendimento.solucao.valorFinanceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />}
      <CampoLinha label="Definido por" valor={`${atendimento.solucao.definidoPor} em ${new Date(atendimento.solucao.definidoEm).toLocaleDateString('pt-BR')}`} />

      {atendimento.solucao.necessitaAprovacao && (
        <div className="pt-2 border-t border-neutral-100">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            atendimento.solucao.statusAprovacao === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : atendimento.solucao.statusAprovacao === 'Reprovado' ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {atendimento.solucao.statusAprovacao}
          </span>
          {atendimento.solucao.aprovador && <p className="text-[10px] text-neutral-400 mt-1">Por {atendimento.solucao.aprovador} em {atendimento.solucao.dataAprovacao && new Date(atendimento.solucao.dataAprovacao).toLocaleDateString('pt-BR')}</p>}
          {atendimento.solucao.statusAprovacao === 'Aguardando aprovação' && (
            <form
              className="flex items-center gap-2 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!aprovador.trim()) return;
                onAprovacao(true, aprovador.trim());
              }}
            >
              <input required placeholder="Nome do aprovador" value={aprovador} onChange={(e) => setAprovador(e.target.value)} className={`${inputCls} flex-1`} />
              <button type="submit" disabled={disabled} className="flex items-center gap-1 px-3 py-2 rounded-full bg-emerald-500 text-white font-bold text-[11px] disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
              </button>
              <button type="button" disabled={disabled || !aprovador.trim()} onClick={() => onAprovacao(false, aprovador.trim())} className="flex items-center gap-1 px-3 py-2 rounded-full bg-red-500 text-white font-bold text-[11px] disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" /> Reprovar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

const SecaoNaoConformidade: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onAbrir: (dados: Record<string, unknown>) => void; onAtualizar: (patch: Record<string, unknown>) => void }> = ({ atendimento, disabled, onAbrir, onAtualizar }) => {
  const [abrindo, setAbrindo] = useState(false);
  const [departamentoResponsavel, setDepartamentoResponsavel] = useState(SAC_DEPARTAMENTOS[0]);
  const [descricao, setDescricao] = useState('');

  if (!atendimento.naoConformidade) {
    return (
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Não Conformidade</h3>
          {!abrindo && (
            <button type="button" onClick={() => setAbrindo(true)} className="text-[11px] font-bold text-yellow-600 hover:underline">Abrir Não Conformidade</button>
          )}
        </div>
        {abrindo && (
          <form
            className="space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!descricao.trim()) return;
              onAbrir({ departamentoResponsavel, descricao: descricao.trim() });
              setAbrindo(false);
            }}
          >
            <select className={inputCls} value={departamentoResponsavel} onChange={(e) => setDepartamentoResponsavel(e.target.value as any)}>
              {SAC_DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <textarea required rows={3} placeholder="Descrição da não conformidade..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbrindo(false)} className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 font-bold text-xs">Cancelar</button>
              <button type="submit" disabled={disabled} className="px-4 py-2 rounded-full bg-yellow-400 text-black font-bold text-xs disabled:opacity-50">Abrir NC</button>
            </div>
          </form>
        )}
      </div>
    );
  }

  const nc = atendimento.naoConformidade;
  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Não Conformidade {nc.numero}</h3>
        <select
          className="px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] font-bold text-neutral-700"
          value={nc.status}
          disabled={disabled}
          onChange={(e) => onAtualizar({ status: e.target.value })}
        >
          {['Aberta', 'Em andamento', 'Concluída'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <CampoLinha label="Departamento" valor={nc.departamentoResponsavel} />
      <CampoLinha label="Descrição" valor={nc.descricao} />
      <CampoLinha label="Causa" valor={nc.causa} />
      <CampoLinha label="Ação Corretiva" valor={nc.acaoCorretiva} />
      <EdicaoNCInline nc={nc} disabled={disabled} onAtualizar={onAtualizar} />
    </div>
  );
};

const EdicaoNCInline: React.FC<{ nc: NonNullable<SacAtendimento['naoConformidade']>; disabled: boolean; onAtualizar: (patch: Record<string, unknown>) => void }> = ({ nc, disabled, onAtualizar }) => {
  const [causa, setCausa] = useState(nc.causa || '');
  const [acaoCorretiva, setAcaoCorretiva] = useState(nc.acaoCorretiva || '');

  return (
    <form
      className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-100"
      onSubmit={(e) => {
        e.preventDefault();
        onAtualizar({ causa: causa.trim() || undefined, acaoCorretiva: acaoCorretiva.trim() || undefined });
      }}
    >
      <input placeholder="Causa" value={causa} onChange={(e) => setCausa(e.target.value)} className={`${inputCls} flex-1`} />
      <input placeholder="Ação corretiva" value={acaoCorretiva} onChange={(e) => setAcaoCorretiva(e.target.value)} className={`${inputCls} flex-1`} />
      <button type="submit" disabled={disabled} className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-700 font-bold text-[11px] disabled:opacity-50 shrink-0">Salvar</button>
    </form>
  );
};

const SecaoEncerramento: React.FC<{ atendimento: SacAtendimento; disabled: boolean; onEncerrar: (dados: Record<string, unknown>) => void }> = ({ atendimento, disabled, onEncerrar }) => {
  const [resultado, setResultado] = useState<'Resolvido' | 'Improcedente'>('Resolvido');
  const [observacaoFinal, setObservacaoFinal] = useState('');
  const [clienteComunicado, setClienteComunicado] = useState(false);
  const [canal, setCanal] = useState(SAC_CANAIS[0]);
  const [confirmou, setConfirmou] = useState<'Sim' | 'Não' | 'Não aplicável'>('Não aplicável');

  const pendencias = atendimento.solicitacoesInternas.filter((s) => s.status === 'Pendente' || s.status === 'Em análise');
  const aguardandoAprovacao = atendimento.solucao?.necessitaAprovacao && atendimento.solucao.statusAprovacao === 'Aguardando aprovação';

  return (
    <div className={cardCls}>
      <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Encerramento</h3>

      {pendencias.length > 0 && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5">
          {pendencias.length} solicitação(ões) interna(s) ainda pendente(s) — responda na aba Análise Interna antes de encerrar.
        </p>
      )}
      {aguardandoAprovacao && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5">A solução proposta ainda aguarda aprovação.</p>
      )}

      <form
        className="space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          onEncerrar({
            resultado,
            observacaoFinal: observacaoFinal.trim() || undefined,
            clienteComunicado,
            canalComunicacaoEncerramento: clienteComunicado ? canal : undefined,
            clienteConfirmouSolucao: confirmou,
          });
        }}
      >
        <div className="flex gap-2">
          {(['Resolvido', 'Improcedente'] as const).map((r) => (
            <button key={r} type="button" onClick={() => setResultado(r)} className={`flex-1 py-2 rounded-full border font-bold text-xs transition-all ${resultado === r ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white text-neutral-500 border-neutral-200'}`}>{r}</button>
          ))}
        </div>
        <textarea rows={2} placeholder="Observação final" value={observacaoFinal} onChange={(e) => setObservacaoFinal(e.target.value)} className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs focus:outline-none focus:border-yellow-400" />
        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
          <input type="checkbox" checked={clienteComunicado} onChange={(e) => setClienteComunicado(e.target.checked)} className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400" />
          Cliente foi comunicado?
        </label>
        {clienteComunicado && (
          <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value as any)}>
            {SAC_CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div>
          <label className={labelCls}>Cliente confirmou a solução?</label>
          <div className="flex gap-2">
            {(['Sim', 'Não', 'Não aplicável'] as const).map((op) => (
              <button key={op} type="button" onClick={() => setConfirmou(op)} className={`flex-1 py-2 rounded-full border font-bold text-[11px] transition-all ${confirmou === op ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white text-neutral-500 border-neutral-200'}`}>{op}</button>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-neutral-100">
          <button type="submit" disabled={disabled} className="px-5 py-2.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs disabled:opacity-50">Encerrar Atendimento</button>
        </div>
      </form>
    </div>
  );
};

// ---- Aba Histórico ----
const AbaHistorico: React.FC<{ atendimento: SacAtendimento }> = ({ atendimento }) => {
  const ordenado = [...atendimento.historico].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <div className={cardCls}>
      <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">Histórico</h3>
      {ordenado.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">Sem eventos registrados.</p>
      ) : (
        <div className="space-y-2.5">
          {ordenado.map((h) => (
            <div key={h.id} className="flex gap-3">
              <Clock className="w-3.5 h-3.5 text-neutral-300 mt-0.5 shrink-0" />
              <div className="flex-1 pb-2.5 border-b border-neutral-50 last:border-0">
                <p className="text-xs text-neutral-700">{h.acao}</p>
                <span className="text-[10px] text-neutral-400 font-mono">{new Date(h.data).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
