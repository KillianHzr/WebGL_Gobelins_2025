import React, { useEffect, useRef } from 'react';
import { PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import App from "../App";

export default function Camera() {
    const appRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);

    useEffect(() => {
        // Initialize
        appRef.current = new App();

        // Create camera
        const perspective = new PerspectiveCamera(
            90,
            appRef.current.canvasSize.aspect,
            0.1,
            100
        );
        perspective.position.set(0, 0, 5);
        cameraRef.current = perspective;

        // Create controls
        const controls = new OrbitControls(perspective, appRef.current.canvas);
        controlsRef.current = controls;

        // Handle resize
        const resizeHandler = (data) => {
            const { aspect } = data;
            perspective.aspect = aspect;
            perspective.updateProjectionMatrix();
        };

        // Register event listeners
        appRef.current.canvasSize.on('resize', resizeHandler);

        // Cleanup function
        return () => {
            appRef.current.canvasSize.off('resize', resizeHandler);
            controlsRef.current.dispose();

            // Clear references
            cameraRef.current = null;
            controlsRef.current = null;
            appRef.current = null;
        };
    }, []);

    return (
        <div style={{ display: 'none' }}>
            {/* Camera doesn't render any visible elements */}
        </div>
    );
}