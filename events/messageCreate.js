const config = require("../config");

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

            if (text === "halo" || text === "hai" || text === "hi") {
                return message.reply("Halo juga! 👋");
            }

            if (text === "morning" || text === "pagi") {
                return message.reply("Morning juga! 🌞");
            }

            if (text === "assalamualaikum") {
                return message.reply("Waalaikumsalam warahmatullahi wabarakatuh 🤲");
            }

            return message.reply("Halo! Ada yang bisa saya bantu? 😊");
        }

        // ===============================
        // COMMAND PREFIX
        // ===============================
        if (!message.content.startsWith(config.prefix)) return;

        const args = message.content
            .slice(config.prefix.length)
            .trim()
            .split(/ +/);

        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command) return;

        try {
            command.execute(message, args);
        } catch (err) {
            console.error(err);
            message.reply("Terjadi error.");
        }
    },
};