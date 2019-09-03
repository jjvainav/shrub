import { EventEmitter } from "@shrub/event-emitter";

/**
 * An event emitter that listens for and forwards DOM events to registered callbacks.
 * This is optimized to only listen for DOM events if a callback has been registered with the emitter.
 */
export class DOMEventEmitter<TArgs = void> extends EventEmitter<TArgs> {
    private readonly listener: any;
    private target?: EventTarget;

    private isRegistered = false;

    constructor(
        name: string, 
        private readonly domEvent: string, 
        private readonly useCapture?: boolean) {
        super(name);
        this.listener = this.onDOMEvent.bind(this);
    }

    bindTarget(target: EventTarget): void {
        this.unbindTarget();
        this.target = target;

        if (this.count > 0) {
            this.addDOMEventListener();
        }
    }

    unbindTarget(): void {
        if (this.target) {
            this.removeDOMEventListener();
            this.target = undefined;
        }
    }

    protected callbackRegistered(): void {
        if (this.count > 0) {
            this.addDOMEventListener();
        }
    }

    protected callbackUnregistered(): void {
        if (this.count === 0) {
            this.removeDOMEventListener();
        }
    }

    private onDOMEvent(event: TArgs): void {
        this.emit(event);
    }

    private addDOMEventListener(): void {
        if (this.target && !this.isRegistered) {
            this.target.addEventListener(this.domEvent, this.listener, this.useCapture);
            this.isRegistered = true;
        }
    }

    private removeDOMEventListener(): void {
        if (this.target && this.isRegistered) {
            this.target.removeEventListener(this.domEvent, this.listener, this.useCapture);
            this.isRegistered = false;
        }
    }
}