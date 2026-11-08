function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pageHtml(record) {
  const genderLabel =
    record.gender === "male"
      ? "ذكر"
      : record.gender === "female"
        ? "أنثى"
        : "غير محدد";
  const created = record.created_at
    ? new Date(record.created_at).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const qaHtml =
    record.questions?.length && record.answers?.length
      ? `<section class="qa">
          <h2>أسئلة الحلم</h2>
          ${record.questions
            .map((q, i) => {
              const a = record.answers[i];
              if (!a) return "";
              return `<div class="qa-item">
                <p class="q">${i + 1}. ${escapeHtml(q)}</p>
                <p class="a">${escapeHtml(a)}</p>
              </div>`;
            })
            .join("")}
        </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>حلم مشارك — تفسير أحلام</title>
<meta name="description" content="تفسير حلم مشارك عبر رابط خاص">
<link rel="icon" type="image/png" href="/mainTheme/favicon.png">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, 'Noto Kufi Arabic', sans-serif;
    background: linear-gradient(180deg, #101820 0%, #132330 55%, #0C1218 100%);
    color: #fff;
    min-height: 100vh;
    line-height: 1.85;
    padding: 32px 16px 64px;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  .badge {
    display: inline-block;
    font-size: 0.78rem;
    color: #0C1218;
    background: linear-gradient(135deg, #F7D56D, #E0B84D);
    padding: 4px 14px;
    border-radius: 999px;
    font-weight: 700;
    margin-bottom: 18px;
  }
  h1 {
    font-size: clamp(1.5rem, 4vw, 2rem);
    background: linear-gradient(135deg, #FFD700, #F5D76E);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 8px;
  }
  .meta { color: #8091A5; font-size: 0.9rem; margin-bottom: 28px; }
  .card {
    background: #16212C;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .card h2 {
    font-size: 1rem;
    color: #F1CC69;
    margin-bottom: 14px;
    font-weight: 700;
  }
  .dream { white-space: pre-wrap; color: #D5DEE8; font-size: 1.05rem; }
  .interp { white-space: pre-wrap; color: #E8EEF5; font-size: 1.05rem; }
  .qa-item {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 12px;
  }
  .qa-item .q { color: #9FB0C0; font-size: 0.92rem; margin-bottom: 6px; }
  .qa-item .a { color: #fff; font-size: 0.98rem; }
  .foot { text-align: center; margin-top: 36px; }
  .foot a {
    color: #FFD700;
    text-decoration: none;
    font-weight: 700;
    border: 1px solid rgba(255,215,0,0.35);
    padding: 12px 28px;
    border-radius: 999px;
    display: inline-block;
  }
  .foot a:hover { background: rgba(255,215,0,0.08); }
</style>
</head>
<body>
<div class="wrap">
  <span class="badge">رابط خاص</span>
  <h1>تفسير حلم مشارك</h1>
  <p class="meta">${genderLabel}${created ? " · " + escapeHtml(created) : ""}</p>

  <section class="card">
    <h2>الحلم</h2>
    <p class="dream">${escapeHtml(record.dream)}</p>
  </section>

  ${qaHtml}

  <section class="card">
    <h2>التفسير</h2>
    <p class="interp">${escapeHtml(record.interpretation)}</p>
  </section>

  <div class="foot">
    <a href="/">فسّر حلمك أنت أيضاً</a>
  </div>
</div>
</body>
</html>`;
}

export async function onRequestGet({ params, env }) {
  const token = String(params?.token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return new Response(
      `<!DOCTYPE html><html lang="ar" dir="rtl"><body style="background:#0C1218;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1>الرابط غير صالح</h1><p style="color:#8091A5;margin-top:12px">هذا الرابط غير موجود أو انتهت صلاحيته.</p><a href="/" style="color:#FFD700;display:inline-block;margin-top:20px">العودة للرئيسية</a></div></body></html>`,
      {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      }
    );
  }

  try {
    const raw = await env.SHARES?.get(`share:${token}`);
    if (!raw) {
      return new Response(
        `<!DOCTYPE html><html lang="ar" dir="rtl"><body style="background:#0C1218;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1>الرابط غير صالح</h1><p style="color:#8091A5;margin-top:12px">هذا الرابط غير موجود أو انتهت صلاحيته.</p><a href="/" style="color:#FFD700;display:inline-block;margin-top:20px">العودة للرئيسية</a></div></body></html>`,
        {
          status: 404,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow",
          },
        }
      );
    }

    const record = JSON.parse(raw);
    return new Response(pageHtml(record), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    console.error(
      "share view unhandled",
      err && err.stack ? err.stack : String(err)
    );
    return new Response("خطأ داخلي", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
