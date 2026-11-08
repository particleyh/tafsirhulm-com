import {
  MIN_DREAM_LEN,
  MAX_DREAM_LEN,
  json,
  preflight,
  sha256Hex,
  cacheGet,
  cachePut,
  checkCooldown,
  setLastUsed,
  getIP,
  extractJson,
  extractText,
  callAI,
  normalizeDream,
  generateGuestId,
} from "./_shared.js";

const COOLDOWN_MS = 10_000;
const NAMESPACE = "mget";

const SYSTEM_PROMPT = `أنت "الجد حلمي"، مفسر أحلام عربي محترف بخبرة في كتب التفسير والنفسيات.
فسّر الحلم الذي يصلك مع مراعاة إجابات الحالم على الأسئلة التوضيحية إن وُجدت.
قواعد:
- اكتب بالعربية الفصحى المبسطة المفهومة للقارئ العام
- اربط كل رمز في الحلم بدلالة واقعية مرتبطة بسياق الحلم وحالته النفسية
- لا تصدر أحكاماً قطعية أو تخويفاً؛ قدّم قراءات محتملة متعددة بلطف
- لا تخترع تفاصيل غير موجودة في الحلم
- الطول الكلي بين 180 و 350 كلمة

أعد JSON فقط بدون أي نص آخر وبدون علامات اقتباس:
{"title":"عنوان قصير للفهم","analysis":"تحليل كامل منظم بفقرات مفصولة بأسطر","symbols":[{"symbol":"الرمز","meaning":"الدلالة"}],"conclusion":"خلاصة عملية في سطرين"}`;

function parseAnswers(raw) {
  if (Array.isArray(raw)) {
    return raw.map((a) => String(a ?? "").trim()).slice(0, 20);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((a) => String(a ?? "").trim()).slice(0, 20);
      }
    } catch (_) {}
    return raw.trim() ? [raw.trim()] : [];
  }
  return [];
}

function composeInterpretation(data) {
  if (!data || typeof data !== "object") return "";
  const parts = [];
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const analysis =
    typeof data.analysis === "string" ? data.analysis.trim() : "";
  const conclusion =
    typeof data.conclusion === "string" ? data.conclusion.trim() : "";
  if (title) parts.push(title);
  if (analysis) parts.push(analysis);
  if (Array.isArray(data.symbols)) {
    const lines = data.symbols
      .filter((s) => s && typeof s === "object")
      .map((s) => {
        const sym = String(s.symbol ?? "").trim();
        const mean = String(s.meaning ?? "").trim();
        return sym ? "- " + sym + ": " + mean : "";
      })
      .filter(Boolean)
      .slice(0, 10);
    if (lines.length) parts.push("أبرز الرموز:\n" + lines.join("\n"));
  }
  if (conclusion) parts.push("الخلاصة:\n" + conclusion);
  return parts.join("\n\n");
}

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) {
      return json(
        { status: "error", error: "خدمة التفسير غير متاحة حالياً." },
        503
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return json({ status: "error", error: "طلب غير صالح." }, 400);
    }

    const dream =
      typeof payload?.dream === "string" ? payload.dream.trim() : "";
    if (dream.length < MIN_DREAM_LEN) {
      return json({ status: "error", error: "اكتب حلمك بشكل أوضح." }, 400);
    }
    if (dream.length > MAX_DREAM_LEN) {
      return json(
        {
          status: "error",
          error: "الحلم طويل جداً. الحد الأقصى " + MAX_DREAM_LEN + " حرف.",
        },
        400
      );
    }

    const gender =
      payload?.gender === "female" || payload?.gender === "male"
        ? payload.gender
        : "";
    const answers = parseAnswers(payload?.answers);
    const guestId =
      typeof payload?.guest_id === "string" && payload.guest_id.trim()
        ? payload.guest_id.trim().slice(0, 128)
        : generateGuestId();

    const ip = getIP(request);
    const rateHash = await sha256Hex(guestId + "|" + ip);
    const waitSec = await checkCooldown(NAMESPACE, rateHash, COOLDOWN_MS);
    if (waitSec) {
      return json(
        {
          status: "error",
          error: "انتظر " + waitSec + " ثانية بين كل طلب وآخر.",
          retry_after: waitSec,
        },
        429
      );
    }

    const answersKey = answers.join("|");
    const dreamKey = normalizeDream(dream);
    const cacheKey = new Request(
      "https://cache.internal/mget/" +
        (await sha256Hex(dreamKey + "|" + gender + "|" + answersKey))
    );
    const cached = await cacheGet(cacheKey);
    if (cached && typeof cached.interpretation === "string") {
      await setLastUsed(NAMESPACE, rateHash, Date.now());
      return json({
        status: "success",
        data: { interpretation: cached.interpretation },
      });
    }

    const genderLabel =
      gender === "male" ? "ذكر" : gender === "female" ? "أنثى" : "غير محدد";
    let answersBlock = "";
    if (answers.length) {
      answersBlock =
        "\n\nإجاباته على الأسئلة التوضيحية:\n" +
        answers
          .map((a, i) => (i + 1) + ") " + (a || "(بدون إجابة)"))
          .join("\n");
    }

    let raw;
    try {
      const aiResult = await callAI(
        env,
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "نص الحلم:\n" +
              dream +
              "\n\nجنس الحالم: " +
              genderLabel +
              answersBlock,
          },
        ],
        900
      );
      raw = extractText(aiResult);
    } catch (err) {
      console.error("get AI error", err && err.message ? err.message : err);
      return json(
        { status: "error", error: "تعذر توليد التفسير الآن. حاول مرة أخرى." },
        502
      );
    }

    const parsed = extractJson(raw);
    let interpretation = composeInterpretation(parsed);
    if (!interpretation && raw && raw.trim()) {
      interpretation = raw.trim().slice(0, 6000);
    }
    if (!interpretation) {
      console.error("get bad output", String(raw).slice(0, 300));
      return json(
        { status: "error", error: "لم يصل تفسير واضح. حاول مرة أخرى." },
        502
      );
    }

    await cachePut(cacheKey, { interpretation });
    await setLastUsed(NAMESPACE, rateHash, Date.now());

    return json({
      status: "success",
      data: { interpretation },
    });
  } catch (err) {
    console.error(
      "get unhandled",
      err && err.stack ? err.stack : String(err)
    );
    return json({ status: "error", error: "خطأ داخلي." }, 500);
  }
}
