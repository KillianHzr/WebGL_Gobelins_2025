import {useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';

/**
 * Composant Debug pour la configuration du renderer
 * Ce composant peut être étendu pour ajouter des fonctionnalités de debug supplémentaires
 */
const Debug = () => {
    const {gl, scene, camera} = useThree();
    const {debug, updateDebugConfig, getDebugConfigValue} = useStore();

    // Configurer le renderer avec les paramètres centralisés si nécessaire
    useEffect(() => {
        if (!gl || !debug?.active) return;

        // Cette fonction peut être utilisée pour configurer le renderer
        // avec des paramètres spécifiques qui ne sont pas gérés par l'interface GUI
        const configureRenderer = () => {
            // Ajouter ici des configurations spécifiques au renderer
            // Exemple: gl.outputEncoding = THREE.sRGBEncoding;
        };

        configureRenderer();
    }, [gl, debug]);

    // Ce composant ne rend rien visuellement
    return null;
};

export default Debug;