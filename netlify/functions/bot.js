const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns').promises;
const https = require('https');

// ==========================================
// ⚙️ الإعدادات
// ==========================================
// ⚠️ تأكد من وضع التوكن والـ ID الخاص بك هنا بدلاً من النصوص المؤقتة
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "8519648833:AAHeg8gNX7P1UZabWKcqeFJv0NAggRzS3Qs"; 
const ADMIN_ID = process.env.ADMIN_ID || "1431886140"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ==========================================
// 🎹 لوحات المفاتيح (Keyboards)
// ==========================================

const keyboards = {
    main: {
        keyboard: [
            [{ text: "🌐 أدوات الشبكة" }, { text: "🔐 الأمن والتشفير" }],
            [{ text: "🛠 أدوات المطورين" }, { text: "💰 خدمات عامة" }],
            [{ text: "🤖 أدوات ذكية" }, { text: "ℹ️ حول البوت" }]
        ],
        resize_keyboard: true
    },
    network: {
        keyboard: [
            [{ text: "🔍 فحص DNS" }, { text: "🔒 فحص SSL" }],
            [{ text: "🔗 فك رابط مختصر" }, { text: "🆙 حالة الموقع" }],
            [{ text: "📑 استخراج الميتا" }, { text: "👤 Whois" }],
            [{ text: "🔙 القائمة الرئيسية" }]
        ],
        resize_keyboard: true
    },
    security: {
        keyboard: [
            [{ text: "#️⃣ مولد MD5" }, { text: "#️⃣ مولد SHA256" }],
            [{ text: "🔑 قوة الباسورد" }, { text: "🆔 مولد UUID" }],
            [{ text: "🔣 تشفير URL" }, { text: "🔙 القائمة الرئيسية" }]
        ],
        resize_keyboard: true
    },
    dev: {
        keyboard: [
            [{ text: "📋 تنسيق JSON" }, { text: "🐙 معلومات GitHub" }],
            [{ text: "🎨 تحويل ألوان" }, { text: "🔙 القائمة الرئيسية" }]
        ],
        resize_keyboard: true
    },
    general: {
        keyboard: [
            [{ text: "🪙 سعر العملات" }, { text: "🌤 الطقس" }],
            [{ text: "📱 باركود QR" }, { text: "🔙 القائمة الرئيسية" }]
        ],
        resize_keyboard: true
    },
    ai: {
        keyboard: [
            [{ text: "💡 معلومة عشوائية" }, { text: "🔙 القائمة الرئيسية" }]
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 🛠️ دوال المساعدة (Helper Functions)
// ==========================================

// 1. فحص DNS
async function checkDNS(domain) {
    try {
        const a = await dns.resolve4(domain).catch(() => []);
        const mx = await dns.resolveMx(domain).catch(() => []);
        const ns = await dns.resolveNs(domain).catch(() => []);
        return `🌍 **DNS لـ ${domain}:**\n🔹 **A:** ${a.join(', ')}\n🔹 **MX:** ${mx.map(m=>m.exchange).join(', ')}\n🔹 **NS:** ${ns.join(', ')}`;
    } catch { return "❌ خطأ في النطاق."; }
}

// 2. فحص SSL
function checkSSL(domain) {
    return new Promise((resolve) => {
        if (!domain.startsWith('https://')) domain = 'https://' + domain;
        try {
            const url = new URL(domain);
            const req = https.request({ host: url.hostname, port: 443, method: 'GET', agent: false, rejectUnauthorized: false }, (res) => {
                const cert = res.connection.getPeerCertificate();
                if (!cert || !Object.keys(cert).length) resolve("❌ لا توجد شهادة.");
                const validTo = new Date(cert.valid_to);
                const daysLeft = Math.floor((validTo - new Date()) / (86400000));
                resolve(`🔒 **SSL:**\n🔹 **المصدر:** ${cert.issuer.O}\n⏳ **الأيام:** ${daysLeft}`);
            });
            req.on('error', () => resolve("❌ خطأ اتصال."));
            req.end();
        } catch { resolve("❌ رابط غير صحيح."); }
    });
}

// 3. أدوات أخرى (مختصرة للأداء)
async function getWeather(city) {
    try {
        const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        if (!geo.data.results) return "❌ مدينة خاطئة.";
        const { latitude, longitude, name, country } = geo.data.results[0];
        const w = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        return `🌤 **${name}, ${country}:** ${w.data.current_weather.temperature}°C`;
    } catch { return "❌ خدمة الطقس متوقفة."; }
}

// ==========================================
// 🚀 المعالج الرئيسي (Router)
// ==========================================
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const body = JSON.parse(event.body);
        if (!body.message || !body.message.text) return { statusCode: 200, body: "No Text" };

        const chatId = body.message.chat.id;
        const text = body.message.text.trim();
        
        let reply = "";
        let keyboard = null;
        let method = "sendMessage";
        let extra = { parse_mode: "Markdown" };

        // --- 1. معالجة القوائم (Navigation) ---
        if (text === "/start" || text === "🔙 القائمة الرئيسية") {
            reply = "👋 **أهلاً بك في البوت الشامل!**\nاختر قسماً من القائمة بالأسفل 👇";
            keyboard = keyboards.main;
        }
        else if (text === "🌐 أدوات الشبكة") {
            reply = "🌐 **قسم الشبكات:**\nاختر الأداة:";
            keyboard = keyboards.network;
        }
        else if (text === "🔐 الأمن والتشفير") {
            reply = "🔐 **قسم الأمن:**\nاختر الأداة:";
            keyboard = keyboards.security;
        }
        else if (text === "🛠 أدوات المطورين") {
            reply = "🛠 **قسم المطورين:**\nاختر الأداة:";
            keyboard = keyboards.dev;
        }
        else if (text === "💰 خدمات عامة") {
            reply = "💰 **خدمات عامة:**\nاختر الأداة:";
            keyboard = keyboards.general;
        }
        else if (text === "🤖 أدوات ذكية") {
            reply = "🤖 **ذكاء وترفيه:**\nاختر الأداة:";
            keyboard = keyboards.ai;
        }
        else if (text === "ℹ️ حول البوت") {
            reply = "👨‍💻 **AboElfadl Security Bot**\nإصدار: 2.0 (Serverless)\nتطوير: Mahmoud AboElfadl";
            keyboard = keyboards.main;
        }

        // --- 2. تعليمات الأزرار (Buttons Actions) ---
        // بما أن البوت Stateless، الأزرار ستعطيك الأمر لتنسخه وتستخدمه
        else if (text === "🔍 فحص DNS") reply = "💡 للاستخدام أرسل:\n`/dns google.com`";
        else if (text === "🔒 فحص SSL") reply = "💡 للاستخدام أرسل:\n`/ssl google.com`";
        else if (text === "🔗 فك رابط مختصر") reply = "💡 للاستخدام أرسل:\n`/unshort bit.ly/xxxx`";
        else if (text === "🆙 حالة الموقع") reply = "💡 للاستخدام أرسل:\n`/isup google.com`";
        else if (text === "📑 استخراج الميتا") reply = "💡 للاستخدام أرسل:\n`/meta google.com`";
        else if (text === "👤 Whois") reply = "💡 للاستخدام أرسل:\n`/whois google.com`";
        
        else if (text === "#️⃣ مولد MD5") reply = "💡 للاستخدام أرسل:\n`/md5 النص_هنا`";
        else if (text === "#️⃣ مولد SHA256") reply = "💡 للاستخدام أرسل:\n`/sha256 النص_هنا`";
        else if (text === "🔑 قوة الباسورد") reply = "💡 للاستخدام أرسل:\n`/pass 123456`";
        else if (text === "🆔 مولد UUID") { reply = `🆔 **UUID:** \`${crypto.randomUUID()}\``; } // تنفيذ مباشر
        else if (text === "🔣 تشفير URL") reply = "💡 للاستخدام أرسل:\n`/urlenc النص`";
        
        else if (text === "📋 تنسيق JSON") reply = "💡 للاستخدام أرسل:\n`/json {كود_غير_منظم}`";
        else if (text === "🐙 معلومات GitHub") reply = "💡 للاستخدام أرسل:\n`/git username`";
        else if (text === "🎨 تحويل ألوان") reply = "💡 للاستخدام أرسل:\n`/color #ff0000`";
        
        else if (text === "🪙 سعر العملات") reply = "💡 للاستخدام أرسل:\n`/coin bitcoin`";
        else if (text === "🌤 الطقس") reply = "💡 للاستخدام أرسل:\n`/weather Cairo`";
        else if (text === "📱 باركود QR") reply = "💡 للاستخدام أرسل:\n`/qr النص_أو_الرابط`";
        else if (text === "💡 معلومة عشوائية") { // تنفيذ مباشر
             try { const f = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en'); reply = `💡 **Fact:** ${f.data.text}`; }
             catch { reply = "❌ خطأ."; }
        }

        // --- 3. تنفيذ الأوامر (Command Execution) ---
        else if (text.startsWith("/")) {
            const cmd = text.split(' ')[0].toLowerCase();
            const arg = text.split(' ').slice(1).join(' ');

            switch (cmd) {
                case "/dns": reply = arg ? await checkDNS(arg) : "⚠️ اكتب الدومين بعد الأمر."; break;
                case "/ssl": reply = arg ? await checkSSL(arg) : "⚠️ اكتب الدومين بعد الأمر."; break;
                case "/unshort": 
                    try { const r = await axios.head(arg, {maxRedirects:10}); reply = `🔗 الأصل: ${r.request.res.responseUrl}`; } 
                    catch { reply = "❌ خطأ."; } break;
                case "/isup":
                    try { await axios.get(arg.startsWith('http')?arg:'http://'+arg, {timeout:3000}); reply = "✅ يعمل (Up)"; }
                    catch { reply = "🔴 لا يعمل (Down)"; } break;
                case "/meta":
                    try { const {data} = await axios.get(arg.startsWith('http')?arg:'http://'+arg, {headers:{"User-Agent":"Bot"},timeout:4000}); 
                    const t = data.match(/<title>(.*?)<\/title>/i)?.[1]||"N/A"; reply = `📑 العنوان: ${t}`; } catch { reply = "❌ خطأ."; } break;
                case "/whois": reply = `📄 **Whois:** https://who.is/whois/${arg}`; break;
                
                case "/md5": reply = `🔐 \`${crypto.createHash('md5').update(arg).digest('hex')}\``; break;
                case "/sha256": reply = `🔐 \`${crypto.createHash('sha256').update(arg).digest('hex')}\``; break;
                case "/pass": reply = `🔑 الطول: ${arg.length}`; break;
                case "/urlenc": reply = `🔣 \`${encodeURIComponent(arg)}\``; break;
                
                case "/json": try { reply = `\`\`\`json\n${JSON.stringify(JSON.parse(arg),null,2)}\n\`\`\``; } catch { reply = "❌ JSON خطأ"; } break;
                case "/git": try { const g = await axios.get(`https://api.github.com/users/${arg}`); reply = `🐙 **${g.data.login}**\nRepos: ${g.data.public_repos}`; } catch { reply = "❌ غير موجود"; } break;
                
                case "/coin": try { const c = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${arg}&vs_currencies=usd`); reply = `💰 $${c.data[arg].usd}`; } catch { reply = "❌ عملة خطأ"; } break;
                case "/weather": reply = arg ? await getWeather(arg) : "⚠️ اكتب المدينة."; break;
                case "/qr": 
                    if(!arg) { reply = "⚠️ اكتب النص."; break; }
                    method = "sendPhoto"; reply = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(arg)}`; break;
                
                default: reply = "⚠️ أمر غير معروف.";
            }
        }
        else {
            // رسالة افتراضية لو النص مش أمر ومش زرار
            reply = "⚠️ اختر من القائمة أو أرسل أمراً يبدأ بـ `/`";
        }

        // إرسال الرد
        if (reply) {
            let payload = { chat_id: chatId, ...extra };
            if (keyboard) payload.reply_markup = keyboard;
            
            if (method === "sendPhoto") payload.photo = reply;
            else payload.text = reply;

            await axios.post(`${TELEGRAM_API}/${method}`, payload);
        }

        return { statusCode: 200, body: "OK" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: "Error" };
    }
};
