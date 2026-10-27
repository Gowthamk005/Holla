/* =========================================================
   OLLA – QR code generator + scanner helpers (no libraries)
   Generator: byte mode, error correction level M, versions 1-10
   (up to 213 bytes of text, plenty for a payment link).
   Scanner: uses the browser's BarcodeDetector when available and
   falls back to the jsQR library (loaded on demand).
   ========================================================= */

const OllaQR = (() => {

    /* ---- version tables, error-correction level M ----
       [ecCodewordsPerBlock, [blockCount, dataCodewordsPerBlock], ...] */
    const BLOCKS = {
        1:  [10, [1, 16]],
        2:  [16, [1, 28]],
        3:  [26, [1, 44]],
        4:  [18, [2, 32]],
        5:  [24, [2, 43]],
        6:  [16, [4, 27]],
        7:  [18, [4, 31]],
        8:  [22, [2, 38], [2, 39]],
        9:  [22, [3, 36], [2, 37]],
        10: [26, [4, 43], [1, 44]]
    };

    const ALIGN = {
        1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
        7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
    };

    function dataCapacity(version) {
        const b = BLOCKS[version];
        let total = 0;
        for (let i = 1; i < b.length; i++) total += b[i][0] * b[i][1];
        return total;
    }

    /* ---- Reed-Solomon over GF(256), polynomial 0x11D ---- */
    const EXP = new Array(512), LOG = new Array(256);
    (() => {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            EXP[i] = x; LOG[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11D;
        }
        for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    })();

    const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

    function rsGenerator(degree) {
        let poly = [1];
        for (let i = 0; i < degree; i++) {
            const next = new Array(poly.length + 1).fill(0);
            for (let j = 0; j < poly.length; j++) {
                next[j] ^= poly[j];
                next[j + 1] ^= gmul(poly[j], EXP[i]);
            }
            poly = next;
        }
        return poly;   /* highest degree first, leading coefficient 1 */
    }

    function rsRemainder(data, degree) {
        const gen = rsGenerator(degree);
        const result = new Array(degree).fill(0);
        for (const byte of data) {
            const factor = byte ^ result.shift();
            result.push(0);
            if (factor !== 0) {
                for (let i = 0; i < degree; i++) result[i] ^= gmul(gen[i + 1], factor);
            }
        }
        return result;
    }

    /* ---- BCH helpers for format / version info ---- */
    function formatBits(mask) {
        const data = (0 << 3) | mask;                 /* level M = 00 */
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        return ((data << 10) | rem) ^ 0x5412;
    }

    function versionBits(version) {
        let rem = version;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        return (version << 12) | rem;
    }

    /* ---- build the symbol ---- */
    function encode(text) {
        const bytes = Array.from(new TextEncoder().encode(text));

        let version = 0;
        for (let v = 1; v <= 10; v++) {
            const countBits = v < 10 ? 8 : 16;
            const bitsNeeded = 4 + countBits + bytes.length * 8;
            if (Math.ceil(bitsNeeded / 8) <= dataCapacity(v)) { version = v; break; }
        }
        if (!version) throw new Error("Text too long for QR (max ~210 characters)");

        /* bit stream */
        const bits = [];
        const push = (value, length) => {
            for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
        };
        push(0b0100, 4);
        push(bytes.length, version < 10 ? 8 : 16);
        bytes.forEach(b => push(b, 8));

        const capBits = dataCapacity(version) * 8;
        push(0, Math.min(4, capBits - bits.length));
        while (bits.length % 8) bits.push(0);
        for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) push(pad, 8);

        const data = [];
        for (let i = 0; i < bits.length; i += 8) {
            let b = 0;
            for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
            data.push(b);
        }

        /* split into blocks, add error correction, interleave */
        const spec = BLOCKS[version];
        const ecLen = spec[0];
        const blocks = [];
        let pos = 0;
        for (let g = 1; g < spec.length; g++) {
            for (let n = 0; n < spec[g][0]; n++) {
                const chunk = data.slice(pos, pos + spec[g][1]);
                pos += spec[g][1];
                blocks.push({ data: chunk, ec: rsRemainder(chunk, ecLen) });
            }
        }

        const stream = [];
        const maxData = Math.max(...blocks.map(b => b.data.length));
        for (let i = 0; i < maxData; i++) blocks.forEach(b => { if (i < b.data.length) stream.push(b.data[i]); });
        for (let i = 0; i < ecLen; i++) blocks.forEach(b => stream.push(b.ec[i]));

        const finalBits = [];
        stream.forEach(b => { for (let i = 7; i >= 0; i--) finalBits.push((b >>> i) & 1); });

        /* matrix */
        const size = version * 4 + 17;
        const modules = Array.from({ length: size }, () => new Array(size).fill(false));
        const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

        const setFn = (r, c, dark) => {
            if (r < 0 || c < 0 || r >= size || c >= size) return;
            modules[r][c] = dark; reserved[r][c] = true;
        };

        /* finder patterns + separators */
        const finder = (r0, c0) => {
            for (let dr = -1; dr <= 7; dr++) {
                for (let dc = -1; dc <= 7; dc++) {
                    const dark = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
                        (dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
                         (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
                    setFn(r0 + dr, c0 + dc, dark);
                }
            }
        };
        finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

        /* timing */
        for (let i = 8; i < size - 8; i++) {
            setFn(6, i, i % 2 === 0);
            setFn(i, 6, i % 2 === 0);
        }

        /* alignment */
        const al = ALIGN[version];
        al.forEach((r, i) => al.forEach((c, j) => {
            const corner = (i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0);
            if (corner) return;
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    setFn(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
                }
            }
        }));

        /* reserve format + version areas */
        for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
        for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
        setFn(size - 8, 8, true);   /* dark module */

        if (version >= 7) {
            const vb = versionBits(version);
            for (let i = 0; i < 18; i++) {
                const dark = ((vb >>> i) & 1) === 1;
                const a = size - 11 + (i % 3), b = Math.floor(i / 3);
                setFn(b, a, dark);
                setFn(a, b, dark);
            }
        }

        /* place data bits in the zigzag order */
        let bitIndex = 0;
        let upward = true;
        for (let right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (let v = 0; v < size; v++) {
                const row = upward ? size - 1 - v : v;
                for (let j = 0; j < 2; j++) {
                    const col = right - j;
                    if (reserved[row][col]) continue;
                    modules[row][col] = bitIndex < finalBits.length ? finalBits[bitIndex] === 1 : false;
                    bitIndex++;
                }
            }
            upward = !upward;
        }

        /* choose the best mask */
        const maskFns = [
            (r, c) => (r + c) % 2 === 0,
            (r, c) => r % 2 === 0,
            (r, c) => c % 3 === 0,
            (r, c) => (r + c) % 3 === 0,
            (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
            (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
            (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
            (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
        ];

        const build = (mask) => {
            const m = modules.map((row, r) => row.map((v, c) =>
                reserved[r][c] ? v : (v !== maskFns[mask](r, c))));

            /* format info */
            const fb = formatBits(mask);
            const bit = (i) => ((fb >>> i) & 1) === 1;
            for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
            m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
            for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
            for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
            for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
            m[size - 8][8] = true;
            return m;
        };

        const penalty = (m) => {
            let p = 0;
            for (let pass = 0; pass < 2; pass++) {
                for (let a = 0; a < size; a++) {
                    let run = 1;
                    for (let b = 1; b < size; b++) {
                        const cur = pass ? m[b][a] : m[a][b];
                        const prev = pass ? m[b - 1][a] : m[a][b - 1];
                        if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
                        else run = 1;
                    }
                }
            }
            for (let r = 0; r < size - 1; r++) {
                for (let c = 0; c < size - 1; c++) {
                    if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
                }
            }
            const pat = [true, false, true, true, true, false, true, false, false, false, false];
            const rev = [...pat].reverse();
            const matchAt = (get, i) => pat.every((v, k) => get(i + k) === v) || rev.every((v, k) => get(i + k) === v);
            for (let a = 0; a < size; a++) {
                for (let i = 0; i <= size - 11; i++) {
                    if (matchAt(k => m[a][k], i)) p += 40;
                    if (matchAt(k => m[k][a], i)) p += 40;
                }
            }
            let dark = 0;
            m.forEach(row => row.forEach(v => { if (v) dark++; }));
            p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
            return p;
        };

        let best = null, bestScore = Infinity;
        for (let mask = 0; mask < 8; mask++) {
            const candidate = build(mask);
            const score = penalty(candidate);
            if (score < bestScore) { bestScore = score; best = candidate; }
        }
        return best;
    }

    /* draw onto a canvas (dark modules on white, 4-module quiet zone) */
    function toCanvas(text, canvas, pixels = 240) {
        const m = encode(text);
        const quiet = 4;
        const count = m.length + quiet * 2;
        const scale = Math.max(1, Math.floor(pixels / count));
        canvas.width = canvas.height = count * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        m.forEach((row, r) => row.forEach((dark, c) => {
            if (dark) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }));
        return canvas;
    }

    /* ---- scanner ---- */
    let jsQRPromise = null;
    function loadJsQR() {
        if (window.jsQR) return Promise.resolve(window.jsQR);
        if (!jsQRPromise) {
            jsQRPromise = new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
                s.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error("jsQR missing"));
                s.onerror = () => reject(new Error("Could not load the QR decoder (offline?)"));
                document.head.appendChild(s);
            });
        }
        return jsQRPromise;
    }

    let detector = null;
    async function decodeSource(source, width, height) {
        /* 1) native detector */
        if ("BarcodeDetector" in window) {
            try {
                detector = detector || new BarcodeDetector({ formats: ["qr_code"] });
                const found = await detector.detect(source);
                if (found.length) return found[0].rawValue;
                return null;
            } catch (e) { /* fall through to jsQR */ }
        }
        /* 2) jsQR fallback */
        const jsQR = await loadJsQR();
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, width, height);
        const img = ctx.getImageData(0, 0, width, height);
        const code = jsQR(img.data, width, height);
        return code ? code.data : null;
    }

    async function decodeImageFile(file) {
        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise((res, rej) => {
                const i = new Image();
                i.onload = () => res(i);
                i.onerror = () => rej(new Error("Could not read that image"));
                i.src = url;
            });
            return await decodeSource(img, img.naturalWidth, img.naturalHeight);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /* live camera scan. Returns { stop } and calls onResult(text) once */
    async function startCamera(videoEl, onResult, onError) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera is not available here. Camera needs https or localhost. Use 'Scan from photo' instead.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } }, audio: false
        });
        videoEl.srcObject = stream;
        await videoEl.play();

        let stopped = false;
        const stop = () => {
            stopped = true;
            stream.getTracks().forEach(t => t.stop());
            videoEl.srcObject = null;
        };

        const tick = async () => {
            if (stopped) return;
            try {
                if (videoEl.videoWidth) {
                    const text = await decodeSource(videoEl, videoEl.videoWidth, videoEl.videoHeight);
                    if (text) { stop(); onResult(text); return; }
                }
            } catch (e) {
                if (onError) onError(e);
            }
            setTimeout(tick, 250);
        };
        tick();
        return { stop };
    }

    return { encode, toCanvas, decodeImageFile, startCamera };
})();
export default OllaQR;
