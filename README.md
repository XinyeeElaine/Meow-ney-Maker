# Meow-ney Maker 💰🐱 (Working Timer)

Welcome to HELL ✨ ...but at least you're getting paid!

Meow-ney Maker is a fun, aesthetic, and slightly sarcastic real-time salary tracker. Instead of staring at the clock while you work, stare at your money going up second by second!

✨ **Features:**

&nbsp;👻 **Real-Time Salary Tracking:** Enter your monthly salary and working hours to watch your exact earnings calculate live down to the second.

&nbsp;👻 **Cute Companions:** Features a bouncing, hard-working cat to keep you company during the grind, and a DJ Cat dropping the beat 
when it's time to clock out!

&nbsp;👻 **Session History:** Automatically saves your daily "shifts" using local storage so you can see your total hours and earnings over time.

&nbsp;👻 **Aesthetic UI:** Clean white glass-morphism cards with a custom floating glitter background.

<br>

🛠️ **Tech Stack:**
React + Vite, with Supabase for auth and storage. Every sprite is hand-drawn pixel art rendered as inline SVG — no image assets, just pure feline motivation.

<br>

🐾 **Running it locally:**

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npm run dev
```

`npm run build` outputs to `dist/`. Signed-in users sync to Supabase; guests fall back to local storage.
