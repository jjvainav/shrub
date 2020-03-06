<template>
    <div id="settings">
        <input id="toggle-english" class="toggle" type="checkbox" :checked="isEnglish" @click="setLocale('en-US')" />
        <label for="toggle-english">English (US)</label>
        <input id="toggle-spanish" class="toggle" type="checkbox" :checked="isSpanish" @click="setLocale('es')" />
        <label for="toggle-spanish">Spanish</label>
    </div>
</template>

<script lang="ts" src="./settings"></script>

<style>
    #settings {
        padding: 0 20px;
    }
</style>