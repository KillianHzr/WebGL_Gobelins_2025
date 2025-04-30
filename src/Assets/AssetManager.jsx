import React, { useEffect, useRef, useState } from 'react';
import { EventBus } from "../Utils/EventEmitter.jsx";
import baseAssets from "./assets";
import templateManager from '../Config/TemplateManager';
import gsap from 'gsap';
import {EXRLoader} from "three/examples/jsm/loaders/EXRLoader.js";
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader.js";
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";
import {
    EquirectangularReflectionMapping,
    LoadingManager,
    Mesh,
    PlaneGeometry,
    ShaderMaterial, Texture,
    TextureLoader,
    Uniform
} from "three";

// Activer ou désactiver les logs pour le débogage
const DEBUG_ASSET_MANAGER = false;

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (DEBUG_ASSET_MANAGER) console.log(`[AssetManager] ${message}`, ...args);
};

// Variable pour suivre l'état d'initialisation global
let isAssetManagerInitialized = false;

// Variable pour suivre les assets déjà chargés
const loadedAssets = new Map();

// Composant AssetManager
const AssetManager = React.forwardRef((props, ref) => {
    const { onReady } = props;

    const itemsRef = useRef({});
    const loadersRef = useRef({});
    const loadingManagerRef = useRef(null);
    const loadingOverlayRef = useRef(null);
    const loadingBarRef = useRef(null);
    const initializationInProgress = useRef(false);

    // Cache pour les matériaux partagés
    const sharedMaterialsRef = useRef({});

    const [loadingComplete, setLoadingComplete] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);

    // Fusionner les assets de base avec les assets du TemplateManager
    const templateAssets = templateManager.generateAssetList();
    const assets = [...baseAssets, ...templateAssets];
    const loadingCount = assets.length;

    // Méthodes d'utilitaire - exposées via la référence React
    const getItemNamesOfType = (type) => {
        return assets.filter(asset =>
            asset.type.toLowerCase() === type.toLowerCase()
        ).map(e => e.name);
    };

    // Vérifier si un asset est valide
    const isAssetValid = (asset) => {
        if (!asset) return false;

        // Pour les modèles GLTF
        if (asset.scene) {
            return true;
        }

        // Pour les textures
        if (asset instanceof Texture) {
            return true;
        }

        // Pour d'autres types d'assets
        return true;
    };

    // Vérifier si un asset est déjà chargé et valide
    const isAssetLoaded = (assetName) => {
        const asset = itemsRef.current[assetName];
        return isAssetValid(asset);
    };

    // Fonction auxiliaire pour trouver un asset de secours en cas d'erreur
    const findFallbackAsset = (assetType) => {
        if (!itemsRef.current) return null;

        // Chercher un asset existant du même type
        for (const [name, asset] of Object.entries(itemsRef.current)) {
            if (!asset) continue;

            const isGltf = assetType.toLowerCase() === "gltf" && asset.scene;
            const isTexture = assetType.toLowerCase() === "texture" && asset instanceof Texture;

            if (isGltf || isTexture) {
                return asset;
            }
        }

        return null;
    };

    const getItem = (name) => {
        // Vérification de base
        if (!itemsRef.current || !itemsRef.current[name]) {
            if (DEBUG_ASSET_MANAGER) {
                console.warn(`Asset not found: ${name}`);
            }
            return null;
        }

        // Vérifier si c'est un matériau gltf
        if (itemsRef.current[name]?.scene
            && itemsRef.current[name].scene.getObjectByName('pbr_node')
            && itemsRef.current[name].scene.getObjectByName('pbr_node').material) {
            return itemsRef.current[name].scene.getObjectByName('pbr_node').material;
        }

        return itemsRef.current[name];
    };

    // Optimise un modèle GLTF pour réduire les drawcalls
    const optimizeGltfModel = (gltfModel) => {
        if (!gltfModel || !gltfModel.scene) return gltfModel;

        try {
            // Optimiser les matériaux - partager les matériaux similaires
            gltfModel.scene.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Partager les matériaux
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(mat => {
                            const key = mat.type + '_' + (mat.color ? mat.color.getHexString() : 'nocolor');
                            if (!sharedMaterialsRef.current[key]) {
                                sharedMaterialsRef.current[key] = mat;
                            }
                            return sharedMaterialsRef.current[key];
                        });
                    } else {
                        const key = child.material.type + '_' + (child.material.color ? child.material.color.getHexString() : 'nocolor');
                        if (!sharedMaterialsRef.current[key]) {
                            sharedMaterialsRef.current[key] = child.material;
                        } else {
                            child.material = sharedMaterialsRef.current[key];
                        }
                    }

                    // Désactiver les shadows pour les petits objets
                    // Vérification plus robuste du boundingSphere
                    if (child.geometry) {
                        // Calculer la boundingSphere si elle n'existe pas
                        if (!child.geometry.boundingSphere) {
                            child.geometry.computeBoundingSphere();
                        }

                        // Vérifier si boundingSphere existe maintenant et appliquer la logique
                        // if (child.geometry.boundingSphere && child.geometry.boundingSphere.radius < 0.5) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        // }
                    }
                }
            });

            return gltfModel;
        } catch (error) {
            console.error("Error optimizing GLTF model:", error);
            return gltfModel; // Retourner le modèle non optimisé en cas d'erreur
        }
    };

    // Exposer les fonctions via la référence React
    React.useImperativeHandle(ref, () => ({
        getItem,
        getItemNamesOfType,
        items: itemsRef.current,
        sharedMaterials: sharedMaterialsRef.current,
        initialized: isAssetManagerInitialized,
        // Ajout de méthodes spécifiques au TemplateManager
        templateManager,
        addTemplate: (templateName, objectId, assetPath, priority = 999) => {
            // Ajouter le template
            templateManager.addTemplate(templateName, objectId, assetPath, priority);

            // Créer un nouvel asset
            const newAsset = {
                name: objectId,
                type: 'gltf',
                path: assetPath,
                license: 'CC-BY',
                author: 'Author',
                url: ''
            };

            // Charger dynamiquement l'asset si l'AssetManager est déjà initialisé
            if (loadingComplete && loadersRef.current.gltf) {
                loadersRef.current.gltf.load(
                    assetPath,
                    (model) => {
                        const optimizedModel = optimizeGltfModel(model);
                        itemsRef.current[objectId] = optimizedModel;
                        debugLog(`Dynamically loaded asset: ${objectId}`);
                    },
                    undefined,
                    (error) => {
                        console.error(`Error loading dynamic asset ${objectId}:`, error);
                    }
                );
            }

            return newAsset;
        },
        addIdMapping: (id, templateName) => {
            return templateManager.addIdMapping(id, templateName);
        }
    }));

    // Initialiser tout
    useEffect(() => {
        // Vérifier si l'AssetManager est déjà initialisé
        if (isAssetManagerInitialized) {
            debugLog('AssetManager already initialized, skipping initialization');

            // Assurez-vous que le callback onReady est appelé même si l'AssetManager est déjà initialisé
            if (onReady && typeof onReady === 'function') {
                onReady();
            }

            // Assurez-vous que l'événement ready est déclenché même si l'AssetManager est déjà initialisé
            setTimeout(() => {
                EventBus.trigger('ready');
            }, 0);

            return;
        }

        // Éviter les initialisations concurrentes
        if (initializationInProgress.current) {
            debugLog('AssetManager initialization already in progress, skipping');
            return;
        }

        initializationInProgress.current = true;

        console.log('AssetManager: Initializing...');

        // Configurer le stockage des éléments
        itemsRef.current = {};

        // Initialiser le cache de matériaux
        sharedMaterialsRef.current = {};
        // Rendre le cache de matériaux accessible globalement
        window.sharedMaterials = sharedMaterialsRef.current;

        // Définir l'AssetManager dans l'objet global window pour y accéder depuis d'autres composants
        window.assetManager = {
            getItem,
            getItemNamesOfType,
            items: itemsRef.current,
            templateManager,
            initialized: true
        };

        // Marquer l'AssetManager comme initialisé
        isAssetManagerInitialized = true;

        // Initialiser l'interface utilisateur de chargement
        initProgressBar();

        // Configurer les loaders
        loadersRef.current = {};
        loadersRef.current.texture = new TextureLoader(loadingManagerRef.current);
        loadersRef.current.exr = new EXRLoader(loadingManagerRef.current);
        loadersRef.current.hdr = new RGBELoader(loadingManagerRef.current);
        loadersRef.current.fbx = new FBXLoader(loadingManagerRef.current);
        loadersRef.current.gltf = new GLTFLoader(loadingManagerRef.current);

        // Configurer DRACO
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./draco/');
        loadersRef.current.gltf.setDRACOLoader(dracoLoader);

        debugLog('Total assets to load:', assets.length);
        debugLog('Base assets:', baseAssets.length);
        debugLog('Template assets:', templateAssets.length);

        // Commencer le chargement s'il y a des assets
        if (assets.length > 0) {
            debugLog(`AssetManager: Loading ${assets.length} assets...`);
            loadAssets();
        } else {
            debugLog('AssetManager: No assets to load, triggering ready event');
            if (onReady) onReady();
            EventBus.trigger('ready');
        }

        // Nettoyage
        return () => {
            // Nettoyer les loaders
            if (loadersRef.current?.gltf?.dracoLoader) {
                loadersRef.current.gltf.dracoLoader.dispose();
            }

            // Ne pas nettoyer les ressources globales lors du démontage du composant AssetManager
            // car elles peuvent être utilisées par d'autres composants qui en dépendent

            // Réinitialiser le flag d'initialisation en cours
            initializationInProgress.current = false;
        };
    }, [onReady]);

    // Initialiser la barre de progression et le gestionnaire de chargement
    const initProgressBar = () => {
        // Create loading overlay mesh
        const overlayGeometry = new PlaneGeometry(2, 2, 1, 1);
        const overlayMaterial = new ShaderMaterial({
            transparent: true,
            vertexShader: `
                void main() {
                    gl_Position = vec4(position, 1.);
                }
            `,
            fragmentShader: `
                uniform float uAlpha;
                void main() {
                    gl_FragColor = vec4(0., 0., 0., uAlpha);
                }
            `,
            uniforms: {
                uAlpha: new Uniform(0)
            }
        });

        const loadingOverlayMesh = new Mesh(overlayGeometry, overlayMaterial);
        loadingOverlayMesh.name = 'LoadingOverlay';
        loadingOverlayMesh.material.uniforms.uAlpha.value = 1.0;
        loadingOverlayRef.current = loadingOverlayMesh;

        // Get loading bar DOM element
        loadingBarRef.current = document.querySelector('.loading-bar');
        if (loadingBarRef.current) {
            loadingBarRef.current.style.opacity = 1;
        }

        // Configurer le gestionnaire de chargement
        loadingManagerRef.current = new LoadingManager(
            // Callback chargé
            () => {
                console.log('AssetManager: All assets loaded successfully');
                setLoadingComplete(true);

                // Ajouter cette ligne pour marquer les items comme chargés
                itemsRef.current.loaded = true;

                // Appeler le callback onReady et déclencher l'événement
                if (onReady) {
                    debugLog('AssetManager: Calling onReady callback');
                    onReady();
                }
                debugLog('AssetManager: Triggering ready event');
                EventBus.trigger('ready');

                // Animations de chargement terminées
                gsap.delayedCall(0.5, () => {
                    debugLog(`AssetManager :: assets load complete`);

                    if (loadingBarRef.current) {
                        loadingBarRef.current.classList.add('ended');
                        loadingBarRef.current.style.transform = '';
                    }

                    // Fade out loading overlay
                    const tl = gsap.timeline({
                        onComplete: () => {
                            if (loadingOverlayRef.current) {
                                loadingOverlayRef.current = null;
                            }
                        }
                    });

                    if (loadingOverlayRef.current) {
                        tl.to(loadingOverlayRef.current.material.uniforms.uAlpha, {
                            value: 0.0,
                            ease: "power4.in",
                            duration: 1
                        });
                    }
                });
            },

            // Callback de progression
            (itemUrl, itemsLoaded, itemsTotal) => {
                debugLog(`AssetManager: Loading progress ${itemsLoaded}/${itemsTotal} - ${itemUrl}`);
                if (loadingBarRef.current) {
                    const progressRatio = itemsLoaded / itemsTotal;
                    loadingBarRef.current.style.transform = `scaleX(${progressRatio})`;
                }
                setLoadedCount(itemsLoaded);
            },

            // Callback d'erreur
            (url) => {
                console.error(`AssetManager: Error loading asset from URL: ${url}`);
            }
        );
    };

    // Charger les assets
    const loadAssets = () => {
        debugLog(`AssetManager: Starting to load ${assets.length} assets`);

        // Pour éviter les doublons, garder une trace des URL déjà chargées
        const loadedUrls = new Set();
        // Pour éviter les doublons de noms, garder une trace des noms déjà traités
        const processedNames = new Set();

        // Compter combien d'assets sont déjà chargés pour mettre à jour la progression
        let alreadyLoadedCount = 0;

        for (const asset of assets) {
            // Éviter les doublons de noms
            if (processedNames.has(asset.name)) {
                debugLog(`AssetManager: Skipping duplicate asset name: ${asset.name}`);
                continue;
            }
            processedNames.add(asset.name);

            // Vérifier si l'asset est déjà chargé et valide
            if (isAssetLoaded(asset.name)) {
                debugLog(`AssetManager: Asset ${asset.name} already loaded, skipping`);
                alreadyLoadedCount++;
                continue;
            }

            // Vérifier si cet asset existe dans loadedAssets (cache global)
            if (loadedAssets.has(asset.name) && isAssetValid(loadedAssets.get(asset.name))) {
                debugLog(`AssetManager: Asset ${asset.name} found in global cache, reusing`);
                itemsRef.current[asset.name] = loadedAssets.get(asset.name);
                alreadyLoadedCount++;
                continue;
            }

            debugLog(`AssetManager: Loading asset ${asset.name} (${asset.type}) from ${asset.path}`);

            // Vérifier si l'URL a déjà été chargée
            if (loadedUrls.has(asset.path)) {
                debugLog(`AssetManager: Asset ${asset.name} has the same URL as a previously loaded asset, reusing...`);
                // Rechercher le nom de l'asset déjà chargé avec cette URL
                let sourceAssetName = null;
                for (const key in itemsRef.current) {
                    const loadedAsset = assets.find(a => a.name === key);
                    if (loadedAsset && loadedAsset.path === asset.path) {
                        sourceAssetName = key;
                        break;
                    }
                }

                // Si on a trouvé la source, copier la référence
                if (sourceAssetName && itemsRef.current[sourceAssetName] && isAssetValid(itemsRef.current[sourceAssetName])) {
                    // Cloner l'objet pour éviter les problèmes de référence
                    if (asset.type.toLowerCase() === "gltf" && itemsRef.current[sourceAssetName].scene) {
                        try {
                            // Pour GLTF, cloner la scène
                            const clonedModel = {
                                scene: itemsRef.current[sourceAssetName].scene.clone(),
                                animations: itemsRef.current[sourceAssetName].animations
                            };
                            loadComplete(asset, clonedModel);
                        } catch (error) {
                            console.warn(`Error cloning GLTF model ${asset.name}:`, error);
                            // Continuer avec le chargement normal
                        }
                    } else {
                        // Pour d'autres types, réutiliser simplement la référence
                        loadComplete(asset, itemsRef.current[sourceAssetName]);
                    }
                    continue;
                }
            }

            // Ajouter l'URL à l'ensemble des URLs chargées
            loadedUrls.add(asset.path);

            // Gérer les erreurs de manière plus robuste pour chaque type d'asset
            const handleLoadError = (error) => {
                console.error(`AssetManager: Error loading ${asset.type} ${asset.name} from ${asset.path}:`, error);

                // Tenter de récupérer un asset déjà chargé du même type comme fallback
                const fallbackAsset = findFallbackAsset(asset.type);
                if (fallbackAsset) {
                    console.warn(`AssetManager: Using fallback for ${asset.name}`);
                    loadComplete(asset, fallbackAsset);
                }
            };

            if (asset.type.toLowerCase() === "texture") {
                loadersRef.current.texture.load(asset.path,
                    (texture) => {
                        if (asset.envmap) {
                            texture.mapping = EquirectangularReflectionMapping;
                        }
                        loadComplete(asset, texture);
                        // Stocker pour une réutilisation future
                        loadedAssets.set(asset.name, texture);
                    },
                    undefined,
                    handleLoadError
                );
            }
            else if (asset.type.toLowerCase() === "exr") {
                loadersRef.current.exr.load(asset.path,
                    (texture) => {
                        texture.mapping = EquirectangularReflectionMapping;
                        loadComplete(asset, texture);
                        loadedAssets.set(asset.name, texture);
                    },
                    undefined,
                    handleLoadError
                );
            }
            else if (asset.type.toLowerCase() === "hdr") {
                loadersRef.current.hdr.load(asset.path,
                    (texture) => {
                        texture.mapping = EquirectangularReflectionMapping;
                        loadComplete(asset, texture);
                        loadedAssets.set(asset.name, texture);
                    },
                    undefined,
                    handleLoadError
                );
            }
            else if (asset.type.toLowerCase() === "fbx") {
                loadersRef.current.fbx.load(asset.path,
                    (model) => {
                        loadComplete(asset, model);
                        loadedAssets.set(asset.name, model);
                    },
                    undefined,
                    handleLoadError
                );
            }
            else if (asset.type.toLowerCase() === "gltf") {
                loadersRef.current.gltf.load(
                    asset.path,
                    (model) => {
                        try {
                            // Optimiser le modèle pour réduire les drawcalls
                            const optimizedModel = optimizeGltfModel(model);
                            loadComplete(asset, optimizedModel);
                            loadedAssets.set(asset.name, optimizedModel);
                        } catch (error) {
                            console.error(`Error optimizing GLTF model ${asset.name}:`, error);
                            // En cas d'erreur d'optimisation, utiliser le modèle tel quel
                            loadComplete(asset, model);
                            loadedAssets.set(asset.name, model);
                        }
                    },
                    (progress) => {
                        // Progress callback (optional)
                        if (DEBUG_ASSET_MANAGER) {
                            console.log(`AssetManager: GLTF ${asset.name} loading progress:`, progress);
                        }
                    },
                    handleLoadError
                );
            }
            else if (asset.type.toLowerCase() === "material") {
                const textures = Object.entries(asset.textures);
                const material = Object.assign(asset.textures);

                let nTex = textures.length;
                let path = asset.path;
                if (path.charAt(path.length - 1) !== '/') {
                    path += '/';
                }

                textures.forEach((texObject) => {
                    const type = texObject[0];

                    if (typeof texObject[1] === 'object' && !Array.isArray(texObject[1]) && texObject[1] !== null) {
                        const textureEntries = Object.entries(texObject[1]);
                        nTex += textureEntries.length - 1; // Ajuster le compteur

                        for (const [key, value] of textureEntries) {
                            const url = path + value;

                            loadersRef.current.texture.load(
                                url,
                                (texture) => {
                                    texture.flipY = true;
                                    material[type][key] = texture;
                                    nTex--;
                                    if (nTex === 0) {
                                        loadComplete(asset, material);
                                        loadedAssets.set(asset.name, material);
                                    }
                                },
                                undefined,
                                (error) => {
                                    console.error(`AssetManager: Error loading material texture ${key} for ${asset.name}:`, error);
                                    nTex--;
                                    if (nTex === 0) {
                                        loadComplete(asset, material);
                                        loadedAssets.set(asset.name, material);
                                    }
                                }
                            );
                        }
                    }
                    else {
                        const url = path + texObject[1];
                        loadersRef.current.texture.load(
                            url,
                            (texture) => {
                                texture.flipY = true;
                                material[type] = texture;
                                nTex--;
                                if (nTex === 0) {
                                    loadComplete(asset, material);
                                    loadedAssets.set(asset.name, material);
                                }
                            },
                            undefined,
                            (error) => {
                                console.error(`AssetManager: Error loading material texture ${type} for ${asset.name}:`, error);
                                nTex--;
                                if (nTex === 0) {
                                    loadComplete(asset, material);
                                    loadedAssets.set(asset.name, material);
                                }
                            }
                        );
                    }
                });
            }
        }

        // Si tous les assets sont déjà chargés, déclencher directement l'événement "ready"
        if (alreadyLoadedCount === assets.length) {
            console.log('AssetManager: All assets already loaded, triggering ready event immediately');
            if (onReady) {
                onReady();
            }
            EventBus.trigger('ready');
        }
    };

    // Gérer l'achèvement du chargement des assets
    const loadComplete = (asset, object) => {
        debugLog(`AssetManager :: new item stored : ${asset.name}`);
        itemsRef.current[asset.name] = object;
    };

    // Ce composant ne rend pas d'interface utilisateur visible
    return null;
});

export default AssetManager;