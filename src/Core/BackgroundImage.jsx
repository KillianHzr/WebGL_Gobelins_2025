import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { TextureLoader, SRGBColorSpace } from 'three';

// Composant pour charger l'image de fond
const BackgroundImage = () => {
    const { scene } = useThree();
    const textureLoaded = useRef(false);

    useEffect(() => {
        if (textureLoaded.current || !scene) return;

        const loader = new TextureLoader();

        // Chemin vers l'image de fond
        const backgroundPath = '/textures/Background.png';

        console.log(`Chargement de l'image de fond depuis: ${backgroundPath}`);

        loader.load(
            backgroundPath,
            (texture) => {
                // Configuration correcte de l'espace de couleur
                texture.colorSpace = SRGBColorSpace;

                // Appliquer la texture comme fond de la scène
                scene.background = texture;

                textureLoaded.current = true;
                console.log('Image de fond chargée avec succès');
            },
            // Progression
            (xhr) => {
                console.log(`Chargement de l'image: ${(xhr.loaded / xhr.total * 100)}% chargé`);
            },
            // Erreur
            (error) => {
                console.error('Erreur lors du chargement de l\'image de fond:', error);
            }
        );

        // Nettoyage
        return () => {
            // Retirer l'arrière-plan lors du démontage
            if (scene.background) {
                if (scene.background.isTexture) {
                    scene.background.dispose();
                }
                scene.background = null;
            }
        };
    }, [scene]);

    // Ce composant ne rend rien directement, il modifie uniquement scene.background
    return null;
};

export default BackgroundImage;