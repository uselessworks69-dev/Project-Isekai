<template>
  <div class="system-card p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-bold" :class="gauntletColor">{{ gauntletName }}</h3>
      <div class="text-sm">
        <span class="text-gray-400">Stage</span>
        <span class="ml-2 text-white font-bold">{{ currentStage }}</span>
      </div>
    </div>
    
    <!-- Progress Bar -->
    <div class="mb-6">
      <div class="flex justify-between text-sm text-gray-400 mb-1">
        <span>Progress</span>
        <span>{{ progressPercentage }}% ({{ currentStage }}/80)</span>
      </div>
      <div class="w-full bg-gray-800 rounded-full h-3">
        <div 
          class="h-3 rounded-full transition-all duration-500"
          :class="progressBarColor"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>
    
    <!-- Current Stage Info -->
    <div class="mb-4 p-4 bg-gray-800/50 rounded-lg">
      <h4 class="font-semibold text-white mb-2">Current Stage: {{ currentStage }}</h4>
      <p class="text-sm text-gray-300 mb-3">{{ currentStageInfo?.description || 'Complete to progress' }}</p>
      
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="text-center p-2 bg-gray-900/50 rounded">
          <div class="text-gray-400">XP Reward</div>
          <div class="text-yellow-400 font-bold">{{ currentStageInfo?.xp || 0 }} XP</div>
        </div>
        <div class="text-center p-2 bg-gray-900/50 rounded">
          <div class="text-gray-400">Target</div>
          <div class="text-blue-400 font-bold">{{ formatTarget(currentStageInfo) }}</div>
        </div>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="space-y-3">
      <button 
        @click="completeStage"
        class="system-btn w-full py-3"
        :class="buttonColor"
        :disabled="isCompleting"
      >
        {{ isCompleting ? 'Completing...' : 'Complete Stage' }}
      </button>
      
      <button 
        v-if="isBossStage"
        @click="attemptBoss"
        class="system-btn system-btn-warning w-full py-3"
        :disabled="isCompleting"
      >
        ⚔️ Attempt Boss Stage
      </button>
      
      <button 
        @click="showDetails = !showDetails"
        class="text-sm text-gray-400 hover:text-white w-full text-center"
      >
        {{ showDetails ? 'Hide Details' : 'Show Next Stages' }}
      </button>
    </div>
    
    <!-- Stage Details -->
    <div v-if="showDetails" class="mt-4 pt-4 border-t border-gray-700">
      <h5 class="font-semibold text-gray-300 mb-2">Next Stages</h5>
      <div class="space-y-2 max-h-60 overflow-y-auto">
        <div 
          v-for="stage in nextStages"
          :key="stage.stage"
          class="p-2 rounded text-sm"
          :class="{
            'bg-blue-900/30': stage.stage === currentStage,
            'bg-gray-800/30': stage.stage !== currentStage,
            'border-l-4 border-yellow-500': stage.isBoss
          }"
        >
          <div class="flex justify-between">
            <span class="font-medium">{{ stage.name }}</span>
            <span class="text-yellow-400">{{ stage.xp }} XP</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">{{ formatTarget(stage) }}</div>
        </div>
      </div>
    </div>
    
    <!-- Stats -->
    <div class="mt-4 pt-4 border-t border-gray-700 text-sm">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-gray-400">Total XP</div>
          <div class="text-lg font-bold text-green-400">{{ totalXp.toLocaleString() }}</div>
        </div>
        <div>
          <div class="text-gray-400">Boss Bonuses</div>
          <div class="text-lg font-bold text-purple-400">{{ bossBonuses }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { progressAPI } from '@/services/api'
import gauntletData from '@/data/gauntletStages.json'

const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: value => ['push', 'pull', 'legs', 'core'].includes(value)
  },
  progress: {
    type: Object,
    default: () => ({ current_stage: 1, total_xp: 0, boss_bonuses: [] })
  },
  user: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['stage-completed'])

const isCompleting = ref(false)
const showDetails = ref(false)

// Computed properties
const gauntletName = computed(() => {
  const names = {
    push: 'Push Gauntlet',
    pull: 'Pull Gauntlet', 
    legs: 'Legs Gauntlet',
    core: 'Core Gauntlet'
  }
  return names[props.type] || props.type
})

const gauntletColor = computed(() => {
  const colors = {
    push: 'text-red-400',
    pull: 'text-blue-400',
    legs: 'text-green-400', 
    core: 'text-purple-400'
  }
  return colors[props.type] || 'text-white'
})

const progressBarColor = computed(() => {
  const colors = {
    push: 'bg-gradient-to-r from-red-500 to-orange-500',
    pull: 'bg-gradient-to-r from-blue-500 to-purple-500',
    legs: 'bg-gradient-to-r from-green-500 to-teal-500',
    core: 'bg-gradient-to-r from-purple-500 to-pink-500'
  }
  return colors[props.type] || 'bg-blue-500'
})

const buttonColor = computed(() => {
  const colors = {
    push: 'system-btn-danger',
    pull: 'system-btn',
    legs: 'system-btn-success',
    core: 'system-btn-warning'
  }
  return colors[props.type] || 'system-btn'
})

const currentStage = computed(() => {
  return props.progress?.current_stage || 1
})

const progressPercentage = computed(() => {
  return Math.min(100, (currentStage.value / 80) * 100)
})

const isBossStage = computed(() => {
  return currentStage.value % 10 === 0
})

const currentStageInfo = computed(() => {
  const gauntlet = gauntletData[props.type]
  if (!gauntlet) return null
  
  return gauntlet.stages.find(stage => stage.stage === currentStage.value) || {
    stage: currentStage.value,
    name: `Stage ${currentStage.value}`,
    xp: calculateStageXP(currentStage.value),
    description: 'Progress through the gauntlet'
  }
})

const nextStages = computed(() => {
  const gauntlet = gauntletData[props.type]
  if (!gauntlet) return []
  
  return gauntlet.stages
    .filter(stage => stage.stage >= currentStage.value && stage.stage <= currentStage.value + 4)
    .map(stage => ({
      ...stage,
      isBoss: stage.stage % 10 === 0
    }))
})

const totalXp = computed(() => {
  return props.progress?.total_xp || 0
})

const bossBonuses = computed(() => {
  return props.progress?.boss_bonuses?.length || 0
})

// Methods
const calculateStageXP = (stage) => {
  const xpTable = [
    { range: [1, 10], xp: 10 },
    { range: [11, 20], xp: 20 },
    { range: [21, 30], xp: 30 },
    { range: [31, 40], xp: 40 },
    { range: [41, 50], xp: 60 },
    { range: [51, 60], xp: 80 },
    { range: [61, 70], xp: 110 },
    { range: [71, 80], xp: 160 }
  ]
  
  const entry = xpTable.find(e => stage >= e.range[0] && stage <= e.range[1])
  return entry?.xp || 10
}

const formatTarget = (stage) => {
  if (!stage) return 'N/A'
  
  if (stage.time) return `${stage.time} hold`
  if (stage.reps) return `${stage.reps} reps`
  if (stage.sets && stage.reps) return `${stage.sets} × ${stage.reps}`
  
  return 'Complete stage'
}

const completeStage = async () => {
  if (isCompleting.value) return
  
  isCompleting.value = true
  
  try {
    const xpEarned = calculateStageXP(currentStage.value)
    const isBoss = isBossStage.value
    const bossBonus = isBoss ? xpEarned * 5 : 0
    
    // Call API
    const result = await progressAPI.completeGauntletStage(
      props.type,
      currentStage.value,
      xpEarned,
      isBoss,
      bossBonus
    )
    
    // Emit to parent
    emit('stage-completed', {
      type: props.type,
      stage: currentStage.value,
      xp: xpEarned,
      isBoss,
      bossBonus
    })
    
  } catch (error) {
    console.error('Failed to complete stage:', error)
  } finally {
    isCompleting.value = false
  }
}

const attemptBoss = async () => {
  if (!isBossStage.value) return
  
  // Special boss stage logic would go here
  await completeStage()
}

onMounted(() => {
  // Load additional data if needed
})
</script>

<style scoped>
/* Custom scrollbar for stage list */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 180, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 180, 255, 0.5);
}
</style>
