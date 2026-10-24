// Shared 3D helper: GPU particles in the brand accent.
// Hayla's mood is steam and frankincense haze, so by default the particles are
// soft round motes that rise slowly instead of falling rain streaks.
import * as THREE from "three";

export function makeParticles(count, color, pixelRatio, size = 22, opacity = 0.5, { rise = true, round = true } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = Math.random() * 7 - 1;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    speed[i] = 0.5 + Math.random();
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uSize: { value: size * pixelRatio }, uOpacity: { value: opacity },
      uDir: { value: rise ? 1 : -1 }, uRound: { value: round ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSpeed;
      uniform float uTime, uBoost, uSize, uDir;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uDir * uTime * aSpeed * (0.18 + uBoost), 7.0) - 1.0;   // drift, wrap
        p.x += sin(uTime * 0.3 + position.z) * 0.15;                              // gentle sway
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * aSpeed / -mv.z;
        vAlpha = smoothstep(9.0, 1.2, -mv.z) * smoothstep(-1.0, 0.5, p.y) * smoothstep(6.0, 4.0, p.y);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uRound;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float shape = uRound > 0.5
          ? smoothstep(0.5, 0.0, length(c))                     // soft round mote
          : smoothstep(0.5, 0.0, length(c * vec2(7.0, 1.0)));   // tall, thin streak
        gl_FragColor = vec4(uColor, shape * vAlpha * uOpacity);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}
