<template>
    <div class="d-flex sidebar">
        <div class="sidebar-items"> 
            <slot name="brand"></slot>
            <sidebar-item v-for="(item, index) of items" :key="`top-${index}`" :item="item"></sidebar-item>
            <div v-if="hasPanel()" class="sidebar-item sidebar-toggle">
                <a role="button" class="sidebar-item-link" href="#" @click.prevent="togglePanel">
                    <i class="sidebar-item-icon" :class="getToggleIconClass()"></i>
                </a>
            </div>
        </div>
        <sidebar-panel v-if="!detachPanel" :state="state"></sidebar-panel>
    </div>
</template>

<script lang="ts" src="./sidebar"></script>

<style lang="scss">
@import "~@app/ui/theme/scss/variables";

.sidebar-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    color: $white !important;
    text-decoration: none;

    &:hover {
        color: $white;
    }
}

.sidebar-item {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    height: 40px;
    @include transition($btn-transition);

    a:hover {
        color: $white;
    }

    &.active {
        background-color: $sidebar-item-active-background-color;
        @include border-radius($btn-border-radius-sm);
    }

    &.active a {
        color: $white;
    }
}

.sidebar-item-icon {
    display: flex;
}

.sidebar-item-link {
    text-decoration: none;
}

.sidebar-items {
    display: flex;
    flex-direction: column;
    background-color: $sidebar-items-background-color;
    padding-left: 10px;
    padding-right: 10px;
    width: $sidebar-items-width;
    z-index: $sidebar-items-z-index;
    
    a {
        color: rgba($white, .55);
    }
}

.sidebar-panel {
    background-color: $sidebar-panel-background-color;
    display: flex;
    flex-direction: column;
    border-right: $sidebar-panel-border;
    min-width: $sidebar-panel-width;
    padding-left: 10px;
    padding-right: 10px;
    transition: margin 0.2s ease-in-out;
    z-index: $sidebar-panel-z-index;

    &.collapsed {
        margin-left: -$sidebar-panel-width;
    }
}

.sidebar-panel-group-title {
    border-bottom: $sidebar-panel-group-title-border;
    color: $sidebar-panel-group-title-color;
    display: flex;
    justify-content: center;
    flex-direction: column;
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 8px;
    height: $toolbar-height;
    width: 100%;
}

.sidebar-panel-link {
    color: $sidebar-panel-link-color;
    padding: 6px 20px;
    text-decoration: none;
    line-height: 14px;

    &.active,
    &:hover {
        background-color: $sidebar-panel-link-hover-background-color;
        @include border-radius($btn-border-radius-sm);
        color: $sidebar-panel-link-hover-color;
    }
}

.sidebar-toggle {
    margin-top: auto;
    margin-bottom: 4px;
}
</style>