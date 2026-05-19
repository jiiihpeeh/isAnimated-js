export const DEFAULT_HEADER_SIZE = 4096;

export const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export function matchSig(data, sig) {
    if (data.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
        if (data[i] !== sig[i]) return false;
    }
    return true;
}

export function readJXLBits(data, byteStart, bitStart, numBits) {
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

export async function headerBytes(blob, size = DEFAULT_HEADER_SIZE) {
    return new Uint8Array(await blob.slice(0, size).arrayBuffer());
}
