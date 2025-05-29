import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import useStore from '../Store/useStore';
import {
    NoToneMapping,
    LinearToneMapping,
    ReinhardToneMapping,
    CineonToneMapping,
    ACESFilmicToneMapping,
    Object3D,
    Vector2, AgXToneMapping, NeutralToneMapping
} from 'three';
import GuiConfig from "../Config/guiConfig.js";

export default function PostProcessing() {
    const { scene, camera, gl } = useThree();
    const { debug, gui, debugConfig } = useStore();
    const composerRef = useRef(null);
    const bloomPassRef = useRef(null);
    const postProcessingGroupRef = useRef(null);
    const bloomSettingsRef = useRef({
        enabled: true,
        strength: 0.67,
        radius: 0.25,
        threshold: 1.0
    });

    // Fonction pour convertir les valeurs de tone mapping en constantes Three.js
    const getToneMappingConstant = (value) => {
        switch (value) {
            case 0: return NoToneMapping;
            case 1: return LinearToneMapping;
            case 2: return ReinhardToneMapping;
            case 3: return CineonToneMapping;
            case 4: return ACESFilmicToneMapping;
            case 5: return AgXToneMapping;
            case 6: return NeutralToneMapping;
            default: return CineonToneMapping;
        }
    };


    // Synchroniser les paramètres de tone mapping avec le debug config
    useEffect(() => {
        if (!gl || !debugConfig) return;

        // Mettre à jour le tone mapping si la valeur a changé
        if (debugConfig.toneMapping !== undefined) {
            const newToneMapping = getToneMappingConstant(debugConfig.toneMapping);
            if (gl.toneMapping !== newToneMapping) {
                gl.toneMapping = newToneMapping;
                console.log(`[PostProcessing] Tone mapping mis à jour:`, debugConfig.toneMapping);
            }
        }

        // Mettre à jour l'exposition si la valeur a changé
        if (debugConfig.toneMappingExposure !== undefined) {
            if (gl.toneMappingExposure !== debugConfig.toneMappingExposure) {
                gl.toneMappingExposure = debugConfig.toneMappingExposure;
                console.log(`[PostProcessing] Exposition mise à jour:`, debugConfig.toneMappingExposure);
            }
        }

        // Forcer la mise à jour du renderer
        gl.needsUpdate = true;

    }, [gl, debugConfig?.toneMapping, debugConfig?.toneMappingExposure]);

    // Synchroniser avec les paramètres de rendu de la caméra si disponibles
    useEffect(() => {
        if (!gl || !debugConfig?.camera?.render) return;

        const cameraRender = debugConfig.camera.render;

        // Mettre à jour depuis les paramètres de la caméra si définis
        if (cameraRender.toneMapping !== undefined) {
            const newToneMapping = getToneMappingConstant(cameraRender.toneMapping);
            if (gl.toneMapping !== newToneMapping) {
                gl.toneMapping = newToneMapping;
                console.log(`[PostProcessing] Tone mapping (camera) mis à jour:`, cameraRender.toneMapping);
            }
        }

        if (cameraRender.toneMappingExposure !== undefined) {
            if (gl.toneMappingExposure !== cameraRender.toneMappingExposure) {
                gl.toneMappingExposure = cameraRender.toneMappingExposure;
                console.log(`[PostProcessing] Exposition (camera) mise à jour:`, cameraRender.toneMappingExposure);
            }
        }

        gl.needsUpdate = true;

    }, [gl, debugConfig?.camera?.render?.toneMapping, debugConfig?.camera?.render?.toneMappingExposure]);

    useEffect(() => {
        gl.autoClear = false;

        // Configuration initiale du tone mapping depuis le config
        gl.toneMapping = getToneMappingConstant(GuiConfig.renderer.toneMapping.default);
        gl.toneMappingExposure = GuiConfig.renderer.toneMappingExposure.default;

        // Créer un groupe pour le post-processing
        if (!postProcessingGroupRef.current) {
            postProcessingGroupRef.current = new Object3D();
            postProcessingGroupRef.current.name = 'PostProcessing';
            scene.add(postProcessingGroupRef.current);
        }

        // Créer le compositeur
        const composer = new EffectComposer(gl);

        // Ajouter le render pass initial
        const renderPass = new RenderPass(scene, camera);
        renderPass.name = 'RenderPass';
        composer.addPass(renderPass);

        // Ajouter le UnrealBloomPass pour l'effet de bloom
        if (bloomSettingsRef.current.enabled) {
            const resolution = new Vector2(
                window.innerWidth * window.devicePixelRatio,
                window.innerHeight * window.devicePixelRatio
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

            // Définir comme dernier pass puisque nous n'utilisons plus de grain
            bloomPass.renderToScreen = true;

            composer.addPass(bloomPass);
            bloomPassRef.current = bloomPass;
        }

        // Stocker les références
        composerRef.current = composer;

        // Rendre le composer accessible depuis l'extérieur
        postProcessingGroupRef.current.userData.composer = composer;
        postProcessingGroupRef.current.userData.passes = composer.passes;

        // Activer le pass de bloom par défaut (contrairement aux autres passes coûteuses)
        if (composerRef.current) {
            composerRef.current.passes.forEach(pass => {
                // Sauvegarder l'état original
                if (!pass.userData) pass.userData = {};
                pass.userData.originalEnabled = pass.enabled;

                // Désactiver les passes coûteuses par défaut, sauf BloomPass
                if (pass.name && (
                    pass.name.includes('SSAOPass') ||
                    pass.name.includes('BokehPass') ||
                    pass.name.includes('SAOPass') ||
                    pass.name.includes('DOFPass')
                )) {
                    pass.enabled = false;
                    // console.log(`[PostProcessing] Désactivation par défaut de la passe: ${pass.name}`);
                }
            });
        }

        // Ajouter les contrôles GUI si disponibles
        if (debug && gui) {
            const ppFolder = gui.addFolder('Post-Processing');

            // Dossier pour le bloom
            const bloomFolder = ppFolder.addFolder('Bloom');
            bloomFolder.hide();
            // Contrôles pour le bloom
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

            // Ouvrir le dossier de bloom par défaut
            bloomFolder.open();

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

                passesFolder.hide();
            }

            // Ajouter les contrôles de tone mapping directement dans le post-processing
            const toneMappingFolder = ppFolder.addFolder('Tone Mapping');

            const toneMappingSettings = {
                toneMapping: gl.toneMapping,
                toneMappingExposure: gl.toneMappingExposure
            };

            // Contrôle du type de tone mapping
            toneMappingFolder.add(toneMappingSettings, 'toneMapping', {
                'None': 0,
                'Linear': 1,
                'Reinhard': 2,
                'Cineon': 3,
                'ACES Filmic': 4,
                'AgX': 5,
                'Neutral': 6
            })
                .name('Type')
                .onChange(value => {
                    gl.toneMapping = getToneMappingConstant(value);
                    gl.needsUpdate = true;
                });

            // Contrôle de l'exposition
            toneMappingFolder.add(toneMappingSettings, 'toneMappingExposure', 0, 5, 0.01)
                .name('Exposition')
                .onChange(value => {
                    gl.toneMappingExposure = value;
                    gl.needsUpdate = true;
                });

            toneMappingFolder.open();

            // Ouvrir le dossier principal pour accéder facilement aux contrôles de bloom
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
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);

            if (composerRef.current) {
                composerRef.current.dispose();
                composerRef.current = null;
            }
            if (bloomPassRef.current) {
                bloomPassRef.current = null;
            }
            if (postProcessingGroupRef.current) {
                scene.remove(postProcessingGroupRef.current);
                postProcessingGroupRef.current = null;
            }
        };
    }, [debug, scene, camera, gl, gui]);

    // Mettre à jour le rendu des effets
    useEffect(() => {
        const animate = () => {
            if (composerRef.current) {
                // Rendre tous les effets
                composerRef.current.render();
            }
        };

        let animationFrameId;
        // Lancer l'animation si le bloom est activé
        if (bloomSettingsRef.current.enabled) {
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