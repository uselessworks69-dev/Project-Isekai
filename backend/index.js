import { Player } from './src/core/Player.js';
import { Gauntlet } from './src/core/Gauntlet.js';
import { Dungeon } from './src/core/Dungeon.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan.bold('\n=== PROJECT ISEKAI - CORE ENGINE ===\n'));

  // 1. Initialize a New Player
  const player = new Player('Jinwoo');
  console.log(chalk.green(`Player Created: ${player.name}`));
  console.log(`Starting Rank: ${player.rank}, Level: ${player.level}\n`);

  // 2. Simulate Completing Some Challenges
  console.log(chalk.yellow('--- Simulating Challenge Completion ---'));
  for (let i = 0; i < 7; i++) {
    player.completeChallenge();
  }
  console.log(`Challenges Completed: ${player.challengesCompleted}`);
  console.log(`Dungeon Keys: ${player.dungeonKeys}\n`);

  // 3. Work on the Push Gauntlet
  console.log(chalk.yellow('--- Training: Push Gauntlet ---'));
  const pushGauntlet = new Gauntlet('push', player);
  
  // Complete first 3 stages
  for (let i = 0; i < 3; i++) {
    pushGauntlet.completeStage();
  }
  
  // 4. Attempt a Dungeon
  console.log(chalk.yellow('\n--- Dungeon Expedition ---'));
  if (player.dungeonKeys > 0) {
    const dungeon = new Dungeon();
    const result = dungeon.attempt(player);
    console.log(chalk[result.success ? 'green' : 'red'](`Result: ${result.message}`));
  }

  // 5. Display Final Player State
  console.log(chalk.yellow('\n=== FINAL PLAYER STATUS ==='));
  console.log(chalk.blue(`Rank: ${player.rank} | Level: ${player.level}`));
  console.log(chalk.blue(`Stats: STR:${player.str} AGI:${player.agi} VIT:${player.vit} SEN:${player.sen} INT:${player.int}`));
  console.log(chalk.blue(`Total XP: ${player.xp.total} (PUSH:${player.xp.push} PULL:${player.xp.pull} LEGS:${player.xp.legs} CORE:${player.xp.core})`));
  console.log(chalk.blue(`Gauntlet Stages:`, JSON.stringify(player.gauntletStages)));
  console.log(chalk.blue(`Keys: ${player.dungeonKeys} | SC: ${player.sponsorshipCredits}`));
}

// Run the demo
main().catch(console.error);
