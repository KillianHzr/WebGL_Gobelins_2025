import React, { useEffect } from 'react';
import Stats from 'stats.js';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';

const StatsComponent = () => {
    const { gl } = useThree();
    const { debug } = useStore();

    useEffect(() => {
        // Only initialize if debug is active and showStats is true
        if (!debug?.active || !debug?.showStats) return;

        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            position:fixed;
            bottom:10px;
            left:10px;
            z-index:1000;
            color:white;
            font-family:monospace;
            padding:10px;
            background:rgba(0,0,0,0.7);
            line-height:1.4;
            border-radius:4px;
            box-shadow:0 2px 5px rgba(0,0,0,0.3);
            max-width:300px;
        `;
        document.body.appendChild(statsContainer);

        const miniStatsContainer = document.createElement('div');
        miniStatsContainer.style.cssText = `
            display:flex;
            gap:5px;
            transform:scale(1.0);
            transform-origin:bottom left;
        `;
        statsContainer.appendChild(miniStatsContainer);

        // Function to clean up each panel style
        const setupPanel = (panel, type = 0) => {
            panel.showPanel(type);
            panel.dom.style.position = 'static';
            panel.dom.style.cursor = 'default';
            panel.dom.style.opacity = '1';
            panel.dom.style.zIndex = 'auto';
            panel.dom.style.width = '80px';
            panel.dom.style.height = '48px';
            return panel;
        };

        // Create panels
        const fpsStats = setupPanel(new Stats(), 0);
        const msStats = setupPanel(new Stats(), 1);
        const mbStats = setupPanel(new Stats(), 2);

        // Append to container
        miniStatsContainer.appendChild(fpsStats.dom);
        miniStatsContainer.appendChild(msStats.dom);
        miniStatsContainer.appendChild(mbStats.dom);

        // WebGL info panel
        const glInfoPanel = document.createElement('pre');
        glInfoPanel.style.cssText = 'margin-top:8px;font-size:12px;';
        statsContainer.appendChild(glInfoPanel);

        const updateWebGLPanel = () => {
            if (!gl) return;
            const memory = gl.info.memory;
            const render = gl.info.render;

            glInfoPanel.textContent =
                `=== Memory ===\n` +
                `Programs: ${memory.programs}\n` +
                `Geometries: ${memory.geometries}\n` +
                `Textures: ${memory.textures}\n\n` +
                `=== Render ===\n` +
                `Calls: ${render.calls}\n` +
                `Triangles: ${render.triangles}\n` +
                `Lines: ${render.lines}\n` +
                `Points: ${render.points}`;
        };

        let frameId;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            fpsStats.begin();
            msStats.begin();
            mbStats.begin();
            updateWebGLPanel();
            mbStats.end();
            msStats.end();
            fpsStats.end();
        };
        animate();

        return () => {
            cancelAnimationFrame(frameId);
            document.body.removeChild(statsContainer);
        };
    }, [gl, debug?.active, debug?.showStats]);

    return null;
};

export default StatsComponent;