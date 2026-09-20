import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { loginAdmin } from '../services/auth';

interface AdminLockScreenProps {
  onLoginSuccess: () => void;
  hasEnvPassword?: boolean;
}

export function AdminLockScreen({ onLoginSuccess, hasEnvPassword }: AdminLockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Введите пароль администратора');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await loginAdmin(password, remember);
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Неверный пароль');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 backdrop-blur-md">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-sky-500 p-0.5 shadow-lg shadow-indigo-900/50 mb-4">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-2">
            <span>🛡️</span>
            <span>Защита доступа активна</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Вход в Панель Крупье
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Сайт защищен от произвольного доступа. Управление вопросами и викториной доступно только ведущему.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-700/60 rounded-xl flex items-start gap-2.5 text-rose-200 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                Проверьте правильность пароля или переменную <code className="bg-rose-900/80 px-1 py-0.5 rounded text-white font-mono">ADMIN_PASSWORD</code> в файле <code className="font-mono">.env</code>
              </p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Пароль администратора
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите секретный пароль..."
                autoFocus
                className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span>Запомнить сессию на этом устройстве</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Войти в студию</span>
              </>
            )}
          </button>
        </form>

        {/* Info / Hint box */}
        <div className="mt-6 pt-5 border-t border-slate-700/60 text-[11px] text-slate-400 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              {hasEnvPassword ? (
                <>Пароль задан в файле <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-indigo-300">.env</code> переменной <code className="text-amber-300 font-mono">ADMIN_PASSWORD</code>.</>
              ) : (
                <>Пароль хранится в защищенном Docker-томе <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-indigo-300">/app/data</code> вместе с базой SQLite.</>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              Telegram-бот в фоне продолжает работать в чате автоматически через локальную SQLite БД.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500">
        Telegram Quiz Bot Studio • Защита от произвольного доступа
      </div>
    </div>
  );
}
