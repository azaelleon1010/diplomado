import { describe, expect, it, vi } from 'vitest';
import { notifySessionExpired, subscribeToSessionExpiry } from './sessionEvents';

describe('session expiry notifications', () => {
  it('notifies active auth contexts and allows unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionExpiry(listener);

    notifySessionExpired();
    unsubscribe();
    notifySessionExpired();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
