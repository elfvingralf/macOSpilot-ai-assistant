const { ipcRenderer } = require("electron");

ipcRenderer.on("add-window-name-to-app", (event, windowName) => {
  updateWindowMessage(`Window Selected: ${windowName}`);
});

ipcRenderer.on("stop-recording", () => {
  // Stop the media recorder
  updateWindowMessage("Processing...");
});

ipcRenderer.on("push-question-to-windows", (event, questionText) => {
  updateWindowMessage(`${questionText} ... thinking...`);
});

ipcRenderer.on("start-recording", async () => {
  updateWindowMessage("Recording in progress...");
});

ipcRenderer.on("update-notificationWindow-text", (event, textInput) => {
  updateWindowMessage(textInput);
});

document.getElementById("closeBtn").addEventListener("click", () => {
  ipcRenderer.send("close-notification-window");
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
