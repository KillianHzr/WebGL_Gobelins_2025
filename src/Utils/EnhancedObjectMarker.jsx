// src/Utils/EnhancedObjectMarker.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { EventBus } from './EventEmitter';
import { MARKER_EVENTS } from './markerEvents';
import { audioManager } from './AudioManager';
import useStore from '../Store/useStore';

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
    const { camera } = useThree();
    const [markerPosition, setMarkerPosition] = useState({ x: 0, y: 0, z: 0 });
    const [closestPoint, setClosestPoint] = useState(null);
    const [normalVector, setNormalVector] = useState(null);

    // Référence pour suivre si la position a déjà été calculée
    const positionCalculated = useRef(false);
    // Mémoriser la position initiale pour éviter tout recalcul non désiré
    const initialPosition = useRef(null);

    // Options par défaut
    const {
        offset = 0.5,
        preferredAxis = null,
        forceRecalculate = false
    } = options;

    // Fonction pour calculer une position stable pour le marqueur
    const calculateStablePosition = useCallback(() => {
        if (!objectRef.current || !camera) return null;

        // Si déjà calculé et pas de forçage de recalcul, retourner position mémorisée
        if (positionCalculated.current && initialPosition.current && !forceRecalculate) {
            return {
                position: initialPosition.current,
                point: closestPoint,
                normal: normalVector
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
            x: markerPos.x,
            y: markerPos.y,
            z: markerPos.z
        };

        initialPosition.current = position;
        setClosestPoint(surfacePoint);
        setNormalVector(surfaceToCamera);
        setMarkerPosition(position);

        // Marquer comme calculé
        positionCalculated.current = true;

        return {
            position,
            point: surfacePoint,
            normal: surfaceToCamera
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
        position: markerPosition,
        closestPoint,
        normal: normalVector,
        updatePosition: updateMarkerPosition
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
                                  id = `marker-${Math.random().toString(36).substr(2, 9)}` // ID unique pour le marqueur
                              }) => {
    const markerRef = useRef();
    const [fadeIn, setFadeIn] = useState(false);
    const { camera } = useThree();
    const time = useRef(0);

    // Utilisation de la position optimale pour le marqueur
    const { position: markerPosition, normal: normalVector, updatePosition } = useOptimalMarkerPosition(objectRef, {
        offset: positionOptions.offsetDistance || 0.5,
        preferredAxis: positionOptions.preferredAxis,
        ...positionOptions
    });

    // Effet de transition pour l'apparition du marqueur
    useEffect(() => {
        if (hovered) {
            setFadeIn(true);
        } else {
            setFadeIn(false);
        }
    }, [hovered]);

    // Gérer le clic sur le marqueur
    const handleMarkerClick = () => {
        // Jouer un son de confirmation
        if (audioManager) {
            audioManager.playSound('click', {
                volume: 0.8
            });
        }

        // Appeler la fonction onClick si elle est fournie
        if (onClick) {
            onClick();
        }

        // Émettre un événement pour informer le système de marqueurs
        EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
            id,
            type: markerType
        });
    };

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
                // Animation de pulsation pour le clic
                if (pulseAnimation && markerRef.current.children[0]) {
                    const pulse = Math.sin(time.current * 4) * 0.1 + 1;
                    markerRef.current.children[0].scale.set(pulse, pulse, 1);
                }
                break;
        }
    });

    // Ne rien rendre si l'objet n'est pas survolé
    if (!hovered) return null;

    // Si un composant personnalisé est fourni, l'utiliser
    if (custom) {
        return (
            <>
                <group
                    ref={markerRef}
                    position={[markerPosition.x, markerPosition.y, markerPosition.z]}
                    onClick={handleMarkerClick}
                    scale={fadeIn ? [scale, scale, scale] : [0.01, 0.01, 0.01]}
                >
                    {custom}

                    {/* Texte en HTML pour toujours rester correctement orienté */}
                    {showText && (
                        <Html
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
                        </Html>
                    )}
                </group>
            </>
        );
    }

    // Contenu visuel spécifique par type d'interaction
    return (
        <>
            {/* Groupe principal pour l'icône du marqueur */}
            <group
                ref={markerRef}
                position={[markerPosition.x, markerPosition.y, markerPosition.z]}
                onClick={handleMarkerClick}
                scale={fadeIn ? [scale, scale, scale] : [0.01, 0.01, 0.01]}
            >
                {/* Anneau de base commun à tous les types */}
                <mesh>
                    <ringGeometry args={[0.3, 0.5, 32]} />
                    <meshBasicMaterial
                        color={color}
                        transparent
                        opacity={fadeIn ? 0.8 : 0}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Cercle central */}
                <mesh>
                    <circleGeometry args={[0.25, 32]} />
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={fadeIn ? 0.9 : 0}
                    />
                </mesh>

                {/* Icônes spécifiques selon le type d'interaction */}
                {markerType === INTERACTION_TYPES.CLICK && (
                    <mesh position={[0, 0, 0.01]}>
                        <circleGeometry args={[0.12, 32]} />
                        <meshBasicMaterial
                            color={color}
                            transparent
                            opacity={fadeIn ? 0.9 : 0}
                        />
                    </mesh>
                )}

                {markerType === INTERACTION_TYPES.LONG_PRESS && (
                    <group position={[0, 0, 0.01]}>
                        <mesh>
                            <ringGeometry args={[0.08, 0.15, 32]} />
                            <meshBasicMaterial
                                color={color}
                                transparent
                                opacity={fadeIn ? 0.9 : 0}
                                side={THREE.DoubleSide}
                            />
                        </mesh>
                        <mesh>
                            <circleGeometry args={[0.08, 32]} />
                            <meshBasicMaterial
                                color={color}
                                transparent
                                opacity={fadeIn ? 0.5 : 0}
                            />
                        </mesh>
                    </group>
                )}

                {/* Flèches directionnelles pour les drags */}
                {(markerType === INTERACTION_TYPES.DRAG_LEFT ||
                    markerType === INTERACTION_TYPES.DRAG_RIGHT ||
                    markerType === INTERACTION_TYPES.DRAG_UP ||
                    markerType === INTERACTION_TYPES.DRAG_DOWN) && (
                    <mesh position={[0, 0, 0]} rotation={[0, 0,
                        markerType === INTERACTION_TYPES.DRAG_LEFT ? Math.PI :
                            markerType === INTERACTION_TYPES.DRAG_RIGHT ? 0 :
                                markerType === INTERACTION_TYPES.DRAG_UP ? Math.PI / 2 :
                                    -Math.PI / 2]}>
                        {/* Flèche triangulaire */}
                        <shapeGeometry args={[(() => {
                            const shape = new THREE.Shape();
                            shape.moveTo(0, 0.1);
                            shape.lineTo(-0.1, -0.05);
                            shape.lineTo(0.1, -0.05);
                            shape.lineTo(0, 0.1);
                            return shape;
                        })()]} />
                        <meshBasicMaterial
                            color={color}
                            transparent
                            opacity={fadeIn ? 0.9 : 0}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                )}

                {/* Texte en HTML pour toujours rester correctement orienté */}
                {showText && (
                    <Html
                        position={[0, 0, 0]} /* Position au-dessus du marqueur */
                        center
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
                        distanceFactor={10}
                        zIndexRange={[100, 0]}
                    >
                        {text}
                    </Html>
                )}
            </group>
        </>
    );
};

// Fonction d'aide pour faciliter l'intégration avec un modèle 3D
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
                                ...props            // Autres propriétés à transmettre
                            }) => {
    // Référence pour l'objet englobant
    const groupRef = useRef();

    // État pour suivre si l'objet est survolé
    const [isHovered, setHovered] = useState(false);

    // Accès à l'état global d'interaction
    const interaction = useStore(state => state.interaction);

    // Utiliser le type d'interaction passé par l'un ou l'autre paramètre
    const effectiveMarkerType = interactionType || markerType;

    // Vérifier si le marqueur doit être affiché basé sur l'état d'interaction
    const shouldShowMarker =
        isHovered && showMarkerOnHover && (
            !requiredStep ||
            (interaction?.waitingForInteraction && interaction.currentStep === requiredStep)
        );

    // Gérer le clic sur l'objet
    const handleObjectInteraction = () => {
        if (onInteract) {
            onInteract();
        }
    };

    return (
        <group ref={groupRef} {...props}>
            {/* Rendre les enfants avec les événements de survol */}
            {React.Children.map(children, child =>
                React.cloneElement(child, {
                    onPointerOver: () => setHovered(true),
                    onPointerOut: () => setHovered(false),
                    ref: objectRef || child.ref
                })
            )}

            {/* Ajouter le marqueur d'interaction seulement s'il doit être affiché */}
            {shouldShowMarker && (
                <EnhancedObjectMarker
                    objectRef={objectRef || groupRef}
                    markerType={effectiveMarkerType}
                    hovered={true} // Forcé à true car shouldShowMarker est déjà vérifié
                    color={markerColor}
                    scale={markerScale}
                    text={markerText}
                    onClick={handleObjectInteraction}
                    positionOptions={positionOptions}
                    id={id}
                    custom={customMarker}
                />
            )}
        </group>
    );
};

export default EnhancedObjectMarker;