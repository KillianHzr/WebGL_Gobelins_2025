import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {LightConfig, configureRenderer} from '../Core/Lights.jsx';

const Debug = () => {
    const {gl, scene, camera} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const foldersRef = useRef([]);

    useEffect(() => {
        // Configurer le renderer avec les paramètres centralisés
        configureRenderer(gl);

    }, [gl, scene, camera, debug, gui, updateDebugConfig, getDebugConfigValue]);
    return null;
};

export default Debug;