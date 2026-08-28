(function () {
    'use strict';

    if (window.__chatdardshaFloatingAdLoaded) return;
    window.__chatdardshaFloatingAdLoaded = true;

    var storageKey = 'chatdardsha_floating_ad_hidden_until';
    var now = Date.now();

    try {
        if (Number(localStorage.getItem(storageKey) || 0) > now) return;
    } catch (_) {
        // Continue when storage is unavailable.
    }

    var style = document.createElement('style');
    style.textContent = `
        .chatdardsha-floating-ad {
            position: fixed;
            right: 18px;
            bottom: 18px;
            z-index: 2147482000;
            direction: rtl;
            font-family: inherit;
        }
        .chatdardsha-floating-ad__panel {
            width: min(310px, calc(100vw - 36px));
            margin-bottom: 10px;
            padding: 18px 18px 16px;
            border: 1px solid rgba(255, 255, 255, .75);
            border-radius: 20px;
            background: linear-gradient(145deg, #fff7ed 0%, #ffffff 65%, #fff7ed 100%);
            color: #172033;
            box-shadow: 0 18px 50px rgba(15, 23, 42, .24);
            opacity: 0;
            pointer-events: none;
            transform: translateY(8px) scale(.98);
            transform-origin: bottom right;
            transition: opacity 160ms ease, transform 160ms ease;
        }
        .chatdardsha-floating-ad:hover .chatdardsha-floating-ad__panel,
        .chatdardsha-floating-ad:focus-within .chatdardsha-floating-ad__panel,
        .chatdardsha-floating-ad.is-open .chatdardsha-floating-ad__panel {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0) scale(1);
        }
        .chatdardsha-floating-ad__close {
            position: absolute;
            top: 7px;
            left: 8px;
            width: 28px;
            height: 28px;
            border: 0;
            border-radius: 50%;
            background: rgba(15, 23, 42, .08);
            color: #475569;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
        }
        .chatdardsha-floating-ad__eyebrow {
            display: block;
            margin-bottom: 6px;
            color: #ea580c;
            font-size: 11px;
            font-weight: 800;
        }
        .chatdardsha-floating-ad__title {
            margin: 0 0 6px;
            color: #0f172a;
            font-size: 18px;
            font-weight: 900;
            line-height: 1.35;
        }
        .chatdardsha-floating-ad__text {
            margin: 0 0 13px;
            color: #475569;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.7;
        }
        .chatdardsha-floating-ad__link {
            display: inline-flex;
            min-height: 40px;
            align-items: center;
            justify-content: center;
            width: 100%;
            border-radius: 12px;
            background: linear-gradient(135deg, #ff6a00, #ea3d00);
            color: #fff;
            text-decoration: none;
            font-size: 13px;
            font-weight: 900;
            box-shadow: 0 9px 18px rgba(234, 88, 12, .24);
            transition: transform 160ms ease;
        }
        .chatdardsha-floating-ad__link:hover {
            transform: translateY(-1px);
        }
        .chatdardsha-floating-ad__toggle {
            display: inline-flex;
            min-height: 42px;
            align-items: center;
            gap: 7px;
            border: 0;
            border-radius: 999px;
            padding: 10px 15px;
            background: #ff5a00;
            color: #fff;
            cursor: pointer;
            font: inherit;
            font-size: 13px;
            font-weight: 900;
            box-shadow: 0 11px 26px rgba(234, 88, 12, .3);
        }
        .chatdardsha-floating-ad__toggle:hover {
            background: #e94b00;
        }
        @media (max-width: 640px) {
            .chatdardsha-floating-ad {
                right: 12px;
                bottom: 12px;
                left: 12px;
            }
            .chatdardsha-floating-ad__panel {
                width: auto;
                margin-bottom: 0;
                opacity: 1;
                pointer-events: auto;
                transform: none;
            }
            .chatdardsha-floating-ad__toggle {
                display: none;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .chatdardsha-floating-ad__panel,
            .chatdardsha-floating-ad__link {
                transition: none;
            }
        }
    `;
    document.head.appendChild(style);

    var root = document.createElement('aside');
    root.className = 'chatdardsha-floating-ad';
    root.setAttribute('aria-label', 'إعلان شات دردشة');
    root.innerHTML = `
        <div class="chatdardsha-floating-ad__panel" role="region" aria-label="شات دردشة">
            <button class="chatdardsha-floating-ad__close" type="button" aria-label="إغلاق الإعلان">×</button>
            <span class="chatdardsha-floating-ad__eyebrow">تجربة عربية جديدة</span>
            <h2 class="chatdardsha-floating-ad__title">تبي تسولف؟ جرّب شات دردشة</h2>
            <p class="chatdardsha-floating-ad__text">دردشة كتابية وصوتية وتعارف فوري مع ناس عرب على الجوال والكمبيوتر.</p>
            <a class="chatdardsha-floating-ad__link" href="https://chatdardsha.com/" target="_blank" rel="noopener sponsored">ادخل شات دردشة</a>
        </div>
        <button class="chatdardsha-floating-ad__toggle" type="button" aria-expanded="false">💬 شات دردشة</button>
    `;

    document.body.appendChild(root);

    var toggle = root.querySelector('.chatdardsha-floating-ad__toggle');
    var close = root.querySelector('.chatdardsha-floating-ad__close');

    toggle.addEventListener('click', function () {
        var open = root.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
    });

    close.addEventListener('click', function () {
        root.remove();
        try {
            localStorage.setItem(storageKey, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (_) {
            // Ignore storage failures.
        }
    });
})();

