import express from 'express';
import { body, validationResult } from 'express-validator';
import DungeonRun from '../models/DungeonRun.js';
import Progress from '../models/Progress.js';

const router = express.Router();

// Get active dungeon
router.get('/active', async (req, res, next) => {
  try {
    const dungeonRun = await DungeonRun.findOne({
      where: {
        user_id: req.user.id,
        status: 'in_progress'
      },
      order: [['started_at', 'DESC']]
    });
    
    if (!dungeonRun) {
      return res.status(404).json({
        error: {
          type: 'NO_ACTIVE_DUNGEON',
          message: 'No active dungeon found'
        }
      });
    }
    
    res.json({
      dungeon: dungeonRun.toJSON()
    });
    
  } catch (error) {
    next(error);
  }
});

// Get dungeon history
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await DungeonRun.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['started_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      dungeons: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Get specific dungeon run
router.get('/:id', async (req, res, next) => {
  try {
    const dungeonRun = await DungeonRun.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id
      }
    });
    
    if (!dungeonRun) {
      return res.status(404).json({
        error: {
          type: 'DUNGEON_NOT_FOUND',
          message: 'Dungeon run not found'
        }
      });
    }
    
    res.json({
      dungeon: dungeonRun.toJSON()
    });
    
  } catch (error) {
    next(error);
  }
});

// Abandon dungeon
router.post('/:id/abandon', async (req, res, next) => {
  try {
    const dungeonRun = await DungeonRun.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
        status: 'in_progress'
      }
    });
    
    if (!dungeonRun) {
      return res.status(404).json({
        error: {
          type: 'DUNGEON_NOT_FOUND',
          message: 'Active dungeon not found'
        }
      });
    }
    
    // Update status
    dungeonRun.status = 'abandoned';
    dungeonRun.completed_at = new Date();
    await dungeonRun.save();
    
    // Clear from progress
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (progress && progress.current_dungeon?.id === dungeonRun.id) {
      progress.current_dungeon = null;
      await progress.save();
    }
    
    res.json({
      message: 'Dungeon abandoned',
      penalty: {
        xp_loss: 0, // Could implement penalties
        cooldown: 300 // 5 minute cooldown
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Get dungeon statistics
router.get('/statistics', async (req, res, next) => {
  try {
    const stats = await DungeonRun.findAll({
      where: { user_id: req.user.id },
      attributes: [
        'dungeon_type',
        [DungeonRun.sequelize.fn('COUNT', DungeonRun.sequelize.col('id')), 'total_runs'],
        [DungeonRun.sequelize.fn('SUM', DungeonRun.sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'successful_runs'],
        [DungeonRun.sequelize.fn('AVG', DungeonRun.sequelize.col('performance_score')), 'avg_score'],
        [DungeonRun.sequelize.fn('SUM', DungeonRun.sequelize.col('loot_earned->>\'xp\'')), 'total_xp'],
        [DungeonRun.sequelize.fn('SUM', DungeonRun.sequelize.col('loot_earned->>\'sc\'')), 'total_sc']
      ],
      group: ['dungeon_type']
    });
    
    // Overall statistics
    const overall = await DungeonRun.findOne({
      where: { user_id: req.user.id },
      attributes: [
        [DungeonRun.sequelize.fn('COUNT', DungeonRun.sequelize.col('id')), 'total_runs'],
        [DungeonRun.sequelize.fn('SUM', DungeonRun.sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'successful_runs'],
        [DungeonRun.sequelize.fn('AVG', DungeonRun.sequelize.col('performance_score')), 'avg_score'],
        [DungeonRun.sequelize.fn('MAX', DungeonRun.sequelize.col('performance_score')), 'best_score']
      ]
    });
    
    // Recent activity
    const recent = await DungeonRun.findAll({
      where: { user_id: req.user.id },
      order: [['started_at', 'DESC']],
      limit: 5
    });
    
    res.json({
      by_type: stats,
      overall: overall || {},
      recent: recent.map(r => ({
        id: r.id,
        type: r.dungeon_type,
        status: r.status,
        score: r.performance_score,
        started_at: r.started_at
      }))
    });
    
  } catch (error) {
    next(error);
  }
});

// Generate promotion dungeon
router.post('/promotion/generate', async (req, res, next) => {
  try {
    // Check if user is eligible for promotion
    const progress = await Progress.findOne({ where: { user_id: req.user.id } });
    if (!progress || !progress.promotion_status?.can_attempt) {
      return res.status(400).json({
        error: {
          type: 'NOT_ELIGIBLE',
          message: 'Not eligible for promotion'
        }
      });
    }
    
    // Check if already has active promotion dungeon
    const activePromotion = await DungeonRun.findOne({
      where: {
        user_id: req.user.id,
        dungeon_type: 'PROMOTION',
        status: 'in_progress'
      }
    });
    
    if (activePromotion) {
      return res.status(400).json({
        error: {
          type: 'ACTIVE_PROMOTION',
          message: 'Promotion dungeon already in progress'
        }
      });
    }
    
    // Generate promotion dungeon
    const promotionData = this.generatePromotionDungeon(req.user, progress);
    
    // Create dungeon run
    const dungeonRun = await DungeonRun.create({
      user_id: req.user.id,
      dungeon_type: 'PROMOTION',
      dungeon_data: promotionData,
      status: 'in_progress'
    });
    
    res.json({
      message: 'Promotion dungeon generated',
      dungeon: {
        id: dungeonRun.id,
        ...promotionData,
        is_promotion: true,
        consequences: {
          success: 'Rank up',
          failure: 'Become Fallen'
        }
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Helper method for promotion dungeon generation
router.generatePromotionDungeon = function(user, progress) {
  const charData = user.character_data;
  const nextRank = progress.promotion_status.next_rank;
  
  // Promotion dungeon is hybrid: tests all attributes
  return {
    archetype: 'PROMOTION',
    difficulty: 'extreme',
    description: `Rank Promotion Test: ${charData.rank} → ${nextRank}`,
    exercises: [
      {
        gauntlet: 'push',
        stage: charData.gauntlet_stages.push,
        reps: 5,
        sets: 3,
        requirement: 'perfect_form',
        description: 'Push strength test'
      },
      {
        gauntlet: 'pull',
        stage: charData.gauntlet_stages.pull,
        reps: 5,
        sets: 3,
        requirement: 'perfect_form',
        description: 'Pull strength test'
      },
      {
        gauntlet: 'legs',
        stage: charData.gauntlet_stages.legs,
        reps: 10,
        sets: 3,
        requirement: 'perfect_form',
        description: 'Leg endurance test'
      },
      {
        gauntlet: 'core',
        stage: charData.gauntlet_stages.core,
        time: '60s',
        requirement: 'perfect_form',
        description: 'Core stability test'
      }
    ],
    requirements: {
      max_form_breaks: 0,
      no_consumables: true,
      no_rest_pass: true,
      completion_conditions: ['all_exercises_perfect']
    },
    rewards: {
      xp: 1000,
      sc: 500,
      stat_points: 5,
      rank_up: true
    },
    penalties: {
      failure: {
        become_fallen: true,
        xp_penalty: 0.2, // +20% XP required
        constellation_corruption: true
      }
    }
  };
};

export default router;
