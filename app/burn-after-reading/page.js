'use client';

import { useRef, useEffect, useState } from 'react';

// Each array position is a temperature, from cold black to hot white.
const palette = [
  '#070707', '#1f0707', '#2f0f07', '#470f07', '#571707', '#671f07',
  '#771f07', '#8f2707', '#9f2f07', '#af3f07', '#bf4707', '#c74707',
  '#df4f07', '#df5707', '#df5707', '#d75f07', '#d7670f', '#cf6f0f',
  '#cf770f', '#cf7f0f', '#cf8717', '#c78717', '#c78f17', '#c7971f',
  '#bf9f1f', '#bf9f1f', '#bfa727', '#bfa727', '#bfaf2f', '#b7af2f',
  '#b7b72f', '#b7b737', '#cfcf6f', '#dfdf9f', '#efefc7', '#ffffff',
];

export default function Home() {
  /** @type {import('react').RefObject<HTMLCanvasElement | null>} */
  const canvasRef = useRef(null);
  const burnRequested = useRef(false);
  const [burnState, setBurnState] = useState('ready');
  const [size, setSize] = useState(null);

  useEffect(() => {
    function resize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!size) return;
    burnRequested.current = false;
    setBurnState('ready');

    const params = new URLSearchParams(window.location.search);

    const text = params.get('text') ?? 'hello world';
  
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Keep 100 heat rows and match the screen's proportions.
    canvas.height = 500;
    const columnCount = Math.max(1, Math.round(100 * size.width / size.height));
    canvas.width = columnCount * 5;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sample the letters into small pieces, each with its own burn time.
    const textCanvas = document.createElement('canvas');
    textCanvas.width = canvas.width;
    textCanvas.height = canvas.height;
    const textCtx = textCanvas.getContext('2d');
    if (!textCtx) return;
    // Convert CSS pixels to drawing pixels so phones get readable text.
    const scale = canvas.height / size.height;
    const preferredSize = Math.min(80, Math.max(40, size.width * 0.06)) * scale;
    const padding = 24 * scale;
    const maxWidth = Math.max(1, canvas.width - padding * 2);
    const maxHeight = canvas.height * 0.6;

    function wrapText(fontSize) {
      textCtx.font = `bold ${fontSize}px monospace`;
      const lines = [];
      for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
          const candidate = line ? `${line} ${word}` : word;
          if (textCtx.measureText(candidate).width <= maxWidth) {
            line = candidate;
            continue;
          }
          if (line) lines.push(line);
          line = '';
          // Split long words and URLs instead of clipping them.
          for (const character of word) {
            if (line && textCtx.measureText(line + character).width > maxWidth) {
              lines.push(line);
              line = '';
            }
            line += character;
          }
        }
        lines.push(line);
      }
      return lines;
    }

    // Find the largest font that fits the complete message. No truncation.
    let low = 0;
    let high = preferredSize;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = (low + high) / 2;
      const wrapped = wrapText(candidate);
      const fits = wrapped.length * candidate * 1.4 <= maxHeight
        && wrapped.every(line => textCtx.measureText(line).width <= maxWidth);
      if (fits) low = candidate;
      else high = candidate;
    }
    const fontSize = low || high;
    const lines = wrapText(fontSize);
    const lineHeight = fontSize * 1.4;
    textCtx.fillStyle = 'white';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    const textTop = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
    const textBottom = textTop + (lines.length - 1) * lineHeight + fontSize / 2;
    const textHeight = Math.max(fontSize, lines.length * lineHeight);
    lines.forEach((line, index) => {
      textCtx.fillText(line, canvas.width / 2, textTop + index * lineHeight);
    });
    const pixels = textCtx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pieces = [];
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3] / 255;
        if (alpha > 0) {
          pieces.push({
            x, y, alpha,
            // Burn upward through the letters with an uneven edge.
            burnAt: Math.max(0, (textBottom - y) / textHeight) * 2000 + Math.random() * 500,
            speed: 20 + Math.random() * 30,
          });
        }
      }
    }
    let burnElapsed = 0;
    let burnFinished = false;

    const cellSize = 5;
    const columns = canvas.width / cellSize;
    const rows = canvas.height / cellSize;
    const maxHeat = palette.length - 1;
    let heat = new Array(columns * rows).fill(0);
    let nextHeat = new Array(columns * rows).fill(0);
    const bottomRowStart = (rows - 1) * columns;
    heat.fill(maxHeat, bottomRowStart);

    function updateFire() {
      // Read from the old grid and write into the new one so each update
      // moves heat only one row upward, regardless of loop order.
      for (let row = 0; row < rows - 1; row++) {
        for (let column = 0; column < columns; column++) {
          // Pull heat from 0–2 cells to the right, so it travels left
          // as it rises. Random variation keeps the wind flickering.
          const drift = Math.floor(Math.random() * 3);
          const sourceColumn = (column + drift + columns) % columns;
          const sourceIndex = (row + 1) * columns + sourceColumn;
          // Frequent zero cooling lets flames climb higher.
          const cooling = Math.random() < 0.45 ? 1 : 0;
          nextHeat[row * columns + column] = Math.max(
            0, heat[sourceIndex] - cooling
          );
        }
      }

      // Keep feeding the fire from the bottom.
      nextHeat.fill(maxHeat, bottomRowStart);
      const previousHeat = heat;
      heat = nextHeat;
      nextHeat = previousHeat;
    }

    function drawFire() {
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          ctx.fillStyle = palette[heat[row * columns + column]];
          ctx.fillRect(
            column * cellSize, row * cellSize, cellSize, cellSize
          );
        }
      }

      // Draw every outline before any letter fills so neighboring pieces
      // cannot cast dark seams over letters that have already been drawn.
      const outline = 2 * scale;
      for (const pass of ['outline', 'fill']) {
        for (const piece of pieces) {
        const age = burnRequested.current ? burnElapsed - piece.burnAt : -Infinity;
        if (age >= 800) continue;
        ctx.globalAlpha = piece.alpha * (age > 0 ? 1 - age / 800 : 1);
        ctx.fillStyle = pass === 'outline' ? '#070707'
          : age > -180 ? (age > 0 ? '#ff9b36' : '#ffe0a0') : 'white';
        const travel = Math.max(0, age) / 1000;
        const border = pass === 'outline' ? outline : 0;
        ctx.fillRect(
          piece.x - travel * piece.speed * 2 - border,
          piece.y - travel * piece.speed - border,
          2 + border * 2, 2 + border * 2
        );
        }
      }
      ctx.globalAlpha = 1;
    }

    // Update 30 times a second, independent of the display's refresh rate.
    const step = 1000 / 30;
    let previousTime = null;
    let accumulatedTime = 0;
    let animationId;

    function animate(time) {
      if (previousTime === null) previousTime = time;
      const elapsed = Math.min(time - previousTime, 100);
      accumulatedTime += elapsed;
      previousTime = time;

      if (burnRequested.current && !burnFinished) {
        burnElapsed += elapsed;
        if (burnElapsed >= 3500) {
          burnFinished = true;
          setBurnState('burned');
        }
      }

      while (accumulatedTime >= step) {
        updateFire();
        accumulatedTime -= step;
      }

      drawFire();
      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);
    // Also prevents duplicate loops during React's development checks.
    return () => cancelAnimationFrame(animationId);
  }, [size]);

  return (
    <main className="fire-page">
      <div className="fire-scene">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        role="img"
        aria-label="Animated pixel fire"
        className="fire-canvas"
      >
        Animated Doom-style fire.
      </canvas>
      <button
        className="burn-button"
        type="button"
        disabled={burnState !== 'ready'}
        onClick={() => {
          burnRequested.current = true;
          setBurnState('burning');
        }}
        style={{
          padding: '12px 24px',
          background: '#22130d',
          color: '#ffd6ad',
          border: '1px solid #8d4826',
          borderRadius: 6,
          font: '16px monospace',
          cursor: burnState === 'ready' ? 'pointer' : 'default',
          opacity: burnState === 'ready' ? 1 : 0.6,
        }}
      >
        {burnState === 'ready' ? 'Burn text' : burnState === 'burning' ? 'Burning…' : 'Burned away'}
      </button>
      </div>
    </main>
  );
}
