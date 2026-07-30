require("dotenv").config();

console.log("PREFIX:", process.env.PREFIX);

module.exports = {
    token: process.env.TOKEN,
    prefix: process.env.PREFIX,
    clientId: process.env.CLIENT_ID,
    vipRoleId: process.env.VIP_ROLE_ID,
    logsVipChannelId: process.env.LOGS_VIP_CHANNEL_ID,
};