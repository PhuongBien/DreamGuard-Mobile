// import React, { createContext, useContext, useState, ReactNode } from 'react';

// type AuthContextType = {
//   user: string | null;
//   login: (email: string, password: string) => Promise<void>;
//   logout: () => void;
//   isLoading: boolean;
// };

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const AuthProvider = ({ children }: { children: ReactNode }) => {
//   const [user, setUser] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   const login = async (email: string, password: string) => {
//     setIsLoading(true);

//     // giả lập API delay
//     await new Promise(resolve => setTimeout(resolve, 1000));

//     setUser(email);
//     setIsLoading(false);
//   };

//   const logout = () => {
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, login, logout, isLoading }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within AuthProvider');
//   }
//   return context;
// };