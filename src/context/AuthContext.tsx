// ============================================================
// KBS Staff App — Auth Context
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { AuthState, User } from "../types";
import { setAuthToken } from "../utils/api";
import { MOCK_USERS, DEMO_CREDENTIALS } from "../utils/mockData";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Simple in-memory token store (replace with AsyncStorage in production)
let _token: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const restored = _token;
    if (restored) {
      setAuthToken(restored);
      setToken(restored);
      // In production: call authGetMe() to re-hydrate user
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // ─── DEMO MODE ──────────────────────────────────────────
      // In production, replace this block with the real API call:
      //   const res = await authLogin({ email, password });
      //   const { token, user } = res.data;
      // ─────────────────────────────────────────────────────────

      await new Promise((r) => setTimeout(r, 900)); // simulate network

      const cred = DEMO_CREDENTIALS[email.toLowerCase().trim()];
      if (!cred || cred.password !== password) {
        throw new Error("Email hoặc mật khẩu không đúng.");
      }

      const foundUser = MOCK_USERS.find((u) => u.id === cred.userId);
      if (!foundUser) throw new Error("Không tìm thấy tài khoản.");

      const fakeToken = `kbs_demo_token_${Date.now()}`;
      _token = fakeToken;
      setAuthToken(fakeToken);
      setToken(fakeToken);
      setUser({ ...foundUser, avatarUrl: foundUser.avatarUrl });
    } catch (e: any) {
      setError(e.message || "Đăng nhập thất bại. Vui lòng thử lại.");
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    _token = null;
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        error,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
