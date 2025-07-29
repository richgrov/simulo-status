export function createGraph(
  lines: number[][],
  xLabels: string[],
  yMin: number,
  yMax: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;

  const padding = 60;
  const graphWidth = canvas.width - 2 * padding;
  const graphHeight = canvas.height - 2 * padding;
  const pointRadius = 4;

  const lineGradient = ctx.createLinearGradient(
    0,
    padding,
    0,
    canvas.height - padding,
  );
  lineGradient.addColorStop(0, "#aaeeff");
  lineGradient.addColorStop(1, "#00ddff");
  ctx.strokeStyle = lineGradient;

  ctx.strokeStyle = "#777";
  ctx.lineWidth = 0.5;

  const yRange = yMax - yMin;
  const ySteps = 5;
  const yStepValue = yRange / ySteps;

  for (let i = 0; i <= ySteps; i++) {
    const y = canvas.height - padding - (i * graphHeight) / ySteps;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText((yMin + i * yStepValue).toFixed(1), padding - 10, y + 4);
  }

  ctx.textAlign = "center";
  const xStep = graphWidth / (xLabels.length - 1);
  xLabels.forEach((label, i) => {
    const x = padding + i * xStep;
    ctx.fillText(label, x, canvas.height - padding + 20);
  });

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.moveTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  ctx.strokeStyle = "#00ffff";
  ctx.fillStyle = "#00ffff";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const positions = lines.map((data) =>
    data.map((value, i) => {
      const x = padding + i * xStep;
      const y =
        canvas.height - padding - ((value - yMin) / yRange) * graphHeight;
      return { x, y };
    }),
  );

  ctx.strokeStyle = lineGradient;
  ctx.fillStyle = lineGradient;

  for (const line of positions) {
    for (let i = 0; i < line.length; i++) {
      const { x, y } = line[i];
      if (i > 0) {
        const prev = line[i - 1];

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
