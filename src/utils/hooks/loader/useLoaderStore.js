import { create } from 'zustand';
import { process } from './utils';
import { createId } from '/src/utils/id';

const BROWSER_HISTORY_KEY = 'ghostBrowserHistory';

const decodeHistoryUrl = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (!raw.includes('/uv/service/') && !raw.includes('/scramjet/')) return raw;

  try {
    const parsed = new URL(raw, location.origin);
    const pathname = parsed.pathname || '';

    if (pathname.includes('/uv/service/')) {
      const encodedParts = pathname.split('/uv/service/');
      const encoded = encodedParts[encodedParts.length - 1];
      if (encoded) return process(`/uv/service/${encoded}`, true) || raw;
    }

    if (pathname.includes('/scramjet/')) {
      const encodedParts = pathname.split('/scramjet/');
      const encoded = encodedParts[encodedParts.length - 1];
      if (encoded) return process(`/scramjet/${encoded}`, true) || raw;
    }
  } catch {
    try {
      if (raw.includes('/uv/service/')) {
        const encodedParts = raw.split('/uv/service/');
        const encoded = encodedParts[encodedParts.length - 1];
        if (encoded) return process(`/uv/service/${encoded}`, true) || raw;
      }
      if (raw.includes('/scramjet/')) {
        const encodedParts = raw.split('/scramjet/');
        const encoded = encodedParts[encodedParts.length - 1];
        if (encoded) return process(`/scramjet/${encoded}`, true) || raw;
      }
    } catch {
      return raw;
    }
  }

  return raw;
};

const appendBrowserHistory = (url, title = '') => {
  if (!url || url === 'tabs://new' || url === 'about:blank') return;
  try {
    const decodedUrl = decodeHistoryUrl(url);
    if (!decodedUrl || decodedUrl === 'tabs://new' || decodedUrl === 'about:blank') return;
    const raw = localStorage.getItem(BROWSER_HISTORY_KEY);
    const list = JSON.parse(raw || '[]');
    const next = [
      {
        id: createId(),
        url: decodedUrl,
        title: title || decodedUrl,
        time: Date.now(),
      },
      ...(Array.isArray(list) ? list : []),
    ].slice(0, 500);
    localStorage.setItem(BROWSER_HISTORY_KEY, JSON.stringify(next));
  } catch {}
};

const store = create((set) => ({
  tabs: [
    {
      title: 'New Tab',
      id: createId(),
      url: 'tabs://new',
      active: true,
      history: ['tabs://new'],
      historyIndex: 0,
      isLoading: false,
    },
  ],
  frameRefs: null,
  showTabs: true,
  showMenu: false,
  iframeUrls: {},
  activeFrameRef: null,
  showUI: true,
  closedTabs: [],
  zoomLevels: {},
  //only used if isStaticBuild == true
  wispStatus: null,
  setWispStatus: (bool) => set({ wispStatus: bool }),
  toggleUI: () => set((state) => ({ showUI: !state.showUI })),
  setZoom: (tabId, zoom, frameRef) => {
    const ifr = frameRef?.current;
    if (ifr) {
      ifr.style.transform = `scale(${zoom / 100})`;
      ifr.style.transformOrigin = 'top left';
      ifr.style.width = `${100 / (zoom / 100)}%`;
      ifr.style.height = `${100 / (zoom / 100)}%`;
    }
    set((state) => ({
      zoomLevels: { ...state.zoomLevels, [tabId]: zoom },
    }));
  },
  resetZoom: (tabId, frameRef) => {
    const ifr = frameRef?.current;
    if (ifr) {
      ifr.style.transform = '';
      ifr.style.width = '';
      ifr.style.height = '';
    }
    set((state) => ({
      zoomLevels: { ...state.zoomLevels, [tabId]: 100 },
    }));
  },
  setShowTabs: () => set({ showTabs: true }),
  toggleTabs: () => set({ showTabs: true }),
  toggleMenu: () => set((state) => ({ showMenu: !state.showMenu })),
  setFrameRefs: (refs) => set({ frameRefs: refs }),
  addTab: (tab) =>
    set((state) => ({
      tabs: [
        ...state.tabs,
        {
          ...tab,
          history: [tab.url || 'tabs://new'],
          historyIndex: 0,
          isLoading: false,
        },
      ],
    })),
  removeTab: (tabId) =>
    set((state) => {
      const removed = state.tabs.find(({ id }) => id === tabId);
      return {
        tabs: state.tabs.filter(({ id }) => id != tabId),
        closedTabs: removed
          ? [
              {
                ...removed,
                active: false,
              },
              ...state.closedTabs,
            ].slice(0, 20)
          : state.closedTabs,
      };
    }),
  reopenClosedTab: () =>
    set((state) => {
      if (state.closedTabs.length === 0 || state.tabs.length >= 20) return state;

      const [top, ...rest] = state.closedTabs;
      const restored = {
        ...top,
        id: createId(),
        active: true,
      };

      return {
        tabs: state.tabs.map((t) => ({ ...t, active: false })).concat(restored),
        closedTabs: rest,
      };
    }),
  setActive: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => ({ ...tab, active: tab.id === tabId })),
    })),
  //this makes the tab BEFORE The matching tab active (all others false)
  setLastActive: (tabId) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === tabId);
      const prevIndex = index > 0 ? index - 1 : index + 1;

      return {
        tabs: state.tabs.map((tab, i) => ({ ...tab, active: i === prevIndex })),
      };
    }),
  //this updates url property of matching tab and merges
  updateUrl: (tabId, url, addToHistory = true) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;

        if (addToHistory) {
          //FORWARD history gets removed -- & add new url
          const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url];
          appendBrowserHistory(url, tab.title || 'New Tab');
          return {
            ...tab,
            url,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            isLoading: url !== 'tabs://new',
          };
        }
        return { ...tab, url, isLoading: url !== 'tabs://new' };
      }),
    })),
  updateTitle: (tabId, title) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)),
    })),
  setLoading: (tabId, isLoading) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isLoading } : tab)),
    })),
  refreshTab: (tabId) => {
    const state = store.getState();
    const iframe = state.frameRefs?.current?.[tabId];
    if (iframe?.contentWindow) {
      iframe.contentWindow.location.reload();
    }
  },
  goBack: (tabId, onNewTab) => {
    set((state) => {
      const updatedTbs = state.tabs.map((tab) => {
        if (tab.id !== tabId || tab.historyIndex <= 0) return tab;

        const newIndex = tab.historyIndex - 1;
        const newUrl = tab.history[newIndex];

        if (newUrl === 'tabs://new' && onNewTab) {
          onNewTab();
        }

        return {
          ...tab,
          url: newUrl,
          historyIndex: newIndex,
          isLoading: true,
        };
      });

      const tab = updatedTbs.find((t) => t.id === tabId);
      const newIframeUrls = tab ? { ...state.iframeUrls, [tabId]: tab.url } : state.iframeUrls;

      return { tabs: updatedTbs, iframeUrls: newIframeUrls };
    });
  },
  goForward: (tabId) => {
    set((state) => {
      const updatedTbs = state.tabs.map((tab) => {
        if (tab.id !== tabId || tab.historyIndex >= tab.history.length - 1) return tab;

        const newIndex = tab.historyIndex + 1;
        return {
          ...tab,
          url: tab.history[newIndex],
          historyIndex: newIndex,
          isLoading: true,
        };
      });

      const tab = updatedTbs.find((t) => t.id === tabId);
      const newIframeUrls = tab ? { ...state.iframeUrls, [tabId]: tab.url } : state.iframeUrls;

      return { tabs: updatedTbs, iframeUrls: newIframeUrls };
    });
  },
  setIframeUrl: (tabId, url) =>
    set((state) => ({
      iframeUrls: {
        ...state.iframeUrls,
        [tabId]: url,
      },
    })),
  updateActiveFrameRef: (ref) => set({ activeFrameRef: ref }),
  clearStore: () =>
    set(() => ({
      tabs: [
        {
          title: 'New Tab',
          id: createId(),
          url: 'tabs://new',
          active: true,
          history: ['tabs://new'],
          historyIndex: 0,
          isLoading: false,
        },
      ],
      frameRefs: null,
      showTabs: true,
      closedTabs: [],
      iframeUrls: {},
    })),
}));

export default store;
