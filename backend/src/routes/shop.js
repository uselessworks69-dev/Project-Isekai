import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';

const router = express.Router();

// Get shop items
router.get('/items', async (req, res, next) => {
  try {
    // Shop items would come from a database or config
    const shopItems = {
      consumables: [
        {
          id: 'rest_pass',
          name: 'Rest-Pass (Single)',
          description: 'Grants +60s rest once in a Promotion challenge.',
          cost: 800,
          type: 'consumable',
          rarity: 'Rare',
          usable_in: ['promotion'],
          max_stack: 5
        },
        {
          id: 'dungeon_reroll',
          name: 'Dungeon Reroll Token',
          description: 'Reroll the next assigned dungeon archetype once.',
          cost: 600,
          type: 'consumable',
          rarity: 'Uncommon',
          max_stack: 3
        },
        {
          id: 'penalty_negation',
          name: 'Penalty Negation (One-time)',
          description: 'Negates one minor penalty on the next failed dungeon.',
          cost: 900,
          type: 'consumable',
          rarity: 'Rare',
          max_stack: 2
        },
        {
          id: 'retry_token',
          name: 'Retry Token',
          description: 'Immediate one retry for a failed assigned dungeon.',
          cost: 1200,
          type: 'consumable',
          rarity: 'Epic',
          max_stack: 1,
          not_usable_in: ['promotion']
        }
      ],
      cosmetics: [
        {
          id: 'title_redeemed',
          name: 'Title: The Redeemed',
          description: 'Cosmetic title earned after completing the Purification Arc.',
          cost: 300,
          type: 'cosmetic',
          rarity: 'Legendary',
          unlock_condition: 'purification_complete'
        },
        {
          id: 'aura_monarch',
          name: 'Monarch Aura',
          description: 'Golden aura effect inspired by Solo Leveling\'s Monarchs.',
          cost: 1500,
          type: 'cosmetic',
          rarity: 'Epic'
        }
      ],
      permanent: [
        {
          id: 'ascension_perk_slot',
          name: 'Ascension Perk Slot',
          description: 'Unlocks an additional perk slot for your next ascension.',
          cost: 5000,
          type: 'permanent',
          rarity: 'Legendary',
          requirement: 'post_ascension',
          purchase_limit: 1
        }
      ]
    };
    
    // Filter based on user's state
    const filteredItems = this.filterItemsForUser(shopItems, req.user);
    
    res.json({
      items: filteredItems,
      user_sc: req.user.character_data.sponsorship_credits || 0
    });
    
  } catch (error) {
    next(error);
  }
});

// Purchase item
router.post('/purchase', [
  body('item_id').notEmpty().withMessage('Item ID required'),
  body('quantity').optional().isInt({ min: 1, max: 10 }).withMessage('Quantity must be 1-10')
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
    
    const { item_id, quantity = 1 } = req.body;
    
    // Get item from shop
    const item = await this.getItemById(item_id);
    if (!item) {
      return res.status(404).json({
        error: {
          type: 'ITEM_NOT_FOUND',
          message: 'Item not found in shop'
        }
      });
    }
    
    // Check requirements
    const requirementCheck = this.checkItemRequirements(item, req.user);
    if (!requirementCheck.valid) {
      return res.status(400).json({
        error: {
          type: 'REQUIREMENTS_NOT_MET',
          message: requirementCheck.message
        }
      });
    }
    
    // Calculate total cost
    const totalCost = item.cost * quantity;
    
    // Check if user has enough SC
    const userSC = req.user.character_data.sponsorship_credits || 0;
    if (userSC < totalCost) {
      return res.status(400).json({
        error: {
          type: 'INSUFFICIENT_FUNDS',
          message: `Need ${totalCost} SC, but only have ${userSC} SC`
        }
      });
    }
    
    // Check purchase limits
    const limitCheck = await this.checkPurchaseLimit(item, req.user, quantity);
    if (!limitCheck.valid) {
      return res.status(400).json({
        error: {
          type: 'PURCHASE_LIMIT',
          message: limitCheck.message
        }
      });
    }
    
    // Process purchase
    await this.processPurchase(req.user, item, quantity, totalCost);
    
    res.json({
      message: 'Purchase successful',
      purchase: {
        item: item.name,
        quantity,
        total_cost: totalCost,
        remaining_sc: userSC - totalCost
      },
      item_added: true
    });
    
  } catch (error) {
    next(error);
  }
});

// Get user's inventory
router.get('/inventory', async (req, res, next) => {
  try {
    const inventory = req.user.inventory || {
      consumables: {},
      cosmetics: [],
      permanent_upgrades: []
    };
    
    // Add counts and details
    const detailedInventory = await this.getDetailedInventory(inventory);
    
    res.json({
      inventory: detailedInventory,
      sc_balance: req.user.character_data.sponsorship_credits || 0
    });
    
  } catch (error) {
    next(error);
  }
});

// Use consumable item
router.post('/inventory/use', [
  body('item_id').notEmpty().withMessage('Item ID required'),
  body('context').optional().isObject().withMessage('Context must be object')
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
    
    const { item_id, context } = req.body;
    
    // Check if user has the item
    const inventory = req.user.inventory || { consumables: {} };
    const itemCount = inventory.consumables[item_id] || 0;
    
    if (itemCount < 1) {
      return res.status(400).json({
        error: {
          type: 'ITEM_NOT_OWNED',
          message: 'You do not have this item'
        }
      });
    }
    
    // Check if item can be used in current context
    const canUse = await this.canUseItem(item_id, context, req.user);
    if (!canUse.valid) {
      return res.status(400).json({
        error: {
          type: 'CANNOT_USE',
          message: canUse.message
        }
      });
    }
    
    // Use the item
    const result = await this.useItem(req.user, item_id, context);
    
    // Update inventory
    inventory.consumables[item_id] = itemCount - 1;
    if (inventory.consumables[item_id] <= 0) {
      delete inventory.consumables[item_id];
    }
    
    await req.user.update({ inventory });
    
    res.json({
      message: 'Item used successfully',
      result,
      remaining: inventory.consumables[item_id] || 0
    });
    
  } catch (error) {
    next(error);
  }
});

// Helper methods
router.filterItemsForUser = function(shopItems, user) {
  const filtered = { ...shopItems };
  const charData = user.character_data;
  
  // Filter consumables
  filtered.consumables = filtered.consumables.filter(item => {
    // Check if user is Fallen (some items not available)
    if (charData.is_fallen && item.not_available_when_fallen) {
      return false;
    }
    
    // Check if user has reached purchase limit
    const userInventory = user.inventory || { consumables: {} };
    const ownedCount = userInventory.consumables?.[item.id] || 0;
    
    if (item.max_stack && ownedCount >= item.max_stack) {
      return false;
    }
    
    return true;
  });
  
  // Filter cosmetics by unlock conditions
  filtered.cosmetics = filtered.cosmetics.filter(item => {
    if (item.unlock_condition) {
      switch(item.unlock_condition) {
        case 'purification_complete':
          return !charData.is_fallen && charData.achievements?.some(a => 
            a.id === 'the_redeemed' || a.id === 'scarred_sage'
          );
        case 'rank_s':
          return ['S', 'SS', 'SSS'].includes(charData.rank);
        default:
          return true;
      }
    }
    return true;
  });
  
  // Filter permanent upgrades
  filtered.permanent = filtered.permanent.filter(item => {
    if (item.requirement) {
      switch(item.requirement) {
        case 'post_ascension':
          return charData.level_offset && charData.level_offset > 0;
        default:
          return true;
      }
    }
    
    // Check purchase limit
    const userInventory = user.inventory || { permanent_upgrades: [] };
    const alreadyPurchased = userInventory.permanent_upgrades?.some(upgrade => 
      upgrade.id === item.id
    );
    
    if (item.purchase_limit === 1 && alreadyPurchased) {
      return false;
    }
    
    return true;
  });
  
  return filtered;
};

router.getItemById = async function(itemId) {
  // In production, this would query a database
  const allItems = {
    'rest_pass': {
      id: 'rest_pass',
      name: 'Rest-Pass (Single)',
      description: 'Grants +60s rest once in a Promotion challenge.',
      cost: 800,
      type: 'consumable',
      rarity: 'Rare',
      usable_in: ['promotion'],
      max_stack: 5
    },
    'dungeon_reroll': {
      id: 'dungeon_reroll',
      name: 'Dungeon Reroll Token',
      description: 'Reroll the next assigned dungeon archetype once.',
      cost: 600,
      type: 'consumable',
      rarity: 'Uncommon',
      max_stack: 3
    },
    // Add other items...
  };
  
  return allItems[itemId] || null;
};

router.checkItemRequirements = function(item, user) {
  const charData = user.character_data;
  
  // Check if user is Fallen
  if (charData.is_fallen && item.not_available_when_fallen) {
    return {
      valid: false,
      message: 'Item not available while Fallen'
    };
  }
  
  // Check special requirements
  if (item.requirement) {
    switch(item.requirement) {
      case 'post_ascension':
        if (!charData.level_offset || charData.level_offset === 0) {
          return {
            valid: false,
            message: 'Requires at least one ascension'
          };
        }
        break;
      case 'purification_complete':
        if (charData.is_fallen || !charData.achievements?.some(a => 
          a.id === 'the_redeemed' || a.id === 'scarred_sage')) {
          return {
            valid: false,
            message: 'Requires completing the Purification Arc'
          };
        }
        break;
    }
  }
  
  return { valid: true };
};

router.checkPurchaseLimit = async function(item, user, quantity) {
  const inventory = user.inventory || {};
  
  if (item.max_stack) {
    const ownedCount = inventory.consumables?.[item.id] || 0;
    if (ownedCount + quantity > item.max_stack) {
      return {
        valid: false,
        message: `Cannot exceed maximum stack of ${item.max_stack}`
      };
    }
  }
  
  if (item.purchase_limit === 1) {
    const alreadyPurchased = inventory.permanent_upgrades?.some(upgrade => 
      upgrade.id === item.id
    );
    if (alreadyPurchased) {
      return {
        valid: false,
        message: 'Already purchased this permanent upgrade'
      };
    }
  }
  
  // Check daily/weekly limits (would be stored in user's progress)
  // Implementation depends on your tracking system
  
  return { valid: true };
};

router.processPurchase = async function(user, item, quantity, totalCost) {
  // Deduct SC
  const newSC = (user.character_data.sponsorship_credits || 0) - totalCost;
  await user.updateCharacterData({
    sponsorship_credits: newSC
  });
  
  // Add to inventory
  const inventory = user.inventory || {
    consumables: {},
    cosmetics: [],
    permanent_upgrades: []
  };
  
  switch(item.type) {
    case 'consumable':
      inventory.consumables[item.id] = (inventory.consumables[item.id] || 0) + quantity;
      break;
      
    case 'cosmetic':
      if (!inventory.cosmetics.some(cosmetic => cosmetic.id === item.id)) {
        inventory.cosmetics.push({
          id: item.id,
          name: item.name,
          acquired_at: new Date().toISOString()
        });
      }
      break;
      
    case 'permanent':
      if (!inventory.permanent_upgrades.some(upgrade => upgrade.id === item.id)) {
        inventory.permanent_upgrades.push({
          id: item.id,
          name: item.name,
          acquired_at: new Date().toISOString(),
          active: true
        });
      }
      break;
  }
  
  await user.update({ inventory });
  
  // Record transaction
  await this.recordTransaction(user, item, quantity, totalCost);
};

router.recordTransaction = async function(user, item, quantity, totalCost) {
  // In production, this would create a transaction record in the database
  const transactions = user.character_data.transactions || [];
  transactions.push({
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    item_id: item.id,
    item_name: item.name,
    quantity,
    unit_cost: item.cost,
    total_cost: totalCost,
    timestamp: new Date().toISOString(),
    type: 'purchase'
  });
  
  await user.updateCharacterData({
    transactions: transactions.slice(-100) // Keep last 100 transactions
  });
};

router.getDetailedInventory = async function(inventory) {
  const detailed = { ...inventory };
  
  // Add item details to consumables
  if (detailed.consumables) {
    const consumableDetails = {};
    for (const [itemId, count] of Object.entries(detailed.consumables)) {
      const item = await this.getItemById(itemId);
      if (item) {
        consumableDetails[itemId] = {
          ...item,
          count
        };
      }
    }
    detailed.consumables = consumableDetails;
  }
  
  return detailed;
};

router.canUseItem = async function(itemId, context, user) {
  const item = await this.getItemById(itemId);
  if (!item) {
    return {
      valid: false,
      message: 'Item not found'
    };
  }
  
  // Check if item can be used in current context
  if (item.usable_in) {
    const currentContext = context?.type || 'general';
    if (!item.usable_in.includes(currentContext)) {
      return {
        valid: false,
        message: `Item can only be used in: ${item.usable_in.join(', ')}`
      };
    }
  }
  
  // Special checks for specific items
  switch(itemId) {
    case 'rest_pass':
      if (context?.type !== 'promotion') {
        return {
          valid: false,
          message: 'Rest-Pass can only be used during promotion challenges'
        };
      }
      break;
      
    case 'retry_token':
      if (context?.type === 'promotion') {
        return {
          valid: false,
          message: 'Retry Tokens cannot be used for promotion challenges'
        };
      }
      break;
  }
  
  return { valid: true };
};

router.useItem = async function(user, itemId, context) {
  const item = await this.getItemById(itemId);
  const result = {
    item: itemId,
    effect: null,
    message: 'Item used'
  };
  
  switch(itemId) {
    case 'rest_pass':
      result.effect = 'add_rest_time';
      result.value = 60; // seconds
      result.message = '+60s rest time added to current challenge';
      break;
      
    case 'dungeon_reroll':
      result.effect = 'reroll_dungeon';
      result.message = 'Next dungeon will be rerolled';
      break;
      
    case 'penalty_negation':
      result.effect = 'negate_penalty';
      result.message = 'Next minor penalty will be negated';
      break;
      
    case 'retry_token':
      result.effect = 'retry_dungeon';
      result.message = 'Granted one retry for failed dungeon';
      break;
  }
  
  // Record item usage
  const itemUsage = user.character_data.item_usage || [];
  itemUsage.push({
    item_id: itemId,
    context,
    timestamp: new Date().toISOString(),
    result
  });
  
  await user.updateCharacterData({
    item_usage: itemUsage.slice(-50) // Keep last 50 usages
  });
  
  return result;
};

export default router;
