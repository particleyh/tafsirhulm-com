const TOKEN_BYTES = 16;
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
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
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SHARES) {
      return json({ status: "error", error: "خدمة المشاركة غير متاحة." }, 503);
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
