// ytdlp.js
// Pembungkus yt-dlp buat cari lagu & stream audio YouTube/SoundCloud.
// Dipakai youtubeSource.js sebagai jalur UTAMA (play-dl jadi cadangan), karena play-dl sering kena
// error 429 dari YouTube di server hosting.
//
// - Binary yt-dlp diunduh otomatis ke folder ./bin saat bot pertama kali jalan (butuh akses ke github.com).
// - Dicek update otomatis kalau umur binary > 12 jam (yt-dlp sering perlu update biar gak rusak).
//
// .env (semua opsional):
//   YTDLP_PATH=...          path binary sendiri (default ./bin/yt-dlp)
//   YTDLP_COOKIES=cookies.txt   file cookies format Netscape (pakai akun cadangan, bukan akun utama)
//   YTDLP_EXTRA_ARGS=--js-runtimes node   argumen tambahan, dipisah spasi
//   YTDLP_NO_UPDATE=1       matikan auto-update
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PassThrough } = require("stream");

const IS_WIN = process.platform === "win32";
// Binary standalone (gak butuh Python). Sengaja TIDAK memakai binary bawaan youtube-dl-exec,
// karena yang itu bisa berupa skrip Python dan gagal jalan di server yang gak punya Python.
const BIN_PATH = process.env.YTDLP_PATH || path.join(__dirname, "bin", IS_WIN ? "yt-dlp.exe" : "yt-dlp");
const UPDATE_AFTER_MS = 12 * 60 * 60 * 1000;
const RETRY_AFTER_FAIL_MS = 10 * 60 * 1000;
const FIRST_BYTE_TIMEOUT_MS = 45 * 1000;

let ffmpegPath = null;
try {
    ffmpegPath = require("ffmpeg-static");
} catch (err) {
    // ffmpeg-static opsional, yt-dlp cari ffmpeg sendiri di PATH
}

let failedAt = 0; // waktu terakhir yt-dlp gagal disiapkan; selama masa tunggu, jalur ini dilewati
let hintShown = false;

function assetName() {
    if (IS_WIN) return "yt-dlp.exe";
    if (process.platform === "darwin") return "yt-dlp_macos";
    return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

async function download() {
    fs.mkdirSync(path.dirname(BIN_PATH), { recursive: true });
    console.log("[ytdlp] Mengunduh yt-dlp (sekali saja, +/- 35 MB)...");
    const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName()}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`unduh yt-dlp gagal (status ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = BIN_PATH + ".tmp";
    fs.writeFileSync(tmp, buf);
    if (!IS_WIN) fs.chmodSync(tmp, 0o755);
    fs.renameSync(tmp, BIN_PATH);
    console.log("[ytdlp] yt-dlp terpasang.");
}

function updateInBackground() {
    if (process.env.YTDLP_NO_UPDATE === "1" || process.env.YTDLP_PATH) return;
    try {
        if (Date.now() - fs.statSync(BIN_PATH).mtimeMs < UPDATE_AFTER_MS) return;
        const p = spawn(BIN_PATH, ["-U"], { stdio: "ignore" });
        const timer = setTimeout(() => p.kill("SIGKILL"), 90_000);
        p.on("error", () => clearTimeout(timer));
        p.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) {
                try {
                    const now = new Date();
                    fs.utimesSync(BIN_PATH, now, now); // tandai sudah dicek, biar gak diulang tiap restart
                } catch (err) {
                    // gak fatal
                }
            }
        });
    } catch (err) {
        // gak fatal
    }
}

let readyPromise = null;
function ensureBinary() {
    if (!readyPromise) {
        readyPromise = (async () => {
            if (!fs.existsSync(BIN_PATH)) await download();
            else updateInBackground();
            return BIN_PATH;
        })().catch((err) => {
            failedAt = Date.now();
            readyPromise = null;
            throw err;
        });
    }
    return readyPromise;
}

// false selama masa tunggu setelah gagal (supaya tiap lagu gak nunggu unduhan yang pasti gagal)
function usable() {
    return Date.now() - failedAt > RETRY_AFTER_FAIL_MS;
}

function baseArgs() {
    const args = ["--ignore-config", "--no-warnings", "--socket-timeout", "15", "--retries", "2"];
    if (ffmpegPath) args.push("--ffmpeg-location", ffmpegPath);
    if (process.env.YTDLP_COOKIES) {
        const cookies = path.resolve(__dirname, process.env.YTDLP_COOKIES);
        if (fs.existsSync(cookies)) args.push("--cookies", cookies);
    }
    if (process.env.YTDLP_EXTRA_ARGS) args.push(...process.env.YTDLP_EXTRA_ARGS.split(/\s+/).filter(Boolean));
    return args;
}

function toError(stderr, code) {
    const lines = String(stderr).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const errLine =
        [...lines].reverse().find((l) => /^ERROR:/i.test(l)) || lines[lines.length - 1] || `yt-dlp keluar dengan kode ${code}`;
    const msg = errLine.replace(/^ERROR:\s*/i, "").slice(0, 300);
    if (!hintShown && /javascript runtime|js runtime|\bejs\b|n challenge/i.test(stderr)) {
        hintShown = true;
        console.log('[ytdlp] YouTube butuh JavaScript runtime. Coba isi di .env: YTDLP_EXTRA_ARGS=--js-runtimes node');
    }
    return new Error(msg);
}

async function run(args, timeoutMs = 30_000) {
    if (!usable()) throw new Error("yt-dlp belum siap (unduhan gagal, dicoba lagi nanti)");
    const bin = await ensureBinary();
    return new Promise((resolve, reject) => {
        const proc = spawn(bin, [...baseArgs(), ...args], { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
            proc.kill("SIGKILL");
            reject(new Error("yt-dlp timeout"));
        }, timeoutMs);
        proc.stdout.on("data", (d) => (out += d));
        proc.stderr.on("data", (d) => {
            err += d;
            if (err.length > 20000) err = err.slice(-20000);
        });
        proc.on("error", (e) => {
            clearTimeout(timer);
            failedAt = Date.now(); // gagal dijalankan (izin/format salah), jangan diulang terus
            reject(e);
        });
        proc.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) resolve(out);
            else reject(toError(err, code));
        });
    });
}

function parseEntries(out) {
    return String(out)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
            try {
                return JSON.parse(l);
            } catch (err) {
                return null;
            }
        })
        .filter(Boolean)
        .map((e) => ({
            title: e.title || "",
            url: e.webpage_url || e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
            durationSec: typeof e.duration === "number" ? e.duration : null,
            channel: e.channel || e.uploader || "",
            playlistTitle: e.playlist_title || e.playlist || "",
        }))
        .filter((e) => e.url);
}

// Cari video YouTube. Hasil: [{ title, url, durationSec, channel }]
async function search(query, limit = 5) {
    const out = await run([`ytsearch${limit}:${query}`, "--flat-playlist", "--dump-json"], 30_000);
    return parseEntries(out);
}

// Info 1 video (judul, durasi) tanpa unduh. Hasil: { title, url, durationSec } atau null
async function info(url) {
    const out = await run(["--no-playlist", "--dump-json", "--skip-download", url], 30_000);
    return parseEntries(out)[0] || null;
}

// Daftar isi playlist YouTube (tanpa unduh). Hasil: { title, entries }
async function playlist(url, limit = 20) {
    const out = await run(["--flat-playlist", "--dump-json", "--playlist-end", String(limit), url], 45_000);
    const entries = parseEntries(out);
    return { title: (entries[0] && entries[0].playlistTitle) || "", entries };
}

// Stream audio. Mengembalikan { stream, type, cleanup }.
// cleanup() mematikan proses yt-dlp; dipanggil musicPlayer.js saat lagu selesai/di-skip/stop.
async function stream(url) {
    if (!usable()) throw new Error("yt-dlp belum siap (unduhan gagal, dicoba lagi nanti)");
    const bin = await ensureBinary();

    const args = [...baseArgs(), "--no-playlist", "--quiet", "--no-progress", "-f", "bestaudio/best", "-o", "-", url];
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = new PassThrough();
    let err = "";

    const cleanup = () => {
        try {
            proc.kill("SIGKILL");
        } catch (e) {
            // sudah mati
        }
        try {
            out.destroy();
        } catch (e) {
            // sudah ditutup
        }
    };

    out.on("error", () => {});
    proc.stdout.on("error", () => {});
    proc.stderr.on("data", (d) => {
        err += d;
        if (err.length > 20000) err = err.slice(-20000);
    });

    // Tunggu byte pertama: kalau yt-dlp gagal duluan (diblokir, video privat, dll), error-nya bisa dilaporkan.
    await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("yt-dlp timeout nunggu audio"));
        }, FIRST_BYTE_TIMEOUT_MS);

        proc.once("error", (e) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            failedAt = Date.now();
            cleanup();
            reject(e);
        });
        proc.once("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            cleanup();
            reject(toError(err, code));
        });
        proc.stdout.once("data", (chunk) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            proc.stdout.pause(); // jangan sampai chunk berikutnya lewat sebelum dipipe
            out.write(chunk);
            proc.stdout.pipe(out);
            resolve();
        });
    });

    return { stream: out, type: "arbitrary", cleanup };
}

module.exports = { ensureBinary, usable, search, playlist, info, stream };