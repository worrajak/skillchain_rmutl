/**
 * Server-side AI dispatcher.
 *
 * Reads the user's BYOK key + selected model from request headers
 * (set by `withUserAIHeaders()` on the client). Falls back to server
 * env vars if no user key is provided — that lets you run a shared
 * pool for users without keys, or keep server-only for ops scripts.
 *
 * Currently routes everything through OpenRouter (one endpoint, many
 * models). Direct Anthropic/OpenAI/Google can be added later if
 * needed for cheaper non-OR pricing.
 */

import "server-only";

export type AIProvider = "openrouter" | "anthropic" | "openai" | "google";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  visionModel?: string;
  source: "user" | "env";
}

export interface AICallOptions {
  /** System prompt (concise instructions) */
  system?: string;
  /** User message — text */
  user: string;
  /** Optional images for vision models (base64 data URL or HTTPS URL) */
  images?: string[];
  /** Override model for this call (e.g. force vision model when images present) */
  model?: string;
  /** Sampling temperature (0-1) */
  temperature?: number;
  /** Max output tokens */
  maxTokens?: number;
}

export interface AIResponse {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
}

const HEADER_MAP: Record<AIProvider, string> = {
  openrouter: "x-user-openrouter-key",
  anthropic: "x-user-anthropic-key",
  openai: "x-user-openai-key",
  google: "x-user-google-key",
};

const ENV_FALLBACK: Record<AIProvider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const DEFAULT_VISION_MODEL = "anthropic/claude-3.5-sonnet";

/**
 * Resolve which provider/key/model to use for this request.
 * Reads from headers first (BYOK), falls back to env.
 */
export function resolveAIConfig(req: Request): AIConfig | null {
  const provider = (req.headers.get("x-user-ai-provider") as AIProvider) || "openrouter";
  const headerName = HEADER_MAP[provider];
  if (!headerName) return null;

  const userKey = req.headers.get(headerName);
  if (userKey) {
    return {
      provider,
      apiKey: userKey,
      model: req.headers.get("x-user-ai-model") || DEFAULT_MODEL,
      visionModel: req.headers.get("x-user-ai-vision-model") || DEFAULT_VISION_MODEL,
      source: "user",
    };
  }

  // Fallback to env
  const envKey = process.env[ENV_FALLBACK[provider]];
  if (envKey) {
    return {
      provider,
      apiKey: envKey,
      model: req.headers.get("x-user-ai-model") || DEFAULT_MODEL,
      visionModel: req.headers.get("x-user-ai-vision-model") || DEFAULT_VISION_MODEL,
      source: "env",
    };
  }

  return null;
}

/**
 * Call OpenRouter (or compatible) chat completions with optional vision.
 * Returns text response + usage metrics.
 */
export async function callAI(
  config: AIConfig,
  opts: AICallOptions,
): Promise<AIResponse> {
  if (config.provider !== "openrouter") {
    return { ok: false, error: `Provider "${config.provider}" not yet implemented (use openrouter for now)` };
  }

  const useVision = (opts.images?.length ?? 0) > 0;
  const model = opts.model || (useVision ? config.visionModel : config.model) || DEFAULT_MODEL;

  // Build OpenAI-compatible message format
  const messages: Array<Record<string, unknown>> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });

  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: opts.user }];
  for (const img of opts.images ?? []) {
    userContent.push({ type: "image_url", image_url: { url: img } });
  }
  messages.push({ role: "user", content: useVision ? userContent : opts.user });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://skillchain-rmutl.vercel.app",
        "X-Title": "SkillChain RMUTL",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `OpenRouter ${res.status}: ${errText.slice(0, 300)}`, model };
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_cost?: number };
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      ok: true,
      text,
      model,
      usage: data.usage ? {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
        cost_usd: data.usage.total_cost,
      } : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI call failed" };
  }
}

/**
 * Quick helper to test if an OpenRouter key works.
 * Used by /api/ai/test-key.
 */
export async function testOpenRouterKey(apiKey: string): Promise<{ ok: boolean; error?: string; model_count?: number }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    const data = await res.json() as { data?: unknown[] };
    return { ok: true, model_count: data.data?.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
