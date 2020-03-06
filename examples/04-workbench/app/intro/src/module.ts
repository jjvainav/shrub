import { IWorkbenchConfiguration, WorkbenchModule } from "@app/workbench";
import { IModule, IModuleConfigurator } from "@shrub/core";
import { VueModule } from "@shrub/vue";
import { VueI18nModule } from "@shrub/vue-i18n";

export class IntroModule implements IModule {
    readonly name = "intro";
    readonly dependencies = [
        VueModule,
        VueI18nModule,
        WorkbenchModule
    ];

    configure({ config }: IModuleConfigurator): void {
        config.get(IWorkbenchConfiguration).registerExample({
            name: "intro",
            title: context => context.translate("intro.title"),
            component: () => import(/* webpackChunkName: "intro" */ "./component"),
            locale: locale => import(/* webpackChunkName: "intro.locale.[request]" */ `./locale/${locale}`),
            menu: {
                order: 1,
                title: context => context.translate("intro.title"),
            }
        });
    }    
}