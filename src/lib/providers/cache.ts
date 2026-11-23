const memo = new Map<string, { t: number; v: unknown }>();

/** Cache em memória do servidor (importante no football-data.org: só 10 requisições/minuto no plano grátis). */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const v = await fn();
  memo.set(key, { t: Date.now(), v });
  return v;
}
