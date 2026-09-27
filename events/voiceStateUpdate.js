const { loadData, saveData } = require("../activityTracker");

module.exports = {
    name: "voiceStateUpdate",

    async execute(oldState, newState) {
        const member = newState.member || oldState.member;
        if (!member) return;

        const data = loadData();
        const entry = data[member.id];
        if (!entry || entry.completed) return;

        const wasInVoice = !!oldState.channelId;
        const isInVoice = !!newState.channelId;

        if (!wasInVoice && isInVoice) {
            entry.voiceJoinedAt = Date.now();
            saveData(data);
        } else if (wasInVoice && !isInVoice) {
            entry.voiceJoinedAt = null;
            saveData(data);
        }
        // pindah channel tapi tetap di voice -> gak perlu apa-apa, masih dianggap aktif
    },
};