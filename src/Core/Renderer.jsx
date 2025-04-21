import React, {useEffect, useRef} from 'react';
import {WebGLRenderer} from "three";
import App from "../App";
import EventEmitter from "../Utils/EventEmitter.jsx";

export default function Renderer() {
    const appRef = useRef(null);
    const rendererRef = useRef(null);
    const emitterRef = useRef(new EventEmitter());

    useEffect(() => {
        // Initialize
        appRef.current = new App();

        // Create renderer
        const renderer = new WebGLRenderer({
            canvas: appRef.current.canvas,
            antialias: true
        });

        renderer.setSize(
            appRef.current.canvasSize.width,
            appRef.current.canvasSize.height
        );
        renderer.setPixelRatio(appRef.current.canvasSize.pixelRatio);
        rendererRef.current = renderer;

        // Handle resize
        const resizeHandler = (data) => {
            const {width, height} = data;
            renderer.setSize(width, height);
        };

        // Register event listeners
        appRef.current.canvasSize.on('resize', resizeHandler);

        // Cleanup function
        return () => {
            appRef.current.canvasSize.off('resize', resizeHandler);
            rendererRef.current.dispose();
            rendererRef.current = null;
            appRef.current = null;
        };
    }, []);

    return (
        <div style={{display: 'none'}}>
            {/* Renderer doesn't render any visible React elements */}
        </div>
    );
}