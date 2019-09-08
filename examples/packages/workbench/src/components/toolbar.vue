<template>
    <v-toolbar 
        :class="['workbench-toolbar', { 'workbench-toolbar--menu': model.showSidebarToggle }]"
        height="54px"
        flat
        app>
        <v-toolbar-items v-if="model.showSidebarToggle" @click.stop="model.toggleSidebar">
            <v-btn class="workbench-toolbar-icon-btn workbench-toolbar-toggle-btn" :ripple="false" flat>
                <v-icon>menu</v-icon>
            </v-btn>
        </v-toolbar-items>
        <v-toolbar-title>{{ model.getCurrentTitle() }}</v-toolbar-title>
    </v-toolbar>
</template>

<script lang="ts" src="./toolbar"></script>

<style lang="scss">
    @import "../styles/variables.scss";

    // remove the right padding for the toolbar
    .workbench-toolbar > .v-toolbar__content {
        padding-right: 0;
    }

    .workbench-toolbar.theme--light {
        background-color: $toolbarBackgroundLight !important;

        .workbench-toolbar-toggle-btn {
            border-right: 1px solid $toolbarToggleBorderLight;
        }        
    }

    // remove left padding when menu button is visible
    .workbench-toolbar--menu > .v-toolbar__content {
        padding-left: 0;
    }

    .workbench-toolbar-icon-btn {
        border-radius: 0px !important;
        min-width: $toolbarIconButtonWidth !important;
    }
</style>