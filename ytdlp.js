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
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PassThrough } = require("stream");

const IS_WIN = process.platform === "win32";
// Binary standalone (gak butuh Python). Sengaja TIDAK memakai binary bawaan youtube-dl-exec,
// karena yang itu bisa berupa skrip Python dan gagal jalan di server yang gak punya Python.
const BIN_PATH = process.env.YTDLP_PATH || path.join(__dirname, "bin", IS_WIN ? "yt-dlp.exe" : "yt-dlp");
// Versi Python (satu file ~3 MB, tanpa ekstraksi ke temp). Dipakai otomatis kalau server punya Python 3.10+;
// ini jauh lebih ringan dan gak kena error "Failed to extract entry" milik binary standalone.
const PY_FILE = path.join(__dirname, "bin", "yt-dlp.pyz");
const UPDATE_AFTER_MS = 12 * 60 * 60 * 1000;
const RETRY_AFTER_FAIL_MS = 10 * 60 * 1000;
const FIRST_BYTE_TIMEOUT_MS = 45 * 1000;

// yt-dlp standalone mengekstrak dirinya ke folder temp tiap kali jalan. /tmp di hosting sering kecil,
// jadi dipindah ke folder project (./tmp) dan sisa ekstrak yang yatim dibersihkan saat startup.
const TMP_DIR = path.join(__dirname, "tmp");
try {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    for (const name of fs.readdirSync(TMP_DIR)) {
        if (name.startsWith("_MEI")) fs.rmSync(path.join(TMP_DIR, name), { recursive: true, force: true });
    }
} catch (err) {
    // gak fatal
}

function childEnv() {
    return { ...process.env, TMPDIR: TMP_DIR, TEMP: TMP_DIR, TMP: TMP_DIR };
}

// Proses yt-dlp dijalankan sebagai grup sendiri, dan dimatikan lembut (SIGTERM) supaya pembungkusnya sempat
// membersihkan folder temp dan ikut mematikan proses dalamnya. SIGKILL hanya jadi cadangan.
const active = new Set();
function spawnYtdlp(target, args) {
    const proc = spawn(target.cmd, [...target.pre, ...args], { stdio: ["ignore", "pipe", "pipe"], env: childEnv(), detached: !IS_WIN });
    active.add(proc);
    proc.once("close", () => active.delete(proc));
    return proc;
}

function killProc(proc) {
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
    const send = (sig) => {
        try {
            if (IS_WIN) proc.kill(sig);
            else process.kill(-proc.pid, sig);
        } catch (err) {
            // sudah mati
        }
    };
    send("SIGTERM");
    const t = setTimeout(() => send("SIGKILL"), 4000);
    if (t.unref) t.unref();
}

process.once("exit", () => {
    for (const proc of active) {
        try {
            if (IS_WIN) proc.kill("SIGKILL");
            else process.kill(-proc.pid, "SIGKILL");
        } catch (err) {
            // sudah mati
        }
    }
});

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

async function download(target) {
    fs.mkdirSync(path.dirname(target.file), { recursive: true });
    const asset = target.kind === "python" ? "yt-dlp" : assetName();
    console.log(`[ytdlp] Mengunduh yt-dlp (${target.kind === "python" ? "versi Python, +/- 3 MB" : "standalone, +/- 35 MB"}, sekali saja)...`);
    const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`unduh yt-dlp gagal (status ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = target.file + ".tmp";
    fs.writeFileSync(tmp, buf);
    if (!IS_WIN) fs.chmodSync(tmp, 0o755);
    fs.renameSync(tmp, target.file);
    console.log("[ytdlp] yt-dlp terpasang.");
}

function updateInBackground(target) {
    if (process.env.YTDLP_NO_UPDATE === "1" || target.kind === "custom") return;
    try {
        if (Date.now() - fs.statSync(target.file).mtimeMs < UPDATE_AFTER_MS) return;
        const p = spawnYtdlp(target, ["-U"]);
        p.stdout.resume();
        p.stderr.resume();
        const timer = setTimeout(() => killProc(p), 90_000);
        p.on("error", () => clearTimeout(timer));
        p.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) {
                try {
                    const now = new Date();
                    fs.utimesSync(target.file, now, now); // tandai sudah dicek, biar gak diulang tiap restart
                } catch (err) {
                    // gak fatal
                }
            }
        });
    } catch (err) {
        // gak fatal
    }
}

// Cari Python 3.10+ (syarat yt-dlp versi Python). Hasil: nama perintah, atau null.
function findPython() {
    if (IS_WIN || process.env.YTDLP_NO_PYTHON === "1") return null;
    for (const cmd of ["python3", "python"]) {
        try {
            const r = spawnSync(cmd, ["-c", "import sys;print(1 if sys.version_info>=(3,10) else 0)"], {
                encoding: "utf8",
                timeout: 10_000,
            });
            if (r.status === 0 && String(r.stdout).trim() === "1") return cmd;
        } catch (err) {
            // perintah gak ada, coba berikutnya
        }
    }
    return null;
}

function pickTarget() {
    if (process.env.YTDLP_PATH) return { kind: "custom", cmd: process.env.YTDLP_PATH, pre: [], file: process.env.YTDLP_PATH };
    const py = findPython();
    if (py) return { kind: "python", cmd: py, pre: [PY_FILE], file: PY_FILE };
    return { kind: "standalone", cmd: BIN_PATH, pre: [], file: BIN_PATH };
}

let readyPromise = null;
function ensureBinary() {
    if (!readyPromise) {
        readyPromise = (async () => {
            const target = pickTarget();
            console.log(`[ytdlp] Mode: ${target.kind}`);
            if (!fs.existsSync(target.file)) await download(target);
            else updateInBackground(target);
            return target;
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
    if (/Failed to extract entry|PYI-\d+/i.test(stderr)) {
        console.log("[ytdlp] yt-dlp standalone gagal mengekstrak (temp/disk penuh). Pasang Python 3.10+ atau kosongkan disk; hapus folder bin/ lalu restart.");
    }
    if (!hintShown && /javascript runtime|js runtime|\bejs\b|n challenge/i.test(stderr)) {
        hintShown = true;
        console.log('[ytdlp] YouTube butuh JavaScript runtime. Coba isi di .env: YTDLP_EXTRA_ARGS=--js-runtimes node');
    }
    return new Error(msg);
}

async function run(args, timeoutMs = 30_000) {
    if (!usable()) throw new Error("yt-dlp belum siap (unduhan gagal, dicoba lagi nanti)");
    const target = await ensureBinary();
    return new Promise((resolve, reject) => {
        const proc = spawnYtdlp(target, [...baseArgs(), ...args]);
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
            killProc(proc);
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
    const target = await ensureBinary();

    const args = [...baseArgs(), "--no-playlist", "--quiet", "--no-progress", "-f", "bestaudio/best", "-o", "-", url];
    const proc = spawnYtdlp(target, args);
    const out = new PassThrough();
    let err = "";

    const cleanup = () => {
        killProc(proc);
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