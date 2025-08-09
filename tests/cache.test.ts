import { CacheService } from '../src/services/cache'

describe('CacheService', () => {
  let cache: CacheService

  beforeEach(() => {
    cache = new CacheService()
  })

  afterEach(() => {
    cache.clear()
  })

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('test-key', 'test-value')
      const value = cache.get('test-key')
      expect(value).toBe('test-value')
    })

    it('should return null for non-existent keys', () => {
      const value = cache.get('non-existent')
      expect(value).toBeNull()
    })

    it('should delete values', () => {
      cache.set('test-key', 'test-value')
      const deleted = cache.delete('test-key')
      expect(deleted).toBe(true)
      expect(cache.get('test-key')).toBeNull()
    })

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('non-existent')
      expect(deleted).toBe(false)
    })

    it('should clear all values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should expire values after TTL', async () => {
      cache.set('test-key', 'test-value', 50) // 50ms TTL
      expect(cache.get('test-key')).toBe('test-value')
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60))
      expect(cache.get('test-key')).toBeNull()
    })

    it('should use default TTL when not specified', () => {
      cache.set('test-key', 'test-value')
      const stats = cache.getStats()
      expect(stats.size).toBe(1)
    })

    it('should not expire values before TTL', async () => {
      cache.set('test-key', 'test-value', 100) // 100ms TTL
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(cache.get('test-key')).toBe('test-value')
    })
  })

  describe('Statistics', () => {
    it('should return correct stats', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      
      const stats = cache.getStats()
      expect(stats.size).toBe(2)
      expect(stats.keys).toContain('key1')
      expect(stats.keys).toContain('key2')
      expect(typeof stats.memoryUsage).toBe('number')
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })

    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats()
      expect(stats.size).toBe(0)
      expect(stats.keys).toEqual([])
      expect(stats.memoryUsage).toBeGreaterThan(0) // JSON.stringify('[]') has some size
    })
  })

  describe('Cleanup', () => {
    it('should clean up expired entries', async () => {
      cache.set('key1', 'value1', 50) // 50ms TTL
      cache.set('key2', 'value2', 200) // 200ms TTL
      
      // Wait for first key to expire
      await new Promise(resolve => setTimeout(resolve, 60))
      
      const cleaned = cache.cleanup()
      expect(cleaned).toBe(1)
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
    })

    it('should return 0 when no entries to clean', () => {
      cache.set('key1', 'value1', 1000) // Long TTL
      const cleaned = cache.cleanup()
      expect(cleaned).toBe(0)
    })
  })

  describe('Get or Set Pattern', () => {
    it('should return cached value if exists', async () => {
      cache.set('test-key', 'cached-value')
      
      const mockFn = jest.fn().mockResolvedValue('new-value')
      const result = await cache.getOrSet('test-key', mockFn)
      
      expect(result).toBe('cached-value')
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should execute function and cache result if not exists', async () => {
      const mockFn = jest.fn().mockResolvedValue('new-value')
      const result = await cache.getOrSet('test-key', mockFn)
      
      expect(result).toBe('new-value')
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(cache.get('test-key')).toBe('new-value')
    })

    it('should use custom TTL in getOrSet', async () => {
      const mockFn = jest.fn().mockResolvedValue('new-value')
      await cache.getOrSet('test-key', mockFn, 50) // 50ms TTL
      
      expect(cache.get('test-key')).toBe('new-value')
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60))
      expect(cache.get('test-key')).toBeNull()
    })
  })

  describe('Tagged Cache', () => {
    it('should set values with tags', () => {
      cache.setWithTags('key1', 'value1', ['tag1', 'tag2'])
      cache.setWithTags('key2', 'value2', ['tag1'])
      cache.setWithTags('key3', 'value3', ['tag2'])
      
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
    })

    it('should invalidate by tag', () => {
      cache.setWithTags('key1', 'value1', ['tag1', 'tag2'])
      cache.setWithTags('key2', 'value2', ['tag1'])
      cache.setWithTags('key3', 'value3', ['tag2'])
      
      const invalidated = cache.invalidateTag('tag1')
      expect(invalidated).toBe(2) // key1 and key2
      
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
      expect(cache.get('key3')).toBe('value3') // Still exists
    })

    it('should return 0 when invalidating non-existent tag', () => {
      const invalidated = cache.invalidateTag('non-existent')
      expect(invalidated).toBe(0)
    })
  })

  describe('Static Key Generators', () => {
    it('should generate client key', () => {
      const key = CacheService.clientKey('client123', 'profile')
      expect(key).toBe('client:client123:profile')
    })

    it('should generate projection key', () => {
      const params = { annualRate: 0.04, initialValue: 10000 }
      const key = CacheService.projectionKey('client123', params)
      expect(key).toContain('projection:client123:')
      expect(key.length).toBeGreaterThan(20) // Should include base64 encoded params
    })

    it('should generate suggestion key', () => {
      const key = CacheService.suggestionKey('client123')
      expect(key).toBe('suggestions:client123')
    })

    it('should generate insurance key', () => {
      const key = CacheService.insuranceKey('client123')
      expect(key).toBe('insurance:client123:summary')
    })

    it('should generate different projection keys for different params', () => {
      const params1 = { annualRate: 0.04 }
      const params2 = { annualRate: 0.05 }
      
      const key1 = CacheService.projectionKey('client123', params1)
      const key2 = CacheService.projectionKey('client123', params2)
      
      expect(key1).not.toBe(key2)
    })

    it('should generate same projection key for same params', () => {
      const params1 = { annualRate: 0.04, initialValue: 10000 }
      const params2 = { annualRate: 0.04, initialValue: 10000 }
      
      const key1 = CacheService.projectionKey('client123', params1)
      const key2 = CacheService.projectionKey('client123', params2)
      
      expect(key1).toBe(key2)
    })
  })

  describe('Complex Data Types', () => {
    it('should handle objects', () => {
      const obj = { name: 'test', value: 123, nested: { prop: 'value' } }
      cache.set('object-key', obj)
      const retrieved = cache.get('object-key')
      expect(retrieved).toEqual(obj)
    })

    it('should handle arrays', () => {
      const arr = [1, 2, 3, { name: 'test' }]
      cache.set('array-key', arr)
      const retrieved = cache.get('array-key')
      expect(retrieved).toEqual(arr)
    })

    it('should handle null and undefined', () => {
      cache.set('null-key', null)
      cache.set('undefined-key', undefined)
      
      expect(cache.get('null-key')).toBeNull()
      expect(cache.get('undefined-key')).toBeUndefined()
    })

    it('should handle boolean values', () => {
      cache.set('true-key', true)
      cache.set('false-key', false)
      
      expect(cache.get('true-key')).toBe(true)
      expect(cache.get('false-key')).toBe(false)
    })

    it('should handle numbers', () => {
      cache.set('number-key', 42.5)
      cache.set('zero-key', 0)
      cache.set('negative-key', -123)
      
      expect(cache.get('number-key')).toBe(42.5)
      expect(cache.get('zero-key')).toBe(0)
      expect(cache.get('negative-key')).toBe(-123)
    })
  })
})
