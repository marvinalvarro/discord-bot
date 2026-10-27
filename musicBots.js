// musicBots.js
// Sistem "multi bot musik" ala Music 1 / Music 2 / Music 3:
//  - Tiap bot = 1 aplikasi Discord sendiri (token sendiri di .env), jalan di proses yang sama.
//  - Bot yang nganggur "parkir" di voice channel lobby (MUSIC_LOBBY_VOICE_ID).
//  - User ketik ;join (atau langsung ;play) -> 1 bot kosong pindah ke voice channel user.
//  - Selesai (;stop / sepi / gak ada lagu) -> bot balik ke lobby.
// Semua perintah dibaca oleh SATU bot saja (bot pertama / "dispatcher"), jadi cuma bot itu
// yang butuh Message Content Intent.
//
// .env:
//   MUSIC_BOT_1_TOKEN=...   MUSIC_BOT_2_TOKEN=...   MUSIC_BOT_3_TOKEN=...   (sampai MUSIC_BOT_5_TOKEN)
//   MUSIC_LOBBY_VOICE_ID=ID_VOICE_CHANNEL_LOBBY      (opsional tapi disarankan)
//   MUSIC_PREFIX=2                                   (opsional, default 2 -> 2join, 2play, 2p, ...)
require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType, Events } = require("discord.js");
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require("@discordjs/voice");
const { getQueue, connectToVoice } = require("./musicPlayer");
const { resolveQuery, findRelatedSong } = require("./youtubeSource");

const PREFIX = process.env.MUSIC_PREFIX || "2";
const LOBBY_ID = (process.env.MUSIC_LOBBY_VOICE_ID || "").trim();
const MAX_BOTS = 5;

const WATCH_INTERVAL_MS = 10 * 1000;
const NO_QUEUE_GRACE_MS = 30 * 1000;      // queue hilang (mis. auto-leave) -> bot dilepas setelah ini
const IDLE_NO_SONG_MS = 3 * 60 * 1000;    // sudah ;join tapi gak ada lagu selama ini -> dilepas
const EMPTY_CHANNEL_MS = 60 * 1000;       // voice channel gak ada manusia selama ini -> dilepas

const ALIASES = { p: "play", s: "skip", q: "queue", vol: "volume", leave: "stop", dc: "stop", disconnect: "stop", ap: "autoplay" };

// { index, name, client, ready, session }
// session = { guildId, voiceChannelId, ownerId, startedAt, lastActivity, busy, emptySince }
const bots = [];
const warned = new Set();

function warnOnce(key, msg) {
    if (warned.has(key)) return;
    warned.add(key);
    console.log(msg);
}

function loadTokens() {
    const list = [];
    for (let i = 1; i <= MAX_BOTS; i++) {
        const t = (process.env[`MUSIC_BOT_${i}_TOKEN`] || "").trim();
        if (t) list.push({ index: i, token: t });
    }
    return list;
}

// ---------- parkir di lobby ----------
async function parkBot(bot) {
    if (!LOBBY_ID || !bot.ready) return;
    try {
        const lobby =
            bot.client.channels.cache.get(LOBBY_ID) || (await bot.client.channels.fetch(LOBBY_ID).catch(() => null));
        if (!lobby || typeof lobby.isVoiceBased !== "function" || !lobby.isVoiceBased()) {
            return warnOnce(`lobby-${bot.index}`, `[MusicBots] ${bot.name} gak bisa lihat voice channel lobby (${LOBBY_ID}). Cek ID dan izin bot.`);
        }
        const conn = joinVoiceChannel({
            channelId: lobby.id,
            guildId: lobby.guild.id,
            adapterCreator: lobby.guild.voiceAdapterCreator,
            group: bot.client.musicNamespace,
            selfDeaf: true,
        });
        await entersState(conn, VoiceConnectionStatus.Ready, 15_000);
    } catch (err) {
        warnOnce(`park-${bot.index}`, `[MusicBots] ${bot.name} gagal parkir di lobby (cek izin Connect di channel lobby): ${err.message}`);
    }
}

// ---------- sesi / assignment ----------
function findSession(guildId, voiceChannelId) {
    return bots.find((b) => b.session && b.session.guildId === guildId && b.session.voiceChannelId === voiceChannelId) || null;
}

// Sinkron (tanpa await) supaya 2 user yang ngetik bersamaan gak dapat bot yang sama
function acquireBot(message, vc) {
    const bot = bots.find((b) => b.ready && !b.session && b.client.guilds.cache.has(message.guild.id));
    if (!bot) return null;
    const now = Date.now();
    bot.session = {
        guildId: message.guild.id,
        voiceChannelId: vc.id,
        ownerId: message.author.id,
        startedAt: now,
        lastActivity: now,
        busy: false,
        emptySince: null,
    };
    return bot;
}

function releaseBot(bot) {
    const s = bot.session;
    bot.session = null;
    if (s) {
        const q = getQueue(s.guildId, bot.client.musicNamespace);
        if (q) {
            q.songs = [];
            q.loopMode = "off";
            try {
                q.player.stop(true);
            } catch (err) {
                // player mungkin sudah berhenti
            }
            q.destroy();
        }
    }
    parkBot(bot);
}

function touch(bot) {
    if (bot.session) bot.session.lastActivity = Date.now();
}

async function connectBot(bot, message, voiceChannelId) {
    const guild = bot.client.guilds.cache.get(message.guild.id);
    const botVc = guild && guild.channels.cache.get(voiceChannelId);
    if (!botVc) throw new Error(`${bot.name} gak bisa lihat voice channel itu.`);

    const perms = botVc.permissionsFor(bot.client.user);
    if (!perms || !perms.has("Connect") || !perms.has("Speak")) {
        throw new Error(`${bot.name} gak punya izin **Connect**/**Speak** di voice channel itu.`);
    }

    const textChannel = bot.client.channels.cache.get(message.channelId) || message.channel;
    return connectToVoice(botVc, textChannel);
}

// Kirim pesan dari bot yang bersangkutan (kalau gak bisa, fallback ke bot dispatcher)
async function say(bot, message, content) {
    const ch = bot ? bot.client.channels.cache.get(message.channelId) : null;
    if (ch) {
        try {
            await ch.send(content);
            return;
        } catch (err) {
            // gak punya izin kirim di channel itu, pakai dispatcher
        }
    }
    await message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => {});
}

function reply(message, content) {
    return message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => {});
}

function userVoice(message) {
    return (message.member && message.member.voice && message.member.voice.channel) || null;
}

// Untuk command kontrol: cari bot yang sedang dipakai di voice channel user
function getControl(message) {
    const vc = userVoice(message);
    if (!vc) {
        reply(message, "Lu harus join voice channel dulu.");
        return null;
    }
    const bot = findSession(message.guild.id, vc.id);
    if (!bot) {
        reply(message, `Gak ada bot musik di voice channel lu. Ketik \`${PREFIX}join\` dulu.`);
        return null;
    }
    touch(bot);
    return { bot, vc, queue: getQueue(message.guild.id, bot.client.musicNamespace) };
}

function friendlyError(err) {
    const m = String(err && err.message ? err.message : err);
    if (/^YouTube lagi nge-blok/.test(m)) return m; // pesan jeda dari youtubeSource.js sudah jelas
    if (/429|too many requests|sign in|not a bot|confirm you/i.test(m)) {
        return "YouTube nolak permintaan dari server (ini sering terjadi di server hosting). Coba lagi nanti, atau pakai link SoundCloud.";
    }
    return m.length > 200 ? m.slice(0, 200) + "…" : m;
}

// ---------- command ----------
const COMMANDS = {
    async join(message) {
        const vc = userVoice(message);
        if (!vc) return reply(message, "Lu harus join voice channel dulu.");

        const existing = findSession(message.guild.id, vc.id);
        if (existing) {
            touch(existing);
            return say(existing, message, `🎧 **${existing.name}** udah ada di <#${vc.id}>. Langsung aja \`${PREFIX}play <link/judul>\`.`);
        }

        const bot = acquireBot(message, vc);
        if (!bot) {
            const total = bots.filter((b) => b.ready).length;
            return reply(message, `Semua bot musik lagi dipakai (${total}/${total}). Coba lagi nanti, atau cek \`${PREFIX}bots\`.`);
        }

        try {
            await connectBot(bot, message, vc.id);
        } catch (err) {
            releaseBot(bot);
            return reply(message, `Gagal manggil bot: ${err.message}`);
        }
        await say(bot, message, `🎧 **${bot.name}** masuk ke <#${vc.id}>. Ketik \`${PREFIX}play <link YouTube/Spotify / judul>\` buat muter lagu.`);
    },

    async play(message, args) {
        const vc = userVoice(message);
        if (!vc) return reply(message, "Lu harus join voice channel dulu buat muter musik!");

        const query = args.join(" ").trim();
        if (!query) return reply(message, `Kasih link YouTube/Spotify atau judul lagunya ya.\nContoh: \`${PREFIX}play https://youtu.be/...\` atau \`${PREFIX}play judul lagu\``);

        let bot = findSession(message.guild.id, vc.id);
        let fresh = false;
        if (!bot) {
            bot = acquireBot(message, vc);
            if (!bot) {
                const total = bots.filter((b) => b.ready).length;
                return reply(message, `Semua bot musik lagi dipakai (${total}/${total}). Coba lagi nanti, atau cek \`${PREFIX}bots\`.`);
            }
            fresh = true;
        }

        bot.session.busy = true;
        touch(bot);
        try {
            await message.channel.sendTyping().catch(() => {});

            let result;
            try {
                result = await resolveQuery(query, message.author.tag);
            } catch (err) {
                if (fresh) releaseBot(bot);
                return reply(message, `❌ ${friendlyError(err)}`);
            }

            let queue = getQueue(message.guild.id, bot.client.musicNamespace);
            if (!queue || !queue.connection) {
                try {
                    queue = await connectBot(bot, message, vc.id);
                } catch (err) {
                    if (fresh) releaseBot(bot);
                    return reply(message, `Gagal manggil bot: ${err.message}`);
                }
            }

            const before = queue.songs.length;
            for (const song of result.songs) queue.songs.push(song);

            if (!queue.playing) {
                if (result.note) await say(bot, message, `📃 ${result.note}: ${result.songs.length} lagu ditambahin.`);
                await queue.playNext();
            } else if (result.songs.length > 1) {
                await say(bot, message, `✅ ${result.songs.length} lagu ditambahin ke antrian. ${result.note || ""}`.trim());
            } else {
                await say(bot, message, `✅ Ditambahin ke antrian (posisi #${before + 1}): **${result.songs[0].title}**`);
            }
        } finally {
            if (bot.session) {
                bot.session.busy = false;
                touch(bot);
            }
        }
    },

    async skip(message) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue || !c.queue.playing) return say(c.bot, message, "Lagi gak ada lagu yang diputar.");

        let note = "";
        if (c.queue.loopMode === "track") {
            c.queue.loopMode = "off"; // kalau gak dimatiin, lagu yang sama keulang lagi
            note = " (loop lagu dimatiin)";
        }
        c.queue.player.stop(); // memicu Idle -> lagu berikutnya
        await say(c.bot, message, `⏭️ Lagu di-skip.${note}`);
    },

    async stop(message) {
        const c = getControl(message);
        if (!c) return;
        const name = c.bot.name;
        releaseBot(c.bot);
        await say(c.bot, message, `⏹️ **${name}** berhenti dan balik ke lobby.`);
    },

    async pause(message) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue || !c.queue.playing) return say(c.bot, message, "Lagi gak ada lagu yang diputar.");
        c.queue.player.pause();
        await say(c.bot, message, "⏸️ Dijeda.");
    },

    async resume(message) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue) return say(c.bot, message, "Bot lagi gak muter apa-apa.");
        c.queue.player.unpause();
        await say(c.bot, message, "▶️ Dilanjut.");
    },

    async queue(message) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue || c.queue.songs.length === 0) return say(c.bot, message, "Antrian kosong.");

        const lines = c.queue.songs.slice(0, 10).map((s, i) => `${i === 0 ? "▶️" : `${i}.`} **${s.title}**${s.duration ? ` \`${s.duration}\`` : ""}`);
        if (c.queue.songs.length > 10) lines.push(`...dan ${c.queue.songs.length - 10} lagu lagi`);
        await say(c.bot, message, `🎶 **Antrian ${c.bot.name}** (loop: ${c.queue.loopMode}, autoplay: ${c.queue.autoplay ? "nyala ♾️" : "mati"})\n${lines.join("\n")}`);
    },

    async volume(message, args) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue) return say(c.bot, message, "Bot lagi gak muter apa-apa.");

        const resource = c.queue.player.state && c.queue.player.state.resource;
        if (!resource || !resource.volume) {
            return say(
                c.bot,
                message,
                "ℹ️ Volume gak bisa diatur lewat bot buat lagu streaming (biar CPU server hemat). Atur lewat Discord: klik kanan bot di voice channel → **User Volume**."
            );
        }
        const value = parseInt(args[0], 10);
        if (Number.isNaN(value) || value < 1 || value > 100) {
            return say(c.bot, message, `Volume sekarang **${Math.round(c.queue.volume * 100)}%**. Pakai: \`${PREFIX}volume 1-100\``);
        }
        c.queue.volume = value / 100;
        resource.volume.setVolume(c.queue.volume);
        await say(c.bot, message, `🔊 Volume diatur ke **${value}%**.`);
    },

    async loop(message, args) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue) return say(c.bot, message, "Bot lagi gak muter apa-apa.");

        const mode = (args[0] || "").toLowerCase();
        if (!["off", "track", "queue"].includes(mode)) {
            return say(c.bot, message, `Pakai: \`${PREFIX}loop off\`, \`${PREFIX}loop track\`, atau \`${PREFIX}loop queue\`.`);
        }
        c.queue.loopMode = mode;
        let note = "";
        if (mode !== "off" && c.queue.autoplay) {
            c.queue.autoplay = false;
            note = " Autoplay dimatikan karena loop aktif.";
        }
        await say(c.bot, message, `🔁 Loop diatur ke **${mode}**.${note}`);
    },

    async autoplay(message, args) {
        const c = getControl(message);
        if (!c) return;
        if (!c.queue || (!c.queue.playing && c.queue.songs.length === 0)) {
            return say(c.bot, message, `Muter 1 lagu dulu pakai \`${PREFIX}play\`, baru nyalain autoplay.`);
        }

        const arg = (args[0] || "").toLowerCase();
        const turnOn = arg === "on" ? true : arg === "off" ? false : !c.queue.autoplay; // tanpa argumen = toggle

        if (!turnOn) {
            c.queue.autoplay = false;
            return say(c.bot, message, "♾️ Autoplay dimatikan. Antrian yang ada tetap diputar sampai habis.");
        }

        c.queue.autoplay = true;
        c.queue.loopMode = "off"; // autoplay gak cocok barengan loop
        c.queue.autoplayFetcher = (basis, history) => findRelatedSong(basis, history, "Autoplay");
        c.queue.refillAutoplay(); // siapkan lagu berikutnya di belakang layar
        await say(
            c.bot,
            message,
            `♾️ Autoplay nyala! Kalau antrian habis, bot otomatis nyari lagu mirip dan lanjut terus. Berhenti dengan \`${PREFIX}stop\` atau \`${PREFIX}leave\`, atau matiin lewat \`${PREFIX}autoplay\`.`
        );
    },

    async bots(message) {
        const lines = bots.map((b) => {
            if (!b.ready) return `⚫ **${b.name}** — offline`;
            if (!b.session || b.session.guildId !== message.guild.id) return `🟢 **${b.name}** — kosong`;
            return `🔴 **${b.name}** — dipakai di <#${b.session.voiceChannelId}>`;
        });
        await reply(message, `🎧 **Bot musik**\n${lines.join("\n")}`);
    },

    async help(message) {
        await reply(
            message,
            `🎧 **Bot musik** (prefix \`${PREFIX}\`)\n` +
                `\`join\` ambil bot, \`play <link/judul>\`, \`autoplay\`, \`skip\`, \`stop\`, \`pause\`, \`resume\`, \`queue\`, \`loop <off|track|queue>\`, \`bots\`\n` +
                `Link yang didukung: YouTube (video/playlist), Spotify (lagu/album/playlist/artis, dicari otomatis di YouTube), dan SoundCloud (track).`
        );
    },
};

async function handleMessage(message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    // Perintah harus nempel ke prefix ("2play lagu"). "2 orang" atau "2 skip" di chat biasa diabaikan.
    const rest = message.content.slice(PREFIX.length);
    if (!rest || /^\s/.test(rest)) return;

    const args = rest.trim().split(/ +/);
    const raw = (args.shift() || "").toLowerCase();
    const isAlias = Object.prototype.hasOwnProperty.call(ALIASES, raw);
    const name = isAlias ? ALIASES[raw] : raw;
    const handler = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
    if (!handler) return;

    // Singkatan ("2p", "2s", "2q") cuma jalan kalau user lagi di voice channel,
    // supaya obrolan biasa seperti "2s lagi" gak dibalas bot.
    if (isAlias && !userVoice(message)) return;

    try {
        await handler(message, args);
    } catch (err) {
        console.error("[MusicBots] Error command:", err);
        reply(message, "Terjadi error.");
    }
}

// ---------- pengecekan berkala: lepas bot yang gak kepakai ----------
function watch() {
    const now = Date.now();
    for (const bot of bots) {
        const s = bot.session;
        if (!s || s.busy) continue;

        const queue = getQueue(s.guildId, bot.client.musicNamespace);

        if (!queue) {
            if (now - s.lastActivity > NO_QUEUE_GRACE_MS) releaseBot(bot);
            continue;
        }

        if (!queue.playing && queue.songs.length === 0 && now - s.lastActivity > IDLE_NO_SONG_MS) {
            releaseBot(bot);
            continue;
        }

        const guild = bot.client.guilds.cache.get(s.guildId);
        const vc = guild && guild.channels.cache.get(s.voiceChannelId);
        const humans = vc ? [...vc.members.values()].filter((m) => !m.user.bot).length : 0;
        if (humans === 0) {
            s.emptySince = s.emptySince || now;
            if (now - s.emptySince > EMPTY_CHANNEL_MS) releaseBot(bot);
        } else {
            s.emptySince = null;
        }
    }
}

// ---------- start ----------
function createBot({ index, token }, isDispatcher) {
    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
    if (isDispatcher) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);

    const client = new Client({ intents });
    client.musicNamespace = `mb${index}`; // memisahkan antrian & koneksi voice tiap bot di musicPlayer.js

    const bot = { index, name: `Music ${index}`, client, ready: false, session: null };
    bots.push(bot);

    client.once(Events.ClientReady, () => {
        bot.ready = true;
        console.log(`[MusicBots] ${bot.name} online sebagai ${client.user.tag}${isDispatcher ? " (pembaca perintah)" : ""}`);
        try {
            client.user.setPresence({
                status: "online",
                activities: [{ type: ActivityType.Listening, name: `${PREFIX}join • ${bot.name}` }],
            });
        } catch (err) {
            // presence gagal diset, gak fatal
        }
        parkBot(bot);
    });

    client.on(Events.Error, (err) => console.error(`[MusicBots] ${bot.name} error:`, err));

    if (isDispatcher) {
        client.on(Events.MessageCreate, (message) => {
            handleMessage(message).catch((err) => console.error("[MusicBots] Error:", err));
        });
    }

    client.login(token).catch((err) => {
        console.error(`[MusicBots] ${bot.name} gagal login:`, err.message);
        if (isDispatcher && /disallowed intents/i.test(err.message)) {
            console.error(`[MusicBots] Nyalakan "Message Content Intent" untuk aplikasi ${bot.name} di Discord Developer Portal.`);
        }
    });
}

function startMusicBots() {
    const tokens = loadTokens();
    if (tokens.length === 0) {
        console.log("[MusicBots] MUSIC_BOT_1_TOKEN belum diisi di .env, sistem bot musik dilewati.");
        return;
    }

    tokens.forEach((t, i) => createBot(t, i === 0));

    const timer = setInterval(watch, WATCH_INTERVAL_MS);
    if (timer.unref) timer.unref();

    console.log(`[MusicBots] ${tokens.length} bot musik dimuat (prefix "${PREFIX}").`);
}

startMusicBots();

module.exports = { startMusicBots, _bots: bots, _watch: watch };