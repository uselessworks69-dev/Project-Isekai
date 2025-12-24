import { validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        type: 'VALIDATION_ERROR',
        messages: errors.array().map(err => ({
          field: err.param,
          message: err.msg,
          value: err.value
        }))
      }
    });
  }
  
  next();
};

export const validatePagination = (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  
  req.query.page = Math.max(1, parseInt(page)) || 1;
  req.query.limit = Math.min(100, Math.max(1, parseInt(limit))) || 20;
  
  next();
};

export const validateCharacterUpdate = (req, res, next) => {
  const allowedUpdates = [
    'str', 'agi', 'vit', 'sen', 'int',
    'level', 'rank',
    'gauntlet_stages',
    'xp',
    'challenges_completed',
    'dungeon_keys',
    'sponsorship_credits',
    'is_fallen',
    'fallen_since',
    'active_constellation',
    'inventory',
    'achievements',
    'settings'
  ];
  
  const updates = req.body.updates || {};
  const invalidFields = Object.keys(updates).filter(key => !allowedUpdates.includes(key));
  
  if (invalidFields.length > 0) {
    return res.status(400).json({
      error: {
        type: 'INVALID_FIELDS',
        message: `Invalid fields: ${invalidFields.join(', ')}`,
        allowed_fields: allowedUpdates
      }
    });
  }
  
  next();
};
