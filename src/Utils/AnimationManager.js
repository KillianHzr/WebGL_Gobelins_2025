// AnimationManager.js
import { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Gestionnaire d'animation centralisé pour optimiser les performances
 * en regroupant tous les callbacks d'animation en un seul useFrame
 */
class AnimationManager {
    constructor() {
        // Stockage des callbacks d'animation par catégorie
        this.callbacks = {
            preFrame: new Map(), // Avant toute autre mise à jour (calculs prioritaires)
            camera: new Map(),   // Mises à jour liées à la caméra
            physics: new Map(),  // Calculs de physique
            animation: new Map(), // Animations d'objets
            postProcess: new Map(), // Effets post-traitement
            ui: new Map(),        // Mises à jour d'interface
            analytics: new Map()  // Mesures de performance
        };

        // Ordre d'exécution des catégories
        this.executionOrder = [
            'preFrame', 'camera', 'physics', 'animation', 'postProcess', 'ui', 'analytics'
        ];

        // 🚀 NOUVEAU : Configuration de throttling par catégorie
        this.throttleConfig = {
            preFrame: 2,    // Chaque frame (pas de throttling)
            camera: 1,      // Chaque frame (critique pour la navigation)
            physics: 2,     // 1 frame sur 2 (30 FPS au lieu de 60)
            animation: 1,   // Chaque frame (animations fluides)
            postProcess: 3, // 1 frame sur 3 (20 FPS)
            ui: 4,          // 1 frame sur 4 (15 FPS)
            analytics: 10   // 1 frame sur 10 (6 FPS - mesures uniquement)
        };

        // 🚀 NOUVEAU : Compteurs pour le throttling de chaque catégorie
        this.frameCounters = {
            preFrame: 0,
            camera: 0,
            physics: 0,
            animation: 0,
            postProcess: 0,
            ui: 0,
            analytics: 0
        };

        // ID counter pour générer des identifiants uniques
        this.idCounter = 0;

        // Flag pour indiquer si le gestionnaire est actif
        this.isActive = true;

        // Statistiques de performance
        this.stats = {
            totalCallbacks: 0,
            lastFrameTime: 0,
            frameCount: 0,
            averageFrameTime: 0
        };
    }

    /**
     * 🚀 NOUVEAU : Configure le throttling pour une catégorie spécifique
     * @param {string} category - Catégorie à configurer
     * @param {number} interval - Interval de throttling (1 = chaque frame, 2 = 1 frame sur 2, etc.)
     */
    setThrottling(category, interval) {
        if (this.throttleConfig.hasOwnProperty(category)) {
            this.throttleConfig[category] = Math.max(1, Math.floor(interval));
            console.log(`Throttling ${category}: 1 frame sur ${this.throttleConfig[category]}`);
        } else {
            console.warn(`Catégorie ${category} non trouvée pour le throttling`);
        }
    }

    /**
     * 🚀 NOUVEAU : Obtient la configuration de throttling actuelle
     * @returns {object} Configuration de throttling
     */
    getThrottlingConfig() {
        return { ...this.throttleConfig };
    }

    /**
     * 🚀 NOUVEAU : Mode performance qui ajuste automatiquement le throttling
     * @param {string} mode - 'low', 'medium', 'high', 'ultra'
     */
    setPerformanceMode(mode) {
        const configs = {
            low: {
                preFrame: 1, camera: 1, physics: 4, animation: 2,
                postProcess: 6, ui: 8, analytics: 15
            },
            medium: {
                preFrame: 1, camera: 1, physics: 3, animation: 1,
                postProcess: 4, ui: 6, analytics: 12
            },
            high: {
                preFrame: 1, camera: 1, physics: 2, animation: 1,
                postProcess: 3, ui: 4, analytics: 10
            },
            ultra: {
                preFrame: 1, camera: 1, physics: 1, animation: 1,
                postProcess: 1, ui: 2, analytics: 5
            }
        };

        if (configs[mode]) {
            this.throttleConfig = { ...configs[mode] };
            console.log(`Mode performance ${mode} appliqué:`, this.throttleConfig);
        } else {
            console.warn(`Mode performance ${mode} non reconnu`);
        }
    }

    /**
     * Génère un ID unique pour un callback
     * @returns {string} Un identifiant unique
     */
    generateId() {
        return `anim_${++this.idCounter}`;
    }

    /**
     * Ajoute un callback à une catégorie spécifique
     * @param {string} category - Catégorie du callback
     * @param {Function} callback - Fonction à exécuter à chaque frame
     * @param {string} [id] - Identifiant optionnel
     * @returns {string} L'identifiant du callback
     */
    addCallback(category, callback, id = null) {
        if (!this.callbacks[category]) {
            console.warn(`Catégorie ${category} non reconnue. Utilisation de 'animation' à la place.`);
            category = 'animation';
        }

        const callbackId = id || this.generateId();
        this.callbacks[category].set(callbackId, callback);
        this.updateStats();

        return callbackId;
    }

    /**
     * Supprime un callback
     * @param {string} category - Catégorie du callback
     * @param {string} id - Identifiant du callback
     * @returns {boolean} Vrai si le callback a été supprimé
     */
    removeCallback(category, id) {
        if (!this.callbacks[category]) return false;

        const result = this.callbacks[category].delete(id);
        this.updateStats();
        return result;
    }

    /**
     * Met à jour les statistiques
     */
    updateStats() {
        let total = 0;
        for (const category in this.callbacks) {
            total += this.callbacks[category].size;
        }
        this.stats.totalCallbacks = total;
    }

    /**
     * 🚀 MODIFIÉ : Exécute tous les callbacks avec throttling par catégorie
     * @param {object} state - L'état Three.js
     * @param {number} delta - Temps écoulé depuis la dernière frame
     */
    executeFrameCallbacks(state, delta) {
        if (!this.isActive) return;

        const startTime = performance.now();
        let executedCallbacks = 0;
        let skippedCallbacks = 0;

        // Exécution des callbacks dans l'ordre défini avec throttling
        for (const category of this.executionOrder) {
            // 🚀 NOUVEAU : Vérifier le throttling pour cette catégorie
            this.frameCounters[category]++;
            const throttleInterval = this.throttleConfig[category];

            // Si ce n'est pas le bon moment pour cette catégorie, skip
            if (this.frameCounters[category] % throttleInterval !== 0) {
                skippedCallbacks += this.callbacks[category].size;
                continue;
            }

            // Exécuter les callbacks de cette catégorie
            for (const callback of this.callbacks[category].values()) {
                try {
                    callback(state, delta);
                    executedCallbacks++;
                } catch (error) {
                    console.error(`Erreur dans un callback ${category}:`, error);
                }
            }
        }

        // 🚀 NOUVEAU : Mise à jour des statistiques avec info sur le throttling
        const frameTime = performance.now() - startTime;
        this.stats.lastFrameTime = frameTime;
        this.stats.frameCount++;

        // Moyenne mobile plus efficace pour les stats
        const alpha = 0.05; // Facteur de lissage
        this.stats.averageFrameTime =
            this.stats.averageFrameTime * (1 - alpha) + frameTime * alpha;

        // Log périodique des performances (uniquement en mode debug)
        if (this.stats.frameCount % 300 === 0 && window.location.search.includes('debug')) {
            console.log(`📊 AnimationManager Stats:`, {
                frameTime: `${frameTime.toFixed(2)}ms`,
                avgFrameTime: `${this.stats.averageFrameTime.toFixed(2)}ms`,
                executed: executedCallbacks,
                skipped: skippedCallbacks,
                throttling: this.throttleConfig
            });
        }

        // Reset des stats après un certain nombre de frames pour éviter les débordements
        if (this.stats.frameCount > 1000) {
            this.stats.frameCount = 1;
            this.stats.averageFrameTime = frameTime;
        }
    }

    /**
     * Active ou désactive le gestionnaire d'animation
     * @param {boolean} isActive - État d'activation
     */
    setActive(isActive) {
        this.isActive = isActive;
    }

    /**
     * Réinitialise complètement le gestionnaire
     */
    reset() {
        for (const category in this.callbacks) {
            this.callbacks[category].clear();
        }
        this.idCounter = 0;

        // 🚀 NOUVEAU : Reset des compteurs de throttling
        for (const category in this.frameCounters) {
            this.frameCounters[category] = 0;
        }

        this.updateStats();
    }

    /**
     * Renvoie les statistiques actuelles
     * @returns {object} Les statistiques
     */
    getStats() {
        return {
            ...this.stats,
            throttleConfig: { ...this.throttleConfig },
            frameCounters: { ...this.frameCounters }
        };
    }
}

// Instance unique pour toute l'application
export const animationManager = new AnimationManager();

// 🚀 NOUVEAU : Exposer les contrôles de throttling globalement
if (typeof window !== 'undefined') {
    window.animationManager = {
        setThrottling: (category, interval) => animationManager.setThrottling(category, interval),
        setPerformanceMode: (mode) => animationManager.setPerformanceMode(mode),
        getStats: () => animationManager.getStats(),
        getThrottlingConfig: () => animationManager.getThrottlingConfig()
    };
}

/**
 * Hook React pour utiliser l'AnimationManager
 * @returns {object} Méthodes pour interagir avec l'AnimationManager
 */
export function useAnimationManager() {
    // Référence pour garder trace des IDs enregistrés par ce composant
    const registeredCallbacks = useRef(new Map());

    // Enregistrer un callback dans une catégorie
    const registerCallback = useCallback((category, callback, id = null) => {
        const callbackId = animationManager.addCallback(category, callback, id);
        registeredCallbacks.current.set(callbackId, category);
        return callbackId;
    }, []);

    // Supprimer un callback spécifique
    const unregisterCallback = useCallback((id) => {
        if (registeredCallbacks.current.has(id)) {
            const category = registeredCallbacks.current.get(id);
            animationManager.removeCallback(category, id);
            registeredCallbacks.current.delete(id);
            return true;
        }
        return false;
    }, []);

    // Configurer le useFrame centralisé
    useFrame((state, delta) => {
        animationManager.executeFrameCallbacks(state, delta);
    });

    // Nettoyer automatiquement lors du démontage du composant
    useEffect(() => {
        return () => {
            registeredCallbacks.current.forEach((category, id) => {
                animationManager.removeCallback(category, id);
            });
            registeredCallbacks.current.clear();
        };
    }, []);

    return {
        registerCallback,
        unregisterCallback,
        getStats: () => animationManager.getStats(),
        // 🚀 NOUVEAU : Méthodes de throttling
        setThrottling: (category, interval) => animationManager.setThrottling(category, interval),
        setPerformanceMode: (mode) => animationManager.setPerformanceMode(mode)
    };
}

/**
 * Hook personnalisé pour remplacer useFrame standard par notre système centralisé
 * @param {function} callback - Fonction à appeler à chaque frame
 * @param {string} category - Catégorie de l'animation (default: 'animation')
 * @param {number} [priority] - Priorité pour la compatibilité avec useFrame (ignorée)
 * @returns {string} ID du callback pour pouvoir le supprimer si nécessaire
 */
export function useAnimationFrame(callback, category = 'animation', priority = 0) {
    const callbackRef = useRef(null);
    const idRef = useRef(null);

    // Utiliser le hook d'animation manager
    const { registerCallback, unregisterCallback } = useAnimationManager();

    // Mettre à jour la référence du callback quand il change
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Enregistrer le callback enveloppé dans une closure
    useEffect(() => {
        // Wrapper qui appelle la version la plus récente du callback
        const wrappedCallback = (state, delta) => {
            if (callbackRef.current) {
                callbackRef.current(state, delta);
            }
        };

        // Enregistrer le callback et stocker son ID
        idRef.current = registerCallback(category, wrappedCallback);

        // Nettoyer lors du démontage
        return () => {
            if (idRef.current) {
                unregisterCallback(idRef.current);
                idRef.current = null;
            }
        };
    }, [registerCallback, unregisterCallback, category]);

    return idRef.current;
}

/**
 * Version de useAnimationLoop optimisée pour utiliser le gestionnaire centralisé
 * @param {function} callback - Fonction à appeler à chaque frame
 * @returns {object} Référence aux identifiants d'animation
 */
export function useAnimationLoop(callback) {
    const requestRef = useRef();
    const previousTimeRef = useRef();

    // Utiliser notre hook centralisé
    useAnimationFrame((state, delta) => {
        if (previousTimeRef.current !== undefined) {
            // Convertir delta en secondes
            const deltaTime = delta;
            callback(deltaTime);
        }
        previousTimeRef.current = state.clock.elapsedTime;
    }, 'animation');

    return { requestRef, previousTimeRef };
}