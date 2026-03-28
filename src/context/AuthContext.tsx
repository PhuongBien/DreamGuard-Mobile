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
import { loginService } from "../services/auth.service";
interface AuthContextType extends AuthState {
  login: (phoneNumber: string, password: string) => Promise<void>;
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
  // const [isLoading, setIsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  // useEffect(() => {
  //   const restored = _token;
  //   if (restored) {
  //     setAuthToken(restored);
  //     setToken(restored);
  //     // In production: call authGetMe() to re-hydrate user
  //   }
  //   setIsLoading(false);
  // }, []);

  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const restored = _token;
    if (restored) {
      setAuthToken(restored);
      setToken(restored);
    }
    setIsInitializing(false);
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // const response = await loginService(phoneNumber, password);

      // _token = response.token;
      // setAuthToken(response.token);
      // setToken(response.token);
      // setUser(response.user);
      const response = await loginService(phoneNumber, password);

      if (!response?.token || !response?.user) {
        throw new Error("Invalid login response");
      }

      _token = response.token;
      setAuthToken(response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Login failed. Please try again.";

      setError(message);

      _token = null;
      setToken(null);
      setUser(null);

      throw error;
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
        // isAuthenticated: !!token,
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
