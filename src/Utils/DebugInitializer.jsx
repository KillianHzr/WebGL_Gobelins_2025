import {useEffect, useRef, useCallback} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import * as THREE from 'three';
import {getProject} from '@theatre/core';
import guiConfig from '../Config/guiConfig';
import {EventBus} from './EventEmitter';
import guiFolderConfig from "../Config/guiFolderConfig.js";
import sceneObjectManager from '../Config/SceneObjectManager';
import textureManager from "../Config/TextureManager.js";

// Configuration des chapitres
const CHAPTERS = [
    {id: 'firstStop', name: "Introduction", distance: 0.5, completed: false},
    {id: 'secondStop', name: "Forêt mystérieuse", distance: 2.0, completed: false},
    {id: 'thirdStop', name: "Découverte", distance: 1.5, completed: false},
    {id: 'fourthStop', name: "Créatures", distance: 1.0, completed: false},
    {id: 'fifthStop', name: "Exploration", distance: 0.8, completed: false},
    {id: 'sixthStop', name: "Conclusion", distance: 1.2, completed: false}
];

// Profil par défaut
const DEFAULT_PROFILE = 'developer';

/**
 * Component that initializes debug features based on URL hash
 * This component doesn't render anything but handles the side effects
 * related to debug mode initialization
 */
const DebugInitializer = () => {
    const {scene, camera, controls} = useThree();
    const {debug, setDebug, setGui, setDebugConfig} = useStore();
    const initializedRef = useRef(false);
    const foldersRef = useRef(new Map());
    const warningShownRef = useRef(new Set());

    // Fonction utilitaire pour mettre à jour la configuration de manière sécurisée
    const safeUpdateConfig = useCallback((path, value) => {
        const updateDebugConfig = useStore.getState().updateDebugConfig;
        if (typeof updateDebugConfig === 'function') {
            updateDebugConfig(path, value);
        } else {
            console.warn('updateDebugConfig not available in store');
        }
    }, []);

    // Fonction pour appliquer un profil à la configuration avant création des dossiers
    const initializeWithProfile = useCallback((profileName) => {
        const profile = guiFolderConfig.profiles[profileName];
        if (!profile) {
            console.warn(`Profil "${profileName}" non trouvé dans la configuration`);
            return false;
        }

        // Mettre à jour la configuration de visibilité avec le profil
        for (const [folderPath, isVisible] of Object.entries(profile)) {
            guiFolderConfig.foldersVisibility[folderPath] = isVisible;
        }

        return true;
    }, []);

    // Fonction pour définir la visibilité d'un dossier et ses dépendances
    const setFolderVisibility = useCallback((folderPath, isVisible) => {
        // Récupérer le dossier depuis la map de référence
        const folder = foldersRef.current.get(folderPath);

        if (folder && folder.domElement) {
            // Mettre à jour la visibilité du dossier
            folder.domElement.style.display = isVisible ? 'block' : 'none';

            // Mettre à jour la configuration
            guiFolderConfig.foldersVisibility[folderPath] = isVisible;

            // Si le dossier est caché et qu'il a des sous-dossiers, les cacher aussi
            if (!isVisible && folder.folders && guiFolderConfig.folderDependencies.enforceParentDependency) {
                folder.folders.forEach(subFolder => {
                    if (subFolder) {
                        const subFolderName = subFolder.title || subFolder.name;
                        if (subFolderName) {
                            const subFolderPath = `${folderPath}/${subFolderName}`;
                            setFolderVisibility(subFolderPath, false);
                        }
                    }
                });
            }

            // Gérer les dépendances spécifiques
            if (!isVisible && guiFolderConfig.folderDependencies.specific &&
                guiFolderConfig.folderDependencies.specific[folderPath]) {
                guiFolderConfig.folderDependencies.specific[folderPath].forEach(depPath => {
                    setFolderVisibility(depPath, false);
                });
            }
        } else if (!warningShownRef.current.has(folderPath)) {
            warningShownRef.current.add(folderPath);
        }
    }, []);

    // Fonction pour appliquer un profil complet
    const applyProfile = useCallback((profileName) => {
        const profile = guiFolderConfig.profiles[profileName];
        if (!profile) {
            console.warn(`Profil "${profileName}" non trouvé dans la configuration`);
            return false;
        }

        // Récupérer tous les chemins de dossier de premier niveau
        const rootFolderPaths = Array.from(foldersRef.current.keys())
            .filter(path => !path.includes('/'));

        // D'abord, appliquer les paramètres définis dans le profil
        for (const [folderPath, isVisible] of Object.entries(profile)) {
            setFolderVisibility(folderPath, isVisible);
        }

        // Ensuite, pour tous les dossiers non mentionnés dans le profil, utiliser la valeur par défaut (true)
        rootFolderPaths.forEach(path => {
            if (profile[path] === undefined) {
                // Si non spécifié dans le profil, le dossier est visible par défaut
                setFolderVisibility(path, true);
            }
        });

        return true;
    }, [setFolderVisibility]);

    // Fonction pour basculer le mode de caméra
    const toggleCameraMode = useCallback((mode) => {
        try {
            // Obtenir l'état actuel
            const store = useStore.getState();
            const currentMode = store.cameraMode || 'default';

            // Ne rien faire si on essaie de passer au même mode
            if (mode === currentMode) {
                return;
            }

            // Afficher un message approprié
            if (mode === 'free') {
                console.log(`Passage au mode caméra libre`);
            } else if (currentMode === 'free') {
                console.log(`Désactivation du mode caméra libre, passage au mode ${mode}`);
            } else {
                console.log(`Changement de mode caméra: ${currentMode} -> ${mode}`);
            }

            // Utiliser la fonction dédiée du CameraSlice si disponible
            if (typeof store.setCameraMode === 'function') {
                store.setCameraMode(mode);
            } else {
                console.warn('setCameraMode n\'est pas disponible dans le store');

                // Fallback - mettre à jour directement
                useStore.getState().setCameraMode(mode);


                // Émettre manuellement l'événement
                EventBus.trigger('camera-mode-changed', { mode });
            }

            // Mettre à jour le paramètre dans la configuration de debug
            safeUpdateConfig('camera.mode.value', mode);

            // Gérer les actions supplémentaires nécessaires pour chaque mode
            const interaction = store.interaction;
            if (mode === 'free') {
                // Désactiver le défilement automatique en mode caméra libre
                if (interaction && typeof interaction.setAllowScroll === 'function') {
                    interaction.setAllowScroll(false);
                }
            } else if (currentMode === 'free') {
                // Réactiver le défilement automatique en quittant le mode caméra libre
                if (interaction && typeof interaction.setAllowScroll === 'function') {
                    interaction.setAllowScroll(true);
                }
            }
        } catch (error) {
            console.error('Erreur lors du changement de mode caméra:', error);
        }
    }, [safeUpdateConfig]);

    // Fonction pour appliquer le mode wireframe à tous les objets de la scène
    const applyWireframeToScene = useCallback((enabled) => {
        if (!scene) return;

        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                // Gérer les matériaux multiples
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        if (material) {
                            material.wireframe = enabled;
                            material.needsUpdate = true;
                        }
                    });
                } else {
                    object.material.wireframe = enabled;
                    object.material.needsUpdate = true;
                }
            }
        });
    }, [scene]);

    // Fonction pour mettre à jour la visibilité des objets dans la scène
    const updateObjectsVisibility = useCallback((settings) => {
        if (!scene) return;

        // Catégories d'objets à traiter
        const categories = [
            {
                test: obj => obj.name === 'Forest' ||
                    obj.name?.includes('instances') ||
                    obj.name?.includes('MapInstance'),
                property: 'showInstances'
            },
            {
                test: obj => obj.name === 'interactive-objects' ||
                    obj.parent?.name === 'interactive-objects',
                property: 'showInteractive'
            },
            {
                test: obj => obj.name === 'static-objects' ||
                    obj.parent?.name === 'static-objects',
                property: 'showStatic'
            }
        ];

        // Parcourir tous les objets de la scène
        scene.traverse((object) => {
            // Vérifier chaque catégorie
            for (const category of categories) {
                if (category.test(object)) {
                    const visibility = settings[category.property];
                    if (object.visible !== visibility) {
                        object.visible = visibility;
                    }
                    break; // Un objet ne peut appartenir qu'à une seule catégorie
                }
            }
        });

        // Émettre un événement pour informer d'autres composants
        EventBus.trigger('objects-visibility-changed', settings);
    }, [scene]);

    // Fonction d'animation avec easing pour les transitions entre chapitres
    const animateChapterTransition = useCallback((sheet, startPosition, targetPosition, chapter, index) => {
        const distance = targetPosition - startPosition;
        const duration = 1500; // ms, ajusté par la vitesse
        const startTime = performance.now();

        const animateTransition = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Fonction d'easing (ease-in-out)
            const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            // Calculer nouvelle position
            const newPosition = startPosition + distance * easeInOut(progress);
            sheet.sequence.position = newPosition;

            // Continuer l'animation ou terminer
            if (progress < 1) {
                requestAnimationFrame(animateTransition);
            } else {
                // Émettre un événement pour indiquer que la transition est terminée
                EventBus.trigger('chapter-transition-complete', {
                    chapterIndex: index,
                    chapterName: chapter.name
                });
            }
        };

        requestAnimationFrame(animateTransition);
    }, []);

    // Fonction pour sauter à un chapitre spécifique
    const jumpToChapter = useCallback((index) => {
        if (index < 0 || index >= CHAPTERS.length) return;

        const chapter = CHAPTERS[index];

        // Si window.jumpToChapter existe (défini dans ScrollControls.jsx),
        // l'utiliser comme méthode principale
        if (typeof window.jumpToChapter === 'function') {
            window.jumpToChapter(index);
            EventBus.trigger('gui-chapter-jump-initiated', {
                chapterIndex: index,
                chapterName: chapter.name
            });
            return;
        }

        // Utiliser Theatre.js si disponible
        const existingProject = window.__theatreProjects && window.__theatreProjects['WebGL_Gobelins'];
        if (existingProject) {
            const sheet = existingProject.sheet('Scene');
            if (sheet) {
                const startPosition = sheet.sequence.position;
                const targetPosition = chapter.position;

                // Lancer l'animation
                animateChapterTransition(sheet, startPosition, targetPosition, chapter, index);
            }
        }

        // Mettre à jour l'URL sans rechargement pour la navigation
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('chapter', chapter.id);
            window.history.replaceState({}, '', url);
        }
    }, [animateChapterTransition]);

    // Fonction pour téléporter la caméra à un emplacement spécifique
    const teleportCamera = useCallback((interactionPoint) => {
        if (!camera) {
            console.warn("Camera not available for teleportation");
            return false;
        }

        try {
            // Extraire la position du point d'interaction
            const posX = interactionPoint.position[0] || 0;
            const posY = interactionPoint.position[1] || 0;
            const posZ = interactionPoint.position[2] || 0;

            const interactionPos = new THREE.Vector3(posX, posY, posZ);
            const cameraOffset = new THREE.Vector3(0, 2, 5);
            const cameraPos = interactionPos.clone().add(cameraOffset);

            // Obtenir le mode de caméra actuel
            const cameraMode = useStore.getState().visualization?.cameraMode || 'free';

            // Si nous sommes en mode Theatre.js, mettre à jour l'état dans Theatre.js
            if (cameraMode === 'theatre' || cameraMode === 'Theatre.js') {
                // Téléporter la caméra
                camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
                camera.lookAt(interactionPos);
                camera.updateProjectionMatrix();

                // Mettre à jour Theatre.js si disponible
                if (window.__theatreStudio) {
                    try {
                        const project = getProject('WebGL_Gobelins');
                        if (project) {
                            const sheet = project.sheet('Scene');
                            if (sheet) {
                                const obj = sheet.object('Camera');
                                if (obj) {
                                    obj.set({
                                        position: {
                                            x: cameraPos.x, y: cameraPos.y, z: cameraPos.z
                                        }
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.warn("Failed to update Theatre.js camera:", error);
                    }
                }
            }

            // Mettre à jour la configuration
            safeUpdateConfig('camera.position.x.value', cameraPos.x);
            safeUpdateConfig('camera.position.y.value', cameraPos.y);
            safeUpdateConfig('camera.position.z.value', cameraPos.z);

            // Émettre l'événement pour les deux modes de caméra
            EventBus.trigger('camera-teleported', {
                position: cameraPos,
                target: interactionPos
            });

            return true;
        } catch (error) {
            console.error("Error teleporting camera:", error);
            return false;
        }
    }, [camera, safeUpdateConfig]);

    // Fonction pour créer une méthode addFolder améliorée avec tracking des dossiers
    const createEnhancedAddFolder = useCallback((gui, originalAddFolder) => {
        return function(name) {
            try {
                const folder = originalAddFolder.call(this, name);

                // Déterminer le chemin complet du dossier
                let folderPath = name;
                let parent = this;

                // Si ce n'est pas le GUI principal mais un sous-dossier
                if (parent !== gui) {
                    // Trouver le chemin du parent
                    for (const [path, storedFolder] of foldersRef.current.entries()) {
                        if (storedFolder === parent) {
                            folderPath = `${path}/${name}`;
                            break;
                        }
                    }
                }

                // Stocker la référence au dossier avec son chemin complet
                foldersRef.current.set(folderPath, folder);

                // Appliquer la visibilité initiale selon la configuration
                const isVisible = guiFolderConfig.foldersVisibility[folderPath] !== false;
                if (!isVisible && folder.domElement) {
                    folder.domElement.style.display = 'none';
                }

                // Remplacer également la méthode addFolder pour ce nouveau dossier
                const childOriginalAddFolder = folder.addFolder;
                folder.addFolder = createEnhancedAddFolder(gui, childOriginalAddFolder);

                return folder;
            } catch (error) {
                console.error(`Error creating folder '${name}':`, error);
                // Retourner un objet factice qui ne provoquera pas d'erreur
                return {
                    add: () => ({ onChange: () => {} }),
                    addColor: () => ({ onChange: () => {} }),
                    addFolder: () => ({ add: () => ({ onChange: () => {} }) }),
                    folders: [],
                    domElement: null
                };
            }
        };
    }, []);

    // Setup des contrôles GUI
    const setupVisualizationControls = useCallback((gui) => {
        const visualizationFolder = gui.addFolder('Visualisation');
        const getDebugConfigValue = useStore.getState().getDebugConfigValue;

        // Paramètres de visualisation avec valeurs par défaut
        const visualizationSettings = {
            wireframe: guiConfig.visualization.wireframe.default,
            showInstances: guiConfig.visualization.showInstances.default,
            showInteractive: guiConfig.visualization.showInteractive.default,
            showStatic: guiConfig.visualization.showStatic.default,
            cameraMode: 'default'
        };

        // Obtenir les valeurs sauvegardées si disponibles
        if (typeof getDebugConfigValue === 'function') {
            visualizationSettings.wireframe = getDebugConfigValue('visualization.wireframe.value',
                guiConfig.visualization.wireframe.default);
            visualizationSettings.showInstances = getDebugConfigValue('visualization.showInstances.value',
                guiConfig.visualization.showInstances.default);
            visualizationSettings.showInteractive = getDebugConfigValue('visualization.showInteractive.value',
                guiConfig.visualization.showInteractive.default);
            visualizationSettings.showStatic = getDebugConfigValue('visualization.showStatic.value',
                guiConfig.visualization.showStatic.default);
            visualizationSettings.cameraMode = getDebugConfigValue('camera.mode.value', 'default');
        }

        // Récupérer le mode de caméra actuel du store
        const store = useStore.getState();
        if (store.cameraMode) {
            visualizationSettings.cameraMode = store.cameraMode;
        }

        // Ajouter les contrôles
        visualizationFolder.add(visualizationSettings, 'wireframe')
            .name(guiConfig.visualization.wireframe.name)
            .onChange(value => {
                applyWireframeToScene(value);
                safeUpdateConfig('visualization.wireframe.value', value);
            });

        visualizationFolder.add(visualizationSettings, 'showInstances')
            .name(guiConfig.visualization.showInstances.name)
            .onChange(value => {
                updateObjectsVisibility(visualizationSettings);
                safeUpdateConfig('visualization.showInstances.value', value);
            });

        visualizationFolder.add(visualizationSettings, 'showInteractive')
            .name(guiConfig.visualization.showInteractive.name)
            .onChange(value => {
                updateObjectsVisibility(visualizationSettings);
                safeUpdateConfig('visualization.showInteractive.value', value);
            });

        visualizationFolder.add(visualizationSettings, 'showStatic')
            .name(guiConfig.visualization.showStatic.name)
            .onChange(value => {
                updateObjectsVisibility(visualizationSettings);
                safeUpdateConfig('visualization.showStatic.value', value);
            });

        // Contrôle du mode caméra avec options améliorées
        const cameraModeOptions = {
            default: 'Caméra par défaut',
            free: 'Caméra libre (ZQSD)',
            theatre: 'Theatre.js'
        };

        visualizationFolder.add(visualizationSettings, 'cameraMode', cameraModeOptions)
            .name('Mode Caméra')
            .onChange(toggleCameraMode);

        if (guiConfig.gui.closeFolders) {
            visualizationFolder.close();
        }

        return visualizationSettings;
    }, [
        applyWireframeToScene,
        updateObjectsVisibility,
        toggleCameraMode,
        safeUpdateConfig
    ]);

    // Setup des contrôles de fin
    const setupEndingControls = useCallback((gui) => {
        const endingFolder = gui.addFolder('Ending');

        // Create ending landing control functions
        const endingControls = {
            showEndingLanding: useStore.getState().endingLandingVisible || false,
            triggerEnding: () => {
                const state = useStore.getState();
                if (state.triggerEnding) {
                    state.triggerEnding();
                } else {
                    // Fallback if triggerEnding not available
                    state.setEndingLandingVisible(true);
                }
                console.log('Full ending triggered');
            },
        };

        // Add button to trigger full ending
        endingFolder.add(endingControls, 'triggerEnding')
            .name('Trigger Full Ending');

        if (guiConfig.gui.closeFolders) {
            endingFolder.close();
        }
    }, []);

    // Setup des contrôles d'interface
    const setupInterfaceControls = useCallback((gui) => {
        const interfaceFolder = gui.addFolder('Interface');

        // Paramètres d'interface avec valeurs par défaut basées uniquement sur l'URL actuelle
        const interfaceSettings = {
            skipIntro: window.location.hash === '#debug' // Cochée si exactement #debug, décochée sinon
        };

        // Créer le contrôle pour activer/désactiver l'affichage de l'intro
        interfaceFolder.add(interfaceSettings, 'skipIntro')
            .name(guiConfig.interface.skipIntro.name)
            .onChange(value => {
                // Mettre à jour uniquement le hash de l'URL
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);

                    // Si skipIntro est activé, définir le hash à #debug exactement
                    if (value) {
                        url.hash = '#debug';
                    } else {
                        // Si on veut voir l'intro, mettre #debugWithIntro
                        url.hash = '#debugWithIntro';
                    }

                    window.history.replaceState({}, '', url);

                    // Informer l'utilisateur qu'un rechargement est nécessaire pour appliquer le changement
                    console.log(`Intro mode updated: ${value ? 'skipping' : 'showing'} intro. Reload page to apply changes.`);
                    // Option: ajouter une notification visuelle indiquant qu'un rechargement est nécessaire
                }
            });

        if (guiConfig.gui.closeFolders) {
            interfaceFolder.close();
        }

        return interfaceSettings;
    }, []);

    // Setup des points d'interaction
    const setupInteractionPoints = useCallback((gui) => {
        const interactionPointsFolder = gui.addFolder('Points d\'interaction');

        try {
            // Récupérer les emplacements d'interaction depuis sceneObjectManager
            let interactivePlacements = [];
            try {
                if (sceneObjectManager && typeof sceneObjectManager.getInteractivePlacements === 'function') {
                    interactivePlacements = sceneObjectManager.getInteractivePlacements();
                }
            } catch (error) {
                console.error("Error getting interactive placements:", error);
            }

            // Créer un objet pour stocker les fonctions de téléportation
            const teleportFunctions = {};

            // Ajouter des boutons pour chaque point d'interaction
            interactivePlacements.forEach((placement, index) => {
                const pointName = placement.markerText ||
                    placement.requiredStep ||
                    placement.markerId ||
                    `${placement.objectKey}_${index}`;

                const functionName = `teleportTo_${index}`;

                teleportFunctions[functionName] = () => {
                    teleportCamera(placement);
                };

                interactionPointsFolder.add(teleportFunctions, functionName)
                    .name(`TP: ${pointName}`);
            });

            // Contrôles pour le défilement automatique
            teleportFunctions.disableAutoMove = () => {
                const state = useStore.getState();
                if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                    state.interaction.setAllowScroll(false);
                }
            };

            teleportFunctions.enableAutoMove = () => {
                const state = useStore.getState();
                if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                    state.interaction.setAllowScroll(true);
                }
            };

            interactionPointsFolder.add(teleportFunctions, 'disableAutoMove')
                .name("Désactiver AutoMove");

            interactionPointsFolder.add(teleportFunctions, 'enableAutoMove')
                .name("Activer AutoMove");

        } catch (error) {
            console.error("Error setting up interaction points:", error);
            // Ajouter un message d'erreur dans le dossier
            const errorObj = {message: "Erreur: sceneObjectManager non disponible"};
            interactionPointsFolder.add(errorObj, 'message').name("ERREUR").disable();
        }

        if (guiConfig.gui.closeFolders) {
            interactionPointsFolder.close();
        }
    }, [teleportCamera]);

    // Setup des contrôles de chapitres
    const setupChaptersControls = useCallback((gui) => {
        const chaptersFolder = gui.addFolder('Chapitres');

        // Objet pour stocker les fonctions et paramètres
        const chapterSettings = {
            currentChapter: 0,
            autoProgress: true,
            // Fonctions pour les boutons
            jumpToIntro: () => jumpToChapter(0),
            jumpToForest: () => jumpToChapter(1),
            jumpToDiscovery: () => jumpToChapter(2),
            jumpToCreatures: () => jumpToChapter(3),
            jumpToConclusion: () => jumpToChapter(4),
            resetScrollVelocity: () => {
                EventBus.trigger('reset-scroll-velocity');
            }
        };

        // Ajouter les contrôles
        chaptersFolder.add(chapterSettings, 'currentChapter', {
            "Introduction": 0,
            "Forêt mystérieuse": 1,
            "Découverte": 2,
            "Créatures": 3,
            "Conclusion": 4
        }).name('Chapitre actuel')
            .onChange(jumpToChapter);

        chaptersFolder.add(chapterSettings, 'autoProgress')
            .name('Progression auto')
            .onChange((value) => {
                const state = useStore.getState();
                if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                    state.interaction.setAllowScroll(value);
                }
            });

        // Section navigation directe
        const navigationSection = chaptersFolder.addFolder('Navigation directe');
        navigationSection.add(chapterSettings, 'jumpToIntro').name('→ Introduction');
        navigationSection.add(chapterSettings, 'jumpToForest').name('→ Forêt mystérieuse');
        navigationSection.add(chapterSettings, 'jumpToDiscovery').name('→ Découverte');
        navigationSection.add(chapterSettings, 'jumpToCreatures').name('→ Créatures');
        navigationSection.add(chapterSettings, 'jumpToConclusion').name('→ Conclusion');

        // Utilitaires
        const utilsSection = chaptersFolder.addFolder('Utilitaires');
        utilsSection.add(chapterSettings, 'resetScrollVelocity').name('Arrêter défilement');

        if (guiConfig.gui.closeFolders) {
            chaptersFolder.close();
            navigationSection.close();
            utilsSection.close();
        }
    }, [jumpToChapter]);
// Add this function to DebugInitializer.jsx
// Inside the DebugInitializer component, add this new setup function

// Setup terrain path controls
// Add this function to DebugInitializer.jsx
// Inside the DebugInitializer component, add this new setup function

// Setup terrain path controls
// Add this function to DebugInitializer.jsx
// Inside the DebugInitializer component, add this new setup function

// Setup terrain path controls
    const setupTerrainPathControls = useCallback((gui) => {
        const terrainFolder = gui.addFolder('Terrain Path');

        // Get any existing config values or use defaults
        const getDebugConfigValue = useStore.getState().getDebugConfigValue;

        // Function to find ground/terrain object in the scene
        const findGroundObject = () => {
            // Enhanced ground detection with detailed logging
            console.log("Starting thorough ground object search...");

            // First try with sceneObjectManager if available
            if (window.sceneObjectManager && typeof window.sceneObjectManager.getGroundObject === 'function') {
                const ground = window.sceneObjectManager.getGroundObject();
                if (ground) {
                    console.log("Found ground via sceneObjectManager:", ground.name);
                    return ground;
                }
            }

            // Get the current scene
            const currentScene = scene;
            if (!currentScene) {
                console.error("No scene available for ground search");
                return null;
            }

            // Arrays of potential names and patterns
            const groundNames = [
                'Ground', 'ground', 'terrain', 'Terrain',
                'floor', 'Floor', 'landscape', 'Landscape',
                'Map', 'map', 'plane', 'Plane', 'land', 'Land'
            ];

            const groundParentNames = [
                'environment', 'Environment', 'static-objects', 'StaticObjects',
                'world', 'World', 'scene', 'Scene', 'level', 'Level'
            ];

            // Collect all candidate objects
            const candidates = [];
            let largestObject = null;
            let maxVertices = 0;
            let flatObject = null;
            let minHeight = Infinity;

            // Log scene hierarchy to help debugging
            console.log("Scene hierarchy:");
            const logHierarchy = (node, depth = 0) => {
                const indent = "  ".repeat(depth);
                console.log(`${indent}${node.name || "unnamed"} (type: ${node.type}, children: ${node.children ? node.children.length : 0})`);

                if (node.children) {
                    node.children.forEach(child => logHierarchy(child, depth + 1));
                }
            };
            logHierarchy(currentScene);

            // First pass: collect all mesh objects
            const allMeshes = [];
            currentScene.traverse((node) => {
                if (node.isMesh && node.geometry) {
                    allMeshes.push(node);
                }
            });
            console.log(`Found ${allMeshes.length} mesh objects in the scene`);

            // Second pass: analyze meshes and find candidates
            allMeshes.forEach((node) => {
                // Track metadata for this object
                const metadata = {
                    name: node.name,
                    vertexCount: node.geometry.attributes.position?.count || 0,
                    isFlat: false,
                    boundingBox: null,
                    score: 0 // We'll calculate a "ground likelihood" score
                };

                // Calculate bounding box if not already computed
                if (!node.geometry.boundingBox) {
                    node.geometry.computeBoundingBox();
                }
                metadata.boundingBox = node.geometry.boundingBox;

                // Check if object is relatively flat (small Y dimension compared to X/Z)
                if (metadata.boundingBox) {
                    const boxSizeX = metadata.boundingBox.max.x - metadata.boundingBox.min.x;
                    const boxSizeY = metadata.boundingBox.max.y - metadata.boundingBox.min.y;
                    const boxSizeZ = metadata.boundingBox.max.z - metadata.boundingBox.min.z;

                    metadata.isFlat = (boxSizeY < boxSizeX * 0.1) && (boxSizeY < boxSizeZ * 0.1);

                    // Check if this might be the flattest object
                    const height = boxSizeY;
                    if (metadata.isFlat && height < minHeight && boxSizeX > 10 && boxSizeZ > 10) {
                        minHeight = height;
                        flatObject = node;
                    }
                }

                // Score based on name match
                if (groundNames.some(name => node.name === name || node.name.includes(name))) {
                    metadata.score += 10;
                }

                // Score based on parent name match
                if (node.parent && groundParentNames.some(name =>
                    node.parent.name === name || node.parent.name.includes(name))) {
                    metadata.score += 5;
                }

                // Score based on size (larger objects more likely to be ground)
                if (metadata.vertexCount > 1000) {
                    metadata.score += Math.min(5, Math.floor(metadata.vertexCount / 1000));
                }

                // Score based on flatness
                if (metadata.isFlat) {
                    metadata.score += 5;
                }

                // Score based on position (grounds tend to be at the bottom of the scene)
                if (metadata.boundingBox && metadata.boundingBox.min.y < 1) {
                    metadata.score += 3;
                }

                // Check if this has vertex colors already (good indicator of ground with paths)
                if (node.geometry.attributes.color) {
                    metadata.score += 8;
                    metadata.hasVertexColors = true;
                }

                // Track the object with the most vertices
                if (metadata.vertexCount > maxVertices) {
                    maxVertices = metadata.vertexCount;
                    largestObject = node;
                }

                // Add to candidates if it has a minimum score
                if (metadata.score > 2 || metadata.vertexCount > 500) {
                    candidates.push({
                        node: node,
                        metadata: metadata
                    });
                }
            });

            // Sort candidates by score
            candidates.sort((a, b) => b.metadata.score - a.metadata.score);

            // Log all candidates for debugging
            console.log("Ground candidates:", candidates.map(c => ({
                name: c.metadata.name,
                score: c.metadata.score,
                vertices: c.metadata.vertexCount,
                isFlat: c.metadata.isFlat,
                hasVertexColors: c.metadata.hasVertexColors
            })));

            // Try to find the most likely ground object
            let groundObject = null;

            // 1. First check high-scoring candidates
            if (candidates.length > 0 && candidates[0].metadata.score >= 15) {
                groundObject = candidates[0].node;
                console.log("Selected high-scoring candidate as ground:", groundObject.name);
            }
            // 2. Try the flattest large object
            else if (flatObject) {
                groundObject = flatObject;
                console.log("Selected flattest large object as ground:", groundObject.name);
            }
            // 3. Try the largest object by vertex count
            else if (largestObject && largestObject.geometry.attributes.position.count > 1000) {
                groundObject = largestObject;
                console.log("Selected largest object as ground:", groundObject.name);
            }
            // 4. Just use the first candidate if available
            else if (candidates.length > 0) {
                groundObject = candidates[0].node;
                console.log("Selected first candidate as ground:", groundObject.name);
            }

            // Add ground object selection UI if needed
            if (!groundObject && candidates.length > 0) {
                console.log("No clear ground object found but have candidates. Adding selection UI might be helpful.");
                // Could implement a UI for manual selection here
            }

            // Store the selected ground for future reference
            if (groundObject) {
                if (typeof window !== 'undefined') {
                    window.__debugGroundObject = groundObject;
                    console.log("Ground object stored in window.__debugGroundObject for reference");
                }
            } else {
                console.error("No suitable ground object found after thorough search");
            }

            return groundObject;
        };

        // Create settings object with default values
        const pathSettings = {
            // Position offset values
            offsetX: getDebugConfigValue('terrain.pathMask.offsetX.value', 0),
            offsetZ: getDebugConfigValue('terrain.pathMask.offsetZ.value', 0),

            // Scale values
            scaleX: getDebugConfigValue('terrain.pathMask.scaleX.value', 0.1),
            scaleZ: getDebugConfigValue('terrain.pathMask.scaleZ.value', 0.1),

            // Rotation value (in radians)
            rotation: getDebugConfigValue('terrain.pathMask.rotation.value', 0),

            // Path mask image
            maskPath: getDebugConfigValue('terrain.pathMask.imagePath.value', '/textures/ground/mask_road.png'),

            // Object selection
            selectedObjectIndex: 0,

            // Manual selection function
            selectGroundObject: () => {
                console.log("Manually selecting ground object");

                // Get current scene
                const currentScene = scene;
                if (!currentScene) {
                    console.error("No scene available for selection");
                    return;
                }

                // Collect all meshes in the scene
                const meshes = [];
                currentScene.traverse((node) => {
                    if (node.isMesh && node.geometry) {
                        meshes.push(node);
                    }
                });

                // Create a selection dialog in the corner of the screen
                const dialog = document.createElement('div');
                dialog.style.position = 'fixed';
                dialog.style.top = '20px';
                dialog.style.right = '20px';
                dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                dialog.style.color = 'white';
                dialog.style.padding = '15px';
                dialog.style.borderRadius = '5px';
                dialog.style.zIndex = '9999';
                dialog.style.maxHeight = '80vh';
                dialog.style.overflowY = 'auto';
                dialog.style.maxWidth = '400px';
                dialog.style.fontFamily = 'monospace';

                // Create header
                const header = document.createElement('h3');
                header.textContent = 'Select Ground Object';
                header.style.margin = '0 0 10px 0';
                dialog.appendChild(header);

                // Create list of objects
                const list = document.createElement('ul');
                list.style.listStyle = 'none';
                list.style.padding = '0';
                list.style.margin = '0';

                meshes.forEach((mesh, index) => {
                    const item = document.createElement('li');
                    item.style.padding = '5px';
                    item.style.margin = '3px 0';
                    item.style.cursor = 'pointer';
                    item.style.borderRadius = '3px';
                    item.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';

                    // Get mesh details
                    const vertexCount = mesh.geometry.attributes.position?.count || 0;
                    const hasColor = !!mesh.geometry.attributes.color;

                    item.textContent = `${index + 1}. ${mesh.name || 'unnamed'} (vertices: ${vertexCount}, color: ${hasColor ? 'yes' : 'no'})`;

                    item.addEventListener('mouseover', () => {
                        item.style.backgroundColor = 'rgba(100, 100, 255, 0.5)';
                    });

                    item.addEventListener('mouseout', () => {
                        item.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
                    });

                    item.addEventListener('click', () => {
                        console.log(`Selected object: ${mesh.name}`);
                        // Store the selected object
                        window.__debugGroundObject = mesh;

                        // Store the selected index
                        pathSettings.selectedObjectIndex = index;

                        // Remove the dialog
                        document.body.removeChild(dialog);

                        // Update the label
                        if (selectedObjectLabel) {
                            selectedObjectLabel.textContent = mesh.name || 'unnamed';
                        }
                    });

                    list.appendChild(item);
                });

                dialog.appendChild(list);

                // Add close button
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Close';
                closeButton.style.marginTop = '10px';
                closeButton.style.padding = '5px 10px';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(dialog);
                });
                dialog.appendChild(closeButton);

                document.body.appendChild(dialog);
            },

            // Function to apply changes
            applyChanges: () => {
                console.log("Applying path mask changes");

                // Log debug information for troubleshooting
                console.log("Debug context:", {
                    hasScene: !!scene,
                    hasWindow: typeof window !== 'undefined',
                    hasWindowScene: typeof window !== 'undefined' && !!window.scene,
                    hasTextureManager: typeof window !== 'undefined' && !!window.textureManager,
                    hasAssetManager: typeof window !== 'undefined' && !!window.assetManager,
                    sceneObjectManager: typeof window !== 'undefined' ? window.sceneObjectManager : null
                });

                // Try to get manually selected ground object first
                let groundObject = window.__debugGroundObject || null;

                // If no manually selected object, try to find one
                if (!groundObject) {
                    groundObject = findGroundObject();
                }

                if (!groundObject) {
                    console.warn("Ground object not found. Please use the 'Select Ground' button to manually choose the ground object.");
                    return;
                }

                console.log("Using ground object:", groundObject.name || "unnamed", groundObject);

                // Get the TextureManager instance
                let textureMgr = null;

                // Try different ways to access TextureManager
                if (window.textureManager) {
                    textureMgr = window.textureManager;
                } else if (window.assetManager?.textureManager) {
                    textureMgr = window.assetManager.textureManager;
                } else if (textureManager) {
                    textureMgr = textureManager;
                } else {
                    // If TextureManager isn't available as a global, we can try to access it
                    // through other means or create a new instance
                    console.warn("TextureManager not found in expected locations. Trying alternative methods...");

                    // Try to import it dynamically if needed
                    try {
                        if (typeof TextureManager !== 'undefined') {
                            textureMgr = new TextureManager();
                            console.log("Created new TextureManager instance");
                        }
                    } catch (err) {
                        console.error("Failed to create TextureManager:", err);
                    }
                }

                if (!textureMgr) {
                    console.error("TextureManager not found. Cannot apply path mask.");
                    return;
                }

                // Add the transformed mask method if it doesn't exist
                if (typeof textureMgr.applyGroundTexturesWithMaskTransformed !== 'function') {
                    console.warn("applyGroundTexturesWithMaskTransformed method not found. Adding it dynamically.");

                    // Add the method to the TextureManager instance
                    textureMgr.applyGroundTexturesWithMaskTransformed = async function(groundObject, maskImagePath, transformOptions = {}) {
                        console.log("Using dynamically added method to apply ground textures with mask");

                        if (!groundObject) {
                            console.error("Ground object missing");
                            return false;
                        }

                        // Check if we can use the existing mask method
                        if (typeof this.applyGroundTexturesWithMask === 'function') {
                            console.log("Using existing applyGroundTexturesWithMask method");
                            return this.applyGroundTexturesWithMask(groundObject, maskImagePath);
                        }

                        // Check if we can apply vertex colors directly
                        if (typeof this.applyMaskImageToGround === 'function') {
                            console.log("Using existing applyMaskImageToGround method");
                            return this.applyMaskImageToGround(groundObject, maskImagePath);
                        }

                        // Fallback: manual implementation to apply vertex colors
                        console.log("Using fallback implementation for mask application");

                        // Apply vertex colors via direct manipulation
                        return new Promise((resolve, reject) => {
                            // Create an image element to load the mask
                            const maskImage = new Image();
                            maskImage.crossOrigin = "Anonymous";

                            maskImage.onload = () => {
                                console.log(`Mask loaded: ${maskImage.width}x${maskImage.height} pixels`);

                                // Create canvas for pixel manipulation
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = maskImage.width;
                                canvas.height = maskImage.height;

                                // Draw the image
                                ctx.drawImage(maskImage, 0, 0);

                                // Get pixel data
                                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                const pixels = imageData.data;

                                // Apply to all mesh objects in the ground
                                let appliedToAny = false;

                                groundObject.traverse((node) => {
                                    if (node.isMesh && node.geometry) {
                                        // Make sure we have vertex colors attribute
                                        if (!node.geometry.attributes.color) {
                                            const positions = node.geometry.attributes.position;
                                            const colors = new Float32Array(positions.count * 3);

                                            // Initialize with default color (all positions as grass)
                                            for (let i = 0; i < positions.count; i++) {
                                                colors[i * 3] = 0.0;     // R - Road (0 = grass)
                                                colors[i * 3 + 1] = 0.5;  // G
                                                colors[i * 3 + 2] = 0.0;  // B
                                            }

                                            node.geometry.setAttribute('color',
                                                new THREE.BufferAttribute(colors, 3));
                                        }

                                        // Get bounding box for terrain size
                                        if (!node.geometry.boundingBox) {
                                            node.geometry.computeBoundingBox();
                                        }

                                        // Apply mask based on transform options
                                        const options = transformOptions || {};
                                        const offsetX = options.offsetX || 0;
                                        const offsetZ = options.offsetZ || 0;
                                        const scaleX = options.scaleX || 1.0;
                                        const scaleZ = options.scaleZ || 1.0;
                                        const rotation = options.rotation || 0;

                                        // Get dimensions
                                        const bb = node.geometry.boundingBox;
                                        const terrainWidth = bb.max.x - bb.min.x;
                                        const terrainDepth = bb.max.z - bb.min.z;

                                        // Get node's world matrix
                                        node.updateMatrixWorld(true);
                                        const worldMatrix = node.matrixWorld.clone();

                                        // Precalculate rotation
                                        const sinRot = Math.sin(rotation);
                                        const cosRot = Math.cos(rotation);

                                        // Apply to each vertex
                                        const positions = node.geometry.attributes.position;
                                        const colors = node.geometry.attributes.color;

                                        for (let i = 0; i < positions.count; i++) {
                                            // Get vertex position in local space
                                            const vx = positions.getX(i);
                                            const vy = positions.getY(i);
                                            const vz = positions.getZ(i);

                                            // Convert to world position
                                            const vertex = new THREE.Vector3(vx, vy, vz);
                                            vertex.applyMatrix4(worldMatrix);

                                            // Apply offset
                                            const tx = vertex.x - bb.min.x - offsetX;
                                            const tz = vertex.z - bb.min.z - offsetZ;

                                            // Apply rotation
                                            const centerX = terrainWidth / 2;
                                            const centerZ = terrainDepth / 2;

                                            const relX = tx - centerX;
                                            const relZ = tz - centerZ;

                                            const rotX = relX * cosRot - relZ * sinRot + centerX;
                                            const rotZ = relX * sinRot + relZ * cosRot + centerZ;

                                            // Convert to UV with scale
                                            const u = (rotX / terrainWidth) / scaleX + (0.5 - 0.5 / scaleX);
                                            const v = (rotZ / terrainDepth) / scaleZ + (0.5 - 0.5 / scaleZ);

                                            // Convert to pixel coords
                                            const pixelX = Math.floor(u * (canvas.width - 1));
                                            const pixelY = Math.floor((1 - v) * (canvas.height - 1));

                                            // Check if within bounds
                                            if (pixelX >= 0 && pixelX < canvas.width &&
                                                pixelY >= 0 && pixelY < canvas.height) {

                                                // Get pixel color
                                                const pixelIndex = (pixelY * canvas.width + pixelX) * 4;
                                                const r = pixels[pixelIndex] / 255;
                                                const g = pixels[pixelIndex + 1] / 255;
                                                const b = pixels[pixelIndex + 2] / 255;

                                                // Calculate brightness (white = path)
                                                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

                                                // Set vertex color (R channel)
                                                colors.setX(i, luminance);
                                            }
                                        }

                                        // Mark as updated
                                        colors.needsUpdate = true;
                                        appliedToAny = true;
                                    }
                                });

                                if (appliedToAny) {
                                    console.log("Successfully applied vertex colors with manual fallback method");
                                    resolve(true);
                                } else {
                                    console.warn("No suitable meshes found for vertex color application");
                                    reject(new Error("No suitable meshes found"));
                                }
                            };

                            maskImage.onerror = (error) => {
                                console.error(`Error loading mask image: ${maskImagePath}`, error);
                                reject(error);
                            };

                            maskImage.src = maskImagePath;
                        });
                    };
                }

                // Call the method with the current settings
                try {
                    textureMgr.applyGroundTexturesWithMaskTransformed(
                        groundObject,
                        pathSettings.maskPath,
                        {
                            offsetX: pathSettings.offsetX,
                            offsetZ: pathSettings.offsetZ,
                            scaleX: pathSettings.scaleX,
                            scaleZ: pathSettings.scaleZ,
                            rotation: pathSettings.rotation
                        }
                    ).catch(err => {
                        console.error("Error applying path mask:", err);
                    });
                } catch (err) {
                    console.error("Error when calling mask application method:", err);
                }
            },

            // Reset to default values
            resetValues: () => {
                pathSettings.offsetX = 0;
                pathSettings.offsetZ = 0;
                pathSettings.scaleX = 1.0;
                pathSettings.scaleZ = 1.0;
                pathSettings.rotation = 0;

                // Update the GUI controls
                for (const controller of Object.values(controllers)) {
                    controller.updateDisplay();
                }

                // Save to debug config
                safeUpdateConfig('terrain.pathMask.offsetX.value', pathSettings.offsetX);
                safeUpdateConfig('terrain.pathMask.offsetZ.value', pathSettings.offsetZ);
                safeUpdateConfig('terrain.pathMask.scaleX.value', pathSettings.scaleX);
                safeUpdateConfig('terrain.pathMask.scaleZ.value', pathSettings.scaleZ);
                safeUpdateConfig('terrain.pathMask.rotation.value', pathSettings.rotation);
            }
        };

        // Add controllers and keep references to update them when resetting
        const controllers = {};

        // Add a manual selection button for the ground object
        terrainFolder.add(pathSettings, 'selectGroundObject').name('Select Ground Object');

        // Add a label to show the currently selected object
        const selectedObjectLabel = document.createElement('div');
        selectedObjectLabel.style.marginTop = '5px';
        selectedObjectLabel.style.marginBottom = '10px';
        selectedObjectLabel.style.color = '#fff';
        selectedObjectLabel.style.fontWeight = 'bold';
        selectedObjectLabel.textContent = window.__debugGroundObject ?
            (window.__debugGroundObject.name || 'unnamed') : 'None selected';

        // Get the GUI element and add our custom label
        setTimeout(() => {
            const folderElement = terrainFolder.domElement;
            if (folderElement) {
                folderElement.insertBefore(selectedObjectLabel, folderElement.children[1]);
            }
        }, 100);

        // Add offset controls
        controllers.offsetX = terrainFolder.add(pathSettings, 'offsetX', -20, 20)
            .name('Offset X')
            .step(0.5)
            .onChange(value => {
                safeUpdateConfig('terrain.pathMask.offsetX.value', value);
            });

        controllers.offsetZ = terrainFolder.add(pathSettings, 'offsetZ', -20, 20)
            .name('Offset Z')
            .step(0.5)
            .onChange(value => {
                safeUpdateConfig('terrain.pathMask.offsetZ.value', value);
            });

        // Add scale controls
        controllers.scaleX = terrainFolder.add(pathSettings, 'scaleX', 0.1, 5)
            .name('Scale X')
            .step(0.1)
            .onChange(value => {
                safeUpdateConfig('terrain.pathMask.scaleX.value', value);
            });

        controllers.scaleZ = terrainFolder.add(pathSettings, 'scaleZ', 0.1, 5)
            .name('Scale Z')
            .step(0.1)
            .onChange(value => {
                safeUpdateConfig('terrain.pathMask.scaleZ.value', value);
            });

        // Add rotation control
        controllers.rotation = terrainFolder.add(pathSettings, 'rotation', -Math.PI, Math.PI)
            .name('Rotation')
            .step(0.05)
            .onChange(value => {
                safeUpdateConfig('terrain.pathMask.rotation.value', value);
            });

        // Add action buttons
        terrainFolder.add(pathSettings, 'applyChanges').name('Apply Changes');
        terrainFolder.add(pathSettings, 'resetValues').name('Reset Values');

        // Add a button to visualize the current ground
        pathSettings.visualizeGround = () => {
            const ground = window.__debugGroundObject;
            if (!ground) {
                console.warn("No ground object selected to visualize");
                return;
            }

            console.log("Highlighting ground object:", ground.name);

            // Store original materials
            const originalMaterials = new Map();

            ground.traverse(node => {
                if (node.isMesh) {
                    originalMaterials.set(node, node.material);

                    // Create a highlight material
                    const highlightMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff00ff,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.7
                    });

                    // Apply highlight material
                    node.material = highlightMaterial;
                }
            });

            // Restore after 2 seconds
            setTimeout(() => {
                originalMaterials.forEach((material, node) => {
                    node.material = material;
                });
                console.log("Restored original materials");
            }, 2000);
        };

        terrainFolder.add(pathSettings, 'visualizeGround').name('Highlight Ground');

        // Add direct apply button for currently selected ground
        pathSettings.applyToCurrent = () => {
            if (!window.__debugGroundObject) {
                console.warn("No ground object selected");
                return;
            }

            const groundObject = window.__debugGroundObject;

            // Create a simple manual implementation to apply vertex colors
            const applyVertexColors = (ground, maskPath, options) => {
                // Create an image element to load the mask
                const maskImage = new Image();
                maskImage.crossOrigin = "Anonymous";

                maskImage.onload = () => {
                    console.log(`Mask loaded: ${maskImage.width}x${maskImage.height} pixels`);

                    // Create canvas for pixel manipulation
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = maskImage.width;
                    canvas.height = maskImage.height;

                    // Draw the image
                    ctx.drawImage(maskImage, 0, 0);

                    // Get pixel data
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const pixels = imageData.data;

                    // Apply to all mesh objects in the ground
                    ground.traverse((node) => {
                        if (node.isMesh && node.geometry) {
                            // Make sure we have vertex colors attribute
                            if (!node.geometry.attributes.color) {
                                const positions = node.geometry.attributes.position;
                                const colors = new Float32Array(positions.count * 3);

                                // Initialize with default color (all positions as grass)
                                for (let i = 0; i < positions.count; i++) {
                                    colors[i * 3] = 0.0;     // R - Road (0 = grass)
                                    colors[i * 3 + 1] = 0.5;  // G
                                    colors[i * 3 + 2] = 0.0;  // B
                                }

                                node.geometry.setAttribute('color',
                                    new THREE.BufferAttribute(colors, 3));

                                // Enable vertex colors in the material
                                if (node.material) {
                                    // Store original material properties
                                    const originalColor = node.material.color ? node.material.color.clone() : null;
                                    const originalMap = node.material.map;

                                    // Create a material that supports vertex colors
                                    const newMaterial = new THREE.MeshStandardMaterial({
                                        vertexColors: true,
                                        map: originalMap,
                                        color: originalColor || 0xffffff
                                    });

                                    // Apply the new material
                                    node.material = newMaterial;
                                }
                            }

                            // Get bounding box for terrain size
                            if (!node.geometry.boundingBox) {
                                node.geometry.computeBoundingBox();
                            }

                            // Apply mask based on transform options
                            const offsetX = options.offsetX || 0;
                            const offsetZ = options.offsetZ || 0;
                            const scaleX = options.scaleX || 1.0;
                            const scaleZ = options.scaleZ || 1.0;
                            const rotation = options.rotation || 0;

                            // Get dimensions
                            const bb = node.geometry.boundingBox;
                            const terrainWidth = bb.max.x - bb.min.x;
                            const terrainDepth = bb.max.z - bb.min.z;

                            // Get node's world matrix
                            node.updateMatrixWorld(true);
                            const worldMatrix = node.matrixWorld.clone();

                            // Precalculate rotation
                            const sinRot = Math.sin(rotation);
                            const cosRot = Math.cos(rotation);

                            // Apply to each vertex
                            const positions = node.geometry.attributes.position;
                            const colors = node.geometry.attributes.color;

                            for (let i = 0; i < positions.count; i++) {
                                // Get vertex position in local space
                                const vx = positions.getX(i);
                                const vy = positions.getY(i);
                                const vz = positions.getZ(i);

                                // Convert to world position
                                const vertex = new THREE.Vector3(vx, vy, vz);
                                vertex.applyMatrix4(worldMatrix);

                                // Apply offset
                                const tx = vertex.x - bb.min.x - offsetX;
                                const tz = vertex.z - bb.min.z - offsetZ;

                                // Apply rotation around center
                                const centerX = terrainWidth / 2;
                                const centerZ = terrainDepth / 2;

                                const relX = tx - centerX;
                                const relZ = tz - centerZ;

                                const rotX = relX * cosRot - relZ * sinRot + centerX;
                                const rotZ = relX * sinRot + relZ * cosRot + centerZ;

                                // Convert to UV with scale
                                const u = (rotX / terrainWidth) / scaleX + (0.5 - 0.5 / scaleX);
                                const v = (rotZ / terrainDepth) / scaleZ + (0.5 - 0.5 / scaleZ);

                                // Convert to pixel coords
                                const pixelX = Math.floor(u * (canvas.width - 1));
                                const pixelY = Math.floor((1 - v) * (canvas.height - 1));

                                // Check if within bounds
                                if (pixelX >= 0 && pixelX < canvas.width &&
                                    pixelY >= 0 && pixelY < canvas.height) {

                                    // Get pixel color
                                    const pixelIndex = (pixelY * canvas.width + pixelX) * 4;
                                    const r = pixels[pixelIndex] / 255;
                                    const g = pixels[pixelIndex + 1] / 255;
                                    const b = pixels[pixelIndex + 2] / 255;

                                    // Calculate brightness (white = path)
                                    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

                                    // Set vertex color (R channel)
                                    colors.setX(i, luminance);
                                }
                            }

                            // Mark as updated
                            colors.needsUpdate = true;
                        }
                    });

                    console.log("Successfully applied vertex colors directly to selected ground");
                };

                maskImage.onerror = (error) => {
                    console.error(`Error loading mask image: ${maskPath}`, error);
                };

                // Start loading
                maskImage.src = maskPath;
            };

            // Apply using direct method
            applyVertexColors(groundObject, pathSettings.maskPath, {
                offsetX: pathSettings.offsetX,
                offsetZ: pathSettings.offsetZ,
                scaleX: pathSettings.scaleX,
                scaleZ: pathSettings.scaleZ,
                rotation: pathSettings.rotation
            });
        };

        terrainFolder.add(pathSettings, 'applyToCurrent')
            .name('Apply Directly to Selected')
            .title('Apply path mask directly to selected ground using internal vertex color method');

        // Add a function to clear ground outside the mask
        pathSettings.clearGroundOutsideMask = () => {
            if (!window.__debugGroundObject) {
                console.warn("No ground object selected");
                return;
            }

            const groundObject = window.__debugGroundObject;
            console.log("Clearing ground outside mask area for:", groundObject.name);

            // Create an image element to load the mask
            const maskImage = new Image();
            maskImage.crossOrigin = "Anonymous";

            maskImage.onload = () => {
                console.log(`Mask loaded: ${maskImage.width}x${maskImage.height} pixels`);

                // Create canvas for pixel manipulation
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = maskImage.width;
                canvas.height = maskImage.height;

                // Draw the image
                ctx.drawImage(maskImage, 0, 0);

                // Get pixel data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;

                // Get options for transformation
                const options = {
                    offsetX: pathSettings.offsetX,
                    offsetZ: pathSettings.offsetZ,
                    scaleX: pathSettings.scaleX,
                    scaleZ: pathSettings.scaleZ,
                    rotation: pathSettings.rotation
                };

                // Precalculate rotation
                const sinRot = Math.sin(options.rotation);
                const cosRot = Math.cos(options.rotation);

                // Apply to all mesh objects in the ground
                let modifiedCount = 0;

                groundObject.traverse((node) => {
                    if (node.isMesh && node.geometry && node.geometry.attributes.color) {
                        // Get bounding box for terrain size
                        if (!node.geometry.boundingBox) {
                            node.geometry.computeBoundingBox();
                        }

                        // Get dimensions
                        const bb = node.geometry.boundingBox;
                        const terrainWidth = bb.max.x - bb.min.x;
                        const terrainDepth = bb.max.z - bb.min.z;

                        // Get node's world matrix
                        node.updateMatrixWorld(true);
                        const worldMatrix = node.matrixWorld.clone();

                        // Apply to each vertex
                        const positions = node.geometry.attributes.position;
                        const colors = node.geometry.attributes.color;

                        // Track updates
                        let clearedVertices = 0;
                        let totalVertices = positions.count;

                        for (let i = 0; i < positions.count; i++) {
                            // Get vertex position in local space
                            const vx = positions.getX(i);
                            const vy = positions.getY(i);
                            const vz = positions.getZ(i);

                            // Convert to world position
                            const vertex = new THREE.Vector3(vx, vy, vz);
                            vertex.applyMatrix4(worldMatrix);

                            // Apply offset
                            const tx = vertex.x - bb.min.x - options.offsetX;
                            const tz = vertex.z - bb.min.z - options.offsetZ;

                            // Apply rotation around center
                            const centerX = terrainWidth / 2;
                            const centerZ = terrainDepth / 2;

                            const relX = tx - centerX;
                            const relZ = tz - centerZ;

                            const rotX = relX * cosRot - relZ * sinRot + centerX;
                            const rotZ = relX * sinRot + relZ * cosRot + centerZ;

                            // Convert to UV with scale
                            const u = (rotX / terrainWidth) / options.scaleX + (0.5 - 0.5 / options.scaleX);
                            const v = (rotZ / terrainDepth) / options.scaleZ + (0.5 - 0.5 / options.scaleZ);

                            // Convert to pixel coords
                            const pixelX = Math.floor(u * (canvas.width - 1));
                            const pixelY = Math.floor((1 - v) * (canvas.height - 1));

                            // Check if outside bounds or mask is transparent/black
                            const isOutside = pixelX < 0 || pixelX >= canvas.width ||
                                pixelY < 0 || pixelY >= canvas.height;

                            let isTransparentOrBlack = true;

                            if (!isOutside) {
                                // Get pixel color
                                const pixelIndex = (pixelY * canvas.width + pixelX) * 4;
                                const r = pixels[pixelIndex];
                                const g = pixels[pixelIndex + 1];
                                const b = pixels[pixelIndex + 2];
                                const a = pixels[pixelIndex + 3];

                                // Check if pixel is transparent or black (very low luminance)
                                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                isTransparentOrBlack = a < 128 || luminance < 0.05;
                            }

                            // If outside mask area or pixel is transparent/black, clear it to grass
                            if (isOutside || isTransparentOrBlack) {
                                // Get current color values
                                const r = colors.getX(i);

                                // Only update if it's not already cleared
                                if (r > 0.05) {
                                    // Set to grass (R=0)
                                    colors.setX(i, 0.0);
                                    clearedVertices++;
                                }
                            }
                        }

                        // Mark as updated
                        if (clearedVertices > 0) {
                            colors.needsUpdate = true;
                            console.log(`Cleared ${clearedVertices} of ${totalVertices} vertices (${(clearedVertices/totalVertices*100).toFixed(1)}%) in ${node.name || "unnamed mesh"}`);
                            modifiedCount++;
                        }
                    }
                });

                if (modifiedCount > 0) {
                    console.log(`Successfully cleared areas outside mask in ${modifiedCount} meshes`);
                } else {
                    console.log("No vertex colors were modified - either all vertices are already cleared or no vertex colors found");
                }
            };

            maskImage.onerror = (error) => {
                console.error(`Error loading mask image: ${pathSettings.maskPath}`, error);
            };

            // Start loading
            maskImage.src = pathSettings.maskPath;
        };

        // Add the clear button
        terrainFolder.add(pathSettings, 'clearGroundOutsideMask')
            .name('Clear Outside Mask')
            .title('Reset vertex colors outside the mask area to create clean paths');

        // Mask path input (could be enhanced with a file picker)
        controllers.maskPath = terrainFolder.add(pathSettings, 'maskPath')
            .name('Mask Image Path')
            .onChange(value => {
                safeUpdateConfig('terrain.pathMask.imagePath.value', value);
            });

        // Close the folder by default if configured
        if (guiConfig.gui.closeFolders) {
            terrainFolder.close();
        }

        return pathSettings;
    }, [safeUpdateConfig]);


    // Initialisation principale
    const initializeGui = useCallback(() => {
        if (!debug?.active || !debug?.showGui || initializedRef.current) return;

        try {
            initializedRef.current = true;

            // Apply the default profile BEFORE creating folders
            initializeWithProfile(DEFAULT_PROFILE);

            // Create the GUI
            const gui = new GUI({ width: guiConfig.gui.width || 300 });
            gui.title(guiConfig.gui.title || 'Debug Controls');

            // Close all folders by default if configured
            if (guiConfig.gui.closeFolders) {
                gui.open();
            }

            // Enhance the addFolder method
            gui.addFolder = createEnhancedAddFolder(gui, gui.addFolder);

            // Add the GUI Config folder
            const guiConfigFolder = gui.addFolder('GUI Config');

            // Add profile selector
            const profileOptions = {};
            if (guiFolderConfig.profiles) {
                Object.keys(guiFolderConfig.profiles).forEach(key => {
                    profileOptions[key] = key;
                });
            }

            const profileSettings = { profile: DEFAULT_PROFILE };
            guiConfigFolder.add(profileSettings, 'profile', profileOptions)
                .name('Profil')
                .onChange(value => applyProfile(value));

            // Configure the different sections
            setupVisualizationControls(gui);
            setupEndingControls(gui);
            setupInterfaceControls(gui);
            setupInteractionPoints(gui);
            setupChaptersControls(gui);
            // Add the new Terrain Path controls
            setupTerrainPathControls(gui);

            // Expose CHAPTERS and jumpToChapter for interoperability
            if (typeof window !== 'undefined') {
                window.CHAPTERS = CHAPTERS;
                window.jumpToChapter = jumpToChapter;
            }

            // Store the GUI interface
            setGui(gui);
            console.log('Debug GUI initialized with profile:', DEFAULT_PROFILE);

        } catch (error) {
            console.error('Error initializing debug GUI:', error);
            initializedRef.current = false;
        }
    }, [
        debug?.active,
        debug?.showGui,
        initializeWithProfile,
        createEnhancedAddFolder,
        applyProfile,
        setupVisualizationControls,
        setupEndingControls,
        setupInterfaceControls,
        setupInteractionPoints,
        setupChaptersControls,
        setupTerrainPathControls, // Make sure this is included
        jumpToChapter,
        setGui,
        scene // Add scene to the dependency array
    ]);


    // Initialiser le GUI au montage du composant
    useEffect(() => {
        initializeGui();

        // Nettoyage lors du démontage
        return () => {
            try {
                const { gui } = useStore.getState();
                if (gui) {
                    gui.destroy();
                    setGui(null);
                    initializedRef.current = false;
                    foldersRef.current.clear();
                    warningShownRef.current.clear();
                }
            } catch (error) {
                console.error('Error cleaning up debug GUI:', error);
            }
        };
    }, [initializeGui, setGui]);

    // Gérer les événements de transition
    useEffect(() => {
        const transitionFailureSubscription = EventBus.on('chapter-transition-failed', () => {
            // Force reset the transition flags
            EventBus.trigger('force-reset-transition');
        });

        return () => {
            transitionFailureSubscription();
        };
    }, []);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;