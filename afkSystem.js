// afkSystem.js
// Fitur AFK: .afk <alasan> -> bot mencatat kamu AFK.
//  - Kalau ada yang me-mention / me-reply orang AFK, bot memberi tahu alasannya.
//  - Kalau orang AFK itu chat lagi, AFK otomatis dicabut ("Welcome back").
// Data disimpan per-server di afkData.json (tetap aman walau bot restart).
//
// Pemasangan: panggil handleMessage(message) dari events/messageCreate.js (lihat petunjuk di chat).
const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const DATA_FILE = path.join(__dirname, "afkData.json");
const GRACE_MS = 5 * 1000; // pesan sesaat setelah .afk diabaikan (biar gak langsung kecabut)
const NOTIFY_COOLDOWN_MS = 30 * 1000; // jeda notifikasi "dia lagi AFK" per channel + orang (anti spam)
const WELCOME_DELETE_MS = 10 * 1000; // pesan "Welcome back" dihapus otomatis setelah ini
const MAX_REASON = 200;
const MAX_LISTED = 5; // maksimal orang AFK yang disebut dalam satu notifikasi
const DEFAULT_REASON = "Tidak disebutkan";
const COLORS = { ok: 0x57f287, info: 0x5865f2 };

// Nickname otomatis saat AFK, contoh: "[ AFK ] Makan Marvin". Nickname lama dikembalikan saat AFK selesai.
// Syarat Discord: bot punya izin Manage Nicknames, role bot di ATAS role user, dan target bukan pemilik server.
const NICK_ENABLED = true;
const NICK_PREFIX = "[ AFK ]";
const NICK_MAX = 32; // batas panjang nickname Discord
const NICK_ISSUES = {
    owner: "Nickname pemilik server gak bisa diubah bot (aturan Discord).",
    hierarchy: "Nickname gak bisa diubah: role bot harus ada di atas role kamu.",
    perm: "Nickname gak bisa diubah: bot butuh izin **Manage Nicknames**.",
    error: "Nickname gak berhasil diubah.",
};
let nickWarned = false;

// { "guildId:userId": { reason, since } }
let data = {};
try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) || {};
} catch (err) {
    data = {};
}

// ---------- simpan ke file (ditunda sebentar + atomik) ----------
let saveTimer = null;
function writeNow() {
    try {
        const tmp = DATA_FILE + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
        console.error("[afk] Gagal simpan afkData.json:", err.message);
    }
}
function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        writeNow();
    }, 500);
}
process.on("exit", () => {
    if (saveTimer) writeNow();
});

const keyOf = (guildId, userId) => `${guildId}:${userId}`;

function cleanReason(text) {
    const r = String(text || "")
        .replace(/@(everyone|here)/gi, "@​$1")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_REASON);
    return r || DEFAULT_REASON;
}

function formatDuration(ms) {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    if (totalMin < 1) return "kurang dari 1 menit";
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    const parts = [];
    if (d) parts.push(`${d} hari`);
    if (h) parts.push(`${h} jam`);
    if (m && !d) parts.push(`${m} menit`);
    return parts.join(" ");
}

// ---------- operasi data ----------
function setAfk(guildId, userId, reasonText) {
    const reason = cleanReason(reasonText);
    const k = keyOf(guildId, userId);
    const prev = data[k];
    const entry = { reason, since: Date.now() };
    if (prev && prev.nickSet) {
        entry.origNick = prev.origNick || null;
        entry.nickSet = prev.nickSet;
    }
    data[k] = entry;
    save();
    return reason;
}

function removeAfk(guildId, userId) {
    const k = keyOf(guildId, userId);
    const entry = data[k];
    if (!entry) return null;
    delete data[k];
    save();
    return entry;
}

function getAfk(guildId, userId) {
    return data[keyOf(guildId, userId)] || null;
}

// ---------- nickname ----------
function buildAfkNick(baseName, reason) {
    const prefix = `${NICK_PREFIX} `;
    let nick = null;
    if (reason && reason !== DEFAULT_REASON) {
        const room = NICK_MAX - prefix.length - 1 - baseName.length; // sisa ruang buat alasan
        if (room >= 3) {
            const cap = reason.charAt(0).toUpperCase() + reason.slice(1);
            const r = cap.length > room ? cap.slice(0, room - 1) + "…" : cap;
            nick = `${prefix}${r} ${baseName}`;
        }
    }
    if (!nick) nick = `${prefix}${baseName}`;
    return nick.slice(0, NICK_MAX);
}

// Hasil: null = berhasil (atau fitur dimatikan), selain itu kode alasan gagal (lihat NICK_ISSUES). AFK tetap jalan walau gagal.
async function applyAfkNickname(member) {
    if (!NICK_ENABLED || !member || !member.guild) return null;
    const entry = getAfk(member.guild.id, member.id);
    if (!entry) return null;
    if (member.id === member.guild.ownerId) return "owner";
    try {
        if (!member.manageable) return "hierarchy";
        const me = member.guild.members && member.guild.members.me;
        if (me && !me.permissions.has("ManageNicknames")) return "perm";

        if (!entry.nickSet) entry.origNick = member.nickname || null; // simpan nickname asli (null = gak punya)
        const base = entry.origNick || member.user.globalName || member.user.username;
        const nick = buildAfkNick(base, entry.reason);
        await member.setNickname(nick, "AFK");
        entry.nickSet = nick;
        save();
        return null;
    } catch (err) {
        if (!nickWarned) {
            nickWarned = true;
            console.log("[afk] Gagal ganti nickname:", err && err.message);
        }
        return err && err.code === 50013 ? "perm" : "error";
    }
}

async function restoreNickname(member, entry) {
    if (!NICK_ENABLED || !member || !entry || !entry.nickSet) return;
    try {
        if (member.nickname !== entry.nickSet) return; // user sudah ganti nickname sendiri, jangan ditimpa
        if (!member.manageable) return;
        await member.setNickname(entry.origNick || null, "AFK selesai");
    } catch (err) {
        // gak fatal
    }
}

// ---------- tampilan (ubah teksnya di sini kalau mau) ----------
function buildSetEmbeds(userId, reason, nickIssue = null) {
    const note = nickIssue && NICK_ISSUES[nickIssue] ? `\n_${NICK_ISSUES[nickIssue]}_` : "";
    return [
        new EmbedBuilder().setColor(COLORS.ok).setDescription(`✅ **• Berhasil!**\nAFK kamu sudah diaktifkan.${note}`),
        new EmbedBuilder().setColor(COLORS.info).setDescription(`<@${userId}> sekarang AFK! **Alasan:** ${reason}`),
    ];
}

const NO_PING = { parse: [], repliedUser: false };
const lastNotified = new Map(); // "channelId:userId" -> waktu terakhir diberi tahu

// Dipanggil untuk SETIAP pesan baru di server.
async function handleMessage(message) {
    if (!message.guild || !message.author || message.author.bot) return;
    const gid = message.guild.id;

    // 1) Yang menulis sedang AFK -> cabut AFK + sambut balik
    const mine = getAfk(gid, message.author.id);
    const isAfkCommand = /^\S{0,2}afk(\s|$)/i.test(message.content || ""); // ".afk ..." / "2afk ..."
    if (mine && !isAfkCommand && Date.now() - mine.since > GRACE_MS) {
        removeAfk(gid, message.author.id);
        await restoreNickname(message.member, mine);
        const embed = new EmbedBuilder()
            .setColor(COLORS.ok)
            .setDescription(`👋 Selamat datang kembali <@${message.author.id}>! Kamu AFK selama **${formatDuration(Date.now() - mine.since)}**.`);
        const sent = await message.reply({ embeds: [embed], allowedMentions: NO_PING }).catch(() => null);
        if (sent) setTimeout(() => sent.delete().catch(() => {}), WELCOME_DELETE_MS);
    }

    // 2) Ada orang AFK yang di-mention / di-reply -> beri tahu
    const targets = new Map();
    if (message.mentions && message.mentions.users) {
        for (const u of message.mentions.users.values()) targets.set(u.id, u);
    }
    if (message.mentions && message.mentions.repliedUser) {
        targets.set(message.mentions.repliedUser.id, message.mentions.repliedUser);
    }
    if (targets.size === 0) return;

    const now = Date.now();
    const lines = [];
    for (const u of targets.values()) {
        if (u.bot || u.id === message.author.id) continue;
        const entry = getAfk(gid, u.id);
        if (!entry) continue;
        const cd = `${message.channel.id}:${u.id}`;
        if (now - (lastNotified.get(cd) || 0) < NOTIFY_COOLDOWN_MS) continue;
        lastNotified.set(cd, now);
        lines.push(`💤 <@${u.id}> sedang AFK: **${entry.reason}** (sejak <t:${Math.floor(entry.since / 1000)}:R>)`);
        if (lines.length >= MAX_LISTED) break;
    }
    if (lines.length === 0) return;
    if (lastNotified.size > 2000) lastNotified.clear();

    const embed = new EmbedBuilder().setColor(COLORS.info).setDescription(lines.join("\n"));
    await message.reply({ embeds: [embed], allowedMentions: NO_PING }).catch(() => {});
}

module.exports = {
    handleMessage,
    setAfk,
    removeAfk,
    getAfk,
    applyAfkNickname,
    buildSetEmbeds,
    buildAfkNick,
    formatDuration,
    NO_PING,
};