import { AuthStatus } from '../types';

const TOKEN_KEY = 'telegram_quiz_admin_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, persist: boolean = true) {
  try {
    if (persist) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch('/api/auth/status', {
      headers: {
        ...getAuthHeader()
      }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Auth status check failed:', err);
  }
  return { isProtected: false, isAuthenticated: true, hasEnvPassword: false };
}

export async function loginAdmin(password: string, remember: boolean = true): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setAuthToken(data.token, remember);
      return { success: true };
    }
    return { success: false, error: data.error || 'Неверный пароль' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Ошибка соединения с сервером' };
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        ...getAuthHeader()
      }
    });
  } catch {
    // ignore
  } finally {
    clearAuthToken();
  }
}

export async function setAdminPassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setAuthToken(data.token, true);
      return { success: true };
    }
    return { success: false, error: data.error || 'Не удалось установить пароль' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Ошибка сети' };
  }
}

export async function removeAdminPassword(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/remove-password', {
      method: 'POST',
      headers: {
        ...getAuthHeader()
      }
    });
    const data = await res.json();
    if (res.ok) {
      clearAuthToken();
      return { success: true };
    }
    return { success: false, error: data.error || 'Не удалось отключить пароль' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Ошибка сети' };
  }
}
