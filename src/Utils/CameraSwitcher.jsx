import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../Store/useStore';
import { EventBus } from '../Utils/EventEmitter';
import { getProject } from '@theatre/core';

/**
 * Component that manages switching between TheatreJS camera and a free camera with ZQSD controls
 */
const CameraSwitcher = () => {
    const { scene, gl, camera: mainCamera, set } = useThree();
    const { debug, getDebugConfigValue, updateDebugConfig } = useStore();

    // Get camera mode from store
    const cameraMode = useStore(state =>
        state.visualization?.cameraMode ||
        getDebugConfigValue('visualization.cameraMode.value', 'theatre')
    );

    // References for cameras and controls
    const freeCameraRef = useRef(null);

    // Reference to maintain original TheatreJS camera instance
    const theatreCameraRef = useRef(null);

    // Track whether we've made the initial switch from TheatreJS to free camera
    const hasInitiatedFirstSwitch = useRef(false);

    // Store the visualization settings before switching to free mode
    const previousVisualizationSettings = useRef(null);

    // Keyboard state for ZQSD movement
    const keysPressed = useRef({});
    // Movement speed
    const moveSpeed = useRef(0.1);
    // Mouse movement
    const mouseMovement = useRef({ x: 0, y: 0 });
    const cameraRotation = useRef({ x: 0, y: 0 });
    const mouseSensitivity = useRef(0.002);
    const isMouseDown = useRef(false);

    // Track all forest objects by category for better restoration
    const forestGroupsRef = useRef({
        forest: [],  // Main Forest group
        instances: [], // Instance meshes
        mapInstance: [], // Map instances
        lodInstances: [] // Added category for LOD instances
    });

    // Find and store all forest-related objects with improved detection
    const findAndStoreForestObjects = () => {
        if (!scene) return;

        // Clear previous references
        forestGroupsRef.current = {
            forest: [],
            instances: [],
            mapInstance: [],
            lodInstances: []
        };

        // Enhanced traversal to find all forest-related objects
        scene.traverse((object) => {
            // Check for Forest group
            if (object.name === 'Forest') {
                forestGroupsRef.current.forest.push(object);
                // Also track all children recursively
                object.traverse((child) => {
                    if (child !== object) { // Avoid adding the Forest object twice
                        if (child.isMesh || child.isGroup) {
                            forestGroupsRef.current.instances.push(child);
                        }
                    }
                });
            }
            // Check for instances by name
            else if (object.name?.includes('instances') ||
                object.name?.includes('forest') ||
                object.name?.includes('tree') ||
                object.name?.includes('lod')) {
                forestGroupsRef.current.instances.push(object);
            }
            // Check for map instances
            else if (object.name?.includes('MapInstance')) {
                forestGroupsRef.current.mapInstance.push(object);
            }
            // Also include child objects of Forest
            else if (object.parent?.name === 'Forest' ||
                (object.parent && (object.parent.name?.includes('forest') ||
                    object.parent.name?.includes('instances')))) {
                forestGroupsRef.current.instances.push(object);
            }
            // Check if it's an InstancedMesh (likely part of the forest)
            else if (object.isInstancedMesh) {
                forestGroupsRef.current.lodInstances.push(object);
            }
            // Check for objects that have LOD in their userData
            else if (object.isMesh && object.userData &&
                (object.userData.lodLevel !== undefined ||
                    object.userData.chunkCenter !== undefined)) {
                forestGroupsRef.current.lodInstances.push(object);
            }
        });

        // Get total counts for logging
        const totalObjects =
            forestGroupsRef.current.forest.length +
            forestGroupsRef.current.instances.length +
            forestGroupsRef.current.mapInstance.length +
            forestGroupsRef.current.lodInstances.length;

        console.log(`Found ${totalObjects} forest-related objects:`, {
            forest: forestGroupsRef.current.forest.length,
            instances: forestGroupsRef.current.instances.length,
            mapInstance: forestGroupsRef.current.mapInstance.length,
            lodInstances: forestGroupsRef.current.lodInstances.length
        });
    };

    // Function to ensure all forest objects are visible with enhanced checks
    const enforceForestVisibility = (visible = true) => {
        console.log(`Enforcing forest visibility: ${visible}`);

        // Apply to all categorized forest objects
        Object.values(forestGroupsRef.current).forEach(group => {
            group.forEach(object => {
                if (object.visible !== visible) {
                    console.log(`Setting ${object.name || 'unnamed object'} visibility to ${visible}`);
                    object.visible = visible;

                    // Also set visibility for all children
                    if (object.children && object.children.length > 0) {
                        object.children.forEach(child => {
                            child.visible = visible;
                        });
                    }
                }
            });
        });

        // Also do a broad pass through the scene to catch any missed objects
        scene.traverse((object) => {
            if (object.isInstancedMesh ||
                (object.isMesh && object.userData && object.userData.lodLevel !== undefined) ||
                (object.name && (
                    object.name.includes('forest') ||
                    object.name.includes('tree') ||
                    object.name.includes('lod') ||
                    object.name.includes('instances')
                ))) {
                if (object.visible !== visible) {
                    console.log(`Additional pass: Setting ${object.name || 'unnamed object'} visibility to ${visible}`);
                    object.visible = visible;
                }
            }
        });

        // Force scene update
        scene.updateMatrixWorld(true);
    };

    // Effect to find forest objects on component mount
    useEffect(() => {
        console.log("CameraSwitcher mounted, finding forest objects...");
        findAndStoreForestObjects();

        // Listen for forest-ready event to refresh object list
        const forestReadyHandler = () => {
            console.log("Forest ready event received, refreshing forest object list");
            findAndStoreForestObjects();
        };

        // Subscribe to relevant events
        const forestReadyUnsubscribe = EventBus.on('forest-ready', forestReadyHandler);

        // Additional subscription for forest scene ready
        const forestSceneReadyUnsubscribe = EventBus.on('forest-scene-ready', () => {
            console.log("Forest scene ready event received, refreshing forest object list");
            setTimeout(findAndStoreForestObjects, 500); // Slight delay to ensure all objects are created
        });

        return () => {
            forestReadyUnsubscribe();
            forestSceneReadyUnsubscribe();
        };
    }, [scene]);

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

    // Handle camera mode switching
    useEffect(() => {
        if (!mainCamera || !freeCameraRef.current) return;

        // Store reference to the original TheatreJS camera on first run
        if (!theatreCameraRef.current) {
            theatreCameraRef.current = mainCamera;
        }

        // Always refresh forest objects list when switching modes
        findAndStoreForestObjects();

        if (cameraMode === 'free') {
            // Switch to the free camera
            console.log('Switching to free camera mode');

            // Store the current visualization settings before switching
            previousVisualizationSettings.current = {
                ...useStore.getState().visualization
            };
            console.log('Saved visualization settings:', previousVisualizationSettings.current);

            // Copy all camera parameters exactly to ensure identical rendering behavior
            copyAllCameraParameters(mainCamera, freeCameraRef.current);

            // Initialize rotation reference
            cameraRotation.current = {
                x: mainCamera.rotation.x,
                y: mainCamera.rotation.y
            };

            // Track that we've made the switch
            hasInitiatedFirstSwitch.current = true;

            // Make the free camera the active camera in Three.js
            set({ camera: freeCameraRef.current });

            // Hide Theatre.js UI if it exists
            if (window.__theatreStudio && window.__theatreStudio.ui) {
                const studioUI = window.__theatreStudio.ui;
                // Store current UI state to restore later
                window.__wasTheatreUIVisible = !studioUI.isHidden;
                if (window.__wasTheatreUIVisible) {
                    studioUI.hide();
                }
            }

            // This is crucial: disable scroll in ScrollControls when in free camera mode
            const interaction = useStore.getState().interaction;
            if (interaction && typeof interaction.setAllowScroll === 'function') {
                interaction.setAllowScroll(false);
                console.log("Disabling scroll for Theatre.js in free camera mode");
            }

        } else {
            // Switch back to TheatreJS camera
            console.log('Switching to TheatreJS camera mode');

            // Set the original camera back as active
            set({ camera: theatreCameraRef.current });

            // Re-enable scroll in ScrollControls
            const interaction = useStore.getState().interaction;
            if (interaction && typeof interaction.setAllowScroll === 'function') {
                interaction.setAllowScroll(true);
                console.log("Re-enabling scroll for Theatre.js");
            }

            // Restore Theatre.js UI if necessary
            if (window.__theatreStudio && window.__theatreStudio.ui && window.__wasTheatreUIVisible) {
                window.__theatreStudio.ui.restore();
            }

            // Only restore settings after first switching to free camera mode
            if (hasInitiatedFirstSwitch.current) {
                // Restore previous visualization settings if available
                if (previousVisualizationSettings.current) {
                    console.log('Restoring visualization settings:', previousVisualizationSettings.current);
                    const store = useStore.getState();

                    // Make sure the visualization object exists in the store
                    if (!store.visualization) {
                        store.visualization = {};
                    }

                    // Restore each setting
                    Object.keys(previousVisualizationSettings.current).forEach(key => {
                        store.visualization[key] = previousVisualizationSettings.current[key];
                    });

                    // Update debug config if needed
                    if (typeof updateDebugConfig === 'function') {
                        Object.keys(previousVisualizationSettings.current).forEach(key => {
                            updateDebugConfig(`visualization.${key}.value`, previousVisualizationSettings.current[key]);
                        });
                    }
                }

                // Force visibility of all forest objects
                console.log("Enforcing forest visibility after switching back to TheatreJS mode");
                enforceForestVisibility(true);

                // Trigger a forest-restore event to notify other components
                console.log("Emitting forest-visibility-restore event");
                EventBus.trigger('forest-visibility-restore');

                // Force multiple render updates to ensure visibility changes apply
                const forceMultipleUpdates = () => {
                    enforceForestVisibility(true);
                    scene.updateMatrixWorld(true);
                };

                // Apply immediate update
                forceMultipleUpdates();

                // Then schedule a few more updates to ensure it sticks
                requestAnimationFrame(forceMultipleUpdates);
                setTimeout(forceMultipleUpdates, 100);
                setTimeout(forceMultipleUpdates, 500);
            }
        }

    }, [cameraMode, mainCamera, set, scene, updateDebugConfig]);

    // Register key event handlers - IMPORTANT: This is outside the cameraMode condition
    // so the event listeners are always active
    useEffect(() => {
        const handleKeyDown = (e) => {
            keysPressed.current[e.key.toLowerCase()] = true;
        };

        const handleKeyUp = (e) => {
            keysPressed.current[e.key.toLowerCase()] = false;
        };

        const handleMouseDown = (e) => {
            if (e.button === 0 && cameraMode === 'free') { // Left mouse button and only in free mode
                isMouseDown.current = true;
                try {
                    gl.domElement.requestPointerLock();
                } catch (err) {
                    console.warn("Could not request pointer lock:", err);
                }
            }
        };

        const handleMouseUp = (e) => {
            if (e.button === 0) { // Left mouse button
                isMouseDown.current = false;
                if (document.pointerLockElement === gl.domElement) {
                    document.exitPointerLock();
                }
            }
        };

        const handleMouseMove = (e) => {
            if (document.pointerLockElement === gl.domElement && cameraMode === 'free') {
                mouseMovement.current = {
                    x: e.movementX || 0,
                    y: e.movementY || 0
                };
            }
        };

        // Speed modifier handler
        const handleSpeedChange = (e) => {
            if (e.key.toLowerCase() === 'shift' && cameraMode === 'free') {
                moveSpeed.current = e.type === 'keydown' ? 0.3 : 0.1; // Faster when shift is pressed
            }
        };

        // Add wheel event handler to prevent scrolling in free mode
        const handleWheel = (e) => {
            if (cameraMode === 'free') {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Add event listeners - important to attach them to window for key events
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('keydown', handleSpeedChange);
        window.addEventListener('keyup', handleSpeedChange);
        gl.domElement.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        gl.domElement.addEventListener('wheel', handleWheel, { passive: false });

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

            // Ensure pointer lock is released
            if (document.pointerLockElement === gl.domElement) {
                document.exitPointerLock();
            }
        };
    }, [gl, cameraMode]);

    // Update free camera position and rotation each frame
    useFrame(() => {
        if (cameraMode === 'free' && freeCameraRef.current) {
            // Only process camera movement in free mode
            const camera = freeCameraRef.current;

            // Apply mouse movement to camera rotation
            if (mouseMovement.current.x !== 0 || mouseMovement.current.y !== 0) {
                // Mettre à jour les angles de rotation
                cameraRotation.current.y -= mouseMovement.current.x * mouseSensitivity.current;
                cameraRotation.current.x -= mouseMovement.current.y * mouseSensitivity.current;

                // Limiter l'angle vertical (pitch) pour éviter de dépasser la verticale
                cameraRotation.current.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, cameraRotation.current.x));

                // Réinitialiser la rotation de la caméra
                camera.rotation.set(0, 0, 0);

                // Appliquer d'abord la rotation horizontale (yaw)
                camera.rotateY(cameraRotation.current.y);

                // Puis appliquer la rotation verticale (pitch) autour de l'axe X local
                camera.rotateX(cameraRotation.current.x);

                // Réinitialiser le mouvement de la souris
                mouseMovement.current = { x: 0, y: 0 };
            }

            // Process keyboard input for movement
            const moveDirection = new THREE.Vector3(0, 0, 0);
            const speed = moveSpeed.current;

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

                // Debug log position occasionally
                if (Math.random() < 0.01) { // Only log about once every 100 frames
                    console.log(`Free camera position: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`);
                }
            }
        }
    });

    // Create a PerspectiveCamera that copies all properties from the TheatreJS camera
    return (
        <PerspectiveCamera
            ref={freeCameraRef}
            makeDefault={false}
            position={[0, 0, 5]}
            near={0.1}
            far={1000}
            fov={75}
        />
    );
};

export default CameraSwitcher;