import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import guiConfig from '../Config/guiConfig';
import {EventBus} from './EventEmitter';
import guiFolderConfig from "../Config/guiFolderConfig.js";

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

    // Définir le profil par défaut (à récupérer du localStorage ou d'une config)
    const DEFAULT_PROFILE = 'artist'; // Changer ici pour le profil par défaut souhaité

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
                    const subFolderName = subFolder.title || subFolder.name;
                    const subFolderPath = `${folderPath}/${subFolderName}`;
                    setFolderVisibility(subFolderPath, false, gui);
                });
            }

            // Gérer les dépendances spécifiques
            if (!isVisible && guiFolderConfig.folderDependencies.specific[folderPath]) {
                guiFolderConfig.folderDependencies.specific[folderPath].forEach(depPath => {
                    setFolderVisibility(depPath, false, gui);
                });
            }
        } else {
            console.warn(`Dossier non trouvé pour le chemin: ${folderPath}`);
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

    // Fonction pour basculer entre les modes de caméra
    const toggleCameraMode = (mode) => {
        if (!controls) return;

        if (mode === 'free') {
            // Activer la caméra libre (OrbitControls)
            if (controls.enabled !== undefined) {
                controls.enabled = true;
            }

            // Désactiver les contrôles TheatreJS s'ils existent
            if (window.__theatreStudio) {
                // Masquer l'UI Theatre si on passe en mode libre
                if (window.__theatreStudio.ui) {
                    const studioUI = window.__theatreStudio.ui;
                    // Stocker l'état actuel de l'UI pour pouvoir le restaurer
                    const wasVisible = studioUI.isHidden ? false : true;
                    if (wasVisible) {
                        studioUI.hide();
                    }
                    // Stocker cette info pour la restaurer plus tard
                    window.__wasTheatreUIVisible = wasVisible;
                }
                console.log('Passing to free camera mode, disabling TheatreJS camera');
            }
        } else if (mode === 'theatre') {
            // Désactiver la caméra libre
            if (controls.enabled !== undefined) {
                controls.enabled = false;
            }

            // Activer les contrôles TheatreJS s'ils existent
            if (window.__theatreStudio) {
                // Restaurer l'état de l'UI si nécessaire
                if (window.__theatreStudio.ui && window.__wasTheatreUIVisible) {
                    window.__theatreStudio.ui.restore();
                }
                console.log('Passing to TheatreJS camera mode');
            }
        }

        // Mettre à jour l'état dans le store
        useStore.getState().visualization.cameraMode = mode;

        // Émettre un événement pour informer d'autres composants
        EventBus.trigger('camera-mode-changed', {mode});
    };

    // Fonction pour appliquer le mode wireframe à tous les objets de la scène
    const applyWireframeToScene = (enabled) => {
        if (!scene) return;

        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                // Gérer les matériaux multiples
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        material.wireframe = enabled;
                    });
                } else {
                    object.material.wireframe = enabled;
                }

                // S'assurer que le matériau est mis à jour
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        material.needsUpdate = true;
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

    useEffect(() => {
        // Initialize GUI if debug mode is active
        if (debug?.active && debug?.showGui && !initializedRef.current) {
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

            gui.addFolder = function(name) {
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
                folder.addFolder = function(childName) {
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
                };

                return folder;
            };

            // Ajouter le dossier de configuration GUI
            const guiConfigFolder = gui.addFolder('GUI Config');

            // Ajouter un sélecteur de profil
            const profileOptions = Object.keys(guiFolderConfig.profiles).reduce((obj, key) => {
                obj[key] = key;
                return obj;
            }, {});

            const profileSettings = { profile: DEFAULT_PROFILE };

            guiConfigFolder.add(profileSettings, 'profile', profileOptions)
                .name('Profil')
                .onChange(value => {
                    applyProfile(value, gui);
                });



            // Fermer les dossiers de configuration par défaut
            guiConfigFolder.open();

            const visualizationFolder = gui.addFolder('Visualisation');

            // Configurer les paramètres de visualisation
            const visualizationSettings = {
                wireframe: false,
                showInstances: true,
                showInteractive: true,
                showStatic: true,
                cameraMode: 'theatre' // 'theatre' ou 'free'
            };

            // Obtenir les valeurs sauvegardées si disponibles
            if (useStore.getState().getDebugConfigValue) {
                visualizationSettings.wireframe = useStore.getState().getDebugConfigValue(
                    'visualization.wireframe.value',
                    false
                );
                visualizationSettings.showInstances = useStore.getState().getDebugConfigValue(
                    'visualization.showInstances.value',
                    true
                );
                visualizationSettings.showInteractive = useStore.getState().getDebugConfigValue(
                    'visualization.showInteractive.value',
                    true
                );
                visualizationSettings.showStatic = useStore.getState().getDebugConfigValue(
                    'visualization.showStatic.value',
                    true
                );
                visualizationSettings.cameraMode = useStore.getState().getDebugConfigValue(
                    'visualization.cameraMode.value',
                    'theatre'
                );
            }

            // Initialiser l'état dans le store
            if (!useStore.getState().visualization) {
                useStore.getState().visualization = {...visualizationSettings};
            }

            // Continue avec le reste de ton code d'initialisation existant
            // ...

            setTimeout(() => {
                // Appliquer la configuration de visibilité à tous les dossiers racine
                gui.folders.forEach(folder => {
                    this.applyFolderVisibility(folder);
                });

                console.log('Configuration de visibilité des dossiers appliquée');
            }, 500); // Petit délai pour s'assurer que tous les dossiers sont créés


            setGui(gui);
            console.log('Debug GUI initialized with profile:', DEFAULT_PROFILE);
        }

        // Cleanup function - destroy GUI on unmount
        return () => {
            const {gui} = useStore.getState();
            if (gui) {
                gui.destroy();
                setGui(null);
                initializedRef.current = false;
                foldersRef.current.clear(); // Nettoyer la référence aux dossiers
            }
        };
    }, [debug?.active, debug?.showGui, setDebug, setGui, setDebugConfig, scene, camera, controls]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;