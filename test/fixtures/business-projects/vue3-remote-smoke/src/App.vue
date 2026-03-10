<template>
  <main class="fixture-shell">
    <h1>Business Fixture</h1>
    <p>{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
const message = 'Remote loading smoke fixture';
</script>

<style scoped>
.fixture-shell {
  padding: 24px;
}
</style>
