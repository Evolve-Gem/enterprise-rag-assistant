import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Enterprise RAG Copilot",
    template: "%s · Enterprise RAG Copilot",
  },
  description:
    "企业知识智能与售前 Agent 工作台：混合检索、可溯源生成、Agent/Skill/Tool 三层执行、知识缺口分析与 RAG 评估。",
  applicationName: "Enterprise RAG Copilot",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

/**
 * Applied before first paint so the correct theme is on `<html>` immediately.
 * Without it a dark-mode user sees a white flash on every navigation.
 */
const THEME_BOOTSTRAP = `
(function(){
  try {
    var stored = localStorage.getItem('copilot.theme');
    var dark = stored ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
