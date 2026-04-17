import re

with open("web/rr_game.html", "r") as f:
    text = f.read()

# Replace font family Courier New with Inter
text = text.replace("Courier New", "Inter")

# Add Google Fonts
fonts_html = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">\n<style>'
text = text.replace("<style>", fonts_html, 1)

# Back Button CSS injection
back_btn_css = """
/* RETURN BUTTON */
.btn-back {
  all: unset; display: flex; align-items: center; justify-content: center;
  position: relative; padding: 0.1em; color: #fff; cursor: pointer; z-index: 10;
  text-decoration: none; margin: 10px auto 25px auto; width: fit-content; max-width: 90%;
}
.btn-back::before, .btn-back::after {
  content: ""; position: absolute; inset: 0; box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
}
.btn-back::before {
  background: linear-gradient(-45deg, #38bdf8, #818cf8, #c084fc, #38bdf8);
  background-size: 400% 400%; animation: holo-grad 4s ease infinite; border-radius: 8px; z-index: -2;
}
.btn-back::after {
  background: rgba(0,0,0,0.4); border-radius: 8px; content: ""; z-index: -1;
  background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
  background-size: 8px 8px; animation: btn-dots 10s linear infinite;
}
.btn-back > div {
  background: rgba(5, 16, 26, 0.9); border-radius: 6px; position: relative;
  display: flex; align-items: center; justify-content: center; padding: 0.75rem 1.25rem; gap: 0.25rem;
  font-family: 'Inter', sans-serif; font-weight: 700;
}
.btn-back > div > span:active { transform: translateY(2px); }
@keyframes holo-grad { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes btn-dots { 0% { background-position: 0 0, 4px 4px; } 100% { background-position: 8px 0, 12px 4px; } }
"""
text = text.replace("/* ══ TITLE ══ */", back_btn_css + "\n/* ══ TITLE ══ */", 1)

# Back Button HTML injection
back_btn_html = """    <a href="index.html" class="btn-back">
      <div><span>🏠 Regresar a Menú Principal</span></div>
    </a>
"""
text = text.replace('<div class="key-row">', back_btn_html + '    <div class="key-row">')

# UI sizing enhancements
text = text.replace('.sp{position:absolute;right:0;top:0;bottom:0;width:230px;', '.sp{position:absolute;right:0;top:0;bottom:0;width:300px;')
text = text.replace('SP_W=window.innerWidth<=640?150:230;', 'SP_W=window.innerWidth<=640?150:300;')
text = text.replace('SP_W=230;', 'SP_W=300;')
text = text.replace('.hud{display:flex;align-items:center;padding:5px 14px;gap:12px;flex-shrink:0;', '.hud{display:flex;align-items:center;padding:12px 18px;gap:18px;min-height:56px;flex-shrink:0;')
text = text.replace('.sp-nm{font-weight:700;color:#f0f0f0;font-size:.68rem;', '.sp-nm{font-weight:700;color:#f0f0f0;font-size:.85rem;')
text = text.replace('.sp-bt{color:#8080a0;font-size:.58rem}', '.sp-bt{color:#8080a0;font-size:.70rem}')

with open("web/rr_game.html", "w") as f:
    f.write(text)

print("Patch applied successfully.")
