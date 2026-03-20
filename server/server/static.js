"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveStatic = serveStatic;
var express_1 = require("express");
var fs_1 = require("fs");
var path_1 = require("path");
var url_1 = require("url");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
function serveStatic(app) {
    var distPath = path_1.default.resolve(__dirname, "public");
    if (!fs_1.default.existsSync(distPath)) {
        throw new Error("Could not find the build directory: ".concat(distPath, ", make sure to build the client first"));
    }
    app.use(express_1.default.static(distPath));
    // fall through to index.html if the file doesn't exist
    app.use("/{*path}", function (_req, res) {
        res.sendFile(path_1.default.resolve(distPath, "index.html"));
    });
}
