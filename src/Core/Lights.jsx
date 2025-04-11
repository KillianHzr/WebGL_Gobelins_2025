import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../Store/useStore';

export default function Lights() {
    const { scene } = useThree();
    const { debug, gui } = useStore();
    const folderRef = useRef(null);

    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists
        if (debug?.active && debug?.showGui && gui) {
            console.log("Setting up lights debug UI");

            // Create lights folder
            const lightsFolder = gui.addFolder('Lights');
            folderRef.current = lightsFolder;

            // Find all lights in the scene
            const lights = [];
            scene.traverse((object) => {
                if (object.isLight) {
                    lights.push(object);
                }
            });

            console.log("Found lights:", lights);

            // Create a subfolder for each light
            lights.forEach((light, index) => {
                const lightType = light.type.replace('Light', '');
                const lightFolder = lightsFolder.addFolder(`${lightType} ${index + 1}`);

                // Common light properties
                lightFolder.add(light, 'visible').name('Enabled');
                lightFolder.add(light, 'intensity', 0, 10, 0.01).name('Intensity');

                // Color control
                const lightParams = {
                    color: '#' + light.color.getHexString()
                };

                lightFolder.addColor(lightParams, 'color').onChange(value => {
                    light.color.set(value);
                });

                // Position control
                const posFolder = lightFolder.addFolder('Position');
                posFolder.add(light.position, 'x', -20, 20, 0.1);
                posFolder.add(light.position, 'y', -20, 20, 0.1);
                posFolder.add(light.position, 'z', -20, 20, 0.1);

                // Specific controls based on light type
                if (light.isDirectionalLight || light.isSpotLight) {
                    // Add shadow controls
                    const shadowFolder = lightFolder.addFolder('Shadows');
                    shadowFolder.add(light, 'castShadow').name('Cast Shadows');

                    if (light.shadow) {
                        shadowFolder.add(light.shadow, 'bias', -0.01, 0.01, 0.0001).name('Bias');
                        shadowFolder.add(light.shadow, 'normalBias', -0.1, 0.1, 0.001).name('Normal Bias');
                        shadowFolder.add(light.shadow, 'radius', 0, 15, 0.1).name('Blur');

                        // Shadow map size as a dropdown
                        const mapSizes = {
                            '256': 256,
                            '512': 512,
                            '1024': 1024,
                            '2048': 2048,
                            '4096': 4096
                        };

                        const shadowParams = {
                            mapSize: light.shadow.mapSize.width // Assuming width and height are the same
                        };

                        shadowFolder.add(shadowParams, 'mapSize', mapSizes).name('Resolution')
                            .onChange(value => {
                                light.shadow.mapSize.set(value, value);
                                // Need to update the shadow map
                                light.shadow.map?.dispose();
                                light.shadow.map = null;
                                light.shadow.camera.updateProjectionMatrix();
                                light.shadow.needsUpdate = true;
                            });
                    }
                }

                // Specific controls for different light types
                if (light.isSpotLight) {
                    lightFolder.add(light, 'angle', 0, Math.PI / 2, 0.01).name('Angle');
                    lightFolder.add(light, 'penumbra', 0, 1, 0.01).name('Softness');
                    lightFolder.add(light, 'decay', 0, 2, 0.01).name('Decay');
                }

                if (light.isPointLight) {
                    lightFolder.add(light, 'decay', 0, 2, 0.01).name('Decay');
                    lightFolder.add(light, 'distance', 0, 1000, 1).name('Distance');
                }

                if (light.isRectAreaLight) {
                    lightFolder.add(light, 'width', 1, 20, 0.1).name('Width');
                    lightFolder.add(light, 'height', 1, 20, 0.1).name('Height');
                }
            });

            // Add option to create a new light
            const addLightParams = {
                type: 'Ambient',
                add: () => {
                    let newLight;

                    switch (addLightParams.type) {
                        case 'Ambient':
                            newLight = new THREE.AmbientLight(0xffffff, 0.5);
                            break;
                        case 'Directional':
                            newLight = new THREE.DirectionalLight(0xffffff, 1);
                            newLight.position.set(1, 2, 3);
                            newLight.castShadow = true;
                            break;
                        case 'Point':
                            newLight = new THREE.PointLight(0xffffff, 1, 100);
                            newLight.position.set(0, 5, 0);
                            newLight.castShadow = true;
                            break;
                        case 'Spot':
                            newLight = new THREE.SpotLight(0xffffff, 1);
                            newLight.position.set(0, 5, 0);
                            newLight.castShadow = true;
                            break;
                        case 'Hemisphere':
                            newLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
                            break;
                    }

                    scene.add(newLight);


                    // Call the effect again to rebuild the GUI
                    const lightsFolder = gui.addFolder('Lights');
                    folderRef.current = lightsFolder;

                    // Find all lights in the scene again
                    const lights = [];
                    scene.traverse((object) => {
                        if (object.isLight) {
                            lights.push(object);
                        }
                    });

                    // Rebuild light controls (would be better to extract this to a function)
                    // ... (same code as above for creating light folders)
                }
            };

        }

        // Cleanup function

        return () => {
            if (folderRef.current && gui) {
                gui.remove(folderRef.current);
                folderRef.current = null;
            }
        };
    }, [debug, gui, scene]);

    return null;
}