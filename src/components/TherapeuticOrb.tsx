import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { VoiceState } from '../types';

interface OrbProps {
  voiceState: VoiceState;
  audioLevel: number;
}

function AnimatedOrb({ voiceState, audioLevel }: OrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  
  // Base animation parameters
  const baseScale = 1;
  const pulseSpeed = 2;
  const distortionSpeed = 0.5;
  
  // Color mapping based on voice state
  const color = useMemo(() => {
    switch (voiceState) {
      case 'listening':
        return '#4fc3f7'; // Light blue
      case 'thinking':
        return '#ab47bc'; // Purple
      case 'speaking':
        return '#66bb6a'; // Green
      case 'error':
        return '#ef5350'; // Red
      default:
        return '#78909c'; // Gray
    }
  }, [voiceState]);
  
  // Animation parameters based on state
  const { targetScale, targetDistortion, targetSpeed } = useMemo(() => {
    switch (voiceState) {
      case 'listening':
        return {
          targetScale: baseScale + audioLevel * 0.3,
          targetDistortion: 0.3 + audioLevel * 0.5,
          targetSpeed: distortionSpeed + audioLevel * 2
        };
      case 'thinking':
        return {
          targetScale: baseScale * 0.9,
          targetDistortion: 0.8,
          targetSpeed: distortionSpeed * 3
        };
      case 'speaking':
        return {
          targetScale: baseScale * 1.1,
          targetDistortion: 0.4,
          targetSpeed: distortionSpeed * 1.5
        };
      case 'error':
        return {
          targetScale: baseScale * 0.95,
          targetDistortion: 0.2,
          targetSpeed: distortionSpeed * 0.5
        };
      default:
        return {
          targetScale: baseScale,
          targetDistortion: 0.1,
          targetSpeed: distortionSpeed
        };
    }
  }, [voiceState, audioLevel]);
  
  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    
    // Smooth scale transitions
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    );
    
    // Smooth distortion transitions
    materialRef.current.distort = THREE.MathUtils.lerp(
      materialRef.current.distort,
      targetDistortion,
      0.1
    );
    
    materialRef.current.speed = THREE.MathUtils.lerp(
      materialRef.current.speed,
      targetSpeed,
      0.1
    );
    
    // Gentle rotation
    meshRef.current.rotation.y += 0.005;
    
    // Pulse effect when idle
    if (voiceState === 'idle') {
      const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.05 + 1;
      meshRef.current.scale.setScalar(baseScale * pulse);
    }
  });
  
  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        ref={materialRef}
        color={color}
        attach="material"
        distort={0.1}
        speed={distortionSpeed}
        roughness={0}
        metalness={0.2}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </Sphere>
  );
}

interface TherapeuticOrbProps {
  voiceState: VoiceState;
  audioLevel: number;
  className?: string;
}

export function TherapeuticOrb({ voiceState, audioLevel, className }: TherapeuticOrbProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.4} />
        <AnimatedOrb voiceState={voiceState} audioLevel={audioLevel} />
      </Canvas>
    </div>
  );
}