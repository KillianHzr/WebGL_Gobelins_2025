import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getProject, val } from '@theatre/core';
import { SheetProvider, useCurrentSheet } from '@theatre/r3f';
import theatreState from '../../static/theatre/theatreState.json';
import useStore from '../Store/useStore';

// Paramètres de défilement
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

    // Référence à la vitesse de défilement configurable via GUI
    const scrollSpeedRef = useRef({ value: 1.0 });

    const { size, camera } = useThree();
    const { debug, gui, updateDebugConfig, getDebugConfigValue } = useStore();

    // État pour savoir si le défilement est autorisé
    const [allowScroll, setAllowScroll] = useState(true);

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
            const magnitude = Math.abs(deltaY) * BASE_SENSITIVITY * scrollSpeedRef.current.value;

            // Limiter la vitesse maximale
            const cappedMagnitude = Math.min(magnitude, MAX_SCROLL_SPEED * scrollSpeedRef.current.value);

            scrollVelocity.current = direction * cappedMagnitude;

            e.preventDefault();
        };

        const handleWheel = (e) => {
            if (!allowScroll) return;

            const normalizedDelta = normalizeWheelDelta(e);
            const direction = Math.sign(normalizedDelta);

            // Appliquer le facteur de vitesse du défilement
            let scrollMagnitude = Math.abs(normalizedDelta) * BASE_SENSITIVITY * scrollSpeedRef.current.value;

            // Limiter la vitesse maximale
            const cappedMagnitude = Math.min(scrollMagnitude, MAX_SCROLL_SPEED * scrollSpeedRef.current.value);

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

        // Ajouter un contrôle GUI pour la vitesse du défilement si le mode debug est actif
        if (debug?.active && gui) {
            // Récupérer la valeur sauvegardée ou utiliser la valeur par défaut
            const savedScrollSpeed = getDebugConfigValue('scroll.speed.value', 0.5);
            scrollSpeedRef.current.value = savedScrollSpeed;

            // Ajouter le dossier pour le contrôle du défilement
            const scrollFolder = gui.addFolder('Scroll Controls');

            // Ajouter le contrôle pour la vitesse du défilement
            scrollFolder.add(scrollSpeedRef.current, 'value', 0.1, 2.0, 0.1)
                .name('Scroll Speed')
                .onChange((value) => {
                    updateDebugConfig('scroll.speed.value', value);
                });

            // Maintenir le dossier ouvert
            scrollFolder.open();
        }

        return () => {
            if (canvasElement) {
                canvasElement.removeEventListener('wheel', handleWheel);
                canvasElement.removeEventListener('touchstart', handleTouchStart);
                canvasElement.removeEventListener('touchmove', handleTouchMove);
            }

            ['scroll-debug-indicator', 'timeline-progress'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
        };
    }, [sheet, allowScroll, debug, gui, updateDebugConfig, getDebugConfigValue]);

    // Update UI based on scroll state
    useEffect(() => {
        const debugIndicator = document.getElementById('scroll-debug-indicator');
        if (debugIndicator) {
            debugIndicator.textContent = allowScroll ? 'Scroll actif' : 'Scroll inactif';
            debugIndicator.style.color = allowScroll ? '#00ff00' : '#ff0000';
        }
    }, [allowScroll]);

    useFrame(() => {
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