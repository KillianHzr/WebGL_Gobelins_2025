// ScrollControls.jsx - Système de chapitres pour Theatre.js - Version modifiée
import React, {useEffect, useRef, useState} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {getProject, val} from '@theatre/core';
import {SheetProvider, useCurrentSheet} from '@theatre/r3f';
import theatreState from '../../static/theatre/theatreState.json';
import useStore from '../Store/useStore';
import sceneObjectManager from '../Config/SceneObjectManager';
import {EventBus, MARKER_EVENTS} from "../Utils/EventEmitter.jsx";

// Configuration des chapitres
const CHAPTERS = [
    {id: 'firstStop', name: "Introduction", distance: 0.5, completed: false},
    {id: 'secondStop', name: "Forêt mystérieuse", distance: 2.0, completed: false},
    {id: 'thirdStop', name: "Découverte", distance: 1.5, completed: false},
    {id: 'fourthStop', name: "Créatures", distance: 1.0, completed: false},
    {id: 'fifthStop', name: "Exploration", distance: 0.8, completed: false},
    {id: 'sixthStop', name: "Conclusion", distance: 1.2, completed: false}
];

// Paramètres de défilement
const MAX_SCROLL_SPEED = 0.01;
const DECELERATION = 0.95;
const MIN_VELOCITY = 0.0001;
const BASE_SENSITIVITY = 0.01;
const SCROLL_NORMALIZATION_FACTOR = 0.2;

// Récupérer un paramètre de l'URL (pour permettre de démarrer à un chapitre spécifique)
const getStartChapterFromURL = () => {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const chapterId = urlParams.get('chapter');
        if (chapterId) {
            const chapterIndex = CHAPTERS.findIndex(c => c.id === chapterId);
            if (chapterIndex >= 0) {
                let cumulativeDistance = 0;
                for (let i = 0; i <= chapterIndex; i++) {
                    cumulativeDistance += CHAPTERS[i].distance;
                }
                return cumulativeDistance;
            }
        }
    }
    return 0; // Position de départ par défaut
};


export default function ScrollControls({children}) {
    const project = getProject('WebGL_Gobelins', {state: theatreState});
    const sheet = project.sheet('Scene');

    return (
        <SheetProvider sheet={sheet}>
            <CameraController>{children}</CameraController>
        </SheetProvider>
    );
}

function CameraController({children}) {
    const sheet = useCurrentSheet();
    const sequenceLengthRef = useRef(0);
    const timelinePositionRef = useRef(0);
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

    const {size, camera, scene} = useThree();
    const {debug, updateDebugConfig, getDebugConfigValue, clickListener} = useStore();
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

    useEffect(() => {
        // Exposer la fonction jumpToChapter globalement
        window.jumpToChapter = jumpToChapter;
        window.CHAPTERS = CHAPTERS;


    }, []);
    useEffect(() => {
        // Listen for chapter jump requests from the GUI
        const guiJumpSubscription = EventBus.on('gui-chapter-jump-initiated', (data) => {
            console.log(`GUI a initié une transition vers le chapitre ${data.chapterName}`);

            // Check if we're currently in a transition
            if (isTransitioningRef.current) {
                console.log("Transition en cours, réinitialisation forcée avant de démarrer une nouvelle transition");
                // Force reset transition state
                isTransitioningRef.current = false;
                setChapterTransitioning(false);
                // Reset velocity to stop any ongoing movement
                // scrollVelocity.current = 0;
            }

            // Find the chapter index based on name
            const chapterIndex = CHAPTERS.findIndex(chapter => chapter.name === data.chapterName);
            if (chapterIndex !== -1) {
                // Execute the jump after a small delay to ensure previous state is cleared
                setTimeout(() => {
                    jumpToChapter(chapterIndex);
                }, 50);
            }
        });

        // Listen for direct transition requests
        const directTransitionSubscription = EventBus.on('direct-transition-to-position', (data) => {
            console.log(`Transition directe demandée vers la position: ${data.position}`);

            // Force reset transition state
            isTransitioningRef.current = false;
            setChapterTransitioning(false);

            // Execute the transition
            setTimeout(() => {
                smoothJumpTo(data.position);
            }, 50);
        });

        // Add a safety mechanism to detect and fix stuck transitions
        const checkInterval = setInterval(() => {
            if (isTransitioningRef.current) {
                console.log("Vérification d'une transition potentiellement bloquée...");
                // If a transition has been active for more than 5 seconds, it's probably stuck
                setTimeout(() => {
                    if (isTransitioningRef.current) {
                        console.log("Transition bloquée détectée, réinitialisation forcée");
                        isTransitioningRef.current = false;
                        setChapterTransitioning(false);
                        // Re-enable scrolling
                        if (setAllowScroll) {
                            setAllowScroll(true);
                        }
                    }
                }, 5000);
            }
        }, 10000); // Check every 10 seconds

        return () => {
            guiJumpSubscription();
            directTransitionSubscription();
            clearInterval(checkInterval);
        };
    }, []);
    // Ajouter l'écouteur d'événement pour réinitialiser la vélocité de défilement
    useEffect(() => {
        // Réinitialiser la vélocité de défilement lorsque demandé par le GUI
        const velocityResetSubscription = EventBus.on('reset-scroll-velocity', () => {
            console.log('Réinitialisation de la vélocité de défilement');
            // scrollVelocity.current = 0;
        });

        // Nettoyage lors du démontage
        return () => {
            velocityResetSubscription();
        };
    }, []);

    // Fonction pour trouver un objet dans la scène par son nom
    const findObjectByName = (name) => {
        let targetObject = null;
        if (name && scene) {
            // Parcourir la scène pour trouver l'objet avec le nom correspondant
            scene.traverse((object) => {
                if (object.name === name) {
                    targetObject = object;
                }
            });
        }
        return targetObject;
    };

    // Fonction pour démarrer un compte à rebours
    const startCountdown = () => {
        setCountdown(5);

        const interval = setInterval(() => {
            setCountdown(prevCount => {
                if (prevCount <= 1) {
                    clearInterval(interval);
                    setAllowScroll(true);
                    return null;
                }
                return prevCount - 1;
            });
        }, 1000);
    };

    // Transition fluide entre les chapitres
    const smoothJumpTo = (targetPosition) => {
        // If already transitioning, queue this transition instead of ignoring it
        if (isTransitioningRef.current) {
            console.log("Executing queued transition to position:", targetPosition);
            smoothJumpTo(targetPosition);
            return;
        }

        console.log("Starting transition to position:", targetPosition);
        isTransitioningRef.current = true;
        setChapterTransitioning(true);

        // Disable scrolling during transition
        const wasScrollEnabled = allowScroll;
        if (wasScrollEnabled && setAllowScroll) {
            setAllowScroll(false);
        }

        // Reset scroll velocity
        // scrollVelocity.current = 0;

        // Emit event to notify other components about transition start
        EventBus.trigger('chapter-transition-started', {
            startPosition: timelinePositionRef.current,
            targetPosition: targetPosition
        });

        // Animation transition
        const startPosition = timelinePositionRef.current;
        const distance = targetPosition - startPosition;
        const duration = 1500; // ms
        const startTime = performance.now();

        const animateTransition = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-in-out)
            const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            // Calculate new position
            const newPosition = startPosition + distance * easeInOut(progress);
            timelinePositionRef.current = newPosition;
            sheet.sequence.position = newPosition;

            // Update progress indicator
            const progressPercentage = sequenceLengthRef.current > 0
                ? (timelinePositionRef.current / sequenceLengthRef.current) * 100
                : 0;

            const indicator = document.getElementById('progress-indicator');
            if (indicator) {
                indicator.style.width = `${progressPercentage}%`;
            }

            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animateTransition);
            } else {
                // Transition complete - ensure we properly reset all flags
                console.log("Transition complete to position:", newPosition);

                // Notify other components that transition is complete
                EventBus.trigger('chapter-transition-complete', {
                    position: newPosition
                });

                // Re-enable scrolling if needed, with a slight delay
                if (wasScrollEnabled && setAllowScroll) {
                    setAllowScroll(true);
                    setChapterTransitioning(false);
                    isTransitioningRef.current = false;
                    console.log("Flags reset, ready for next transition");
                } else {
                    setChapterTransitioning(false);
                    isTransitioningRef.current = false;
                    console.log("Flags reset, ready for next transition");
                }
            }
        };

        requestAnimationFrame(animateTransition);
    };
    useEffect(() => {
        console.log("Setting up INTERACTION_COMPLETE handler in ScrollControls");

        // Function that will be called when an interaction is completed
        const handleInteractionComplete = (eventData) => {
            console.log("⭐ INTERACTION_COMPLETE received in ScrollControls:", eventData);

            // Wait a short delay to ensure all state updates are complete
            setTimeout(() => {
                // Find current chapter using a simple approach
                const currentPosition = timelinePositionRef.current;
                console.log(`Current timeline position: ${currentPosition}`);

                // Determine current chapter
                let currentChapterIndex = 0;
                for (let i = 0; i < CHAPTERS.length; i++) {
                    if (currentPosition >= CHAPTERS[i].position) {
                        currentChapterIndex = i;
                    } else {
                        break;
                    }
                }

                console.log(`Current chapter determined to be: ${currentChapterIndex} (${CHAPTERS[currentChapterIndex].name})`);

                // Check if there's a next chapter
                if (currentChapterIndex < CHAPTERS.length - 1) {
                    const nextChapterIndex = currentChapterIndex + 1;
                    const nextChapter = CHAPTERS[nextChapterIndex];

                    console.log(`Moving to next chapter ${nextChapterIndex}: ${nextChapter.name} (position: ${nextChapter.position})`);

                    // Execute the transition with a slight delay
                    setTimeout(() => {
                        // Force transition
                        jumpToChapter(nextChapterIndex);
                    }, 300);
                } else {
                    console.log("No next chapter available (already at last chapter)");
                }
            }, 500);
        };

        // CRITICAL: Set up multiple event listeners to catch the completion event however it's emitted
        const interactionCompleteSubscription1 = EventBus.on('INTERACTION_COMPLETE', handleInteractionComplete);
        const interactionCompleteSubscription2 = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);
        const interactionCompleteSubscription3 = EventBus.on('marker:interaction:complete', handleInteractionComplete);

        // Clean up listeners on unmount
        return () => {
            console.log("Cleaning up INTERACTION_COMPLETE handlers");
            interactionCompleteSubscription1();
            interactionCompleteSubscription2();
            interactionCompleteSubscription3();
        };
    }, []);
// Fix for the jumpToChapter function
    const jumpToChapter = (index) => {
        console.log(`Tentative de transition vers le chapitre d'index: ${index}`);

        if (index >= 0 && index < CHAPTERS.length) {
            const chapter = CHAPTERS[index];
            console.log(`Transition vers le chapitre: ${chapter.name} (distance: ${chapter.distance})`);

            // Force reset transition flags if they're stuck
            if (isTransitioningRef.current) {
                console.log("Réinitialisation forcée des drapeaux de transition avant d'en démarrer une nouvelle");
                isTransitioningRef.current = false;
                setChapterTransitioning(false);
            }

            // Mark previous chapters as completed
            const updatedChapters = [...CHAPTERS];
            for (let i = 0; i < index; i++) {
                updatedChapters[i].completed = true;
            }

            // Mettre à jour l'interface en indiquant clairement le chapitre cible
            setCurrentChapter(index);
            console.log(`Chapitre cible défini sur: ${index} (${chapter.name})`);

            // Assurez-vous que le scroll est désactivé pendant la transition
            if (setAllowScroll) {
                setAllowScroll(false);
                console.log("Scroll désactivé pour la transition");
            }

            // Calculer la position cible en fonction de la position actuelle et de la distance relative
            const currentPosition = timelinePositionRef.current;
            const targetPosition = currentPosition + chapter.distance;

            console.log(`Position actuelle: ${currentPosition}`);
            console.log(`Distance à parcourir: ${chapter.distance}`);
            console.log(`Position cible calculée: ${targetPosition}`);

            // Emit event before starting transition
            EventBus.trigger('chapter-jump-initiated', {
                chapterIndex: index,
                chapterName: chapter.name,
                startPosition: currentPosition,
                distance: chapter.distance,
                targetPosition: targetPosition
            });

            // Smooth transition to the calculated target position
            smoothJumpTo(targetPosition);
            console.log(`Transition fluide démarrée vers la position: ${targetPosition}`);

            // Update URL without reloading for navigation
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.set('chapter', chapter.id);
                window.history.replaceState({}, '', url);
            }

            // Return success
            return true;
        } else {
            console.error(`Index de chapitre invalide: ${index}`);
            return false;
        }
    };

// Add a cleanup mechanism to ensure flags are reset properly
    useEffect(() => {
        // Reset flags function that can be called externally
        const resetTransitionFlags = () => {
            isTransitioningRef.current = false;
            setChapterTransitioning(false);
            console.log("Transition flags manually reset");
        };

        // Register event listener for forced reset
        const resetSubscription = EventBus.on('force-reset-transition', resetTransitionFlags);

        // Make the reset function available globally
        window.resetTransitionFlags = resetTransitionFlags;

        // Add an emergency timeout that will reset flags if stuck for too long
        const safetyInterval = setInterval(() => {
            if (isTransitioningRef.current) {
                const transitionDuration = 3000; // 3 seconds is longer than any transition should take
                console.log("Checking if transition is stuck...");

                // If transition state doesn't change for 5 seconds, reset it
                setTimeout(() => {
                    if (isTransitioningRef.current) {
                        console.log("Transition appears stuck, forcing reset");
                        resetTransitionFlags();
                        // scrollVelocity.current = 0;

                        // Re-enable scrolling as well
                        if (setAllowScroll) {
                            setAllowScroll(true);
                        }
                    }
                }, transitionDuration);
            }
        }, 5000); // Check every 5 seconds

        return () => {
            resetSubscription();
            clearInterval(safetyInterval);
            window.resetTransitionFlags = undefined;
        };
    }, []);

    // Trouver le chapitre actuel en fonction de la position
    const updateCurrentChapter = () => {
        if (chapterTransitioning) return;

        const position = timelinePositionRef.current;
        let newChapterIndex = 0;
        let cumulativeDistance = 0;

        // Parcourir les chapitres et déterminer lequel correspond à la position actuelle
        for (let i = 0; i < CHAPTERS.length; i++) {
            cumulativeDistance += CHAPTERS[i].distance;
            if (position < cumulativeDistance) {
                break;
            }
            newChapterIndex = i;
        }

        if (newChapterIndex !== currentChapter) {
            setCurrentChapter(newChapterIndex);

            // Marquer les chapitres précédents comme complétés
            const updatedChapters = [...CHAPTERS];
            for (let i = 0; i <= newChapterIndex; i++) {
                updatedChapters[i].completed = true;
            }
        }
    };


    // Marquer les interactions précédentes comme complétées
    const markPreviousInteractionsAsCompleted = (targetPosition, totalLength) => {
        const progressPercentage = targetPosition / totalLength;
        const completedInteractions = {...useStore.getState().interaction.completedInteractions};

        // Estimer quelles interactions seraient avant ce point
        interactions.forEach(interaction => {
            // Cette logique est simplifiée - vous devrez l'adapter selon votre structure exacte
            const interactionEstimatedPosition = interaction.triggers.z / 100; // Exemple de calcul

            if (interactionEstimatedPosition <= progressPercentage) {
                completedInteractions[interaction.id] = true;
            }
        });

        // Mettre à jour le store avec les interactions complétées
        if (useStore.getState().interaction) {
            useStore.getState().interaction.completedInteractions = completedInteractions;
        }
    };

    // Fonction pour vérifier les déclencheurs d'interaction
    const checkInteractionTriggers = (position) => {
        // Variable pour stocker l'interaction déclenchée
        let triggeredInteraction = null;

        // Récupérer la liste des interactions complétées
        const completedInteractions = useStore.getState().interaction.completedInteractions || {};

        // Définir une distance maximale
        const TRIGGER_PROXIMITY = 2.0;

        interactions.forEach(interaction => {
            // Ignorer les interactions déjà complétées
            if (!interaction.isActive || completedInteractions[interaction.id]) {
                return;
            }

            // Vérifications spécifiques de prérequis
            if (interaction.objectKey === 'AnimalPaws') {
                const leafErableCompleted = Object.keys(completedInteractions).some(key =>
                    key.includes('thirdStop') || key.includes('LeafErable')
                );

                if (!leafErableCompleted) {
                    return;
                }
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
                    objectKey: relatedObjectKey,
                    requiredStep: interaction.id
                })[0];

                // Trouver l'objet cible dans la scène si spécifié
                const targetObject = placement?.targetId ?
                    findObjectByName(placement.targetId) : null;

                // Bloquer le défilement
                setAllowScroll(false);

                // IMPORTANT: Réinitialiser la vélocité pour éviter tout mouvement résiduel
                // scrollVelocity.current = 0;

                // CORRECTION: Stocker la position actuelle de la timeline pour éviter tout mouvement
                // Cela permet de garder la caméra exactement à la position où l'interaction a été déclenchée
                const currentTimelinePosition = timelinePositionRef.current;

                // NOUVEAU: Ajouter un événement pour rétablir la position si nécessaire
                EventBus.trigger('interaction-position-saved', {
                    position: currentTimelinePosition,
                    interactionId: interaction.id
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
            console.log(`==== INTERACTION DÉCLENCHÉE: ${triggeredInteraction.id} ====`);
            console.log(`Position caméra: x=${position.x.toFixed(2)}, z=${position.z.toFixed(2)}`);
            console.log(`Point de déclenchement: x=${triggeredInteraction.triggers.x}, z=${triggeredInteraction.triggers.z}`);
            console.log(`Distance: ${Math.sqrt(
                Math.pow(position.x - triggeredInteraction.triggers.x, 2) +
                Math.pow(position.z - triggeredInteraction.triggers.z, 2)
            ).toFixed(2)} unités`);

            // Mettre à jour le chapitre actuel en fonction de l'interaction
            updateCurrentChapter();
        }
    };

// Ajouter une nouvelle fonction pour fixer la position lors de l'attente d'interaction
    const ensurePositionDuringInteraction = () => {
        // Récupérer l'état d'interaction actuel du store global
        const currentInteractionState = useStore.getState().interaction;

        // Si nous attendons une interaction et que le défilement est désactivé, forcer la position
        if (currentInteractionState?.waitingForInteraction && !allowScroll) {
            // Vérifier si la position de la timeline a changé et la ramener à la position sauvegardée si nécessaire
            if (savedInteractionPosition.current !== null &&
                Math.abs(timelinePositionRef.current - savedInteractionPosition.current) > 0.0001) {
                // Forcer le maintien de la position pendant l'interaction
                timelinePositionRef.current = savedInteractionPosition.current;
                sheet.sequence.position = savedInteractionPosition.current;
            }
        }

        // Si l'interaction vient de se terminer (scroll réactivé), ne pas réinitialiser la position
        // (le comportement que nous cherchons à éviter était ici)
    };

// Ajouter une référence pour stocker la position sauvegardée
    const savedInteractionPosition = useRef(null);

// Ajouter un écouteur pour le début d'interaction
    useEffect(() => {
        const interactionPositionSavedSubscription = EventBus.on('interaction-position-saved', (data) => {
            savedInteractionPosition.current = data.position;
            console.log(`Position d'interaction sauvegardée: ${data.position} pour ${data.interactionId}`);
        });

        // Ne pas réinitialiser la position sauvegardée lors de l'interaction complétée
        // Nous voulons maintenir la position où l'interaction a eu lieu
        const interactionCompleteSubscription = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, () => {
            // Ne pas réinitialiser savedInteractionPosition.current ici
            // Nous gardons la même position pour continuer à partir de là
            console.log(`Interaction complétée, reprise du scroll à la position: ${timelinePositionRef.current}`);
        });

        return () => {
            interactionPositionSavedSubscription();
            interactionCompleteSubscription();
        };
    }, []);

    useFrame(() => {
        if (!camera) return;

        const cameraPosition = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        };

        setCurrentCameraZ(cameraPosition.z);

        // Vérifier les déclencheurs d'interaction
        checkInteractionTriggers(cameraPosition);

        // S'assurer que la position est maintenue pendant les interactions
        ensurePositionDuringInteraction();

        // MODIFICATION: séparation claire du contrôle et de l'application de la position

        // 1. Calcul du mouvement - uniquement si le défilement est autorisé
        if (Math.abs(scrollVelocity.current) > MIN_VELOCITY && allowScroll && !chapterTransitioning) {
            // Mettre à jour la position basée sur la vélocité
            timelinePositionRef.current += scrollVelocity.current;

            // Décelération de la vélocité
            scrollVelocity.current *= DECELERATION;
        }

        // 2. Bornes et application - toujours appliqué, mais sauvegarde la position actuelle si en interaction
        // Cela garantit que la position reste valide mais ne change pas pendant une interaction
        if (!allowScroll && savedInteractionPosition.current !== null) {
            // Si nous sommes en interaction, forcer la position sauvegardée
            timelinePositionRef.current = savedInteractionPosition.current;
        } else {
            // Sinon, limiter la position dans les bornes
            timelinePositionRef.current = Math.max(0, Math.min(sequenceLengthRef.current, timelinePositionRef.current));
        }

        // 3. Toujours appliquer la position à la séquence
        sheet.sequence.position = timelinePositionRef.current;

        // Mettre à jour le chapitre actuel - toujours faire cette mise à jour
        updateCurrentChapter();

        // Mettre à jour l'indicateur de progression
        const progressPercentage = sequenceLengthRef.current > 0
            ? (timelinePositionRef.current / sequenceLengthRef.current) * 100
            : 0;

        const indicator = document.getElementById('progress-indicator');
        if (indicator) {
            indicator.style.width = `${progressPercentage}%`;
        }

        // Détection de la fin du scroll
        const scrollProgress = timelinePositionRef.current / sequenceLengthRef.current;
        const isNowAtEnd = scrollProgress >= END_SCROLL_THRESHOLD;

        // Mettre à jour l'état uniquement s'il change pour éviter des re-rendus inutiles
        if (isNowAtEnd !== isAtEndOfScroll) {
            setIsAtEndOfScroll(isNowAtEnd);
        }

        // Faire le switch seulement quand on atteint la fin du scroll pour la première fois
        if (isNowAtEnd && !hasTriggeredEndSwitch) {
            // Basculer entre End et Screen à la fin du scroll
            console.log("Fin du scroll atteinte, exécution du switch End/Screen");

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
    });

    useEffect(() => {
        // S'il n'est plus à la fin du scroll, réinitialiser hasTriggeredEndSwitch
        if (!isAtEndOfScroll) {
            setHasTriggeredEndSwitch(false);
        }

        // Gérer la visibilité des groupes selon la progression
        const scrollProgress = timelinePositionRef.current / sequenceLengthRef.current;
        if (scrollProgress < 0.5) {
            setEndGroupVisible(true);
            setScreenGroupVisible(false);

            if (window.endGroupRef && window.endGroupRef.current) {
                window.endGroupRef.current.visible = true;
            }
            if (window.screenGroupRef && window.screenGroupRef.current) {
                window.screenGroupRef.current.visible = false;
            }

            EventBus.trigger('end-group-visibility-changed', true);
            EventBus.trigger('screen-group-visibility-changed', false);
        }
    }, [isAtEndOfScroll, timelinePositionRef.current]);

    useEffect(() => {
        // Stocker la position avant la modification de l'état dans completeInteraction
        const preInteractionCompleteSubscription = EventBus.on('pre-interaction-complete', (data) => {
            // Sauvegarder la position actuelle
            const currentPosition = timelinePositionRef.current;
            console.log(`Sauvegarde de la position avant modification d'état: ${currentPosition}`);

            // Stocker cette position dans une référence pour une utilisation ultérieure
            savedInteractionPosition.current = currentPosition;
        });

        // Écouter l'événement qui réactive le scroll
        const setAllowScrollSubscription = EventBus.on('interaction-complete-set-allow-scroll', (data) => {
            // S'assurer que la vélocité est à zéro
            // scrollVelocity.current = 0;

            // Si nous avons une position sauvegardée, forcer la position de la timeline
            // if (savedInteractionPosition.current !== null) {
            //     // Forcer la position actuelle
            //     timelinePositionRef.current = savedInteractionPosition.current;
            //     sheet.sequence.position = savedInteractionPosition.current;
            //
            //     console.log(`Position forcée à ${savedInteractionPosition.current} avant de réactiver le scroll`);
            // }

            // Réactiver le scroll après avoir forcé la position
            // if (setAllowScroll) {
            //     console.log(`Réactivation du scroll à la position: ${timelinePositionRef.current}`);
            //     setAllowScroll(true);
            // }
        });

        return () => {
            preInteractionCompleteSubscription();
            setAllowScrollSubscription();
        };
    }, [setAllowScroll]);
    // Gestion de l'affichage du compte à rebours
    useEffect(() => {
        const countdownEl = document.getElementById('countdown-element');
        if (countdownEl) {
            if (countdown !== null) {
                countdownEl.textContent = `Scroll actif dans ${countdown}...`;
                countdownEl.style.display = 'block';

                if (countdown === 0) {
                    countdownEl.style.opacity = '1';
                    countdownEl.style.transition = 'opacity 1s ease';

                    setTimeout(() => {
                        countdownEl.style.opacity = '0';
                        setTimeout(() => {
                            countdownEl.style.display = 'none';
                            countdownEl.style.opacity = '1';
                        }, 1000);
                    }, 500);
                }
            } else {
                countdownEl.style.display = 'none';
            }
        }
    }, [countdown]);

    // Surveiller les changements de allowScroll pour réinitialiser la vélocité
    useEffect(() => {
        if (allowScroll && !previousAllowScrollRef.current) {
            console.log('Scroll réactivé après interaction - réinitialisation de la vélocité');
            // scrollVelocity.current = 0;
        }
        previousAllowScrollRef.current = allowScroll;
    }, [allowScroll]);

    // Récupérer les points d'interaction
    useEffect(() => {
        const interactivePlacements = sceneObjectManager.getInteractivePlacements();

        const interactionPoints = interactivePlacements.map(placement => {
            return {
                id: placement.requiredStep,
                name: placement.markerText || sceneObjectManager.getStepText(placement.requiredStep),
                triggers: {
                    x: placement.position[0],
                    z: placement.position[2]
                },
                isActive: true,
                objectKey: placement.objectKey
            };
        });

        setInteractions(interactionPoints);
        console.log('Points d\'interaction chargés:', interactionPoints);
    }, []);

    // Initialiser la timeline et créer l'interface utilisateur
    useEffect(() => {
        if (camera && sheet) {
            let obj;
            try {
                obj = sheet.object('Camera');
                obj.set({
                    position: {
                        x: camera.position.x,
                        y: camera.position.y,
                        z: camera.position.z
                    },
                    rotation: {
                        x: camera.rotation.x,
                        y: camera.rotation.y,
                        z: camera.rotation.z
                    }
                });
            } catch (error) {
                obj = sheet.object('Camera', {
                    position: {
                        x: camera.position.x,
                        y: camera.position.y,
                        z: camera.position.z
                    },
                    rotation: {
                        x: camera.rotation.x,
                        y: camera.rotation.y,
                        z: camera.rotation.z
                    }
                }, {reconfigure: true});
            }

            const unsubscribe = obj.onValuesChange((values) => {
                if (values.position) {
                    camera.position.x = values.position.x;
                    camera.position.y = values.position.y;
                    camera.position.z = values.position.z;
                }
                if (values.rotation) {
                    camera.rotation.x = values.rotation.x;
                    camera.rotation.y = values.rotation.y;
                    camera.rotation.z = values.rotation.z;
                }
                camera.updateProjectionMatrix();
            });

            return () => {
                unsubscribe();
            };
        }
    }, [camera, sheet]);

    // Initialiser la timeline et créer l'interface de progression
    useEffect(() => {
        sequenceLengthRef.current = val(sheet.sequence.pointer.length);

        // Déterminer la position de départ
        const startChapterPosition = getStartChapterFromURL();
        timelinePositionRef.current = startChapterPosition;
        sheet.sequence.position = startChapterPosition;

        // Créer l'interface de progression
        createProgressUI();

        // Configurer le scroll
        setupScrollHandlers();

        // Si on commence à une position autre que 0, marquer les interactions précédentes
        // if (startChapterPosition > 0) {
        //     markPreviousInteractionsAsCompleted(startChapterPosition, sequenceLengthRef.current);
        // }

        // Nettoyer lors du démontage
        return () => {
            cleanupUI();
        };
    }, [sheet, allowScroll]);

    // Fonction pour configurer les gestionnaires d'événements de défilement
    const setupScrollHandlers = () => {
        let lastWheelTimestamp = 0;
        let recentWheelEvents = [];
        const MAX_WHEEL_SAMPLES = 5;

        const normalizeWheelDelta = (e) => {
            const now = performance.now();
            recentWheelEvents.push({
                deltaY: e.deltaY,
                timestamp: now,
                deltaMode: e.deltaMode
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

        // Supprimer les fonctions globales
        // if (typeof window !== 'undefined') {
        //     window.jumpToChapter = undefined;
        //     window.CHAPTERS = undefined;
        // }

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

// Gestion des éléments d'interface pour les interactions
    useEffect(() => {
        // Créer l'élément d'instruction pour les interactions si nécessaire
        if (!document.getElementById('interaction-instruction')) {
            const instruction = document.createElement('div');
            instruction.id = 'interaction-instruction';
            instruction.style.position = 'fixed';
            instruction.style.top = '50%';
            instruction.style.left = '50%';
            instruction.style.transform = 'translate(-50%, -50%)';
            instruction.style.padding = '15px 30px';
            instruction.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            instruction.style.color = 'white';
            instruction.style.fontFamily = 'sans-serif';
            instruction.style.fontSize = '18px';
            instruction.style.fontWeight = 'bold';
            instruction.style.borderRadius = '8px';
            instruction.style.display = 'none';
            instruction.style.zIndex = '100';
            instruction.style.textAlign = 'center';
            instruction.textContent = 'Interagir pour continuer';
            document.body.appendChild(instruction);
        }

        // Créer le bouton d'interaction si nécessaire
        if (!document.getElementById('interaction-button') && isWaitingForInteraction) {
            const button = document.createElement('button');
            button.id = 'interaction-button';
            button.style.position = 'fixed';
            button.style.top = '60%';
            button.style.left = '50%';
            button.style.transform = 'translate(-50%, -50%)';
            button.style.padding = '15px 30px';
            button.style.backgroundColor = '#4383f5';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '8px';
            button.style.fontSize = '18px';
            button.style.fontWeight = 'bold';
            button.style.cursor = 'pointer';
            button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            button.style.transition = 'all 0.3s ease';
            button.style.zIndex = '100';
            button.textContent = 'Continuer';

            button.addEventListener('mouseover', () => {
                button.style.backgroundColor = '#306ad6';
            });

            button.addEventListener('mouseout', () => {
                button.style.backgroundColor = '#4383f5';
            });

            button.addEventListener('click', completeInteraction);

            document.body.appendChild(button);
            setShowInteractionButton(true);
        } else if (document.getElementById('interaction-button') && !isWaitingForInteraction) {
            const button = document.getElementById('interaction-button');
            button.remove();
            setShowInteractionButton(false);
        }

        return () => {
            if (document.getElementById('interaction-button')) {
                document.getElementById('interaction-button').remove();
            }
        };
    }, [isWaitingForInteraction, completeInteraction]);


    useEffect(() => {
        // Écouteur pour réactiver le scroll après interaction directement depuis ScrollControls
        const enableScrollSubscription = EventBus.on('enable-scroll-after-interaction', (data) => {
            // Option 1: Réactiver immédiatement
            if (setAllowScroll && !allowScroll) {
                console.log(`Réactivation directe du scroll dans ScrollControls après interaction ${data.step}`);
                setAllowScroll(true);
            }

            // Option 2: Réactiver avec un délai si nécessaire
            // setTimeout(() => {
            //     if (setAllowScroll && !allowScroll) {
            //         setAllowScroll(true);
            //     }
            // }, 300);
        });

        return () => {
            enableScrollSubscription();
        };
    }, [allowScroll, setAllowScroll]);
// Mettre à jour l'état UI en fonction de l'état d'interaction
    useEffect(() => {
        const debugIndicator = document.getElementById('scroll-debug-indicator');
        if (debugIndicator) {
            debugIndicator.textContent = allowScroll ? 'Scroll actif' : 'Scroll inactif';
            debugIndicator.style.color = allowScroll ? '#00ff00' : '#ff0000';
        }

        const instruction = document.getElementById('interaction-instruction');
        if (instruction) {
            if (isWaitingForInteraction) {
                const currentInteraction = interactions.find(i => i.id === interactionStep);
                if (currentInteraction) {
                    const objectConfig = sceneObjectManager.getObjectFromCatalog(currentInteraction.objectKey);
                    if (objectConfig && objectConfig.interaction) {
                        let instructionText = 'Interagir pour continuer';
                        if (objectConfig.interaction.type === 'click') {
                            instructionText = 'Cliquez pour continuer';
                        } else if (objectConfig.interaction.type === 'drag') {
                            instructionText = 'Glissez pour continuer';
                        }
                        instruction.textContent = instructionText;
                    }
                }
                instruction.style.display = 'block';
            } else {
                instruction.style.display = 'none';
            }
        }
    }, [allowScroll, isWaitingForInteraction, interactionStep, interactions]);
    useEffect(() => {
        // Fonction pour avancer au chapitre suivant après une interaction
        const handleInteractionComplete = () => {
            // Attendre un court délai pour que l'interaction se termine complètement
            setTimeout(() => {
                // Trouver le chapitre actuel de manière plus robuste
                let currentChapterIndex = -1;
                let cumulativeDistance = 0;

                // Parcourir les chapitres pour trouver l'index actuel basé sur les distances cumulées
                for (let i = 0; i < CHAPTERS.length; i++) {
                    cumulativeDistance += CHAPTERS[i].distance;
                    if (i === CHAPTERS.length - 1 || timelinePositionRef.current < cumulativeDistance) {
                        currentChapterIndex = i;
                        break;
                    }
                }

                console.log(`Chapitre actuel déterminé: ${currentChapterIndex} (${CHAPTERS[currentChapterIndex]?.name})`);
                console.log(`Position actuelle: ${timelinePositionRef.current}`);

                // S'il y a un chapitre suivant, y naviguer
                if (currentChapterIndex >= 0 && currentChapterIndex < CHAPTERS.length - 1) {
                    const nextChapterIndex = currentChapterIndex + 1;
                    const nextChapter = CHAPTERS[nextChapterIndex];

                    // Enregistrer la position actuelle avant la transition
                    const currentPosition = timelinePositionRef.current;

                    // Calculer la distance à parcourir (la distance du prochain chapitre)
                    const distanceToTravel = nextChapter.distance;

                    console.log(`Interaction complétée, transition automatique vers le chapitre suivant: ${nextChapter.name} (distance: ${distanceToTravel})`);

                    // Forcer la transition vers le chapitre suivant
                    jumpToChapter(nextChapterIndex);

                    // Émettre un événement pour informer les autres composants
                    EventBus.trigger('chapter-advanced-after-interaction', {
                        previousChapter: currentChapterIndex,
                        newChapter: nextChapterIndex,
                        previousPosition: currentPosition,
                        distance: distanceToTravel,
                        newPosition: currentPosition + distanceToTravel
                    });
                } else {
                    console.log("Aucun chapitre suivant disponible ou dernier chapitre atteint");
                }
            }, 1000); // Délai d'une seconde avant la transition
        };

        // S'abonner à l'événement d'interaction complète
        const interactionCompleteSubscription = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);

        // Nettoyer lors du démontage
        return () => {
            interactionCompleteSubscription();
        };
    }, []);
    return (<>
        {children}
    </>);
} // Fin de CameraController