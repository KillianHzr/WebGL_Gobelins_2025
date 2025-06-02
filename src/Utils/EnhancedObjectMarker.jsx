import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {EventBus} from './EventEmitter';
import {audioManager} from './AudioManager';
import useStore from '../Store/useStore';
import {useRayCaster} from "./RayCaster";
import {MARKER_EVENTS} from './EventEmitter.jsx';
import {useAnimationFrame} from "./AnimationManager.js";
import DoubleButtonConfirmMarker from "./DoubleButtonConfirmMarker.jsx";

export const ModelMarker = React.memo(function ModelMarker({
                                                               objectRef,
                                                               children,
                                                               id,
                                                               markerType = INTERACTION_TYPES.CLICK,
                                                               markerText = "Interagir",
                                                               markerScale = 1,
                                                               onInteract,
                                                               interactionType,
                                                               requiredStep,
                                                               positionOptions = {},
                                                               showMarkerOnHover = true,
                                                               customMarker = null,
                                                               onPointerEnter,
                                                               onPointerLeave,
                                                               postInteractionAnimation = null,
                                                               keepMarkerInView = true,
                                                               viewportMargin = 250,
                                                               smoothTransition = true,
                                                               transitionDuration = 300,
                                                               ...props
                                                           }) {
    // Référence pour l'objet englobant
    const groupRef = useRef();

    // État pour suivre si l'objet est survolé
    const [isHovered, setHovered] = useState(false);
    const [isMarkerHovered, setIsMarkerHovered] = useState(false);

    // État pour mémoriser si le marqueur doit rester visible
    const [keepMarkerVisible, setKeepMarkerVisible] = useState(false);
    // const [isInInteractionSequence, setIsInInteractionSequence] = useState(false);

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
    const shouldShowMarker = (
        // Ne pas montrer si l'étape a déjà été complétée
        !interactionCompleted && (
            // Cas spécial pour le type DISABLE : toujours afficher quand l'interaction est disponible
            (effectiveMarkerType === INTERACTION_TYPES.DISABLE &&
                (!requiredStep || (interaction?.waitingForInteraction && interaction.currentStep === requiredStep))) ||

            // Condition standard pour les autres types (basée sur le hover)
            ((isHovered || isMarkerHovered) &&
                showMarkerOnHover &&
                (!requiredStep || (interaction?.waitingForInteraction && interaction.currentStep === requiredStep)))
        )
    );

    // Gérer le clic sur l'objet
    const handleObjectInteraction = () => {
        if (interactionCompleted) return;

        if (onInteract) {
            onInteract();
        }

        // Marquer l'interaction comme complétée
        setInteractionCompleted(true);

        // Jouer l'animation après l'interaction si spécifiée
        if (postInteractionAnimation) {
            // Déclencher un événement personnalisé pour l'animation post-interaction
            EventBus.trigger(MARKER_EVENTS.INTERACTION_ANIMATION, {
                id,
                animationName: postInteractionAnimation.name,
                animationOptions: postInteractionAnimation.options || {},
                targetObject: postInteractionAnimation.targetObject || null
            });
        }
    };


    // // NOUVEAU: Écouter l'événement de complétion de séquence d'interactions
    // useEffect(() => {
    //     const handleSequenceComplete = (data) => {
    //         if (data.step === requiredStep) {
    //             console.log(`[ModelMarker] Sequence d'interaction ${requiredStep} complètement terminée`);
    //             // Une fois que toute la séquence est terminée, on peut masquer le marqueur
    //             setIsInInteractionSequence(false);
    //             setKeepMarkerVisible(false);
    //         }
    //     };
    //
    //     const cleanup = EventBus.on('interaction-sequence-complete', handleSequenceComplete);
    //     return cleanup;
    // }, [requiredStep]);

    // Dans ModelMarker, modifiez les gestionnaires d'événements pour qu'ils gèrent correctement les états du composant
    const handleMarkerPointerEnter = (e) => {
        // console.log('[ModelMarker] Marker pointer enter', id);
        // Arrêter complètement la propagation
        if (e) {
            e.stopPropagation();
            if (e.nativeEvent) {
                e.nativeEvent.stopPropagation();
            }
        }

        // Mettre à jour l'état interne du ModelMarker
        setIsMarkerHovered(true);

        // Émission d'un événement pour le système de narration
        EventBus.trigger(MARKER_EVENTS.MARKER_HOVER, {
            id,
            type: 'marker-hover',
            objectKey: id.split('-')[0] // Essayer d'extraire l'identifiant de l'objet
        });

        // Propager l'événement au callback externe si fourni
        if (typeof onPointerEnter === 'function') {
            onPointerEnter(e);
        }
    };

    const handleMarkerPointerLeave = (e) => {
        // console.log('[ModelMarker] Marker pointer leave', id);
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
    // useEffect(() => {
    //     const handleNextInteractionReady = (data) => {
    //         if (data.markerId === id) {
    //             // console.log(`[ModelMarker] Prêt pour la prochaine interaction ${id}`);
    //             // Mettre à jour les états directement
    //             setIsInInteractionSequence(true);
    //             setInteractionCompleted(false);
    //             setKeepMarkerVisible(true);
    //         }
    //     };
    //
    //     const cleanup = EventBus.on('next-interaction-ready', handleNextInteractionReady);
    //     return cleanup;
    // }, [id]);
    // Écouter l'événement d'interaction complète
    useEffect(() => {
        const handleInteractionComplete = (data) => {
            if (data.id === id) {
                // console.log(`[ModelMarker] Interaction ${id} marquée comme complétée pour l'étape ${interaction?.currentStep}`);

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
            // console.log(`[ModelMarker] Nouvelle étape d'interaction détectée: ${interaction.currentStep}, réinitialisation de l'état`);
            setInteractionCompleted(false);
        }
    }, [interaction?.currentStep, interaction?.waitingForInteraction, lastCompletedStep]);

    // S'abonner aux événements de pointeur via le système RayCaster
    useEffect(() => {
        // Utiliser la référence à l'objet ou au groupe
        const targetRef = objectRef || groupRef;

        if (targetRef.current) {
            // SUPPRIMÉ: la condition qui empêche l'ajout d'écouteurs pour les prochaines interactions
            // AJOUTÉ: log pour indiquer l'ajout d'écouteurs
            // console.log(`[ModelMarker] Ajout des écouteurs pour ${id}, étape ${interaction?.currentStep}`);

            // Ajouter des écouteurs pour le survol - modification de la logique pour gérer les interactions séquentielles
            const removeEnterListener = addPointerEnterListener(targetRef.current.uuid, (intersection, event, object) => {
                // Permettre le hover même si une interaction précédente a été complétée mais que nous sommes dans une séquence
                if (interactionCompleted && interaction?.currentStep === lastCompletedStep) {
                    // console.log('[EnhancedObjectMarker] Hover ignoré - interaction complétée');
                    return;
                }

                // console.log('[EnhancedObjectMarker] Pointer enter via raycaster', object);
                setHovered(true);
            });

            const removeLeaveListener = addPointerLeaveListener(targetRef.current.uuid, (event) => {
                // Permettre le leave hover même si une interaction précédente a été complétée mais que nous sommes dans une séquence
                if (interactionCompleted && interaction?.currentStep === lastCompletedStep) {
                    // console.log('[EnhancedObjectMarker] Leave hover ignoré - interaction complétée');
                    return;
                }

                // console.log('[EnhancedObjectMarker] Pointer leave via raycaster');
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
    }, [
        objectRef,
        groupRef,
        id,
        addPointerEnterListener,
        addPointerLeaveListener,
        interactionCompleted,
        interaction?.currentStep,
        lastCompletedStep,
        isMarkerHovered,
    ]);

    return (<group ref={groupRef} {...props}>
        {React.Children.map(children, child => React.cloneElement(child, {
            ref: objectRef || child.ref
        }))}

        {shouldShowMarker && (<EnhancedObjectMarker
            objectRef={objectRef || groupRef}
            markerType={effectiveMarkerType}
            scale={markerScale}
            text={markerText}
            onClick={handleObjectInteraction}
            positionOptions={{
                ...positionOptions,
                keepInView: keepMarkerInView,
                viewportMargin: viewportMargin,
                smoothTransition: smoothTransition,
                transitionDuration: transitionDuration
            }}
            id={id}
            custom={customMarker}
            keepVisible={true}
            onPointerEnter={handleMarkerPointerEnter}
            onPointerLeave={handleMarkerPointerLeave}
            hovered={isHovered || isMarkerHovered}
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
    DRAG_DOWN: 'dragDown',
    DISABLE: 'disable',
    CONFIRM: 'confirm',
};

export const useOptimalMarkerPosition = (objectRef, options = {}) => {
    const {camera, gl: renderer} = useThree();
    const [markerPosition, setMarkerPosition] = useState({x: 0, y: 0, z: 0});
    const [closestPoint, setClosestPoint] = useState(null);
    const [normalVector, setNormalVector] = useState(null);
    const [isVisible, setIsVisible] = useState(true);

    // Refs pour le suivi de l'état
    const positionCalculated = useRef(false);
    const initialPosition = useRef(null);
    const lastUpdateTime = useRef(0);
    const targetPosition = useRef(null);
    const isMoving = useRef(false);
    const startPosition = useRef(null);
    const moveProgress = useRef(0);

    // Options avec valeurs par défaut
    const {
        offset = 0.5,
        preferredAxis = null,
        forceRecalculate = false,
        keepInView = true,
        viewportMargin = 50,
        smoothTransition = true,
        transitionDuration = 300,
        updateInterval = 100
    } = options;

    // Vérifier si un point est visible dans le viewport
    const isInViewport = useCallback((position) => {
        if (!camera || !renderer || !position) return true;

        try {
            // Créer un vecteur THREE.Vector3 si nécessaire
            const vector = position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z);

            // Projeter le point 3D en coordonnées d'écran 2D
            vector.project(camera);

            // Coordonnées en pixels
            const widthHalf = renderer.domElement.width / 2;
            const heightHalf = renderer.domElement.height / 2;

            const x = (vector.x * widthHalf) + widthHalf;
            const y = -(vector.y * heightHalf) + heightHalf;

            // Vérifier si le point est dans le viewport avec une marge
            return (vector.z < 1 && // Le point est devant la caméra
                x >= viewportMargin && x <= renderer.domElement.width - viewportMargin && y >= viewportMargin && y <= renderer.domElement.height - viewportMargin);
        } catch (error) {
            console.warn("Erreur lors de la vérification de la visibilité:", error);
            return true; // En cas d'erreur, supposer que le point est visible
        }
    }, [camera, renderer, viewportMargin]);

    // Ajuster la position pour qu'elle reste dans le viewport
    const adjustPositionToStayInView = useCallback((position, objectCenter) => {
        if (!camera || !renderer || !position || !objectCenter || !keepInView) return position;
        if (isInViewport(position)) return position;

        try {
            // Distance entre la caméra et l'objet
            const distanceToObject = camera.position.distanceTo(objectCenter);

            // Créer un plant perpendiculaire à la direction de la caméra
            const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
            const viewDistance = distanceToObject * 0.8;
            const viewCenter = camera.position.clone().add(cameraDirection.multiplyScalar(viewDistance));

            // Calculer les dimensions du viewport à cette distance
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const height = 2 * Math.tan(vFOV / 2) * viewDistance;
            const width = height * camera.aspect;

            // Calculer les marges
            const marginRatio = viewportMargin / Math.min(renderer.domElement.width, renderer.domElement.height);
            const safeWidth = width * (1 - marginRatio * 2);
            const safeHeight = height * (1 - marginRatio * 2);

            // Vecteurs de base
            const rightVector = new THREE.Vector3().crossVectors(cameraDirection, camera.up).normalize();
            const upVector = camera.up.clone().normalize();

            // Position relative au centre de l'écran
            const relativePos = position.clone().sub(viewCenter);

            // Décomposer en composantes
            const horizontalDist = relativePos.dot(rightVector);
            const verticalDist = relativePos.dot(upVector);

            // Limiter aux dimensions sécurisées
            const boundedHorizontal = Math.max(Math.min(horizontalDist, safeWidth / 2), -safeWidth / 2);
            const boundedVertical = Math.max(Math.min(verticalDist, safeHeight / 2), -safeHeight / 2);

            // Reconstruire la position ajustée
            const adjustedPosition = viewCenter.clone()
                .add(rightVector.multiplyScalar(boundedHorizontal))
                .add(upVector.multiplyScalar(boundedVertical));

            return adjustedPosition;
        } catch (error) {
            console.warn("Erreur lors de l'ajustement de la position:", error);
            return position; // En cas d'erreur, retourner la position originale
        }
    }, [camera, renderer, isInViewport, keepInView]);

    // Calculer ou récupérer la position stable du marqueur
    const calculateStablePosition = useCallback(() => {
        if (!objectRef.current || !camera) return null;

        // Si déjà calculé et pas besoin de recalculer
        if (positionCalculated.current && initialPosition.current && !forceRecalculate && !isMoving.current) {
            // Vérifier quand même si le point est visible
            if (!keepInView || isInViewport({
                x: initialPosition.current.x, y: initialPosition.current.y, z: initialPosition.current.z
            })) {
                return {
                    position: initialPosition.current, point: closestPoint, normal: normalVector
                };
            }
        }

        try {
            // Calculer la position
            const obj = objectRef.current;
            const boundingBox = new THREE.Box3().setFromObject(obj);
            const center = new THREE.Vector3();
            boundingBox.getCenter(center);

            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            const objectSize = Math.max(size.x, size.y, size.z);

            const cameraPosition = camera.position.clone();
            const cameraToObject = center.clone().sub(cameraPosition).normalize();

            const raycaster = new THREE.Raycaster(cameraPosition, cameraToObject);
            const intersects = raycaster.intersectObject(obj, true);

            let surfacePoint = intersects.length > 0 ? intersects[0].point : center;

            const fixedOffset = objectSize * offset;
            const surfaceToCamera = cameraPosition.clone().sub(surfacePoint).normalize();
            let markerPos = surfacePoint.clone().add(surfaceToCamera.multiplyScalar(fixedOffset));

            // Ajuster si nécessaire
            if (keepInView) {
                const adjusted = adjustPositionToStayInView(markerPos, center);

                // Si transition fluide est activée et qu'on a une position initiale
                if (smoothTransition && initialPosition.current && !forceRecalculate) {
                    const currentPos = new THREE.Vector3(initialPosition.current.x, initialPosition.current.y, initialPosition.current.z);

                    // Vérifier si le déplacement est nécessaire
                    const distance = currentPos.distanceTo(adjusted);
                    if (distance > 0.01) {
                        // Configurer la transition
                        isMoving.current = true;
                        moveProgress.current = 0;
                        startPosition.current = currentPos.clone();
                        targetPosition.current = adjusted.clone();

                        // Conserver la position actuelle pendant la transition
                        markerPos = currentPos.clone();
                    } else {
                        markerPos = adjusted.clone();
                    }
                } else {
                    markerPos = adjusted.clone();
                }
            }

            // Mettre à jour l'état
            const position = {
                x: markerPos.x, y: markerPos.y, z: markerPos.z
            };

            // Ne pas écraser la position si on est en mouvement
            if (!isMoving.current || forceRecalculate) {
                initialPosition.current = position;
                setMarkerPosition(position);
                setClosestPoint(surfacePoint);
                setNormalVector(surfaceToCamera);
            }

            positionCalculated.current = true;

            return {
                position, point: surfacePoint, normal: surfaceToCamera
            };
        } catch (error) {
            console.warn("Erreur lors du calcul de la position:", error);
            return {
                position: initialPosition.current || {x: 0, y: 0, z: 0}, point: closestPoint, normal: normalVector
            };
        }
    }, [camera, objectRef, offset, forceRecalculate, isInViewport, keepInView, adjustPositionToStayInView, smoothTransition]);

    // Effectuer le calcul initial
    useEffect(() => {
        calculateStablePosition();
    }, [objectRef.current, camera, calculateStablePosition]);

    const checkAndUpdate = useCallback((delta) => {
        if (!delta) delta = 0.016; // Delta par défaut si non fourni

        try {
            // Mettre à jour la transition si en cours
            if (isMoving.current && startPosition.current && targetPosition.current) {
                moveProgress.current += delta * 1000 / transitionDuration;

                if (moveProgress.current >= 1) {
                    // Transition terminée
                    isMoving.current = false;
                    const finalPos = {
                        x: targetPosition.current.x, y: targetPosition.current.y, z: targetPosition.current.z
                    };
                    setMarkerPosition(finalPos);
                    initialPosition.current = finalPos;
                } else {
                    // Fonction d'easing pour une transition douce
                    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic
                    const t = ease(moveProgress.current);

                    // Interpoler
                    const newPos = startPosition.current.clone().lerp(targetPosition.current, t);
                    setMarkerPosition({
                        x: newPos.x, y: newPos.y, z: newPos.z
                    });
                }

                return true; // Transition en cours
            }

            // Vérifier périodiquement la visibilité
            if (keepInView && initialPosition.current) {
                const now = Date.now();
                if (now - lastUpdateTime.current > updateInterval) {
                    lastUpdateTime.current = now;

                    const currentPos = new THREE.Vector3(initialPosition.current.x, initialPosition.current.y, initialPosition.current.z);

                    const visible = isInViewport(currentPos);
                    // setIsVisible(visible);

                    if (!visible) {
                        calculateStablePosition();
                    }
                }
            }

            return false; // Pas de transition en cours
        } catch (error) {
            console.warn("Erreur lors de la mise à jour:", error);
            return false;
        }
    }, [calculateStablePosition, isInViewport, keepInView, updateInterval, transitionDuration]);

    // Fonction pour forcer une mise à jour
    const updatePosition = useCallback(() => {
        isMoving.current = false;
        positionCalculated.current = false;
        calculateStablePosition();
    }, [calculateStablePosition]);

    return {
        position: markerPosition, closestPoint, normal: normalVector, isVisible, updatePosition, checkAndUpdate // Renommer pour éviter les confusions avec checkVisibility
    };
};

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
    const {camera, gl} = useThree();
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

    // Options sécurisées pour le positionnement
    const safePositionOptions = {
        offsetDistance: positionOptions.offsetDistance || 0.5,
        preferredAxis: positionOptions.preferredAxis,
        keepInView: positionOptions.keepInView !== undefined ? positionOptions.keepInView : true,
        viewportMargin: positionOptions.viewportMargin || 50,
        smoothTransition: positionOptions.smoothTransition !== undefined ? positionOptions.smoothTransition : true,
        transitionDuration: positionOptions.transitionDuration || 300, ...positionOptions
    };

    // Utiliser le hook avec gestion d'erreurs
    const {
        position: markerPosition,
        normal: normalVector,
        updatePosition,
        checkAndUpdate  // Assurez-vous qu'elle s'appelle bien checkAndUpdate ici
    } = useOptimalMarkerPosition(objectRef, safePositionOptions);

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
    useAnimationFrame((state, delta) => {
        if (!markerRef.current) return;

        try {
            // Application de la position du marqueur
            if (markerPosition) {
                markerRef.current.position.set(markerPosition.x, markerPosition.y, markerPosition.z);
            }

            // Orientation vers la caméra pour l'effet billboard
            markerRef.current.lookAt(camera.position);

            // Vérifier et ajuster la visibilité
            if (animate) {
                checkAndUpdate(delta);
            }
        } catch (error) {
            console.warn("Erreur dans l'animation du marqueur:", error);
        }
    }, 'ui');

    const handleLongPressStart = (e) => {
        stopAllPropagation(e);
        if (markerType !== INTERACTION_TYPES.LONG_PRESS) return;

        longPressStartTime.current = Date.now();
        setIsLongPressing(true);

        longPressTimeoutRef.current = setTimeout(() => {
            if (audioManager) {
                // audioManager.playSound('click', {
                //     volume: 0.8, fade: true, fadeTime: 400
                // });
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
            // console.log(`[EnhancedObjectMarker] Cette interaction nécessite un glissement (${markerType}), pas un simple clic`);
            return;
        }

        if (audioManager) {
            // audioManager.playSound('click', {
            //     volume: 0.8
            // });
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
                        type: markerType, direction, distance
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
            // Nettoyer tous les écouteurs d'événements
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

    // Animation continue pour les marqueurs et contrainte au viewport
    useAnimationFrame((state, delta) => { // Assurez-vous de récupérer delta depuis les arguments
        if (!markerRef.current) return;

        // Application de la position du marqueur
        if (markerPosition) {
            markerRef.current.position.set(markerPosition.x, markerPosition.y, markerPosition.z);
        }

        // Orientation vers la caméra pour l'effet billboard
        markerRef.current.lookAt(camera.position);

        // Vérifier et ajuster la visibilité si nécessaire
        if (animate) {
            checkAndUpdate(delta); // Correction - utiliser le nouveau nom de fonction
        }
    }, 'ui');

    // Gérer les animations des marqueurs

    // Animation existante
    useAnimationFrame((state, delta) => {
        if (!markerRef.current || !fadeIn || !animate) return;

        try {
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
        } catch (error) {
            console.warn("Erreur dans l'animation du marqueur:", error);
        }
    }, 'ui');

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
                    position={[0, 0.4, 0.05]}
                    className="marker-text"
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
                className="marker-button"
                position={[0, 0, 0.002]}
                center
            >
                <div
                    className={`marker-button-inner ${buttonHovered ? 'marker-button-inner-hovered' : ''}`}
                    onMouseEnter={(e) => {
                        // console.log('Button hover enter');
                        stopAllPropagation(e);
                        setButtonHovered(true);
                        if (typeof onPointerEnter === 'function') {
                            onPointerEnter(e);
                        }
                    }}
                    onMouseLeave={(e) => {
                        // console.log('Button hover leave');
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
                >
                    <div className="marker-button-inner-text">
                        {text}
                    </div>
                </div>
            </Html>)}

            {markerType === INTERACTION_TYPES.LONG_PRESS && (
                <Html
                    className="marker-button"
                    position={[0, 0, 0.002]}
                    center
                >
                    <div
                        className={`marker-button-inner ${buttonHovered ? 'marker-button-inner-hovered' : ''}`}
                        onMouseDown={(e) => {
                            stopAllPropagation(e);
                            handleLongPressStart(e);
                        }}
                        onMouseUp={(e) => {
                            stopAllPropagation(e);
                            handleLongPressCancel();
                        }}
                        onTouchStart={(e) => {
                            stopAllPropagation(e);
                            handleLongPressStart(e);
                        }}
                        onTouchEnd={(e) => {
                            stopAllPropagation(e);
                            handleLongPressCancel();
                        }}
                        onMouseLeave={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            handleLongPressCancel();
                            if (onPointerLeave) onPointerLeave(e);
                        }}
                        onMouseEnter={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(true);
                            if (onPointerEnter) onPointerEnter(e);
                        }}
                    >
                        <div className="marker-button-inner-text">
                            {text}
                        </div>
                        {/* Toujours afficher le cercle de progression mais avec des styles conditionnels */}
                        <div
                            className="marker-button-inner-progress"
                            style={{
                                transform: `scale(${isLongPressing ? 1 + longPressFeedback * 0.22 : 1})`,
                                width: '72px',
                                height: '72px',
                                opacity: isLongPressing ? 1 : 0.7,
                                transition: isLongPressing ? 'transform 0.1s linear' : 'transform 0.3s ease, opacity 0.3s ease'
                            }}
                        />
                    </div>
                </Html>
            )}

            {/* Flèches directionnelles pour les drags */}
            {(markerType === INTERACTION_TYPES.DRAG_LEFT || markerType === INTERACTION_TYPES.DRAG_RIGHT || markerType === INTERACTION_TYPES.DRAG_UP || markerType === INTERACTION_TYPES.DRAG_DOWN) && (
                <Html
                    className="marker-drag"
                    position={[0, 0, 0.002]}
                    center
                    style={{
                        transform: isDraggingRef.current ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : 'none'
                    }}
                >
                    <div
                        className={`marker-drag-inner ${buttonHovered ? 'marker-drag-inner-hovered' : ''} ${isDraggingRef.current ? 'marker-drag-inner-dragging' : ''}`}
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        onMouseEnter={(e) => {
                            // console.log('Button hover enter');
                            stopAllPropagation(e);
                            setButtonHovered(true);
                            if (typeof onPointerEnter === 'function') {
                                onPointerEnter(e);
                            }
                        }}
                        onMouseLeave={(e) => {
                            // console.log('Button hover leave');
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            if (typeof onPointerLeave === 'function') {
                                onPointerLeave(e);
                            }
                        }}
                    >
                        <div className="marker-drag-inner-content">
                            <div className="marker-drag-inner-icon">
                                <svg
                                    style={{
                                        transform: markerType === INTERACTION_TYPES.DRAG_LEFT ? 'rotate(-180deg)' : markerType === INTERACTION_TYPES.DRAG_RIGHT ? 'rotate(0deg)' : markerType === INTERACTION_TYPES.DRAG_UP ? 'rotate(-90deg)' : 'rotate(90deg)'
                                    }}
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path d="M12 2L22 12L12 22" stroke="#F9FEFF" strokeWidth="2"
                                          strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2 12L22 12" stroke="#F9FEFF" strokeWidth="2" strokeLinecap="round"
                                          strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div className="marker-drag-inner-text">
                                {text}
                            </div>
                        </div>
                    </div>
                </Html>)}

            // Dans EnhancedObjectMarker.jsx, modifiez le rendu des marqueurs de type DISABLE
            // Recherchez ce code (ligne 1084 environ) :

            {markerType === INTERACTION_TYPES.DISABLE && (
                <Html
                    className="marker-button disable"
                    position={[0, 0, 0.002]}
                    center
                >
                    <div
                        className={`marker-button-inner ${buttonHovered ? 'marker-button-inner-hovered' : ''}`}
                        onMouseEnter={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(true);

                            // Déclencher l'interaction directement au survol
                            if (onClick) {
                                onClick({
                                    type: 'hover'
                                });
                            }

                            // Émettre l'événement d'interaction complète
                            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                                id, type: markerType
                            });

                            if (onPointerEnter) onPointerEnter(e);
                        }}
                        onMouseLeave={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            if (onPointerLeave) onPointerLeave(e);
                        }}
                        // Pour le support tactile
                        onTouchStart={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(true);

                            // Déclencher l'interaction au toucher sur mobile
                            if (onClick) {
                                onClick({
                                    type: 'touch'
                                });
                            }

                            // Émettre l'événement d'interaction complète
                            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                                id, type: markerType
                            });
                        }}
                    >
                        <div className="marker-button-inner-text">
                            {text}
                        </div>
                        <div
                            className="marker-button-inner-progress"
                            style={{
                                width: '72px',
                                height: '72px',
                                opacity: 0.7,
                            }}
                        />
                    </div>
                </Html>
            )}

            // Et remplacez-le par ce code :

            {markerType === INTERACTION_TYPES.DISABLE && (
                <Html
                    className="marker-button disable center-screen"
                    position={[0, 0, 0.002]}
                    center
                    zIndexRange={[9999, 10000]}
                >
                    <div
                        className={`marker-button-inner ${buttonHovered ? 'marker-button-inner-hovered' : ''}`}
                        onMouseEnter={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(true);

                            // Déclencher l'interaction directement au survol
                            if (onClick) {
                                onClick({
                                    type: 'hover'
                                });
                            }

                            // Émettre l'événement d'interaction complète
                            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                                id, type: markerType
                            });

                            if (onPointerEnter) onPointerEnter(e);
                        }}
                        onMouseLeave={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            if (onPointerLeave) onPointerLeave(e);
                        }}
                        // Pour le support tactile
                        onTouchStart={(e) => {
                            stopAllPropagation(e);
                            setButtonHovered(true);

                            // Déclencher l'interaction au toucher sur mobile
                            if (onClick) {
                                onClick({
                                    type: 'touch'
                                });
                            }

                            // Émettre l'événement d'interaction complète
                            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                                id, type: markerType
                            });
                        }}
                    >
                        <div className="marker-button-inner-text">
                            {text}
                        </div>
                        <div
                            className="marker-button-inner-progress"
                            style={{
                                width: '72px',
                                height: '72px',
                                opacity: 0.7,
                            }}
                        />
                    </div>
                </Html>
            )}

            {markerType === INTERACTION_TYPES.CONFIRM && (
                <DoubleButtonConfirmMarker
                    id={id}
                    text={text}
                    buttonHovered={buttonHovered}
                    setButtonHovered={setButtonHovered}
                    onClick={onClick}
                    onPointerEnter={onPointerEnter}
                    onPointerLeave={onPointerLeave}
                    stopAllPropagation={stopAllPropagation}
                    EventBus={EventBus}
                    MARKER_EVENTS={MARKER_EVENTS}
                />
            )}
        </group>
    </>);
});