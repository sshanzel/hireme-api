/**
 * IP-based rate limiting for WebSocket connections.
 * Prevents bypass by reconnecting since limits are tied to IP, not connection.
 */

interface RateLimitEntry {
  timestamps: number[];
  lastCleanup: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

class IpRateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  isRateLimited(ip: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry) {
      this.store.set(ip, {timestamps: [now], lastCleanup: now});
      return false;
    }

    // Filter timestamps within window
    entry.timestamps = entry.timestamps.filter(ts => now - ts < config.windowMs);
    entry.lastCleanup = now;

    if (entry.timestamps.length >= config.maxRequests) {
      return true;
    }

    entry.timestamps.push(now);
    return false;
  }

  private cleanup(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [ip, entry] of this.store) {
      if (now - entry.lastCleanup > staleThreshold) {
        this.store.delete(ip);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance for bio chat (public endpoint - strict limits)
export const bioChatRateLimiter = new IpRateLimitStore();

// Rate limit configs
export const BIO_CHAT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 messages per minute per IP
};

// Helper function for checking rate limits
export function isBioChatRateLimited(ip: string): boolean {
  return bioChatRateLimiter.isRateLimited(ip, BIO_CHAT_RATE_LIMIT);
}
