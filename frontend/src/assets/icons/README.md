# Icons Directory

Place icon files here for the application. Recommended structure:

## Constellation Symbols (SVG format)
- naruto.svg (Spiral/Uzumaki symbol)
- goku.svg (Dragon Ball/Z symbol)
- levi.svg (Wings of Freedom)
- itachi.svg (Sharingan/Uchiha symbol)
- light.svg (Death Note/Apple)
- ayanokoji.svg (Blank/Simple design)
- saitama.svg (One Punch Man symbol)
- eren.svg (Attack Titan symbol)

## Skill/Attribute Icons
- str.svg (Strength/fist icon)
- agi.svg (Agility/footprint icon)
- vit.svg (Vitality/heart icon)
- sen.svg (Sensory/eye icon)
- int.svg (Intelligence/brain icon)

## System Icons
- dungeon.svg
- gauntlet.svg
- shop.svg
- task.svg
- rank-up.svg
- fallen.svg

## File Requirements
- SVG format preferred for scalability
- Optimize with SVGO before adding
- Use consistent 24x24 or 32x32 viewBox
- Follow Solo Leveling color scheme: blues, purples, neon accents

## Placeholder Generation
If you don't have custom icons, you can use:
1. Heroicons (https://heroicons.com)
2. Font Awesome Free
3. Simple Icons

Example placeholder script (run in icons directory):
```bash
# Create placeholder SVG files
for icon in str agi vit sen int; do
  cat > $icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"/>
  <text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">${icon:0:1}</text>
</svg>
EOF
done
