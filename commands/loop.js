const { getQueue } = require("../musicPlayer");

module.exports = {
    name: "loop",
    execute(message, args) {
        const queue = getQueue(message.guild.id);
        if (!queue) {
            return message.reply("Gak ada musik yang lagi jalan.").catch(() => {});
        }

        const mode = (args[0] || "").toLowerCase();
        if (!["off", "track", "queue"].includes(mode)) {
            return message
                .reply(`Mode loop sekarang: **${queue.loopMode}**\nPakai: \`.loop off\` / \`.loop track\` / \`.loop queue\``)
                .catch(() => {});
        }

        queue.loopMode = mode;
        const labels = {
            off: "Loop dimatiin",
            track: "Loop lagu ini terus-menerus",
            queue: "Loop seluruh antrian",
        };
        message.reply(`🔁 ${labels[mode]}.`).catch(() => {});
    },
};