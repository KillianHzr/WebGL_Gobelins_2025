import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EventBus } from "../Utils/EventEmitter.jsx";
import assets from "./assets";
import gsap from 'gsap';
import {EXRLoader} from "three/examples/jsm/loaders/EXRLoader.js";
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader.js";
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";

// Composant AssetManager
const AssetManager = React.forwardRef((props, ref) => {
    const { onReady } = props;
    const itemsRef = useRef({});
    const loadersRef = useRef({});
    const loadingManagerRef = useRef(null);
    const loadingOverlayRef = useRef(null);
    const loadingBarRef = useRef(null);

    const [loadingComplete, setLoadingComplete] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);
    const loadingCount = assets.length;

    // Méthodes d'utilitaire - exposées via la référence React
    const getItemNamesOfType = (type) => {
        return assets.filter(asset =>
            asset.type.toLowerCase() === type.toLowerCase()
        ).map(e => e.name);
    };

    const getItem = (name) => {
        // Vérification de base
        if (!itemsRef.current || !itemsRef.current[name]) {
            console.warn(`Asset not found: ${name}`);
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

    // Exposer les fonctions via la référence React
    React.useImperativeHandle(ref, () => ({
        getItem,
        getItemNamesOfType,
        items: itemsRef.current
    }));

    // Initialiser tout
    useEffect(() => {
        console.log('AssetManager: Initializing...');

        // Configurer le stockage des éléments
        itemsRef.current = {};

        // Initialiser l'interface utilisateur de chargement
        initProgressBar();

        // Configurer les loaders
        loadersRef.current = {};
        loadersRef.current.texture = new THREE.TextureLoader(loadingManagerRef.current);
        loadersRef.current.exr = new EXRLoader(loadingManagerRef.current);
        loadersRef.current.hdr = new RGBELoader(loadingManagerRef.current);
        loadersRef.current.fbx = new FBXLoader(loadingManagerRef.current);
        loadersRef.current.gltf = new GLTFLoader(loadingManagerRef.current);

        // Configurer DRACO
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./draco/');
        loadersRef.current.gltf.setDRACOLoader(dracoLoader);

        // Imprimer les assets pour le débogage
        console.log('Assets to load:', assets);

        // Commencer le chargement s'il y a des assets
        if (assets.length > 0) {
            console.log(`AssetManager: Loading ${assets.length} assets...`);
            loadAssets();
        } else {
            console.log('AssetManager: No assets to load, triggering ready event');
            if (onReady) onReady();
            EventBus.trigger('ready');
        }

        // Nettoyage
        return () => {
            // Nettoyer les loaders
            if (loadersRef.current?.gltf?.dracoLoader) {
                loadersRef.current.gltf.dracoLoader.dispose();
            }

            // Nettoyer les références
            loadersRef.current = null;
            itemsRef.current = null;
            loadingBarRef.current = null;
            loadingManagerRef.current = null;

            // Nettoyer les objets Three.js
            if (loadingOverlayRef.current) {
                loadingOverlayRef.current.geometry?.dispose();
                loadingOverlayRef.current.material?.dispose();
                loadingOverlayRef.current = null;
            }
        };
    }, [onReady]);

    // Initialiser la barre de progression et le gestionnaire de chargement
    const initProgressBar = () => {
        // Create loading overlay mesh
        const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
        const overlayMaterial = new THREE.ShaderMaterial({
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
                uAlpha: new THREE.Uniform(0)
            }
        });

        const loadingOverlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
        loadingOverlayMesh.name = 'LoadingOverlay';
        loadingOverlayMesh.material.uniforms.uAlpha.value = 1.0;
        loadingOverlayRef.current = loadingOverlayMesh;

        // Get loading bar DOM element
        loadingBarRef.current = document.querySelector('.loading-bar');
        if (loadingBarRef.current) {
            loadingBarRef.current.style.opacity = 1;
        }

        // Configurer le gestionnaire de chargement
        loadingManagerRef.current = new THREE.LoadingManager(
            // Callback chargé
            () => {
                console.log('AssetManager: All assets loaded successfully');
                setLoadingComplete(true);

                // Appeler le callback onReady et déclencher l'événement
                if (onReady) {
                    console.log('AssetManager: Calling onReady callback');
                    onReady();
                }
                console.log('AssetManager: Triggering ready event');
                EventBus.trigger('ready');

                // Animations de chargement terminées
                gsap.delayedCall(0.5, () => {
                    console.log(`AssetManager :: assets load complete`);

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
                console.log(`AssetManager: Loading progress ${itemsLoaded}/${itemsTotal} - ${itemUrl}`);
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
        console.log(`AssetManager: Starting to load ${assets.length} assets`);

        for (const asset of assets) {
            console.log(`AssetManager: Loading asset ${asset.name} (${asset.type}) from ${asset.path}`);

            if (asset.type.toLowerCase() === "texture") {
                loadersRef.current.texture.load(asset.path,
                    (texture) => {
                        if (asset.envmap) {
                            texture.mapping = THREE.EquirectangularReflectionMapping;
                        }
                        loadComplete(asset, texture);
                    },
                    undefined,
                    (error) => {
                        console.error(`AssetManager: Error loading texture ${asset.name}:`, error);
                    }
                );
            }
            else if (asset.type.toLowerCase() === "exr") {
                loadersRef.current.exr.load(asset.path,
                    (texture) => {
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        loadComplete(asset, texture);
                    },
                    undefined,
                    (error) => {
                        console.error(`AssetManager: Error loading EXR ${asset.name}:`, error);
                    }
                );
            }
            else if (asset.type.toLowerCase() === "hdr") {
                loadersRef.current.hdr.load(asset.path,
                    (texture) => {
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        loadComplete(asset, texture);
                    },
                    undefined,
                    (error) => {
                        console.error(`AssetManager: Error loading HDR ${asset.name}:`, error);
                    }
                );
            }
            else if (asset.type.toLowerCase() === "fbx") {
                loadersRef.current.fbx.load(asset.path,
                    (model) => {
                        loadComplete(asset, model);
                    },
                    undefined,
                    (error) => {
                        console.error(`AssetManager: Error loading FBX ${asset.name}:`, error);
                    }
                );
            }
            else if (asset.type.toLowerCase() === "gltf") {
                loadersRef.current.gltf.load(
                    asset.path,
                    (model) => {
                        loadComplete(asset, model);
                    },
                    (progress) => {
                        // Progress callback (optional)
                        console.log(`AssetManager: GLTF ${asset.name} loading progress:`, progress);
                    },
                    (error) => {
                        console.error(`AssetManager: Error loading GLTF ${asset.name}:`, error);
                    }
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

                textures.map((texObject) => {
                    const type = texObject[0];

                    if (typeof texObject[1] === 'object' && !Array.isArray(texObject[1]) && texObject[1] !== null) {
                        for (const [key, value] of Object.entries(texObject[1])) {
                            const url = path + value;

                            loadersRef.current.texture.load(
                                url,
                                (texture) => {
                                    texture.flipY = false;
                                    material[type][key] = texture;
                                    if (--nTex === 0) {
                                        loadComplete(asset, material);
                                    }
                                },
                                undefined,
                                (error) => {
                                    console.error(`AssetManager: Error loading material texture ${key} for ${asset.name}:`, error);
                                    if (--nTex === 0) {
                                        loadComplete(asset, material);
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
                                texture.flipY = false;
                                material[type] = texture;
                                if (--nTex === 0) {
                                    loadComplete(asset, material);
                                }
                            },
                            undefined,
                            (error) => {
                                console.error(`AssetManager: Error loading material texture ${type} for ${asset.name}:`, error);
                                if (--nTex === 0) {
                                    loadComplete(asset, material);
                                }
                            }
                        );
                    }
                });
            }
        }
    };

    // Gérer l'achèvement du chargement des assets
    const loadComplete = (asset, object) => {
        console.log(`AssetManager :: new item stored : ${asset.name}`);
        itemsRef.current[asset.name] = object;
    };

    // Ce composant ne rend pas d'interface utilisateur visible
    return null;
});

export default AssetManager;