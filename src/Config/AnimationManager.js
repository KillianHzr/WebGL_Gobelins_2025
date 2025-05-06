import * as THREE from 'three';
import { EventBus } from '../Utils/EventEmitter';
import { MARKER_EVENTS } from '../Utils/EventEmitter.jsx';
import useStore from '../Store/useStore';

/**
 * Gestionnaire d'animations pour les interactions du scénario
 * Permet de déclencher des animations spécifiques sur des objets de la scène
 */
class AnimationManager {
    constructor() {
        this.animations = {};
        this.activeAnimations = new Map();
        this.initialized = false;
        this.scene = null;
        this.camera = null;
    }

    /**
     * Initialise le gestionnaire d'animations
     * @param {THREE.Scene} scene - La scène Three.js
     * @param {THREE.Camera} camera - La caméra Three.js
     */
    init(scene, camera) {
        if (this.initialized) return;

        this.scene = scene;
        this.camera = camera;

        // Initialiser les animations comme un objet vide
        this.animations = {};
        this.activeAnimations = new Map();

        // Configurer les animations prédéfinies
        this._setupAnimations();

        // Configurer l'écoute des événements d'animation
        this._setupEventListeners();

        this.initialized = true;

        console.log('AnimationManager initialized with scene and camera', {
            sceneExists: !!scene,
            cameraExists: !!camera,
            animationsSetup: Object.keys(this.animations).length
        });
    }

    /**
     * Configure les animations prédéfinies disponibles
     */
    _setupAnimations() {
        // Animations existantes - Maintenant jump-animation utilise l'avancement timeline
        this.registerAnimation('jump-animation', this._createTimelineAdvanceAnimation);
        this.registerAnimation('leaf-scatter', this._createLeafScatterAnimation);
        this.registerAnimation('river-jump', this._createRiverJumpAnimation);
        this.registerAnimation('duck-animation', this._createDuckAnimation);
        this.registerAnimation('camera-flash', this._createCameraFlashAnimation);
        this.registerAnimation('camera-zoom', this._createCameraZoomAnimation);

        // Avancement dans la timeline
        this.registerAnimation('timeline-advance', this._createTimelineAdvanceAnimation);
    }

    /**
     * Configure les écouteurs d'événements d'animation
     */
    _setupEventListeners() {
        // Écouter les événements d'animation
        EventBus.on(MARKER_EVENTS.INTERACTION_ANIMATION, this._handleAnimationEvent.bind(this));
    }

    /**
     * Gère les événements d'animation
     * @param {Object} data - Données de l'événement d'animation
     */
    _handleAnimationEvent(data) {
        console.log('Animation event received:', data);

        const { id, animationName, animationOptions, targetObject } = data;

        // Vérifier si l'animation existe
        if (!this.animations[animationName]) {
            console.warn(`Animation "${animationName}" not found`);
            return;
        }

        // Trouver l'objet cible
        let target = null;

        if (targetObject) {
            // Utiliser l'objet cible spécifié
            target = targetObject;
        } else if (id) {
            // Chercher l'objet dans la scène par son nom ou son ID
            target = this._findObjectByName(id);

            if (!target) {
                console.warn(`Target object for animation "${animationName}" not found with id "${id}"`);
                // Utiliser un objet vide comme fallback UNIQUEMENT pour les animations qui en ont besoin
                // Pour timeline-advance, on n'a pas toujours besoin d'un target
                if (animationName !== 'timeline-advance' || (animationName === 'timeline-advance' && id)) {
                    target = new THREE.Object3D();
                    target.name = `animation-target-${id}`;
                    this.scene.add(target);
                }
            }
        }

        // AJOUT IMPORTANT: Vérifier si une animation timeline-advance est déjà en cours
        if (animationName === 'timeline-advance' || animationName === 'jump-animation') {
            // Vérifier si des animations de même type sont déjà actives
            let animationsOfSameTypeActive = false;

            for (const [id, animation] of this.activeAnimations.entries()) {
                if (id.startsWith('timeline-advance-') || id.startsWith('jump-animation-')) {
                    console.log(`Une animation d'avancement est déjà active: ${id} - Annulation du nouveau déclenchement`);
                    animationsOfSameTypeActive = true;
                    break;
                }
            }

            if (animationsOfSameTypeActive) {
                console.warn(`Animation "${animationName}" non déclenchée car une animation similaire est déjà en cours`);
                return;
            }

            // Annuler les animations contradictoires
            this._cancelAnimationsByType(['timeline-advance', 'jump-animation']);
        }

        // Créer et démarrer l'animation en appelant la fonction d'animation
        const animationFunction = this.animations[animationName];
        if (typeof animationFunction !== 'function') {
            console.error(`Animation "${animationName}" is not a function`);
            return;
        }

        try {
            // Appel direct de la fonction d'animation
            const animation = animationFunction(target, animationOptions || {});

            // Stocker l'animation active
            if (animation) {
                const animationId = `${animationName}-${id || 'global'}-${Date.now()}`;
                this.activeAnimations.set(animationId, animation);
                console.log(`Animation démarrée et stockée avec ID: ${animationId}`);

                // Configurer le nettoyage automatique
                if (animation.duration) {
                    setTimeout(() => {
                        this._cleanupAnimation(animationId);
                    }, animation.duration * 1000 + 100); // Ajouter un délai supplémentaire par sécurité
                }
            }
        } catch (error) {
            console.error(`Error starting animation "${animationName}":`, error);
        }
    }

    /**
     * Annule les animations du type spécifié
     * @param {Array<string>} animationTypes - Liste des types d'animations à annuler
     */
    _cancelAnimationsByType(animationTypes) {
        for (const [id, animation] of this.activeAnimations.entries()) {
            const [animationType] = id.split('-');
            if (animationTypes.includes(animationType) && animation.cancel) {
                console.log(`Cancelling existing animation: ${id}`);
                animation.cancel();
                this.activeAnimations.delete(id);
            }
        }
    }

    /**
     * Trouve un objet dans la scène par son nom ou son ID
     * @param {string} name - Nom ou ID de l'objet à rechercher
     * @returns {THREE.Object3D|null} - L'objet trouvé ou null
     */
    _findObjectByName(name) {
        if (!this.scene) return null;

        let result = null;

        this.scene.traverse((object) => {
            // Vérifier les correspondances exactes
            if (object.name === name || object.userData.id === name) {
                result = object;
                return;
            }

            // Vérifier les correspondances partielles
            if ((object.name && object.name.includes(name)) ||
                (object.userData.id && object.userData.id.includes(name))) {
                result = object;
            }
        });

        return result;
    }

    /**
     * Nettoie une animation terminée
     * @param {string} animationId - ID de l'animation à nettoyer
     */
    _cleanupAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);

        if (animation && animation.cleanup) {
            try {
                animation.cleanup();
            } catch (error) {
                console.error(`Error cleaning up animation ${animationId}:`, error);
            }
        }

        this.activeAnimations.delete(animationId);
    }

    /**
     * Crée une animation d'avancement automatique dans la timeline
     * @param {THREE.Object3D} target - Objet cible (peut être null dans ce cas)
     * @param {Object} options - Options de l'animation
     * @returns {Object} - Objet d'animation avec méthodes de contrôle
     */
    // In AnimationManager.js - Improve the _createTimelineAdvanceAnimation function
    _createTimelineAdvanceAnimation(target, options = {}) {
        if (!this.scene) return null;

        const duration = options.duration || 2.0; // Duration in seconds

        // Get store and timeline information
        const store = this.scene.userData.storeInstance;
        if (!store) {
            console.error("Store not available for timeline advancement animation");
            return null;
        }

        // Get Theatre.js sheet and sequence
        const sheet = this.scene.userData.theatreSheet;
        if (!sheet) {
            console.error("Theatre.js sheet not available");
            return null;
        }

        // Use explicit positions if provided, otherwise calculate them
        let currentPosition, finalPosition;

        if (options.startPosition !== undefined && options.targetPosition !== undefined) {
            // Use provided positions
            currentPosition = options.startPosition;
            finalPosition = options.targetPosition;
        } else {
            // Calculate positions
            currentPosition = sheet.sequence.position;
            const sequenceLength = store.sequenceLength || 1;
            const advancePercentage = options.percentage || 10; // Default to 10% advancement
            const advanceAmount = (sequenceLength * advancePercentage) / 100;
            finalPosition = Math.min(currentPosition + advanceAmount, sequenceLength);
        }

        // Mark animation in progress in the store
        store.setAnimationInProgress(true);

        // Important: Disable scroll during animation to prevent conflicts
        if (store.interaction && store.interaction.setAllowScroll) {
            store.interaction.setAllowScroll(false);
        }

        // Animation variables
        let startTime = Date.now();
        let animationFrame = null;
        let completed = false;
        let canceled = false;

        // Animation function
        const animate = () => {
            if (canceled) return;

            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / duration, 1);

            // Easing function for smoother movement
            const easeProgress = easeInOutCubic(progress);

            // Calculate new position
            const newPosition = currentPosition + (finalPosition - currentPosition) * easeProgress;

            // Apply new position to timeline
            try {
                // Update the Theatre.js timeline position
                sheet.sequence.position = newPosition;

                // Update store references to keep everything in sync
                if (store.setTimelinePosition) {
                    store.setTimelinePosition(newPosition);
                }

                // Important: Also update the lastProcessedPosition in the interaction state
                // This ensures the scroll control doesn't block the animation progress
                if (store.interaction && store.interaction._lastProcessedPosition !== undefined) {
                    store.interaction._lastProcessedPosition = newPosition;
                }
            } catch (error) {
                console.error("Error updating timeline position:", error);
                canceled = true;
            }

            // Continue animation until end
            if (progress < 1 && !canceled) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation completed
                completed = true;

                // Get final position from Theatre.js
                const actualFinalPosition = sheet.sequence.position;

                // Ensure store references are updated with final position
                if (store.setTimelinePosition) {
                    store.setTimelinePosition(actualFinalPosition);
                }

                // Critical: Update lastProcessedPosition to final position
                if (store.interaction && store.interaction._lastProcessedPosition !== undefined) {
                    store.interaction._lastProcessedPosition = actualFinalPosition;
                }

                // Emit event with EXACT final position
                EventBus.trigger('animation:complete', {
                    name: 'timeline-advance',
                    target: target ? target.name || target.uuid : null,
                    finalPosition: actualFinalPosition,
                    originalTarget: finalPosition,
                    // Add a lock flag to prevent position changes
                    lockPosition: true
                });

                // Reset animation state
                store.setAnimationInProgress(false);

                // Now re-enable scroll after a short delay
                setTimeout(() => {
                    if (store.interaction && store.interaction.setAllowScroll) {
                        store.interaction.setAllowScroll(true);
                    }
                }, 200); // Short delay to prevent immediate scrolling
            }
        };

        // Cubic easing function
        const easeInOutCubic = (t) => {
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        // Start animation
        animationFrame = requestAnimationFrame(animate);

        // Return animation object with control methods
        return {
            duration,
            cancel: () => {
                if (!completed && !canceled && animationFrame) {
                    canceled = true;
                    cancelAnimationFrame(animationFrame);

                    // Ensure animation state is properly reset
                    store.setAnimationInProgress(false);

                    // Re-enable scrolling
                    if (store.interaction && store.interaction.setAllowScroll) {
                        store.interaction.setAllowScroll(true);
                    }
                }
            },
            cleanup: () => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
            }
        };
    }

    /**
     * Enregistre une nouvelle animation
     * @param {string} name - Nom de l'animation
     * @param {Function} createFunction - Fonction de création de l'animation
     */
    registerAnimation(name, createFunction) {
        if (this.animations[name]) {
            console.warn(`Animation "${name}" already registered, overwriting`);
        }

        // Store the function directly without binding
        this.animations[name] = (target, options) => {
            return createFunction.call(this, target, options);
        };
    }

    /**
     * Crée une animation de saut sur des pierres pour traverser la rivière
     * @param {THREE.Object3D} target - Objet cible de l'animation (première pierre)
     * @param {Object} options - Options de l'animation
     * @returns {Object} - Objet d'animation avec méthodes de contrôle
     */
    _createRiverJumpAnimation(target, options = {}) {
        if (!target || !this.scene || !this.camera) return null;

        const duration = options.duration || 0.8; // Durée en secondes
        const height = options.height || 1.2; // Hauteur du saut

        // Position initiale
        const initialPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };

        // Position de la pierre cible
        const targetPosition = new THREE.Vector3();
        target.getWorldPosition(targetPosition);

        // Obtenir le store depuis scene.userData
        const store = this.scene.userData.storeInstance;

        // Désactiver temporairement le scroll
        if (store && store.interaction) {
            store.interaction.setAllowScroll(false);
        }

        // Variables de l'animation
        let startTime = Date.now();
        let animationFrame = null;
        let completed = false;
        let canceled = false;

        // Fonction d'animation
        const animate = () => {
            if (canceled) return;

            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / duration, 1);

            // Courbe d'animation pour le saut (parabole)
            const jumpCurve = Math.sin(progress * Math.PI) * height;

            // Interpolation de la position
            this.camera.position.x = initialPosition.x + (targetPosition.x - initialPosition.x) * progress;
            this.camera.position.y = initialPosition.y + jumpCurve;
            this.camera.position.z = initialPosition.z + (targetPosition.z - initialPosition.z) * progress;

            // Continuer l'animation jusqu'à la fin
            if (progress < 1 && !canceled) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation terminée
                completed = true;

                // Réactiver le scroll
                if (store && store.interaction && !canceled) {
                    store.interaction.setAllowScroll(true);
                }

                // Émettre un événement de fin d'animation
                if (!canceled) {
                    EventBus.trigger('animation:complete', {
                        name: 'river-jump',
                        target: target.name || target.uuid
                    });
                }
            }
        };

        // Démarrer l'animation
        animationFrame = requestAnimationFrame(animate);

        // Retourner l'objet d'animation avec méthodes de contrôle
        return {
            duration,
            cancel: () => {
                if (!completed && !canceled && animationFrame) {
                    canceled = true;
                    cancelAnimationFrame(animationFrame);

                    // Réactiver le scroll
                    if (store && store.interaction) {
                        store.interaction.setAllowScroll(true);
                    }
                }
            },
            cleanup: () => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
            }
        };
    }

    /**
     * Crée une animation de passage sous une branche
     * @param {THREE.Object3D} target - Objet cible de l'animation
     * @param {Object} options - Options de l'animation
     * @returns {Object} - Objet d'animation avec méthodes de contrôle
     */
    _createDuckAnimation(target, options = {}) {
        if (!target || !this.scene || !this.camera) return null;

        const duration = options.duration || 1.0; // Durée en secondes

        // Position initiale
        const initialPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };

        // Position finale
        const targetPosition = new THREE.Vector3();
        target.getWorldPosition(targetPosition);

        // Ajouter un décalage pour passer sous la branche
        const direction = new THREE.Vector3().subVectors(targetPosition, this.camera.position).normalize();
        const finalPosition = {
            x: targetPosition.x + direction.x * 3,
            y: initialPosition.y,
            z: targetPosition.z + direction.z * 3
        };

        // Obtenir le store depuis scene.userData
        const store = this.scene.userData.storeInstance;

        // Désactiver temporairement le scroll
        if (store && store.interaction) {
            store.interaction.setAllowScroll(false);
        }

        // Variables de l'animation
        let startTime = Date.now();
        let animationFrame = null;
        let completed = false;
        let canceled = false;

        // Fonction d'animation
        const animate = () => {
            if (canceled) return;

            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / duration, 1);

            // Courbe d'animation pour le mouvement vertical (accroupissement)
            const duckCurve = Math.sin(progress * Math.PI) * -0.8; // Valeur négative pour aller vers le bas

            // Interpolation de la position
            this.camera.position.x = initialPosition.x + (finalPosition.x - initialPosition.x) * progress;
            this.camera.position.y = initialPosition.y + duckCurve;
            this.camera.position.z = initialPosition.z + (finalPosition.z - initialPosition.z) * progress;

            // Continuer l'animation jusqu'à la fin
            if (progress < 1 && !canceled) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation terminée
                completed = true;

                // Réactiver le scroll
                if (store && store.interaction && !canceled) {
                    store.interaction.setAllowScroll(true);
                }

                // Émettre un événement de fin d'animation
                if (!canceled) {
                    EventBus.trigger('animation:complete', {
                        name: 'duck-animation',
                        target: target.name || target.uuid
                    });
                }
            }
        };

        // Démarrer l'animation
        animationFrame = requestAnimationFrame(animate);

        // Retourner l'objet d'animation avec méthodes de contrôle
        return {
            duration,
            cancel: () => {
                if (!completed && !canceled && animationFrame) {
                    canceled = true;
                    cancelAnimationFrame(animationFrame);

                    // Réactiver le scroll
                    if (store && store.interaction) {
                        store.interaction.setAllowScroll(true);
                    }
                }
            },
            cleanup: () => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
            }
        };
    }

    /**
     * Crée une animation de flash d'appareil photo
     * @param {THREE.Object3D} target - Objet cible de l'animation
     * @param {Object} options - Options de l'animation
     * @returns {Object} - Objet d'animation avec méthodes de contrôle
     */
    _createCameraFlashAnimation(target, options = {}) {
        if (!this.scene) return null;

        const duration = options.duration || 0.5; // Durée en secondes
        const intensity = options.intensity || 3.0; // Intensité du flash

        // Créer un rectangle blanc couvrant l'écran entier
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });

        const flashGeometry = new THREE.PlaneGeometry(2, 2);
        const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);

        // Positionner le flash devant la caméra
        flashMesh.position.z = -1;

        // Créer une caméra orthographique pour le flash
        const flashCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        flashCamera.position.z = 0;

        // Créer une scène pour le flash
        const flashScene = new THREE.Scene();
        flashScene.add(flashMesh);

        // Ajouter le rendu de la scène de flash comme overlay
        const originalRenderFunction = this.scene.userData.originalRenderFunction;
        const renderer = this.scene.userData.renderer;

        if (!originalRenderFunction || !renderer) {
            console.warn('Cannot create camera flash animation: missing renderer or original render function');
            return null;
        }

        // Variables de l'animation
        let startTime = Date.now();
        let animationFrame = null;
        let completed = false;
        let canceled = false;

        // Nouvelle fonction de rendu avec flash
        const renderWithFlash = () => {
            // Rendu de la scène principale
            originalRenderFunction();

            // Rendu du flash en overlay
            renderer.autoClear = false;
            renderer.render(flashScene, flashCamera);
            renderer.autoClear = true;
        };

        // Remplacer la fonction de rendu
        this.scene.userData.renderFunction = renderWithFlash;

        // Fonction d'animation
        const animate = () => {
            if (canceled) {
                // Si annulé, restaurer immédiatement la fonction de rendu originale
                this.scene.userData.renderFunction = originalRenderFunction;
                return;
            }

            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / duration, 1);

            // Courbe d'animation pour le flash (rapide montée, lente descente)
            let flashCurve;
            if (progress < 0.2) {
                // Montée rapide
                flashCurve = progress * 5 * intensity;
            } else {
                // Descente plus lente
                flashCurve = (1 - (progress - 0.2) / 0.8) * intensity;
            }

            // Mettre à jour l'opacité du flash
            flashMaterial.opacity = flashCurve;

            // Continuer l'animation jusqu'à la fin
            if (progress < 1 && !canceled) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation terminée
                completed = true;

                // Restaurer la fonction de rendu originale
                this.scene.userData.renderFunction = originalRenderFunction;

                // Nettoyer les ressources
                flashScene.remove(flashMesh);
                flashGeometry.dispose();
                flashMaterial.dispose();

                // Émettre un événement de fin d'animation
                if (!canceled) {
                    EventBus.trigger('animation:complete', {
                        name: 'camera-flash'
                    });
                }
            }
        };

        // Démarrer l'animation
        animationFrame = requestAnimationFrame(animate);

        // Retourner l'objet d'animation avec méthodes de contrôle
        return {
            duration,
            cancel: () => {
                if (!completed && !canceled) {
                    canceled = true;
                    if (animationFrame) {
                        cancelAnimationFrame(animationFrame);
                    }

                    // Restaurer la fonction de rendu originale
                    this.scene.userData.renderFunction = originalRenderFunction;

                    // Nettoyer les ressources
                    flashScene.remove(flashMesh);
                    flashGeometry.dispose();
                    flashMaterial.dispose();
                }
            },
            cleanup: () => {
                // Restaurer la fonction de rendu originale si nécessaire
                if (this.scene.userData.renderFunction === renderWithFlash) {
                    this.scene.userData.renderFunction = originalRenderFunction;
                }

                // Nettoyer les ressources si elles existent encore
                if (flashMesh.parent) {
                    flashScene.remove(flashMesh);
                    flashGeometry.dispose();
                    flashMaterial.dispose();
                }

                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
            }
        };
    }

    /**
     * Crée une animation de zoom de caméra vers un objet
     * @param {THREE.Object3D} target - Objet cible de l'animation
     * @param {Object} options - Options de l'animation
     * @returns {Object} - Objet d'animation avec méthodes de contrôle
     */
    _createCameraZoomAnimation(target, options = {}) {
        if (!target || !this.scene || !this.camera) return null;

        const duration = options.duration || 2.0; // Durée en secondes
        const zoomLevel = options.zoomLevel || 2.0; // Niveau de zoom
        const lookAt = options.lookAt !== undefined ? options.lookAt : true; // Regarder la cible

        // Position et rotation initiales
        const initialPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };

        const initialRotation = {
            x: this.camera.rotation.x,
            y: this.camera.rotation.y,
            z: this.camera.rotation.z
        };

        // Position de la cible
        const targetPosition = new THREE.Vector3();
        target.getWorldPosition(targetPosition);

        // Direction vers la cible
        const direction = new THREE.Vector3().subVectors(targetPosition, this.camera.position).normalize();

        // Position finale (zoom vers la cible)
        const finalPosition = {
            x: this.camera.position.x + direction.x * zoomLevel,
            y: this.camera.position.y + direction.y * zoomLevel,
            z: this.camera.position.z + direction.z * zoomLevel
        };

        // Obtenir le store depuis scene.userData
        const store = this.scene.userData.storeInstance;

        // Désactiver temporairement le scroll
        if (store && store.interaction) {
            store.interaction.setAllowScroll(false);
        }

        // Calculer la rotation finale si lookAt est activé
        let finalRotation = { ...initialRotation };
        if (lookAt) {
            // Créer une caméra temporaire pour calculer la rotation
            const tempCamera = this.camera.clone();
            tempCamera.position.copy(finalPosition);
            tempCamera.lookAt(targetPosition);

            finalRotation = {
                x: tempCamera.rotation.x,
                y: tempCamera.rotation.y,
                z: tempCamera.rotation.z
            };
        }

        // Variables de l'animation
        let startTime = Date.now();
        let animationFrame = null;
        let completed = false;
        let canceled = false;

        // Fonction d'animation
        const animate = () => {
            if (canceled) return;

            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / duration, 1);

            // Fonction d'easing pour un mouvement plus fluide
            const easeProgress = easeInOutCubic(progress);

            // Interpolation de la position
            this.camera.position.x = initialPosition.x + (finalPosition.x - initialPosition.x) * easeProgress;
            this.camera.position.y = initialPosition.y + (finalPosition.y - initialPosition.y) * easeProgress;
            this.camera.position.z = initialPosition.z + (finalPosition.z - initialPosition.z) * easeProgress;

            // Interpolation de la rotation
            if (lookAt) {
                this.camera.rotation.x = initialRotation.x + (finalRotation.x - initialRotation.x) * easeProgress;
                this.camera.rotation.y = initialRotation.y + (finalRotation.y - initialRotation.y) * easeProgress;
                this.camera.rotation.z = initialRotation.z + (finalRotation.z - initialRotation.z) * easeProgress;
            }

            // Continuer l'animation jusqu'à la fin
            if (progress < 1 && !canceled) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation terminée
                completed = true;

                // Réactiver le scroll uniquement si l'option le permet
                if (!options.keepScrollDisabled && store && store.interaction && !canceled) {
                    store.interaction.setAllowScroll(true);
                }

                // Émettre un événement de fin d'animation
                if (!canceled) {
                    EventBus.trigger('animation:complete', {
                        name: 'camera-zoom',
                        target: target.name || target.uuid
                    });
                }
            }
        };

        // Fonction d'easing cubic
        const easeInOutCubic = (t) => {
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        // Démarrer l'animation
        animationFrame = requestAnimationFrame(animate);

        // Retourner l'objet d'animation avec méthodes de contrôle
        return {
            duration,
            cancel: () => {
                if (!completed && !canceled && animationFrame) {
                    canceled = true;
                    cancelAnimationFrame(animationFrame);

                    // Réactiver le scroll
                    if (store && store.interaction) {
                        store.interaction.setAllowScroll(true);
                    }
                }
            },
            cleanup: () => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
            }
        };
    }
}

// Exporter une instance unique (singleton)
export const animationManager = new AnimationManager();

// Ajouter l'instance à window pour pouvoir y accéder facilement depuis la console
if (typeof window !== 'undefined') {
    window.animationManager = animationManager;
}

export default animationManager;