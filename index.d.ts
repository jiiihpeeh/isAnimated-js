/**
 * Detect whether an image is animated by inspecting its binary header.
 * Supports APNG, animated WebP, and animated AVIF.
 *
 * @param data - The first few KB of the image file as a Uint8Array
 * @returns `true` if the image has multiple frames (is animated)
 */
export function is_animated(data: Uint8Array): boolean;

/**
 * Detect the image format from its binary header.
 *
 * @param data - The first few KB of the image file as a Uint8Array
 * @returns The detected format: "png", "webp", "avif", or "unknown"
 */
export function detect_format(data: Uint8Array): 'png' | 'webp' | 'avif' | 'unknown';
