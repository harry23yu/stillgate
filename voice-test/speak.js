// Sends one sentence to Cartesia text-to-speech and saves the result as output.wav.
// Run with: npm start   (from inside the voice-test folder)

// This script reads the API key and voice ID from environment variables, 
// sends a sentence to the Cartesia API, and saves the audio output as output.wav.

const fs = require("fs");

const apiKey = process.env.CARTESIA_API_KEY;
const voiceId = process.env.CARTESIA_VOICE_ID;

if (!apiKey || apiKey.includes("PASTE")) {
  console.error("Missing API key. Open voice-test/.env and paste your Cartesia API key.");
  process.exit(1);
}
if (!voiceId || voiceId.includes("PASTE")) {
  console.error("Missing voice ID. Open voice-test/.env and paste your Cartesia voice ID.");
  process.exit(1);
}

const sentence = "Welcome to the airport. Take a slow breath, your gate is just ahead.";

async function main() {
  console.log("Asking Cartesia to speak:", sentence);

  const response = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Cartesia-Version": "2026-08-14",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-3.6",
      transcript: sentence,
      voice: { id: voiceId },
      language: "en",
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 },
    }),
  });

  if (!response.ok) {
    console.error(`Cartesia returned an error (${response.status}):`);
    console.error(await response.text());
    process.exit(1);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync("output.wav", audio);
  console.log("Done! Saved voice-test/output.wav - double-click it to play.");
}

main().catch((err) => {
  console.error("Something went wrong:", err.message);
  process.exit(1);
});
