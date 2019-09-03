export function toKebabCase(value: string): string {
    return value
        .replace(/\s+/g, '-')
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase();
}