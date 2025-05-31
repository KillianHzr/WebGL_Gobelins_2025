import {forwardRef, useEffect, useImperativeHandle, useRef, useMemo, useState} from 'react';
import * as THREE from 'three';
import {useThree, useFrame} from '@react-three/fiber';

/**
 * Shader simple pour outline géométrique avec two-pass rendering
 */
const createTwoPassOutlineShader = (color, thickness, intensity) => {
    return {
        uniforms: {
            outlineColor: { value: new THREE.Color(color) },
            outlineThickness: { value: thickness },
            outlineIntensity: { value: intensity }
        },
        vertexShader: `
            uniform float outlineThickness;
            
            void main() {
                // Extension simple des normales
                vec3 newPosition = position + normal * outlineThickness;
                
                vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 outlineColor;
            uniform float outlineIntensity;
            
            void main() {
                gl_FragColor = vec4(outlineColor * outlineIntensity, 1.0);
            }
        `
    };
};

/**
 * Shader pour l'objet original (masquage)
 */
const createMaskShader = () => {
    return {
        vertexShader: `
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            void main() {
                // Couleur transparente pour masquer
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            }
        `
    };
};

/**
 * Composant OutlineEffect avec two-pass rendering
 */
const OutlineEffect = forwardRef(({
                                      objectRef,
                                      active = false,
                                      color = '#ffffff',
                                      thickness = 0.02,
                                      intensity = 3,
                                      pulseSpeed = 0,
                                      debug = false
                                  }, ref) => {
    const outlineRef = useRef();
    const maskRef = useRef();
    const pulseRef = useRef({ value: 0, direction: 1 });
    const shadersRef = useRef([]);
    const { scene } = useThree();
    const [isReady, setIsReady] = useState(false);
    const lastObjectRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const mountedRef = useRef(true);

    // Debug function
    const debugLog = (...args) => {
        if (debug) console.log('[OutlineEffect]', ...args);
    };

    // Créer les matériaux
    const materials = useMemo(() => {
        // Matériau pour l'outline (rendu en premier, en arrière)
        const outlineShader = createTwoPassOutlineShader(color, thickness, intensity);
        const outlineMaterial = new THREE.ShaderMaterial({
            ...outlineShader,
            side: THREE.BackSide,
            transparent: false,
            depthWrite: true,
            depthTest: true
        });

        // Matériau pour masquer l'outline à l'intérieur (rendu en second, en avant)
        const maskShader = createMaskShader();
        const maskMaterial = new THREE.ShaderMaterial({
            ...maskShader,
            side: THREE.FrontSide,
            transparent: true,
            depthWrite: true,
            depthTest: true,
            colorWrite: false // Ne pas écrire de couleur, juste la profondeur
        });

        return { outline: outlineMaterial, mask: maskMaterial };
    }, [color, thickness, intensity]);

    // Fonction pour vérifier si l'objet est prêt
    const checkObjectReady = () => {
        if (!objectRef?.current) {
            debugLog('ObjectRef not available');
            return false;
        }

        let hasMeshes = false;
        let hasValidGeometries = false;

        objectRef.current.traverse((child) => {
            if (child.isMesh) {
                hasMeshes = true;
                if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                    hasValidGeometries = true;
                }
            }
        });

        if (!hasMeshes || !hasValidGeometries) {
            debugLog('Object not ready: missing meshes or geometries');
            return false;
        }

        let isInScene = false;
        let current = objectRef.current;
        while (current) {
            if (current === scene) {
                isInScene = true;
                break;
            }
            current = current.parent;
        }

        if (!isInScene) {
            debugLog('Object not in scene yet');
            return false;
        }

        debugLog('Object is ready!');
        return true;
    };

    // Exposer les méthodes via la référence
    useImperativeHandle(ref, () => ({
        outlineGroup: outlineRef.current,
        maskGroup: maskRef.current,

        setVisible: (visible) => {
            if (outlineRef.current) {
                outlineRef.current.visible = visible;
            }
            if (maskRef.current) {
                maskRef.current.visible = visible;
            }
            debugLog('Visibility set to:', visible);
        },

        setColor: (newColor) => {
            if (materials.outline.uniforms && materials.outline.uniforms.outlineColor) {
                materials.outline.uniforms.outlineColor.value.set(newColor);
            }
            debugLog('Color changed to:', newColor);
        },

        setThickness: (newThickness) => {
            if (materials.outline.uniforms && materials.outline.uniforms.outlineThickness) {
                materials.outline.uniforms.outlineThickness.value = newThickness;
            }
            debugLog('Thickness changed to:', newThickness);
        },

        setIntensity: (newIntensity) => {
            if (materials.outline.uniforms && materials.outline.uniforms.outlineIntensity) {
                materials.outline.uniforms.outlineIntensity.value = newIntensity;
            }
            debugLog('Intensity changed to:', newIntensity);
        },

        refresh: () => {
            debugLog('Manual refresh requested');
            setIsReady(false);
            setTimeout(() => {
                if (mountedRef.current && checkObjectReady()) {
                    setIsReady(true);
                }
            }, 100);
        },

        getState: () => ({ active, color, thickness, intensity, isReady })
    }));

    // Fonction pour créer un groupe de meshes depuis l'objet cible
    const createMeshGroup = (targetObject, material, groupName) => {
        const meshes = [];

        targetObject.updateMatrixWorld(true);

        targetObject.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                debugLog(`Creating ${groupName} mesh for:`, child.name || 'unnamed');

                try {
                    // Cloner la géométrie
                    const geometry = child.geometry.clone();

                    // S'assurer que la géométrie a des normales
                    if (!geometry.attributes.normal) {
                        geometry.computeVertexNormals();
                    }

                    // Créer le mesh
                    const clonedMaterial = material.clone();
                    const mesh = new THREE.Mesh(geometry, clonedMaterial);

                    // Appliquer la transformation du mesh original
                    child.updateMatrixWorld(true);
                    mesh.matrix.copy(child.matrixWorld);
                    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
                    mesh.matrixAutoUpdate = false;

                    meshes.push(mesh);
                } catch (error) {
                    console.warn(`[OutlineEffect] Error creating ${groupName} mesh:`, error);
                }
            }
        });

        debugLog(`Created ${meshes.length} ${groupName} meshes`);
        return meshes;
    };

    // Fonction principale pour créer l'effet d'outline
    const createOutlineEffect = () => {
        if (!objectRef?.current || !isReady || !mountedRef.current) {
            debugLog('Cannot create outline: object not ready or component unmounted');
            return;
        }

        debugLog('Creating two-pass outline effect');

        // Nettoyer les outlines existants
        if (outlineRef.current) {
            scene.remove(outlineRef.current);
            outlineRef.current.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        if (maskRef.current) {
            scene.remove(maskRef.current);
            maskRef.current.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        try {
            // Créer le groupe d'outline (rendu en premier avec BackSide)
            const outlineGroup = new THREE.Group();
            outlineGroup.name = 'TwoPassOutline';
            outlineGroup.visible = active;

            const outlineMeshes = createMeshGroup(objectRef.current, materials.outline, 'outline');

            // Assigner des renderOrder pour contrôler l'ordre de rendu
            outlineMeshes.forEach((mesh, index) => {
                mesh.name = `outline-mesh-${index}`;
                mesh.renderOrder = -100; // Rendu en premier
                outlineGroup.add(mesh);
            });

            // Créer le groupe de masque (rendu en second avec FrontSide)
            const maskGroup = new THREE.Group();
            maskGroup.name = 'TwoPassMask';
            maskGroup.visible = active;

            const maskMeshes = createMeshGroup(objectRef.current, materials.mask, 'mask');

            maskMeshes.forEach((mesh, index) => {
                mesh.name = `mask-mesh-${index}`;
                mesh.renderOrder = -99; // Rendu après l'outline
                maskGroup.add(mesh);
            });

            if (outlineMeshes.length === 0) {
                debugLog('No outline meshes created - retrying...');
                if (retryTimeoutRef.current) {
                    clearTimeout(retryTimeoutRef.current);
                }
                retryTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        createOutlineEffect();
                    }
                }, 500);
                return;
            }

            // Stocker les références pour l'animation
            shadersRef.current = [materials.outline].filter(material => material.uniforms);

            // Ajouter à la scène
            scene.add(outlineGroup);
            scene.add(maskGroup);
            outlineRef.current = outlineGroup;
            maskRef.current = maskGroup;

            debugLog('Two-pass outline created with', outlineMeshes.length, 'outline meshes and', maskMeshes.length, 'mask meshes');

        } catch (error) {
            console.error('[OutlineEffect] Error creating two-pass outline:', error);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            retryTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                    createOutlineEffect();
                }
            }, 1000);
        }
    };

    // Système de retry pour vérifier si l'objet est prêt
    useEffect(() => {
        mountedRef.current = true;

        if (!objectRef?.current) {
            return;
        }

        const shouldCheck = (objectRef.current !== lastObjectRef.current) || !isReady;
        if (!shouldCheck) {
            return;
        }

        lastObjectRef.current = objectRef.current;
        setIsReady(false);

        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }

        const attemptToReady = (attempt = 0) => {
            if (!mountedRef.current) {
                return;
            }

            if (checkObjectReady()) {
                setIsReady(true);
                debugLog('Object ready after', attempt, 'attempts');
            } else if (attempt < 20) {
                retryTimeoutRef.current = setTimeout(() => attemptToReady(attempt + 1), 200);
            } else {
                debugLog('Max attempts reached');
            }
        };

        retryTimeoutRef.current = setTimeout(() => attemptToReady(0), 50);

        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [objectRef?.current, isReady]);

    // Créer l'effet quand l'objet est prêt
    useEffect(() => {
        if (isReady && mountedRef.current) {
            const timer = setTimeout(() => {
                if (mountedRef.current) {
                    createOutlineEffect();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isReady]);

    // Mettre à jour la visibilité
    useEffect(() => {
        if (outlineRef.current && maskRef.current) {
            outlineRef.current.visible = active;
            maskRef.current.visible = active;
            debugLog('Active state changed to:', active);
        }
    }, [active]);

    // Mettre à jour les propriétés des shaders
    useEffect(() => {
        if (materials.outline.uniforms) {
            if (materials.outline.uniforms.outlineColor) {
                materials.outline.uniforms.outlineColor.value.set(color);
            }
            if (materials.outline.uniforms.outlineThickness) {
                materials.outline.uniforms.outlineThickness.value = thickness;
            }
            if (materials.outline.uniforms.outlineIntensity) {
                materials.outline.uniforms.outlineIntensity.value = intensity;
            }
        }
    }, [color, thickness, intensity, materials]);

    // Cleanup
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            if (outlineRef.current) {
                scene.remove(outlineRef.current);
                outlineRef.current.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
            if (maskRef.current) {
                scene.remove(maskRef.current);
                maskRef.current.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        };
    }, [scene]);

    // Animation de pulsation
    useFrame((state, delta) => {
        if (!active || pulseSpeed <= 0 || shadersRef.current.length === 0) return;

        // Pulsation
        pulseRef.current.value += delta * pulseSpeed * pulseRef.current.direction;

        if (pulseRef.current.value >= 1) {
            pulseRef.current.value = 1;
            pulseRef.current.direction = -1;
        } else if (pulseRef.current.value <= 0) {
            pulseRef.current.value = 0;
            pulseRef.current.direction = 1;
        }

        const pulseIntensity = intensity * (0.5 + 0.5 * pulseRef.current.value);

        shadersRef.current.forEach(material => {
            if (material.uniforms && material.uniforms.outlineIntensity) {
                material.uniforms.outlineIntensity.value = pulseIntensity;
            }
        });
    });

    return null;
});

OutlineEffect.displayName = 'OutlineEffect';

export default OutlineEffect;