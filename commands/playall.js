const fs = require("fs");
const path = require("path");
const { connectToVoice, LOCAL_MUSIC_DIR } = require("../musicPlayer");

module.exports = {
    name: "playall",
    async execute(message, args, client) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply("Lu harus join voice channel dulu buat muter musik!");
        }

        if (!fs.existsSync(LOCAL_MUSIC_DIR)) {
            return message.reply("Folder `music/` belum ada di server. Buat dulu foldernya, upload file mp3 ke situ.");
        }

        const files = fs
            .readdirSync(LOCAL_MUSIC_DIR)
            .filter((f) => [".mp3", ".wav", ".ogg", ".m4a"].includes(path.extname(f).toLowerCase()))
            .sort(); // urutin nama file biar konsisten urutan puternya

        if (files.length === 0) {
            return message.reply("Gak ada file musik di folder `music/`.");
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions.has("Connect") || !permissions.has("Speak")) {
            return message.reply("Bot gak punya izin **Connect**/**Speak** di voice channel itu.");
        }

        let queue;
        try {
            queue = await connectToVoice(voiceChannel, message.channel);
        } catch (err) {
            console.error("[playall] Gagal connect voice:", err.message);
            return message.reply("Gagal connect ke voice channel, coba lagi.");
        }

        // Kosongin antrian lama, isi ulang sama semua lagu dari folder
        queue.songs = files.map((file) => ({
            title: path.parse(file).name,
            source: path.join(LOCAL_MUSIC_DIR, file),
            requestedBy: message.author.tag,
        }));

        // Loop "queue" = abis lagu terakhir, otomatis balik muter dari lagu pertama lagi, terus-menerus
        queue.loopMode = "queue";

        message.reply(
            `🎶 Muter **${files.length} lagu** dari folder musik, berurutan dan bakal ngulang otomatis dari awal kalau udah abis semua.\nKetik \`.stop\` kalau mau berhentiin.`
        );

        if (!queue.playing) {
            await queue.playNext();
        }
    },
};