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
     * Exécute tous les callbacks pour une frame
     * @param {object} state - L'état Three.js
     * @param {number} delta - Temps écoulé depuis la dernière frame
     */
    executeFrameCallbacks(state, delta) {
        if (!this.isActive) return;

        const startTime = performance.now();

        // Exécution des callbacks dans l'ordre défini
        for (const category of this.executionOrder) {
            for (const callback of this.callbacks[category].values()) {
                try {
                    callback(state, delta);
                } catch (error) {
                    console.error(`Erreur dans un callback ${category}:`, error);
                }
            }
        }

        // Mise à jour des statistiques
        const frameTime = performance.now() - startTime;
        this.stats.lastFrameTime = frameTime;

        this.stats.frameCount++;
        this.stats.averageFrameTime =
            (this.stats.averageFrameTime * (this.stats.frameCount - 1) + frameTime) / this.stats.frameCount;

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
        this.updateStats();
    }

    /**
     * Renvoie les statistiques actuelles
     * @returns {object} Les statistiques
     */
    getStats() {
        return { ...this.stats };
    }
}

// Instance unique pour toute l'application
export const animationManager = new AnimationManager();

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
        getStats: () => animationManager.getStats()
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