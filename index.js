export const DEFAULT_HEADER_SIZE = 4096;

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function matchSig(data, sig) {
    if (data.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
        if (data[i] !== sig[i]) return false;
    }
    return true;
}

function readJXLBits(data, byteStart, bitStart, numBits) {
    let result = 0;
    for (let i = 0; i < numBits; i++) {
        const byteIdx = byteStart + ((bitStart + i) >>> 3);
        const bitIdx = (bitStart + i) & 7;
        if (byteIdx < data.length) {
            result |= ((data[byteIdx] >>> bitIdx) & 1) << i;
        }
    }
    return result;
}

function isJXLRawAnimated(data) {
    if (data.length < 4) return false;
    let boff = 0;

    const small = readJXLBits(data, 2, boff, 1); boff += 1;
    if (small) {
        readJXLBits(data, 2, boff, 5); boff += 5;
        const ratio = readJXLBits(data, 2, boff, 3); boff += 3;
        if (ratio === 0) {
            readJXLBits(data, 2, boff, 5); boff += 5;
        }
    } else {
        const ysel = readJXLBits(data, 2, boff, 2); boff += 2;
        const bits = [9, 13, 18, 30];
        readJXLBits(data, 2, boff, bits[ysel]); boff += bits[ysel];
        const ratio = readJXLBits(data, 2, boff, 3); boff += 3;
        if (ratio === 0) {
            const xsel = readJXLBits(data, 2, boff, 2); boff += 2;
            readJXLBits(data, 2, boff, bits[xsel]); boff += bits[xsel];
        }
    }

    const allDefault = readJXLBits(data, 2, boff, 1); boff += 1;
    if (allDefault) return false;

    const extraFields = readJXLBits(data, 2, boff, 1); boff += 1;
    if (!extraFields) return false;

    readJXLBits(data, 2, boff, 3); boff += 3;
    readJXLBits(data, 2, boff, 1); boff += 1;
    readJXLBits(data, 2, boff, 1); boff += 1;
    return readJXLBits(data, 2, boff, 1) === 1;
}

function isJXLContainerAnimated(data) {
    if (data.length < 20) return false;
    let offset = 12;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let jxlpCount = 0;

    while (offset + 12 <= data.length) {
        const boxSize = view.getUint32(offset);
        if (boxSize < 8) break;
        const boxType = String.fromCharCode(
            data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
        );

        if (boxType === 'jxlp') {
            jxlpCount++;
            if (jxlpCount >= 2) return true;
        } else if (boxType === 'jxlc') {
            const payloadLen = Math.min(boxSize - 8, data.length - offset - 8);
            if (payloadLen >= 4) {
                const payload = data.subarray(offset + 8, offset + 8 + payloadLen);
                return isJXLRawAnimated(payload);
            }
            return false;
        }

        if (boxSize === 0) break;
        offset += boxSize;
    }
    return jxlpCount >= 2;
}

export function isJXL(data) {
    if (data.length < 2) return false;
    if (data[0] === 0xFF && data[1] === 0x0A) return true;
    if (data.length >= 12) {
        if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x0C &&
            data[4] === 0x4A && data[5] === 0x58 && data[6] === 0x4C && data[7] === 0x20 &&
            data[8] === 0x0D && data[9] === 0x0A && data[10] === 0x87 && data[11] === 0x0A) {
            return true;
        }
    }
    return false;
}

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

export function isAnimatedJXL(data) {
    if (data.length < 2) return false;

    if (data[0] === 0xFF && data[1] === 0x0A) {
        return isJXLRawAnimated(data);
    }

    if (data.length >= 12) {
        if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x0C &&
            data[4] === 0x4A && data[5] === 0x58 && data[6] === 0x4C && data[7] === 0x20 &&
            data[8] === 0x0D && data[9] === 0x0A && data[10] === 0x87 && data[11] === 0x0A) {
            return isJXLContainerAnimated(data);
        }
    }

    return false;
}

export function is_animated(data) {
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

export async function is_animated_blob(blob, size = DEFAULT_HEADER_SIZE) {
    return is_animated(await headerBytes(blob, size));
}

export async function detect_format_blob(blob, size = DEFAULT_HEADER_SIZE) {
    return detect_format(await headerBytes(blob, size));
}
