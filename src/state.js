// Tiny shared state + event bus. No framework at this size keeps things fast.
const handlers = new Map();

export const store = {
  signedIn: false,
  // { rootId, folders: {id: entry}, files: {id: entry}, childrenOf: {folderId: [{kind, id}]}, builtAt }
  tree: null,
  rootFolderId: null,
  currentFolderId: null,
  currentFile: null,
  expanded: new Set(),
  syncing: false,
  aiOpen: false,
  mobilePane: 'tree' // 'tree' | 'list' | 'viewer'
};

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event)?.delete(fn);
}

export function emit(event, detail) {
  handlers.get(event)?.forEach((fn) => {
    try {
      fn(detail);
    } catch (err) {
      console.error(`[bus:${event}]`, err);
    }
  });
}
