// A transparent WebGL layer over the scrubbed film. Amber motes drift up through
// the frame like steam and incense, speed up with scroll, and lean with the cursor.
import * as THREE from "three";
import { makeParticles } from "./particles.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const LITE = matchMedia("(max-width: 768px), (hover: none)").matches;

export function initAtmosphere({ lenis }) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const canvas = document.getElementById("atmos");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); } catch { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1.25 : 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 40);
  camera.position.set(0, 1.5, 6);
  const particles = makeParticles(LITE ? 260 : 700, css("--accent"), renderer.getPixelRatio(), 30, 0.55);
  scene.add(particles);

  const pointer = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });
  const resize = () => {
    // Size from the canvas itself: on phones it is a square band, not the whole window.
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  addEventListener("resize", resize);
  resize();

  const cover = document.querySelector(".stage-cover");
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (document.hidden || (cover && cover.getBoundingClientRect().top <= 0)) return;
    const t = clock.getElapsedTime();
    camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (1.5 + pointer.y * 0.3 - camera.position.y) * 0.04;
    camera.lookAt(0, 1.5, 0);
    particles.material.uniforms.uTime.value = t;
    particles.material.uniforms.uBoost.value = Math.min(1.2, Math.abs(lenis?.velocity || 0) * 0.015);
    renderer.render(scene, camera);
  });
  return { renderer, scene, camera };
}
