// commands/removebg.js
// Install fallback gratis (tanpa kuota):  npm i @imgly/background-removal-node
// Opsional: isi REMOVEBG_API_KEY di .env untuk kualitas remove.bg.
// Kalau key kosong / kuota habis / error, otomatis pakai fallback lokal.
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

async function viaRemoveBg(buffer) {
  const key = process.env.REMOVEBG_API_KEY;
  if (!key) throw new Error('NO_KEY');

  const form = new FormData();
  form.append('size', 'auto');
  form.append('image_file', new Blob([buffer]), 'image.png');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: form,
  });
  if (!res.ok) throw new Error(`REMOVEBG_${res.status}`); // 402 = kuota habis
  return Buffer.from(await res.arrayBuffer());
}

async function viaLocal(buffer) {
  const { removeBackground } = require('@imgly/background-removal-node');
  const blob = await removeBackground(new Blob([buffer], { type: 'image/png' }));
  return Buffer.from(await blob.arrayBuffer());
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removebg')
    .setDescription('Hapus background gambar')
    .addAttachmentOption((o) =>
      o.setName('gambar').setDescription('Gambar (PNG/JPG/WEBP)').setRequired(true)
    ),

  async execute(interaction) {
    const file = interaction.options.getAttachment('gambar');

    if (!file.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '❌ File harus berupa gambar.', ephemeral: true });
    }
    if (file.size > MAX_SIZE) {
      return interaction.reply({ content: '❌ Ukuran gambar maksimal 10MB.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const input = Buffer.from(await (await fetch(file.url)).arrayBuffer());

      let output;
      try {
        output = await viaRemoveBg(input);
      } catch (e) {
        console.warn('[removebg] remove.bg gagal, pakai fallback lokal:', e.message);
        output = await viaLocal(input);
      }

      const att = new AttachmentBuilder(output, { name: 'removebg.png' });
      await interaction.editReply({
        content: `✅ Background gambar dari — **${interaction.user.username}** berhasil dihapus.`,
        files: [att],
      });
    } catch (err) {
      console.error('[removebg]', err);
      await interaction.editReply('❌ Gagal menghapus background. Coba gambar lain ya.');
    }
  },
};