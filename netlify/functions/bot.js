const axios = require('axios');
const crypto = require('crypto');

// ==========================================
// ⚙️ الإعدادات
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs"; 
const ADMIN_ID = process.env.ADMIN_ID || "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// 🛡️ نظام الذاكرة المؤقتة لتحديد المعدل
// (ملاحظة: في Netlify قد يتم تصفير هذه الذاكرة عند إعادة تشغيل السيرفر، لكنها فعالة للحماية اللحظية)
const userRequests = new Map();

// ==========================================
// 🛠️ دوال الحماية (Rate Limiting)
// ==========================================
function isRateLimited(userId) {
    const limitCount = 20;           // الحد الأقصى: 20 رسالة
    const limitTime = 60 * 60 * 1000; // المدة: ساعة واحدة (بالمللي ثانية)
    const now = Date.now();

    if (!userRequests.has(userId)) {
        userRequests.set(userId, []);
    }

    // جلب سجل توقيتات المستخدم وتنظيف القديم منها
    let timestamps = userRequests.get(userId);
    timestamps = timestamps.filter(timestamp => now - timestamp < limitTime);

    // التحقق هل تجاوز الحد
    if (timestamps.length >= limitCount) {
        userRequests.set(userId, timestamps); // تحديث القائمة بعد التنظيف
        return true; // ⛔ محظور (تجاوز الحد)
    }

    // تسجيل الطلب الجديد
    timestamps.push(now);
    userRequests.set(userId, timestamps);
    return false; // ✅ مسموح
}

// ==========================================
// 🛠️ باقي الأدوات (كما هي)
// ==========================================
async function checkIP(target) {
    try {
        const res = await axios.get(`http://ip-api.com/json/${target}`);
        const data = res.data;
        if (data.status === 'fail') return "❌ العنوان غير صحيح.";
        return `🌍 **تقرير IP:**\n🔹 IP: \`${data.query}\`\n🔹 الدولة: ${data.country}\n🔹 الشبكة: ${data.isp}`;
    } catch (e) { return "❌ خطأ في الاتصال."; }
}

async function checkApiStatus(targetNumber) {
    // دالة الفحص الآمن (بديلة للإسبام)
    return `🔍 **فحص حالة الرقم:** \`${targetNumber}\`\n✅ الخدمة متاحة (Simulation Mode).`;
}

// ... (يمكنك إضافة باقي دوال الأدوات القديمة هنا مثل findAdmin وغيرها) ...

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

        // 🛑 خطوة الحماية الأولى: فحص المعدل
        // نستثني الأدمن (أنت) من الحظر
        if (String(chatId) !== ADMIN_ID && isRateLimited(chatId)) {
            await axios.post(TELEGRAM_API, {
                chat_id: chatId,
                text: "⛔ **عفواً، لقد تجاوزت الحد المسموح (20 طلب في الساعة).**\nيرجى المحاولة لاحقاً.",
                parse_mode: "Markdown"
            });
            return { statusCode: 200, body: "Rate Limited" };
        }

        let replyText = "";

        // --- الأوامر ---
        if (text === "/start") {
            replyText = `👮‍♂️ **أهلاً بك يا ${firstName}**\n\nنظام الحماية مفعل: 20 طلب/ساعة كحد أقصى.`;
        }
        else if (text.startsWith("/ip ")) {
            replyText = await checkIP(text.split(" ")[1]);
        }
        else if (text.startsWith("/check ")) {
            replyText = await checkApiStatus(text.split(" ")[1]);
        }
        else {
            replyText = "💡 الأوامر المتاحة:\n`/ip google.com`\n`/check 01xxxxxxxxx`";
        }

        // إرسال الرد
        await axios.post(TELEGRAM_API, {
            chat_id: chatId,
            text: replyText,
            parse_mode: "Markdown"
        });

        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
