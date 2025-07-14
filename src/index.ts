import './App.css';
import './index.css';

const statusText = document.getElementById("status-text")!;
const statusTime = document.getElementById("status-time")!;

try {
    const response = await fetch(import.meta.env.VITE_BACKEND_URL);
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