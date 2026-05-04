import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "../theme/ThemeContext";

const LETTERS: Record<string, number[][]> = {
  C:[[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  O:[[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  R:[[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,1,0],[1,0,0,0,1]],
  P:[[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0]],
  M:[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  E:[[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,1,1,1,1]],
  T:[[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
};

const DOT_R = 1.8;
const GAP = 4.5;
const LETTER_GAP = 5;

interface Dot {
  homeX: number; homeY: number;
  x: number; y: number;
  vx: number; vy: number;
  color: string;
}

export interface DotMatrixLogoProps {
  /** Word to render. Each letter must exist in the LETTERS map. Default: "CORPMEET". */
  word?: string;
  /** Accent color used for the second half of the word. */
  accentColor?: string;
  height?: number;
}

export function DotMatrixLogo({
  word = "CORPMEET",
  accentColor = "#4f46e5",
  height = 22,
}: DotMatrixLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -999, y: -999, hover: false });
  const rafRef = useRef<number>(0);
  const letters = word.toUpperCase().split("").filter(c => LETTERS[c]);
  const half = Math.ceil(letters.length / 2);

  const buildDots = useCallback(() => {
    const baseColor = isDark ? "#f8fafc" : "#1a1a1a";
    const dots: Dot[] = [];
    let ox = 4;
    for (let w = 0; w < letters.length; w++) {
      const mat = LETTERS[letters[w]];
      const color = w < half ? baseColor : accentColor;
      for (let row = 0; row < mat.length; row++) {
        for (let col = 0; col < mat[row].length; col++) {
          if (mat[row][col]) {
            dots.push({
              homeX: ox + col * GAP, homeY: DOT_R + row * GAP,
              x: ox + col * GAP, y: DOT_R + row * GAP,
              vx: 0, vy: 0,
              color,
            });
          }
        }
      }
      ox += mat[0].length * GAP + LETTER_GAP;
    }
    return dots;
  }, [isDark, letters, half, accentColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dots = buildDots();
    dotsRef.current = dots;

    const maxX = Math.max(...dots.map(d => d.homeX)) + DOT_R + 1;
    const maxY = Math.max(...dots.map(d => d.homeY)) + DOT_R + 1;
    canvas.width = Math.ceil(maxX);
    canvas.height = Math.ceil(maxY);

    function frame() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.homeX, d.homeY, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
      }
    }
    frame();

    return () => cancelAnimationFrame(rafRef.current);
  }, [buildDots]);

  const onMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
    mouseRef.current.hover = true;
  };

  const onLeave = () => {
    mouseRef.current.hover = false;
    mouseRef.current.x = -999;
    mouseRef.current.y = -999;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ height, width: "auto", display: "block", cursor: "pointer" }}
    />
  );
}
