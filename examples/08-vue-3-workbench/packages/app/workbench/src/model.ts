import { reactive } from "vue";
import { DisplayBreakpoint, IDisplayService } from "./services/display";
import { IWorkbenchExample, IWorkbenchService } from "./services/workbench";

export interface IWorkbenchModel {
    readonly isSidebarOpen: boolean;
    readonly showSidebarToggle: boolean;
    toggleSidebar(): void;
}

export class WorkbenchModel implements IWorkbenchModel {
    private readonly state = reactive({
        current: "",
        isSidebarOpen: true,
        showSidebarToggle: false,
        wasSidebarToggledOpen: false
    });

    constructor(
        @IWorkbenchService private readonly  workbenchService: IWorkbenchService,
        @IDisplayService displayService: IDisplayService) {

        workbenchService.onRouteChanged(() => this.updateCurrentExample(workbenchService.currentExample));
        displayService.onBreakpointChanged(() => this.updateSidebarToggle(displayService.breakpoint));

        this.updateSidebarToggle(displayService.breakpoint);
        this.updateCurrentExample(workbenchService.currentExample);
    }

    get isSidebarOpen(): boolean {
        return this.state.isSidebarOpen;
    }

    get showSidebarToggle(): boolean {
        return this.state.showSidebarToggle;
    }

    getCurrentTitle(): string {
        if (this.state.current) {
            const example = this.workbenchService.getExample(this.state.current);
            if (example) {
                return typeof example.title === "function"
                    ? this.workbenchService.getLocaleString(example.title)
                    : example.title;
            }
        }

        return "";
    }

    toggleSidebar(): void {
        this.state.isSidebarOpen = !this.state.isSidebarOpen;
        this.state.wasSidebarToggledOpen = this.state.isSidebarOpen;
    }

    private updateCurrentExample(example?: IWorkbenchExample): void {
        this.state.current = example ? example.name : "";
    }

    private updateSidebarToggle(breakpoint: DisplayBreakpoint): void {
        const isSmallDisplay = breakpoint === "xs" || breakpoint === "sm";

        this.state.showSidebarToggle = isSmallDisplay;
        this.state.isSidebarOpen = !isSmallDisplay || this.state.wasSidebarToggledOpen;
    }
}