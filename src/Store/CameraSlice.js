export const CameraSlice = (set, get) => ({
    // Modèle de caméra chargé depuis le GLB
    cameraModel: null,
    setCameraModel: (model) => set({ cameraModel: model }),

    // Animation de caméra active
    cameraAnimation: null,
    setCameraAnimation: (animation) => set({ cameraAnimation: animation }),

    // Toutes les animations disponibles
    availableCameraAnimations: [],
    setAvailableCameraAnimations: (animations) => set({ availableCameraAnimations: animations }),
});