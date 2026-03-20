# UI Layout Redesign & Smart Input Feature

## Goal
Improve the shopping experience with a modern off-white aesthetic and personalized greeting. Add a "Smart Input" box allowing the user to add items via free AI models. Add a simple Feedback Logging mechanism. 

## 1. Aesthetic Updates
- Change global background in `index.css` or `App.jsx` to a light off-white (`#FAFAF8`).
- Update `CategoriaCard` and `ListaItem` to use softer borders, rounded corners (`rounded-2xl`), and subtle drop shadows (`shadow-sm`) to create a "floating card" app feel.
- Implement a new `WelcomeHeader` component to dynamically display "Bom dia/Boa tarde/Boa noite, [Nome]! 🍀" based on the exact hour. 

## 2. Smart Input System
- Create `SmartInput.jsx` at the top of the interface. 
- In `ConfigToken.jsx`, add a new configuration section for the AI provider with presets:
  - **Provider Dropdown**: Gemini (Free Tier), Groq (Free Llama 3), OpenRouter (Free DeepSeek), Custom OpenAI-compatible.
  - **API Key Field**.
- When the user types a sentence into the Smart Input and submits, the app will call the selected provider's API with a system prompt: *"You are a grocery parser. User inputs a sentence. Return JSON array with { nome: string, quantidadePadrao: string (only numbers), unidade: string }."*
- Unlisted items returned by the AI are merged seamlessly into the user's `data.json` catalog inside `App.jsx`.

## 3. Feedback Logging Mechanism
- Implement a discrete "Deixar Feedback 📝" button calling `FeedbackModal.jsx`.
- When submitted, the text is formatted with a timestamp and committed to a `public/feedback_log.json` file on the current GitHub repository using the existing `salvarDados` mechanism.
