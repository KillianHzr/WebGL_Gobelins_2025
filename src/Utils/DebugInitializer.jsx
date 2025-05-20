import {useEffect, useRef, useCallback} from 'react';
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

    // Initialisation principale
    const initializeGui = useCallback(() => {
        if (!debug?.active || !debug?.showGui || initializedRef.current) return;

        try {
            initializedRef.current = true;

            // Appliquer le profil par défaut AVANT de créer les dossiers
            initializeWithProfile(DEFAULT_PROFILE);

            // Créer le GUI
            const gui = new GUI({ width: guiConfig.gui.width || 300 });
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

            const profileSettings = { profile: DEFAULT_PROFILE };
            guiConfigFolder.add(profileSettings, 'profile', profileOptions)
                .name('Profil')
                .onChange(value => applyProfile(value));

            // Configurer les différentes sections
            setupVisualizationControls(gui);
            setupEndingControls(gui);
            setupInterfaceControls(gui);
            setupInteractionPoints(gui);
            setupChaptersControls(gui);

            // Exposer CHAPTERS et jumpToChapter pour l'interopérabilité
            if (typeof window !== 'undefined') {
                window.CHAPTERS = CHAPTERS;
                window.jumpToChapter = jumpToChapter;
            }

            // Stocker l'interface GUI
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
        jumpToChapter,
        setGui
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