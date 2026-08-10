import React, { useState } from 'react';
import { Lock, Mail, AlertTriangle, LogIn } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao entrar');
      onLoginSuccess();
    } catch (err: any) {
      setErro(err.message || 'Falha ao entrar');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center font-black text-black text-2xl shadow-lg shadow-yellow-400/20">
            GF
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="font-extrabold text-2xl tracking-tighter text-white">GFERRO</span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                Intranet
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">Soluções em Aço &amp; Siderurgia</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111111] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
          <div>
            <label htmlFor="login-email" className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@gferro.com.br"
                className="w-full bg-neutral-900 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white placeholder-neutral-600 focus:border-yellow-400 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-900 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white placeholder-neutral-600 focus:border-yellow-400 focus:outline-none transition-all"
              />
            </div>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-yellow-400 text-black font-extrabold text-sm hover:bg-yellow-300 shadow-lg shadow-yellow-400/20 active:scale-95 disabled:opacity-50 transition-all"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
