import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  HourlyWeatherFrame,
  TIMELINE_PHASE_META,
  generateFibonacciSurfaceNodes,
  generateSeededCloudClusters,
  getThermalAuraColor,
  projectSpherePoint,
} from '../utils/weatherTimeMachineModels';

export interface Interactive3DWeatherGlobeProps {
  currentFrame: HourlyWeatherFrame;
  isLowEndMode: boolean;
  className?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
}

/**
 * Interactive 3D Weather Globe & Particle Engine (`com.aerolune.weather.timemachine.Interactive3DWeatherGlobe`)
 * Uses 3D spherical-to-Cartesian coordinates (Vec3), matrix rotation (rotateX, rotateY),
 * and perspective depth projection to render a touch-rotatable, zoomable 3D Earth Globe
 * with 3D cloud shells, falling rain streaks, wind vector particles, and a Bangladesh focus beacon.
 */
export const Interactive3DWeatherGlobe: React.FC<Interactive3DWeatherGlobeProps> = ({
  currentFrame,
  isLowEndMode,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive 3D camera orientation (default centered on Bangladesh / South Asia front hemisphere)
  const [rotationYaw, setRotationYaw] = useState<number>(-3.12);
  const [rotationPitch, setRotationPitch] = useState<number>(-0.38);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  // Pre-generate Fibonacci sphere surface dots & volumetric cloud clusters
  const surfaceNodes = useMemo(
    () => generateFibonacciSurfaceNodes(isLowEndMode),
    [isLowEndMode]
  );
  const cloudClusters = useMemo(
    () => generateSeededCloudClusters(isLowEndMode),
    [isLowEndMode]
  );

  // Smoothly interpolated telemetry ref so timeline scrubbing transitions smoothly
  const smoothedRef = useRef({
    cloudCover: currentFrame.cloudCoverFraction,
    rain: currentFrame.rainIntensityMm,
    temp: currentFrame.temperatureC,
    wind: currentFrame.windSpeedKmh,
  });

  useEffect(() => {
    let rafId = 0;
    let cancelled = false;
    const startTime = performance.now();

    const renderLoop = (now: number) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          const dpr = isLowEndMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
          const targetW = Math.max(240, Math.floor(rect.width * dpr));
          const targetH = Math.max(240, Math.floor(rect.height * dpr));
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          const width = rect.width || 360;
          const height = rect.height || 360;
          ctx.clearRect(0, 0, width, height);

          // Smoothly interpolate towards target frame metrics (350ms equivalent lerp)
          const s = smoothedRef.current;
          s.cloudCover += (currentFrame.cloudCoverFraction - s.cloudCover) * 0.16;
          s.rain += (currentFrame.rainIntensityMm - s.rain) * 0.16;
          s.temp += (currentFrame.temperatureC - s.temp) * 0.16;
          s.wind += (currentFrame.windSpeedKmh - s.wind) * 0.16;

          const phaseMeta = TIMELINE_PHASE_META[currentFrame.phase];
          const thermalAuraHex = getThermalAuraColor(s.temp);

          // Continuous orbital animation (0 to 2*PI over 14000ms)
          const atmosphereTick = (((now - startTime) % 14000) / 14000) * (2 * Math.PI);

          const centerX = width / 2;
          const centerY = height / 2;
          const minDim = Math.min(width, height);
          const baseRadius = minDim * 0.36 * zoomScale;
          const fov = minDim * 0.95;

          // 1. Outer Atmospheric & Thermal Heatmap Halo
          if (!isLowEndMode) {
            const haloRadius = baseRadius * 1.48;
            const haloGrad = ctx.createRadialGradient(
              centerX,
              centerY,
              baseRadius * 0.65,
              centerX,
              centerY,
              haloRadius
            );
            haloGrad.addColorStop(0, hexToRgba(phaseMeta.primaryColor, 0.25));
            haloGrad.addColorStop(0.55, hexToRgba(thermalAuraHex, 0.14));
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Core 3D Ocean Sphere Body
          const oceanGrad = ctx.createRadialGradient(
            centerX - baseRadius * 0.25,
            centerY - baseRadius * 0.25,
            baseRadius * 0.08,
            centerX - baseRadius * 0.25,
            centerY - baseRadius * 0.25,
            baseRadius * 1.15
          );
          oceanGrad.addColorStop(0, '#1E3A8A');
          oceanGrad.addColorStop(0.55, '#0F172A');
          oceanGrad.addColorStop(1, '#020617');
          ctx.fillStyle = oceanGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
          ctx.fill();

          // 3. Render Surface Grid Nodes & Thermal Tint
          for (let i = 0; i < surfaceNodes.length; i++) {
            const node = surfaceNodes[i];
            const { screenX, screenY, zDepth } = projectSpherePoint(
              node.baseTheta,
              node.basePhi,
              1.0,
              baseRadius,
              fov,
              centerX,
              centerY,
              rotationYaw,
              rotationPitch
            );
            // Back-face culling: only render front-facing hemisphere
            if (zDepth < baseRadius * 0.15) {
              const depthAlpha = Math.min(
                0.9,
                Math.max(0.1, (baseRadius - zDepth) / (2 * baseRadius))
              );
              ctx.fillStyle = hexToRgba(thermalAuraHex, depthAlpha * 0.55);
              ctx.beginPath();
              ctx.arc(screenX, screenY, node.size * zoomScale, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 4. Render Elevated 3D Cloud Shell & Wind Streamlines
          const windSpeedFactor = Math.min(3.0, Math.max(0.2, s.wind / 35));
          const visibleCloudCount = Math.floor(cloudClusters.length * s.cloudCover);
          const twoPi = 2 * Math.PI;

          ctx.lineCap = 'round';
          for (let i = 0; i < visibleCloudCount; i++) {
            const cloud = cloudClusters[i];
            const animatedPhi = (cloud.basePhi + atmosphereTick * windSpeedFactor) % twoPi;
            const {
              screenX: cx,
              screenY: cy,
              zDepth: cz,
            } = projectSpherePoint(
              cloud.baseTheta,
              animatedPhi,
              cloud.altitudeMultiplier,
              baseRadius,
              fov,
              centerX,
              centerY,
              rotationYaw,
              rotationPitch
            );

            if (cz < 0) {
              const cloudAlpha = ((baseRadius - cz) / (2 * baseRadius)) * s.cloudCover;
              const clampedCloudAlpha = Math.min(0.75, Math.max(0, cloudAlpha * 0.42));

              // Volumetric 3D Cloud Puff
              ctx.fillStyle = `rgba(255, 255, 255, ${clampedCloudAlpha.toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(cx, cy, cloud.size * zoomScale, 0, Math.PI * 2);
              ctx.fill();

              // Wind Streamline Trail behind Cloud
              if (i % 3 === 0) {
                const { screenX: tx, screenY: ty } = projectSpherePoint(
                  cloud.baseTheta,
                  animatedPhi - 0.09 * windSpeedFactor,
                  cloud.altitudeMultiplier,
                  baseRadius,
                  fov,
                  centerX,
                  centerY,
                  rotationYaw,
                  rotationPitch
                );
                ctx.strokeStyle = hexToRgba(phaseMeta.primaryColor, 0.45);
                ctx.lineWidth = 2.2 * zoomScale;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(cx, cy);
                ctx.stroke();
              }

              // 5. 3D Rain Streaks Falling from Cloud Layer to Earth Surface
              if (s.rain > 0.5 && i % 2 === 0) {
                const { screenX: gx, screenY: gy } = projectSpherePoint(
                  cloud.baseTheta,
                  animatedPhi,
                  0.98,
                  baseRadius,
                  fov,
                  centerX,
                  centerY,
                  rotationYaw,
                  rotationPitch
                );
                const rainAlpha = Math.min(0.95, Math.max(0.35, s.rain / 25));
                ctx.strokeStyle = hexToRgba('#38BDF8', rainAlpha);
                ctx.lineWidth = 2.5 * zoomScale;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(gx, gy);
                ctx.stroke();
              }
            }
          }

          // 6. Highlight Target Pin for Bangladesh (23.6850° N, 90.3563° E)
          const bdTheta = ((90 - 23.68) * Math.PI) / 180;
          const bdPhi = (90.35 * Math.PI) / 180;
          const {
            screenX: bdX,
            screenY: bdY,
            zDepth: bdZ,
          } = projectSpherePoint(
            bdTheta,
            bdPhi,
            1.02,
            baseRadius,
            fov,
            centerX,
            centerY,
            rotationYaw,
            rotationPitch
          );

          if (bdZ < 0) {
            ctx.fillStyle = hexToRgba(phaseMeta.primaryColor, 0.35);
            ctx.beginPath();
            ctx.arc(bdX, bdY, 18 * zoomScale, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(bdX, bdY, 5.5 * zoomScale, 0, Math.PI * 2);
            ctx.fill();

            // Target Beacon Label
            ctx.font = '600 10px "JetBrains Mono", monospace';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('BD 23.7°N 90.4°E', bdX + 10 * zoomScale, bdY + 3);
          }

          // 7. Specular 3D Rim Lighting Ring (Distinguishes Past vs Forecast Mode)
          const rimGrad = ctx.createLinearGradient(
            centerX - baseRadius,
            centerY - baseRadius,
            centerX + baseRadius,
            centerY + baseRadius
          );
          rimGrad.addColorStop(0, hexToRgba(phaseMeta.primaryColor, 0.85));
          rimGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
          rimGrad.addColorStop(1, hexToRgba(phaseMeta.secondaryColor, 0.55));
          ctx.strokeStyle = rimGrad;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        }
      }
      // Pace frames cleanly in headless / low-end environments
      window.setTimeout(() => {
        if (!cancelled) {
          rafId = requestAnimationFrame(renderLoop);
        }
      }, 60);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [
    currentFrame,
    isLowEndMode,
    rotationYaw,
    rotationPitch,
    zoomScale,
    surfaceNodes,
    cloudClusters,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setRotationYaw((prev) => prev + dx * 0.0065);
    setRotationPitch((prev) => Math.min(1.2, Math.max(-1.2, prev + dy * 0.0065)));
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const phaseMeta = TIMELINE_PHASE_META[currentFrame.phase];

  return (
    <div
      data-testid="interactive-3d-weather-globe"
      className={`relative w-full h-[320px] sm:h-[360px] rounded-xl overflow-hidden bg-[#030712] border border-slate-800 select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top-Left Telemetry & Phase Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none space-y-1">
        <div
          style={{
            color: phaseMeta.primaryColor,
            borderColor: `${phaseMeta.primaryColor}66`,
            backgroundColor: '#07090Ecc',
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[10px] font-mono font-bold tracking-wider"
        >
          <span>{phaseMeta.badgeText}</span>
          <span>·</span>
          <span>{currentFrame.displayTime}</span>
        </div>
        <div className="text-[11px] font-mono text-slate-300 bg-[#07090E]/85 px-2 py-0.5 rounded border border-slate-800/80">
          Nodes: {surfaceNodes.length} · Clouds: {Math.round(currentFrame.cloudCoverFraction * 100)}% · Rain: {currentFrame.rainIntensityMm.toFixed(1)}mm/h
        </div>
      </div>

      {/* Bottom-Right Zoom & Reset Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Zoom In Globe"
          onClick={() => setZoomScale((z) => Math.min(2.25, +(z + 0.18).toFixed(2)))}
          className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 hover:border-cyan-400"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="Zoom Out Globe"
          onClick={() => setZoomScale((z) => Math.max(0.75, +(z - 0.18).toFixed(2)))}
          className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 hover:border-cyan-400"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="Center Globe on Bangladesh"
          onClick={() => {
            setRotationYaw(-3.12);
            setRotationPitch(-0.38);
            setZoomScale(1.0);
          }}
          className="px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-cyan-300 hover:border-cyan-400 inline-flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>23.7°N BD</span>
        </button>
      </div>
    </div>
  );
};
