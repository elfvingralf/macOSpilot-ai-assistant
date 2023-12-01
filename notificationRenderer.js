const { ipcRenderer } = require("electron");

// ipcRenderer.on("add-window-name-to-app", (event, windowName) => {
//   // function addWindowNameToApp(windowName) {
//   //  ipcRenderer.send("select-window", windowName);
//   const analysisContainer = document.getElementById("analysis");

//   // Create a new section for this window
//   const windowSection = document.createElement("div");
//   windowSection.className = "window-section";

//   //   const title = document.createElement("h3");
//   //   title.textContent = `${windowName}`;
//   //   windowSection.appendChild(title);

//   const message = document.createElement("div");
//   message.className = "window-message";
//   windowSection.appendChild(message);

//   // Prepend the new section to the analysis container
//   if (analysisContainer.firstChild) {
//     analysisContainer.insertBefore(windowSection, analysisContainer.firstChild);
//   } else {
//     analysisContainer.appendChild(windowSection);
//   }
//   // }
// });

let lockPosition = false; // Variable to control position locking

document.addEventListener("DOMContentLoaded", () => {
  const lockPositionToggle = document.getElementById("lockPosition");
  console.log("Toggle element:", lockPositionToggle); // Check if the element is correctly identified

  lockPositionToggle.addEventListener("change", () => {
    const isLocked = lockPositionToggle.checked;
    console.log("Toggle changed, isLocked:", isLocked); // Verify the change event

    ipcRenderer.send("lock-position-toggle", isLocked);
  });
});

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

ipcRenderer.on("screenshot-analysis", (event, analysis) => {
  updateWindowMessage(analysis);
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
