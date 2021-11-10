import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import { IVueRouterConfiguration, VueRouterModule } from "@shrub/vue-3-router";

export class AppModule {
    name = "app";
    dependencies = [
        HelloModule,
        WorldModule,
        VueModule, 
        VueRouterModule
    ];
    
    configure({ config }) {
        config.get(IVueRouterConfiguration).addRoute({ path: "/", component: { template: "<div></div>" } });
        config.get(IVueConfiguration).mount({ 
            template: '<router-link to="/hello">Hello</router-link>&nbsp;&nbsp;<router-link to="/world">World!</router-link><div><router-view></router-view></div>' 
        });
    }
}

class HelloModule {
    name = "hello";
    dependencies = [VueModule, VueRouterModule];
    
    configure({ config }) {
        config.get(IVueRouterConfiguration).addRoute({ path: "/hello", component: () => import('./hello') });
    }
}

class WorldModule {
    name = "world";
    dependencies = [VueModule, VueRouterModule];
    
    configure({ config }) {
        config.get(IVueRouterConfiguration).addRoute({ path: "/world", component: () => import('./world') });
    }
}