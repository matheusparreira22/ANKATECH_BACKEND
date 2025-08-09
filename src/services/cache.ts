/**
 * Simple in-memory cache service for performance optimization
 */
export class CacheService {
  private cache = new Map<string, { data: any; expires: number }>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  /**
   * Set value in cache
   */
  set(key: string, data: any, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { data, expires })
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    keys: string[]
    memoryUsage: number
  } {
    const keys = Array.from(this.cache.keys())
    const memoryUsage = JSON.stringify(Array.from(this.cache.entries())).length

    return {
      size: this.cache.size,
      keys,
      memoryUsage
    }
  }

  /**
   * Clean expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get or set pattern - if key exists return it, otherwise execute function and cache result
   */
  async getOrSet<T>(
    key: string, 
    fn: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key)
    
    if (cached !== null) {
      return cached
    }

    const result = await fn()
    this.set(key, result, ttl)
    return result
  }

  /**
   * Cache with tags for group invalidation
   */
  private tags = new Map<string, Set<string>>()

  setWithTags(key: string, data: any, tags: string[], ttl?: number): void {
    this.set(key, data, ttl)
    
    // Associate key with tags
    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set())
      }
      this.tags.get(tag)!.add(key)
    }
  }

  /**
   * Invalidate all keys with specific tag
   */
  invalidateTag(tag: string): number {
    const keys = this.tags.get(tag)
    if (!keys) return 0

    let invalidated = 0
    for (const key of keys) {
      if (this.cache.delete(key)) {
        invalidated++
      }
    }

    this.tags.delete(tag)
    return invalidated
  }

  /**
   * Generate cache key for client-specific data
   */
  static clientKey(clientId: string, suffix: string): string {
    return `client:${clientId}:${suffix}`
  }

  /**
   * Generate cache key for projection data
   */
  static projectionKey(clientId: string, params: any): string {
    const paramsHash = JSON.stringify(params)
    return `projection:${clientId}:${Buffer.from(paramsHash).toString('base64')}`
  }

  /**
   * Generate cache key for suggestions
   */
  static suggestionKey(clientId: string): string {
    return `suggestions:${clientId}`
  }

  /**
   * Generate cache key for insurance summary
   */
  static insuranceKey(clientId: string): string {
    return `insurance:${clientId}:summary`
  }
}

// Global cache instance
export const cache = new CacheService()

// Cleanup expired entries every 10 minutes (only in production)
let cleanupInterval: NodeJS.Timeout | null = null

if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(() => {
    const cleaned = cache.cleanup()
    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`)
    }
  }, 10 * 60 * 1000)
}

// Export cleanup function for testing
export const stopCacheCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}
