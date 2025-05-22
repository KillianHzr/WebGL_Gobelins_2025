import * as THREE from 'three';
import { EventBus } from '../Utils/EventEmitter';

/**
 * Gestionnaire d'animations pour les modèles 3D
 * Permet de déclencher des animations spécifiques sur des modèles basé sur des événements
 */
class ModelAnimationManager {
    constructor() {
        this.animationMixers = new Map(); // Map<modelId, THREE.AnimationMixer>
        this.activeAnimations = new Map(); // Map<animationId, animationInfo>
        this.modelAnimationConfig = new Map(); // Map<modelId, animationConfig>
        this.clock = new THREE.Clock();
        this.initialized = false;

        // Configuration des associations modèle -> animations
        this.modelAnimationAssociations = {
            // Exemple de configuration pour un vison
            'Vison': {
                modelId: 'Vison',
                animations: {
                    'idle': {
                        animationName: 'Action', // Nom de l'animation dans le fichier GLB
                        autoplay: false,
                        loop: true,
                        loopCount: -1, // -1 = infini, 0 = pas de loop, >0 = nombre de loops
                        timeScale: 1.0,
                        clampWhenFinished: false,
                        fadeInDuration: 0.2,
                        fadeOutDuration: 0.2,
                        weight: 1.0
                    },
                    'running': {
                        animationName: 'Action.001',
                        autoplay: false,
                        loop: true,
                        loopCount: -1,
                        timeScale: 1.5,
                        clampWhenFinished: false,
                        fadeInDuration: 0.3,
                        fadeOutDuration: 0.3,
                        weight: 1.0
                    },
                    'death': {
                        animationName: 'Action.002',
                        autoplay: false,
                        loop: false,
                        loopCount: 1,
                        timeScale: 0.8,
                        clampWhenFinished: true,
                        fadeInDuration: 0.5,
                        fadeOutDuration: 0.0,
                        weight: 1.0
                    }
                },
                // Animations par défaut qui se jouent automatiquement
                defaultAnimations: ['idle']
            },

            // Exemple pour un autre modèle
            'AnimalVisonMortV1': {
                modelId: 'AnimalVisonMortV1',
                animations: {
                    'breathing': {
                        animationName: 'Action',
                        autoplay: true,
                        loop: true,
                        loopCount: -1,
                        timeScale: 0.5,
                        clampWhenFinished: false,
                        fadeInDuration: 1.0,
                        fadeOutDuration: 1.0,
                        weight: 1.0
                    },
                    'twitch': {
                        animationName: 'Action.001',
                        autoplay: false,
                        loop: false,
                        loopCount: 1,
                        timeScale: 2.0,
                        clampWhenFinished: false,
                        fadeInDuration: 0.1,
                        fadeOutDuration: 0.1,
                        weight: 0.8
                    }
                },
                defaultAnimations: ['breathing']
            },

            // Configuration générique pour tous les modèles non spécifiés
            '*': {
                animations: {
                    'default': {
                        animationName: 'Action',
                        autoplay: true,
                        loop: true,
                        loopCount: -1,
                        timeScale: 1.0,
                        clampWhenFinished: false,
                        fadeInDuration: 0.5,
                        fadeOutDuration: 0.5,
                        weight: 1.0
                    }
                },
                defaultAnimations: ['default']
            }
        };

        // Événements d'animation personnalisés
        this.animationEvents = {
            // Événements génériques
            MODEL_ANIMATION_START: 'model:animation:start',
            MODEL_ANIMATION_STOP: 'model:animation:stop',
            MODEL_ANIMATION_PAUSE: 'model:animation:pause',
            MODEL_ANIMATION_RESUME: 'model:animation:resume',
            MODEL_ANIMATION_COMPLETE: 'model:animation:complete',

            // Événements spécifiques aux modèles
            VISON_START_RUNNING: 'vison:start:running',
            VISON_STOP_RUNNING: 'vison:stop:running',
            VISON_DEATH: 'vison:death',
            VISON_IDLE: 'vison:idle',

            // Événements de séquence
            PLAY_ANIMATION_SEQUENCE: 'animation:sequence:play',
            STOP_ALL_ANIMATIONS: 'animation:stop:all',

            // Événements personnalisés
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

        // Démarrer la boucle d'animation
        this._startAnimationLoop();

        console.log('ModelAnimationManager initialisé');

        // Exposer globalement pour le débogage
        if (typeof window !== 'undefined') {
            window.modelAnimationManager = this;
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    _setupEventListeners() {
        // Écouteurs pour les événements génériques
        EventBus.on(this.animationEvents.MODEL_ANIMATION_START, this._handleAnimationStart.bind(this));
        EventBus.on(this.animationEvents.MODEL_ANIMATION_STOP, this._handleAnimationStop.bind(this));
        EventBus.on(this.animationEvents.MODEL_ANIMATION_PAUSE, this._handleAnimationPause.bind(this));
        EventBus.on(this.animationEvents.MODEL_ANIMATION_RESUME, this._handleAnimationResume.bind(this));

        // Écouteurs pour les événements spécifiques aux modèles
        EventBus.on(this.animationEvents.VISON_START_RUNNING, (data) => {
            this.playAnimation('Vison', 'running', data);
        });

        EventBus.on(this.animationEvents.VISON_STOP_RUNNING, (data) => {
            this.stopAnimation('Vison', 'running', data);
            this.playAnimation('Vison', 'idle', data);
        });

        EventBus.on(this.animationEvents.VISON_DEATH, (data) => {
            this.stopAllAnimationsForModel('Vison');
            this.playAnimation('Vison', 'death', data);
        });

        EventBus.on(this.animationEvents.VISON_IDLE, (data) => {
            this.stopAllAnimationsForModel('Vison');
            this.playAnimation('Vison', 'idle', data);
        });

        // Écouteur pour les séquences d'animations
        EventBus.on(this.animationEvents.PLAY_ANIMATION_SEQUENCE, this._handleAnimationSequence.bind(this));

        // Écouteur pour arrêter toutes les animations
        EventBus.on(this.animationEvents.STOP_ALL_ANIMATIONS, this._handleStopAllAnimations.bind(this));

        // Écouteur pour les triggers personnalisés
        EventBus.on(this.animationEvents.CUSTOM_ANIMATION_TRIGGER, this._handleCustomAnimationTrigger.bind(this));
    }

    /**
     * Enregistre un modèle 3D et configure ses animations
     * @param {string} modelId - Identifiant unique du modèle
     * @param {THREE.Object3D} model - Le modèle 3D (généralement une scène GLB)
     * @param {Array} animations - Tableau des animations du modèle
     */
    registerModel(modelId, model, animations = []) {
        if (this.animationMixers.has(modelId)) {
            console.warn(`Modèle ${modelId} déjà enregistré, mise à jour...`);
            this._cleanupModel(modelId);
        }

        // Créer le mixer d'animation
        const mixer = new THREE.AnimationMixer(model);
        this.animationMixers.set(modelId, mixer);

        // Obtenir la configuration d'animations pour ce modèle
        const config = this.modelAnimationAssociations[modelId] || this.modelAnimationAssociations['*'];

        if (config && config.animations) {
            // Configurer chaque animation
            Object.entries(config.animations).forEach(([animKey, animConfig]) => {
                this._setupAnimation(modelId, animKey, animConfig, animations);
            });

            // Jouer les animations par défaut
            if (config.defaultAnimations) {
                config.defaultAnimations.forEach(animKey => {
                    const animConfig = config.animations[animKey];
                    if (animConfig && animConfig.autoplay) {
                        this.playAnimation(modelId, animKey);
                    }
                });
            }
        }

        console.log(`Modèle ${modelId} enregistré avec ${animations.length} animations disponibles`);
    }

    /**
     * Configure une animation spécifique
     */
    _setupAnimation(modelId, animKey, animConfig, availableAnimations) {
        const mixer = this.animationMixers.get(modelId);
        if (!mixer) return;

        // Chercher l'animation correspondante
        let targetClip = null;

        // Essayer de trouver par nom exact
        targetClip = availableAnimations.find(clip => clip.name === animConfig.animationName);

        // Si pas trouvé, essayer des variations courantes
        if (!targetClip) {
            const variations = [
                animConfig.animationName,
                `${animConfig.animationName}.001`,
                `${animConfig.animationName}.002`,
                'Action',
                'Action.001',
                'Scene'
            ];

            for (const variation of variations) {
                targetClip = availableAnimations.find(clip => clip.name === variation);
                if (targetClip) break;
            }
        }

        // Si toujours pas trouvé, prendre la première animation disponible
        if (!targetClip && availableAnimations.length > 0) {
            targetClip = availableAnimations[0];
            console.warn(`Animation "${animConfig.animationName}" introuvable pour ${modelId}, utilisation de "${targetClip.name}"`);
        }

        if (targetClip) {
            // Créer l'action d'animation
            const action = mixer.clipAction(targetClip);

            // Configurer l'action selon les paramètres
            if (animConfig.loop === false) {
                action.setLoop(THREE.LoopOnce);
            } else {
                action.setLoop(THREE.LoopRepeat);
            }

            action.clampWhenFinished = animConfig.clampWhenFinished || false;

            // Stocker la configuration pour usage ultérieur
            if (!this.modelAnimationConfig.has(modelId)) {
                this.modelAnimationConfig.set(modelId, new Map());
            }

            this.modelAnimationConfig.get(modelId).set(animKey, {
                action: action,
                config: animConfig,
                clip: targetClip
            });
        }
    }

    /**
     * Joue une animation spécifique
     * @param {string} modelId - ID du modèle
     * @param {string} animationKey - Clé de l'animation
     * @param {Object} options - Options supplémentaires
     */
    playAnimation(modelId, animationKey, options = {}) {
        const modelConfig = this.modelAnimationConfig.get(modelId);
        if (!modelConfig || !modelConfig.has(animationKey)) {
            console.warn(`Animation "${animationKey}" introuvable pour le modèle "${modelId}"`);
            return false;
        }

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
            // Boucle infinie
            action.setLoop(THREE.LoopRepeat, Infinity);
        } else if (loopCount === 0) {
            // Pas de boucle
            action.setLoop(THREE.LoopOnce);
        } else {
            // Nombre spécifique de boucles
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
        const onFinished = () => {
            mixer.removeEventListener('finished', onFinished);
            this.activeAnimations.delete(animationId);

            EventBus.trigger(this.animationEvents.MODEL_ANIMATION_COMPLETE, {
                modelId,
                animationKey,
                animationId
            });
        };

        mixer.addEventListener('finished', onFinished);

        console.log(`Animation "${animationKey}" démarrée pour le modèle "${modelId}" (ID: ${animationId})`);

        EventBus.trigger(this.animationEvents.MODEL_ANIMATION_START, {
            modelId,
            animationKey,
            animationId,
            timeScale,
            weight
        });

        return animationId;
    }

    /**
     * Arrête une animation spécifique
     */
    stopAnimation(modelId, animationKey, options = {}) {
        const modelConfig = this.modelAnimationConfig.get(modelId);
        if (!modelConfig || !modelConfig.has(animationKey)) {
            return false;
        }

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
    }

    /**
     * Arrête toutes les animations d'un modèle
     */
    stopAllAnimationsForModel(modelId) {
        const mixer = this.animationMixers.get(modelId);
        if (!mixer) return false;

        mixer.stopAllAction();

        // Nettoyer les animations actives
        for (const [animId, animInfo] of this.activeAnimations.entries()) {
            if (animInfo.modelId === modelId) {
                this.activeAnimations.delete(animId);
            }
        }

        console.log(`Toutes les animations arrêtées pour le modèle "${modelId}"`);
        return true;
    }

    /**
     * Met en pause une animation
     */
    pauseAnimation(modelId, animationKey) {
        const modelConfig = this.modelAnimationConfig.get(modelId);
        if (!modelConfig || !modelConfig.has(animationKey)) {
            return false;
        }

        const animData = modelConfig.get(modelId);
        animData.action.paused = true;

        EventBus.trigger(this.animationEvents.MODEL_ANIMATION_PAUSE, {
            modelId,
            animationKey
        });

        return true;
    }

    /**
     * Reprend une animation en pause
     */
    resumeAnimation(modelId, animationKey) {
        const modelConfig = this.modelAnimationConfig.get(modelId);
        if (!modelConfig || !modelConfig.has(animationKey)) {
            return false;
        }

        const animData = modelConfig.get(animationKey);
        animData.action.paused = false;

        EventBus.trigger(this.animationEvents.MODEL_ANIMATION_RESUME, {
            modelId,
            animationKey
        });

        return true;
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

            console.log(`Étape ${currentIndex + 1}/${sequence.length}: Joue "${animationKey}" pour ${duration ? duration + 'ms' : 'durée complète'}`);

            // Jouer l'animation
            const animationId = this.playAnimation(modelId, animationKey, step.options || {});

            if (duration) {
                // Arrêter après la durée spécifiée
                setTimeout(() => {
                    this.stopAnimation(modelId, animationKey);
                    currentIndex++;
                    playNext();
                }, duration);
            } else {
                // Attendre la fin naturelle de l'animation
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
        console.log(`Association ajoutée pour le modèle "${modelId}"`);
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

    _handleAnimationPause(data) {
        const { modelId, animationKey } = data;
        this.pauseAnimation(modelId, animationKey);
    }

    _handleAnimationResume(data) {
        const { modelId, animationKey } = data;
        this.resumeAnimation(modelId, animationKey);
    }

    _handleAnimationSequence(data) {
        const { modelId, sequence } = data;
        this.playAnimationSequence(modelId, sequence);
    }

    _handleStopAllAnimations(data) {
        if (data.modelId) {
            this.stopAllAnimationsForModel(data.modelId);
        } else {
            // Arrêter toutes les animations de tous les modèles
            for (const modelId of this.animationMixers.keys()) {
                this.stopAllAnimationsForModel(modelId);
            }
        }
    }

    _handleCustomAnimationTrigger(data) {
        const { modelId, animationKey, trigger, options } = data;

        console.log(`Trigger personnalisé "${trigger}" reçu pour ${modelId}:${animationKey}`);

        // Logique personnalisée basée sur le trigger
        switch (trigger) {
            case 'environmental_stress':
                // Exemple: stress environnemental déclenche une animation rapide
                this.playAnimation(modelId, animationKey, {
                    ...options,
                    timeScale: 2.0,
                    weight: 0.8
                });
                break;

            case 'death_sequence':
                // Exemple: séquence de mort
                this.stopAllAnimationsForModel(modelId);
                this.playAnimationSequence(modelId, [
                    { animation: 'idle', duration: 1000 },
                    { animation: 'death', options: { timeScale: 0.5 } }
                ]);
                break;

            default:
                this.playAnimation(modelId, animationKey, options);
        }
    }

    /**
     * Démarrer la boucle d'animation
     */
    _startAnimationLoop() {
        const animate = () => {
            if (!this.initialized) return;

            const delta = this.clock.getDelta();

            // Mettre à jour tous les mixers
            for (const mixer of this.animationMixers.values()) {
                mixer.update(delta);
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Nettoie un modèle
     */
    _cleanupModel(modelId) {
        // Arrêter toutes les animations du modèle
        this.stopAllAnimationsForModel(modelId);

        // Supprimer le mixer
        const mixer = this.animationMixers.get(modelId);
        if (mixer) {
            mixer.stopAllAction();
        }

        this.animationMixers.delete(modelId);
        this.modelAnimationConfig.delete(modelId);
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        for (const modelId of this.animationMixers.keys()) {
            this._cleanupModel(modelId);
        }

        this.activeAnimations.clear();
        this.initialized = false;

        console.log('ModelAnimationManager nettoyé');
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
}

// Créer et exporter l'instance singleton
export const modelAnimationManager = new ModelAnimationManager();

// Exposer les événements pour utilisation externe
export const ANIMATION_EVENTS = modelAnimationManager.animationEvents;

export default modelAnimationManager;