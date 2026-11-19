// The few extension APIs the Chromium e2e suite calls inside the service worker.
declare const chrome: {
  tabs: { query(query: object): Promise<{ id?: number; url?: string }[]> };
  storage: { session: { set(items: object): Promise<void> } };
};
