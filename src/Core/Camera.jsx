import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';

export default function Camera() {
    const { camera, gl } = useThree();
    const folderRef = useRef(null);
    const { debug, gui } = useStore();

    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists
        if (debug?.active && debug?.showGui && gui && camera) {
            console.log("Setting up camera debug controls", camera);

            // Add camera controls to existing GUI
            const cameraFolder = gui.addFolder('Camera');
            folderRef.current = cameraFolder;

            // Camera position controls
            cameraFolder.add(camera.position, 'x', -20, 20, 0.1).name('positionX');
            cameraFolder.add(camera.position, 'y', -20, 20, 0.1).name('positionY');
            cameraFolder.add(camera.position, 'z', -20, 20, 0.1).name('positionZ');

            // Camera rotation (Euler angles)
            cameraFolder.add(camera.rotation, 'x', -Math.PI, Math.PI, 0.01).name('rotationX');
            cameraFolder.add(camera.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rotationY');
            cameraFolder.add(camera.rotation, 'z', -Math.PI, Math.PI, 0.01).name('rotationZ');

            // Camera settings
            const cameraSettings = {
                fov: camera.fov,
                near: camera.near,
                far: camera.far
            };

            cameraFolder.add(cameraSettings, 'fov', 10, 150).onChange(value => {
                camera.fov = value;
                camera.updateProjectionMatrix();
            });

            cameraFolder.add(cameraSettings, 'near', 0.01, 10, 0.01).onChange(value => {
                camera.near = value;
                camera.updateProjectionMatrix();
            });

            cameraFolder.add(cameraSettings, 'far', 10, 1000, 1).onChange(value => {
                camera.far = value;
                camera.updateProjectionMatrix();
            });

            // Check if we can find OrbitControls
            const controls = gl.domElement.__r3f?.controls;
            if (controls && controls.length > 0) {
                const orbitControls = controls[0];

                // OrbitControls settings if available
                const orbitSettings = {
                    enableDamping: orbitControls.enableDamping,
                    dampingFactor: orbitControls.dampingFactor,
                    enableZoom: orbitControls.enableZoom,
                    autoRotate: orbitControls.autoRotate,
                    autoRotateSpeed: orbitControls.autoRotateSpeed
                };

                const orbitFolder = cameraFolder.addFolder('Orbit Controls');

                orbitFolder.add(orbitSettings, 'enableDamping').onChange(value => {
                    orbitControls.enableDamping = value;
                });

                orbitFolder.add(orbitSettings, 'dampingFactor', 0, 1, 0.01).onChange(value => {
                    orbitControls.dampingFactor = value;
                });

                orbitFolder.add(orbitSettings, 'enableZoom').onChange(value => {
                    orbitControls.enableZoom = value;
                });

                orbitFolder.add(orbitSettings, 'autoRotate').onChange(value => {
                    orbitControls.autoRotate = value;
                });

                orbitFolder.add(orbitSettings, 'autoRotateSpeed', -10, 10, 0.1).onChange(value => {
                    orbitControls.autoRotateSpeed = value;
                });
            }
        }

        // Cleanup function
        return () => {
            if (folderRef.current && gui) {
                gui.removeFolder(folderRef.current);
                folderRef.current = null;
            }
        };
    }, [camera, debug, gui, gl]);

    // This component doesn't render any visible elements
    return null;
}