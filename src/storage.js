const storeKey = "hanzi-archaeology-2124";

export const loadStore = () => {
  try {
    const raw = localStorage.getItem(storeKey);
    const x = raw ? JSON.parse(raw) : null;
    return {
      discovered: x?.discovered || {},
      lastIndex: Number.isFinite(x?.lastIndex) ? x.lastIndex : 0,
      setsUnlocked: x?.setsUnlocked || {},
      achievements: x?.achievements || {},
      stats: x?.stats || { clears: 0, flawless: 0, bestTimeMs: 0 },
      hasSeenTutorial: x?.hasSeenTutorial || false,
    };
  } catch {
    return { discovered: {}, lastIndex: 0, setsUnlocked: {}, achievements: {}, stats: { clears: 0, flawless: 0, bestTimeMs: 0 }, hasSeenTutorial: false };
  }
};

export const saveStore = (store) => localStorage.setItem(storeKey, JSON.stringify(store));

export const resetStore = () => localStorage.removeItem(storeKey);

