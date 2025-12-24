<template>
  <header class="border-b border-gray-700 bg-gradient-to-r from-gray-900 to-blue-900/30">
    <div class="container mx-auto px-4 py-4">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <!-- Player Identity -->
        <div class="mb-4 md:mb-0">
          <h1 class="text-2xl font-bold text-blue-300">{{ player.name }}</h1>
          <div class="flex items-center space-x-4 mt-2">
            <div class="flex items-center">
              <span class="text-sm text-gray-400 mr-2">Rank:</span>
              <span :class="rankClass" class="px-3 py-1 rounded-full font-bold">
                {{ player.rank }}
              </span>
            </div>
            <div class="text-sm">
              <span class="text-gray-400">Level</span>
              <span class="ml-1 text-white">{{ player.level }}</span>
            </div>
            <div v-if="player.isFallen" class="text-red-400 font-bold glitch">
              [FALLEN]
            </div>
          </div>
        </div>
        
        <!-- Core Stats Display -->
        <div class="grid grid-cols-5 gap-4">
          <div v-for="stat in ['STR', 'AGI', 'VIT', 'SEN', 'INT']" 
               :key="stat"
               class="text-center"
               :class="getStatColor(stat)">
            <div class="text-xs text-gray-400">{{ stat }}</div>
            <div class="text-xl font-bold">{{ player[stat.toLowerCase()] }}</div>
          </div>
        </div>
        
        <!-- Resources -->
        <div class="mt-4 md:mt-0">
          <div class="flex space-x-6">
            <div class="text-center">
              <div class="text-sm text-gray-400">Dungeon Keys</div>
              <div class="text-xl text-yellow-400 font-bold">{{ player.dungeonKeys }}</div>
            </div>
            <div class="text-center">
              <div class="text-sm text-gray-400">Sponsor Credits</div>
              <div class="text-xl text-green-400 font-bold">{{ player.sponsorshipCredits }}</div>
            </div>
            <div v-if="player.activeConstellation" class="text-center">
              <div class="text-sm text-gray-400">Constellation</div>
              <div class="text-lg text-purple-300">{{ getConstellationName() }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  player: {
    type: Object,
    required: true
  }
})

const rankClass = computed(() => {
  const colors = {
    'F': 'bg-gray-600 text-gray-300',
    'E': 'bg-gray-500 text-white',
    'D': 'bg-green-700 text-white',
    'C': 'bg-blue-700 text-white',
    'B': 'bg-purple-700 text-white',
    'A': 'bg-red-700 text-white',
    'S': 'bg-yellow-600 text-black',
    'SS': 'bg-orange-500 text-black',
    'SSS': 'bg-gradient-to-r from-yellow-400 to-red-500 text-black'
  }
  return colors[props.player.rank] || colors['F']
})

const getStatColor = (stat) => {
  const colors = {
    'STR': 'text-red-400',
    'AGI': 'text-green-400',
    'VIT': 'text-yellow-400',
    'SEN': 'text-blue-400',
    'INT': 'text-purple-400'
  }
  return colors[stat]
}

const getConstellationName = () => {
  // This would come from your constellation data
  const constellations = {
    'naruto': 'Naruto',
    'goku': 'Son Goku',
    'levi': 'Levi Ackerman',
    'corrupted_goku': 'Black Goku'
  }
  return constellations[props.player.activeConstellation] || 'Unknown'
}
</script>
