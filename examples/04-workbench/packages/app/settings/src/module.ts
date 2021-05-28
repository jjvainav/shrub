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
        config.get(IWorkbenchConfiguration).registerExample({
            name: "settings",
            title: context => context.translate("settings.example.title"),
            locale: locale => import(/* webpackChunkName: "settings.locale.[request]" */ `./locale/example/${locale}`),
            content: {
                component: () => import(/* webpackChunkName: "settings" */ "./component"),
                locale: locale => import(/* webpackChunkName: "settings.content.locale.[request]" */ `./locale/content/${locale}`)
            },
            menu: {
                order: 99,
                title: context => context.translate("settings.example.title"),
            }
        });
    }    
}