import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import sceneObjectManager from '../Config/SceneObjectManager';
import {EventBus, MARKER_EVENTS} from "../Utils/EventEmitter.jsx";
import {useAnimationFrame} from "../Utils/AnimationManager.js";
import {CameraAnimatorGLB} from './CameraAnimatorGLB';

const getChaptersWithDistances = () => {
    return [{
        id: 'firstStop',
        name: "Introduction",
        distance: getDistanceForChapter('firstStop'),
        completed: false
    }, {
        id: 'secondStop',
        name: "Forêt mystérieuse",
        distance: getDistanceForChapter('secondStop'),
        completed: false
    }, {
        id: 'thirdStop',
        name: "Découverte",
        distance: getDistanceForChapter('thirdStop'),
        completed: false
    }, {
        id: 'fourthStop',
        name: "Créatures",
        distance: getDistanceForChapter('fourthStop'),
        completed: false
    }, {
        id: 'fifthStop',
        name: "Exploration",
        distance: getDistanceForChapter('fifthStop'),
        completed: false
    }, {id: 'sixthStop', name: "Conclusion", distance: getDistanceForChapter('sixthStop'), completed: false}];
};

// Fonction pour récupérer la distance pour un chapitre donné
const getDistanceForChapter = (chapterId) => {
    return sceneObjectManager.getChapterDistance(chapterId);
};

// Utilisation de la fonction pour initialiser les chapitres
const CHAPTERS = getChaptersWithDistances();
const ACTIVE_CHAPTERS = CHAPTERS.filter(chapter => chapter.distance !== 0 && chapter.distance !== "none" && chapter.distance !== undefined);

// Paramètres de défilement
const MAX_SCROLL_SPEED = 0.02;
const DECELERATION = 0.95;
const MIN_VELOCITY = 0.005;
const BASE_SENSITIVITY = 0.05;
const SCROLL_NORMALIZATION_FACTOR = 0.2;

// Récupérer un paramètre de l'URL (pour permettre de démarrer à un chapitre spécifique)
const getStartChapterFromURL = () => {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const chapterId = urlParams.get('chapter');
        if (chapterId) {
            const chapterIndex = ACTIVE_CHAPTERS.findIndex(c => c.id === chapterId);
            if (chapterIndex >= 0) {
                let cumulativeDistance = 0;
                for (let i = 0; i <= chapterIndex; i++) {
                    cumulativeDistance += ACTIVE_CHAPTERS[i].distance;
                }
                return cumulativeDistance;
            }
        }
    }
    return 0; // Position de départ par défaut
};

export default function ScrollControls({children}) {
    return <CameraController>{children}</CameraController>;
}

function CameraController({children}) {
    const savedTargetPosition = useRef(null);
    const cameraAnimatorRef = useRef(null);
    const timelinePositionRef = useRef(0);
    const timelineLengthRef = useRef(0);
    const scrollVelocity = useRef(0);
    const flickerScrollBlockTimeoutRef = useRef(null);
    const scrollBlockedAt81Ref = useRef(false);
    const has81ThresholdBeenTriggeredRef = useRef(false);

    // CORRECTION: Déplacer visonTriggeredRef au niveau du composant
    const visonTriggeredRef = useRef(false);
    const visonRunTriggeredRef = useRef(false);

    // MODIFIÉ : Limitation du scroll arrière avec offset de sécurité
    const minAllowedPositionRef = useRef(0); // Position minimum de base (dernière étape validée)
    const maxProgressReachedRef = useRef(0); // Position maximale atteinte par l'utilisateur
    const SCROLL_SAFETY_OFFSET = 0.0; // Offset de sécurité pour éviter de revenir trop près de l'interaction
    const validatedPositionsRef = useRef([]); // Tableau des positions validées avec leurs offsets

    // NOUVEAU : Référence pour la dernière position normalisée émise
    const lastEmittedNormalizedPosition = useRef(-1);

    // NOUVEAU: Flag pour indiquer si une réinitialisation est en cours
    const isReinitializingRef = useRef(false);

    const [scrollDirection, setScrollDirection] = useState(0);
    const [showInteractionButton, setShowInteractionButton] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [currentCameraZ, setCurrentCameraZ] = useState(0);
    const [interactionStatus, setInteractionStatus] = useState({});
    const previousAllowScrollRef = useRef(true);
    const [currentChapter, setCurrentChapter] = useState(0);
    const [chapterTransitioning, setChapterTransitioning] = useState(false);
    const isTransitioningRef = useRef(false);
    const savedInteractionPosition = useRef(null);
    const handledInteractions = useRef(new Set());
    const scrollBackDisabledRef = useRef(false);

    // Pour suivre si l'initialisation de la caméra GLB est en cours/terminée
    const glbInitializedRef = useRef(false);

    const transitionQueue = useRef([]);
    const isProcessingTransition = useRef(false);
    const {size, camera, scene} = useThree();
    const {debug, updateDebugConfig, getDebugConfigValue, clickListener, cameraModel, cameraAnimation} = useStore();
    const [isAtEndOfScroll, setIsAtEndOfScroll] = useState(false);
    const [hasTriggeredEndSwitch, setHasTriggeredEndSwitch] = useState(false);
    const END_SCROLL_THRESHOLD = 0.85; // 92.5% du scroll considéré comme fin

    const endGroupVisible = useStore(state => state.endGroupVisible);
    const screenGroupVisible = useStore(state => state.screenGroupVisible);
    const setEndGroupVisible = useStore(state => state.setEndGroupVisible);
    const setScreenGroupVisible = useStore(state => state.setScreenGroupVisible);
    const isWaitingForInteraction = useStore(state => state.interaction?.waitingForInteraction);
    const allowScroll = useStore(state => state.interaction?.allowScroll !== false);
    const interactionStep = useStore(state => state.interaction?.currentStep);
    const completeInteraction = useStore(state => state.interaction?.completeInteraction);
    const setAllowScroll = useStore(state => state.interaction?.setAllowScroll);
    const setWaitingForInteraction = useStore(state => state.interaction?.setWaitingForInteraction);
    const setCurrentStep = useStore(state => state.interaction?.setCurrentStep);
    const setInteractionTarget = useStore(state => state.interaction?.setInteractionTarget);

    // Récupérer dynamiquement les points d'interaction depuis le SceneObjectManager
    const [interactions, setInteractions] = useState([]);

    // NOUVEAU: Fonction pour extraire et appliquer les paramètres de caméra depuis le modèle GLB
    const applyCameraParametersFromGLB = (model) => {
        if (!model || !camera) return;

        console.log("🎥 Extracting camera parameters from GLB model");

        try {
            // Chercher la caméra dans le modèle GLB
            let glbCamera = null;
            const scene = model.scene || model;

            scene.traverse((object) => {
                if (object.isCamera && !glbCamera) {
                    glbCamera = object;
                    console.log("🎥 Found camera in GLB:", object.name, "FOV:", object.fov);
                }
            });

            // Si pas de caméra trouvée, chercher un objet qui pourrait être une caméra
            if (!glbCamera) {
                scene.traverse((object) => {
                    if (object.name && object.name.toLowerCase().includes('camera') && !glbCamera) {
                        glbCamera = object;
                        console.log("🎥 Found camera-like object:", object.name);
                    }
                });
            }

            if (glbCamera) {
                // Appliquer les paramètres de la caméra GLB
                if (glbCamera.isCamera) {
                    console.log("🎥 Applying camera parameters from GLB:");
                    console.log("🎥 - FOV:", glbCamera.fov, "→", camera.fov);
                    console.log("🎥 - Near:", glbCamera.near, "→", camera.near);
                    console.log("🎥 - Far:", glbCamera.far, "→", camera.far);
                    console.log("🎥 - Aspect:", glbCamera.aspect, "→", camera.aspect);

                    camera.fov = glbCamera.fov || 24; // Valeur par défaut si pas de FOV
                    camera.near = glbCamera.near || 0.1;
                    camera.far = glbCamera.far || 1000;
                    camera.aspect = glbCamera.aspect || camera.aspect;
                    camera.zoom = glbCamera.zoom || 1;

                    // IMPORTANT: Mettre à jour la matrice de projection
                    camera.updateProjectionMatrix();

                    console.log("🎥 Camera parameters applied successfully. Final FOV:", camera.fov);
                } else if (glbCamera.fov !== undefined) {
                    // Si l'objet a des propriétés de caméra mais n'est pas une vraie caméra
                    console.log("🎥 Applying FOV from camera-like object:", glbCamera.fov);
                    camera.fov = glbCamera.fov;
                    camera.updateProjectionMatrix();
                }
            } else {
                console.warn("🎥 No camera found in GLB model, using default FOV");
                camera.fov = 30; // FOV par défaut
                camera.updateProjectionMatrix();
            }
        } catch (error) {
            console.error("🎥 Error extracting camera parameters:", error);
            // Appliquer des valeurs par défaut en cas d'erreur
            camera.fov = 30;
            camera.updateProjectionMatrix();
        }
    };

    // NOUVEAU: Fonction pour réinitialiser complètement le système de caméra
    const reinitializeCameraSystem = (model) => {
        if (isReinitializingRef.current) {
            console.log("🎥 Camera reinitialisation already in progress, skipping...");
            return;
        }

        isReinitializingRef.current = true;
        console.log("🎥 REINITIALIZING CAMERA SYSTEM...");

        try {
            // 1. Nettoyer l'animateur existant s'il y en a un
            if (cameraAnimatorRef.current) {
                console.log("🎥 Disposing existing camera animator");
                if (typeof cameraAnimatorRef.current.dispose === 'function') {
                    cameraAnimatorRef.current.dispose();
                }
                cameraAnimatorRef.current = null;
            }

            // 2. Réinitialiser les références
            glbInitializedRef.current = false;
            timelinePositionRef.current = 0;
            timelineLengthRef.current = 0;
            scrollVelocity.current = 0;

            // 3. Réinitialiser les limites de scroll
            minAllowedPositionRef.current = 0;
            maxProgressReachedRef.current = 0;
            validatedPositionsRef.current = [];

            // 4. Réinitialiser les triggers d'animation
            visonTriggeredRef.current = false;
            visonRunTriggeredRef.current = false;
            lastEmittedNormalizedPosition.current = -1;

            // 5. NOUVEAU: Appliquer les paramètres de caméra depuis le modèle GLB
            applyCameraParametersFromGLB(model);

            console.log("🎥 Camera system reset complete, initializing with model:", model);

            // 6. Initialiser avec le nouveau modèle après un court délai
            setTimeout(() => {
                initializeGLBAnimator(model);
                isReinitializingRef.current = false;
                console.log("🎥 Camera system reinitialisation complete");
            }, 100);

        } catch (error) {
            console.error("🎥 Error during camera system reinitialisation:", error);
            isReinitializingRef.current = false;
        }
    };

    // CORRIGÉ : Fonction pour calculer et émettre la position normalisée
    const emitNormalizedPosition = () => {
        if (timelineLengthRef.current > 0) {
            const normalizedPosition = Math.max(0, Math.min(1, timelinePositionRef.current / timelineLengthRef.current));

            if (Math.abs(normalizedPosition - lastEmittedNormalizedPosition.current) > 0.001) {
                lastEmittedNormalizedPosition.current = normalizedPosition;

                EventBus.trigger('timeline-position-normalized', {
                    position: normalizedPosition,
                    rawPosition: timelinePositionRef.current,
                    timelineLength: timelineLengthRef.current
                });

                const VISON_TRIGGER = 0.62;
                const SCREEN_TRIGGER = 0.23; //VisonRun

                if (normalizedPosition >= VISON_TRIGGER && !visonTriggeredRef.current) {
                    console.log("🦡 Déclenchement animation Vison à la position:", normalizedPosition);

                    visonTriggeredRef.current = true;

                    // Utiliser la nouvelle fonction globale
                    if (window.startAnimation) {
                        const success = window.startAnimation('Vison', 'animation_0');
                        console.log(`🦡 Animation Vison déclenchée: ${success}`);
                    }
                }
                if (normalizedPosition >= SCREEN_TRIGGER && !visonRunTriggeredRef.current) {
                    visonRunTriggeredRef.current = true;

                    // Utiliser la nouvelle fonction globale
                    if (window.startAnimation) {
                        const success = window.startAnimation('VisonRun', 'animation_0');
                        console.log(`🦡 Animation VisonRun déclenchée: ${success}`);
                    }
                }
            }
        }
    };

    // MODIFIÉ : Fonction pour mettre à jour la position minimale autorisée avec offset
    const updateMinAllowedPosition = (newPosition) => {
        if (newPosition > minAllowedPositionRef.current) {
            // Ajouter cette position à la liste des positions validées
            validatedPositionsRef.current.push({
                basePosition: newPosition,
                offsetPosition: newPosition + SCROLL_SAFETY_OFFSET,
                hasPassedOffset: false // On n'a pas encore dépassé l'offset
            });

            minAllowedPositionRef.current = newPosition;
            console.log(`Position minimale de base mise à jour : ${newPosition} (offset à ${newPosition + SCROLL_SAFETY_OFFSET})`);

            // Émettre un événement pour informer d'autres composants si nécessaire
            EventBus.trigger('min-scroll-position-updated', {
                minPosition: newPosition,
                offsetPosition: newPosition + SCROLL_SAFETY_OFFSET,
                previousMin: minAllowedPositionRef.current
            });
        }
    };

    // NOUVEAU : Fonction pour calculer la position effective de blocage
    const getEffectiveMinPosition = (currentPosition) => {
        let effectiveMin = 0; // Position minimale par défaut

        // Parcourir toutes les positions validées pour trouver la limite effective
        for (let validatedPos of validatedPositionsRef.current) {
            // Si on a déjà dépassé l'offset de cette position, utiliser l'offset comme limite
            if (validatedPos.hasPassedOffset && validatedPos.offsetPosition > effectiveMin) {
                effectiveMin = validatedPos.offsetPosition;
            }
            // Sinon, utiliser la position de base si elle est plus élevée
            else if (!validatedPos.hasPassedOffset && validatedPos.basePosition > effectiveMin) {
                effectiveMin = validatedPos.basePosition;
            }
        }

        return effectiveMin;
    };

    // NOUVEAU : Fonction pour mettre à jour les flags de dépassement d'offset
    const updateOffsetFlags = (currentPosition) => {
        for (let validatedPos of validatedPositionsRef.current) {
            // Si on dépasse l'offset d'une position et qu'on ne l'avait pas encore marqué
            if (!validatedPos.hasPassedOffset && currentPosition > validatedPos.offsetPosition) {
                validatedPos.hasPassedOffset = true;
                console.log(`Offset dépassé pour la position ${validatedPos.basePosition} (offset: ${validatedPos.offsetPosition})`);
            }
        }
    };

    // Fonction pour vérifier si une position est autorisée
    const isPositionAllowed = (position) => {
        const effectiveMin = getEffectiveMinPosition(position);

        // Vérifier s'il y a une restriction due à la flashlight
        const flashlightRestriction = validatedPositionsRef.current.find(pos => pos.reason === 'flashlight-activation');

        if (flashlightRestriction) {
            // Si la flashlight a été activée, bloquer complètement le retour en arrière
            return position >= flashlightRestriction.basePosition;
        }

        return position >= effectiveMin;
    };

    // Fonction pour limiter une position aux bornes autorisées
    const clampToAllowedRange = (position) => {
        const effectiveMinPos = getEffectiveMinPosition(position);
        const maxPos = timelineLengthRef.current;

        // Vérifier s'il y a une restriction due à la flashlight
        const flashlightRestriction = validatedPositionsRef.current.find(pos => pos.reason === 'flashlight-activation');

        if (flashlightRestriction) {
            // Si la flashlight a été activée, utiliser sa position comme minimum absolu
            const absoluteMin = flashlightRestriction.basePosition;
            return Math.max(absoluteMin, Math.min(maxPos, position));
        }

        return Math.max(effectiveMinPos, Math.min(maxPos, position));
    };

    // NOUVEAU: Écouter les événements de reload de caméra
    useEffect(() => {
        const handleCameraReload = (data) => {
            console.log("🎥 ScrollControls received camera reload event:", data);

            if (data && data.cameraModel) {
                console.log("🎥 Reinitializing camera system with reloaded model");
                reinitializeCameraSystem(data.cameraModel);
            } else {
                console.warn("🎥 Camera reload event received but no model provided");
            }
        };

        const handleForceReinitialize = (data) => {
            console.log("🎥 ScrollControls received force reinitialize event:", data);

            // Utiliser le modèle du store
            const currentModel = useStore.getState().cameraModel;
            if (currentModel) {
                console.log("🎥 Force reinitializing with current store model");
                reinitializeCameraSystem(currentModel);
            } else {
                console.warn("🎥 Force reinitialize requested but no model in store");
            }
        };

        // S'abonner aux événements
        const reloadSubscription = EventBus.on('camera-glb-reloaded', handleCameraReload);
        const forceReinitSubscription = EventBus.on('force-reinitialize-scroll-controls', handleForceReinitialize);

        return () => {
            reloadSubscription();
            forceReinitSubscription();
        };
    }, []);

    // Écouter les événements de chargement de la caméra GLB
    useEffect(() => {
        const handleCameraGLBLoaded = (data) => {
            if (cameraModel) {
                initializeGLBAnimator(cameraModel);
            }
        };

        const handleCameraAnimationLoaded = (data) => {
            if (cameraAnimatorRef.current && data.animation) {
                // Si nécessaire, réinitialiser l'animateur avec la nouvelle animation
            }
        };

        // S'abonner aux événements
        const cameraGLBSubscription = EventBus.on('camera-glb-loaded', handleCameraGLBLoaded);
        const cameraAnimationSubscription = EventBus.on('camera-animation-loaded', handleCameraAnimationLoaded);

        return () => {
            cameraGLBSubscription();
            cameraAnimationSubscription();
        };
    }, [cameraModel]);

    // Initialiser l'animateur de caméra GLB
    const initializeGLBAnimator = (model) => {
        if (!model || glbInitializedRef.current) return;

        // Éviter les réinitialisations multiples
        if (isReinitializingRef.current && glbInitializedRef.current) {
            console.log("🎥 GLB animator already initialized and reinitialisation in progress, skipping");
            return;
        }

        try {
            console.log("🎥 Initializing GLB animator with model:", model);

            if (model.scene && Array.isArray(model.animations)) {
                cameraAnimatorRef.current = new CameraAnimatorGLB(model, camera, 'Action.008');
            } else {
                cameraAnimatorRef.current = new CameraAnimatorGLB(model, camera, 'Action.008');
            }

            // Vérifier si l'initialisation a fonctionné
            if (cameraAnimatorRef.current.timelineLength > 0) {
                timelineLengthRef.current = cameraAnimatorRef.current.getLength();
                console.log("🎥 Camera animator initialized successfully, timeline length:", timelineLengthRef.current);
            } else {
                timelineLengthRef.current = 30; // Valeur par défaut de 30 secondes
                console.warn("🎥 Camera animator timeline length is 0, using default 30s");
            }

            // Déterminer la position de départ
            const startChapterPosition = getStartChapterFromURL();
            timelinePositionRef.current = startChapterPosition;

            // CORRIGÉ : Initialiser les limites de scroll correctement
            minAllowedPositionRef.current = 0; // Toujours permettre de revenir au début initialement
            maxProgressReachedRef.current = startChapterPosition;
            validatedPositionsRef.current = []; // Réinitialiser le tableau des positions validées

            cameraAnimatorRef.current.setPosition(startChapterPosition);

            // NOUVEAU : Émettre la position normalisée initiale
            emitNormalizedPosition();

            // NOUVEAU : Initialiser l'UI de debug si en mode debug
            if (debug?.active) {
                setTimeout(() => {
                    createDebugUI();
                    const normalizedPos = timelineLengthRef.current > 0 ?
                        startChapterPosition / timelineLengthRef.current : 0;
                    updateDebugIndicators(startChapterPosition, normalizedPos);
                    console.log('Debug UI: Initialisé avec position de départ');
                }, 100); // Petit délai pour s'assurer que l'interface est prête
            }

            // Exposer la fonction jumpToChapter globalement
            window.jumpToChapter = jumpToChapter;
            window.smoothJumpTo = smoothJumpTo;
            window.doJumpToChapter = doJumpToChapter;
            window.CHAPTERS = ACTIVE_CHAPTERS;

            // NOUVEAU : Exposer les fonctions de debug pour le système de scroll
            window.scrollDebug = {
                getValidatedPositions: () => validatedPositionsRef.current,
                getCurrentPosition: () => timelinePositionRef.current,
                getEffectiveMinPosition: () => getEffectiveMinPosition(timelinePositionRef.current),
                getMinAllowedPosition: () => minAllowedPositionRef.current,
                forceUpdateOffsetFlags: () => updateOffsetFlags(timelinePositionRef.current),
                getNormalizedPosition: () => timelinePositionRef.current / timelineLengthRef.current
            };

            // Créer l'interface de progression

            createDebugUI();

            // Configurer le scroll
            setupScrollHandlers();

            // Marquer comme initialisé
            glbInitializedRef.current = true;

            // Informer les autres composants que l'animateur est prêt
            EventBus.trigger('camera-animator-ready', {
                animator: cameraAnimatorRef.current
            });

            console.log("🎥 GLB camera animator initialization complete");
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de CameraAnimatorGLB:', error);
        }
    };

    // Initialiser l'animateur dès que la caméra ou le modèle est disponible
    useEffect(() => {
        if (camera && cameraModel && !glbInitializedRef.current && !isReinitializingRef.current) {
            console.log("🎥 Camera and model available, initializing GLB animator");
            initializeGLBAnimator(cameraModel);
        }

        return () => {
            cleanupUI();
        };
    }, [camera, cameraModel]);

    // NOUVEAU : Gérer l'affichage des indicateurs de debug quand le mode debug change
    useEffect(() => {
        if (debug?.active && glbInitializedRef.current) {
            // Créer l'interface de debug si elle n'existe pas
            console.log('Debug UI: Mode debug activé, création de l\'interface');
            createDebugUI();
            // Mettre à jour immédiatement les indicateurs
            const normalizedPos = timelineLengthRef.current > 0 ?
                timelinePositionRef.current / timelineLengthRef.current : 0;
            updateDebugIndicators(timelinePositionRef.current, normalizedPos);
        } else if (!debug?.active) {
            // Supprimer les éléments de debug si le mode debug est désactivé
            console.log('Debug UI: Mode debug désactivé, suppression de l\'interface');
            const debugElements = ['scroll-progress-counter', 'scroll-position-details'];
            debugElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                    console.log(`Debug UI: Élément ${id} supprimé`);
                }
            });
        }
    }, [debug?.active, glbInitializedRef.current]);

    // Fonction pour trouver un objet dans la scène par son nom
    const findObjectByName = (name) => {
        let targetObject = null;
        if (name && scene) {
            scene.traverse((object) => {
                if (object.name === name) {
                    targetObject = object;
                }
            });
        }
        return targetObject;
    };

    useEffect(() => {
        const handleFlashlightFirstActivation = (data) => {
            console.log('🔦 ScrollControls: Première activation de la flashlight - Enregistrement position minimale');

            // Au lieu de désactiver complètement le scroll arrière,
            // enregistrer la position actuelle comme position minimale autorisée
            const currentPosition = timelinePositionRef.current;

            // Ajouter cette position à la liste des positions validées avec marqueur spécial
            validatedPositionsRef.current.push({
                basePosition: currentPosition,
                offsetPosition: currentPosition + SCROLL_SAFETY_OFFSET,
                hasPassedOffset: false,
                reason: 'flashlight-activation', // Marqueur spécial pour la flashlight
                timestamp: Date.now()
            });

            // Mettre à jour la position minimale
            updateMinAllowedPosition(currentPosition);

            // Émettre un événement pour informer d'autres composants
            EventBus.trigger('scroll-back-limited-to-flashlight-position', {
                reason: 'flashlight-first-activation',
                minPosition: currentPosition,
                offsetPosition: currentPosition + SCROLL_SAFETY_OFFSET,
                timestamp: Date.now()
            });

            // Afficher un message de debug si nécessaire
            if (debug?.active) {
                console.log(`🔦 SCROLL ARRIÈRE LIMITÉ à partir de la position ${currentPosition.toFixed(2)}`);
            }
        };

        const flashlightActivationSubscription = EventBus.on('flashlight-first-activation', handleFlashlightFirstActivation);

        return () => {
            flashlightActivationSubscription();
        };
    }, [debug]);

    useEffect(() => {
        const handleFlashlightFlickerCompletelyFinished = (data) => {
            console.log('🎬 Fin complète du clignottement de la flashlight détectée, basculement vers screenGroup');
            console.log('🔦 Données du clignottement:', data);

            // Basculer de endGroup vers screenGroup UNIQUEMENT si les conditions sont bonnes
            if (endGroupVisible && !screenGroupVisible) {
                // Mettre à jour le store
                setEndGroupVisible(false);
                setScreenGroupVisible(true);

                // Mettre à jour directement les références DOM
                if (window.endGroupRef && window.endGroupRef.current) {
                    window.endGroupRef.current.visible = false;
                    console.log('✅ EndGroup caché (fin de clignottement)');
                }
                if (window.screenGroupRef && window.screenGroupRef.current) {
                    window.screenGroupRef.current.visible = true;
                    console.log('✅ ScreenGroup affiché (fin de clignottement)');
                }

                // Émettre les événements
                EventBus.trigger('end-group-visibility-changed', false);
                EventBus.trigger('screen-group-visibility-changed', true);

                console.log('🎬 Switch synchronisé avec fin de clignottement: endGroup→CACHÉ, screenGroup→VISIBLE');
            } else {
                console.log('🎬 Switch déjà effectué ou états inattendus:', {
                    endGroupVisible,
                    screenGroupVisible
                });
            }
        };

        // S'abonner à l'événement de fin complète du clignottement
        const flashlightFlickerSubscription = EventBus.on('flashlight-flicker-completely-finished', handleFlashlightFlickerCompletelyFinished);

        return () => {
            flashlightFlickerSubscription();
        };
    }, [endGroupVisible, screenGroupVisible, setEndGroupVisible, setScreenGroupVisible]);

    // Récupérer les points d'interaction
    useEffect(() => {
        const interactivePlacements = sceneObjectManager.getInteractivePlacements();

        const interactionPoints = interactivePlacements.map(placement => {
            return {
                id: placement.requiredStep,
                name: placement.markerText || sceneObjectManager.getStepText(placement.requiredStep),
                triggers: {
                    x: placement.position[0], z: placement.position[2]
                },
                isActive: true,
                objectKey: placement.objectKey
            };
        });

        setInteractions(interactionPoints);
    }, []);

    useEffect(() => {
        // Fonction pour gérer les événements d'interaction complète
        const handleInteractionComplete = (data) => {
            // Vérifier si une interface doit être affichée
            if (data.interfaceToShow) {
                const store = useStore.getState();

                // Afficher l'interface correspondante
                switch (data.interfaceToShow) {
                    case 'scanner':
                        if (store.interaction && typeof store.interaction.setShowScannerInterface === 'function') {
                            store.interaction.setShowScannerInterface(true);
                        }
                        break;
                    case 'capture':
                        if (store.interaction && typeof store.interaction.setShowCaptureInterface === 'function') {
                            store.interaction.setShowCaptureInterface(true);
                        }
                        break;
                    case 'blackScreen':
                        if (store.interaction && typeof store.interaction.setShowBlackscreenInterface === 'function') {
                            store.interaction.setShowBlackscreenInterface(true);
                        }
                        break;
                    default:
                        console.warn(`[EventListener] Type d'interface non reconnu: ${data.interfaceToShow}`);
                }
            }
        };

        // S'abonner aux événements d'interaction complète
        const subscription = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);

        // Nettoyage de l'abonnement lors du démontage
        return () => {
            subscription();
        };
    }, []);

    // Fonction pour vérifier les déclencheurs d'interaction
    const checkInteractionTriggers = (position) => {
        // Variable pour stocker l'interaction déclenchée
        let triggeredInteraction = null;

        // Récupérer la liste des interactions complétées
        const completedInteractions = useStore.getState().interaction.completedInteractions || {};

        // Définir une distance maximale
        const TRIGGER_PROXIMITY = 4.75;

        // Fonction utilitaire pour vérifier les prérequis d'une interaction
        const checkInteractionPrerequisites = (interaction) => {
            // Cas spécifique pour AnimalPaws (maintenu pour compatibilité)
            if (interaction.objectKey === 'AnimalPaws') {
                const leafErableCompleted = Object.keys(completedInteractions).some(key => key.includes('thirdStop') || key.includes('LeafErable'));

                if (!leafErableCompleted) {
                    return false;
                }
            }

            // Vérification générique des prérequis basée sur la configuration des objets
            const objectConfig = sceneObjectManager.getObjectFromCatalog(interaction.objectKey);

            if (objectConfig && Array.isArray(objectConfig.interaction) && objectConfig.interaction.length > 1) {
                // Trouver l'index de l'interaction actuelle
                const currentInteractionIndex = objectConfig.interaction.findIndex(config => config.requiredStep === interaction.id);

                // Si ce n'est pas la première interaction (index > 0), vérifier les prérequis
                if (currentInteractionIndex > 0) {
                    // Obtenir l'interaction précédente
                    const previousInteraction = objectConfig.interaction[currentInteractionIndex - 1];

                    // Vérifier si l'interaction précédente a été complétée
                    const previousStepCompleted = Object.keys(completedInteractions).some(key => key.includes(previousInteraction.requiredStep) || key === previousInteraction.requiredStep);

                    // Si l'interaction précédente n'a pas été complétée, ignorer cette interaction
                    if (!previousStepCompleted) {
                        return false;
                    }
                }
            }

            // Tous les prérequis sont satisfaits
            return true;
        };

        interactions.forEach(interaction => {
            // Ignorer les interactions déjà complétées
            if (!interaction.isActive || completedInteractions[interaction.id]) {
                return;
            }

            // Vérifier les prérequis avant de procéder
            if (!checkInteractionPrerequisites(interaction)) {
                return;
            }

            // Calculer la distance euclidienne 2D entre la position actuelle et le point de déclenchement
            const dx = position.x - interaction.triggers.x;
            const dz = position.z - interaction.triggers.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            // Si la distance est inférieure au seuil ET que le défilement est autorisé
            if (distance < TRIGGER_PROXIMITY && allowScroll && !chapterTransitioning) {
                // Stocker l'interaction déclenchée pour le log
                triggeredInteraction = interaction;

                // Récupérer l'objet associé à cette interaction
                const relatedObjectKey = interaction.objectKey;
                const placement = sceneObjectManager.getPlacements({
                    objectKey: relatedObjectKey, requiredStep: interaction.id
                })[0];

                // Trouver l'objet cible dans la scène si spécifié
                const targetObject = placement?.targetId ? findObjectByName(placement.targetId) : null;

                // Bloquer le défilement
                setAllowScroll(false);

                // Stocker la position actuelle de la timeline pour éviter tout mouvement
                const currentTimelinePosition = timelinePositionRef.current;

                // Ajouter un événement pour rétablir la position si nécessaire
                EventBus.trigger('interaction-position-saved', {
                    position: currentTimelinePosition, interactionId: interaction.id
                });

                // Indiquer que nous attendons une interaction de l'utilisateur
                setWaitingForInteraction(true);

                // Enregistrer l'étape actuelle
                setCurrentStep(interaction.id);

                // Stocker la référence à l'objet cible dans le store
                setInteractionTarget(targetObject);

                // Mettre à jour l'état local
                setInteractionStatus(prev => ({...prev, [interaction.id]: 'waiting'}));
            }
        });

        // Afficher le log uniquement si une interaction est déclenchée
        if (triggeredInteraction) {
            // Mettre à jour le chapitre actuel en fonction de l'interaction
            updateCurrentChapter();
        }
    };

    // Trouver le chapitre actuel en fonction de la position
    const updateCurrentChapter = () => {
        if (chapterTransitioning) return;

        // Utiliser la position actuelle ou sauvegardée pour le calcul
        const position = timelinePositionRef.current;
        let newChapterIndex = 0;
        let cumulativeDistance = 0;

        // Parcourir les chapitres pour déterminer lequel correspond à la position actuelle
        for (let i = 0; i < ACTIVE_CHAPTERS.length; i++) {
            cumulativeDistance += ACTIVE_CHAPTERS[i].distance;
            if (position < cumulativeDistance) {
                break;
            }
            newChapterIndex = i;
        }

        if (newChapterIndex !== currentChapter) {
            setCurrentChapter(newChapterIndex);

            // Marquer les chapitres précédents comme complétés
            const updatedACTIVE_CHAPTERS = [...ACTIVE_CHAPTERS];
            for (let i = 0; i <= newChapterIndex; i++) {
                updatedACTIVE_CHAPTERS[i].completed = true;
            }
        }
    };

    // Ajouter un écouteur pour le début d'interaction
    useEffect(() => {
        const interactionPositionSavedSubscription = EventBus.on('interaction-position-saved', (data) => {
            savedInteractionPosition.current = data.position;
        });

        const interactionCompleteSubscription = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, () => {
            // Ne pas réinitialiser savedInteractionPosition.current ici
        });

        return () => {
            interactionPositionSavedSubscription();
            interactionCompleteSubscription();
        };
    }, []);

    // MODIFIÉ : Écouter les interactions complétées pour mettre à jour la position minimale
    useEffect(() => {
        // Function that will be called when an interaction is completed
        const handleInteractionComplete = (data) => {
            const interactionId = data?.id || '';

            // Si cette interaction a déjà été traitée, ignorer
            if (handledInteractions.current.has(interactionId)) {
                return;
            }

            // Marquer cette interaction comme traitée
            handledInteractions.current.add(interactionId);

            // Réinitialiser après un délai
            setTimeout(() => {
                handledInteractions.current.delete(interactionId);
            }, 2000);

            // NOUVEAU : Enregistrer la position actuelle comme nouvelle position minimale autorisée
            const currentPosition = timelinePositionRef.current;
            updateMinAllowedPosition(currentPosition);

            // Traitement simplifié pour la transition après l'interaction
            setTimeout(() => {
                const stepId = interactionId.split('-')[0];
                const distanceToMove = sceneObjectManager.getChapterDistance(stepId);

                if (distanceToMove === 0) {
                    // Ajouter un événement explicite pour informer les autres systèmes
                    EventBus.trigger('no-transition-for-step', {
                        stepId: stepId, reason: 'zero-distance'
                    });

                    // Réactiver le défilement après un court délai
                    setTimeout(() => {
                        if (setAllowScroll) {
                            setAllowScroll(true);
                        }
                    }, 500);

                    return;
                }

                // Calculer la position cible
                const targetPosition = currentPosition + distanceToMove;

                // Effectuer la transition
                smoothJumpTo(targetPosition);

                // Notifier les autres composants
                EventBus.trigger('post-interaction-advancement', {
                    startPosition: currentPosition,
                    distance: distanceToMove,
                    targetPosition: targetPosition,
                    stepId: stepId
                });
            }, 1000);
        };

        // Set up multiple event listeners to catch the completion event however it's emitted
        const interactionCompleteSubscription1 = EventBus.on('INTERACTION_COMPLETE', handleInteractionComplete);
        const interactionCompleteSubscription2 = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);
        const interactionCompleteSubscription3 = EventBus.on('marker:interaction:complete', handleInteractionComplete);

        // Clean up listeners on unmount
        return () => {
            interactionCompleteSubscription1();
            interactionCompleteSubscription2();
            interactionCompleteSubscription3();
        };
    }, []);

    useEffect(() => {
        // Listen for chapter jump requests from the GUI
        const guiJumpSubscription = EventBus.on('gui-chapter-jump-initiated', (data) => {
            // Check if we're currently in a transition
            if (isTransitioningRef.current) {
                // Force reset transition state
                isTransitioningRef.current = false;
                setChapterTransitioning(false);
            }

            // Find the chapter index based on name
            const chapterIndex = ACTIVE_CHAPTERS.findIndex(chapter => chapter.name === data.chapterName);
            if (chapterIndex !== -1) {
                jumpToChapter(chapterIndex);
            }
        });

        // Listen for direct transition requests
        const directTransitionSubscription = EventBus.on('direct-transition-to-position', (data) => {
            // Force reset transition state
            isTransitioningRef.current = false;
            setChapterTransitioning(false);

            // Execute the transition
            smoothJumpTo(data.position);
        });

        return () => {
            guiJumpSubscription();
            directTransitionSubscription();
        };
    }, []);

    // Fonctions pour gérer le défilement et les transitions
    const smoothJumpTo = (targetPosition) => {
        // NOUVEAU : Vérifier si la position cible est autorisée avant d'ajouter à la queue
        const clampedPosition = clampToAllowedRange(targetPosition);

        if (clampedPosition !== targetPosition) {
            console.log(`Position cible ${targetPosition} limitée à ${clampedPosition} (position minimale: ${minAllowedPositionRef.current})`);
        }

        // Ajouter la transition à la file d'attente
        transitionQueue.current.push(clampedPosition);

        // Si une transition est déjà en cours, ne pas en démarrer une nouvelle
        if (isProcessingTransition.current) {
            return;
        }

        // Traiter la file d'attente de transitions
        processTransitionQueue();
    };

    // Fonction pour traiter les transitions en file d'attente une par une
    const processTransitionQueue = () => {
        // Si la file est vide, sortir
        if (transitionQueue.current.length === 0) {
            isProcessingTransition.current = false;
            return;
        }

        // Marquer qu'une transition est en cours
        isProcessingTransition.current = true;

        // Récupérer la prochaine position cible
        const targetPosition = transitionQueue.current[0];

        // NOUVEAU : Vérifier encore une fois que la position est autorisée
        const finalTargetPosition = clampToAllowedRange(targetPosition);

        // Désactiver explicitement la correction de position pendant cette transition
        const savedInteractionPositionBackup = savedInteractionPosition.current;
        savedInteractionPosition.current = null;

        // Marquer le début de la transition
        isTransitioningRef.current = true;
        setChapterTransitioning(true);

        // Réinitialiser la vélocité de défilement
        scrollVelocity.current = 0;

        // Sauvegarder les positions et rotations de départ et d'arrivée
        const startPosition = {...camera.position.clone()};
        const startRotation = {...camera.rotation.clone()};

        // Stocker la position actuelle pour restauration
        const currentTimelinePos = timelinePositionRef.current;

        // Créer un état temporaire pour la caméra
        const tempCamera = camera.clone();
        const originalPosition = camera.position.clone();
        const originalRotation = camera.rotation.clone();

        // Temporairement mettre à jour la position
        timelinePositionRef.current = finalTargetPosition;
        // Utiliser updateCamera pour calculer la nouvelle position
        const targetCameraState = cameraAnimatorRef.current.updateCamera();

        // Restaurer la caméra à sa position d'origine
        camera.position.copy(originalPosition);
        camera.rotation.copy(originalRotation);
        camera.updateMatrixWorld();

        // Restaurer la position initiale de la timeline
        timelinePositionRef.current = currentTimelinePos;

        // Maintenant nous avons les positions de départ et d'arrivée
        const endPosition = targetCameraState.position;
        const endRotation = targetCameraState.rotation;

        // Durée de la transition
        const DURATION = 2000; // 2 secondes
        const startTime = performance.now();

        // Fonction pour terminer la transition actuelle et passer à la suivante
        const finishCurrentTransition = () => {
            // Important: réinitialiser explicitement tous les drapeaux de transition
            isTransitioningRef.current = false;
            setChapterTransitioning(false);

            // Restaurer la position d'interaction si nécessaire
            if (savedInteractionPositionBackup !== null) {
                savedInteractionPosition.current = finalTargetPosition;
            }

            // Retirer la transition actuelle de la file
            transitionQueue.current.shift();

            // Vérifier à nouveau si nous pouvons traiter la file d'attente
            if (!isTransitioningRef.current && !chapterTransitioning) {
                processTransitionQueue();
            } else {
                // Forcer la réinitialisation des drapeaux si toujours actifs
                isTransitioningRef.current = false;
                setChapterTransitioning(false);
                processTransitionQueue();
            }
        };

        // Fonction d'animation qui sera appelée à chaque frame
        const animate = (time) => {
            // Si une interruption forcée a été demandée, il faut terminer proprement
            if (!isTransitioningRef.current) {
                // S'assurer que nous ne laissons pas la caméra dans un état intermédiaire
                timelinePositionRef.current = finalTargetPosition;
                cameraAnimatorRef.current.setPosition(finalTargetPosition);

                finishCurrentTransition();
                return;
            }

            // Calculer la progression (de 0 à 1)
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / DURATION, 1);

            // Interpolation linéaire directe des positions
            camera.position.x = startPosition.x + (endPosition.x - startPosition.x) * progress;
            camera.position.y = startPosition.y + (endPosition.y - startPosition.y) * progress;
            camera.position.z = startPosition.z + (endPosition.z - startPosition.z) * progress;

            // Interpolation linéaire des rotations
            camera.rotation.x = startRotation.x + (endRotation.x - startRotation.x) * progress;
            camera.rotation.y = startRotation.y + (endRotation.y - startRotation.y) * progress;
            camera.rotation.z = startRotation.z + (endRotation.z - startRotation.z) * progress;

            // Mettre à jour la matrice de la caméra
            camera.updateMatrixWorld();

            // Mettre à jour progressivement la position de la timeline
            timelinePositionRef.current = currentTimelinePos + (finalTargetPosition - currentTimelinePos) * progress;

            // NOUVEAU : Émettre la position normalisée pendant la transition
            emitNormalizedPosition();

            // Mettre à jour l'indicateur visuel de progression
            updateProgressIndicator(timelinePositionRef.current);

            // Continuer l'animation jusqu'à la fin
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation terminée
                // Fixer la position finale exacte
                timelinePositionRef.current = finalTargetPosition;
                cameraAnimatorRef.current.setPosition(finalTargetPosition);

                // NOUVEAU : Mettre à jour le progrès maximum atteint
                if (finalTargetPosition > maxProgressReachedRef.current) {
                    maxProgressReachedRef.current = finalTargetPosition;
                }

                // NOUVEAU : Émettre la position normalisée finale
                emitNormalizedPosition();

                // Notifier la fin de transition
                EventBus.trigger('distance-transition-complete', {
                    finalPosition: finalTargetPosition
                });

                EventBus.trigger('chapter-transition-complete', {
                    position: finalTargetPosition, finalPosition: finalTargetPosition
                });

                // Sauvegarder la position finale
                savedTargetPosition.current = finalTargetPosition;

                // Stocker la position finale comme position d'interaction uniquement si nécessaire
                if (savedInteractionPositionBackup !== null) {
                    savedInteractionPosition.current = finalTargetPosition;
                }

                // Réinitialiser les états après un court délai
                setAllowScroll(true);
                setChapterTransitioning(false);
                isTransitioningRef.current = false;

                // Terminer la transition actuelle et passer à la suivante
                finishCurrentTransition();
            }
        };

        // Démarrer l'animation
        requestAnimationFrame(animate);
    };

    const updateProgressIndicator = (position) => {
        const timelineLength = timelineLengthRef.current;
        const progressPercentage = timelineLength > 0 ? (position / timelineLength) * 100 : 0;

        const indicator = document.getElementById('progress-indicator');
        if (indicator) {
            indicator.style.width = `${progressPercentage}%`;
        }

        // NOUVEAU : Mettre à jour aussi les indicateurs de debug si actifs
        if (debug?.active && timelineLength > 0) {
            const normalizedPos = position / timelineLength;
            updateDebugIndicators(position, normalizedPos);
        }
    };

    // Fix for the jumpToChapter function
    const jumpToChapter = (index) => {
        if (index >= 0 && index < ACTIVE_CHAPTERS.length) {
            const chapter = ACTIVE_CHAPTERS[index];
            const distanceToMove = sceneObjectManager.getChapterDistance(chapter.id);

            // Si une transition est déjà en cours, forcer sa réinitialisation
            if (isTransitioningRef.current || chapterTransitioning) {
                // Forcer la réinitialisation complète de toutes les transitions
                EventBus.trigger('force-reset-all-transitions');

                doJumpToChapter(distanceToMove);
                return true;
            } else {
                return doJumpToChapter(distanceToMove);
            }
        } else {
            console.error(`Index de distance invalide: ${index}`);
            return false;
        }
    };

    function doJumpToChapter(distance) {
        // Sauvegarder l'état actuel avant toute opération
        const wasWaitingForInteraction = isWaitingForInteraction;

        // Récupérer la position actuelle comme point de départ
        const currentPosition = timelinePositionRef.current;
        // Calculer la position cible en ajoutant la distance
        const targetPosition = currentPosition + distance;

        // Si nous étions en attente d'interaction, désactiver temporairement cet état
        if (wasWaitingForInteraction) {
            setWaitingForInteraction(false);
        }

        // Désactiver le scroll pendant la transition
        if (setAllowScroll) {
            setAllowScroll(false);
        }

        // Nettoyer les transitions précédentes si nécessaire
        // Vider complètement la file d'attente existante
        transitionQueue.current = [];
        isProcessingTransition.current = false;
        isTransitioningRef.current = false;
        setChapterTransitioning(false);

        // Notifier du début de la transition
        EventBus.trigger('distance-transition-started', {
            startPosition: currentPosition, distance: distance, targetPosition: targetPosition
        });

        // Suspendre temporairement la correction de position
        const savedInteractionPositionBackup = savedInteractionPosition.current;
        savedInteractionPosition.current = null;

        // Effectuer la transition fluide
        smoothJumpTo(targetPosition);

        return true;
    }

    // MODIFIÉ : Animation frame avec limitation du scroll arrière et émission de position
    useAnimationFrame(() => {
        if (!camera || !cameraAnimatorRef.current) return;

        const cameraPosition = {
            x: camera.position.x, y: camera.position.y, z: camera.position.z
        };

        setCurrentCameraZ(cameraPosition.z);

        // Vérifier les déclencheurs d'interaction
        checkInteractionTriggers(cameraPosition);

        // 1. Calcul du mouvement - uniquement si le défilement est autorisé
        if (Math.abs(scrollVelocity.current) > MIN_VELOCITY && allowScroll && !chapterTransitioning) {
            // Calculer la nouvelle position potentielle
            const potentialNewPosition = timelinePositionRef.current + scrollVelocity.current;

            // Vérifier si la nouvelle position est autorisée seulement pour le mouvement arrière
            if (scrollVelocity.current < 0) { // Mouvement arrière
                if (isPositionAllowed(potentialNewPosition)) {
                    timelinePositionRef.current = potentialNewPosition;
                } else {
                    // Bloquer le mouvement arrière en limitant à la position effective minimale
                    const effectiveMin = getEffectiveMinPosition(timelinePositionRef.current);
                    timelinePositionRef.current = effectiveMin;
                    scrollVelocity.current = 0; // Arrêter la vélocité pour éviter les rebonds
                    console.log(`Scroll arrière bloqué à la position effective ${effectiveMin}`);
                }
            } else {
                // Mouvement avant : toujours autorisé
                timelinePositionRef.current = potentialNewPosition;

                // Mettre à jour le progrès maximum si on avance
                if (potentialNewPosition > maxProgressReachedRef.current) {
                    maxProgressReachedRef.current = potentialNewPosition;
                }

                // NOUVEAU : Mettre à jour les flags de dépassement d'offset
                updateOffsetFlags(potentialNewPosition);
            }

            // Décelération de la vélocité (seulement si on n'a pas forcé à 0)
            if (scrollVelocity.current !== 0) {
                scrollVelocity.current *= DECELERATION;
            }
        }

        // 2. Bornes et application
        if (!allowScroll && savedInteractionPosition.current !== null) {
            // Si nous sommes en interaction, forcer la position sauvegardée
            timelinePositionRef.current = savedInteractionPosition.current;
        } else {
            // MODIFIÉ : Limiter la position dans les bornes autorisées (pas seulement 0 à max)
            timelinePositionRef.current = clampToAllowedRange(timelinePositionRef.current);
        }

        // 3. Toujours appliquer la position au CameraAnimator
        cameraAnimatorRef.current.setPosition(timelinePositionRef.current);

        // NOUVEAU : Émettre la position normalisée à chaque frame
        emitNormalizedPosition();

        // Mettre à jour l'indicateur de progression (qui inclut les indicateurs de debug)
        updateProgressIndicator(timelinePositionRef.current);

        // Détection de la fin du scroll
        const scrollProgress = timelinePositionRef.current / timelineLengthRef.current;
        if (scrollProgress >= 0.81 && !has81ThresholdBeenTriggeredRef.current) {
            console.log('🚫 Scroll bloqué à 81% pendant 2 secondes');
            has81ThresholdBeenTriggeredRef.current = true;
            scrollBlockedAt81Ref.current = true;

            setTimeout(() => {
                console.log('✅ Scroll débloqué après 2 secondes');
                scrollBlockedAt81Ref.current = false;
            }, 2000);
        }
        const isNowAtEnd = scrollProgress >= END_SCROLL_THRESHOLD;

        // Mettre à jour l'état uniquement s'il change pour éviter des re-rendus inutiles
        if (isNowAtEnd !== isAtEndOfScroll) {
            setIsAtEndOfScroll(isNowAtEnd);
        }

        // Faire le switch seulement quand on atteint la fin du scroll pour la première fois
        // if (isNowAtEnd && !hasTriggeredEndSwitch) {
        //     console.log('🎬 Fin du scroll détectée, basculement vers screenGroup');
        //
        //     // Basculer de endGroup vers screenGroup
        //     if (endGroupVisible && !screenGroupVisible) {
        //         // Mettre à jour le store
        //         setEndGroupVisible(false);
        //         setScreenGroupVisible(true);
        //
        //         // Mettre à jour directement les références DOM
        //         if (window.endGroupRef && window.endGroupRef.current) {
        //             window.endGroupRef.current.visible = false;
        //             console.log('✅ EndGroup caché');
        //         }
        //         if (window.screenGroupRef && window.screenGroupRef.current) {
        //             window.screenGroupRef.current.visible = true;
        //             console.log('✅ ScreenGroup affiché');
        //         }
        //
        //         // Émettre les événements
        //         EventBus.trigger('end-group-visibility-changed', false);
        //         EventBus.trigger('screen-group-visibility-changed', true);
        //
        //         console.log('🎬 Switch terminé: endGroup→CACHÉ, screenGroup→VISIBLE');
        //     }
        //
        //     setHasTriggeredEndSwitch(true);
        //
        //     // Réinitialiser le déclencheur après un délai
        //     setTimeout(() => {
        //         setHasTriggeredEndSwitch(false);
        //     }, 3000);
        // }

    }, 'camera');

    // Fonction pour configurer les gestionnaires d'événements de défilement
    const setupScrollHandlers = () => {
        let lastWheelTimestamp = 0;
        let recentWheelEvents = [];
        const MAX_WHEEL_SAMPLES = 5;

        const normalizeWheelDelta = (e) => {
            const now = performance.now();
            recentWheelEvents.push({
                deltaY: e.deltaY, timestamp: now, deltaMode: e.deltaMode
            });

            if (recentWheelEvents.length > MAX_WHEEL_SAMPLES) {
                recentWheelEvents.shift();
            }

            const timeDelta = lastWheelTimestamp ? now - lastWheelTimestamp : 0;
            lastWheelTimestamp = now;

            let normalizedDelta;

            if (e.deltaMode === 1) {
                normalizedDelta = e.deltaY * 20;
            } else if (e.deltaMode === 2) {
                normalizedDelta = e.deltaY * 500;
            } else {
                normalizedDelta = e.deltaY;
            }

            const isHighPrecision = e.deltaMode === 0 && Math.abs(normalizedDelta) < 10;

            if (isHighPrecision) {
                normalizedDelta *= 2;
            }

            const timeCoefficient = timeDelta > 0 && timeDelta < 100 ? 100 / timeDelta : 1;

            return normalizedDelta * SCROLL_NORMALIZATION_FACTOR * Math.min(timeCoefficient, 2);
        };

        let touchStartY = 0;
        let lastTouchY = 0;

        const handleTouchStart = (e) => {
            if (!allowScroll || chapterTransitioning) return;
            touchStartY = e.touches[0].clientY;
            lastTouchY = touchStartY;
        };

        const handleTouchMove = (e) => {
            if (scrollBlockedAt81Ref.current) {
                e.preventDefault();
                return;
            }

            if (!allowScroll || chapterTransitioning) return;

            const currentY = e.touches[0].clientY;
            const deltaY = lastTouchY - currentY;
            lastTouchY = currentY;

            const direction = Math.sign(deltaY);

            // Si le scroll arrière est désactivé et qu'on essaie de scroller vers l'arrière, ignorer complètement
            if (scrollBackDisabledRef.current && direction > 0) { // direction > 0 = swipe vers le haut = scroll arrière
                console.log('🚫 Touch scroll arrière ignoré - flashlight activée');
                e.preventDefault();
                return; // Sortir complètement, ne pas traiter l'événement
            }

            const magnitude = Math.abs(deltaY) * BASE_SENSITIVITY * 1.5;
            const cappedMagnitude = Math.min(magnitude, MAX_SCROLL_SPEED);

            // Vérifier si le mouvement arrière est autorisé
            if (direction < 0) { // Scroll arrière
                const potentialPosition = timelinePositionRef.current + (direction * cappedMagnitude);
                if (!isPositionAllowed(potentialPosition)) {
                    // Bloquer le mouvement arrière
                    return;
                }
            }

            scrollVelocity.current = direction * cappedMagnitude;

            e.preventDefault();
        };

        const handleWheel = (e) => {
            if (scrollBlockedAt81Ref.current) {
                e.preventDefault();
                return;
            }

            if (!allowScroll || chapterTransitioning) {
                console.log('🚫 Scroll bloqué:', {
                    allowScroll,
                    chapterTransitioning,
                    reason: !allowScroll ? 'scroll-disabled' : 'chapter-transitioning'
                });
                e.preventDefault();
                return;
            }

            const normalizedDelta = normalizeWheelDelta(e);
            const direction = Math.sign(normalizedDelta);
            setScrollDirection(direction);

            if (scrollBackDisabledRef.current && direction < 0) {
                console.log('🚫 Scroll arrière ignoré - flashlight activée');
                e.preventDefault();
                return;
            }

            let scrollMagnitude = Math.abs(normalizedDelta) * BASE_SENSITIVITY;
            const cappedMagnitude = Math.min(scrollMagnitude, MAX_SCROLL_SPEED);

            // Vérifier si le mouvement arrière est autorisé
            if (direction < 0) { // Scroll arrière
                const potentialPosition = timelinePositionRef.current + (direction * cappedMagnitude);
                if (!isPositionAllowed(potentialPosition)) {
                    e.preventDefault();
                    return;
                }
            }

            scrollVelocity.current = direction * cappedMagnitude;
            e.preventDefault();
        };

        const canvasElement = document.querySelector('canvas');
        if (canvasElement) {
            canvasElement.addEventListener('wheel', handleWheel, {passive: false});
            canvasElement.addEventListener('touchstart', handleTouchStart, {passive: false});
            canvasElement.addEventListener('touchmove', handleTouchMove, {passive: false});
        }
    };

    // Créer UI pour les progrès généraux
    const createProgressUI = () => {
        // Barre de progression en bas de l'écran
        if (!document.getElementById('timeline-progress')) {
            const progressBar = document.createElement('div');
            progressBar.id = 'timeline-progress';
            progressBar.style.position = 'fixed';
            progressBar.style.bottom = '10px';
            progressBar.style.left = '10px';
            progressBar.style.right = '10px';
            progressBar.style.height = '4px';
            progressBar.style.backgroundColor = 'rgba(255,255,255,0.2)';
            progressBar.style.borderRadius = '2px';
            progressBar.style.zIndex = '100';

            const progressIndicator = document.createElement('div');
            progressIndicator.id = 'progress-indicator';
            progressIndicator.style.height = '100%';
            progressIndicator.style.width = '0%';
            progressIndicator.style.backgroundColor = 'white';
            progressIndicator.style.borderRadius = '2px';
            progressIndicator.style.transition = 'width 0.05s ease-out';

            progressBar.appendChild(progressIndicator);
            document.body.appendChild(progressBar);
            console.log('UI: Barre de progression créée');
        }
    };

    // NOUVEAU : Créer UI pour le debug en mode développeur
    const createDebugUI = () => {
        if (!debug?.active) return;

        // Compteur de progression en bas à gauche
        if (!document.getElementById('scroll-progress-counter')) {
            const progressCounter = document.createElement('div');
            progressCounter.id = 'scroll-progress-counter';
            progressCounter.style.position = 'fixed';
            progressCounter.style.bottom = '20px';
            progressCounter.style.right = '20px';
            progressCounter.style.padding = '12px 16px';
            progressCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            progressCounter.style.color = '#00ff88';
            progressCounter.style.fontFamily = 'Monaco, "Lucida Console", monospace';
            progressCounter.style.fontSize = '16px';
            progressCounter.style.fontWeight = 'bold';
            progressCounter.style.borderRadius = '8px';
            progressCounter.style.border = '2px solid rgba(0, 255, 136, 0.3)';
            progressCounter.style.zIndex = '150';
            progressCounter.style.minWidth = '180px';
            progressCounter.style.textAlign = 'center';
            progressCounter.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
            progressCounter.style.backdropFilter = 'blur(4px)';
            progressCounter.textContent = '0.0%';
            document.body.appendChild(progressCounter);
        }

        // Indicateur de position absolue (optionnel, plus détaillé)
        if (!document.getElementById('scroll-position-details')) {
            const positionDetails = document.createElement('div');
            positionDetails.id = 'scroll-position-details';
            positionDetails.style.position = 'fixed';
            positionDetails.style.bottom = '70px';
            positionDetails.style.right = '20px';
            positionDetails.style.padding = '8px 12px';
            positionDetails.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            positionDetails.style.color = '#cccccc';
            positionDetails.style.fontFamily = 'Monaco, "Lucida Console", monospace';
            positionDetails.style.fontSize = '12px';
            positionDetails.style.borderRadius = '4px';
            positionDetails.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            positionDetails.style.zIndex = '149';
            positionDetails.style.maxWidth = '250px';
            positionDetails.style.wordWrap = 'break-word';
            positionDetails.innerHTML = 'Pos: 0.00 / 0.00<br>Min: 0.00';
            document.body.appendChild(positionDetails);
        }
    };

    // NOUVEAU : Mettre à jour les indicateurs de debug
    const updateDebugIndicators = (currentPosition, normalizedPosition) => {
        if (!debug?.active) return;

        // Mettre à jour le compteur de progression principal
        const progressCounter = document.getElementById('scroll-progress-counter');
        if (progressCounter) {
            const percentage = (normalizedPosition * 100).toFixed(1);
            progressCounter.textContent = `${percentage}%`;

            // Changer la couleur en fonction du progrès
            if (normalizedPosition < 0.2) {
                progressCounter.style.color = '#ff6b6b'; // Rouge pour début
                progressCounter.style.borderColor = 'rgba(255, 107, 107, 0.3)';
            } else if (normalizedPosition < 0.6) {
                progressCounter.style.color = '#ffd93d'; // Jaune pour milieu
                progressCounter.style.borderColor = 'rgba(255, 217, 61, 0.3)';
            } else {
                progressCounter.style.color = '#00ff88'; // Vert pour fin
                progressCounter.style.borderColor = 'rgba(0, 255, 136, 0.3)';
            }
        }

        // Mettre à jour les détails de position
        const positionDetails = document.getElementById('scroll-position-details');
        if (positionDetails) {
            const timelineLength = timelineLengthRef.current;
            const effectiveMin = getEffectiveMinPosition(currentPosition);
            positionDetails.innerHTML =
                `Pos: ${currentPosition.toFixed(2)} / ${timelineLength.toFixed(2)}<br>` +
                `Min: ${effectiveMin.toFixed(2)} | Max: ${maxProgressReachedRef.current.toFixed(2)}`;
        }
    };

    const cleanupUI = () => {
        // Supprimer tous les éléments d'interface créés
        [
            'scroll-debug-indicator',
            'interaction-button',
            'countdown-element',
            'timeline-progress',
            'interaction-instruction',
            'chapter-navigation',
            'scroll-progress-counter',      // NOUVEAU
            'scroll-position-details'       // NOUVEAU
        ].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });

        // Nettoyer les écouteurs d'événements
        const canvasElement = document.querySelector('canvas');
        if (canvasElement) {
            // Note: Ces gestionnaires sont définis dans setupScrollHandlers,
            // nous devrions idéalement les stocker dans des refs pour un nettoyage précis
            canvasElement.removeEventListener('wheel', () => {
            });
            canvasElement.removeEventListener('touchstart', () => {
            });
            canvasElement.removeEventListener('touchmove', () => {
            });
        }
    };

    return (<>
        {children}
    </>);
}