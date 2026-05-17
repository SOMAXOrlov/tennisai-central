import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, Suspense } from "react";
import * as THREE from "three";

/**
 * Tennis rally — clean top-down stylized court.
 *
 * Design notes: the previous version had floating, swinging rackets which
 * read as uncanny. This scene drops the rackets entirely and instead shows
 * a stylized hard court viewed from above with a single ball bouncing
 * baseline-to-baseline. The ball leaves a soft motion trail and squashes
 * on each bounce, which reads clearly as "tennis rally" without any
 * disembodied gear.
 */

const PERIOD = 1.8; // seconds per one-way trip
const COURT_HALF_Y = 2.2;
const ARC_HEIGHT = 0.9;

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Stylized court drawn as flat planes + line strips. Viewed top-down. */
function Court() {
  const lineColor = "hsl(150 60% 92%)";
  const lineMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.85 }),
    []
  );
  const LW = 0.045; // line width

  // Court rectangle dimensions (chosen to fit camera frustum)
  const W = 2.4; // singles width
  const H = 5.0; // baseline-to-baseline
  const SERVICE_W = W;
  const SERVICE_H = 1.6; // service box depth from net

  const Line = ({
    x = 0,
    y = 0,
    w,
    h,
  }: { x?: number; y?: number; w: number; h: number }) => (
    <mesh position={[x, y, 0.001]} material={lineMat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );

  return (
    <group>
      {/* Court surface */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[W + 1.2, H + 1.2]} />
        <meshBasicMaterial color="hsl(158 45% 22%)" />
      </mesh>
      <mesh position={[0, 0, 0.0005]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="hsl(158 55% 30%)" />
      </mesh>

      {/* Baselines */}
      <Line y={H / 2} w={W} h={LW} />
      <Line y={-H / 2} w={W} h={LW} />
      {/* Sidelines */}
      <Line x={W / 2} w={LW} h={H} />
      <Line x={-W / 2} w={LW} h={H} />
      {/* Net (slightly thicker dark band with a light tape on top) */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[W + 0.4, 0.08]} />
        <meshBasicMaterial color="hsl(0 0% 8%)" transparent opacity={0.85} />
      </mesh>
      <Line y={0} w={W + 0.4} h={LW * 0.8} />
      {/* Service boxes */}
      <Line y={SERVICE_H} w={SERVICE_W} h={LW} />
      <Line y={-SERVICE_H} w={SERVICE_W} h={LW} />
      {/* Center service line */}
      <Line w={LW} h={SERVICE_H * 2} />
      {/* Center mark on baselines */}
      <Line y={H / 2 - 0.08} w={LW} h={0.16} />
      <Line y={-H / 2 + 0.08} w={LW} h={0.16} />
    </group>
  );
}

function Ball() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);
  const trailRefs = useRef<THREE.Mesh[]>([]);
  const TRAIL = 12;

  const ballTexture = useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.55);
    grad.addColorStop(0, "#e8ff5e");
    grad.addColorStop(1, "#bcd520");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#fdffe8";
    ctx.lineWidth = 8;
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
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Pre-allocate trail history of recent positions
  const history = useRef<{ x: number; y: number; z: number }[]>(
    Array.from({ length: TRAIL }, () => ({ x: 0, y: 0, z: 0 }))
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = Math.floor(t / PERIOD);
    const phase = (t % PERIOD) / PERIOD;
    const dir = cycle % 2 === 0 ? 1 : -1;

    // Court-length travel along Y.
    const eased = easeInOutSine(phase);
    const y = dir * (-COURT_HALF_Y + eased * COURT_HALF_Y * 2);
    // Two arcs per trip: bounce once at mid-court so it reads as a real rally.
    const bouncePhase = (phase * 2) % 1;
    const z = Math.sin(bouncePhase * Math.PI) * ARC_HEIGHT;
    const x = Math.sin(phase * Math.PI) * 0.35 * dir;

    meshRef.current.position.set(x, y, z + 0.18);
    meshRef.current.rotation.x = t * 5 * dir;
    meshRef.current.rotation.z = t * 1.5 * dir;

    // Squash on bounce
    const nearGround = 1 - Math.min(1, z / 0.15);
    const squash = 1 - nearGround * 0.18;
    meshRef.current.scale.set(1 + (1 - squash) * 0.4, 1 + (1 - squash) * 0.4, squash);

    // Shadow shrinks/fades as the ball rises
    const heightFactor = Math.min(1, z / ARC_HEIGHT);
    shadowRef.current.position.set(x, y, 0.005);
    shadowRef.current.scale.setScalar(1 - heightFactor * 0.55);
    (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.45 - heightFactor * 0.35;

    // Update trail history
    history.current.unshift({ x, y, z: z + 0.18 });
    history.current.pop();
    trailRefs.current.forEach((m, i) => {
      if (!m) return;
      const p = history.current[i + 1];
      if (!p) return;
      m.position.set(p.x, p.y, p.z);
      const fade = 1 - i / TRAIL;
      m.scale.setScalar(0.9 * fade);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.18 * fade;
    });
  });

  return (
    <>
      {/* Soft motion trail */}
      {Array.from({ length: TRAIL }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) trailRefs.current[i] = el;
          }}
          renderOrder={5}
        >
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#e8ff5e" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {/* Ball */}
      <mesh ref={meshRef} renderOrder={10}>
        <sphereGeometry args={[0.18, 48, 48]} />
        <meshStandardMaterial
          map={ballTexture}
          roughness={0.95}
          metalness={0}
          emissive="#9fbf1a"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Bounce shadow */}
      <mesh ref={shadowRef} rotation={[0, 0, 0]} renderOrder={4}>
        <circleGeometry args={[0.22, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </>
  );
}

export function TennisRallyScene({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        // Top-down camera with a slight tilt so the court reads as a court,
        // not a flat rectangle. Portrait framing matches the overlay slot.
        camera={{ position: [0, -0.6, 6.4], fov: 46 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 5]} intensity={1.1} />
        <Suspense fallback={null}>
          {/* Tilt the whole scene slightly forward so the far baseline
              recedes — gives a sense of depth without being a full 3D shot. */}
          <group rotation={[-0.35, 0, 0]}>
            <Court />
            <Ball />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
