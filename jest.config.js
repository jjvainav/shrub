const base = require("./jest.config.base.js");

module.exports = {
    ...base,
    roots: [
        "<rootDir>"
    ],
    projects: [
        "<rootDir>/packages/**/jest.config.js"
    ]
};