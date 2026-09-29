const { getQueue } = require("../musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");

module.exports = {
    name: "resume",
    execute(message) {
        const queue = getQueue(message.guild.id);
        if (!queue || queue.player.state.status !== AudioPlayerStatus.Paused) {
            return message.reply("Gak ada lagu yang lagi di-pause.");
        }
        queue.player.unpause();
        message.reply("▶️ Musik dilanjutin.");
    },
};