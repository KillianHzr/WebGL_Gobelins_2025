import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {useAnimations, useGLTF} from '@react-three/drei';
import EasyModelMarker from './EasyModelMarker';
import sceneObjectManager from '../Config/SceneObjectManager';
import {textureManager} from '../Config/TextureManager';
import useStore from '../Store/useStore';
import MARKER_EVENTS, {EventBus} from '../Utils/EventEmitter';
import * as THREE from 'three';
import {FrontSide, LoopOnce, LoopRepeat} from 'three';
import {useAnimationFrame} from "../Utils/AnimationManager.js";

// Activer ou désactiver les logs pour le débogage
const DEBUG_SCENE_OBJECTS = false;

/**
 * Composant pour afficher un objet statique individuel avec textures
 * Version optimisée pour éviter les problèmes de performance et améliorer les ombres
 * NOUVEAU: Avec support complet du contrôle d'animations externes
 */
export const StaticObject = React.memo(function StaticObject({
                                                                 path,
                                                                 position,
                                                                 rotation,
                                                                 quaternion,
                                                                 scale,
                                                                 castShadow = true,
                                                                 receiveShadow = true,
                                                                 visible = true,
                                                                 textureModelId = null,
                                                                 useTextures = true,
                                                                 playAnimation = false,
                                                                 animationName = null,
                                                                 animationLoop = true,
                                                                 animationClamp = false,
                                                                 animationTimeScale = 1.0,
                                                                 onAnimationComplete = null
                                                             }) {
    const objectRef = useRef();
    const isComponentMounted = useRef(true);
    const animationRef = useRef(null);
    const currentAnimationRef = useRef(null);
    const isGroundObjectRef = useRef(false);

    // NOUVEAU: État pour déclencher des re-renders lors de mises à jour d'animation externes
    const [animationTrigger, setAnimationTrigger] = useState(0);
    const [externalAnimationProps, setExternalAnimationProps] = useState(null);

    // Utiliser useMemo pour éviter de recharger le modèle à chaque re-render
    const {scene: modelScene, animations} = useGLTF(path);

    // Cloner le modèle une seule fois avec useMemo
    const model = useMemo(() => {
        const clonedModel = modelScene.clone();

        // Déterminer si c'est un objet de type sol en fonction du nom ou du chemin
        const isGroundObject = path.toLowerCase().includes('ground') ||
            textureModelId?.toLowerCase().includes('ground');
        isGroundObjectRef.current = isGroundObject;

        // Appliquer les propriétés d'ombre de manière appropriée
        clonedModel.traverse((child) => {
            if (child.isMesh) {
                if (isGroundObject) {
                    // Le sol reçoit des ombres mais n'en projette pas
                    child.castShadow = false;
                    child.receiveShadow = true;

                    // Améliorer le matériau pour mieux recevoir les ombres
                    if (child.material) {
                        child.material.roughness = 0.8; // Plus rugueux pour mieux montrer les ombres
                        child.material.metalness = 0.2; // Légèrement métallique

                        // S'assurer que le matériau est configuré pour les ombres
                        child.material.shadowSide = FrontSide;
                        child.material.needsUpdate = true;
                    }
                } else {
                    // Les autres objets peuvent projeter et recevoir des ombres
                    child.castShadow = castShadow;
                    child.receiveShadow = receiveShadow;

                    // Améliorer les paramètres du matériau pour de meilleures ombres
                    if (child.material) {
                        // Assurez-vous que tous les matériaux sont configurés pour les ombres
                        child.material.needsUpdate = true;
                    }
                }
            }
        });

        return clonedModel;
    }, [modelScene, path, textureModelId, castShadow, receiveShadow]);

    // Utiliser useAnimations pour gérer les animations
    const {actions, mixer} = useAnimations(animations, objectRef);

    // Référence pour suivre l'état de lecture
    const animationState = useRef({
        isPlaying: false,
        currentName: null,
        loop: animationLoop,
        clamp: animationClamp,
        timeScale: animationTimeScale
    });

    // NOUVEAU: Écouteur pour les mises à jour d'animation externes
    useEffect(() => {
        const handleAnimationControlUpdate = (data) => {
            // Vérifier si cette mise à jour concerne cet objet
            const matchesIdentifier = data.objectKey === textureModelId ||
                data.identifier === textureModelId ||
                (data.placement && (
                    data.placement.markerId === textureModelId ||
                    data.placement.objectKey === textureModelId
                ));

            if (matchesIdentifier && data.placement && data.placement.animation) {
                console.log(`Mise à jour d'animation externe reçue pour ${textureModelId}:`, data);

                // Stocker les nouvelles propriétés d'animation
                setExternalAnimationProps(data.placement.animation);

                // Déclencher un re-render
                setAnimationTrigger(prev => prev + 1);
            }
        };

        const cleanup = EventBus.on('animation-control-update', handleAnimationControlUpdate);

        return cleanup;
    }, [textureModelId]);

    // Fonction pour déterminer les propriétés d'animation effectives
    const getEffectiveAnimationProps = () => {
        // Les propriétés externes ont la priorité sur les props du composant
        if (externalAnimationProps) {
            return {
                playAnimation: externalAnimationProps.play,
                animationName: externalAnimationProps.name,
                animationLoop: externalAnimationProps.loop,
                animationClamp: externalAnimationProps.clamp,
                animationTimeScale: externalAnimationProps.timeScale,
                onAnimationComplete: externalAnimationProps.onComplete || onAnimationComplete
            };
        }

        // Utiliser les props normales du composant
        return {
            playAnimation,
            animationName,
            animationLoop,
            animationClamp,
            animationTimeScale,
            onAnimationComplete
        };
    };

    // Mettre à jour l'animation lorsque les props changent ou lors de mises à jour externes
    useEffect(() => {
        if (!objectRef.current || !mixer || !actions || Object.keys(actions).length === 0) return;

        // Obtenir les propriétés d'animation effectives
        const effectiveProps = getEffectiveAnimationProps();

        // Si aucune animation n'est spécifiée mais qu'il y en a disponibles, utiliser la première
        if (Object.keys(actions).length > 0 && !effectiveProps.animationName && effectiveProps.playAnimation) {
            const firstAnimName = Object.keys(actions)[0];
            const action = actions[firstAnimName];
            action.reset().play();
            currentAnimationRef.current = action;
            return;
        }

        // Si l'animation doit être jouée
        if (effectiveProps.playAnimation && effectiveProps.animationName) {
            // Si c'est une nouvelle animation ou si l'animation était arrêtée
            if (effectiveProps.animationName !== animationState.current.currentName || !animationState.current.isPlaying) {
                // Arrêter l'animation en cours si elle existe
                if (currentAnimationRef.current) {
                    currentAnimationRef.current.stop();
                }

                const action = actions[effectiveProps.animationName];
                if (action) {
                    // Configurer l'animation
                    action.reset();
                    action.clampWhenFinished = effectiveProps.animationClamp;
                    action.timeScale = effectiveProps.animationTimeScale;
                    action.setLoop(effectiveProps.animationLoop ? LoopRepeat : LoopOnce);

                    // Démarrer l'animation
                    action.play();

                    // Mettre à jour les références
                    currentAnimationRef.current = action;
                    animationState.current = {
                        isPlaying: true,
                        currentName: effectiveProps.animationName,
                        loop: effectiveProps.animationLoop,
                        clamp: effectiveProps.animationClamp,
                        timeScale: effectiveProps.animationTimeScale
                    };

                    console.log(`Animation "${effectiveProps.animationName}" démarrée sur ${textureModelId || path}`);

                    // Gérer la fin d'animation si elle n'est pas en boucle
                    if (!effectiveProps.animationLoop && effectiveProps.onAnimationComplete && mixer) {
                        // Nettoyer d'abord tout écouteur existant
                        if (animationRef.current) {
                            mixer.removeEventListener('finished', animationRef.current);
                        }

                        // Créer une nouvelle fonction de rappel pour cet événement spécifique
                        const finishCallback = (e) => {
                            if (isComponentMounted.current && e.action === action) {
                                console.log(`Animation "${effectiveProps.animationName}" terminée`);
                                animationState.current.isPlaying = false;

                                // Réinitialiser les propriétés d'animation externes si elles existent
                                if (externalAnimationProps) {
                                    setExternalAnimationProps(prev => ({
                                        ...prev,
                                        play: false
                                    }));
                                }

                                effectiveProps.onAnimationComplete(effectiveProps.animationName);
                            }
                        };

                        // Stocker la référence pour le nettoyage ultérieur
                        animationRef.current = finishCallback;

                        // Ajouter l'écouteur
                        mixer.addEventListener('finished', finishCallback);
                    }
                } else {
                    console.warn(`Animation "${effectiveProps.animationName}" non trouvée dans le modèle ${textureModelId || path}`);
                }
            } else if (currentAnimationRef.current) {
                // Mettre à jour les paramètres de l'animation en cours si nécessaire
                if (animationState.current.loop !== effectiveProps.animationLoop) {
                    currentAnimationRef.current.setLoop(effectiveProps.animationLoop ? LoopRepeat : LoopOnce);
                    animationState.current.loop = effectiveProps.animationLoop;
                }

                if (animationState.current.timeScale !== effectiveProps.animationTimeScale) {
                    currentAnimationRef.current.timeScale = effectiveProps.animationTimeScale;
                    animationState.current.timeScale = effectiveProps.animationTimeScale;
                }

                if (animationState.current.clamp !== effectiveProps.animationClamp) {
                    currentAnimationRef.current.clampWhenFinished = effectiveProps.animationClamp;
                    animationState.current.clamp = effectiveProps.animationClamp;
                }
            }
        } else if (!effectiveProps.playAnimation && animationState.current.isPlaying && currentAnimationRef.current) {
            // Arrêter l'animation si playAnimation est passé à false
            currentAnimationRef.current.stop();
            animationState.current.isPlaying = false;
            console.log(`Animation "${animationState.current.currentName}" arrêtée sur ${textureModelId || path}`);
        }
    }, [
        playAnimation, animationName, animationLoop, animationClamp, animationTimeScale,
        actions, mixer, path, textureModelId, onAnimationComplete,
        animationTrigger, externalAnimationProps // NOUVEAU: Dépendances pour les animations externes
    ]);

    // Mettre à jour le mixer d'animation à chaque frame si des animations sont en cours
    useAnimationFrame((state, delta) => {
        if (mixer && animationState.current.isPlaying) {
            mixer.update(delta);
        }
    }, 'animation');

    useEffect(() => {
        if (animations && animations.length > 0 && DEBUG_SCENE_OBJECTS) {
            const effectiveProps = getEffectiveAnimationProps();
            if (effectiveProps.playAnimation && effectiveProps.animationName) {
                if (!actions[effectiveProps.animationName]) {
                    console.warn(`Animation "${effectiveProps.animationName}" introuvable. Animations disponibles:`,
                        Object.keys(actions));
                }
            }
        }
    }, [animations, actions, path, animationTrigger]); // Ajout d'animationTrigger comme dépendance

    // Appliquer les textures au modèle après le montage - avec optimisations
    useEffect(() => {
        if (!objectRef.current || !useTextures || !textureModelId || !textureManager) return;

        let isApplyingTextures = true;

        const applyTextures = async () => {
            try {
                await textureManager.applyTexturesToModel(textureModelId, objectRef.current);

                if (isComponentMounted.current && isApplyingTextures) {
                    // debugLog(`Textures appliquées à ${textureModelId}`);
                }
            } catch (error) {
                if (isComponentMounted.current && isApplyingTextures) {
                    console.error(`Erreur lors de l'application des textures:`, error);
                }
            }
        };

        applyTextures();

        // Nettoyage
        return () => {
            isApplyingTextures = false;
        };
    }, [textureModelId, useTextures]);

    // Nettoyer lors du démontage
    useEffect(() => {
        isComponentMounted.current = true;

        return () => {
            isComponentMounted.current = false;

            // Arrêter toutes les animations en cours
            if (mixer) {
                mixer.stopAllAction();

                // Supprimer l'écouteur d'événement si présent
                if (animationRef.current) {
                    mixer.removeEventListener('finished', animationRef.current);
                }
            }
        };
    }, [mixer]);

    // Éviter les re-rendus inutiles des attributs de primitive
    const primitiveProps = useMemo(() => {
        const props = {
            position,
            scale,
            castShadow: isGroundObjectRef.current ? false : castShadow,
            receiveShadow: isGroundObjectRef.current ? true : receiveShadow,
            visible
        };

        // Utiliser quaternion si disponible, sinon utiliser rotation
        if (quaternion) {
            props.quaternion = quaternion;
        } else {
            props.rotation = rotation;
        }

        return props;
    }, [position, rotation, quaternion, scale, castShadow, receiveShadow, visible]);

    return (
        <primitive
            ref={objectRef}
            object={model}
            {...primitiveProps}
        />
    );
});

/**
 * Composant pour afficher les objets statiques (non-interactifs) dans la scène
 * Version optimisée avec support des animations
 */
export const StaticObjects = React.memo(function StaticObjects({filter = {}}) {
    const [placements, setPlacements] = useState([]);
    const {scene} = useThree();
    const lastFilter = useRef(filter);

    // Fonction de mise à jour des placements optimisée
    const updatePlacements = useCallback(() => {
        const staticPlacements = sceneObjectManager.getStaticPlacements(filter);
        setPlacements(staticPlacements);
    }, [filter]);

    // Récupérer les placements au chargement et lorsque le filtre change
    useEffect(() => {
        // Vérifier si le filtre a changé
        if (JSON.stringify(lastFilter.current) !== JSON.stringify(filter)) {
            lastFilter.current = filter;
            updatePlacements();
        } else {
            // Mise à jour initiale
            updatePlacements();
        }

        // Appliquer la correction pour les ombres des planes une seule fois au chargement
        if (textureManager && typeof textureManager.fixAllPlantMaterials === 'function') {
            textureManager.fixAllPlantMaterials();
        }
        if (scene && textureManager && typeof textureManager.forceEmissiveOnObjects === 'function') {
            textureManager.forceEmissiveOnObjects(scene);
        }
    }, [filter, updatePlacements, scene]);

    // Optimiser le rendu avec useMemo
    const staticObjects = useMemo(() => {
        return placements.map((placement, index) => {
            const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
            if (!objectConfig) return null;

            // Obtenir les informations sur les textures
            const textureModelId = sceneObjectManager.getTextureModelId(placement.objectKey);
            const useTextures = placement.useTextures !== undefined ?
                placement.useTextures : sceneObjectManager.doesObjectUseTextures(placement.objectKey);

            const key = `static-${placement.objectKey}-${index}`;

            // Ajouter les informations d'animations si présentes
            const animationProps = placement.animation ? {
                playAnimation: placement.animation.play,
                animationName: placement.animation.name,
                animationLoop: placement.animation.loop,
                animationClamp: placement.animation.clamp,
                animationTimeScale: placement.animation.timeScale,
                onAnimationComplete: (animName) => {
                    if (placement.animation.onComplete) {
                        placement.animation.onComplete(animName, index);
                    }

                    // Si l'animation n'est pas en boucle, mettre à jour le placement pour indiquer qu'elle est terminée
                    if (!placement.animation.loop) {
                        const updatedPlacement = {...placement};
                        updatedPlacement.animation.play = false;
                        sceneObjectManager.updatePlacement(index, updatedPlacement);

                        // Mettre à jour l'état local
                        setPlacements(prevPlacements => {
                            const newPlacements = [...prevPlacements];
                            newPlacements[index] = updatedPlacement;
                            return newPlacements;
                        });
                    }
                }
            } : {};

            if (placement.animation) {
                console.log(`Animation pour ${placement.objectKey} :`,
                    placement.animation ? {
                        play: placement.animation.play,
                        name: placement.animation.name
                    } : 'Aucune animation');
            }

            return (
                <StaticObject
                    key={key}
                    path={objectConfig.path}
                    position={placement.position}
                    rotation={placement.rotation}
                    quaternion={placement.quaternion} // Nouveau paramètre ajouté
                    scale={placement.scale}
                    castShadow={placement.castShadow !== undefined ? placement.castShadow : true}
                    receiveShadow={placement.receiveShadow !== undefined ? placement.receiveShadow : true}
                    visible={placement.visible}
                    textureModelId={textureModelId}
                    useTextures={useTextures}
                    {...animationProps}
                />
            );
        });
    }, [placements, setPlacements]);

    return (
        <group name="static-objects">
            {staticObjects}
        </group>
    );
});

/**
 * Composant pour gérer et afficher les objets interactifs dans la scène
 * Version optimisée
 */
export const InteractiveObjects = React.memo(function InteractiveObjects({filter = {}}) {
    const [placements, setPlacements] = useState([]);
    const interaction = useStore(state => state.interaction);
    const eventListenerRef = useRef(null);
    const lastFilter = useRef(filter);
    const lastInteractionStep = useRef(interaction?.currentStep);

    // Fonction de mise à jour des placements optimisée
    const updatePlacements = useCallback(() => {
        const interactivePlacements = sceneObjectManager.getInteractivePlacements(filter);
        setPlacements(interactivePlacements);
    }, [filter]);

    // Gestionnaire d'événement optimisé
    const handleInteractionComplete = useCallback(() => {
        updatePlacements();
    }, [updatePlacements]);

    useEffect(() => {
        // S'abonner à l'événement de complétion d'interaction
        const completeCleanup = EventBus.on('object:interaction:complete', (data) => {
            // Directement mettre à jour les placements
            updatePlacements();
        });

        return () => {
            completeCleanup();
        };
    }, [updatePlacements]);

    // Récupérer les placements et configurer les écouteurs d'événements
    useEffect(() => {
        updatePlacements();

        // S'abonner aux événements avec gestion des erreurs
        try {
            // Nettoyer l'écouteur précédent s'il existe
            if (eventListenerRef.current) {
                eventListenerRef.current();
                eventListenerRef.current = null;
            }

            // Ajouter le nouvel écouteur
            eventListenerRef.current = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);
        } catch (error) {
            console.error("Error setting up event listener in InteractiveObjects:", error);
        }

        // Nettoyer les écouteurs
        return () => {
            try {
                if (eventListenerRef.current) {
                    eventListenerRef.current();
                    eventListenerRef.current = null;
                }
            } catch (error) {
                console.warn("Error cleaning up event listener in InteractiveObjects:", error);
            }
        };
    }, [filter, handleInteractionComplete, updatePlacements]);

    // Mettre à jour lorsque l'étape d'interaction change
    useEffect(() => {
        if (interaction && interaction.currentStep !== lastInteractionStep.current) {
            lastInteractionStep.current = interaction.currentStep;
            updatePlacements();
        }
    }, [interaction?.currentStep, updatePlacements]);

    // Optimiser le rendu avec useMemo
    const interactiveObjects = useMemo(() => {
        return placements.map((placement, index) => {
            const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
            if (!objectConfig) return null;

            // Obtenir les informations sur les textures
            const textureModelId = sceneObjectManager.getTextureModelId(placement.objectKey);
            const useTextures = placement.useTextures !== undefined ?
                placement.useTextures : sceneObjectManager.doesObjectUseTextures(placement.objectKey);

            // Déterminer le bon markerType, markerText, markerOffset et markerAxis à partir de la bonne interaction
            let interaction;
            if (Array.isArray(objectConfig.interaction)) {
                // Trouver l'interaction correspondant au requiredStep du placement
                interaction = objectConfig.interaction.find(
                    i => i.requiredStep === placement.requiredStep
                );

                // Fallback à la première interaction si aucune correspondance n'est trouvée
                if (!interaction && objectConfig.interaction.length > 0) {
                    interaction = objectConfig.interaction[0];
                }
            } else {
                interaction = objectConfig.interaction;
            }

            if (!interaction) {
                console.error(`Aucune interaction trouvée pour ${placement.objectKey} (requiredStep: ${placement.requiredStep})`);
                return null;
            }

            // Utiliser les propriétés du placement si définies, sinon utiliser celles de l'interaction trouvée
            const markerProps = {
                modelPath: objectConfig.path,
                position: placement.position,
                rotation: placement.rotation,
                scale: placement.scale,
                markerId: placement.markerId,
                outlinePulse: placement.outlinePulse,
                requiredStep: placement.requiredStep,
                textureModelId: textureModelId,
                useTextures: useTextures,
                markerType: placement.markerType || interaction.type,
                markerText: placement.markerText || interaction.text,
                markerOffset: placement.markerOffset || interaction.offset,
                markerAxis: placement.markerAxis || interaction.axis,
                interfaceToShow: interaction.interfaceToShow
            };

            // IMPORTANT: Garantir que la key est unique et bien définie
            const markerKey = placement.markerId || `interactive-${placement.objectKey}-${index}`;

            return (
                <EasyModelMarker
                    key={markerKey}
                    {...markerProps}
                    onInteract={(event) => {
                        // debugLog(`Interaction avec ${placement.markerId}:`, event);
                        if (placement.onInteract) {
                            placement.onInteract(event);
                        }
                    }}
                />
            );
        });
    }, [placements]);

    return (
        <group name="interactive-objects">
            {interactiveObjects}
        </group>
    );
});

/**
 * Composant pour afficher un seul objet interactif
 * Version optimisée
 */
export const SingleInteractiveObject = React.memo(function SingleInteractiveObject({
                                                                                       objectKey,
                                                                                       position,
                                                                                       options = {}
                                                                                   }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    // Early return si l'objet n'est pas valide
    if (!objectConfig || !objectConfig.interactive) {
        console.error(`Objet interactif "${objectKey}" non trouvé ou non interactif.`);
        return null;
    }

    const markerId = options.markerId || `${objectKey}-single`;
    const textureModelId = sceneObjectManager.getTextureModelId(objectKey);
    const useTextures = options.useTextures !== undefined ?
        options.useTextures : sceneObjectManager.doesObjectUseTextures(objectKey);

    // Déterminer le requiredStep
    let requiredStep = options.requiredStep;
    if (!requiredStep) {
        // Chercher dans les interactions
        if (Array.isArray(objectConfig.interaction) && objectConfig.interaction.length > 0) {
            requiredStep = objectConfig.interaction[0].requiredStep;
        } else if (objectConfig.interaction && objectConfig.interaction.requiredStep) {
            requiredStep = objectConfig.interaction.requiredStep;
        }
    }

    // Trouver l'interaction correspondante
    let matchingInteraction;
    if (Array.isArray(objectConfig.interaction)) {
        matchingInteraction = requiredStep
            ? objectConfig.interaction.find(i => i.requiredStep === requiredStep)
            : objectConfig.interaction[0];
    } else {
        matchingInteraction = objectConfig.interaction;
    }

    if (!matchingInteraction) {
        console.error(`Aucune interaction trouvée pour ${objectKey} (requiredStep: ${requiredStep})`);
        return null;
    }

    // Optimisation: utiliser useMemo pour les props
    const markerProps = useMemo(() => ({
        modelPath: objectConfig.path,
        position: position || [0, 0, 0],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || objectConfig.scale || [1, 1, 1],
        markerId: markerId,
        markerType: options.markerType || matchingInteraction.type,
        markerText: options.markerText || matchingInteraction.text,
        markerOffset: options.markerOffset || matchingInteraction.offset,
        markerAxis: options.markerAxis || matchingInteraction.axis,
        outlinePulse: options.outlinePulse !== undefined ? options.outlinePulse : true,
        requiredStep: requiredStep,
        textureModelId: textureModelId,
        useTextures: useTextures,
        interfaceToShow: matchingInteraction.interfaceToShow
    }), [
        objectConfig,
        position,
        options,
        markerId,
        textureModelId,
        useTextures,
        matchingInteraction,
        requiredStep
    ]);

    // Gérer l'interaction avec le callback mémorisé
    const handleInteract = useCallback((event) => {
        // debugLog(`Interaction avec ${markerId}:`, event);
        if (options.onInteract) {
            options.onInteract(event);
        }
    }, [markerId, options.onInteract]);

    return <EasyModelMarker {...markerProps} onInteract={handleInteract}/>;
});

/**
 * Composant pour afficher un seul objet statique
 * Version optimisée
 */
export const SingleStaticObject = React.memo(function SingleStaticObject({
                                                                             objectKey,
                                                                             position,
                                                                             options = {}
                                                                         }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    // Early return si l'objet n'est pas valide
    if (!objectConfig || objectConfig.interactive) {
        console.error(`Objet statique "${objectKey}" non trouvé ou est interactif.`);
        return null;
    }

    const textureModelId = sceneObjectManager.getTextureModelId(objectKey);
    const useTextures = options.useTextures !== undefined ?
        options.useTextures : sceneObjectManager.doesObjectUseTextures(objectKey);

    // Préparer les propriétés d'animation si elles sont fournies
    const animationProps = {};
    if (options.animation) {
        // Vérifier si l'animation existe dans la configuration de l'objet
        const availableAnimations = sceneObjectManager.getAvailableAnimations(objectKey);
        const animationExists = availableAnimations.includes(options.animation.name);

        if (options.animation.name && animationExists) {
            // Récupérer les paramètres par défaut de l'animation
            const animDefaults = objectConfig.animations?.[options.animation.name] || {};

            animationProps.playAnimation = options.animation.play !== undefined ? options.animation.play : false;
            animationProps.animationName = options.animation.name;
            animationProps.animationLoop = options.animation.loop !== undefined ? options.animation.loop : (animDefaults.defaultLoop || true);
            animationProps.animationClamp = options.animation.clamp !== undefined ? options.animation.clamp : (animDefaults.defaultClamp || false);
            animationProps.animationTimeScale = options.animation.timeScale !== undefined ? options.animation.timeScale : (animDefaults.defaultTimeScale || 1.0);

            if (options.animation.onComplete) {
                animationProps.onAnimationComplete = options.animation.onComplete;
            }
        } else if (options.animation.name) {
            console.warn(`Animation "${options.animation.name}" non trouvée pour l'objet "${objectKey}". Animations disponibles: ${availableAnimations.join(', ') || 'aucune'}`);
        }
    }

    // Optimisation: utiliser useMemo pour les props
    const staticProps = useMemo(() => ({
        path: objectConfig.path,
        position: position || [0, 0, 0],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || objectConfig.scale || [1, 1, 1],
        castShadow: options.castShadow !== undefined ? options.castShadow : true,
        receiveShadow: options.receiveShadow !== undefined ? options.receiveShadow : true,
        visible: options.visible !== undefined ? options.visible : true,
        textureModelId: textureModelId,
        useTextures: useTextures,
        ...animationProps
    }), [
        objectConfig,
        position,
        options,
        textureModelId,
        useTextures,
        animationProps
    ]);

    return <StaticObject {...staticProps} />;
});

/**
 * Composant principal qui affiche tous les objets de scène
 * Utilise les deux sous-composants pour objets statiques et interactifs
 * Version optimisée
 */
const SceneObjects = React.memo(function SceneObjects({
                                                          staticFilter = {},
                                                          interactiveFilter = {}
                                                      }) {
    return (
        <group name="scene-objects">
            <StaticObjects filter={staticFilter}/>
            <InteractiveObjects filter={interactiveFilter}/>
        </group>
    );
});

export default SceneObjects;