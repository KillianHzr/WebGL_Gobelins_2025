/**
 * Tranche du store Zustand pour la gestion de l'audio
 * Gère l'état des sons ambiants et des effets sonores
 */
export const createAudioSlice = (set, get) => ({
    // État audio
    audio: {
        ambientPlaying: false,
        volume: 1.0,
        muted: false,

        // Méthodes pour contrôler l'audio
        playAmbient: () => set(state => ({
            audio: {
                ...state.audio,
                ambientPlaying: true
            }
        })),

        pauseAmbient: () => set(state => ({
            audio: {
                ...state.audio,
                ambientPlaying: false
            }
        })),

        resumeAmbient: () => set(state => ({
            audio: {
                ...state.audio,
                ambientPlaying: true
            }
        })),

        toggleAmbient: () => {
            const currentlyPlaying = get().audio.ambientPlaying;
            set(state => ({
                audio: {
                    ...state.audio,
                    ambientPlaying: !currentlyPlaying
                }
            }));
        },

        setVolume: (volume) => set(state => ({
            audio: {
                ...state.audio,
                volume
            }
        })),

        toggleMute: () => {
            const currentlyMuted = get().audio.muted;
            set(state => ({
                audio: {
                    ...state.audio,
                    muted: !currentlyMuted
                }
            }));
        }
    }
});