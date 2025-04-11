import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/Addons.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import EventEmitter from "../Utils/EventEmitter";
import assets from "./assets";
import App from '../App';
import gsap from 'gsap';

export default function AssetManager({ onReady }) {
    const appRef = useRef(null);
    const emitterRef = useRef(new EventEmitter());
    const itemsRef = useRef({});
    const loadersRef = useRef({});
    const loadingManagerRef = useRef(null);
    const loadingOverlayRef = useRef(null);
    const loadingBarRef = useRef(null);

    const [loadingComplete, setLoadingComplete] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);
    const loadingCount = assets.length;

    // Initialize everything
    useEffect(() => {
        // Initialize app
        appRef.current = new App();

        // Setup event listener for ready event
        if (onReady) {
            emitterRef.current.on('ready', onReady);
        }

        // Setup items storage
        itemsRef.current = {};

        // Initialize loading UI
        initProgressBar();

        // Setup loaders
        loadersRef.current = {};
        loadersRef.current.texture = new THREE.TextureLoader(loadingManagerRef.current);
        loadersRef.current.exr = new EXRLoader(loadingManagerRef.current);
        loadersRef.current.hdr = new RGBELoader(loadingManagerRef.current);
        loadersRef.current.fbx = new FBXLoader(loadingManagerRef.current);
        loadersRef.current.gltf = new GLTFLoader(loadingManagerRef.current);

        // Setup DRACO
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./lib/draco/');
        loadersRef.current.gltf.setDRACOLoader(dracoLoader);

        // Start loading if there are assets
        if (assets.length > 0) {
            loadAssets();
        } else {
            emitterRef.current.trigger('ready');
        }

        // Cleanup
        return () => {
            // Cleanup event listeners
            if (onReady) {
                emitterRef.current.off('ready', onReady);
            }

            // Clean up loaders
            if (loadersRef.current?.gltf?.dracoLoader) {
                loadersRef.current.gltf.dracoLoader.dispose();
            }

            // Clean up references
            loadersRef.current = null;
            itemsRef.current = null;
            appRef.current = null;
            loadingBarRef.current = null;
            loadingManagerRef.current = null;

            // Clean up Three.js objects
            if (loadingOverlayRef.current) {
                appRef.current?.scene?.remove(loadingOverlayRef.current);
                loadingOverlayRef.current.geometry.dispose();
                loadingOverlayRef.current.material.dispose();
                loadingOverlayRef.current = null;
            }
        };
    }, [onReady]);

    // Initialize progress bar and loading manager
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

        // Add to scene if app is initialized
        if (appRef.current?.scene) {
            appRef.current.scene.add(loadingOverlayMesh);
        }

        // Get loading bar DOM element
        loadingBarRef.current = document.querySelector('.loading-bar');
        if (loadingBarRef.current) {
            loadingBarRef.current.style.opacity = 1;
        }

        // Setup loading manager
        loadingManagerRef.current = new THREE.LoadingManager(
            // Loaded callback
            () => {
                setLoadingComplete(true);
                emitterRef.current.trigger('ready');

                // Match original 500ms delay
                gsap.delayedCall(0.5, () => {
                    console.log(`AssetManager :: assets load complete`);

                    if (loadingBarRef.current) {
                        loadingBarRef.current.classList.add('ended');
                        loadingBarRef.current.style.transform = '';
                    }

                    // Fade out loading overlay
                    const tl = gsap.timeline({
                        onComplete: () => {
                            if (appRef.current?.scene && loadingOverlayRef.current) {
                                appRef.current.scene.remove(loadingOverlayRef.current);
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

            // Progress callback
            (itemUrl, itemsLoaded, itemsTotal) => {
                if (loadingBarRef.current) {
                    const progressRatio = itemsLoaded / itemsTotal;
                    loadingBarRef.current.style.transform = `scaleX(${progressRatio})`;
                }
                setLoadedCount(itemsLoaded);
            }
        );
    };

    // Load assets
    const loadAssets = () => {
        for (const asset of assets) {
            if (asset.type.toLowerCase() === "texture") {
                loadersRef.current.texture.load(asset.path, (texture) => {
                    if (asset.envmap) {
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                    }
                    loadComplete(asset, texture);
                });
            }
            else if (asset.type.toLowerCase() === "exr") {
                loadersRef.current.exr.load(asset.path, (texture) => {
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    loadComplete(asset, texture);
                });
            }
            else if (asset.type.toLowerCase() === "hdr") {
                loadersRef.current.hdr.load(asset.path, (texture) => {
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    loadComplete(asset, texture);
                });
            }
            else if (asset.type.toLowerCase() === "fbx") {
                loadersRef.current.fbx.load(asset.path, (model) => {
                    loadComplete(asset, model);
                });
            }
            else if (asset.type.toLowerCase() === "gltf") {
                loadersRef.current.gltf.load(asset.path, (model) => {
                    loadComplete(asset, model);
                });
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

                            loadersRef.current.texture.load(url, (texture) => {
                                texture.flipY = false;
                                material[type][key] = texture;
                                if (--nTex === 0) {
                                    loadComplete(asset, material);
                                }
                            });
                        }
                    }
                    else {
                        const url = path + texObject[1];
                        loadersRef.current.texture.load(url, (texture) => {
                            texture.flipY = false;
                            material[type] = texture;
                            if (--nTex === 0) {
                                loadComplete(asset, material);
                            }
                        });
                    }
                });
            }
        }
    };

    // Handle asset load completion
    const loadComplete = (asset, object) => {
        console.log(`AssetManager :: new item stored : ${asset.name}`);
        itemsRef.current[asset.name] = object;
    };

    // Utility methods - exposed through ref forwarding
    const getItemNamesOfType = (type) => {
        return assets.filter(asset =>
            asset.type.toLowerCase() === type.toLowerCase()
        ).map(e => e.name);
    };

    const getItem = (name) => {
        // Check if it's a gltf material
        if (itemsRef.current[name]?.scene
            && itemsRef.current[name].scene.getObjectByName('pbr_node')
            && itemsRef.current[name].scene.getObjectByName('pbr_node').material) {
            return itemsRef.current[name].scene.getObjectByName('pbr_node').material;
        }

        return itemsRef.current[name];
    };

    // Expose functions via React ref
    React.useImperativeHandle(React.forwardRef, () => ({
        getItem,
        getItemNamesOfType,
        items: itemsRef.current
    }));

    // This component doesn't render visible UI
    return null;
}