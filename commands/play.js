const { connectToVoice, resolveSong } = require("../musicPlayer");

module.exports = {
    name: "play",
    async execute(message, args, client) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply("Lu harus join voice channel dulu buat muter musik!").catch(() => {});
        }

        const query = args.join(" ");
        if (!query) {
            return message
                .reply("Kasih nama file musik lokal ya (gak perlu ekstensi .mp3).\nContoh: `.play namafile`")
                .catch(() => {});
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions.has("Connect") || !permissions.has("Speak")) {
            return message.reply("Bot gak punya izin **Connect**/**Speak** di voice channel itu.").catch(() => {});
        }

        let queue;
        try {
            queue = await connectToVoice(voiceChannel, message.channel);
        } catch (err) {
            console.error("[play] Gagal connect voice:", err.message);
            return message.reply("Gagal connect ke voice channel, coba lagi.").catch(() => {});
        }

        const song = resolveSong(query, message.author.tag);

        if (!song) {
            return message
                .reply(
                    `Lagu **${query}** gak ketemu di folder musik. Pastiin file udah diupload ke folder \`music/\` dan nama filenya mengandung kata itu.`
                )
                .catch(() => {});
        }

        queue.songs.push(song);

        if (!queue.playing) {
            await queue.playNext();
        } else {
            message
                .reply(`✅ Ditambahin ke antrian (posisi #${queue.songs.length}): **${song.title}**`)
                .catch(() => {});
        }
    },
};