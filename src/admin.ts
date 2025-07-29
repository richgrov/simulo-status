import { createGraph, type LineColor } from "./graph";

const MACHINE_SLOTS = 10;
const MEGABYTE = 1024 * 1024;
const GIGABYTE = 1024 * 1024 * 1024;

async function fetchPrivateData(password: string) {
  try {
    const response = await fetch(process.env.VITE_PRIVATE_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

function addMetric(
  metric: string,
  values: [any, string][],
): HTMLElement | undefined {
  let yValues: number[][] = [];
  let yMin = 0;
  let yMax = 0;
  let colors: LineColor[] = [];
  let labels: string[] = [];

  switch (metric) {
    case "service":
      yValues = [values.map((value) => (value[0] === "active" ? 1 : 0))];
      yMin = 0;
      yMax = 1;
      colors = [
        {
          high: "#aaeeff",
          low: "#00ddff",
        },
      ];
      labels = ["active"];
      break;

    case "cpu_percent":
      if (values.length === 0) {
        return;
      }

      const nCpus = values[0][0].length;
      for (let i = 0; i < nCpus; i++) {
        const cpuValues = values.map((value) => value[0][i]);
        yValues.push(cpuValues);
      }

      yMin = 0;
      yMax = 100;
      colors = Array(nCpus).fill({
        high: "#aaeeff",
        low: "#00ddff",
      });
      for (let i = 0; i < nCpus; i++) {
        labels.push(`CPU ${i}`);
      }
      break;

    case "memory":
      if (values.length === 0) {
        return;
      }

      yValues = [
        values.map((value) => value[0]["used"] / MEGABYTE),
        values.map((value) => value[0]["total"] / MEGABYTE),
        values.map((value) => value[0]["free"] / MEGABYTE),
      ];
      yMin = 0;
      yMax = values[0][0]["total"] / MEGABYTE;
      colors = [
        {
          high: "#ffaaee",
          low: "#ff00dd",
        },
        {
          high: "#aaeeff",
          low: "#00ddff",
        },
        {
          high: "#eeffaa",
          low: "#ffdd00",
        },
      ];
      labels = ["used", "total", "free"];
      break;

    case "disk":
      if (values.length === 0) {
        return;
      }

      yValues = [
        values.map((value) => value[0]["used"] / GIGABYTE),
        values.map((value) => value[0]["total"] / GIGABYTE),
        values.map((value) => value[0]["free"] / GIGABYTE),
      ];
      yMin = 0;
      yMax = values[0][0]["total"] / GIGABYTE;
      colors = [
        {
          high: "#ffaaee",
          low: "#ff00dd",
        },
        {
          high: "#aaeeff",
          low: "#00ddff",
        },
        {
          high: "#eeffaa",
          low: "#ffdd00",
        },
      ];
      labels = ["used", "total", "free"];
      break;
  }

  const xLabels = values.map((value: number[]) => String(value[1]));
  const graph = createGraph(yValues, colors, xLabels, yMin, yMax);

  const section = document.createElement("div");
  section.className = "graph-section";
  section.innerHTML = `
            <div class="legend">
                ${colors
                  .map(
                    (color, i) => `<div class="legend-item">
                        <div style="background: linear-gradient(to right, ${color.high}, ${color.low});"></div>
                        <p>${labels[i]}</p>
                    </div>`,
                  )
                  .join("")}
            </div>
        `;
  section.prepend(graph);

  return section;
}

async function initAdmin() {
  const admin = document.getElementById("admin")!;
  admin.style.display = "block";

  const password = prompt("Enter admin password:");
  if (!password) {
    return;
  }

  admin.innerHTML = `<div class="loading">Loading...</div>`;

  try {
    const response = await fetchPrivateData(password);

    let machines = response
      .map((machine: any) => machine.id)
      .concat(Array(Math.max(0, MACHINE_SLOTS - response.length)).fill("XX"));

    const machineHtml = machines.reduce((acc: string, machine: string) => {
      const real = machine !== "XX";
      return (
        acc +
        `
      <div class="machine ${real ? "" : "disabled"}">
          <h2>B-${machine}</h2>
          <p>${real ? "OK" : "SLOT"}</p>
      </div>
      `
      );
    }, "");

    admin.innerHTML = `
    <div id="machines-scroll">
      <div id="machines">
        ${machineHtml}
      </div>
    </div>
    `;

    for (const machine of response) {
      for (const metric in machine.metrics) {
        const values = machine.metrics[metric] as [any, string][];
        const section = addMetric(metric, values);
        if (section) {
          const header = document.createElement("h2");
          header.textContent = metric;
          admin.appendChild(header);
          admin.appendChild(section);
        }
      }
    }
  } catch (error) {
    console.error("Admin data fetch error:", error);
    admin.innerHTML = `<div class="error">Failed to load admin data: ${error instanceof Error ? error.message : "unknown error"}</div>`;
  }
}

document.getElementById("status-text")!.addEventListener("dblclick", initAdmin);
