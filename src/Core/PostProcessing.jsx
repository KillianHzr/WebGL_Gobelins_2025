import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { GrainShader } from '../World/Shaders/GrainShader';
import useStore from '../Store/useStore';

export default function PostProcessing() {
    const { scene, camera, gl } = useThree();
    const { debug, gui } = useStore();
    const composerRef = useRef(null);
    const grainPassRef = useRef(null);
    const grainSettingsRef = useRef({
        enabled: true,
        intensity: 0.1,
        fps: 24
    });

    useEffect(() => {
        // Ne pas initialiser si le mode debug n'est pas actif
        if (!debug?.active || !debug?.showGui) return;

        // Créer le compositeur
        const composer = new EffectComposer(gl);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Créer le pass de grain
        const grainPass = new ShaderPass(GrainShader);

        // Configurer avec les valeurs par défaut
        grainPass.uniforms.grainIntensity.value = grainSettingsRef.current.intensity;
        grainPass.uniforms.grainFPS.value = grainSettingsRef.current.fps;
        grainPass.uniforms.enabled.value = grainSettingsRef.current.enabled;
        grainPass.uniforms.resolution.value = {
            x: window.innerWidth * window.devicePixelRatio,
            y: window.innerHeight * window.devicePixelRatio
        };

        composer.addPass(grainPass);

        // Stocker les références
        composerRef.current = composer;
        grainPassRef.current = grainPass;

        // Ajouter les contrôles GUI si disponibles
        if (gui) {
            const postProcessingFolder = gui.addFolder('Post Processing');
            const grainFolder = postProcessingFolder.addFolder('Grain');

            // Contrôle de l'activation du grain
            grainFolder.add(grainSettingsRef.current, 'enabled')
                .name('Enabled')
                .onChange(value => {
                    if (grainPassRef.current) {
                        grainPassRef.current.uniforms.enabled.value = value;
                    }
                });

            // Contrôle de l'intensité du grain
            grainFolder.add(grainSettingsRef.current, 'intensity', 0, 1, 0.01)
                .name('Intensity')
                .onChange(value => {
                    if (grainPassRef.current) {
                        grainPassRef.current.uniforms.grainIntensity.value = value;
                    }
                });

            // Contrôle des FPS du grain
            grainFolder.add(grainSettingsRef.current, 'fps', 1, 60, 1)
                .name('FPS')
                .onChange(value => {
                    if (grainPassRef.current) {
                        grainPassRef.current.uniforms.grainFPS.value = value;
                    }
                });

            // Fermer le dossier par défaut
            grainFolder.close();
        }

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
    }, [debug, scene, camera, gl, gui]);

    // Mettre à jour le temps du shader
    useEffect(() => {
        const animate = () => {
            if (composerRef.current && grainPassRef.current && debug?.active) {
                grainPassRef.current.uniforms.time.value = performance.now() / 1000;
                composerRef.current.render();
            }
        };

        let animationFrameId;
        if (debug?.active) {
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
    }, [debug]);

    return null;
}