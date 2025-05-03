import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';

/**
 * Flashlight Component - World/Flashlight.jsx
 *
 * A spotlight that follows the camera and acts as a flashlight.
 * Features:
 * - Toggle on/off with 'F' key
 * - Dynamic positioning relative to camera
 * - Customizable parameters via GUI config
 * - State management via Zustand store
 */
export default function Flashlight() {
    const { camera, scene } = useThree();
    const flashlightRef = useRef();
    const flashlightTargetRef = useRef(new THREE.Object3D());
    const configRef = useRef(guiConfig.flashlight);

    // Refs for tracking initialization state
    const guiInitializedRef = useRef(false);
    const componentInitializedRef = useRef(false);

    // Access flashlight state from the store
    const flashlightState = useStore(state => state.flashlight);
    const updateFlashlightState = useStore(state => state.updateFlashlightState);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // Initialize the flashlight GUI controls - only once
    useEffect(() => {
        // Only set up GUI if debug mode is active, GUI is available, and it hasn't been initialized yet
        if (debug?.active && gui && !guiInitializedRef.current) {
            // Check if flashlight folder already exists
            let flashlightFolder = gui.folders?.find(folder => folder.name === 'Flashlight');

            if (!flashlightFolder) {
                console.log("Creating flashlight GUI folder");
                flashlightFolder = gui.addFolder('Flashlight');

                // Create a proxy object for the active state to avoid recreating controllers
                const activeProxy = { active: flashlightState.active };

                // Add controls for flashlight parameters
                const activeController = flashlightFolder.add(activeProxy, 'active')
                    .name('Enable Flashlight')
                    .onChange(value => {
                        updateFlashlightState({ active: value });
                    });

                // Add intensity control
                flashlightFolder.add(
                    configRef.current.intensity,
                    'default',
                    configRef.current.intensity.min,
                    configRef.current.intensity.max,
                    configRef.current.intensity.step
                )
                    .name('Intensity')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.intensity = value;
                        }
                    });

                // Add color control
                flashlightFolder.addColor(configRef.current.color, 'default')
                    .name('Color')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.color.set(value);
                        }
                    });

                // Add angle control
                flashlightFolder.add(
                    configRef.current.angle,
                    'default',
                    configRef.current.angle.min,
                    configRef.current.angle.max,
                    configRef.current.angle.step
                )
                    .name('Angle')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.angle = value;
                        }
                    });

                // Add penumbra control
                flashlightFolder.add(
                    configRef.current.penumbra,
                    'default',
                    configRef.current.penumbra.min,
                    configRef.current.penumbra.max,
                    configRef.current.penumbra.step
                )
                    .name('Penumbra')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.penumbra = value;
                        }
                    });

                // Add distance control
                flashlightFolder.add(
                    configRef.current.distance,
                    'default',
                    configRef.current.distance.min,
                    configRef.current.distance.max,
                    configRef.current.distance.step
                )
                    .name('Distance')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.distance = value;
                        }
                    });

                // Add decay control
                flashlightFolder.add(
                    configRef.current.decay,
                    'default',
                    configRef.current.decay.min,
                    configRef.current.decay.max,
                    configRef.current.decay.step
                )
                    .name('Decay')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.decay = value;
                        }
                    });

                // Add shadows folder
                const shadowsFolder = flashlightFolder.addFolder('Shadows');

                shadowsFolder.add(configRef.current.shadows.enabled, 'default')
                    .name('Enable Shadows')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.castShadow = value;
                        }
                    });

                // Add shadow map size control
                shadowsFolder.add(
                    { value: configRef.current.shadows.mapSize.default },
                    'value',
                    configRef.current.shadows.mapSize.options
                )
                    .name('Shadow Resolution')
                    .onChange(value => {
                        if (flashlightRef.current && flashlightRef.current.shadow) {
                            flashlightRef.current.shadow.mapSize.width = value;
                            flashlightRef.current.shadow.mapSize.height = value;
                            // Need to update the shadow map
                            flashlightRef.current.shadow.needsUpdate = true;
                        }
                    });

                // Add shadow bias control
                shadowsFolder.add(
                    configRef.current.shadows.bias,
                    'default',
                    configRef.current.shadows.bias.min,
                    configRef.current.shadows.bias.max,
                    configRef.current.shadows.bias.step
                )
                    .name('Shadow Bias')
                    .onChange(value => {
                        if (flashlightRef.current && flashlightRef.current.shadow) {
                            flashlightRef.current.shadow.bias = value;
                        }
                    });

                // Add shadow normal bias control
                shadowsFolder.add(
                    configRef.current.shadows.normalBias,
                    'default',
                    configRef.current.shadows.normalBias.min,
                    configRef.current.shadows.normalBias.max,
                    configRef.current.shadows.normalBias.step
                )
                    .name('Normal Bias')
                    .onChange(value => {
                        if (flashlightRef.current && flashlightRef.current.shadow) {
                            flashlightRef.current.shadow.normalBias = value;
                        }
                    });

                // Update the activeController when flashlightState changes
                // This will keep the GUI in sync with the state
                if (activeController && flashlightState) {
                    const updateGUIFromState = () => {
                        activeProxy.active = flashlightState.active;
                        activeController.updateDisplay();
                    };

                    // Create a reference to the update function
                    if (flashlightRef.current) {
                        flashlightRef.current.userData = flashlightRef.current.userData || {};
                        flashlightRef.current.userData.updateGUIFromState = updateGUIFromState;
                    }
                }

                // Mark as initialized
                guiInitializedRef.current = true;
            }
        }

        // Update GUI controls when flashlight state changes
        if (flashlightRef.current &&
            flashlightRef.current.userData &&
            flashlightRef.current.userData.updateGUIFromState) {
            flashlightRef.current.userData.updateGUIFromState();
        }

    }, [debug, gui, flashlightState, updateFlashlightState]);

    // Initialize the flashlight and target - only once
    useEffect(() => {
        // Only initialize once
        if (componentInitializedRef.current) return;
        componentInitializedRef.current = true;

        console.log("Initializing flashlight world component - one time setup");

        // Add the target to the scene
        scene.add(flashlightTargetRef.current);
        flashlightTargetRef.current.name = "flashlightTarget";

        // Position the target initially
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        const targetPosition = camera.position.clone().add(direction.multiplyScalar(10));
        flashlightTargetRef.current.position.copy(targetPosition);

        // Apply initial configuration to flashlight
        if (flashlightRef.current) {
            const config = configRef.current;
            const flashlight = flashlightRef.current;

            // Apply settings from config
            flashlight.intensity = config.intensity.default;
            flashlight.angle = config.angle.default;
            flashlight.penumbra = config.penumbra.default;
            flashlight.distance = config.distance.default;
            flashlight.decay = config.decay.default;
            flashlight.color.set(config.color.default);

            // Shadow settings
            flashlight.castShadow = config.shadows.enabled.default;
            if (flashlight.shadow) {
                flashlight.shadow.mapSize.width = config.shadows.mapSize.default;
                flashlight.shadow.mapSize.height = config.shadows.mapSize.default;
                flashlight.shadow.bias = config.shadows.bias.default;
                flashlight.shadow.normalBias = config.shadows.normalBias.default;
            }

            // Set the target
            flashlight.target = flashlightTargetRef.current;
        }

        // Clean up on unmount
        return () => {
            if (flashlightTargetRef.current) {
                scene.remove(flashlightTargetRef.current);
            }
        };
    }, [camera, scene]); // Only depend on camera and scene, not on state that changes frequently

    // Handle keyboard events in a separate effect
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'f' || event.key === 'F') {
                updateFlashlightState({
                    active: !flashlightState.active
                });
                // Only log in development or with debug flag
                if (process.env.NODE_ENV === 'development' || debug?.active) {
                    console.log("Flashlight toggled:", !flashlightState.active);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [updateFlashlightState, flashlightState.active, debug]);

    // Create UI button for mobile/touch users
    useEffect(() => {
        // Only create button if we're in a browser environment and it doesn't exist
        if (typeof window !== 'undefined' && !document.getElementById('flashlight-button')) {
            const button = document.createElement('button');
            button.id = 'flashlight-button';
            button.textContent = flashlightState.active ? 'Flashlight ON' : 'Flashlight OFF';
            button.style.position = 'fixed';
            button.style.bottom = '20px';
            button.style.left = '20px';
            button.style.padding = '10px';
            button.style.backgroundColor = flashlightState.active ? 'rgba(255, 165, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '5px';
            button.style.cursor = 'pointer';
            button.style.zIndex = '1000';
            button.style.fontFamily = 'Arial, sans-serif';
            button.style.fontSize = '14px';
            button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';

            button.addEventListener('click', () => {
                updateFlashlightState({
                    active: !flashlightState.active
                });
            });

            document.body.appendChild(button);
        }

        return () => {
            if (typeof window !== 'undefined') {
                const button = document.getElementById('flashlight-button');
                if (button) {
                    button.remove();
                }
            }
        };
    }, []);

    // Update button appearance when flashlight state changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const button = document.getElementById('flashlight-button');
            if (button) {
                button.textContent = flashlightState.active ? 'Flashlight ON' : 'Flashlight OFF';
                button.style.backgroundColor = flashlightState.active ? 'rgba(255, 165, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)';
            }

            // Also update the flashlight visibility
            if (flashlightRef.current) {
                flashlightRef.current.visible = flashlightState.active;
            }
        }
    }, [flashlightState.active]);

    // Update the flashlight position and target every frame
    useFrame(() => {
        if (flashlightRef.current && flashlightTargetRef.current) {
            // Position the flashlight relative to the camera
            // This positions it like holding a flashlight in your hand
            const offsetPosition = new THREE.Vector3(0.0, -0.5, 0.0);

            // Apply camera's rotation to the offset
            offsetPosition.applyQuaternion(camera.quaternion);

            // Set the flashlight position relative to the camera
            flashlightRef.current.position.copy(camera.position).add(offsetPosition);

            // Create a direction that points slightly downward
            // The y component (-0.7) creates a downward tilt
            const direction = new THREE.Vector3(0, -0.7, -1);
            direction.normalize(); // Normalize to ensure consistent length
            direction.applyQuaternion(camera.quaternion);

            // Set the target position
            const targetPosition = camera.position.clone().add(direction.multiplyScalar(10));
            flashlightTargetRef.current.position.copy(targetPosition);

            // Ensure target's matrix is updated for proper shadow calculation
            flashlightTargetRef.current.updateMatrixWorld();

            // Make sure the visibility always matches the state
            if (flashlightRef.current.visible !== flashlightState.active) {
                flashlightRef.current.visible = flashlightState.active;
            }
        }
    });

    // Define constants from config
    const {
        intensity,
        angle,
        penumbra,
        distance,
        decay,
        color,
        shadows
    } = configRef.current;

    return (
        <spotLight
            ref={flashlightRef}
            position={[0, 0, 0]} // Will be updated in useFrame
            intensity={intensity.default}
            angle={angle.default}
            penumbra={penumbra.default}
            distance={distance.default}
            decay={decay.default}
            color={color.default}
            castShadow={shadows.enabled.default}
            shadow-mapSize-width={shadows.mapSize.default}
            shadow-mapSize-height={shadows.mapSize.default}
            shadow-bias={shadows.bias.default}
            shadow-normalBias={shadows.normalBias.default}
            visible={flashlightState.active}
        />
    );
}