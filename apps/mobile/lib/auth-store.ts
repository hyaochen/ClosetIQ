import { create } from 'zustand';
import { authApi, tokenStorage } from './api';

interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await authApi<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login', { email, password });

    await tokenStorage.set('accessToken', data.accessToken);
    await tokenStorage.set('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (email, password, displayName) => {
    const data = await authApi<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register', { email, password, displayName });

    await tokenStorage.set('accessToken', data.accessToken);
    await tokenStorage.set('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    await tokenStorage.remove('accessToken');
    await tokenStorage.remove('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const token = await tokenStorage.get('accessToken');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthenticated: true, isLoading: false });
      } else {
        // Token expired, try refresh
        const refreshToken = await tokenStorage.get('refreshToken');
        if (refreshToken) {
          const refreshRes = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            }
          );

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            await tokenStorage.set('accessToken', refreshData.accessToken);
            await tokenStorage.set('refreshToken', refreshData.refreshToken);

            // Retry /me
            const meRes = await fetch(
              `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`,
              { headers: { Authorization: `Bearer ${refreshData.accessToken}` } }
            );
            if (meRes.ok) {
              const meData = await meRes.json();
              set({ user: meData.user, isAuthenticated: true, isLoading: false });
              return;
            }
          }
        }

        await tokenStorage.remove('accessToken');
        await tokenStorage.remove('refreshToken');
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
