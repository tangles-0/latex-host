import "katex/dist/katex.min.css";
import "./globals.css";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserTheme, isAdminUser } from "@/lib/metadata-store";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { FloatingLogo } from "@/components/theme/floating-logo";
import { AppShell } from "@/components/chrome/app-shell";
import { AuthSessionProvider } from "@/components/chrome/session-provider";
import { isNodeMode } from "@/lib/self-hosted-nodes";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "latex",
  description: "Upload images, organize albums, and share direct links.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const theme = userId ? await getUserTheme(userId) : "dark";
  const isAdmin = userId ? await isAdminUser(userId) : false;
  const username =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "user";

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning={true}>
      {!userId ? (
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  const stored = localStorage.getItem("latex-theme");
                  if (stored) {
                    document.documentElement.dataset.theme = stored;
                  }
                } catch {}
              `,
            }}
          />
        </head>
      ) : null}
      <body className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
        <AuthSessionProvider session={session}>
          <ThemeProvider initialTheme={theme} preferLocalStorage={!userId}>
            <AppShell
              isAuthenticated={Boolean(userId)}
              username={username}
              isAdmin={isAdmin}
              isNodeMode={isNodeMode()}
            >
              {children}
              <FloatingLogo />
            </AppShell>
          </ThemeProvider>
        </AuthSessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
