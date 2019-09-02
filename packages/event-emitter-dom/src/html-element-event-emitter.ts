import { DOMEventEmitter } from "./dom-event-emitter";

/** A DOM event emitter that listens to events for an html element. */
export class HTMLElementEventEmitter<K extends keyof HTMLElementEventMap> extends DOMEventEmitter<HTMLElementEventMap[K]> {
    constructor(name: string, domEvent: K, useCapture?: boolean) {
        super(name, domEvent, useCapture);
    }

    bindTarget(element: HTMLElement): void {
        super.bindTarget(element);
    }
}