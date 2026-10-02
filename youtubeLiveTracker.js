const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const channelsConfigPath = path.join(__dirname, "youtubeChannels.json");
const dataPath = path.join(__dirname, "youtubeLiveData.json");

// Interval cek (ms). 3 menit cukup hemat kuota API walau pantau banyak channel sekaligus.
const CHECK_INTERVAL_MS = 3 * 60 * 1000;

// Role default yang dipasang pas seseorang live, dicabut pas selesai live.
// Bisa di-override per channel lewat field "liveRoleId" di youtubeChannels.json kalau mau beda-beda.
// Kosongin jadi "" kalau gak mau ada role sama sekali (cuma notif doang).
const DEFAULT_LIVE_ROLE_ID = "";

function loadChannelsConfig() {
    if (!fs.existsSync(channelsConfigPath)) {
        fs.writeFileSync(channelsConfigPath, JSON.stringify([], null, 2));
    }
    return JSON.parse(fs.readFileSync(channelsConfigPath, "utf8"));
}

function loadData() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Ambil daftar video ID terbaru dari RSS feed publik YouTube (gratis, gak pake kuota API sama sekali)
async function getLatestVideoIds(channelId) {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RSS feed gagal diambil (status ${res.status})`);
    const xml = await res.text();

    const ids = [];
    const regex = /<yt:videoId>([^<]+)<\/yt:videoId>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        ids.push(match[1]);
    }
    return ids.slice(0, 5); // ambil 5 video/stream terbaru aja, cukup buat deteksi live
}

// Cek status live dari beberapa video ID sekaligus (1 request = 1 unit kuota, gak peduli berapa ID-nya)
async function getLiveVideoDetails(videoIds, apiKey) {
    if (videoIds.length === 0) return [];
    const idsParam = videoIds.join(",");
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${idsParam}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`YouTube API error (status ${res.status}): ${body}`);
    }
    const json = await res.json();
    return json.items || [];
}

/**
 * Ambil channel/thread tujuan notif. Thread yang ter-archive nggak ada di cache
 * (apalagi setelah bot restart atau sepi aktivitas), jadi kalau nggak ketemu di cache,
 * di-fetch langsung dari Discord, lalu di-unarchive kalau perlu.
 * (Pola yang sama kayak getLogChannel di inviteTracker.js)
 */
async function getDiscordTarget(client, discordChannelId, label) {
    let channel = client.channels.cache.get(discordChannelId);

    if (!channel) {
        try {
            channel = await client.channels.fetch(discordChannelId);
        } catch (err) {
            console.log(`[youtubeLiveTracker] Gagal fetch channel/thread ${discordChannelId} buat ${label}:`, err.message);
            return null;
        }
    }

    if (channel && typeof channel.isThread === "function" && channel.isThread() && channel.archived) {
        try {
            await channel.setArchived(false);
            console.log(`[youtubeLiveTracker] Thread buat ${label} tadi ter-archive, sudah dibuka lagi.`);
        } catch (err) {
            console.log(`[youtubeLiveTracker] Gagal unarchive thread buat ${label} (cek izin Manage Threads):`, err.message);
        }
    }

    return channel;
}

// Bikin embed notif live dari data video (dipakai baik buat notif asli maupun preview/dummy)
function buildLiveEmbed(label, liveVideo) {
    const thumbnail =
        liveVideo.snippet.thumbnails?.maxres?.url ||
        liveVideo.snippet.thumbnails?.high?.url ||
        liveVideo.snippet.thumbnails?.default?.url;

    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setAuthor({ name: `${label || liveVideo.snippet.channelTitle} sedang LIVE di YouTube!` })
        .setTitle(liveVideo.snippet.title)
        .setURL(`https://www.youtube.com/watch?v=${liveVideo.id}`)
        .setImage(thumbnail || null)
        .setTimestamp();
}

// Kirim notif live ke thread/channel tujuan. Dipakai baik buat notif asli maupun preview/dummy.
async function sendLiveAnnouncement(client, channelConfig, liveVideo) {
    const { discordChannelId, label } = channelConfig;

    const discordChannel = await getDiscordTarget(client, discordChannelId, label || channelConfig.channelId);
    if (!discordChannel) {
        console.log(`[youtubeLiveTracker] Discord channel/thread ${discordChannelId} tidak ditemukan buat ${label}.`);
        return { sent: false, discordChannel: null };
    }

    const embed = buildLiveEmbed(label, liveVideo);

    try {
        await discordChannel.send({
            content: `🔴 **${label || liveVideo.snippet.channelTitle}** lagi live sekarang! https://www.youtube.com/watch?v=${liveVideo.id}`,
            embeds: [embed],
        });
        return { sent: true, discordChannel };
    } catch (err) {
        console.error(`[youtubeLiveTracker] Gagal kirim notif live buat ${label}:`, err.message);
        return { sent: false, discordChannel };
    }
}

/**
 * Pasang/cabut role live. Butuh "discordUserId" di config channel itu.
 * Guild diambil dari channel notif (channel.guild), jadi gak perlu field guildId terpisah.
 */
async function setLiveRole(discordChannel, channelConfig, shouldHaveRole) {
    const roleId = channelConfig.liveRoleId || DEFAULT_LIVE_ROLE_ID;
    const { discordUserId, label } = channelConfig;

    if (!roleId || !discordUserId) return; // fitur role gak dikonfig buat channel ini, skip diam-diam
    if (!discordChannel || !discordChannel.guild) return;

    try {
        const member = await discordChannel.guild.members.fetch(discordUserId);

        if (shouldHaveRole && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
            console.log(`[youtubeLiveTracker] Role live dipasang ke ${label || discordUserId}.`);
        } else if (!shouldHaveRole && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            console.log(`[youtubeLiveTracker] Role live dicabut dari ${label || discordUserId}.`);
        }
    } catch (err) {
        console.error(`[youtubeLiveTracker] Gagal update role live buat ${label || discordUserId}:`, err.message);
    }
}

async function checkChannel(client, channelConfig, apiKey, data) {
    const { channelId } = channelConfig;

    if (!data[channelId]) {
        data[channelId] = { isLive: false, lastAnnouncedVideoId: null };
    }
    // Jaga-jaga buat data lama (sebelum ada field isLive) biar gak error
    if (data[channelId].isLive === undefined) {
        data[channelId].isLive = !!data[channelId].lastAnnouncedVideoId;
    }

    const videoIds = await getLatestVideoIds(channelId);
    const videos = await getLiveVideoDetails(videoIds, apiKey);

    const liveVideo = videos.find((v) => v.snippet?.liveBroadcastContent === "live");

    if (liveVideo) {
        if (data[channelId].isLive) return; // udah live dari pengecekan sebelumnya, gak perlu diulang

        // ===== BARU MULAI LIVE =====
        const { sent, discordChannel } = await sendLiveAnnouncement(client, channelConfig, liveVideo);
        await setLiveRole(discordChannel, channelConfig, true);

        if (sent || discordChannel) {
            data[channelId].isLive = true;
            data[channelId].lastAnnouncedVideoId = liveVideo.id;
        }
    } else {
        if (!data[channelId].isLive) return; // emang dari tadi gak live, gak ada perubahan

        // ===== BARU SELESAI LIVE =====
        // Guild buat cabut role diambil lewat channel notif yang sama
        const discordChannel = await getDiscordTarget(client, channelConfig.discordChannelId, channelConfig.label);
        await setLiveRole(discordChannel, channelConfig, false);

        data[channelId].isLive = false;
    }
}

async function checkAllChannels(client) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        console.log("[youtubeLiveTracker] YOUTUBE_API_KEY belum diset di .env, skip pengecekan.");
        return;
    }

    const channels = loadChannelsConfig();
    if (channels.length === 0) return;

    const data = loadData();
    let changed = false;

    for (const channelConfig of channels) {
        try {
            const before = JSON.stringify(data[channelConfig.channelId]);
            await checkChannel(client, channelConfig, apiKey, data);
            const after = JSON.stringify(data[channelConfig.channelId]);
            if (before !== after) changed = true;
        } catch (err) {
            console.error(
                `[youtubeLiveTracker] Error cek channel ${channelConfig.label || channelConfig.channelId}:`,
                err.message
            );
        }
    }

    if (changed) saveData(data);
}

/**
 * Kirim notif CONTOH/DUMMY ke thread tujuan, pakai data video palsu, TANPA nyentuh
 * youtubeLiveData.json sama sekali. Berguna buat preview tampilan tanpa perlu nunggu
 * orangnya beneran live. (Role live TIDAK ikut dipasang di mode preview ini, sengaja,
 * biar gak kebawa kecabut keliru.)
 * @param {import("discord.js").Client} client
 * @param {string|null} label - nama creator (cocokin ke field "label" di youtubeChannels.json).
 *   Kalau null/kosong, dipakai channel PERTAMA di daftar.
 * @returns {Promise<boolean>} true kalau berhasil terkirim
 */
async function previewLiveAnnouncement(client, label) {
    const channels = loadChannelsConfig();
    if (channels.length === 0) {
        throw new Error("youtubeChannels.json masih kosong, belum ada channel yang didaftarin.");
    }

    const channelConfig = label
        ? channels.find((c) => (c.label || "").toLowerCase() === label.toLowerCase())
        : channels[0];

    if (!channelConfig) {
        throw new Error(`Gak nemu channel dengan label "${label}" di youtubeChannels.json.`);
    }

    const dummyVideo = {
        id: "dQw4w9WgXcQ",
        snippet: {
            title: `[CONTOH/PREVIEW] ${channelConfig.label || "Creator"} lagi main bareng viewers!`,
            channelTitle: channelConfig.label || "Creator",
            thumbnails: {
                high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
            },
        },
    };

    const { sent } = await sendLiveAnnouncement(client, channelConfig, dummyVideo);
    return sent;
}

function startYoutubeLiveLoop(client) {
    if (!process.env.YOUTUBE_API_KEY) {
        console.log("[youtubeLiveTracker] YOUTUBE_API_KEY belum diset di .env, fitur live notif YouTube gak aktif.");
        return;
    }

    checkAllChannels(client).catch((err) => console.error("[youtubeLiveTracker] Error:", err.message));
    setInterval(() => {
        checkAllChannels(client).catch((err) => console.error("[youtubeLiveTracker] Error:", err.message));
    }, CHECK_INTERVAL_MS);

    console.log(`[youtubeLiveTracker] Loop aktif (cek tiap ${CHECK_INTERVAL_MS / 1000 / 60} menit).`);
}

module.exports = { startYoutubeLiveLoop, checkAllChannels, previewLiveAnnouncement };