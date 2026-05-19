export declare const DEFAULT_HEADER_SIZE: 4096;

export type ImageFormat = 'png' | 'gif' | 'webp' | 'avif' | 'jxl';

export function is_animated(data: Uint8Array, formats?: ImageFormat[]): boolean;
export function detect_format(data: Uint8Array): 'png' | 'webp' | 'avif' | 'gif' | 'jxl' | 'unknown';

export function isJXL(data: Uint8Array): boolean;
export function isAPNG(data: Uint8Array): boolean;
export function isAnimatedWebP(data: Uint8Array): boolean;
export function isAnimatedAVIF(data: Uint8Array): boolean;
export function isAnimatedGIF(data: Uint8Array): boolean;
export function isAnimatedJXL(data: Uint8Array): boolean;

export function is_animated_blob(blob: Blob, size?: number, formats?: ImageFormat[]): Promise<boolean>;
export function detect_format_blob(blob: Blob, size?: number): Promise<'png' | 'gif' | 'webp' | 'avif' | 'jxl' | 'unknown'>;
