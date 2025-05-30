#!/bin/bash

# Script pour optimiser récursivement les fichiers GLB/glTF
# avec compression Draco pour compatibilité Three.js
# Utilise la syntaxe correcte de gltf-transform CLI

SOURCE_DIR="./models"
OUTPUT_DIR="./models_optimized"

# Configuration
TEXTURE_SIZE=1024         # Taille max des textures
TEXTURE_FORMAT="webp"     # Format de compression (webp, ktx2, avif)
DRACO_METHOD="sequential" # Méthode Draco (edgebreaker ou sequential)

echo "🚀 Optimisation GLB/glTF avec compression Draco"
echo "🔍 Parcours de $SOURCE_DIR pour optimisation..."
echo "📁 Dossier de destination : $OUTPUT_DIR"
echo "🗜️  Configuration:"
echo "   - Méthode Draco: $DRACO_METHOD"
echo "   - Textures: $TEXTURE_FORMAT max ${TEXTURE_SIZE}px"
echo ""

# Vérification des dépendances
if ! command -v gltf-transform &> /dev/null; then
    echo "❌ Erreur: gltf-transform n'est pas installé."
    echo "📥 Installation: npm install -g @gltf-transform/cli"
    exit 1
fi

# Vérification de la version
GLTF_VERSION=$(gltf-transform --version 2>/dev/null | head -n1)
echo "🔧 Version gltf-transform: $GLTF_VERSION"
echo ""

count=0
success_count=0
error_count=0
total_original_size=0
total_optimized_size=0

total_files=$(find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f | wc -l)

if [ "$total_files" -eq 0 ]; then
    echo "❌ Aucun fichier GLB/glTF trouvé dans $SOURCE_DIR"
    exit 1
fi

echo "📊 $total_files fichiers trouvés"
echo ""

find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f | while IFS= read -r input_file; do
    count=$((count + 1))

    # Calcul du chemin relatif et de sortie
    relative_path="${input_file#$SOURCE_DIR/}"
    output_path="$OUTPUT_DIR/$relative_path"

    # Création des dossiers nécessaires
    mkdir -p "$(dirname "$output_path")"

    # Détection de l'extension
    extension="${input_file##*.}"
    filename=$(basename "$input_file" ."$extension")

    echo "[$count/$total_files] 🔧 Optimisation : $relative_path"

    # Méthode 1: Optimisation complète avec Draco
    echo "  🔄 Optimisation complète avec Draco..."

    if gltf-transform optimize "$input_file" "$output_path" \
        --compress draco \
        --texture-compress "$TEXTURE_FORMAT" \
        --texture-size "$TEXTURE_SIZE" 2>/dev/null; then

        echo "  ✅ Optimisation réussie"
        success_count=$((success_count + 1))

        # Calcul et affichage des tailles
        if [[ -f "$input_file" && -f "$output_path" ]]; then
            original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null || echo "0")
            optimized_size=$(stat -f%z "$output_path" 2>/dev/null || stat -c%s "$output_path" 2>/dev/null || echo "0")

            if [[ "$original_size" != "0" && "$optimized_size" != "0" ]]; then
                reduction=$((100 - (optimized_size * 100 / original_size)))

                # Formatage des tailles
                if command -v numfmt &> /dev/null; then
                    orig_formatted=$(numfmt --to=iec $original_size)
                    opt_formatted=$(numfmt --to=iec $optimized_size)
                else
                    orig_formatted="${original_size} bytes"
                    opt_formatted="${optimized_size} bytes"
                fi

                echo "  📊 Taille: $orig_formatted → $opt_formatted (${reduction}% de réduction)"

                total_original_size=$((total_original_size + original_size))
                total_optimized_size=$((total_optimized_size + optimized_size))
            fi
        fi

    else
        echo "  ⚠️  Échec de l'optimisation complète, tentative Draco seul..."
        error_count=$((error_count + 1))

        # Méthode 2: Draco seul
        if gltf-transform draco "$input_file" "$output_path" --method "$DRACO_METHOD" 2>/dev/null; then
            echo "  ✅ Compression Draco réussie"

            # Puis compression des textures séparément
            if gltf-transform "$TEXTURE_FORMAT" "$output_path" "$output_path" 2>/dev/null; then
                echo "  ✅ Compression texture ajoutée"
            fi

        else
            echo "  ⚠️  Échec de Draco, tentative optimisation basique..."

            # Méthode 3: Optimisation sans Draco
            if gltf-transform optimize "$input_file" "$output_path" \
                --texture-compress "$TEXTURE_FORMAT" \
                --texture-size "$TEXTURE_SIZE" 2>/dev/null; then

                echo "  ✅ Optimisation basique réussie (sans Draco)"

            else
                echo "  ⚠️  Échec optimisation, tentative commandes individuelles..."

                # Méthode 4: Commandes individuelles
                temp_file="/tmp/$(basename "$input_file")"

                # Copie simple d'abord
                if gltf-transform copy "$input_file" "$temp_file" 2>/dev/null; then

                    # Tentative de nettoyage
                    if gltf-transform prune "$temp_file" "$temp_file" 2>/dev/null; then
                        echo "  ✅ Nettoyage appliqué"
                    fi

                    # Tentative de compression texture
                    if gltf-transform "$TEXTURE_FORMAT" "$temp_file" "$temp_file" 2>/dev/null; then
                        echo "  ✅ Compression texture appliquée"
                    fi

                    # Tentative de redimensionnement
                    if gltf-transform resize "$temp_file" "$output_path" \
                        --width "$TEXTURE_SIZE" --height "$TEXTURE_SIZE" 2>/dev/null; then
                        echo "  ✅ Redimensionnement appliqué"
                    else
                        cp "$temp_file" "$output_path"
                        echo "  ✅ Optimisation partielle réussie"
                    fi

                    rm -f "$temp_file"

                else
                    echo "  ❌ Échec complet, copie du fichier original"
                    cp "$input_file" "$output_path"
                fi
            fi
        fi
    fi

    echo ""
done

# Lecture des statistiques depuis les fichiers créés (nécessaire car find/while est en sous-shell)
final_success=$(find "$OUTPUT_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f | wc -l)
final_errors=$((total_files - final_success))

# Calcul des tailles totales
if [[ -d "$OUTPUT_DIR" ]]; then
    for original_file in $(find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f); do
        relative_path="${original_file#$SOURCE_DIR/}"
        optimized_file="$OUTPUT_DIR/$relative_path"

        if [[ -f "$optimized_file" ]]; then
            orig_size=$(stat -f%z "$original_file" 2>/dev/null || stat -c%s "$original_file" 2>/dev/null || echo "0")
            opt_size=$(stat -f%z "$optimized_file" 2>/dev/null || stat -c%s "$optimized_file" 2>/dev/null || echo "0")

            total_original_size=$((total_original_size + orig_size))
            total_optimized_size=$((total_optimized_size + opt_size))
        fi
    done
fi

# Statistiques finales
echo "🎉 Optimisation terminée !"
echo ""
echo "📊 Statistiques:"
echo "   - Fichiers traités: $total_files"
echo "   - Succès: $final_success"
echo "   - Erreurs: $final_errors"

if [[ $total_original_size -gt 0 && $total_optimized_size -gt 0 ]]; then
    total_reduction=$((100 - (total_optimized_size * 100 / total_original_size)))

    if command -v numfmt &> /dev/null; then
        total_orig_formatted=$(numfmt --to=iec $total_original_size)
        total_opt_formatted=$(numfmt --to=iec $total_optimized_size)
    else
        total_orig_formatted="${total_original_size} bytes"
        total_opt_formatted="${total_optimized_size} bytes"
    fi

    echo "   - Taille totale: $total_orig_formatted → $total_opt_formatted"
    echo "   - Réduction totale: ${total_reduction}%"
fi

echo ""
echo "💡 Pour Three.js avec Draco, configurez votre loader:"
echo ""
echo "📝 Code Three.js:"
cat << 'EOF'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Configuration du DRACOLoader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/'); // Chemin vers les décodeurs
dracoLoader.preload();

// Configuration du GLTFLoader
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Chargement du modèle optimisé
gltfLoader.load('model_optimized.glb', (gltf) => {
    scene.add(gltf.scene);
});

// N'oubliez pas de nettoyer
dracoLoader.dispose();
EOF

echo ""
echo "📦 Téléchargez les décodeurs Draco depuis:"
echo "   https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
echo "   Fichiers requis: draco_decoder.js et draco_decoder.wasm"
echo ""
echo "🔗 Documentation complète:"
echo "   https://gltf-transform.dev/cli"