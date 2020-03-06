<template>
    <v-list-tile active-class="" :to="getLocation()">
        <v-list-tile-title>{{ getTitle() }}</v-list-tile-title>
    </v-list-tile>
</template>

<script lang="ts" src="./sidebar-item"></script>

<style lang="scss">
    @import "../styles/variables.scss";

    .workbench-sidebar {
        .v-list {
            .v-list__tile--active::before {
                background: $sidebarItemIndicatorActiveBackground;
                bottom: 0;
                content: "";
                left: 0;
                position: absolute;
                top: 0;
                width: $sidebarItemIndicatorWidth; 
            }
        }
    }
</style>