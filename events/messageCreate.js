const config = require("../config");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `Kamu adalah GAME VERSE BOT, bot Discord untuk komunitas gaming Indonesia bernama Game Verse.
Gaya bicara kamu santai, gaul, pakai bahasa sehari-hari ala anak nongkrong/gamer Indonesia (boleh pakai "lu/gua", singkatan gaul, emoji secukupnya).
Jawaban kamu singkat aja, maksimal 3-4 kalimat, jangan bertele-tele.
Kamu TIDAK BISA benar-benar mencarikan jodoh, memberi hadiah asli, atau melakukan aksi di dunia nyata — kalau ada yang minta itu, becandain aja dengan santai, jangan pura-pura bisa.
Kalau ada yang tanya soal channel atau aturan server, arahkan mereka untuk cek channel #rules atau #take-role.`,
});

module.exports = {
    name: "messageCreate",

    async execute(message, client) {
        console.log("Pesan diterima:", message.content);
        if (message.author.bot) return;

        // ===============================
        // AUTO RESPON + AVATAR
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

            // Balasan tetap (cepat, tanpa perlu panggil AI)
            if (text === "halo" || text === "hai" || text === "hi") {
                return message.reply("Halo juga! 👋");
            }

            if (text === "morning" || text === "pagi") {
                return message.reply("Morning juga! 🌞");
            }

            if (text === "assalamualaikum") {
                return message.reply("Waalaikumsalam warahmatullahi wabarakatuh 🤲");
            }

            // Kalau nggak ada isi teksnya (cuma mention doang), kasih sapaan singkat
            if (!text) {
                return message.reply("Halo! Ada yang bisa gue bantu? Coba tulis pertanyaan lu ya 😊");
            }

            // Selain itu, lempar ke Gemini AI biar jawabannya sesuai konteks
            try {
                await message.channel.sendTyping();

                const result = await model.generateContent(text);
                const reply = result.response.text().trim();

                return message.reply(reply || "Hmm, gue bingung mau jawab apa nih, coba tanya lagi ya 😅");
            } catch (err) {
                console.error("Gagal manggil Gemini API:", err);
                return message.reply("Waduh, ada gangguan pas mau mikir jawaban 😵 coba lagi bentar ya.");
            }
        }

        // ===============================
        // COMMAND PREFIX
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
            command.execute(message, args);
            console.log("DEBUG - command executed without throwing");
        } catch (err) {
            console.error("DEBUG - ERROR:", err);
            message.reply("Terjadi error.");
        }
    },
};