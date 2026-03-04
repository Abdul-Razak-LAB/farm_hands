import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/layout/auth-provider";
import { NavigationShell } from "@/components/layout/navigation-shell";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "FarmOps PWA",
  description: "Next-gen Farm Operations Platform",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const stored = localStorage.getItem('theme');
    const mode = stored === 'light' || stored === 'dark'
      ? stored
      : 'light';
    const theme = mode;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          <AuthProvider>
            <NavigationShell>
              {children}
            </NavigationShell>
          </AuthProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
