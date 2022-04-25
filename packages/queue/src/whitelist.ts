/** 
 * A utility to validate if a queue name matches the specified pattern. 
 * Currently, queue name patterns only support wildcard (*).
 */
 export function isQueueNameMatch(queueNamePattern: string, channelName: string): boolean {
    const regex = toRegExp(queueNamePattern);
    return regex.test(channelName);
}

/** Returns true if the provided queue name is a pattern containing one or more wildcards. */
export function isQueueNamePattern(channelName: string): boolean {
    for (let i = 0; i < channelName.length; i++) {
        if (channelName[i] === "*") {
            return true;
        }
    }

    return false;
}

function toRegExp(pattern: string): RegExp {
    const escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    pattern = "^" + pattern.split("*").map(escapeRegex).join(".*") + "$";
    return new RegExp(pattern);
}

/** Utlity class for managing and matching a set of queue names and patterns for queue adapters. */
export class QueueAdapterWhitelist {
    private readonly patterns: string[] = [];
    private readonly queues = new Set<string>();
    private allowAll = false;

    constructor(queueNamePatterns: string[]) {
        queueNamePatterns.forEach(pattern => this.add(pattern));
    }

    add(queueNamePattern: string): void {
        //note: this will only add the pattern if it is not already covered by another pattern/channel

        if (!this.allowAll) {
            queueNamePattern = this.normalizePattern(queueNamePattern);
            if (isQueueNamePattern(queueNamePattern)) {
                if (queueNamePattern === "*") {
                    this.allowAll = true;
                    this.patterns.splice(0);
                    this.queues.clear();
                }

                if (!this.isQueueSupported(queueNamePattern)) {
                    this.patterns.push(queueNamePattern);
                }
            }
            else if (!this.isQueueSupported(queueNamePattern)) {
                this.queues.add(queueNamePattern);
            }
        }
    }

    isQueueSupported(channelName: string): boolean {
        if (this.allowAll || this.queues.has(channelName)) {
            return true;
        }

        for (const pattern of this.patterns) {
            if (isQueueNameMatch(pattern, channelName)) {
                return true;
            }
        }

        return false;
    }

    private normalizePattern(queueNamePattern: string): string {
        queueNamePattern = queueNamePattern.trim();
        while (queueNamePattern.indexOf("**") > -1) {
            queueNamePattern = queueNamePattern.replace("**", "*");
        }

        return queueNamePattern;
    }
}