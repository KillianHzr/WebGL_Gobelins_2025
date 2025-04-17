// Structure d'un asset:
// {
//     name: '',    // Identifiant unique
//     type: '',    // Type d'asset: texture, exr, hdr, fbx, gltf, material
//     path: '',    // Chemin vers le fichier
//     license: '', // Information sur la licence
//     author: '',  // Auteur de l'asset
//     url: ''      // URL source
// }

// Définition des assets à charger
const assets = [
    {
        name: 'map',
        type: 'gltf',
        path: '/models/MapScene.glb'
    }
];

export default assets;