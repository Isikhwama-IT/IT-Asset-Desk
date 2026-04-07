"use client";

import { createContext, useContext } from "react";

export type AuthUser = {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  isAdmin: boolean;
};

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthUser;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUser {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
