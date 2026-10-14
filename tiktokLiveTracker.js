// tiktokLiveTracker.js  (taruh di folder utama, sejajar dengan youtubeLiveTracker.js)
// Notif live TikTok + pasang/cabut role otomatis.
// Pakai library tidak resmi "tiktok-live-connector" (npm i tiktok-live-connector).
// Config: tiktokChannels.json
const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const configPath = path.join(__dirname, "tiktokChannels.json");
const dataPath = path.join(__dirname, "tiktokLiveData.json");

// Interval cek. Jangan terlalu rapat, TikTok bisa membatasi (rate limit) kalau terlalu sering.
const CHECK_INTERVAL_MS = 3 * 60 * 1000;

// Jeda antar akun dalam satu putaran cek (biar gak dianggap spam)
const DELAY_BETWEEN_USERS_MS = 3000;

// Berapa kali cek berturut-turut harus "offline" dulu sebelum role dicabut.
// Cek TikTok kadang salah/gagal sesaat; ini biar role gak kecabut gara-gara 1x salah baca.
const OFFLINE_CONFIRM_CHECKS = 2;

// Batas waktu 1x cek (ms)
const CHECK_TIMEOUT_MS = 20 * 1000;

// Role default kalau di config gak ada "liveRoleId". Kosongin kalau gak mau pakai role.
const DEFAULT_LIVE_ROLE_ID = "";

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function loadConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify([], null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
        console.log("[tiktokLiveTracker] tiktokChannels.json rusak/format salah:", err.message);
        return [];
    }
}

function loadData() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");
    try {
        return JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } catch (err) {
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Library-nya ESM, jadi dimuat pakai import() dinamis (bot kamu CommonJS)
let libPromise = null;
function getLib() {
    if (!libPromise) libPromise = import("tiktok-live-connector");
    return libPromise;
}

const connections = new Map();

async function fetchIsLive(username) {
    const { TikTokLiveConnection } = await getLib();
    let conn = connections.get(username);
    if (!conn) {
        // Opsi dikirim eksplisit: versi baru library kadang error kalau opsi tidak diberikan
        conn = new TikTokLiveConnection(username, { processInitialData: false });
        connections.set(username, conn);
    }
    const result = await Promise.race([
        conn.fetchIsLive(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS)),
    ]);
    return !!result;
}

async function getDiscordTarget(client, discordChannelId, label) {
    let channel = client.channels.cache.get(discordChannelId);

    if (!channel) {
        try {
            channel = await client.channels.fetch(discordChannelId);
        } catch (err) {
            console.log(`[tiktokLiveTracker] Gagal fetch channel/thread ${discordChannelId} buat ${label}:`, err.message);
            return null;
        }
    }

    if (channel && typeof channel.isThread === "function" && channel.isThread() && channel.archived) {
        try {
            await channel.setArchived(false);
        } catch (err) {
            console.log(`[tiktokLiveTracker] Gagal unarchive thread buat ${label} (cek izin Manage Threads):`, err.message);
        }
    }

    return channel;
}

async function sendLiveAnnouncement(client, cfg) {
    const label = cfg.label || cfg.username;
    const url = `https://www.tiktok.com/@${cfg.username}/live`;

    const discordChannel = await getDiscordTarget(client, cfg.discordChannelId, label);
    if (!discordChannel) return { sent: false, discordChannel: null };

    const embed = new EmbedBuilder()
        .setColor(0xFE2C55)
        .setAuthor({ name: `${label} sedang LIVE di TikTok!` })
        .setTitle("Klik di sini buat nonton")
        .setURL(url)
        .setDescription(`@${cfg.username}`)
        .setTimestamp();

    try {
        await discordChannel.send({
            content: `🎵 **${label}** lagi live TikTok sekarang! ${url}`,
            embeds: [embed],
        });
        return { sent: true, discordChannel };
    } catch (err) {
        console.error(`[tiktokLiveTracker] Gagal kirim notif live buat ${label}:`, err.message);
        return { sent: false, discordChannel };
    }
}

async function setLiveRole(discordChannel, cfg, shouldHaveRole) {
    const roleId = cfg.liveRoleId || DEFAULT_LIVE_ROLE_ID;
    const label = cfg.label || cfg.username;

    if (!roleId || !cfg.discordUserId) return;
    if (!discordChannel || !discordChannel.guild) return;

    try {
        const member = await discordChannel.guild.members.fetch(cfg.discordUserId);

        if (shouldHaveRole && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
            console.log(`[tiktokLiveTracker] Role live dipasang ke ${label}.`);
        } else if (!shouldHaveRole && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            console.log(`[tiktokLiveTracker] Role live dicabut dari ${label}.`);
        }
    } catch (err) {
        console.error(`[tiktokLiveTracker] Gagal update role live buat ${label}:`, err.message);
    }
}

// Akun yang errornya sudah pernah dicatat (biar log gak ke-spam tiap 3 menit)
const errorWarned = new Set();

async function checkUser(client, cfg, data) {
    const key = cfg.username.toLowerCase();
    if (!data[key]) data[key] = { isLive: false, offlineStreak: 0 };
    const state = data[key];

    const live = await fetchIsLive(cfg.username); // kalau error, dilempar ke pemanggil, state gak berubah

    if (live) {
        state.offlineStreak = 0;
        if (state.isLive) return; // udah live dari tadi

        // ===== BARU MULAI LIVE =====
        const { sent, discordChannel } = await sendLiveAnnouncement(client, cfg);
        await setLiveRole(discordChannel, cfg, true);
        if (sent || discordChannel) state.isLive = true;
    } else {
        if (!state.isLive) return;

        state.offlineStreak = (state.offlineStreak || 0) + 1;
        if (state.offlineStreak < OFFLINE_CONFIRM_CHECKS) return; // tunggu konfirmasi

        // ===== SELESAI LIVE =====
        const discordChannel = await getDiscordTarget(client, cfg.discordChannelId, cfg.label || cfg.username);
        await setLiveRole(discordChannel, cfg, false);
        state.isLive = false;
        state.offlineStreak = 0;
    }
}

let running = false;

async function checkAll(client) {
    if (running) return; // jangan numpuk kalau putaran sebelumnya belum selesai
    running = true;
    try {
        const channels = loadConfig().filter((c) => c && c.username && c.discordChannelId);
        if (channels.length === 0) return;

        const data = loadData();
        let changed = false;

        for (let i = 0; i < channels.length; i++) {
            const cfg = channels[i];
            const key = cfg.username.toLowerCase();
            try {
                const before = JSON.stringify(data[key]);
                await checkUser(client, cfg, data);
                if (before !== JSON.stringify(data[key])) changed = true;

                if (errorWarned.delete(key)) {
                    console.log(`[tiktokLiveTracker] ${cfg.label || cfg.username} sudah normal lagi.`);
                }
            } catch (err) {
                if (!errorWarned.has(key)) {
                    errorWarned.add(key);
                    const stack = (err.stack || "").split("\n").slice(0, 5).join("\n");
                    console.error(
                        `[tiktokLiveTracker] Error cek ${cfg.label || cfg.username}: ${err.message} (error berikutnya disembunyikan sampai pulih)\n${stack}`
                    );
                }
            }
            if (i < channels.length - 1) await sleep(DELAY_BETWEEN_USERS_MS);
        }

        if (changed) saveData(data);
    } finally {
        running = false;
    }
}

function startTiktokLiveLoop(client) {
    const run = () => checkAll(client).catch((err) => console.error("[tiktokLiveTracker] Error:", err.message));
    run();
    setInterval(run, CHECK_INTERVAL_MS);
    console.log(`[tiktokLiveTracker] Loop aktif (cek tiap ${CHECK_INTERVAL_MS / 1000 / 60} menit).`);
}

module.exports = { startTiktokLiveLoop, checkAll };