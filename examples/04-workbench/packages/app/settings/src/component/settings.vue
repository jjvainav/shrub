<template>
    <div id="settings">
        <ul class="language-list">
            <li class="language">
                <div class="view">
                    <input id="toggle-english" class="toggle" type="checkbox" :checked="isEnglish" @click="setLocale('en-US')" />
                    <label for="toggle-english">{{ $t("settings.content.englishUS") }}</label>                    
                </div>
            </li>
            <li class="language">
                <div class="view">
                    <input id="toggle-french" class="toggle" type="checkbox" :checked="isFrench" @click="setLocale('fr')" />
                    <label for="toggle-french">{{ $t("settings.content.french") }}</label>                    
                </div>
            </li>
            <li class="language">
                <div class="view">
                    <input id="toggle-spanish" class="toggle" type="checkbox" :checked="isSpanish" @click="setLocale('es')" />
                    <label for="toggle-spanish">{{ $t("settings.content.spanish") }}</label>                    
                </div>
            </li>
        </ul>
    </div>
</template>

<script lang="ts" src="./settings"></script>

<style scoped>
    #settings {
        padding: 20px;
    }

    .language-list {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .language-list li {
        position: relative;
        font-size: 24px;
    }

    .language-list li .toggle {
        text-align: center;
        width: 40px;
        /* auto, since non-WebKit browsers doesn't support input styling */
        height: auto;
        position: absolute;
        top: 0;
        bottom: 0;
        margin: auto 0;
        border: none; /* Mobile Safari */
        -webkit-appearance: none;
        appearance: none;
    }

    .language-list li .toggle {
        opacity: 0;
    }

    .language-list li .toggle + label {
        /*
            Firefox requires `#` to be escaped - https://bugzilla.mozilla.org/show_bug.cgi?id=922433
            IE and Edge requires *everything* to be escaped to render, so we do that instead of just the `#` - https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/7157459/
        */
        background-image: url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%22-10%20-18%20100%20135%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22%23ededed%22%20stroke-width%3D%223%22/%3E%3C/svg%3E');
        background-repeat: no-repeat;
        background-position: center left;
    }

    .language-list li .toggle:checked + label {
        background-image: url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%22-10%20-18%20100%20135%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22%23bddad5%22%20stroke-width%3D%223%22/%3E%3Cpath%20fill%3D%22%235dc2af%22%20d%3D%22M72%2025L42%2071%2027%2056l-4%204%2020%2020%2034-52z%22/%3E%3C/svg%3E');
    }

    .language-list li label {
        word-break: break-all;
        padding: 15px 15px 15px 60px;
        display: block;
        line-height: 1.2;
        transition: color 0.4s;
    }    

    /*
        Hack to remove background from Mobile Safari.
        Can't use it globally since it destroys checkboxes in Firefox
    */
    @media screen and (-webkit-min-device-pixel-ratio:0) {
        .todo-list li .toggle {
            background: none;
        }

        .todo-list li .toggle {
            height: 40px;
        }
    }
</style>