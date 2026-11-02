// Самопроверка разбора патчноутов на каверзных строках: npm test
import assert from 'node:assert/strict';
globalThis.location = { search: '' }; // core.js читает язык из адреса
const { analyzeChange } = await import('../js/patches.js');

const cases = {
  'Anti-Heal increased from -35% to -40%': 'buff',
  'Damage Penalty reduced from -15% to -12%': 'buff',
  'Parry Cooldown reduction reduced from -1.75s to -1.25s': 'nerf',
  'Cooldown boon scaling increased from -0.25 to -0.45': 'buff',
  'Luggage Cart - T3 increased from -15s Cooldown to -18s': 'buff',
  'Rook Battery - T3 reduced from -12s cooldown to -10s': 'nerf',
  'Self damage from 6.5% max HP to 5% and is now spirit damage': 'buff',
  'Traveler - T2 changed from "400 Barrier that scales with spirit" to "-65s Cooldown"': 'neutral',
  'Grasping Hands - Can now be more easily double jumped over': 'nerf',
  'Scrap Grenade - Fuse timers increased by 0.1s': 'nerf',
  'Gun now deals -20% headshot damage': 'nerf',
  "Baba's Brew - No longer has an initial brew time": 'buff',
  'Still Life - Line of sight is now required when the channel ends': 'nerf',
  'Abstract Landscape - Now ends early if Violet dies': 'nerf',
  'Polished slide animations, added new ability and item aim poses': 'neutral',
  'Healing Nova: Now scales with Spirit Power (1.1) instead of Boons (6)': 'neutral',
};
for (const [line, want] of Object.entries(cases)) assert.equal(analyzeChange(line).effect, want, line);
console.log(`ok: ${Object.keys(cases).length} строк разобраны верно`);
