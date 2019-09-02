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
    @import "../styles/variables.scss";

    .workbench-content-border {
        pointer-events: none;
        position: absolute;
        top: 0px;
        left: 0px;
        width: 100%;
        height: 100%;
    }

    .theme--light {
        .workbench-content-border {
            box-shadow: $contentContainerShadowLight;            
        }        
    }
</style>