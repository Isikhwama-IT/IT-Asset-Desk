import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/supabase-server";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "IT Asset Desk — ISIBAG",
  description: "IT Asset Management by ISIBAG",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  return (
    <html lang="en">
      <body className="bg-stone-50">
        {user ? (
          <AuthProvider
            user={{
              userId: user.id,
              email: user.email ?? "",
              name:
                user.user_metadata?.full_name ??
                user.email?.split("@")[0] ??
                "User",
              role:
                user.user_metadata?.role === "admin" ? "admin" : "viewer",
              isAdmin: user.user_metadata?.role === "admin",
            }}
          >
            <AppShell>{children}</AppShell>
          </AuthProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
