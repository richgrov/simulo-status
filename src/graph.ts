const WIDTH = 600;
const HEIGHT = 400;
const WIDTH_PX = WIDTH * window.devicePixelRatio;
const HEIGHT_PX = HEIGHT * window.devicePixelRatio;
const GRAPH_X_PADDING = 60 * window.devicePixelRatio;
const LABEL_PADDING = 10 * window.devicePixelRatio;
const GRAPH_HEIGHT = HEIGHT_PX * 0.6;
const Y_STEPS = 5;

export interface LineColor {
  high: string;
  low: string;
}

function normalizeFontSize(size: number, style: string) {
  return `${size * window.devicePixelRatio}px ${style}`;
}

function drawPrimaryAxis(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(GRAPH_X_PADDING, 0);
  ctx.lineTo(GRAPH_X_PADDING, GRAPH_HEIGHT);
  ctx.lineTo(WIDTH_PX - GRAPH_X_PADDING, GRAPH_HEIGHT);
  ctx.stroke();
}

function drawYLabelsAndLines(
  ctx: CanvasRenderingContext2D,
  yMin: number,
  yStep: number,
) {
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 0.5;

  ctx.font = normalizeFontSize(14, "Arial");
  ctx.fillStyle = "white";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";

  for (let i = 0; i <= Y_STEPS; i++) {
    const y = GRAPH_HEIGHT - i * (GRAPH_HEIGHT / Y_STEPS);
    ctx.beginPath();
    ctx.moveTo(GRAPH_X_PADDING, y);
    ctx.lineTo(WIDTH_PX - GRAPH_X_PADDING, y);
    ctx.stroke();

    ctx.fillText(
      (yMin + i * yStep).toFixed(1),
      GRAPH_X_PADDING - LABEL_PADDING,
      y + 4,
    );
  }
}

function drawXLabels(
  ctx: CanvasRenderingContext2D,
  xLabels: string[],
  step: number,
) {
  ctx.font = normalizeFontSize(14, "Arial");
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  xLabels.forEach((label, i) => {
    if (i % 4 !== 0) {
      return;
    }

    const x = GRAPH_X_PADDING + i * step;
    ctx.save();
    ctx.translate(x, GRAPH_HEIGHT + LABEL_PADDING);
    ctx.rotate(Math.PI / 3);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

export function createGraph(
  lines: number[][],
  colors: LineColor[],
  xLabels: string[],
  yMin: number,
  yMax: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH_PX;
  canvas.height = HEIGHT_PX;
  canvas.style.width = `${WIDTH}px`;
  canvas.style.height = `${HEIGHT}px`;
  const ctx = canvas.getContext("2d")!;

  const xStep = (WIDTH_PX - 2 * GRAPH_X_PADDING) / (xLabels.length - 1);
  const yRange = yMax - yMin;
  const yStep = yRange / Y_STEPS;

  drawPrimaryAxis(ctx);
  drawYLabelsAndLines(ctx, yMin, yStep);
  drawXLabels(ctx, xLabels, xStep);

  const positions = lines.map((line) =>
    line.map((value, i) => ({
      x: GRAPH_X_PADDING + i * xStep,
      y: GRAPH_HEIGHT - ((value - yMin) / yRange) * GRAPH_HEIGHT + 1,
    })),
  );

  ctx.lineWidth = 2;

  for (let i = 0; i < lines.length; i++) {
    const data = positions[i];
    const highColor = colors[i].high;
    const lowColor = colors[i].low;

    const lineGradient = ctx.createLinearGradient(0, 0, 0, GRAPH_HEIGHT);
    lineGradient.addColorStop(0, highColor);
    lineGradient.addColorStop(1, lowColor);
    ctx.strokeStyle = lineGradient;

    for (let i = 0; i < data.length; i++) {
      const { x, y } = data[i];
      if (i > 0) {
        const prev = data[i - 1];

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  }

  ctx.stroke();

  return canvas;
}
