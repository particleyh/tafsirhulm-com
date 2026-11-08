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
  requireApiKey,
  checkDailyCap,
} from "./_shared.js";

const COOLDOWN_MS = 10_000;
const NAMESPACE = "mstart";
const QUESTION_COUNT = 4;
const DAILY_AI_CAP = 150; // high enough for carrier NAT (shared mobile IPs)

const SYSTEM_PROMPT = `أنت "الجد حلمي"، مفسر أحلام عربي محترف.
سيصلك نص حلم من مستخدم. اكتب له ${QUESTION_COUNT} أسئلة توضيحية قصيرة (سطر واحد لكل سؤال) تساعد على فهم الحلم وتفسيره بشكل أدق: مشاعره أثناء الحلم، هوية الأشخاص الظاهرين، هل يكرر الحلم، وأي تفاصيل ناقصة.
الأسئلة تكون بالعربية الفصحى المبسطة، مباشرة ومحايدة، بدون تخويف.
أعد JSON فقط بدون أي نص آخر: ["سؤال أول","سؤال ثان","سؤال ثال","سؤال رابع"]`;

function sanitizeQuestions(parsed) {
  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.questions)) arr = parsed.questions;
  if (!arr) return null;
  const questions = arr
    .map((q) =>
      typeof q === "string"
        ? q.trim()
        : q && typeof q.question === "string"
          ? q.question.trim()
          : ""
    )
    .filter(Boolean)
    .slice(0, 8)
    .map((q) => q.slice(0, 300));
  return questions.length > 0 ? questions : null;
}

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost({ request, env }) {
  try {
    const authErr = requireApiKey(request, env);
    if (authErr) return authErr;

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
      return json(
        { status: "error", error: "اكتب حلمك بشكل أوضح." },
        400
      );
    }
    if (dream.length > MAX_DREAM_LEN) {
      return json(
        {
          status: "error",
          error: `الحلم طويل جداً. الحد الأقصى ${MAX_DREAM_LEN} حرف.`,
        },
        400
      );
    }

    const gender =
      payload?.gender === "female" || payload?.gender === "male"
        ? payload.gender
        : "";
    const deviceId =
      typeof payload?.device_id === "string" && payload.device_id.trim()
        ? payload.device_id.trim().slice(0, 128)
        : generateGuestId();
    const guestId =
      typeof payload?.guest_id === "string" && payload.guest_id.trim()
        ? payload.guest_id.trim().slice(0, 128)
        : deviceId;

    const ip = getIP(request);
    const rateHash = await sha256Hex(`${deviceId}|${ip}`);
    const waitSec = await checkCooldown(NAMESPACE, rateHash, COOLDOWN_MS);
    if (waitSec) {
      return json(
        {
          status: "error",
          error: `انتظر ${waitSec} ثانية بين كل طلب وآخر.`,
          retry_after: waitSec,
        },
        429
      );
    }

    const daily = await checkDailyCap(env, ip, DAILY_AI_CAP, "mstart_day");
    if (daily.limited) {
      return json(
        {
          status: "error",
          error: "وصلت للحد اليومي. حاول غداً.",
          retry_after: daily.retry_after,
        },
        429
      );
    }

    const cacheKey = new Request(
      `https://cache.internal/mstart/${await sha256Hex(
        `${normalizeDream(dream)}|${gender}`
      )}`
    );
    const cached = await cacheGet(cacheKey);
    if (cached && Array.isArray(cached.questions) && cached.questions.length) {
      await setLastUsed(NAMESPACE, rateHash, Date.now());
      return json({
        status: "success",
        data: {
          guest_id: guestId,
          questions: cached.questions,
          total_questions: cached.questions.length,
        },
      });
    }

    let raw;
    try {
      const aiResult = await callAI(
        env,
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `نص الحلم:\n${dream}`,
          },
        ],
        400
      );
      raw = extractText(aiResult);
    } catch (err) {
      console.error(
        "start AI error",
        err && err.message ? err.message : err
      );
      return json(
        { status: "error", error: "تعذر توليد الأسئلة الآن. حاول مرة أخرى." },
        502
      );
    }

    const questions = sanitizeQuestions(extractJson(raw));
    if (!questions) {
      console.error("start bad output", raw.slice(0, 300));
      return json(
        { status: "error", error: "لم تصل أسئلة صالحة. حاول مرة أخرى." },
        502
      );
    }

    await cachePut(cacheKey, { questions });
    await setLastUsed(NAMESPACE, rateHash, Date.now());

    return json({
      status: "success",
      data: {
        guest_id: guestId,
        questions,
        total_questions: questions.length,
      },
    });
  } catch (err) {
    console.error(
      "start unhandled",
      err && err.stack ? err.stack : String(err)
    );
    return json({ status: "error", error: "خطأ داخلي." }, 500);
  }
}
