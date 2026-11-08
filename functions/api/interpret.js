const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const COOLDOWN_MS = 30_000;
const MAX_DREAM_LEN = 3000;
const MIN_DREAM_LEN = 10;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const SYSTEM_PROMPT = `أنت "الجد حلمي"، مفسر أحلام عربي محترف بخبرة عقود في كتب التفسير والنفسيات.
فسّر الحلم الذي يكتبه المستخدم بدقة ووضوح.

قواعد:
- اكتب بالعربية الفصحى المبسطة المفهومة للقارئ العام
- اربط كل رمز في الحلم بدلالة واقعية مرتبطة بسياق الحلم وحالته النفسية
- لا تصدر أحكاماً قطعية أو تخويفاً؛ قدّم قراءات محتملة متعددة بلطف
- لا تخترع تفاصيل غير موجودة في الحلم
- اجعل الإجابة مركّزة: مقدمة قصيرة، ثم تحليل الرموز الرئيسية، ثم خلاصة عملية
- الطول الكلي بين 150 و 350 كلمة

أعد JSON فقط بدون أي نص آخر وبدون علامات اقتباس:
{"title":"عنوان قصير للفهم","analysis":"تحليل كامل منظم بفقرات قصيرة","symbols":[{"symbol":"الرمز","meaning":"الدلالة"}],"conclusion":"خلاصة عملية في سطرين"}`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function cacheGet(key) {
  try {
    const hit = await caches.default.match(key);
    return hit ? await hit.json() : null;
  } catch (_) {
    return null;
  }
}

async function cachePut(key, value, maxAge) {
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

async function getLastUsed(ipHash) {
  try {
    const hit = await caches.default.match(
      new Request(`https://cooldown.internal/last/${ipHash}`)
    );
    if (!hit) return 0;
    const n = parseInt(await hit.text(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

async function setLastUsed(ipHash, ts) {
  try {
    await caches.default.put(
      new Request(`https://cooldown.internal/last/${ipHash}`),
      new Response(String(ts), {
        headers: { "cache-control": "public, max-age=86400" },
      })
    );
  } catch (_) {}
}

function stripFences(s) {
  let t = String(s).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return t.trim();
}

function extractJson(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = stripFences(raw);
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function extractText(aiResult) {
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

function sanitizeResult(data) {
  if (!data || typeof data !== "object") return null;
  const title =
    typeof data.title === "string" ? data.title.trim().slice(0, 200) : "";
  const analysis =
    typeof data.analysis === "string" ? data.analysis.trim().slice(0, 6000) : "";
  const conclusion =
    typeof data.conclusion === "string"
      ? data.conclusion.trim().slice(0, 1000)
      : "";
  if (!analysis) return null;
  const symbols = Array.isArray(data.symbols)
    ? data.symbols
        .filter((s) => s && typeof s === "object")
        .slice(0, 12)
        .map((s) => ({
          symbol: String(s.symbol ?? "").trim().slice(0, 120),
          meaning: String(s.meaning ?? "").trim().slice(0, 500),
        }))
        .filter((s) => s.symbol && s.meaning)
    : [];
  return {
    title: title || "تفسير حلمك",
    analysis,
    symbols,
    conclusion,
  };
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

const LEGACY_AUTH_UNTIL = Date.UTC(2026, 11, 9, 0, 0, 0); // Dec 9 2026 UTC

function requireApiKey(request, env) {
  const expected = env.API_KEY;
  if (!expected) return json({ error: "خدمة غير مهيأة." }, 503);
  const header =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization") ||
    "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (provided) {
    if (timingSafeEqual(provided, expected)) return null;
    return json({ error: "مفتاح API غير صالح." }, 401);
  }
  const origin = (request.headers.get("origin") || "").toLowerCase();
  const referer = (request.headers.get("referer") || "").toLowerCase();
  const allowed = [
    "https://tafsirhulm.com",
    "http://tafsirhulm.com",
    "https://www.tafsirhulm.com",
  ];
  const trusted =
    allowed.some((a) => origin === a || origin.startsWith(a + "/")) ||
    allowed.some((a) => referer.startsWith(a + "/") || referer === a);
  if (trusted) return null;
  if (Date.now() < LEGACY_AUTH_UNTIL) return null;
  return json({ error: "مفتاح API مفقود. حدّث التطبيق." }, 401);
}

export async function onRequestPost({ request, env }) {
  try {
    const authErr = requireApiKey(request, env);
    if (authErr) return authErr;

    if (!env.AI) {
      return json(
        { error: "خدمة التفسير غير متاحة حالياً. حاول لاحقاً." },
        503
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return json({ error: "طلب غير صالح." }, 400);
    }

    const dream =
      typeof payload?.dream === "string" ? payload.dream.trim() : "";
    if (dream.length < MIN_DREAM_LEN) {
      return json(
        { error: "اكتب حلمك بشكل أوضح (10 أحرف على الأقل)." },
        400
      );
    }
    if (dream.length > MAX_DREAM_LEN) {
      return json(
        { error: `الحلم طويل جداً. الحد الأقصى ${MAX_DREAM_LEN} حرف.` },
        400
      );
    }

    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown";
    const ipHash = await sha256Hex(ip);
    const now = Date.now();
    const lastUsed = await getLastUsed(ipHash);
    const elapsed = now - lastUsed;

    if (lastUsed && elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return json(
        {
          error: `انتظر ${waitSec} ثانية بين كل تفسير وآخر.`,
          retry_after: waitSec,
        },
        429
      );
    }

    const normalized = dream.replace(/\s+/g, " ").trim().toLowerCase();
    const cacheKey = new Request(
      `https://cache.internal/interpret/${await sha256Hex(normalized)}`
    );
    const cached = await cacheGet(cacheKey);
    if (cached && cached.analysis) {
      await setLastUsed(ipHash, now);
      return json({ ...cached, cached: true });
    }

    let aiResult;
    try {
      aiResult = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `نص الحلم:\n${dream}` },
        ],
        max_tokens: 900,
        temperature: 0.5,
        enable_thinking: false,
      });
    } catch (err) {
      console.error("AI error", err && err.message ? err.message : err);
      return json(
        { error: "تعذر توليد التفسير الآن. حاول مرة أخرى بعد قليل." },
        502
      );
    }

    const raw = extractText(aiResult);
    const parsed = sanitizeResult(extractJson(raw));

    if (parsed) {
      await cachePut(cacheKey, parsed, CACHE_TTL_SECONDS);
      await setLastUsed(ipHash, now);
      return json(parsed);
    }

    if (raw.trim()) {
      const fallback = {
        title: "تفسير حلمك",
        analysis: stripFences(raw).slice(0, 6000),
        symbols: [],
        conclusion: "",
      };
      await cachePut(cacheKey, fallback, CACHE_TTL_SECONDS);
      await setLastUsed(ipHash, now);
      return json(fallback);
    }

    console.error(
      "Empty AI output",
      JSON.stringify(aiResult).slice(0, 500)
    );
    return json(
      { error: "لم يصل تفسير واضح. حاول صياغة الحلم بشكل مختلف." },
      502
    );
  } catch (err) {
    console.error(
      "Unhandled",
      err && err.stack ? err.stack : String(err)
    );
    return json({ error: "خطأ داخلي. حاول مرة أخرى." }, 500);
  }
}
