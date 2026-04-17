import re

with open('web/rr_game.html', 'r', encoding='utf-8') as f:
    text = f.read()

new_css = """/* RETURN BUTTON */
.button {
  --stone-50: #fafaf9;
  --stone-800: #292524;
  --yellow-400: #facc15;

  font-size: 1rem;
  cursor: pointer;
  position: relative;
  font-family: "Inter", sans-serif;
  font-weight: bold;
  line-height: 1;
  padding: 1px;
  transform: translate(-4px, -4px);
  outline: 2px solid transparent;
  outline-offset: 5px;
  border-radius: 9999px;
  background-color: var(--stone-800);
  color: var(--stone-800);
  transition:
    transform 150ms ease,
    box-shadow 150ms ease;
  text-align: center;
  box-shadow:
    0.5px 0.5px 0 0 var(--stone-800),
    1px 1px 0 0 var(--stone-800),
    1.5px 1.5px 0 0 var(--stone-800),
    2px 2px 0 0 var(--stone-800),
    2.5px 2.5px 0 0 var(--stone-800),
    3px 3px 0 0 var(--stone-800),
    0 0 0 2px var(--stone-50),
    0.5px 0.5px 0 2px var(--stone-50),
    1px 1px 0 2px var(--stone-50),
    1.5px 1.5px 0 2px var(--stone-50),
    2px 2px 0 2px var(--stone-50),
    2.5px 2.5px 0 2px var(--stone-50),
    3px 3px 0 2px var(--stone-50),
    3.5px 3.5px 0 2px var(--stone-50),
    4px 4px 0 2px var(--stone-50);
}
.button:hover {
  transform: translate(0, 0);
  box-shadow: 0 0 0 2px var(--stone-50);
}
.button:active,
.button:focus-visible {
  outline-color: var(--yellow-400);
}
.button:focus-visible {
  outline-style: dashed;
}
.button > div {
  position: relative;
  pointer-events: none;
  background-color: var(--yellow-400);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 9999px;
}
.button > div::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  opacity: 0.5;
  background-image: radial-gradient(
      rgb(255 255 255 / 80%) 20%,
      transparent 20%
    ),
    radial-gradient(rgb(255 255 255 / 100%) 20%, transparent 20%);
  background-position:
    0 0,
    4px 4px;
  background-size: 8px 8px;
  mix-blend-mode: hard-light;
  animation: btn-dots 0.5s infinite linear;
}
.button > div > span {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.25rem;
  gap: 0.25rem;
  filter: drop-shadow(0 -1px 0 rgba(255, 255, 255, 0.25));
}
.button > div > span:active {
  transform: translateY(2px);
}
@keyframes btn-dots { 0% { background-position: 0 0, 4px 4px; } 100% { background-position: 8px 0, 12px 4px; } }
"""

# I unnested the CSS so it remains universally compatible without a bundler mapping nesting syntax.
# Also I preserved 'Inter' as the font family instead of adding Rubik just for one button, since we unified the font globally.

pattern = re.compile(r'/\* RETURN BUTTON \*/.*?/\* ══ TITLE ══ \*/', re.DOTALL)
new_text = pattern.sub(new_css + "\n/* ══ TITLE ══ */", text)

with open('web/rr_game.html', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Applied new brutalist yellow button styles to rr_game.html")
