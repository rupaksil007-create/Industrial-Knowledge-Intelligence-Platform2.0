"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function IndustrialStructure() {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.12;
      meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.08) * 0.04;
    }
  });

  // Create nodes and connections
  const [nodes, connections] = useMemo(() => {
    const tempNodes: THREE.Vector3[] = [];
    const numNodes = 24;
    for (let i = 0; i < numNodes; i++) {
      const angle = (i / (numNodes / 3)) * Math.PI * 2;
      const radius = 2.4 + Math.sin(i * 1.7) * 0.4;
      const y = (Math.floor(i / (numNodes / 3)) - 1) * 1.6 + Math.cos(i) * 0.2;
      tempNodes.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      ));
    }

    const tempConnections: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < tempNodes.length; i++) {
      const ringIndex = Math.floor(i / 8);
      const nextInRing = ringIndex * 8 + ((i + 1) % 8);
      tempConnections.push([tempNodes[i], tempNodes[nextInRing]]);

      if (ringIndex < 2) {
        tempConnections.push([tempNodes[i], tempNodes[i + 8]]);
      }

      if (ringIndex < 2 && i % 2 === 0) {
        tempConnections.push([tempNodes[i], tempNodes[((i + 1) % 8) + (ringIndex + 1) * 8]]);
      }
    }

    return [tempNodes, tempConnections];
  }, []);

  return (
    <group ref={meshRef}>
      {/* Central cylinder core */}
      <mesh>
        <cylinderGeometry args={[0.6, 0.6, 3.8, 16]} />
        <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.25} />
      </mesh>
      
      {/* Central glowing hub */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshPhysicalMaterial 
          color="#06b6d4" 
          emissive="#0891b2" 
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Orbiting rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.5, 0]}>
        <torusGeometry args={[2.8, 0.03, 8, 64]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <torusGeometry args={[2.8, 0.03, 8, 64]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} />
      </mesh>

      {/* Nodes */}
      {nodes.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial 
            color={idx % 3 === 0 ? "#f59e0b" : "#06b6d4"} 
            emissive={idx % 3 === 0 ? "#d97706" : "#0891b2"}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}

      {/* Connective lines */}
      {connections.map(([start, end], idx) => {
        const distance = start.distanceTo(end);
        const position = start.clone().lerp(end, 0.5);
        const direction = end.clone().sub(start).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        
        return (
          <mesh key={idx} position={position} quaternion={quaternion}>
            <cylinderGeometry args={[0.015, 0.015, distance, 6]} />
            <meshBasicMaterial color="#27272a" transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function DataParticles({ count = 120 }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, speeds] = useMemo(() => {
    const tempPositions = new Float32Array(count * 3);
    const tempSpeeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 3.5;
      const y = (Math.random() - 0.5) * 5.5;
      
      tempPositions[i * 3] = Math.cos(theta) * radius;
      tempPositions[i * 3 + 1] = y;
      tempPositions[i * 3 + 2] = Math.sin(theta) * radius;
      
      tempSpeeds[i] = 0.08 + Math.random() * 0.4;
    }
    return [tempPositions, tempSpeeds];
  }, [count]);

  useFrame((state) => {
    if (pointsRef.current) {
      const positionsArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const time = state.clock.getElapsedTime();
      for (let i = 0; i < count; i++) {
        positionsArray[i * 3 + 1] += speeds[i] * 0.008;
        if (positionsArray[i * 3 + 1] > 2.75) {
          positionsArray[i * 3 + 1] = -2.75;
        }
        positionsArray[i * 3] += Math.sin(time + i) * 0.0015;
        positionsArray[i * 3 + 2] += Math.cos(time + i) * 0.0015;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.rotation.y = time * 0.03;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#06b6d4"
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

export default function Industrial3D() {
  return (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px] relative">
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#06b6d4" />
        <pointLight position={[-10, -10, -10]} intensity={0.4} color="#f59e0b" />
        
        <IndustrialStructure />
        <DataParticles count={120} />
        
        <Grid 
          position={[0, -2.8, 0]}
          args={[12, 12]}
          cellSize={0.4}
          cellThickness={0.4}
          cellColor="#1e293b"
          sectionSize={2}
          sectionThickness={0.8}
          sectionColor="#0891b2"
          fadeDistance={15}
        />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          autoRotate 
          autoRotateSpeed={0.4} 
        />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-[#09090b] pointer-events-none" />
    </div>
  );
}
