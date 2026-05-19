export function compose(...checkers: ((data: Uint8Array) => boolean)[]): (data: Uint8Array) => boolean;
