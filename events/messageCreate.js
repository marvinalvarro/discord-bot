const config = require("../config");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { EmbedBuilder } = require("discord.js");
const { incrementBanCounter } = require("../banCounter");
const { handleChatMessage } = require("../chatXP");

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
// KONFIGURASI AUTO-BAN TRAP CHANNEL
// ===============================
const TRAP_CHANNEL_ID = "1532607922431987805";   // ID channel trap (#dilarang-chat)
const LOG_CHANNEL_ID = "";       // dikosongin, karena notif ban sekarang dihandle guildBanAdd.js
const BAN_REASON = "Auto-ban: mengirim pesan di trap channel (terdeteksi spam/phishing bot)";
const WHITELIST_USER_IDS = ["1015666814325375067"]; // founder, gak akan ke-ban walau chat di trap channel
let banCount = 0;

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
        // AUTO-BAN TRAP CHANNEL (paling atas biar dicek duluan)
        // ===============================
        if (message.channelId === TRAP_CHANNEL_ID) {
            // Founder/whitelist: dibiarkan aja, gak dihapus & gak di-ban
            if (WHITELIST_USER_IDS.includes(message.author.id)) {
                console.log(`[WHITELIST] ${message.author.tag} bebas chat di trap channel.`);
                return;
            }

            try {
                await message.delete().catch(() => {});

                const member = message.member;
                if (member && member.bannable) {
                    await member.ban({ reason: BAN_REASON });
                    banCount++;

                    console.log(`[AUTO-BAN] ${message.author.tag} (${message.author.id}) di-ban. Total: ${banCount}`);

                    // Update pesan counter "Bans count" di trap channel
                    await incrementBanCounter(message.channel).catch((err) => {
                        console.error("Gagal update ban counter:", err);
                    });

                    if (LOG_CHANNEL_ID) {
                        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
                        if (logChannel) {
                            const embed = new EmbedBuilder()
                                .setColor(0xE74C3C)
                                .setTitle("🔨 Auto-Ban Triggered")
                                .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Alasan:** ${BAN_REASON}`)
                                .setFooter({ text: `Total bans: ${banCount}` })
                                .setTimestamp();
                            logChannel.send({ embeds: [embed] }).catch(() => {});
                        }
                    }
                } else {
                    console.log(`Tidak bisa ban ${message.author.tag} — mungkin role bot lebih rendah, atau target admin/owner.`);
                }
            } catch (err) {
                console.error("Gagal auto-ban:", err);
            }
            return; // stop, jangan lanjut ke logic lain
        }

        // ===============================
        // XP CHAT (dihitung untuk semua pesan valid di luar trap channel)
        // ===============================
        handleChatMessage(message, config);

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
             `🔒 Wah kalo mau ngobrol interaktif kayak gini, gua butuh 'power' lebih dulu bro ini khusus **Server Booster** atau role **VIP** ya!\n\nCukup **VIP 5k** aja, boost server dulu atau order VIP di bio founder. Nanti notifnya bakal muncul di <#${config.logsVipChannelId}> 😉`
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