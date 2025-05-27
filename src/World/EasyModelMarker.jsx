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
// const debugLog = (message, ...args) => {
//     if (DEBUG_EASY_MARKER) console.log(`[EasyModelMarker] ${message}`, ...args);
// };

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
 * Version refactorisée pour optimiser les performances et corriger l'application des textures
 */
const EasyModelMarker = React.memo(function EasyModelMarker({
                                                                // Props du modèle
                                                                modelPath = null,
                                                                position = [0, 0, 0],
                                                                scale = [1, 1, 1],
                                                                rotation = [0, 0, 0],

                                                                // Props du marqueur
                                                                markerId = `marker-${Math.random().toString(36).substr(2, 9)}`,
                                                                markerType = INTERACTION_TYPES.CLICK,
                                                                markerText = "Interagir",
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
    const [isInInteractionSequence, setIsInInteractionSequence] = useState(false);
    const outlineVisibleRef = useRef(false);

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

    // NOUVEAU: Créer le modèle avec textures appliquées de manière synchrone
    const processedModel = useMemo(() => {
        if (!gltf || !gltf.scene) return null;

        try {
            // Cloner le modèle une seule fois
            const clonedModel = gltf.scene.clone();

            // Appliquer les textures immédiatement si nécessaire
            if (useTextures && textureModelId && textureManager) {
                console.log(`🎨 Application des textures pour objet interactif: ${textureModelId}`);

                // Application synchrone des textures sur le modèle cloné
                textureManager.applyTexturesToModel(textureModelId, clonedModel, {
                    preserveSpecialMaterials: true,
                    optimizeGeometry: true
                }).catch(error => {
                    console.warn(`Erreur lors de l'application des textures pour ${textureModelId}:`, error);
                });
            }

            // Configurer les propriétés d'ombre et autres
            clonedModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material) {
                        child.material.needsUpdate = true;
                    }
                }
            });

            return clonedModel;
        } catch (error) {
            console.error(`Erreur lors du traitement du modèle ${modelPath}:`, error);
            return null;
        }
    }, [gltf, textureModelId, useTextures, modelPath]);

    // SUPPRIMÉ: L'ancien useEffect pour l'application des textures
    // car maintenant les textures sont appliquées dans useMemo ci-dessus

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
            // debugLog(`${markerId} est en attente d'interaction: ${interaction.currentStep}`);
        }
    }, [interaction?.waitingForInteraction, interaction?.currentStep, requiredStep, markerId, isWaitingForInteraction]);

    // Réinitialiser l'état d'interaction complétée lorsque l'étape change
    useEffect(() => {
        if (interaction && interaction.currentStep && isInteractionCompleted) {
            setIsInteractionCompleted(false);
        }
    }, [interaction?.currentStep, isInteractionCompleted]);

    useEffect(() => {
        const handleInteractionProgress = (data) => {
            // Si cette progression concerne notre objet
            if (data.markerId === markerId && data.requiredStep === requiredStep) {
                // console.log(`[EasyModelMarker] Progression d'interaction pour ${markerId}`, data);

                // Marquer que nous sommes dans une séquence d'interactions
                setIsInInteractionSequence(true);

                // Mettre à jour les états pour refléter que nous sommes prêts pour la prochaine étape
                setIsInteractionCompleted(false);
            }
        };

        const handleSequenceComplete = (data) => {
            if (data.step === requiredStep) {
                // console.log(`[EasyModelMarker] Séquence d'interaction terminée pour ${markerId}`);
                setIsInInteractionSequence(false);
            }
        };

        // S'abonner aux événements
        const progressCleanup = EventBus.on('object:interaction:progress', handleInteractionProgress);
        const completeCleanup = EventBus.on('interaction-sequence-complete', handleSequenceComplete);

        return () => {
            progressCleanup();
            completeCleanup();
        };
    }, [markerId, requiredStep]);

    // Gérer l'interaction avec le marqueur - optimisé avec useCallback
    const handleMarkerInteraction = useCallback((eventData = {}) => {
        // debugLog(`Interaction avec le marqueur ${markerId}:`, eventData);

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

        // Vérifier si l'interaction est attendue - vérifier avec le requiredStep
        if (interaction?.waitingForInteraction && isWaitingForInteraction &&
            interaction.currentStep === requiredStep) {
            // Compléter l'interaction
            if (interaction.completeInteraction) {
                interaction.completeInteraction();
                // debugLog(`Interaction ${markerId} complétée via ${eventData.type || markerType}`);
            }

            // Gérer les interfaces spécifiques si nécessaire
            if (interfaceToShow) {
                // debugLog(`Tentative d'affichage de l'interface: ${interfaceToShow}`);

                // Obtenir une référence fraîche au store
                const store = useStore.getState();

                // Afficher l'interface correspondante basée sur le type
                switch (interfaceToShow) {
                    case 'scanner':
                        // debugLog(`Affichage de l'interface scanner`);
                        if (store.interaction && typeof store.interaction.setShowScannerInterface === 'function') {
                            store.interaction.setShowScannerInterface(true);
                        } else {
                            console.error("L'interface scanner n'est pas disponible dans le store");
                        }
                        break;
                    case 'capture':
                        // debugLog(`Affichage de l'interface capture`);
                        if (store.interaction && typeof store.interaction.setShowCaptureInterface === 'function') {
                            store.interaction.setShowCaptureInterface(true);
                        } else {
                            console.error("L'interface capture n'est pas disponible dans le store");
                        }
                        break;
                    case 'blackScreen':
                        // debugLog(`Affichage de l'interface blackScreen`);
                        if (store.interaction && typeof store.interaction.setShowBlackscreenInterface === 'function') {
                            store.interaction.setShowBlackscreenInterface(true);
                        } else {
                            console.error("L'interface blackScreen n'est pas disponible dans le store");
                        }
                        break;
                    case 'image':
                        console.log(`Préparation de l'affichage de l'interface image`);
                        if (store.interaction && typeof store.interaction.setShowImageInterface === 'function') {
                            store.interaction.setShowImageInterface(true);
                        } else {
                            console.error("L'interface image n'est pas disponible dans le store");
                        }
                        break;
                    default:
                        console.warn(`Type d'interface non reconnu: ${interfaceToShow}`);
                }

                // Émettre un événement pour signaler l'affichage d'une interface
                EventBus.trigger('interface-display-requested', {
                    interfaceType: interfaceToShow,
                    markerId: markerId,
                    requiredStep: requiredStep
                });
            }

            // Si une animation post-interaction est définie, la déclencher
            if (postInteractionAnimation) {
                try {
                    // debugLog(`Déclenchement de l'animation post-interaction: ${postInteractionAnimation.name}`);
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
                type: markerType,
                requiredStep: requiredStep,
                interfaceToShow: interfaceToShow
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
        interfaceToShow,
        onInteract,
        postInteractionAnimation,
        requiredStep
    ]);

    // Gérer le survol de l'objet
    const handlePointerEnter = useCallback(() => {
        // console.log('[EnhancedObjectMarker] Pointer enter via callback', markerId, markerText);

        // Récupérer les interactions complétées du store
        const completedInteractions = useStore.getState().interaction.completedInteractions || {};

        // Vérifier si cet objet a plusieurs interactions et si cette interaction n'est pas la première
        if (requiredStep) {
            const objectKey = markerId.split('-')[0]; // Extraire la clé de l'objet du markerId
            const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

            if (objectConfig && Array.isArray(objectConfig.interaction) && objectConfig.interaction.length > 1) {
                // Code de vérification des prérequis...
                const currentInteractionIndex = objectConfig.interaction.findIndex(
                    interaction => interaction.requiredStep === requiredStep
                );

                if (currentInteractionIndex > 0) {
                    const previousInteraction = objectConfig.interaction[currentInteractionIndex - 1];
                    const previousStepCompleted = Object.keys(completedInteractions).some(key =>
                        key.includes(previousInteraction.requiredStep) || key === previousInteraction.requiredStep
                    );

                    if (!previousStepCompleted) {
                        return;
                    }
                }
            }

            // Cas spécifiques pour les objets séquentiels
            if (markerId.includes('AnimalPaws') || markerId.includes('fifthStop')) {
                const multipleLeafCompleted = Object.keys(completedInteractions).some(key =>
                    key.includes('thirdStop') || key.includes('MultipleLeaf')
                );

                if (!multipleLeafCompleted) {
                    return;
                }
            }

            // Autres cas spécifiques pour les rochers...
            if (markerId.includes('JumpRock2') || markerId.includes('twelfthStop')) {
                const rock1Completed = Object.keys(completedInteractions).some(key =>
                    key.includes('eleventhStop') || key.includes('JumpRock1')
                );

                if (!rock1Completed) {
                    return;
                }
            }

            if (markerId.includes('JumpRock3') || markerId.includes('thirteenthStop')) {
                const rock2Completed = Object.keys(completedInteractions).some(key =>
                    key.includes('twelfthStop') || key.includes('JumpRock2')
                );

                if (!rock2Completed) {
                    return;
                }
            }

            if (markerId.includes('JumpRock4') || markerId.includes('fourteenthStop')) {
                const rock3Completed = Object.keys(completedInteractions).some(key =>
                    key.includes('thirteenthStop') || key.includes('JumpRock3')
                );

                if (!rock3Completed) {
                    return;
                }
            }
        }

        setHovered(true);

        // Émettre un événement personnalisé pour le survol du marker
        EventBus.trigger('marker:pointer:enter', {
            id: markerId,
            type: 'hover',
            text: markerText
        });
    }, [markerId, markerText, requiredStep]);

    // Fonction pour déterminer si le contour doit être affiché
    const shouldShowOutline = useCallback(() => {
        if (!showOutline) {
            return false;
        }

        if (requiredStep) {
            const isCorrectStep = interaction?.currentStep === requiredStep &&
                interaction?.waitingForInteraction;

            if (isWaitingForInteraction || (isCorrectStep && !isInteractionCompleted)) {
                if (!outlineVisibleRef.current) {
                    outlineVisibleRef.current = true;

                    EventBus.trigger('outline:appeared', {
                        markerId: markerId,
                        requiredStep: requiredStep,
                        objectKey: modelProps?.userData?.objectKey
                    });
                }
                return true;
            } else {
                if (outlineVisibleRef.current && !alwaysVisible && !isWaitingForInteraction) {
                    outlineVisibleRef.current = false;
                }
                return alwaysVisible;
            }
        } else {
            const shouldShow = isWaitingForInteraction || alwaysVisible || hovered;

            if (shouldShow && !outlineVisibleRef.current) {
                outlineVisibleRef.current = true;
            } else if (!shouldShow && outlineVisibleRef.current) {
                outlineVisibleRef.current = false;
            }

            return shouldShow;
        }
    }, [
        showOutline,
        requiredStep,
        interaction?.currentStep,
        interaction?.waitingForInteraction,
        isWaitingForInteraction,
        isInteractionCompleted,
        alwaysVisible,
        hovered,
        markerId
    ]);

    // Nouveau useEffect pour suivre les changements dans l'état d'attente d'interaction
    useEffect(() => {
        if (isWaitingForInteraction && requiredStep) {
            const timer = setTimeout(() => {
                EventBus.trigger('interaction:detected', {
                    markerId: markerId,
                    requiredStep: requiredStep,
                    objectKey: modelProps?.userData?.objectKey,
                    type: 'waiting-for-interaction'
                });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isWaitingForInteraction, requiredStep, markerId]);

    // Handlers pour le survol du marqueur optimisés avec useCallback
    const handleMarkerPointerEnter = useCallback((e) => {
        setIsMarkerHovered(true);
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    }, [markerId]);

    const handleMarkerPointerLeave = useCallback((e) => {
        setIsMarkerHovered(false);
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    }, [markerId]);

    // Nettoyer les ressources lors du démontage
    useEffect(() => {
        isComponentMounted.current = true;

        return () => {
            isComponentMounted.current = false;

            cleanupFunctions.current.forEach(cleanup => {
                try {
                    if (typeof cleanup === 'function') {
                        cleanup();
                    }
                } catch (error) {
                    console.warn('Error cleaning up:', error);
                }
            });

            cleanupFunctions.current = [];
        };
    }, []);

    // Éléments de marqueur mémorisés pour éviter les re-rendus inutiles
    const markerProps = useMemo(() => ({
        id: markerId,
        markerType: markerType,
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
        const showOutlineNow = shouldShowOutline();

        if (!showOutlineNow) return null;

        return (
            <OutlineEffect
                objectRef={modelRef}
                active={true}
                color="#ffffff"
                thickness={0.01}
                intensity={1.3}
                technique="geometry"
                debug={false}
            />
        );
    }, [shouldShowOutline]);

    const shouldModelBeVisible = useMemo(() => {
        if (markerType === INTERACTION_TYPES.DISABLE) {
            return false;
        }
        return true;
    }, [markerType]);

    // MODIFIÉ: Rendu du modèle par défaut utilisant le modèle pré-traité
    const renderDefaultModel = useMemo(() => {
        if (!shouldModelBeVisible) {
            return null;
        }

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
        } else if (modelPath && processedModel) {
            // Utiliser le modèle pré-traité avec textures déjà appliquées
            return (
                <primitive
                    ref={modelRef}
                    object={processedModel}
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
        } else if (modelPath && gltf) {
            // Fallback si le modèle pré-traité n'est pas disponible
            try {
                const fallbackModel = gltf.scene.clone();

                return (
                    <primitive
                        ref={modelRef}
                        object={fallbackModel}
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
                if (DEBUG_EASY_MARKER) {
                    console.warn(`Error with fallback model: ${error.message}`);
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
            // Placeholder en attendant le chargement
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
    }, [shouldModelBeVisible, useBox, modelPath, processedModel, gltf, position, rotation, scale, modelProps, nodeProps]);

    return (
        <ModelMarker {...markerProps}>
            {/* Si children est fourni, utiliser les enfants personnalisés */}
            {children ? (
                <group>
                    {renderChildren}
                    {renderOutlineEffect}
                </group>
            ) : (
                <group>
                    {renderDefaultModel}
                    {renderOutlineEffect}
                </group>
            )}
        </ModelMarker>
    );
});

export default EasyModelMarker;