<template>
    <v-list-tile v-if="!hasChildren(item)" active-class="" :to="getLocation(item)">
        <v-list-tile-action>
            <v-icon>{{ item.icon }}</v-icon>
        </v-list-tile-action>
        <v-list-tile-title>{{ item.title }}</v-list-tile-title>
    </v-list-tile>
    <v-list-group v-else append-icon="" :value="hasActiveChild">
        <template v-slot:activator>
            <v-list-tile active-class="" @click.stop="onClick" :to="getLocation(item)">
                <v-list-tile-action>
                    <v-icon>{{ item.icon }}</v-icon>
                </v-list-tile-action>
                <v-list-tile-title>{{ item.title }}</v-list-tile-title>
            </v-list-tile>
        </template>
        <template v-for="child in getChildren()">
            <sidebar-item v-if="hasChildren(child)" :model="model" :item="child" :key="$key(child)"/>
            <!-- note: v-list-tile extends router-link, the to and exact props are handled by view-router -->
            <v-list-tile v-else :to="getLocation(child)" active-class="" :class="getChildClass()" :exact="true" :key="$key(child)">
                <v-list-tile-action>
                    <v-icon small>{{ child.icon }}</v-icon>
                </v-list-tile-action>
                <v-list-tile-title>{{ child.title }}</v-list-tile-title>
            </v-list-tile>
        </template>
    </v-list-group>
</template>

<script lang="ts" src="./sidebar-item"></script>

<style lang="scss">
    @import "../styles/variables.scss";

    .workbench-sidebar {
        // disable/hide the hover for the group header as the list-tile representing the header will have it's own hover
        .v-list__group__header:hover {
            background: rgba(#ffffff, 0) !important;
        }

        // hide the divider that gets added before/after the list group when expanded
        .v-list__group::after,
        .v-list__group::before {
            height: 0 !important;
        }

        .v-list.theme--dark {
            // the entire group containing the currently expanded/active item and children
            .v-list__group--active {
                background-color: $sidebarItemGroupBackgroundDark;
            }

            // sets the color for the indicator
            .v-list__group--active > .v-list__group__header::before,
            .v-list__group--active > .v-list__group__items::before {
                background: $sidebarItemIndicatorBackgroundDark;
            }
        }

        .v-list.theme--light {
            // the entire group containing the currently expanded/active item and children
            .v-list__group--active {
                background-color: $sidebarItemGroupBackgroundLight;
            }

            // sets the color for the indicator
            .v-list__group--active > .v-list__group__header::before,
            .v-list__group--active > .v-list__group__items::before {
                background: $sidebarItemIndicatorBackgroundLight;
            }
        }

        // select the item if it does not have children
        .v-list > :not(.v-list__group) {
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

        // adds the indicator to the left side of the currently expanded/active item and children
        .v-list__group--active > .v-list__group__header::before,
        .v-list__group--active > .v-list__group__items::before {
            bottom: 0;
            content: "";
            left: 0;
            position: absolute;
            top: 0;
            width: $sidebarItemIndicatorWidth;        
        }

        // a group of child items
        .v-list__group__items {
            // the left indicator for the currently selected/active child item
            .v-list__tile--active::before {
                background: $sidebarItemIndicatorActiveBackground;
                bottom: 0;
                content: "";
                left: 0;
                position: absolute;
                top: 0;
                width: $sidebarItemIndicatorWidth; 
                z-index: 999;
            }

            // currently selected/active child item
            .v-list__tile--active.theme--dark {
                background: $sidebarItemActiveBackgroundDark;
            }

            // currently selected/active child item
            .v-list__tile--active.theme--light {
                background: $sidebarItemActiveBackgroundLight;
            }   
        }

        // the left area of an item representing an action/icon 
        .v-list__tile__action {
            min-width: $sidebarItemActionWidth !important;
        }
    }
</style>