const fs = require("fs");
const path = require("path");

// ====== KONFIGURASI ======
const BACKUP_INTERVAL_MS = 3 * 60 * 60 * 1000; // backup tiap 3 jam

// Daftar file data yang mau di-backup: [file asli, file backup]
const FILES_TO_BACKUP = [
    ["xpData.json", "xpData.backup.json"],
    ["chatXpData.json", "chatXpData.backup.json"],
    ["economyData.json", "economyData.backup.json"],
];

function isEmptyObject(obj) {
    return obj && typeof obj === "object" && Object.keys(obj).length === 0;
}

function backupOneFile(sourceName, backupName) {
    const sourcePath = path.join(__dirname, sourceName);
    const backupPath = path.join(__dirname, backupName);

    if (!fs.existsSync(sourcePath)) {
        return; // file sumbernya belum ada, skip aja
    }

    let sourceData;
    try {
        sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    } catch (err) {
        console.error(`[backup] Gagal baca ${sourceName}, backup di-skip:`, err.message);
        return;
    }

    // PENGAMAN: kalau file sumber KOSONG tapi backup yang lama JUSTRU ada isinya,
    // JANGAN timpa backup itu — kemungkinan besar file sumbernya baru aja ke-reset gak sengaja.
    if (isEmptyObject(sourceData) && fs.existsSync(backupPath)) {
        try {
            const oldBackup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
            if (!isEmptyObject(oldBackup)) {
                console.warn(
                    `[backup] ⚠️ ${sourceName} kosong tapi backup lama ada isinya. ` +
                    `Backup TIDAK ditimpa (biar data lama gak ilang). Cek apakah ${sourceName} kehapus gak sengaja!`
                );
                return;
            }
        } catch (err) {
            // backup lama corrupt, lanjut aja proses backup normal di bawah
        }
    }

    fs.writeFileSync(backupPath, JSON.stringify(sourceData, null, 2));
    console.log(`[backup] ${sourceName} -> ${backupName} (${Object.keys(sourceData).length} entri)`);
}

function backupAllFiles() {
    for (const [source, backup] of FILES_TO_BACKUP) {
        backupOneFile(source, backup);
    }
}

/** Dipanggil sekali dari index.js buat mulai loop backup otomatis. */
function startBackupLoop() {
    backupAllFiles(); // backup langsung sekali pas bot nyala
    setInterval(backupAllFiles, BACKUP_INTERVAL_MS);
    console.log(`[backup] Auto-backup data aktif (tiap ${BACKUP_INTERVAL_MS / 3600000} jam).`);
}

module.exports = { startBackupLoop, backupAllFiles };