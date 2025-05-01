export const GrainShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        grainIntensity: { value: 0.05 },
        grainFPS: { value: 24.0 }, // Contrôle de vitesse en FPS
        enabled: { value: true },
        resolution: { value: { x: window.innerWidth, y: window.innerHeight } }
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

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            
            if (enabled) {
                // Coordonnées en pixels
                vec2 texCoord = vUv * resolution;
                
                // Génération du grain avec déplacement aléatoire
                float grain = noise(texCoord, time) * grainIntensity;
                
                // Application du grain
                color.rgb += vec3(grain);
            }
            
            gl_FragColor = color;
        }
    `
};