import {create} from 'zustand'
import {createAudioSlice} from './AudioSlice'
import {createInteractionSlice} from './InteractionSlice'
import {createClickListenerSlice} from './clickListenerSlice'
import {createNarrationSlice} from './NarrationSlice'
import {createEndingLandingSlice} from "./EndingLandingSlice.js";
import {CameraSlice} from "./CameraSlice.js";

// Function to check if debug is enabled in URL
const isDebugEnabled = () => {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
        // Debug est activé si le hash contient #debug ou #debugWithIntro
        return window.location.hash === '#debug' || window.location.hash === '#debugWithIntro';
    }
    return false;
}

// Function to check if intro should be skipped
const shouldSkipIntro = () => {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
        // Skip intro uniquement si le hash est exactement #debug (pas #debugWithIntro)
        return window.location.hash === '#debug';
    }
    return false;
}

// Central Store for application state
const useStore = create((set, get) => ({
    // Asset loading state
    loaded: false,
    setLoaded: (loaded) => set({loaded}),

    // Camera GLB model and animation
    ...CameraSlice(set, get),

    chapters: {
        distances: {},
        currentChapter: 0
    },
    setChapterDistance: (chapterId, distance) => set(state => ({
        chapters: {
            ...state.chapters,
            distances: {
                ...state.chapters.distances,
                [chapterId]: distance
            }
        }
    })),
    setCurrentChapter: (index) => set(state => ({
        chapters: {
            ...state.chapters,
            currentChapter: index
        }
    })),

    // Debug state - initially set based on URL hash
    debug: {
        active: isDebugEnabled(),     // Enable debug features if #debug or #debugWithIntro in URL
        showStats: isDebugEnabled(),  // Show performance statistics
        showGui: isDebugEnabled(),    // Show control panel
        skipIntro: shouldSkipIntro(),
    },
    setDebug: (debugSettings) => set(state => ({
        debug: {...state.debug, ...debugSettings}
    })),
    flashlight: {
        active: false,
        autoActivate: true,
        manuallyToggled: false,
        preloadState: 'pending'
    },
    // Camera state for zoom functionality
    camera: null,
    setCamera: (camera) => set({camera}),
    cameraInitialZoom: null,
    setCameraInitialZoom: (zoom) => set({cameraInitialZoom: zoom}),
    currentZoomLevel: 0, // -3 to +3 range
    setCurrentZoomLevel: (level) => set({currentZoomLevel: level}),

    // GUI instance (shared among all components)
    gui: null,
    setGui: (gui) => set({gui}),

    animationInProgress: false,
    setAnimationInProgress: (inProgress) => set({ animationInProgress: inProgress }),

    // Timeline position tracking
    // Debug configuration (for export/import)
    debugConfig: null,
    setDebugConfig: (config) => set({debugConfig: config}),

    // NOUVELLES PROPRIÉTÉS POUR LA TRANSITION JOUR/NUIT

    timelinePosition: 0,
    sequenceLength: 1,


    endGroupVisible: false,
    screenGroupVisible: true,

    setEndGroupVisible: (visible) => set({endGroupVisible: visible}),
    setScreenGroupVisible: (visible) => set({screenGroupVisible: visible}),
    // NOUVELLES ACTIONS POUR LA TRANSITION JOUR/NUIT
    setTimelinePosition: (position) => set({timelinePosition: position}),
    setSequenceLength: (length) => set({sequenceLength: length}),
    updateFlashlightState: (newState) => set((state) => ({
        flashlight: {
            ...state.flashlight,
            ...newState
        }
    })),
    // Update specific part of debug config
    updateDebugConfig: (path, value) => {
        const config = {...get().debugConfig};
        let current = config;
        const parts = path.split('.');

        // Navigate to the second-to-last part of the path
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Set the value at the final path
        current[parts[parts.length - 1]] = value;
        set({debugConfig: config});
    },

    // Get value from debug config
    getDebugConfigValue: (path, defaultValue) => {
        const config = get().debugConfig;
        if (!config) return defaultValue;

        let current = config;
        const parts = path.split('.');

        // Navigate through the path
        for (let i = 0; i < parts.length; i++) {
            if (!current[parts[i]]) {
                return defaultValue;
            }
            current = current[parts[i]];
        }

        return current;
    },

    updateDebugConfigWithoutRender: (path, value) => {
        const config = {...get().debugConfig};
        let current = config;
        const parts = path.split('.');

        // Naviguer jusqu'à l'avant-dernière partie du chemin
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Définir la valeur au chemin final
        current[parts[parts.length - 1]] = value;

        // Mettre à jour la config sans déclencher de re-rendu
        get().setDebugConfig(config);
    },

    // Système de détection des clics
    clickListener: {
        // État indiquant si l'écoute des clics est active
        isListening: false,

        // Méthode pour démarrer l'écoute des clics
        startListening: () => set(state => ({
            clickListener: {
                ...state.clickListener,
                isListening: true
            }
        })),

        // Méthode pour arrêter l'écoute des clics
        stopListening: () => set(state => ({
            clickListener: {
                ...state.clickListener,
                isListening: false
            }
        })),

        // Méthode pour basculer l'état d'écoute
        toggleListening: () => set(state => ({
            clickListener: {
                ...state.clickListener,
                isListening: !state.clickListener.isListening
            }
        })),

        // Configuration de débogage
        debug: {
            enabled: false
        }
    },

    // État des interactions
    interaction: {
        currentStep: null,
        allowScroll: true,
        waitingForInteraction: false,
        completedInteractions: {},
        showCaptureInterface: false,
        showScannerInterface: false,
        showBlackscreenInterface: false,
        showImageInterface: false,
        imageInterfaceSource: null,

        setShowCaptureInterface: (show) => set(state => ({
            interaction: {
                ...state.interaction,
                showCaptureInterface: show
            }
        })),

        setShowScannerInterface: (show) => set(state => ({
            interaction: {
                ...state.interaction,
                showScannerInterface: show
            }
        })),

        setShowBlackscreenInterface: (show) => set(state => ({
            interaction: {
                ...state.interaction,
                showBlackscreenInterface: show
            }
        })),

        setShowImageInterface: (show, imageSource = null) => set(state => ({
            interaction: {
                ...state.interaction,
                showImageInterface: show,
                imageInterfaceSource: imageSource
            }
        })),

        // Méthodes existantes
        setCurrentStep: (step) => set(state => ({
            interaction: {
                ...state.interaction,
                currentStep: step
            }
        })),

        // Définir si le défilement est autorisé
        setAllowScroll: (allow) => set(state => ({
            interaction: {
                ...state.interaction,
                allowScroll: allow
            }
        })),

        // Définir si on attend une interaction
        setWaitingForInteraction: (waiting) => set(state => ({
            interaction: {
                ...state.interaction,
                waitingForInteraction: waiting
            }
        })),

        // Compléter une interaction (utilisé lorsqu'on détecte un clic sur un objet)
        completeInteraction: () => {
            const state = get();
            if (!state.interaction.waitingForInteraction) return;

            // Récupérer l'étape actuelle
            const currentStep = state.interaction.currentStep;
            const currentStepBeforeComplete = get().interaction.currentStep;

            set(state => ({
                interaction: {
                    ...state.interaction,
                    waitingForInteraction: false,
                    currentStep: null,
                    interactionTarget: null,
                    completedInteractions: {
                        ...state.interaction.completedInteractions,
                        [currentStepBeforeComplete]: true
                    }
                }
            }));

            return currentStep;
        }
    },

    // Gestion des instances et des positions des arbres
    instanceGroups: {},
    setInstanceGroups: (groups) => set({instanceGroups: groups}),

    treePositions: null,
    setTreePositions: (positions) => set({treePositions: positions}),

    // Intégration des tranches
    ...createClickListenerSlice(set, get),
    ...createInteractionSlice(set, get),
    ...createAudioSlice(set, get),
    ...createNarrationSlice(set, get),
    ...createEndingLandingSlice(set, get)
}));

// Listen for hash changes to toggle debug mode
if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
        const debugEnabled = isDebugEnabled();
        const skipIntroEnabled = shouldSkipIntro();

        // Mise à jour du mode debug
        useStore.getState().setDebug({
            active: debugEnabled,
            showStats: debugEnabled,
            showGui: debugEnabled,
            showTheatre: debugEnabled,
            skipIntro: skipIntroEnabled
        });
    });
}

export default useStore