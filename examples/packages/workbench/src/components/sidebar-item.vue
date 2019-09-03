<template>
    <v-list-tile active-class="" :to="getLocation()">
        <v-list-tile-action>
            <v-icon>{{ item.icon }}</v-icon>
        </v-list-tile-action>
        <v-list-tile-title>{{ item.title }}</v-list-tile-title>
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

        // the left area of an item representing an action/icon 
        .v-list__tile__action {
            min-width: $sidebarItemActionWidth !important;
        }
    }
</style>