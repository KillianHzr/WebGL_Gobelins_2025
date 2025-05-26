import { EffectComposer, GodRays } from '@react-three/postprocessing';
import { BlendFunction, Resizer, KernelSize } from 'postprocessing';
import { useRef } from 'react';

export function GodRaysEffect({ sunRef }) {
    if (!sunRef.current) return null;

    return (
        <EffectComposer multisampling={0}>
            <GodRays
                sun={sunRef.current}
                blendFunction={BlendFunction.SCREEN}
                samples={30}
                density={0.96}
                decay={0.95}
                weight={0.1}
                exposure={0.6}
                clampMax={1}
                width={Resizer.AUTO_SIZE}
                height={Resizer.AUTO_SIZE}
                kernelSize={KernelSize.SMALL}
                resolutionScale={4.0}
            />
        </EffectComposer>
    );
}
