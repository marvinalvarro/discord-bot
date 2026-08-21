// ====== KONFIGURASI TITLE & ROLE PER LEVEL ======
// Urutan HARUS dari level terkecil ke terbesar.

const CHAT_TIERS = [
    { level: 3, title: "GV SPARK Chat", roleId: "1540462930615730287" },
    { level: 7, title: "GV TALKER Chat", roleId: "1540463840104423504" },
    { level: 12, title: "GV TYPER Chat", roleId: "1540463700274585741" },
    { level: 20, title: "GV SIGNAL Chat", roleId: "1540464060850643135" },
    { level: 35, title: "GV SYNTAX Chat", roleId: "1540464192740397217" },
    { level: 55, title: "GV NEON Chat", roleId: "1540464314585055302" },
    { level: 80, title: "GV CYBER Chat", roleId: "1540464427453648977" },
    { level: 120, title: "GV QUANTUM Chat", roleId: "1540464624216965162" },
    { level: 170, title: "GV NEXUS Chat", roleId: "1540464741087051796" },
    { level: 250, title: "GAME VERSE CHAT LEGEND", roleId: "1540464864323960832" },
];

const VOICE_TIERS = [
    { level: 3, title: "GV WHISPER Voice", roleId: "1540465873201135646" },
    { level: 8, title: "GV AMPLIFIER Voice", roleId: "1540465998895775775" },
    { level: 15, title: "GV FREQUENCY Voice", roleId: "1540466169226600508" },
    { level: 25, title: "GV VOCALIST Voice", roleId: "1540466278056075406" },
    { level: 40, title: "GV SONIC Voice", roleId: "1540466384708833330" },
    { level: 60, title: "GV ECHO Voice", roleId: "1540466495463751712" },
    { level: 90, title: "GV PULSE Voice", roleId: "1540466603182002207" },
    { level: 130, title: "GV VOLT Voice", roleId: "1540466692294049902" },
    { level: 180, title: "GV RESONANCE Voice", roleId: "1540466790285443134" },
    { level: 250, title: "GAME VERSE VOICE LEGEND", roleId: "1540466897877864528" },
];

/** Cari tier tertinggi yang udah tercapai di level ini (atau di bawahnya). */
function getTierForLevel(level, tiers) {
    let result = null;
    for (const tier of tiers) {
        if (level >= tier.level) {
            result = tier;
        } else {
            break;
        }
    }
    return result;
}

/**
 * Kasih role sesuai tier baru, dan copot role tier lain (dari kategori yang sama)
 * biar gak numpuk banyak role tier sekaligus. Aman dipanggil walau roleId masih null
 * (bakal di-skip otomatis).
 */
async function syncMemberRole(member, newLevel, tiers) {
    const targetTier = getTierForLevel(newLevel, tiers);
    if (!targetTier || !targetTier.roleId) return; // belum ada role yang di-set buat tier ini

    const allTierRoleIds = tiers.map((t) => t.roleId).filter(Boolean);

    try {
        // Copot semua role tier lain (kategori yang sama) yang mungkin masih nempel
        const rolesToRemove = allTierRoleIds.filter(
            (id) => id !== targetTier.roleId && member.roles.cache.has(id)
        );
        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
        }

        // Kasih role tier baru kalau belum ada
        if (!member.roles.cache.has(targetTier.roleId)) {
            await member.roles.add(targetTier.roleId);
        }
    } catch (err) {
        console.error(`[rankRoles] Gagal update role buat ${member.user?.tag || member.id}:`, err.message);
    }
}

module.exports = {
    CHAT_TIERS,
    VOICE_TIERS,
    getTierForLevel,
    syncMemberRole,
};