const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns');

// ==========================================
// ⚙️ إعدادات البوت والبيانات
// ==========================================
// سيقوم الكود بجلب التوكن والأدمن ID تلقائياً من إعدادات Netlify لو كنت وضعتها هناك
// أو يمكنك كتابتها هنا مباشرة للتجربة السريعة:
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs"; 
const ADMIN_ID = process.env.ADMIN_ID || "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// ==========================================
// 🛠️ دوال الأدوات (Helper Functions)
// ==========================================

// 1. فحص IP
async function checkIP(target) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${target}`);
        const data = response.data;
        if (data.status === 'fail') return "❌ العنوان غير صحيح أو لا يوجد بيانات.";
        
        return `🌍 **تقرير IP:**\n` +
               `🔹 الـ IP: \`${data.query}\`\n` +
               `🔹 الدولة: ${data.country} (${data.countryCode})\n` +
               `🔹 المدينة: ${data.city}\n` +
               `🔹 الشبكة (ISP): ${data.isp}\n` +
               `🔹 النطاق الزمني: ${data.timezone}`;
    } catch (e) { return "❌ خطأ في الاتصال بخدمة IP."; }
}

// 2. كاشف لوحة التحكم (Admin Finder)
async function findAdmin(url) {
    if (!url.startsWith('http')) url = 'http://' + url;
    // قائمة مختصرة لتناسب وقت السيرفر (Serverless Timeout)
    const paths = ['/admin', '/login', '/wp-admin', '/cpanel', '/dashboard', '/admin/login.php'];
    let found = "";
    
    // فحص المسارات بالتوازي (Parallel) لسرعة قصوى
    const promises = paths.map(async (path) => {
        try {
            const res = await axios.get(url + path, { timeout: 2000, validateStatus: false });
            if (res.status === 200) found += `✅ وجدنا: ${url + path}\n`;
        } catch (e) {}
    });
    
    await Promise.all(promises);
    return found ? found : "❌ لم يتم العثور على مسارات مشهورة في هذه القائمة السريعة.";
}

// 3. فحص الهيدرز (Headers)
async function checkHeaders(url) {
    if (!url.startsWith('http')) url = 'http://' + url;
    try {
        const res = await axios.head(url, { timeout: 5000 });
        let headers = "";
        for (const [key, value] of Object.entries(res.headers)) {
            headers += `🔹 **${key}:** \`${value}\`\n`;
        }
        return `📑 **بيانات الهيدرز (Headers):**\n\n${headers}`.substring(0, 4000);
    } catch (e) { return "❌ لا يمكن الوصول للموقع أو الرابط خطأ."; }
}

// 4. بريد مؤقت
async function getTempMail() {
    try {
        const res = await axios.get("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1");
        return `📧 **بريدك المؤقت:**\n\`${res.data[0]}\`\n\n(استخدم موقع 1secmail لقراءة الرسائل)`;
    } catch (e) { return "❌ خطأ في خدمة البريد."; }
}

// 5. كسر هاش MD5 (قائمة بسيطة)
function crackMD5(hash) {
    const wordlist = ['123456', 'password', 'admin', 'welcome', '12345678', 'root', '12345', 'user'];
    for (let word of wordlist) {
        const md5 = crypto.createHash('md5').update(word).digest('hex');
        if (md5 === hash) return `✅ **تم الكسر!** الكلمة هي: \`${word}\``;
    }
    return "❌ فشل الكسر (غير موجود في القائمة البسيطة).";
}

// ==========================================
// 🚀 المعالج الرئيسي (Main Handler)
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

        // -- القائمة الرئيسية --
        const mainMenu = {
            keyboard: [
                [{ text: "🌍 معلومات IP" }, { text: "❓ معلومات Whois" }],
                [{ text: "🔍 بحث يوزر" }, { text: "🌐 فحص منافذ" }],
                [{ text: "🚪 كاشف أدمن" }, { text: "📑 فحص Headers" }],
                [{ text: "🔐 تشفير Base64" }, { text: "🔨 كسر MD5" }],
                [{ text: "📧 بريد مؤقت" }, { text: "🔑 توليد باسوورد" }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        };

        // --- معالجة الأوامر والنصوص ---

        if (text === "/start") {
            replyText = `👮‍♂️ **أهلاً بك يا ${firstName} في بوت الأدوات السيبرانية (Node.js Edition)**\n\n` +
                        `اضغط على الأزرار بالأسفل لمعرفة كيفية استخدام كل أداة 👇`;
            keyboard = mainMenu;

        } 
        // 1. IP Info
        else if (text === "🌍 معلومات IP") {
            replyText = "💡 **طريقة الاستخدام:**\nأرسل الأمر متبوعاً بالدومين أو IP.\nمثال: `/ip google.com`";
        } else if (text.startsWith("/ip ")) {
            const target = text.split(" ")[1];
            replyText = await checkIP(target);
        }

        // 2. Whois (مبسط)
        else if (text === "❓ معلومات Whois") {
            replyText = "💡 **طريقة الاستخدام:**\nأرسل الأمر: `/whois google.com`";
        } else if (text.startsWith("/whois ")) {
            const target = text.split(" ")[1];
            replyText = `ℹ️ للحصول على معلومات Whois كاملة لهذا النطاق، يرجى زيارة:\nhttps://who.is/whois/${target}`;
        }

        // 3. User Search
        else if (text === "🔍 بحث يوزر") {
            replyText = "💡 **طريقة الاستخدام:**\nأرسل الأمر: `/user aboelfadl`";
        } else if (text.startsWith("/user ")) {
            const user = text.split(" ")[1];
            replyText = `🔍 **نتائج البحث المبدئي عن ${user}:**\n\n` +
                        `👤 Facebook: facebook.com/${user}\n` +
                        `📸 Instagram: instagram.com/${user}\n` +
                        `🐦 Twitter: twitter.com/${user}\n` +
                        `🐙 GitHub: github.com/${user}\n` +
                        `🎵 TikTok: tiktok.com/@${user}`;
        }

        // 4. Ports (Simulated for Safety)
        else if (text === "🌐 فحص منافذ") {
            replyText = "⚠️ فحص المنافذ الكامل محظور على السيرفرات السحابية المجانية.\n" + 
                        "💡 **جرب الفحص السريع:** `/scan google.com`";
        } else if (text.startsWith("/scan ")) {
            replyText = `🔒 **فحص المنافذ (Simulation):**\n\n` +
                        `يتم الآن فحص المنافذ الأساسية (80, 443)...\n` +
                        `⚠️ *ملاحظة:* للحصول على فحص حقيقي استخدم Nmap على جهازك الشخصي.`;
        }

        // 5. Admin Finder
        else if (text === "🚪 كاشف أدمن") {
            replyText = "💡 **طريقة الاستخدام:**\nأرسل الأمر: `/admin google.com`";
        } else if (text.startsWith("/admin ")) {
            const url = text.split(" ")[1];
            replyText = "⏳ جاري الفحص... (قد يستغرق بضع ثوانٍ)";
            // نرسل رسالة انتظار أولاً (اختياري، هنا سنرسل النتيجة مباشرة لسرعة الرد)
            replyText = await findAdmin(url);
        }

        // 6. Headers
        else if (text === "📑 فحص Headers") {
            replyText = "💡 **طريقة الاستخدام:**\nأرسل الأمر: `/head google.com`";
        } else if (text.startsWith("/head ")) {
            const url = text.split(" ")[1];
            replyText = await checkHeaders(url);
        }

        // 7. Base64
        else if (text === "🔐 تشفير Base64") {
            replyText = "💡 **طريقة الاستخدام:**\nللتشفير: `/en النص`\nلفك التشفير: `/de النص_المشفر`";
        } else if (text.startsWith("/en ")) {
            const raw = text.replace("/en ", "");
            const encoded = Buffer.from(raw).toString('base64');
            replyText = `🔒 **تشفير:**\n\`${encoded}\``;
        } else if (text.startsWith("/de ")) {
            const raw = text.replace("/de ", "");
            const decoded = Buffer.from(raw, 'base64').toString('utf-8');
            replyText = `🔓 **فك تشفير:**\n\`${decoded}\``;
        }

        // 8. MD5 Crack
        else if (text === "🔨 كسر MD5") {
            replyText = "💡 **طريقة الاستخدام:**\nأرسل الأمر: `/md5 الهاش`";
        } else if (text.startsWith("/md5 ")) {
            const hash = text.split(" ")[1];
            replyText = crackMD5(hash);
        }

        // 9. Temp Mail
        else if (text === "📧 بريد مؤقت") {
            replyText = await getTempMail();
        }

        // 10. Password Generator
        else if (text === "🔑 توليد باسوورد") {
            const pass = crypto.randomBytes(8).toString('hex') + "!@#";
            replyText = `🔑 **كلمة مرور مقترحة:**\n\`${pass}\``;
        }

        // رسالة افتراضية
        else {
            replyText = "⚠️ لم أفهم هذا الأمر. استخدم القائمة بالأسفل.";
            keyboard = mainMenu;
        }

        // إرسال الرد
        const payload = {
            chat_id: chatId,
            text: replyText,
            parse_mode: "Markdown"
        };
        if (keyboard) payload.reply_markup = keyboard;

        await axios.post(TELEGRAM_API, payload);

        // مراقبة النشاط (إرسال نسخة للأدمن إذا لم يكن هو المستخدم)
        if (String(chatId) !== ADMIN_ID) {
            await axios.post(TELEGRAM_API, {
                chat_id: ADMIN_ID,
                text: `🚨 **نشاط جديد:**\n👤 ${firstName}\n📝 ${text}`
            });
        }

        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
