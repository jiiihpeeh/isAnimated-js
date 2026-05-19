export function compose(...checkers) {
    return function isAnimated(data) {
        for (let i = 0; i < checkers.length; i++) {
            if (checkers[i](data)) return true;
        }
        return false;
    };
}
