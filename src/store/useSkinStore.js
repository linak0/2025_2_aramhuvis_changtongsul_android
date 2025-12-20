import { create } from 'zustand';

export const useSkinStore = create((set, get) => ({
  currentResult: null,
  setCurrentResult: (result) => set({ currentResult: result }),

  history: [],
  addHistory: (summary) => set({ history: [summary, ...get().history] }),
  clearHistory: () => set({ history: [] }),
}));
