const { getQueue } = require("../musicPlayer");

module.exports = {
    name: "skip",
    execute(message) {
        const queue = getQueue(message.guild.id);
        if (!queue || !queue.playing) {
            return message.reply("Gak ada lagu yang lagi diputer.").catch(() => {});
        }
        queue.player.stop();
        message.reply("⏭️ Lagu di-skip.").catch(() => {});
    },
};