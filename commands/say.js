module.exports = {
    name: "say",

    execute(message, args) {

        const text = args.join(" ");

        if (!text)
            return message.reply("Masukkan pesan.");

        message.channel.send(text);
    },
};