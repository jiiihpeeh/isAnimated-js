/** Default number of header bytes to read for blob-based detection. */
export const DEFAULT_HEADER_SIZE = 4096;

/** PNG magic signature bytes: `\x89PNG\r\n\x1a\n`. */
export const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Check whether binary data starts with a given signature.
 * @param {Uint8Array} data - Binary image data.
 * @param {Uint8Array} sig - Signature bytes to match.
 * @returns {boolean} `true` if `data` starts with `sig`.
 */
export function matchSig(data, sig) {
    if (data.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
        if (data[i] !== sig[i]) return false;
    }
    return true;
}

/**
 * Read a range of bits from a JXL codestream (little-endian bit packing).
 * @param {Uint8Array} data - Binary JXL data.
 * @param {number} byteStart - Start byte offset within `data`.
 * @param {number} bitStart - Start bit offset within the first byte.
 * @param {number} numBits - Number of bits to read.
 * @returns {number} The bits as an unsigned integer.
 */
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

/**
 * Read the first `size` bytes of a `Blob` as a `Uint8Array`.
 * @param {Blob} blob - The image blob.
 * @param {number} [size=4096] - Number of bytes to read.
 * @returns {Promise<Uint8Array>} The header bytes.
 */
export async function headerBytes(blob, size = DEFAULT_HEADER_SIZE) {
    return new Uint8Array(await blob.slice(0, size).arrayBuffer());
}
