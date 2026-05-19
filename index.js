const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function isAPNG(data) {
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

/**
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function isAnimatedWebP(data) {
    if (data.length < 12) return false;
    const tag = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const webp = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (tag !== 'RIFF' || webp !== 'WEBP') return false;

    let offset = 12;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    while (offset + 8 <= data.length) {
        const chunk_id = String.fromCharCode(
            data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
        );
        const chunk_size = view.getUint32(offset + 4, true);

        if (chunk_id === 'VP8X' && offset + 12 <= data.length) {
            return (data[offset + 8] & 0x02) !== 0;
        }
        if (chunk_id === 'ANIM') return true;

        offset += 8 + chunk_size;
        if (chunk_size % 2 !== 0) offset += 1;
    }
    return false;
}

/**
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function isAnimatedAVIF(data) {
    if (data.length < 12) return false;

    let offset = 0;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    while (offset + 8 <= data.length) {
        const box_size = view.getUint32(offset);
        if (box_size < 8) break;

        const box_type = String.fromCharCode(
            data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
        );
        if (box_type === 'moov' || box_type === 'moof') return true;
        if (box_size === 0) break;
        offset += box_size;
    }
    return false;
}

/**
 * Detect whether an image is animated by inspecting its binary header.
 * Supports APNG, animated WebP, and animated AVIF.
 *
 * @param {Uint8Array} data - The first few KB of the image file
 * @returns {boolean} `true` if the image has multiple frames (is animated)
 */
export function is_animated(data) {
    return isAPNG(data) || isAnimatedWebP(data) || isAnimatedAVIF(data);
}

/**
 * Detect the image format from its binary header.
 *
 * @param {Uint8Array} data - The first few KB of the image file
 * @returns {'png'|'webp'|'avif'|'unknown'}
 */
export function detect_format(data) {
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
