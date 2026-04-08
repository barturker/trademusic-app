import { create } from "zustand";

interface PendingUploadState {
  files: File[];
  setFiles: (files: File[]) => void;
  clearFiles: () => void;
}

/**
 * Transient store for files dropped on the homepage.
 * The room page consumes and clears on mount.
 * NOT persisted — File objects are not serializable.
 */
export const usePendingUploadStore = create<PendingUploadState>((set) => ({
  files: [],
  setFiles: (files) => set({ files }),
  clearFiles: () => set({ files: [] }),
}));
