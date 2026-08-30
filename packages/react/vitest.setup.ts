// seqviz measures its container; jsdom reports zero for everything, which is fine for a
// mount test but noisy without a stub.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
}
