module.exports = {
    name: "ping",

    async execute(message, args) {
        await message.reply(`🏓 Pong! ${message.client.ws.ping}ms`);
    },
};