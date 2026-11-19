import { browser } from 'wxt/browser';
import type { LockState, ResultHit, WorkerEvent, WorkerRequest } from '../../lib/search/protocol';

// Talks to the search worker. Requests that need an answer get an id and a promise.

export interface ClientHandlers {
  onStatus: (ready: boolean, building: { done: number; total: number } | null, failed?: string) => void;
  onResults: (id: number, query: string, hits: ResultHit[]) => void;
  onLockState: (lock: LockState) => void;
}

type Ask = Exclude<WorkerRequest, { type: 'init' } | { type: 'search' } | { type: 'lock' }>;
type AskWithoutId = Ask extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

export class ReplyError extends Error {}

export class SearchClient {
  private worker: Worker;
  private nextId = 1;
  private waiting = new Map<number, { resolve: (data: unknown) => void; reject: (error: Error) => void }>();

  constructor(private handlers: ClientHandlers) {
    this.worker = new Worker(browser.runtime.getURL('/search-worker.js'));
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => this.receive(event.data);
    this.worker.onerror = () => handlers.onStatus(false, null, 'worker-error');
    this.post({ type: 'init' });
  }

  private post(request: WorkerRequest) {
    this.worker.postMessage(request);
  }

  private receive(event: WorkerEvent) {
    if (event.type === 'status') this.handlers.onStatus(event.ready, event.building, event.failed);
    else if (event.type === 'results') this.handlers.onResults(event.id, event.query, event.hits);
    else if (event.type === 'lock-state') this.handlers.onLockState(event.lock);
    else if (event.type === 'reply') {
      const waiter = this.waiting.get(event.id);
      this.waiting.delete(event.id);
      if (!waiter) return;
      if (event.ok) waiter.resolve(event.data);
      else waiter.reject(new ReplyError(event.error ?? 'failed'));
    }
  }

  search(query: string): number {
    const id = this.nextId++;
    this.post({ type: 'search', id, query });
    return id;
  }

  lock() {
    this.post({ type: 'lock' });
  }

  ask<T = unknown>(request: AskWithoutId): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (data: unknown) => void, reject });
      this.post({ ...request, id } as WorkerRequest);
    });
  }

  restart() {
    this.worker.terminate();
    for (const waiter of this.waiting.values()) waiter.reject(new ReplyError('restarted'));
    this.waiting.clear();
    this.worker = new Worker(browser.runtime.getURL('/search-worker.js'));
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => this.receive(event.data);
    this.post({ type: 'init' });
  }
}
