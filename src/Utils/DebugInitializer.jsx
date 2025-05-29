import {useCallback, useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import * as THREE from 'three';
import guiConfig from '../Config/guiConfig';
import {EventBus} from './EventEmitter';
import guiFolderConfig from "../Config/guiFolderConfig.js";
import sceneObjectManager from '../Config/SceneObjectManager';

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
const DEFAULT_PROFILE = 'artist';

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

        // *** NOUVEAU *** S'assurer que les dossiers alwaysVisible restent visibles
        if (guiFolderConfig.folderDependencies.alwaysVisible) {
            guiFolderConfig.folderDependencies.alwaysVisible.forEach(folderPath => {
                guiFolderConfig.foldersVisibility[folderPath] = true;
                console.log(`Force visibility for always-visible folder: ${folderPath}`);
            });
        }

        return true;
    }, []);

    // Fonction pour définir la visibilité d'un dossier et ses dépendances
    const setFolderVisibility = useCallback((folderPath, isVisible) => {
        // *** NOUVEAU *** Vérifier si le dossier doit toujours être visible
        if (guiFolderConfig.folderDependencies.alwaysVisible &&
            guiFolderConfig.folderDependencies.alwaysVisible.includes(folderPath)) {
            console.log(`Skipping visibility change for always-visible folder: ${folderPath}`);
            isVisible = true; // Forcer à true
        }

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

        // *** NOUVEAU *** Force la visibilité des dossiers alwaysVisible après application du profil
        if (guiFolderConfig.folderDependencies.alwaysVisible) {
            guiFolderConfig.folderDependencies.alwaysVisible.forEach(folderPath => {
                setFolderVisibility(folderPath, true);
            });
        }

        return true;
    }, [setFolderVisibility]);

    // Fonction pour basculer le mode de caméra
    const toggleCameraMode = useCallback((mode) => {
        try {
            // Récupérer l'état actuel
            const store = useStore.getState();

            // S'assurer que visualization existe
            if (!store.visualization) {
                store.visualization = {cameraMode: mode};
            } else {
                store.visualization.cameraMode = mode;
            }

            // Mettre à jour le paramètre dans la configuration de debug
            safeUpdateConfig('visualization.cameraMode.value', mode);

            // Émettre un événement pour informer d'autres composants
            EventBus.trigger('camera-mode-changed', {mode});
        } catch (error) {
            console.error('Error toggling camera mode:', error);
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
        return function (name) {
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

                // *** NOUVEAU *** Vérifier si le dossier doit toujours être visible
                const shouldAlwaysBeVisible = guiFolderConfig.folderDependencies.alwaysVisible &&
                    guiFolderConfig.folderDependencies.alwaysVisible.includes(folderPath);

                // Appliquer la visibilité initiale selon la configuration
                let isVisible = guiFolderConfig.foldersVisibility[folderPath] !== false;

                // Forcer la visibilité si c'est un dossier alwaysVisible
                if (shouldAlwaysBeVisible) {
                    isVisible = true;
                    console.log(`Forcing visibility for always-visible folder: ${folderPath}`);
                }

                if (!isVisible && folder.domElement) {
                    folder.domElement.style.display = 'none';
                } else if (isVisible && folder.domElement) {
                    folder.domElement.style.display = 'block';
                }

                // Remplacer également la méthode addFolder pour ce nouveau dossier
                const childOriginalAddFolder = folder.addFolder;
                folder.addFolder = createEnhancedAddFolder(gui, childOriginalAddFolder);

                return folder;
            } catch (error) {
                console.error(`Error creating folder '${name}':`, error);
                // Retourner un objet factice qui ne provoquera pas d'erreur
                return {
                    add: () => ({
                        onChange: () => {
                        }
                    }),
                    addColor: () => ({
                        onChange: () => {
                        }
                    }),
                    addFolder: () => ({
                        add: () => ({
                            onChange: () => {
                            }
                        })
                    }),
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
            cameraMode: 'free'
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
            visualizationSettings.cameraMode = getDebugConfigValue('visualization.cameraMode.value', 'free');
        }

        // Initialiser l'état dans le store
        const store = useStore.getState();
        if (!store.visualization) {
            store.visualization = {...visualizationSettings};
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

        // Camera mode control
        const cameraModeOptions = {theatre: 'Theatre.js', free: 'Free Camera'};
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
                // // console.log('Full ending triggered');
            },
        };

        // Add button to trigger full ending
        endingFolder.add(endingControls, 'triggerEnding')
            .name('Trigger Full Ending');

        // if (guiConfig.gui.closeFolders) {
            endingFolder.hide();
        // }
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
                    // console.log(`Intro mode updated: ${value ? 'skipping' : 'showing'} intro. Reload page to apply changes.`);
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

        // if (guiConfig.gui.closeFolders) {
            interactionPointsFolder.hide();
        // }
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

        // if (guiConfig.gui.closeFolders) {
            chaptersFolder.hide();
            navigationSection.hide();
            utilsSection.hide();
        // }
    }, [jumpToChapter]);

    // Dans DebugInitializer.jsx, ajouter cette fonction après setupChaptersControls

// Setup des contrôles de Flashlight
    const setupFlashlightControls = useCallback((gui) => {
        const flashlightFolder = gui.addFolder('Flashlight');
        const getDebugConfigValue = useStore.getState().getDebugConfigValue;

        // Configuration des seuils d'activation de la lampe torche
        const flashlightThresholdsRef = {
            startActivation: 0.65,
            fullActivation: 0.8
        };

        // Références pour le clignottement
        const flickerRef = {
            enabled: false,
            intensity: 0.3,
            frequency: 2.0,
            irregularity: 0.7,
            microFlicker: 0.2,
            duration: 2.0,
            patternIndex: 0,
            isActive: false
        };

        // Patterns de clignottement prédéfinis
        const flickerPatterns = [
            [1, 0.3, 0.8, 0.1, 1, 0.5, 0.2, 1, 0.4, 0.9],
            [0.8, 0.2, 1, 0.1, 0.6, 0.3, 1, 0.1, 0.4, 0.7, 1],
            [1, 0.9, 0.8, 0.9, 1, 0.8, 0.9, 1, 0.7, 0.9, 1],
            [1, 0.8, 0.6, 0.4, 0.2, 0.1, 0.3, 0.6, 0.8, 1]
        ];

        // Fonction pour déclencher le clignottement
        const triggerFlicker = (duration = 0, patternIndex = null) => {
            flickerRef.isActive = true;
            flickerRef.startTime = performance.now() * 0.001;
            flickerRef.duration = duration;

            if (patternIndex !== null) {
                flickerRef.patternIndex = patternIndex;
            } else {
                flickerRef.patternIndex = Math.floor(Math.random() * flickerPatterns.length);
            }

            flickerRef.noiseOffset = Math.random() * 1000;

            // Émettre un événement pour que Flashlight.jsx puisse réagir
            EventBus.trigger('flashlight-flicker-triggered', {
                duration,
                patternIndex: flickerRef.patternIndex,
                flickerRef
            });
        };

        // Objet proxy pour les contrôles
        const flashlightProxy = {
            // État principal
            active: true,
            autoActivate: true,
            intensity: 0,
            normalIntensity: guiConfig.flashlight.intensity.default,

            // Seuils d'activation
            startActivationThreshold: flashlightThresholdsRef.startActivation,
            fullActivationThreshold: flashlightThresholdsRef.fullActivation,

            // Paramètres de clignottement
            flickerEnabled: flickerRef.enabled,
            flickerIntensity: flickerRef.intensity,
            flickerFrequency: flickerRef.frequency,
            flickerIrregularity: flickerRef.irregularity,
            flickerMicroFlicker: flickerRef.microFlicker,
            flickerDuration: flickerRef.duration,
            flickerPattern: 0,

            // Fonctions de déclenchement
            triggerFlicker1s: () => triggerFlicker(1, 0),
            triggerFlicker3s: () => triggerFlicker(3, 1),
            triggerFlicker5s: () => triggerFlicker(5, 2),
            triggerFlickerInfinite: () => triggerFlicker(0, 3),
            stopFlicker: () => {
                flickerRef.isActive = false;
                EventBus.trigger('flashlight-flicker-stopped');
            },

            // Paramètres de lumière
            color: guiConfig.flashlight.color.default,
            angle: guiConfig.flashlight.angle.default,
            penumbra: guiConfig.flashlight.penumbra.default,
            distance: guiConfig.flashlight.distance.default,
            decay: guiConfig.flashlight.decay.default,

            // Position et direction
            offsetX: guiConfig.flashlight.position.offsetX.default,
            offsetY: guiConfig.flashlight.position.offsetY.default,
            offsetZ: guiConfig.flashlight.position.offsetZ.default,
            directionX: guiConfig.flashlight.target.offsetX.default,
            directionY: guiConfig.flashlight.target.offsetY.default,
            directionZ: guiConfig.flashlight.target.offsetZ.default,
            directionDistance: guiConfig.flashlight.target.distance.default,

            // Ombres
            shadowsEnabled: guiConfig.flashlight.shadows.enabled.default,
            shadowMapSize: guiConfig.flashlight.shadows.mapSize.default,
            shadowBias: guiConfig.flashlight.shadows.bias.default,
            shadowNormalBias: guiConfig.flashlight.shadows.normalBias.default
        };

        // Contrôles de base
        flashlightFolder.add(flashlightProxy, 'active')
            .name('Activer')
            .onChange(value => {
                EventBus.trigger('flashlight-active-changed', {active: value});
                safeUpdateConfig('flashlight.active.value', value);
            });

        flashlightFolder.add(flashlightProxy, 'autoActivate')
            .name('Activation automatique')
            .onChange(value => {
                EventBus.trigger('flashlight-auto-activate-changed', {autoActivate: value});
                safeUpdateConfig('flashlight.autoActivate.value', value);
            });

        // Section Clignottement
        const flickerFolder = flashlightFolder.addFolder('🔦 Clignottement');

        flickerFolder.add(flashlightProxy, 'flickerEnabled')
            .name('Activer clignottement')
            .onChange(value => {
                flickerRef.enabled = value;
                EventBus.trigger('flashlight-flicker-enabled-changed', {enabled: value});
            });

        flickerFolder.add(flashlightProxy, 'flickerIntensity', 0, 1, 0.01)
            .name('Intensité clignottement')
            .onChange(value => {
                flickerRef.intensity = value;
                EventBus.trigger('flashlight-flicker-intensity-changed', {intensity: value});
            });

        flickerFolder.add(flashlightProxy, 'flickerFrequency', 0.1, 10, 0.1)
            .name('Fréquence (Hz)')
            .onChange(value => {
                flickerRef.frequency = value;
                EventBus.trigger('flashlight-flicker-frequency-changed', {frequency: value});
            });

        flickerFolder.add(flashlightProxy, 'flickerIrregularity', 0, 1, 0.01)
            .name('Irrégularité')
            .onChange(value => {
                flickerRef.irregularity = value;
                EventBus.trigger('flashlight-flicker-irregularity-changed', {irregularity: value});
            });

        flickerFolder.add(flashlightProxy, 'flickerMicroFlicker', 0, 1, 0.01)
            .name('Micro-clignotements')
            .onChange(value => {
                flickerRef.microFlicker = value;
                EventBus.trigger('flashlight-flicker-micro-changed', {microFlicker: value});
            });

        flickerFolder.add(flashlightProxy, 'flickerPattern', {
            'Rapide avec pauses': 0,
            'Irrégulier': 1,
            'Micro-clignotements': 2,
            'Défaillance progressive': 3
        })
            .name('Pattern')
            .onChange(value => {
                flickerRef.patternIndex = parseInt(value);
                EventBus.trigger('flashlight-flicker-pattern-changed', {patternIndex: flickerRef.patternIndex});
            });

        // Boutons de déclenchement
        flickerFolder.add(flashlightProxy, 'triggerFlicker1s').name('⚡ Clignotter 1s (Rapide)');
        flickerFolder.add(flashlightProxy, 'triggerFlicker3s').name('⚡ Clignotter 3s (Irrégulier)');
        flickerFolder.add(flashlightProxy, 'triggerFlicker5s').name('⚡ Clignotter 5s (Micro)');
        flickerFolder.add(flashlightProxy, 'triggerFlickerInfinite').name('⚡ Clignotter infini (Défaillance)');
        flickerFolder.add(flashlightProxy, 'stopFlicker').name('🛑 Arrêter clignottement');

        flickerFolder.add(flashlightProxy, 'flickerDuration', 0, 10, 0.1)
            .name('Durée (s, 0=infini)')
            .onChange(value => {
                flickerRef.duration = value;
            });

        // Seuils d'activation
        flashlightFolder.add(flashlightProxy, 'startActivationThreshold', 0, 1, 0.01)
            .name('Seuil début activation')
            .onChange(value => {
                flashlightThresholdsRef.startActivation = value;
                EventBus.trigger('flashlight-threshold-changed', {startActivation: value});
            });

        flashlightFolder.add(flashlightProxy, 'fullActivationThreshold', 0, 1, 0.01)
            .name('Seuil activation complète')
            .onChange(value => {
                flashlightThresholdsRef.fullActivation = value;
                EventBus.trigger('flashlight-threshold-changed', {fullActivation: value});
            });

        // Intensité
        flashlightFolder.add(flashlightProxy, 'intensity', 0, guiConfig.flashlight.intensity.max, guiConfig.flashlight.intensity.step)
            .name('Intensité actuelle')
            .onChange(value => {
                EventBus.trigger('flashlight-intensity-changed', {intensity: value});
                safeUpdateConfig('flashlight.intensity.value', value);
            });

        flashlightFolder.add(flashlightProxy, 'normalIntensity', guiConfig.flashlight.intensity.min, guiConfig.flashlight.intensity.max, guiConfig.flashlight.intensity.step)
            .name('Intensité normale')
            .onChange(value => {
                EventBus.trigger('flashlight-normal-intensity-changed', {normalIntensity: value});
                safeUpdateConfig('flashlight.normalIntensity.value', value);
            });

        // Paramètres de lumière
        const lightFolder = flashlightFolder.addFolder('Paramètres Lumière');

        lightFolder.addColor(flashlightProxy, 'color')
            .name('Couleur')
            .onChange(value => {
                EventBus.trigger('flashlight-color-changed', {color: value});
            });

        lightFolder.add(flashlightProxy, 'angle', guiConfig.flashlight.angle.min, guiConfig.flashlight.angle.max, guiConfig.flashlight.angle.step)
            .name('Angle')
            .onChange(value => {
                EventBus.trigger('flashlight-angle-changed', {angle: value});
            });

        lightFolder.add(flashlightProxy, 'penumbra', guiConfig.flashlight.penumbra.min, guiConfig.flashlight.penumbra.max, guiConfig.flashlight.penumbra.step)
            .name('Penumbra')
            .onChange(value => {
                EventBus.trigger('flashlight-penumbra-changed', {penumbra: value});
            });

        lightFolder.add(flashlightProxy, 'distance', guiConfig.flashlight.distance.min, guiConfig.flashlight.distance.max, guiConfig.flashlight.distance.step)
            .name('Distance')
            .onChange(value => {
                EventBus.trigger('flashlight-distance-changed', {distance: value});
            });

        lightFolder.add(flashlightProxy, 'decay', guiConfig.flashlight.decay.min, guiConfig.flashlight.decay.max, guiConfig.flashlight.decay.step)
            .name('Decay')
            .onChange(value => {
                EventBus.trigger('flashlight-decay-changed', {decay: value});
            });

        // Position et direction
        const positionFolder = flashlightFolder.addFolder('Position');

        positionFolder.add(flashlightProxy, 'offsetX', guiConfig.flashlight.position.offsetX.min, guiConfig.flashlight.position.offsetX.max, guiConfig.flashlight.position.offsetX.step)
            .name(guiConfig.flashlight.position.offsetX.name)
            .onChange(value => {
                EventBus.trigger('flashlight-position-changed', {offsetX: value});
            });

        positionFolder.add(flashlightProxy, 'offsetY', guiConfig.flashlight.position.offsetY.min, guiConfig.flashlight.position.offsetY.max, guiConfig.flashlight.position.offsetY.step)
            .name(guiConfig.flashlight.position.offsetY.name)
            .onChange(value => {
                EventBus.trigger('flashlight-position-changed', {offsetY: value});
            });

        positionFolder.add(flashlightProxy, 'offsetZ', guiConfig.flashlight.position.offsetZ.min, guiConfig.flashlight.position.offsetZ.max, guiConfig.flashlight.position.offsetZ.step)
            .name(guiConfig.flashlight.position.offsetZ.name)
            .onChange(value => {
                EventBus.trigger('flashlight-position-changed', {offsetZ: value});
            });

        const directionFolder = flashlightFolder.addFolder('Direction');

        directionFolder.add(flashlightProxy, 'directionX', guiConfig.flashlight.target.offsetX.min, guiConfig.flashlight.target.offsetX.max, guiConfig.flashlight.target.offsetX.step)
            .name(guiConfig.flashlight.target.offsetX.name)
            .onChange(value => {
                EventBus.trigger('flashlight-direction-changed', {offsetX: value});
            });

        directionFolder.add(flashlightProxy, 'directionY', guiConfig.flashlight.target.offsetY.min, guiConfig.flashlight.target.offsetY.max, guiConfig.flashlight.target.offsetY.step)
            .name(guiConfig.flashlight.target.offsetY.name)
            .onChange(value => {
                EventBus.trigger('flashlight-direction-changed', {offsetY: value});
            });

        directionFolder.add(flashlightProxy, 'directionZ', guiConfig.flashlight.target.offsetZ.min, guiConfig.flashlight.target.offsetZ.max, guiConfig.flashlight.target.offsetZ.step)
            .name(guiConfig.flashlight.target.offsetZ.name)
            .onChange(value => {
                EventBus.trigger('flashlight-direction-changed', {offsetZ: value});
            });

        directionFolder.add(flashlightProxy, 'directionDistance', guiConfig.flashlight.target.distance.min, guiConfig.flashlight.target.distance.max, guiConfig.flashlight.target.distance.step)
            .name(guiConfig.flashlight.target.distance.name)
            .onChange(value => {
                EventBus.trigger('flashlight-direction-changed', {distance: value});
            });

        // Ombres
        const shadowsFolder = flashlightFolder.addFolder('Ombres');

        shadowsFolder.add(flashlightProxy, 'shadowsEnabled')
            .name('Activer ombres')
            .onChange(value => {
                EventBus.trigger('flashlight-shadows-changed', {enabled: value});
            });

        shadowsFolder.add(flashlightProxy, 'shadowMapSize', guiConfig.flashlight.shadows.mapSize.options)
            .name('Taille shadow map')
            .onChange(value => {
                EventBus.trigger('flashlight-shadows-changed', {mapSize: value});
            });

        shadowsFolder.add(flashlightProxy, 'shadowBias', guiConfig.flashlight.shadows.bias.min, guiConfig.flashlight.shadows.bias.max, guiConfig.flashlight.shadows.bias.step)
            .name('Shadow Bias')
            .onChange(value => {
                EventBus.trigger('flashlight-shadows-changed', {bias: value});
            });

        shadowsFolder.add(flashlightProxy, 'shadowNormalBias', guiConfig.flashlight.shadows.normalBias.min, guiConfig.flashlight.shadows.normalBias.max, guiConfig.flashlight.shadows.normalBias.step)
            .name('Normal Bias')
            .onChange(value => {
                EventBus.trigger('flashlight-shadows-changed', {normalBias: value});
            });

        if (guiConfig.gui.closeFolders) {
            flashlightFolder.close();
            flickerFolder.close();
            lightFolder.close();
            positionFolder.close();
            directionFolder.close();
            shadowsFolder.close();
        }

    }, [safeUpdateConfig]);

    // Ajouter cette fonction dans DebugInitializer.jsx après setupFlashlightControls

// Setup des contrôles d'éclairage
    const setupLightsControls = useCallback((gui) => {
        const lightsFolder = gui.addFolder('Lights');

        // Configuration par défaut basée sur guiConfig
        const lightsProxy = {
            // Mode d'éclairage
            lightingMode: 'auto', // auto, day, night, transition1, transition2
            forcedNightMode: false,

            // Informations de debug (lecture seule)
            currentMode: 'Day',
            normalizedPosition: 0,
            transitionFactor: 0,

            // Lumière principale (point light)
            mainLight: {
                positionX: guiConfig.lights.defaults.Point[0].position.x,
                positionY: guiConfig.lights.defaults.Point[0].position.y,
                positionZ: guiConfig.lights.defaults.Point[0].position.z,
                intensity: guiConfig.lights.defaults.Point[0].intensity,
                color: guiConfig.lights.defaults.Point[0].color,
                castShadow: guiConfig.lights.defaults.Point[0].castShadow,
                visible: guiConfig.lights.defaults.Point[0].visible
            },

            // Lumière ambiante
            ambientLight: {
                intensity: guiConfig.lights.defaults.Ambient[0].intensity,
                color: guiConfig.lights.defaults.Ambient[0].color,
                visible: guiConfig.lights.defaults.Ambient[0].visible
            },

            // Seuils de transition
            transitionThresholds: {
                startDayToTransition1: 0.15,
                startTransition1ToTransition2: 0.35,
                startTransition2ToNight: 0.60,
                completeNight: 0.80
            },

            // Paramètres d'ombre
            shadows: {
                mapSize: guiConfig.lights.shadows.mapSizes.default,
                bias: guiConfig.lights.shadows.bias.default,
                normalBias: guiConfig.lights.shadows.normalBias.default,
                radius: guiConfig.lights.shadows.radius.default
            },

            // Fonctions utilitaires
            resetToDay: () => {
                lightsProxy.lightingMode = 'day';
                EventBus.trigger('lights-mode-changed', {mode: 'day'});
            },

            resetToNight: () => {
                lightsProxy.lightingMode = 'night';
                EventBus.trigger('lights-mode-changed', {mode: 'night'});
            },

            resetToAuto: () => {
                lightsProxy.lightingMode = 'auto';
                EventBus.trigger('lights-mode-changed', {mode: 'auto'});
            },

            // Preset de lumières
            applyPresetDay: () => {
                lightsProxy.mainLight.intensity = 9000;
                lightsProxy.mainLight.color = '#d6c0b3';
                lightsProxy.ambientLight.intensity = 1.0;
                lightsProxy.ambientLight.color = '#FFFFFF';
                EventBus.trigger('lights-preset-applied', {preset: 'day'});
            },

            applyPresetNight: () => {
                lightsProxy.mainLight.intensity = 13100;
                lightsProxy.mainLight.color = '#6a74fb';
                lightsProxy.ambientLight.intensity = 0.1;
                lightsProxy.ambientLight.color = '#333366';
                EventBus.trigger('lights-preset-applied', {preset: 'night'});
            }
        };

        // Section Mode d'éclairage
        const modeFolder = lightsFolder.addFolder('Mode Éclairage');

        modeFolder.add(lightsProxy, 'lightingMode', {
            'Automatique': 'auto',
            'Jour': 'day',
            'Coucher de soleil': 'transition1',
            'Crépuscule': 'transition2',
            'Nuit': 'night'
        })
            .name('Mode')
            .onChange(value => {
                EventBus.trigger('lights-mode-changed', {mode: value});
                safeUpdateConfig('lights.mode.value', value);
            });

        modeFolder.add(lightsProxy, 'forcedNightMode')
            .name('Forcer mode nuit')
            .onChange(value => {
                EventBus.trigger('lights-night-mode-forced', {forced: value});
                safeUpdateConfig('lights.forcedNightMode.value', value);
            });

        // Section Debug Info (lecture seule)
        const debugFolder = lightsFolder.addFolder('Debug Info');

        const currentModeController = debugFolder.add(lightsProxy, 'currentMode').name('Mode actuel').disable();
        const normalizedPosController = debugFolder.add(lightsProxy, 'normalizedPosition', 0, 1, 0.001).name('Position normalisée').disable();
        const transitionFactorController = debugFolder.add(lightsProxy, 'transitionFactor', 0, 1, 0.001).name('Facteur transition').disable();

        // Section Lumière principale
        const mainLightFolder = lightsFolder.addFolder('Lumière Principale');

        mainLightFolder.add(lightsProxy.mainLight, 'visible')
            .name('Visible')
            .onChange(value => {
                EventBus.trigger('lights-main-visibility-changed', {visible: value});
            });

        // Position de la lumière principale
        const mainPositionFolder = mainLightFolder.addFolder('Position');

        mainPositionFolder.add(lightsProxy.mainLight, 'positionX', guiConfig.lights.position.x.min, guiConfig.lights.position.x.max, guiConfig.lights.position.x.step)
            .name(guiConfig.lights.position.x.name)
            .onChange(value => {
                EventBus.trigger('lights-main-position-changed', {
                    axis: 'x',
                    value: value,
                    position: [value, lightsProxy.mainLight.positionY, lightsProxy.mainLight.positionZ]
                });
            });

        mainPositionFolder.add(lightsProxy.mainLight, 'positionY', guiConfig.lights.position.y.min, guiConfig.lights.position.y.max, guiConfig.lights.position.y.step)
            .name(guiConfig.lights.position.y.name)
            .onChange(value => {
                EventBus.trigger('lights-main-position-changed', {
                    axis: 'y',
                    value: value,
                    position: [lightsProxy.mainLight.positionX, value, lightsProxy.mainLight.positionZ]
                });
            });

        mainPositionFolder.add(lightsProxy.mainLight, 'positionZ', guiConfig.lights.position.z.min, guiConfig.lights.position.z.max, guiConfig.lights.position.z.step)
            .name(guiConfig.lights.position.z.name)
            .onChange(value => {
                EventBus.trigger('lights-main-position-changed', {
                    axis: 'z',
                    value: value,
                    position: [lightsProxy.mainLight.positionX, lightsProxy.mainLight.positionY, value]
                });
            });

        // Paramètres de la lumière principale
        const mainIntensityController = mainLightFolder.add(lightsProxy.mainLight, 'intensity', guiConfig.lights.common.intensity.min, 50000, 100)
            .name('Intensité')
            .onChange(value => {
                EventBus.trigger('lights-main-intensity-changed', {intensity: value});
            });

        mainLightFolder.addColor(lightsProxy.mainLight, 'color')
            .name('Couleur')
            .onChange(value => {
                EventBus.trigger('lights-main-color-changed', {color: value});
            });

        mainLightFolder.add(lightsProxy.mainLight, 'castShadow')
            .name('Projeter ombres')
            .onChange(value => {
                EventBus.trigger('lights-main-shadow-changed', {castShadow: value});
            });

        // Section Lumière ambiante
        const ambientFolder = lightsFolder.addFolder('Lumière Ambiante');

        ambientFolder.add(lightsProxy.ambientLight, 'visible')
            .name('Visible')
            .onChange(value => {
                EventBus.trigger('lights-ambient-visibility-changed', {visible: value});
            });

        const ambientIntensityController = ambientFolder.add(lightsProxy.ambientLight, 'intensity', 0, 5, 0.01)
            .name('Intensité')
            .onChange(value => {
                EventBus.trigger('lights-ambient-intensity-changed', {intensity: value});
            });

        ambientFolder.addColor(lightsProxy.ambientLight, 'color')
            .name('Couleur')
            .onChange(value => {
                EventBus.trigger('lights-ambient-color-changed', {color: value});
            });

        // Section Seuils de transition
        const thresholdsFolder = lightsFolder.addFolder('Seuils de Transition');

        thresholdsFolder.add(lightsProxy.transitionThresholds, 'startDayToTransition1', 0, 1, 0.01)
            .name('Début jour→coucher')
            .onChange(value => {
                EventBus.trigger('lights-threshold-changed', {
                    threshold: 'startDayToTransition1',
                    value: value
                });
            });

        thresholdsFolder.add(lightsProxy.transitionThresholds, 'startTransition1ToTransition2', 0, 1, 0.01)
            .name('Début coucher→crépuscule')
            .onChange(value => {
                EventBus.trigger('lights-threshold-changed', {
                    threshold: 'startTransition1ToTransition2',
                    value: value
                });
            });

        thresholdsFolder.add(lightsProxy.transitionThresholds, 'startTransition2ToNight', 0, 1, 0.01)
            .name('Début crépuscule→nuit')
            .onChange(value => {
                EventBus.trigger('lights-threshold-changed', {
                    threshold: 'startTransition2ToNight',
                    value: value
                });
            });

        thresholdsFolder.add(lightsProxy.transitionThresholds, 'completeNight', 0, 1, 0.01)
            .name('Nuit complète')
            .onChange(value => {
                EventBus.trigger('lights-threshold-changed', {
                    threshold: 'completeNight',
                    value: value
                });
            });

        // Section Ombres
        const shadowsFolder = lightsFolder.addFolder('Ombres');

        shadowsFolder.add(lightsProxy.shadows, 'mapSize', guiConfig.lights.shadows.mapSizes.options)
            .name(guiConfig.lights.shadows.mapSizes.name)
            .onChange(value => {
                EventBus.trigger('lights-shadow-mapsize-changed', {mapSize: value});
            });

        shadowsFolder.add(lightsProxy.shadows, 'bias', guiConfig.lights.shadows.bias.min, guiConfig.lights.shadows.bias.max, guiConfig.lights.shadows.bias.step)
            .name(guiConfig.lights.shadows.bias.name)
            .onChange(value => {
                EventBus.trigger('lights-shadow-bias-changed', {bias: value});
            });

        shadowsFolder.add(lightsProxy.shadows, 'normalBias', guiConfig.lights.shadows.normalBias.min, guiConfig.lights.shadows.normalBias.max, guiConfig.lights.shadows.normalBias.step)
            .name(guiConfig.lights.shadows.normalBias.name)
            .onChange(value => {
                EventBus.trigger('lights-shadow-normal-bias-changed', {normalBias: value});
            });

        shadowsFolder.add(lightsProxy.shadows, 'radius', guiConfig.lights.shadows.radius.min, guiConfig.lights.shadows.radius.max, guiConfig.lights.shadows.radius.step)
            .name(guiConfig.lights.shadows.radius.name)
            .onChange(value => {
                EventBus.trigger('lights-shadow-radius-changed', {radius: value});
            });

        // Section Presets
        const presetsFolder = lightsFolder.addFolder('Presets');

        presetsFolder.add(lightsProxy, 'applyPresetDay').name('🌞 Appliquer Jour');
        presetsFolder.add(lightsProxy, 'applyPresetNight').name('🌙 Appliquer Nuit');

        // Section Actions rapides
        const actionsFolder = lightsFolder.addFolder('Actions Rapides');

        actionsFolder.add(lightsProxy, 'resetToDay').name('→ Mode Jour');
        actionsFolder.add(lightsProxy, 'resetToNight').name('→ Mode Nuit');
        actionsFolder.add(lightsProxy, 'resetToAuto').name('→ Mode Auto');

        // Écouter les événements de mise à jour des valeurs debug
        const updateDebugValues = () => {
            // Cette fonction sera appelée par les événements pour mettre à jour l'affichage
        };

        // Écouter les événements de mise à jour depuis Lights.jsx
        const subscriptions = [
            EventBus.on('lights-values-updated', (data) => {
                // Mettre à jour les valeurs affichées dans le GUI
                lightsProxy.currentMode = data.currentMode || lightsProxy.currentMode;
                lightsProxy.normalizedPosition = data.normalizedPosition || lightsProxy.normalizedPosition;
                lightsProxy.transitionFactor = data.transitionFactor || lightsProxy.transitionFactor;

                // Mettre à jour les contrôleurs si nécessaire
                try {
                    currentModeController.setValue(lightsProxy.currentMode);
                    normalizedPosController.setValue(lightsProxy.normalizedPosition);
                    transitionFactorController.setValue(lightsProxy.transitionFactor);

                    if (data.mainLightIntensity !== undefined) {
                        lightsProxy.mainLight.intensity = data.mainLightIntensity;
                        mainIntensityController.setValue(data.mainLightIntensity);
                    }

                    if (data.ambientIntensity !== undefined) {
                        lightsProxy.ambientLight.intensity = data.ambientIntensity;
                        ambientIntensityController.setValue(data.ambientIntensity);
                    }
                } catch (error) {
                    console.warn('Error updating GUI controllers:', error);
                }
            })
        ];

        // Nettoyer les subscriptions quand le GUI est détruit
        const originalDestroy = gui.destroy;
        gui.destroy = function () {
            subscriptions.forEach(unsub => {
                if (typeof unsub === 'function') {
                    unsub();
                }
            });
            originalDestroy.call(this);
        };

        if (guiConfig.gui.closeFolders) {
            lightsFolder.close();
            modeFolder.close();
            debugFolder.close();
            mainLightFolder.close();
            mainPositionFolder.close();
            ambientFolder.close();
            thresholdsFolder.close();
            shadowsFolder.close();
            presetsFolder.close();
            actionsFolder.close();
        }

    }, [safeUpdateConfig]);

    // Initialisation principale
    const initializeGui = useCallback(() => {
        if (!debug?.active || !debug?.showGui || initializedRef.current) return;

        try {
            initializedRef.current = true;

            // Appliquer le profil par défaut AVANT de créer les dossiers
            initializeWithProfile(DEFAULT_PROFILE);

            // Créer le GUI
            const gui = new GUI({width: guiConfig.gui.width || 300});
            gui.title(guiConfig.gui.title || 'Debug Controls');

            // Fermer tous les dossiers par défaut si configuré
            if (guiConfig.gui.closeFolders) {
                gui.open();
            }

            // Améliorer la méthode addFolder
            gui.addFolder = createEnhancedAddFolder(gui, gui.addFolder);

            // Ajouter le dossier de configuration GUI
            const guiConfigFolder = gui.addFolder('GUI Config');

            // Ajouter un sélecteur de profil
            const profileOptions = {};
            if (guiFolderConfig.profiles) {
                Object.keys(guiFolderConfig.profiles).forEach(key => {
                    profileOptions[key] = key;
                });
            }

            const profileSettings = {profile: DEFAULT_PROFILE};
            guiConfigFolder.add(profileSettings, 'profile', profileOptions)
                .name('Profil')
                .onChange(value => applyProfile(value));

            // Configurer les différentes sections
            setupVisualizationControls(gui);
            setupEndingControls(gui);
            setupInterfaceControls(gui);
            setupInteractionPoints(gui);
            setupChaptersControls(gui);
            setupFlashlightControls(gui);
            setupLightsControls(gui);


            // Stocker l'interface GUI
            setGui(gui);
            console.log('Debug GUI initialized with profile:', DEFAULT_PROFILE);
            console.log('Flashlight should be visible with alwaysVisible configuration');

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
        setupFlashlightControls,
        setupLightsControls,
        jumpToChapter,
        setGui
    ]);

    // Initialiser le GUI au montage du composant
    useEffect(() => {
        initializeGui();

        // Nettoyage lors du démontage
        return () => {
            try {
                const {gui} = useStore.getState();
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