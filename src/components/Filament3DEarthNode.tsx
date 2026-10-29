import React, { useEffect, useMemo, useRef } from 'react';
import {
  HourlyWeatherFrame,
  TIMELINE_PHASE_META,
  computeFilamentEarthRotation,
  getThermalAuraColor,
} from '../utils/weatherTimeMachineModels';

export interface Filament3DEarthNodeProps {
  currentFrame: HourlyWeatherFrame;
  isLowEndMode?: boolean;
  className?: string;
}

/**
 * Interactive PBR Mesh Preview of `Filament3DEarthNode(hourOffset: Int)`
 * Simulates `io.github.sceneview:sceneview:4.62.0` loading `models/aerolune_earth_clouds.glb`
 * with `scaleToUnits = 1.2f` and `Float3(x = 23.68f, y = (hourOffset * 15f) % 360f, z = 0f)`.
 */
export const Filament3DEarthNode: React.FC<Filament3DEarthNodeProps> = ({
  currentFrame,
  isLowEndMode = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transform = useMemo(
    () => computeFilamentEarthRotation(currentFrame.hourOffset),
    [currentFrame.hourOffset]
  );
  const phaseMeta = TIMELINE_PHASE_META[currentFrame.phase];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = isLowEndMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(260, rect.width || 380);
    const height = Math.max(220, rect.height || 260);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.35 * (transform.scaleToUnits / 1.08);
    const yawRad = (transform.rotationDeg.y * Math.PI) / 180;
    const tiltRad = (transform.rotationDeg.x * Math.PI) / 180;

    // 1. PBR IBL Atmospheric Scattering Halo
    const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.38);
    haloGrad.addColorStop(0, `${phaseMeta.primaryColor}44`);
    haloGrad.addColorStop(0.55, `${getThermalAuraColor(currentFrame.temperatureC)}22`);
    haloGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.38, 0, Math.PI * 2);
    ctx.fill();

    // 2. PBR Ocean Base Sphere with Specular Sun Reflection
    const sunOffsetX = Math.sin(yawRad * 0.5) * radius * 0.35;
    const sunOffsetY = -Math.sin(tiltRad) * radius * 0.45;
    const oceanGrad = ctx.createRadialGradient(
      cx + sunOffsetX,
      cy + sunOffsetY,
      radius * 0.06,
      cx,
      cy,
      radius
    );
    oceanGrad.addColorStop(0, '#38BDF8');
    oceanGrad.addColorStop(0.28, '#0284C7');
    oceanGrad.addColorStop(0.68, '#0F172A');
    oceanGrad.addColorStop(1, '#020617');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = oceanGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // 3. PBR Normal-Mapped Continental Relief Patches (Rotated by y = (hourOffset * 15) % 360)
    const continents = [
      { lat: 23.68, lon: 90.35, rx: 0.34, ry: 0.24, label: 'Bay of Bengal / BD' },
      { lat: 35.0, lon: 105.0, rx: 0.44, ry: 0.3, label: 'Eurasia' },
      { lat: 5.0, lon: 22.0, rx: 0.32, ry: 0.42, label: 'Africa' },
      { lat: -24.0, lon: 135.0, rx: 0.26, ry: 0.18, label: 'Australia' },
      { lat: 40.0, lon: -100.0, rx: 0.36, ry: 0.32, label: 'Americas' },
    ];

    continents.forEach((cont) => {
      const lonRad = ((cont.lon + transform.rotationDeg.y - 90) * Math.PI) / 180;
      const latRad = ((cont.lat - transform.rotationDeg.x * 0.45) * Math.PI) / 180;
      const zVis = Math.cos(latRad) * Math.cos(lonRad);
      if (zVis > -0.15) {
        const px = cx + Math.cos(latRad) * Math.sin(lonRad) * radius * 0.86;
        const py = cy - Math.sin(latRad) * radius * 0.86;
        const landGrad = ctx.createRadialGradient(
          px - 6,
          py - 6,
          2,
          px,
          py,
          radius * cont.rx
        );
        landGrad.addColorStop(0, '#34D399aa');
        landGrad.addColorStop(0.55, '#05966988');
        landGrad.addColorStop(1, '#064E3B00');
        ctx.fillStyle = landGrad;
        ctx.beginPath();
        ctx.ellipse(
          px,
          py,
          radius * cont.rx * Math.max(0.35, zVis),
          radius * cont.ry,
          lonRad * 0.25,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });

    // 4. Lat/Lon Normal Map Graticule Lines (Tilted by x = 23.68 deg)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      const yOff = Math.sin(((lat - transform.rotationDeg.x * 0.35) * Math.PI) / 180) * radius;
      const rLat = Math.cos((lat * Math.PI) / 180) * radius;
      ctx.beginPath();
      ctx.ellipse(cx, cy - yOff, rLat, rLat * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. PBR Cloud Normal Shell (`aerolune_earth_clouds.glb` secondary mesh layer)
    const cloudAlpha = Math.min(0.82, Math.max(0.15, currentFrame.cloudCoverFraction * 0.78));
    for (let i = 0; i < 14; i++) {
      const angle = (i * 0.85 + yawRad * 1.15) % (Math.PI * 2);
      const bandY = Math.sin(i * 1.3) * radius * 0.68;
      const bandX = Math.cos(angle) * radius * 0.58;
      const cGrad = ctx.createRadialGradient(
        cx + bandX,
        cy + bandY,
        2,
        cx + bandX,
        cy + bandY,
        radius * 0.36
      );
      cGrad.addColorStop(0, `rgba(255, 255, 255, ${cloudAlpha.toFixed(2)})`);
      cGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(cx + bandX, cy + bandY, radius * 0.36, radius * 0.16, angle * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Bangladesh Focus Pin (23.68°N Tilt Anchor)
    ctx.fillStyle = `${phaseMeta.primaryColor}66`;
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.18, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.18, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('23.68°N BD Tilt Anchor', cx + 10, cy - radius * 0.18 + 3);

    ctx.restore();

    // 7. Fresnel PBR Rim Ring
    ctx.strokeStyle = phaseMeta.primaryColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, [currentFrame, isLowEndMode, phaseMeta, transform]);

  return (
    <div
      data-testid="filament-3d-earth-node"
      className={`relative w-full h-[250px] sm:h-[270px] rounded-xl overflow-hidden bg-[#030712] border border-slate-800 ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Top-Left SceneView 4.62.0 Asset & Rotation Telemetry Overlay */}
      <div className="absolute top-3 left-3 space-y-1 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-950/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
          <span>SceneView 4.62.0</span>
          <span>·</span>
          <span>{transform.assetFileLocation}</span>
        </div>
        <div
          data-testid="filament-rotation-readout"
          className="text-[11px] font-mono text-slate-200 bg-slate-950/90 px-2.5 py-0.5 rounded border border-slate-800"
        >
          Float3(x={transform.rotationDeg.x}°, y={transform.rotationDeg.y}°, z={transform.rotationDeg.z}°) · scale={transform.scaleToUnits}
        </div>
      </div>
    </div>
  );
};
