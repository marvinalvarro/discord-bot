const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { generateKTPImage } = require("../ktpGenerator");

// Channel khusus buat nampilin hasil KTP
const KTP_CHANNEL_ID = "1534281400826728448";

// Nyimpen sementara data dari modal tahap 1, sambil nunggu user isi modal tahap 2.
// Key: userId, Value: { nama, ttl, jk, golda, agama }
const pendingKTPData = new Map();

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
        }
    },
};