export const EPSILON = 1e-6;

export const isZero = (x) => {
    return Math.abs(x) < EPSILON;
};

export const isEqual = (a, b) => {
    return Math.abs(a - b) < EPSILON;
};

export default {
    isZero,
    isEqual
};
