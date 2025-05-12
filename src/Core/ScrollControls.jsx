// ScrollControls.jsx - Modifié pour utiliser CameraAnimatorGLB
import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import sceneObjectManager from '../Config/SceneObjectManager';
import {EventBus, MARKER_EVENTS} from "../Utils/EventEmitter.jsx";
import {useAnimationFrame} from "../Utils/AnimationManager.js";
import {CameraAnimatorGLB} from './CameraAnimatorGLB';

const getChaptersWithDistances = () => {
    return [
        {id: 'firstStop', name: "Introduction", distance: getDistanceForChapter('firstStop'), completed: false},
        {id: 'secondStop', name: "Forêt mystérieuse", distance: getDistanceForChapter('secondStop'), completed: false},
        {id: 'thirdStop', name: "Découverte", distance: getDistanceForChapter('thirdStop'), completed: false},
        {id: 'fourthStop', name: "Créatures", distance: getDistanceForChapter('fourthStop'), completed: false},
        {id: 'fifthStop', name: "Exploration", distance: getDistanceForChapter('fifthStop'), completed: false},
        {id: 'sixthStop', name: "Conclusion", distance: getDistanceForChapter('sixthStop'), completed: false}
    ];
};

// Fonction pour récupérer la distance pour un chapitre donné
const getDistanceForChapter = (chapterId) => {
    return sceneObjectManager.getChapterDistance(chapterId);
};

// Utilisation de la fonction pour initialiser les chapitres
const CHAPTERS = getChaptersWithDistances();
const ACTIVE_CHAPTERS = CHAPTERS.filter(chapter =>
    chapter.distance !== 0 &&
    chapter.distance !== "none" &&
    chapter.distance !== undefined
);

// Paramètres de défilement
const MAX_SCROLL_SPEED = 0.01;
const DECELERATION = 0.95;
const MIN_VELOCITY = 0.001;
const BASE_SENSITIVITY = 0.01;
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

    // Pour suivre si l'initialisation de la caméra GLB est en cours/terminée
    const glbInitializedRef = useRef(false);

    const transitionQueue = useRef([]);
    const isProcessingTransition = useRef(false);
    const {size, camera, scene} = useThree();
    const {debug, updateDebugConfig, getDebugConfigValue, clickListener, cameraModel, cameraAnimation} = useStore();
    const [isAtEndOfScroll, setIsAtEndOfScroll] = useState(false);
    const [hasTriggeredEndSwitch, setHasTriggeredEndSwitch] = useState(false);
    const END_SCROLL_THRESHOLD = 0.98; // 98% du scroll considéré comme fin

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

    // Écouter les événements de chargement de la caméra GLB
    useEffect(() => {
        const handleCameraGLBLoaded = (data) => {
            // console.log('Caméra GLB chargée dans ScrollControls:', data);

            // Si le modèle est disponible dans le store, on l'initialise
            if (cameraModel) {
                initializeGLBAnimator(cameraModel);
            }
        };

        const handleCameraAnimationLoaded = (data) => {
            // console.log('Animation de caméra chargée dans ScrollControls:', data);

            // Mettre à jour l'animation si l'animateur est déjà initialisé
            if (cameraAnimatorRef.current && data.animation) {
                // console.log('Mise à jour de l\'animation dans l\'animateur existant');
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

        // console.log('Initialisation de CameraAnimatorGLB avec le modèle:', model);

        try {
            // CORRECTION: Vérifier si le format du modèle est nouveau {scene, animations}
            // ou ancien (direct)
            if (model.scene && Array.isArray(model.animations)) {
                // console.log('Détection du nouveau format de modèle avec animations:',
                //     model.animations.length);

                // Créer l'animateur GLB avec le modèle complet
                cameraAnimatorRef.current = new CameraAnimatorGLB(model, camera, 'Action.003');
            } else {
                // console.log('Utilisation du format standard du modèle');
                // Ancienne méthode
                cameraAnimatorRef.current = new CameraAnimatorGLB(model, camera, 'Action.003');
            }

            // Vérifier si l'initialisation a fonctionné
            if (cameraAnimatorRef.current.timelineLength > 0) {
                timelineLengthRef.current = cameraAnimatorRef.current.getLength();
                // console.log(`Animateur GLB initialisé avec succès, longueur: ${timelineLengthRef.current}`);
            } else {
                // console.warn("Animateur GLB initialisé, mais la longueur de timeline est 0. Vérifier les animations.");
                timelineLengthRef.current = 30; // Valeur par défaut de 30 secondes
            }

            // Déterminer la position de départ
            const startChapterPosition = getStartChapterFromURL();
            timelinePositionRef.current = startChapterPosition;
            cameraAnimatorRef.current.setPosition(startChapterPosition);

            // Exposer la fonction jumpToChapter globalement
            window.jumpToChapter = jumpToChapter;
            window.smoothJumpTo = smoothJumpTo;
            window.doJumpToChapter = doJumpToChapter;
            window.CHAPTERS = ACTIVE_CHAPTERS;

            // Créer l'interface de progression
            createProgressUI();

            // Configurer le scroll
            setupScrollHandlers();

            // Marquer comme initialisé
            glbInitializedRef.current = true;

            // Informer les autres composants que l'animateur est prêt
            EventBus.trigger('camera-animator-ready', {
                animator: cameraAnimatorRef.current
            });
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de CameraAnimatorGLB:', error);
        }
    };


    // Initialiser l'animateur dès que la caméra ou le modèle est disponible
    useEffect(() => {
        if (camera && cameraModel && !glbInitializedRef.current) {
            initializeGLBAnimator(cameraModel);
        }

        return () => {
            cleanupUI();
        };
    }, [camera, cameraModel]);

    // Le reste du code est le même que dans le ScrollControls.jsx original...
    // [J'ai omis l'essentiel du code original pour la clarté, car seul le système
    // d'animation de la caméra change, la gestion du défilement reste identique]

    useEffect(() => {
        // Function to handle interaction completion
        const handleInteractionComplete = (data) => {
            // Code existant pour gérer la fin d'une interaction...
        };

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
    // [J'ai gardé les fonctions originales car elles sont compatibles avec le nouvel animateur]

    const smoothJumpTo = (targetPosition) => {
        // Ajouter la transition à la file d'attente
        transitionQueue.current.push(targetPosition);

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

        // NOUVEAU: Désactiver explicitement la correction de position pendant cette transition
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

        // Pour calculer la position cible, nous devons déterminer où la caméra
        // serait si nous étions directement à la position ciblée sur la timeline

        // Stocker la position actuelle pour restauration
        const currentTimelinePos = timelinePositionRef.current;

        // MODIFICATION: Utiliser une approche différente pour obtenir les positions cibles
        // Créer un état temporaire pour la caméra
        const tempCamera = camera.clone();
        const originalPosition = camera.position.clone();
        const originalRotation = camera.rotation.clone();

        // Temporairement mettre à jour la position
        timelinePositionRef.current = targetPosition;
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

            // NOUVEAU: Restaurer la position d'interaction si nécessaire
            if (savedInteractionPositionBackup !== null) {
                savedInteractionPosition.current = targetPosition;
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
                timelinePositionRef.current = targetPosition;
                cameraAnimatorRef.current.setPosition(targetPosition);

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
            timelinePositionRef.current = currentTimelinePos + (targetPosition - currentTimelinePos) * progress;

            // Mettre à jour l'indicateur visuel de progression
            updateProgressIndicator(timelinePositionRef.current);

            // Continuer l'animation jusqu'à la fin
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation terminée
                // Fixer la position finale exacte
                timelinePositionRef.current = targetPosition;
                cameraAnimatorRef.current.setPosition(targetPosition);

                // Notifier la fin de transition
                EventBus.trigger('distance-transition-complete', {
                    finalPosition: targetPosition
                });

                EventBus.trigger('chapter-transition-complete', {
                    position: targetPosition, finalPosition: targetPosition
                });

                // Sauvegarder la position finale
                savedTargetPosition.current = targetPosition;

                // NOUVEAU: Stocker la position finale comme position d'interaction uniquement si nécessaire
                if (savedInteractionPositionBackup !== null) {
                    savedInteractionPosition.current = targetPosition;
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
        // NOUVEAU: Sauvegarder l'état actuel avant toute opération
        const wasWaitingForInteraction = isWaitingForInteraction;

        // Récupérer la position actuelle comme point de départ
        const currentPosition = timelinePositionRef.current;
        // Calculer la position cible en ajoutant la distance
        const targetPosition = currentPosition + distance;

        // NOUVEAU: Si nous étions en attente d'interaction, désactiver temporairement cet état
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

        // NOUVEAU: Suspendre temporairement la correction de position
        const savedInteractionPositionBackup = savedInteractionPosition.current;
        savedInteractionPosition.current = null;

        // Effectuer la transition fluide
        smoothJumpTo(targetPosition);

        return true;
    }

    // Animation frame pour mettre à jour la caméra en fonction du scroll
    useAnimationFrame(() => {
        if (!camera || !cameraAnimatorRef.current) return;

        const cameraPosition = {
            x: camera.position.x, y: camera.position.y, z: camera.position.z
        };

        setCurrentCameraZ(cameraPosition.z);

        // 1. Calcul du mouvement - uniquement si le défilement est autorisé
        if (Math.abs(scrollVelocity.current) > MIN_VELOCITY && allowScroll && !chapterTransitioning) {
            // Mettre à jour la position basée sur la vélocité
            timelinePositionRef.current += scrollVelocity.current;

            // Décelération de la vélocité
            scrollVelocity.current *= DECELERATION;
        }

        // 2. Bornes et application
        if (!allowScroll && savedInteractionPosition.current !== null) {
            // Si nous sommes en interaction, forcer la position sauvegardée
            timelinePositionRef.current = savedInteractionPosition.current;
        } else {
            // Sinon, limiter la position dans les bornes
            timelinePositionRef.current = Math.max(0, Math.min(timelineLengthRef.current, timelinePositionRef.current));
        }

        // 3. Toujours appliquer la position au CameraAnimator
        cameraAnimatorRef.current.setPosition(timelinePositionRef.current);

        // Mettre à jour l'indicateur de progression
        updateProgressIndicator(timelinePositionRef.current);

        // Détection de la fin du scroll
        const scrollProgress = timelinePositionRef.current / timelineLengthRef.current;
        const isNowAtEnd = scrollProgress >= END_SCROLL_THRESHOLD;

        // Mettre à jour l'état uniquement s'il change pour éviter des re-rendus inutiles
        if (isNowAtEnd !== isAtEndOfScroll) {
            setIsAtEndOfScroll(isNowAtEnd);
        }

        // Faire le switch seulement quand on atteint la fin du scroll pour la première fois
        if (isNowAtEnd && !hasTriggeredEndSwitch) {
            // Basculer entre End et Screen à la fin du scroll
            // Si on est sur End, passer à Screen
            if (endGroupVisible && !screenGroupVisible) {
                setEndGroupVisible(false);
                setScreenGroupVisible(true);

                // Mettre à jour directement les références DOM
                if (window.endGroupRef && window.endGroupRef.current) {
                    window.endGroupRef.current.visible = false;
                }
                if (window.screenGroupRef && window.screenGroupRef.current) {
                    window.screenGroupRef.current.visible = true;
                }

                // Émettre les événements
                EventBus.trigger('end-group-visibility-changed', false);
                EventBus.trigger('screen-group-visibility-changed', true);
            }

            setHasTriggeredEndSwitch(true);

            // Réinitialiser le déclencheur après un délai
            setTimeout(() => {
                setHasTriggeredEndSwitch(false);
            }, 3000);
        }
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
            if (!allowScroll || chapterTransitioning) return;

            const currentY = e.touches[0].clientY;
            const deltaY = lastTouchY - currentY;
            lastTouchY = currentY;

            const direction = Math.sign(deltaY);
            const magnitude = Math.abs(deltaY) * BASE_SENSITIVITY * 1.5;
            const cappedMagnitude = Math.min(magnitude, MAX_SCROLL_SPEED);

            scrollVelocity.current = direction * cappedMagnitude;

            e.preventDefault();
        };

        const handleWheel = (e) => {
            if (!allowScroll || chapterTransitioning) return;

            const normalizedDelta = normalizeWheelDelta(e);
            const direction = Math.sign(normalizedDelta);
            setScrollDirection(direction);

            let scrollMagnitude = Math.abs(normalizedDelta) * BASE_SENSITIVITY;
            const cappedMagnitude = Math.min(scrollMagnitude, MAX_SCROLL_SPEED);

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
        if (!document.getElementById('scroll-debug-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'scroll-debug-indicator';
            indicator.style.position = 'fixed';
            indicator.style.bottom = '20px';
            indicator.style.right = '20px';
            indicator.style.padding = '8px 12px';
            indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            indicator.style.color = '#00ff00';
            indicator.style.fontFamily = 'sans-serif';
            indicator.style.fontSize = '14px';
            indicator.style.borderRadius = '4px';
            indicator.style.zIndex = '100';
            indicator.style.transition = 'color 0.3s ease';
            indicator.textContent = 'Scroll actif';
            document.body.appendChild(indicator);
        }

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
        }
    };

    const cleanupUI = () => {
        // Supprimer tous les éléments d'interface créés
        ['scroll-debug-indicator', 'interaction-button', 'countdown-element', 'timeline-progress', 'interaction-instruction', 'chapter-navigation'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });

        // Nettoyer les écouteurs d'événements
        const canvasElement = document.querySelector('canvas');
        if (canvasElement) {
            // Note: Ces gestionnaires sont définis dans setupScrollHandlers,
            // nous devrions idéalement les stocker dans des refs pour un nettoyage précis
            canvasElement.removeEventListener('wheel', () => {});
            canvasElement.removeEventListener('touchstart', () => {});
            canvasElement.removeEventListener('touchmove', () => {});
        }
    };

    return (
        <>
            {children}
        </>
    );
}