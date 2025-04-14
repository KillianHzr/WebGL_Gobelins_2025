// src/Hooks/useMarkerSystem.jsx
import { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EventBus } from '../Utils/EventEmitter';
import { MARKER_EVENTS } from '../Utils/markerEvents';
import useStore from '../Store/useStore';

/**
 * Hook qui gère les marqueurs associés à un objet 3D
 */
const useMarkerSystem = (objectRef, options = {}) => {
    const [hovered, setHovered] = useState(false);
    const [active, setActive] = useState(false);
    const [markerVisible, setMarkerVisible] = useState(false);
    const [markerPosition, setMarkerPosition] = useState({ x: 0, y: 0, z: 0 });
    const markerRef = useRef(null);
    const lastInteractionTime = useRef(0);

    const { raycaster, camera } = useThree();
    const { interaction } = useStore();

    // Options par défaut
    const {
        id = `marker-${Math.random().toString(36).substr(2, 9)}`,
        markerType = 'interaction',
        markerColor = '#44ff44',
        markerText = 'Cliquez ici',
        markerScale = 1,
        interactionType = 'click', // 'click', 'drag', 'hover', etc.
        showOnlyWhenInteractionRequired = true,  // Montrer seulement quand une interaction est requise
        customAction = null,  // Action personnalisée lors de l'interaction
        requiredInteractionStep = null, // Étape d'interaction spécifique requise
        autoShowMarker = true, // Afficher automatiquement le marqueur au survol
        showMarkerDelay = 300, // Délai avant d'afficher le marqueur (en ms)
        hideMarkerDelay = 200, // Délai avant de cacher le marqueur (en ms)
        onInteractionComplete = null, // Callback après une interaction réussie
        onMarkerClick = null, // Callback lors du clic sur le marqueur
        onHover = null, // Callback lors du survol de l'objet
        onHoverEnd = null, // Callback lors de la fin du survol
        enableRaycast = true, // Activer le raycasting pour la détection des survols
        faceCamera = true, // Faire face à la caméra
        animateMarker = true, // Animer le marqueur (pulsation, rotation, etc.)
        debugMode = false, // Mode debug
    } = options;

    // État de débogage depuis le store
    const debugActive = useStore(state => state.debug?.active) || debugMode;

    // Gérer le survol de l'objet
    useEffect(() => {
        // Vérifier si le suivi de survol est activé
        if (!enableRaycast || !objectRef.current) return;

        const checkHover = () => {
            if (!objectRef.current) return;

            // Intersection avec l'objet
            const intersects = raycaster.intersectObject(objectRef.current, true);
            const isHovered = intersects.length > 0;

            // Mise à jour de l'état seulement si nécessaire pour éviter les re-renders
            if (isHovered !== hovered) {
                setHovered(isHovered);

                // Déclencher les callbacks et événements appropriés
                if (isHovered) {
                    if (onHover) onHover(intersects[0]);

                    // Timer pour afficher le marqueur après un délai
                    if (autoShowMarker) {
                        const timer = setTimeout(() => {
                            // Vérifier si on doit afficher le marqueur
                            const shouldShowMarker = !showOnlyWhenInteractionRequired ||
                                (interaction?.waitingForInteraction &&
                                    (!requiredInteractionStep || requiredInteractionStep === interaction.currentStep));

                            if (shouldShowMarker) {
                                setMarkerVisible(true);

                                // Événement de marqueur montré
                                EventBus.trigger(MARKER_EVENTS.MARKER_SHOW, { id, type: markerType });
                            }
                        }, showMarkerDelay);

                        return () => clearTimeout(timer);
                    }
                } else {
                    if (onHoverEnd) onHoverEnd();

                    // Timer pour cacher le marqueur après un délai
                    const timer = setTimeout(() => {
                        setMarkerVisible(false);

                        // Événement de marqueur caché
                        EventBus.trigger(MARKER_EVENTS.MARKER_HIDE, { id, type: markerType });
                    }, hideMarkerDelay);

                    return () => clearTimeout(timer);
                }
            }
        };

        // Ajouter l'écouteur d'événements
        window.addEventListener('pointermove', checkHover);

        // Nettoyage
        return () => {
            window.removeEventListener('pointermove', checkHover);
        };
    }, [objectRef.current, enableRaycast, hovered, interaction?.waitingForInteraction, interaction?.currentStep]);

    // Calculer la position du marqueur
    const calculateMarkerPosition = () => {
        if (!objectRef.current || !camera) return;

        // Position de l'objet
        const object = objectRef.current;
        const objectPosition = new THREE.Vector3();

        // Si l'objet a une méthode getWorldPosition, l'utiliser
        if (typeof object.getWorldPosition === 'function') {
            object.getWorldPosition(objectPosition);
        } else {
            // Sinon, essayer d'obtenir la position directement
            objectPosition.copy(object.position);
        }

        // Direction de la caméra à l'objet
        const cameraPosition = camera.position.clone();
        const direction = new THREE.Vector3().subVectors(cameraPosition, objectPosition).normalize();

        // Boîte englobante pour calculer la taille de l'objet
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);

        // Distance du marqueur par rapport à l'objet (proportionnelle à la taille)
        const offset = Math.max(size.x, size.y, size.z) * 0.6;

        // Position du marqueur
        const markerPos = objectPosition.clone().add(direction.multiplyScalar(-offset));

        return {
            x: markerPos.x,
            y: markerPos.y,
            z: markerPos.z
        };
    };

    // Mettre à jour la position du marqueur
    const updateMarkerPosition = () => {
        const position = calculateMarkerPosition();
        if (position) {
            setMarkerPosition(position);
        }
    };

    // Suivre les changements de l'objet ou de la caméra
    useEffect(() => {
        if (markerVisible) {
            updateMarkerPosition();
        }
    }, [markerVisible, objectRef.current?.position.x, objectRef.current?.position.y, objectRef.current?.position.z, camera?.position.x, camera?.position.y, camera?.position.z]);

    // Compléter une interaction
    const completeInteraction = () => {
        const now = Date.now();

        // Éviter les doubles déclenchements (anti-rebond)
        if (now - lastInteractionTime.current < 500) {
            return;
        }

        lastInteractionTime.current = now;

        // Jouer un son si disponible
        if (window.audioManager) {
            window.audioManager.playSound('click', { volume: 0.8 });
        }

        // Vérifier si une interaction est attendue et si nous sommes à la bonne étape
        if (interaction?.waitingForInteraction &&
            (!requiredInteractionStep || requiredInteractionStep === interaction.currentStep)) {

            // Appeler la fonction de complétion de l'interaction du store
            if (interaction.completeInteraction) {
                interaction.completeInteraction();
            }

            // Événement d'interaction complétée
            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                id,
                type: interactionType
            });

            // Callback personnalisé si fourni
            if (onInteractionComplete) {
                onInteractionComplete();
            }

            // Action personnalisée
            if (customAction) {
                customAction();
            }

            // Désactiver le marqueur
            setMarkerVisible(false);

            if (debugActive) {
                console.log(`Interaction complétée: ${id} (type: ${interactionType})`);
            }
        }
    };

    // Gérer le clic sur le marqueur
    const handleMarkerClick = () => {
        if (onMarkerClick) {
            onMarkerClick();
        }

        completeInteraction();
    };

    return {
        hovered,
        active,
        setActive,
        markerVisible,
        setMarkerVisible,
        markerPosition,
        updateMarkerPosition,
        completeInteraction,
        handleMarkerClick,
        markerRef,
        markerProps: {
            id,
            type: markerType,
            color: markerColor,
            text: markerText,
            scale: markerScale,
            position: markerPosition,
            faceCamera,
            animateMarker
        }
    };
};

export default useMarkerSystem;