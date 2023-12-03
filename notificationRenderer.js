const { ipcRenderer } = require("electron");

ipcRenderer.on("add-window-name-to-app", (event, windowName) => {
  updateWindowMessage(`Window Selected: ${windowName}`);
});

ipcRenderer.on("stop-recording", () => {
  // Stop the media recorder
  updateWindowMessage("Processing...");
});

ipcRenderer.on("start-recording", async () => {
  updateWindowMessage("Recording in progress...");
});

ipcRenderer.on("push-vision-response-to-windows", (event, visionResponse) => {
  updateWindowMessage(visionResponse);
});

function updateWindowMessage(message) {
  const analysisContainer = document.getElementById("analysis");

  let messageDiv = analysisContainer.querySelector(".window-message");

  if (!messageDiv) {
    messageDiv = document.createElement("div");
    messageDiv.className = "window-message";
    analysisContainer.appendChild(messageDiv);
  }

  messageDiv.textContent = message;
}
