import React, {useEffect, useRef, useState} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {getProject, val} from '@theatre/core';
import {SheetProvider, useCurrentSheet} from '@theatre/r3f';
import theatreState from '../../static/theatre/theatreState.json';
import useStore from '../Store/useStore';

const MAX_SCROLL_SPEED = 0.01;
const DECELERATION = 0.95;
const MIN_VELOCITY = 0.0001;
const BASE_SENSITIVITY = 0.01;
const SCROLL_NORMALIZATION_FACTOR = 0.2;

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

    const {size, camera, scene} = useThree(); // Import scene from useThree
    const {debug, updateDebugConfig, getDebugConfigValue, clickListener} = useStore();

    // Get interaction state from the store
    const isWaitingForInteraction = useStore(state => state.interaction?.waitingForInteraction);
    const allowScroll = useStore(state => state.interaction?.allowScroll !== false);
    const interactionStep = useStore(state => state.interaction?.currentStep);
    const completeInteraction = useStore(state => state.interaction?.completeInteraction);
    const setAllowScroll = useStore(state => state.interaction?.setAllowScroll);
    const setWaitingForInteraction = useStore(state => state.interaction?.setWaitingForInteraction);
    const setCurrentStep = useStore(state => state.interaction?.setCurrentStep);
    const setInteractionTarget = useStore(state => state.interaction?.setInteractionTarget);

    // Définition des points d'interaction avec leurs types
    const interactions = [
        {
            id: 'firstStop',
            name: 'Premier arrêt',
            triggers: {x: 4.9},
            isActive: true,
            interactionType: 'click', // Requiert un clic
            targetId: 'MainCube' // Nom du cube dans la scène
        },
        {
            id: 'secondStop',
            name: 'Second arrêt',
            triggers: {x: -6, y: 2.1},
            isActive: true,
            interactionType: 'drag', // Requiert un drag horizontal
            targetId: 'MainCube' // Nom du cube dans la scène
        }
    ];

    useEffect(() => {
        // Ajouter le contrôle de la caméra via Theatre.js
        if (camera && sheet) {
            // Créer un objet pour stocker les paramètres de la caméra
            const obj = sheet.object('Camera', {
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

            // Écouter les modifications de Theatre.js et les appliquer à la caméra
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

            // Nettoyer l'abonnement
            return () => {
                unsubscribe();
            };
        }
    }, [camera, sheet]);

    useEffect(() => {
        sequenceLengthRef.current = val(sheet.sequence.pointer.length);

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
            if (!allowScroll) return;
            touchStartY = e.touches[0].clientY;
            lastTouchY = touchStartY;
        };

        const handleTouchMove = (e) => {
            if (!allowScroll) return;

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
            if (!allowScroll) return;

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

        const createUI = () => {
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

            if (!document.getElementById('interaction-button')) {
                const button = document.createElement('button');
                button.id = 'interaction-button';
                button.style.position = 'fixed';
                button.style.top = '50%';
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
                button.style.display = 'none';
                button.style.zIndex = '100';
                button.textContent = 'Interaction';

                button.addEventListener('mouseover', () => {
                    button.style.backgroundColor = '#306ad6';
                });

                button.addEventListener('mouseout', () => {
                    button.style.backgroundColor = '#4383f5';
                });

                button.addEventListener('click', completeInteraction);

                document.body.appendChild(button);
            }

            if (!document.getElementById('countdown-element')) {
                const countdownEl = document.createElement('div');
                countdownEl.id = 'countdown-element';
                countdownEl.style.position = 'fixed';
                countdownEl.style.top = '50%';
                countdownEl.style.left = '50%';
                countdownEl.style.transform = 'translate(-50%, -50%)';
                countdownEl.style.fontSize = '36px';
                countdownEl.style.fontWeight = 'bold';
                countdownEl.style.color = 'white';
                countdownEl.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.5)';
                countdownEl.style.display = 'none';
                countdownEl.style.zIndex = '100';
                document.body.appendChild(countdownEl);
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

            // Instruction pour cube interaction
            // if (!document.getElementById('interaction-instruction')) {
            //     const instruction = document.createElement('div');
            //     instruction.id = 'interaction-instruction';
            //     instruction.style.position = 'fixed';
            //     instruction.style.top = '25%';
            //     instruction.style.left = '50%';
            //     instruction.style.transform = 'translate(-50%, -50%)';
            //     instruction.style.fontSize = '24px';
            //     instruction.style.fontWeight = 'bold';
            //     instruction.style.color = 'white';
            //     instruction.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            //     instruction.style.padding = '15px 25px';
            //     instruction.style.borderRadius = '8px';
            //     instruction.style.textAlign = 'center';
            //     instruction.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            //     instruction.style.zIndex = '100';
            //     instruction.style.display = 'none';
            //     instruction.textContent = 'Cliquez sur le cube pour continuer';
            //     document.body.appendChild(instruction);
            // }
        };

        createUI();

        return () => {
            if (canvasElement) {
                canvasElement.removeEventListener('wheel', handleWheel);
                canvasElement.removeEventListener('touchstart', handleTouchStart);
                canvasElement.removeEventListener('touchmove', handleTouchMove);
            }

            ['scroll-debug-indicator', 'interaction-button', 'countdown-element', 'timeline-progress', 'interaction-instruction'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
        };
    }, [sheet, allowScroll]);

    // Update UI based on interaction state
    useEffect(() => {
        const debugIndicator = document.getElementById('scroll-debug-indicator');
        if (debugIndicator) {
            debugIndicator.textContent = allowScroll ? 'Scroll actif' : 'Scroll inactif';
            debugIndicator.style.color = allowScroll ? '#00ff00' : '#ff0000';
        }

        const instruction = document.getElementById('interaction-instruction');
        if (instruction) {
            // Mettre à jour le texte d'instruction en fonction de l'étape
            if (isWaitingForInteraction) {
                const currentInteraction = interactions.find(i => i.id === interactionStep);
                if (currentInteraction) {
                    if (currentInteraction.interactionType === 'click') {
                        instruction.textContent = 'Cliquez sur le cube pour continuer';
                    } else if (currentInteraction.interactionType === 'drag') {
                        instruction.textContent = 'Glissez le cube horizontalement pour continuer';
                    }
                }
                instruction.style.display = 'block';
            } else {
                instruction.style.display = 'none';
            }
        }

        // Vérifier si l'écoute n'est pas déjà active
        if (clickListener && !clickListener.isListening && typeof clickListener.startListening === 'function') {
            clickListener.startListening();
        }
    }, [allowScroll, isWaitingForInteraction, interactionStep, clickListener]);

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

    const checkInteractionTriggers = (position) => {
        // Récupérer la liste des interactions complétées avec une valeur par défaut
        const completedInteractions = useStore.getState().interaction.completedInteractions || {};

        interactions.forEach(interaction => {
            // Ignorer les interactions déjà complétées
            if (!interaction.isActive || completedInteractions[interaction.id]) {
                return;
            }

            const allTriggersMatched = Object.entries(interaction.triggers).every(([axis, value]) => {
                const currentValue = position[axis];
                if (axis === 'z') {
                    return currentValue <= value;
                }
                const tolerance = 0.1;
                return Math.abs(currentValue - value) <= tolerance;
            });

            // Si toutes les conditions de position sont remplies et que le défilement est actuellement autorisé
            if (allTriggersMatched && allowScroll) {
                console.log(`Point d'interaction atteint: ${interaction.id} - ${interaction.name} (type: ${interaction.interactionType})`);

                // Trouver l'objet cible dans la scène
                const targetObject = findObjectByName(interaction.targetId);

                // Bloquer le défilement
                setAllowScroll(false);

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
    };

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

        // Ne mettre à jour la position de la timeline que si le défilement est autorisé
        if (Math.abs(scrollVelocity.current) > MIN_VELOCITY && allowScroll) {
            timelinePositionRef.current += scrollVelocity.current;
            timelinePositionRef.current = Math.max(0, Math.min(sequenceLengthRef.current, timelinePositionRef.current));
            sheet.sequence.position = timelinePositionRef.current;

            scrollVelocity.current *= DECELERATION;
        }

        const progressPercentage = sequenceLengthRef.current > 0
            ? (timelinePositionRef.current / sequenceLengthRef.current) * 100
            : 0;

        const indicator = document.getElementById('progress-indicator');
        if (indicator) {
            indicator.style.width = `${progressPercentage}%`;
        }
    });

    return (
        <>
            {children}
        </>
    );
}