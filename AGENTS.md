# Project Instructions

## Project
This is a smartphone-first PWA for recording bowling practice and generating prompts for ChatGPT coaching.

## User
The target user is one non-technical person who mainly uses a smartphone.

## Constraints
- No server
- No login
- No OpenAI API
- No paid external APIs
- Data must be stored locally on the device
- Must work well on smartphone portrait screens
- UI must be simple, large, and easy to understand
- Prefer buttons and selections over free text
- Always preserve manual input as a fallback

## Tech
- HTML
- CSS
- JavaScript
- PWA
- localStorage or IndexedDB
- Tesseract.js for OCR when needed

## Design Principles
- Japanese UI
- Large buttons
- Clear labels
- Minimal screens
- Avoid technical jargon
- Always confirm OCR results before saving
- Never overwrite existing data without confirmation

## Development Order
1. Manual practice record PWA
2. History and AI prompt generation
3. Analysis dashboard
4. Backup and restore
5. Score sheet OCR
6. OCR accuracy improvements
7. UI polish
