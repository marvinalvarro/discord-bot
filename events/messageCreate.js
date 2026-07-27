const config = require("../config");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: `Kamu adalah GAME VERSE BOT, bot Discord untuk komunitas gaming Indonesia bernama Game Verse.
Gaya bicara kamu santai, gaul, pakai bahasa sehari-hari ala anak nongkrong/gamer Indonesia (boleh pakai "lu/gua", singkatan gaul, emoji secukupnya).
Jawaban kamu singkat aja, maksimal 3-4 kalimat, jangan bertele-tele.
Kamu TIDAK BISA benar-benar mencarikan jodoh, memberi hadiah asli, atau melakukan aksi di dunia nyata — kalau ada yang minta itu, becandain aja dengan santai, jangan pura-pura bisa.
Kalau ada yang tanya soal channel atau aturan server, arahkan mereka untuk cek channel #rules atau #take-role.`,
});

// ===============================
// HELPER: Cek akses Booster/VIP
// ===============================
function hasVIPAccess(member) {
    if (!member) return false;
    const isBooster = member.premiumSince !== null;
    const isVIP = config.vipRoleId
        ? member.roles.cache.has(config.vipRoleId)
        : false;
    return isBooster || isVIP;
}

module.exports = {
    name: "messageCreate",

    async execute(message, client) {
        console.log("Pesan diterima:", message.content);
        if (message.author.bot) return;

        // ===============================
        // AUTO RESPON + AVATAR (GENERAL - semua bisa akses)
        // ===============================
        const responses = {
            "hy sayang": "APA SAYANG ❤️",
            "hai sayang": "APA SAYANG ❤️",
            "hi sayang": "APA SAYANG ❤️",
            "halo sayang": "APA SAYANG ❤️",

            "hy ganteng": "Apa Cintaku ❤️",
            "hai ganteng": "Apa Cintaku ❤️",
            "hi ganteng": "Apa Cintaku ❤️",
            "halo ganteng": "Apa Cintaku ❤️",

            "hy cantik": "Apa Cintaku ❤️",
            "hai cantik": "Apa Cintaku ❤️",
            "hi cantik": "Apa Cintaku ❤️",
            "halo cantik": "Apa Cintaku ❤️",

            "peluk": "🤗 Nih dipeyuk duyu~",
            "cium": "😘 Muachh!!",
            "pap": "📸 Nih PAP nya 😳",
            "mana pap": "📸 Nih PAP nya, jangan disimpan lama-lama ya 🥺"
        };

        const lower = message.content.toLowerCase();

        for (const trigger in responses) {
            if (lower.startsWith(trigger)) {

                const user = message.mentions.users.first();

                if (!user) {
                    return message.reply({
                        content: "Tag dulu orangnya ya 😊",
                        allowedMentions: {
                            repliedUser: false,
                        },
                    });
                }

                return message.reply({
                    content: responses[trigger],
                    files: [
                        user.displayAvatarURL({
                            extension: "jpg",
                            size: 1024,
                        }),
                    ],
                    allowedMentions: {
                        repliedUser: false,
                    },
                });
            }
        }

        // ===============================
        // RESPON SAAT BOT DI-MENTION
        // ===============================
        if (message.mentions.has(client.user)) {

            const text = message.content
                .replace(`<@${client.user.id}>`, "")
                .replace(`<@!${client.user.id}>`, "")
                .trim()
                .toLowerCase();

            // Balasan tetap (cepat, tanpa perlu panggil AI) - GENERAL, semua bisa akses
            if (text === "halo" || text === "hai" || text === "hi") {
                return message.reply("Halo juga! 👋");
            }

            if (text === "morning" || text === "pagi") {
                return message.reply("Morning juga! 🌞");
            }

            if (text === "assalamualaikum") {
                return message.reply("Waalaikumsalam warahmatullahi wabarakatuh 🤲");
            }

            // Kalau nggak ada isi teksnya (cuma mention doang), kasih sapaan singkat - GENERAL
            if (!text) {
                return message.reply("Halo! Ada yang bisa gue bantu? Coba tulis pertanyaan lu ya 😊");
            }

            // ===============================
            // MULAI DARI SINI: butuh AI beneran (Gemini)
            // KHUSUS SERVER BOOSTER / VIP
            // ===============================
            if (!hasVIPAccess(message.member)) {
                return message.reply(
                    "🔒 Wah kalo mau ngobrol interaktif kayak gini gua butuh 'power' lebih dulu bro, ini khusus **Server Booster** atau role **VIP** ya! Boost server dulu atau dapetin role VIP-nya di #take-role 😉"
                );
            }

            // Selain itu, lempar ke Gemini AI biar jawabannya sesuai konteks
            try {
                await message.channel.sendTyping();

                const result = await model.generateContent(text);
                const reply = result.response.text().trim();

                return message.reply(reply || "Hmm, gue bingung mau jawab apa nih, coba tanya lagi ya 😅");
            } catch (err) {
                console.error("Gagal manggil Gemini API:", err);

                // Cek kalau errornya karena limit harian Gemini habis (429)
                if (err?.status === 429 || err?.message?.includes("Too Many Requests")) {
                    return message.reply(
                        "🥱 Waduh, otak AI-ku lagi capek nih! Jatah chat harian udah abis dipake ngobrol sama kalian semua. Istirahat dulu ya, besok kita ngobrol lagi kalau jatahnya udah reset~"
                    );
                }

                // Error teknis lainnya (network, bug, dll)
                return message.reply("hmm otakku lagi ngadat dikit, coba tanya lagi nanti ya 😅");
            }
        }

        // ===============================
        // COMMAND PREFIX (GENERAL - semua bisa akses)
        // ===============================
        console.log("DEBUG - prefix:", JSON.stringify(config.prefix));
        console.log("DEBUG - starts with prefix?", message.content.startsWith(config.prefix));

        if (!message.content.startsWith(config.prefix)) return;

        const args = message.content
            .slice(config.prefix.length)
            .trim()
            .split(/ +/);

        const commandName = args.shift().toLowerCase();

        console.log("DEBUG - commandName:", commandName);
        console.log("DEBUG - available commands:", [...client.commands.keys()]);

        const command = client.commands.get(commandName);

        console.log("DEBUG - command found?", !!command);

        if (!command) return;

        try {
            console.log("DEBUG - executing command...");
            command.execute(message, args, client);
            console.log("DEBUG - command executed without throwing");
        } catch (err) {
            console.error("DEBUG - ERROR:", err);
            message.reply("Terjadi error.");
        }
    },
};