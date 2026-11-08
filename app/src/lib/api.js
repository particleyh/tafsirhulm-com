const API_BASE = "https://tafsirhulm.com/api/mobile";
const SHARE_API = "https://tafsirhulm.com/api/share";
const API_KEY = "x3HY7BBYp5q625OJXQ8h6LkVLCKMDYAx";

async function post(url, body, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) {
      const err = new Error(
        (data && (data.error || data.message)) || "حدث خطأ، حاول مرة أخرى."
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function startInterpretation({ dream, gender }) {
  const data = await post(`${API_BASE}/start-interpretation`, {
    dream,
    gender,
  });
  const d = data && data.data ? data.data : data;
  return {
    guestId: (d && d.guest_id) || "",
    questions: (d && d.questions) || [],
  };
}

export async function getInterpretation({ dream, gender, answers, guestId }) {
  const data = await post(
    `${API_BASE}/get-interpretation`,
    {
      dream,
      gender,
      answers: JSON.stringify(answers),
      guest_id: guestId,
    },
    60000
  );
  const d = data && data.data ? data.data : data;
  const raw =
    (d && (d.interpretation || d.result)) ||
    (data && (data.interpretation || data.result)) ||
    "";
  if (!raw || String(raw).length < 10) {
    throw new Error("لم يتم استلام تفسير صالح من الخادم.");
  }
  return String(raw);
}

export async function createShare({ dream, gender, questions, answers, interpretation }) {
  const data = await post(
    SHARE_API,
    { dream, gender, questions, answers, interpretation },
    20000
  );
  const d = data && data.data ? data.data : data;
  if (!d || !d.url) throw new Error("تعذر إنشاء الرابط.");
  return d.url;
}

export function prettyInterpretation(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const title = parsed.title || parsed.heading || "";
      const body =
        parsed.analysis ||
        parsed.body ||
        parsed.text ||
        parsed.interpretation ||
        "";
      const symbols = Array.isArray(parsed.symbols) ? parsed.symbols : null;
      let out = "";
      if (title) out += `${title}\n\n`;
      if (body) out += body;
      if (symbols && symbols.length) {
        out += `\n\nرموز الحلم: ${symbols.join("، ")}`;
      }
      return out || raw;
    }
  } catch (_) {}
  return raw;
}
