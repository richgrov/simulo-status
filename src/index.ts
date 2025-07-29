import "./index.css";
import "./admin";

const statusText = document.getElementById("status-text")!;
const statusTime = document.getElementById("status-time")!;
const circle = document.getElementById("circle")!;
const checkIcon = document.getElementById("check-icon")!;
const warningIcon = document.getElementById("warning-icon")!;
const xIcon = document.getElementById("x-icon")!;

try {
  const response = await fetch(process.env.VITE_BACKEND_URL);
  const data = await response.json();

  if (data.status === "ok") {
    statusText.textContent = "ONLINE";
    circle.style.backgroundColor = "#2ecc71";
    checkIcon.style.display = "block";
  } else {
    statusText.textContent = "SERVICE DEGRADATION";
    circle.style.backgroundColor = "#FF6900";
    warningIcon.style.display = "block";
  }

  if (data.since) {
    statusTime.textContent = `As of ${data.since}`;
  }
} catch (error) {
  console.error(error);
  statusText.textContent = "SERVICE ERROR";
  circle.style.backgroundColor = "#fa2c37";
  xIcon.style.display = "block";
}
