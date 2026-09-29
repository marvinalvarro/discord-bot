const { getQueue } = require("../musicPlayer");

module.exports = {
    name: "queue",
    execute(message) {
        const queue = getQueue(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply("Antrian musik kosong.");
        }

        const list = queue.songs
            .slice(0, 10)
            .map((s, i) => (i === 0 ? `▶️ ${s.title} *(lagi diputer)*` : `${i}. ${s.title}`))
            .join("\n");

        const extra = queue.songs.length > 10 ? `\n...dan ${queue.songs.length - 10} lagu lagi` : "";

        message.reply(`🎶 **Antrian musik** (loop: ${queue.loopMode}, volume: ${Math.round(queue.volume * 100)}%):\n${list}${extra}`);
    },
};