module.exports = {
    name: "avatar",

    execute(message) {
        message.reply(message.author.displayAvatarURL());
    },
};