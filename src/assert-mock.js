export function deepStrictEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error('Not equal length');
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) throw new Error('Not equal elements');
    }
    return;
  }
  if (a !== b) throw new Error('Not equal values');
}

export default {
  deepStrictEqual
};
