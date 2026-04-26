# Operation Red Trophy - Update Guide

This project now has a single source for all round-wise passwords, links, and placeholders.

## Edit Only This File

- src/config/gameContent.js

After changing values, run:

```bash
npm run build
```

## Round-Wise Configuration

### Story Intro

Update in src/config/gameContent.js -> GAME_CONTENT.storyIntro

- clubs: Club names and short codes
- clubLogos.SALUS: Logo URL
- clubLogos.COGNITO: Logo URL
- clubLogos.NEURON: Logo URL
- missionBriefing: Intro text shown in typewriter animation

### Round 1 - Steganography + WiFi

Update in src/config/gameContent.js -> GAME_CONTENT.round1

- steganographyImages.outer: Outer layer image URL
- steganographyImages.inner: Inner layer image URL
- wifiNetworks: SSID list + baseSignal + baseSpeed
- correctNetworkId: Correct SSID id
- correctPassword: Password extracted from hidden clues

### Round 2 - Network + PDF Key Extraction

Update in src/config/gameContent.js -> GAME_CONTENT.round2

- pdfPassword: Password used to open encrypted briefing PDF
- pdfDownloadUrl: PDF path or URL (example: /assets/encrypted_briefing.pdf)
- correctTerminalKey: Key extracted from PDF
- networkScanMessages: Status messages shown during connection simulation

### Round 3 - IPL Terminals + Geo Location

Update in src/config/gameContent.js -> GAME_CONTENT.round3

- questions: All terminal questions and answers
  - id
  - terminal
  - question
  - answer
  - hint
  - explanation
  - coordinateValue
- coordinates.latitude
- coordinates.longitude
- coordinates.locationName
- coordinates.tolerance

## Quick Replace Checklist

- Replace all logo URLs
- Replace steganography image URLs
- Upload encrypted PDF and set pdfDownloadUrl
- Set real round 1 password
- Set real round 2 terminal key
- Update round 3 questions/answers if needed
- Update final coordinates if needed

## Notes

- Round components and utilities now read values from src/config/gameContent.js.
- Do not hardcode passwords/links in component files.
