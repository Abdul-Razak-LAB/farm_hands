import { create } from 'zustand';

interface OutboxState {
  isSyncing: boolean;
  pendingCount: number;
  setSyncing: (status: boolean) => void;
  setPendingCount: (count: number) => void;
}

export const useOutboxStore = create<OutboxState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  setSyncing: (status) => set({ isSyncing: status }),
  setPendingCount: (count) => set({ pendingCount: count }),
}));
