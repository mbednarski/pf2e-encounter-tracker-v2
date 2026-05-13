import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// JSDOM doesn't implement Element.prototype.animate, but Svelte transitions
// (fly/fade) call it. Stub it with a no-op Animation-shaped object so
// components that opt into transitions can render in tests.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = function animate() {
    return {
      cancel() {},
      finish() {},
      pause() {},
      play() {},
      reverse() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      onfinish: null,
      oncancel: null,
      currentTime: 0,
      playState: 'finished',
      playbackRate: 1
    } as unknown as Animation;
  };
}
