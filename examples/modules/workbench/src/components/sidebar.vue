<template>
    <!-- note: floating removes the border-right from the sidebar -->
    <v-navigation-drawer 
        class="workbench-sidebar"
        :dark="model.isDarkTheme"
        :permanent="model.isSidebarOpen" 
        :value="model.isSidebarOpen" 
        width="250" 
        app 
        floating
        hide-overlay
        stateless>
        <div>
            <router-link class="workbench-sidebar-logo" to="/">
                <logo></logo>
            </router-link>
            <v-list>
                <sidebar-item v-for="item of menuItems" :key="$key(item)" :model="model" :item="item" />
            </v-list>
        </div>
    </v-navigation-drawer>
</template>

<script lang="ts" src="./sidebar"></script>

<style lang="scss">
    @import "../styles/variables.scss";

    .workbench-sidebar {
        // allow visible overflow for the logo right border
        overflow: visible !important;
        z-index: $sidebarZIndex;
    }

    .workbench-sidebar-logo {
        box-sizing: content-box;
        color: inherit;
        display: block;
        height: $toolbarHeight;
        text-decoration: none;
    }    

    .workbench-sidebar.theme--dark {
        background-color: $sidebarBackgroundDark !important;

        .workbench-sidebar-logo {
            box-shadow: $sidebarLogoShadowDark;
        }          
    }

    .workbench-sidebar.theme--light {
        background-color: $sidebarBackgroundLight !important;

        .workbench-sidebar-logo {
            box-shadow: $sidebarLogoShadowLight;
        }        
    }
</style>