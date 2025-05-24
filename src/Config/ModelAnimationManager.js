import * as THREE from 'three';
import { EventBus } from '../Utils/EventEmitter';

// Flag de débogage pour le ModelAnimationManager
const DEBUG_ANIMATION_MANAGER = false;

/**
 * Gestionnaire d'animations synchronisé pour les modèles 3D
 * Version optimisée pour éviter les doublons et améliorer les performances
 */
class ModelAnimationManager {
    constructor() {
        this.animationMixers = new Map(); // Map<modelId, THREE.AnimationMixer>
        this.activeAnimations = new Map(); // Map<animationId, animationInfo>
        this.modelAnimationConfig = new Map(); // Map<modelId, animationConfig>
        this.registeredModels = new Set(); // Pour éviter les doublons
        this.clock = new THREE.Clock();
        this.initialized = false;
        this.isUpdating = false; // Flag pour éviter les mises à jour simultanées

        // Configuration des associations modèle -> animations
        this.modelAnimationAssociations = {
            // Configuration pour le vison qui court
            'VisonRun': {
                modelId: 'VisonRun',
                animations: {
                    'run': {
                        animationName: 'animation_0', // Nom correct basé sur les logs
                        autoplay: true,
                        loop: true,
                        loopCount: -1,
                        timeScale: 1.0,
                        clampWhenFinished: false,
                        fadeInDuration: 0.2,
                        fadeOutDuration: 0.2,
                        weight: 1.0
                    },

                },
                // defaultAnimations: ['run']
            },


            // Configuration générique pour tous les modèles non spécifiés
            '*': {
                animations: {
                    'default': {
                        animationName: 'Action',
                        autoplay: false, // Changé à false pour éviter les conflits
                        loop: true,
                        loopCount: -1,
                        timeScale: 1.0,
                        clampWhenFinished: false,
                        fadeInDuration: 0.5,
                        fadeOutDuration: 0.5,
                        weight: 1.0
                    }
                },
                defaultAnimations: []
            }
        };

        // Événements d'animation personnalisés
        this.animationEvents = {
            MODEL_ANIMATION_START: 'model:animation:start',
            MODEL_ANIMATION_STOP: 'model:animation:stop',
            MODEL_ANIMATION_PAUSE: 'model:animation:pause',
            MODEL_ANIMATION_RESUME: 'model:animation:resume',
            MODEL_ANIMATION_COMPLETE: 'model:animation:complete',
            PLAY_ANIMATION_SEQUENCE: 'animation:sequence:play',
            STOP_ALL_ANIMATIONS: 'animation:stop:all',
            CUSTOM_ANIMATION_TRIGGER: 'animation:custom:trigger'
        };

        this._setupEventListeners();
    }

    /**
     * Initialise le gestionnaire d'animations
     */
    init() {
        if (this.initialized) return;

        this.initialized = true;
        this._startAnimationLoop();

        console.log('ModelAnimationManager initialisé (version synchronisée)');

        if (typeof window !== 'undefined') {
            window.modelAnimationManager = this;
        }
    }

    /**
     * Enregistre un modèle 3D de manière sécurisée
     */
    registerModel(modelId, model, animations = []) {
        // Éviter les doublons avec une clé unique
        const uniqueKey = `${modelId}-${model.uuid}`;

        if (this.registeredModels.has(uniqueKey)) {
            console.log(`Modèle ${modelId} déjà enregistré (${uniqueKey}), ignoré`);
            return;
        }

        // Nettoyer l'ancien modèle s'il existe
        if (this.animationMixers.has(modelId)) {
            console.log(`Nettoyage de l'ancien modèle ${modelId}`);
            this._cleanupModel(modelId);
        }

        // Marquer comme en cours de traitement
        this.isUpdating = true;

        try {
            // Créer le mixer d'animation
            const mixer = new THREE.AnimationMixer(model);
            this.animationMixers.set(modelId, mixer);
            this.registeredModels.add(uniqueKey);

            // Obtenir la configuration d'animations pour ce modèle
            const config = this.modelAnimationAssociations[modelId] || this.modelAnimationAssociations['*'];

            if (config && config.animations) {
                // Configurer chaque animation
                Object.entries(config.animations).forEach(([animKey, animConfig]) => {
                    this._setupAnimation(modelId, animKey, animConfig, animations);
                });

                // ⚠️ NE PLUS jouer les animations par défaut ici
                // Elles sont maintenant gérées localement dans StaticObject
                console.log(`🎭 Modèle ${modelId} configuré avec ${Object.keys(config.animations).length} animations (lecture locale)`);
            }

            console.log(`✅ Modèle ${modelId} enregistré avec ${animations.length} animations disponibles`);

        } catch (error) {
            console.error(`Erreur lors de l'enregistrement du modèle ${modelId}:`, error);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Configure une animation spécifique avec gestion d'erreurs améliorée
     */
    _setupAnimation(modelId, animKey, animConfig, availableAnimations) {
        const mixer = this.animationMixers.get(modelId);
        if (!mixer) return;

        let targetClip = null;

        // Stratégie de recherche d'animation améliorée
        const searchStrategies = [
            // 1. Nom exact
            () => availableAnimations.find(clip => clip.name === animConfig.animationName),
            // 2. Variations courantes
            () => {
                const variations = [
                    animConfig.animationName,
                    `${animConfig.animationName}.001`,
                    `${animConfig.animationName}.002`,
                    'Action',
                    'Action.001',
                    'Action.003', // Ajouté basé sur les logs
                    'animation_0', // Ajouté basé sur les logs
                    'Scene'
                ];

                for (const variation of variations) {
                    const clip = availableAnimations.find(clip => clip.name === variation);
                    if (clip) return clip;
                }
                return null;
            },
            // 3. Première animation disponible
            () => availableAnimations.length > 0 ? availableAnimations[0] : null
        ];

        // Essayer chaque stratégie
        for (const strategy of searchStrategies) {
            targetClip = strategy();
            if (targetClip) break;
        }

        if (targetClip) {
            try {
                // Créer l'action d'animation
                const action = mixer.clipAction(targetClip);

                // Configurer l'action selon les paramètres
                if (animConfig.loop === false) {
                    action.setLoop(THREE.LoopOnce);
                } else {
                    action.setLoop(THREE.LoopRepeat);
                }

                action.clampWhenFinished = animConfig.clampWhenFinished || false;

                // Stocker la configuration
                if (!this.modelAnimationConfig.has(modelId)) {
                    this.modelAnimationConfig.set(modelId, new Map());
                }

                this.modelAnimationConfig.get(modelId).set(animKey, {
                    action: action,
                    config: animConfig,
                    clip: targetClip
                });

                // Log seulement si le nom d'animation trouvé diffère de celui demandé
                if (targetClip.name !== animConfig.animationName) {
                    console.log(`🔄 Animation "${animConfig.animationName}" → "${targetClip.name}" pour ${modelId}`);
                }

            } catch (error) {
                console.error(`Erreur lors de la configuration de l'animation ${animKey} pour ${modelId}:`, error);
            }
        } else {
            console.warn(`❌ Aucune animation trouvée pour ${animKey} (${animConfig.animationName}) sur ${modelId}`);
        }
    }

    /**
     * Joue une animation avec gestion d'erreurs améliorée
     */
    playAnimation(modelId, animationKey, options = {}) {
        if (this.isUpdating) {
            console.log(`Animation ${animationKey} pour ${modelId} reportée (mise à jour en cours)`);
            setTimeout(() => this.playAnimation(modelId, animationKey, options), 50);
            return false;
        }

        const modelConfig = this.modelAnimationConfig.get(modelId);
        if (!modelConfig || !modelConfig.has(animationKey)) {
            console.warn(`Animation "${animationKey}" introuvable pour le modèle "${modelId}"`);
            return false;
        }

        try {
            const animData = modelConfig.get(animationKey);
            const { action, config } = animData;

            // Générer un ID unique pour cette instance d'animation
            const animationId = `${modelId}-${animationKey}-${Date.now()}`;

            // Appliquer les options
            const timeScale = options.timeScale || config.timeScale || 1.0;
            const weight = options.weight !== undefined ? options.weight : config.weight || 1.0;
            const fadeIn = options.fadeInDuration !== undefined ? options.fadeInDuration : config.fadeInDuration || 0;

            action.setEffectiveTimeScale(timeScale);
            action.setEffectiveWeight(weight);

            // Gérer les boucles
            let loopCount = options.loopCount !== undefined ? options.loopCount : config.loopCount;
            if (loopCount === -1) {
                action.setLoop(THREE.LoopRepeat, Infinity);
            } else if (loopCount === 0) {
                action.setLoop(THREE.LoopOnce);
            } else {
                action.setLoop(THREE.LoopRepeat, loopCount);
            }

            // Réinitialiser et jouer
            action.reset();

            if (fadeIn > 0) {
                action.fadeIn(fadeIn);
            } else {
                action.play();
            }

            // Stocker l'animation active
            this.activeAnimations.set(animationId, {
                modelId,
                animationKey,
                action,
                config,
                startTime: Date.now(),
                options
            });

            // Configurer l'écouteur pour la fin d'animation
            const mixer = this.animationMixers.get(modelId);
            const onFinished = (event) => {
                if (event.action === action) {
                    mixer.removeEventListener('finished', onFinished);
                    this.activeAnimations.delete(animationId);

                    EventBus.trigger(this.animationEvents.MODEL_ANIMATION_COMPLETE, {
                        modelId,
                        animationKey,
                        animationId
                    });
                }
            };

            mixer.addEventListener('finished', onFinished);

            console.log(`🎬 Animation "${animationKey}" démarrée pour "${modelId}"`);

            EventBus.trigger(this.animationEvents.MODEL_ANIMATION_START, {
                modelId,
                animationKey,
                animationId,
                timeScale,
                weight
            });

            return animationId;

        } catch (error) {
            console.error(`Erreur lors de la lecture de l'animation ${animationKey} pour ${modelId}:`, error);
            return false;
        }
    }

    /**
     * Arrête une animation spécifique
     */
    stopAnimation(modelId, animationKey, options = {}) {
        const modelConfig = this.modelAnimationConfig.get(modelId);
        if (!modelConfig || !modelConfig.has(animationKey)) {
            return false;
        }

        try {
            const animData = modelConfig.get(animationKey);
            const { action, config } = animData;

            const fadeOut = options.fadeOutDuration !== undefined ? options.fadeOutDuration : config.fadeOutDuration || 0;

            if (fadeOut > 0) {
                action.fadeOut(fadeOut);
            } else {
                action.stop();
            }

            // Supprimer de la liste des animations actives
            for (const [animId, animInfo] of this.activeAnimations.entries()) {
                if (animInfo.modelId === modelId && animInfo.animationKey === animationKey) {
                    this.activeAnimations.delete(animId);
                    break;
                }
            }

            EventBus.trigger(this.animationEvents.MODEL_ANIMATION_STOP, {
                modelId,
                animationKey
            });

            return true;

        } catch (error) {
            console.error(`Erreur lors de l'arrêt de l'animation ${animationKey} pour ${modelId}:`, error);
            return false;
        }
    }

    /**
     * Arrête toutes les animations d'un modèle
     */
    stopAllAnimationsForModel(modelId) {
        const mixer = this.animationMixers.get(modelId);
        if (!mixer) return false;

        try {
            mixer.stopAllAction();

            // Nettoyer les animations actives
            for (const [animId, animInfo] of this.activeAnimations.entries()) {
                if (animInfo.modelId === modelId) {
                    this.activeAnimations.delete(animId);
                }
            }

            console.log(`⏹️ Toutes les animations arrêtées pour "${modelId}"`);
            return true;

        } catch (error) {
            console.error(`Erreur lors de l'arrêt des animations pour ${modelId}:`, error);
            return false;
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    _setupEventListeners() {
        EventBus.on(this.animationEvents.MODEL_ANIMATION_START, this._handleAnimationStart.bind(this));
        EventBus.on(this.animationEvents.MODEL_ANIMATION_STOP, this._handleAnimationStop.bind(this));
        EventBus.on(this.animationEvents.PLAY_ANIMATION_SEQUENCE, this._handleAnimationSequence.bind(this));
        EventBus.on(this.animationEvents.STOP_ALL_ANIMATIONS, this._handleStopAllAnimations.bind(this));
    }

    /**
     * Gestionnaires d'événements
     */
    _handleAnimationStart(data) {
        const { modelId, animationKey, options } = data;
        this.playAnimation(modelId, animationKey, options);
    }

    _handleAnimationStop(data) {
        const { modelId, animationKey, options } = data;
        this.stopAnimation(modelId, animationKey, options);
    }

    _handleAnimationSequence(data) {
        const { modelId, sequence } = data;
        this.playAnimationSequence(modelId, sequence);
    }

    _handleStopAllAnimations(data) {
        if (data.modelId) {
            this.stopAllAnimationsForModel(data.modelId);
        } else {
            for (const modelId of this.animationMixers.keys()) {
                this.stopAllAnimationsForModel(modelId);
            }
        }
    }

    /**
     * Joue une séquence d'animations
     */
    playAnimationSequence(modelId, sequence) {
        if (!Array.isArray(sequence)) {
            console.error('La séquence doit être un tableau');
            return false;
        }

        let currentIndex = 0;

        const playNext = () => {
            if (currentIndex >= sequence.length) {
                console.log(`Séquence d'animations terminée pour ${modelId}`);
                return;
            }

            const step = sequence[currentIndex];
            const animationKey = step.animation;
            const duration = step.duration || null;

            const animationId = this.playAnimation(modelId, animationKey, step.options || {});

            if (duration) {
                setTimeout(() => {
                    this.stopAnimation(modelId, animationKey);
                    currentIndex++;
                    playNext();
                }, duration);
            } else {
                const checkComplete = () => {
                    if (!this.activeAnimations.has(animationId)) {
                        currentIndex++;
                        playNext();
                    } else {
                        setTimeout(checkComplete, 100);
                    }
                };
                checkComplete();
            }
        };

        playNext();
        return true;
    }

    /**
     * Ajoute une nouvelle association modèle-animation
     */
    addModelAnimationAssociation(modelId, config) {
        this.modelAnimationAssociations[modelId] = config;
        console.log(`📝 Association ajoutée pour le modèle "${modelId}"`);
    }

    /**
     * Démarrer la boucle d'animation optimisée
     * DÉSACTIVÉE pour éviter les conflits avec les mixers locaux
     */
    _startAnimationLoop() {
        // ⚠️ IMPORTANT: Ne pas démarrer de boucle d'animation ici
        // pour éviter les conflits avec les mixers gérés localement
        // par les composants StaticObject

        console.log('🔄 Boucle d\'animation ModelAnimationManager désactivée (gestion locale)');

        // Optionnel: ajouter une boucle de surveillance pour le débogage
        if (DEBUG_ANIMATION_MANAGER) {
            setInterval(() => {
                if (this.activeAnimations.size > 0) {
                    console.log(`📊 Animations actives: ${this.activeAnimations.size}`);
                }
            }, 5000);
        }
    }

    /**
     * Vérifie si un modèle a des animations actives
     */
    hasActiveAnimations(modelId) {
        for (const animInfo of this.activeAnimations.values()) {
            if (animInfo.modelId === modelId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Nettoie un modèle de manière sécurisée
     */
    _cleanupModel(modelId) {
        try {
            // Arrêter toutes les animations du modèle
            this.stopAllAnimationsForModel(modelId);

            // Supprimer le mixer
            const mixer = this.animationMixers.get(modelId);
            if (mixer) {
                mixer.stopAllAction();
                mixer.uncacheRoot(mixer.getRoot());
            }

            this.animationMixers.delete(modelId);
            this.modelAnimationConfig.delete(modelId);

            // Nettoyer les clés d'enregistrement
            const keysToRemove = [];
            for (const key of this.registeredModels) {
                if (key.startsWith(modelId + '-')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => this.registeredModels.delete(key));

        } catch (error) {
            console.error(`Erreur lors du nettoyage du modèle ${modelId}:`, error);
        }
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        try {
            for (const modelId of this.animationMixers.keys()) {
                this._cleanupModel(modelId);
            }

            this.activeAnimations.clear();
            this.registeredModels.clear();
            this.initialized = false;

            console.log('ModelAnimationManager nettoyé');

        } catch (error) {
            console.error('Erreur lors du nettoyage du ModelAnimationManager:', error);
        }
    }

    /**
     * Méthodes utilitaires pour le débogage
     */
    getActiveAnimations() {
        return Array.from(this.activeAnimations.entries()).map(([id, info]) => ({
            id,
            modelId: info.modelId,
            animationKey: info.animationKey,
            startTime: info.startTime,
            running: Date.now() - info.startTime
        }));
    }

    getRegisteredModels() {
        return Array.from(this.animationMixers.keys());
    }

    getModelAnimations(modelId) {
        const config = this.modelAnimationConfig.get(modelId);
        if (!config) return [];
        return Array.from(config.keys());
    }

    // Méthode pour déboguer l'état actuel
    debugState() {
        console.group('🔍 État du ModelAnimationManager');
        console.log('Modèles enregistrés:', this.getRegisteredModels());
        console.log('Animations actives:', this.getActiveAnimations());
        console.log('Clés d\'enregistrement:', Array.from(this.registeredModels));
        console.groupEnd();
    }
}

// Créer et exporter l'instance singleton
export const modelAnimationManager = new ModelAnimationManager();
export const ANIMATION_EVENTS = modelAnimationManager.animationEvents;
export default modelAnimationManager;