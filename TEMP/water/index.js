import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

var camera, scene, renderer, waterfall, clock;
// Facteur de ralentissement pour l'eau
var FLOW_SPEED = 0.3;
// Taille de base du shader (en unités Three.js)
// Taille de base du shader (en unités Three.js)
// Définit l'échelle à laquelle le shader est naturellement conçu
// Cette taille sert de référence pour la répétition du pattern
var BASE_SHADER_SIZE = new THREE.Vector2(2, 2);

init();
animate();

function init() {
    clock = new THREE.Clock();

    // Caméra
    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 6, 8);

    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e485e);

    // Lumières
    var ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    scene.add(ambientLight);

    var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 5, 5);
    scene.add(dirLight);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.gammaOutput = true;
    document.body.appendChild(renderer.domElement);

    // Textures pour la cascade
    var loader = new THREE.TextureLoader();
    var noiseMap = loader.load("https://i.imgur.com/gPz7iPX.jpg");
    var dudvMap = loader.load("https://i.imgur.com/hOIsXiZ.png");

    noiseMap.wrapS = noiseMap.wrapT = THREE.RepeatWrapping;
    noiseMap.minFilter = THREE.NearestFilter;
    noiseMap.magFilter = THREE.NearestFilter;
    dudvMap.wrapS = dudvMap.wrapT = THREE.RepeatWrapping;

    // Dimensions du mesh de la cascade
    const waterfallWidth = 50;
    const waterfallHeight = 50;
    const meshSize = new THREE.Vector2(waterfallWidth, waterfallHeight);

    // Matériau pour la cascade
    var waterfallUniforms = {
        time: {
            value: 0,
        },
        tNoise: {
            value: null,
        },
        tDudv: {
            value: null,
        },
        topDarkColor: {
            value: new THREE.Color(0x3f7dce),
        },
        bottomDarkColor: {
            value: new THREE.Color(0x3f7dce),
        },
        topLightColor: {
            value: new THREE.Color(0x193252),
        },
        bottomLightColor: {
            value: new THREE.Color(0x193252),
        },
        foamColor: {
            value: new THREE.Color(0xffffff),
        },
        baseSize: {
            value: BASE_SHADER_SIZE,
        },
        meshSize: {
            value: meshSize,
        },
    };

    var waterfallMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib["fog"],
            waterfallUniforms,
        ]),
        vertexShader: document.getElementById("vertexShaderWaterfall").textContent,
        fragmentShader: document.getElementById("fragmentShaderWaterfall")
            .textContent,
        fog: true,
    });

    // Création de la cascade horizontale
    waterfall = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(waterfallWidth, waterfallHeight),
        waterfallMaterial
    );
    waterfall.position.y = 3;
    // On positionne la cascade horizontalement
    waterfall.rotation.x = -Math.PI * 0.5; // Rotation de -90 degrés autour de l'axe X pour la rendre horizontale
    waterfall.position.z = 0;
    scene.add(waterfall);

    // Application des textures
    waterfallMaterial.uniforms.tNoise.value = noiseMap;
    waterfallMaterial.uniforms.tDudv.value = dudvMap;

    // Contrôles de caméra
    var controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;
    controls.maxDistance = 50;

    // Gestion du redimensionnement de la fenêtre
    window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Mise à jour du temps pour l'animation du shader
    // On applique le facteur de ralentissement
    var time = clock.getElapsedTime() * FLOW_SPEED;
    waterfall.material.uniforms.time.value = time;

    // Rendu de la scène
    renderer.render(scene, camera);
}
