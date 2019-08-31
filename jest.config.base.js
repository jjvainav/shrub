/*
 * This is a base config file for all packages to inherit from.
 * 
 * Note: there is currently a performance issue with jest after version 23 that is still open: https://github.com/kulshekhar/ts-jest/issues/908
 * The issue seems to be related to typescript compilation the first time tests are ran (jest will cache the compiled files unless the --no-cahce flag is specified).
 * The performance hit is huge if the tests reference a number of other packages.
 * For packages that suffer this hit use the ts-jest 'isolatedModules' option: https://github.com/kulshekhar/ts-jest/blob/master/docs/user/config/isolatedModules.md
 */

module.exports = {
    globals: {
        "ts-jest": {
            tsConfig: "<rootDir>/test/tsconfig.json"
        }
    },
    roots: [
        "<rootDir>/test"
    ],
    transform: {
        "^.+\\.(js|ts)$": "ts-jest"
    },
    transformIgnorePatterns: [
        "node_modules/?!(@shrub)"
    ],
    testRegex: "((\\.|/)(test))\\.ts$",
    moduleFileExtensions: ["js", "ts"],
    verbose: true
}