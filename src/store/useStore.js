import { create } from 'zustand'

// Central store for application state
const useStore = create((set) => ({
    // Asset loading state
    loaded: false,
    setLoaded: (loaded) => set({ loaded }),

    // Add more state as needed
}))

export default useStore