<template>
    <v-app>
        <sidebar :model="model"></sidebar>
        <toolbar :model="model"></toolbar>
        <v-content>
            <v-fade-transition mode="out-in">
                <router-view></router-view>
            </v-fade-transition>
            <div class="workbench-content-border"></div>
        </v-content>
    </v-app>
</template>

<script lang="ts" src="./workbench"></script>

<style lang="scss">
@import "~@app/ui/theme/scss/main";

html, body {
    height: 100%;
    width: 100%;
    display: flex;
    padding: 0;
    margin: 0;
    overflow: hidden;
}

.workbench-sidebar-brand {
    display: flex;
    justify-content: center;
    height: $toolbar-height;
}
</style>