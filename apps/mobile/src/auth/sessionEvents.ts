type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

export function subscribeToSessionExpiry(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionExpired(): void {
  listeners.forEach((listener) => listener());
}
