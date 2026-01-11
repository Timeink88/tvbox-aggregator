/**
 * 缓存适配器接口
 */
export interface ICacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  setMany<T>(
    entries: Array<{ key: string; value: T; ttl: number }>
  ): Promise<void>;
  clear(pattern?: string): Promise<void>;
}
