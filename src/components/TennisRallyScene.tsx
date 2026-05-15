import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, Suspense } from "react";
import * as THREE from "three";

/**
 * 3D tennis rally — VERTICAL orientation:
 * - Two rackets sit at the top and bottom baselines of a court whose
 *   long axis runs vertically on screen.
 * - Rackets are upright (handles vertical, frames horizontal across the court).
 * - The ball arcs north-south between them, with a slight left-right sway
 *   to give depth, and rackets swing on contact.
 */

const PERIOD = 1.6;        // seconds per one-way trip
const COURT_HALF_Y = 3.0;  // ball travels y ∈ [-COURT_HALF_Y, +COURT_HALF_Y]
const ARC_HEIGHT = 1.4;    // peak of ball arc (out-of-court / camera-toward axis)

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

    // Ball travels along the Y axis (court length).
    const y = dir * (-COURT_HALF_Y + easeInOutSine(phase) * COURT_HALF_Y * 2);
    // Arc lifts the ball toward the camera (positive Z) at mid-flight.
    const z = Math.sin(phase * Math.PI) * ARC_HEIGHT;
    // Subtle sideways drift for visual interest.
    const x = Math.sin(phase * Math.PI) * 0.25 * dir;

    meshRef.current.position.set(x, y, z);
    meshRef.current.rotation.x = t * 5 * dir;
    meshRef.current.rotation.y = t * 3 * dir;

    // Court-floor shadow follows the ball; shrinks/fades as the ball rises.
    const heightFactor = z / ARC_HEIGHT;
    const s = 1 - heightFactor * 0.55;
    shadowRef.current.position.set(x, y, -0.01);
    shadowRef.current.scale.setScalar(s);
    (shadowRef.current.material as THREE.MeshBasicMaterial).opacity =
      0.4 - heightFactor * 0.3;
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.18, 48, 48]} />
        <meshStandardMaterial
          color="#d8f24a"
          roughness={0.85}
          metalness={0.02}
          emissive="#9bbf28"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh ref={shadowRef}>
        <circleGeometry args={[0.26, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>
    </>
  );
}

/**
 * Upright racket. `end="top"` sits at +Y with handle pointing further up;
 * `end="bottom"` sits at -Y with handle pointing further down. Frames face
 * inward (toward the court center).
 */
function Racket({ end }: { end: "top" | "bottom" }) {
  const groupRef = useRef<THREE.Group>(null!);
  const sign = end === "top" ? 1 : -1;
  // Slight inward tilt at rest (frame angled toward center of court).
  const restTilt = sign * -0.18;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = Math.floor(t / PERIOD);
    const phase = (t % PERIOD) / PERIOD;
    const dir = cycle % 2 === 0 ? 1 : -1;

    // Ball is approaching this end when:
    //  - end=top    & dir=+1 (ball going from -Y to +Y), contact near phase=1
    //  - end=bottom & dir=-1 (ball going from +Y to -Y), contact near phase=1
    const onThisEnd = (end === "top" && dir === 1) || (end === "bottom" && dir === -1);
    const swingPhase = onThisEnd ? phase : 0;
    const impulse =
      swingPhase > 0.78
        ? Math.sin(((swingPhase - 0.78) / 0.22) * Math.PI) * sign * -1.0
        : 0;
    // Rotate around X so frame swings toward / away from camera.
    groupRef.current.rotation.x = restTilt + impulse;
  });

  // The whole racket is built along the Y axis (handle below frame in local
  // space), then translated to its baseline position. For the bottom racket
  // we mirror via rotation.z = π so the handle points downward on screen.
  return (
    <group
      ref={groupRef}
      position={[0, sign * 3.4, 0.2]}
      rotation={[0, 0, end === "bottom" ? Math.PI : 0]}
    >
      {/* handle */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.95, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>
      {/* grip wrap */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.075, 0.07, 0.4, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
      {/* frame (head) */}
      <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.05, 16, 80]} />
        <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* strings */}
      <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial
          color="#f5f5f5"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* throat accent */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial
          color="hsl(212 90% 55%)"
          emissive="hsl(212 90% 55%)"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

export function TennisRallyScene({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        // Camera lifted slightly and pulled back; portrait framing fits the
        // tall court area where the rally is overlaid.
        camera={{ position: [0, 0, 7.5], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={1.3} />
        <directionalLight
          position={[-3, -2, 3]}
          intensity={0.5}
          color="hsl(212 90% 70%)"
        />
        <Suspense fallback={null}>
          <Racket end="top" />
          <Racket end="bottom" />
          <Ball />
        </Suspense>
      </Canvas>
    </div>
  );
}
