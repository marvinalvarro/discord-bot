const { getQueue } = require("../musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");

module.exports = {
    name: "pause",
    execute(message) {
        const queue = getQueue(message.guild.id);
        if (!queue || queue.player.state.status !== AudioPlayerStatus.Playing) {
            return message.reply("Gak ada lagu yang lagi diputer.");
        }
        queue.player.pause();
        message.reply("⏸️ Musik di-pause. Ketik `.resume` buat lanjutin.");
    },
};