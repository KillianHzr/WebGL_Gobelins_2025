import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import * as THREE from 'three';
import {getProject} from '@theatre/core';
import guiConfig from '../Config/guiConfig';
import GuiConfig from '../Config/guiConfig';
import {EventBus} from './EventEmitter';
import guiFolderConfig from "../Config/guiFolderConfig.js";
import sceneObjectManager from '../Config/SceneObjectManager';

// Configuration des chapitres
const CHAPTERS = [
    {id: 'intro', name: "Introduction", position: 0, completed: false},
    {id: 'forest', name: "Forêt mystérieuse", position: 5.5, completed: false},
    {id: 'discovery', name: "Découverte", position: 12.3, completed: false},
    {id: 'creatures', name: "Créatures", position: 18.7, completed: false},
    {id: 'conclusion', name: "Conclusion", position: 25.4, completed: false}
];

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
    const warningShownRef = useRef(new Set()); // Pour éviter de répéter les avertissements

    const DEFAULT_PROFILE = 'developer'; // Changer ici pour le profil par défaut souhaité

    // Fonction pour appliquer un profil à la configuration avant création des dossiers
    const initializeWithProfile = (profileName) => {
        const profile = guiFolderConfig.profiles[profileName];
        if (!profile) {
            console.warn(`Profil "${profileName}" non trouvé dans la configuration`);
            return;
        }

        // Mettre à jour la configuration de visibilité avec le profil
        for (const [folderPath, isVisible] of Object.entries(profile)) {
            guiFolderConfig.foldersVisibility[folderPath] = isVisible;
        }

        console.log(`Configuration initialisée avec le profil "${profileName}"`);
    };

    // Fonction pour définir la visibilité d'un dossier et ses dépendances
    const setFolderVisibility = (folderPath, isVisible, gui) => {
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
                            setFolderVisibility(subFolderPath, false, gui);
                        }
                    }
                });
            }

            // Gérer les dépendances spécifiques
            if (!isVisible && guiFolderConfig.folderDependencies.specific && guiFolderConfig.folderDependencies.specific[folderPath]) {
                guiFolderConfig.folderDependencies.specific[folderPath].forEach(depPath => {
                    setFolderVisibility(depPath, false, gui);
                });
            }
        } else {
            // N'afficher l'avertissement qu'une seule fois par chemin de dossier
            if (!warningShownRef.current.has(folderPath)) {
                // console.warn(`Dossier non trouvé pour le chemin: ${folderPath}`);
                warningShownRef.current.add(folderPath);
            }
        }
    };

    // Fonction pour appliquer un profil complet
    const applyProfile = (profileName, gui) => {
        const profile = guiFolderConfig.profiles[profileName];
        if (!profile) {
            console.warn(`Profil "${profileName}" non trouvé dans la configuration`);
            return;
        }

        // Récupérer tous les chemins de dossier de premier niveau
        const rootFolderPaths = Array.from(foldersRef.current.keys())
            .filter(path => !path.includes('/'));

        // D'abord, appliquer les paramètres définis dans le profil
        for (const [folderPath, isVisible] of Object.entries(profile)) {
            setFolderVisibility(folderPath, isVisible, gui);
        }

        // Ensuite, pour tous les dossiers non mentionnés dans le profil, utiliser la valeur par défaut (true)
        rootFolderPaths.forEach(path => {
            if (profile[path] === undefined) {
                // Si non spécifié dans le profil, le dossier est visible par défaut
                setFolderVisibility(path, true, gui);
            }
        });

        console.log(`Profil "${profileName}" appliqué, tous les dossiers ont été mis à jour`);
    };

    const toggleTheatreUI = (show) => {
        if (window.__theatreStudio) {
            try {
                if (show) {
                    console.log('Restoring Theatre.js UI');
                    window.__theatreStudio.ui.restore();
                } else {
                    console.log('Hiding Theatre.js UI');
                    window.__theatreStudio.ui.hide();
                }

                // Mettre à jour la configuration sans modifier l'état React
                if (useStore.getState().debugConfig) {
                    const updatedConfig = {...useStore.getState().debugConfig};
                    if (!updatedConfig.theatre) updatedConfig.theatre = {};
                    if (!updatedConfig.theatre.showUI) updatedConfig.theatre.showUI = {};
                    updatedConfig.theatre.showUI.value = show;

                    // Mettre à jour directement sans déclencher un re-rendu
                    setDebugConfig(updatedConfig);
                }
            } catch (error) {
                console.error('Error toggling Theatre.js UI:', error);
            }
        } else {
            console.warn('Theatre.js instance not found');
        }
    };

    // Fonction toggleCameraMode améliorée pour assurer la stabilité
    const toggleCameraMode = (mode) => {
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
            if (typeof store.updateDebugConfig === 'function') {
                store.updateDebugConfig('visualization.cameraMode.value', mode);
            }

            console.log(`Camera mode switched to: ${mode}`);

            // Émettre un événement pour informer d'autres composants
            EventBus.trigger('camera-mode-changed', {mode});
        } catch (error) {
            console.error('Error toggling camera mode:', error);
        }
    };

    // Fonction pour appliquer le mode wireframe à tous les objets de la scène
    const applyWireframeToScene = (enabled) => {
        if (!scene) return;

        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                // Gérer les matériaux multiples
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        if (material) material.wireframe = enabled;
                    });
                } else {
                    object.material.wireframe = enabled;
                }

                // S'assurer que le matériau est mis à jour
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        if (material) material.needsUpdate = true;
                    });
                } else {
                    object.material.needsUpdate = true;
                }
            }
        });

        console.log(`Wireframe mode ${enabled ? 'enabled' : 'disabled'}`);
    };

    // Fonction pour mettre à jour la visibilité des objets dans la scène
    const updateObjectsVisibility = (settings) => {
        if (!scene) return;

        // Parcourir tous les objets de la scène
        scene.traverse((object) => {
            // Vérification des objets de la forêt (instances)
            if (object.name === 'Forest' || object.name?.includes('instances') || object.name?.includes('MapInstance')) {
                if (object.visible !== settings.showInstances) {
                    object.visible = settings.showInstances;
                    console.log(`${object.name} visibility set to ${settings.showInstances}`);
                }
            }

            // Gestion des objets interactifs
            else if (object.name === 'interactive-objects' || object.parent?.name === 'interactive-objects') {
                if (object.visible !== settings.showInteractive) {
                    object.visible = settings.showInteractive;
                    console.log(`${object.name} visibility set to ${settings.showInteractive}`);
                }
            }

            // Gestion des objets statiques
            else if (object.name === 'static-objects' || object.parent?.name === 'static-objects') {
                if (object.visible !== settings.showStatic) {
                    object.visible = settings.showStatic;
                    console.log(`${object.name} visibility set to ${settings.showStatic}`);
                }
            }
        });

        // Émettre un événement pour informer d'autres composants
        EventBus.trigger('objects-visibility-changed', settings);
    };

    // Fonction protégée pour appliquer la configuration de visibilité des dossiers
    const applyFolderVisibility = (folder) => {
        if (!folder) return;

        // Sécurité pour éviter les erreurs d'accès
        const folderName = folder.title || folder.name || "";

        // Vérifier si ce dossier doit être caché selon la configuration
        const isVisible = guiFolderConfig.foldersVisibility[folderName] !== false; // Par défaut visible

        // Appliquer la visibilité si le dossier a un DOM element
        if (folder.domElement) {
            folder.domElement.style.display = isVisible ? 'block' : 'none';
        }

        // Récursivement appliquer aux sous-dossiers si le parent est visible ou si on force la cascade
        if (folder.folders && (isVisible || guiFolderConfig.folderDependencies.enforceParentDependency)) {
            folder.folders.forEach(subFolder => {
                if (subFolder) {
                    const subFolderName = (folderName ? folderName + "/" : "") + (subFolder.title || subFolder.name || "");
                    // Récursivement appliquer la visibilité
                    applyFolderVisibility(subFolder);
                }
            });
        }
    };

    // Sécuriser la fonction updateDebugConfig
    const updateDebugConfig = (path, value) => {
        if (typeof useStore.getState().updateDebugConfig === 'function') {
            useStore.getState().updateDebugConfig(path, value);
        } else {
            console.warn('updateDebugConfig not available in store');
        }
    };

    // Fonction pour sauter à un chapitre spécifique
    const jumpToChapter = (index) => {
        if (index >= 0 && index < CHAPTERS.length) {
            const chapter = CHAPTERS[index];
            console.log(`GUI: Transition vers le chapitre: ${chapter.name}`);

            // Au lieu d'initialiser un nouveau projet Theatre.js, utilisez celui déjà disponible globalement
            try {
                // Si window.jumpToChapter existe (défini dans ScrollControls.jsx),
                // l'utiliser comme méthode principale
                if (typeof window.jumpToChapter === 'function') {
                    window.jumpToChapter(index);// Émettre un événement pour indiquer que la transition a été démarrée via le GUI
                    EventBus.trigger('gui-chapter-jump-initiated', {
                        chapterIndex: index,
                        chapterName: chapter.name
                    });

                    return; // Terminer ici pour éviter la double initialisation
                }
                const existingProject = window.__theatreProjects && window.__theatreProjects['WebGL_Gobelins'];
                if (existingProject) {
                    const sheet = existingProject.sheet('Scene');
                    if (sheet) {
                        // Transition fluide vers la position du chapitre
                        const startPosition = sheet.sequence.position;
                        const targetPosition = chapter.position;
                        const distance = targetPosition - startPosition;
                        const duration = 1500; // ms, ajusté par la vitesse
                        const startTime = performance.now();

                        // Animation de la transition
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
                    }
                }
            } catch (error) {
                console.error('Erreur lors du saut de chapitre:', error);
            }

            // Si window.jumpToChapter existe déjà (défini dans ScrollControls.jsx),
            // l'utiliser comme fallback
            if (typeof window.jumpToChapter === 'function') {
                window.jumpToChapter(index);
            }

            // Mettre à jour l'URL sans rechargement pour la navigation
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.set('chapter', chapter.id);
                window.history.replaceState({}, '', url);
            }
        }
    };

    useEffect(() => {
        // Initialize GUI if debug mode is active
        if (debug?.active && debug?.showGui && !initializedRef.current) {
            try {
                initializedRef.current = true;

                // Appliquer le profil par défaut AVANT de créer les dossiers
                initializeWithProfile(DEFAULT_PROFILE);

                // Create GUI only if it doesn't exist yet
                const gui = new GUI({
                    width: guiConfig.gui.width || 300
                });
                gui.title(guiConfig.gui.title || 'Debug Controls');

                // Ferme tous les dossiers par défaut si configuré ainsi
                if (guiConfig.gui.closeFolders) {
                    gui.open();
                }

                // Remplacer la méthode addFolder pour suivre tous les dossiers créés
                const originalAddFolder = gui.addFolder;

                gui.addFolder = function (name) {
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
                        const isVisible = guiFolderConfig.foldersVisibility[folderPath];
                        if (isVisible === false && folder.domElement) {
                            folder.domElement.style.display = 'none';
                        }

                        // Remplacer également la méthode addFolder pour ce nouveau dossier
                        const childOriginalAddFolder = folder.addFolder;
                        folder.addFolder = function (childName) {
                            try {
                                const childFolder = childOriginalAddFolder.call(this, childName);
                                const childPath = `${folderPath}/${childName}`;

                                // Stocker la référence au sous-dossier
                                foldersRef.current.set(childPath, childFolder);

                                // Appliquer la visibilité initiale
                                const isChildVisible = guiFolderConfig.foldersVisibility[childPath];
                                if (isChildVisible === false && childFolder.domElement) {
                                    childFolder.domElement.style.display = 'none';
                                }

                                return childFolder;
                            } catch (error) {
                                console.error(`Error creating subfolder '${childName}':`, error);
                                return null;
                            }
                        };

                        return folder;
                    } catch (error) {
                        console.error(`Error creating folder '${name}':`, error);
                        return {
                            add: () => ({
                                onChange: () => {
                                }
                            }), addColor: () => ({
                                onChange: () => {
                                }
                            }), addFolder: () => ({
                                add: () => ({
                                    onChange: () => {
                                    }
                                })
                            }), folders: [], domElement: null
                        };
                    }
                };

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

                const profileControl = guiConfigFolder.add(profileSettings, 'profile', profileOptions)
                    .name('Profil');

                if (profileControl && profileControl.onChange) {
                    profileControl.onChange(value => {
                        applyProfile(value, gui);
                    });
                }

                // Configurer les contrôles de visualisation
                const visualizationFolder = gui.addFolder('Visualisation');

                // Configurer les paramètres de visualisation
                const visualizationSettings = {
                    wireframe: GuiConfig.visualization.wireframe.default,
                    showInstances: GuiConfig.visualization.showInstances.default,
                    showInteractive: GuiConfig.visualization.showInteractive.default,
                    showStatic: GuiConfig.visualization.showStatic.default,
                    cameraMode: 'free' // 'theatre' ou 'free'
                };

                // Obtenir les valeurs sauvegardées si disponibles
                if (useStore.getState().getDebugConfigValue) {
                    visualizationSettings.wireframe = useStore.getState().getDebugConfigValue('visualization.wireframe.value', GuiConfig.visualization.wireframe.default);
                    visualizationSettings.showInstances = useStore.getState().getDebugConfigValue('visualization.showInstances.value', GuiConfig.visualization.showInstances.default);
                    visualizationSettings.showInteractive = useStore.getState().getDebugConfigValue('visualization.showInteractive.value', GuiConfig.visualization.showInteractive.default);
                    visualizationSettings.showStatic = useStore.getState().getDebugConfigValue('visualization.showStatic.value', GuiConfig.visualization.showStatic.default);
                    visualizationSettings.cameraMode = useStore.getState().getDebugConfigValue('visualization.cameraMode.value', 'free');
                }

                // Initialiser l'état dans le store
                if (!useStore.getState().visualization) {
                    useStore.getState().visualization = {...visualizationSettings};
                }

                // Wireframe control
                const wireframeControl = visualizationFolder.add(visualizationSettings, 'wireframe')
                    .name(guiConfig.visualization.wireframe.name);

                wireframeControl.onChange(value => {
                    applyWireframeToScene(value);
                    updateDebugConfig('visualization.wireframe.value', value);
                });

                // Show instances control
                const showInstancesControl = visualizationFolder.add(visualizationSettings, 'showInstances')
                    .name(guiConfig.visualization.showInstances.name);

                showInstancesControl.onChange(value => {
                    updateObjectsVisibility(visualizationSettings);
                    updateDebugConfig('visualization.showInstances.value', value);
                });

                // Show interactive control
                const showInteractiveControl = visualizationFolder.add(visualizationSettings, 'showInteractive')
                    .name(guiConfig.visualization.showInteractive.name);

                showInteractiveControl.onChange(value => {
                    updateObjectsVisibility(visualizationSettings);
                    updateDebugConfig('visualization.showInteractive.value', value);
                });

                // Show static control
                const showStaticControl = visualizationFolder.add(visualizationSettings, 'showStatic')
                    .name(guiConfig.visualization.showStatic.name);

                showStaticControl.onChange(value => {
                    updateObjectsVisibility(visualizationSettings);
                    updateDebugConfig('visualization.showStatic.value', value);
                });

                // Camera mode control
                const cameraModeOptions = {theatre: 'Theatre.js', free: 'Free Camera'};

                visualizationFolder.add(visualizationSettings, 'cameraMode', cameraModeOptions)
                    .name('Mode Caméra')
                    .onChange(toggleCameraMode);

                // Si configuré ainsi, fermer le dossier
                if (guiConfig.gui.closeFolders) {
                    visualizationFolder.close();
                }

                // Ajouter le dossier des points d'interaction
                const interactionPointsFolder = gui.addFolder('Points d\'interaction');

                try {
                    // Récupérer les emplacements d'interaction depuis sceneObjectManager de manière sécurisée
                    let interactivePlacements = [];
                    try {
                        if (sceneObjectManager && typeof sceneObjectManager.getInteractivePlacements === 'function') {
                            interactivePlacements = sceneObjectManager.getInteractivePlacements();
                        } else {
                            console.warn("sceneObjectManager not available or getInteractivePlacements is not a function");
                        }
                    } catch (error) {
                        console.error("Error getting interactive placements:", error);
                    }

                    // Fonction pour téléporter la caméra à un emplacement spécifique
                    // Fonction pour téléporter la caméra à un emplacement spécifique
                    const teleportCamera = (interactionPoint) => {
                        if (!camera) {
                            console.warn("Camera not available for teleportation");
                            return;
                        }

                        try {
                            // Extraire la position du point d'interaction
                            const posX = interactionPoint.position[0] || 0;
                            const posY = interactionPoint.position[1] || 0;
                            const posZ = interactionPoint.position[2] || 0;

                            const interactionPos = new THREE.Vector3(posX, posY, posZ);

                            // Position de la caméra légèrement en arrière et au-dessus du point d'interaction
                            const cameraOffset = new THREE.Vector3(0, 2, 5);

                            // Position finale de la caméra
                            const cameraPos = interactionPos.clone().add(cameraOffset);

                            console.log(`Teleporting camera to: ${cameraPos.x}, ${cameraPos.y}, ${cameraPos.z}`);
                            console.log(`Target position: ${interactionPos.x}, ${interactionPos.y}, ${interactionPos.z}`);

                            // Obtenir le mode de caméra actuel depuis le store
                            const cameraMode = useStore.getState().visualization?.cameraMode || 'free';
                            console.log(`Current camera mode: ${cameraMode}`);

                            // Si nous sommes en mode Theatre.js, mettre à jour l'état dans Theatre.js
                            if (cameraMode === 'theatre' || cameraMode === 'Theatre.js') {
                                // Téléporter la caméra à la position calculée
                                camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);

                                // Faire la caméra regarder vers le point d'interaction
                                camera.lookAt(interactionPos);

                                // Mettre à jour la matrice de projection de la caméra
                                camera.updateProjectionMatrix();

                                if (window.__theatreStudio) {
                                    console.log("Updating Theatre.js camera position");

                                    try {
                                        // Accéder à la feuille actuelle
                                        const project = getProject('WebGL_Gobelins');
                                        if (project) {
                                            const sheet = project.sheet('Scene');

                                            if (sheet) {
                                                // Mise à jour de l'objet caméra dans Theatre.js
                                                const obj = sheet.object('Camera');

                                                if (obj) {
                                                    obj.set({
                                                        position: {
                                                            x: cameraPos.x, y: cameraPos.y, z: cameraPos.z
                                                        }
                                                    });

                                                    console.log("Theatre.js camera position updated successfully");
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        console.warn("Failed to update Theatre.js camera:", error);
                                    }
                                }
                            }

                            // Mettre à jour la configuration de débogage
                            updateDebugConfig('camera.position.x.value', cameraPos.x);
                            updateDebugConfig('camera.position.y.value', cameraPos.y);
                            updateDebugConfig('camera.position.z.value', cameraPos.z);

                            // IMPORTANT: Toujours émettre l'événement pour les deux modes de caméra
                            // Cet événement est crucial pour que le mode free camera fonctionne
                            EventBus.trigger('camera-teleported', {
                                position: cameraPos,
                                target: interactionPos
                            });

                            console.log("Teleport event emitted with data:", {
                                position: cameraPos,
                                target: interactionPos
                            });

                            return true;
                        } catch (error) {
                            console.error("Error teleporting camera:", error);
                            return false;
                        }
                    };

                    // Créer un objet pour stocker les fonctions de téléportation
                    const teleportFunctions = {};

                    // Ajouter des boutons pour se téléporter à chaque point d'interaction
                    interactivePlacements.forEach((placement, index) => {
                        // Générer un nom unique pour ce point d'interaction
                        const pointName = placement.markerText || placement.requiredStep || placement.markerId || `${placement.objectKey}_${index}`;

                        // Créer une propriété unique pour cette fonction de téléportation
                        const functionName = `teleportTo_${index}`;

                        // Ajouter la fonction de téléportation à l'objet
                        teleportFunctions[functionName] = () => {
                            teleportCamera(placement);
                        };

                        // Ajouter un bouton pour cette fonction
                        interactionPointsFolder.add(teleportFunctions, functionName).name(`TP: ${pointName}`);
                    });

                    // Ajouter une fonction pour désactiver le mouvement automatique de la caméra
                    teleportFunctions.disableAutoMove = () => {
                        const state = useStore.getState();

                        // Si l'interaction a une méthode pour désactiver le défilement automatique
                        if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                            state.interaction.setAllowScroll(false);
                            console.log("Auto-scrolling disabled");
                        }
                    };

                    // Ajouter une fonction pour activer le mouvement automatique de la caméra
                    teleportFunctions.enableAutoMove = () => {
                        const state = useStore.getState();

                        // Si l'interaction a une méthode pour activer le défilement automatique
                        if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                            state.interaction.setAllowScroll(true);
                            console.log("Auto-scrolling enabled");
                        }
                    };

                    // Ajouter ces boutons
                    interactionPointsFolder.add(teleportFunctions, 'disableAutoMove').name("Désactiver AutoMove");
                    interactionPointsFolder.add(teleportFunctions, 'enableAutoMove').name("Activer AutoMove");

                } catch (error) {
                    console.error("Error setting up interaction points:", error);
                    // Ajouter un message d'erreur dans le dossier
                    const errorObj = {message: "Erreur: sceneObjectManager non disponible"};
                    interactionPointsFolder.add(errorObj, 'message').name("ERREUR").disable();
                }

                // Fermer le dossier si configuré ainsi
                if (guiConfig.gui.closeFolders) {
                    interactionPointsFolder.close();
                }

                // Ajouter le dossier de gestion des chapitres
                const chaptersFolder = gui.addFolder('Chapitres');

                // Objet pour stocker les fonctions et paramètres liés aux chapitres
                const chapterSettings = {
                    currentChapter: 0,
                    autoProgress: true,
                    // Fonctions pour les boutons
                    jumpToIntro: () => jumpToChapter(0),
                    jumpToForest: () => jumpToChapter(1),
                    jumpToDiscovery: () => jumpToChapter(2),
                    jumpToCreatures: () => jumpToChapter(3), jumpToConclusion: () => jumpToChapter(4),
                    resetScrollVelocity: () => {
                        // Émettre un événement pour demander la réinitialisation de la vélocité
                        EventBus.trigger('reset-scroll-velocity');
                    }
                };

                // Ajouter les contrôles de chapitres au GUI
                chaptersFolder.add(chapterSettings, 'currentChapter', {
                    "Introduction": 0,
                    "Forêt mystérieuse": 1,
                    "Découverte": 2,
                    "Créatures": 3,
                    "Conclusion": 4
                }).name('Chapitre actuel')
                    .onChange((value) => {
                        jumpToChapter(value);
                    });

                chaptersFolder.add(chapterSettings, 'autoProgress').name('Progression auto')
                    .onChange((value) => {
                        // Permettre ou non le défilement automatique
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

                // Fermer le dossier si configuré ainsi
                if (guiConfig.gui.closeFolders) {
                    chaptersFolder.close();
                    navigationSection.close();
                    utilsSection.close();
                }

                // Exposer CHAPTERS et jumpToChapter pour l'interopérabilité avec ScrollControls
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
        }

        // Cleanup function - destroy GUI on unmount
        return () => {
            try {
                const {gui} = useStore.getState();
                if (gui) {
                    gui.destroy();
                    setGui(null);
                    initializedRef.current = false;
                    foldersRef.current.clear(); // Nettoyer la référence aux dossiers
                    warningShownRef.current.clear(); // Nettoyer la liste des avertissements
                }
            } catch (error) {
                console.error('Error cleaning up debug GUI:', error);
            }
        };
    }, [debug?.active, debug?.showGui, setDebug, setGui, setDebugConfig, scene, camera, controls]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;