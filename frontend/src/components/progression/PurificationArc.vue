<template>
  <div class="system-card p-6 fallen-state">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold text-red-400">
        <span class="text-2xl">✝</span> THE PATH OF ATONEMENT
      </h3>
      <div class="text-sm text-gray-400">
        Phase {{ currentPhase }} of {{ totalPhases }}
      </div>
    </div>

    <!-- Phase Display -->
    <div v-if="!isActive" class="text-center py-8">
      <p class="text-gray-300 mb-4">You have walked the path of the Fallen for {{ fallenDays }} days.</p>
      <p class="text-blue-300 mb-6">A chance for purification exists. The cost will be everything.</p>
      <button 
        @click="startPurification"
        class="system-btn system-btn-danger w-full py-3"
        :disabled="fallenDays < 30"
      >
        {{ fallenDays < 30 ? `Wait ${30 - fallenDays} more days` : 'BEGIN PURIFICATION' }}
      </button>
      <p class="text-xs text-gray-500 mt-2">Requires: 30+ days Fallen, 10+ dungeons completed while Fallen</p>
    </div>

    <!-- Active Purification -->
    <div v-else>
      <!-- Phase 1: The Sacrifice -->
      <div v-if="currentPhase === 1" class="phase-container">
        <h4 class="text-lg font-semibold text-yellow-400 mb-4">Phase 1: The Sacrifice</h4>
        <div class="bg-gray-800/50 p-4 rounded-lg mb-4">
          <p class="text-gray-300 mb-3">To begin, you must prove your commitment is not mere calculation.</p>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Forfeit all Sponsorship Credits</span>
              <span class="text-red-400 font-bold">{{ player.sponsorshipCredits }} SC</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Reset Corrupted Constellation Level</span>
              <span class="text-red-400 font-bold">CL {{ player.corruptedCL }} → 1</span>
            </div>
          </div>
        </div>
        <button 
          @click="completeSacrifice"
          class="system-btn system-btn-danger w-full"
          :disabled="isProcessing"
        >
          {{ isProcessing ? 'Processing...' : 'MAKE THE SACRIFICE' }}
        </button>
      </div>

      <!-- Phase 2: Trials of Reflection -->
      <div v-else-if="currentPhase === 2" class="phase-container">
        <h4 class="text-lg font-semibold text-blue-400 mb-4">Phase 2: Trials of Reflection</h4>
        <div class="space-y-4">
          <div 
            v-for="trial in trials" 
            :key="trial.id"
            class="trial-card p-4 rounded-lg"
            :class="{
              'bg-green-900/30 border border-green-700': trial.completed,
              'bg-gray-800/50 border border-gray-700': !trial.completed,
              'border-yellow-600 bg-yellow-900/20': trial.current
            }"
          >
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold" :class="trial.completed ? 'text-green-400' : 'text-white'">
                {{ trial.name }}
              </span>
              <span class="text-xs px-2 py-1 rounded" 
                    :class="trial.completed ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-300'">
                {{ trial.completed ? 'COMPLETED' : trial.current ? 'ACTIVE' : 'LOCKED' }}
              </span>
            </div>
            <p class="text-sm text-gray-400 mb-3">{{ trial.description }}</p>
            <div class="text-xs text-gray-500">
              <div v-if="trial.mechanics" class="mb-2">
                <span class="text-gray-400">Mechanics:</span> {{ trial.mechanics }}
              </div>
              <div v-if="trial.successCondition">
                <span class="text-gray-400">Success:</span> {{ trial.successCondition }}
              </div>
            </div>
            <button 
              v-if="trial.current && !trial.completed"
              @click="attemptTrial(trial.id)"
              class="system-btn system-btn-warning w-full mt-3 text-sm py-2"
            >
              ATTEMPT TRIAL
            </button>
          </div>
        </div>
        
        <div class="mt-6 p-4 bg-blue-900/20 rounded-lg">
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Fallen XP Penalty</span>
            <span class="text-xl font-bold" :class="penaltyColor">
              +{{ currentPenalty }}%
            </span>
          </div>
          <div class="mt-2 text-xs text-gray-400">
            Each trial completed reduces penalty by 5%. Current: {{ completedTrials }}/3 trials
          </div>
        </div>
      </div>

      <!-- Phase 3: Echo of Failure -->
      <div v-else-if="currentPhase === 3" class="phase-container">
        <h4 class="text-lg font-semibold text-purple-400 mb-4">Phase 3: Echo of Failure</h4>
        <div class="bg-gradient-to-r from-purple-900/30 to-gray-900/30 p-6 rounded-lg text-center">
          <div class="text-4xl mb-4">👤</div>
          <h5 class="text-xl font-bold mb-2">Mirror of the Fallen</h5>
          <p class="text-gray-300 mb-4">
            Face a mirror version of yourself at the moment of your original failure.
          </p>
          
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="text-center p-3 bg-gray-800/50 rounded">
              <div class="text-sm text-gray-400">Your Stats</div>
              <div class="text-lg font-bold text-blue-400">{{ player.str }}/{{ player.vit }}/{{ player.agi }}</div>
            </div>
            <div class="text-center p-3 bg-gray-800/50 rounded">
              <div class="text-sm text-gray-400">Mirror Stats</div>
              <div class="text-lg font-bold text-red-400">{{ mirrorStats.str }}/{{ mirrorStats.vit }}/{{ mirrorStats.agi }}</div>
            </div>
          </div>
          
          <p class="text-sm text-yellow-400 mb-4 italic">
            "You must defeat not with superior power, but with the wisdom you lacked."
          </p>
          
          <button 
            @click="startMirrorBattle"
            class="system-btn system-btn-danger w-full py-3"
            :disabled="isInBattle"
          >
            {{ isInBattle ? 'BATTLE IN PROGRESS...' : 'ENTER THE MIRROR' }}
          </button>
        </div>
      </div>

      <!-- Phase 4: Final Atonement -->
      <div v-else-if="currentPhase === 4" class="phase-container">
        <h4 class="text-lg font-semibold text-green-400 mb-4">Phase 4: Final Atonement</h4>
        <div class="text-center py-6">
          <div class="text-5xl mb-4">✨</div>
          <h5 class="text-2xl font-bold mb-2 text-green-300">PURIFICATION ACHIEVED</h5>
          <p class="text-gray-300 mb-6">
            You have proven your change. Choose your path forward:
          </p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div 
              @click="selectOption('purge')"
              class="option-card p-4 rounded-lg cursor-pointer transition-all"
              :class="selectedOption === 'purge' ? 'border-2 border-blue-500 bg-blue-900/20' : 'border border-gray-700 hover:border-blue-400'"
            >
              <div class="text-2xl mb-2">🔄</div>
              <h6 class="font-bold text-lg mb-1">Purge & Reset</h6>
              <p class="text-sm text-gray-400 mb-2">Cleanse the Fallen status completely</p>
              <ul class="text-xs text-left text-gray-300 space-y-1">
                <li>• Return to pre-fall rank</li>
                <li>• Remove all penalties</li>
                <li>• Clean slate</li>
              </ul>
            </div>
            
            <div 
              @click="selectOption('absorb')"
              class="option-card p-4 rounded-lg cursor-pointer transition-all"
              :class="selectedOption === 'absorb' ? 'border-2 border-purple-500 bg-purple-900/20' : 'border border-gray-700 hover:border-purple-400'"
            >
              <div class="text-2xl mb-2">⚔️</div>
              <h6 class="font-bold text-lg mb-1">Absorb & Transcend</h6>
              <p class="text-sm text-gray-400 mb-2">Carry the lesson, forge it into strength</p>
              <ul class="text-xs text-left text-gray-300 space-y-1">
                <li>• Keep current, lower rank</li>
                <li>• Gain "Unbreakable Will" perk</li>
                <li>• Constellation favor increased</li>
              </ul>
            </div>
          </div>
          
          <button 
            @click="completePurification"
            class="system-btn system-btn-success w-full py-3"
            :disabled="!selectedOption"
          >
            COMPLETE PURIFICATION
          </button>
        </div>
      </div>

      <!-- Progress Tracker -->
      <div class="mt-6 pt-4 border-t border-gray-700">
        <div class="flex justify-between text-sm text-gray-400 mb-2">
          <span>Purification Progress</span>
          <span>{{ purificationProgress }}%</span>
        </div>
        <div class="w-full bg-gray-800 rounded-full h-2">
          <div 
            class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-500"
            :style="{ width: `${purificationProgress}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- System Messages -->
    <div v-if="systemMessage" class="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
      <p class="text-sm font-mono text-blue-300">{{ systemMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  player: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['purification-progress'])

// State
const isActive = ref(false)
const currentPhase = ref(1)
const isProcessing = ref(false)
const systemMessage = ref('')
const fallenDays = ref(45) // Example - would come from player data
const selectedOption = ref(null)
const isInBattle = ref(false)

// Trials data
const trials = ref([
  {
    id: 'humility',
    name: 'Trial of Humility',
    description: 'Failed due to arrogance/rushing. Learn patience.',
    mechanics: 'Finish within precise 60s window (not too fast, not too slow)',
    successCondition: 'Finish within window with ≤1 form break',
    completed: false,
    current: true
  },
  {
    id: 'perseverance',
    name: 'Trial of Perseverance',
    description: 'Failed due to lack of preparation. Build endurance.',
    mechanics: 'Stacking debuff: -0.5% power per rep. Complete 150 total reps.',
    successCondition: 'Achieve 150 reps before debuff makes movement impossible',
    completed: false,
    current: false
  },
  {
    id: 'perfection',
    name: 'Trial of Perfection',
    description: 'Failed due to form neglect. Master precision.',
    mechanics: 'Zero-tolerance form-checking. Any deviation = fail.',
    successCondition: 'Complete 3 sets of 5 reps with zero form-break flags',
    completed: false,
    current: false
  }
])

// Mirror stats (would be calculated from player's original failure state)
const mirrorStats = ref({
  str: 45,
  vit: 38,
  agi: 42
})

// Computed
const totalPhases = computed(() => 4)
const completedTrials = computed(() => trials.value.filter(t => t.completed).length)
const currentPenalty = computed(() => {
  const basePenalty = 20
  const reduction = completedTrials.value * 5
  return Math.max(0, basePenalty - reduction)
})
const penaltyColor = computed(() => {
  if (currentPenalty.value >= 15) return 'text-red-400'
  if (currentPenalty.value >= 10) return 'text-yellow-400'
  return 'text-green-400'
})
const purificationProgress = computed(() => {
  let progress = 0
  if (currentPhase.value > 1) progress += 25
  if (currentPhase.value > 2) progress += 25 + (completedTrials.value * 8.33)
  if (currentPhase.value > 3) progress += 25
  if (currentPhase.value > 4) progress = 100
  return Math.min(100, progress)
})

// Methods
const startPurification = () => {
  if (fallenDays.value < 30 || props.player.dungeonsCompletedFallen < 10) {
    systemMessage.value = '[Requirements not met: 30+ days Fallen, 10+ dungeons completed while Fallen]'
    return
  }
  
  isActive.value = true
  systemMessage.value = '[The Path of Atonement has begun. The cost will be everything.]'
  emit('purification-progress', 'started')
}

const completeSacrifice = () => {
  isProcessing.value = true
  
  // Simulate processing
  setTimeout(() => {
    // In real implementation, this would modify player state
    systemMessage.value = `[You have shattered the corrupted bond. ${props.player.sponsorshipCredits} SC lost. CL reset to 1.]`
    
    // Move to next phase
    currentPhase.value = 2
    isProcessing.value = false
    
    emit('purification-progress', 'sacrifice_completed')
  }, 1500)
}

const attemptTrial = (trialId) => {
  const trial = trials.value.find(t => t.id === trialId)
  if (!trial) return
  
  // Simulate trial attempt (in real app, this would trigger a dungeon)
  systemMessage.value = `[Attempting ${trial.name}...]`
  
  setTimeout(() => {
    // 80% success chance for demo
    const success = Math.random() > 0.2
    
    if (success) {
      trial.completed = true
      
      // Activate next trial if available
      const nextTrialIndex = trials.value.findIndex(t => t.id === trialId) + 1
      if (nextTrialIndex < trials.value.length) {
        trials.value[nextTrialIndex].current = true
      }
      
      systemMessage.value = `[${trial.name} COMPLETED! Fallen XP penalty reduced by 5%.]`
      
      // Check if all trials completed
      if (completedTrials.value >= 3) {
        setTimeout(() => {
          currentPhase.value = 3
          systemMessage.value = '[All trials completed. Face your reflection...]'
          emit('purification-progress', 'trials_completed')
        }, 1000)
      }
    } else {
      systemMessage.value = `[${trial.name} FAILED. The path grows harder...]`
    }
  }, 2000)
}

const startMirrorBattle = () => {
  isInBattle.value = true
  systemMessage.value = '[Entering the Mirror... Facing your past failure.]'
  
  // Simulate battle (would be a complex mechanic in real app)
  setTimeout(() => {
    const victory = Math.random() > 0.3 // 70% success for demo
    
    if (victory) {
      setTimeout(() => {
        currentPhase.value = 4
        systemMessage.value = '[VICTORY! You have overcome your past. Choose your final atonement.]'
        isInBattle.value = false
        emit('purification-progress', 'mirror_defeated')
      }, 1000)
    } else {
      systemMessage.value = '[DEFEAT! The mirror was too strong. Try again when ready.]'
      isInBattle.value = false
    }
  }, 3000)
}

const selectOption = (option) => {
  selectedOption.value = option
}

const completePurification = () => {
  if (!selectedOption.value) {
    systemMessage.value = '[You must choose a path forward.]'
    return
  }
  
  isProcessing.value = true
  
  setTimeout(() => {
    const rewards = {
      purge: {
        title: 'The Redeemed',
        message: '[Purge complete. Your sins are cleansed. You return renewed.]',
        perks: ['Rank restored', 'Penalties removed']
      },
      absorb: {
        title: 'Scarred Sage',
        message: '[You absorb the lesson. The Fallen status is removed, but you keep the wisdom.]',
        perks: ['Unbreakable Will perk', '+50% Constellation attraction', 'New CL starts at 3']
      }
    }
    
    const reward = rewards[selectedOption.value]
    
    systemMessage.value = reward.message
    emit('purification-progress', 'purification_complete')
    
    // In real app, this would update player state
    setTimeout(() => {
      // Reset component state
      isActive.value = false
      currentPhase.value = 1
      selectedOption.value = null
      isProcessing.value = false
      
      // Reset trials for next time
      trials.value.forEach(t => {
        t.completed = false
        t.current = t.id === 'humility'
      })
      
      systemMessage.value = '[Purification complete. You are reborn.]'
    }, 2000)
  }, 1500)
}

// Initialize
onMounted(() => {
  // Check if player meets requirements
  if (props.player.isFallen && fallenDays.value >= 30) {
    systemMessage.value = '[A chance for purification exists...]'
  }
})
</script>

<style scoped>
.phase-container {
  animation: fadeIn 0.5s ease;
}

.trial-card {
  transition: all 0.3s ease;
}

.trial-card:hover {
  transform: translateY(-2px);
}

.option-card {
  transition: all 0.3s ease;
}

.option-card:hover {
  transform: translateY(-3px);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
