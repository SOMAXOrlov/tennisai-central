import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, Suspense } from "react";
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
// Travel range and racket positions are sized to fit inside the camera
// frustum (camera at z=7.5, fov=42 → visible half-height ≈ 2.88). Keeping
// everything inside ~2.4 ensures the ball never leaves the frame.
const COURT_HALF_Y = 2.1;  // ball travels y ∈ [-COURT_HALF_Y, +COURT_HALF_Y]
const RACKET_Y = 2.4;      // racket baseline position on the Y axis
const ARC_HEIGHT = 1.0;    // peak of ball arc (toward camera, +Z)

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function Ball() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);

  // Procedural tennis-ball texture: yellow felt with two curved white seams.
  const ballTexture = useMemo(() => {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    // Felt base (subtle radial variation)
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.6);
    grad.addColorStop(0, "#e6ff5c");
    grad.addColorStop(1, "#c8e22a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    // The classic tennis-ball seam is one continuous curve. On an unwrapped
    // sphere (equirectangular) it reads as two opposing sinusoidal bands.
    ctx.strokeStyle = "#fbfff0";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    for (const offset of [0, size / 2]) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const y = size / 2 + Math.sin((x / size) * Math.PI * 2 + (offset ? Math.PI : 0)) * size * 0.22;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Faint shadow under each seam for depth
    ctx.strokeStyle = "rgba(60,80,0,0.35)";
    ctx.lineWidth = 6;
    for (const offset of [0, size / 2]) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const y = size / 2 + Math.sin((x / size) * Math.PI * 2 + (offset ? Math.PI : 0)) * size * 0.22 + 9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

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
    meshRef.current.rotation.x = t * 6 * dir;
    meshRef.current.rotation.z = t * 2 * dir;

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
      {/* Ball — rendered late + with depthTest off so it always sits on
          top of the rackets / strings and stays visible at every phase. */}
      <mesh ref={meshRef} renderOrder={10}>
        <sphereGeometry args={[0.26, 64, 64]} />
        <meshStandardMaterial
          map={ballTexture}
          roughness={0.95}
          metalness={0}
          emissive="#9fbf1a"
          emissiveIntensity={0.15}
          depthTest={false}
        />
      </mesh>
      <mesh ref={shadowRef} renderOrder={9}>
        <circleGeometry args={[0.28, 32]} />
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
  const restTilt = sign * -0.22;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = Math.floor(t / PERIOD);
    const phase = (t % PERIOD) / PERIOD;
    const dir = cycle % 2 === 0 ? 1 : -1;

    // Ball is approaching this end when:
    //  - end=top    & dir=+1 (ball going from -Y to +Y), contact near phase=1
    //  - end=bottom & dir=-1 (ball going from +Y to -Y), contact near phase=1
    const onThisEnd = (end === "top" && dir === 1) || (end === "bottom" && dir === -1);
    // Full swing: wind-up (pull back, away from camera) → contact → follow-through.
    let swing = 0;
    let twist = 0;
    if (onThisEnd) {
      if (phase < 0.55) {
        // Wind-up: rotate frame away from camera (-Z) gradually
        const k = phase / 0.55;
        swing = sign * 0.85 * easeInOutSine(k);
      } else {
        // Forward swing & follow-through toward camera (+Z) past contact
        const k = (phase - 0.55) / 0.45;
        swing = sign * (0.85 - 2.1 * easeInOutSine(k));
      }
      // Slight lateral twist for natural arm motion
      twist = sign * Math.sin(phase * Math.PI) * 0.35;
    } else {
      // Idle ready-stance bob
      twist = Math.sin(t * 2 + (end === "top" ? 0 : Math.PI)) * 0.05;
    }
    groupRef.current.rotation.x = restTilt + swing;
    groupRef.current.rotation.z = (end === "bottom" ? Math.PI : 0) + twist;
  });

  // The whole racket is built along the Y axis (handle below frame in local
  // space), then translated to its baseline position. For the bottom racket
  // we mirror via rotation.z = π so the handle points downward on screen.
  return (
    <group
      ref={groupRef}
      position={[0, sign * RACKET_Y, 0.2]}
    >
      {/* handle */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.95, 16]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>
      {/* grip wrap */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.42, 16]} />
        <meshStandardMaterial color="#222" roughness={0.95} />
      </mesh>
      {/* throat — Y-shaped struts replacing the old box */}
      <mesh position={[-0.16, 1.02, 0]} rotation={[0, 0, 0.55]}>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 12]} />
        <meshStandardMaterial color="hsl(45 90% 55%)" emissive="hsl(45 90% 55%)" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.16, 1.02, 0]} rotation={[0, 0, -0.55]}>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 12]} />
        <meshStandardMaterial color="hsl(45 90% 55%)" emissive="hsl(45 90% 55%)" emissiveIntensity={0.45} />
      </mesh>
      {/* frame (head) — bright, visible outline */}
      <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.045, 18, 96]} />
        <meshStandardMaterial
          color="hsl(45 95% 60%)"
          emissive="hsl(45 95% 55%)"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.35}
        />
      </mesh>
      {/* strings — crosshatch lines for visible string bed */}
      <group position={[0, 1.5, 0]}>
        {Array.from({ length: 9 }).map((_, i) => {
          const t = (i / 8) * 2 - 1; // -1..1
          const w = Math.sqrt(Math.max(0, 1 - t * t)) * 0.96; // chord length within frame
          return (
            <mesh key={`v${i}`} position={[t * 0.5, 0, 0]}>
              <boxGeometry args={[0.008, 0.5 * w, 0.005]} />
              <meshBasicMaterial color="#f4f4f0" transparent opacity={0.85} />
            </mesh>
          );
        })}
        {Array.from({ length: 9 }).map((_, i) => {
          const t = (i / 8) * 2 - 1;
          const w = Math.sqrt(Math.max(0, 1 - t * t)) * 0.96;
          return (
            <mesh key={`h${i}`} position={[0, t * 0.5, 0]}>
              <boxGeometry args={[0.5 * w, 0.008, 0.005]} />
              <meshBasicMaterial color="#f4f4f0" transparent opacity={0.85} />
            </mesh>
          );
        })}
      </group>
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
