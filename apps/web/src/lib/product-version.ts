/**
 * Product identity — the single source of truth for the product version.
 *
 * WHY THIS FILE EXISTS
 *
 * Before this, nothing in the frontend actually knew the product version. The
 * About page rendered `v${system.version}`, which is the **backend API version**
 * — so the product described itself to visitors as "v3.0.0" while shipping as
 * V4.x. `package.json` still says 3.0.0 from the same era.
 *
 * The two are genuinely different things and must stay different:
 *
 *   - PRODUCT version  — the thing a visitor sees (this file). Bumped when a
 *     release ships, and only then.
 *   - API version      — `backend/app/core/config.py: app_version = "3.0.0"`.
 *     It describes the HTTP surface. V4.0 / V4.1 / V4.2 changed no backend code,
 *     which is exactly why it has stayed at 3.0.0 across all three releases.
 *     Deliberately NOT changed here: the task forbids faking the frontend
 *     version by editing the backend constant.
 *
 * STATUS SEMANTICS
 *
 * `product-review` means the build is verified but NOT deployed. V4.2 is in that
 * state, so it must never render as "released" and must never show a release
 * date. `releasedAt` is only set for versions that are actually running on the
 * public deployment, and the dates below come from the release reports and the
 * deployment timestamps, not from memory:
 *
 *   V4.0 — docs/V4_RELEASE_REPORT.md 「发布日期：2026-09-25」,
 *          image rag-copilot-web:4.0.0 created 2026-09-25T18:31:16+08:00,
 *          commit 5396db2.
 *   V4.1 — docs/V4_1_RELEASE_REPORT.md, deployed 2026-10-06 17:22:34 +0800,
 *          commit ac27d58.
 *   V4.2 — not deployed; no date exists and none is invented here.
 */

export type ReleaseStatus = "released" | "product-review";

export interface ReleaseEntry {
  version: string;
  status: ReleaseStatus;
  /** ISO date of the public deployment. `null` for a version that never shipped. */
  releasedAt: string | null;
  title: string;
  summary: string;
  highlights: string[];
}

/** The version a visitor is looking at right now. */
export const PRODUCT_VERSION = "V4.2";

/**
 * Set to "released" as part of the V4.2 production release on 2026-10-08.
 * Before that it was "product-review", which is what the pre-release build
 * shipped with — the About page therefore said "待发布" while running V4.2 code.
 */
export const PRODUCT_STATUS: ReleaseStatus = "released";

export const PRODUCT_NAME = "Enterprise RAG Copilot";
export const PRODUCT_TAGLINE = "企业知识智能工作台";

/** Shown next to the version in the brand area. Short on purpose. */
export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  released: "已发布",
  "product-review": "待发布 · Product Review",
};

/** Newest first. */
export const RELEASES: ReleaseEntry[] = [
  {
    version: "V4.2",
    status: "released",
    // The deployment date, not the date the acceptance report was written.
    releasedAt: "2026-10-08",
    title: "视觉体验升级",
    summary: "Design System V2 与全站视觉、交互、可访问性收口，以及产品身份与版本历程。",
    highlights: [
      "Design System V2：六层 Surface 与四级 Elevation，取代「白底 + 灰边」的层级表达",
      "Premium Hero：分层玻璃、环境光、上下受光边与克制的指针光晕",
      "深色模式独立设计（画布、Surface、结果面分别调色，非简单反色）",
      "微交互体系：统一时长与缓动，并同时覆盖 CSS 与 JS 动画的 reduced-motion",
      "结果阅读体验：Ask / Agent / Solution 输出向「文档」而非「卡片堆」靠拢",
      "可访问性改进：焦点环、skip link、对话框焦点管理、对比度修正",
      "Citation 焦点修复：消除引用按钮的整树重挂载，关闭抽屉后焦点正确归位",
    ],
  },
  {
    version: "V4.1",
    status: "released",
    releasedAt: "2026-10-06",
    title: "用户体验升级",
    summary: "产品信息架构压缩与移动端体验重构。已在生产环境运行。",
    highlights: [
      "首页信息架构压缩：桌面 −60.7%、手机 −69.9%",
      "Mobile QR First Screen：390 / 430 / 375 三档下三个核心入口首屏完整可见",
      "状态式布局：Agent 与方案生成「输入时输入是主角、产出后结果是主角」",
      "Progressive Disclosure：技术细节、执行轨迹、检索证据默认折叠且标签自解释",
      "移动端交互优化：导航抽屉、全屏引用面板、统一触控目标",
    ],
  },
  {
    version: "V4.0",
    status: "released",
    releasedAt: "2026-09-25",
    title: "产品化升级",
    summary: "把技术演示整理成一个可公开体验的产品。已在生产环境运行。",
    highlights: [
      "企业知识工作台产品化：统一视觉语言与卡片体系",
      "首页价值主张与两个主入口行动点",
      "三个核心入口：知识问答、AI Agent、方案生成",
      "公开可体验的 Demo 与只读保护",
      "产品介绍与技术边界说明",
    ],
  },
];

export function formatReleaseDate(iso: string | null): string {
  if (!iso) return "未发布";
  return iso;
}
