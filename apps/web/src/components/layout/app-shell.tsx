"use client";

import { Lock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/states";
import { api, ApiError, getDemoToken } from "@/lib/api";
import { useAsync, useLocalStorage } from "@/lib/hooks";
import type { AuthStatus, HealthResponse, SettingsResponse } from "@/lib/types";

/**
 * Application shell: demo-password gate → collapsible sidebar → topbar → page.
 *
 * The gate only appears when the backend reports `password_required`. Health and
 * settings are fetched once here and shared with the sidebar/topbar rather than
 * being re-fetched by every page.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage("copilot.sidebar.collapsed", false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const auth = useAsync<AuthStatus>(() => api.authStatus(), []);

  useEffect(() => {
    // Narrowing a property access does not survive into a nested closure, so the
    // discriminant is captured into a local const first.
    if (auth.status !== "success") return;
    const status = auth.data;
    if (!status.password_required) {
      setAuthed(true);
      return;
    }
    setAuthed(Boolean(getDemoToken()));
  }, [auth]);

  const health = useAsync<HealthResponse>(() => api.health(), [], { keepPreviousData: false });
  const settings = useAsync<SettingsResponse>(() => api.settings(), []);

  const reloadAll = useCallback(() => {
    void health.reload();
    void settings.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health.reload, settings.reload]);

  const handleLogin = useCallback(async () => {
    setLoggingIn(true);
    setLoginError("");
    try {
      await api.login(password);
      setAuthed(true);
      setPassword("");
      reloadAll();
    } catch (error) {
      setLoginError(
        error instanceof ApiError ? error.message : "登录失败，请检查后端服务是否已启动。",
      );
    } finally {
      setLoggingIn(false);
    }
  }, [password, reloadAll]);

  /* ------------------------------------------------------------- gate ---- */
  if (auth.status === "loading" || authed === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-canvas)]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-5 animate-spin text-[var(--color-accent)]" />
          <p className="text-xs text-[var(--color-ink-muted)]">正在连接后端服务…</p>
        </div>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-canvas)] p-6">
        <div className="w-full max-w-lg">
          <ErrorState error={auth.error} onRetry={auth.reload} />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-canvas)] p-6">
        <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7">
          <div className="mb-5 flex flex-col items-center gap-2 text-center">
            <span className="flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Lock className="size-5" />
            </span>
            <h1 className="text-base font-semibold text-[var(--color-ink)]">
              {auth.data.app_name}
            </h1>
            <p className="text-xs text-[var(--color-ink-muted)]">
              该部署启用了演示访问密码，请输入后继续。
            </p>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              value={password}
              autoFocus
              placeholder="访问密码"
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleLogin();
              }}
            />
            {loginError ? (
              <p className="text-xs text-[var(--color-danger)]">{loginError}</p>
            ) : null}
            <Button
              variant="primary"
              className="w-full"
              loading={loggingIn}
              onClick={() => void handleLogin()}
            >
              进入工作台
            </Button>
            <p className="text-center text-2xs text-[var(--color-ink-faint)]">
              v{auth.data.version} · 密码仅用于演示环境访问控制
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ shell ---- */
  return (
    <div className="flex min-h-dvh bg-[var(--color-canvas)]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        settings={settings.status === "success" ? settings.data : undefined}
        health={health.status === "success" ? health.data : undefined}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          health={health.status === "success" ? health.data : undefined}
          onRefresh={reloadAll}
          refreshing={health.status === "loading"}
        />
        <main className="min-w-0 flex-1 px-5 py-5 xl:px-7">{children}</main>
      </div>
    </div>
  );
}
