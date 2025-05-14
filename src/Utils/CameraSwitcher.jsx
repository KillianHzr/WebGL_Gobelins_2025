import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {OrbitControls, PerspectiveCamera} from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../Store/useStore';
import {EventBus} from './EventEmitter';
import {useAnimationFrame} from "./AnimationManager.js";

/**
 * Component that manages switching between TheatreJS camera and a free camera with ZQSD controls
 */
const CameraSwitcher = () => {
    const {scene, gl, camera: mainCamera, set} = useThree();
    const {debug, getDebugConfigValue, updateDebugConfig} = useStore();

    // Track last known mode to avoid duplicate mode changes
    const lastKnownMode = useRef('theatre');

    // Get camera mode from store
    const cameraMode = useStore(state => state.cameraMode || 'default');


    // References for cameras and controls
    const freeCameraRef = useRef(null);

    // Reference to maintain original TheatreJS camera instance
    const theatreCameraRef = useRef(null);

    // Track whether we've made the initial switch from TheatreJS to free camera
    const hasInitiatedFirstSwitch = useRef(false);

    // Keyboard state for ZQSD movement
    const keysPressed = useRef({});
    // Movement speed
    const moveSpeed = useRef(0.1);

    // Camera rotation state
    const cameraRotation = useRef({x: 0, y: 0});
    const rotationSpeed = useRef(0.03); // Rotation speed with arrow keys

    // Track all forest objects by category for better restoration
    const forestGroupsRef = useRef({
        forest: [],  // Main Forest group
        instances: [], // Instance meshes
        mapInstance: [] // Map instances
    });

    // State to track whether event listeners are initialized
    const [listenersInitialized, setListenersInitialized] = useState(false);

    // Éviter les rendus en boucle et les changements multiples
    const isChangingMode = useRef(false);

    // Find and store all forest-related objects
    const findAndStoreForestObjects = () => {
        if (!scene) return;

        // Clear previous references
        forestGroupsRef.current = {
            forest: [], instances: [], mapInstance: []
        };

        // Find all forest-related objects
        scene.traverse((object) => {
            if (object.name === 'Forest') {
                forestGroupsRef.current.forest.push(object);
            } else if (object.name?.includes('instances')) {
                forestGroupsRef.current.instances.push(object);
            } else if (object.name?.includes('MapInstance')) {
                forestGroupsRef.current.mapInstance.push(object);
            }
            // Also include child objects of Forest
            else if (object.parent?.name === 'Forest') {
                forestGroupsRef.current.instances.push(object);
            }
        });

        const totalObjects = forestGroupsRef.current.forest.length + forestGroupsRef.current.instances.length + forestGroupsRef.current.mapInstance.length;

        console.log(`Found ${totalObjects} forest-related objects:`, {
            forest: forestGroupsRef.current.forest.length,
            instances: forestGroupsRef.current.instances.length,
            mapInstance: forestGroupsRef.current.mapInstance.length
        });
    };

    // Function to ensure all forest objects are visible
    const enforceForestVisibility = (visible = true) => {
        Object.values(forestGroupsRef.current).forEach(group => {
            group.forEach(object => {
                if (object.visible !== visible) {
                    object.visible = visible;
                }
            });
        });

        // Force scene update
        scene.updateMatrixWorld(true);
    };

    // Copy all camera parameters exactly to ensure identical rendering
    const copyAllCameraParameters = (source, target) => {
        if (!source || !target) return;

        // Basic parameters
        target.position.copy(source.position);
        target.rotation.copy(source.rotation);
        target.quaternion.copy(source.quaternion);
        target.scale.copy(source.scale);

        // View parameters
        target.fov = source.fov;
        target.zoom = source.zoom;
        target.near = source.near;
        target.far = source.far;
        target.aspect = source.aspect;
        target.view = source.view;

        // Advanced properties
        target.matrixWorldInverse.copy(source.matrixWorldInverse);
        target.projectionMatrix.copy(source.projectionMatrix);

        // If source has any other properties that affect frustum culling
        if (source.layers) {
            target.layers.mask = source.layers.mask;
        }

        // Update matrices
        target.updateMatrixWorld(true);
        target.updateProjectionMatrix();
    };

    // Handle camera teleport events
    // Handle camera teleport events
    const handleCameraTeleport = (data) => {
        // Check if we have a free camera and appropriate data
        if (freeCameraRef.current) {
            console.log("CameraSwitcher received teleport event:", data);

            // For free camera mode
            const camera = freeCameraRef.current;

            // Update position directly from event data
            if (data.position) {
                console.log("Setting free camera position to:", data.position);
                camera.position.copy(data.position);
            }

            // Look at target position
            if (data.target) {
                console.log("Setting free camera to look at:", data.target);
                camera.lookAt(data.target);

                // Update rotation reference to match current quaternion
                const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
                cameraRotation.current.x = euler.x;
                cameraRotation.current.y = euler.y;
            }

            // Force matrix and projection update
            camera.updateMatrixWorld(true);
            camera.updateProjectionMatrix();

            console.log("Free camera teleported successfully");
        } else {
            console.warn("Free camera reference not available for teleportation");
        }
    };

    // Fonction pour nettoyer les événements clavier
    function clearAllKeys() {
        for (const key in keysPressed.current) {
            keysPressed.current[key] = false;
        }
    }

    // Set up event listeners for mouse and keyboard controls
    const setupEventListeners = () => {
        if (listenersInitialized) return null;

        const handleKeyDown = (e) => {
            // Toujours capturer les touches sans condition
            keysPressed.current[e.key.toLowerCase()] = true;
        };

        const handleKeyUp = (e) => {
            // Toujours relâcher les touches sans condition
            keysPressed.current[e.key.toLowerCase()] = false;
        };

        // We don't need the complex mouse drag handlers anymore
        const handleMouseDown = (e) => {
            // No specific action needed for mouse down
        };

        const handleMouseUp = (e) => {
            // No specific action needed for mouse up
        };

        const handleMouseMove = (e) => {
            // No specific action needed for mouse move
        };

        // Speed modifier handler
        const handleSpeedChange = (e) => {
            if (e.key.toLowerCase() === 'shift') {
                moveSpeed.current = e.type === 'keydown' ? 0.3 : 0.1; // Faster when shift is pressed
            }
        };

        // Add wheel event handler to prevent scrolling in free mode
        const handleWheel = (e) => {
            if (cameraMode === 'Free Camera' || cameraMode === 'free' || cameraMode === 'Caméra libre (ZQSD)') {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Handle window blur (tab loses focus)
        const handleBlur = () => {
            clearAllKeys();
        };

        // No need for special cursor styles anymore
        const handleMouseEnter = () => {
            // No specific action needed
        };

        const handleMouseLeave = () => {
            // No specific action needed
        };

        // Add event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('keydown', handleSpeedChange);
        window.addEventListener('keyup', handleSpeedChange);
        gl.domElement.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        gl.domElement.addEventListener('wheel', handleWheel, {passive: false});
        window.addEventListener('blur', handleBlur);
        gl.domElement.addEventListener('mouseenter', handleMouseEnter);
        gl.domElement.addEventListener('mouseleave', handleMouseLeave);

        // Update state to track that listeners are initialized
        setListenersInitialized(true);

        // Return cleanup function
        return () => {
            // Clean up event listeners
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('keydown', handleSpeedChange);
            window.removeEventListener('keyup', handleSpeedChange);
            gl.domElement.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
            gl.domElement.removeEventListener('wheel', handleWheel);
            window.removeEventListener('blur', handleBlur);
            gl.domElement.removeEventListener('mouseenter', handleMouseEnter);
            gl.domElement.removeEventListener('mouseleave', handleMouseLeave);

            // Reset cursor style
            gl.domElement.style.cursor = 'auto';

            clearAllKeys();
            isDragging.current = false;
            setListenersInitialized(false);
        };
    };

    // Register for camera events when component mounts
    useEffect(() => {
        console.log("CameraSwitcher mounted");
        findAndStoreForestObjects();

        // Setup event listeners immediately
        const cleanup = setupEventListeners();

        // Listen for events
        const forestReadyHandler = () => {
            findAndStoreForestObjects();
        };

        const teleportHandler = (data) => {
            handleCameraTeleport(data);
        };

        const cameraModeHandler = (data) => {
            if (data && data.mode) {
                console.log(`CameraSwitcher received camera mode change event: ${data.mode}`);
            }
        };

        // Subscribe to events
        const forestReadyUnsubscribe = EventBus.on('forest-ready', forestReadyHandler);
        const teleportUnsubscribe = EventBus.on('camera-teleported', teleportHandler);
        const cameraModeUnsubscribe = EventBus.on('camera-mode-changed', cameraModeHandler);

        return () => {
            // Clean up event listeners
            if (cleanup) cleanup();
            forestReadyUnsubscribe();
            teleportUnsubscribe();
            cameraModeUnsubscribe();
        };
    }, []);

    // Handle camera mode switching
    useEffect(() => {
        if (!mainCamera || !freeCameraRef.current) return;

        // Avoid changing mode multiple times
        if (isChangingMode.current || cameraMode === lastKnownMode.current) return;

        // Start changing mode
        isChangingMode.current = true;

        // Store reference to the original TheatreJS camera on first run
        if (!theatreCameraRef.current) {
            theatreCameraRef.current = mainCamera;
        }

        console.log(`CameraSwitcher: Camera mode is now ${cameraMode}`);
        lastKnownMode.current = cameraMode;

        if (cameraMode === 'Free Camera' || cameraMode === 'free' || cameraMode === 'Caméra libre (ZQSD)') {
            // Switch to the free camera
            console.log('Switching to free camera mode');

            // Copy all camera parameters exactly to ensure identical rendering behavior
            copyAllCameraParameters(mainCamera, freeCameraRef.current);

            // Initialize rotation reference
            const euler = new THREE.Euler().setFromQuaternion(freeCameraRef.current.quaternion, 'YXZ');
            cameraRotation.current = {
                x: euler.x, y: euler.y
            };

            // No need to change cursor style

            // Track that we've made the switch
            hasInitiatedFirstSwitch.current = true;

            // Make the free camera the active camera in Three.js
            set({camera: freeCameraRef.current});


            // Disable scroll in ScrollControls
            const interaction = useStore.getState().interaction;
            if (interaction && typeof interaction.setAllowScroll === 'function') {
                interaction.setAllowScroll(false);
                console.log("Disabling scroll for Theatre.js in free camera mode");
            }

            // Update the store with the new mode
            useStore.getState().setCameraMode('free');


            // Update debug config
            if (typeof updateDebugConfig === 'function') {
                updateDebugConfig('visualization.cameraMode.value', 'Free Camera');
            }
        } else {
            // Switch back to TheatreJS camera
            console.log('Switching to TheatreJS camera mode');

            // No need to reset cursor

            // Set the original camera back as active
            set({camera: theatreCameraRef.current});

            // Re-enable scroll in ScrollControls
            const interaction = useStore.getState().interaction;
            if (interaction && typeof interaction.setAllowScroll === 'function') {
                interaction.setAllowScroll(true);
                console.log("Re-enabling scroll for Theatre.js");
            }


            // Force visibility of all forest objects
            if (hasInitiatedFirstSwitch.current) {
                enforceForestVisibility(true);

                // Trigger a forest-restore event to notify other components
                EventBus.trigger('forest-visibility-restore');

                // Request a frame update
                requestAnimationFrame(() => {
                    scene.updateMatrixWorld(true);
                });
            }

            // Update the store with the new mode
            const store = useStore.getState();
            if (store.visualization) {
                store.visualization.cameraMode = 'theatre';
            } else {
                store.visualization = {cameraMode: 'theatre'};
            }

            // Update debug config
            if (typeof store.updateDebugConfig === 'function') {
                store.updateDebugConfig('visualization.cameraMode.value', 'theatre');
            }
        }

        // Set a timeout to allow mode changes again
        setTimeout(() => {
            isChangingMode.current = false;
        }, 300);
    }, [cameraMode, mainCamera, set, scene]);

    // Update free camera position and rotation each frame
    useAnimationFrame(() => {
        if (cameraMode === 'Free Camera' && freeCameraRef.current) {
            // Seulement traiter les mouvements de caméra en mode libre
            const camera = freeCameraRef.current;

            // Process keyboard input for movement
            const moveDirection = new THREE.Vector3(0, 0, 0);
            const speed = moveSpeed.current;

            // Check for camera rotation using arrow keys
            const rotateAmount = rotationSpeed.current;

            // Handle arrow keys for rotation
            if (keysPressed.current['arrowleft']) {
                cameraRotation.current.y += rotateAmount;
            }
            if (keysPressed.current['arrowright']) {
                cameraRotation.current.y -= rotateAmount;
            }
            if (keysPressed.current['arrowup']) {
                cameraRotation.current.x += rotateAmount;
            }
            if (keysPressed.current['arrowdown']) {
                cameraRotation.current.x -= rotateAmount;
            }

            // Limit vertical angle (pitch) to avoid flipping
            cameraRotation.current.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraRotation.current.x));

            // Apply rotation
            camera.rotation.set(0, 0, 0);
            camera.rotateY(cameraRotation.current.y);
            camera.rotateX(cameraRotation.current.x);

            // Check all possible movement keys - support both ZQSD (French) and WASD (English)
            if (keysPressed.current['z'] || keysPressed.current['w']) {
                moveDirection.z = 1;
            }
            if (keysPressed.current['s']) {
                moveDirection.z = -1;
            }
            if (keysPressed.current['q'] || keysPressed.current['a']) {
                moveDirection.x = -1;
            }
            if (keysPressed.current['d']) {
                moveDirection.x = 1;
            }
            if (keysPressed.current[' ']) {
                moveDirection.y = 1;
            }
            if (keysPressed.current['control'] || keysPressed.current['c']) {
                moveDirection.y = -1;
            }

            // Debug logging of key states occasionally
            if (Math.random() < 0.01) {
                const pressedKeys = Object.entries(keysPressed.current)
                    .filter(([_, pressed]) => pressed)
                    .map(([key]) => key);

                if (pressedKeys.length > 0) {
                    console.log("Keys pressed:", pressedKeys.join(', '));
                }
            }

            // Only move if there's input
            if (moveDirection.length() > 0) {
                // Normalize to maintain consistent speed in all directions
                moveDirection.normalize();

                // Get forward and right vectors relative to camera rotation
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

                // Calculate final movement vector
                const movement = new THREE.Vector3();

                // Apply forward/backward movement
                if (moveDirection.z !== 0) {
                    movement.addScaledVector(forward, moveDirection.z * speed);
                }

                // Apply left/right movement
                if (moveDirection.x !== 0) {
                    movement.addScaledVector(right, moveDirection.x * speed);
                }

                // Apply up/down movement (world Y axis)
                if (moveDirection.y !== 0) {
                    movement.y += moveDirection.y * speed;
                }

                // Apply movement to camera position
                camera.position.add(movement);
            }
        }
    }, 'camera');

    return (
        <>
            {/* Free camera setup */}
            <PerspectiveCamera
                ref={freeCameraRef}
                makeDefault={false}
                position={[0, 1.6, 3]} // Default position
                fov={75}
                near={0.1}
                far={1000}
            />
        </>
    );
};

export default CameraSwitcher;