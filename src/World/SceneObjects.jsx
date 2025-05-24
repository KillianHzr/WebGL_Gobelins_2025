import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {useAnimations, useGLTF} from '@react-three/drei';
import EasyModelMarker from './EasyModelMarker';
import sceneObjectManager from '../Config/SceneObjectManager';
import {textureManager} from '../Config/TextureManager';
import useStore from '../Store/useStore';
import MARKER_EVENTS, {EventBus} from '../Utils/EventEmitter';
import {FrontSide, LoopOnce, LoopRepeat} from 'three';

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
                                                                 onAnimationComplete = null,
                                                                 placementIndex = null, // NOUVEAU: pour identification
                                                                 animationId = null     // NOUVEAU: pour identification
                                                             }) {
    const objectRef = useRef();
    const isComponentMounted = useRef(true);
    const animationRef = useRef(null);
    const currentAnimationRef = useRef(null);
    const isGroundObjectRef = useRef(false);

    // État pour déclencher des re-renders lors de mises à jour d'animation externes
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
                        child.material.roughness = 0.8;
                        child.material.metalness = 0.2;
                        child.material.shadowSide = FrontSide;
                        child.material.needsUpdate = true;
                    }
                } else {
                    // Les autres objets peuvent projeter et recevoir des ombres
                    child.castShadow = castShadow;
                    child.receiveShadow = receiveShadow;

                    if (child.material) {
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


    useEffect(() => {
        console.log(`👂 StaticObject [${textureModelId}] - Configuration écouteur animation`);
        console.log(`🏷️ Identifiants disponibles:`, {
            textureModelId,
            placementIndex,
            animationId,
            path: path.split('/').pop()
        });

        const handleAnimationControlUpdate = (data) => {
            console.log(`📨 StaticObject [${textureModelId}] reçoit événement:`, {
                eventIdentifier: data.identifier,
                eventObjectKey: data.objectKey,
                eventPlacementIndex: data.placementIndex,
                myTextureModelId: textureModelId,
                myPlacementIndex: placementIndex,
                myAnimationId: animationId
            });

            // Test de correspondance détaillé
            const matches = {
                byTextureModelId: data.identifier === textureModelId || data.objectKey === textureModelId,
                byPlacementIndex: placementIndex !== null && data.placementIndex === placementIndex,
                byAnimationId: animationId && data.animationId === animationId,
                byPlacement: data.placement && (
                    data.placement.objectKey === textureModelId ||
                    data.placement.animationId === animationId
                )
            };

            console.log(`🔍 Tests de correspondance:`, matches);

            const matchesIdentifier = Object.values(matches).some(match => match);

            if (matchesIdentifier && data.placement && data.placement.animation) {
                console.log(`✅ [${textureModelId}] Animation externe acceptée:`, data.placement.animation);

                // Stocker les nouvelles propriétés d'animation
                setExternalAnimationProps(data.placement.animation);

                // Déclencher un re-render
                setAnimationTrigger(prev => {
                    console.log(`🔄 [${textureModelId}] Trigger animation: ${prev} -> ${prev + 1}`);
                    return prev + 1;
                });
            } else {
                console.log(`❌ [${textureModelId}] Événement ignoré - pas de correspondance ou pas de données animation`);
            }
        };

        const cleanup = EventBus.on('animation-control-update', handleAnimationControlUpdate);
        return cleanup;
    }, [textureModelId, placementIndex, animationId, path]);
    window.debugVisonAnimation = () => {
        console.log("=== DEBUG ANIMATION VISON ===");

        // Vérifier les placements
        const visonPlacements = sceneObjectManager.getPlacements({objectKey: 'Vison'});
        console.log("1. Placements Vison:", visonPlacements);

        // Vérifier la configuration
        const visonConfig = sceneObjectManager.getObjectFromCatalog('Vison');
        console.log("2. Config Vison:", visonConfig);

        // Tester l'identification
        const foundPlacements = sceneObjectManager.findPlacementsByIdentifier('Vison');
        console.log("3. Placements trouvés par identifier:", foundPlacements);

        // Tester l'événement directement
        console.log("4. Test événement direct...");
        EventBus.trigger('animation-control-update', {
            identifier: 'Vison',
            objectKey: 'Vison',
            action: 'play',
            animationName: 'animation_0',
            placement: {
                objectKey: 'Vison',
                animation: {
                    play: true,
                    name: 'animation_0',
                    loop: true,
                    timeScale: 1.0
                }
            },
            placementIndex: 7
        });

        console.log("=== FIN DEBUG ===");
    };

    console.log("🛠️ Debug tools installés - utilisez window.debugVisonAnimation() pour tester");

    // MODIFIÉ: Écouteur pour les mises à jour d'animation externes avec meilleure identification
    useEffect(() => {
        const handleAnimationControlUpdate = (data) => {
            console.log(`StaticObject reçoit événement animation:`, {
                dataIdentifier: data.identifier,
                dataObjectKey: data.objectKey,
                dataPlacementIndex: data.placementIndex,
                textureModelId,
                placementIndex,
                animationId,
                path
            });

            // AMÉLIORÉ: Plusieurs méthodes d'identification
            const matchesIdentifier =
                // Par textureModelId
                data.identifier === textureModelId ||
                data.objectKey === textureModelId ||
                // Par placementIndex (plus fiable pour objets statiques)
                (placementIndex !== null && data.placementIndex === placementIndex) ||
                // Par animationId
                (animationId && data.animationId === animationId) ||
                // Par placement
                (data.placement && (
                    data.placement.markerId === textureModelId ||
                    data.placement.objectKey === textureModelId ||
                    data.placement.animationId === animationId
                ));

            if (matchesIdentifier && data.placement && data.placement.animation) {
                console.log(`✅ Animation externe acceptée pour ${textureModelId || path}:`, data.placement.animation);

                // Stocker les nouvelles propriétés d'animation
                setExternalAnimationProps(data.placement.animation);

                // Déclencher un re-render
                setAnimationTrigger(prev => prev + 1);
            } else if (matchesIdentifier) {
                console.log(`⚠️ Événement d'animation reçu mais pas de données d'animation pour ${textureModelId}`);
            }
        };

        const cleanup = EventBus.on('animation-control-update', handleAnimationControlUpdate);

        return cleanup;
    }, [textureModelId, placementIndex, animationId, path]);

    // Fonction pour déterminer les propriétés d'animation effectives
    const getEffectiveAnimationProps = () => {
        // Les propriétés externes ont la priorité sur les props du composant
        if (externalAnimationProps) {
            console.log(`🎬 Utilisation animation externe:`, externalAnimationProps);
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
        if (!objectRef.current || !mixer || !actions || Object.keys(actions).length === 0) {
            console.log(`❌ Animation impossible - Composants manquants:`, {
                objectRef: !!objectRef.current,
                mixer: !!mixer,
                actions: !!actions,
                actionsCount: actions ? Object.keys(actions).length : 0,
                textureModelId
            });
            return;
        }

        // Obtenir les propriétés d'animation effectives
        const effectiveProps = getEffectiveAnimationProps();

        console.log(`🎯 Props d'animation effectives pour ${textureModelId}:`, effectiveProps);

        // Si aucune animation n'est spécifiée mais qu'il y en a disponibles, utiliser la première
        if (Object.keys(actions).length > 0 && !effectiveProps.animationName && effectiveProps.playAnimation) {
            const firstAnimName = Object.keys(actions)[0];
            console.log(`🎬 Démarrage animation par défaut: ${firstAnimName}`);
            const action = actions[firstAnimName];
            action.reset().play();
            currentAnimationRef.current = action;
            animationState.current.isPlaying = true;
            animationState.current.currentName = firstAnimName;
            return;
        }

        // Si l'animation doit être jouée
        if (effectiveProps.playAnimation && effectiveProps.animationName) {
            console.log(`🎬 Tentative de lecture animation "${effectiveProps.animationName}" sur ${textureModelId}`);

            // Si c'est une nouvelle animation ou si l'animation était arrêtée
            if (effectiveProps.animationName !== animationState.current.currentName || !animationState.current.isPlaying) {
                // Arrêter l'animation en cours si elle existe
                if (currentAnimationRef.current) {
                    console.log(`🛑 Arrêt animation précédente`);
                    currentAnimationRef.current.stop();
                }

                const action = actions[effectiveProps.animationName];
                if (action) {
                    console.log(`✅ Action trouvée, configuration et démarrage...`);

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

                    console.log(`🎉 Animation "${effectiveProps.animationName}" démarrée avec succès sur ${textureModelId || path}`);

                    // Gérer la fin d'animation si elle n'est pas en boucle
                    if (!effectiveProps.animationLoop && effectiveProps.onAnimationComplete && mixer) {
                        // Nettoyer d'abord tout écouteur existant
                        if (animationRef.current) {
                            mixer.removeEventListener('finished', animationRef.current);
                        }

                        // Créer une nouvelle fonction de rappel pour cet événement spécifique
                        const finishCallback = (e) => {
                            if (isComponentMounted.current && e.action === action) {
                                console.log(`🏁 Animation "${effectiveProps.animationName}" terminée`);
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
                    console.warn(`❌ Animation "${effectiveProps.animationName}" non trouvée dans le modèle ${textureModelId || path}. Animations disponibles:`, Object.keys(actions));
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
            console.log(`🛑 Arrêt animation "${animationState.current.currentName}" sur ${textureModelId || path}`);
            currentAnimationRef.current.stop();
            animationState.current.isPlaying = false;
        }
    }, [
        playAnimation, animationName, animationLoop, animationClamp, animationTimeScale,
        actions, mixer, path, textureModelId, onAnimationComplete,
        animationTrigger, externalAnimationProps // Dépendances pour les animations externes
    ]);
// Modifier l'useEffect de force Vison pour qu'il ne se déclenche que sur demande :
    useEffect(() => {
        if (textureModelId === 'Vison' || path.includes('Vison')) {
            console.log(`🦡 Composant Vison prêt`);

            // Exposer une fonction pour démarrer l'animation depuis l'extérieur
            const startVisonAnimation = (options = {}) => {
                if (!objectRef.current || !mixer || !actions || Object.keys(actions).length === 0) {
                    console.log(`❌ Vison pas prêt pour animation`);
                    return false;
                }

                console.log(`🎬 Démarrage animation Vison sur demande`);

                // Récupérer la configuration de l'objet Vison depuis le SceneObjectManager
                const visonConfig = sceneObjectManager.getObjectFromCatalog('Vison');

                console.log(visonConfig.animations);
                if (actions['animation_0']) {
                    const action = actions['animation_0'];

                    // Récupérer les paramètres par défaut de l'animation depuis la config
                    const animationDefaults = visonConfig?.animations?.['animation_0'] || {};

                    console.log(`📋 Config animation par défaut:`, animationDefaults);

                    // Arrêter les autres animations
                    mixer.stopAllAction();

                    // Configurer l'animation avec les valeurs par défaut ou les options passées
                    action.reset();

                    // Utiliser defaultLoop depuis la config, sinon true par défaut
                    const shouldLoop = options.loop !== undefined ? options.loop :
                        (animationDefaults.defaultLoop !== undefined ? animationDefaults.defaultLoop : true);

                    action.setLoop(shouldLoop ? LoopRepeat : LoopOnce, shouldLoop ? Infinity : 1);

                    // Utiliser defaultTimeScale depuis la config, sinon 1.0 par défaut
                    const timeScale = options.timeScale !== undefined ? options.timeScale :
                        (animationDefaults.defaultTimeScale !== undefined ? animationDefaults.defaultTimeScale : 1.0);

                    action.timeScale = timeScale;

                    // Utiliser defaultClamp depuis la config si spécifié
                    const shouldClamp = options.clamp !== undefined ? options.clamp :
                        (animationDefaults.defaultClamp !== undefined ? animationDefaults.defaultClamp : false);

                    action.clampWhenFinished = shouldClamp;

                    action.play();

                    console.log(`✅ Animation Vison démarrée avec config:`, {
                        loop: shouldLoop,
                        timeScale: timeScale,
                        clamp: shouldClamp,
                        source: 'config + options'
                    });

                    // Mettre à jour l'état avec les valeurs effectives
                    animationState.current = {
                        isPlaying: true,
                        currentName: 'animation_0',
                        loop: shouldLoop,
                        clamp: shouldClamp,
                        timeScale: timeScale
                    };

                    currentAnimationRef.current = action;
                    return true;
                }

                console.warn(`❌ Animation 'animation_0' non trouvée pour le Vison`);
                return false;
            };

            // Exposer globalement
            window.startVisonAnimation = startVisonAnimation;

            // Écouter l'événement de déclenchement
            const handleVisonTrigger = (data) => {
                console.log(`🦡 Réception événement déclenchement Vison:`, data);
                startVisonAnimation(data.options || {});
            };

            const cleanup = EventBus.on('START_VISON_ANIMATION', handleVisonTrigger);

            return () => {
                cleanup();
                // Nettoyer la fonction globale
                if (window.startVisonAnimation === startVisonAnimation) {
                    delete window.startVisonAnimation;
                }
            };
        }
    }, [textureModelId, path, actions, mixer]);


        return (
        <primitive
            ref={objectRef}
            object={model}
            position={position}
            rotation={rotation}
            quaternion={quaternion}
            scale={scale}
            castShadow={isGroundObjectRef.current ? false : castShadow}
            receiveShadow={isGroundObjectRef.current ? true : receiveShadow}
            visible={visible}
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

    // NOUVEAU: Écouter les mises à jour d'animation pour re-render
    useEffect(() => {
        const handleAnimationUpdate = (data) => {
            // Re-récupérer les placements si une animation a été mise à jour
            updatePlacements();
        };

        return EventBus.on('animation-control-update', handleAnimationUpdate);
    }, [updatePlacements]);


    useEffect(() => {
        console.log(`👂 StaticObjects - Configuration écouteur animation pour ${placements.length} placements`);

        // Debug: Lister tous les placements avec leurs identifiants
        placements.forEach((placement, index) => {
            if (placement.objectKey === 'Vison') {
                console.log(`🦡 Placement Vison trouvé à l'index ${index}:`, {
                    objectKey: placement.objectKey,
                    animationId: placement.animationId,
                    hasAnimation: !!placement.animation,
                    animationActive: placement.animation?.play
                });
            }
        });

        const handleAnimationUpdate = (data) => {
            console.log(`📨 StaticObjects reçoit événement animation:`, {
                identifier: data.identifier,
                objectKey: data.objectKey,
                placementIndex: data.placementIndex,
                action: data.action
            });

            // Re-récupérer les placements si une animation a été mise à jour
            console.log(`🔄 StaticObjects - Mise à jour des placements suite à animation`);
            updatePlacements();
        };

        const cleanup = EventBus.on('animation-control-update', handleAnimationUpdate);
        return cleanup;
    }, [updatePlacements, placements]); // Ajouter placements comme dépendance

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

            // MODIFIÉ: Ajouter les informations d'animations si présentes
            const animationProps = placement.animation ? {
                playAnimation: placement.animation.play,
                animationName: placement.animation.name,
                animationLoop: placement.animation.loop,
                animationClamp: placement.animation.clamp,
                animationTimeScale: placement.animation.timeScale,
                onAnimationComplete: (animName) => {
                    console.log(`🏁 Animation ${animName} terminée pour ${placement.objectKey}`);

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

            // Debug log pour les objets avec animations
            if (placement.animation) {
                console.log(`🎬 Rendu objet statique ${placement.objectKey} avec animation:`, {
                    objectKey: placement.objectKey,
                    index,
                    animationId: placement.animationId,
                    animation: placement.animation ? {
                        play: placement.animation.play,
                        name: placement.animation.name,
                        loop: placement.animation.loop
                    } : 'Aucune animation'
                });
            }

            return (
                <StaticObject
                    key={key}
                    path={objectConfig.path}
                    position={placement.position}
                    rotation={placement.rotation}
                    quaternion={placement.quaternion}
                    scale={placement.scale}
                    castShadow={placement.castShadow !== undefined ? placement.castShadow : true}
                    receiveShadow={placement.receiveShadow !== undefined ? placement.receiveShadow : true}
                    visible={placement.visible}
                    textureModelId={textureModelId}
                    useTextures={useTextures}
                    placementIndex={index} // NOUVEAU: Passer l'index pour identification
                    animationId={placement.animationId} // NOUVEAU: Passer l'ID d'animation si disponible
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