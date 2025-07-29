import "./index.css";
import { createGraph } from "./graph";

const statusText = document.getElementById("status-text")!;
const statusTime = document.getElementById("status-time")!;

try {
  const response = await fetch(process.env.VITE_BACKEND_URL);
  const data = await response.json();

  if (data.status === "ok") {
    statusText.textContent = "ONLINE";
  } else {
    statusText.textContent = "SERVICE DEGRADATION";
  }

  if (data.since) {
    statusTime.textContent = `As of ${data.since}`;
  }
} catch (error) {
  console.error(error);
  statusText.textContent = "SERVICE ERROR";
}

const MACHINE_SLOTS = 10;

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
        let yValues: number[][] = [];
        let yMin = 0;
        let yMax = 0;
        switch (metric) {
          case "service":
            yValues = [values.map((value) => (value[0] === "active" ? 1 : 0))];
            yMin = 0;
            yMax = 1;
            break;

          case "cpu_percent":
            if (values.length === 0) {
              continue;
            }

            const nCpus = values[0][0].length;
            for (let i = 0; i < nCpus; i++) {
              const cpuValues = values.map((value) => value[0][i]);
              yValues.push(cpuValues);
            }

            yMin = 0;
            yMax = 100;
            break;

          case "memory":
            if (values.length === 0) {
              continue;
            }

            yValues = [
              values.map((value) => value[0]["used"]),
              values.map((value) => value[0]["total"]),
              values.map((value) => value[0]["free"]),
            ];
            yMin = 0;
            yMax = values[0][0]["total"];
            break;

          case "disk":
            if (values.length === 0) {
              continue;
            }

            yValues = [
              values.map((value) => value[0]["used"]),
              values.map((value) => value[0]["total"]),
              values.map((value) => value[0]["free"]),
            ];
            yMin = 0;
            yMax = values[0][0]["total"];
            break;
        }

        const xLabels = values.map((value: number[]) => String(value[1]));
        const graph = createGraph(yValues, xLabels, yMin, yMax);
        admin.appendChild(graph);
      }
    }
  } catch (error) {
    console.error("Admin data fetch error:", error);
    admin.innerHTML = `<div class="error">Failed to load admin data: ${error instanceof Error ? error.message : "unknown error"}</div>`;
  }
}

statusText.addEventListener("dblclick", initAdmin);
