import { readJXLBits } from './shared.js';

/**
 * Parse a raw JXL codestream header and check the animation flag.
 *
 * The animation flag is located at a specific bit position in the header's
 * extra-fields section.
 *
 * @param {Uint8Array} data - Raw JXL codestream bytes (not container-wrapped).
 * @returns {boolean} `true` if the codestream has animation enabled.
 */
function isJXLRawAnimated(data) {
    if (data.length < 4) return false;
    if (data[0] !== 0xFF || data[1] !== 0x0A) return false;

    const HEADER_START = 2;
    let boff = 0;

    /**
     * Checks if there are enough bits remaining to read.
     * @param {number} n - Number of bits to check for.
     * @returns {boolean} True if enough bits are available, false otherwise.
     */
    const needBits = (n) => {
        if (boff + n > (data.length - HEADER_START) * 8) return false;
        return true;
    };

    if (!needBits(1)) return false;
    const small = readJXLBits(data, HEADER_START, boff, 1); boff += 1;
    if (small) {
        if (!needBits(5)) return false;
        readJXLBits(data, HEADER_START, boff, 5); boff += 5;
        if (!needBits(3)) return false;
        const ratio = readJXLBits(data, HEADER_START, boff, 3); boff += 3;
        if (ratio === 0) {
            if (!needBits(5)) return false;
            readJXLBits(data, HEADER_START, boff, 5); boff += 5;
        }
    } else {
        if (!needBits(2)) return false;
        const ysel = readJXLBits(data, HEADER_START, boff, 2); boff += 2;
        const bits = [9, 13, 18, 30];
        if (!needBits(bits[ysel])) return false;
        readJXLBits(data, HEADER_START, boff, bits[ysel]); boff += bits[ysel];
        if (!needBits(3)) return false;
        const ratio = readJXLBits(data, HEADER_START, boff, 3); boff += 3;
        if (ratio === 0) {
            if (!needBits(2)) return false;
            const xsel = readJXLBits(data, HEADER_START, boff, 2); boff += 2;
            if (!needBits(bits[xsel])) return false;
            readJXLBits(data, HEADER_START, boff, bits[xsel]); boff += bits[xsel];
        }
    }

    if (!needBits(1)) return false;
    const allDefault = readJXLBits(data, HEADER_START, boff, 1); boff += 1;
    if (allDefault) return false;

    if (!needBits(1)) return false;
    const extraFields = readJXLBits(data, HEADER_START, boff, 1); boff += 1;
    if (!extraFields) return false;

    if (!needBits(6)) return false;
    readJXLBits(data, HEADER_START, boff, 3); boff += 3;
    readJXLBits(data, HEADER_START, boff, 1); boff += 1;
    readJXLBits(data, HEADER_START, boff, 1); boff += 1;
    return readJXLBits(data, HEADER_START, boff, 1) === 1;
}

/**
 * Extract the raw JXL codestream from a container-format JXL file.
 *
 * Handles `jxlc` (single-box) and `jxlp` (chunked) payloads per the
 * ISO/IEC 18181-2 container spec.
 *
 * @param {Uint8Array} data - Binary JXL container data (starts with JXL signature).
 * @returns {Uint8Array|null} The raw codestream, or `null` if it could not be extracted.
 */
function extractJXLCodestream(data) {
    if (data.length < 12) return null;

    const sig = String.fromCharCode(data[4], data[5], data[6], data[7]);
    if (sig !== 'JXL ') return null;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 12;
    const chunks = [];

    while (offset + 8 <= data.length) {
        let boxSize = view.getUint32(offset);
        const boxType = String.fromCharCode(
            data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
        );

        let headerSize = 8;
        if (boxSize === 0) {
            boxSize = data.length - offset;
        } else if (boxSize === 1) {
            if (offset + 16 > data.length) break;
            const hi = view.getUint32(offset + 8);
            const lo = view.getUint32(offset + 12);
            const bigSize = (BigInt(hi) << 32n) | BigInt(lo);
            if (bigSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
            boxSize = Number(bigSize);
            if (boxSize < 16) break;
            headerSize = 16;
        } else if (boxSize < 8) {
            break;
        }

        if (boxSize < headerSize || offset + boxSize > data.length) break;

        const payloadStart = offset + headerSize;
        const payloadEnd = offset + boxSize;
        const payloadLen = payloadEnd - payloadStart;

        if (boxType === 'jxlc' && payloadLen > 0) {
            return data.subarray(payloadStart, payloadEnd);
        }

        if (boxType === 'jxlp' && payloadLen > 4) {
            const index = view.getUint32(payloadStart);
            chunks.push({ index, data: data.subarray(payloadStart + 4, payloadEnd) });
        }

        offset += boxSize;
    }

    if (chunks.length === 0) return null;

    chunks.sort((a, b) => a.index - b.index);

    const totalLen = chunks.reduce((a, c) => a + c.data.length, 0);
    const merged = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
        merged.set(c.data, pos);
        pos += c.data.length;
    }
    return merged;
}

/**
 * Check whether binary data represents a JXL image (raw codestream or container).
 *
 * @param {Uint8Array} data - Binary image data.
 * @returns {boolean} `true` if the data matches a JXL signature.
 */
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

/**
 * Check if a JXL image is animated.
 *
 * Supports both raw codestream (`FF 0A`) and container (`JXL `) formats.
 *
 * @param {Uint8Array} data - Binary JXL data.
 * @returns {boolean} `true` if the image is an animated JXL.
 */
export function isAnimatedJXL(data) {
    if (data.length < 2) return false;

    if (data[0] === 0xFF && data[1] === 0x0A) {
        return isJXLRawAnimated(data);
    }

    const codestream = extractJXLCodestream(data);
    if (codestream) {
        return isJXLRawAnimated(codestream);
    }

    return false;
}
