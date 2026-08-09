const config = require("./config");

/**
 * Cek apakah message ini dikirim di channel khusus game.
 * Kalau bukan, otomatis reply nolak dan return false.
 * Dipakai di awal tiap command game.
 */
function isInGamesChannel(message) {
    const gamesChannelId = config.gamesChannelId;

    if (!gamesChannelId) return true; // kalau belum di-set, gak dibatasi (biar gak ke-block semua)

    if (message.channelId !== gamesChannelId) {
        message.reply(`🎮 Command game cuma bisa dipake di <#${gamesChannelId}> ya!`);
        return false;
    }

    return true;
}

module.exports = { isInGamesChannel };