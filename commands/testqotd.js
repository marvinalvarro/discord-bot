const { sendQOTD } = require("../qotd");

module.exports = {
    name: "testqotd",
    async execute(message, args, client) {
        await message.reply("⏳ Ngirim QOTD tes...");
        await sendQOTD(client);
    },
};