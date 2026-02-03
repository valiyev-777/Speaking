import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, MatchData, QueueStatus } from "@/types";
import { api } from "./api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setHasHydrated: (state: boolean) => void;
}

interface MatchState {
  queueStatus: QueueStatus | null;
  currentMatch: MatchData | null;
  isInSession: boolean;

  setQueueStatus: (status: QueueStatus | null) => void;
  setCurrentMatch: (match: MatchData | null) => void;
  setIsInSession: (inSession: boolean) => void;
  clearMatch: () => void;
}

interface AppState extends AuthState, MatchState {}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth state
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setAuth: (user, token) => {
        api.setToken(token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        api.setToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          queueStatus: null,
          currentMatch: null,
          isInSession: false,
        });
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },

      // Match state
      queueStatus: null,
      currentMatch: null,
      isInSession: false,

      setQueueStatus: (status) => set({ queueStatus: status }),

      setCurrentMatch: (match) => set({ currentMatch: match }),

      setIsInSession: (inSession) => set({ isInSession: inSession }),

      clearMatch: () =>
        set({
          currentMatch: null,
          isInSession: false,
          queueStatus: null,
        }),
    }),
    {
      name: "ielts-speaking-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Called when persisted state is loaded from localStorage
        if (state?.token) {
          api.setToken(state.token);
        }
        useStore.setState({ _hasHydrated: true });
      },
    }
  )
);
