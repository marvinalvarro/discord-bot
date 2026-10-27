const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior,
} = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");

// Folder tempat kamu upload file musik lokal (mp3/wav/ogg/m4a). Buat folder ini di root project kalau belum ada.
const LOCAL_MUSIC_DIR = path.join(__dirname, "music");

// Map<queueKey, GuildMusicQueue>
const queues = new Map();

// Tiap bot punya "namespace" sendiri supaya antrian & koneksi voice-nya gak bentrok.
// - Bot utama (Nova Verse): tanpa namespace -> key = guildId (sama persis seperti sebelumnya,
//   jadi command lama yang pakai getQueue(guildId) / queues.get(guildId) tetap aman).
// - Bot lain (GV Platform): client.musicNamespace = "platform" -> key = "platform:guildId".
function namespaceOf(client) {
    return (client && client.musicNamespace) || null;
}

function queueKey(guildId, namespace) {
    return namespace ? `${namespace}:${guildId}` : guildId;
}

class GuildMusicQueue {
    constructor(guildId, textChannel, namespace = null) {
        this.guildId = guildId;
        this.namespace = namespace;
        this.key = queueKey(guildId, namespace);
        this.textChannel = textChannel;
        this.connection = null;
        this.player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
        });
        this.songs = []; // { title, source, requestedBy }
        this.volume = 1; // 1 = 100%
        this.loopMode = "off"; // off | track | queue
        this.playing = false;
        this.idleTimeout = null;

        // Autoplay: kalau antrian habis, cari lagu lanjutan otomatis lewat autoplayFetcher(basisSong, history)
        this.autoplay = false;
        this.autoplayFetcher = null;
        this.autoplayPromise = null;
        this.history = []; // URL lagu yang sudah diputar (dipakai autoplay supaya gak ngulang)
        this.lastPlayed = null;

        this.player.on(AudioPlayerStatus.Idle, () => this.handleTrackEnd());
        this.player.on("error", (err) => {
            console.error("[musicPlayer] Player error:", err.message);
            this.handleTrackEnd();
        });
    }

    async handleTrackEnd() {
        const finished = this.songs.shift();
        if (finished) this.lastPlayed = finished;

        if (this.loopMode === "track" && finished) {
            this.songs.unshift(finished);
        } else if (this.loopMode === "queue" && finished) {
            this.songs.push(finished);
        }

        // Antrian habis tapi autoplay nyala -> cari lagu lanjutan (kalau sudah ke-prefetch, langsung dipakai)
        if (this.songs.length === 0 && this.autoplay) {
            await this.refillAutoplay(finished);
            if (this.songs.length === 0 && this.autoplay) {
                this.autoplay = false;
                this.textChannel
                    .send("♾️ Autoplay gak nemu lagu lanjutan (YouTube lagi nolak atau gak ada rekomendasi), autoplay dimatikan.")
                    .catch(() => {});
            }
        }

        if (this.songs.length > 0) {
            await this.playNext();
        } else {
            this.playing = false;
            this.scheduleIdleLeave();
        }
    }

    // Catat lagu yang mulai diputar (buat riwayat autoplay) dan siapkan lagu berikutnya di belakang layar
    trackPlayed(song) {
        this.lastPlayed = song;
        const key = song.resolvedUrl || song.url;
        if (key) {
            this.history.push(key);
            if (this.history.length > 50) this.history.shift();
        }
        if (this.autoplay && this.songs.length <= 1) this.refillAutoplay();
    }

    // Cari 1 lagu lanjutan dan taruh di akhir antrian. Kalau sudah ada proses pencarian, ikut menunggu yang itu.
    refillAutoplay(basisOverride) {
        if (!this.autoplay || !this.autoplayFetcher) return Promise.resolve(false);
        if (this.autoplayPromise) return this.autoplayPromise;

        const basis = basisOverride || this.songs[this.songs.length - 1] || this.lastPlayed;
        if (!basis) return Promise.resolve(false);

        const p = (async () => {
            try {
                const next = await this.autoplayFetcher(basis, this.history);
                if (next && this.autoplay) {
                    next.autoplay = true;
                    this.songs.push(next);
                    return true;
                }
            } catch (err) {
                console.error("[musicPlayer] Autoplay gagal cari lagu:", err.message);
            }
            return false;
        })();

        this.autoplayPromise = p;
        p.finally(() => {
            if (this.autoplayPromise === p) this.autoplayPromise = null;
        });
        return p;
    }

    // Auto-leave voice channel kalau 60 detik gak ada lagu, biar gak nyangkut
    scheduleIdleLeave() {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = setTimeout(() => {
            if (!this.playing && this.songs.length === 0) {
                this.destroy();
            }
        }, 60 * 1000);
    }

    async playNext() {
        clearTimeout(this.idleTimeout);
        const song = this.songs[0];
        if (!song) return;

        // Tandai "sedang muter" dari awal, supaya perintah play lain yang masuk saat stream
        // masih diambil gak ikut memanggil playNext() lagi (bisa dobel).
        this.playing = true;

        try {
            let input = song.source;
            const options = { inlineVolume: true };

            // Lagu streaming (YouTube/SoundCloud): stream diambil saat mau diputar.
            // inlineVolume dimatikan supaya audio diteruskan apa adanya (hemat CPU server).
            if (typeof song.getStream === "function") {
                const s = await song.getStream();
                input = s.stream;
                if (s.type) options.inputType = s.type;
                options.inlineVolume = false;
            }

            const resource = createAudioResource(input, options);
            if (resource.volume) resource.volume.setVolume(this.volume);
            this.player.play(resource);
            this.trackPlayed(song);

            const dur = song.duration ? ` \`${song.duration}\`` : "";
            this.textChannel.send(`🎵 Sekarang muter: **${song.title}**${dur}${song.autoplay ? " ♾️" : ""}`).catch(() => {});
        } catch (err) {
            console.error("[musicPlayer] Gagal play lagu:", err.message);
            const hint = typeof song.getStream === "function" ? " (YouTube sering nolak koneksi dari server hosting)" : "";
            this.textChannel
                .send(`⚠️ Gagal muter **${song.title}**${hint}, skip ke lagu berikutnya.`)
                .catch(() => {});
            this.songs.shift();
            if (this.songs.length > 0) {
                await this.playNext();
            } else {
                this.playing = false;
                this.scheduleIdleLeave();
            }
        }
    }

    destroy() {
        clearTimeout(this.idleTimeout);
        if (this.connection) {
            try {
                this.connection.destroy();
            } catch (err) {
                // koneksi mungkin udah ke-destroy duluan, aman diabaikan
            }
        }
        queues.delete(this.key);
    }
}

// namespace kosong = bot utama (Nova Verse). Untuk GV Platform pakai getQueue(guildId, "platform").
function getQueue(guildId, namespace = null) {
    return queues.get(queueKey(guildId, namespace));
}

async function connectToVoice(voiceChannel, textChannel) {
    const guild = voiceChannel.guild;
    // Bot mana yang dipakai ditentukan otomatis dari guild.client (bot yang punya voice channel ini)
    const namespace = namespaceOf(guild.client);
    const key = queueKey(guild.id, namespace);

    let queue = queues.get(key);
    if (!queue) {
        queue = new GuildMusicQueue(guild.id, textChannel, namespace);
        queues.set(key, queue);
    }

    if (!queue.connection) {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            // "group" memisahkan koneksi tiap bot. Tanpa ini, 2 bot di 1 proses saling pakai koneksi.
            group: namespace || "default",
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        } catch (err) {
            connection.destroy();
            queues.delete(key);
            throw new Error("Gagal connect ke voice channel (timeout).");
        }

        connection.subscribe(queue.player);
        queue.connection = connection;
    }

    return queue;
}

// Cari file lokal yang namanya mengandung query
function resolveSong(query, requestedBy) {
    if (!fs.existsSync(LOCAL_MUSIC_DIR)) return null;

    const files = fs.readdirSync(LOCAL_MUSIC_DIR).filter((f) =>
        [".mp3", ".wav", ".ogg", ".m4a"].includes(path.extname(f).toLowerCase())
    );
    const match = files.find((f) => f.toLowerCase().includes(query.toLowerCase()));
    if (!match) return null;

    return {
        title: path.parse(match).name,
        source: path.join(LOCAL_MUSIC_DIR, match),
        requestedBy,
    };
}

module.exports = {
    queues,
    getQueue,
    connectToVoice,
    resolveSong,
    GuildMusicQueue,
    LOCAL_MUSIC_DIR,
    queueKey,
    namespaceOf,
};