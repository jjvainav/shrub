<template>
    <div id="intro">
        <div v-html="getCompiledMarkdown()"></div>
    </div>
</template>

<script lang="ts" src="./intro"></script>

<style>
    #intro {
        padding: 0 20px;
    }
</style>