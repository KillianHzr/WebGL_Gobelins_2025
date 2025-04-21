import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';

/**
 * Composant qui crée un effet de contour (outline) pour n'importe quel modèle 3D
 * Simule un effet de post-processing en utilisant une technique de "silhouette"
 *
 * @param {Object} props - Propriétés du composant
 * @param {React.RefObject} props.objectRef - Référence à l'objet à entourer
 * @param {boolean} props.active - Indique si l'effet est actif
 * @param {string} props.color - Couleur du contour (par défaut blanc)
 * @param {number} props.thickness - Épaisseur du contour (0.01-0.1)
 * @param {number} props.intensity - Intensité lumineuse du contour (1-10)
 * @param {number} props.pulseSpeed - Vitesse de pulsation (0 pour désactiver)
 */
const OutlineEffect = forwardRef(({
                                      objectRef,
                                      active = false,
                                      color = '#ffffff',
                                      thickness = 0.03,
                                      intensity = 5,
                                      pulseSpeed = 1.2
                                  }, ref) => {
    const outlineRef = useRef();
    const pulseRef = useRef({value: 0, direction: 1});
    const {scene} = useThree();

    // Exposer des méthodes et propriétés via la référence
    useImperativeHandle(ref, () => ({
        outlineGroup: outlineRef.current,

        // Méthode pour définir la visibilité du contour
        setVisible: (visible) => {
            if (outlineRef.current) {
                outlineRef.current.visible = visible;
            }
        },

        // Méthode pour changer la couleur en cours d'exécution
        setColor: (newColor) => {
            if (outlineRef.current) {
                outlineRef.current.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.color.set(newColor);
                    }
                });
            }
        },

        setThickness: (newThickness) => {
            if (outlineRef.current) {
                outlineRef.current.traverse(child => {
                    if (child.isMesh && child.userData.original) {
                        const original = child.userData.original;
                        child.scale.copy(original.scale).multiplyScalar(1 + newThickness);
                    }
                });
            }
        },

        getState: () => ({active, color, thickness, intensity, pulseSpeed})
    }));

    useEffect(() => {
        if (!objectRef?.current || !scene) return;

        try {
            if (outlineRef.current) {
                scene.remove(outlineRef.current);

                if (outlineRef.current.children) {
                    outlineRef.current.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m && m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                }
            }

            // Créer un groupe pour contenir les meshes de contour
            const outlineGroup = new THREE.Group();
            outlineGroup.visible = active;
            outlineGroup.name = 'OutlineEffect';

            // Fonction pour créer un matériau de contour plus éclatant
            const createOutlineMaterial = () => {
                return new THREE.MeshBasicMaterial({
                    color: new THREE.Color(color).multiplyScalar(2.0),
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: Math.min(1, intensity * 0.7),
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    toneMapped: false
                });
            };

            // Fonction récursive pour traiter tous les meshes dans l'objet
            const processObject = (object, parent = outlineGroup) => {
                if (object.type === 'Mesh' && object.geometry) {
                    const outlineMaterial = createOutlineMaterial();
                    const outlineMesh = new THREE.Mesh(object.geometry.clone(), outlineMaterial);

                    outlineMesh.position.copy(object.position);
                    outlineMesh.rotation.copy(object.rotation);
                    outlineMesh.scale.copy(object.scale).multiplyScalar(1 + thickness);

                    outlineMesh.userData.original = object;

                    parent.add(outlineMesh);
                }

                if (object.children && object.children.length > 0) {
                    const childGroup = new THREE.Group();
                    childGroup.position.copy(object.position);
                    childGroup.rotation.copy(object.rotation);
                    childGroup.scale.copy(object.scale);
                    parent.add(childGroup);

                    object.children.forEach(child => {
                        processObject(child, childGroup);
                    });
                }
            };

            processObject(objectRef.current);

            scene.add(outlineGroup);
            outlineRef.current = outlineGroup;
        } catch (error) {
            console.error("Erreur lors de la création de l'effet de contour:", error);
        }

        return () => {
            try {
                if (outlineRef.current) {
                    scene.remove(outlineRef.current);

                    outlineRef.current.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m && m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });

                    outlineRef.current = null;
                }
            } catch (error) {
                console.error("Erreur lors du nettoyage de l'effet de contour:", error);
            }
        };
    }, [objectRef?.current, scene, color, thickness, intensity]);

    // Mettre à jour la visibilité
    useEffect(() => {
        if (outlineRef.current) {
            outlineRef.current.visible = active;
        }
    }, [active]);

    // Animation de pulsation
    useFrame((state, delta) => {
        if (!outlineRef.current || !active || pulseSpeed <= 0) return;

        try {
            // Mettre à jour la valeur de pulsation
            pulseRef.current.value += delta * pulseSpeed * pulseRef.current.direction;

            if (pulseRef.current.value >= 1) {
                pulseRef.current.value = 1;
                pulseRef.current.direction = -1;
            } else if (pulseRef.current.value <= 0) {
                pulseRef.current.value = 0;
                pulseRef.current.direction = 1;
            }

            // Facteur de pulsation (entre 0.8 et 1.2)
            const pulseFactor = 1 + (0.4 * pulseRef.current.value - 0.2);

            // Mettre à jour les meshes de contour
            outlineRef.current.traverse(child => {
                if (child.isMesh && child.userData.original) {
                    const original = child.userData.original;

                    child.position.copy(original.position);
                    child.rotation.copy(original.rotation);

                    child.scale.copy(original.scale).multiplyScalar(1 + thickness * pulseFactor * 1.2);

                    // Faire varier l'opacité et l'intensité pour un effet éclatant
                    if (child.material) {
                        const baseOpacity = Math.min(1, intensity * 0.7);
                        const pulseOpacity = Math.min(0.3, intensity * 0.3) * pulseRef.current.value;
                        child.material.opacity = baseOpacity + pulseOpacity;

                        const pulseColorIntensity = 2.0 + pulseRef.current.value * 1.5;
                        child.material.color.set(color).multiplyScalar(pulseColorIntensity);
                    }
                }
            });
        } catch (error) {
            console.error("Erreur dans l'animation de l'effet de contour:", error);
        }
    });

    return null;
});

export default OutlineEffect;