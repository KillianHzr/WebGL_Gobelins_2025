export const GrainShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        grainIntensity: { value: 0.05 },
        grainFPS: { value: 24.0 },
        enabled: { value: true },
        resolution: { value: { x: window.innerWidth, y: window.innerHeight } },
        toneMappingType: { value: 0 }, // 0: NoToneMapping, 1: LinearToneMapping, etc.
        toneMappingExp: { value: 1.0 }
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float grainIntensity;
        uniform float grainFPS;
        uniform bool enabled;
        uniform vec2 resolution;
        uniform int toneMappingType;
        uniform float toneMappingExp;
        
        varying vec2 vUv;

        // Fonction de hachage pour générer un nombre aléatoire à partir de 3 valeurs
        float hash(vec3 p) {
            p = fract(p * vec3(0.1031, 0.1030, 0.0973));
            p += dot(p, p.yxz + 33.33);
            return fract((p.x + p.y) * p.z);
        }
        
        // Fonction de bruit pour générer un grain qui se déplace de façon aléatoire
        float noise(vec2 p, float t) {
            // Discretiser le temps selon le FPS désiré
            float frameTime = floor(t * grainFPS) / grainFPS;
            
            // Générer un offset aléatoire basé sur le frame time
            vec2 offset = vec2(
                hash(vec3(frameTime, 0.0, 0.0)) * 2.0 - 1.0,
                hash(vec3(0.0, frameTime, 0.0)) * 2.0 - 1.0
            ) * 10.0; // Ampleur du déplacement
            
            // Appliquer l'offset aux coordonnées
            p += offset;
            
            // Utiliser hash avec les coordonnées et le temps pour un bruit vraiment aléatoire
            return hash(vec3(p, frameTime)) * 2.0 - 1.0;
        }

        // ACESFilmicToneMapping
        vec3 ACESFilmic(vec3 color) {
            float a = 2.51;
            float b = 0.03;
            float c = 2.43;
            float d = 0.59;
            float e = 0.14;
            return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
        }

        // ReinhardToneMapping
        vec3 Reinhard(vec3 color) {
            return color / (1.0 + color);
        }
        
        // CineonToneMapping
        vec3 Cineon(vec3 color) {
            color = max(vec3(0.0), color - 0.004);
            color = (color * (6.2 * color + 0.5)) / (color * (6.2 * color + 1.7) + 0.06);
            return color;
        }

        // Appliquer le tone mapping basé sur le mode sélectionné
        vec3 applyCustomToneMapping(vec3 color, int mode, float exposure) {
            // Appliquer l'exposition
            color *= exposure;
            
            // Appliquer le tone mapping spécifique
            if (mode == 1) { // LinearToneMapping
                return color;
            } else if (mode == 2) { // ReinhardToneMapping
                return Reinhard(color);
            } else if (mode == 3) { // CineonToneMapping
                return Cineon(color);
            } else if (mode == 4) { // ACESFilmicToneMapping
                return ACESFilmic(color);
            }
            
            // NoToneMapping (mode == 0) ou par défaut
            return color;
        }

        void main() {
            // Récupérer la couleur de base
            vec4 color = texture2D(tDiffuse, vUv);
            
            // Appliquer le grain dans l'espace linéaire
            if (enabled) {
                // Coordonnées en pixels
                vec2 texCoord = vUv * resolution;
                
                // Génération du grain avec déplacement aléatoire
                float grain = noise(texCoord, time) * grainIntensity;
                
                // Application du grain
                color.rgb += vec3(grain);
            }
            
            // Appliquer le tone mapping seulement si nous ne sommes pas en mode NoToneMapping
            if (toneMappingType > 0) {
                color.rgb = applyCustomToneMapping(color.rgb, toneMappingType, toneMappingExp);
            }
                        color.rgb = pow(color.rgb, vec3(1.0 / toneMappingExp));

            gl_FragColor = color;
        }
    `
};