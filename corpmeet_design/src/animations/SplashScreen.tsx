import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../theme/ThemeContext";

export interface SplashScreenProps {
  onFinish: () => void;
}

const LETTERS: Record<string, number[][]> = {
  C:[[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  O:[[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  R:[[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,1,0],[1,0,0,0,1]],
  P:[[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0]],
  M:[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  E:[[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,1,1,1,1]],
  T:[[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
};

const WORD = ["C","O","R","P","M","E","E","T"];

interface Dot { x: number; y: number; color: string }

function buildDots(darkColor: string, accentColor: string, gap: number, letterGap: number): Dot[] {
  const colors = [darkColor,darkColor,darkColor,darkColor,accentColor,accentColor,accentColor,accentColor];
  const dots: Dot[] = [];
  let ox = 0;
  for (let w = 0; w < WORD.length; w++) {
    const mat = LETTERS[WORD[w]];
    for (let row = 0; row < mat.length; row++) {
      for (let col = 0; col < mat[row].length; col++) {
        if (mat[row][col]) dots.push({ x: ox + col * gap, y: row * gap, color: colors[w] });
      }
    }
    ox += mat[0].length * gap + letterGap;
  }
  return dots;
}

/**
 * Splash screen with logo wipe + dot-matrix typewriter. Auto-dismisses ~5s.
 * Replace inline SVG paths to rebrand for non-Corpmeet apps.
 */
export function SplashScreen({ onFinish }: SplashScreenProps) {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  const w1Ref = useRef<SVGRectElement>(null);
  const w2Ref = useRef<SVGRectElement>(null);
  const iconRef = useRef<SVGGElement>(null);
  const bgRef = useRef<SVGRectElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const play = useCallback(() => {
    const bg = bgRef.current, iconEl = iconRef.current;
    const w1 = w1Ref.current, w2 = w2Ref.current;
    const canvas = canvasRef.current;
    if (!bg || !iconEl || !w1 || !w2 || !canvas) return;

    const ctx = canvas.getContext("2d")!;
    const dots = buildDots(isDark ? "#f8fafc" : "#1a1a1a", "#4f46e5", 18, 20);
    const dotR = 7;
    const maxX = Math.max(...dots.map(d => d.x)) + dotR * 2;
    const maxY = Math.max(...dots.map(d => d.y)) + dotR * 2;
    canvas.width = Math.ceil(maxX + 20);
    canvas.height = Math.ceil(maxY + 20);

    function drawDots(count: number) {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (let i = 0; i < Math.min(count, dots.length); i++) {
        ctx.beginPath();
        ctx.arc(dots[i].x + 10, dots[i].y + 10, dotR, 0, Math.PI * 2);
        ctx.fillStyle = dots[i].color;
        ctx.fill();
      }
    }

    bg.style.transition = "none"; bg.setAttribute("opacity", "0");
    iconEl.style.transition = "none"; iconEl.style.transform = "scale(1)";
    w1.setAttribute("width", "0"); w1.setAttribute("x", "0");
    w2.setAttribute("width", "0"); w2.setAttribute("x", "184");
    canvas.style.transition = "none"; canvas.style.opacity = "0";
    drawDots(0); bg.getBBox();

    setTimeout(() => { bg.style.transition = "opacity 0.5s ease"; bg.setAttribute("opacity", "1"); }, 100);

    setTimeout(() => {
      const start = performance.now();
      function wipeAnim(now: number) {
        const t = Math.min((now - start) / 1200, 1);
        const e = 1 - Math.pow(1 - t, 3);
        const w = Math.round(184 * e);
        w1!.setAttribute("width", String(w));
        w2!.setAttribute("x", String(184 - w));
        w2!.setAttribute("width", String(w));
        if (t < 1) requestAnimationFrame(wipeAnim);
        else {
          iconEl!.style.transition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
          iconEl!.style.transform = "scale(1.06)";
          setTimeout(() => {
            iconEl!.style.transition = "transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)";
            iconEl!.style.transform = "scale(1)";
          }, 400);
        }
      }
      requestAnimationFrame(wipeAnim);
    }, 450);

    setTimeout(() => {
      canvas.style.transition = "opacity 0.2s ease";
      canvas.style.opacity = "1";
      const start = performance.now();
      function dotAnim(now: number) {
        const t = Math.min((now - start) / 800, 1);
        drawDots(Math.round(t * dots.length));
        if (t < 1) requestAnimationFrame(dotAnim);
      }
      requestAnimationFrame(dotAnim);
    }, 1600);

    setTimeout(() => setFading(true), 4200);
    setTimeout(() => { setVisible(false); onFinishRef.current(); }, 5000);
  }, [isDark]);

  useEffect(() => {
    const t = setTimeout(play, 200);
    return () => clearTimeout(t);
  }, [play]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: isDark ? "#0b0f1a" : "#f1f5f9" }}
        >
          <svg viewBox="-4 -4 192 192" width="220" height="220" style={{ overflow: "visible" }}>
            <defs>
              <clipPath id="splash-clip"><rect x="0" y="0" width="183.477" height="183.476" rx="24" /></clipPath>
              <clipPath id="splash-wipe1"><rect ref={w1Ref} x="0" y="0" width="0" height="184" /></clipPath>
              <clipPath id="splash-wipe2"><rect ref={w2Ref} x="184" y="0" width="0" height="184" /></clipPath>
            </defs>
            <g ref={iconRef} style={{ transformOrigin: "92px 92px" }}>
              <rect ref={bgRef} x="0" y="0" width="183.477" height="183.476" rx="24"
                fill={isDark ? "#1e293b" : "#ffffff"} stroke={isDark ? "#334155" : "#e0e0e0"}
                strokeWidth="1" opacity="0" />
              <g clipPath="url(#splash-clip)">
                <g clipPath="url(#splash-wipe1)">
                  <path d="M183.477 -0.000213652H24.1003C10.8448 -0.000213652 0 10.8442 0 24.1002V29.4577C4.35965 30.1241 9.2007 31.4108 14.4453 33.2707C30.9597 39.1299 51.5212 50.7097 73.5983 66.6973C91.5408 53.3303 108.051 43.7672 121.444 39.0204C134.526 34.3831 144.68 34.3293 150.36 39.7837C156.794 45.9587 156.535 58.3064 150.797 74.4786C144.935 90.9937 133.356 111.555 117.37 133.632C130.738 151.575 140.298 168.087 145.045 181.48C145.286 182.154 145.511 182.818 145.725 183.476H159.377C172.632 183.476 183.477 172.634 183.477 159.378V-0.000213652Z" fill="#4f46e5" />
                </g>
                <g clipPath="url(#splash-wipe2)">
                  <path d="M0 101.189V159.376C0 168.393 5.01728 176.29 12.3973 180.42C18.0218 180.586 24.8281 179.206 32.5683 176.422C48.3471 170.754 67.9784 159.273 89.4463 143.198C89.6156 143.069 89.8609 143.105 89.9921 143.275C90.1104 143.434 90.0894 143.658 89.949 143.793C83.9014 149.56 77.876 155.016 71.9314 160.131C65.8788 165.336 59.906 170.191 54.0732 174.655L54.0705 174.658L50.6656 177.231L50.6641 177.232L50.6599 177.235L50.6572 177.237C47.73 179.421 44.8397 181.502 41.9898 183.475H116.387C121.896 177.132 121.584 165.949 116.392 151.497C110.722 135.719 99.2405 116.088 83.1656 94.6182C83.0359 94.4481 83.071 94.2006 83.2423 94.0716C83.4017 93.9534 83.6256 93.9747 83.7592 94.1147H83.7611C89.5271 100.163 94.9865 106.19 100.101 112.134C105.16 118.017 109.887 123.825 114.25 129.503C121.803 114.774 126.675 101.709 128.415 91.1596C130.095 80.9622 128.849 73.1332 124.268 68.4527C118.097 62.1511 106.564 62.2476 91.463 67.6745C75.6841 73.3441 56.0556 84.8229 34.5862 100.899C34.4156 101.028 34.1715 100.994 34.0391 100.821C33.9217 100.663 33.943 100.438 34.0842 100.305H34.083C40.1287 94.5412 46.1515 89.0841 52.0938 83.9737C57.9766 78.9107 63.7907 74.1829 69.4702 69.8191C54.7411 62.2655 41.6766 57.3913 31.1279 55.6515C20.9285 53.9692 13.1007 55.2151 8.42024 59.7979C2.11631 65.9691 2.21587 77.5024 7.64207 92.6007C13.3097 108.38 24.7911 128.011 40.8664 149.476C40.9965 149.648 40.9587 149.894 40.7867 150.023C40.6299 150.143 40.4056 150.122 40.2706 149.979V149.982C34.5064 143.936 29.052 137.913 23.9397 131.971C18.7325 125.916 13.8754 119.941 9.4105 114.105L9.40821 114.104L6.83453 110.699L6.83148 110.697L6.83034 110.692L6.8269 110.69C4.42679 107.474 2.15065 104.304 0 101.189Z" fill="#4f46e5" />
                </g>
              </g>
            </g>
          </svg>
          <canvas ref={canvasRef} style={{ marginTop: 32, opacity: 0 }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
