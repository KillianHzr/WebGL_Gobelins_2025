import React, {useEffect, useRef, useState} from 'react'
import {useFrame} from '@react-three/fiber'
import {Color} from 'three'
import useStore from '../Store/useStore'
import guiConfig from '../Config/guiConfig'
import {getDefaultValue} from "../Utils/defaultValues.js";
import useObjectClick from '../Hooks/useObjectClick';
import useDragGesture from '../Hooks/useDragGesture';
import {audioManager} from '../Utils/AudioManager';
import OutlineEffect from '../Utils/OutlineEffect';
import GlowEffectDebug from '../Utils/GlowEffectDebug';
import {EventBus} from '../Utils/EventEmitter';
import {INTERACTION_TYPES, ModelMarker} from '../Utils/EnhancedObjectMarker';
import MARKER_EVENTS from "../Utils/markerEvents.js";

export default function EnhancedCube() {
    const cubeRef = useRef();
    const [hovered, setHovered] = useState(false);
    const [active, setActive] = useState(false);
    const [dragging, setDragging] = useState(false);
    const folderRef = useRef(null);
    const {debug, gui, updateDebugConfig, getDebugConfigValue, clickListener, interaction} = useStore();
    const [isInteractionCompleted, setIsInteractionCompleted] = useState(false);
    // État indiquant si ce cube est l'objet qui nécessite actuellement une interaction
    const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);

    // État pour suivre si le marqueur est survolé
    const [isMarkerHovered, setIsMarkerHovered] = useState(false);

    // Type d'interaction actuellement demandé (pour changer l'apparence du marqueur)
    const [currentInteractionType, setCurrentInteractionType] = useState(null);

    // Utiliser le composant de debug pour l'effet de glow
    const {effectSettings, updateEffectRef} = GlowEffectDebug({objectRef: cubeRef});

    // Texte du marqueur selon le type d'interaction
    const getMarkerText = () => {
        switch (currentInteractionType) {
            case INTERACTION_TYPES.CLICK:
                return "Cliquez ici";
            case INTERACTION_TYPES.LONG_PRESS:
                return "Appuyez et maintenez";
            case INTERACTION_TYPES.DRAG_LEFT:
                return "Glissez vers la gauche";
            case INTERACTION_TYPES.DRAG_RIGHT:
                return "Glissez vers la droite";
            case INTERACTION_TYPES.DRAG_UP:
                return "Glissez vers le haut";
            case INTERACTION_TYPES.DRAG_DOWN:
                return "Glissez vers le bas";
            default:
                return "Interagir";
        }
    };

    // Surveiller l'état d'interaction pour activer l'effet de glow et définir le type d'interaction
    useEffect(() => {
        // Vérifier si ce cube est l'objet qui nécessite une interaction
        const isFirstStop = interaction?.waitingForInteraction && interaction.currentStep === 'firstStop';
        const isSecondStop = interaction?.waitingForInteraction && interaction.currentStep === 'secondStop';
        const isThirdStop = interaction?.waitingForInteraction && interaction.currentStep === 'thirdStop';
        const isCurrentInteractionTarget = isFirstStop || isSecondStop || isThirdStop;

        setIsWaitingForInteraction(isCurrentInteractionTarget);

        // Définir le type d'interaction en fonction de l'étape
        if (isFirstStop) {
            setCurrentInteractionType(INTERACTION_TYPES.CLICK);
        } else if (isSecondStop) {
            setCurrentInteractionType(INTERACTION_TYPES.DRAG_RIGHT);
        } else if (isThirdStop) {
            setCurrentInteractionType(INTERACTION_TYPES.LONG_PRESS);
        }

        // Afficher les informations de débogage
        if (debug?.active && isCurrentInteractionTarget) {
            console.log(`[Cube] Waiting for interaction: ${interaction.currentStep} - Type: ${
                isFirstStop ? 'CLICK' : isSecondStop ? 'DRAG_RIGHT' : isThirdStop ? 'LONG_PRESS' : 'UNKNOWN'
            }`);
        }
    }, [interaction?.waitingForInteraction, interaction?.currentStep, debug?.active]);

    // Activer l'écoute des clics au montage
    useEffect(() => {
        if (clickListener && !clickListener.isListening && typeof clickListener.startListening === 'function') {
            clickListener.startListening();
        }
    }, [clickListener]);

    // Utiliser le hook pour détecter les clics sur le cube
    useObjectClick({
        objectRef: cubeRef,
        enabled: true,
        debug: debug?.active,
        onClick: (intersection, event) => {
            // Logique de clic
        }
    });

    // Utiliser le hook pour détecter les drags sur le cube
    const {isDragging} = useDragGesture({
        objectRef: cubeRef,
        enabled: true,
        minDistance: 100, // 100 pixels minimum de glissement
        direction: 'right', // Pour le DRAG_RIGHT
        debug: debug?.active,
        onDragStart: (data) => {
            console.log('Drag started on cube');
            setDragging(true);
        },
        onDragEnd: (data) => {
            console.log('Drag ended on cube', data);
            setDragging(false);
        },
        onDragSuccess: (data) => {
            // Logique de drag réussi
        }
    });

    // Animation state avec valeurs par défaut du config
    const animationRef = useRef({
        enabled: getDebugConfigValue('objects.cube.animation.enabled.value', getDefaultValue('objects.cube.animation.enabled', true)),
        speed: getDebugConfigValue('objects.cube.animation.speed.value', getDefaultValue('objects.cube.animation.speed', 0.5))
    });

    // Appliquer les valeurs par défaut du cube au montage
    useEffect(() => {
        if (cubeRef.current) {
            const mesh = cubeRef.current;

            // Donner un nom explicite au cube pour faciliter le débogage
            mesh.name = 'MainCube';
            console.log('[Cube] Initialized with name:', mesh.name, 'and UUID:', mesh.uuid);

            // Appliquer les positions par défaut
            const posX = getDefaultValue('objects.cube.position.x', 0);
            const posY = getDefaultValue('objects.cube.position.y', 0);
            const posZ = getDefaultValue('objects.cube.position.z', 0);
            mesh.position.set(posX, posY, posZ);

            // Appliquer les rotations par défaut
            const rotX = getDefaultValue('objects.cube.rotation.x', 0);
            const rotY = getDefaultValue('objects.cube.rotation.y', 0);
            const rotZ = getDefaultValue('objects.cube.rotation.z', 0);
            mesh.rotation.set(rotX, rotY, rotZ);

            // Appliquer les échelles par défaut
            const scaleX = getDefaultValue('objects.cube.scale.x', 1);
            const scaleY = getDefaultValue('objects.cube.scale.y', 1);
            const scaleZ = getDefaultValue('objects.cube.scale.z', 1);
            mesh.scale.set(scaleX, scaleY, scaleZ);

            // Appliquer les propriétés du matériau par défaut
            if (mesh.material) {
                // Couleur
                const defaultColor = getDefaultValue('objects.cube.material.color', '#ff5533');
                if (defaultColor) {
                    mesh.material.color.set(defaultColor.color || defaultColor);
                }

                // Wireframe
                const defaultWireframe = getDefaultValue('objects.cube.material.wireframe', false);
                mesh.material.wireframe = defaultWireframe;

                // Roughness et metalness
                const defaultRoughness = getDefaultValue('objects.cube.material.roughness', 0.5);
                const defaultMetalness = getDefaultValue('objects.cube.material.metalness', 0.5);
                mesh.material.roughness = defaultRoughness;
                mesh.material.metalness = defaultMetalness;
            }
        }
    }, [cubeRef.current]);

    // Apply debug GUI for cube
    useEffect(() => {
        if (debug?.active && debug?.showGui && gui && cubeRef.current) {
            console.log("Setting up cube debug UI");

            // Create objects folder if it doesn't exist yet
            let objectsFolder = gui.folders.find(folder => folder.name === guiConfig.objects.folder)
            if (!objectsFolder) {
                objectsFolder = gui.addFolder(guiConfig.objects.folder);
            }
            if (guiConfig.gui.closeFolders) {
                objectsFolder.close();
            }

            // Create cube folder
            const cubeFolder = objectsFolder.addFolder(guiConfig.objects.cube.folder)
            folderRef.current = cubeFolder

            if (guiConfig.gui.closeFolders) {
                cubeFolder.close();
            }

            const mesh = cubeRef.current

            // Get saved transform values or use defaults from config
            const savedPosition = {
                x: getDebugConfigValue('objects.cube.position.x.value', getDefaultValue('objects.cube.position.x', mesh.position.x)),
                y: getDebugConfigValue('objects.cube.position.y.value', getDefaultValue('objects.cube.position.y', mesh.position.y)),
                z: getDebugConfigValue('objects.cube.position.z.value', getDefaultValue('objects.cube.position.z', mesh.position.z))
            }

            const savedRotation = {
                x: getDebugConfigValue('objects.cube.rotation.x.value', getDefaultValue('objects.cube.rotation.x', mesh.rotation.x)),
                y: getDebugConfigValue('objects.cube.rotation.y.value', getDefaultValue('objects.cube.rotation.y', mesh.rotation.y)),
                z: getDebugConfigValue('objects.cube.rotation.z.value', getDefaultValue('objects.cube.rotation.z', mesh.rotation.z))
            }

            const savedScale = {
                x: getDebugConfigValue('objects.cube.scale.x.value', getDefaultValue('objects.cube.scale.x', mesh.scale.x)),
                y: getDebugConfigValue('objects.cube.scale.y.value', getDefaultValue('objects.cube.scale.y', mesh.scale.y)),
                z: getDebugConfigValue('objects.cube.scale.z.value', getDefaultValue('objects.cube.scale.z', mesh.scale.z))
            }

            // Apply saved transforms from GUI if they exist, or from defaults
            mesh.position.set(savedPosition.x, savedPosition.y, savedPosition.z)
            mesh.rotation.set(savedRotation.x, savedRotation.y, savedRotation.z)
            mesh.scale.set(savedScale.x, savedScale.y, savedScale.z)

            // Position controls
            const posFolder = cubeFolder.addFolder('Position')

            posFolder.add(mesh.position, 'x', guiConfig.objects.cube.position.x.min, guiConfig.objects.cube.position.x.max, guiConfig.objects.cube.position.x.step).name(guiConfig.objects.cube.position.x.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.position.x.value', value)
                })

            posFolder.add(mesh.position, 'y', guiConfig.objects.cube.position.y.min, guiConfig.objects.cube.position.y.max, guiConfig.objects.cube.position.y.step).name(guiConfig.objects.cube.position.y.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.position.y.value', value)
                })

            posFolder.add(mesh.position, 'z', guiConfig.objects.cube.position.z.min, guiConfig.objects.cube.position.z.max, guiConfig.objects.cube.position.z.step).name(guiConfig.objects.cube.position.z.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.position.z.value', value)
                })

            // Rotation controls
            const rotFolder = cubeFolder.addFolder('Rotation')

            rotFolder.add(mesh.rotation, 'x', guiConfig.objects.cube.rotation.x.min, guiConfig.objects.cube.rotation.x.max, guiConfig.objects.cube.rotation.x.step).name(guiConfig.objects.cube.rotation.x.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.rotation.x.value', value)
                })

            rotFolder.add(mesh.rotation, 'y', guiConfig.objects.cube.rotation.y.min, guiConfig.objects.cube.rotation.y.max, guiConfig.objects.cube.rotation.y.step).name(guiConfig.objects.cube.rotation.y.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.rotation.y.value', value)
                })

            rotFolder.add(mesh.rotation, 'z', guiConfig.objects.cube.rotation.z.min, guiConfig.objects.cube.rotation.z.max, guiConfig.objects.cube.rotation.z.step).name(guiConfig.objects.cube.rotation.z.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.rotation.z.value', value)
                })

            // Scale controls
            const scaleFolder = cubeFolder.addFolder('Scale')

            scaleFolder.add(mesh.scale, 'x', guiConfig.objects.cube.scale.x.min, guiConfig.objects.cube.scale.x.max, guiConfig.objects.cube.scale.x.step).name(guiConfig.objects.cube.scale.x.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.scale.x.value', value)
                })

            scaleFolder.add(mesh.scale, 'y', guiConfig.objects.cube.scale.y.min, guiConfig.objects.cube.scale.y.max, guiConfig.objects.cube.scale.y.step).name(guiConfig.objects.cube.scale.y.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.scale.y.value', value)
                })

            scaleFolder.add(mesh.scale, 'z', guiConfig.objects.cube.scale.z.min, guiConfig.objects.cube.scale.z.max, guiConfig.objects.cube.scale.z.step).name(guiConfig.objects.cube.scale.z.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.scale.z.value', value)
                })

            // Material controls
            const material = mesh.material
            const materialFolder = cubeFolder.addFolder(guiConfig.objects.cube.material.folder)

            // Get saved material properties with defaults from config
            const defaultColor = guiConfig.objects.cube.material.color.color;
            const savedColor = getDebugConfigValue('objects.cube.material.color.value', defaultColor)
            const defaultWireframe = getDefaultValue('objects.cube.material.wireframe', false);
            const savedWireframe = getDebugConfigValue('objects.cube.material.wireframe.value', defaultWireframe)
            const defaultRoughness = getDefaultValue('objects.cube.material.roughness', 0.5);
            const savedRoughness = getDebugConfigValue('objects.cube.material.roughness.value', defaultRoughness)
            const defaultMetalness = getDefaultValue('objects.cube.material.metalness', 0.5);
            const savedMetalness = getDebugConfigValue('objects.cube.material.metalness.value', defaultMetalness)

            // Apply saved material properties
            material.color.set(savedColor)
            material.wireframe = savedWireframe
            material.roughness = savedRoughness
            material.metalness = savedMetalness

            // Color control
            const matSettings = {
                color: savedColor
            }

            materialFolder.addColor(matSettings, 'color')
                .name(guiConfig.objects.cube.material.color.name)
                .onChange(value => {
                    material.color.set(value)
                    updateDebugConfig('objects.cube.material.color.value', value)
                })

            // Wireframe control
            materialFolder.add(material, 'wireframe')
                .name(guiConfig.objects.cube.material.wireframe.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.material.wireframe.value', value)
                })

            // Roughness control
            materialFolder.add(material, 'roughness', guiConfig.objects.cube.material.roughness.min, guiConfig.objects.cube.material.roughness.max, guiConfig.objects.cube.material.roughness.step).name(guiConfig.objects.cube.material.roughness.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.material.roughness.value', value)
                })

            // Metalness control
            materialFolder.add(material, 'metalness', guiConfig.objects.cube.material.metalness.min, guiConfig.objects.cube.material.metalness.max, guiConfig.objects.cube.material.metalness.step).name(guiConfig.objects.cube.material.metalness.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.material.metalness.value', value)
                })

            // Animation controls
            const animFolder = cubeFolder.addFolder(guiConfig.objects.cube.animation.folder)

            animFolder.add(animationRef.current, 'enabled')
                .name(guiConfig.objects.cube.animation.enabled.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.animation.enabled.value', value)
                })

            animFolder.add(animationRef.current, 'speed', guiConfig.objects.cube.animation.speed.min, guiConfig.objects.cube.animation.speed.max, guiConfig.objects.cube.animation.speed.step).name(guiConfig.objects.cube.animation.speed.name)
                .onChange(value => {
                    updateDebugConfig('objects.cube.animation.speed.value', value)
                })

            // Fermer les sous-dossiers si configuré ainsi
            if (guiConfig.gui.closeFolders) {
                posFolder.close();
                rotFolder.close();
                scaleFolder.close();
                materialFolder.close();
                animFolder.close();
            }
        }

        return () => {
            if (folderRef.current && gui) {
                // Find the objects folder
                const objectsFolder = gui.folders.find(folder => folder.name === guiConfig.objects.folder)
                if (objectsFolder) {
                    // Remove the cube folder from the objects folder
                    folderRef.current = null;

                    // If objects folder is now empty, remove it too
                    if (objectsFolder.folders.length === 0) {
                        gui.removeFolder(objectsFolder)
                    }
                }
                folderRef.current = null
            }
        }
    }, [debug, gui, updateDebugConfig, getDebugConfigValue])

    const shouldShowOutline = () => {
        // L'outline est affiché dans tous les cas SAUF si on survole le marqueur
        // Peu importe si on survole le cube
        if (isMarkerHovered) {
            return false;
        }
        return isWaitingForInteraction;
    };

    useEffect(() => {
        // Ajouté pour observer les changements d'état qui pourraient affecter l'outline
        console.log(`Outline condition: shouldShow=${shouldShowOutline()}, hovered=${hovered}, isMarkerHovered=${isMarkerHovered}`);
    }, [hovered, isMarkerHovered, isWaitingForInteraction]);

    // Animation
    useFrame((state, delta) => {
        // Animation code if needed
        if (dragging && cubeRef.current) {
            // Optionnel: ajouter une animation subtile pendant le drag
            cubeRef.current.rotation.y += delta * 2;
        }
    });

    // Gérer le clic sur le marqueur
    const handleMarkerInteraction = (eventData = {}) => {
        // Gérer le cas où eventData est undefined
        console.log("Received interaction data:", eventData);

        // Vérifier si c'est un événement de type conforme à ce qui est attendu
        // Comparer directement le type d'événement avec le type attendu
        const eventType = eventData.type || currentInteractionType || 'click';

        // Déterminer le son à jouer
        let soundType = 'click';
        if (eventType.includes('drag')) {
            soundType = 'drag';
        } else if (eventType === 'longPress') {
            soundType = 'click'; // Utiliser click pour longPress sauf si son spécifique disponible
        }

        // Jouer un son approprié
        audioManager.playSound(soundType, {
            volume: 0.8,
            fade: eventType.includes('drag') || eventType === 'longPress',
            fadeTime: eventType.includes('drag') ? 800 : (eventType === 'longPress' ? 400 : 0)
        });

        // Vérification simple : le type reçu est-il exactement celui attendu?
        const isCorrectInteractionType = currentInteractionType === eventType;

        // Compléter l'interaction seulement si le type correspond exactement à ce qui est attendu
        if (interaction?.waitingForInteraction && isCorrectInteractionType) {
            interaction.completeInteraction();
            console.log(`Interaction complétée via ${eventType} sur le marqueur`);

            // Mettre à jour l'état
            setIsInteractionCompleted(true);

            // Émettre un événement
            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                id: 'enhanced-cube-marker',
                type: currentInteractionType
            });
        } else if (interaction?.waitingForInteraction) {
            console.log(`Type d'interaction incorrect: attendu ${currentInteractionType}, reçu ${eventType}`);
        }
    };
    useEffect(() => {
        if (interaction && interaction.currentStep) {
            setIsInteractionCompleted(false);
        }
    }, [interaction?.currentStep]);
    // Handlers pour le survol du marqueur avec arrêt complet de la propagation
    const handleMarkerPointerEnter = (e) => {
        console.log("[EnhancedCube] Marker hover enter - setting isMarkerHovered to true");
        // Arrêter la propagation de tous les types d'événements
        if (e) {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            if (e.nativeEvent) {
                e.nativeEvent.stopPropagation();
                e.nativeEvent.stopImmediatePropagation?.();
            }
        }
        // Mettre à jour UNIQUEMENT l'état du marqueur
        setIsMarkerHovered(true);

        // NE PAS modifier l'état du cube ici
        // Enlever toute modification de l'état "hovered"
    };

    const handleMarkerPointerLeave = (e) => {
        console.log("[EnhancedCube] Marker hover leave - setting isMarkerHovered to false");
        // Arrêter la propagation de tous les types d'événements
        if (e) {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            if (e.nativeEvent) {
                e.nativeEvent.stopPropagation();
                e.nativeEvent.stopImmediatePropagation?.();
            }
        }
        // Mettre à jour UNIQUEMENT l'état du marqueur
        setIsMarkerHovered(false);

        // NE PAS modifier l'état du cube ici
    };

    // Déterminer la couleur du marqueur en fonction du type d'interaction
    const getMarkerColor = () => {
        switch (currentInteractionType) {
            case INTERACTION_TYPES.CLICK:
                return "#4488ff";  // Bleu pour clic
            case INTERACTION_TYPES.LONG_PRESS:
                return "#ff44aa";  // Rose pour appui long
            case INTERACTION_TYPES.DRAG_LEFT:
                return "#44ffaa";  // Turquoise pour drag gauche
            case INTERACTION_TYPES.DRAG_RIGHT:
                return "#ffaa44";  // Orange pour drag droite
            case INTERACTION_TYPES.DRAG_UP:
                return "#33eeff";  // Cyan pour drag haut
            case INTERACTION_TYPES.DRAG_DOWN:
                return "#ff7744";  // Corail pour drag bas
            default:
                return "#44ff44";  // Vert par défaut
        }
    };

    return (
        <ModelMarker
            id="enhanced-cube-marker"
            markerType={currentInteractionType}
            markerColor={getMarkerColor()}
            markerText={getMarkerText()}
            onInteract={handleMarkerInteraction}
            positionOptions={{
                offset: 0.8,
                preferredAxis: 'z'
            }}
            alwaysVisible={isWaitingForInteraction && !isInteractionCompleted}
            onPointerEnter={handleMarkerPointerEnter}
            onPointerLeave={handleMarkerPointerLeave}
        >
            <mesh
                ref={cubeRef}
                position={[-2, 0, 0]}
                scale={[1, 1, 1]}
                onPointerOver={(e) => {
                    // Ne mettre à jour QUE l'état du cube
                    if (e && e.object && e.object === cubeRef.current) {
                        console.log("[EnhancedCube] Cube hover enter - setting hovered to true");
                        setHovered(true);
                    }
                }}
                onPointerOut={(e) => {
                    // Ne mettre à jour QUE l'état du cube
                    if (e && e.object && e.object === cubeRef.current) {
                        console.log("[EnhancedCube] Cube hover leave - setting hovered to false");
                        setHovered(false);
                    }
                }}
                castShadow
            >
                <boxGeometry args={[1, 1, 1]}/>
                <meshStandardMaterial
                    color={'#ff5533'}
                    metalness={0.2}
                    roughness={0.7}
                    emissive={new Color('#000000')}
                />
            </mesh>

            {/* Effet de contour - utiliser notre nouvelle fonction shouldShowOutline */}
            {active ? null : <OutlineEffect
                objectRef={cubeRef}
                active={shouldShowOutline()}
                color={effectSettings.color}
                thickness={effectSettings.thickness}
                intensity={effectSettings.intensity}
                pulseSpeed={effectSettings.pulseSpeed}
                ref={updateEffectRef}
            />}
        </ModelMarker>
    );
}