const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "inviteData.json");

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

// Cache invite uses per guild, dipakai buat bandingin sebelum/sesudah member baru join
const inviteCache = new Map(); // guildId -> Map(inviteCode -> uses)

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

/** Simpan snapshot invite terbaru buat sebuah guild. Dipanggil pas bot ready & tiap ada invite dibuat/dihapus. */
async function cacheGuildInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        const map = new Map();
        invites.forEach((inv) => map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter?.id || null }));
        inviteCache.set(guild.id, map);
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

/**
 * Dipanggil dari guildMemberAdd, bandingin invite sebelum & sesudah buat cari
 * siapa yang invite-nya kepake, terus tambahin +1 invite valid ke dia.
 */
async function handleMemberJoin(member) {
    const guild = member.guild;
    const oldMap = inviteCache.get(guild.id) || new Map();

    let newInvites;
    try {
        newInvites = await guild.invites.fetch();
    } catch (err) {
        console.error("[inviteTracker] Gagal fetch invite terbaru:", err.message);
        return;
    }

    let usedInvite = null;
    for (const inv of newInvites.values()) {
        const old = oldMap.get(inv.code);
        const oldUses = old ? old.uses : 0;
        if ((inv.uses || 0) > oldUses) {
            usedInvite = inv;
            break;
        }
    }

    // Update cache buat perbandingan berikutnya
    const newMap = new Map();
    newInvites.forEach((inv) => newMap.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter?.id || null }));
    inviteCache.set(guild.id, newMap);

    if (!usedInvite || !usedInvite.inviter) {
        console.log("[inviteTracker] Gak bisa deteksi invite mana yang dipake (mungkin vanity URL).");
        return;
    }

    const inviterId = usedInvite.inviter.id;
    const data = loadData();
    const user = getUser(data, inviterId);
    user.validInvites += 1;
    saveData(data);

    console.log(`[inviteTracker] ${usedInvite.inviter.tag} dapat +1 invite valid (total: ${user.validInvites})`);

    try {
        const inviterMember = await guild.members.fetch(inviterId);
        await syncMemberRole(inviterMember, user.validInvites);
    } catch (err) {
        console.error("[inviteTracker] Gagal fetch member inviter buat update role:", err.message);
    }
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
    INVITE_TIERS,
};