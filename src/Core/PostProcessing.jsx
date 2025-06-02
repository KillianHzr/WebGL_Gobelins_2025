import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import useStore from '../Store/useStore';
import {
    NoToneMapping,
    LinearToneMapping,
    ReinhardToneMapping,
    CineonToneMapping,
    ACESFilmicToneMapping,
    Object3D,
    Vector2,
    Vector3,
    Scene,
    WebGLRenderTarget,
    RGBAFormat,
    Material,
    MeshBasicMaterial,
    Color
} from 'three';
import guiConfig from "../Config/guiConfig.js";
import { EventBus } from '../Utils/EventEmitter';

// Shader pour les God Rays volumétriques avec masque de lumière
const GodRaysShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'tMask': { value: null }, // NOUVEAU: masque pour isoler la lumière principale
        'fX': { value: 0.5 },
        'fY': { value: 0.5 },
        'fExposure': { value: 0.6 },
        'fDecay': { value: 0.93 },
        'fDensity': { value: 0.96 },
        'fWeight': { value: 0.4 },
        'fClamp': { value: 1.0 },
        'fMaskIntensity': { value: 1.0 } // NOUVEAU: intensité du masque
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,

    fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform sampler2D tMask;
        uniform float fX;
        uniform float fY;
        uniform float fExposure;
        uniform float fDecay;
        uniform float fDensity;
        uniform float fWeight;
        uniform float fClamp;
        uniform float fMaskIntensity;
        
        const int iSamples = 500;
        
        void main() {
            vec2 deltaTextCoord = vec2(vUv - vec2(fX, fY));
            vec2 textCoo = vUv.xy;
            deltaTextCoord *= 1.0 / float(iSamples) * fDensity;
            float illuminationDecay = 1.0;
            
            vec4 color = texture2D(tDiffuse, textCoo);
            vec4 maskColor = texture2D(tMask, textCoo);
            
            // NOUVEAU: Utiliser le masque pour déterminer où appliquer les god rays
            float maskStrength = dot(maskColor.rgb, vec3(0.299, 0.587, 0.114)) * fMaskIntensity;
            
            vec4 godRayColor = vec4(0.0);
            
            for(int i = 0; i < iSamples; i++) {
                textCoo -= deltaTextCoord;
                vec4 texSample = texture2D(tDiffuse, textCoo);
                vec4 maskSample = texture2D(tMask, textCoo);
                
                // Appliquer le masque à chaque échantillon
                float sampleMask = dot(maskSample.rgb, vec3(0.299, 0.587, 0.114));
                texSample *= illuminationDecay * fWeight * sampleMask;
                godRayColor += texSample;
                illuminationDecay *= fDecay;
            }
            
            godRayColor *= fExposure;
            godRayColor = clamp(godRayColor, 0.0, fClamp);
            
            // Mélanger les god rays avec la couleur originale
            // Les god rays n'apparaissent que là où le masque est présent
            gl_FragColor = color + godRayColor * maskStrength;
        }
    `
};

// Matériau pour le masque de lumière principale
const createLightMaskMaterial = (lightColor = '#ffffff') => {
    return new MeshBasicMaterial({
        color: new Color(lightColor),
        transparent: false,
        fog: false
    });
};

// Matériau noir pour masquer les autres objets
const createBlackMaskMaterial = () => {
    return new MeshBasicMaterial({
        color: new Color(0x000000),
        transparent: false,
        fog: false
    });
};

export default function PostProcessing() {
    const { scene, camera, gl } = useThree();
    const { debug, gui } = useStore();
    const composerRef = useRef(null);
    const bloomPassRef = useRef(null);
    const godRaysPassRef = useRef(null);
    const postProcessingGroupRef = useRef(null);

    // NOUVEAU: Références pour le masque de lumière
    const maskSceneRef = useRef(new Scene());
    const maskRenderTargetRef = useRef(null);
    const originalMaterialsRef = useRef(new Map());
    const lightMaskMaterialRef = useRef(null);
    const blackMaskMaterialRef = useRef(null);
    const mainLightRef = useRef(null);

    // État pour les God Rays
    const godRaysSettingsRef = useRef({
        enabled: true,
        exposure: 0.93,
        decay: 0.94,
        density: 0.9,
        weight: 0.01,
        clamp: 0.5,
        lightPosX: 1,
        lightPosY: 1.0,
        maskIntensity: 1.0 // NOUVEAU
    });

    const bloomSettingsRef = useRef({
        enabled: true,
        strength: 0.4,
        radius: 0.0,
        threshold: 1.0
    });

    // NOUVEAU: Fonction pour identifier la lumière principale dans la scène
    const findMainLight = () => {
        let mainLight = null;

        // Chercher la lumière principale par nom ou type
        scene.traverse((object) => {
            if (object.isPointLight || object.isDirectionalLight) {
                // Priorité aux lumières nommées explicitement comme principales
                if (object.name && (
                    object.name.includes('main') ||
                    object.name.includes('Main') ||
                    object.name.includes('sun') ||
                    object.name.includes('Sun')
                )) {
                    mainLight = object;
                    return;
                }

                // Si pas de nom spécifique, prendre la plus puissante (sauf la flashlight)
                if (!object.name?.includes('flashlight') &&
                    !object.name?.includes('Flashlight') &&
                    (!mainLight || object.intensity > mainLight.intensity)) {
                    mainLight = object;
                }
            }
        });

        return mainLight;
    };

    // NOUVEAU: Fonction pour vérifier si un objet est dans la zone d'influence de la lumière principale
    const isInMainLightInfluence = (object) => {
        const mainLight = findMainLight();
        if (!mainLight) return false;

        const objectPosition = new Vector3();
        object.getWorldPosition(objectPosition);

        const lightPosition = mainLight.position.clone();
        const distance = objectPosition.distanceTo(lightPosition);

        // Définir une zone d'influence pour la lumière principale
        const maxInfluenceDistance = mainLight.distance || 100;

        return distance <= maxInfluenceDistance;
    };

    // NOUVEAU: Fonction pour déterminer si un objet contribue à la lumière principale
    const isMainLightContributor = (object) => {
        // APPROCHE ULTRA-RESTRICTIVE : LISTE BLANCHE SEULEMENT

        // 🚫 EXCLUSIONS ABSOLUES - ces objets ne contribuent JAMAIS aux god rays

        // 1. Tous les objets émissifs (écrans, etc.)
        if (object.userData?.isEmissive) {
            return false;
        }

        // 2. Tous les objets interactifs du SceneObjectManager (ils ont des glow effects)
        if (object.userData?.objectKey || object.userData?.markerId) {
            return false;
        }

        // 3. Exclusions par nom - TOUS les objets suspects
        if (object.name && (
            // Écrans et émissions
            object.name.includes('Screen') ||
            object.name.includes('Emission') ||
            object.name.includes('screen') ||
            object.name.includes('emission') ||

            // Visons et animaux
            object.name.includes('Vison') ||
            object.name.includes('vison') ||
            object.name.includes('Animal') ||
            object.name.includes('animal') ||

            // Markers et effets
            object.name.includes('marker') ||
            object.name.includes('Marker') ||
            object.name.includes('Effect') ||
            object.name.includes('Glow') ||
            object.name.includes('Outline') ||
            object.name.includes('outline') ||

            // Éclairage
            object.name.includes('Flashlight') ||
            object.name.includes('flashlight') ||
            object.name.includes('Spotlight') ||
            object.name.includes('spotlight') ||
            object.name.includes('Light') ||

            // Système
            object.name.includes('Helper') ||
            object.name.includes('Target') ||
            object.name.includes('target') ||

            // Objets spécifiques du SceneObjectManager
            object.name.includes('DirectionPanel') ||
            object.name.includes('TrunkLarge') ||
            object.name.includes('TrunkThin') ||
            object.name.includes('MultipleLeaf') ||
            object.name.includes('AnimalPaws') ||
            object.name.includes('JumpRock') ||
            object.name.includes('RiverCheckpoint') ||
            object.name.includes('DataCenter') ||
            object.name.includes('VisonDead') ||
            object.name.includes('BigRock') ||
            object.name.includes('TreeStump')
        )) {
            return false;
        }

        // 4. Exclure les lumières elles-mêmes
        if (object.isLight || object.isSpotLight || object.isPointLight || object.isDirectionalLight) {
            return false;
        }

        // 5. Exclure les objets du post-processing
        if (object.userData?.isPostProcessingObject ||
            (object.parent && object.parent.name === 'PostProcessing')) {
            return false;
        }

        // 6. Exclure les objets proches de la caméra (zone flashlight)
        try {
            const position = new Vector3();
            object.getWorldPosition(position);
            if (camera && position.distanceTo(camera.position) < 10) {
                return false;
            }
        } catch (error) {
            // Si erreur de position, exclure par sécurité
            return false;
        }

        // ✅ INCLUSIONS - LISTE BLANCHE TRÈS RESTRICTIVE

        // SEULEMENT le terrain/sol principal
        if (object.name && (
            object.name.includes('Ground') ||
            object.name.includes('Map') ||
            object.name.includes('Terrain') ||
            object.name === 'MapInstanceModel'
        )) {
            return true;
        }

        // SEULEMENT les instances de forêt générées automatiquement (pas les objets interactifs)
        if (object.name && (
            object.name.includes('_lod') && (
                object.name.includes('Tree') ||
                object.name.includes('Bush') ||
                object.name.includes('Plant') ||
                object.name.includes('Mushroom') ||
                object.name.includes('Flower')
            )
        )) {
            // Vérifier que ce n'est pas un objet interactif
            if (!object.userData?.objectKey && !object.userData?.markerId) {
                return true;
            }
        }

        // 🚫 DÉFAUT : EXCLURE TOUT LE RESTE
        return false;
    };

    // NOUVEAU: Fonction pour créer le masque de lumière
    const createLightMask = () => {
        if (!maskRenderTargetRef.current) {
            // Créer le render target pour le masque
            maskRenderTargetRef.current = new WebGLRenderTarget(
                window.innerWidth * window.devicePixelRatio,
                window.innerHeight * window.devicePixelRatio,
                {
                    format: RGBAFormat,
                    generateMipmaps: false
                }
            );
        }

        // Créer les matériaux de masque
        if (!lightMaskMaterialRef.current) {
            lightMaskMaterialRef.current = createLightMaskMaterial('#ffffff');
        }
        if (!blackMaskMaterialRef.current) {
            blackMaskMaterialRef.current = createBlackMaskMaterial();
        }

        // Configurer la scène de masque
        const maskScene = maskSceneRef.current;
        maskScene.clear();

        // Copier la caméra pour le masque
        const maskCamera = camera.clone();
        maskScene.add(maskCamera);

        // Identifier la lumière principale
        const mainLight = findMainLight();
        if (!mainLight) {
            console.warn('PostProcessing: Aucune lumière principale trouvée pour les god rays');
            return;
        }

        console.log('PostProcessing: Lumière principale identifiée:', mainLight.type, mainLight.name || 'sans nom');

        // Compteurs pour debug
        let whiteMaskObjects = 0;
        let blackMaskObjects = 0;

        // Parcourir la scène pour identifier les objets à masquer
        scene.traverse((object) => {
            if (object.isMesh && object.visible) {
                const clonedObject = object.clone();

                // Déterminer si cet objet doit contribuer aux god rays
                const shouldContributeToGodRays = isMainLightContributor(object) &&
                    isInMainLightInfluence(object);

                if (shouldContributeToGodRays) {
                    // Utiliser le matériau blanc pour les objets éclairés par la lumière principale
                    clonedObject.material = lightMaskMaterialRef.current;
                    whiteMaskObjects++;
                } else {
                    // Utiliser le matériau noir pour tous les autres objets
                    clonedObject.material = blackMaskMaterialRef.current;
                    blackMaskObjects++;
                }

                maskScene.add(clonedObject);
            }
        });

        console.log(`PostProcessing: Masque créé - ${whiteMaskObjects} objets blancs, ${blackMaskObjects} objets noirs`);

        // Stocker la référence de la lumière principale
        mainLightRef.current = mainLight;
    };

    // NOUVEAU: Fonction pour rendre le masque
    const renderLightMask = () => {
        if (!maskRenderTargetRef.current || !maskSceneRef.current) return;

        // Sauvegarder l'état actuel
        const currentRenderTarget = gl.getRenderTarget();
        const currentClearColor = gl.getClearColor(new Color());
        const currentClearAlpha = gl.getClearAlpha();

        // Configurer pour le rendu du masque
        gl.setRenderTarget(maskRenderTargetRef.current);
        gl.setClearColor(0x000000, 1.0);
        gl.clear();

        // Rendre la scène de masque
        gl.render(maskSceneRef.current, camera);

        // Restaurer l'état
        gl.setRenderTarget(currentRenderTarget);
        gl.setClearColor(currentClearColor, currentClearAlpha);
    };

    // Fonction pour convertir la position 3D de la lumière en coordonnées écran 2D
    const updateLightScreenPosition = (lightPosition = null) => {
        if (!camera || !godRaysPassRef.current) return;

        // Si aucune position spécifiée, utiliser la lumière principale
        let targetPosition;
        if (lightPosition) {
            targetPosition = lightPosition;
        } else {
            const mainLight = mainLightRef.current || findMainLight();
            if (!mainLight) {
                console.warn('PostProcessing: Aucune lumière principale pour mettre à jour la position des god rays');
                return;
            }
            targetPosition = [mainLight.position.x, mainLight.position.y, mainLight.position.z];
        }

        const lightPos3D = new Vector3(targetPosition[0], targetPosition[1], targetPosition[2]);
        lightPos3D.project(camera);

        // Convertir de -1,1 à 0,1
        const screenX = (lightPos3D.x + 1) / 2;
        const screenY = (lightPos3D.y + 1) / 2;

        // Mettre à jour les uniforms seulement si la position a significativement changé
        const currentX = godRaysPassRef.current.uniforms.fX.value;
        const currentY = godRaysPassRef.current.uniforms.fY.value;

        if (Math.abs(screenX - currentX) > 0.01 || Math.abs(screenY - currentY) > 0.01) {
            godRaysPassRef.current.uniforms.fX.value = screenX;
            godRaysPassRef.current.uniforms.fY.value = screenY;

            // Mettre à jour les settings pour le GUI
            godRaysSettingsRef.current.lightPosX = screenX;
            godRaysSettingsRef.current.lightPosY = screenY;
        }
    };

    useEffect(() => {
        gl.autoClear = false;
        gl.toneMapping = CineonToneMapping;
        gl.toneMappingExposure = 2.0;

        // Créer un groupe pour le post-processing
        if (!postProcessingGroupRef.current) {
            postProcessingGroupRef.current = new Object3D();
            postProcessingGroupRef.current.name = 'PostProcessing';
            scene.add(postProcessingGroupRef.current);
        }

        // NOUVEAU: Initialiser le système de masque
        createLightMask();

        // Créer le compositeur
        const composer = new EffectComposer(gl);

        // Ajouter le render pass initial
        const renderPass = new RenderPass(scene, camera);
        renderPass.name = 'RenderPass';
        composer.addPass(renderPass);

        // Ajouter le God Rays Pass AVANT le bloom pour de meilleurs résultats
        if (godRaysSettingsRef.current.enabled) {
            const godRaysPass = new ShaderPass(GodRaysShader);
            godRaysPass.name = 'GodRaysPass';

            // Configurer les uniforms
            godRaysPass.uniforms.fX.value = godRaysSettingsRef.current.lightPosX;
            godRaysPass.uniforms.fY.value = godRaysSettingsRef.current.lightPosY;
            godRaysPass.uniforms.fExposure.value = godRaysSettingsRef.current.exposure;
            godRaysPass.uniforms.fDecay.value = godRaysSettingsRef.current.decay;
            godRaysPass.uniforms.fDensity.value = godRaysSettingsRef.current.density;
            godRaysPass.uniforms.fWeight.value = godRaysSettingsRef.current.weight;
            godRaysPass.uniforms.fClamp.value = godRaysSettingsRef.current.clamp;
            godRaysPass.uniforms.fMaskIntensity.value = godRaysSettingsRef.current.maskIntensity;

            // NOUVEAU: Assigner le masque de lumière
            if (maskRenderTargetRef.current) {
                godRaysPass.uniforms.tMask.value = maskRenderTargetRef.current.texture;
            }

            composer.addPass(godRaysPass);
            godRaysPassRef.current = godRaysPass;
        }

        // Ajouter le UnrealBloomPass pour l'effet de bloom
        if (bloomSettingsRef.current.enabled) {
            const resolution = new Vector2(
                window.innerWidth * (window.devicePixelRatio * 0.85),
                window.innerHeight * (window.devicePixelRatio * 0.85)
            );
            const bloomPass = new UnrealBloomPass(
                resolution,
                bloomSettingsRef.current.strength,
                bloomSettingsRef.current.radius,
                bloomSettingsRef.current.threshold
            );
            bloomPass.name = 'BloomPass';

            // Configurer le bloom
            bloomPass.threshold = bloomSettingsRef.current.threshold;
            bloomPass.strength = bloomSettingsRef.current.strength;
            bloomPass.radius = bloomSettingsRef.current.radius;

            // Définir comme dernier pass
            bloomPass.renderToScreen = true;

            composer.addPass(bloomPass);
            bloomPassRef.current = bloomPass;
        }

        // Stocker les références
        composerRef.current = composer;

        // Rendre le composer accessible depuis l'extérieur
        postProcessingGroupRef.current.userData.composer = composer;
        postProcessingGroupRef.current.userData.passes = composer.passes;

        // Activer les passes par défaut
        if (composerRef.current) {
            composerRef.current.passes.forEach(pass => {
                // Sauvegarder l'état original
                if (!pass.userData) pass.userData = {};
                pass.userData.originalEnabled = pass.enabled;

                // Désactiver les passes coûteuses par défaut, sauf BloomPass et GodRaysPass
                if (pass.name && (
                    pass.name.includes('SSAOPass') ||
                    pass.name.includes('BokehPass') ||
                    pass.name.includes('SAOPass') ||
                    pass.name.includes('DOFPass')
                )) {
                    pass.enabled = false;
                }
            });
        }

        // Écouter les mises à jour de position de lumière PRINCIPALE uniquement
        const lightUpdateSubscription = EventBus.on('lights-values-updated', (data) => {
            // Vérifier que c'est bien la lumière principale qui a été mise à jour
            if (data.position && godRaysPassRef.current) {
                // Mettre à jour la position des god rays uniquement pour la lumière principale
                updateLightScreenPosition(data.position);

                // NOUVEAU: Mettre à jour le masque seulement si c'est la lumière principale
                const mainLight = findMainLight();
                if (mainLight && mainLightRef.current === mainLight) {
                    createLightMask();
                    renderLightMask();
                }
            }
        });

        // NOUVEAU: Écouteur spécifique pour les changements de la lumière principale
        const mainLightUpdateSubscription = EventBus.on('main-light-updated', (data) => {
            if (data.position && godRaysPassRef.current) {
                updateLightScreenPosition(data.position);
                createLightMask();
                renderLightMask();
            }
        });

        // NOUVEAU: Mettre à jour automatiquement la position des god rays périodiquement
        const updateInterval = setInterval(() => {
            if (godRaysPassRef.current && camera) {
                updateLightScreenPosition(); // Sans paramètre = utilise la lumière principale
            }
        }, 1000); // Toutes les secondes

        // Ajouter les contrôles GUI si disponibles
        if (debug && gui) {
            const ppFolder = gui.addFolder('Post-Processing');

            // Dossier pour les God Rays
            const godRaysFolder = ppFolder.addFolder('God Rays');

            // Contrôles pour les God Rays
            godRaysFolder.add(godRaysSettingsRef.current, 'enabled')
                .name('Activer God Rays')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.enabled = value;
                    }
                });

            godRaysFolder.add(godRaysSettingsRef.current, 'exposure', 0, 2.0, 0.01)
                .name('Exposition')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fExposure.value = value;
                    }
                });

            godRaysFolder.add(godRaysSettingsRef.current, 'decay', 0.8, 1.0, 0.001)
                .name('Décroissance')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fDecay.value = value;
                    }
                });

            godRaysFolder.add(godRaysSettingsRef.current, 'density', 0.8, 1.0, 0.001)
                .name('Densité')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fDensity.value = value;
                    }
                });

            godRaysFolder.add(godRaysSettingsRef.current, 'weight', 0, 1.0, 0.01)
                .name('Poids')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fWeight.value = value;
                    }
                });

            godRaysFolder.add(godRaysSettingsRef.current, 'clamp', 0.5, 2.0, 0.01)
                .name('Limite')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fClamp.value = value;
                    }
                });

            // NOUVEAU: Contrôle d'intensité du masque
            godRaysFolder.add(godRaysSettingsRef.current, 'maskIntensity', 0, 2.0, 0.01)
                .name('Intensité Masque')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fMaskIntensity.value = value;
                    }
                });

            // Position manuelle de la lumière (pour debug)
            godRaysFolder.add(godRaysSettingsRef.current, 'lightPosX', 0, 1, 0.01)
                .name('Position X')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fX.value = value;
                    }
                });

            godRaysFolder.add(godRaysSettingsRef.current, 'lightPosY', 0, 1, 0.01)
                .name('Position Y')
                .onChange(value => {
                    if (godRaysPassRef.current) {
                        godRaysPassRef.current.uniforms.fY.value = value;
                    }
                });

            // NOUVEAU: Bouton pour régénérer le masque
            const maskControls = {
                regenerateMask: () => {
                    createLightMask();
                    renderLightMask();
                    console.log('🎭 Masque de lumière régénéré');
                }
            };

            godRaysFolder.add(maskControls, 'regenerateMask').name('Régénérer Masque');

            // Ouvrir le dossier God Rays par défaut
            godRaysFolder.open();

            // Dossier pour le bloom (code existant)
            const bloomFolder = ppFolder.addFolder('Bloom');

            bloomFolder.add(bloomSettingsRef.current, 'enabled')
                .name('Activer Bloom')
                .onChange(value => {
                    if (bloomPassRef.current) {
                        bloomPassRef.current.enabled = value;
                    }
                });

            bloomFolder.add(bloomSettingsRef.current, 'strength', 0, 3.0, 0.05)
                .name('Intensité')
                .onChange(value => {
                    if (bloomPassRef.current) {
                        bloomPassRef.current.strength = value;
                    }
                });

            bloomFolder.add(bloomSettingsRef.current, 'radius', 0, 1.0, 0.01)
                .name('Rayon')
                .onChange(value => {
                    if (bloomPassRef.current) {
                        bloomPassRef.current.radius = value;
                    }
                });

            bloomFolder.add(bloomSettingsRef.current, 'threshold', 0, 1.0, 0.01)
                .name('Seuil')
                .onChange(value => {
                    if (bloomPassRef.current) {
                        bloomPassRef.current.threshold = value;
                    }
                });

            // Interface pour activer/désactiver les passes individuellement
            if (composerRef.current && composerRef.current.passes.length > 0) {
                const passesFolder = ppFolder.addFolder('Passes');

                composerRef.current.passes.forEach(pass => {
                    if (pass.name) {
                        const passControl = {
                            enabled: pass.enabled
                        };

                        passesFolder.add(passControl, 'enabled')
                            .name(pass.name)
                            .onChange(value => {
                                pass.enabled = value;
                            });
                    }
                });

                passesFolder.close();
            }

            // Ouvrir le dossier principal pour accéder facilement aux contrôles
            ppFolder.open();
        }

        // Gérer le redimensionnement de la fenêtre
        const handleResize = () => {
            const width = window.innerWidth * window.devicePixelRatio;
            const height = window.innerHeight * window.devicePixelRatio;

            if (composerRef.current) {
                composerRef.current.setSize(width, height);
            }

            if (bloomPassRef.current) {
                bloomPassRef.current.resolution.set(width, height);
            }

            // NOUVEAU: Redimensionner le render target du masque
            if (maskRenderTargetRef.current) {
                maskRenderTargetRef.current.setSize(width, height);
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);

            if (lightUpdateSubscription && typeof lightUpdateSubscription === 'function') {
                lightUpdateSubscription();
            }

            if (mainLightUpdateSubscription && typeof mainLightUpdateSubscription === 'function') {
                mainLightUpdateSubscription();
            }

            if (updateInterval) {
                clearInterval(updateInterval);
            }

            if (composerRef.current) {
                composerRef.current.dispose();
                composerRef.current = null;
            }
            if (bloomPassRef.current) {
                bloomPassRef.current = null;
            }
            if (godRaysPassRef.current) {
                godRaysPassRef.current = null;
            }
            if (postProcessingGroupRef.current) {
                scene.remove(postProcessingGroupRef.current);
                postProcessingGroupRef.current = null;
            }

            // NOUVEAU: Nettoyer les ressources du masque
            if (maskRenderTargetRef.current) {
                maskRenderTargetRef.current.dispose();
                maskRenderTargetRef.current = null;
            }
            if (lightMaskMaterialRef.current) {
                lightMaskMaterialRef.current.dispose();
                lightMaskMaterialRef.current = null;
            }
            if (blackMaskMaterialRef.current) {
                blackMaskMaterialRef.current.dispose();
                blackMaskMaterialRef.current = null;
            }

            // Nettoyer la référence à la lumière principale
            mainLightRef.current = null;
        };
    }, [debug, scene, camera, gl, gui]);

    // Mettre à jour le rendu des effets avec masque
    useEffect(() => {
        const animate = () => {
            if (composerRef.current) {
                // NOUVEAU: Rendre le masque avant les god rays
                if (godRaysSettingsRef.current.enabled && godRaysPassRef.current) {
                    renderLightMask();
                }

                // Rendre tous les effets
                composerRef.current.render();
            }
        };

        let animationFrameId;
        // Lancer l'animation si au moins un effet est activé
        if (bloomSettingsRef.current.enabled || godRaysSettingsRef.current.enabled) {
            animationFrameId = requestAnimationFrame(function update() {
                animate();
                animationFrameId = requestAnimationFrame(update);
            });
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [debug, gl]);

    return null;
}