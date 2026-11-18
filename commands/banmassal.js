// commands/banmassal.js
// Ban banyak orang sekaligus lewat ID. Khusus founder / yang punya izin Ban Members.
// Notif di #banned dikirim otomatis oleh events/guildBanAdd.js (embed + banner BANNED + alasan),
// jadi command ini TIDAK kirim notif sendiri. Orangnya juga langsung masuk daftar Bans di Server Settings.
//
// Pakai:  .banmassal 111111111111111111 222222222222222222 | alasan
// Alasan boleh beberapa baris. Kalau lebih dari satu baris, otomatis dinomori 1. 2. 3.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");

const ALLOWED_USER_IDS = ["1015666814325375067"]; // founder (selalu boleh)
const MAX_IDS = 50;
const DELAY_MS = 1200; // jeda antar ban biar aman dari rate limit
const CONFIRM_MS = 30_000;
const MAX_REASON = 480; // batas alasan ban Discord = 512 karakter

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pisahkan ID (sebelum "|") dan alasan (sesudah "|"), baris baru pada alasan dipertahankan.
function parseInput(content) {
    const sep = content.indexOf("|");
    const idPart = sep === -1 ? content : content.slice(0, sep);
    const rawReason = sep === -1 ? "" : content.slice(sep + 1);
    const ids = [...new Set(idPart.match(/\d{17,20}/g) || [])];

    const lines = rawReason
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    let reason;
    if (!lines.length) reason = "Tidak ada alasan diberikan";
    else if (lines.length === 1) reason = lines[0];
    else reason = lines.map((l, i) => (/^\d+[.)]\s/.test(l) ? l : `${i + 1}. ${l}`)).join("\n");
    return { ids, reason: reason.slice(0, MAX_REASON) };
}

module.exports = {
    name: "banmassal",
    aliases: ["massban", "banid"],
    parseInput,
    async execute(message, args, client) {
        if (!message.guild) return;

        const allowed =
            ALLOWED_USER_IDS.includes(message.author.id) ||
            message.member.permissions.has(PermissionFlagsBits.BanMembers);
        if (!allowed) return message.reply("Kamu gak punya izin Ban Members.").catch(() => {});

        const me = message.guild.members.me;
        if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply("Bot belum punya izin **Ban Members**.").catch(() => {});
        }

        // Ambil dari isi pesan asli supaya baris baru di alasan tidak hilang
        const body = message.content.replace(/^\S+\s*/, "");
        const { ids, reason } = parseInput(body);

        if (!ids.length) {
            return message.reply("Format: `.banmassal <id1> <id2> ... | alasan`").catch(() => {});
        }
        if (ids.length > MAX_IDS) {
            return message.reply(`Maksimal ${MAX_IDS} ID sekali jalan (kamu kirim ${ids.length}).`).catch(() => {});
        }

        const ok = []; // { id, user, member }
        const skipped = [];
        for (const id of ids) {
            if (id === message.author.id) { skipped.push([id, "itu kamu sendiri"]); continue; }
            if (id === client.user.id) { skipped.push([id, "itu bot"]); continue; }
            if (id === message.guild.ownerId) { skipped.push([id, "owner server"]); continue; }

            const member = await message.guild.members.fetch(id).catch(() => null);
            if (member) {
                if (!member.bannable) { skipped.push([id, "role lebih tinggi dari bot"]); continue; }
                if (
                    message.guild.ownerId !== message.author.id &&
                    !ALLOWED_USER_IDS.includes(message.author.id) &&
                    member.roles.highest.position >= message.member.roles.highest.position
                ) { skipped.push([id, "role sama/lebih tinggi dari kamu"]); continue; }
                ok.push({ id, user: member.user, member });
                continue;
            }
            // Bukan member (sudah keluar): tetap bisa di-ban lewat ID kalau akunnya ada
            const already = await message.guild.bans.fetch(id).catch(() => null);
            if (already) { skipped.push([id, "sudah di-ban"]); continue; }
            const user = await client.users.fetch(id).catch(() => null);
            if (!user) { skipped.push([id, "ID tidak valid"]); continue; }
            ok.push({ id, user, member: null });
        }

        if (!ok.length) {
            const list = skipped.map(([id, why]) => `• \`${id}\` — ${why}`).join("\n");
            return message.reply(`Tidak ada yang bisa di-ban:\n${list}`.slice(0, 1900)).catch(() => {});
        }

        const preview = ok
            .map((o) => `• ${o.user.tag} (\`${o.id}\`)${o.member ? "" : " — sudah tidak di server"}`)
            .join("\n");
        const skipText = skipped.length
            ? "\n\n**Dilewati:**\n" + skipped.map(([id, why]) => `• \`${id}\` — ${why}`).join("\n")
            : "";
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("banmassal_yes").setLabel(`Ban ${ok.length} orang`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("banmassal_no").setLabel("Batal").setStyle(ButtonStyle.Secondary)
        );
        const prompt = await message.reply({
            content: `⚠️ **Yakin BAN ${ok.length} orang ini?** (permanen, masuk daftar Bans)\n**Alasan:**\n${reason}\n\n${preview}${skipText}`.slice(0, 1990),
            components: [row],
            allowedMentions: { repliedUser: false },
        });

        let click;
        try {
            click = await prompt.awaitMessageComponent({
                filter: (i) => i.user.id === message.author.id && i.customId.startsWith("banmassal_"),
                time: CONFIRM_MS,
            });
        } catch {
            return prompt.edit({ content: "⏱️ Waktu habis, ban dibatalkan.", components: [] }).catch(() => {});
        }

        if (click.customId === "banmassal_no") {
            return click.update({ content: "❎ Dibatalkan.", components: [] }).catch(() => {});
        }
        await click.update({ content: `⏳ Mem-ban ${ok.length} orang...`, components: [] }).catch(() => {});

        const done = [];
        const failed = [];
        for (const o of ok) {
            try {
                // Alasan ini yang dibaca guildBanAdd.js dan tampil di #banned + daftar Bans
                await message.guild.bans.create(o.id, { reason });
                done.push(o);
            } catch (err) {
                failed.push([o, err.message]);
            }
            await sleep(DELAY_MS);
        }

        let out = `✅ **Berhasil ban ${done.length}/${ok.length}** (notif ada di #banned)\n`;
        if (done.length) out += done.map((o) => `• ${o.user.tag} (\`${o.id}\`)`).join("\n");
        if (failed.length) {
            out += "\n\n❌ **Gagal:**\n" + failed.map(([o, e]) => `• \`${o.id}\` — ${e}`).join("\n");
        }
        console.log(`[banmassal] ${message.author.tag} ban ${done.length}/${ok.length}. Alasan: ${reason.replace(/\n/g, " / ")}`);
        prompt.edit({ content: out.slice(0, 1990), components: [] }).catch(() => {});
    },
};