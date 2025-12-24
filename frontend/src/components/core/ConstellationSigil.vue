<template>
  <div class="system-card p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold" :style="{ color: constellationColor }">
        <span class="text-2xl mr-2">🌟</span> CONSTELLATION
      </h3>
      <span class="text-xs px-3 py-1 rounded-full" :class="rarityClass">
        {{ constellationRarity }}
      </span>
    </div>
    
    <!-- Constellation Info -->
    <div class="text-center mb-6">
      <!-- Sigil Display -->
      <div class="relative mx-auto w-32 h-32 mb-4">
        <div class="constellation-sigil w-full h-full"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-4xl" :style="{ color: constellationColor }">
            {{ constellationSymbol }}
          </div>
        </div>
        <!-- Constellation Level Badge -->
        <div class="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-gray-900 border-2 flex items-center justify-center"
             :style="{ borderColor: constellationColor }">
          <span class="font-bold" :style="{ color: constellationColor }">CL{{ constellationLevel }}</span>
        </div>
      </div>
      
      <h4 class="text-2xl font-bold mb-2" :style="{ color: constellationColor }">
        {{ constellationName }}
      </h4>
      <p class="text-lg italic text-gray-300 mb-2">{{ constellationTitle }}</p>
      <p class="text-sm text-gray-400">{{ constellationDescription }}</p>
    </div>
    
    <!-- Effects -->
    <div v-if="activeEffects.length > 0" class="mb-6">
      <h5 class="font-semibold text-gray-300 mb-3">Active Effects</h5>
      <div class="space-y-2">
        <div 
          v-for="effect in activeEffects"
          :key="effect.name"
          class="p-3 bg-gray-800/50 rounded text-sm"
        >
          <div class="flex justify-between items-center">
            <span class="font-medium text-white">{{ effect.name }}</span>
            <span :class="effect.value >= 0 ? 'text-green-400' : 'text-red-400'">
              {{ effect.value >= 0 ? '+' : '' }}{{ effect.value }}{{ effect.unit || '' }}
            </span>
          </div>
          <p class="text-xs text-gray-400 mt-1">{{ effect.description }}</p>
          <div v-if="effect.scaling" class="mt-2 text-xs text-gray-500">
            Scales with CL: +{{ effect.scaling }} per level
          </div>
        </div>
      </div>
    </div>
    
    <!-- Progression -->
    <div class="mb-6">
      <div class="flex justify-between text-sm text-gray-400 mb-1">
        <span>Constellation Experience</span>
        <span>{{ currentXP }}/{{ xpForNextLevel }} XP</span>
      </div>
      <div class="w-full bg-gray-800 rounded-full h-2">
        <div 
          class="h-2 rounded-full transition-all"
          :style="{ 
            width: `${xpProgress}%`,
            background: `linear-gradient(90deg, ${constellationColor}, ${constellationColor}99)`
          }"
        ></div>
      </div>
      <div class="text-xs text-gray-500 mt-1 text-center">
        Level {{ constellationLevel }} → {{ constellationLevel + 1 }}
      </div>
    </div>
    
    <!-- Stats -->
    <div class="pt-4 border-t border-gray-700">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="text-gray-400">Primary Attribute</div>
          <div class="text-lg font-bold" :style="{ color: constellationColor }">
            {{ primaryAttribute }}
          </div>
        </div>
        <div>
          <div class="text-gray-400">Days Sponsored</div>
          <div class="text-lg font-bold text-white">{{ daysSponsored }}</div>
        </div>
      </div>
      
      <div v-if="isCorrupted" class="mt-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
        <div class="flex items-center">
          <span class="text-red-400 mr-2">⚠️</span>
          <span class="text-red-300 font-semibold">CORRUPTED</span>
        </div>
        <p class="text-xs text-red-400/80 mt-1">
          Effects inverted. Complete purification to restore.
        </p>
      </div>
    </div>
    
    <!-- Interaction -->
    <div v-if="showInteraction" class="mt-4">
      <button 
        @click="levelUpConstellation"
        class="system-btn w-full py-3 mb-2"
        :disabled="!canLevelUp || isProcessing"
        :style="{ 
          background: canLevelUp ? `linear-gradient(135deg, ${constellationColor}, ${constellationColor}99)` : ''
        }"
      >
        {{ isProcessing ? 'Processing...' : canLevelUp ? 'LEVEL UP CONSTELLATION' : 'Need More XP' }}
      </button>
      
      <button 
        @click="showEffects = !showEffects"
        class="text-sm text-gray-400 hover:text-white w-full text-center"
      >
        {{ showEffects ? 'Hide All Effects' : 'Show All Effects' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import constellationData from '@/data/constellations.json'

const props = defineProps({
  constellation: {
    type: String,
    default: null
  },
  user: {
    type: Object,
    default: null
  }
})

const showEffects = ref(false)
const isProcessing = ref(false)
const showInteraction = ref(true)

// Computed properties
const constellationInfo = computed(() => {
  if (!props.constellation) return null
  
  // Find in normal constellations
  let info = constellationData.constellations.find(c => c.id === props.constellation)
  
  // If not found, check corrupted
  if (!info) {
    info = constellationData.corruptedConstellations.find(c => c.id === props.constellation)
    if (info) info.isCorrupted = true
  }
  
  return info || {
    id: props.constellation,
    name: 'Unknown Constellation',
    title: 'The Hidden One',
    rarity: 'Common',
    primaryAttribute: 'VIT',
    description: 'A mysterious presence watches over you.',
    effects: []
  }
})

const constellationName = computed(() => constellationInfo.value?.name || 'Unknown')
const constellationTitle = computed(() => constellationInfo.value?.title || '')
const constellationDescription = computed(() => constellationInfo.value?.description || '')
const constellationRarity = computed(() => constellationInfo.value?.rarity || 'Common')
const primaryAttribute = computed(() => constellationInfo.value?.primaryAttribute || 'VIT')
const isCorrupted = computed(() => constellationInfo.value?.isCorrupted || false)

const constellationColor = computed(() => {
  if (isCorrupted.value) return '#9d4edd' // Purple for corrupted
  
  const colors = {
    'Naruto Uzumaki': '#FF6B00',
    'Son Goku': '#FFD700',
    'Levi Ackerman': '#00B4FF',
    'Itachi Uchiha': '#DC2626',
    'Light Yagami': '#000000',
    'Ayanokoji Kiyotaka': '#4B5563',
    'Saitama': '#F59E0B',
    'Eren': '#10B981'
  }
  return colors[constellationName.value] || '#9d4edd'
})

const constellationSymbol = computed(() => {
  const symbols = {
    'Naruto Uzumaki': '🌀',
    'Son Goku': '⚡',
    'Levi Ackerman': '✂️',
    'Itachi Uchiha': '👁️',
    'Light Yagami': '📓',
    'Ayanokoji Kiyotaka': '🎭',
    'Saitama': '👊',
    'Eren': '⚔️'
  }
  return symbols[constellationName.value] || '🌟'
})

const rarityClass = computed(() => {
  const classes = {
    'Common': 'bg-gray-700 text-gray-300',
    'Rare': 'bg-blue-900/50 text-blue-300',
    'VeryRare': 'bg-purple-900/50 text-purple-300',
    'Mythic': 'bg-red-900/50 text-red-300',
    'Legendary': 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 text-yellow-300'
  }
  return classes[constellationRarity.value] || 'bg-gray-800 text-gray-300'
})

const constellationLevel = computed(() => {
  return props.user?.character_data?.constellation_level || 1
})

const currentXP = computed(() => {
  return props.user?.character_data?.constellation_xp || 0
})

const xpForNextLevel = computed(() => {
  // Exponential XP requirement
  return 100 * Math.pow(2, constellationLevel.value - 1)
})

const xpProgress = computed(() => {
  return Math.min(100, (currentXP.value / xpForNextLevel.value) * 100)
})

const canLevelUp = computed(() => {
  return currentXP.value >= xpForNextLevel.value
})

const daysSponsored = computed(() => {
  const sponsoredSince = props.user?.character_data?.constellation_since
  if (!sponsoredSince) return 0
  
  const start = new Date(sponsoredSince)
  const now = new Date()
  const diffTime = Math.abs(now - start)
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
})

const activeEffects = computed(() => {
  const effects = constellationInfo.value?.effects || []
  
  // Apply CL scaling
  return effects.map(effect => {
    const scaledValue = effect.baseValue + ((constellationLevel.value - 1) * (effect.scalingFactor || 0))
    
    return {
      name: effect.name,
      description: effect.description,
      value: isCorrupted.value ? -scaledValue : scaledValue,
      unit: effect.type === 'xp_modifier' ? '%' : '',
      scaling: effect.scalingFactor || 0
    }
  })
})

// Methods
const levelUpConstellation = async () => {
  if (!canLevelUp.value || isProcessing.value) return
  
  isProcessing.value = true
  
  // Simulate API call
  setTimeout(() => {
    // In real app, this would call an API
    console.log(`Leveling up ${constellationName.value} to CL ${constellationLevel.value + 1}`)
    isProcessing.value = false
  }, 1500)
}

onMounted(() => {
  // Check if this is a corrupted constellation for special handling
  if (isCorrupted.value) {
    console.log('Corrupted constellation active:', constellationName.value)
  }
})
</script>

<style scoped>
.constellation-sigil {
  position: relative;
  background: radial-gradient(circle, 
    rgba(157, 78, 221, 0.1) 0%,
    rgba(0, 180, 255, 0.05) 50%,
    transparent 70%);
  border-radius: 50%;
  border: 2px solid;
  border-image: conic-gradient(
    from 0deg,
    transparent,
    var(--constellation-color, #9d4edd),
    transparent,
    var(--constellation-color, #9d4edd),
    transparent
  ) 1;
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.constellation-sigil::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 80%;
  background: conic-gradient(
    from 0deg,
    transparent,
    var(--constellation-color, #9d4edd),
    transparent
  );
  border-radius: 50%;
  animation: rotate 10s linear infinite reverse;
  filter: blur(10px);
  opacity: 0.3;
}
</style>
