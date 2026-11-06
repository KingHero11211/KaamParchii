"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

type Props = { playing: boolean; analyser: AnalyserNode | null; className?: string };

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0., 1.); }
`;
const fragment = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform float level;
uniform float speaking;
void main() {
  vec2 p = (vUv - .5) * 2.5;
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float wave = sin(angle * 3. + time * .8) * .035
             + sin(angle * 5. - time * .65) * .025;
  float edge = .78 + wave * (.5 + level * 2.);
  float ring = exp(-abs(radius - edge) * (32. - level * 12.));
  float inner = exp(-abs(radius - edge + .09) * 26.) * .38;
  float halo = exp(-abs(radius - edge) * 7.) * .18;
  float shine = .5 + .5 * sin(angle * 1.5 - time * .45);
  vec3 forest = vec3(.137, .306, .251);
  vec3 sage = vec3(.36, .59, .39);
  vec3 lime = vec3(.87, .95, .60);
  vec3 color = mix(forest, sage, shine);
  color = mix(color, lime, pow(shine, 5.) * (.45 + speaking * .45));
  float alpha = clamp(ring + inner + halo, 0., 1.);
  gl_FragColor = vec4(color, alpha * (.7 + speaking * .3));
}
`;

export function VoicePoweredOrb({ playing, analyser, className = "" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ playing, analyser });
  const restart = useRef<(() => void) | null>(null);
  useEffect(() => {
    state.current = { playing, analyser };
    restart.current?.();
  }, [playing, analyser]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let dispose = () => {};
    try {
      const renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(devicePixelRatio || 1, 1.75) });
      const gl = renderer.gl;
      const geometry = new Triangle(gl);
      const program = new Program(gl, { vertex, fragment, transparent: true, uniforms: {
        time: { value: 0 }, level: { value: 0 }, speaking: { value: 0 },
      } });
      const mesh = new Mesh(gl, { geometry, program });
      container.appendChild(gl.canvas);
      container.dataset.rendered = "true";
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0;
      let clock = 0;
      let previous = 0;
      let amplitude = 0;
      let lost = false;
      let samples = new Uint8Array(256);
      function draw(now: number) {
        if (lost) return;
        const current = state.current;
        const animate = current.playing && !reduced.matches && !document.hidden;
        const delta = previous ? Math.min((now - previous) / 1000, .05) : 0;
        previous = now;
        let target = 0;
        if (animate && current.analyser) {
          if (samples.length !== current.analyser.fftSize) samples = new Uint8Array(current.analyser.fftSize);
          current.analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += Math.pow((sample - 128) / 128, 2);
          target = Math.min(1, Math.sqrt(sum / samples.length) * 4);
        }
        amplitude = animate ? amplitude + (target - amplitude) * .22 : 0;
        if (animate) clock += delta * (1 + amplitude * 2);
        program.uniforms.time.value = clock;
        program.uniforms.level.value = amplitude;
        program.uniforms.speaking.value = current.playing ? 1 : 0;
        renderer.render({ scene: mesh });
        frame = animate ? requestAnimationFrame(draw) : 0;
      }
      function start() {
        cancelAnimationFrame(frame);
        previous = 0;
        draw(performance.now());
      }
      const observer = new ResizeObserver(() => {
        renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
        start();
      });
      function contextLost(event: Event) {
        event.preventDefault(); lost = true; cancelAnimationFrame(frame);
        delete container!.dataset.rendered;
      }
      restart.current = start;
      observer.observe(container);
      reduced.addEventListener("change", start);
      document.addEventListener("visibilitychange", start);
      gl.canvas.addEventListener("webglcontextlost", contextLost);
      dispose = () => {
        restart.current = null;
        cancelAnimationFrame(frame);
        observer.disconnect();
        reduced.removeEventListener("change", start);
        document.removeEventListener("visibilitychange", start);
        gl.canvas.removeEventListener("webglcontextlost", contextLost);
        geometry.remove(); program.remove();
        gl.canvas.remove(); delete container.dataset.rendered;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch {
      container.dataset.rendered = "";
    }
    return () => dispose();
  }, []);
  return <div ref={host} className={("voice-orb " + className).trim()} data-speaking={playing} aria-hidden="true">
    <span className="voice-orb-fallback" />
  </div>;
}
