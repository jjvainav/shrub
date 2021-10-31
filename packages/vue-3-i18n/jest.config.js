const base = require("../../jest.config.base.js");
const pack = require("./package");

module.exports = {
    ...base,
    name: pack.name,
    displayName: pack.name,
    globals: {
        "ts-jest": {
            isolatedModules: true,
            tsconfig: "<rootDir>/test/tsconfig.json"
        }
    }
};