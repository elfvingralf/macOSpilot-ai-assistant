const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut,
} = require("electron");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const { Blob } = require("buffer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const FormData = require("form-data");
// const Speaker = require("speaker");
const { exec } = require("child_process");
const activeWin = require("active-win");

ffmpeg.setFfmpegPath(ffmpegStatic);

let mainWindow;
let notificationWindow;

dotenv.config();
const openAiApiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: openAiApiKey,
});
// Function to create the main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load your window selection HTML page
  mainWindow.loadFile("index.html");

  // Open the DevTools for debugging (optional)
  // mainWindow.webContents.openDevTools();
}

const notificationWidth = 300; // Width of your notification window
const notificationHeight = 100; // Height of your notification window
let isPositionLocked = false;

function createNotificationWindow() {
  notificationWindow = new BrowserWindow({
    width: notificationWidth,
    height: notificationHeight,
    frame: false,
    transparent: true, // Enable transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    alwaysOnTop: true,
    skipTaskbar: true,
    x: 100,
    y: 100,
  });
  notificationWindow.setOpacity(0.8);

  notificationWindow.loadFile("notifications.html"); // Load your custom HTML content
}

// app.whenReady().then(createNotificationWindow);

let conversationHistory = [
  {
    role: "system",
    content:
      "You are helping users with questions about their OSX applications based on screenshots, always answer in at most one sentence.",
  },
];

function positionNotificationAtTopRight(selectedWindow) {
  if (isPositionLocked) {
    return; // Do not reposition if locked
  }
  const notificationWidth = 300; // Width of your notification window
  const notificationHeight = 100; // Height of your notification window

  // Calculate top-right position
  const topRightX =
    selectedWindow.bounds.x + selectedWindow.bounds.width - notificationWidth;
  const topRightY = selectedWindow.bounds.y;

  // Ensure the window is not positioned off-screen
  const safeX = Math.max(topRightX, 0);
  const safeY = Math.max(topRightY, 0);

  // Set the position of the notification window
  if (notificationWindow) {
    notificationWindow.setPosition(safeX - 15, safeY + 15);
  }
}

ipcMain.on("audio-buffer", (event, buffer) => {
  const audioDir = path.join(__dirname, "audio");

  // Ensure the 'audio' directory exists
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const tempFilePath = path.join(audioDir, "temp_audio.raw"); // Temporary file
  const mp3FilePath = path.join(audioDir, "recording.mp3");

  // Save buffer to the temporary file
  fs.writeFile(tempFilePath, buffer, (err) => {
    if (err) {
      console.error("Failed to save temporary audio file:", err);
      return;
    }

    // Convert the temporary file to MP3
    try {
      ffmpeg(tempFilePath)
        .setFfmpegPath(ffmpegStatic)
        .audioBitrate(32)
        .toFormat("mp3")
        .on("error", (err) => {
          console.error("Error converting to MP3:", err);
        })
        .on("end", async () => {
          console.log("Conversion to MP3 finished:", mp3FilePath);

          // Optionally, delete the temporary file after conversion
          fs.unlink(tempFilePath, (err) => {
            if (err) console.error("Failed to delete temporary file:", err);
          });
          console.log("Inside the end");
          // Call the function to send the audio file to OpenAI
          const audioInput = await sendAudioToOpenAI(mp3FilePath);

          const screenshotsDir = path.join(__dirname, "screenshots");
          const filePath = path.join(screenshotsDir, "screenshot.png");
          const screenshotAnalysis = await processScreenshot(
            filePath,
            audioInput
          );
          mainWindow.webContents.send(
            "screenshot-analysis",
            screenshotAnalysis
          );
          notificationWindow.webContents.send(
            "screenshot-analysis",
            screenshotAnalysis
          );
          const testing = await playScreenshotAnalysisResponse(
            screenshotAnalysis
          );
        })
        .save(mp3FilePath);
    } catch (error) {
      console.log(error);
    }
  });
});

async function playScreenshotAnalysisResponse(inputText) {
  const url = "https://api.openai.com/v1/audio/speech";
  const voice = "echo";
  const model = "tts-1";
  const headers = {
    Authorization: `Bearer ${openAiApiKey}`, // API key for authentication
  };

  const data = {
    model: model,
    input: inputText,
    voice: voice,
    response_format: "mp3",
  };

  try {
    // Make a POST request to the OpenAI audio API
    const response = await axios.post(url, data, {
      headers: headers,
      responseType: "stream",
    });

    const audioFilePath = path.join(__dirname, "audio", "output.mp3");

    // Save the response stream to a file
    const writer = fs.createWriteStream(audioFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    }).then(() => {
      // Play the audio file using a system command
      let playCommand;

      switch (process.platform) {
        case "darwin": // macOS
          playCommand = `afplay ${audioFilePath}`;
          break;
        case "win32": // Windows
          playCommand = `start ${audioFilePath}`;
          break;
        case "linux": // Linux (requires aplay or mpg123 or similar to be installed)
          playCommand = `aplay ${audioFilePath}`; // or mpg123, etc.
          break;
        default:
          console.error("Unsupported platform for audio playback");
          return;
      }

      exec(playCommand, (error) => {
        if (error) {
          console.error("Failed to play audio:", error);
        } else {
          console.log("Audio playback started");
        }
      });
    });
  } catch (error) {
    // Handle errors from the API or the audio processing
    if (error.response) {
      console.error(
        `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error(`Error in streamedAudio: ${error.message}`);
    }
  }
}

async function sendAudioToOpenAI(mp3FilePath) {
  console.log("Trying to transcribe");
  // let response;
  try {
    const form = await new FormData();
    // form.append("file", fs.createReadStream("./outputTest.mp3"));
    form.append("file", fs.createReadStream(mp3FilePath));
    form.append("model", "whisper-1");
    // form.append("response_format", "srt"); // Ensure response is in SRT format
    form.append("response_format", "text"); // Ensure response is in text format
    form.append("prompt", "testing"); // Fix broken words
    response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${openAiApiKey}`,
        },
      }
    );
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return null;
  }

  return response.data;
}

async function processScreenshot(inputScreenshot, audioInput) {
  const base64Image = fs.readFileSync(inputScreenshot).toString("base64");
  const dataUrl = `data:image/png;base64,${base64Image}`; // Assuming the image is a JPEG
  const userMessage = {
    role: "user",
    content: [
      { type: "text", text: audioInput },
      {
        type: "image_url",
        image_url: {
          url: dataUrl,
        },
      },
    ],
    // content: [
    //   { type: "text", text: audioInput },
    //   {
    //     image: base64Image,
    //     resize: 1024, // Include the resize parameter here
    //   },
    // ],
  };

  conversationHistory.push(userMessage);

  const params = {
    max_tokens: 850,
    model: "gpt-4-vision-preview",
    messages: conversationHistory,
  };

  try {
    const response = await openai.chat.completions.create({
      max_tokens: 850,
      model: "gpt-4-vision-preview",
      messages: conversationHistory,
    });

    const responseContent = response.choices[0].message.content;
    // console.log(responseContent);

    conversationHistory.push({
      role: "assistant",
      content: responseContent,
    });
    // responseContent =
    //   "You have four images in this folder. If you want me to help you with something, let me know.";
    return responseContent;
  } catch (error) {
    console.log(error);
  }
}

function handleShortcut() {
  console.log("Shortcut pressed!");
}

// Function to get the list of window sources
async function getWindows() {
  const inputSources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 200, height: 200 },
  });

  return inputSources;
}

async function captureWindow(windowName) {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  const selectedSource = sources.find((source) => source.name === windowName);

  if (!selectedSource) {
    console.error("Window not found:", windowName);
    return;
  }

  // Capture the thumbnail of the window
  const screenshot = selectedSource.thumbnail.toPNG();

  // Define the screenshots directory path
  const screenshotsDir = path.join(__dirname, "screenshots");

  // Check if the directory exists, if not, create it
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  // Save the screenshot to a file (you can change the directory and file name as needed)
  const filePath = path.join(screenshotsDir, "screenshot.png");
  fs.writeFile(filePath, screenshot, async (err) => {
    if (err) {
      throw err;
    }
    console.log("Screenshot saved to", filePath);
  });
}
let isRecording = false;
// Electron app ready
app.whenReady().then(() => {
  createMainWindow();
  createNotificationWindow();

  // globalShortcut.register("CommandOrControl+Shift+X", () => {
  //   if (!isRecording) {
  //     mainWindow.webContents.send("start-recording");
  //     isRecording = true;
  //     console.log("Started recording");
  //   } else {
  //     mainWindow.webContents.send("stop-recording");
  //     isRecording = false;
  //     console.log("Stopped recording");
  //   }
  // });

  globalShortcut.register("CommandOrControl+Shift+P", async () => {
    if (!isRecording) {
      try {
        const activeWindow = await activeWin();
        captureWindow(activeWindow.title);
        positionNotificationAtTopRight(activeWindow);
        const windowOwner = activeWindow.owner.name;
        mainWindow.webContents.send(
          "add-window-name-to-app",
          `${windowOwner}: ${activeWindow.title}`
        );
        notificationWindow.webContents.send(
          "add-window-name-to-app",
          `${windowOwner}: ${activeWindow.title}`
        );
      } catch (error) {
        console.error("Error capturing the active window:", error);
      }
      mainWindow.webContents.send("start-recording");
      notificationWindow.webContents.send("start-recording");
      isRecording = true;
      console.log("Started recording");
    } else {
      mainWindow.webContents.send("stop-recording");
      notificationWindow.webContents.send("stop-recording");
      isRecording = false;
      console.log("Stopped recording");
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister all shortcuts when the application is about to quit
  globalShortcut.unregisterAll();
});

// IPC listener for window selection
ipcMain.on("select-window", (event, windowName) => {
  captureWindow(windowName);
});

// IPC listener to request the list of windows
ipcMain.handle("get-windows", async () => {
  return await getWindows();
});

// Prevent Electron from quitting when the main window is closed
// mainWindow.on("closed", () => {
//   mainWindow = null;
// });

ipcMain.on("update-analysis-content", (event, content) => {
  // Forward the content to the notification window
  if (notificationWindow) {
    notificationWindow.webContents.send("update-analysis-content", content);
  }
});

ipcMain.on("lock-position-toggle", (event, isLocked) => {
  isPositionLocked = isLocked;
});
