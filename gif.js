export function isAnimatedGIF(data) {
    if (data.length < 14) return false;

    const sig = String.fromCharCode(data[0], data[1], data[2]);
    const ver = String.fromCharCode(data[3], data[4], data[5]);
    if (sig !== 'GIF' || (ver !== '87a' && ver !== '89a')) return false;

    let offset = 13;

    const packed = data[10];
    const gct_size = packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
    offset += gct_size;

    let frames = 0;
    while (offset < data.length) {
        const block = data[offset];
        if (block === 0x3B) break;

        if (block === 0x2C) {
            frames++;
            if (frames >= 2) return true;
            offset += 10;
            if (offset < data.length) {
                const lct_packed = data[offset - 1];
                const lct_size = lct_packed & 0x80 ? 3 * (1 << ((lct_packed & 0x07) + 1)) : 0;
                offset += lct_size;
            }
            if (offset < data.length) {
                offset += 1;
                while (offset < data.length) {
                    const sb_size = data[offset];
                    if (sb_size === 0) { offset += 1; break; }
                    offset += 1 + sb_size;
                }
            }
        } else if (block === 0x21) {
            offset += 2;
            while (offset < data.length) {
                const sb_size = data[offset];
                if (sb_size === 0) { offset += 1; break; }
                offset += 1 + sb_size;
            }
        } else {
            break;
        }
    }
    return false;
}
