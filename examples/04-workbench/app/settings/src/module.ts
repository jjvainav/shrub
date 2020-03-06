import { IWorkbenchConfiguration, WorkbenchModule } from "@app/workbench";
import { IModule, IModuleConfigurator } from "@shrub/core";
import { VueModule } from "@shrub/vue";

export class SettingsModule implements IModule {
    readonly name = "settings";
    readonly dependencies = [
        VueModule,
        WorkbenchModule
    ];

    configure({ config }: IModuleConfigurator): void {
        // TODO: need to use the locale/module values for the title and menu items
        // TODO: load locale based on menu item and not the example (e.g. move locale into menu item)
        config.get(IWorkbenchConfiguration).registerExample({
            name: "settings",
            title: context => context.translate("settings.title"),
            component: () => import(/* webpackChunkName: "settings" */ "./component"),
            locale: locale => import(/* webpackChunkName: "settings.locale.[request]" */ `./locale/${locale}`),
            menu: {
                order: 99,
                title: context => context.translate("settings.title"),
            }
        });
    }    
}