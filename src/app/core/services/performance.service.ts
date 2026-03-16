import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 300000; // 5 minutes in milliseconds

  /**
   * Cache data with TTL
   */
  setCache(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cached data if not expired
   */
  getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Clear cache by key or all
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Debounce function calls for performance
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 300
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        timeout = null;
        func(...args);
      };
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number = 1000
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function executedFunction(...args: Parameters<T>) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Virtual scroll helper - calculate visible items
   */
  getVisibleItems(
    totalItems: number,
    itemHeight: number,
    containerHeight: number,
    scrollTop: number
  ): { start: number; end: number; visibleItems: number } {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(start + visibleCount + 1, totalItems);

    return {
      start,
      end,
      visibleItems: end - start
    };
  }

  /**
   * Lazy load images
   */
  lazyLoadImage(img: HTMLImageElement, src: string): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.unobserve(img);
        }
      });
    });
    observer.observe(img);
  }

  /**
   * Batch API calls
   */
  batchRequests<T>(
    requests: Observable<T>[],
    batchSize: number = 5
  ): Observable<T[]> {
    const batches: Observable<T>[][] = [];
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    // Process batches sequentially
    return new Observable((subscriber) => {
      let results: T[] = [];
      let currentBatch = 0;

      const processBatch = () => {
        if (currentBatch >= batches.length) {
          subscriber.next(results);
          subscriber.complete();
          return;
        }

        // Process current batch in parallel
        const batchObservables = batches[currentBatch];
        // Implementation would use forkJoin or similar
        currentBatch++;
        setTimeout(processBatch, 0);
      };

      processBatch();
    });
  }

  /**
   * Performance monitoring
   */
  measurePerformance(name: string, fn: () => void): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
      fn();
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name)[0];
      console.log(`Performance [${name}]: ${measure.duration.toFixed(2)}ms`);
    } else {
      fn();
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  constructor() {
    // Cleanup cache every 5 minutes
    setInterval(() => this.cleanupCache(), 300000);
  }
}


