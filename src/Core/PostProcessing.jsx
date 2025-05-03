import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { GrainShader } from '../World/Shaders/GrainShader';
import useStore from '../Store/useStore';
import {ACESFilmicToneMapping, TextureLoader} from "three";
import guiConfig from "../Config/guiConfig.js";

export default function PostProcessing() {
    const { scene, camera, gl } = useThree();
    const { debug, gui } = useStore();
    const composerRef = useRef(null);
    const grainPassRef = useRef(null);
    const grainSettingsRef = useRef({
        enabled: true,
        intensity: 0.005,
        fps: 40
    });

    useEffect(() => {
        gl.autoClear = false;

        // Créer le compositeur
        const composer = new EffectComposer(gl);

        // Ajouter le render pass initial
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Ajouter le pass de grain seulement s'il est activé
        if (grainSettingsRef.current.enabled) {
            const grainPass = new ShaderPass(GrainShader);

            // Configurer les uniformes
            grainPass.uniforms.grainIntensity.value = grainSettingsRef.current.intensity;
            grainPass.uniforms.grainFPS.value = grainSettingsRef.current.fps;
            grainPass.uniforms.enabled.value = true;
            grainPass.uniforms.resolution.value = {
                x: window.innerWidth * window.devicePixelRatio,
                y: window.innerHeight * window.devicePixelRatio
            };

            // Synchroniser les paramètres de tone mapping avec le renderer
            grainPass.uniforms.toneMappingType.value = gl.toneMapping;
            grainPass.uniforms.toneMappingExp.value = gl.toneMappingExposure;

            // S'assurer que le grain est le dernier pass
            grainPass.renderToScreen = true;
            composer.addPass(grainPass);

            grainPassRef.current = grainPass;
        }

        // Stocker les références
        composerRef.current = composer;

        // Ajouter les contrôles GUI si disponibles
        // if (gui) {
        //     const grainFolder = gui.addFolder('Film Grain');
        //
        //     // Contrôle de l'intensité du grain
        //     const intensityController = grainFolder.add(grainSettingsRef.current, 'intensity', 0, 0.15, 0.001)
        //         .name('Intensity')
        //         .onChange(value => {
        //             // Si le grain est déjà activé, mettre à jour
        //             if (grainPassRef.current) {
        //                 grainPassRef.current.uniforms.grainIntensity.value = value;
        //             }
        //         });
        //
        //     // Contrôle des FPS du grain
        //     grainFolder.add(grainSettingsRef.current, 'fps', 1, 60, 1)
        //         .name('Grain Update FPS')
        //         .onChange(value => {
        //             // Si le grain est déjà activé, mettre à jour
        //             if (grainPassRef.current) {
        //                 grainPassRef.current.uniforms.grainFPS.value = value;
        //             }
        //         });
        //
        //     // Fermer le dossier par défaut
        //     grainFolder.close();
        // }

        // Cleanup
        return () => {
            if (composerRef.current) {
                composerRef.current.dispose();
                composerRef.current = null;
            }
            if (grainPassRef.current) {
                grainPassRef.current = null;
            }
        };
    }, [debug, scene, camera, gl, gui, grainSettingsRef.current.enabled]);

    // Mettre à jour le temps du shader et les paramètres de tone mapping
    useEffect(() => {
        const animate = () => {
            if (composerRef.current && grainPassRef.current) {
                // Mettre à jour le temps pour l'animation du grain
                grainPassRef.current.uniforms.time.value = performance.now() / 1000;

                // Synchroniser le tone mapping avec le renderer à chaque frame
                if (grainPassRef.current.uniforms.toneMappingType) {
                    grainPassRef.current.uniforms.toneMappingType.value = gl.toneMapping;
                }

                if (grainPassRef.current.uniforms.toneMappingExp) {
                    grainPassRef.current.uniforms.toneMappingExp.value = gl.toneMappingExposure;
                }

                composerRef.current.render();
            }
        };

        let animationFrameId;
        if (grainSettingsRef.current.enabled) {
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
    }, [debug, gl, grainSettingsRef.current.enabled]);

    return null;
}