// autoPlay.js
// Saat bot menyala: otomatis masuk ke voice channel tertentu dan muter SEMUA lagu di folder music/
// (berurutan, ngulang terus dari awal) - sama seperti perintah playall, tapi tanpa perlu diketik manual.
//
// .env (isi ID voice channel; klik kanan channel -> Copy Channel ID, mode Developer harus aktif):
//   NOVA_AUTOPLAY_CHANNEL_ID=...        voice channel buat bot Nova Verse (prefix ".")
//   PLATFORM_AUTOPLAY_CHANNEL_ID=...    voice channel buat bot GV Platform (prefix ",")
// Opsional:
//   AUTOPLAY_SHUFFLE=1      acak urutan lagu tiap bot menyala (default: urut nama file)
//   AUTOPLAY_KEEPALIVE=1    cek tiap 1 menit; kalau bot keluar/terputus dari voice, masuk & muter lagi.
//                           (Catatan: dengan ini, perintah stop bakal "dibatalkan" dalam 1 menit.)
//
// Kalau ID-nya gak diisi, fitur ini otomatis dilewati.
const fs = require("fs");
const path = require("path");
const { Events } = require("discord.js");
const { getQueue, connectToVoice, LOCAL_MUSIC_DIR } = require("./musicPlayer");

const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a"];
const START_DELAY_MS = Number(process.env.AUTOPLAY_START_DELAY_MS) || 5000; // tunggu cache Discord siap
const RETRY_DELAY_MS = Number(process.env.AUTOPLAY_RETRY_DELAY_MS) || 10000;
const MAX_ATTEMPTS = 3;
const KEEPALIVE_MS = Number(process.env.AUTOPLAY_KEEPALIVE_MS) || 60 * 1000;

// Pengganti text channel: auto-play jalan diam-diam, gak ngirim "Sekarang muter" tiap ganti lagu.
const silentChannel = { send: () => Promise.resolve() };

const started = new WeakSet(); // satu client cukup di-setup sekali
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function listSongs() {
    if (!fs.existsSync(LOCAL_MUSIC_DIR)) return [];
    const files = fs
        .readdirSync(LOCAL_MUSIC_DIR)
        .filter((f) => AUDIO_EXT.includes(path.extname(f).toLowerCase()))
        .sort();
    if (process.env.AUTOPLAY_SHUFFLE === "1") {
        for (let i = files.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [files[i], files[j]] = [files[j], files[i]];
        }
    }
    return files.map((file) => ({
        title: path.parse(file).name,
        source: path.join(LOCAL_MUSIC_DIR, file),
        requestedBy: "AutoPlay",
    }));
}

// Hasil: "ok" (sudah/berhasil muter), "fatal" (konfigurasi salah, gak perlu dicoba ulang).
// Melempar error kalau gagal connect (bisa dicoba ulang).
async function startPlayback(client, channelId, name) {
    const channel = client.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null));
    if (!channel || typeof channel.isVoiceBased !== "function" || !channel.isVoiceBased()) {
        console.log(`[AutoPlay:${name}] Channel ${channelId} gak ketemu atau bukan voice channel. Cek ID dan izin bot.`);
        return "fatal";
    }

    const perms = channel.permissionsFor(client.user);
    if (!perms || !perms.has("Connect") || !perms.has("Speak")) {
        console.log(`[AutoPlay:${name}] Bot gak punya izin Connect/Speak di #${channel.name || channelId}.`);
        return "fatal";
    }

    const songs = listSongs();
    if (songs.length === 0) {
        console.log(`[AutoPlay:${name}] Folder music/ kosong atau gak ada, auto-play dilewati.`);
        return "fatal";
    }

    const ns = client.musicNamespace || null;
    const existing = getQueue(channel.guild.id, ns);
    if (existing && existing.playing && existing.connection) return "ok"; // udah muter (mis. playall diketik duluan)
    if (existing) {
        // sisa queue yang macet: bersihkan dulu
        existing.songs = [];
        try {
            existing.player.stop(true);
        } catch (err) {
            // player mungkin sudah berhenti
        }
        existing.destroy();
    }

    const queue = await connectToVoice(channel, silentChannel);
    queue.songs = songs;
    queue.loopMode = "queue";
    if (!queue.playing) await queue.playNext();
    console.log(`[AutoPlay:${name}] Muter ${songs.length} lagu di #${channel.name || channelId}.`);
    return "ok";
}

function isHealthy(client, channelId) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return false;
    const q = getQueue(channel.guild.id, client.musicNamespace || null);
    const me = channel.guild.members && channel.guild.members.me;
    return !!(q && q.connection && q.playing && me && me.voice && me.voice.channelId === channelId);
}

function setupAutoPlay(client, { envKey, name }) {
    const channelId = (process.env[envKey] || "").trim();
    if (!channelId) {
        console.log(`[AutoPlay:${name}] ${envKey} belum diisi di .env, auto-play dilewati.`);
        return;
    }
    if (started.has(client)) return;
    started.add(client);

    let busy = false;
    const attempt = async (tries) => {
        if (busy) return;
        busy = true;
        try {
            for (let i = 1; i <= tries; i++) {
                try {
                    if ((await startPlayback(client, channelId, name)) === "fatal") return;
                    return;
                } catch (err) {
                    console.log(`[AutoPlay:${name}] Percobaan ${i}/${tries} gagal: ${err.message}`);
                    if (i < tries) await sleep(RETRY_DELAY_MS);
                }
            }
        } finally {
            busy = false;
        }
    };

    const begin = () => {
        setTimeout(() => {
            attempt(MAX_ATTEMPTS).catch((err) => console.error(`[AutoPlay:${name}] Error:`, err));
            if (process.env.AUTOPLAY_KEEPALIVE === "1") {
                const timer = setInterval(() => {
                    if (!busy && !isHealthy(client, channelId)) {
                        console.log(`[AutoPlay:${name}] Bot keluar dari voice, masuk dan muter lagi...`);
                        attempt(1).catch((err) => console.error(`[AutoPlay:${name}] Error:`, err));
                    }
                }, KEEPALIVE_MS);
                if (timer.unref) timer.unref();
            }
        }, START_DELAY_MS);
    };

    if (typeof client.isReady === "function" && client.isReady()) begin();
    else client.once(Events.ClientReady, begin);
}

module.exports = { setupAutoPlay, startPlayback, isHealthy };