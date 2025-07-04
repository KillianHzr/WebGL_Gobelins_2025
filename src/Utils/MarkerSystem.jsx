import React, {createContext, useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Quaternion, Vector3} from 'three';
import {EventBus, useEventEmitter} from './EventEmitter';
import useStore from '../Store/useStore';
import {MARKER_EVENTS} from './EventEmitter';

// // Context pour les marqueurs interactifs
const InteractiveMarkersContext = createContext(null);
export const InteractiveMarkersProvider = ({children, config}) => {
    const {scene, camera} = useThree();
    const markersRef = useRef(new Map());
    const markerGroupsRef = useRef(new Map());
    const [activeMarker, setActiveMarker] = useState(null);
    const [hoveredMarker, setHoveredMarker] = useState(null);
    const eventEmitter = useEventEmitter();
    const [isAnimating, setIsAnimating] = useState(false);
    const animationRef = useRef(null);
    const {clickListener} = useStore();

    // Charger la configuration des marqueurs
    useEffect(() => {
        if (config) {
            initializeMarkers(config);
        }
    }, [config]);

    // Activer l'écoute des clics pour les interactions avec les marqueurs
    useEffect(() => {
        if (clickListener && !clickListener.isListening) {
            clickListener.startListening();
        }
    }, [clickListener]);

    // Initialiser les marqueurs à partir de la configuration
    const initializeMarkers = (markersConfig) => {
        // Nettoyer les marqueurs existants
        markersRef.current.forEach(marker => {
            scene.remove(marker.object);
        });
        markersRef.current.clear();
        markerGroupsRef.current.clear();

        // Créer les groupes de marqueurs
        markersConfig.groups.forEach(group => {
            markerGroupsRef.current.set(group.id, {
                id: group.id,
                name: group.name,
                description: group.description,
                isVisible: group.isVisible !== false,
                markers: []
            });
        });

        // Créer les marqueurs
        markersConfig.markers.forEach(markerConfig => {
            const marker = createMarker(markerConfig);
            if (marker) {
                markersRef.current.set(marker.id, marker);

                // Ajouter au groupe si spécifié
                if (markerConfig.groupId && markerGroupsRef.current.has(markerConfig.groupId)) {
                    const group = markerGroupsRef.current.get(markerConfig.groupId);
                    group.markers.push(marker.id);
                }
            }
        });

        // Mettre à jour la visibilité initiale
        updateMarkersVisibility();
    };

    // Créer un marqueur individuel
    const createMarker = (config) => {
        const factory = new CTAFactory();
        const cta = factory.createCTA({
            type: config.ctaType || MARKER_TYPES.INFO,
            position: new Vector3(config.position.x, config.position.y, config.position.z),
            data: {
                id: config.id,
                title: config.title,
                description: config.description,
                icon: config.icon,
                color: config.color,
                scale: config.scale || 1,
                targetView: config.targetView,
                onClick: config.onClick || MARKER_EVENTS.MARKER_CLICK,
                onHover: config.onHover || MARKER_EVENTS.MARKER_HOVER,
                customData: config.customData || {},
                parent: config.parent || null,
                children: config.children || [],
                groupId: config.groupId
            }
        });

        if (cta) {
            // Ajouter à la scène
            // scene.add(cta.object);

            return {
                id: config.id,
                // object: cta.object,
                config: config,
                // cta: cta
            };
        }

        return null;
    };

    // Mettre à jour la visibilité des marqueurs en fonction des groupes
    const updateMarkersVisibility = () => {
        markersRef.current.forEach(marker => {
            const groupId = marker.config.groupId;
            if (groupId && markerGroupsRef.current.has(groupId)) {
                const group = markerGroupsRef.current.get(groupId);
                marker.object.visible = group.isVisible;
            }
        });
    };

    // Animation de caméra vers une vue cible
    const animateCameraToView = (targetView, duration = 2.0) => {
        if (!targetView || isAnimating) return;

        setIsAnimating(true);

        // Positions de départ
        const startPosition = camera.position.clone();
        const startQuaternion = camera.quaternion.clone();

        // Positions cibles
        const targetPosition = new Vector3(
            targetView.position.x,
            targetView.position.y,
            targetView.position.z
        );

        // Créer un quaternion cible à partir de la rotation
        const targetQuaternion = new Quaternion();
        if (targetView.lookAt) {
            // Si lookAt est spécifié, faire pointer la caméra vers ce point
            const lookAtVector = new Vector3(
                targetView.lookAt.x,
                targetView.lookAt.y,
                targetView.lookAt.z
            );

            // Sauvegarder la position actuelle
            const currentPosition = camera.position.clone();

            // Temporairement déplacer la caméra à la position cible
            camera.position.copy(targetPosition);

            // Faire regarder la caméra vers le point lookAt
            camera.lookAt(lookAtVector);

            // Capturer la rotation résultante
            targetQuaternion.copy(camera.quaternion);

            // Remettre la caméra à sa position initiale
            camera.position.copy(currentPosition);
            camera.updateProjectionMatrix();
        } else if (targetView.rotation) {
            // Si une rotation est spécifiée directement
            targetQuaternion.setFromEuler(targetView.rotation);
        }

        // Paramètres d'animation
        const startTime = Date.now();
        const endTime = startTime + duration * 1000;

        // Désactiver le défilement pendant l'animation
        const {setAllowScroll} = useStore.getState().interaction;
        if (setAllowScroll) {
            setAllowScroll(false);
        }

        // Fonction d'animation
        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);

            // Fonction d'easing pour une animation plus fluide
            const easeInOutCubic = t =>
                t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const easedProgress = easeInOutCubic(progress);

            // Interpolation de la position et de la rotation
            camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
            camera.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, easedProgress);
            camera.updateProjectionMatrix();

            if (progress < 1) {
                // Continuer l'animation
                animationRef.current = requestAnimationFrame(animate);
            } else {
                // Animation terminée
                setIsAnimating(false);

                // Réactiver le défilement
                if (setAllowScroll) {
                    setAllowScroll(true)
                }

                // Émettre un événement de fin d'animation
                EventBus.trigger(MARKER_EVENTS.CAMERA_ANIMATION_COMPLETE, {
                    markerId: activeMarker
                });
            }
        };

        // Démarrer l'animation
        animationRef.current = requestAnimationFrame(animate);
    };

    // Nettoyer l'animation quand le composant est démonté
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    // Gérer le clic sur un marqueur
    const handleMarkerClick = (markerId) => {
        const marker = markersRef.current.get(markerId);
        if (!marker) return;

        setActiveMarker(markerId);

        // Émettre l'événement spécifié dans la configuration du marqueur
        EventBus.trigger(marker.cta.data.onClick, {
            marker: marker.config,
            id: markerId
        });

        // Si le marqueur a une vue cible définie, animer la caméra vers cette vue
        if (marker.config.targetView) {
            animateCameraToView(marker.config.targetView);
        }
    };

    // Gérer le survol d'un marqueur
    const handleMarkerHover = (markerId) => {
        const marker = markersRef.current.get(markerId);
        if (!marker) return;

        setHoveredMarker(markerId);

        // Émettre l'événement de survol
        EventBus.trigger(marker.cta.data.onHover, {
            marker: marker.config,
            id: markerId
        });
    };

    // Gérer la fin du survol d'un marqueur
    const handleMarkerHoverEnd = (markerId) => {
        setHoveredMarker(null);

        const marker = markersRef.current.get(markerId);
        if (marker) {
            EventBus.trigger(MARKER_EVENTS.MARKER_HOVER_END, {
                marker: marker.config,
                id: markerId
            });
        }
    };

    // Afficher ou masquer un groupe de marqueurs
    const toggleMarkerGroup = (groupId, visible = null) => {
        if (markerGroupsRef.current.has(groupId)) {
            const group = markerGroupsRef.current.get(groupId);

            // Si visible n'est pas spécifié, inverser l'état actuel
            group.isVisible = visible !== null ? visible : !group.isVisible;

            // Mettre à jour la visibilité des marqueurs
            updateMarkersVisibility();

            // Émettre un événement de changement de visibilité
            EventBus.trigger(MARKER_EVENTS.GROUP_VISIBILITY_CHANGED, {
                groupId,
                isVisible: group.isVisible
            });

            return group.isVisible;
        }
        return false;
    };

    // Obtenir un marqueur par son ID
    const getMarker = (markerId) => {
        return markersRef.current.get(markerId);
    };

    // Obtenir tous les marqueurs
    const getAllMarkers = () => {
        return Array.from(markersRef.current.values()).map(marker => marker.config);
    };

    // Obtenir tous les groupes
    const getAllGroups = () => {
        return Array.from(markerGroupsRef.current.values());
    };

    // API exposée par le contexte
    const contextValue = {
        getMarker,
        getAllMarkers,
        getAllGroups,
        activeMarker,
        hoveredMarker,
        handleMarkerClick,
        handleMarkerHover,
        handleMarkerHoverEnd,
        toggleMarkerGroup,
        animateCameraToView,
        isAnimating
    };

    return (
        <InteractiveMarkersContext.Provider value={contextValue}>
            {children}
        </InteractiveMarkersContext.Provider>
    );
};
export default InteractiveMarkersProvider;