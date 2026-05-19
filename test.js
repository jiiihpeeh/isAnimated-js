import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { is_animated, detect_format } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(__dirname, 'test-fixtures');

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function bytes(...args) {
    return new Uint8Array(args);
}

function u32(n, le = false) {
    const b = new Uint8Array(4);
    const v = new DataView(b.buffer);
    le ? v.setUint32(0, n, true) : v.setUint32(0, n);
    return b;
}

function str(s) {
    return new TextEncoder().encode(s);
}

/** Minimal PNG with IHDR only */
function makePNG() {
    const data = [];
    data.push(...PNG_SIG);
    const ihdr_data = new Uint8Array(13);
    new DataView(ihdr_data.buffer).setUint32(0, 1); // width=1
    new DataView(ihdr_data.buffer).setUint32(4, 1); // height=1
    ihdr_data[8] = 8;  // bit depth
    ihdr_data[9] = 2;  // color type (RGB)
    data.push(...u32(13));
    data.push(...str('IHDR'));
    data.push(...ihdr_data);
    data.push(...u32(0)); // CRC placeholder
    return new Uint8Array(data);
}

/** APNG with IHDR + acTL */
function makeAPNG() {
    const data = [...makePNG()];
    data.push(...u32(8));
    data.push(...str('acTL'));
    data.push(...u32(2)); // num_frames
    data.push(...u32(0)); // num_plays
    data.push(...u32(0)); // CRC placeholder
    return new Uint8Array(data);
}

/** PNG with IEND immediately (no frames after) */
function makePNGWithIEND() {
    const data = [...makePNG()];
    data.push(...u32(0));
    data.push(...str('IEND'));
    data.push(...u32(0));
    return new Uint8Array(data);
}

/** Build a WebP file with a single VP8X chunk */
function makeWebP(animated) {
    const vp8x_payload = new Uint8Array(10);
    if (animated) vp8x_payload[0] = 0x02;
    const data = [];
    data.push(...str('RIFF'));
    // total file size placeholder (will be set below)
    data.push(0, 0, 0, 0);
    data.push(...str('WEBP'));
    data.push(...str('VP8X'));
    data.push(...u32(vp8x_payload.length, true));
    data.push(...vp8x_payload);
    // pad to even
    return new Uint8Array(data);
}

/** WebP with ANIM chunk (animated) */
function makeWebPWithANIM() {
    const data = [];
    data.push(...str('RIFF'));
    data.push(0, 0, 0, 0);
    data.push(...str('WEBP'));
    data.push(...str('ANIM'));
    data.push(...u32(6, true)); // anim chunk: bgcolor(4) + loops(2)
    data.push(0, 0, 0, 0, 0, 0);
    return new Uint8Array(data);
}

/** WebP with ALPH chunk (no animation) followed by VP8 */
function makeWebPWithoutVP8X() {
    const data = [];
    data.push(...str('RIFF'));
    data.push(0, 0, 0, 0);
    data.push(...str('WEBP'));
    // Some non-animation chunk
    data.push(...str('VP8 '));
    data.push(...u32(10, true));
    data.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    return new Uint8Array(data);
}

/** Build an AVIF with a given brand and optional moov box */
function makeAVIF(animated) {
    const mdat = new Uint8Array(20);
    const data = [];
    // ftyp box
    const ftyp_data = [];
    ftyp_data.push(...str('avif'));
    ftyp_data.push(0, 0, 0, 0); // version
    ftyp_data.push(...str('avif'));
    ftyp_data.push(...str('mif1'));
    const ftyp_size = 8 + ftyp_data.length;
    data.push(...u32(ftyp_size));
    data.push(...str('ftyp'));
    data.push(...ftyp_data);

    if (animated) {
        // moov box
        const moov_size = 8 + mdat.length;
        data.push(...u32(moov_size));
        data.push(...str('moov'));
        data.push(...mdat);
    } else {
        // empty mdat (single frame)
        const mdat_size = 8 + mdat.length;
        data.push(...u32(mdat_size));
        data.push(...str('mdat'));
        data.push(...mdat);
    }
    return new Uint8Array(data);
}

/** AVIF with moof box (fragment-based animation) */
function makeAVIFWithMoof() {
    const data = [];
    const ftyp_data = [];
    ftyp_data.push(...str('avif'));
    ftyp_data.push(0, 0, 0, 0);
    ftyp_data.push(...str('avif'));
    ftyp_data.push(...str('mif1'));
    data.push(...u32(8 + ftyp_data.length));
    data.push(...str('ftyp'));
    data.push(...ftyp_data);
    data.push(...u32(8 + 8));
    data.push(...str('moof'));
    data.push(...u32(8));
    data.push(...str('mfhd'));
    return new Uint8Array(data);
}

function makeAVIS() {
    const ftyp_data = [];
    ftyp_data.push(...str('avis'));
    ftyp_data.push(0, 0, 0, 0);
    ftyp_data.push(...str('avis'));
    ftyp_data.push(...str('mif1'));
    const data = [];
    data.push(...u32(8 + ftyp_data.length));
    data.push(...str('ftyp'));
    data.push(...ftyp_data);
    return new Uint8Array(data);
}

// ---- Tests ----

describe('detect_format', () => {
    it('detects PNG', () => {
        assert.equal(detect_format(makePNG()), 'png');
    });

    it('detects APNG as PNG', () => {
        assert.equal(detect_format(makeAPNG()), 'png');
    });

    it('detects WebP', () => {
        assert.equal(detect_format(makeWebP(false)), 'webp');
        assert.equal(detect_format(makeWebP(true)), 'webp');
    });

    it('detects AVIF', () => {
        assert.equal(detect_format(makeAVIF(false)), 'avif');
        assert.equal(detect_format(makeAVIF(true)), 'avif');
    });

    it('detects AVIS as avif', () => {
        assert.equal(detect_format(makeAVIS()), 'avif');
    });

    it('returns unknown for empty data', () => {
        assert.equal(detect_format(new Uint8Array()), 'unknown');
    });

    it('returns unknown for short data', () => {
        assert.equal(detect_format(new Uint8Array([1, 2, 3])), 'unknown');
    });

    it('returns unknown for garbage', () => {
        assert.equal(detect_format(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])), 'unknown');
    });
});

describe('is_animated — PNG / APNG', () => {
    it('static PNG is not animated', () => {
        assert.equal(is_animated(makePNG()), false);
    });

    it('PNG with IEND and no acTL is not animated', () => {
        assert.equal(is_animated(makePNGWithIEND()), false);
    });

    it('APNG with acTL chunk is animated', () => {
        assert.equal(is_animated(makeAPNG()), true);
    });

    it('short PNG data (only signature) is not animated', () => {
        assert.equal(is_animated(PNG_SIG), false);
    });

    it('truncated PNG (no chunks after IHDR) is not animated', () => {
        const png = makePNG();
        assert.equal(is_animated(png), false);
    });
});

describe('is_animated — WebP', () => {
    it('WebP with VP8X but no animation flag is not animated', () => {
        assert.equal(is_animated(makeWebP(false)), false);
    });

    it('WebP with VP8X and animation flag is animated', () => {
        assert.equal(is_animated(makeWebP(true)), true);
    });

    it('WebP with ANIM chunk is animated', () => {
        assert.equal(is_animated(makeWebPWithANIM()), true);
    });

    it('WebP without VP8X or ANIM is not animated', () => {
        assert.equal(is_animated(makeWebPWithoutVP8X()), false);
    });

    it('short WebP header (no chunks) is not animated', () => {
        const data = new Uint8Array([...str('RIFF'), 0, 0, 0, 0, ...str('WEBP')]);
        assert.equal(is_animated(data), false);
    });

    it('data shorter than WebP header is not animated', () => {
        assert.equal(is_animated(new Uint8Array([1, 2, 3])), false);
    });

    it('non-RIFF data returns false', () => {
        const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert.equal(is_animated(data), false);
    });
});

describe('is_animated — AVIF', () => {
    it('AVIF without moov/moof is not animated', () => {
        assert.equal(is_animated(makeAVIF(false)), false);
    });

    it('AVIF with moov box is animated', () => {
        assert.equal(is_animated(makeAVIF(true)), true);
    });

    it('AVIF with moof box is animated', () => {
        assert.equal(is_animated(makeAVIFWithMoof()), true);
    });

    it('AVIF with box_size < 8 handles edge case', () => {
        // ftyp with declared size < 8 should break
        const data = new Uint8Array([0, 0, 0, 4, ...str('ftyp')]);
        assert.equal(is_animated(data), false);
    });

    it('empty AVIF-like data is not animated', () => {
        assert.equal(is_animated(new Uint8Array(12)), false);
    });
});

describe('is_animated — edge cases', () => {
    it('empty array is not animated', () => {
        assert.equal(is_animated(new Uint8Array()), false);
    });

    it('null-like data returns false gracefully', () => {
        // @ts-ignore
        assert.throws(() => is_animated(null));
    });

    it('data that matches no format is not animated', () => {
        assert.equal(is_animated(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), false);
    });
});

describe('real file fixtures (encoded by ffmpeg)', () => {

    const files = [
        ['animated.png',              'png',  true,  'APNG (5 frames)'],
        ['animated.webp',             'webp', true,  'Animated WebP (5 frames)'],
        ['animated.avif',             'avif', true,  'Animated AVIF (5 frames)'],
        ['animated-lossless.webp',    'webp', true,  'Animated lossless WebP (5 frames)'],
        ['animated-lossless.avif',    'avif', true,  'Animated lossless AVIF (5 frames)'],
        ['static.png',                'png',  false, 'Static PNG'],
        ['static.webp',               'webp', false, 'Static WebP'],
        ['static.avif',               'avif', false, 'Static AVIF'],
        ['static-lossless.webp',      'webp', false, 'Static lossless WebP'],
        ['static-lossless.avif',      'avif', false, 'Static lossless AVIF'],
    ];

    for (const [filename, expected_format, expected_animated, label] of files) {
        it(`${label} → format=${expected_format}, animated=${expected_animated}`, () => {
            const filepath = path.join(fixtures, filename);
            const data = new Uint8Array(fs.readFileSync(filepath));
            const fmt = detect_format(data);
            const anim = is_animated(data);
            assert.equal(fmt, expected_format, `${filename}: expected format ${expected_format}, got ${fmt}`);
            assert.equal(anim, expected_animated, `${filename}: expected animated=${expected_animated}, got ${anim}`);
        });
    }
});

describe('is_animated — real-world scenario', () => {
    it('first 4KB of a real PNG would be tested', () => {
        const header = makePNG();
        // Pad to 4096 to simulate fetching first 4KB
        const padded = new Uint8Array(4096);
        padded.set(header);
        assert.equal(is_animated(padded), false);
    });

    it('first 4KB of a real APNG would be detected', () => {
        const header = makeAPNG();
        const padded = new Uint8Array(4096);
        padded.set(header);
        assert.equal(is_animated(padded), true);
    });
});
