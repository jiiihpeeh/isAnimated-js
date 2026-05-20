export function isAnimatedWebP(data) {
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
