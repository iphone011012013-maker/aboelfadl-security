const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns').promises;
const https = require('https');

// ==========================================
// ⚙️ الإعدادات
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "YOUR_BOT_TOKEN_HERE"; 
const ADMIN_ID = process.env.ADMIN_ID || "YOUR_ID_HERE"; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ==========================================
// 🛠️ دوال المساعدة (Helper Functions)
// ==========================================

// 1. فحص DNS
async function checkDNS(domain) {
    try {
        const a = await dns.resolve4(domain).catch(() => []);
        const mx = await dns.resolveMx(domain).catch(() => []);
        const ns = await dns.resolveNs(domain).catch(() => []);
        const txt = await dns.resolveTxt(domain).catch(() => []);

        return `🌍 **سجلات DNS لـ ${domain}:**\n\n` +
               `🔹 **A:** ${a.join(', ') || 'غير موجود'}\n` +
               `🔹 **MX:** ${mx.map(m => m.exchange).join(', ') || 'غير موجود'}\n` +
               `🔹 **NS:** ${ns.join(', ') || 'غير موجود'}\n` +
               `🔹 **TXT:** ${txt.flat().join('\n').substring(0, 100) || 'غير موجود'}`;
    } catch (e) { return "❌ لا يمكن جلب سجلات DNS لهذا النطاق."; }
}

// 2. فحص SSL
function checkSSL(domain) {
    return new Promise((resolve) => {
        if (!domain.startsWith('https://')) domain = 'https://' + domain;
        const url = new URL(domain);
        const req = https.request({ host: url.hostname, port: 443, method: 'GET', agent: false, rejectUnauthorized: false }, (res) => {
            const cert = res.connection.getPeerCertificate();
            if (!cert || Object.keys(cert).length === 0) resolve("❌ لا توجد شهادة SSL.");
            
            const validTo = new Date(cert.valid_to);
            const daysLeft = Math.floor((validTo - new Date()) / (1000 * 60 * 60 * 24));
            
            resolve(`🔒 **فحص SSL:**\n` +
                    `🔹 **النطاق:** ${url.hostname}\n` +
                    `🔹 **المصدر:** ${cert.issuer.O || cert.issuer.CN}\n` +
                    `🔹 **ينتهي في:** ${validTo.toLocaleDateString()}\n` +
                    `⏳ **الأيام المتبقية:** ${daysLeft} يوم`);
        });
        req.on('error', () => resolve("❌ خطأ في الاتصال بالسيرفر."));
        req.end();
    });
}

// 3. فك الروابط المختصرة
async function expandLink(shortUrl) {
    try {
        const res = await axios.head(shortUrl, { maxRedirects: 10, validateStatus: false });
        return `🔗 **الرابط الأصلي:**\n${res.request.res.responseUrl}`;
    } catch (e) { return "❌ لا يمكن فك هذا الرابط."; }
}

// 4. استخراج الميتا
async function scrapeMeta(url) {
    if (!url.startsWith('http')) url = 'http://' + url;
    try {
        const { data } = await axios.get(url, { headers: { "User-Agent": "Bot" }, timeout: 5000 });
        const title = data.match(/<title>(.*?)<\/title>/i)?.[1] || "لا يوجد";
        const desc = data.match(/name="description" content="(.*?)"/i)?.[1] || "لا يوجد";
        return `📑 **بيانات الموقع:**\n🔹 **العنوان:** ${title}\n🔹 **الوصف:** ${desc}`;
    } catch (e) { return "❌ لا يمكن الوصول للموقع."; }
}

// 5. مدقق البريد (MX)
async function validateEmail(email) {
    const domain = email.split('@')[1];
    if (!domain) return "❌ صيغة إيميل خاطئة.";
    try {
        const mx = await dns.resolveMx(domain);
        return mx.length > 0 ? `✅ **الإيميل صالح:** الدومين ${domain} يمتلك سيرفرات بريد.` : `❌ **غير صالح:** الدومين لا يستقبل رسائل.`;
    } catch (e) { return "❌ الدومين غير موجود."; }
}

// 6. سعر الكريبتو
async function getCryptoPrice(coin) {
    try {
        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`);
        const price = res.data[coin]?.usd;
        return price ? `💰 **سعر ${coin}:** $${price}` : "❌ عملة غير معروفة (جرب bitcoin, ethereum).";
    } catch (e) { return "❌ الخدمة مشغولة حالياً."; }
}

// 7. الطقس (Open-Meteo)
async function getWeather(city) {
    try {
        // البحث عن إحداثيات المدينة أولاً
        const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        if (!geo.data.results) return "❌ مدينة غير موجودة.";
        const { latitude, longitude, name, country } = geo.data.results[0];
        
        const weather = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const w = weather.data.current_weather;
        
        return `🌤 **الطقس في ${name}, ${country}:**\n` +
               `🌡 **الحرارة:** ${w.temperature}°C\n` +
               `💨 **الرياح:** ${w.windspeed} km/h`;
    } catch (e) { return "❌ خطأ في خدمة الطقس."; }
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
        const cmd = text.split(' ')[0].toLowerCase();
        const arg = text.split(' ').slice(1).join(' ');

        let reply = "";
        let method = "sendMessage";
        let extra = { parse_mode: "Markdown" };

        // --- قائمة الأوامر ---
        switch (cmd) {
            case "/start":
                reply = "🛠 **أهلاً بك في البوت الشامل!**\nاكتب `/help` لعرض قائمة بـ 30 أداة متاحة.";
                break;

            case "/help":
                reply = `📜 **قائمة الأوامر:**\n\n` +
                        `🌐 **الشبكات:**\n` +
                        `/dns [domain] - سجلات DNS\n` +
                        `/ssl [domain] - فحص الشهادة\n` +
                        `/unshort [url] - فك رابط\n` +
                        `/isup [url] - حالة الموقع\n` +
                        `/meta [url] - جلب الميتا\n` +
                        `/whois [domain] - معلومات المالك\n` +
                        `/mx [email] - فحص الإيميل\n\n` +
                        `🔐 **الأمن:**\n` +
                        `/md5 [text] - هاش MD5\n` +
                        `/sha256 [text] - هاش SHA256\n` +
                        `/pass [text] - قوة الباسورد\n` +
                        `/uuid - مولد معرف فريد\n\n` +
                        `🛠 **أدوات:**\n` +
                        `/json [text] - تنسيق JSON\n` +
                        `/color [hex] - تحويل ألوان\n` +
                        `/git [user] - معلومات GitHub\n\n` +
                        `💰 **عام:**\n` +
                        `/coin [name] - سعر العملة\n` +
                        `/qr [text] - صورة QR\n` +
                        `/weather [city] - الطقس`;
                break;

            // --- 🌐 الشبكات ---
            case "/dns": reply = arg ? await checkDNS(arg) : "💡 الاستخدام: `/dns google.com`"; break;
            case "/ssl": reply = arg ? await checkSSL(arg) : "💡 الاستخدام: `/ssl google.com`"; break;
            case "/unshort": reply = arg ? await expandLink(arg) : "💡 الاستخدام: `/unshort bit.ly/...`"; break;
            case "/meta": reply = arg ? await scrapeMeta(arg) : "💡 الاستخدام: `/meta google.com`"; break;
            case "/mx": reply = arg ? await validateEmail(arg) : "💡 الاستخدام: `/mx mail@test.com`"; break;
            case "/isup": 
                if(!arg) { reply = "💡 الاستخدام: `/isup google.com`"; break; }
                try { await axios.get(arg.startsWith('http')?arg:'http://'+arg, {timeout:3000}); reply = "✅ **الموقع يعمل!** (Up)"; } 
                catch { reply = "🔴 **الموقع لا يعمل** أو محجوب."; }
                break;
            case "/whois": reply = arg ? `📄 **Whois:** https://who.is/whois/${arg}` : "💡 الاستخدام: `/whois google.com`"; break;

            // --- 🔐 الأمن ---
            case "/md5": reply = arg ? `🔐 **MD5:** \`${crypto.createHash('md5').update(arg).digest('hex')}\`` : "اكتب النص"; break;
            case "/sha256": reply = arg ? `🔐 **SHA256:** \`${crypto.createHash('sha256').update(arg).digest('hex')}\`` : "اكتب النص"; break;
            case "/uuid": reply = `🆔 **UUID:** \`${crypto.randomUUID()}\``; break;
            case "/urlenc": reply = arg ? `🔣 **Encoded:** \`${encodeURIComponent(arg)}\`` : "اكتب النص"; break;
            case "/urldec": reply = arg ? `🔣 **Decoded:** \`${decodeURIComponent(arg)}\`` : "اكتب النص"; break;
            case "/pass": 
                const len = arg.length;
                let strength = "ضعيفة";
                if(len > 8 && /[A-Z]/.test(arg) && /[0-9]/.test(arg)) strength = "قوية";
                reply = arg ? `🔑 **تحليل:** الطول ${len} - القوة: ${strength}` : "اكتب الباسورد"; 
                break;

            // --- 🛠 المطورين ---
            case "/json": 
                try { reply = `📋 **JSON:**\n\`\`\`json\n${JSON.stringify(JSON.parse(arg), null, 2)}\n\`\`\``; } 
                catch { reply = "❌ JSON غير صالح."; }
                break;
            case "/git":
                if(!arg) { reply = "💡 الاستخدام: `/git aboelfadl`"; break; }
                try {
                    const g = await axios.get(`https://api.github.com/users/${arg}`);
                    reply = `🐙 **${g.data.login}**\n📦 Repos: ${g.data.public_repos}\n👥 Followers: ${g.data.followers}`;
                } catch { reply = "❌ مستخدم غير موجود."; }
                break;

            // --- 💰 عام وترفيهي ---
            case "/coin": reply = arg ? await getCryptoPrice(arg.toLowerCase()) : "💡 الاستخدام: `/coin bitcoin`"; break;
            case "/weather": reply = arg ? await getWeather(arg) : "💡 الاستخدام: `/weather Cairo`"; break;
            case "/fact": 
                try { const f = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en'); reply = `💡 **Fact:** ${f.data.text}`; }
                catch { reply = "❌ خطأ."; }
                break;
            case "/qr":
                if (!arg) { reply = "💡 الاستخدام: `/qr Hello`"; break; }
                method = "sendPhoto";
                extra = { caption: "📱 **QR Code الخاص بك**" };
                // نرسل الرابط مباشرة كصورة
                reply = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(arg)}`;
                break;

            default:
                if (text.startsWith("/")) reply = "⚠️ أمر غير معروف. استخدم `/help`.";
        }

        // إرسال الرد
        if (reply) {
            let payload = { chat_id: chatId, ...extra };
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
