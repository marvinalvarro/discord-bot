// commands/kickmassal.js
// Kick banyak orang sekaligus lewat ID. Khusus founder / yang punya izin Kick Members.
// Pakai: .kickmassal 111111111111111111 222222222222222222 333333333333333333 | alasan (opsional)
//        ID dipisah spasi / koma / baris baru. Maksimal 50 ID sekali jalan.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");

const ALLOWED_USER_IDS = ["1015666814325375067"]; // founder (selalu boleh)
const MAX_IDS = 50;
const DELAY_MS = 1200; // jeda antar kick biar aman dari rate limit
const CONFIRM_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
    name: "kickmassal",
    aliases: ["masskick", "kickid"],
    async execute(message, args, client) {
        if (!message.guild) return;

        const allowed =
            ALLOWED_USER_IDS.includes(message.author.id) ||
            message.member.permissions.has(PermissionFlagsBits.KickMembers);
        if (!allowed) return message.reply("Kamu gak punya izin Kick Members.").catch(() => {});

        const me = message.guild.members.me;
        if (!me.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply("Bot belum punya izin **Kick Members**.").catch(() => {});
        }

        // Pisahkan ID dan alasan (alasan setelah tanda "|")
        const raw = args.join(" ");
        const [idPart, ...reasonParts] = raw.split("|");
        const reason = (reasonParts.join("|").trim() || "Kick massal").slice(0, 400);
        const ids = [...new Set(idPart.match(/\d{17,20}/g) || [])];

        if (!ids.length) {
            return message.reply("Format: `.kickmassal <id1> <id2> ... | alasan`").catch(() => {});
        }
        if (ids.length > MAX_IDS) {
            return message.reply(`Maksimal ${MAX_IDS} ID sekali jalan (kamu kirim ${ids.length}).`).catch(() => {});
        }

        // Cek tiap ID sebelum konfirmasi
        const ok = [];
        const skipped = [];
        for (const id of ids) {
            if (id === message.author.id) { skipped.push([id, "itu kamu sendiri"]); continue; }
            if (id === client.user.id) { skipped.push([id, "itu bot"]); continue; }
            if (id === message.guild.ownerId) { skipped.push([id, "owner server"]); continue; }
            const m = await message.guild.members.fetch(id).catch(() => null);
            if (!m) { skipped.push([id, "tidak ada di server"]); continue; }
            if (!m.kickable) { skipped.push([id, "role lebih tinggi dari bot"]); continue; }
            if (
                message.guild.ownerId !== message.author.id &&
                !ALLOWED_USER_IDS.includes(message.author.id) &&
                m.roles.highest.position >= message.member.roles.highest.position
            ) { skipped.push([id, "role sama/lebih tinggi dari kamu"]); continue; }
            ok.push(m);
        }

        if (!ok.length) {
            const list = skipped.map(([id, why]) => `• \`${id}\` — ${why}`).join("\n");
            return message.reply(`Tidak ada yang bisa di-kick:\n${list}`.slice(0, 1900)).catch(() => {});
        }

        const preview = ok.map((m) => `• ${m.user.tag} (\`${m.id}\`)`).join("\n");
        const skipText = skipped.length
            ? "\n\n**Dilewati:**\n" + skipped.map(([id, why]) => `• \`${id}\` — ${why}`).join("\n")
            : "";
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("kickmassal_yes").setLabel(`Kick ${ok.length} orang`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("kickmassal_no").setLabel("Batal").setStyle(ButtonStyle.Secondary)
        );
        const prompt = await message.reply({
            content: `⚠️ **Yakin kick ${ok.length} orang ini?**\nAlasan: ${reason}\n\n${preview}${skipText}`.slice(0, 1990),
            components: [row],
            allowedMentions: { repliedUser: false },
        });

        let click;
        try {
            click = await prompt.awaitMessageComponent({
                filter: (i) => i.user.id === message.author.id && i.customId.startsWith("kickmassal_"),
                time: CONFIRM_MS,
            });
        } catch {
            return prompt.edit({ content: "⏱️ Waktu habis, kick dibatalkan.", components: [] }).catch(() => {});
        }

        if (click.customId === "kickmassal_no") {
            return click.update({ content: "❎ Dibatalkan.", components: [] }).catch(() => {});
        }
        await click.update({ content: `⏳ Mengkick ${ok.length} orang...`, components: [] }).catch(() => {});

        const done = [];
        const failed = [];
        for (const m of ok) {
            try {
                await m.kick(`${reason} (oleh ${message.author.tag})`);
                done.push(m);
            } catch (err) {
                failed.push([m, err.message]);
            }
            await sleep(DELAY_MS);
        }

        let out = `✅ **Berhasil kick ${done.length}/${ok.length}**\n`;
        if (done.length) out += done.map((m) => `• ${m.user.tag} (\`${m.id}\`)`).join("\n");
        if (failed.length) {
            out += "\n\n❌ **Gagal:**\n" + failed.map(([m, e]) => `• \`${m.id}\` — ${e}`).join("\n");
        }
        console.log(`[kickmassal] ${message.author.tag} kick ${done.length}/${ok.length}. Alasan: ${reason}`);
        prompt.edit({ content: out.slice(0, 1990), components: [] }).catch(() => {});
    },
};