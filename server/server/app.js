"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.createApp = createApp;
var express_1 = require("express");
var express_session_1 = require("express-session");
var connect_pg_simple_1 = require("connect-pg-simple");
var routes_1 = require("./routes");
var http_1 = require("http");
function log(message, source) {
    if (source === void 0) { source = "express"; }
    var formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log("".concat(formattedTime, " [").concat(source, "] ").concat(message));
}
function createApp() {
    return __awaiter(this, void 0, void 0, function () {
        var app, httpServer, isProduction, sessionConfig, PgSession;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    app = (0, express_1.default)();
                    httpServer = (0, http_1.createServer)(app);
                    // Trust Replit's reverse proxy so secure cookies work over HTTPS
                    app.set("trust proxy", 1);
                    app.use(express_1.default.json({
                        verify: function (req, _res, buf) {
                            req.rawBody = buf;
                        },
                    }));
                    app.use(express_1.default.urlencoded({ extended: false }));
                    isProduction = process.env.NODE_ENV === "production";
                    sessionConfig = {
                        secret: process.env.SESSION_SECRET || "notebeat-kids-secret-2024",
                        resave: false,
                        saveUninitialized: false,
                        proxy: isProduction,
                        cookie: {
                            secure: isProduction,
                            sameSite: isProduction ? "none" : "lax",
                            maxAge: 7 * 24 * 60 * 60 * 1000,
                        },
                    };
                    if (isProduction && process.env.DATABASE_URL) {
                        PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
                        sessionConfig.store = new PgSession({
                            conString: process.env.DATABASE_URL,
                            tableName: "session",
                            createTableIfMissing: true,
                        });
                    }
                    app.use((0, express_session_1.default)(sessionConfig));
                    app.use(function (req, res, next) {
                        var start = Date.now();
                        var path = req.path;
                        var capturedJsonResponse = undefined;
                        var originalResJson = res.json;
                        res.json = function (bodyJson) {
                            var args = [];
                            for (var _i = 1; _i < arguments.length; _i++) {
                                args[_i - 1] = arguments[_i];
                            }
                            capturedJsonResponse = bodyJson;
                            return originalResJson.apply(res, __spreadArray([bodyJson], args, true));
                        };
                        res.on("finish", function () {
                            var duration = Date.now() - start;
                            if (path.startsWith("/api")) {
                                var logLine = "".concat(req.method, " ").concat(path, " ").concat(res.statusCode, " in ").concat(duration, "ms");
                                if (capturedJsonResponse)
                                    logLine += " :: ".concat(JSON.stringify(capturedJsonResponse));
                                log(logLine);
                            }
                        });
                        next();
                    });
                    return [4 /*yield*/, (0, routes_1.registerRoutes)(httpServer, app)];
                case 1:
                    _a.sent();
                    app.use(function (err, _req, res, next) {
                        var status = err.status || err.statusCode || 500;
                        var message = err.message || "Internal Server Error";
                        console.error("Internal Server Error:", err);
                        if (res.headersSent)
                            return next(err);
                        return res.status(status).json({ message: message });
                    });
                    return [2 /*return*/, { app: app, httpServer: httpServer }];
            }
        });
    });
}
