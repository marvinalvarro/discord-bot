const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "friendStreakData.json");

// Streak berdua cuma dihitung di channel streak (channel yang sama dengan streak harian)
const { STREAK_CHANNEL_ID } = require("./streakTracker");

// true  = reply ke pesan orang juga dihitung (kayak bot di contoh), jadi gak wajib ngetik @tag
// false = cuma @tag yang diketik eksplisit yang dihitung (perilaku lama)
const COUNT_REPLY = true;

function loadData() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");
    try {
        return JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } catch (err) {
        console.log("[friendStreak] friendStreakData.json rusak/kosong, mulai dari kosong:", err.message);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Key unik buat 1 pasangan user, urutan ID gak ngaruh (A-B sama aja kayak B-A)
function getPairKey(idA, idB) {
    return [idA, idB].sort().join("_");
}

function getJakartaDateString(date = new Date()) {
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// Streak yang masih "hidup": selesai hari ini atau kemarin. Selain itu dianggap putus (0).
function effectiveStreak(entry, today, yesterday) {
    if (entry.lastCompletedDate === today || entry.lastCompletedDate === yesterday) return entry.streak;
    return 0;
}

// Kirim kartu Game Verse; kalau gagal bikin kartu, kirim teks biasa
async function sendCard(message, text, cardOpts) {
    try {
        const { AttachmentBuilder } = require("discord.js");
        const { generateStreakCard } = require("./streakCardGenerator");
        const buf = await generateStreakCard(cardOpts);
        await message.reply({
            content: text,
            files: [new AttachmentBuilder(buf, { name: "friendstreak.png" })],
            allowedMentions: { repliedUser: false },
        });
    } catch (err) {
        console.log("[friendStreak] gagal kirim kartu, kirim teks aja:", err.message);
        await message
            .reply({ content: text, allowedMentions: { repliedUser: false } })
            .catch(() => {});
    }
}

// Kumpulin target: @tag yang diketik eksplisit + (opsional) orang yang di-reply
async function collectTargets(message) {
    const targets = new Map();

    for (const u of message.mentions.users.values()) {
        if (u.bot || u.id === message.author.id) continue;
        const explicitlyTagged =
            message.content.includes(`<@${u.id}>`) || message.content.includes(`<@!${u.id}>`);
        if (explicitlyTagged) targets.set(u.id, u);
    }

    if (COUNT_REPLY && message.reference?.messageId) {
        try {
            const ref = await message.fetchReference();
            const u = ref.author;
            if (u && !u.bot && u.id !== message.author.id) targets.set(u.id, u);
        } catch (err) {
            // pesan asli udah kehapus / gak bisa diambil, abaikan
        }
    }

    return targets;
}

// Dipanggil dari messageCreate buat SETIAP pesan (teks/foto/video apapun).
async function handleFriendStreakMessage(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.channelId !== STREAK_CHANNEL_ID) return; // channel lain diabaikan
    if (message.mentions.everyone) return;

    // Semua await (fetch reply) dilakukan SEBELUM load data,
    // biar load -> ubah -> save berjalan sinkron dan gak saling timpa antar pesan.
    const targets = await collectTargets(message);
    if (targets.size === 0) return;

    const data = loadData();
    const today = getJakartaDateString();
    const yesterday = getJakartaDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const notifications = [];

    for (const target of targets.values()) {
        const key = getPairKey(message.author.id, target.id);
        let entry = data[key];

        if (!entry) {
            entry = {
                streak: 0,
                lastCompletedDate: null,
                pendingDate: null,
                pendingUserId: null,
                userA: message.author.id,
                userB: target.id,
            };
            data[key] = entry;
        }

        // Udah lengkap hari ini buat pasangan ini, gak ngapa-ngapain lagi
        if (entry.lastCompletedDate === today) continue;

        if (entry.pendingDate === today && entry.pendingUserId !== message.author.id) {
            // Orang KEDUA membalas di hari yang sama -> LENGKAP, streak nambah
            if (entry.lastCompletedDate === yesterday) {
                entry.streak += 1;
            } else {
                entry.streak = 1; // kelewat sehari, atau pertama kali -> mulai dari 1
            }
            entry.lastCompletedDate = today;
            entry.pendingDate = null;
            entry.pendingUserId = null;
            notifications.push({ type: "complete", target, days: entry.streak });
        } else if (entry.pendingDate !== today) {
            // Belum ada yang mulai hari ini -> orang ini jadi yang PERTAMA, nunggu balesan
            entry.pendingDate = today;
            entry.pendingUserId = message.author.id;
            notifications.push({ type: "pending", target, days: effectiveStreak(entry, today, yesterday) });
        }
        // pendingDate === today && orang yang sama ngirim lagi -> diam, gak spam
    }

    if (notifications.length === 0) return;
    saveData(data);

    const me = message.author;
    const avatar = (u) => u.displayAvatarURL({ extension: "png", size: 256 });

    for (const n of notifications) {
        if (n.type === "complete") {
            await message.react("🔥").catch(() => {});
            await sendCard(
                message,
                `🔥 Streakmu dengan **${n.target.username}** sekarang sudah **${n.days}** hari!`,
                {
                    user1Name: me.username,
                    user1Avatar: avatar(me),
                    user2Name: n.target.username,
                    user2Avatar: avatar(n.target),
                    days: n.days,
                    label: "HARI",
                }
            );
        } else {
            await sendCard(
                message,
                `🔥 Api dengan **${n.target.username}** sudah dicoba dinyalakan! Dia cukup reply pesanmu atau mention kamu dengan chat apa pun.`,
                {
                    user1Name: me.username,
                    user1Avatar: avatar(me),
                    user2Name: n.target.username,
                    user2Avatar: avatar(n.target),
                    days: n.days,
                    user1Badge: "done",
                    user2Badge: "wait",
                    label: "MENUNGGU",
                }
            );
        }
    }
}

module.exports = { handleFriendStreakMessage }; 