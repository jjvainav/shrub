import { IServiceCollection } from "@shrub/service-collection";
import { DisplayBreakpoint, IDisplayService } from "./services";

export interface IWorkbenchModel {
    readonly isSidebarOpen: boolean;
    readonly showSidebarToggle: boolean;
    toggleSidebar(): void;
}

export class WorkbenchModel implements IWorkbenchModel {
    isSidebarOpen = true;
    showSidebarToggle = false;
    wasSidebarToggledOpen = false;

    constructor(private readonly services: IServiceCollection) {
        const displayService = this.services.get(IDisplayService);
        displayService.onBreakpointChanged(() => { 
            this.updateSidebarToggle(displayService.breakpoint);
        });

        this.updateSidebarToggle(displayService.breakpoint);
    }

    toggleSidebar(): void {
        this.isSidebarOpen = !this.isSidebarOpen;
        this.wasSidebarToggledOpen = this.isSidebarOpen;
    }

    private updateSidebarToggle(breakpoint: DisplayBreakpoint): void {
        const isSmallDisplay = breakpoint === DisplayBreakpoint.extraSmall || breakpoint === DisplayBreakpoint.small;

        this.showSidebarToggle = isSmallDisplay;
        this.isSidebarOpen = !isSmallDisplay || this.wasSidebarToggledOpen;
    }
}