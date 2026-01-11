/**
 * Deno 运行时适配器
 */
import { ICacheAdapter } from "./interfaces/cache-adapter.interface.ts";
import { DenoKVAdapter } from "./storage/deno-kv.adapter.ts";

export class DenoRuntimeAdapter {
  name = "deno";
  private kvCache: ICacheAdapter | null = null;

  constructor(private env: Record<string, string> = {}) {}

  async getKV(): Promise<ICacheAdapter> {
    if (!this.kvCache) {
      const kv = await Deno.openKv();
      this.kvCache = new DenoKVAdapter(kv);
    }
    return this.kvCache;
  }

  getLogger(): typeof console {
    return console;
  }
}
