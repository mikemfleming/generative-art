'use client'; // Canvas needs the browser, rather than Next.js's server.

import { useEffect, useRef } from 'react';
import styles from './page.module.css';

export default function Parallax() {
  // React only mounts the canvas. The animation itself uses normal Canvas APIs.
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width;
    let height;
    let animationId;
    const startTime = performance.now();
    let previousTime = startTime;
    let nextCloud = startTime;
    const clouds = [];

    // x is a fraction of the screen width: 0 is left, 1 is right.
    // New clouds start offscreen. Save random shapes once so they don't flicker.
    function addCloud(x = 1.2) {
      clouds.push({
        x,
        nearness: 0.08 + Math.random() * 0.82,
        width: 1.5 + Math.random(),
        height: 0.65 + Math.random() * 0.5,
        puffs: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
          x: Math.random() * 2 - 1,
          y: -Math.random() * 0.5,
          radius: 0.45 + Math.random() * 0.5,
        })),
      });
    }

    // Start with a few clouds visible rather than waiting for them to arrive.
    for (let i = 0; i < 4; i++) addCloud(Math.random());

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      // Extra drawing pixels keep lines sharp on high-resolution displays.
      // The transform lets the rest of the code still use screen pixels.
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function draw(time) {
      // Movement uses elapsed seconds, so faster displays don't move faster.
      // Cap the gap to avoid a big jump after switching back to this tab.
      const seconds = Math.min((time - previousTime) / 1000, 0.1);
      previousTime = time;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#ffffff';

      const centerX = width / 2;
      const horizon = height / 2;

      ctx.lineWidth = 1.5;

      const distance = 50;
      const travel = (time - startTime) / 2400;
      const first = Math.ceil(travel - distance);
      const last = Math.floor(travel + distance);

      // Integer positions give the ground lines equal spacing in the scene.
      // Subtracting travel slides that whole scene left, without a visible reset.
      for (let i = first; i <= last; i++) {
        const x = i - travel;
        // A line meets the bottom until its x passes a side of the screen.
        // Dividing by depth then puts its endpoint on that side, nearer the
        // horizon. This creates perspective instead of rotating spokes.
        const depth = Math.max(1, Math.abs(x));
        const endX = centerX + x * centerX / depth;
        const endY = horizon + horizon / depth;
        line(centerX, horizon, endX, endY);
      }

      if (time >= nextCloud) {
        addCloud();
        // A new cloud enters every 1.5–5 seconds.
        nextCloud = time + 1500 + Math.random() * 3500;
      }

      ctx.fillStyle = '#ffffff';
      for (let i = clouds.length - 1; i >= 0; i--) {
        const cloud = clouds[i];
        // Nearness puts big clouds higher in the sky, away from the center.
        // Squaring it makes small clouds near the horizon move much slower:
        // half the nearness means a quarter of the speed.
        const size = Math.min(width, height) * (0.008 + cloud.nearness * 0.055);
        cloud.x -= seconds * cloud.nearness ** 2 * 0.1;
        const x = cloud.x * width;
        const y = horizon * (1 - cloud.nearness);

        // Draw one small cloud shape, then stretch and position it.
        // Overlapping circles make the puffs; an ellipse joins their base.
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size, size * cloud.height);
        ctx.beginPath();
        ctx.ellipse(0, 0, cloud.width, 0.5, 0, 0, Math.PI * 2);
        for (const puff of cloud.puffs) {
          ctx.moveTo(puff.x + puff.radius, puff.y);
          ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();

        // Remove clouds once their right edge leaves the screen.
        // Looping backward makes removing array entries safe.
        if (x + size * cloud.width < 0) clouds.splice(i, 1);
      }

      animationId = requestAnimationFrame(draw); // Draw again before the next screen refresh.
    }

    resize();
    window.addEventListener('resize', resize);
    animationId = requestAnimationFrame(draw);

    // Stop the animation and resize listener when leaving this page.
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <main className={styles.page}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label="White perspective lines on flat ground and clouds moving right to left against a black background."
      />
    </main>
  );
}
