import {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';

/**
 * Hook pour détecter les gestes de glissement (drag) sur des objets 3D dans la scène
 * @param {Object} options - Options de configuration
 * @param {Object} options.objectRef - Référence à l'objet 3D (useRef)
 * @param {string} options.eventName - Nom de l'événement à émettre lors d'un drag réussi
 * @param {boolean} options.enabled - Activer/désactiver la détection
 * @param {number} options.minDistance - Distance minimale de glissement (en pixels)
 * @param {string} options.direction - Direction attendue ('any', 'horizontal', 'vertical', 'up', 'down', 'left', 'right')
 * @param {Function} options.onDragStart - Callback appelé au début du glissement
 * @param {Function} options.onDragEnd - Callback appelé à la fin du glissement
 * @param {Function} options.onDragSuccess - Callback appelé quand un glissement réussi est détecté
 * @param {boolean} options.debug - Activer les logs de débogage
 * @returns {Object} - État et méthodes du hook
 */
export const useDragGesture = ({
                                   objectRef,
                                   eventName = 'object:drag',
                                   enabled = true,
                                   minDistance = 50,
                                   direction = 'horizontal',
                                   onDragStart,
                                   onDragEnd,
                                   onDragSuccess,
                                   debug = false
                               }) => {
    const {gl, camera, raycaster} = useThree();
    const [isDragging, setIsDragging] = useState(false);

    // Références pour gérer l'état du drag
    const dragStateRef = useRef({
        isMouseDown: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        dragStartTimestamp: 0
    });


    // Vérifier si le clic initial est sur l'objet
    const isClickOnObject = (event) => {
        if (!objectRef.current) return false;

        const rect = gl.domElement.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera({x: mouseX, y: mouseY}, camera);
        const intersects = raycaster.intersectObject(objectRef.current);

        return intersects.length > 0;
    };

    // Vérifier la direction et la distance du drag
    const validateDrag = () => {
        const {startX, startY, currentX, currentY} = dragStateRef.current;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Distance minimale
        if (distance < minDistance) {
            // debugLog('Drag distance too short', {distance, minDistance});
            return false;
        }

        // Vérification de la direction
        switch (direction) {
            case 'any':
                return true;
            case 'horizontal':
                return absX > absY;
            case 'vertical':
                return absY > absX;
            case 'up':
                return deltaY < 0 && absY > absX;
            case 'down':
                return deltaY > 0 && absY > absX;
            case 'left':
                return deltaX < 0 && absX > absY;
            case 'right':
                return deltaX > 0 && absX > absY;
            default:
                return true;
        }
    };

    useEffect(() => {
        if (!objectRef?.current || !enabled) return;

        const canvas = gl.domElement;

        const handleMouseDown = (event) => {
            // Vérifier si le clic est sur l'objet
            if (!isClickOnObject(event)) return;

            const state = dragStateRef.current;
            state.isMouseDown = true;
            state.startX = event.clientX;
            state.startY = event.clientY;
            state.currentX = event.clientX;
            state.currentY = event.clientY;
            state.dragStartTimestamp = Date.now();

            // debugLog('Mouse down', {
                x: state.startX,
                y: state.startY
            });

            // Appeler le callback de début de drag
            if (onDragStart && typeof onDragStart === 'function') {
                onDragStart({
                    originalEvent: event,
                    startX: state.startX,
                    startY: state.startY
                });
            }
        };

        const handleMouseMove = (event) => {
            const state = dragStateRef.current;
            if (!state.isMouseDown) return;

            state.currentX = event.clientX;
            state.currentY = event.clientY;

            // Vérifier si la distance minimale est atteinte
            const deltaX = state.currentX - state.startX;
            const deltaY = state.currentY - state.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance >= minDistance && !isDragging) {
                setIsDragging(true);
                // debugLog('Drag started', {
                    deltaX,
                    deltaY,
                    distance
                });
            }
        };

        const handleMouseUp = (event) => {
            const state = dragStateRef.current;
            if (!state.isMouseDown) return;

            state.currentX = event.clientX;
            state.currentY = event.clientY;

            // Construire les données du drag
            const dragData = {
                startX: state.startX,
                startY: state.startY,
                endX: state.currentX,
                endY: state.currentY,
                deltaX: state.currentX - state.startX,
                deltaY: state.currentY - state.startY,
                distance: Math.sqrt(
                    Math.pow(state.currentX - state.startX, 2) +
                    Math.pow(state.currentY - state.startY, 2)
                ),
                duration: Date.now() - state.dragStartTimestamp,
                isSuccessful: false
            };

            // Vérifier si le drag est réussi
            const isSuccessfulDrag = validateDrag();
            dragData.isSuccessful = isSuccessfulDrag;

            // Réinitialiser l'état
            state.isMouseDown = false;
            setIsDragging(false);

            // debugLog('Mouse up', dragData);

            // Si le drag est réussi, déclencher l'événement de succès
            if (isSuccessfulDrag) {
                if (onDragSuccess && typeof onDragSuccess === 'function') {
                    onDragSuccess(dragData);
                }
            }

            // Toujours appeler le callback de fin de drag
            if (onDragEnd && typeof onDragEnd === 'function') {
                onDragEnd(dragData);
            }
        };

        const handleMouseLeave = () => {
            const state = dragStateRef.current;
            if (!state.isMouseDown) return;

            // Réinitialiser l'état si la souris quitte le canvas
            state.isMouseDown = false;
            setIsDragging(false);

            // debugLog('Mouse leave - drag canceled');

            // Appeler le callback de fin de drag avec annulation
            if (onDragEnd && typeof onDragEnd === 'function') {
                onDragEnd({canceled: true});
            }
        };

        // Ajouter les écouteurs d'événements
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        // Support tactile
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                handleMouseDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault()
                });
            }
        }, {passive: false});

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault()
                });
            }
        }, {passive: false});

        canvas.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                handleMouseUp({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault()
                });
            }
        }, {passive: false});

        // Nettoyage
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.removeEventListener('touchstart', handleMouseDown);
            canvas.removeEventListener('touchmove', handleMouseMove);
            canvas.removeEventListener('touchend', handleMouseUp);
        };
    }, [objectRef, enabled, direction, minDistance, debug, gl, onDragStart, onDragEnd, onDragSuccess, camera, raycaster]);

    return {
        isDragging
    };
};

export default useDragGesture;