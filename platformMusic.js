// platformMusic.js
// Fitur musik untuk bot GV Platform. Pakai musicPlayer.js yang SAMA dengan Nova Verse,
// tapi antrian & koneksi voice-nya dipisah lewat namespace "platform".
// Aktif kalau di .env ada PLATFORM_MUSIC=on (lihat platformBot.js).
const fs = require("fs");
const path = require("path");
const { Events } = require("discord.js");
const { getQueue, connectToVoice, resolveSong, LOCAL_MUSIC_DIR } = require("./musicPlayer");

const NS = "platform";
const PREFIX = process.env.PLATFORM_PREFIX || ",";

// Cek user ada di voice channel yang sama dengan bot (buat command kontrol)
function checkSameChannel(message, queue) {
    const userChannelId = message.member?.voice?.channelId;
    const botChannelId = queue.connection?.joinConfig?.channelId;
    if (!userChannelId) {
        message.reply("Lu harus join voice channel dulu.").catch(() => {});
        return false;
    }
    if (botChannelId && userChannelId !== botChannelId) {
        message.reply("Lu harus satu voice channel sama bot ini.").catch(() => {});
        return false;
    }
    return true;
}

const commands = {
    async play(message, args, client) {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return message.reply("Lu harus join voice channel dulu buat muter musik!").catch(() => {});
        }

        const query = args.join(" ");
        if (!query) {
            return message
                .reply(`Kasih nama file musik lokal ya (gak perlu ekstensi .mp3).\nContoh: \`${PREFIX}play namafile\``)
                .catch(() => {});
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions || !permissions.has("Connect") || !permissions.has("Speak")) {
            return message.reply("Bot gak punya izin **Connect**/**Speak** di voice channel itu.").catch(() => {});
        }

        const song = resolveSong(query, message.author.tag);
        if (!song) {
            return message
                .reply(
                    `Lagu **${query}** gak ketemu di folder musik. Pastiin file udah diupload ke folder \`music/\` dan nama filenya mengandung kata itu.`
                )
                .catch(() => {});
        }

        let queue;
        try {
            queue = await connectToVoice(voiceChannel, message.channel);
        } catch (err) {
            console.error("[platformMusic] Gagal connect voice:", err.message);
            return message.reply("Gagal connect ke voice channel, coba lagi.").catch(() => {});
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

    // Muter SEMUA lagu di folder music/ berurutan, ngulang otomatis dari awal (loop queue)
    async playall(message, args, client) {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return message.reply("Lu harus join voice channel dulu buat muter musik!").catch(() => {});
        }

        if (!fs.existsSync(LOCAL_MUSIC_DIR)) {
            return message
                .reply("Folder `music/` belum ada di server. Buat dulu foldernya, upload file mp3 ke situ.")
                .catch(() => {});
        }

        const files = fs
            .readdirSync(LOCAL_MUSIC_DIR)
            .filter((f) => [".mp3", ".wav", ".ogg", ".m4a"].includes(path.extname(f).toLowerCase()))
            .sort();

        if (files.length === 0) {
            return message.reply("Gak ada file musik di folder `music/`.").catch(() => {});
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions || !permissions.has("Connect") || !permissions.has("Speak")) {
            return message.reply("Bot gak punya izin **Connect**/**Speak** di voice channel itu.").catch(() => {});
        }

        let queue;
        try {
            queue = await connectToVoice(voiceChannel, message.channel);
        } catch (err) {
            console.error("[platformMusic] Gagal connect voice:", err.message);
            return message.reply("Gagal connect ke voice channel, coba lagi.").catch(() => {});
        }

        const allSongs = files.map((file) => ({
            title: path.parse(file).name,
            source: path.join(LOCAL_MUSIC_DIR, file),
            requestedBy: message.author.tag,
        }));

        if (queue.playing && queue.songs[0]) {
            // Lagi muter sesuatu: biarkan lagu yang sekarang lanjut, sisanya menyusul berurutan
            const current = queue.songs[0];
            queue.songs = [current, ...allSongs.filter((song) => song.source !== current.source)];
        } else {
            queue.songs = allSongs;
        }

        queue.loopMode = "queue";

        message
            .reply(
                `🎶 Muter **${files.length} lagu** dari folder musik, berurutan dan bakal ngulang otomatis dari awal kalau udah abis semua.\nKetik \`${PREFIX}stop\` kalau mau berhentiin.`
            )
            .catch(() => {});

        if (!queue.playing) {
            await queue.playNext();
        }
    },

    async skip(message) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue || !queue.playing) return message.reply("Lagi gak ada lagu yang diputar.").catch(() => {});
        if (!checkSameChannel(message, queue)) return;

        let note = "";
        if (queue.loopMode === "track") {
            queue.loopMode = "off"; // kalau gak dimatiin, lagu yang sama bakal keulang lagi
            note = " (loop lagu dimatiin)";
        }
        queue.player.stop(); // memicu Idle -> lanjut lagu berikutnya
        message.reply(`⏭️ Lagu di-skip.${note}`).catch(() => {});
    },

    async stop(message) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue) return message.reply("Bot lagi gak muter apa-apa.").catch(() => {});
        if (!checkSameChannel(message, queue)) return;

        queue.songs = [];
        queue.loopMode = "off";
        queue.player.stop(true);
        queue.destroy();
        message.reply("⏹️ Musik dihentikan, bot keluar dari voice.").catch(() => {});
    },

    async pause(message) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue || !queue.playing) return message.reply("Lagi gak ada lagu yang diputar.").catch(() => {});
        if (!checkSameChannel(message, queue)) return;

        queue.player.pause();
        message.reply("⏸️ Dijeda.").catch(() => {});
    },

    async resume(message) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue) return message.reply("Bot lagi gak muter apa-apa.").catch(() => {});
        if (!checkSameChannel(message, queue)) return;

        queue.player.unpause();
        message.reply("▶️ Dilanjut.").catch(() => {});
    },

    async queue(message) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue || queue.songs.length === 0) return message.reply("Antrian kosong.").catch(() => {});

        const lines = queue.songs.slice(0, 10).map((s, i) => `${i === 0 ? "▶️" : `${i}.`} **${s.title}**`);
        if (queue.songs.length > 10) lines.push(`...dan ${queue.songs.length - 10} lagu lagi`);
        message.reply(`🎶 **Antrian** (loop: ${queue.loopMode})\n${lines.join("\n")}`).catch(() => {});
    },

    async volume(message, args) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue) return message.reply("Bot lagi gak muter apa-apa.").catch(() => {});
        if (!checkSameChannel(message, queue)) return;

        const value = parseInt(args[0], 10);
        if (Number.isNaN(value) || value < 1 || value > 100) {
            return message.reply(`Volume sekarang **${Math.round(queue.volume * 100)}%**. Pakai: \`${PREFIX}volume 1-100\``).catch(() => {});
        }

        queue.volume = value / 100;
        const resource = queue.player.state.resource;
        if (resource && resource.volume) resource.volume.setVolume(queue.volume);
        message.reply(`🔊 Volume diatur ke **${value}%**.`).catch(() => {});
    },

    async loop(message, args) {
        const queue = getQueue(message.guild.id, NS);
        if (!queue) return message.reply("Bot lagi gak muter apa-apa.").catch(() => {});
        if (!checkSameChannel(message, queue)) return;

        const mode = (args[0] || "").toLowerCase();
        if (!["off", "track", "queue"].includes(mode)) {
            return message.reply(`Pakai: \`${PREFIX}loop off\`, \`${PREFIX}loop track\`, atau \`${PREFIX}loop queue\`.`).catch(() => {});
        }
        queue.loopMode = mode;
        message.reply(`🔁 Loop diatur ke **${mode}**.`).catch(() => {});
    },

    async help(message) {
        message
            .reply(
                `🎵 **Musik GV Platform** (prefix \`${PREFIX}\`)\n` +
                    `\`play <nama>\`, \`playall\`, \`skip\`, \`stop\`, \`pause\`, \`resume\`, \`queue\`, \`volume <1-100>\`, \`loop <off|track|queue>\``
            )
            .catch(() => {});
    },
};

// Alias singkat
const aliases = { p: "play", s: "skip", q: "queue", vol: "volume", leave: "stop" };

function registerPlatformMusic(client) {
    // Tandai client ini supaya musicPlayer.js memakai antrian & koneksi voice terpisah dari Nova Verse
    client.musicNamespace = NS;

    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot || !message.guild) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const raw = (args.shift() || "").toLowerCase();
        const name = aliases[raw] || raw;
        const handler = commands[name];
        if (!handler) return;

        try {
            await handler(message, args, client);
        } catch (err) {
            console.error("[platformMusic] Error command:", err);
            message.reply("Terjadi error.").catch(() => {});
        }
    });

    console.log(`[Platform] Musik aktif (prefix "${PREFIX}").`);
}

module.exports = { registerPlatformMusic };