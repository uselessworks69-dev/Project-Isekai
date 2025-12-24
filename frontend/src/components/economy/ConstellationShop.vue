<template>
  <div class="system-card p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold text-yellow-300">
        <span class="text-2xl mr-2">🏪</span> CONSTELLATION SHOP
      </h3>
      <div class="text-right">
        <div class="text-sm text-gray-400">Balance</div>
        <div class="text-2xl font-bold text-yellow-400">{{ userSC }} SC</div>
      </div>
    </div>
    
    <!-- Shop Categories -->
    <div class="mb-6">
      <div class="flex space-x-2 mb-4 overflow-x-auto">
        <button 
          v-for="category in categories"
          :key="category.id"
          @click="selectCategory(category.id)"
          class="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors"
          :class="activeCategory === category.id 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
        >
          {{ category.name }}
          <span v-if="category.count" class="ml-1 text-xs opacity-75">
            ({{ category.count }})
          </span>
        </button>
      </div>
      
      <!-- Category Description -->
      <p class="text-sm text-gray-400 mb-4">
        {{ categoryDescription }}
      </p>
    </div>
    
    <!-- Shop Items Grid -->
    <div v-if="filteredItems.length > 0" class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="item in filteredItems"
          :key="item.id"
          class="shop-item p-4 rounded-lg border transition-all"
          :class="{
            'border-gray-700 hover:border-blue-500 bg-gray-800/30': !item.purchased,
            'border-green-500/50 bg-green-900/20': item.purchased,
            'border-red-500/50 bg-red-900/20': !canAfford(item)
          }"
        >
          <div class="flex justify-between items-start mb-3">
            <div>
              <h4 class="font-bold text-white">{{ item.name }}</h4>
              <span class="text-xs px-2 py-1 rounded" :class="rarityClass(item.rarity)">
                {{ item.rarity }}
              </span>
            </div>
            <div class="text-right">
              <div class="text-xl font-bold text-yellow-400">{{ item.cost }} SC</div>
              <div v-if="item.max_stack" class="text-xs text-gray-400">
                Max: {{ item.max_stack }}
              </div>
            </div>
          </div>
          
          <p class="text-sm text-gray-300 mb-3">{{ item.description }}</p>
          
          <!-- Item Stats -->
          <div v-if="item.stats" class="mb-3">
            <div class="text-xs text-gray-400 mb-1">Effects:</div>
            <div class="space-y-1">
              <div 
                v-for="(value, key) in item.stats"
                :key="key"
                class="text-xs"
              >
                <span class="text-gray-400">{{ formatStatKey(key) }}:</span>
                <span class="ml-1 text-green-400">+{{ value }}</span>
              </div>
            </div>
          </div>
          
          <!-- Requirements -->
          <div v-if="item.requirements" class="mb-3">
            <div class="text-xs text-gray-400 mb-1">Requirements:</div>
            <div class="space-y-1">
              <div 
                v-for="req in item.requirements"
                :key="req"
                class="text-xs flex items-center"
              >
                <span :class="checkRequirement(req) ? 'text-green-400' : 'text-red-400'" class="mr-1">
                  {{ checkRequirement(req) ? '✓' : '✗' }}
                </span>
                <span :class="checkRequirement(req) ? 'text-gray-300' : 'text-gray-500'">
                  {{ formatRequirement(req) }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Purchase Button -->
          <button 
            @click="purchaseItem(item)"
            class="w-full py-2 rounded text-sm font-medium transition-colors"
            :class="getButtonClass(item)"
            :disabled="!canPurchase(item) || isPurchasing"
          >
            {{ getButtonText(item) }}
          </button>
          
          <!-- Owned Info -->
          <div v-if="item.owned" class="text-xs text-center mt-2 text-green-400">
            Owned: {{ item.owned }} / {{ item.max_stack || '∞' }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- No Items -->
    <div v-else class="text-center py-8">
      <div class="text-4xl mb-3">📭</div>
      <h4 class="text-lg font-bold text-gray-300 mb-2">No Items Available</h4>
      <p class="text-gray-400">Complete more challenges to unlock shop items</p>
    </div>
    
    <!-- Inventory -->
    <div v-if="userInventory && Object.keys(userInventory).length > 0" class="mt-6 pt-4 border-t border-gray-700">
      <h5 class="font-semibold text-gray-300 mb-3">Your Inventory</h5>
      <div class="space-y-3">
        <!-- Consumables -->
        <div v-if="userInventory.consumables && Object.keys(userInventory.consumables).length > 0">
          <div class="text-sm text-gray-400 mb-2">Consumables:</div>
          <div class="flex flex-wrap gap-2">
            <div 
              v-for="(count, itemId) in userInventory.consumables"
              :key="itemId"
              class="flex items-center px-3 py-2 bg-gray-800/50 rounded text-sm"
              @click="useItem(itemId)"
            >
              <span class="text-white">{{ getItemName(itemId) }}</span>
              <span class="ml-2 text-yellow-400">×{{ count }}</span>
              <button 
                v-if="canUseItem(itemId)"
                class="ml-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Use
              </button>
            </div>
          </div>
        </div>
        
        <!-- Cosmetics -->
        <div v-if="userInventory.cosmetics && userInventory.cosmetics.length > 0">
          <div class="text-sm text-gray-400 mb-2">Cosmetics:</div>
          <div class="flex flex-wrap gap-2">
            <div 
              v-for="cosmetic in userInventory.cosmetics.slice(0, 5)"
              :key="cosmetic.id"
              class="px-3 py-2 bg-gray-800/50 rounded text-sm"
            >
              <span class="text-white">{{ cosmetic.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Transaction History -->
    <div class="mt-6 pt-4 border-t border-gray-700">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm text-gray-400">Recent Transactions</span>
        <button 
          @click="showTransactions = !showTransactions"
          class="text-xs text-gray-500 hover:text-white"
        >
          {{ showTransactions ? 'Hide' : 'Show' }}
        </button>
      </div>
      
      <div v-if="showTransactions && recentTransactions.length > 0" class="space-y-2 max-h-40 overflow-y-auto">
        <div 
          v-for="tx in recentTransactions"
          :key="tx.id"
          class="p-2 bg-gray-800/30 rounded text-sm"
        >
          <div class="flex justify-between">
            <span class="text-gray-300">{{ tx.item_name }}</span>
            <span class="text-yellow-400">-{{ tx.total_cost }} SC</span>
          </div>
          <div class="text-xs text-gray-500">{{ formatTime(tx.timestamp) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { shopAPI } from '@/services/api'
import shopItemsData from '@/data/shopItems.json'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['purchase-item', 'use-item'])

const activeCategory = ref('consumables')
const isPurchasing = ref(false)
const showTransactions = ref(false)
const userInventory = ref({})
const recentTransactions = ref([])

// Computed properties
const userSC = computed(() => {
  return props.user?.character_data?.sponsorship_credits || 0
})

const categories = computed(() => {
  return [
    { id: 'consumables', name: 'Consumables', count: shopItemsData.consumables.length },
    { id: 'cosmetics', name: 'Cosmetics', count: shopItemsData.cosmetics.length },
    { id: 'permanent', name: 'Permanent', count: shopItemsData.permanent.length },
    { id: 'special', name: 'Special', count: shopItemsData.special?.length || 0 }
  ]
})

const categoryDescription = computed(() => {
  const descriptions = {
    consumables: 'One-time use items for challenges and dungeons',
    cosmetics: 'Visual customizations and titles',
    permanent: 'Lasting upgrades for your journey',
    special: 'Limited-time and exclusive items'
  }
  return descriptions[activeCategory.value] || 'Shop items'
})

const filteredItems = computed(() => {
  const items = shopItemsData[activeCategory.value] || []
  
  return items.map(item => {
    const owned = getUserOwnedCount(item.id)
    return {
      ...item,
      owned,
      purchased: owned > 0
    }
  })
})

// Methods
const selectCategory = (categoryId) => {
  activeCategory.value = categoryId
}

const rarityClass = (rarity) => {
  const classes = {
    'Common': 'bg-gray-700 text-gray-300',
    'Uncommon': 'bg-green-900/50 text-green-300',
    'Rare': 'bg-blue-900/50 text-blue-300',
    'VeryRare': 'bg-purple-900/50 text-purple-300',
    'Epic': 'bg-pink-900/50 text-pink-300',
    'Legendary': 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 text-yellow-300',
    'Mythic': 'bg-gradient-to-r from-red-900/50 to-purple-900/50 text-red-300'
  }
  return classes[rarity] || 'bg-gray-800 text-gray-300'
}

const formatStatKey = (key) => {
  const mappings = {
    'xp_multiplier': 'XP Bonus',
    'rest_time': 'Rest Time',
    'form_tolerance': 'Form Tolerance',
    'key_drop': 'Key Drop Chance'
  }
  return mappings[key] || key.replace('_', ' ').toUpperCase()
}

const formatRequirement = (req) => {
  const mappings = {
    'rank_b': 'Rank B or higher',
    'rank_a': 'Rank A or higher',
    'purification_complete': 'Purification Arc Complete',
    'fallen_state': 'Fallen State Required',
    'post_ascension': 'After First Ascension'
  }
  return mappings[req] || req
}

const checkRequirement = (requirement) => {
  const charData = props.user?.character_data || {}
  
  switch(requirement) {
    case 'rank_b':
      const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']
      return rankOrder.indexOf(charData.rank) >= rankOrder.indexOf('B')
      
    case 'rank_a':
      const rankOrderA = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']
      return rankOrderA.indexOf(charData.rank) >= rankOrderA.indexOf('A')
      
    case 'purification_complete':
      return !charData.is_fallen && charData.achievements?.some(a => 
        a.id === 'the_redeemed' || a.id === 'scarred_sage'
      )
      
    case 'fallen_state':
      return charData.is_fallen
      
    case 'post_ascension':
      return charData.level_offset && charData.level_offset > 0
      
    default:
      return true
  }
}

const canAfford = (item) => {
  return userSC.value >= item.cost
}

const canPurchase = (item) => {
  if (!canAfford(item)) return false
  
  // Check requirements
  if (item.requirements) {
    return item.requirements.every(req => checkRequirement(req))
  }
  
  // Check purchase limits
  if (item.max_stack) {
    const owned = getUserOwnedCount(item.id)
    return owned < item.max_stack
  }
  
  if (item.purchase_limit === 1 && getUserOwnedCount(item.id) > 0) {
    return false
  }
  
  return true
}

const getUserOwnedCount = (itemId) => {
  const inventory = props.user?.inventory || {}
  
  if (inventory.consumables && inventory.consumables[itemId]) {
    return inventory.consumables[itemId]
  }
  
  if (inventory.cosmetics && inventory.cosmetics.some(c => c.id === itemId)) {
    return 1
  }
  
  if (inventory.permanent_upgrades && inventory.permanent_upgrades.some(u => u.id === itemId)) {
    return 1
  }
  
  return 0
}

const getButtonClass = (item) => {
  if (!canPurchase(item)) return 'bg-gray-700 text-gray-400 cursor-not-allowed'
  if (item.purchased) return 'bg-green-600 text-white hover:bg-green-700'
  return 'bg-blue-600 text-white hover:bg-blue-700'
}

const getButtonText = (item) => {
  if (!canPurchase(item)) {
    if (!canAfford(item)) return 'Insufficient SC'
    if (item.requirements && !item.requirements.every(req => checkRequirement(req))) return 'Requirements Not Met'
    if (getUserOwnedCount(item.id) >= (item.max_stack || Infinity)) return 'Maximum Owned'
    return 'Cannot Purchase'
  }
  
  if (item.purchased) return 'Already Owned'
  return `Purchase (${item.cost} SC)`
}

const getItemName = (itemId) => {
  // Search through all categories for item name
  for (const category of Object.values(shopItemsData)) {
    if (Array.isArray(category)) {
      const item = category.find(i => i.id === itemId)
      if (item) return item.name
    }
  }
  return itemId
}

const canUseItem = (itemId) => {
  // Check if item can be used (consumables only)
  const item = shopItemsData.consumables.find(i => i.id === itemId)
  return item && item.type === 'consumable'
}

const purchaseItem = async (item) => {
  if (!canPurchase(item) || isPurchasing.value) return
  
  isPurchasing.value = true
  
  try {
    emit('purchase-item', {
      itemId: item.id,
      quantity: 1
    })
    
    // Record transaction
    recentTransactions.value.unshift({
      id: `tx_${Date.now()}`,
      item_id: item.id,
      item_name: item.name,
      total_cost: item.cost,
      timestamp: new Date().toISOString()
    })
    
    // Keep only last 10 transactions
    if (recentTransactions.value.length > 10) {
      recentTransactions.value = recentTransactions.value.slice(0, 10)
    }
    
  } catch (error) {
    console.error('Purchase failed:', error)
  } finally {
    isPurchasing.value = false
  }
}

const useItem = (itemId) => {
  if (!canUseItem(itemId)) return
  
  emit('use-item', {
    itemId,
    context: { type: 'general' }
  })
}

const formatTime = (timestamp) => {
  if (!timestamp) return 'Recently'
  const time = new Date(timestamp)
  const now = new Date()
  const diffHours = Math.floor((now - time) / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// Load user inventory
onMounted(() => {
  userInventory.value = props.user?.inventory || {
    consumables: {},
    cosmetics: [],
    permanent_upgrades: []
  }
  
  // Load transaction history from localStorage
  const savedTransactions = localStorage.getItem('isekai_transactions')
  if (savedTransactions) {
    try {
      recentTransactions.value = JSON.parse(savedTransactions)
    } catch (e) {
      console.error('Failed to load transactions:', e)
    }
  }
  
  // Save transactions periodically
  setInterval(() => {
    localStorage.setItem('isekai_transactions', JSON.stringify(recentTransactions.value))
  }, 30000)
})
</script>

<style scoped>
.shop-item {
  transition: all 0.3s ease;
}

.shop-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(245, 158, 11, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(245, 158, 11, 0.5);
}
</style>
