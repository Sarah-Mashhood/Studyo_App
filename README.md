 # Studyo

 Upload, understand, and prove you've learned it.

 Studyo is a privacy-focused interactive study companion that helps you absorb and master dense materials. Upload text files or PDFs, chat with the content with automatic source citations, and verify your understanding using the Teach-back active-recall evaluation framework.

 ## Table of contents

 - [Features](#features)
 - [Technical stack](#technical-stack)
 - [Design system](#design-system)
 - [Getting started](#getting-started)
 - [Deployment](#deployment)
 - [Security & privacy](#security--privacy)
 - [License](#license)

 ## Features

 ### Document Chat (Grounded & Cited)

 - Ask deep or high-level questions about your uploaded study material.
 - 100% grounded answers: the model responds only from the provided documents and signals when an answer can't be found.
 - Automatic source citations pointing to the original file(s).

 ### Teach-Back Evaluation Engine

 - Explain a concept in your own words and run the validator.
 - Studyo returns four concise insights:
	 - What you got right
	 - What you missed
	 - What’s slightly off
	 - A mastery score (1–5) with a short verdict

 ### Bring-Your-Own-Key (BYOK)

 - No server-side storage of API keys or user documents.
 - Your Gemini API key stays on the client (React state + optional localStorage).

 ### Dynamic Depth Toggle

 - Toggle between Simple (friendly, high-level) and Expert (technical, precise) response depths.

 ## Technical stack

 - Framework: Next.js (App Router)
 - Language: React / ES6
 - Styling: Tailwind CSS
 - Model engine: Google Gemini (e.g. `gemini-2.5-flash-lite`)
 - State: React state with localStorage sync
 - Data processing: native PDF parsing; documents are streamed as Base64 into the multimodal context

 ## Design system

 The app uses a distraction-free layout with neutral backgrounds and crisp white surfaces. Primary accents use a high-fidelity blue (#2F7FD1). Teach-back feedback uses subtle tints for success, omissions, and minor errors.

 ## Getting started

 Prerequisites

 - Node.js v18 or later

 Install and run locally

 ```bash
 git clone https://github.com/yourusername/studyo.git
 cd studyo
 npm install
 npm run dev
 ```

 Open http://localhost:3000 in your browser.

 ## Deployment

 Deploy to Vercel (no server env vars required since users provide keys client-side).

 Option A — GitHub + Vercel

 ```bash
 git init
 git add .
 git commit -m "Initial commit for Studyo"
 git branch -M main
 git remote add origin https://github.com/yourusername/studyo.git
 git push -u origin main
 ```

 Then import the repository in the Vercel dashboard and deploy.

 Option B — Vercel CLI

 ```bash
 npm install -g vercel
 vercel
 vercel --prod
 ```

 ## Security & privacy

 - No persistent storage of uploaded documents or derived vectors on third-party servers.
 - API keys remain on the client and are sent directly to the Google Gemini endpoint.

 ## License

 This project is licensed under the MIT License.
