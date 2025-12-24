import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Progress from '../models/Progress.js';
import DungeonRun from '../models/DungeonRun.js';
import ConstellationAssignment from '../models/ConstellationAssignment.js';

const router = express.Router();

// Get user progress
router.get('/', async (req, res, next) => {
  try {
    const progress = await Progress.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: User,
          attributes: ['username', 'email', 'character_data']
        }
      ]
    });
    
    if (!progress) {
      return res.status(404).json({
        error: {
          type: 'PROGRESS_NOT_FOUND',
          message: 'Progress data not found'
        }
      });
    }
    
    res.json({
      progress: progress.toJSON(),
      character: req.user.character_data
    });
    
  } catch (error) {
    next(error);
  }
});

// Update character data
router.put('/character', [
  body('updates').isObject().withMessage('Updates must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }
    
    const { updates } = req.body;
    
    // Update user's character data
    await req.user.updateCharacterData(updates);
    
    // Update progress if needed
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (progress) {
      // Sync relevant data to progress
      if (updates.gauntlet_stages) {
        Object.keys(updates.gauntlet_stages).forEach(gauntlet => {
          if (progress.gauntlet_progress[gauntlet]) {
            progress.gauntlet_progress[gauntlet].current_stage = 
              updates.gauntlet_stages[gauntlet];
          }
        });
        await progress.save();
      }
    }
    
    res.json({
      message: 'Character data updated',
      character: req.user.character_data
    });
    
  } catch (error) {
    next(error);
  }
});

// Complete a challenge
router.post('/challenges/complete', [
  body('challenge_id').notEmpty().withMessage('Challenge ID required'),
  body('xp_earned').isInt({ min: 0 }).withMessage('XP earned must be positive integer'),
  body('details').optional().isObject()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }
    
    const { challenge_id, xp_earned, details } = req.body;
    
    // Get or create progress
    let progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (!progress) {
      progress = await Progress.create({ user_id: req.user.id });
    }
    
    // Complete challenge
    await progress.completeChallenge({
      id: challenge_id,
      xp_earned,
      details
    });
    
    // Update user's character data with XP
    await req.user.updateCharacterData({
      xp: {
        total: req.user.character_data.xp.total + xp_earned,
        // Distribute XP based on challenge type
        push: req.user.character_data.xp.push + (details?.gauntlet === 'push' ? xp_earned : 0),
        pull: req.user.character_data.xp.pull + (details?.gauntlet === 'pull' ? xp_earned : 0),
        legs: req.user.character_data.xp.legs + (details?.gauntlet === 'legs' ? xp_earned : 0),
        core: req.user.character_data.xp.core + (details?.gauntlet === 'core' ? xp_earned : 0)
      },
      challenges_completed: req.user.character_data.challenges_completed + 1,
      dungeon_keys: progress.dungeon_keys
    });
    
    // Recalculate stats
    await this.recalculateStats(req.user);
    
    res.json({
      message: 'Challenge completed',
      progress: {
        challenges_completed: progress.statistics.total_challenges_completed,
        dungeon_keys: progress.dungeon_keys,
        streak: progress.statistics.current_streak
      },
      rewards: {
        xp: xp_earned
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Complete gauntlet stage
router.post('/gauntlets/:type/stages/:stage/complete', [
  body('xp_earned').isInt({ min: 0 }).withMessage('XP earned required'),
  body('is_boss').optional().isBoolean(),
  body('boss_bonus').optional().isInt({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }
    
    const { type, stage } = req.params;
    const { xp_earned, is_boss, boss_bonus } = req.body;
    
    const validTypes = ['push', 'pull', 'legs', 'core'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: {
          type: 'INVALID_GAUNTLET',
          message: `Invalid gauntlet type. Must be one of: ${validTypes.join(', ')}`
        }
      });
    }
    
    // Get progress
    let progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (!progress) {
      progress = await Progress.create({ user_id: req.user.id });
    }
    
    // Complete stage
    await progress.completeGauntletStage(type, {
      stage: parseInt(stage),
      xp_earned,
      is_boss: is_boss || false,
      boss_bonus: boss_bonus || 0
    });
    
    // Update user character data
    const stageUpdate = {};
    stageUpdate[`gauntlet_stages.${type}`] = progress.gauntlet_progress[type].current_stage;
    
    await req.user.updateCharacterData({
      ...stageUpdate,
      xp: {
        total: req.user.character_data.xp.total + xp_earned,
        [type]: req.user.character_data.xp[type] + xp_earned
      }
    });
    
    // If boss stage, add INT (boss bonus = +1 INT)
    if (is_boss && boss_bonus) {
      await req.user.updateCharacterData({
        int: req.user.character_data.int + 1
      });
    }
    
    // Recalculate level and rank
    await this.recalculateLevelAndRank(req.user);
    
    res.json({
      message: `Stage ${stage} completed`,
      progress: {
        current_stage: progress.gauntlet_progress[type].current_stage,
        total_xp: progress.gauntlet_progress[type].total_xp,
        stages_completed: progress.gauntlet_progress[type].stages_completed.length
      },
      rewards: {
        xp: xp_earned,
        int: is_boss ? 1 : 0
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Request dungeon
router.post('/dungeons/request', async (req, res, next) => {
  try {
    // Get progress
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (!progress) {
      return res.status(404).json({
        error: {
          type: 'PROGRESS_NOT_FOUND',
          message: 'Progress data not found'
        }
      });
    }
    
    // Check if user has dungeon keys
    if (progress.dungeon_keys < 1) {
      return res.status(400).json({
        error: {
          type: 'NO_DUNGEON_KEYS',
          message: 'No dungeon keys available. Complete 5 challenges to earn one.'
        }
      });
    }
    
    // Generate dungeon
    const dungeonData = DungeonRun.generateDungeon(req.user, progress);
    
    // Create dungeon run record
    const dungeonRun = await DungeonRun.create({
      user_id: req.user.id,
      dungeon_type: dungeonData.archetype,
      dungeon_data: dungeonData,
      status: 'in_progress'
    });
    
    // Update progress
    await progress.startDungeon({
      id: dungeonRun.id,
      ...dungeonData
    });
    
    res.json({
      message: 'Dungeon assigned',
      dungeon: {
        id: dungeonRun.id,
        ...dungeonData,
        key_cost: 1,
        keys_remaining: progress.dungeon_keys - 1
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Complete dungeon
router.post('/dungeons/:id/complete', [
  body('success').isBoolean().withMessage('Success status required'),
  body('form_breaks').optional().isInt({ min: 0 }),
  body('completion_time').optional().isInt({ min: 0 }),
  body('constraint_violations').optional().isInt({ min: 0 }),
  body('details').optional().isObject()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }
    
    const { id } = req.params;
    const { success, form_breaks, completion_time, constraint_violations, details } = req.body;
    
    // Get dungeon run
    const dungeonRun = await DungeonRun.findOne({
      where: {
        id,
        user_id: req.user.id,
        status: 'in_progress'
      }
    });
    
    if (!dungeonRun) {
      return res.status(404).json({
        error: {
          type: 'DUNGEON_NOT_FOUND',
          message: 'Dungeon not found or already completed'
        }
      });
    }
    
    // Complete the run
    await dungeonRun.completeRun({
      success,
      form_breaks: form_breaks || 0,
      completion_time: completion_time || null,
      constraint_violations: constraint_violations || 0,
      details: details || {}
    });
    
    // Update progress
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (progress) {
      await progress.completeDungeon({
        success,
        xp_earned: dungeonRun.loot_earned.xp,
        sc_earned: dungeonRun.loot_earned.sc
      });
    }
    
    // Update user character data
    if (success && dungeonRun.loot_earned) {
      const updates = {};
      
      // Add SC
      updates.sponsorship_credits = req.user.character_data.sponsorship_credits + 
        dungeonRun.loot_earned.sc;
      
      // Add stat points if any
      if (dungeonRun.loot_earned.stat_points > 0) {
        // Distribute stat points based on dungeon type
        const statMap = {
          'TIME_TRIAL': ['agi', 'vit'],
          'GRAVITY': ['str', 'int'],
          'CURSED': ['sen', 'vit']
        };
        
        const stats = statMap[dungeonRun.dungeon_type] || ['str', 'agi', 'vit', 'sen', 'int'];
        const randomStat = stats[Math.floor(Math.random() * stats.length)];
        updates[randomStat] = req.user.character_data[randomStat] + 
          dungeonRun.loot_earned.stat_points;
      }
      
      await req.user.updateCharacterData(updates);
    }
    
    res.json({
      message: success ? 'Dungeon completed successfully' : 'Dungeon failed',
      result: {
        success,
        performance_score: dungeonRun.performance_score,
        loot: dungeonRun.loot_earned,
        duration: dungeonRun.duration_seconds
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Get available constellations
router.get('/constellations/available', async (req, res, next) => {
  try {
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (!progress) {
      return res.json({ available: [] });
    }
    
    const available = ConstellationAssignment.findAvailableConstellations(req.user, progress);
    
    res.json({
      available,
      has_active: !!req.user.active_constellation_id
    });
    
  } catch (error) {
    next(error);
  }
});

// Accept constellation sponsorship
router.post('/constellations/:id/accept', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user already has an active constellation
    const existing = await ConstellationAssignment.findOne({
      where: {
        user_id: req.user.id,
        is_corrupted: false
      }
    });
    
    if (existing) {
      return res.status(400).json({
        error: {
          type: 'ALREADY_SPONSORED',
          message: 'You already have an active constellation sponsor'
        }
      });
    }
    
    // Get constellation data
    const constellationData = ConstellationAssignment.getConstellationByTrigger(id);
    if (!constellationData) {
      return res.status(404).json({
        error: {
          type: 'CONSTELLATION_NOT_FOUND',
          message: 'Constellation not found'
        }
      });
    }
    
    // Create constellation assignment
    const assignment = await ConstellationAssignment.create({
      user_id: req.user.id,
      ...constellationData
    });
    
    // Update user with active constellation
    await req.user.update({
      active_constellation_id: assignment.id
    });
    
    res.json({
      message: `Constellation '${constellationData.name}' sponsorship accepted`,
      constellation: assignment.toJSON()
    });
    
  } catch (error) {
    next(error);
  }
});

// Start purification arc
router.post('/purification/start', async (req, res, next) => {
  try {
    // Check if user is Fallen
    if (!req.user.character_data.is_fallen) {
      return res.status(400).json({
        error: {
          type: 'NOT_FALLEN',
          message: 'You are not in the Fallen state'
        }
      });
    }
    
    // Check if already in purification
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (progress && progress.purification_progress) {
      return res.status(400).json({
        error: {
          type: 'ALREADY_PURIFYING',
          message: 'Purification arc already in progress'
        }
      });
    }
    
    // Check requirements: 30+ days Fallen, 10+ dungeons completed while Fallen
    const fallenSince = new Date(req.user.character_data.fallen_since);
    const daysFallen = Math.floor((new Date() - fallenSince) / (1000 * 60 * 60 * 24));
    
    if (daysFallen < 30) {
      return res.status(400).json({
        error: {
          type: 'REQUIREMENTS_NOT_MET',
          message: `Need ${30 - daysFallen} more days in Fallen state`
        }
      });
    }
    
    // Start purification
    await progress.startPurification();
    
    // Sacrifice: Reset corrupted constellation level to 1
    const corruptedConstellation = await ConstellationAssignment.findOne({
      where: {
        user_id: req.user.id,
        is_corrupted: true
      }
    });
    
    if (corruptedConstellation) {
      corruptedConstellation.level = 1;
      corruptedConstellation.experience = 0;
      await corruptedConstellation.save();
    }
    
    res.json({
      message: 'Purification arc begun. The cost will be everything.',
      purification: progress.purification_progress
    });
    
  } catch (error) {
    next(error);
  }
});

// Complete purification phase
router.post('/purification/phase/:phase/complete', [
  body('trial_id').optional().isString(),
  body('sacrifices_made').optional().isBoolean(),
  body('mirror_defeated').optional().isBoolean(),
  body('selected_option').optional().isIn(['purge', 'absorb'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }
    
    const { phase } = req.params;
    const { trial_id, sacrifices_made, mirror_defeated, selected_option } = req.body;
    
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (!progress || !progress.purification_progress) {
      return res.status(400).json({
        error: {
          type: 'PURIFICATION_NOT_ACTIVE',
          message: 'Purification arc not active'
        }
      });
    }
    
    // Update purification progress
    await progress.updatePurification(parseInt(phase), {
      trial_completed: trial_id,
      sacrifices_made,
      mirror_defeated,
      selected_option
    });
    
    // If phase 4 completed, finalize purification
    if (parseInt(phase) === 4 && selected_option) {
      await this.finalizePurification(req.user, progress, selected_option);
    }
    
    res.json({
      message: `Purification phase ${phase} completed`,
      purification: progress.purification_progress
    });
    
  } catch (error) {
    next(error);
  }
});

// Helper methods
router.recalculateStats = async function(user) {
  const charData = user.character_data;
  
  // Calculate STR from Push + Pull XP
  const pushPullXP = charData.xp.push + charData.xp.pull;
  charData.str = 1 + Math.floor(pushPullXP / 250);
  
  // Calculate AGI from Legs/Pull stages
  const agiStages = charData.gauntlet_stages.legs + charData.gauntlet_stages.pull;
  charData.agi = 1 + Math.floor(agiStages / 5);
  
  // Calculate VIT from Total XP
  charData.vit = 1 + Math.floor(charData.xp.total / 500);
  
  // Calculate SEN from Core XP
  charData.sen = 1 + Math.floor(charData.xp.core / 150);
  
  // INT is calculated from boss bonuses (handled elsewhere)
  
  await user.updateCharacterData(charData);
};

router.recalculateLevelAndRank = async function(user) {
  const charData = user.character_data;
  
  // Calculate level from average gauntlet stage
  const stages = Object.values(charData.gauntlet_stages);
  const avgStage = stages.reduce((a, b) => a + b, 0) / stages.length;
  charData.level = Math.floor(avgStage);
  
  // Calculate rank
  const rankThresholds = [
    { maxLevel: 9, rank: 'F' },
    { maxLevel: 19, rank: 'E' },
    { maxLevel: 29, rank: 'D' },
    { maxLevel: 39, rank: 'C' },
    { maxLevel: 59, rank: 'B' },
    { maxLevel: 79, rank: 'A' },
    { maxLevel: 89, rank: 'S' },
    { maxLevel: 99, rank: 'SS' },
    { maxLevel: Infinity, rank: 'SSS' }
  ];
  
  const rankObj = rankThresholds.find(t => charData.level <= t.maxLevel);
  charData.rank = rankObj ? rankObj.rank : 'SSS';
  
  await user.updateCharacterData(charData);
};

router.finalizePurification = async function(user, progress, option) {
  // Remove Fallen state
  await user.updateCharacterData({
    is_fallen: false,
    fallen_since: null
  });
  
  // Apply option-specific changes
  if (option === 'purge') {
    // Restore to rank before fall
    // This would need to be stored when user becomes Fallen
    const preFallRank = progress.milestones?.find(m => 
      m.type === 'fallen')?.pre_fall_rank || 'F';
    
    await user.updateCharacterData({
      rank: preFallRank
    });
    
  } else if (option === 'absorb') {
    // Keep current rank but grant perk
    // Add "Unbreakable Will" perk to character data
    const perks = user.character_data.perks || [];
    perks.push({
      id: 'unbreakable_will',
      name: 'Unbreakable Will',
      description: 'Once per major promotion, forgive one form-break',
      type: 'passive',
      uses_remaining: 1,
      max_uses: 1,
      reset_on_promotion: true
    });
    
    await user.updateCharacterData({
      perks
    });
  }
  
  // Clear purification progress
  progress.purification_progress = null;
  await progress.save();
  
  // Grant redemption title
  const achievements = user.character_data.achievements || [];
  achievements.push({
    id: 'the_redeemed',
    title: option === 'purge' ? 'The Redeemed' : 'Scarred Sage',
    description: 'Completed the Path of Atonement',
    earned_at: new Date().toISOString(),
    rarity: 'Legendary'
  });
  
  await user.updateCharacterData({
    achievements
  });
};

export default router;
