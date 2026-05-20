import { readJXLBits } from './shared.js';

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
