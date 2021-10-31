import { defineComponent, h, PropType, ref, watch } from "vue";
import { CInputGroup } from "../input-group";

export type InputAutocomplete = "off" | "on";
export type InputType = "text" | "number" | "email" | "password" | "tel";

/** An async callback that gets invoked whenever the input changes. */
export interface IAsyncCallback<TResult = any> {
    /** The minimum number of characters before the input callback is invoked. */
    readonly minChars?: number;
    /** An optional callback that will be invoked on a successful callback operation. */
    readonly result?: (value: TResult) => void;
    /** 
     * A callback that will be invoked when the input has changed. Return a truthy value if successful or a falsy value if not. 
     * Users should either listen for the 'result' event or provide a result callback to handle the result of the operation.
     */
    input(value: string): Promise<TResult>;
}

/** Options for the format callback. */
export interface IFormatOptions {
    readonly partial: boolean;
}

/** A callback to handle formatting an input value. */
export interface IInputFormatter {
    (value: string, options: IFormatOptions): string | undefined;
}

/** Handles converting a model property value when binding with the input element. */
export interface IValueConverter {
    readonly toPropertyValue?: (value: string) => any;
    readonly fromPropertyValue?: (value: any) => string;
}

interface IInputFormatHandler {
    formatInput(target: HTMLInputElement, partial: boolean): void;
}

const defaultMinChars = 3;
const noOpFormatHandler: IInputFormatHandler = {
    formatInput: () => {}
};

class InputFormatHandler implements IInputFormatHandler {
    private oldInput = "";
    private oldSelectionStart: number | null;
    private oldSelectionEnd: number | null;

    constructor(
        private readonly formatter: IInputFormatter,
        private readonly symbols: string[]) {
    }

    formatInput(target: HTMLInputElement, partial: boolean): void {
        if (!target.value) {
            // the user deleted all the content in the input field
            this.captureInputState(target);
            return;
        }

        const result = this.formatter(target.value, { partial });
        if (result !== undefined) {
            target.value = result;
            this.advanceCaret(target);
            this.captureInputState(target);
        }
        else {
            this.resetInputState(target);
        }
    }

    private advanceCaret(target: HTMLInputElement): void {
        if (target.selectionStart === target.selectionEnd) {
            let index = target.selectionStart || 0;
            while (index < target.value.length - 1 && this.isSymbol(target.value[index + 1])) {
                index++;
            }

            // move the caret forward past any symbols in the string
            target.setSelectionRange(index, index);
        }
    }

    private captureInputState(target: HTMLInputElement): void {
        this.oldInput = target.value;
        this.oldSelectionStart = target.selectionStart;
        this.oldSelectionEnd = target.selectionEnd;
    }

    private resetInputState(target: HTMLInputElement): void {
        target.value = this.oldInput || "";
        target.setSelectionRange(this.oldSelectionStart || 0, this.oldSelectionEnd || 0);
    }

    private isSymbol(char: string): boolean {
        return this.symbols.indexOf(char) > -1;
    }
}

class FormInputViewModel {
    private readonly formatHandler: IInputFormatHandler
    private cancel = () => {};
    
    readonly input = ref("");

    constructor(
        private readonly alphanumeric: boolean,
        private readonly number: boolean,
        private readonly symbols: string[],
        private readonly formatter: IInputFormatter | undefined,
        private readonly converter: IValueConverter | undefined,
        private readonly async: IAsyncCallback | undefined,
        private readonly emit: (event: string, ...args: any[]) => void,
        value: any) {
        this.formatHandler = this.formatter ? new InputFormatHandler(this.formatter, this.symbols) : noOpFormatHandler;
        this.updateInput(value);
    }

    get isAsync(): boolean {
        return !!this.async;
    }

    clear(): void {
        this.setInput("");
        this.emit("clear");
    }

    formatInput(target: HTMLInputElement, partial: boolean): void {
        this.formatHandler.formatInput(target, partial);
    }

    handleBackspace(target: HTMLInputElement): void {
        let start = target.selectionStart || 0;
        let end = target.selectionEnd || 0;

        if (start) {
            const calculateStart = (start: number, end: number): number => {
                const hasSelection = start !== end;

                // automatically delete symbols preceding the start character
                while (start > 0 && this.isSymbol(target.value[start - 1])) {
                    start--;
                }

                if (start && !hasSelection) {
                    // if there was no selection delete the next character and re-evaluate
                    return calculateStart(start - 1, end);
                }

                return start;
            }

            target.selectionStart = calculateStart(start, end);
        }
    }

    handleDelete(target: HTMLInputElement): void {
        let start = target.selectionStart || 0;
        let end = target.selectionEnd || 0;

        if (end < target.value.length) {
            // select the character that would be deleted if there currently isn't a selection
            end = start === end ? end + 1 : end;

            // automatically delete symbols after the character
            while (end < target.value.length && this.isSymbol(target.value[end])) {
                end++;
            }

            target.selectionEnd = end;
        }
    }

    isValidKey(key: string): boolean {
        // first check if any key/character is allowed
        if (this.number && this.alphanumeric && !this.symbols.length) {
            return true;
        }

        return this.isSymbol(key)
            || (this.number && this.isNumeric(key)) 
            || (this.alphanumeric && this.isAlphanumeric(key));
    }

    setInput(input: string): void {
        if (this.input.value === input) {
            return;
        }

        this.input.value = input;

        // get the unformatted input value
        const value = this.converter && this.converter.toPropertyValue 
            ? this.converter.toPropertyValue(input) 
            : input;

        // emit the event before performing any async operations
        // pass the unformatted value so it can be bound to the model
        this.emit("input", value);
        this.cancel();

        if (!this.input.value) {
            this.clear();
            return;
        }

        if (!this.async || this.input.value.length < (this.async.minChars || defaultMinChars)) {
            return;
        }

        const cancel = new Promise<void>((resolve) => this.cancel = resolve);
        Promise.race([cancel, this.async.input(value)]).then(result => {
            if (result && this.input) {
                if (this.async!.result) {
                    this.async!.result(result);
                }

                this.emit("result", result);
            }
        });
    }

    updateInput(value: any): void {
        this.input.value = this.getInputValue(value);
    }

    private formatValue(value: string, partial: boolean): string {
        // if the formatter fails to format the value return the original value
        return this.formatter ? this.formatter(value, { partial }) || value : value;
    }

    private getInputValue(value: any): string {
        let input = "";

        if (value !== undefined) {
            if (this.converter && this.converter.fromPropertyValue) {
                input = this.converter.fromPropertyValue(value);
            }
            else {
                if (value.toString === undefined) {
                    throw new Error(`Invalid value type (${typeof value}), a value converter is expected.`);
                }

                input = value.toString();
            }
        }

        return this.formatValue(input, /* partial */ true);
    }

    private isAlphanumeric(key: string): boolean {
        const value = key.length === 1 ? key.charCodeAt(0) : 0;
        return (value >= 65 && value <= 90) || (value >= 97 && value <= 122);
    }

    private isNumeric(key: string): boolean {
        const value = key.length === 1 ? key.charCodeAt(0) : 0;
        return value >= 48 && value <= 57;
    }

    private isSymbol(char: string): boolean {
        return this.symbols.indexOf(char) > -1;
    }
}

export default defineComponent({
    props: {
        id: { required: false, type: String },
        placeholder: { required: false, type: String },
        icon: { required: false, type: String },
        async: { required: false, type: Object as PropType<IAsyncCallback> },
        converter: { required: false, type: Object as PropType<IValueConverter> },
        formatter: { required: false, type: Object as PropType<IInputFormatter> },
        autocomplete: { required: false, type: String, default: "on" },
        type: { required: false, type: String, default: "text" },
        alphanumeric: { required: false, type: Boolean, default: true },
        number: { required: false, type: Boolean, default: true },
        symbols: { required: false, type: Array as PropType<Array<string>>, default: () => [] },
        autofocus: { required: false, type: Boolean, default: false },
        clearOnBlur: { required: false, type: Boolean, default: false },
        enableClear: { required: false, type: Boolean, default: false },
        disabled: { required: false, type: Boolean, default: false },
        invalid: { required: false, type: Boolean, default: false },
        valid: { required: false, type: Boolean, default: false },
        value: { required: false },
    },
    setup: (props, context) => {
        const vm = new FormInputViewModel(
            props.alphanumeric, 
            props.number, 
            props.symbols, 
            props.formatter, 
            props.converter, 
            props.async, 
            context.emit, 
            props.value);

        // watch for changes to the value and update the input
        watch(() => props.value, () => vm.updateInput(props.value));

        return () => {
            const input = h("input", {
                id: props.id,
                type: props.type,
                disabled: props.disabled,
                // turn autocomplete off when async
                autocomplete: vm.isAsync ? "off" : props.autocomplete,
                autofocus: props.autofocus,
                placeholder: props.placeholder,
                value: vm.input.value,
                ref: "input",
                class: ["form-control", { 
                    "is-invalid": props.invalid,
                    "is-valid": props.valid
                }],
                onBlur: (event: FocusEvent) => {
                    if (props.clearOnBlur) {
                        vm.clear();
                        return;
                    }

                    // perform a non-partial formatting check on lost focus
                    vm.formatInput(<HTMLInputElement>event.target, /* partial */ false);
                    vm.setInput((<HTMLInputElement>event.target).value);
                },
                onChange: () => context.emit("change"),
                onKeydown: (event: KeyboardEvent) => {
                    const target = <HTMLInputElement>event.target;
                    if (event.key === "Escape") {
                        if (props.enableClear) {
                            vm.clear();
                        }
                    }
                    else if (event.key === "Backspace") {
                        vm.handleBackspace(target);
                    }
                    else if (event.key === "Delete") {
                        vm.handleDelete(target);
                    }

                    context.emit("keydown", event);
                },
                onKeypress: (event: KeyboardEvent) => {
                    if (!vm.isValidKey(event.key)) {
                        event.preventDefault();
                    }

                    context.emit("keypress", event);
                },
                onInput: (event: InputEvent) => {
                    vm.formatInput(<HTMLInputElement>event.target, /* partial */ true);
                    vm.setInput((<HTMLInputElement>event.target).value);
                }
            });

            if (!props.icon) {
                return input;
            }
    
            // show the x icon and make it clickable if enableClear is true and there is a value in the input element
            const icon = !props.enableClear || !vm.input.value
                ? h("i", { class: [props.icon] })
                : h("i", {
                    class: ["bi-x"],
                    style: [{ cursor: "pointer" }],
                    onClick: () => vm.clear()
                });

            /** 
             * <div>
             *   <span>
             *     <i></i>
             *   </span>
             * </div>
             */ 
            const iconGroup = h("div", { 
                class: ["input-group-append"]
            },
            [h("span", { 
                class: ["input-group-text", "bg-transparent"]
            },
            [icon])]);
        
            return h(CInputGroup, {
                class: ["form-input"],
                props: { marginBottom: 0 } 
            }, 
            [input, iconGroup]);
        };
    }
});