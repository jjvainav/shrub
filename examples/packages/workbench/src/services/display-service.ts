import { EventEmitter, IEvent } from "@shrub/event-emitter";
import { DOMEventEmitter } from "@shrub/event-emitter-dom";
import { createService, Singleton } from "@shrub/service-collection";

export const IDisplayService = createService<IDisplayService>("display-service");

export enum DisplayBreakpoint {
    extraSmall = "xs",
    small = "sm",
    medium = "md",
    large = "lg",
    extraLarge = "xl"
}

export interface IDisplayBreakpoints {
    readonly extraSmall: number;
    readonly small: number;
    readonly medium: number;
    readonly large: number;
}

export interface IDisplayService {
    readonly onBreakpointChanged: IEvent;
    readonly onResize: IEvent;
    readonly breakpoint: DisplayBreakpoint;
    readonly breakpoints: IDisplayBreakpoints;
    getDisplayWidth(): number;
    setBreakpoints(breakpoints: IDisplayBreakpoints): void;
}

@Singleton
export class DisplayService implements IDisplayService {
    private readonly breakpointChanged = new EventEmitter("display-breakpoint-changed");
    private readonly resize = new DOMEventEmitter("display-resize", "resize");
    private _breakpoint!: DisplayBreakpoint;
    private _breakpoints: IDisplayBreakpoints;

    constructor() {
        // breakpoints used by Bootstrap 4
        this._breakpoints = {
            extraSmall: 576,
            small: 768,
            medium: 992,
            large: 1200
        };

        this.resize.bindTarget(window);
        this.resize.event.debounce(200)(() => this.updateBreakpoint());

        this.updateBreakpoint();
    }

    get onBreakpointChanged(): IEvent {
        return this.breakpointChanged.event;
    }

    get onResize(): IEvent {
        return this.resize.event;
    }

    get breakpoint(): DisplayBreakpoint {
        return this._breakpoint;
    }

    get breakpoints(): IDisplayBreakpoints {
        return this._breakpoints;
    }

    getDisplayWidth(): number {
        if (typeof document === "undefined") {
            // server-side rendering
            return 0;
        }

        return Math.max(document.documentElement!.clientWidth, window.innerWidth || 0);
    }

    setBreakpoints(breakpoints: IDisplayBreakpoints): void {
        // TODO: validate breakpoints
        this._breakpoints = breakpoints;
        this.updateBreakpoint();
    }

    private getBreakpointForWidth(breakpoints: IDisplayBreakpoints, width: number): DisplayBreakpoint {
        if (width < breakpoints.extraSmall) {
            return DisplayBreakpoint.extraSmall;
        }
        
        if (width < breakpoints.small) {
            return DisplayBreakpoint.small
        }
        
        if (width < breakpoints.medium) {
            return DisplayBreakpoint.medium;
        }
        
        if (width < breakpoints.large) {
            return DisplayBreakpoint.large;
        }
        
        return DisplayBreakpoint.extraLarge;
    }

    private setBreakpoint(breakpoint: DisplayBreakpoint): void {
        if (this._breakpoint !== breakpoint) {
            this._breakpoint = breakpoint;
            this.breakpointChanged.emit();
        }
    }

    private updateBreakpoint(): void {
        const width = this.getDisplayWidth();
        this.setBreakpoint(this.getBreakpointForWidth(this.breakpoints, width));
    }
}