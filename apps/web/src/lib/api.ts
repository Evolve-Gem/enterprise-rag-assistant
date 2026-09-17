/**
 * Typed API client.
 *
 * Responsibilities:
 *  - resolve the backend base URL from `NEXT_PUBLIC_API_BASE_URL`
 *  - attach the demo session token (when `DEMO_PASSWORD` is configured)
 *  - turn the backend's `{ error: { code, message, details } }` envelope into a
 *    typed `ApiError`, so UI code never has to inspect raw status codes
 *  - expose one function per endpoint, grouped by domain
 */

import type {
  ActivityListResponse,
  ActivityStats,
  AgentCatalogResponse,
  AgentRunRequest,
  AgentRunResponse,
  ApiErrorBody,
  AuthStatus,
  ChunkListResponse,
  ChunkSummary,
  DocumentDetail,
  DocumentListResponse,
  EvalCase,
  EvalDatasetResponse,
  EvalRunResponse,
  EvalRunSummary,
  GapReport,
  HealthResponse,
  KnowledgeStats,
  OverviewResponse,
  PromptInfo,
  RagQueryRequest,
  RagQueryResponse,
  ReindexResult,
  RequirementAnalyzeResponse,
  RequirementForm,
  RetrieveOnlyResponse,
  SettingsResponse,
  SolutionResponse,
  SystemStatus,
  UploadResult,
} from "./types";

/**
 * Base URL for API calls.
 *
 * Empty (the production default) means **same origin**: the browser requests
 * `/api/...` on whatever origin served the page, and Next.js proxies it to the
 * backend (`API_PROXY_TARGET` in `next.config.ts`). That keeps the FastAPI port
 * off the public internet and removes the whole class of bug where a stale
 * `localhost:8000` gets baked into a client bundle.
 *
 * Set it to an absolute URL only for local development against a backend on a
 * different origin.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

const TOKEN_KEY = "copilot.demo.token";

/** Read the demo token from localStorage (browser only). */
export function getDemoToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Persist the demo token. */
export function setDemoToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage disabled — the request will simply fail the auth check */
  }
}

/** Error thrown for every non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: Partial<ApiErrorBody>, fallback: string) {
    super(body.message || fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code || "unknown_error";
    this.details = (body.details as Record<string, unknown>) ?? {};
  }

  /** True when the failure is a missing/invalid demo password. */
  get isUnauthorized() {
    return this.status === 401 || this.code === "invalid_password";
  }
}

const NETWORK_MESSAGE = API_BASE_URL
  ? `无法连接后端服务（${API_BASE_URL}）。请确认 FastAPI 已启动。`
  : "无法连接后端服务。请确认后端（FastAPI）已启动。";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getDemoToken();
  if (token) headers.set("X-Demo-Token", token);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, { code: "network_error", message: NETWORK_MESSAGE }, NETWORK_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body =
      payload && typeof payload === "object" && "error" in payload
        ? ((payload as { error: ApiErrorBody }).error as Partial<ApiErrorBody>)
        : {};
    throw new ApiError(
      response.status,
      body,
      `请求失败（HTTP ${response.status}）。`,
    );
  }

  return payload as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const asString = search.toString();
  return asString ? `?${asString}` : "";
}

/* ------------------------------------------------------------------ system */

export const api = {
  /* ---------------- health / auth ---------------- */
  health: () => request<HealthResponse>("/health"),
  rootInfo: () => request<Record<string, unknown>>("/"),
  systemStatus: () => request<SystemStatus>("/api/system/status"),

  authStatus: () => request<AuthStatus>("/api/auth/status"),
  async login(password: string) {
    const result = await request<{ ok: boolean; token: string; message: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ password }) },
    );
    if (result.token) setDemoToken(result.token);
    return result;
  },
  logout: () => setDemoToken(""),

  /* ---------------- overview / settings ---------------- */
  overview: () => request<OverviewResponse>("/api/overview"),
  settings: () => request<SettingsResponse>("/api/settings"),
  prompts: () =>
    request<{ version: string; directory: string; items: PromptInfo[] }>(
      "/api/settings/prompts",
    ),

  /* ---------------- knowledge ---------------- */
  listDocuments: (params: {
    q?: string;
    category?: string;
    status?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  } = {}) => request<DocumentListResponse>(`/api/knowledge/documents${query(params)}`),

  getDocument: (id: string) =>
    request<DocumentDetail>(`/api/knowledge/documents/${encodeURIComponent(id)}`),

  getDocumentChunks: (id: string) =>
    request<ChunkListResponse>(`/api/knowledge/documents/${encodeURIComponent(id)}/chunks`),

  getChunk: (chunkId: string) =>
    request<ChunkSummary>(`/api/knowledge/chunks/${encodeURIComponent(chunkId)}`),

  knowledgeStats: () => request<KnowledgeStats>("/api/knowledge/stats"),

  async uploadDocument(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResult>("/api/knowledge/upload", { method: "POST", body: form });
  },

  updateDocument: (id: string, content: string) =>
    request<DocumentDetail>(`/api/knowledge/documents/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  deleteDocument: (id: string) =>
    request<{ ok: boolean; message: string }>(
      `/api/knowledge/documents/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  reindex: (forceVectors = false) =>
    request<ReindexResult>("/api/knowledge/reindex", {
      method: "POST",
      body: JSON.stringify({ force_vectors: forceVectors }),
    }),

  /* ---------------- rag ---------------- */
  ragQuery: (payload: RagQueryRequest) =>
    request<RagQueryResponse>("/api/rag/query", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  chat: (payload: RagQueryRequest) =>
    request<RagQueryResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  retrieve: (params: {
    q: string;
    top_k?: number;
    mode?: string;
    rerank?: boolean;
  }) => request<RetrieveOnlyResponse>(`/api/rag/retrieve${query(params)}`),

  /* ---------------- agent ---------------- */
  agentCatalog: () => request<AgentCatalogResponse>("/api/agent/catalog"),
  agentRun: (payload: AgentRunRequest) =>
    request<AgentRunResponse>("/api/agent/run", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /* ---------------- solutions ---------------- */
  analyzeRequirement: (requirement: string, form?: RequirementForm | null) =>
    request<RequirementAnalyzeResponse>("/api/solutions/analyze", {
      method: "POST",
      body: JSON.stringify({ requirement, form: form ?? null }),
    }),

  generateSolution: (payload: {
    requirement: string;
    form?: RequirementForm | null;
    top_k?: number;
  }) =>
    request<SolutionResponse>("/api/solutions/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  solutionConfig: () =>
    request<{
      model: string;
      provider: string;
      configured: boolean;
      retriever_mode: string;
      top_k: number;
      rerank_top_k: number;
      sections: string[];
    }>("/api/solutions/config"),

  /** Download the proposal as a Blob (markdown or docx). */
  async exportSolution(payload: {
    format: "markdown" | "docx";
    title: string;
    markdown: string;
  }): Promise<Blob> {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = getDemoToken();
    if (token) headers.set("X-Demo-Token", token);

    const response = await fetch(`${API_BASE_URL}/api/solutions/export`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let body: Partial<ApiErrorBody> = {};
      try {
        const parsed = await response.json();
        body = parsed?.error ?? {};
      } catch {
        /* ignore */
      }
      throw new ApiError(response.status, body, "导出失败。");
    }
    return response.blob();
  },

  /* ---------------- insights ---------------- */
  coverage: () => request<GapReport>("/api/insights/coverage"),
  gaps: () => request<GapReport>("/api/insights/gaps"),

  /* ---------------- evaluation ---------------- */
  evalDataset: () => request<EvalDatasetResponse>("/api/evaluation/dataset"),
  evalAddCase: (payload: {
    question: string;
    expected_keywords: string[];
    expected_document_ids: string[];
    notes?: string;
  }) =>
    request<EvalCase>("/api/evaluation/dataset", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  evalSeed: () =>
    request<EvalDatasetResponse>("/api/evaluation/dataset/seed", { method: "POST" }),
  evalDeleteCase: (caseId: string) =>
    request<{ ok: boolean; message: string }>(
      `/api/evaluation/dataset/${encodeURIComponent(caseId)}`,
      { method: "DELETE" },
    ),
  evalRun: (payload: { k?: number; mode?: string | null; case_ids?: string[] }) =>
    request<EvalRunResponse>("/api/evaluation/run", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  evalRuns: (limit = 10) => request<EvalRunSummary[]>(`/api/evaluation/runs${query({ limit })}`),
  evalFeedback: (payload: { case_id: string; grade: string; note?: string }) =>
    request<{
      case_id: string;
      grade: string;
      total_graded: number;
      answer_accuracy: number | null;
    }>("/api/evaluation/feedback", { method: "POST", body: JSON.stringify(payload) }),

  /* ---------------- activity ---------------- */
  activity: (params: { kind?: string; status?: string; offset?: number; limit?: number } = {}) =>
    request<ActivityListResponse>(`/api/activity${query(params)}`),
  activityStats: (days = 30) =>
    request<ActivityStats>(`/api/activity/stats${query({ days })}`),
  clearActivity: () =>
    request<{ ok: boolean; message: string }>("/api/activity", { method: "DELETE" }),
};

export type Api = typeof api;
