import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import useStore from '../Store/useStore';
import {
    NoToneMapping,
    LinearToneMapping,
    ReinhardToneMapping,
    CineonToneMapping,
    ACESFilmicToneMapping,
    Object3D
} from 'three';





export default function PostProcessing() {
    const { scene, camera, gl } = useThree();
    const { debug, gui } = useStore();
    const composerRef = useRef(null);
    const postProcessingGroupRef = useRef(null);

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

        // Créer le compositeur
        const composer = new EffectComposer(gl);

        // Ajouter le render pass initial
        const renderPass = new RenderPass(scene, camera);
        renderPass.name = 'RenderPass';
        composer.addPass(renderPass);

        // Stocker les références
        composerRef.current = composer;

        // Rendre le composer accessible depuis l'extérieur
        postProcessingGroupRef.current.userData.composer = composer;
        postProcessingGroupRef.current.userData.passes = composer.passes;

        // Désactiver les passes coûteuses par défaut
        if (composerRef.current) {
            composerRef.current.passes.forEach(pass => {
                // Sauvegarder l'état original
                if (!pass.userData) pass.userData = {};
                pass.userData.originalEnabled = pass.enabled;

                // Désactiver les passes coûteuses par défaut
                if (pass.name && (
                    pass.name.includes('BloomPass') ||
                    pass.name.includes('SSAOPass') ||
                    pass.name.includes('BokehPass') ||
                    pass.name.includes('SAOPass') ||
                    pass.name.includes('DOFPass')
                )) {
                    pass.enabled = false;
                    console.log(`[PostProcessing] Désactivation par défaut de la passe: ${pass.name}`);
                }
            });
        }

        // Ajouter les contrôles GUI si disponibles
        if (debug && gui) {
            const ppFolder = gui.addFolder('Post-Processing');

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

            ppFolder.close();
        }

        // Cleanup
        return () => {
            if (composerRef.current) {
                composerRef.current.dispose();
                composerRef.current = null;
            }
            if (postProcessingGroupRef.current) {
                scene.remove(postProcessingGroupRef.current);
                postProcessingGroupRef.current = null;
            }
        };
    }, [debug, scene, camera, gl, gui]);

    return null;
}