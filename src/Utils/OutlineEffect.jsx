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
 * Composant OutlineEffect corrigé avec gestion du timing et des références
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

    // Vérifier si l'objet est prêt
    const checkObjectReady = () => {
        if (!objectRef?.current) {
            debugLog('ObjectRef not available');
            return false;
        }

        // Vérifier que l'objet a des mesh enfants
        let hasMeshes = false;
        objectRef.current.traverse((child) => {
            if (child.isMesh && child.geometry) {
                hasMeshes = true;
            }
        });

        if (!hasMeshes) {
            debugLog('Object has no meshes yet');
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
                if (checkObjectReady()) {
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
            if (child.isMesh && child.geometry) {
                debugLog('Creating outline for mesh:', child.name || 'unnamed');

                // Cloner la géométrie
                const outlineGeometry = child.geometry.clone();

                // S'assurer que la géométrie a des normales
                if (!outlineGeometry.attributes.normal) {
                    outlineGeometry.computeVertexNormals();
                }

                // Créer le mesh d'outline
                const outlineMesh = new THREE.Mesh(outlineGeometry, material);

                // Appliquer la transformation mondiale du mesh original
                child.updateMatrixWorld(true);
                outlineMesh.matrix.copy(child.matrixWorld);
                outlineMesh.matrix.decompose(outlineMesh.position, outlineMesh.quaternion, outlineMesh.scale);

                // Désactiver l'auto-update pour utiliser la matrice manuelle
                outlineMesh.matrixAutoUpdate = false;

                outlines.push(outlineMesh);
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
            if (child.isMesh && child.geometry) {
                const outlineMesh = new THREE.Mesh(child.geometry.clone(), material);

                // Appliquer la même transformation
                child.updateMatrixWorld(true);
                outlineMesh.matrix.copy(child.matrixWorld);
                outlineMesh.matrix.decompose(outlineMesh.position, outlineMesh.quaternion, outlineMesh.scale);
                outlineMesh.matrixAutoUpdate = false;

                outlines.push(outlineMesh);
            }
        });

        return outlines;
    };

    // Fonction principale pour créer l'effet d'outline
    const createOutlineEffect = () => {
        if (!objectRef?.current || !isReady) {
            debugLog('Cannot create outline: object not ready');
            return;
        }

        debugLog('Creating outline effect with technique:', technique);

        // Nettoyer l'outline existant
        if (outlineRef.current) {
            scene.remove(outlineRef.current);
            outlineRef.current.traverse(child => {
                if (child.geometry) child.geometry.dispose();
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

            // Ajouter tous les meshes d'outline au groupe
            outlineMeshes.forEach(mesh => {
                outlineGroup.add(mesh);
            });

            // Stocker les références des shaders pour l'animation
            shadersRef.current = outlineMeshes
                .map(mesh => mesh.material)
                .filter(material => material.uniforms);

            scene.add(outlineGroup);
            outlineRef.current = outlineGroup;

            debugLog('Outline effect created successfully with', outlineMeshes.length, 'meshes');

        } catch (error) {
            console.error('[OutlineEffect] Error creating outline:', error);
        }
    };

    // Vérifier périodiquement si l'objet est prêt
    useEffect(() => {
        if (!objectRef?.current || objectRef.current === lastObjectRef.current) {
            return;
        }

        lastObjectRef.current = objectRef.current;
        setIsReady(false);

        // Attendre un court délai pour que l'objet soit complètement monté
        const checkTimer = setTimeout(() => {
            if (checkObjectReady()) {
                setIsReady(true);
            } else {
                // Réessayer plusieurs fois
                let attempts = 0;
                const retryInterval = setInterval(() => {
                    attempts++;
                    if (checkObjectReady()) {
                        setIsReady(true);
                        clearInterval(retryInterval);
                    } else if (attempts >= 10) {
                        debugLog('Max attempts reached, object may not be ready');
                        clearInterval(retryInterval);
                    }
                }, 200);
            }
        }, 100);

        return () => clearTimeout(checkTimer);
    }, [objectRef?.current]);

    // Créer l'effet quand l'objet est prêt
    useEffect(() => {
        if (isReady) {
            createOutlineEffect();
        }

        return () => {
            if (outlineRef.current) {
                scene.remove(outlineRef.current);
                outlineRef.current.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                });
            }
        };
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
        Object.values(outlineMaterials).forEach(material => {
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