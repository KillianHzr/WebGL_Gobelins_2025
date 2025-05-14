export const CameraSlice = (set, get) => ({
    // Modèle de caméra chargé depuis le GLB
    cameraModel: null,
    setCameraModel: (model) => set({ cameraModel: model }),
    cameraAnimation: null,
    setCameraAnimation: (animation) => set({ cameraAnimation: animation }),
    availableCameraAnimations: [],
    setAvailableCameraAnimations: (animations) => set({ availableCameraAnimations: animations }),

    // Nouvelle propriété pour le mode caméra
    cameraMode: 'default', // 'default', 'free', 'theatre'

    // Nouvelle fonction pour changer le mode caméra
    setCameraMode: (mode) => {
        // Mise à jour du mode de caméra
        set({ cameraMode: mode });

        // Émission d'un événement pour informer les autres composants
        if (typeof window !== 'undefined' && window.EventBus) {
            window.EventBus.trigger('camera-mode-changed', { mode });
        } else if (typeof EventBus !== 'undefined') {
            // Alternative si EventBus est importé
            try {
                EventBus.trigger('camera-mode-changed', { mode });
            } catch (error) {
                console.warn('Impossible d\'émettre l\'événement camera-mode-changed:', error);
            }
        }
    },

    // Configuration visuelle
    cameraSettings: {
        wireframe: false,
        showInstances: true,
        showInteractive: true,
        showStatic: true
    },

    // Mettre à jour les paramètres visuels
    updateCameraSettings: (settings) => set(state => ({
        cameraSettings: {
            ...state.cameraSettings,
            ...settings
        }
    }))
});