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
    // Map
    {
        name: 'Map',
        type: 'gltf',
        path: '/models/Map.glb', // Chemin absolu depuis le dossier "static"
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    // Trees
    {
        name: 'Tree1',
        type: 'gltf',
        path: '/models/forest/tree/Tree1.glb', // Chemin absolu depuis le dossier "static"
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'Tree2',
        type: 'gltf',
        path: '/models/forest/tree/Tree2.glb', // Chemin absolu depuis le dossier "static"
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'Tree3',
        type: 'gltf',
        path: '/models/forest/tree/Tree3.glb', // Chemin absolu depuis le dossier "static"
        license: 'CC-BY',
        author: 'Author',
        url: ''
    }
];

export default assets;