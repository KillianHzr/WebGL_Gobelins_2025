import {useEffect, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {Color, Fog, TextureLoader} from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';

/**
 * Composant intégré qui gère à la fois l'image de fond et le brouillard progressif
 * pour une meilleure intégration entre les deux
 */
const BackgroundWithFog = () => {
        const {scene} = useThree();
        const timelinePosition = useStore(state => state.timelinePosition);
        const sequenceLength = useStore(state => state.sequenceLength);
        const debug = useStore(state => state.debug);
        const gui = useStore(state => state.gui);

        // Références pour suivre l'état
        const textureLoaded = useRef(false);
        const guiInitializedRef = useRef(false);
        const bgColorRef = useRef(null);

        // Configuration de base pour le brouillard
        const fogConfigRef = useRef({
            enabled: true,
            color: guiConfig.scene.fog.color.color,
            startPoint: guiConfig.scene.fog.transition?.startPoint?.default || 0.3,
            endPoint: guiConfig.scene.fog.transition?.endPoint?.default || 0.7,
            initialNear: guiConfig.scene.fog.transition.initialNear.default, // Très éloigné (invisible au début)
            initialFar: guiConfig.scene.fog.transition.initialFar.default,  // Très éloigné (invisible au début)
            targetNear: guiConfig.scene.fog.near.default,
            targetFar: guiConfig.scene.fog.far.default
        });

        // Chargement de l'image de fond
        useEffect(() => {
                if (textureLoaded.current || !scene) return;

                const loader = new TextureLoader();
                const backgroundPath = '/textures/Background.png';

                console.log(`Chargement de l'image de fond depuis: ${backgroundPath}`);


                // Définir l'image comme fond
                scene.background = new Color(fogConfigRef.current.color);


                // Analyser la couleur dominante de l'image pour adapter le brouillard
                // Cette partie est simulée - dans un cas réel vous pourriez analyser l'image
                // Pour simplifier, on utilise la couleur définie dans la config
                bgColorRef.current = new Color(fogConfigRef.current.color);

                // Initialiser le brouillard avec une couleur coordonnée à l'image
                // et des valeurs initiales lointaines (invisible au début)
                scene.fog = new Fog(
                    bgColorRef.current,
                    fogConfigRef.current.initialNear,
                    fogConfigRef.current.initialFar
                );


                // Nettoyage
                return () => {
                    if (scene.background && scene.background.isTexture) {
                        scene.background.dispose();
                        scene.background = null;
                    }

                    if (scene.fog) {
                        scene.fog = null;
                    }
                };
            }, [scene]
        )
        ;

// Initialiser les contrôles GUI en mode debug
        useEffect(() => {
            if (debug?.active && gui && !guiInitializedRef.current && scene.fog) {
                // Trouver ou créer le dossier Scene
                let sceneFolder = gui.folders?.find(folder => folder.name === 'Scene');
                if (!sceneFolder) {
                    sceneFolder = gui.addFolder('Scene');
                }

                // Créer un dossier pour le brouillard
                const fogFolder = sceneFolder.addFolder('Fog');

                // Objet pour le contrôle
                const fogControls = {
                    color: fogConfigRef.current.color,
                    near: fogConfigRef.current.targetNear,
                    far: fogConfigRef.current.targetFar,
                    startPoint: fogConfigRef.current.startPoint,
                    endPoint: fogConfigRef.current.endPoint
                };

                // Ajouter les contrôles
                fogFolder.addColor(fogControls, 'color')
                    .name('Couleur du brouillard')
                    .onChange(value => {
                        if (scene.fog) {
                            scene.fog.color.set(value);
                            fogConfigRef.current.color = value;
                        }
                    });

                fogFolder.add(fogControls, 'near', 0, 50, 0.1)
                    .name('Distance minimale')
                    .onChange(value => {
                        fogConfigRef.current.targetNear = value;
                    });

                fogFolder.add(fogControls, 'far', 5, 100, 0.1)
                    .name('Distance maximale')
                    .onChange(value => {
                        fogConfigRef.current.targetFar = value;
                    });

                // Contrôles de transition
                const transitionFolder = fogFolder.addFolder('Transition');

                transitionFolder.add(fogControls, 'startPoint', 0, 1, 0.01)
                    .name('Début transition')
                    .onChange(value => {
                        fogConfigRef.current.startPoint = value;
                    });

                transitionFolder.add(fogControls, 'endPoint', 0, 1, 0.01)
                    .name('Fin transition')
                    .onChange(value => {
                        fogConfigRef.current.endPoint = value;
                    });

                guiInitializedRef.current = true;
            }
        }, [debug, gui, scene.fog]);

// Mettre à jour le brouillard en fonction de la position de défilement
        useFrame(() => {
            if (!scene.fog || sequenceLength <= 0) return;

            // Récupérer la configuration actuelle
            const config = fogConfigRef.current;

            // Calculer la progression du défilement (0 à 1)
            const scrollProgress = Math.max(0, Math.min(1, timelinePosition / sequenceLength));

            // Calculer l'intensité du brouillard en fonction de la progression
            let fogIntensity = 0;
            if (scrollProgress > config.startPoint) {
                fogIntensity = Math.min(1, (scrollProgress - config.startPoint) / (config.endPoint - config.startPoint));
            }

            // Interpoler les valeurs du brouillard entre les valeurs initiales et cibles
            const currentNear = config.initialNear - (config.initialNear - config.targetNear) * fogIntensity;
            const currentFar = config.initialFar - (config.initialFar - config.targetFar) * fogIntensity;

            // Mettre à jour le brouillard
            scene.fog.near = currentNear;
            scene.fog.far = currentFar;
        });

// Ce composant ne rend rien visuellement, il modifie uniquement scene.background et scene.fog
        return null;
    }
;

export default BackgroundWithFog;