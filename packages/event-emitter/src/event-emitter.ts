/** Defines a function for subscribing callbacks with an IEvent. */
export interface IEventSubscription<TArgs> {
    (callback: (args: TArgs) => void): IEventListener;
}

export interface IEvent<TArgs = void> extends IEventSubscription<TArgs>, IEventProperties<TArgs> {
}

export interface IEventEmitterOptions {
    readonly onFirstListenerAdd?: () => void;
    readonly onLastListenerRemove?: () => void;
}

interface IEventProperties<TArgs> {
    readonly name: string;
    readonly on: IEventSubscription<TArgs>;
    readonly once: IEventSubscription<TArgs>;

    aggregate(event: IEvent<TArgs>): IEvent<TArgs>;
    debounce(delay: number, reduce?: (acc: TArgs, cur: TArgs) => TArgs): IEvent<TArgs>;
    filter(predicate: (args: TArgs) => boolean): IEvent<TArgs>;
    forward(emitter: EventEmitter<TArgs>): IEventListener;
    map<T>(map: (args: TArgs) => T): IEvent<T>;
    split<T>(splitter: (args: TArgs) => Iterable<T>): IEvent<T>;
} 

interface IEventListener { 
    remove(): void 
};

const eventProto: IEventProperties<any> = {
    name: "",
    get on(): IEventSubscription<any> {
        return <any>this;
    },
    get once(): IEventSubscription<any> {
        return callback => {
            const listener = this.on(args => {
                callback(args);
                listener.remove();
            });
    
            return listener;
        };
    },
    aggregate(event: IEvent<any>): IEvent<any> {
        // create a new event that will invoke its callback if either of the events are raised
        return createEvent<any>(`${this.name}+${event.name}`, callback => {
            const c1 = this.on(callback);
            const c2 = event.on(callback);
            
            return {
                remove(): void {
                    c1.remove();
                    c2.remove();
                }
            };
        });
    },
    debounce(delay: number, reduce?: (acc: any, cur: any) => any): IEvent<any> {
        let listener: IEventListener | undefined;
        let result: any;
        let handle: any;

        const emitter = new EventEmitter<any>(this.name, {
            onFirstListenerAdd: () => {
                listener = this.on(args => {
                    if (reduce && result !== undefined && args !== undefined) {
                        result = reduce(result, args);
                    }
                    else if (args !== undefined) {
                        result = args;
                    }

                    clearTimeout(handle);
                    handle = setTimeout(() => {
                        const _result = result;
                        result = undefined;
                        handle = undefined;
    
                        emitter.emit(_result!);
                    }, delay);
                });
            },
            onLastListenerRemove: () => {
                if (listener) {
                    listener.remove();
                    listener = undefined;
                }
            }
        });

        return emitter.event;
    },
    filter(predicate: (args: any) => boolean): IEvent<any> {
        // create a new event that will invoke its callback only if the predicate evaluates to true
        return createEvent<any>(this.name, callback => {
            return this.on(args => {
                if (predicate(args)) {
                    callback(args);
                }
            });
        });
    },
    forward(emitter: EventEmitter<any>): IEventListener {
        return this.on(args => emitter.emit(args));
    },
    map<T>(map: (args: any) => T): IEvent<T> {
        return createEvent<T>(this.name, callback => {
            return this.on(args => callback(map(args)));
        });
    },
    split<T>(splitter: (args: any) => Iterable<T>): IEvent<T> {
        return createEvent<T>(this.name, callback => {
            // create a new event that will invoke the callback with each result from the splitter
            return this.on(args => {
                for (const result of splitter(args)) {
                    callback(result);
                }
            });
        });
    }
};

function createEvent<TArgs>(name: string, subscription: IEventSubscription<TArgs>): IEvent<TArgs> {
    Object.defineProperty(subscription, "name", {
        writable: true,
        value: name
    });
    Object.setPrototypeOf(subscription, eventProto);
    return <IEvent<TArgs>>subscription;
}

export class EventEmitter<TArgs = void> {
    private callbacks?: Function[];

    readonly event: IEvent<TArgs>;

    constructor(name: string, options?: IEventEmitterOptions) {
        this.event = createEvent(name, callback => {
            if (this.callbacks === undefined) {
                this.callbacks = [];
            }

            this.callbacks.push(callback);
            this.callbackRegistered();

            if (this.callbacks.length === 1 && options && options.onFirstListenerAdd) {
                options.onFirstListenerAdd();
            }

            return {
                remove: (): void => {
                    const index = this.callbacks!.indexOf(callback);

                    if (index > -1) {
                        this.callbacks!.splice(index, 1);
                        this.callbackUnregistered();

                        if (this.callbacks!.length === 0 && options && options.onLastListenerRemove) {
                            options.onLastListenerRemove();
                        }
            
                    }
                }
            };
        });
    }

    protected get count(): number {
        if (!this.callbacks) {
            return 0;
        }

        return this.callbacks.length;
    }

    emit(args: TArgs): void {
        if (this.callbacks !== undefined) {
            this.callbacks.forEach(callback => callback(args));
        }
    }

    protected callbackRegistered(): void {
    }

    protected callbackUnregistered(): void {
    }
}

/** 
 * An event emitter that listens for and collects results from one or more other events. This is useful
 * when reducing multiple events into one, whether it be seperate events or multiple firings of
 * a single event. 
 * 
 * ---
 * 
 * const emitter = new AggregateEventEmitter<string>("emitter");
 * 
 * emitter.wrap(event, () => "", (args, result) => result + args);
 * emitter.collectEvents(() => {
 *  // every time the wrapped 'event' is fired here the results will be correlated into 'result'
 * });
 * 
 * // if the wrapped 'event' was fired during 'collectEvents' the aggregate event will now fire with the 'result'
 * 
 * ---
 */
export class AggregateEventEmitter<TArgs> extends EventEmitter<TArgs> implements IEventListener {
    private readonly listeners: IEventListener[] = [];
    private result?: TArgs;
    private captured = 0;
    
    remove(): void {
        this.listeners.forEach(listener => listener.remove());
        this.listeners.length = 0;
    }

    /**
     * Wrap an event to monitor for changes and the merge callback will be invoked everytime the event is emitted during collectEvents.
     * 
     * @param event An event.
     * @param initializeResult An optional initialized result.
     * @param merge An optional callback to merge/reduce the event data.
     */
    wrap<T>(event: IEvent<T>, initializeResult?: () => TArgs, merge?: (args: T, result: TArgs) => TArgs): void {
        this.listeners.push(event.on(e => {
            if (this.capture()) {
                if (this.captured === 0 && initializeResult) {
                    // first event
                    this.result = initializeResult();
                }
                
                this.captured++;
                
                if (merge) {
                    this.result = merge(e, this.result!);
                }
            }
        }));
    }
    
    collectEvents(action: () => void): void {
        this.captured = 0;

        action();

        if (this.captured > 0) {
            this.emit(this.result!);
        }

        this.captured = -1;
    }

    private capture(): boolean {
        return this.captured !== -1;
    }
}