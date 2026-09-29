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

// Map<guildId, GuildMusicQueue>
const queues = new Map();

class GuildMusicQueue {
    constructor(guildId, textChannel) {
        this.guildId = guildId;
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

        this.player.on(AudioPlayerStatus.Idle, () => this.handleTrackEnd());
        this.player.on("error", (err) => {
            console.error("[musicPlayer] Player error:", err.message);
            this.handleTrackEnd();
        });
    }

    async handleTrackEnd() {
        const finished = this.songs.shift();

        if (this.loopMode === "track" && finished) {
            this.songs.unshift(finished);
        } else if (this.loopMode === "queue" && finished) {
            this.songs.push(finished);
        }

        if (this.songs.length > 0) {
            await this.playNext();
        } else {
            this.playing = false;
            // Auto-leave voice channel kalau 60 detik gak ada lagu, biar gak nyangkut
            this.idleTimeout = setTimeout(() => {
                if (!this.playing && this.songs.length === 0) {
                    this.destroy();
                }
            }, 60 * 1000);
        }
    }

    async playNext() {
        clearTimeout(this.idleTimeout);
        const song = this.songs[0];
        if (!song) return;

        try {
            const resource = createAudioResource(song.source, { inlineVolume: true });
            resource.volume.setVolume(this.volume);
            this.player.play(resource);
            this.playing = true;

            this.textChannel.send(`🎵 Sekarang muter: **${song.title}**`).catch(() => {});
        } catch (err) {
            console.error("[musicPlayer] Gagal play lagu:", err.message);
            this.textChannel
                .send(`⚠️ Gagal muter **${song.title}**, skip ke lagu berikutnya.`)
                .catch(() => {});
            this.songs.shift();
            await this.playNext();
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
        queues.delete(this.guildId);
    }
}

function getQueue(guildId) {
    return queues.get(guildId);
}

async function connectToVoice(voiceChannel, textChannel) {
    let queue = queues.get(voiceChannel.guild.id);
    if (!queue) {
        queue = new GuildMusicQueue(voiceChannel.guild.id, textChannel);
        queues.set(voiceChannel.guild.id, queue);
    }

    if (!queue.connection) {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        } catch (err) {
            connection.destroy();
            queues.delete(voiceChannel.guild.id);
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
};