import NodeCache from "node-cache";

interface CacheOptions {
  successTTL?: number; // TTL in seconds, 0 = never expire
  errorTTL?: number; // TTL in seconds for errors
  maxKeys?: number; // Max keys for success cache
  maxErrorKeys?: number; // Max keys for error cache
  isCacheableError?: (error: Error) => boolean; // Function to determine if error should be cached
}

/**
 * Generic caching utility with request deduplication and error caching
 */
export class ApiCache<T> {
  private successCache: NodeCache;
  private errorCache: NodeCache;
  private inFlightRequests = new Map<string, Promise<T>>();
  private isCacheableError: (error: Error) => boolean;

  constructor(options: CacheOptions = {}) {
    const {
      successTTL = 0, // Never expire by default
      errorTTL = 5 * 60, // 5 minutes for errors
      maxKeys = 10000,
      maxErrorKeys = 1000,
      isCacheableError = () => true, // Cache all errors by default
    } = options;

    this.successCache = new NodeCache({
      stdTTL: successTTL,
      maxKeys,
      useClones: false,
    });
    this.errorCache = new NodeCache({
      stdTTL: errorTTL,
      maxKeys: maxErrorKeys,
      useClones: false,
    });

    this.isCacheableError = isCacheableError;
  }

  /**
   * Get or fetch data with caching and request deduplication
   */
  async getOrFetch(key: string, fetchFn: () => Promise<T>): Promise<T> {
    // Check success cache first
    const cached = this.successCache.get<T>(key);
    if (cached) {
      console.log(`Cache hit: ${key}`);
      return cached;
    }

    // Check error cache (negative caching)
    const cachedError = this.errorCache.get<Error>(key);
    if (cachedError) {
      console.log(`Error cache hit: ${key}`);
      throw cachedError;
    }

    // Check if there's already an in-flight request for this key (race condition fix)
    // Check and set atomically to prevent race conditions
    let inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      console.log(`In-flight request: ${key}`);
      return inFlight;
    }

    // Create new request and track it
    // Set it immediately to prevent other concurrent requests from creating duplicates
    const requestPromise = (async () => {
      try {
        const data = await fetchFn();

        // Store in cache
        this.successCache.set(key, data);

        // Clear any previous error for this key
        this.errorCache.del(key);

        return data;
      } catch (error) {
        console.error(`Error caching: ${key}`, error);

        // Cache the error if it's cacheable
        if (this.isCacheableError(error as Error)) {
          this.errorCache.set(key, error);
        }

        // Always re-throw the error
        throw error;
      } finally {
        // Remove from in-flight tracking once done (success or failure)
        this.inFlightRequests.delete(key);
      }
    })();

    // Track the in-flight request IMMEDIATELY (before await) to prevent race conditions
    // This ensures concurrent requests see this promise
    this.inFlightRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Clear cache entry for a specific key (both success and error cache)
   */
  clear(key: string): void {
    this.successCache.del(key);
    this.errorCache.del(key);
  }

  /**
   * Clear entire cache (both success and error cache)
   */
  clearAll(): void {
    this.successCache.flushAll();
    this.errorCache.flushAll();
  }

  /**
   * Get current success cache size (useful for monitoring)
   */
  getSize(): number {
    return this.successCache.keys().length;
  }

  /**
   * Get current error cache size (useful for monitoring)
   */
  getErrorSize(): number {
    return this.errorCache.keys().length;
  }
}
