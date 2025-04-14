// src/Utils/ObjectMarker.jsx
import React, {useRef, useState, useEffect, useCallback} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EventBus} from './EventEmitter';
import {MARKER_EVENTS} from './markerEvents';
import {audioManager} from './AudioManager';

// Hook personnalisé pour calculer le point d'attachement optimal sur un objet
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
        offset = 0.5, autoUpdatePosition = false, // Désactivé par défaut maintenant
        preferredAxis = null, alwaysBetweenCameraAndObject = true, forceRecalculate = false // Option pour forcer le recalcul si nécessaire
    } = options;

    // Version simplifiée qui ne calcule qu'une seule fois
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

        // Calculer la position du marqueur dans tous les cas (même sans alwaysBetweenCameraAndObject)
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
            // Fallback: utiliser le centre ou le point le plus proche de la caméra
            surfacePoint = center;
        }

        // Distance fixe depuis la surface vers la caméra
        const fixedOffset = objectSize * offset;

        // Direction surface -> caméra (normalisée)
        const surfaceToCamera = cameraPosition.clone().sub(surfacePoint).normalize();

        // Position finale: point sur la surface + décalage vers la caméra
        const markerPos = surfacePoint.clone().add(surfaceToCamera.multiplyScalar(fixedOffset));

        // Mémoriser cette position initiale
        initialPosition.current = {
            x: markerPos.x, y: markerPos.y, z: markerPos.z
        };

        // Mettre à jour les états
        setClosestPoint(surfacePoint);
        setNormalVector(surfaceToCamera);
        setMarkerPosition(initialPosition.current);

        // Marquer comme calculé
        positionCalculated.current = true;

        return {
            position: initialPosition.current, point: surfacePoint, normal: surfaceToCamera
        };
    }, [camera, objectRef, offset, forceRecalculate, alwaysBetweenCameraAndObject]);

    // Calcul initial unique au montage ou quand les dépendances changent
    useEffect(() => {
        calculateStablePosition();
        // Ce calcul ne devrait se produire qu'au montage initial
        // ou si objectRef/camera changent structurellement
    }, [objectRef.current, camera, calculateStablePosition]);

    // Version explicite pour recalculer la position
    const updateMarkerPosition = useCallback(() => {
        // Réinitialiser l'état calculé pour forcer un recalcul
        positionCalculated.current = false;
        calculateStablePosition();
    }, [calculateStablePosition]);

    // Aucune mise à jour dans useFrame pour garantir une stabilité totale

    return {
        position: markerPosition, closestPoint, normal: normalVector, updatePosition: updateMarkerPosition
    };
};

function ObjectMarker({
                          objectRef,        // Référence à l'objet 3D
                          markerType,       // Type de marqueur (info, warning, interaction, etc.)
                          hovered,          // Si l'objet est survolé
                          color = "#44ff44", // Couleur par défaut du marqueur
                          scale = 1,        // Échelle du marqueur
                          text = "Cliquez ici", // Texte à afficher
                          onClick,          // Fonction à appeler lors du clic
                          positionOptions = {}, // Options pour le positionnement
                          animate = true,   // Activer les animations
                          showText = true,  // Afficher le texte
                          pulseAnimation = true, // Activer l'animation de pulsation
                          offsetDistance = 0.5, // Distance de décalage par rapport à la surface
                          custom = null,    // Composant personnalisé à rendre
                      }) {
    const markerRef = useRef();
    const [fadeIn, setFadeIn] = useState(false);
    const {camera} = useThree();

    // Utilisation avec position stable
    const {position: markerPosition} = useOptimalMarkerPosition(objectRef, {
        offset: positionOptions.offsetDistance || 0.5, autoUpdatePosition: false, // Crucial: désactiver les mises à jour automatiques
        alwaysBetweenCameraAndObject: true, // Permettre des options supplémentaires mais avec des valeurs sûres par défaut
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
            id: 'object-marker', type: 'interaction'
        });
    };

    useFrame(() => {
        if (!markerRef.current) return;

        // Orientation vers la caméra (billboard effect)
        markerRef.current.lookAt(camera.position);

        // Application de la position FIXE du marqueur
        if (markerPosition) {
            markerRef.current.position.set(markerPosition.x, markerPosition.y, markerPosition.z);
        }
    });

    // Ne rien rendre si l'objet n'est pas survolé
    if (!hovered) return null;

    // Si un composant personnalisé est fourni, l'utiliser
    if (custom) {
        return (<group
            ref={markerRef}
            position={[markerPosition.x, markerPosition.y, markerPosition.z]}
            onClick={handleMarkerClick}
            // Appliquer une animation d'apparition
            scale={fadeIn ? [scale, scale, scale] : [0.01, 0.01, 0.01]}
        >
            {custom}
        </group>);
    }

    // Rendu par défaut pour le marqueur d'interaction
    return (<group
        ref={markerRef}
        position={[markerPosition.x, markerPosition.y, markerPosition.z]}
        onClick={handleMarkerClick}
        // Appliquer une animation d'apparition
        scale={fadeIn ? [scale, scale, scale] : [0.01, 0.01, 0.01]}
    >
        {/* Anneau du marqueur */}
        <mesh>
            <ringGeometry args={[0.3, 0.5, 32]}/>
            <meshBasicMaterial
                color={color}
                transparent
                opacity={fadeIn ? 0.8 : 0}
                side={THREE.DoubleSide}
            />
        </mesh>

        {/* Icône centrale */}
        <mesh>
            <circleGeometry args={[0.25, 32]}/>
            <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={fadeIn ? 0.9 : 0}
            />
        </mesh>

        {/* Texte */}
        {showText && (<group position={[0, 0.8, 0]}>
            <mesh>
                <planeGeometry args={[2, 0.5]}/>
                <meshBasicMaterial
                    color="#000000"
                    transparent
                    opacity={fadeIn ? 0.7 : 0}
                />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[1.9, 0.4]}/>
                <meshBasicMaterial>
                    <canvasTexture attach="map" args={[createTextCanvas(text)]}/>
                </meshBasicMaterial>
            </mesh>
        </group>)}
    </group>);
};

// Utilitaire pour créer une texture de texte
function createTextCanvas(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas;
}

export default ObjectMarker;