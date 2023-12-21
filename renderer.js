const { ipcRenderer } = require("electron");

let mediaRecorder; // Define mediaRecorder in a broader scope
let audioChunks = []; // Define audioChunks in a broader scope

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

ipcRenderer.on("push-vision-response-to-windows", (event, visionResponse) => {
  // Get the analysis container
  const analysisContainer = document.getElementById("analysis");
  updateWindowMessage(visionResponse);
});

ipcRenderer.on("push-question-to-windows", (event, questionText) => {
  updateWindowMessage(`${questionText} ... thinking...`);
});

// This triggers a 500 ms audio/microphone recording as soon as the app loads. It's a work-around to address an issue seen on some machines where the first audio recording doesn't work.
ipcRenderer.on("init-mediaRecorder", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  sleep(1);
  mediaRecorder.stop();
});

ipcRenderer.on("start-recording", async () => {
  try {
    updateWindowMessage("Recording in progress...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream); // Use the broader scoped mediaRecorder
    audioChunks = []; // Reset audioChunks for a new recording

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Convert ArrayBuffer to Buffer
      const buffer = Buffer.from(arrayBuffer);

      // Send the buffer to the main process
      ipcRenderer.send("audio-buffer", buffer);
    });

    mediaRecorder.start();
  } catch (error) {
    console.error("Error accessing the microphone", error);
    updateWindowMessage("Failed to record microphone...");
  }
});

ipcRenderer.on("stop-recording", () => {
  // Stop the media recorder
  updateWindowMessage("Processing...");

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
});

ipcRenderer.on("add-window-name-to-app", (event, windowName) => {
  const analysisContainer = document.getElementById("analysis");

  // Create a new section for this window
  const windowSection = document.createElement("div");
  windowSection.className = "window-section";

  const title = document.createElement("h3");
  title.textContent = `${windowName}`;
  windowSection.appendChild(title);

  const message = document.createElement("div");
  message.className = "window-message";
  windowSection.appendChild(message);

  // Prepend the new section to the analysis container
  if (analysisContainer.firstChild) {
    analysisContainer.insertBefore(windowSection, analysisContainer.firstChild);
  } else {
    analysisContainer.appendChild(windowSection);
  }
  // }
});

function updateWindowMessage(message) {
  const latestWindowSection = document.querySelector(".window-section");
  if (latestWindowSection) {
    const messageDiv = latestWindowSection.querySelector(".window-message");
    if (messageDiv) {
      messageDiv.textContent = message;
    }
  }
}
