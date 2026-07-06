const { ActivityType } = require("discord.js");

module.exports = {
    name: "clientReady",
    once: true,

    execute(client) {
        console.log(`${client.user.tag} berhasil online!`);

        function greeting() {
            const hour = new Date().getHours();

            if (hour >= 5 && hour < 12) return "🌅 Good Morning";
            if (hour >= 12 && hour < 18) return "☀️ Good Afternoon";
            if (hour >= 18 && hour < 22) return "🌇 Good Evening";

            return "🌙 Good Night";
        }

        function uptime() {
            const total = Math.floor(process.uptime());

            const d = Math.floor(total / 86400);
            const h = Math.floor((total % 86400) / 3600);
            const m = Math.floor((total % 3600) / 60);

            if (d > 0) return `${d}D ${h}H`;
            if (h > 0) return `${h}H ${m}M`;

            return `${m}M`;
        }


        let index = 0;

        function updatePresence() {

            let members = 0;

            client.guilds.cache.forEach(guild => {
                members += guild.memberCount;
            });


            const activities = [

                {
                    type: ActivityType.Watching,
                    name: `${client.guilds.cache.size} Servers`
                },

                {
                    type: ActivityType.Watching,
                    name: `${members.toLocaleString()} Members`
                },

                {
                    type: ActivityType.Watching,
                    name: `${client.commands.size} Commands`
                },

                {
                    type: ActivityType.Watching,
                    name: `Ping ${client.ws.ping}ms`
                },

                {
                    type: ActivityType.Watching,
                    name: `Uptime ${uptime()}`
                },

                {
                    type: ActivityType.Listening,
                    name: "!ping"
                },

                {
                    type: ActivityType.Playing,
                    name: "Game Verse"
                },

                {
                    type: ActivityType.Competing,
                    name: "GAME VERSE Tournament"
                },

                {
                    type: ActivityType.Watching,
                    name: "discord.gg/gameverse"
                },

                {
                    type: ActivityType.Playing,
                    name: greeting()
                }

            ];


            const activity = activities[index];

            client.user.setActivity(activity.name, {
                type: activity.type
            });


            index++;

            if (index >= activities.length) {
                index = 0;
            }
        }


        updatePresence();

        setInterval(updatePresence, 15000);
    },
};