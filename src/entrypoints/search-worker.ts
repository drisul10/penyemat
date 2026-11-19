import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { startSearchWorker } from '../workers/search.worker';

// Built to /search-worker.js and started with `new Worker(...)` by the library page.
export default defineUnlistedScript(() => startSearchWorker());
