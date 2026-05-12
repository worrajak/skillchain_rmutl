/**
 * BYOK (Bring Your Own Key) — AI settings storage for SkillChain
 *
 * ผู้ใช้แต่ละคนกรอก OpenRouter API key + เลือก model เอง
 * Keys เก็บใน localStorage บนเครื่องผู้ใช้ — ไม่ส่ง server (server ไม่ persist)
 * Server จะอ่าน key จาก header X-User-OpenRouter-Key เมื่อมี request
 *
 * Pattern อ้างอิง: PerformanceEvaluation-System (ทีม CESru)
 */

"use client";

export type AIProvider = "openrouter" | "anthropic" | "openai" | "google";

export interface UserAIKeys {
  openrouter?: string;
  anthropic?: string;
  openai?: string;
  google?: string;
}

export interface UserAIPrefs {
  default_provider: AIProvider;
  default_model?: string; // e.g. "anthropic/claude-3.5-sonnet" (OpenRouter format)
  vision_model?: string; // optional separate model for image analysis
  enable_voice?: boolean; // toggle voice → text features
}

const KEYS_STORAGE = "skc_user_ai_keys";
const PREFS_STORAGE = "skc_user_ai_prefs";

const DEFAULT_PREFS: UserAIPrefs = {
  default_provider: "openrouter",
  default_model: "anthropic/claude-3.5-sonnet", // good balance of quality/cost
  vision_model: "anthropic/claude-3.5-sonnet",
  enable_voice: false,
};

// Event name dispatched on every config change so UI can re-render
const EVENT_NAME = "skc_ai_config_changed";

// =============================================================
// Storage helpers
// =============================================================

export function getUserKeys(): UserAIKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEYS_STORAGE);
    if (!raw) return {};
    return JSON.parse(raw) as UserAIKeys;
  } catch {
    return {};
  }
}

export function setUserKey(provider: keyof UserAIKeys, key: string): void {
  if (typeof window === "undefined") return;
  const cur = getUserKeys();
  cur[provider] = key.trim();
  window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(cur));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function clearUserKey(provider: keyof UserAIKeys): void {
  if (typeof window === "undefined") return;
  const cur = getUserKeys();
  delete cur[provider];
  window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(cur));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getUserPrefs(): UserAIPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setUserPrefs(patch: Partial<UserAIPrefs>): void {
  if (typeof window === "undefined") return;
  const cur = getUserPrefs();
  const next = { ...cur, ...patch };
  window.localStorage.setItem(PREFS_STORAGE, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

// =============================================================
// JSON import / export — for backup or sharing settings
// =============================================================

export interface AIConfigBundle {
  // Versioned so we can migrate later if shape changes
  version: 1;
  exported_at: string;
  app: "skillchain-rmutl";
  keys: UserAIKeys; // includes secrets — handle carefully
  prefs: UserAIPrefs;
}

/** Export current AI settings to a JSON string (downloadable). */
export function exportAIConfig(): string {
  const bundle: AIConfigBundle = {
    version: 1,
    exported_at: new Date().toISOString(),
    app: "skillchain-rmutl",
    keys: getUserKeys(),
    prefs: getUserPrefs(),
  };
  return JSON.stringify(bundle, null, 2);
}

/** Import AI settings from a JSON string. Returns null on success, error message on failure. */
export function importAIConfig(json: string): string | null {
  try {
    const bundle = JSON.parse(json) as Partial<AIConfigBundle>;
    if (bundle.app && bundle.app !== "skillchain-rmutl") {
      return `ไฟล์นี้เป็นของ ${bundle.app}, ไม่ใช่ skillchain-rmutl`;
    }
    if (typeof window === "undefined") return "ไม่สามารถ import นอก browser";
    if (bundle.keys) {
      window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(bundle.keys));
    }
    if (bundle.prefs) {
      window.localStorage.setItem(PREFS_STORAGE, JSON.stringify(bundle.prefs));
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "JSON ผิดรูปแบบ";
  }
}

// =============================================================
// Provider check
// =============================================================

export function userHasKeyFor(provider: AIProvider): boolean {
  const keys = getUserKeys();
  switch (provider) {
    case "openrouter": return !!keys.openrouter;
    case "anthropic": return !!keys.anthropic;
    case "openai": return !!keys.openai;
    case "google": return !!keys.google;
    default: return false;
  }
}

export function userHasAnyKey(): boolean {
  const k = getUserKeys();
  return !!(k.openrouter || k.anthropic || k.openai || k.google);
}

// =============================================================
// Fetch helper — auto-attach user keys + selected model
// =============================================================

const HEADER_MAP: Record<keyof UserAIKeys, string> = {
  openrouter: "X-User-OpenRouter-Key",
  anthropic: "X-User-Anthropic-Key",
  openai: "X-User-OpenAI-Key",
  google: "X-User-Google-Key",
};

/** Add user's keys + selected model as headers (server reads these). */
export function withUserAIHeaders(init: RequestInit = {}): RequestInit {
  const keys = getUserKeys();
  const prefs = getUserPrefs();
  const headers = new Headers(init.headers ?? {});
  for (const [provider, key] of Object.entries(keys) as [keyof UserAIKeys, string][]) {
    if (key) headers.set(HEADER_MAP[provider], key);
  }
  if (prefs.default_provider) headers.set("X-User-AI-Provider", prefs.default_provider);
  if (prefs.default_model) headers.set("X-User-AI-Model", prefs.default_model);
  if (prefs.vision_model) headers.set("X-User-AI-Vision-Model", prefs.vision_model);
  return { ...init, headers };
}

/** Convenience wrapper around fetch that attaches AI headers. */
export function fetchAI(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, withUserAIHeaders(init));
}

// =============================================================
// React hook (re-renders when config changes)
// =============================================================

export function subscribeToAIConfig(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
