#!/bin/bash

# Script pour optimiser récursivement les fichiers GLB/glTF
# dans le dossier "input" et créer une arborescence miroir
# dans le dossier "input_optimized"

SOURCE_DIR="./models"
OUTPUT_DIR="./models_optimized"

echo "🔍 Parcours de $SOURCE_DIR pour optimisation..."
echo "📁 Dossier de destination : $OUTPUT_DIR"
echo ""

count=0
total=$(find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f | wc -l)

find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f | while read -r input_file; do
    count=$((count + 1))

    # Calcul du chemin relatif et de sortie
    relative_path="${input_file#$SOURCE_DIR/}"
    output_path="$OUTPUT_DIR/$relative_path"

    # Création des dossiers nécessaires
    mkdir -p "$(dirname "$output_path")"

    # Détection de l'extension et du nom de fichier
    extension="${input_file##*.}"
    filename=$(basename "$input_file" ."$extension")

    echo "[$count/$total] 🔧 Optimisation : $relative_path"

    # Optimisation
    if gltf-transform optimize "$input_file" "$output_path" \
        --texture-compress webp \
        --texture-size 1024; then

        echo "  ✅ Fichier optimisé : $relative_path"

        # Affichage taille
        original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null || echo "?")
        optimized_size=$(stat -f%z "$output_path" 2>/dev/null || stat -c%s "$output_path" 2>/dev/null || echo "?")

        if [[ "$original_size" != "?" && "$optimized_size" != "?" ]]; then
            reduction=$((100 - (optimized_size * 100 / original_size)))
            echo "  📊 Taille: $(numfmt --to=iec $original_size) → $(numfmt --to=iec $optimized_size) (${reduction}% de réduction)"
        fi

    else
        echo "  ❌ Erreur pendant l'optimisation."

        if [[ "$extension" == "gltf" ]]; then
            echo "  🔄 Tentative : conversion glTF → glb"
            tmp_glb="${input_file%.*}_tmp.glb"
            tmp_out_glb="${output_path%.*}_opt.glb"
            tmp_out_gltf="$output_path"

            if gltf-transform copy "$input_file" "$tmp_glb" --format binary; then
                echo "  ✅ Conversion vers glb réussie"

                if gltf-transform optimize "$tmp_glb" "$tmp_out_glb" \
                    --texture-compress webp \
                    --texture-size 1024; then

                    echo "  ✅ Optimisation du glb réussie"

                    echo "  🔄 Conversion glb optimisé → gltf"
                    if gltf-transform copy "$tmp_out_glb" "$tmp_out_gltf" --format embedded; then
                        echo "  ✅ Conversion finale gltf réussie"
                        rm -f "$tmp_glb" "$tmp_out_glb"
                    else
                        echo "  ❌ Échec de la reconversion gltf. Copie brute."
                        cp "$input_file" "$output_path"
                    fi

                else
                    echo "  ❌ Optimisation échouée après conversion glb"
                    cp "$input_file" "$output_path"
                fi
            else
                echo "  ❌ Échec de la conversion glTF → glb"
                cp "$input_file" "$output_path"
            fi

        else
            echo "  ❌ Erreur non récupérable. Copie brute."
            cp "$input_file" "$output_path"
        fi
    fi



  echo "✅ Optimisation terminée !"
done

