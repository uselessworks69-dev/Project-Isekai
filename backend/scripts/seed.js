import sequelize from '../src/config/database.js';
import User from '../src/models/User.js';
import Progress from '../src/models/Progress.js';

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data (optional - comment out in production!)
    console.log('🧹 Clearing existing data...');
    await sequelize.models.Progress.destroy({ where: {} });
    await sequelize.models.User.destroy({ where: {} });
    
    // Create test users
    console.log('👤 Creating test users...');
    
    const testUsers = [
      {
        username: 'jinwoo',
        email: 'jinwoo@isekai.com',
        password_hash: 'ShadowMonarch123!',
        character_data: {
          str: 45,
          agi: 52,
          vit: 38,
          sen: 41,
          int: 36,
          level: 42,
          rank: 'B',
          gauntlet_stages: {
            push: 45,
            pull: 42,
            legs: 38,
            core: 40
          },
          xp: {
            total: 18500,
            push: 5200,
            pull: 4800,
            legs: 4200,
            core: 4300
          },
          challenges_completed: 127,
          dungeon_keys: 2,
          sponsorship_credits: 3500,
          is_fallen: false,
          active_constellation: 'naruto'
        }
      },
      {
        username: 'levi_ackerman',
        email: 'levi@isekai.com',
        password_hash: 'CleanFreak456!',
        character_data: {
          str: 38,
          agi: 68,
          vit: 42,
          sen: 55,
          int: 61,
          level: 58,
          rank: 'A',
          gauntlet_stages: {
            push: 52,
            pull: 60,
            legs: 55,
            core: 58
          },
          xp: {
            total: 26500,
            push: 6200,
            pull: 7200,
            legs: 6800,
            core: 6300
          },
          challenges_completed: 215,
          dungeon_keys: 1,
          sponsorship_credits: 5200,
          is_fallen: false,
          active_constellation: 'levi'
        }
      },
      {
        username: 'fallen_one',
        email: 'fallen@isekai.com',
        password_hash: 'Redemption789!',
        character_data: {
          str: 32,
          agi: 28,
          vit: 35,
          sen: 31,
          int: 29,
          level: 25,
          rank: 'D',
          gauntlet_stages: {
            push: 28,
            pull: 25,
            legs: 22,
            core: 24
          },
          xp: {
            total: 8500,
            push: 2200,
            pull: 2100,
            legs: 2000,
            core: 2200
          },
          challenges_completed: 85,
          dungeon_keys: 0,
          sponsorship_credits: 150,
          is_fallen: true,
          fallen_since: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
          active_constellation: 'corrupted_goku'
        }
      }
    ];
    
    const createdUsers = [];
    for (const userData of testUsers) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.username}`);
    }
    
    // Create progress for each user
    console.log('📈 Creating progress records...');
    
    for (const user of createdUsers) {
      const progressData = {
        user_id: user.id,
        dungeon_keys: user.character_data.dungeon_keys,
        statistics: {
          total_challenges_completed: user.character_data.challenges_completed,
          total_dungeons_completed: Math.floor(user.character_data.challenges_completed / 5) * 3,
          total_dungeons_failed: Math.floor(user.character_data.challenges_completed / 5),
          total_xp_earned: user.character_data.xp.total,
          total_sc_earned: user.character_data.sponsorship_credits,
          current_streak: Math.floor(Math.random() * 30) + 1,
          longest_streak: Math.floor(Math.random() * 60) + 30,
          last_activity_date: new Date().toISOString()
        },
        gauntlet_progress: {
          push: {
            current_stage: user.character_data.gauntlet_stages.push,
            stages_completed: Array.from({ length: user.character_data.gauntlet_stages.push - 1 }, (_, i) => i + 1),
            total_xp: user.character_data.xp.push,
            boss_bonuses: Array.from({ length: Math.floor((user.character_data.gauntlet_stages.push - 1) / 10) }, (_, i) => ({
              stage: (i + 1) * 10,
              bonus: [50, 100, 150, 200, 300, 400, 600, 1000][i] || 1000,
              completed_at: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
            }))
          },
          pull: {
            current_stage: user.character_data.gauntlet_stages.pull,
            stages_completed: Array.from({ length: user.character_data.gauntlet_stages.pull - 1 }, (_, i) => i + 1),
            total_xp: user.character_data.xp.pull,
            boss_bonuses: Array.from({ length: Math.floor((user.character_data.gauntlet_stages.pull - 1) / 10) }, (_, i) => ({
              stage: (i + 1) * 10,
              bonus: [50, 100, 150, 200, 300, 400, 600, 1000][i] || 1000,
              completed_at: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
            }))
          },
          legs: {
            current_stage: user.character_data.gauntlet_stages.legs,
            stages_completed: Array.from({ length: user.character_data.gauntlet_stages.legs - 1 }, (_, i) => i + 1),
            total_xp: user.character_data.xp.legs,
            boss_bonuses: Array.from({ length: Math.floor((user.character_data.gauntlet_stages.legs - 1) / 10) }, (_, i) => ({
              stage: (i + 1) * 10,
              bonus: [50, 100, 150, 200, 300, 400, 600, 1000][i] || 1000,
              completed_at: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
            }))
          },
          core: {
            current_stage: user.character_data.gauntlet_stages.core,
            stages_completed: Array.from({ length: user.character_data.gauntlet_stages.core - 1 }, (_, i) => i + 1),
            total_xp: user.character_data.xp.core,
            boss_bonuses: Array.from({ length: Math.floor((user.character_data.gauntlet_stages.core - 1) / 10) }, (_, i) => ({
              stage: (i + 1) * 10,
              bonus: [50, 100, 150, 200, 300, 400, 600, 1000][i] || 1000,
              completed_at: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
            }))
          }
        }
      };
      
      // Add promotion status for higher level users
      if (user.character_data.level >= 40) {
        progressData.promotion_status = {
          can_attempt: true,
          next_rank: user.character_data.rank === 'B' ? 'A' : 'S',
          failed_attempts: 0,
          last_attempt: null
        };
      }
      
      // Add purification progress for fallen user
      if (user.character_data.is_fallen) {
        progressData.purification_progress = {
          started_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          current_phase: 2,
          completed_trials: ['humility'],
          sacrifices_made: true,
          mirror_defeated: false,
          selected_option: null
        };
      }
      
      const progress = await Progress.create(progressData);
      console.log(`✅ Created progress for: ${user.username}`);
    }
    
    console.log('\n✅ Seeding completed successfully!');
    console.log('\n🧪 Test Accounts:');
    console.log('1. jinwoo / ShadowMonarch123!');
    console.log('2. levi_ackerman / CleanFreak456!');
    console.log('3. fallen_one / Redemption789! (Fallen state)');
    console.log('\n🔗 API URL: http://localhost:3000/api');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
