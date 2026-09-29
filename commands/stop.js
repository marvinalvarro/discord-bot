const { getQueue } = require("../musicPlayer");

module.exports = {
    name: "stop",
    execute(message) {
        const queue = getQueue(message.guild.id);
        if (!queue) {
            return message.reply("Gak ada musik yang lagi jalan.").catch(() => {});
        }
        queue.songs = [];
        queue.loopMode = "off";
        queue.player.stop();
        queue.destroy();
        message.reply("⏹️ Musik dihentikan, bot keluar dari voice channel.").catch(() => {});
    },
};