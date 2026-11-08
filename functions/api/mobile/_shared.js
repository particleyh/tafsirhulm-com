export const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
export const MIN_DREAM_LEN = 10;
export const MAX_DREAM_LEN = 3000;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, authorization",
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(String(a));
  const bufB = enc.encode(String(b));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export function getApiKey(request) {
  const header =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization") ||
    "";
  const trimmed = header.replace(/^Bearer\s+/i, "").trim();
  return trimmed;
}

function isTrustedOrigin(request) {
  const origin = (request.headers.get("origin") || "").toLowerCase();
  const referer = (request.headers.get("referer") || "").toLowerCase();
  const allowed = ["https://tafsirhulm.com", "http://tafsirhulm.com", "https://www.tafsirhulm.com"];
  if (allowed.some((a) => origin === a || origin.startsWith(a + "/"))) {
    return true;
  }
  if (allowed.some((a) => referer.startsWith(a + "/") || referer === a)) {
    return true;
  }
  return false;
}

/** Legacy grace: old Play builds send no key. Cutoff = 2026-11-18 UTC (10 days). */
const LEGACY_AUTH_UNTIL = Date.UTC(2026, 10, 18, 0, 0, 0); // month 0-indexed → Nov 18 2026

export function isLegacyAuthOpen() {
  return Date.now() < LEGACY_AUTH_UNTIL;
}

/**
 * Auth:
 * - valid X-API-Key → ok
 * - browser from tafsirhulm.com → ok
 * - missing key during legacy grace window → ok (old Play app)
 * - wrong key → always 401
 * Returns null if authorized, else a Response.
 */
export function requireApiKey(request, env) {
  const expected = env.API_KEY;
  if (!expected) {
    return json({ status: "error", error: "خدمة غير مهيأة." }, 503);
  }
  const provided = getApiKey(request);
  if (provided) {
    if (timingSafeEqual(provided, expected)) return null;
    return json(
      { status: "error", error: "مفتاح API غير صالح." },
      401
    );
  }
  if (isTrustedOrigin(request)) return null;
  if (isLegacyAuthOpen()) return null; // old app: no key yet
  return json(
    { status: "error", error: "مفتاح API مفقود. حدّث التطبيق." },
    401
  );
}

/** Sliding daily cap per IP (best-effort via Cache API). Returns wait info or null. */
export async function checkDailyCap(env, ip, limit, namespace = "dcap") {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const idHash = await sha256Hex(`${namespace}|${ip}|${day}`);
    const key = new Request(`https://cooldown.internal/${namespace}/${idHash}`);
    const hit = await caches.default.match(key);
    let count = 0;
    if (hit) {
      const n = parseInt(await hit.text(), 10);
      if (Number.isFinite(n)) count = n;
    }
    if (count >= limit) {
      const resetSec = 60 * 60 * 24;
      return { limited: true, retry_after: resetSec, remaining: 0 };
    }
    await caches.default.put(
      key,
      new Response(String(count + 1), {
        headers: { "cache-control": "public, max-age=86400" },
      })
    );
    return { limited: false, remaining: limit - count - 1 };
  } catch (_) {
    return { limited: false, remaining: limit };
  }
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function cacheGet(key) {
  try {
    const hit = await caches.default.match(key);
    return hit ? await hit.json() : null;
  } catch (_) {
    return null;
  }
}

export async function cachePut(key, value, maxAge = CACHE_TTL_SECONDS) {
  try {
    await caches.default.put(
      key,
      new Response(JSON.stringify(value), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": `public, max-age=${maxAge}`,
        },
      })
    );
  } catch (_) {}
}

export async function getLastUsed(namespace, idHash) {
  try {
    const hit = await caches.default.match(
      new Request(`https://cooldown.internal/${namespace}/${idHash}`)
    );
    if (!hit) return 0;
    const n = parseInt(await hit.text(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

export async function setLastUsed(namespace, idHash, ts) {
  try {
    await caches.default.put(
      new Request(`https://cooldown.internal/${namespace}/${idHash}`),
      new Response(String(ts), {
        headers: { "cache-control": "public, max-age=86400" },
      })
    );
  } catch (_) {}
}

export async function checkCooldown(namespace, idHash, cooldownMs) {
  const lastUsed = await getLastUsed(namespace, idHash);
  const elapsed = Date.now() - lastUsed;
  if (lastUsed && elapsed < cooldownMs) {
    return Math.ceil((cooldownMs - elapsed) / 1000);
  }
  return 0;
}

export function getIP(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown"
  );
}

export function stripFences(s) {
  let t = String(s).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return t.trim();
}

export function extractJson(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = stripFences(raw);
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  const start = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const useArr =
    start === -1 || (arrStart !== -1 && arrStart < start);
  if (useArr) {
    const aEnd = trimmed.lastIndexOf("]");
    if (arrStart !== -1 && aEnd > arrStart) {
      try {
        return JSON.parse(trimmed.slice(arrStart, aEnd + 1));
      } catch (_) {}
    }
  }
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

export function extractText(aiResult) {
  if (!aiResult || typeof aiResult !== "object") return "";
  if (typeof aiResult.response === "string" && aiResult.response.trim()) {
    return aiResult.response;
  }
  if (typeof aiResult.result === "string" && aiResult.result.trim()) {
    return aiResult.result;
  }
  const choice = Array.isArray(aiResult.choices)
    ? aiResult.choices[0]
    : null;
  const msg = choice && choice.message ? choice.message : null;
  if (msg && typeof msg.content === "string" && msg.content.trim()) {
    return msg.content;
  }
  return "";
}

export async function callAI(env, messages, maxTokens) {
  return env.AI.run(MODEL, {
    messages,
    max_tokens: maxTokens,
    temperature: 0.5,
    enable_thinking: false,
  });
}

export function normalizeDream(dream) {
  return dream.replace(/\s+/g, " ").trim().toLowerCase();
}

export function generateGuestId() {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
