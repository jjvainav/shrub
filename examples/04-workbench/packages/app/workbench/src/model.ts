import { DisplayBreakpoint, IDisplayService, IWorkbenchExample, IWorkbenchService } from "./services";

export interface IWorkbenchModel {
    readonly isSidebarOpen: boolean;
    readonly showSidebarToggle: boolean;
    toggleSidebar(): void;
}

export class WorkbenchModel implements IWorkbenchModel {
    private readonly workbenchService!: IWorkbenchService;

    current = "";
    isSidebarOpen = true;
    showSidebarToggle = false;
    wasSidebarToggledOpen = false;

    constructor(
        @IWorkbenchService workbenchService: IWorkbenchService,
        @IDisplayService displayService: IDisplayService) {
        this.setNonReactive("workbenchService", workbenchService);

        workbenchService.onRouteChanged(() => this.updateCurrentExample(workbenchService.currentExample));
        displayService.onBreakpointChanged(() => this.updateSidebarToggle(displayService.breakpoint));

        this.updateSidebarToggle(displayService.breakpoint);
        this.updateCurrentExample(workbenchService.currentExample);
    }

    getCurrentTitle(): string {
        if (this.current) {
            const example = this.workbenchService.getExample(this.current);
            if (example) {
                return typeof example.title === "function"
                    ? this.workbenchService.getLocaleString(example.title)
                    : example.title;
            }
        }

        return "";
    }

    toggleSidebar(): void {
        this.isSidebarOpen = !this.isSidebarOpen;
        this.wasSidebarToggledOpen = this.isSidebarOpen;
    }

    private setNonReactive(name: string, value: any): void {
        // the model is expected to be reactive but not all properties should be (e.g. injected services)
        // by defining a property as non-enumerable vue will not be able to discover and make it reactive
        Object.defineProperty(this, name, { value, enumerable: false });
    }

    private updateCurrentExample(example?: IWorkbenchExample): void {
        this.current = example ? example.name : "";
    }

    private updateSidebarToggle(breakpoint: DisplayBreakpoint): void {
        const isSmallDisplay = breakpoint === DisplayBreakpoint.extraSmall || breakpoint === DisplayBreakpoint.small;

        this.showSidebarToggle = isSmallDisplay;
        this.isSidebarOpen = !isSmallDisplay || this.wasSidebarToggledOpen;
    }
}