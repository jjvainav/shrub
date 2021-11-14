<template>
    <div>
        <button @click="setLocale('en-US')">English</button>
        <button @click="setLocale('es')">Spanish</button>
        <div>{{ t("main.hello") }}</div>
    </div>
</template>

<script src="./main"></script>