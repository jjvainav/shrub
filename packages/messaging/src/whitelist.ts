/** 
 * A utility to validate if a channel name matches the specified channel name pattern. 
 * Currently, channel name patterns only support wildcard (*).
 */
export function isChannelNameMatch(channelNamePattern: string, channelName: string): boolean {
    const regex = toRegExp(channelNamePattern);
    return regex.test(channelName);
}

/** Returns true if the provided channel name is a pattern containing one or more wildcards. */
export function isChannelNamePattern(channelName: string): boolean {
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

/** Utlity class for managing and matching a set of channel names and patterns. */
export class ChannelWhitelist {
    private readonly patterns: string[] = [];
    private readonly channels = new Set<string>();
    private allowAll = false;

    add(channelNamePattern: string): void {
        //note: this will only add the pattern if it is not already covered by another pattern/channel

        if (!this.allowAll) {
            channelNamePattern = this.normalizePattern(channelNamePattern);
            if (isChannelNamePattern(channelNamePattern)) {
                if (channelNamePattern === "*") {
                    this.allowAll = true;
                    this.patterns.splice(0);
                    this.channels.clear();
                }

                if (!this.isChannelSupported(channelNamePattern)) {
                    this.patterns.push(channelNamePattern);
                }
            }
            else if (!this.isChannelSupported(channelNamePattern)) {
                this.channels.add(channelNamePattern);
            }
        }
    }

    isChannelSupported(channelName: string): boolean {
        if (this.allowAll || this.channels.has(channelName)) {
            return true;
        }

        for (const pattern of this.patterns) {
            if (isChannelNameMatch(pattern, channelName)) {
                return true;
            }
        }

        return false;
    }

    private normalizePattern(channelNamePattern: string): string {
        channelNamePattern = channelNamePattern.trim();
        while (channelNamePattern.indexOf("**") > -1) {
            channelNamePattern = channelNamePattern.replace("**", "*");
        }

        return channelNamePattern;
    }
}