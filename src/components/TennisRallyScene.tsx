import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

/**
 * 3D tennis rally:
 * - Small yellow ball arcs back and forth between two rackets.
 * - Rackets tilt-swing on impact.
 * - Camera is locked side-on so the rally reads as one player hitting the
 *   ball across the court to the other side and back.
 */

const PERIOD = 1.6;          // seconds per one-way trip
const COURT_HALF = 3.2;      // ball travels x ∈ [-COURT_HALF, +COURT_HALF]
const ARC_HEIGHT = 1.7;      // peak of ball arc

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function Ball() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = Math.floor(t / PERIOD);
    const phase = (t % PERIOD) / PERIOD; // 0..1
    const dir = cycle % 2 === 0 ? 1 : -1;
    const x = dir * (-COURT_HALF + easeInOutSine(phase) * COURT_HALF * 2);
    const y = Math.sin(phase * Math.PI) * ARC_HEIGHT - 0.4;
    meshRef.current.position.set(x, y, 0);
    meshRef.current.rotation.x = t * 5 * dir;
    meshRef.current.rotation.z = t * 3 * dir;

    // soft ground shadow that scales with height
    const heightFactor = (y + 0.4) / ARC_HEIGHT;
    const s = 1 - heightFactor * 0.55;
    shadowRef.current.position.set(x, -1.55, 0);
    shadowRef.current.scale.setScalar(s);
    (shadowRef.current.material as THREE.MeshBasicMaterial).opacity =
      0.35 - heightFactor * 0.25;
  });

  return (
    <>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.22, 48, 48]} />
        <meshStandardMaterial
          color="#d8f24a"
          roughness={0.85}
          metalness={0.02}
          emissive="#9bbf28"
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

function Racket({ side }: { side: "left" | "right" }) {
  const groupRef = useRef<THREE.Group>(null!);
  const sign = side === "left" ? -1 : 1;
  const restTilt = sign * -0.35;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = Math.floor(t / PERIOD);
    const phase = (t % PERIOD) / PERIOD;
    const dir = cycle % 2 === 0 ? 1 : -1;

    // Ball is approaching this racket when it nears phase=1 on its side.
    const onThisSide = (side === "right" && dir === 1) || (side === "left" && dir === -1);
    const swingPhase = onThisSide ? phase : 0;
    // Sharp swing in the last 20% before contact, then ease back out.
    const impulse =
      swingPhase > 0.8
        ? Math.sin(((swingPhase - 0.8) / 0.2) * Math.PI) * sign * 1.2
        : 0;
    groupRef.current.rotation.z = restTilt + impulse;
  });

  return (
    <group ref={groupRef} position={[sign * 3.55, -1.35, 0]}>
      {/* handle */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.95, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>
      {/* grip wrap */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.085, 0.08, 0.4, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
      {/* frame */}
      <mesh position={[0, 1.35, 0]}>
        <torusGeometry args={[0.5, 0.055, 16, 80]} />
        <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* strings */}
      <mesh position={[0, 1.35, 0]}>
        <circleGeometry args={[0.46, 48]} />
        <meshBasicMaterial color="#f5f5f5" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      {/* throat accent */}
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[0.18, 0.18, 0.04]} />
        <meshStandardMaterial color="hsl(212 90% 55%)" emissive="hsl(212 90% 55%)" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function CourtFloor() {
  const tex = useMemo(() => null, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
      <planeGeometry args={[10, 4]} />
      <meshStandardMaterial color="hsl(212 35% 14%)" roughness={1} transparent opacity={0.0} />
      {/* invisible — we only want the shadow disc on the ball's ground projection */}
      <primitive object={tex ?? new THREE.Object3D()} attach="userData-noop" />
    </mesh>
  );
}

export function TennisRallyScene({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.4, 6.2], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color="hsl(212 90% 70%)" />
        <Suspense fallback={null}>
          <Racket side="left" />
          <Racket side="right" />
          <Ball />
          <CourtFloor />
        </Suspense>
      </Canvas>
    </div>
  );
}
