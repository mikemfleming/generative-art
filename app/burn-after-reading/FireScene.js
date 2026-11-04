'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './page.module.css';

// Each array position is a temperature, from cold black to hot white.
const warmPalette = [
  '#070707', '#1f0707', '#2f0f07', '#470f07', '#571707', '#671f07',
  '#771f07', '#8f2707', '#9f2f07', '#af3f07', '#bf4707', '#c74707',
  '#df4f07', '#df5707', '#df5707', '#d75f07', '#d7670f', '#cf6f0f',
  '#cf770f', '#cf7f0f', '#cf8717', '#c78717', '#c78f17', '#c7971f',
  '#bf9f1f', '#bf9f1f', '#bfa727', '#bfa727', '#bfaf2f', '#b7af2f',
  '#b7b72f', '#b7b737', '#cfcf6f', '#dfdf9f', '#efefc7', '#ffffff',
];

const bluePalette = [
  '#070707', '#07091f', '#080d2f', '#091147', '#0b1657', '#0d1c67',
  '#0f2277', '#11298f', '#13319f', '#1539af', '#1742bf', '#194bc7',
  '#1b54df', '#1d5de7', '#2066ef', '#236ff7', '#2678ff', '#2981ff',
  '#2c8aff', '#3093ff', '#349cff', '#39a5ff', '#3eaeff', '#43b7ff',
  '#49c0ff', '#50c9ff', '#58d2ff', '#61d9ff', '#6be0ff', '#76e6ff',
  '#83ecff', '#92f1ff', '#a4f5ff', '#baf8ff', '#d5fcff', '#ffffff',
];

const portraitPaths = [
  '/blue-tsunami/41404.png',
  '/blue-tsunami/58352.png',
  '/blue-tsunami/ann-richards.png',
  '/blue-tsunami/texas-toast.png',
];

function loadPortrait(path) {
  const image = new Image();
  image.src = (process.env.NEXT_PUBLIC_BASE_PATH || '') + path;
  return image.decode().then(() => image);
}

export default function FireScene({ blue = false }) {
  /** @type {import('react').RefObject<HTMLCanvasElement | null>} */
  const canvasRef = useRef(null);
  const burnRequested = useRef(false);
  const [burnState, setBurnState] = useState('ready');
  const [size, setSize] = useState(null);
  const [portraits, setPortraits] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!blue) return;
    let active = true;

    Promise.all(portraitPaths.map(loadPortrait)).then(
      images => { if (active) setPortraits(images); },
      () => { if (active) setImageError(true); },
    );

    return () => { active = false; };
  }, [blue]);

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

    const canvas = canvasRef.current;
    if (!canvas) return;
    // Keep 100 heat rows and match the screen's proportions.
    canvas.height = 500;
    const columnCount = Math.max(1, Math.round(100 * size.width / size.height));
    canvas.width = columnCount * 5;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the foreground on a separate canvas, then sample it into embers.
    const textCanvas = document.createElement('canvas');
    textCanvas.width = canvas.width;
    textCanvas.height = canvas.height;
    const textCtx = textCanvas.getContext('2d');
    if (!textCtx) return;
    const scale = canvas.height / size.height;
    let foregroundBottom = 0;
    let foregroundHeight = 1;
    let portraitLayout;

    if (blue) {
      if (portraits) {
        const gap = Math.min(24 * scale, canvas.width * 0.08);
        const side = Math.max(1, Math.floor(Math.min(
          160 * scale, (canvas.width - gap) * 0.42, canvas.height * 0.4,
        )));
        const left = (canvas.width - side * 2 - gap) / 2;
        const top = (canvas.height - side) / 2;
        portraitLayout = { left, top, side, gap };
        portraits.slice(0, 2).forEach((portrait, index) => {
          textCtx.drawImage(portrait, left + index * (side + gap), top, side, side);
        });
        foregroundBottom = top + side;
        foregroundHeight = side;
      }
    } else {
      const params = new URLSearchParams(window.location.search);
      const text = params.get('text') ?? 'hello world';
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
      foregroundBottom = textTop + (lines.length - 1) * lineHeight + fontSize / 2;
      foregroundHeight = Math.max(fontSize, lines.length * lineHeight);
      lines.forEach((line, index) => {
        textCtx.fillText(line, canvas.width / 2, textTop + index * lineHeight);
      });
    }
    const pixels = blue ? null : textCtx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pieces = [];
    for (let y = 0; pixels && y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const offset = (y * canvas.width + x) * 4;
        const alpha = pixels[offset + 3] / 255;
        if (alpha > 0) {
          pieces.push({
            x, y, alpha,
            // Burn upward through the letters with an uneven edge.
            burnAt: Math.max(0, (foregroundBottom - y) / foregroundHeight) * 2000 + Math.random() * 500,
            speed: 20 + Math.random() * 30,
          });
        }
      }
    }
    let burnElapsed = 0;
    let burnFinished = false;
    let burnStarted = false;

    const cellSize = 5;
    const columns = canvas.width / cellSize;
    const rows = canvas.height / cellSize;
    const palette = blue ? bluePalette : warmPalette;
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

    function drawToastSequence() {
      const { left, top, side, gap } = portraitLayout;
      const [, , ann, toast] = portraits;
      const clamp = value => Math.max(0, Math.min(1, value));
      const ease = value => value * value * (3 - 2 * value);

      const toastIn = clamp(burnElapsed / 350);
      const headWidth = Math.min(side * 1.75, canvas.height * 0.65 * ann.width / ann.height);
      const headHeight = headWidth * ann.height / ann.width;
      const headX = (canvas.width - headWidth) / 2;
      const descent = ease(clamp((burnElapsed - 350) / 800));
      const exit = ease(clamp((burnElapsed - 2700) / 800));
      const restingY = top - headHeight * 0.78;
      const headY = -headHeight + (restingY + headHeight) * descent * (1 - exit);
      const mouthX = headX + headWidth * 0.45;
      const mouthY = headY + headHeight * 0.47;

      ctx.drawImage(ann, headX, headY, headWidth, headHeight);

      // Open the mouth for each bite, then close it between slices.
      for (let index = 0; index < 2; index++) {
        const bite = (burnElapsed - 1250 - index * 650) / 550;
        if (bite > -0.25 && bite < 1.15) {
          const opening = Math.min(clamp((bite + 0.25) * 5), clamp((1.15 - bite) * 5));
          if (opening > 0) {
            ctx.beginPath();
            ctx.ellipse(mouthX, mouthY, headWidth * 0.09, headHeight * 0.065 * opening, -0.08, 0, Math.PI * 2);
            ctx.fillStyle = '#35101c';
            ctx.strokeStyle = '#b93b57';
            ctx.lineWidth = Math.max(1, headWidth * 0.012);
            ctx.fill();
            ctx.stroke();
          }
        }

        const travel = ease(clamp(bite));
        if (travel >= 1) continue;
        const startX = left + index * (side + gap) + side / 2;
        const startY = top + side / 2;
        const centerX = startX + (mouthX - startX) * travel;
        const centerY = startY + (mouthY - startY) * travel;
        const width = side * (1 - travel * 0.9);
        const inset = width * 0.19 * toastIn;
        const x = centerX - width / 2;
        const y = centerY - width / 2;

        ctx.save();
        ctx.globalAlpha = toastIn;
        const toastHeight = width * toast.height / toast.width;
        ctx.drawImage(toast, x, centerY - toastHeight / 2, width, toastHeight);
        ctx.restore();
        ctx.drawImage(portraits[index], x + inset, y + inset, width - inset * 2, width - inset * 2);
      }
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

      if (blue) {
        if (!burnStarted) {
          ctx.drawImage(textCanvas, 0, 0);
        } else if (portraitLayout && !burnFinished) {
          drawToastSequence();
        }
        return;
      }

      // Draw every outline before any letter fills so neighboring pieces
      // cannot cast dark seams over letters that have already been drawn.
      const outline = 2 * scale;
      for (const pass of ['outline', 'fill']) {
        for (const piece of pieces) {
        const age = burnStarted ? burnElapsed - piece.burnAt : -Infinity;
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

      if (burnRequested.current) {
        burnRequested.current = false;
        burnElapsed = 0;
        burnFinished = false;
        burnStarted = true;
      }

      if (burnStarted && !burnFinished) {
        burnElapsed += elapsed * (blue ? 0.85 : 1);
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
  }, [size, blue, portraits]);

  return (
    <main className={styles.page}>
      <div className={styles.scene}>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        role="img"
        aria-label={blue ? "Animated blue flames with two portraits on toast and Ann Richards" : "Animated pixel fire"}
        className={styles.canvas}
      >
        Animated Doom-style fire.
      </canvas>
      <button
        className={styles.burnButton}
        type="button"
        disabled={blue ? !portraits || burnState === 'burning' : burnState !== 'ready'}
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
          cursor: burnState === 'ready' || (blue && burnState === 'burned') ? 'pointer' : 'default',
          opacity: burnState === 'ready' || (blue && burnState === 'burned') ? 1 : 0.6,
        }}
      >
        {blue
          ? (imageError ? 'Images unavailable' : 'They’re toast')
          : (burnState === 'ready' ? 'Burn text' : burnState === 'burning' ? 'Burning…' : 'Burned away')}
      </button>
      </div>
    </main>
  );
}
