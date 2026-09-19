import type { LeaderboardEntry, RankedRun } from './ranked-types';

export class RankedApiError extends Error {
  constructor(public code: string) { super(code); }
}
export async function rankedRequest(body: Record<string, unknown>): Promise<RankedRun> {
  return request<RankedRun>('', body);
}
export async function leaderboard(period: 'today' | 'all') {
  return request<{ entries: LeaderboardEntry[]; updatedAt: string }>(`?period=${period}`);
}
async function request<T>(query: string, body?: Record<string, unknown>): Promise<T> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/raid${query}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new RankedApiError('unavailable');
    const result = await response.json();
    if (!response.ok) throw new RankedApiError(result.error ?? 'unavailable');
    return result as T;
  } catch (error) {
    if (error instanceof RankedApiError) throw error;
    throw new RankedApiError('unavailable');
  }
}
