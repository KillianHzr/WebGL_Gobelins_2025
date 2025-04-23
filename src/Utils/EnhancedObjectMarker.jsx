import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {EventBus} from './EventEmitter';
import {audioManager} from './AudioManager';
import useStore from '../Store/useStore';
import {useRayCaster} from "./RayCaster";
import {MARKER_EVENTS} from './EventEmitter.jsx';

export const ModelMarker = React.memo(function ModelMarker({
                                                               objectRef,         // Référence à l'objet, optionnelle si les enfants sont fournis
                                                               children,          // Enfants à englober (typiquement un mesh)
                                                               id,                // ID unique pour le marqueur
                                                               markerType = INTERACTION_TYPES.CLICK, // Type d'interaction
                                                               markerColor = "#44ff44", // Couleur du marqueur
                                                               markerText = "Interagir", // Texte du marqueur
                                                               markerScale = 1,    // Échelle du marqueur
                                                               onInteract,         // Fonction à appeler lors de l'interaction
                                                               interactionType,    // Alias pour markerType (pour compatibilité avec l'API existante)
                                                               requiredStep,       // Étape d'interaction requise
                                                               positionOptions = {}, // Options de positionnement
                                                               showMarkerOnHover = true, // Montrer le marqueur au survol (si interaction requise)
                                                               customMarker = null, // Marqueur personnalisé
                                                               onPointerEnter,     // Fonction pour gérer les événements de survol
                                                               onPointerLeave,     // Fonctions pour gérer les événements de survol
                                                               ...props
                                                           }) {
    // Référence pour l'objet englobant
    const groupRef = useRef();

    // État pour suivre si l'objet est survolé
    const [isHovered, setHovered] = useState(false);
    const [isMarkerHovered, setIsMarkerHovered] = useState(false);

    // État pour mémoriser si le marqueur doit rester visible
    const [keepMarkerVisible, setKeepMarkerVisible] = useState(false);

    // État pour suivre si l'interaction a été complétée
    const [interactionCompleted, setInteractionCompleted] = useState(false);

    // NOUVEAU: Garder une trace de l'étape d'interaction précédente
    const [lastCompletedStep, setLastCompletedStep] = useState(null);

    // Accès à l'état global d'interaction
    const interaction = useStore(state => state.interaction);

    // Accès au RayCaster
    const {addPointerEnterListener, addPointerLeaveListener, removePointerListeners} = useRayCaster();

    // Utiliser le type d'interaction passé par l'un ou l'autre paramètre
    const effectiveMarkerType = interactionType || markerType;

    // MODIFIÉ: Vérifier si le marqueur doit être affiché basé sur l'état d'interaction actuelle et l'historique
    const shouldShowMarker = (// Ne pas montrer si l'étape actuelle a déjà été complétée
        (interaction?.currentStep !== lastCompletedStep || !interactionCompleted) &&

        // Conditions standards d'affichage
        (isHovered || isMarkerHovered) && showMarkerOnHover && (!requiredStep || (interaction?.waitingForInteraction && interaction.currentStep === requiredStep)));

    // Gérer le clic sur l'objet
    const handleObjectInteraction = () => {
        if (interactionCompleted && interaction?.currentStep === lastCompletedStep) return;

        if (onInteract) {
            onInteract();
        }

        // Marquer l'interaction comme complétée
        setInteractionCompleted(true);
        setLastCompletedStep(interaction?.currentStep);
        setKeepMarkerVisible(false);
    };

    // Dans ModelMarker, modifiez les gestionnaires d'événements pour qu'ils gèrent correctement les états du composant
    const handleMarkerPointerEnter = (e) => {
        console.log('[ModelMarker] Marker pointer enter', id);
        // Arrêter complètement la propagation
        if (e) {
            e.stopPropagation();
            if (e.nativeEvent) {
                e.nativeEvent.stopPropagation();
            }
        }

        // Mettre à jour l'état interne du ModelMarker
        setIsMarkerHovered(true);

        // Propager l'événement au callback externe si fourni
        if (typeof onPointerEnter === 'function') {
            onPointerEnter(e);
        }
    };

    const handleMarkerPointerLeave = (e) => {
        console.log('[ModelMarker] Marker pointer leave', id);
        // Arrêter complètement la propagation
        if (e) {
            e.stopPropagation();
            if (e.nativeEvent) {
                e.nativeEvent.stopPropagation();
            }
        }

        // Mettre à jour l'état interne du ModelMarker
        setIsMarkerHovered(false);

        // Propager l'événement au callback externe si fourni
        if (typeof onPointerLeave === 'function') {
            onPointerLeave(e);
        }
    };

    // Écouter l'événement d'interaction complète
    useEffect(() => {
        const handleInteractionComplete = (data) => {
            if (data.id === id) {
                console.log(`[ModelMarker] Interaction ${id} marquée comme complétée pour l'étape ${interaction?.currentStep}`);

                // Stocker l'étape qui vient d'être complétée
                setInteractionCompleted(true);
                setLastCompletedStep(interaction?.currentStep);
                setKeepMarkerVisible(false);

                // Supprimer les écouteurs d'événements pour l'étape actuelle
                if (objectRef && objectRef.current) {
                    removePointerListeners(objectRef.current.uuid);
                }
                if (groupRef && groupRef.current) {
                    removePointerListeners(groupRef.current.uuid);
                }
            }
        };

        const cleanup = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);
        return cleanup;
    }, [id, removePointerListeners, interaction?.currentStep]);

    // IMPORTANT: Réinitialiser l'état lorsque l'étape d'interaction change
    useEffect(() => {
        // Si l'étape d'interaction a changé et est différente de la dernière étape complétée,
        // réinitialiser l'état pour permettre une nouvelle interaction
        if (interaction && interaction.currentStep !== lastCompletedStep && interaction.waitingForInteraction) {
            console.log(`[ModelMarker] Nouvelle étape d'interaction détectée: ${interaction.currentStep}, réinitialisation de l'état`);
            setInteractionCompleted(false);
        }
    }, [interaction?.currentStep, interaction?.waitingForInteraction, lastCompletedStep]);

    // S'abonner aux événements de pointeur via le système RayCaster
    useEffect(() => {
        // Ne pas ajouter d'écouteurs si l'interaction est déjà complétée pour l'étape actuelle
        if (interactionCompleted && interaction?.currentStep === lastCompletedStep) return;

        // Utiliser la référence à l'objet ou au groupe
        const targetRef = objectRef || groupRef;

        if (targetRef.current) {
            console.log(`[ModelMarker] Ajout des écouteurs pour l'étape ${interaction?.currentStep}`);

            // Ajouter des écouteurs pour le survol
            const removeEnterListener = addPointerEnterListener(targetRef.current.uuid, (intersection, event, object) => {
                if (interactionCompleted && interaction?.currentStep === lastCompletedStep) return;
                console.log('[EnhancedObjectMarker] Pointer enter via raycaster', object);
                setHovered(true);
            });

            const removeLeaveListener = addPointerLeaveListener(targetRef.current.uuid, (event) => {
                if (interactionCompleted && interaction?.currentStep === lastCompletedStep) return;
                console.log('[EnhancedObjectMarker] Pointer leave via raycaster');
                setHovered(false);

                // IMPORTANT: Si ni le modèle ni le marqueur ne sont survolés, nous devons nous assurer que le marqueur est caché
                if (!isMarkerHovered) {
                    setKeepMarkerVisible(false);
                }
            });

            return () => {
                removeEnterListener();
                removeLeaveListener();
            };
        }
    }, [objectRef, addPointerEnterListener, addPointerLeaveListener, interactionCompleted, interaction?.currentStep, lastCompletedStep, isMarkerHovered]);

    return (<group ref={groupRef} {...props}>
        {React.Children.map(children, child => React.cloneElement(child, {
            ref: objectRef || child.ref
        }))}

        {shouldShowMarker && (<EnhancedObjectMarker
            objectRef={objectRef || groupRef}
            markerType={effectiveMarkerType}
            color={markerColor}
            scale={markerScale}
            text={markerText}
            onClick={handleObjectInteraction}
            positionOptions={positionOptions}
            id={id}
            custom={customMarker}
            keepVisible={true}
            onPointerEnter={handleMarkerPointerEnter}
            onPointerLeave={handleMarkerPointerLeave}
        />)}
    </group>);
});
// Types d'interaction supportés
export const INTERACTION_TYPES = {
    CLICK: 'click',
    LONG_PRESS: 'longPress',
    DRAG_LEFT: 'dragLeft',
    DRAG_RIGHT: 'dragRight',
    DRAG_UP: 'dragUp',
    DRAG_DOWN: 'dragDown'
};

// Hook personnalisé pour calculer le point d'attachement optimal sur un objet
export const useOptimalMarkerPosition = (objectRef, options = {}) => {
    const {camera} = useThree();
    const [markerPosition, setMarkerPosition] = useState({x: 0, y: 0, z: 0});
    const [closestPoint, setClosestPoint] = useState(null);
    const [normalVector, setNormalVector] = useState(null);

    const positionCalculated = useRef(false);
    const initialPosition = useRef(null);

    const {
        offset = 0.5, preferredAxis = null, forceRecalculate = false
    } = options;

    const calculateStablePosition = useCallback(() => {
        if (!objectRef.current || !camera) return null;

        if (positionCalculated.current && initialPosition.current && !forceRecalculate) {
            return {
                position: initialPosition.current, point: closestPoint, normal: normalVector
            };
        }

        const obj = objectRef.current;
        const boundingBox = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        const cameraPosition = camera.position.clone();

        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const objectSize = Math.max(size.x, size.y, size.z);

        const cameraToObject = center.clone().sub(cameraPosition).normalize();

        const raycaster = new THREE.Raycaster(cameraPosition, cameraToObject);
        const intersects = raycaster.intersectObject(obj, true);

        let surfacePoint;

        if (intersects.length > 0) {
            surfacePoint = intersects[0].point;
        } else {
            surfacePoint = center;
        }

        const fixedOffset = objectSize * offset;

        const surfaceToCamera = cameraPosition.clone().sub(surfacePoint).normalize();

        const markerPos = surfacePoint.clone().add(surfaceToCamera.multiplyScalar(fixedOffset));

        const position = {
            x: markerPos.x, y: markerPos.y, z: markerPos.z
        };

        initialPosition.current = position;
        setClosestPoint(surfacePoint);
        setNormalVector(surfaceToCamera);
        setMarkerPosition(position);

        positionCalculated.current = true;

        return {
            position, point: surfacePoint, normal: surfaceToCamera
        };
    }, [camera, objectRef, offset, forceRecalculate]);

    useEffect(() => {
        calculateStablePosition();
    }, [objectRef.current, camera, calculateStablePosition]);

    const updateMarkerPosition = useCallback(() => {
        positionCalculated.current = false;
        calculateStablePosition();
    }, [calculateStablePosition]);

    return {
        position: markerPosition, closestPoint, normal: normalVector, updatePosition: updateMarkerPosition
    };
};

// Fonction pour créer une texture de texte
function createTextCanvas(text, fontSize = 32, fontWeight = 'bold', fontFamily = 'Albert Sans') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas;
}

// Fonction d'arrêt complet de la propagation
const stopAllPropagation = (e) => {
    if (!e) return;
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
    }
    if (e.nativeEvent) {
        e.nativeEvent.stopPropagation();
        if (typeof e.nativeEvent.stopImmediatePropagation === 'function') {
            e.nativeEvent.stopImmediatePropagation();
        }
    }
    e.preventDefault();
};

// Composant de marqueur d'interaction amélioré
const EnhancedObjectMarker = React.memo(function EnhancedObjectMarker({
                                                                          objectRef,
                                                                          markerType = INTERACTION_TYPES.CLICK,
                                                                          hovered,
                                                                          color = "#44ff44",
                                                                          scale = 1,
                                                                          text = "Interagir",
                                                                          onClick,
                                                                          positionOptions = {},
                                                                          animate = true,
                                                                          showText = true,
                                                                          pulseAnimation = true,
                                                                          custom = null,
                                                                          id = `marker-${Math.random().toString(36).substr(2, 9)}`,
                                                                          keepVisible = false,
                                                                          onPointerEnter,
                                                                          onPointerLeave
                                                                      }) {
    const markerRef = useRef();
    const [fadeIn, setFadeIn] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const {camera} = useThree();
    const time = useRef(0);
    const [buttonHovered, setButtonHovered] = useState(false);
    const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
    const isDraggingRef = useRef(false);
    const startDragPos = useRef({x: 0, y: 0});
    const currentDragPos = useRef({x: 0, y: 0});

    const longPressTimeoutRef = useRef(null);
    const longPressMinTime = 2000;
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [longPressFeedback, setLongPressFeedback] = useState(0);
    const longPressStartTime = useRef(0);

    const {position: markerPosition, normal: normalVector, updatePosition} = useOptimalMarkerPosition(objectRef, {
        offset: positionOptions.offsetDistance || 0.5, preferredAxis: positionOptions.preferredAxis, ...positionOptions
    });

    const handleMarkerPointerEnter = (e) => {
        stopAllPropagation(e);
        setIsHovering(true);
        if (typeof onPointerEnter === 'function') {
            onPointerEnter(e);
        }
    };

    const handleMarkerPointerLeave = (e) => {
        stopAllPropagation(e);
        setIsHovering(false);
        if (typeof onPointerLeave === 'function') {
            onPointerLeave(e);
        }
    };

    useEffect(() => {
        if (hovered || keepVisible || isHovering) {
            setFadeIn(true);
        } else {
            setFadeIn(false);
        }
    }, [hovered, keepVisible, isHovering]);

    const handleLongPressStart = (e) => {
        stopAllPropagation(e);
        if (markerType !== INTERACTION_TYPES.LONG_PRESS) return;

        longPressStartTime.current = Date.now();
        setIsLongPressing(true);
        setLongPressFeedback(0); // Réinitialiser la progression au début

        longPressTimeoutRef.current = setTimeout(() => {
            if (audioManager) {
                audioManager.playSound('click', {
                    volume: 0.8, fade: true, fadeTime: 400
                });
            }

            if (onClick) {
                onClick({
                    type: 'longPress', duration: longPressMinTime
                });
            }

            setIsLongPressing(false);
            setLongPressFeedback(0);

            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                id, type: markerType
            });
        }, longPressMinTime);

        window.addEventListener('mouseup', handleLongPressCancel);
        window.addEventListener('touchend', handleLongPressCancel);
        window.addEventListener('mousemove', handleLongPressMove);
        window.addEventListener('touchmove', handleLongPressMove);
    };

    const handleLongPressCancel = () => {
        if (!isLongPressing) return;

        clearTimeout(longPressTimeoutRef.current);
        setIsLongPressing(false);
        setLongPressFeedback(0);

        window.removeEventListener('mouseup', handleLongPressCancel);
        window.removeEventListener('touchend', handleLongPressCancel);
        window.removeEventListener('mousemove', handleLongPressMove);
        window.removeEventListener('touchmove', handleLongPressMove);
    };

    const handleLongPressMove = (e) => {
        if (!isLongPressing) return;

        if (!e || !e.target) {
            handleLongPressCancel();
            return;
        }

        try {
            const rect = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : {
                left: 0, top: 0, width: 0, height: 0
            };
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

            const moveX = clientX - (rect.left + rect.width / 2);
            const moveY = clientY - (rect.top + rect.height / 2);
            const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

            if (moveDistance > 20) {
                handleLongPressCancel();
            }
        } catch (error) {
            console.error('Error in handleLongPressMove:', error);
            handleLongPressCancel();
        }
    };

    const handleMarkerClick = (e) => {
        stopAllPropagation(e);

        if (markerType === INTERACTION_TYPES.LONG_PRESS) {
            handleLongPressStart(e);
            return;
        }

        if (markerType.includes('drag')) {
            console.log(`[EnhancedObjectMarker] Cette interaction nécessite un glissement (${markerType}), pas un simple clic`);
            return;
        }

        if (audioManager) {
            audioManager.playSound('click', {
                volume: 0.8
            });
        }

        if (onClick) {
            onClick({
                type: 'click'
            });
        }

        EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
            id, type: markerType
        });
    };

    const handleDragStart = (e) => {
        if (!markerType.includes('drag')) return;

        stopAllPropagation(e);
        isDraggingRef.current = true;

        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        startDragPos.current = {x: clientX, y: clientY};
        currentDragPos.current = {...startDragPos.current};

        // Réinitialiser l'offset de drag
        setDragOffset({x: 0, y: 0});

        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('touchmove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchend', handleDragEnd);
    };


    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;

        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : currentDragPos.current.x);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : currentDragPos.current.y);

        currentDragPos.current = {x: clientX, y: clientY};

        const dx = currentDragPos.current.x - startDragPos.current.x;
        const dy = currentDragPos.current.y - startDragPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const dragValue = 200;
        // Mettre à jour l'offset de déplacement visuel (limité à une certaine distance max)
        const maxOffset = dragValue; // Pixels maximum de déplacement visuel
        const scale = 1.0; // Facteur d'échelle pour contrôler la sensibilité

        // Calculer l'offset en fonction de la direction du drag
        let offsetX = 0;
        let offsetY = 0;

        if (markerType === INTERACTION_TYPES.DRAG_LEFT || markerType === INTERACTION_TYPES.DRAG_RIGHT) {
            offsetX = Math.min(Math.abs(dx * scale), maxOffset) * Math.sign(dx);
        } else if (markerType === INTERACTION_TYPES.DRAG_UP || markerType === INTERACTION_TYPES.DRAG_DOWN) {
            offsetY = Math.min(Math.abs(dy * scale), maxOffset) * Math.sign(dy);
        }

        setDragOffset({x: offsetX, y: offsetY});

        let direction = '';
        const threshold = dragValue;

        if (distance > threshold) {
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }

            let success = false;

            switch (markerType) {
                case INTERACTION_TYPES.DRAG_LEFT:
                    success = direction === 'left';
                    break;
                case INTERACTION_TYPES.DRAG_RIGHT:
                    success = direction === 'right';
                    break;
                case INTERACTION_TYPES.DRAG_UP:
                    success = direction === 'up';
                    break;
                case INTERACTION_TYPES.DRAG_DOWN:
                    success = direction === 'down';
                    break;
            }

            if (success) {
                if (audioManager) {
                    audioManager.playSound('drag', {
                        volume: 0.8, fade: true, fadeTime: 800
                    });
                }

                if (onClick) {
                    onClick({
                        type: markerType,
                        direction, distance
                    });
                }

                EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                    id, type: markerType
                });
                handleDragEnd();
            }
        }
    };


    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;

        isDraggingRef.current = false;

        // Réinitialiser l'offset avec animation
        setDragOffset({x: 0, y: 0});

        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchend', handleDragEnd);
    };

    useEffect(() => {
        return () => {
            if (longPressTimeoutRef.current) {
                clearTimeout(longPressTimeoutRef.current);
            }
            window.removeEventListener('mouseup', handleLongPressCancel);
            window.removeEventListener('touchend', handleLongPressCancel);
            window.removeEventListener('mousemove', handleLongPressMove);
            window.removeEventListener('touchmove', handleLongPressMove);
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, []);

    // Animation continue pour les marqueurs
    useFrame(() => {
        if (!markerRef.current) return;

        // Application de la position du marqueur
        if (markerPosition) {
            markerRef.current.position.set(markerPosition.x, markerPosition.y, markerPosition.z);
        }

        // Orientation vers la caméra pour l'effet billboard, mais préserver l'orientation verticale
        markerRef.current.lookAt(camera.position);
    });

    // Gérer les animations des marqueurs
    useFrame((state, delta) => {
        if (!markerRef.current || !fadeIn || !animate) return;

        time.current += delta;

        // Animations spécifiques selon le type d'interaction
        switch (markerType) {
            case INTERACTION_TYPES.LONG_PRESS:
                // Animation de pulsation lente pour le clic maintenu
                if (markerRef.current.children[0]) {
                    const pulse = Math.sin(time.current * 2) * 0.1 + 1;
                    markerRef.current.children[0].scale.set(pulse, pulse, 1);
                }

                // Mise à jour de la progression pour l'appui long
                if (isLongPressing) {
                    const elapsedTime = Date.now() - longPressStartTime.current;
                    const progress = Math.min(elapsedTime / longPressMinTime, 1);
                    setLongPressFeedback(progress);
                }
                break;

            case INTERACTION_TYPES.DRAG_LEFT:
            case INTERACTION_TYPES.DRAG_RIGHT:
            case INTERACTION_TYPES.DRAG_UP:
            case INTERACTION_TYPES.DRAG_DOWN:
                // Animation de mouvement pour les drags
                if (markerRef.current.children[2]) { // Flèche directionnelle
                    const move = Math.sin(time.current * 5) * 0.05;
                    const arrow = markerRef.current.children[2];

                    // Réinitialiser la position
                    arrow.position.set(0, 0, 0.02);

                    // Appliquer le mouvement selon la direction
                    if (markerType === INTERACTION_TYPES.DRAG_LEFT) {
                        arrow.position.x -= move;
                    } else if (markerType === INTERACTION_TYPES.DRAG_RIGHT) {
                        arrow.position.x += move;
                    } else if (markerType === INTERACTION_TYPES.DRAG_UP) {
                        arrow.position.y += move;
                    } else if (markerType === INTERACTION_TYPES.DRAG_DOWN) {
                        arrow.position.y -= move;
                    }
                }
                break;
            case INTERACTION_TYPES.CLICK:
            default:
                break;
        }
    });

    // Ne rien rendre si l'objet n'est pas survolé et keepVisible est false
    if (!hovered && !keepVisible && !isHovering) return null;

    // Si un composant personnalisé est fourni, l'utiliser
    if (custom) {
        return (<>
            <group
                ref={markerRef}
                position={[markerPosition.x, markerPosition.y, markerPosition.z]}
                onClick={handleMarkerClick}
                onPointerOver={handleMarkerPointerEnter}
                onPointerOut={handleMarkerPointerLeave}
                scale={fadeIn ? [scale, scale, scale] : [0.01, 0.01, 0.01]}
            >
                {custom}

                {/* Texte en HTML pour toujours rester correctement orienté */}
                {showText && (<Html
                    position={[0, 0.4, 0.05]} /* Position au-dessus avec léger décalage en Z */
                    className="marker-text"
                    style={{
                        opacity: fadeIn ? 1 : 0,
                        transition: 'opacity 0.3s',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontFamily: 'Albert Sans',
                        fontSize: '14px',
                        fontWeight: '600',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        width: 'auto',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)', /* Ombre pour lisibilité */
                    }}
                    center
                    fullscreen={false}
                    distanceFactor={10}
                    zIndexRange={[100, 0]}
                >
                    <div>{text}</div>
                </Html>)}
            </group>
        </>);
    }

    // Contenu visuel spécifique par type d'interaction
    return (<>
        {/* Groupe principal pour l'icône du marqueur */}
        <group
            ref={markerRef}
            position={[markerPosition.x, markerPosition.y, markerPosition.z]}
            onClick={handleMarkerClick}
            onPointerOver={handleMarkerPointerEnter}
            onPointerOut={handleMarkerPointerLeave}
            scale={fadeIn ? [scale, scale, scale] : [0.01, 0.01, 0.01]}
        >
            {markerType === INTERACTION_TYPES.CLICK && (<Html
                style={{
                    position: 'absolute',
                    width: '88px',
                    height: '88px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                    aspectRatio: 1,
                    borderRadius: '999px',
                    border: '1.5px solid #F9FEFF',
                    pointerEvents: 'auto',
                }}
                position={[0, 0, 0.002]}
                center>
                <div
                    onMouseEnter={(e) => {
                        console.log('Button hover enter');
                        stopAllPropagation(e);
                        setButtonHovered(true);
                        if (typeof onPointerEnter === 'function') {
                            onPointerEnter(e);
                        }
                    }}
                    onMouseLeave={(e) => {
                        console.log('Button hover leave');
                        stopAllPropagation(e);
                        setButtonHovered(false);
                        if (typeof onPointerLeave === 'function') {
                            onPointerLeave(e);
                        }
                    }}
                    onClick={(e) => {
                        stopAllPropagation(e);
                        handleMarkerClick(e);
                    }}
                    style={{
                        position: 'absolute',
                        width: '88px',
                        height: '88px',
                        display: 'flex',
                        padding: '8px',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        aspectRatio: 1,
                        borderRadius: '999px',
                        border: '1.5px solid #F9FEFF',
                        background: 'rgba(249, 254, 255, 0.50)',
                        pointerEvents: 'auto',
                        cursor: 'pointer', ...(buttonHovered ? {
                            boxShadow: '0px 0px 8px 4px rgba(255, 255, 255, 0.50)', backdropFilter: 'blur(2px)',
                        } : {})
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '56px',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: '#F9FEFF',
                            textAlign: 'center',
                            fontFamily: 'Albert Sans',
                            fontSize: '12px',
                            fontStyle: 'normal',
                            fontWeight: 600,
                            lineHeight: 'normal',
                            transition: 'box-shadow 0.3s ease, backdrop-filter 0.3s ease',
                        }}
                    >
                        {text}
                    </div>
                </div>
            </Html>)}

            {markerType === INTERACTION_TYPES.LONG_PRESS && (<Html
                style={{
                    position: 'absolute',
                    width: '88px',
                    height: '88px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                    aspectRatio: 1,
                    borderRadius: '999px',
                    border: '1.5px solid #F9FEFF',
                    pointerEvents: 'auto',
                }}
                position={[0, 0, 0.002]}
                center>
                <div
                    onMouseDown={handleLongPressStart}
                    onMouseUp={handleLongPressCancel}
                    onTouchStart={handleLongPressStart}
                    onTouchEnd={handleLongPressCancel}
                    onMouseEnter={(e) => {
                        console.log('Button hover enter');
                        stopAllPropagation(e);
                        setButtonHovered(true);
                        if (onPointerEnter) onPointerEnter(e);
                    }}
                    onMouseLeave={(e) => {
                        console.log('Button hover leave');
                        stopAllPropagation(e);
                        setButtonHovered(false);
                        if (onPointerLeave) onPointerLeave(e);
                    }}
                    style={{
                        position: 'absolute',
                        width: '88px',
                        height: '88px',
                        display: 'flex',
                        padding: '8px',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        aspectRatio: 1,
                        borderRadius: '999px',
                        border: '1.5px solid #F9FEFF',
                        background: 'rgba(249, 254, 255, 0.50)',
                        pointerEvents: 'auto',
                        transition: 'box-shadow 0.3s ease, backdrop-filter 0.3s ease',
                        cursor: 'pointer', ...(buttonHovered ? {
                            boxShadow: '0px 0px 8px 4px rgba(255, 255, 255, 0.50)', backdropFilter: 'blur(2px)',
                        } : {})
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '56px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: '#F9FEFF',
                            textAlign: 'center',
                            fontFamily: 'Albert Sans',
                            fontSize: '12px',
                            fontStyle: 'normal',
                            fontWeight: 600,
                            lineHeight: 'normal',
                        }}
                    >
                        {text}
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            width: `${isLongPressing ? (72 + longPressFeedback * 16) : 72}px`, // Commence à 32px et atteint 88px
                            height: `${isLongPressing ? (72 + longPressFeedback * 16) : 72}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexShrink: 0,
                            aspectRatio: 1,
                            borderRadius: '999px',
                            background: 'rgba(249, 254, 255, 0.30)',
                            border: '1px solid #F9FEFF',
                            transition: isLongPressing ? 'none' : 'all 0.3s ease',
                            opacity: isLongPressing ? 1 : 0.7,
                            pointerEvents: 'none',
                        }}
                    />
                </div>
            </Html>)}

            {/* Flèches directionnelles pour les drags */}
            {(markerType === INTERACTION_TYPES.DRAG_LEFT || markerType === INTERACTION_TYPES.DRAG_RIGHT || markerType === INTERACTION_TYPES.DRAG_UP || markerType === INTERACTION_TYPES.DRAG_DOWN) && (
                <Html
                    style={{
                        position: 'absolute',
                        width: '80px',
                        height: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0,
                        aspectRatio: 1,
                        borderRadius: '999px',
                        border: '1.5px solid #F9FEFF',
                        pointerEvents: 'auto',
                        transition: 'box-shadow 0.3s ease, backdrop-filter 0.3s ease',
                        transform: isDraggingRef.current ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : 'none',
                        // transition: isDraggingRef.current ? 'none' : 'transform 0.3s ease-out',
                    }}
                    position={[0, 0, 0.002]}
                    center>
                    <div
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        onMouseEnter={(e) => {
                            console.log('Button hover enter');
                            stopAllPropagation(e);
                            setButtonHovered(true);
                            if (typeof onPointerEnter === 'function') {
                                onPointerEnter(e);
                            }
                        }}
                        onMouseLeave={(e) => {
                            console.log('Button hover leave');
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            if (typeof onPointerLeave === 'function') {
                                onPointerLeave(e);
                            }
                        }}
                        style={{
                            position: 'absolute',
                            width: '80px',
                            height: '120px',
                            display: 'flex',
                            padding: '8px',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0,
                            aspectRatio: 1,
                            borderRadius: '999px',
                            border: '1.5px solid #F9FEFF',
                            background: 'rgba(249, 254, 255, 0.50)',
                            pointerEvents: 'auto',
                            cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                            ...(buttonHovered ? {
                                boxShadow: '0px 0px 8px 4px rgba(255, 255, 255, 0.50)',
                                backdropFilter: 'blur(2px)',
                            } : {})
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <div style={{
                                width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}>
                                <svg
                                    style={{
                                        transform: markerType === INTERACTION_TYPES.DRAG_LEFT ? 'rotate(-180deg)' :
                                            markerType === INTERACTION_TYPES.DRAG_RIGHT ? 'rotate(0deg)' :
                                                markerType === INTERACTION_TYPES.DRAG_UP ? 'rotate(-90deg)' :
                                                    'rotate(90deg)'
                                    }}
                                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                    fill="none">
                                    <path d="M12 2L22 12L12 22" stroke="#F9FEFF" strokeWidth="2" strokeLinecap="round"
                                          strokeLinejoin="round"/>
                                    <path d="M2 12L22 12" stroke="#F9FEFF" strokeWidth="2" strokeLinecap="round"
                                          strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div
                                style={{
                                    width: '100%',
                                    maxWidth: '56px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    color: '#F9FEFF',
                                    textAlign: 'center',
                                    fontFamily: 'Albert Sans',
                                    fontSize: '12px',
                                    fontStyle: 'normal',
                                    fontWeight: 600,
                                    lineHeight: 'normal',
                                }}
                            >
                                {text}
                            </div>
                        </div>
                    </div>
                </Html>
            )}
        </group>
    </>);
});

