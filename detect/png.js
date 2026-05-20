import { PNG_SIG } from './shared.js';

/**
 * Check if a PNG image is animated (APNG) by looking for an `acTL` chunk.
 *
 * @param {Uint8Array} data - Binary PNG/APNG data.
 * @returns {boolean} `true` if the image is an animated PNG.
 */
export function isAPNG(data) {
    if (data.length < 8) return false;
    for (let i = 0; i < 8; i++) {
        if (data[i] !== PNG_SIG[i]) return false;
    }

    let offset = 8;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    while (offset + 8 <= data.length) {
        const chunk_len = view.getUint32(offset);
        const type = String.fromCharCode(
            data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
        );
        if (type === 'acTL') return true;
        if (type === 'IEND') break;
        offset += 12 + chunk_len;
    }
    return false;
}
