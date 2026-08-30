const fs = require("fs");
const path = require("path");
const { CHAT_TIERS, VOICE_TIERS } = require("./rankRoles");

const SEASON_INFO_PATH = path.join(__dirname, "seasonInfo.json");
const VOICE_DATA_PATH = path.join(__dirname, "xpData.json");
const CHAT_DATA_PATH = path.join(__dirname, "chatXpData.json");

function getSeasonArchivePath(type, seasonNumber) {
    // type: "voice" atau "chat"
    return path.join(__dirname, `${type}Data.season${seasonNumber}.json`);
}

function loadSeasonInfo() {
    if (!fs.existsSync(SEASON_INFO_PATH)) {
        fs.writeFileSync(SEASON_INFO_PATH, JSON.stringify({ currentSeason: 1 }, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(SEASON_INFO_PATH, "utf8"));
    } catch (err) {
        return { currentSeason: 1 };
    }
}

function saveSeasonInfo(info) {
    fs.writeFileSync(SEASON_INFO_PATH, JSON.stringify(info, null, 2));
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        return {};
    }
}

/** Copot semua role tier (chat + voice) dari SEMUA member di guild. */
async function stripAllTierRoles(guild) {
    const allTierRoleIds = [
        ...CHAT_TIERS.map((t) => t.roleId),
        ...VOICE_TIERS.map((t) => t.roleId),
    ].filter(Boolean);

    if (allTierRoleIds.length === 0) return 0;

    const members = await guild.members.fetch();
    let strippedCount = 0;

    for (const member of members.values()) {
        const rolesToRemove = allTierRoleIds.filter((id) => member.roles.cache.has(id));
        if (rolesToRemove.length > 0) {
            try {
                await member.roles.remove(rolesToRemove);
                strippedCount++;
            } catch (err) {
                console.error(`[seasonManager] Gagal copot role dari ${member.user.tag}:`, err.message);
            }
        }
    }

    return strippedCount;
}

/**
 * Arsipin data season sekarang, reset ke kosong buat season baru,
 * dan copot semua role tier dari semua member.
 * @returns {{ archivedSeason: number, newSeason: number, strippedCount: number }}
 */
async function startNewSeason(guild) {
    const info = loadSeasonInfo();
    const archivedSeason = info.currentSeason;

    // Arsipin data voice & chat yang sekarang
    const voiceData = readJson(VOICE_DATA_PATH);
    const chatData = readJson(CHAT_DATA_PATH);

    fs.writeFileSync(getSeasonArchivePath("xp", archivedSeason), JSON.stringify(voiceData, null, 2));
    fs.writeFileSync(getSeasonArchivePath("chatXp", archivedSeason), JSON.stringify(chatData, null, 2));

    // Reset data aktif ke kosong
    fs.writeFileSync(VOICE_DATA_PATH, JSON.stringify({}, null, 2));
    fs.writeFileSync(CHAT_DATA_PATH, JSON.stringify({}, null, 2));

    // Copot semua role tier dari semua member
    const strippedCount = await stripAllTierRoles(guild);

    // Naikin nomor season
    const newSeason = archivedSeason + 1;
    saveSeasonInfo({ currentSeason: newSeason });

    console.log(`[seasonManager] Season ${archivedSeason} diarsipkan, mulai Season ${newSeason}. ${strippedCount} member di-strip role.`);

    return { archivedSeason, newSeason, strippedCount };
}

/** Ambil leaderboard dari season yang udah lewat (arsip). */
function getArchivedLeaderboard(type, seasonNumber) {
    const archivePath = getSeasonArchivePath(type === "voice" ? "xp" : "chatXp", seasonNumber);
    if (!fs.existsSync(archivePath)) return null;
    return readJson(archivePath);
}

function getCurrentSeason() {
    return loadSeasonInfo().currentSeason;
}

module.exports = {
    startNewSeason,
    getArchivedLeaderboard,
    getCurrentSeason,
};