import json
import math
from typing import List, Dict, Any

def calculate_distance(obj1: Dict[str, float], obj2: Dict[str, float]) -> float:
    """
    Calcule la distance euclidienne entre deux objets 3D.
    Prend en compte les coordonnées x, y, z et optionnellement les rotations et échelles.
    """
    # Distance euclidienne basique sur les positions
    pos_distance = math.sqrt(
        (obj1['x'] - obj2['x'])**2 +
        (obj1['y'] - obj2['y'])**2 +
        (obj1['z'] - obj2['z'])**2
    )

    # Distance sur les rotations (optionnel)
    rot_distance = 0
    if all(key in obj1 and key in obj2 for key in ['rotationX', 'rotationY', 'rotationZ']):
        rot_distance = math.sqrt(
            (obj1['rotationX'] - obj2['rotationX'])**2 +
            (obj1['rotationY'] - obj2['rotationY'])**2 +
            (obj1['rotationZ'] - obj2['rotationZ'])**2
        )

    # Distance sur les échelles (optionnel)
    scale_distance = 0
    if all(key in obj1 and key in obj2 for key in ['scaleX', 'scaleY', 'scaleZ']):
        scale_distance = math.sqrt(
            (obj1['scaleX'] - obj2['scaleX'])**2 +
            (obj1['scaleY'] - obj2['scaleY'])**2 +
            (obj1['scaleZ'] - obj2['scaleZ'])**2
        )

    # Combinaison pondérée des distances (vous pouvez ajuster les poids)
    total_distance = pos_distance + (rot_distance * 0.1) + (scale_distance * 0.01)

    return total_distance

def calculate_normalized_distance(obj1: Dict[str, float], obj2: Dict[str, float]) -> float:
    """
    Calcule une distance normalisée entre 0 et 1 pour deux objets.
    Cette version est plus adaptée au seuil 0.0001-0.9.
    """
    # Distance euclidienne sur les positions
    pos_distance = math.sqrt(
        (obj1['x'] - obj2['x'])**2 +
        (obj1['y'] - obj2['y'])**2 +
        (obj1['z'] - obj2['z'])**2
    )

    # Normalisation approximative (ajustez selon vos données)
    # Ici on assume que la distance max attendue est ~200 unités
    max_expected_distance = 200.0
    normalized_distance = min(pos_distance / max_expected_distance, 1.0)

    return normalized_distance

def remove_close_objects(objects: List[Dict[str, Any]],
                        threshold: float = 0.1,
                        use_normalized: bool = True) -> List[Dict[str, Any]]:
    """
    Supprime les objets trop proches selon le seuil donné.

    Args:
        objects: Liste des objets JSON
        threshold: Seuil de proximité (0.0001 à 0.9 si use_normalized=True)
        use_normalized: Utilise la distance normalisée ou la distance brute

    Returns:
        Liste filtrée des objets
    """
    if not objects:
        return objects

    filtered_objects = []
    distance_func = calculate_normalized_distance if use_normalized else calculate_distance

    for i, current_obj in enumerate(objects):
        is_too_close = False

        # Vérifier la distance avec tous les objets déjà acceptés
        for accepted_obj in filtered_objects:
            distance = distance_func(current_obj, accepted_obj)

            if distance < threshold:
                is_too_close = True
                print(f"Objet {i} supprimé (distance {distance:.6f} < seuil {threshold})")
                break

        if not is_too_close:
            filtered_objects.append(current_obj)
            print(f"Objet {i} conservé")

    return filtered_objects

def process_json_file(input_file: str, output_file: str, threshold: float = 0.1):
    """
    Traite un fichier JSON complet.
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Si c'est une liste directe d'objets
        if isinstance(data, list):
            filtered_data = remove_close_objects(data, threshold)

        # Si les objets sont dans une clé spécifique
        elif isinstance(data, dict) and 'objects' in data:
            filtered_data = data.copy()
            filtered_data['objects'] = remove_close_objects(data['objects'], threshold)

        else:
            print("Format JSON non reconnu. Attendu: liste d'objets ou dict avec clé 'objects'")
            return

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, indent=2, ensure_ascii=False)

        print(f"\nTraitement terminé:")
        original_count = len(data) if isinstance(data, list) else len(data.get('objects', []))
        final_count = len(filtered_data) if isinstance(filtered_data, list) else len(filtered_data.get('objects', []))
        print(f"Objects originaux: {original_count}")
        print(f"Objects conservés: {final_count}")
        print(f"Objects supprimés: {original_count - final_count}")

    except FileNotFoundError:
        print(f"Fichier {input_file} non trouvé")
    except json.JSONDecodeError:
        print(f"Erreur de format JSON dans {input_file}")
    except Exception as e:
        print(f"Erreur: {e}")

# Exemple d'utilisation avec vos données
def example_usage():
    # Vos données d'exemple
    sample_objects = [
        {
            "x": -0.365875244140625,
            "y": 6.226734161376953,
            "z": -69.98272705078125,
            "rotationX": 0.4472027457453762,
            "rotationY": 0.4115408346765261,
            "rotationZ": -0.23082820591802286,
            "scaleX": 4.996317429299222,
            "scaleY": 4.996318373028111,
            "scaleZ": 4.996317932190464
        },
        {
            "x": -18.88863754272461,
            "y": 1.890096664428711,
            "z": -138.70361328125,
            "rotationX": 2.1282555915624712,
            "rotationY": -0.3925090627145855,
            "rotationZ": 2.5281181450206036,
            "scaleX": 4.996320189317805,
            "scaleY": 4.996318367676491,
            "scaleZ": 4.996318882325262
        },
        {
            "x": -16.800365447998047,
            "y": 0.8295907974243164,
            "z": -136.35488891601562,
            "rotationX": 1.5796504791771422,
            "rotationY": 0.044142557249213836,
            "rotationZ": 2.4282955094795726,
            "scaleX": 4.996318042732904,
            "scaleY": 4.996317967849013,
            "scaleZ": 4.996317012813175
        },
        # ... ajoutez les autres objets
    ]

    print("=== Test avec seuil 0.1 ===")
    filtered = remove_close_objects(sample_objects, threshold=0.1)

    print(f"\nRésultat: {len(filtered)} objets conservés sur {len(sample_objects)}")

    # Test avec différents seuils
    print("\n=== Tests avec différents seuils ===")
    for threshold in [0.0001, 0.01, 0.1, 0.5, 0.9]:
        filtered = remove_close_objects(sample_objects, threshold=threshold, use_normalized=True)
        print(f"Seuil {threshold}: {len(filtered)} objets conservés")

if __name__ == "__main__":
    # Exemple d'utilisation
    example_usage()
    THRESHOLD = 0.01
    # Pour traiter un fichier:
    process_json_file('treePositions_ThreeRoof2.json', 'output.json', threshold=THRESHOLD)

    # Configuration du seuil (modifiez cette valeur entre 0.0001 et 0.9)
     # Ajustez selon vos besoins

    print(f"\nSeuil configuré à: {THRESHOLD}")
    print("Pour traiter un fichier, utilisez:")
    print("process_json_file('votre_fichier.json', 'fichier_filtre.json', threshold=THRESHOLD)")