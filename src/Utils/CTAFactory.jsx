// src/Utils/InteractiveMarkers/CTAFactory.jsx
import React from 'react';
import * as THREE from 'three';
import { EventBus } from './EventEmitter';
import { MARKER_EVENTS } from './markerEvents';

// Classe de base pour les CTA
class BaseCTA {
    constructor(options) {
        this.type = options.type;
        this.position = options.position;
        this.data = options.data || {};
        this.object = null;
        this.material = null;
        this.geometry = null;
        this.texture = null;
        this.isHovered = false;

        // Créer l'objet 3D spécifique au type de CTA
        this.initialize();
    }

    // À implémenter par les sous-classes
    initialize() {
        throw new Error('Method not implemented');
    }

    // Gérer le survol
    onHover() {
        this.isHovered = true;
        this.updateAppearance();

        // Émettre l'événement enregistré dans les données
        if (this.data.onHover) {
            EventBus.trigger(this.data.onHover, {
                id: this.data.id,
                type: this.type,
                position: this.position
            });
        }
    }

    // Gérer la fin du survol
    onHoverEnd() {
        this.isHovered = false;
        this.updateAppearance();

        EventBus.trigger(MARKER_EVENTS.MARKER_HOVER_END, {
            id: this.data.id
        });
    }

    // Gérer le clic
    onClick() {
        // Émettre l'événement enregistré dans les données
        if (this.data.onClick) {
            EventBus.trigger(this.data.onClick, {
                id: this.data.id,
                type: this.type,
                position: this.position,
                customData: this.data.customData
            });
        }
    }

    // Mettre à jour l'apparence en fonction de l'état (survol, etc.)
    updateAppearance() {
        if (!this.material) return;

        if (this.isHovered) {
            this.material.opacity = 1.0;
            if (this.material.color) {
                this.material.color.setHex(0xffffff);
            }
        } else {
            this.material.opacity = 0.8;
            if (this.material.color && this.data.color) {
                this.material.color.set(this.data.color);
            }
        }
    }

    // Définir la position de l'objet 3D
    setPosition(position) {
        if (this.object) {
            this.object.position.copy(position);
        }
        this.position = position;
    }

    // Définir la rotation de l'objet 3D
    setRotation(rotation) {
        if (this.object && rotation) {
            this.object.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Définir la visibilité de l'objet 3D
    setVisible(visible) {
        if (this.object) {
            this.object.visible = visible;
        }
    }

    // Obtenir l'objet 3D
    getObject() {
        return this.object;
    }

    // Rendu du composant Three.js
    renderThreeComponent() {
        return null; // Implémentation par défaut vide, à surcharger par les sous-classes
    }

    // Nettoyage des ressources
    dispose() {
        if (this.material) {
            this.material.dispose();
        }
        if (this.geometry) {
            this.geometry.dispose();
        }
        if (this.texture) {
            this.texture.dispose();
        }
        // Autres nettoyages spécifiques peuvent être ajoutés dans les sous-classes
    }
}

// CTA de type Info (point d'information standard)
class InfoCTA extends BaseCTA {
    initialize() {
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load('/static/textures/markers/info.png');

        this.material = new THREE.SpriteMaterial({
            map: this.texture,
            color: this.data.color || 0x00aaff,
            transparent: true,
            opacity: 0.8
        });

        this.object = new THREE.Sprite(this.material);
        const scale = this.data.scale || 1;
        this.object.scale.set(scale, scale, 1);
        this.object.position.copy(this.position);

        // Effet de pulsation
        this.pulseAnimation();
    }

    pulseAnimation() {
        const initialScale = this.data.scale || 1;
        let time = 0;

        const animate = () => {
            time += 0.05;
            const pulse = Math.sin(time) * 0.1 + 1;

            if (this.object) {
                this.object.scale.set(
                    initialScale * pulse,
                    initialScale * pulse,
                    1
                );
            } else {
                return; // Arrêter l'animation si l'objet n'existe plus
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    renderThreeComponent() {
        return null; // Le sprite est déjà créé dans initialize()
    }
}

// CTA de type Warning (point d'avertissement)
class WarningCTA extends BaseCTA {
    initialize() {
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load('/static/textures/markers/warning.png');

        this.material = new THREE.SpriteMaterial({
            map: this.texture,
            color: this.data.color || 0xff8800,
            transparent: true,
            opacity: 0.8
        });

        this.object = new THREE.Sprite(this.material);
        const scale = this.data.scale || 1;
        this.object.scale.set(scale, scale, 1);
        this.object.position.copy(this.position);

        // Effet de clignotement
        this.blinkAnimation();
    }

    blinkAnimation() {
        let visible = true;
        let interval = setInterval(() => {
            if (!this.object) {
                clearInterval(interval);
                return;
            }

            if (this.isHovered) {
                this.object.visible = true;
                return;
            }

            visible = !visible;
            this.object.visible = visible;
        }, 1000);
    }

    renderThreeComponent() {
        return null; // Le sprite est déjà créé dans initialize()
    }
}

// CTA de type Hotspot (point d'intérêt cliquable)
class HotspotCTA extends BaseCTA {
    initialize() {
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load('/static/textures/markers/hotspot.png');

        this.material = new THREE.SpriteMaterial({
            map: this.texture,
            color: this.data.color || 0xff3300,
            transparent: true,
            opacity: 0.8
        });

        this.object = new THREE.Sprite(this.material);
        const scale = this.data.scale || 1;
        this.object.scale.set(scale, scale, 1);
        this.object.position.copy(this.position);

        // Effet de rotation
        this.rotateAnimation();
    }

    rotateAnimation() {
        let time = 0;

        const animate = () => {
            time += 0.02;

            if (this.object) {
                this.object.material.rotation = time;
            } else {
                return; // Arrêter l'animation si l'objet n'existe plus
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    renderThreeComponent() {
        return null; // Le sprite est déjà créé dans initialize()
    }
}

// CTA de type Interaction (nécessite une action utilisateur)
class InteractionCTA extends BaseCTA {
    initialize() {
        // Créer une géométrie plus complexe pour ce type de marqueur
        this.geometry = new THREE.RingGeometry(0.3, 0.5, 32);
        this.material = new THREE.MeshBasicMaterial({
            color: this.data.color || 0x44ff44,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });

        this.object = new THREE.Mesh(this.geometry, this.material);
        const scale = this.data.scale || 1;
        this.object.scale.set(scale, scale, scale);
        this.object.position.copy(this.position);

        // Toujours face à la caméra
        this.object.userData.billboard = true;

        // Effet de pulsation
        this.pulseAnimation();
    }

    pulseAnimation() {
        const initialScale = this.data.scale || 1;
        let time = 0;

        const animate = () => {
            time += 0.05;
            const pulse = Math.sin(time) * 0.2 + 1;

            if (this.object) {
                this.object.scale.set(
                    initialScale * pulse,
                    initialScale * pulse,
                    initialScale * pulse
                );
            } else {
                return; // Arrêter l'animation si l'objet n'existe plus
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    renderThreeComponent() {
        return null; // Le mesh est déjà créé dans initialize()
    }
}

// CTA de type Navigation (point de navigation)
class NavigationCTA extends BaseCTA {
    initialize() {
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load('/static/textures/markers/navigation.png');

        this.material = new THREE.SpriteMaterial({
            map: this.texture,
            color: this.data.color || 0x00ff88,
            transparent: true,
            opacity: 0.8
        });

        this.object = new THREE.Sprite(this.material);
        const scale = this.data.scale || 1;
        this.object.scale.set(scale, scale, 1);
        this.object.position.copy(this.position);

        // Effet de légère oscillation
        this.oscillateAnimation();
    }

    oscillateAnimation() {
        const initialY = this.position.y;
        let time = 0;

        const animate = () => {
            time += 0.02;
            const offset = Math.sin(time) * 0.1;

            if (this.object) {
                this.object.position.y = initialY + offset;
            } else {
                return; // Arrêter l'animation si l'objet n'existe plus
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    renderThreeComponent() {
        return null; // Le sprite est déjà créé dans initialize()
    }
}

// CTA personnalisé (permet de définir des éléments personnalisés)
class CustomCTA extends BaseCTA {
    initialize() {
        // Par défaut, créer un simple point
        this.geometry = new THREE.SphereGeometry(0.2, 16, 16);
        this.material = new THREE.MeshBasicMaterial({
            color: this.data.color || 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        this.object = new THREE.Mesh(this.geometry, this.material);
        const scale = this.data.scale || 1;
        this.object.scale.set(scale, scale, scale);
        this.object.position.copy(this.position);
    }

    renderThreeComponent() {
        // Pour les CTA personnalisés, cela peut être surchargé avec un rendu React spécifique
        return null;
    }
}

// Classe Factory pour créer différents types de CTA
export class CTAFactory {
    constructor() {
        this.registry = {
            'info': InfoCTA,
            'warning': WarningCTA,
            'hotspot': HotspotCTA,
            'interaction': InteractionCTA,
            'navigation': NavigationCTA,
            'custom': CustomCTA
        };
    }

    // Enregistrer un nouveau type de CTA
    registerCTAType(typeName, CTAClass) {
        this.registry[typeName] = CTAClass;
    }

    // Créer un CTA du type spécifié
    createCTA(options) {
        const { type } = options;

        if (!type || !this.registry[type]) {
            console.warn(`CTA type "${type}" not found in registry, using default "info" type`);
            return new this.registry['info'](options);
        }

        return new this.registry[type](options);
    }
}

export default CTAFactory;