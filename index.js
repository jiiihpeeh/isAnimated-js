export { DEFAULT_HEADER_SIZE } from './detect/shared.js';
export { isAPNG } from './detect/png.js';
export { isAnimatedGIF } from './detect/gif.js';
export { isAnimatedWebP } from './detect/webp.js';
export { isAnimatedAVIF } from './detect/avif.js';
export { isJXL, isAnimatedJXL } from './detect/jxl.js';

import { PNG_SIG, DEFAULT_HEADER_SIZE } from './detect/shared.js';
import { isAPNG } from './detect/png.js';
import { isAnimatedGIF } from './detect/gif.js';
import { isAnimatedWebP } from './detect/webp.js';
import { isAnimatedAVIF } from './detect/avif.js';
import { isAnimatedJXL } from './detect/jxl.js';

const FORMAT_CHECKERS = {
    png: isAPNG,
    gif: isAnimatedGIF,
    webp: isAnimatedWebP,
    avif: isAnimatedAVIF,
    jxl: isAnimatedJXL,
};

export function is_animated(data, formats) {
    if (formats) {
        return formats.some(f => f in FORMAT_CHECKERS && FORMAT_CHECKERS[f](data));
    }
    return isAPNG(data) || isAnimatedWebP(data) || isAnimatedAVIF(data) || isAnimatedGIF(data) || isAnimatedJXL(data);
}

export function detect_format(data) {
    if (data.length === 0) return 'unknown';

    const sig2 = data[0] === 0xFF && data[1] === 0x0A;
    if (sig2) return 'jxl';

    if (data.length >= 12) {
        if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x0C &&
            data[4] === 0x4A && data[5] === 0x58 && data[6] === 0x4C && data[7] === 0x20 &&
            data[8] === 0x0D && data[9] === 0x0A && data[10] === 0x87 && data[11] === 0x0A) {
            return 'jxl';
        }
    }

    if (data.length < 6) return 'unknown';

    const sig = String.fromCharCode(data[0], data[1], data[2]);
    const ver = String.fromCharCode(data[3], data[4], data[5]);

    if (sig === 'GIF' && (ver === '87a' || ver === '89a')) return 'gif';

    if (data.length < 12) return 'unknown';

    for (let i = 0; i < 8; i++) {
        if (data[i] !== PNG_SIG[i]) break;
        if (i === 7) return 'png';
    }

    const tag = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const webp = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (tag === 'RIFF' && webp === 'WEBP') return 'webp';

    const ftyp = String.fromCharCode(data[4], data[5], data[6], data[7]);
    if (ftyp === 'ftyp' && data.length >= 12) {
        const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
        if (brand === 'avif' || brand === 'avis') return 'avif';
    }

    return 'unknown';
}

async function headerBytes(blob, size = DEFAULT_HEADER_SIZE) {
    return new Uint8Array(await blob.slice(0, size).arrayBuffer());
}

export async function is_animated_blob(blob, size = DEFAULT_HEADER_SIZE, formats) {
    return is_animated(await headerBytes(blob, size), formats);
}

export async function detect_format_blob(blob, size = DEFAULT_HEADER_SIZE) {
    return detect_format(await headerBytes(blob, size));
}
