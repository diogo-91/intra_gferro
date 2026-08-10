import React, { useState } from 'react';
import { Documento } from '../types';
import { 
  FileText, 
  Search, 
  Download, 
  ShieldCheck, 
  FileSpreadsheet, 
  FileType, 
  CheckCircle2, 
  HardHat, 
  Tag, 
  Folder, 
  ExternalLink 
} from 'lucide-react';

interface DocumentosHubProps {
  documentos: Documento[];
}

export const DocumentosHub: React.FC<DocumentosHubProps> = ({ documentos }) => {
  const [selectedCat, setSelectedCat] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    'Todos',
    'Normas de Segurança',
    'Recursos Humanos',
    'Qualidade & ISO',
    'TI & Sistemas',
    'Formulários',
  ];

  const filtered = documentos.filter((doc) => {
    const matchesCat = selectedCat === 'Todos' || doc.category === selectedCat;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.requiredFor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-600" />;
      case 'DOCX':
        return <FileType className="w-5 h-5 text-sky-600" />;
      case 'XLSX':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      default:
        return <Folder className="w-5 h-5 text-amber-400" />;
    }
  };

  const handleDownload = (doc: Documento) => {
    alert(`Fazendo download oficial de "${doc.title}" (${doc.fileType} - ${doc.fileSize}).\nRastreabilidade ISO reg: GF-DOC-${doc.id}`);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 flex items-center gap-2 tracking-tight">
            <FileText className="w-6 h-6 text-yellow-600" />
            <span>Documentos, NRs & Formulários</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Repositório centralizado de normas regulamentadoras, código de conduta, manuais ISO e formulários de RH.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-full text-yellow-700 text-xs font-extrabold shrink-0">
          <ShieldCheck className="w-4 h-4 text-yellow-600" />
          <span>ISO 9001:2015 Certificado</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                  : 'bg-white text-neutral-500 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, norma ou nome..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-all"
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className="p-6 rounded-[2rem] bg-white border border-neutral-200 hover:border-yellow-400/60 transition-all flex flex-col justify-between space-y-4 shadow-sm group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 shrink-0 group-hover:scale-105 transition-transform">
                  {getFileIcon(doc.fileType)}
                </div>
                <span className="px-2.5 py-1 rounded-full bg-neutral-50 text-neutral-500 text-[10px] font-mono font-bold border border-neutral-100">
                  {doc.version}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase text-yellow-600 tracking-widest">
                  {doc.category}
                </span>
                <h3 className="text-base font-bold text-neutral-900 group-hover:text-yellow-600 transition-colors leading-snug mt-1">
                  {doc.title}
                </h3>
                <p className="text-xs text-neutral-500 mt-2 leading-relaxed line-clamp-2">
                  {doc.description}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-neutral-200">
              <div className="text-[11px] text-neutral-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Público-alvo:</span>
                  <strong className="text-neutral-800 font-semibold">{doc.requiredFor}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Atualizado em:</span>
                  <span className="font-mono text-neutral-500">{doc.updatedAt}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-neutral-500 font-mono">
                  {doc.fileType} • {doc.fileSize} • {doc.downloads} downloads
                </span>

                <button
                  onClick={() => handleDownload(doc)}
                  className="px-4 py-2 rounded-full bg-yellow-400 text-black font-extrabold text-xs hover:bg-yellow-300 flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
