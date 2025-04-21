import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {EventBus} from './EventEmitter';
import {audioManager} from './AudioManager';
import useStore from '../Store/useStore';
import {useRayCaster} from "./RayCaster.jsx";
import MARKER_EVENTS from "./EventEmitter.jsx";

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

    // Référence pour suivre si la position a déjà été calculée
    const positionCalculated = useRef(false);
    // Mémoriser la position initiale pour éviter tout recalcul non désiré
    const initialPosition = useRef(null);

    // Options par défaut
    const {
        offset = 0.5, preferredAxis = null, forceRecalculate = false
    } = options;

    // Fonction pour calculer une position stable pour le marqueur
    const calculateStablePosition = useCallback(() => {
        if (!objectRef.current || !camera) return null;

        // Si déjà calculé et pas de forçage de recalcul, retourner position mémorisée
        if (positionCalculated.current && initialPosition.current && !forceRecalculate) {
            return {
                position: initialPosition.current, point: closestPoint, normal: normalVector
            };
        }

        // Récupérer l'objet et sa boîte englobante
        const obj = objectRef.current;
        const boundingBox = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        // Position de la caméra
        const cameraPosition = camera.position.clone();

        // Taille de l'objet pour l'offset proportionnel
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const objectSize = Math.max(size.x, size.y, size.z);

        // Direction caméra -> objet (normalisée)
        const cameraToObject = center.clone().sub(cameraPosition).normalize();

        // Trouver le point d'intersection sur l'objet
        const raycaster = new THREE.Raycaster(cameraPosition, cameraToObject);
        const intersects = raycaster.intersectObject(obj, true);

        let surfacePoint;

        if (intersects.length > 0) {
            surfacePoint = intersects[0].point;
        } else {
            // Fallback: utiliser le centre
            surfacePoint = center;
        }

        // Distance fixe depuis la surface vers la caméra
        const fixedOffset = objectSize * offset;

        // Direction surface -> caméra (normalisée)
        const surfaceToCamera = cameraPosition.clone().sub(surfacePoint).normalize();

        // Position finale: point sur la surface + décalage vers la caméra
        const markerPos = surfacePoint.clone().add(surfaceToCamera.multiplyScalar(fixedOffset));

        // Mémoriser cette position initiale
        const position = {
            x: markerPos.x, y: markerPos.y, z: markerPos.z
        };

        initialPosition.current = position;
        setClosestPoint(surfacePoint);
        setNormalVector(surfaceToCamera);
        setMarkerPosition(position);

        // Marquer comme calculé
        positionCalculated.current = true;

        return {
            position, point: surfacePoint, normal: surfaceToCamera
        };
    }, [camera, objectRef, offset, forceRecalculate]);

    // Calcul initial unique au montage ou quand les dépendances changent
    useEffect(() => {
        calculateStablePosition();
    }, [objectRef.current, camera, calculateStablePosition]);

    // Fonction explicite pour mettre à jour la position
    const updateMarkerPosition = useCallback(() => {
        positionCalculated.current = false;
        calculateStablePosition();
    }, [calculateStablePosition]);

    return {
        position: markerPosition, closestPoint, normal: normalVector, updatePosition: updateMarkerPosition
    };
};

// Fonction pour créer une texture de texte
function createTextCanvas(text, fontSize = 32, fontWeight = 'bold', fontFamily = 'Arial') {
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

// Assurez-vous que cette fonction stoppe complètement la propagation
const stopAllPropagation = (e) => {
    if (!e) return;

    // Arrêter la propagation React
    e.stopPropagation();

    // Arrêter la propagation immédiate (plus agressive)
    if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
    }

    // Arrêter aussi les événements natifs
    if (e.nativeEvent) {
        e.nativeEvent.stopPropagation();
        if (typeof e.nativeEvent.stopImmediatePropagation === 'function') {
            e.nativeEvent.stopImmediatePropagation();
        }
    }

    // Empêcher toute autre action par défaut
    e.preventDefault();
};
/**
 * Composant marqueur d'interaction amélioré qui s'adapte à différents types d'interactions
 */
const EnhancedObjectMarker = ({
                                  objectRef,                      // Référence à l'objet 3D
                                  markerType = INTERACTION_TYPES.CLICK, // Type d'interaction attendue
                                  hovered,                        // Si l'objet est survolé
                                  color = "#44ff44",              // Couleur principale du marqueur
                                  scale = 1,                      // Échelle du marqueur
                                  text = "Interagir",             // Texte à afficher
                                  onClick,                        // Fonction à appeler lors du clic
                                  positionOptions = {},           // Options pour le positionnement
                                  animate = true,                 // Activer les animations
                                  showText = true,                // Afficher le texte
                                  pulseAnimation = true,          // Activer l'animation de pulsation
                                  custom = null,                  // Composant personnalisé à rendre
                                  id = `marker-${Math.random().toString(36).substr(2, 9)}`, // ID unique pour le marqueur
                                  keepVisible = false,            // Nouveau prop pour forcer la visibilité
                                  onPointerEnter,                 // Fonction appelée quand le pointeur entre dans le marqueur
                                  onPointerLeave                  // Fonction appelée quand le pointeur quitte le marqueur
                              }) => {
    const markerRef = useRef();
    const [fadeIn, setFadeIn] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const {camera} = useThree();
    const time = useRef(0);
    const [buttonHovered, setButtonHovered] = useState(false); // État spécifique pour le survol du bouton HTML
    const isDraggingRef = useRef(false); // Référence pour suivre si on est en train de faire un drag
    const startDragPos = useRef({x: 0, y: 0}); // Position de départ du drag
    const currentDragPos = useRef({x: 0, y: 0}); // Position actuelle du drag

    // Variables pour l'appui long
    const longPressTimeoutRef = useRef(null);
    const longPressMinTime = 2000; // Durée minimale pour considérer un appui comme "long" (en ms)
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [longPressFeedback, setLongPressFeedback] = useState(0); // Pour l'animation de progression
    const longPressStartTime = useRef(0);

    // Utilisation de la position optimale pour le marqueur
    const {position: markerPosition, normal: normalVector, updatePosition} = useOptimalMarkerPosition(objectRef, {
        offset: positionOptions.offsetDistance || 0.5, preferredAxis: positionOptions.preferredAxis, ...positionOptions
    });

    // Gérer le survol du marqueur lui-même avec arrêt complet de la propagation
    // Gérer le survol du marqueur lui-même avec arrêt complet de la propagation
    const handleMarkerPointerEnter = (e) => {
        console.log('[EnhancedObjectMarker] Pointer enter on marker');
        // Arrêter complètement la propagation
        stopAllPropagation(e);

        // Mettre à jour son propre état de survol
        setIsHovering(true);

        // Appeler le callback externe
        if (typeof onPointerEnter === 'function') {
            onPointerEnter(e); // Ce callback vient de ModelMarker et modifiera son état setIsMarkerHovered
        }
    };

    const handleMarkerPointerLeave = (e) => {
        console.log('[EnhancedObjectMarker] Pointer leave on marker');
        // Arrêter complètement la propagation
        stopAllPropagation(e);

        // Mettre à jour son propre état de survol
        setIsHovering(false);

        // Appeler le callback externe
        if (typeof onPointerLeave === 'function') {
            onPointerLeave(e); // Ce callback vient de ModelMarker et modifiera son état setIsMarkerHovered
        }
    };

    // Effet de transition pour l'apparition du marqueur
    useEffect(() => {
        if (hovered || keepVisible || isHovering) {
            setFadeIn(true);
        } else {
            setFadeIn(false);
        }
    }, [hovered, keepVisible, isHovering]);

    // Fonction pour démarrer le timer d'appui long
    const handleLongPressStart = (e) => {
        stopAllPropagation(e);

        // Ignorer si ce n'est pas un marqueur de type appui long
        if (markerType !== INTERACTION_TYPES.LONG_PRESS) return;

        console.log('[EnhancedObjectMarker] Long press started');
        longPressStartTime.current = Date.now();
        setIsLongPressing(true);

        // Démarrer le timer pour l'appui long
        longPressTimeoutRef.current = setTimeout(() => {
            // L'appui a duré assez longtemps
            console.log('[EnhancedObjectMarker] Long press completed');

            // Jouer un son de confirmation
            if (audioManager) {
                audioManager.playSound('click', {
                    volume: 0.8, fade: true, fadeTime: 400
                });
            }

            // Appeler le callback avec les infos du long press
            if (onClick) {
                onClick({
                    type: 'longPress', duration: longPressMinTime
                });
            }

            // Réinitialiser l'état
            setIsLongPressing(false);
            setLongPressFeedback(0);

            // Émettre un événement pour informer le système de marqueurs
            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                id, type: markerType
            });
        }, longPressMinTime);

        // Ajouter les écouteurs pour l'annulation
        window.addEventListener('mouseup', handleLongPressCancel);
        window.addEventListener('touchend', handleLongPressCancel);
        window.addEventListener('mousemove', handleLongPressMove);
        window.addEventListener('touchmove', handleLongPressMove);
    };

    // Fonction pour annuler l'appui long si l'utilisateur bouge trop ou relâche
    const handleLongPressCancel = () => {
        if (!isLongPressing) return;

        console.log('[EnhancedObjectMarker] Long press canceled');
        clearTimeout(longPressTimeoutRef.current);
        setIsLongPressing(false);
        setLongPressFeedback(0);

        // Supprimer les écouteurs
        window.removeEventListener('mouseup', handleLongPressCancel);
        window.removeEventListener('touchend', handleLongPressCancel);
        window.removeEventListener('mousemove', handleLongPressMove);
        window.removeEventListener('touchmove', handleLongPressMove);
    };

    // Fonction pour détecter si l'utilisateur bouge trop durant l'appui
    const handleLongPressMove = (e) => {
        if (!isLongPressing) return;

        // Si pas d'événement ou pas de cible, annuler
        if (!e || !e.target) {
            handleLongPressCancel();
            return;
        }

        try {
            // Calculer le déplacement (avec gestion des erreurs)
            const rect = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : {
                left: 0, top: 0, width: 0, height: 0
            };
            const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

            const moveX = clientX - (rect.left + rect.width / 2);
            const moveY = clientY - (rect.top + rect.height / 2);
            const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);

            // Si l'utilisateur bouge trop, annuler l'appui long
            if (moveDistance > 20) { // Tolérance de 20 pixels
                handleLongPressCancel();
            }
        } catch (error) {
            console.error('[EnhancedObjectMarker] Error in handleLongPressMove:', error);
            handleLongPressCancel();
        }
    };

    // Gérer le clic sur le marqueur
    const handleMarkerClick = (e) => {
        stopAllPropagation(e);

        // Pour les appuis longs, on démarre le timer
        if (markerType === INTERACTION_TYPES.LONG_PRESS) {
            handleLongPressStart(e);
            return;
        }

        // Pour les interactions de type drag, ne pas compléter au clic
        if (markerType.includes('drag')) {
            console.log(`[EnhancedObjectMarker] Cette interaction nécessite un glissement (${markerType}), pas un simple clic`);
            return;
        }

        // Jouer un son de confirmation
        if (audioManager) {
            audioManager.playSound('click', {
                volume: 0.8
            });
        }

        // Appeler la fonction onClick si elle est fournie
        if (onClick) {
            onClick({
                type: 'click'
            });
        }

        // Émettre un événement pour informer le système de marqueurs
        EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
            id, type: markerType
        });
    };

    // Fonction pour démarrer un drag
    const handleDragStart = (e) => {
        if (!markerType.includes('drag')) return;

        console.log('[EnhancedObjectMarker] Drag started');
        stopAllPropagation(e);

        isDraggingRef.current = true;

        // Capturer les coordonnées initiales
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        startDragPos.current = {x: clientX, y: clientY};
        currentDragPos.current = {...startDragPos.current};

        // Ajouter les écouteurs au niveau de la fenêtre
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('touchmove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchend', handleDragEnd);
    };

    // Modifier la fonction handleDragMove pour un meilleur suivi
    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;

        // Mise à jour de la position actuelle
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : currentDragPos.current.x);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : currentDragPos.current.y);

        currentDragPos.current = {x: clientX, y: clientY};

        // Calculer le déplacement
        const dx = currentDragPos.current.x - startDragPos.current.x;
        const dy = currentDragPos.current.y - startDragPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Déterminer la direction principale
        let direction = '';
        const threshold = 50; // Seuil minimum de déplacement

        if (distance > threshold) {
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }

            // Vérifier si la direction correspond au type de drag attendu
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
                console.log(`[EnhancedObjectMarker] Drag successful: ${direction}, distance: ${distance}, type: ${markerType}`);

                if (audioManager) {
                    audioManager.playSound('drag', {
                        volume: 0.8, fade: true, fadeTime: 800
                    });
                }

                if (onClick) {
                    onClick({
                        type: markerType, // Utiliser directement markerType, pas 'drag' générique
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

    const isDragEventType = (type) => {
        return type === INTERACTION_TYPES.DRAG_LEFT || type === INTERACTION_TYPES.DRAG_RIGHT || type === INTERACTION_TYPES.DRAG_UP || type === INTERACTION_TYPES.DRAG_DOWN;
    };

    // Fonction pour terminer un drag
    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;

        console.log('[EnhancedObjectMarker] Drag ended');
        isDraggingRef.current = false;

        // Supprimer les écouteurs d'événements
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchend', handleDragEnd);
    };

    // Nettoyer les écouteurs d'événements et timeouts au démontage
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
        // Cette technique fait face à la caméra tout en gardant l'axe Y aligné avec celui du monde
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
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        fontWeight: 'bold',
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
                        }}

                        onMouseEnter={(e) => {
                            console.log('Button hover enter');
                            stopAllPropagation(e);
                            setButtonHovered(true);
                            // Ne pas appeler directement onPointerEnter, utiliser un appel sécurisé
                            if (typeof onPointerEnter === 'function') {
                                onPointerEnter(e);
                            }
                        }}
                        onMouseLeave={(e) => {
                            console.log('Button hover leave');
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            // Ne pas appeler directement onPointerLeave, utiliser un appel sécurisé
                            if (typeof onPointerLeave === 'function') {
                                onPointerLeave(e);
                            }
                        }}
                        onClick={(e) => {
                            stopAllPropagation(e);
                            handleMarkerClick(e);
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
                            width: '64px',
                            height: '64px',
                            display: 'flex',
                            padding: '8px',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0,
                            aspectRatio: 1,
                            borderRadius: '999px',
                            border: '1px solid #F9FEFF',
                            background: 'transparent',
                            pointerEvents: 'none',
                        }}
                    >
                    </div>
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
                            // Ne pas appeler directement onPointerEnter, utiliser un appel sécurisé
                            if (typeof onPointerEnter === 'function') {
                                onPointerEnter(e);
                            }
                        }}
                        onMouseLeave={(e) => {
                            console.log('Button hover leave');
                            stopAllPropagation(e);
                            setButtonHovered(false);
                            // Ne pas appeler directement onPointerLeave, utiliser un appel sécurisé
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
                            cursor: isDraggingRef.current ? 'grabbing' : 'grab', ...(buttonHovered ? {
                                boxShadow: '0px 0px 8px 4px rgba(255, 255, 255, 0.50)', backdropFilter: 'blur(2px)',
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
                                        transform: markerType === INTERACTION_TYPES.DRAG_LEFT ? 'rotate(-180deg)' : markerType === INTERACTION_TYPES.DRAG_RIGHT ? 'rotate(0deg)' : markerType === INTERACTION_TYPES.DRAG_UP ? 'rotate(-90deg)' : 'rotate(90deg)'
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
                </Html>)}
        </group>
    </>);
};

// Fonction d'aide pour faciliter l'intégration avec un modèle 3D
// Dans ModelMarker, modifiez la partie pertinente:

// Modification dans le composant ModelMarker - fonction à ajouter dans le fichier EnhancedObjectMarker.jsx

// Correction pour le composant ModelMarker dans EnhancedObjectMarker.jsx
// Mise à jour : réinitialisation de l'état pour les nouvelles interactions

// Replace the ModelMarker component in EnhancedObjectMarker.jsx with this fixed version

export const ModelMarker = ({
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
                            }) => {
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
        (isHovered || isMarkerHovered || keepMarkerVisible) && showMarkerOnHover && (!requiredStep || (interaction?.waitingForInteraction && interaction.currentStep === requiredStep)));

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

    // Gérer le survol du marqueur
    // Dans ModelMarker, modifiez les gestionnaires d'événements pour qu'ils gèrent correctement les états du composant
    const handleMarkerPointerEnter = (e) => {
        console.log('[ModelMarker] Marker pointer enter', id);
        // Arrêter complètement la propagation
        stopAllPropagation(e);

        // Mettre à jour l'état interne du ModelMarker
        setIsMarkerHovered(true);
        setKeepMarkerVisible(true);

        // Propager l'événement au callback externe si fourni
        if (typeof onPointerEnter === 'function') {
            onPointerEnter(e);
        }
    };

    const handleMarkerPointerLeave = (e) => {
        console.log('[ModelMarker] Marker pointer leave', id);
        // Arrêter complètement la propagation
        stopAllPropagation(e);

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
            });

            return () => {
                removeEnterListener();
                removeLeaveListener();
            };
        }
    }, [objectRef, addPointerEnterListener, addPointerLeaveListener, interactionCompleted, interaction?.currentStep, lastCompletedStep]);

    return (
        <group ref={groupRef} {...props}>
            {React.Children.map(children, child => React.cloneElement(child, {
                ref: objectRef || child.ref
            }))}

            {shouldShowMarker && (
                <EnhancedObjectMarker
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
                />
            )}
        </group>
    );
};

export default EnhancedObjectMarker;