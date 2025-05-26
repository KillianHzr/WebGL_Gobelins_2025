import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function Sun({ refProp }) {

    return (
        <mesh ref={refProp} position={[-30.943, 0, 37.149]}>
            <sphereGeometry args={[2, 32, 32]} />
            <meshBasicMaterial color="white" />
        </mesh>
    );
}
