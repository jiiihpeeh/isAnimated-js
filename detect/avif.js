/**
 * Check if an AVIF image is animated.
 *
 * Looks for `moov` or `moof` boxes in the ISOBMFF structure.
 *
 * @param {Uint8Array} data - Binary AVIF data.
 * @returns {boolean} `true` if the image is an animated AVIF.
 */
export function isAnimatedAVIF(data) {
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
