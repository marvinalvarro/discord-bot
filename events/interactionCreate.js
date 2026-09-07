const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { generateKTPImage } = require("../ktpGenerator");
const fs = require("fs");
const path = require("path");

// Channel khusus buat nampilin hasil KTP
const KTP_CHANNEL_ID = "1534281400826728448";

// Nyimpen sementara data dari modal tahap 1, sambil nunggu user isi modal tahap 2.
// Key: userId, Value: { nama, ttl, jk, golda, agama }
const pendingKTPData = new Map();

// ===============================
// DATA SEMENTARA & PERMANEN BUAT FITUR ULTAH INTERAKTIF
// ===============================
const RAYAIN_DATA_PATH = path.join(__dirname, "..", "ultahRayainData.json");

// Muat data "siapa aja yang udah klik Ikut Rayain" dari file, biar gak reset pas bot restart.
// Format di file: { "<messageId>": ["userId1", "userId2", ...] }
function loadRayainData() {
    try {
        const raw = fs.readFileSync(RAYAIN_DATA_PATH, "utf8");
        const parsed = JSON.parse(raw);
        const map = new Map();
        for (const [messageId, userIds] of Object.entries(parsed)) {
            map.set(messageId, new Set(userIds));
        }
        return map;
    } catch (err) {
        return new Map(); // file belum ada / kosong / rusak -> mulai dari kosong
    }
}

function saveRayainData(map) {
    try {
        const obj = {};
        for (const [messageId, userIdSet] of map.entries()) {
            obj[messageId] = Array.from(userIdSet);
        }
        fs.writeFileSync(RAYAIN_DATA_PATH, JSON.stringify(obj, null, 2));
    } catch (err) {
        console.log("[ultah] Gagal simpan data rayain:", err.message);
    }
}

const rayainParticipants = loadRayainData();

// Nyimpen target user (yang ulang tahun) & channel/thread, dipakai pas modal "Kirim Ucapan" disubmit.
// Key: userId (yang lagi ngisi modal), Value: { targetUserId, channelId }
const pendingUcapan = new Map();

function buildModalStep2() {
    const modal2 = new ModalBuilder()
        .setCustomId("modal_ktp_step2")
        .setTitle("Isi Data KTP Kamu (2/2)");

    const statusKawinInput = new TextInputBuilder()
        .setCustomId("statusKawin")
        .setLabel("Status Perkawinan")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Belum Kawin / Kawin / Cerai")
        .setRequired(true);

    const pekerjaanInput = new TextInputBuilder()
        .setCustomId("pekerjaan")
        .setLabel("Pekerjaan")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const alamatInput = new TextInputBuilder()
        .setCustomId("alamat")
        .setLabel("Alamat (+ RT/RW)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Jl. Contoh No. 123, RT 01/RW 01")
        .setRequired(true);

    const kelDesaInput = new TextInputBuilder()
        .setCustomId("kelDesa")
        .setLabel("Kel/Desa")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Pegadungan")
        .setRequired(true);

    const kecamatanInput = new TextInputBuilder()
        .setCustomId("kecamatan")
        .setLabel("Kecamatan")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Kalideres")
        .setRequired(true);

    modal2.addComponents(
        new ActionRowBuilder().addComponents(statusKawinInput),
        new ActionRowBuilder().addComponents(pekerjaanInput),
        new ActionRowBuilder().addComponents(alamatInput),
        new ActionRowBuilder().addComponents(kelDesaInput),
        new ActionRowBuilder().addComponents(kecamatanInput)
    );

    return modal2;
}

module.exports = {
    name: "interactionCreate",

    async execute(interaction, client) {
        // ===== Tombol "Buat KTP" diklik -> munculin modal tahap 1 =====
        if (interaction.isButton() && interaction.customId === "buat_ktp") {
            const modal = new ModalBuilder()
                .setCustomId("modal_ktp_step1")
                .setTitle("Isi Data KTP Kamu (1/2)");

            const namaInput = new TextInputBuilder()
                .setCustomId("nama")
                .setLabel("Nama Lengkap")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(50);

            const ttlInput = new TextInputBuilder()
                .setCustomId("ttl")
                .setLabel("Tempat, Tanggal Lahir")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Jakarta, 18-02-2000")
                .setRequired(true);

            const jkInput = new TextInputBuilder()
                .setCustomId("jk")
                .setLabel("Jenis Kelamin")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Laki-laki / Perempuan")
                .setRequired(true);

            const goldaInput = new TextInputBuilder()
                .setCustomId("golda")
                .setLabel("Golongan Darah")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("A / B / AB / O")
                .setRequired(true)
                .setMaxLength(3);

            const agamaInput = new TextInputBuilder()
                .setCustomId("agama")
                .setLabel("Agama")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(namaInput),
                new ActionRowBuilder().addComponents(ttlInput),
                new ActionRowBuilder().addComponents(jkInput),
                new ActionRowBuilder().addComponents(goldaInput),
                new ActionRowBuilder().addComponents(agamaInput)
            );

            try {
                await interaction.showModal(modal);
            } catch (err) {
                console.log("[KTP] Gagal munculin modal step1:", err);
            }
            return;
        }

        // ===== Modal tahap 1 disubmit -> simpan sementara, kasih tombol lanjut ke tahap 2 =====
        if (interaction.isModalSubmit() && interaction.customId === "modal_ktp_step1") {
            try {
                const nama = interaction.fields.getTextInputValue("nama");
                const ttl = interaction.fields.getTextInputValue("ttl");
                const jk = interaction.fields.getTextInputValue("jk");
                const golda = interaction.fields.getTextInputValue("golda");
                const agama = interaction.fields.getTextInputValue("agama");

                pendingKTPData.set(interaction.user.id, { nama, ttl, jk, golda, agama });

                const lanjutButton = new ButtonBuilder()
                    .setCustomId("lanjut_ktp_step2")
                    .setLabel("Lanjut ke Form 2/2")
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(lanjutButton);

                await interaction.reply({
                    content: "✅ Data tahap 1 tersimpan! Klik tombol di bawah buat lanjut isi data terakhir.",
                    components: [row],
                    ephemeral: true,
                });
            } catch (err) {
                console.log("[KTP] Gagal proses step1:", err);
            }
            return;
        }

        // ===== Tombol "Lanjut ke Form 2/2" diklik -> munculin modal tahap 2 =====
        if (interaction.isButton() && interaction.customId === "lanjut_ktp_step2") {
            if (!pendingKTPData.has(interaction.user.id)) {
                await interaction.reply({
                    content: "❌ Data tahap 1 kamu nggak ketemu (mungkin session expired). Coba klik tombol 'Buat KTP' lagi dari awal ya.",
                    ephemeral: true,
                });
                return;
            }

            try {
                await interaction.showModal(buildModalStep2());
            } catch (err) {
                console.log("[KTP] Gagal munculin modal step2:", err);
            }
            return;
        }

        // ===== Modal tahap 2 disubmit -> gabungkan semua data, generate gambar =====
        if (interaction.isModalSubmit() && interaction.customId === "modal_ktp_step2") {
            await interaction.deferReply({ ephemeral: true });

            const step1Data = pendingKTPData.get(interaction.user.id);

            if (!step1Data) {
                await interaction.editReply({
                    content: "❌ Data tahap 1 kamu nggak ketemu (mungkin session expired). Coba klik tombol 'Buat KTP' lagi dari awal ya.",
                });
                return;
            }

            const statusKawin = interaction.fields.getTextInputValue("statusKawin");
            const pekerjaan = interaction.fields.getTextInputValue("pekerjaan");
            const alamat = interaction.fields.getTextInputValue("alamat");
            const kelDesa = interaction.fields.getTextInputValue("kelDesa");
            const kecamatan = interaction.fields.getTextInputValue("kecamatan");

            const noKTP = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
            const avatarURL = interaction.user.displayAvatarURL({ extension: "png", size: 256 });

            try {
                const imageBuffer = await generateKTPImage({
                    noKTP,
                    ...step1Data,
                    statusKawin,
                    pekerjaan,
                    alamat,
                    kelDesa,
                    kecamatan,
                    kewarganegaraan: "WNI",
                    berlakuHingga: "SELAMA JADI MEMBER SERVER",
                    avatarURL,
                    userId: interaction.user.id,
                });

                const attachment = new AttachmentBuilder(imageBuffer, { name: "ktp.png" });

                const ktpChannel = interaction.guild.channels.cache.get(KTP_CHANNEL_ID);

                if (ktpChannel) {
                    const buttonAgain = new ButtonBuilder()
                        .setCustomId("buat_ktp")
                        .setLabel("Buat KTP")
                        .setStyle(ButtonStyle.Primary);

                    const rowAgain = new ActionRowBuilder().addComponents(buttonAgain);

                    await ktpChannel.send({
                        content: `Kartu Tanda Penduduk milik ${interaction.user}`,
                        files: [attachment],
                        components: [rowAgain],
                    });
                    await interaction.editReply({
                        content: `✅ KTP kamu berhasil dibuat! Cek di <#${KTP_CHANNEL_ID}>`,
                    });
                } else {
                    console.log("[KTP] Channel KTP tidak ditemukan, cek ID:", KTP_CHANNEL_ID);
                    await interaction.editReply({
                        content: "❌ Channel KTP nggak ketemu, hubungi admin ya.",
                    });
                }
            } catch (err) {
                console.log("[KTP] Gagal generate/kirim gambar KTP:", err.message);
                await interaction.editReply({
                    content: "❌ Gagal bikin KTP, coba lagi nanti ya.",
                });
            } finally {
                pendingKTPData.delete(interaction.user.id);
            }
            return;
        }

        // ===============================
        // ===== FITUR ULTAH INTERAKTIF =====
        // ===============================

        // ===== Tombol "🎉 Ikut Rayain!" diklik =====
        if (interaction.isButton() && interaction.customId.startsWith("ultah_rayain|")) {
            const targetUserId = interaction.customId.split("|")[1];

            if (interaction.user.id === targetUserId) {
                await interaction.reply({
                    content: "Hehe, gak bisa ngerayain ulang tahun sendiri 😄",
                    ephemeral: true,
                });
                return;
            }

            const messageId = interaction.message.id;

            if (!rayainParticipants.has(messageId)) {
                rayainParticipants.set(messageId, new Set());
            }
            const participants = rayainParticipants.get(messageId);

            if (participants.has(interaction.user.id)) {
                await interaction.reply({
                    content: "Kamu udah ikut rayain sebelumnya nih 🎉",
                    ephemeral: true,
                });
                return;
            }

            participants.add(interaction.user.id);
            saveRayainData(rayainParticipants);

            try {
                const oldRow = interaction.message.components[0];
                const rayainBtn = ButtonBuilder.from(oldRow.components[0]).setLabel(
                    `🎉 Ikut Rayain! (${participants.size})`
                );
                const ucapanBtn = ButtonBuilder.from(oldRow.components[1]);

                const newRow = new ActionRowBuilder().addComponents(rayainBtn, ucapanBtn);

                await interaction.update({ components: [newRow] });
            } catch (err) {
                console.log("[ultah] Gagal update tombol rayain:", err.message);
                await interaction.reply({
                    content: "🎉 Makasih udah ikut rayain!",
                    ephemeral: true,
                }).catch(() => {});
            }
            return;
        }

        // ===== Tombol "💌 Kirim Ucapan Juga" diklik -> munculin modal =====
        if (interaction.isButton() && interaction.customId.startsWith("ultah_ucapan|")) {
            const targetUserId = interaction.customId.split("|")[1];

            // Kalau pesan ultah-nya punya thread, ucapan diarahkan ke situ biar rapi.
            // Kalau gak ada thread (misal gagal dibuat), fallback ke channel biasa.
            const destinationChannelId = interaction.message.thread
                ? interaction.message.thread.id
                : interaction.channelId;

            pendingUcapan.set(interaction.user.id, {
                targetUserId,
                channelId: destinationChannelId,
            });

            const modal = new ModalBuilder()
                .setCustomId("modal_ultah_ucapan")
                .setTitle("Kirim Ucapan Ulang Tahun");

            const ucapanInput = new TextInputBuilder()
                .setCustomId("ucapan")
                .setLabel("Tulis ucapan kamu")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Semoga makin sukses dan bahagia ya!")
                .setRequired(true)
                .setMaxLength(300);

            modal.addComponents(new ActionRowBuilder().addComponents(ucapanInput));

            try {
                await interaction.showModal(modal);
            } catch (err) {
                console.log("[ultah] Gagal munculin modal ucapan:", err.message);
            }
            return;
        }

        // ===== Modal ucapan disubmit -> posting ucapan ke channel =====
        if (interaction.isModalSubmit() && interaction.customId === "modal_ultah_ucapan") {
            const pending = pendingUcapan.get(interaction.user.id);

            if (!pending) {
                await interaction.reply({
                    content: "❌ Sesi kamu udah expired, coba klik tombol 'Kirim Ucapan Juga' lagi ya.",
                    ephemeral: true,
                });
                return;
            }

            const ucapanText = interaction.fields.getTextInputValue("ucapan");

            try {
                const channel = await client.channels.fetch(pending.channelId);

                if (channel) {
                    await channel.send({
                        content: `💌 **Ucapan dari ${interaction.user}** untuk <@${pending.targetUserId}>:\n> ${ucapanText}`,
                        allowedMentions: { users: [pending.targetUserId] },
                    });
                }

                await interaction.reply({
                    content: "✅ Ucapan kamu berhasil dikirim!",
                    ephemeral: true,
                });
            } catch (err) {
                console.log("[ultah] Gagal kirim ucapan:", err.message);
                await interaction.reply({
                    content: "❌ Gagal kirim ucapan, coba lagi ya.",
                    ephemeral: true,
                }).catch(() => {});
            } finally {
                pendingUcapan.delete(interaction.user.id);
            }
        }
    },
};