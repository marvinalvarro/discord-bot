const { getQueue } = require("../musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");

module.exports = {
    name: "volume",
    execute(message, args) {
        const queue = getQueue(message.guild.id);
        if (!queue) {
            return message.reply("Gak ada musik yang lagi jalan.");
        }

        const percent = parseInt(args[0], 10);
        if (isNaN(percent) || percent < 0 || percent > 200) {
            return message.reply(
                `Volume sekarang: **${Math.round(queue.volume * 100)}%**\nPakai: \`.volume <0-200>\``
            );
        }

        queue.volume = percent / 100;

        const status = queue.player.state.status;
        if (status === AudioPlayerStatus.Playing || status === AudioPlayerStatus.Paused) {
            const resource = queue.player.state.resource;
            if (resource && resource.volume) {
                resource.volume.setVolume(queue.volume);
            }
        }

        message.reply(`🔊 Volume diatur ke **${percent}%**.`);
    },
};