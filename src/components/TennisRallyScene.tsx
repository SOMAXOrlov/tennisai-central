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

const PERIOD = 2.2; // seconds per one-way trip (hit -> bounce -> opposite baseline)
const COURT_HALF_Y = 2.2;
const ARC_HEIGHT = 1.3; // peak height clearing the net
const NET_HEIGHT = 0.42;
const BOUNCE_FRACTION = 0.55; // where in the trip the ball touches down (0..1)

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
        <meshBasicMaterial color="hsl(158 38% 14%)" />
      </mesh>
      <mesh position={[0, 0, 0.0005]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="hsl(158 52% 28%)" />
      </mesh>

      {/* Baselines */}
      <Line y={H / 2} w={W} h={LW} />
      <Line y={-H / 2} w={W} h={LW} />
      {/* Sidelines */}
      <Line x={W / 2} w={LW} h={H} />
      <Line x={-W / 2} w={LW} h={H} />
      {/* Net — vertical mesh standing on the court, plus white tape on top */}
      <mesh position={[0, 0, NET_HEIGHT / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 0.5, NET_HEIGHT]} />
        <meshBasicMaterial
          color="hsl(0 0% 90%)"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Net posts */}
      {[-(W + 0.5) / 2, (W + 0.5) / 2].map((x) => (
        <mesh key={x} position={[x, 0, NET_HEIGHT / 2]}>
          <boxGeometry args={[0.04, 0.04, NET_HEIGHT]} />
          <meshBasicMaterial color="hsl(0 0% 8%)" />
        </mesh>
      ))}
      {/* White tape along top of net */}
      <mesh position={[0, 0, NET_HEIGHT]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 0.5, 0.035]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
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
    // Real tennis-ball seam: two interlocking curves that wrap the ball.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.42;
    // Top curve (smile)
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.55, r, Math.PI * 0.18, Math.PI - Math.PI * 0.18, false);
    ctx.stroke();
    // Bottom curve (frown) — mirrored
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.55, r, Math.PI + Math.PI * 0.18, Math.PI * 2 - Math.PI * 0.18, false);
    ctx.stroke();
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

    // One trip = struck at near baseline -> flies over net -> bounces once on
    // opponent's side -> reaches opponent's baseline.  Next trip mirrors back.
    // Y travel is mostly linear (slight ease) so the bounce lands at a fixed
    // spot on the far side.
    const yStart = dir * COURT_HALF_Y;            // hitter baseline
    const yEnd = -dir * COURT_HALF_Y;             // receiver baseline
    const yBounce = -dir * COURT_HALF_Y * 0.5;    // bounce ~mid receiver side

    const eased = easeInOutSine(phase);
    const y = yStart + (yEnd - yStart) * eased;

    // Z is two parabolic arcs joined at the bounce:
    //   arc A (phase 0 .. BOUNCE_FRACTION): big arc clearing the net
    //   arc B (BOUNCE_FRACTION .. 1):       small arc up to receiver
    let z: number;
    if (phase < BOUNCE_FRACTION) {
      const p = phase / BOUNCE_FRACTION;
      z = Math.sin(p * Math.PI) * ARC_HEIGHT;
    } else {
      const p = (phase - BOUNCE_FRACTION) / (1 - BOUNCE_FRACTION);
      z = Math.sin(p * Math.PI) * ARC_HEIGHT * 0.35;
    }
    // Tiny lateral drift so the ball doesn't track a perfect straight line.
    const x = Math.sin(phase * Math.PI) * 0.25 * dir;
    // Mark a momentary "bounce" flash at the contact point so the eye can lock
    // onto where the ball hit the court.
    void yBounce;

    meshRef.current.position.set(x, y, z + 0.12);
    meshRef.current.rotation.x = t * 5 * dir;
    meshRef.current.rotation.z = t * 1.5 * dir;

    // Squash on bounce
    const nearGround = 1 - Math.min(1, z / 0.12);
    const squash = 1 - nearGround * 0.18;
    meshRef.current.scale.set(1 + (1 - squash) * 0.4, 1 + (1 - squash) * 0.4, squash);

    // Shadow shrinks/fades as the ball rises
    const heightFactor = Math.min(1, z / ARC_HEIGHT);
    shadowRef.current.position.set(x, y, 0.005);
    shadowRef.current.scale.setScalar(1 - heightFactor * 0.55);
    (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.45 - heightFactor * 0.35;

    // Update trail history
    history.current.unshift({ x, y, z: z + 0.12 });
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
        // Elevated camera looking down the court at an angle, so the net
        // reads as a vertical mesh and the ball is clearly seen flying over
        // it and bouncing once on each side.
        camera={{ position: [0, -4.6, 4.2], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 5]} intensity={1.1} />
        <Suspense fallback={null}>
          <group>
            <Court />
            <Ball />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
