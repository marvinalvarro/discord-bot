const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "inviteData.json");

// Thread/channel tempat notif "X telah di invite oleh Y" otomatis dikirim
const INVITE_LOG_CHANNEL_ID = "1552772455662096515";

// ====== KONFIGURASI TIER & ROLE PER JUMLAH INVITE ======
// Urutan HARUS dari invite terkecil ke terbesar.
// Isi roleId dengan ID role Discord (klik kanan role > Copy Role ID, aktifkan Developer Mode dulu kalau perlu).
const INVITE_TIERS = [
    { count: 3, title: "GV Recruiter", roleId: "1542459874821279824" },
    { count: 5, title: "GV Scout", roleId: "1542460093738520606" },
    { count: 10, title: "GV Promoter", roleId: "1542460209979465729" },
    { count: 20, title: "GV Ambassador", roleId: "1542460288895418439" },
    { count: 30, title: "GV Elite Ambassador", roleId: "1542460370822889472" },
    { count: 50, title: "GAME VERSE LEGEND", roleId: "1542460457447858176" },
];

// Cache invite per guild, dipakai buat bandingin sebelum/sesudah member baru join
// guildId -> Map(inviteCode -> { uses, inviterId, maxUses })
const inviteCache = new Map();

// Antrian proses join per guild, biar member yang join hampir bersamaan diproses satu-satu (nggak tabrakan)
const joinQueues = new Map(); // guildId -> Promise

function loadData() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    } catch (err) {
        console.error("[inviteTracker] Gagal membaca inviteData.json:", err);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUser(data, userId) {
    if (!data[userId]) {
        data[userId] = { validInvites: 0 };
    }
    return data[userId];
}

function getTierForCount(count) {
    let result = null;
    for (const tier of INVITE_TIERS) {
        if (count >= tier.count) {
            result = tier;
        } else {
            break;
        }
    }
    return result;
}

async function syncMemberRole(member, count) {
    const targetTier = getTierForCount(count);
    if (!targetTier || !targetTier.roleId) return;

    const allTierRoleIds = INVITE_TIERS.map((t) => t.roleId).filter(Boolean);

    try {
        const rolesToRemove = allTierRoleIds.filter(
            (id) => id !== targetTier.roleId && member.roles.cache.has(id)
        );
        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
        }

        if (!member.roles.cache.has(targetTier.roleId)) {
            await member.roles.add(targetTier.roleId);
        }
    } catch (err) {
        console.error(`[inviteTracker] Gagal update role buat ${member.user?.tag || member.id}:`, err.message);
    }
}

/** Ubah daftar invite dari Discord jadi snapshot ringan (kode -> uses, pengundang, batas pemakaian). */
function snapshotInvites(invites) {
    const map = new Map();
    invites.forEach((inv) =>
        map.set(inv.code, {
            uses: inv.uses || 0,
            inviterId: inv.inviter?.id || null,
            maxUses: inv.maxUses || 0,
        })
    );
    return map;
}

/** Simpan snapshot invite terbaru buat sebuah guild. Dipanggil pas bot ready. */
async function cacheGuildInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        inviteCache.set(guild.id, snapshotInvites(invites));
    } catch (err) {
        console.error(`[inviteTracker] Gagal cache invite guild ${guild.name}:`, err.message);
    }
}

/** Dipanggil sekali dari ready.js buat cache semua guild invite pas bot nyala. */
async function initInviteCache(client) {
    for (const guild of client.guilds.cache.values()) {
        await cacheGuildInvites(guild);
    }
    console.log("[inviteTracker] Cache invite awal selesai.");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cari invite yang kepake member baru.
 * 1) Invite yang jumlah pemakaiannya nambah dibanding snapshot lama.
 * 2) Kalau nggak ada: invite yang HILANG dari daftar karena batas pemakaiannya habis
 *    (misal invite sekali-pakai, langsung dihapus Discord setelah dipakai).
 */
function detectUsedInvite(oldMap, newInvites) {
    for (const inv of newInvites.values()) {
        const old = oldMap.get(inv.code);
        const oldUses = old ? old.uses : 0;
        if ((inv.uses || 0) > oldUses) {
            return { code: inv.code, inviterId: inv.inviter?.id || null, source: "uses" };
        }
    }

    const newCodes = new Set(newInvites.keys());
    for (const [code, old] of oldMap.entries()) {
        if (!newCodes.has(code) && old.maxUses > 0 && old.uses + 1 >= old.maxUses && old.inviterId) {
            return { code, inviterId: old.inviterId, source: "habis" };
        }
    }

    return null;
}

/**
 * Ambil channel/thread log invite. Thread yang sudah ter-archive nggak ada di cache
 * (apalagi setelah bot restart), jadi kalau nggak ketemu di cache, di-fetch langsung dari Discord,
 * lalu di-unarchive kalau perlu.
 */
async function getLogChannel(guild) {
    let channel = guild.channels.cache.get(INVITE_LOG_CHANNEL_ID);

    if (!channel) {
        try {
            channel = await guild.client.channels.fetch(INVITE_LOG_CHANNEL_ID);
        } catch (err) {
            console.error("[inviteTracker] Gagal fetch channel log invite:", err.message);
            return null;
        }
    }

    if (channel && typeof channel.isThread === "function" && channel.isThread()) {
        try {
            // Unlock + unarchive dibarengin dalam 1 request. Thread yang locked+archived
            // sekaligus kadang ditolak Discord kalau cuma salah satunya doang yang diubah,
            // dan cache lokal bot (channel.locked/channel.archived) kadang gak akurat -
            // jadi langsung aja edit dua-duanya tiap kali, gak usah cek cache dulu.
            await channel.edit({ locked: false, archived: false });
            console.log("[inviteTracker] Thread log invite di-unlock & dibuka lagi (kalau tadinya locked/archived).");
        } catch (err) {
            console.error("[inviteTracker] Gagal unlock/unarchive thread log invite (cek izin Manage Threads):", err.message);
        }
    }

    return channel;
}

async function processMemberJoin(member) {
    const guild = member.guild;
    const oldMap = inviteCache.get(guild.id) || new Map();

    let newInvites;
    try {
        newInvites = await guild.invites.fetch();
    } catch (err) {
        console.error("[inviteTracker] Gagal fetch invite terbaru (cek izin Manage Server):", err.message);
        return;
    }

    let used = detectUsedInvite(oldMap, newInvites);

    // Kadang angka "uses" invite di Discord belum ke-update pas kita fetch (terutama kalau
    // ada 2+ member join hampir bersamaan). Kalau gagal kedeteksi di percobaan pertama,
    // tunggu sebentar terus coba fetch ulang sekali sebelum bener-bener nyerah.
    if (!used) {
        await sleep(1500);
        try {
            newInvites = await guild.invites.fetch();
            used = detectUsedInvite(oldMap, newInvites);
            if (used) {
                console.log(`[inviteTracker] Kedeteksi setelah retry buat ${member.user?.tag || member.id}.`);
            }
        } catch (err) {
            console.error("[inviteTracker] Gagal fetch ulang invite (retry):", err.message);
        }
    }

    // Update cache. Kalau ada beberapa invite yang nambah sekaligus (beberapa orang join barengan),
    // cuma 1 pemakaian yang dikreditkan ke member ini; sisanya dibiarin "nunggu" buat member berikutnya.
    const newMap = snapshotInvites(newInvites);
    if (used && used.source === "uses") {
        for (const [code, snap] of newMap.entries()) {
            const old = oldMap.get(code);
            const oldUses = old ? old.uses : 0;
            if (code === used.code) {
                snap.uses = oldUses + 1;
            } else if (snap.uses > oldUses) {
                snap.uses = oldUses;
            }
        }
    }
    inviteCache.set(guild.id, newMap);

    if (!used || !used.inviterId) {
        console.log(
            `[inviteTracker] Gak bisa deteksi invite buat ${member.user?.tag || member.id} ` +
            `(invite aktif: ${newInvites.size}). Kemungkinan vanity URL / Server Discovery / invite sekali-pakai yang dibuat setelah bot nyala.`
        );
        return;
    }

    const inviterId = used.inviterId;
    const data = loadData();
    const user = getUser(data, inviterId);
    user.validInvites += 1;
    saveData(data);

    console.log(
        `[inviteTracker] ${member.user?.tag || member.id} masuk lewat invite ${used.code} (${used.source}) ` +
        `-> ${inviterId} dapat +1 invite valid (total: ${user.validInvites})`
    );

    // Kirim notif otomatis ke thread log invite
    try {
        const logChannel = await getLogChannel(guild);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send(
                `${member} telah di invite oleh <@${inviterId}>. Sekarang memiliki jumlah **${user.validInvites}** invites.`
            );
        } else {
            console.log("[inviteTracker] Channel log invite gak ketemu, cek INVITE_LOG_CHANNEL_ID.");
        }
    } catch (err) {
        console.error("[inviteTracker] Gagal kirim notif ke channel log invite:", err.message);
    }

    try {
        const inviterMember = await guild.members.fetch(inviterId);
        await syncMemberRole(inviterMember, user.validInvites);
    } catch (err) {
        console.error("[inviteTracker] Gagal fetch member inviter buat update role:", err.message);
    }
}

/**
 * Dipanggil dari guildMemberAdd. Member yang join hampir bersamaan diproses berurutan lewat antrian.
 */
function handleMemberJoin(member) {
    const guildId = member.guild.id;
    const previous = joinQueues.get(guildId) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => processMemberJoin(member));
    joinQueues.set(guildId, next);
    return next;
}

/**
 * Reset invite valid seorang user ke 0, DAN otomatis cabut semua role tier invite dari dia.
 * @returns {{ previousCount: number, removedRoles: boolean }}
 */
async function resetUserInvites(guild, userId) {
    const data = loadData();
    const user = getUser(data, userId);
    const previousCount = user.validInvites;

    user.validInvites = 0;
    saveData(data);

    let removedRoles = false;
    try {
        const member = await guild.members.fetch(userId);
        const allTierRoleIds = INVITE_TIERS.map((t) => t.roleId).filter(Boolean);
        const rolesToRemove = allTierRoleIds.filter((id) => member.roles.cache.has(id));

        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
            removedRoles = true;
        }
    } catch (err) {
        console.error(`[inviteTracker] Gagal cabut role pas reset invite ${userId}:`, err.message);
    }

    console.log(`[inviteTracker] Invite ${userId} di-reset dari ${previousCount} ke 0.`);

    return { previousCount, removedRoles };
}

/**
 * Reset invite valid SEMUA member ke 0, DAN cabut semua role tier invite dari SEMUA member.
 * @returns {{ strippedCount: number }}
 */
async function resetAllInvites(guild) {
    // Reset semua data invite ke kosong
    saveData({});

    const allTierRoleIds = INVITE_TIERS.map((t) => t.roleId).filter(Boolean);
    let strippedCount = 0;

    if (allTierRoleIds.length > 0) {
        const members = await guild.members.fetch();

        for (const member of members.values()) {
            const rolesToRemove = allTierRoleIds.filter((id) => member.roles.cache.has(id));
            if (rolesToRemove.length > 0) {
                try {
                    await member.roles.remove(rolesToRemove);
                    strippedCount++;
                } catch (err) {
                    console.error(`[inviteTracker] Gagal cabut role dari ${member.user.tag}:`, err.message);
                }
            }
        }
    }

    console.log(`[inviteTracker] Semua invite di-reset. ${strippedCount} member di-strip role.`);

    return { strippedCount };
}

module.exports = {
    loadData,
    saveData,
    getUser,
    getTierForCount,
    syncMemberRole,
    cacheGuildInvites,
    initInviteCache,
    handleMemberJoin,
    resetUserInvites,
    resetAllInvites,
    INVITE_TIERS,
};