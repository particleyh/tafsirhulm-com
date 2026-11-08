const TOKEN_BYTES = 16;
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year
const DAILY_SHARE_CAP = 30;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-api-key, authorization",
    },
  });
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

function requireApiKey(request, env) {
  const expected = env.API_KEY;
  if (!expected) return json({ status: "error", error: "خدمة غير مهيأة." }, 503);
  const header =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization") ||
    "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (provided && timingSafeEqual(provided, expected)) return null;

  const origin = (request.headers.get("origin") || "").toLowerCase();
  const referer = (request.headers.get("referer") || "").toLowerCase();
  const allowed = ["https://tafsirhulm.com", "http://tafsirhulm.com", "https://www.tafsirhulm.com"];
  const trusted =
    allowed.some((a) => origin === a || origin.startsWith(a + "/")) ||
    allowed.some((a) => referer.startsWith(a + "/") || referer === a);
  if (!provided && trusted) return null;

  return json({ status: "error", error: "مفتاح API غير صالح أو مفقود." }, 401);
}

function getIP(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown"
  );
}

async function checkDailyShareCap(ip) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`share_day|${ip}|${day}`)
    );
    const idHash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const key = new Request(`https://cooldown.internal/share_day/${idHash}`);
    const hit = await caches.default.match(key);
    let count = 0;
    if (hit) {
      const n = parseInt(await hit.text(), 10);
      if (Number.isFinite(n)) count = n;
    }
    if (count >= DAILY_SHARE_CAP) return true;
    await caches.default.put(
      key,
      new Response(String(count + 1), {
        headers: { "cache-control": "public, max-age=86400" },
      })
    );
    return false;
  } catch (_) {
    return false;
  }
}

function generateToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitize(str, max) {
  return typeof str === "string" ? str.trim().slice(0, max) : "";
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-api-key, authorization",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const authErr = requireApiKey(request, env);
    if (authErr) return authErr;

    if (!env.SHARES) {
      return json({ status: "error", error: "خدمة المشاركة غير متاحة." }, 503);
    }

    if (await checkDailyShareCap(getIP(request))) {
      return json(
        {
          status: "error",
          error: "وصلت للحد اليومي للمشاركة. حاول غداً.",
          retry_after: 86400,
        },
        429
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return json({ status: "error", error: "طلب غير صالح." }, 400);
    }

    const dream = sanitize(payload?.dream, 3000);
    const interpretation = sanitize(payload?.interpretation, 8000);
    if (dream.length < 10 || interpretation.length < 10) {
      return json(
        { status: "error", error: "البيانات غير مكتملة للمشاركة." },
        400
      );
    }

    const gender =
      payload?.gender === "female" || payload?.gender === "male"
        ? payload.gender
        : "";

    const questions = Array.isArray(payload?.questions)
      ? payload.questions
          .map((q) => sanitize(q, 300))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    const answers = Array.isArray(payload?.answers)
      ? payload.answers
          .map((a) => sanitize(a, 1000))
          .slice(0, 12)
      : [];

    const token = generateToken();
    const record = {
      dream,
      gender,
      questions,
      answers,
      interpretation,
      created_at: Date.now(),
    };

    await env.SHARES.put(`share:${token}`, JSON.stringify(record), {
      expirationTtl: SHARE_TTL_SECONDS,
    });

    return json({
      status: "success",
      data: {
        token,
        url: `https://tafsirhulm.com/s/${token}`,
      },
    });
  } catch (err) {
    console.error(
      "share unhandled",
      err && err.stack ? err.stack : String(err)
    );
    return json({ status: "error", error: "خطأ داخلي." }, 500);
  }
}
