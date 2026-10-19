// youtubeSource.js
// Ubah input user (link YouTube / playlist / link SoundCloud / judul lagu) jadi daftar "song"
// yang bisa dimainkan musicPlayer.js. Pakai library play-dl yang sudah terpasang di project.
//
// CATATAN: play-dl sudah tidak dirawat lagi oleh pembuatnya, dan YouTube sering menolak
// koneksi dari server hosting (error 429 / "sign in to confirm you're not a bot").
// Kalau sering gagal, lihat opsi YOUTUBE_COOKIE di bawah, atau pakai link SoundCloud.
const play = require("play-dl");

const MAX_PLAYLIST_SONGS = 20;

// Opsional: cookie YouTube (dari akun cadangan, JANGAN akun utama) kadang membantu kalau YouTube menolak.
// Isi di .env: YOUTUBE_COOKIE=...  (risiko: akun itu bisa kena batasan dari YouTube)
if (process.env.YOUTUBE_COOKIE) {
    Promise.resolve(play.setToken({ youtube: { cookie: process.env.YOUTUBE_COOKIE } })).catch((err) =>
        console.error("[youtubeSource] Gagal set YOUTUBE_COOKIE:", err.message)
    );
}

let soundcloudReady = null;
function ensureSoundCloud() {
    if (!soundcloudReady) {
        soundcloudReady = Promise.resolve(play.getFreeClientID())
            .then((client_id) => play.setToken({ soundcloud: { client_id } }))
            .catch((err) => {
                soundcloudReady = null; // boleh dicoba lagi nanti
                throw err;
            });
    }
    return soundcloudReady;
}

// Bikin objek lagu. Stream baru diambil saat lagu mau diputar (getStream), bukan saat ditambah ke antrian.
function makeSong({ title, url, duration }, requestedBy) {
    return {
        title: title || url,
        url,
        duration: duration || null,
        source: url,
        requestedBy,
        getStream: async () => {
            const s = await play.stream(url);
            return { stream: s.stream, type: s.type };
        },
    };
}

// ---------- SPOTIFY ----------
// Spotify TIDAK dipakai buat audio. Seperti Jockie Music: ambil judul + artis dari Spotify,
// lalu otomatis dicari di YouTube saat lagunya mau diputar.
// Metadata dibaca dari halaman embed publik Spotify (tanpa API key). Ini cara tidak resmi,
// jadi bisa berhenti jalan kalau Spotify mengubah halamannya.
// (API resmi Spotify sejak Februari 2026 mensyaratkan akun Premium untuk pemilik app, jadi dihindari.)
const SPOTIFY_URL = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/i;
const SPOTIFY_URI = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/i;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function parseSpotify(text) {
    const m = text.match(SPOTIFY_URL) || text.match(SPOTIFY_URI);
    return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}

async function fetchSpotifyEmbed(type, id) {
    const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
        headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) throw new Error(`Spotify membalas status ${res.status}`);
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error("Format halaman Spotify berubah");
    return JSON.parse(m[1]);
}

// Cari objek pertama di dalam struktur JSON yang memenuhi syarat (dibuat longgar karena struktur bisa berubah)
function findDeep(node, predicate, depth = 0) {
    if (!node || typeof node !== "object" || depth > 12) return null;
    if (!Array.isArray(node) && predicate(node)) return node;
    const values = Array.isArray(node) ? node : Object.values(node);
    for (const v of values) {
        const found = findDeep(v, predicate, depth + 1);
        if (found) return found;
    }
    return null;
}

const clean = (t) => (typeof t === "string" ? t.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() : "");
const artistsToString = (arr) => (Array.isArray(arr) ? arr.map((a) => clean(a && a.name)).filter(Boolean).join(", ") : "");

// Hasil: { name, tracks: [{ title, artist }] }
function extractSpotify(data) {
    const holder = findDeep(data, (o) => Array.isArray(o.trackList) && o.trackList.length > 0);
    if (holder) {
        const tracks = holder.trackList
            .map((t) => ({ title: clean(t.title || t.name), artist: clean(t.subtitle) || artistsToString(t.artists) }))
            .filter((t) => t.title);
        return { name: clean(holder.name || holder.title), tracks };
    }

    const single =
        findDeep(data, (o) => typeof o.name === "string" && Array.isArray(o.artists) && o.artists.length > 0) ||
        findDeep(data, (o) => typeof o.title === "string" && typeof o.subtitle === "string");
    if (single) {
        const title = clean(single.name || single.title);
        const artist = artistsToString(single.artists) || clean(single.subtitle);
        if (title) return { name: title, tracks: [{ title, artist }] };
    }
    return { name: "", tracks: [] };
}

async function spotifyOEmbedTitle(url) {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) throw new Error(`oEmbed status ${res.status}`);
    const json = await res.json();
    return clean(json.title);
}

// ---------- PENCARIAN PINTAR ----------
// Ambil beberapa hasil YouTube lalu pilih yang paling cocok: utamakan versi asli
// (channel "- Topic", "official audio", lirik), hindari cover/live/remix/karaoke dll
// kecuali memang diminta di judul yang diketik.
const BAD_WORDS = ["cover", "live", "remix", "karaoke", "slowed", "sped up", "reverb", "nightcore", "8d", "instrumental", "akustik", "acoustic", "reaction"];

async function findBestYouTube(query, rawQuery = query) {
    const results = await play.search(query, { limit: 5, source: { youtube: "video" } });
    if (!results || results.length === 0) return null;

    const wanted = String(rawQuery).toLowerCase();
    let best = null;
    let bestScore = -Infinity;

    results.forEach((v, i) => {
        const title = String(v.title || "").toLowerCase();
        const channel = String((v.channel && v.channel.name) || "").toLowerCase();
        let score = -i * 0.5; // urutan asli dari YouTube tetap dihargai

        if (/ - topic$/.test(channel)) score += 3;
        if (/\b(official audio|audio|lyrics?|lirik)\b/.test(title)) score += 1.5;
        for (const bad of BAD_WORDS) {
            if (new RegExp(`\\b${bad}\\b`, "i").test(title) && !wanted.includes(bad)) score -= 3;
        }
        if (v.durationInSec && v.durationInSec > 15 * 60) score -= 3; // kemungkinan kompilasi/mix panjang

        if (score > bestScore) {
            best = v;
            bestScore = score;
        }
    });
    return best;
}

// OPSIONAL: cari judul + artis resmi lewat Spotify, kalau SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET diisi di .env.
// Kalau gak diisi atau gagal, otomatis pakai pencarian YouTube biasa.
let spotifyToken = null;
let spotifyTokenExp = 0;
let spotifySearchWarned = false;

async function getSpotifyToken() {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) return null;
    if (spotifyToken && Date.now() < spotifyTokenExp - 30000) return spotifyToken;

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`token Spotify status ${res.status}`);
    const json = await res.json();
    spotifyToken = json.access_token;
    spotifyTokenExp = Date.now() + (json.expires_in || 3600) * 1000;
    return spotifyToken;
}

async function spotifySearch(text) {
    const token = await getSpotifyToken();
    if (!token) return null;

    const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(text)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`pencarian Spotify status ${res.status}`);
    const json = await res.json();
    const t = json.tracks && json.tracks.items && json.tracks.items[0];
    if (!t) return null;
    return { title: clean(t.name), artist: artistsToString(t.artists) };
}

// Lagu yang dicari di YouTube baru saat mau diputar (hemat: playlist 20 lagu gak langsung 20x search)
function makeLazySearchSong({ title, artist, url, duration }, requestedBy) {
    const q = artist ? `${artist} - ${title}` : title;
    let cachedUrl = null;
    return {
        title: q,
        url,
        duration: duration || null,
        source: url,
        requestedBy,
        getStream: async () => {
            if (!cachedUrl) {
                const best = await findBestYouTube(q);
                if (!best) throw new Error(`Gak nemu "${q}" di YouTube.`);
                cachedUrl = best.url;
            }
            const s = await play.stream(cachedUrl);
            return { stream: s.stream, type: s.type };
        },
    };
}

async function resolveSpotify({ type, id }, originalUrl, requestedBy) {
    let info = { name: "", tracks: [] };
    try {
        info = extractSpotify(await fetchSpotifyEmbed(type, id));
    } catch (err) {
        console.log("[youtubeSource] Embed Spotify gagal:", err.message);
    }

    if (info.tracks.length === 0) {
        if (type === "track") {
            try {
                const title = await spotifyOEmbedTitle(`https://open.spotify.com/track/${id}`);
                if (title) return { songs: [makeLazySearchSong({ title, artist: "", url: originalUrl }, requestedBy)] };
            } catch (err) {
                console.log("[youtubeSource] oEmbed Spotify gagal:", err.message);
            }
        }
        throw new Error("Gak bisa baca data dari Spotify (link salah, playlist privat, atau Spotify lagi nolak). Coba link YouTube atau ketik judul lagunya.");
    }

    const tracks = info.tracks.slice(0, MAX_PLAYLIST_SONGS);
    const songs = tracks.map((t) => makeLazySearchSong({ title: t.title, artist: t.artist, url: originalUrl }, requestedBy));

    if (type === "track") return { songs: songs.slice(0, 1) };
    return {
        songs,
        note: `${type === "album" ? "Album" : "Playlist"} Spotify **${info.name || "tanpa judul"}** (maks ${MAX_PLAYLIST_SONGS} lagu pertama)`,
    };
}

async function resolveQuery(query, requestedBy) {
    const text = String(query || "").trim();
    if (!text) throw new Error("Query kosong.");

    const sp = parseSpotify(text);
    if (sp) return resolveSpotify(sp, text, requestedBy);
    if (/open\.spotify\.com\//i.test(text)) {
        throw new Error("Link Spotify itu belum didukung. Pakai link lagu (track), album, atau playlist.");
    }

    if (/^https?:\/\//i.test(text)) {
        const yt = play.yt_validate(text);

        if (yt === "video") {
            const info = await play.video_basic_info(text);
            const d = info.video_details;
            return { songs: [makeSong({ title: d.title, url: d.url || text, duration: d.durationRaw }, requestedBy)] };
        }

        if (yt === "playlist") {
            const pl = await play.playlist_info(text, { incomplete: true });
            let vids = [];
            try {
                vids = typeof pl.page === "function" ? await pl.page(1) : pl.videos;
            } catch (err) {
                vids = pl.videos || [];
            }
            vids = (vids || []).slice(0, MAX_PLAYLIST_SONGS);
            if (vids.length === 0) throw new Error("Playlist kosong atau gak bisa dibaca.");
            return {
                songs: vids.map((v) => makeSong({ title: v.title, url: v.url, duration: v.durationRaw }, requestedBy)),
                note: `Playlist **${pl.title || "tanpa judul"}** (maks ${MAX_PLAYLIST_SONGS} lagu pertama)`,
            };
        }

        let so = false;
        try {
            await ensureSoundCloud();
            so = await play.so_validate(text);
        } catch (err) {
            // SoundCloud gak bisa diinisialisasi, lanjut ke pesan "gak didukung"
        }
        if (so === "track") {
            const t = await play.soundcloud(text);
            return {
                songs: [makeSong({ title: t.name, url: t.url || text, duration: t.durationInSec ? `${Math.floor(t.durationInSec / 60)}:${String(t.durationInSec % 60).padStart(2, "0")}` : null }, requestedBy)],
            };
        }

        throw new Error("Link itu belum didukung. Pakai link YouTube, Spotify, SoundCloud (track), atau ketik judul lagu.");
    }

    // Teks biasa (judul lagu): rapikan lewat Spotify kalau tersedia, lalu cari versi terbaik di YouTube
    let canonical = null;
    try {
        canonical = await spotifySearch(text);
    } catch (err) {
        if (!spotifySearchWarned) {
            spotifySearchWarned = true;
            console.log("[youtubeSource] Pencarian Spotify gagal, pakai pencarian YouTube saja:", err.message);
        }
    }

    const q = canonical && canonical.title ? (canonical.artist ? `${canonical.artist} - ${canonical.title}` : canonical.title) : text;
    const best = await findBestYouTube(q, text);
    if (!best) throw new Error(`Gak nemu hasil buat "${text}".`);
    return {
        songs: [makeSong({ title: canonical ? q : best.title, url: best.url, duration: best.durationRaw }, requestedBy)],
    };
}

module.exports = { resolveQuery, makeSong };