import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, Environment, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_PATH = '/assets/base.glb';

class TrophyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function TrophyModel({ hero = false }) {
  const group = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const { scene } = useGLTF(MODEL_PATH);
  const [scale, setScale] = useState(hero ? 2.0 : 1.2);
  const [position, setPosition] = useState(hero ? [0, -0.55, 0] : [0, -0.28, 0]);

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const material = child.material;
      if (material) {
        material.envMapIntensity = 1.7;
        if (Object.prototype.hasOwnProperty.call(material, 'metalness')) {
          material.metalness = Math.min(1, Math.max(material.metalness ?? 0.85, 0.88));
        }
        if (Object.prototype.hasOwnProperty.call(material, 'roughness')) {
          material.roughness = Math.min(0.45, Math.max(material.roughness ?? 0.2, 0.12));
        }
      }
    });
    return cloned;
  }, [scene]);

  useEffect(() => {
    const onMove = (event) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    
    const updateSize = () => {
      const vw = window.innerWidth;
      
      if (vw < 640) {
        setScale(hero ? 1.6 : 0.9);
        setPosition(hero ? [0, -0.4, 0] : [0, -0.15, 0]);
      } else if (vw < 1024) {
        setScale(hero ? 1.8 : 1.1);
        setPosition(hero ? [0, -0.48, 0] : [0, -0.22, 0]);
      } else {
        setScale(hero ? 2.0 : 1.2);
        setPosition(hero ? [0, -0.55, 0] : [0, -0.28, 0]);
      }
    };
    
    updateSize();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', updateSize);
    };
  }, [hero]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.22;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -mouse.current.y * 0.12, 0.05);
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, mouse.current.x * 0.35, 0.05);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, mouse.current.y * 0.2 + Math.sin(state.clock.elapsedTime * 1.2) * 0.04, 0.05);
  });

  return (
    <group ref={group} scale={scale} position={position}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div style={{
        color: '#f0c16b',
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '0.78rem',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        padding: '0.8rem 1rem',
        border: '1px solid rgba(218,24,24,0.25)',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: '0.75rem',
      }}>
        Loading Trophy...
      </div>
    </Html>
  );
}

function TrophyScene({ hero = false }) {
  const [cameraConfig, setCameraConfig] = useState({
    position: [0, 0.1, 5.5],
    fov: 35,
  });

  useEffect(() => {
    const updateCamera = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const aspectRatio = vw / vh;

      // Responsive calculations
      let z = hero ? 5.5 : 6.2;
      let fov = hero ? 35 : 40;

      // Mobile adjustments (small screens)
      if (vw < 640) {
        z = hero ? 6.5 : 7.2;
        fov = hero ? 38 : 43;
      }
      // Tablet adjustments
      else if (vw < 1024) {
        z = hero ? 6.0 : 6.8;
        fov = hero ? 36 : 41;
      }
      // Very wide screens
      else if (aspectRatio > 1.8) {
        z = hero ? 5.2 : 6.0;
        fov = hero ? 32 : 38;
      }

      setCameraConfig({
        position: [0, hero ? 0.1 : 0.2, z],
        fov,
      });
    };

    updateCamera();
    window.addEventListener('resize', updateCamera);
    return () => window.removeEventListener('resize', updateCamera);
  }, [hero]);

  return (
    <Canvas
      camera={{ position: cameraConfig.position, fov: cameraConfig.fov }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      shadows={false}
    >
      {/* Enhanced Lighting for Premium Feel */}
      <ambientLight intensity={0.55} />
      
      {/* Primary Golden Fill Light */}
      <directionalLight position={[4, 6, 5]} intensity={2.2} color="#ffd17d" />
      
      {/* Red Accent Light */}
      <directionalLight position={[-3, 2, -2]} intensity={1.0} color="#da1818" />
      
      {/* Rim/Glow Lights */}
      <pointLight position={[0, 1.2, 3]} intensity={2.0} color="#f0c16b" />
      <pointLight position={[2.5, 0.5, -2]} intensity={1.2} color="#da1818" decay={2} />
      <pointLight position={[-2.5, 0.5, -2]} intensity={1.2} color="#f0c16b" decay={2} />
      
      {/* Subtle Top Light */}
      <directionalLight position={[0, 3, 0]} intensity={0.6} color="#ffffff" />
      
      <Environment preset="night" />
      <Suspense fallback={<LoadingFallback />}>
        <TrophyModel hero={hero} />
      </Suspense>
    </Canvas>
  );
}

export default function TrophyBackground({ className = '', hero = false }) {
  return (
    <div className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Primary Glow Halo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,193,107,0.2) 0%, rgba(218,24,24,0.12) 30%, transparent 70%)',
          filter: 'blur(28px)',
          pointerEvents: 'none',
          animation: 'glowPulse 4s ease-in-out infinite',
        }}
      />
      
      {/* Secondary Red Glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(218,24,24,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      
      {/* Secondary Gold Accent */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '20%',
          right: '15%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,193,107,0.1) 0%, transparent 70%)',
          filter: 'blur(35px)',
          pointerEvents: 'none',
        }}
      />
      
      <TrophyScene hero={hero} />
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
