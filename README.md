#Studyo

Upload, understand, and prove you've learned it.

Studyo is a modern, privacy-focused interactive study companion built to revolutionize how you absorb and master dense materials. Powered directly by Google Gemini, Studyo lets you upload text files or PDFs, interact with them through highly contextual chats (with automatic source citations), and verify your real comprehension using the signature Teach-back active-recall evaluation framework.

🌟 Core Features

1. Document Chat (Grounded & Cited)

Ask deep or high-level questions about your custom study material.

100% Grounded: The model is strictly instructed to answer using only your uploaded context. If the answer cannot be found in the documents, it lets you know instead of guessing or hallucinating.

Source Citations: Answers automatically call out and cite the specific file names they were pulled from.

2. Teach-Back Evaluation Engine (The Signature Feature)

Passive reading is a trap. Truly mastering a concept requires explaining it in your own words.

Type a concept from your materials, draft your explanation, and run the validator.

Studyo cross-references your explanation against the text and returns four precise insights:

What you got right (Encouraging verification of correctly recalled facts)

What you missed (Critical details or nuances present in the texts that you overlooked)

What's slightly off (Subtle inaccuracies, errors, or mischaracterizations)

Mastery Score (An objective 1 to 5 score with a single-sentence verdict)

3. Bring-Your-Own-Key (BYOK) Architecture

Zero databases, zero servers storing or tracking your API keys.

Your Gemini API key is kept completely on the client side in secure React state (and mirrored in localStorage for convenience).

API calls carry your key to the model securely and dynamically.

4. Dynamic Depth Toggle

Toggle between Simple and Expert study depths:

Simple: Friendly, high-level, intuitive analogies, and conversational vocabulary.

Expert: Academic, precise, highly technical terminology, and rigorous logic loops.

🛠️ Technical Stack

Framework: Next.js (App Router)

Language: React / ES6 JavaScript

Styling: Tailwind CSS (Fluid responsive grids, minimalist spacing)

Model Engine: Google Gemini (gemini-2.5-flash-lite or gemini-2.5-flash)

State Management: React state & native localStorage synchronization

Data Processing: Native PDF parsing (Base64 inline document stream injected straight into Gemini's multimodal context window — no heavyweight text-extraction packages required).

🎨 Visual Design System

Studyo is designed with a premium, focused, and distraction-free workspace layout:

Background Canvas: Neutral warm off-white (#F5F4EF) to reduce eye strain.

Component Surface: Crisp white panels (#FFFFFF) bound by thin subtle borders (#E7E5DE) and elegant 12px rounded corners.

Accents: High-fidelity blue (#2F7FD1) for primary actions, indicators, and focus states.

Teach-back Color Feedback:

Success/Correct states: soft emerald tint (#E5F4EE)

Omissions: soft amber tint (#FBEFD9)

Minor errors/Misalignments: soft coral tint (#FAEbE4)

🚀 Getting Started

Prerequisites

Make sure you have Node.js (v18+ recommended) installed on your system.

Installation

Clone the repository:

git clone https://github.com/yourusername/studyo.git
cd studyo


Install project dependencies:

npm install


Start the local development server:

npm run dev


Open the web app:
Navigate to http://localhost:3000 in your web browser.

☁️ Vercel Deployment

Deploying Studyo to Vercel takes less than 2 minutes and requires zero backend environment variable configurations, because users supply their own keys!

Option A: Via GitHub (Recommended)

Commit and push your local files to a new GitHub repository:

git init
git add .
git commit -m "Initial commit for Studyo"
git branch -M main
git remote add origin https://github.com/yourusername/studyo.git
git push -u origin main


Go to your Vercel Dashboard.

Click Add New -> Project.

Import your newly created studyo repository.

Click Deploy. Vercel will automatically configure Node.js, build your App Router project, and produce a live production URL!

Option B: Via Vercel CLI

Install the CLI tool globally:

npm install -g vercel


Execute the login and initialization wizard from your project directory:

vercel


Push the build to the production environment:

vercel --prod


🔒 Security & Privacy

Direct execution: No text document vectors or private PDFs are stored on a third-party server. All data operations exist inside the temporary browser memory.

Key Preservation: Your API keys are strictly sent from your client environment to the official Google Gemini server endpoint directly.

📄 License

This project is licensed under the MIT License.
