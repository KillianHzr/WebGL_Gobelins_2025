import {forwardRef, useEffect, useImperativeHandle, useRef, useMemo, useState} from 'react';
import * as THREE from 'three';
import {useThree, useFrame} from '@react-three/fiber';

/**
 * Shader personnalisé pour créer un outline basé sur l'extension des normales
 */
const createOutlineShader = (color, thickness, intensity) => {
    return {
        uniforms: {
            outlineColor: { value: new THREE.Color(color) },
            outlineThickness: { value: thickness },
            outlineIntensity: { value: intensity }
        },
        vertexShader: `
            uniform float outlineThickness;
            
            void main() {
                // Étendre la géométrie le long des normales
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
 * Shader Fresnel pour un outline plus subtil
 */
const createFresnelOutlineShader = (color, intensity, power) => {
    return {
        uniforms: {
            outlineColor: { value: new THREE.Color(color) },
            outlineIntensity: { value: intensity },
            fresnelPower: { value: power }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                vNormal = normalize(normalMatrix * normal);
                
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 outlineColor;
            uniform float outlineIntensity;
            uniform float fresnelPower;
            
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vec3 viewDirection = normalize(vViewPosition);
                float fresnel = 1.0 - abs(dot(viewDirection, vNormal));
                fresnel = pow(fresnel, fresnelPower);
                
                float alpha = fresnel * outlineIntensity;
                if (alpha < 0.1) discard;
                
                gl_FragColor = vec4(outlineColor, alpha);
            }
        `
    };
};

/**
 * Composant OutlineEffect optimisé
 */
const OutlineEffect = forwardRef(({
                                      objectRef,
                                      active = false,
                                      color = '#ffffff',
                                      thickness = 0.02,
                                      intensity = 3,
                                      pulseSpeed = 0,
                                      technique = 'geometry', // 'geometry', 'fresnel', 'hybrid'
                                      fresnelPower = 2.0,
                                      debug = false
                                  }, ref) => {
    const outlineRef = useRef();
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

    // Créer les matériaux de shader
    const outlineMaterials = useMemo(() => {
        const materials = {};

        // Matériau géométrique
        const geometryShader = createOutlineShader(color, thickness, intensity);
        materials.geometry = new THREE.ShaderMaterial({
            ...geometryShader,
            side: THREE.BackSide,
            transparent: false,
            depthWrite: false,
            depthTest: true
        });

        // Matériau Fresnel
        const fresnelShader = createFresnelOutlineShader(color, intensity * 0.5, fresnelPower);
        materials.fresnel = new THREE.ShaderMaterial({
            ...fresnelShader,
            side: THREE.FrontSide,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending
        });

        return materials;
    }, [color, thickness, intensity, fresnelPower]);

    // Fonction pour vérifier si l'objet est prêt
    const checkObjectReady = () => {
        if (!objectRef?.current) {
            debugLog('ObjectRef not available');
            return false;
        }

        const obj = objectRef.current;

        // Vérifier que l'objet a des mesh enfants avec géométries valides
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

        if (!hasMeshes) {
            debugLog('Object has no meshes yet');
            return false;
        }

        if (!hasValidGeometries) {
            debugLog('Object meshes have no valid geometries yet');
            return false;
        }

        // Vérifier que l'objet est dans la scène
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

        // Vérifier que l'objet a une position valide (pas NaN)
        const pos = objectRef.current.position;
        if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
            debugLog('Object has invalid position');
            return false;
        }

        debugLog('Object is ready!');
        return true;
    };

    // Exposer les méthodes via la référence
    useImperativeHandle(ref, () => ({
        outlineGroup: outlineRef.current,

        setVisible: (visible) => {
            if (outlineRef.current) {
                outlineRef.current.visible = visible;
                debugLog('Visibility set to:', visible);
            }
        },

        setColor: (newColor) => {
            Object.values(outlineMaterials).forEach(material => {
                if (material.uniforms && material.uniforms.outlineColor) {
                    material.uniforms.outlineColor.value.set(newColor);
                }
            });
            debugLog('Color changed to:', newColor);
        },

        setThickness: (newThickness) => {
            Object.values(outlineMaterials).forEach(material => {
                if (material.uniforms && material.uniforms.outlineThickness) {
                    material.uniforms.outlineThickness.value = newThickness;
                }
            });
            debugLog('Thickness changed to:', newThickness);
        },

        setIntensity: (newIntensity) => {
            Object.values(outlineMaterials).forEach(material => {
                if (material.uniforms && material.uniforms.outlineIntensity) {
                    material.uniforms.outlineIntensity.value = newIntensity;
                }
            });
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

        getState: () => ({ active, color, thickness, intensity, technique, isReady })
    }));

    // Fonction pour créer l'outline géométrique
    const createGeometryOutline = (targetObject, material) => {
        const outlines = [];

        // Calculer la transformation mondiale de l'objet cible
        targetObject.updateMatrixWorld(true);

        targetObject.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                debugLog('Creating outline for mesh:', child.name || 'unnamed');

                try {
                    // Cloner la géométrie
                    const outlineGeometry = child.geometry.clone();

                    // S'assurer que la géométrie a des normales
                    if (!outlineGeometry.attributes.normal) {
                        outlineGeometry.computeVertexNormals();
                    }

                    // Créer le mesh d'outline
                    const clonedMaterial = material.clone();
                    const outlineMesh = new THREE.Mesh(outlineGeometry, clonedMaterial);

                    // Appliquer la transformation mondiale du mesh original
                    child.updateMatrixWorld(true);
                    outlineMesh.matrix.copy(child.matrixWorld);
                    outlineMesh.matrix.decompose(outlineMesh.position, outlineMesh.quaternion, outlineMesh.scale);

                    // Désactiver l'auto-update pour utiliser la matrice manuelle
                    outlineMesh.matrixAutoUpdate = false;

                    outlines.push(outlineMesh);
                } catch (error) {
                    console.warn('[OutlineEffect] Error creating outline for mesh:', error);
                }
            }
        });

        debugLog('Created', outlines.length, 'outline meshes');
        return outlines;
    };

    // Fonction pour créer l'outline Fresnel
    const createFresnelOutline = (targetObject, material) => {
        const outlines = [];

        targetObject.updateMatrixWorld(true);

        targetObject.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                try {
                    const clonedMaterial = material.clone();
                    const outlineMesh = new THREE.Mesh(child.geometry.clone(), clonedMaterial);

                    // Appliquer la même transformation
                    child.updateMatrixWorld(true);
                    outlineMesh.matrix.copy(child.matrixWorld);
                    outlineMesh.matrix.decompose(outlineMesh.position, outlineMesh.quaternion, outlineMesh.scale);
                    outlineMesh.matrixAutoUpdate = false;

                    outlines.push(outlineMesh);
                } catch (error) {
                    console.warn('[OutlineEffect] Error creating fresnel outline for mesh:', error);
                }
            }
        });

        return outlines;
    };

    // Fonction principale pour créer l'effet d'outline
    const createOutlineEffect = () => {
        if (!objectRef?.current || !isReady || !mountedRef.current) {
            debugLog('Cannot create outline: object not ready or component unmounted');
            return;
        }

        debugLog('Creating outline effect with technique:', technique);

        // Nettoyer l'outline existant
        if (outlineRef.current) {
            scene.remove(outlineRef.current);
            outlineRef.current.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        const outlineGroup = new THREE.Group();
        outlineGroup.name = 'OutlineEffect';
        outlineGroup.visible = active;

        let outlineMeshes = [];

        try {
            switch (technique) {
                case 'geometry':
                    outlineMeshes = createGeometryOutline(objectRef.current, outlineMaterials.geometry);
                    break;

                case 'fresnel':
                    outlineMeshes = createFresnelOutline(objectRef.current, outlineMaterials.fresnel);
                    break;

                case 'hybrid':
                default:
                    const geometryOutlines = createGeometryOutline(objectRef.current, outlineMaterials.geometry);
                    const fresnelOutlines = createFresnelOutline(objectRef.current, outlineMaterials.fresnel);
                    outlineMeshes = [...geometryOutlines, ...fresnelOutlines];
                    break;
            }

            if (outlineMeshes.length === 0) {
                debugLog('No outline meshes created - retrying in a moment');
                // Réessayer après un délai
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

            // Ajouter tous les meshes d'outline au groupe
            outlineMeshes.forEach((mesh, index) => {
                mesh.name = `outline-mesh-${index}`;
                outlineGroup.add(mesh);
            });

            // Stocker les références des shaders pour l'animation
            shadersRef.current = outlineMeshes
                .map(mesh => mesh.material)
                .filter(material => material.uniforms);

            // Ajouter le groupe à la scène
            scene.add(outlineGroup);
            outlineRef.current = outlineGroup;

            debugLog('Outline effect created successfully with', outlineMeshes.length, 'meshes');

        } catch (error) {
            console.error('[OutlineEffect] Error creating outline:', error);
            // Réessayer en cas d'erreur
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
        // S'assurer que le composant est marqué comme monté
        mountedRef.current = true;

        if (!objectRef?.current) {
            return;
        }

        // Forcer la vérification si l'objet n'est pas ready, même si pas changé
        const shouldCheck = (objectRef.current !== lastObjectRef.current) || !isReady;

        if (!shouldCheck) {
            return;
        }

        lastObjectRef.current = objectRef.current;
        setIsReady(false);

        // Nettoyer les timeouts précédents
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
                debugLog('Max attempts reached, object may not be ready');
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
    }, [isReady, technique]);

    // Mettre à jour la visibilité
    useEffect(() => {
        if (outlineRef.current) {
            outlineRef.current.visible = active;
            debugLog('Active state changed to:', active);
        }
    }, [active]);

    // Mettre à jour les propriétés des shaders
    useEffect(() => {
        Object.values(outlineMaterials).forEach((material) => {
            if (material.uniforms) {
                if (material.uniforms.outlineColor) {
                    material.uniforms.outlineColor.value.set(color);
                }
                if (material.uniforms.outlineThickness) {
                    material.uniforms.outlineThickness.value = thickness;
                }
                if (material.uniforms.outlineIntensity) {
                    material.uniforms.outlineIntensity.value = intensity;
                }
            }
        });
    }, [color, thickness, intensity, outlineMaterials]);

    // Cleanup lors du démontage
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
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        };
    }, [scene]);

    // Animation de pulsation
    useFrame((state, delta) => {
        if (!active || pulseSpeed <= 0 || shadersRef.current.length === 0) return;

        // Calculer la pulsation
        pulseRef.current.value += delta * pulseSpeed * pulseRef.current.direction;

        if (pulseRef.current.value >= 1) {
            pulseRef.current.value = 1;
            pulseRef.current.direction = -1;
        } else if (pulseRef.current.value <= 0) {
            pulseRef.current.value = 0;
            pulseRef.current.direction = 1;
        }

        // Appliquer la pulsation aux shaders
        const pulseIntensity = intensity * (0.5 + 0.5 * pulseRef.current.value);

        shadersRef.current.forEach(material => {
            if (material.uniforms) {
                if (material.uniforms.time) {
                    material.uniforms.time.value = state.clock.elapsedTime;
                }
                if (material.uniforms.outlineIntensity) {
                    material.uniforms.outlineIntensity.value = pulseIntensity;
                }
            }
        });
    });

    return null;
});

OutlineEffect.displayName = 'OutlineEffect';

export default OutlineEffect;