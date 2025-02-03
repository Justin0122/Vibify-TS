/* jshint esversion: 9 */
/* jshint node: true */
import gts from "gts/.prettierrc.json";

module.exports = {
    ...(gts),
    semi: true,
    bracketSpacing: true,
    singleQuote: true,
    trailingComma: "none",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 4
};