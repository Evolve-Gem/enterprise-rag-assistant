/**
 * TypeScript mirrors of the backend Pydantic schemas.
 *
 * These are hand-maintained on purpose: the API is small enough that a
 * generator would add more moving parts than it removes, and keeping them
 * explicit makes the contract reviewable in one file.
 */

/* ------------------------------------------------------------------ common */

export type TraceStatus =
  | "pending"
  | "running"
  | "success"
  | "skipped"
  | "failed"
  | "warning";

export interface TraceStep {
  index: number;
  node: string;
  title: string;
  status: TraceStatus;
  duration_ms: number;
  summary: string;
  detail: string;
  tool: string | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  environment: string;
  agent_engine: string;
  index_ready: boolean;
  index_document_count: number;
  index_chunk_count: number;
  llm_configured: boolean;
  checked_at: string;
}

/* --------------------------------------------------------------- knowledge */

export type DocumentStatus =
  | "uploaded"
  | "parsing"
  | "indexed"
  | "failed"
  | "unsupported";

export interface ChunkSummary {
  chunk_id: string;
  document_id: string;
  document_name: string;
  index: number;
  char_count: number;
  content: string;
  preview: string;
  section: string;
  has_vector: boolean;
}

export interface DocumentSummary {
  id: string;
  name: string;
  title: string;
  suffix: string;
  type_label: string;
  size_bytes: number;
  size_human: string;
  char_count: number | null;
  chunk_count: number;
  status: DocumentStatus;
  status_label: string;
  category: string;
  category_label: string;
  tags: string[];
  searchable: boolean;
  modified_at: string | null;
  created_at: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  content_truncated: boolean;
  summary: string;
  outline: string[];
  chunks: ChunkSummary[];
  extraction_note: string;
}

export interface DocumentListResponse {
  items: DocumentSummary[];
  total: number;
  offset: number;
  limit: number;
}

export interface ChunkListResponse {
  document_id: string;
  items: ChunkSummary[];
  total: number;
}

export interface KnowledgeStats {
  document_count: number;
  indexed_document_count: number;
  chunk_count: number;
  total_chars: number;
  total_bytes: number;
  searchable_count: number;
  failed_count: number;
  type_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  index_state: "ready" | "stale" | "empty" | "building";
  index_note: string;
  last_indexed_at: string | null;
  retriever_mode: string;
  embedding_provider: string;
  vectorized_chunk_count: number;
}

export interface ReindexResult {
  document_count: number;
  chunk_count: number;
  vectorized_chunk_count: number;
  duration_ms: number;
  index_state: string;
  note: string;
}

export interface UploadResult {
  document: DocumentSummary;
  chunks_created: number;
  warnings: string[];
}

/* --------------------------------------------------------------------- rag */

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_name: string;
  index: number;
  section: string;
  content: string;
  preview: string;
  char_count: number;
  score: number;
  keyword_score: number;
  vector_score: number;
  fused_score: number;
  rerank_score: number | null;
  rank_keyword: number | null;
  rank_vector: number | null;
  rank_fused: number | null;
  rank_final: number | null;
  found_by: string[];
  matched_terms: string[];
}

export interface Citation {
  index: number;
  chunk_id: string;
  document_id: string;
  document_name: string;
  section: string;
  snippet: string;
  score: number;
}

export interface SourceRef {
  document_id: string;
  document_name: string;
  chunk_count: number;
  best_score: number;
  citation_indexes: number[];
}

export interface RetrievalStats {
  mode: "keyword" | "vector" | "hybrid";
  candidate_count: number;
  keyword_hits: number;
  vector_hits: number;
  after_fusion: number;
  after_rerank: number;
  rerank_provider: string;
  fusion_strategy: string;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RagQueryRequest {
  question: string;
  top_k?: number | null;
  rerank_top_k?: number | null;
  mode?: "keyword" | "vector" | "hybrid" | null;
  rerank_provider?: "off" | "heuristic" | "llm" | null;
  allow_general_fallback?: boolean | null;
  history?: ChatMessage[];
}

export interface RagQueryResponse {
  question: string;
  answer: string;
  grounded: boolean;
  fallback_used: boolean;
  citations: Citation[];
  sources: SourceRef[];
  retrieved_chunks: RetrievedChunk[];
  trace: TraceStep[];
  stats: RetrievalStats;
  latency_ms: number;
  usage: UsageInfo;
  prompt_version: string;
  model: string;
}

export interface RetrieveOnlyResponse {
  query: string;
  stats: RetrievalStats;
  items: RetrievedChunk[];
  latency_ms: number;
}

/* ------------------------------------------------------------------- agent */

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  intents: string[];
  tools: string[];
  output_type: string;
  requires_retrieval: boolean;
  enabled: boolean;
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  read_only: boolean;
  parameters: string[];
  returns: string;
}

export interface ToolCallRecord {
  name: string;
  status: "success" | "failed" | "skipped";
  duration_ms: number;
  summary: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error: string | null;
}

export interface PlanStep {
  index: number;
  node: string;
  title: string;
  rationale: string;
  tool: string | null;
}

export interface AgentCatalogResponse {
  skills: SkillInfo[];
  tools: ToolInfo[];
  engines: string[];
  active_engine: string;
  intents: { intent: string; label: string; skill: string }[];
}

export interface AgentRunRequest {
  task: string;
  preferred_intent?: string | null;
  allow_general_fallback?: boolean | null;
  engine?: "auto" | "native" | "langgraph" | null;
  max_steps?: number | null;
  require_human_check?: boolean;
}

export interface AgentRunResponse {
  run_id: string;
  task: string;
  engine: string;
  intent: string;
  intent_confidence: number;
  skill: string;
  skill_name: string;
  plan: PlanStep[];
  tool_calls: ToolCallRecord[];
  trace: TraceStep[];
  output_type: string;
  answer: string;
  analysis: string;
  citations: Citation[];
  sources: SourceRef[];
  retrieved_chunks: RetrievedChunk[];
  used_general_fallback: boolean;
  human_check_required: boolean;
  human_check_reason: string;
  warnings: string[];
  skipped_nodes: string[];
  latency_ms: number;
  usage: UsageInfo;
  model: string;
}

/* ---------------------------------------------------------------- solution */

export interface RequirementForm {
  customer: string;
  industry: string;
  scenario: string;
  pain_points: string;
  requirements: string;
  constraints: string;
}

export interface RequirementAnalysis {
  customer_type: string;
  industry: string;
  scenario: string;
  core_needs: string[];
  pain_points: string[];
  constraints: string[];
  missing_info: string[];
  recommended_direction: string;
  search_query: string;
  raw_text: string;
  generated_by: "llm" | "rules";
}

export interface SolutionSection {
  key: string;
  title: string;
  content: string;
  grounded: boolean;
}

export interface SolutionResponse {
  requirement_text: string;
  analysis: RequirementAnalysis;
  sections: SolutionSection[];
  citations: Citation[];
  sources: SourceRef[];
  retrieved_chunks: RetrievedChunk[];
  trace: TraceStep[];
  markdown: string;
  grounded: boolean;
  warnings: string[];
  latency_ms: number;
  usage: UsageInfo;
  model: string;
}

export interface RequirementAnalyzeResponse {
  requirement_text: string;
  analysis: RequirementAnalysis;
  latency_ms: number;
  model: string;
}

/* ---------------------------------------------------------------- insights */

export interface CoverageItem {
  category: string;
  label: string;
  status: "covered" | "partial" | "missing";
  description: string;
  document_count: number;
  evidence_documents: string[];
  matched_keywords: string[];
  reason: string;
  suggested_documents: string[];
}

export interface GapReport {
  coverage: CoverageItem[];
  covered: string[];
  partial: string[];
  missing: string[];
  recommended_documents: {
    category: string;
    label: string;
    title: string;
    priority: string;
    reason: string;
    owner: string;
  }[];
  coverage_ratio: number;
  analyzed_document_count: number;
  analyzed_chunk_count: number;
  generated_at: string | null;
}

export interface ActivityRef {
  id: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  latency_ms: number;
  created_at: string;
  skill: string | null;
  intent: string | null;
  citations: number;
}

export interface OverviewResponse {
  knowledge: {
    document_count: number;
    indexed_document_count: number;
    chunk_count: number;
    total_chars: number;
    last_indexed_at: string | null;
    index_state: string;
    category_breakdown: Record<string, number>;
  };
  agent: {
    run_count: number;
    successful_runs: number;
    skill_count: number;
    tool_count: number;
    tool_call_count: number;
    success_rate: number;
    engine: string;
    top_skills: { skill: string; count: number }[];
  };
  rag: {
    question_count: number;
    answered_count: number;
    grounded_rate: number;
    retrieval_hit_count: number;
    citation_count: number;
    average_latency_ms: number;
    average_citations: number;
  };
  system: {
    llm_provider: string;
    llm_model: string;
    llm_configured: boolean;
    retriever_mode: string;
    embedding_provider: string;
    embedding_model: string;
    index_state: string;
    read_only: boolean;
    password_required: boolean;
    version: string;
    environment: string;
  };
  recent_activity: ActivityRef[];
  recent_questions: ActivityRef[];
  recent_documents: {
    id: string;
    name: string;
    category: string;
    status: string;
    chunks: number;
    modified_at: string | null;
  }[];
  coverage_summary: Record<string, number>;
  quick_actions: {
    id: string;
    label: string;
    description: string;
    href: string;
    icon: string;
    enabled: boolean;
  }[];
  generated_at: string | null;
  data_available: boolean;
  notes: string[];
}

/* -------------------------------------------------------------- evaluation */

export interface EvalCase {
  id: string;
  question: string;
  expected_keywords: string[];
  expected_document_ids: string[];
  notes: string;
  created_at: string | null;
}

export interface EvalDatasetResponse {
  cases: EvalCase[];
  total: number;
  path: string;
}

export interface EvalCaseResult {
  case_id: string;
  question: string;
  retrieved_document_ids: string[];
  retrieved_chunk_ids: string[];
  hit_at_k: boolean;
  first_hit_rank: number | null;
  reciprocal_rank: number;
  recall_at_k: number;
  keyword_coverage: number;
  matched_keywords: string[];
  missing_keywords: string[];
  answer_grade: "correct" | "partial" | "wrong" | "ungraded";
  latency_ms: number;
  failure_reason: string;
}

export interface EvalRunSummary {
  run_id: string;
  case_count: number;
  k: number;
  mode: string;
  hit_at_k: number;
  mrr: number;
  recall_at_k: number;
  keyword_coverage: number;
  graded_count: number;
  correct_count: number;
  partial_count: number;
  wrong_count: number;
  answer_accuracy: number | null;
  average_latency_ms: number;
  started_at: string | null;
  duration_ms: number;
  notes: string[];
}

export interface EvalRunResponse {
  summary: EvalRunSummary;
  cases: EvalCaseResult[];
}

/* ---------------------------------------------------------------- activity */

export interface ActivityRecord {
  id: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  intent: string | null;
  skill: string | null;
  tools: string[];
  latency_ms: number;
  source_ids: string[];
  source_names: string[];
  citation_count: number;
  chunk_count: number;
  grounded: boolean | null;
  engine: string | null;
  model: string | null;
  error: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

export interface ActivityListResponse {
  items: ActivityRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface ActivityStats {
  total: number;
  by_kind: Record<string, number>;
  by_status: Record<string, number>;
  by_skill: Record<string, number>;
  failure_count: number;
  success_rate: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  last_activity_at: string | null;
  backend: string;
}

/* ---------------------------------------------------------------- settings */

export interface PromptInfo {
  name: string;
  version: string;
  description: string;
  placeholders: string[];
  path: string;
}

export interface SettingsResponse {
  app: { name: string; version: string; environment: string };
  guard_rails: { password_required: boolean; read_only: boolean };
  storage: {
    knowledge_base: string;
    prompts: string;
    prompt_version: string;
    data: string;
  };
  providers: {
    llm: {
      provider: string;
      model: string;
      configured: boolean;
      key_hint: string;
      base_url: string;
    };
    embedding: {
      provider: string;
      model: string;
      configured: boolean;
      key_hint: string;
      dim: number;
    };
  };
  retrieval: {
    configured_mode: string;
    effective_mode: string;
    vector_store: string;
    top_k: number;
    rerank_top_k: number;
    fusion: string;
    rerank_provider: string;
  };
  chunking: { chunk_size: number; chunk_overlap: number };
  agent: {
    engine: string;
    requested_engine: string;
    max_steps: number;
    human_check_required: boolean;
  };
  uploads: { max_bytes: number; allowed_suffixes: string[] };
  runtime: { python: string; langgraph_available: boolean; prompt_version: string };
  observability: {
    activity_enabled: boolean;
    activity_backend: string;
    max_records: number;
  };
  evaluation: { dataset_path: string };
}

export interface SystemStatus {
  status: "ok" | "degraded";
  checked_at: string;
  checks: { key: string; label: string; status: string; detail: string }[];
  index: {
    state: string;
    built_at: string | null;
    from_cache: boolean;
    document_count: number;
    chunk_count: number;
    vectorized_chunk_count: number;
    failed_count: number;
  };
}

export interface AuthStatus {
  password_required: boolean;
  read_only: boolean;
  app_name: string;
  version: string;
}
