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
const { exec } = require("child_process");
const activeWin = require("active-win");
const Store = require("electron-store");
const store = new Store();

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);

// // //  SET CONFIGS AND PLACEHOLDER VARIABLES // // //

let openAiApiKey = store.get("userApiKey", "");
let openai = new OpenAI({
  apiKey: openAiApiKey,
});

const keyboardShortcut = "CommandOrControl+Shift+'";

const notificationWidth = 300; // Width of notification window
const notificationHeight = 100; // Height of notification window
const notificationOpacity = 0.8; // Opacity of notification window
const mainWindowWidth = 600; // Width of main window
const mainWindowHeight = 400; // Height of main window

let isRecording = false;
let mainWindow;
let notificationWindow;

let conversationHistory = [
  {
    role: "system",
    content:
      "You are helping users with questions about their OSX applications based on screenshots, always answer in at most one sentence.",
  },
];

// // // // // // // // // // // // // // // // // // // // //

// Create main Electron window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: mainWindowWidth,
    height: mainWindowHeight,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile("index.html");
}

// Create "always on top" Electron notification window
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
  notificationWindow.setOpacity(notificationOpacity);
  notificationWindow.loadFile("notifications.html");
}

// Function to re-position "always on top" notification window when a new active window is used
function repositionNotificationWindow(selectedWindow) {
  // Calculate top-right position which is what's currently used
  const topRightX =
    selectedWindow.bounds.x + selectedWindow.bounds.width - notificationWidth;
  const topRightY = selectedWindow.bounds.y;

  // Ensure the window is not positioned off-screen
  const safeX = Math.max(topRightX, 0);
  const safeY = Math.max(topRightY, 0);

  // Set the position of the notification window
  // Currently set to 15px in form the right-hand corner of the active window
  if (notificationWindow) {
    notificationWindow.setPosition(safeX - 15, safeY + 15);
  }
}

// Manage API key storage/access
ipcMain.on("submit-api-key", (event, apiKey) => {
  store.set("userApiKey", apiKey); // Directly saving the API key using electron-store
});

// Function to mask the API key except for the last 4 characters
function maskApiKey(apiKey) {
  if (apiKey.length <= 4) {
    return apiKey; // If the key is too short, just return it
  }
  return "*".repeat(apiKey.length - 4) + apiKey.slice(-4);
}

// Handle request for API key
ipcMain.on("request-api-key", (event) => {
  const apiKey = store.get("userApiKey", ""); // Get the API key
  const maskedApiKey = maskApiKey(apiKey); // Get the masked version
  event.reply("send-api-key", maskedApiKey); // Send the masked key
});

// fetch the key to send to backend logic
ipcMain.handle("get-api-key", (event) => {
  return store.get("userApiKey", "");
});

// Recorded audio gets passed to this function when the microphone recording has stopped
ipcMain.on("audio-buffer", (event, buffer) => {
  const audioDir = path.join(app.getPath("userData"), "audio");
  // use the option below to debug and store files to /audio/ in your node project when running from the terminal
  // const audioDir = path.join(__dirname, "audio");

  // Calling this in case the user added
  openAiApiKey = store.get("userApiKey", "");
  openai = new OpenAI({
    apiKey: openAiApiKey,
  });

  // Ensure the 'audio' directory exists
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const tempFilePath = path.join(audioDir, "temp_audio.raw");
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
          fs.unlink(tempFilePath, (err) => {
            if (err) console.error("Failed to delete temporary file:", err);
          });
          // Send user audio recording to OpenAI Whisper API for transcription
          const audioInput = await transcribeUserRecording(mp3FilePath);
          const screenshotsDir = path.join(
            app.getPath("userData"),
            "screenshots"
          );
          // Use the option below to debug and store files to /audio/ in your node project when running from the terminal
          // const screenshotsDir = path.join(__dirname, "screenshots");

          const filePath = path.join(screenshotsDir, "screenshot.png");

          // Call Vision API with screenshot and transcription of question
          const visionApiResponse = await callVisionAPI(filePath, audioInput);

          // Update both windows with the
          mainWindow.webContents.send(
            "push-vision-response-to-windows",
            visionApiResponse
          );
          notificationWindow.webContents.send(
            "push-vision-response-to-windows",
            visionApiResponse
          );
          await playVisionApiResponse(visionApiResponse);
        })
        .save(mp3FilePath);
    } catch (error) {
      console.log(error);
    }
  });
});

async function playVisionApiResponse(inputText) {
  const url = "https://api.openai.com/v1/audio/speech";
  const voice = "echo"; // you can change voice if you want
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
          // console.log("Audio playback started");
        }
      });
    });
  } catch (error) {
    if (error.response) {
      console.error(
        `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error(`Error in streamedAudio: ${error.message}`);
    }
  }
}

async function transcribeUserRecording(mp3FilePath) {
  try {
    const form = await new FormData();

    form.append("file", fs.createReadStream(mp3FilePath));
    form.append("model", "whisper-1");
    form.append("response_format", "text");
    // form.append("prompt", "add", "words", "it", "usually", "gets", "wrong"); // Append correction words if needed
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
}

async function callVisionAPI(inputScreenshot, audioInput) {
  const base64Image = fs.readFileSync(inputScreenshot).toString("base64");
  const dataUrl = `data:image/png;base64,${base64Image}`;
  const userMessage = {
    role: "user",
    content: [
      { type: "text", text: audioInput },
      {
        type: "image_url",
        image_url: {
          url: dataUrl,
        },
        // OPTION TO RESIZE
        //   {
        //     image: base64Image,
        //     resize: 1024, // Can be changed, smaller = less quality
        //   },
      },
    ],
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

    conversationHistory.push({
      role: "assistant",
      content: responseContent,
    });

    return responseContent;
  } catch (error) {
    console.log(error);
  }
}

async function captureWindow(windowName) {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  // Could be updated to use ids
  const selectedSource = sources.find((source) => source.name === windowName);

  if (!selectedSource) {
    console.error("Window not found:", windowName);
    return;
  }

  // Capture the thumbnail of the window and define the screenshots directory path
  const screenshot = selectedSource.thumbnail.toPNG();
  const screenshotsDir = path.join(app.getPath("userData"), "screenshots");

  // use the option below to debug and store files to /audio/ in your node project when running from the terminal
  // const screenshotsDir = path.join(__dirname, "screenshots");

  // Check if the directory exists, if not, create it
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Save the screenshot to file, note that it is continiously overwritten with every new question
  const filePath = path.join(screenshotsDir, "screenshot.png");
  fs.writeFile(filePath, screenshot, async (err) => {
    if (err) {
      throw err;
    }
  });
}
async function checkMicrophoneAccess() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    // Access granted
    return true;
  } catch (error) {
    // Access denied or not available
    return false;
  }
}
// Run when Electron app is ready
app.whenReady().then(() => {
  createMainWindow();
  createNotificationWindow();

  // If defined keyboard shortcut is triggered then run
  globalShortcut.register(keyboardShortcut, async () => {
    // If the microphone recording isn't already running
    if (!isRecording) {
      try {
        const activeWindow = await activeWin();
        captureWindow(activeWindow.title);
        repositionNotificationWindow(activeWindow);
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
      // console.log("Started recording"); // for debugging
    } else {
      // If we're already recording, the keyboard shortcut means we should stop
      mainWindow.webContents.send("stop-recording");
      notificationWindow.webContents.send("stop-recording");
      isRecording = false;
      // console.log("Stopped recording"); // for debugging
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

ipcMain.on("update-analysis-content", (event, content) => {
  // Forward the content to the notification window
  if (notificationWindow) {
    notificationWindow.webContents.send("update-analysis-content", content);
  }
});
