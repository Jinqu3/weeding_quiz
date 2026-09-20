import React, { useState } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  HardDrive,
  Server,
  Lock,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  FileCode,
  LogOut,
  Sparkles
} from 'lucide-react';
import { AuthStatus } from '../types';
import { setAdminPassword, removeAdminPassword } from '../services/auth';

interface SecurityModalProps {
  isOpen?: boolean;
  onClose: () => void;
  authStatus: AuthStatus;
  onAuthStatusChange: (newStatus: AuthStatus) => void;
  onLogout?: () => void;
}

export function SecurityModal({
  isOpen = true,
  onClose,
  authStatus,
  onAuthStatusChange,
  onLogout
}: SecurityModalProps) {
  const [activeTab, setActiveTab] = useState<'password' | 'volume' | 'nginx'>('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setStatusMessage({ text: 'Пароль должен содержать минимум 4 символа', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ text: 'Введенные пароли не совпадают', isError: true });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await setAdminPassword(newPassword);
    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ text: '✅ Пароль успешно установлен и сохранён в volume (data/auth.json)!' });
      setNewPassword('');
      setConfirmPassword('');
      onAuthStatusChange({ ...authStatus, isProtected: true, isAuthenticated: true });
    } else {
      setStatusMessage({ text: res.error || 'Ошибка установки пароля', isError: true });
    }
  };

  const handleRemovePassword = async () => {
    if (!confirm('Вы уверены, что хотите отключить защиту паролем? Сайт снова станет общедоступным.')) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await removeAdminPassword();
    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ text: 'Защита паролем отключена. Сайт открыт для свободного доступа.' });
      onAuthStatusChange({ ...authStatus, isProtected: false, isAuthenticated: true });
    } else {
      setStatusMessage({ text: res.error || 'Не удалось отключить пароль', isError: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Безопасность & Постоянный Volume БД</span>
                {authStatus.isProtected ? (
                  <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Защищено
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    Свободный доступ
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-300">
                Защита сайта от посторонних и гарантия сохранности базы данных SQLite
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'password'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Пароль сайта (Admin)
          </button>

          <button
            onClick={() => setActiveTab('volume')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'volume'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Docker Volume (БД без потерь)
          </button>

          <button
            onClick={() => setActiveTab('nginx')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'nginx'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Nginx & Закрытие портов
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-slate-700">
          {/* TAB 1: ПАРОЛЬ АДМИНИСТРАТОРА */}
          {activeTab === 'password' && (
            <div className="space-y-4">
              {/* Current state card */}
              <div className="p-3.5 rounded-xl border flex items-start justify-between gap-3 bg-slate-50 border-slate-200">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Текущий статус</span>
                  <div className="flex items-center gap-2">
                    {authStatus.isProtected ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Сайт защищен паролем администратора
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Сайт открыт для всех пользователей сети
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    {authStatus.hasEnvPassword ? (
                      <>Задан через переменную <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">ADMIN_PASSWORD</code> в файле <code className="font-mono">.env</code>.</>
                    ) : authStatus.isProtected ? (
                      <>Сохранен в зашифрованном виде в постоянном томе <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">data/auth.json</code>.</>
                    ) : (
                      <>Любой человек, знающий URL вашего сервера, может просматривать и удалять вопросы.</>
                    )}
                  </p>
                </div>

                {authStatus.isAuthenticated && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 text-slate-600 hover:text-rose-600 border border-slate-300 hover:border-rose-300 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Выйти из сессии
                  </button>
                )}
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    statusMessage.isError
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Set/Change password form */}
              {authStatus.hasEnvPassword ? (
                <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>Пароль управляется через .env</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">
                    Чтобы изменить или отключить пароль, отредактируйте файл <code className="bg-white px-1 py-0.5 rounded border border-amber-300 font-mono font-bold">.env</code> на сервере:
                  </p>
                  <div className="bg-slate-900 text-emerald-300 p-2.5 rounded-lg font-mono flex items-center justify-between text-[11px]">
                    <span>ADMIN_PASSWORD="новый_секретный_пароль"</span>
                    <button
                      onClick={() => copyText('ADMIN_PASSWORD="новый_секретный_пароль"', 'env_pass')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 'env_pass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSavePassword} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="font-bold text-slate-900">
                    {authStatus.isProtected ? 'Сменить пароль администратора' : 'Установить пароль администратора'}
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    После установки пароля сайт будет требовать ввод пароля при первом входе. Все изменения вопросов будут защищены.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Новый пароль
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Минимум 4 символа"
                          className="w-full pr-8 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Повторите пароль
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Повтор пароля"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newPassword}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {authStatus.isProtected ? 'Обновить пароль' : 'Включить защиту паролем'}
                    </button>

                    {authStatus.isProtected && (
                      <button
                        type="button"
                        onClick={handleRemovePassword}
                        disabled={isSubmitting}
                        className="text-rose-600 hover:text-rose-700 text-xs font-semibold underline hover:no-underline"
                      >
                        Отключить защиту паролем
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: DOCKER VOLUME (ПОСТОЯННАЯ БД) */}
          {activeTab === 'volume' && (
            <div className="space-y-3.5">
              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl text-sky-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-900">
                  <HardDrive className="w-4 h-4 text-sky-700" />
                  <span>Почему база данных пересоздавалась и как это решено:</span>
                </div>
                <p className="text-[11px] text-sky-900 leading-relaxed">
                  По умолчанию в Docker без постоянного тома (Volume) всё содержимое контейнера очищается при удалении контейнера (<code className="bg-sky-100 px-1 py-0.5 rounded font-mono">docker compose down</code> или при новой сборке <code className="font-mono">docker compose build</code>).
                </p>
                <p className="text-[11px] text-sky-900 leading-relaxed">
                  Мы настроили <b>именованный том Docker (Named Volume)</b> <code className="bg-sky-200 font-bold px-1.5 py-0.5 rounded text-sky-950">quiz_data:/app/data</code>. Он хранится на хост-сервере независимо от контейнеров и переживает любые перезапуски, обновления кода и перезагрузки сервера!
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-1.5">1. Конфигурация в docker-compose.yml:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] space-y-1 relative">
                  <button
                    onClick={() =>
                      copyText(
                        `services:\n  web:\n    volumes:\n      - quiz_data:/app/data\n  bot:\n    volumes:\n      - quiz_data:/app/data\n\nvolumes:\n  quiz_data:\n    driver: local`,
                        'dc_vol'
                      )
                    }
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'dc_vol' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <p className="text-emerald-400"># Оба контейнера делят один постоянный том:</p>
                  <p>services:</p>
                  <p className="pl-2">web:</p>
                  <p className="pl-4">volumes:</p>
                  <p className="pl-6 text-amber-300">- quiz_data:/app/data</p>
                  <p className="pl-2">bot:</p>
                  <p className="pl-4">volumes:</p>
                  <p className="pl-6 text-amber-300">- quiz_data:/app/data</p>
                  <p className="text-emerald-400 mt-2"># Декларация тома на уровне Docker:</p>
                  <p>volumes:</p>
                  <p className="pl-2">quiz_data:</p>
                  <p className="pl-4">driver: local</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-1.5">2. Как создать резервную копию базы SQLite (бэкап) на хост:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <span className="text-sky-300">docker cp quiz_web_ui:/app/data/quiz.db ./backup_quiz.db</span>
                  <button
                    onClick={() => copyText('docker cp quiz_web_ui:/app/data/quiz.db ./backup_quiz.db', 'backup_cmd')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'backup_cmd' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-1.5">3. Как восстановить базу из бэкапа:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <span className="text-emerald-300">docker cp ./backup_quiz.db quiz_web_ui:/app/data/quiz.db</span>
                  <button
                    onClick={() => copyText('docker cp ./backup_quiz.db quiz_web_ui:/app/data/quiz.db', 'restore_cmd')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'restore_cmd' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-[11px]">
                ⚠️ <b>Важное предостережение:</b> никогда не выполняйте команду <code className="bg-white px-1 rounded font-bold font-mono">docker compose down -v</code> с флагом <b>-v</b>, так как этот флаг преднамеренно стирает все тома! Используйте обычный <code className="bg-white px-1 rounded font-bold font-mono">docker compose down</code>.
              </div>
            </div>
          )}

          {/* TAB 3: NGINX & ЗАКРЫТИЕ ПОРТОВ */}
          {activeTab === 'nginx' && (
            <div className="space-y-3.5">
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-indigo-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-indigo-900">
                  <Server className="w-4 h-4 text-indigo-700" />
                  <span>Профессиональная трехуровневая защита сайта на сервере:</span>
                </div>
                <p className="text-[11px] text-indigo-900 leading-relaxed">
                  Если вы разворачиваете викторину на публичном VPS (Ubuntu, Debian), защитите сайт связкой <b>изоляция порта + Nginx Basic Auth</b> или через <b>Cloudflare Access</b>.
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-1">Шаг 1: Привязка порта только к localhost (127.0.0.1)</p>
                <p className="text-slate-500 text-[11px] mb-1.5">
                  В файле <code className="font-mono">docker-compose.yml</code> замените порт <code className="font-mono">"3000:3000"</code> на:
                </p>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <span className="text-amber-300">ports: ["127.0.0.1:3000:3000"]</span>
                  <button
                    onClick={() => copyText('ports:\n  - "127.0.0.1:3000:3000"', 'bind_local')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'bind_local' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Теперь никто из интернета не сможет напрямую достучаться до порта 3000. Вход будет только через Nginx или SSH туннель.
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-1">Шаг 2: Конфигурация Nginx с HTTP Basic Auth</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[10px] leading-relaxed relative">
                  <button
                    onClick={() =>
                      copyText(
                        `server {\n    listen 80;\n    server_name quiz.yourdomain.com;\n\n    # HTTP Basic Auth (всплывающее окно логина браузера)\n    auth_basic "Админ-панель Викторины";\n    auth_basic_user_file /etc/nginx/.htpasswd;\n\n    location / {\n        proxy_pass http://127.0.0.1:3000;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n}`,
                        'nginx_conf'
                      )
                    }
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'nginx_conf' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <p className="text-slate-400"># Создание файла с логином и паролем на сервере:</p>
                  <p className="text-emerald-400">sudo apt install apache2-utils</p>
                  <p className="text-emerald-400">sudo htpasswd -c /etc/nginx/.htpasswd admin</p>
                  <p className="text-slate-400 mt-2"># Конфиг Nginx (/etc/nginx/sites-available/quiz):</p>
                  <p>location / &#123;</p>
                  <p className="pl-4 text-amber-300">auth_basic "Закрытая зона Викторины";</p>
                  <p className="pl-4 text-amber-300">auth_basic_user_file /etc/nginx/.htpasswd;</p>
                  <p className="pl-4">proxy_pass http://127.0.0.1:3000;</p>
                  <p>&#125;</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-1">Шаг 3: Альтернатива — Cloudflare Zero Trust (Access)</p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Бесплатный сервис Cloudflare: позволяет привязать сайт к авторизации через одноразовый PIN-код на ваш Email или через Google аккаунт. Порты на сервере вообще не нужно открывать наружу (через Cloudflare Tunnel <code className="font-mono">cloudflared</code>).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Все настройки сохраняются в томе <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">/app/data</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
