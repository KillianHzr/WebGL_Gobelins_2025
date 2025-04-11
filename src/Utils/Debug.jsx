import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';

const Debug = () => {
    const { gl, scene } = useThree();
    const { debug, gui } = useStore();
    const foldersRef = useRef([]);

    useEffect(() => {
        if (!debug?.active || !debug?.showGui || !gui) return;

        // Add scene controls
        const sceneFolder = gui.addFolder('Scene');
        const sceneSettings = {
            background: '#000000',
            fogEnabled: false,
            fogColor: '#ffffff',
            fogNear: 1,
            fogFar: 10
        };

        sceneFolder.addColor(sceneSettings, 'background').onChange(value => {
            scene.background = new THREE.Color(value);
        });

        sceneFolder.add(sceneSettings, 'fogEnabled').name('fog').onChange(value => {
            if (value) {
                scene.fog = new THREE.Fog(
                    sceneSettings.fogColor,
                    sceneSettings.fogNear,
                    sceneSettings.fogFar
                );
            } else {
                scene.fog = null;
            }
        });

        sceneFolder.addColor(sceneSettings, 'fogColor').onChange(value => {
            if (scene.fog) {
                scene.fog.color = new THREE.Color(value);
            }
        });

        sceneFolder.add(sceneSettings, 'fogNear', 0, 10).onChange(value => {
            if (scene.fog) {
                scene.fog.near = value;
            }
        });

        sceneFolder.add(sceneSettings, 'fogFar', 0, 50).onChange(value => {
            if (scene.fog) {
                scene.fog.far = value;
            }
        });

        // Add renderer controls
        const rendererFolder = gui.addFolder('Renderer');
        const rendererSettings = {
            shadowMap: true,
            toneMapping: 4, // ACESFilmic by default
            toneMappingExposure: 1
        };

        rendererFolder.add(rendererSettings, 'shadowMap').onChange(value => {
            gl.shadowMap.enabled = value;
            gl.shadowMap.needsUpdate = true;
        });

        rendererFolder.add(rendererSettings, 'toneMapping', {
            'None': THREE.NoToneMapping,
            'Linear': THREE.LinearToneMapping,
            'Reinhard': THREE.ReinhardToneMapping,
            'Cineon': THREE.CineonToneMapping,
            'ACESFilmic': THREE.ACESFilmicToneMapping
        }).onChange(value => {
            gl.toneMapping = Number(value);
        });

        rendererFolder.add(rendererSettings, 'toneMappingExposure', 0, 5, 0.01).onChange(value => {
            gl.toneMappingExposure = value;
        });

        // Store folders for cleanup
        foldersRef.current = [sceneFolder, rendererFolder];

        // Cleanup on unmount - remove folders but don't destroy GUI
        return () => {
            if (gui) {
                foldersRef.current.forEach(folder => {
                    if (folder && gui.folders.includes(folder)) {
                        gui.removeFolder(folder);
                    }
                });
            }
        };
    }, [gl, scene, debug, gui]);

    return null; // This component doesn't render any React elements
};

export default Debug;