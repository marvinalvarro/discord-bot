require("dotenv").config();

console.log("PREFIX:", process.env.PREFIX);

module.exports = {
    token: process.env.TOKEN,
    prefix: process.env.PREFIX,
    clientId: process.env.CLIENT_ID,
    vipRoleId: process.env.VIP_ROLE_ID,
    logsVipChannelId: process.env.LOGS_VIP_CHANNEL_ID,
    levelUpChannelId: process.env.LEVEL_UP_CHANNEL_ID, // <-- channel khusus notif naik level voice
    chatLevelUpChannelId: process.env.CHAT_LEVEL_UP_CHANNEL_ID, // <-- channel khusus notif naik level chat
};