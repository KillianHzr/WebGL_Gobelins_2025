import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { getProject, val } from '@theatre/core';
import { SheetProvider, useCurrentSheet, editable as e } from '@theatre/r3f';
import theatreState from '../../static/theatre/theatreState.json';

const MAX_SCROLL_SPEED = 0.01;
const DECELERATION = 0.95;
const MIN_VELOCITY = 0.0001;
const BASE_SENSITIVITY = 0.01;
const SCROLL_NORMALIZATION_FACTOR = 0.2;

export default function ScrollControls({ children }) {
    const project = getProject('WebGL_Gobelins', { state: theatreState });
    const sheet = project.sheet('Scene');

    return (
        <SheetProvider sheet={sheet}>
            <CameraController>{children}</CameraController>
        </SheetProvider>
    );
}

function CameraController({ children }) {
    const sheet = useCurrentSheet();
    const sequenceLengthRef = useRef(0);
    const timelinePositionRef = useRef(0);
    const scrollVelocity = useRef(0);
    const [scrollDirection, setScrollDirection] = useState(0);
    const [isScrollActive, setIsScrollActive] = useState(true);
    const [showInteractionButton, setShowInteractionButton] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [currentCameraZ, setCurrentCameraZ] = useState(0);
    const [interactionStatus, setInteractionStatus] = useState({});

    const cameraRef = useRef();

    const { set, size, viewport, camera: defaultCamera } = useThree();

    const interactions = [
        {
            id: 'firstStop',
            name: 'Premier arrêt',
            triggers: { x: 4.9 },
            isActive: true
        },
        {
            id: 'secondStop',
            name: 'Second arrêt',
            triggers: { x: -6, y: 2.1 },
            isActive: true
        }
    ];

    useEffect(() => {
        if (cameraRef.current) {
            cameraRef.current.aspect = size.width / size.height;
            cameraRef.current.updateProjectionMatrix();
        }
    }, [size]);

    useEffect(() => {
        if (cameraRef.current) {
            cameraRef.current.aspect = size.width / size.height;
            cameraRef.current.updateProjectionMatrix();

            set({ camera: cameraRef.current });
            console.log("Caméra Theatre.js définie comme caméra par défaut");
        }
        return () => {
            if (defaultCamera) {
                set({ camera: defaultCamera });
            }
        };
    }, [set, defaultCamera, size]);

    const checkInteractionTriggers = (position) => {
        interactions.forEach(interaction => {
            if (!interaction.isActive || interactionStatus[interaction.id] === 'done') {
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

            if (allTriggersMatched && isScrollActive) {
                setIsScrollActive(false);
                setShowInteractionButton(true);
                setInteractionStatus(prev => ({ ...prev, [interaction.id]: 'waiting' }));
                console.log(`Interaction "${interaction.name}" déclenchée à la position:`, position);
            }
        });
    };

    const completeInteraction = () => {
        const currentInteraction = interactions.find(
            interaction => interactionStatus[interaction.id] === 'waiting'
        );

        if (currentInteraction) {
            setInteractionStatus(prev => ({ ...prev, [currentInteraction.id]: 'done' }));
            startCountdown();
            console.log(`Interaction "${currentInteraction.name}" terminée`);
        }
    };

    const startCountdown = () => {
        setShowInteractionButton(false);
        setCountdown(5);

        const interval = setInterval(() => {
            setCountdown(prevCount => {
                if (prevCount <= 1) {
                    clearInterval(interval);
                    setIsScrollActive(true);
                    return null;
                }
                return prevCount - 1;
            });
        }, 1000);
    };

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
            if (!isScrollActive) return;
            touchStartY = e.touches[0].clientY;
            lastTouchY = touchStartY;
        };

        const handleTouchMove = (e) => {
            if (!isScrollActive) return;

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
            if (!isScrollActive) return;

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
            canvasElement.addEventListener('wheel', handleWheel, { passive: false });
            canvasElement.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvasElement.addEventListener('touchmove', handleTouchMove, { passive: false });
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
        };

        createUI();

        return () => {
            if (canvasElement) {
                canvasElement.removeEventListener('wheel', handleWheel);
                canvasElement.removeEventListener('touchstart', handleTouchStart);
                canvasElement.removeEventListener('touchmove', handleTouchMove);
            }

            ['scroll-debug-indicator', 'interaction-button', 'countdown-element', 'timeline-progress'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
        };
    }, [sheet, isScrollActive]);

    useEffect(() => {
        const debugIndicator = document.getElementById('scroll-debug-indicator');
        if (debugIndicator) {
            debugIndicator.textContent = isScrollActive ? 'Scroll actif' : 'Scroll inactif';
            debugIndicator.style.color = isScrollActive ? '#00ff00' : '#ff0000';
        }
    }, [isScrollActive]);

    useEffect(() => {
        const button = document.getElementById('interaction-button');
        if (button) {
            button.style.display = showInteractionButton ? 'block' : 'none';
        }
    }, [showInteractionButton]);

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
        if (!cameraRef.current) return;

        if (cameraRef.current.aspect !== size.width / size.height) {
            cameraRef.current.aspect = size.width / size.height;
            cameraRef.current.updateProjectionMatrix();
        }

        const cameraPosition = {
            x: cameraRef.current.position.x,
            y: cameraRef.current.position.y,
            z: cameraRef.current.position.z
        };

        setCurrentCameraZ(cameraPosition.z);

        checkInteractionTriggers(cameraPosition);

        if (Math.abs(scrollVelocity.current) > MIN_VELOCITY && isScrollActive) {
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
            <e.perspectiveCamera
                ref={cameraRef}
                theatreKey="Camera"
                makeDefault
                position={[3, 2, 6]}
                rotation={[0, 0, 0]}
                fov={45}
                near={0.1}
                far={200}
                aspect={size.width / size.height}
            />
            {children}
        </>
    );
}