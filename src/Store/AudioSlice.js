/**
 * Tranche du store Zustand pour la gestion de l'audio
 * Gère l'état des sons ambiants et des effets sonores
 */
export const createAudioSlice = (set, get) => ({
    // État audio
    audio: {
        ambientPlaying: false,
        narrationPlaying: false,
        currentNarrationId: null,
        volume: 1.0,
        muted: false,
        ambienceType: 'none',

        // Méthodes pour contrôler l'audio ambiant
        playAmbient: () => set(state => ({
            audio: {
                ...state.audio,
                ambientPlaying: true
            }
        })),

        setAmbienceType: (type) => set(state => ({
            audio: {
                ...state.audio,
                ambienceType: type,
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

        // Méthodes pour contrôler la narration
        playNarration: (narrationId) => set(state => ({
            audio: {
                ...state.audio,
                narrationPlaying: true,
                currentNarrationId: narrationId
            }
        })),

        // Contrôle du volume
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