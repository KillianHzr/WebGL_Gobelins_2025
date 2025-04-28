import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useGLTF} from '@react-three/drei';
import {INTERACTION_TYPES, ModelMarker} from '../Utils/EnhancedObjectMarker';
import {EventBus} from '../Utils/EventEmitter';
import MARKER_EVENTS from "../Utils/EventEmitter.jsx";
import {audioManager} from '../Utils/AudioManager';
import OutlineEffect from '../Utils/OutlineEffect';
import GlowEffectDebug from '../Utils/GlowEffectDebug';
import useStore from '../Store/useStore';
import {textureManager} from '../Config/TextureManager';
import {Object3D} from "three";

// Activer ou désactiver les logs pour le débogage
const DEBUG_EASY_MARKER = false;

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (DEBUG_EASY_MARKER) console.log(`[EasyModelMarker] ${message}`, ...args);
};

// Pool d'objets pour limiter les allocations
const objectPool = {
    dummyObjects: [],
    getDummyObject: function () {
        if (this.dummyObjects.length > 0) {
            return this.dummyObjects.pop();
        }
        return new Object3D();
    },
    returnDummyObject: function (obj) {
        obj.position.set(0, 0, 0);
        obj.rotation.set(0, 0, 0);
        obj.scale.set(1, 1, 1);
        this.dummyObjects.push(obj);
    }
};

/**
 * Composant simple pour ajouter un marqueur à n'importe quel modèle 3D
 * Version refactorisée pour optimiser les performances
 */
const EasyModelMarker = React.memo(function EasyModelMarker({
                                                                // Props du modèle
                                                                modelPath = null,
                                                                position = [0, 0, 0],
                                                                scale = [1, 1, 1],
                                                                rotation = [0, 0, 0],
                                                                color = "#5533ff",

                                                                // Props du marqueur
                                                                markerId = `marker-${Math.random().toString(36).substr(2, 9)}`,
                                                                markerType = INTERACTION_TYPES.CLICK,
                                                                markerText = "Interagir",
                                                                markerColor = "#44ff44",
                                                                markerOffset = 0.8,
                                                                markerAxis = 'y',
                                                                alwaysVisible = false,

                                                                // Props de callback
                                                                onInteract = null,

                                                                // Props avancées
                                                                modelProps = {},
                                                                nodeProps = {},
                                                                useBox = false,
                                                                playSound = true,

                                                                // Props d'effet visuel
                                                                showOutline = true,
                                                                outlineColor = "#ffffff",
                                                                outlineThickness = 1.5,
                                                                outlineIntensity = 1,
                                                                outlinePulse = true,
                                                                outlinePulseSpeed = 2,

                                                                // Props d'interaction spécifiques
                                                                requiredStep = null,

                                                                // Props pour les textures
                                                                textureModelId = null,
                                                                useTextures = true,

                                                                // Props pour enfants personnalisés
                                                                children,
                                                                interfaceToShow = null,
                                                                postInteractionAnimation = null,

                                                            }) {
    // Références
    const modelRef = useRef();
    const isComponentMounted = useRef(true);
    const cleanupFunctions = useRef([]);

    // État local
    const [hovered, setHovered] = useState(false);
    const [active, setActive] = useState(false);
    const [isMarkerHovered, setIsMarkerHovered] = useState(false);
    const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);
    const [isInteractionCompleted, setIsInteractionCompleted] = useState(false);

    // Accéder à l'état d'interaction global
    const interaction = useStore(state => state.interaction);

    // Charger le modèle GLTF si un chemin est fourni, avec mise en cache
    const gltf = modelPath ? useGLTF(modelPath) : null;

// Ajouter un useEffect pour gérer et logger les erreurs si nécessaire
    useEffect(() => {
        if (modelPath && !gltf && DEBUG_EASY_MARKER) {
            console.warn(`Issue loading model from ${modelPath}`);
        }
    }, [modelPath, gltf]);

    // Utiliser le composant de debug pour l'effet de glow
    const {effectSettings, updateEffectRef} = GlowEffectDebug({objectRef: modelRef});

    // Gestion des textures de manière optimisée
    useEffect(() => {
        // Vérifier si l'objet a un modèle 3D et si nous devons appliquer des textures
        if (!modelRef.current || !gltf || !useTextures || !textureModelId || !isComponentMounted.current) return;

        // Variable pour suivre si l'application des textures est en cours
        let isApplyingTextures = true;

        // Appliquer les textures au modèle
        const applyTextures = async () => {
            try {
                await textureManager.applyTexturesToModel(textureModelId, modelRef.current);
                // Vérifier si le composant est toujours monté avant de continuer
                if (isComponentMounted.current && isApplyingTextures) {
                    debugLog(`Textures appliquées à ${markerId} (${textureModelId})`);
                }
            } catch (error) {
                if (isComponentMounted.current && isApplyingTextures) {
                    console.error(`Erreur lors de l'application des textures:`, error);
                }
            }
        };

        applyTextures();

        // Nettoyage - marquer comme non monté pour éviter les mises à jour sur un composant démonté
        return () => {
            isApplyingTextures = false;
        };
    }, [gltf, textureModelId, useTextures, markerId]);

    // Personnaliser les paramètres d'effet - optimisé pour éviter les recalculs inutiles
    useEffect(() => {
        if (!updateEffectRef || !updateEffectRef.current) return;

        const effectRef = updateEffectRef.current;

        // Mettre à jour uniquement les paramètres qui ont changé
        if (effectRef.color !== outlineColor) {
            effectRef.color = outlineColor;
        }

        if (effectRef.thickness !== outlineThickness) {
            effectRef.thickness = outlineThickness;
        }

        if (effectRef.intensity !== outlineIntensity) {
            effectRef.intensity = outlineIntensity;
        }

        // Désactiver complètement la pulsation si outlinePulse est false
        const targetPulseSpeed = outlinePulse ? outlinePulseSpeed : 0;
        if (effectRef.pulseSpeed !== targetPulseSpeed) {
            effectRef.pulseSpeed = targetPulseSpeed;
        }

        // Force une mise à jour immédiate pour arrêter tout mouvement existant
        if (!outlinePulse && effectRef.pulseRef) {
            effectRef.pulseRef.current = {value: 0, direction: 0};
        }
    }, [outlineColor, outlineThickness, outlineIntensity, outlinePulseSpeed, outlinePulse, updateEffectRef]);

    // Surveiller l'état d'interaction de manière optimisée
    useEffect(() => {
        // Vérifier si ce modèle est l'objet qui nécessite une interaction
        const isCurrentInteractionTarget =
            interaction?.waitingForInteraction &&
            requiredStep &&
            interaction.currentStep === requiredStep;

        if (isWaitingForInteraction !== isCurrentInteractionTarget) {
            setIsWaitingForInteraction(isCurrentInteractionTarget);
        }

        if (isCurrentInteractionTarget) {
            debugLog(`${markerId} is waiting for interaction: ${interaction.currentStep}`);
        }
    }, [interaction?.waitingForInteraction, interaction?.currentStep, requiredStep, markerId, isWaitingForInteraction]);

    // Réinitialiser l'état d'interaction complétée lorsque l'étape change
    useEffect(() => {
        if (interaction && interaction.currentStep && isInteractionCompleted) {
            setIsInteractionCompleted(false);
        }
    }, [interaction?.currentStep, isInteractionCompleted]);

    // Gérer l'interaction avec le marqueur - optimisé avec useCallback
    const handleMarkerInteraction = useCallback((eventData = {}) => {
        debugLog(`Interaction avec le marqueur ${markerId}:`, eventData);

        // Jouer un son si activé
        if (playSound && audioManager) {
            const soundType = markerType.includes('drag') ? 'drag' : 'click';
            const fadeTime = markerType.includes('drag') ? 800 :
                markerType === INTERACTION_TYPES.LONG_PRESS ? 400 : 0;

            audioManager.playSound(soundType, {
                volume: 0.8,
                fade: markerType.includes('drag') || markerType === INTERACTION_TYPES.LONG_PRESS,
                fadeTime
            });
        }

        // Vérifier si l'interaction est attendue et la compléter
        if (interaction?.waitingForInteraction && isWaitingForInteraction && !isInteractionCompleted) {
            // Mettre à jour l'état avant de compléter l'interaction
            setIsInteractionCompleted(true);

            // Compléter l'interaction
            if (interaction.completeInteraction) {
                interaction.completeInteraction();
                debugLog(`Interaction ${markerId} complétée via ${eventData.type || markerType}`);
            }

            // Gérer les interfaces spécifiques
            if (interfaceToShow) {
                const store = useStore.getState();

                if (interfaceToShow === 'camera') {
                    if (typeof store.setShowCaptureInterface === 'function') {
                        store.setShowCaptureInterface(true);
                    } else if (store.interaction && typeof store.interaction.setShowCaptureInterface === 'function') {
                        store.interaction.setShowCaptureInterface(true);
                    } else {
                        debugLog("Méthode setShowCaptureInterface non trouvée, utilisation d'une alternative");
                        useStore.setState(state => ({
                            interaction: {
                                ...state.interaction,
                                showCaptureInterface: true
                            }
                        }));
                    }
                } else if (interfaceToShow === 'scanner') {
                    if (typeof store.setShowScannerInterface === 'function') {
                        store.setShowScannerInterface(true);
                    } else if (store.interaction && typeof store.interaction.setShowScannerInterface === 'function') {
                        store.interaction.setShowScannerInterface(true);
                    } else {
                        debugLog("Méthode setShowScannerInterface non trouvée, utilisation d'une alternative");
                        useStore.setState(state => ({
                            interaction: {
                                ...state.interaction,
                                showScannerInterface: true
                            }
                        }));
                    }
                }
            }

            // Si une animation post-interaction est définie, la déclencher
            if (postInteractionAnimation) {
                try {
                    debugLog(`Déclenchement de l'animation post-interaction: ${postInteractionAnimation.name}`);
                    EventBus.trigger(MARKER_EVENTS.INTERACTION_ANIMATION, {
                        id: markerId,
                        animationName: postInteractionAnimation.name,
                        animationOptions: postInteractionAnimation.options || {},
                        targetObject: postInteractionAnimation.targetObject || null
                    });
                } catch (error) {
                    console.error(`Erreur lors du déclenchement de l'animation post-interaction:`, error);
                }
            }
        }

        // Appeler le callback personnalisé
        if (onInteract) {
            onInteract(eventData);
        }

        // Émettre l'événement d'interaction complète
        try {
            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                id: markerId,
                type: markerType
            });
        } catch (error) {
            console.error(`Error triggering interaction complete event for ${markerId}:`, error);
        }
    }, [
        markerId,
        markerType,
        playSound,
        interaction,
        isWaitingForInteraction,
        isInteractionCompleted,
        interfaceToShow,
        onInteract,
        postInteractionAnimation
    ]);

    // Gérer le survol de l'objet
    const handlePointerEnter = useCallback(() => {
        console.log('[EnhancedObjectMarker] Pointer enter via callback', markerId, markerText);

        // Vérification spéciale pour AnimalPaws
        if (markerId.includes('AnimalPaws') || markerId.includes('fifthStop')) {
            // Récupérer les interactions complétées du store
            const completedInteractions = useStore.getState().interaction.completedInteractions || {};

            // Vérifier si LeafErable a été complété
            const leafErableCompleted = Object.keys(completedInteractions).some(key =>
                key.includes('thirdStop') ||
                key.includes('LeafErable')
            );

            if (!leafErableCompleted) {
                console.log('Survolage de AnimalPaws ignoré car LeafErable n\'a pas encore été complété');
                return; // Ne pas mettre à jour l'état de hovering
            }
        }

        setHovered(true);

        // Émettre un événement personnalisé pour le survol du marker
        // Ceci sera utilisé par le NarrationTriggers pour déclencher les narrations
        EventBus.trigger('marker:pointer:enter', {
            id: markerId,
            type: 'hover',
            text: markerText
        });
    }, [markerId, markerText]);

    // Fonction pour déterminer si le contour doit être affiché
    const shouldShowOutline = useCallback(() => {
        // Ne pas afficher le contour si le marqueur est survolé ou si showOutline est false
        if (!showOutline) {
            return false;
        }

        // NOUVEAU: Vérification spéciale pour AnimalPaws
        if (markerId.includes('AnimalPaws') || (requiredStep && requiredStep.includes('fifthStop'))) {
            // Récupérer les interactions complétées du store
            const completedInteractions = useStore.getState().interaction.completedInteractions || {};

            // Vérifier si LeafErable a été complété
            const leafErableCompleted = Object.keys(completedInteractions).some(key =>
                key.includes('thirdStop') ||
                key.includes('LeafErable')
            );

            if (!leafErableCompleted) {
                return false; // Ne pas afficher le contour
            }
        }

        // Si un requiredStep est spécifié, vérifier si nous sommes à cette étape
        // avant de montrer l'outline au survol
        if (requiredStep) {
            const isCorrectStep = interaction?.currentStep === requiredStep &&
                interaction?.waitingForInteraction;

            // Afficher le contour seulement si:
            // - L'objet est en attente d'interaction (isWaitingForInteraction)
            // - OU si alwaysVisible est true
            // - OU si l'objet est survolé ET que nous sommes à la bonne étape d'interaction
            return isWaitingForInteraction || alwaysVisible || (hovered && isCorrectStep);
        } else {
            // Comportement par défaut pour les objets sans requiredStep
            return isWaitingForInteraction || alwaysVisible || hovered;
        }
    }, [
        isMarkerHovered,
        showOutline,
        requiredStep,
        interaction?.currentStep,
        interaction?.waitingForInteraction,
        isWaitingForInteraction,
        alwaysVisible,
        hovered,
        markerId
    ]);

    // Handlers pour le survol du marqueur optimisés avec useCallback
    const handleMarkerPointerEnter = useCallback((e) => {
        debugLog(`Marker ${markerId} hover enter`);
        setIsMarkerHovered(true);
        // S'assurer que la visibilité du marqueur est correctement gérée
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    }, [markerId]);

    const handleMarkerPointerLeave = useCallback((e) => {
        debugLog(`Marker ${markerId} hover leave`);
        setIsMarkerHovered(false);
        // S'assurer que la visibilité du marqueur est correctement gérée
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    }, [markerId]);

    // Nettoyer les ressources lors du démontage
    useEffect(() => {
        // Marquer le composant comme monté
        isComponentMounted.current = true;

        return () => {
            // Marquer le composant comme démonté
            isComponentMounted.current = false;

            // Nettoyer toutes les fonctions enregistrées
            cleanupFunctions.current.forEach(cleanup => {
                try {
                    if (typeof cleanup === 'function') {
                        cleanup();
                    }
                } catch (error) {
                    console.warn('Error cleaning up:', error);
                }
            });

            // Vider la liste
            cleanupFunctions.current = [];
        };
    }, []);

    // Éléments de marqueur mémorisés pour éviter les re-rendus inutiles
    const markerProps = useMemo(() => ({
        id: markerId,
        markerType: markerType,
        markerColor: markerColor,
        markerText: markerText,
        onInteract: handleMarkerInteraction,
        viewportMargin: 100,
        positionOptions: {
            offset: markerOffset,
            preferredAxis: markerAxis
        },
        alwaysVisible: false,
        requiredStep: requiredStep,
        onPointerEnter: handleMarkerPointerEnter,
        onPointerLeave: handleMarkerPointerLeave,
        showMarkerOnHover: true
    }), [
        markerId,
        markerType,
        markerColor,
        markerText,
        handleMarkerInteraction,
        markerOffset,
        markerAxis,
        requiredStep,
        handleMarkerPointerEnter,
        handleMarkerPointerLeave
    ]);

    // Optimiser le rendu conditionnel des enfants
    const renderChildren = useMemo(() => {
        if (!children) return null;

        return React.Children.map(children, child =>
            React.cloneElement(child, {ref: modelRef})
        );
    }, [children]);

    // Optimiser le rendu conditionnel de l'effet de contour
    const renderOutlineEffect = useMemo(() => {
        if (active) return null;

        return (
            <OutlineEffect
                objectRef={modelRef}
                active={shouldShowOutline()}
                color={effectSettings.color}
                thickness={effectSettings.thickness}
                intensity={effectSettings.intensity}
                pulseSpeed={outlinePulse ? effectSettings.pulseSpeed : 0}
                ref={updateEffectRef}
            />
        );
    }, [active, shouldShowOutline, effectSettings, outlinePulse, updateEffectRef]);

    // Optimiser le rendu conditionnel du modèle par défaut
    const renderDefaultModel = useMemo(() => {
        if (useBox) {
            return (
                <mesh
                    ref={modelRef}
                    position={position}
                    rotation={rotation}
                    scale={scale}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                    castShadow
                    {...modelProps}
                >
                    <boxGeometry args={[1, 1, 1]}/>
                    <meshStandardMaterial color={color}/>
                </mesh>
            );
        } else if (modelPath && gltf && gltf.scene) {
            // Vérifier explicitement que gltf.scene existe avant de l'utiliser
            try {
                // Utiliser une copie de la scène pour éviter des problèmes de partage
                const clonedScene = gltf.scene.clone();

                return (
                    <primitive
                        ref={modelRef}
                        object={clonedScene}
                        position={position}
                        rotation={rotation}
                        scale={scale}
                        onPointerOver={() => setHovered(true)}
                        onPointerOut={() => setHovered(false)}
                        castShadow
                        {...modelProps}
                        {...nodeProps}
                    />
                );
            } catch (error) {
                // En cas d'erreur, afficher une boxGeometry comme fallback silencieux
                if (DEBUG_EASY_MARKER) {
                    console.warn(`Error cloning GLTF scene: ${error.message}`);
                }
                return (
                    <mesh
                        ref={modelRef}
                        position={position}
                        rotation={rotation}
                        scale={scale}
                        onPointerOver={() => setHovered(true)}
                        onPointerOut={() => setHovered(false)}
                        castShadow
                        {...modelProps}
                    >
                        <boxGeometry args={[0.5, 0.5, 0.5]}/>
                        <meshStandardMaterial color="#ff0000" wireframe={true}/>
                    </mesh>
                );
            }
        } else if (modelPath) {
            // Si modelPath est fourni mais gltf n'est pas encore chargé, afficher un placeholder
            return (
                <mesh
                    ref={modelRef}
                    position={position}
                    rotation={rotation}
                    scale={scale}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                    castShadow
                    {...modelProps}
                >
                    <boxGeometry args={[0.5, 0.5, 0.5]}/>
                    <meshStandardMaterial color="#888888" wireframe={true} opacity={0.5} transparent/>
                </mesh>
            );
        }

        return null;
    }, [useBox, modelPath, gltf, position, rotation, scale, color, modelProps, nodeProps]);

    return (
        <ModelMarker {...markerProps}>
            {/* Si children est fourni, utiliser les enfants personnalisés */}
            {children ? (
                <>
                    {renderChildren}
                    {renderOutlineEffect}
                </>
            ) : (
                <>
                    {renderDefaultModel}
                    {renderOutlineEffect}
                </>
            )}
        </ModelMarker>
    );
});

export default EasyModelMarker;