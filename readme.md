# macOSpilot: your personal macOS AI assistant

macOSpilot answers your questions about anything, in any application. No need to reach for another window. Simply use a keyboard shortcut to trigger the assistant, speak or type your question, and it will give the answer in context and in audio within seconds. Behind the scenes macOSpilot takes a screenshot of your active window when triggered, and sends it to OpenAI GPT Vision along with a transcript of your question. It's answer will be displayed in text, and converted into audio using OpenAI TTS (text to speech).

https://github.com/elfvingralf/macOSpilot-ai-assistant/assets/94417497/5a9e9288-0479-4def-9a87-451dddd783af

- **Works with any application in macOS:** macOSpilot is application agnostic, and simply takes a screenshot of the currently active window when you trigger the assistant.
- **Trigger with keyboard shortcut, speak your question:** No need to juggle windows, just press the keyboard shortcut and speak your question. If you prefer to type it, that's possible too.
- **Answers in-context and in audio:** The answer to your question is provided in an small window overlayed on top of your active window, and in audio (using text-to-speech).

## How it works

1. macOSpilot runs NodeJS/Electron. Simply install the NodeJS project and dependencies (see below) and make the necessary configurations in `index.js`. Then chose to run `yarn start` from the terminal, or package it with Electron with the instructions below, add your OpenAI API key and let the application run in the background.
2. When you need to use macOSpilot, press the keyboard shortcut you've configured (default is Command+Shift+'). macOSpilot will take a screenshot of your currently active macOS application window and activate the microphone.
3. Speak your question into your microphone and then press the same keyboard shortcut to end the microphone recording. If you've enabled text input, you'll get to type your question and press enter instead of speaking.
4. macOSpilot will send your question to OpenAI's Whisper API, and the transcription will be sent to OpenAI's Vision API along with the screenshot.
5. The Vision API response will be displayed in a small notification window on top of your active macOS application window, and read outloud once it's been processed by OpenAI's TTS (text to speech) API.
6. A simple history of answers to your questions in the current session is available in another window that you can hide/minimize.

The most recent screenshot, audio recording, and TTS response will be stored on your machine in part for debugging purposes. The same filename is used every time so they will be overwritten, but are not automatically deleted when you close or delete the application.

## Getting Started

### Video walk-through

Prefer a video? Head on over to YouTube to watch the walk through of how to get started, how the application works, and a brief explanation of how it works under the hood.

[![YouTube walk-through and tutorial](https://github.com/elfvingralf/macOSpilot-ai-assistant/assets/94417497/e96e314f-6778-42e5-8a9b-04ce9e6fc0b9)](https://www.youtube.com/watch?v=1IdCWqTZLyA)

### Install

Make sure you have NodeJS installed on your machine. Then clone the repo and follow the steps below.

```bash

git  clone  https://github.com/elfvingralf/macOSpilot-ai-assistant.git

```

Navigate to the folder and run `yarn install` or `npm install` in your folder. This should install all dependencies.

Run `yarn start` or `npm start`. Because the application needs access to read your screen, microphone, read/write files etc, you will need to go through the steps of granting it access and possibly restarting your terminal.

### Configurations

Make sure to add your OpenAI API key by clicking the settings icon in the top right-hand corner of the main window. (it's not stored encrypted!)

If you want to change the default values here's a few things that might be worth changing, all in `index.js`:

- **Keyboard shortcut:** The default keyboard shortcut `keyboardShortcut` is set to "CommandOrControl+Shift+'" (because it seemed like it was rarely used by other applications)

- **OpenAI Vision prompt:** The OpenAI Vision API system prompt in `conversationHistory`, currently just set to "You are helping users with questions about their macOS applications based on screenshots, always answer in at most one sentence."

- **VisionAPI image size:** Image resize params to save some money, I left an example of how in `callVisionAPI()` (I found that I had much poorer results when using it)

- **Application window sizes and settings:** The size of the main window: `mainWindowWidth` and `mainWindowHeight`. The size of the notification window, which always remains on top: `notificationWidth` and `notificationHeight`.

- **More notification window settings:** The level of opacity of the notification window: `notificationOpacity`. Where the notification window moves to on activation, relative to the active window: inside `positionNotificationAtTopRight()` (terrible naming, I know)

### Turn it into an .app with Electron

Want to create an .app executable instead of running this from your terminal?

First go to `index.js` and change `const useElectronPackager` from `false` to `true`.

Run one of these in your terminal, depending on which platform you're on.

```bash
npm  run  package-mac
npm  run  package-win
npm  run  package-linux
```

Note I have only tested this on Mac (Apple silicon and Intel).

Go to `/release-builds/` in your project folder, and chose the folder of your platform. In there is an executable, `.app` if you're on Mac. Double-click it to open the app, note that it may take a few seconds the first time so be patient.

Once the app is opened, trigger your keyboard shortcut. You'll be asked to grant Privacy & Security permissions. You may need to repeat this another one or two times for all permissions to work properly, and to restart the app.

## Improvements:

Some improvements I'd like to make, in no particular order:

- Enable optional conversation state inbetween sessions (open/close application)
- Use buffers instead of writing/reading screenshot and audio files to disk
- Make assistant audio configurable in UI (e.g. speed, make playback optional)
- Make always-on-top window configurable in UI (e.g. toggle sticky position, enable/disable)
- Make screenshot settings configurable in UI (e.g. select area, entire screen)
- ~Fix microphone issue not working as .app~ Fixed thanks to [@claar](https://www.github.com/claar).
- ~Enable text-based input instead of voice~

## About / contact

I'm a self-taught and really like scrapping together fun projects. I write functional code that probably isn't beautiful nor efficient, and share it with the hope that someone else might find it useful.

You can find me as [@ralfelfving](https://twitter.com/ralfelfving) on Twitter/X. If you liked this project, consider checking my tutorials on my YouTube channel [@ralfelfving](https://www.youtube.com/@ralfelfving).
