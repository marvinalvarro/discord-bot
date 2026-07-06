module.exports = {
    name: "clientReady",
    once: true,
    execute(client) {
        console.log(`${client.user.tag} berhasil online!`);
        client.user.setActivity("Bot Discord");
    },
};