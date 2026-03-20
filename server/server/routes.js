"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
var storage_1 = require("./storage");
var bcryptjs_1 = require("bcryptjs");
var schema_1 = require("@shared/schema");
var multer_1 = require("multer");
function getContentType(filename) {
    var ext = (filename.split(".").pop() || "").toLowerCase();
    var map = {
        mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
        aac: "audio/aac", m4a: "audio/mp4",
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        gif: "image/gif", webp: "image/webp",
    };
    return map[ext] || "application/octet-stream";
}
function makeStoredFilename() {
    return "".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2));
}
var upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (_req, file, cb) {
        if (file.mimetype.startsWith("audio/") || file.originalname.match(/\.(mp3|wav|ogg|aac|m4a)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only audio files are allowed"));
        }
    },
});
var maestroUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: function (_req, file, cb) {
        if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only video and image files are allowed"));
        }
    },
});
function generateRhythmPattern(bpm) {
    var original = {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
        perc: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    };
    var kids = {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        perc: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    };
    return { original: original, kids: kids };
}
function generateClassCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    for (var i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
function registerRoutes(httpServer, app) {
    return __awaiter(this, void 0, void 0, function () {
        var isLicenseExpired;
        var _this = this;
        return __generator(this, function (_a) {
            // Admin auth
            app.post("/api/auth/admin/login", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, password, admin_1, valid, e_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            _a = req.body, email = _a.email, password = _a.password;
                            return [4 /*yield*/, storage_1.storage.getAdminByEmail(email)];
                        case 1:
                            admin_1 = _b.sent();
                            if (!admin_1)
                                return [2 /*return*/, res.status(401).json({ message: "Invalid credentials" })];
                            return [4 /*yield*/, bcryptjs_1.default.compare(password, admin_1.password)];
                        case 2:
                            valid = _b.sent();
                            if (!valid)
                                return [2 /*return*/, res.status(401).json({ message: "Invalid credentials" })];
                            req.session.adminId = admin_1.id;
                            req.session.save(function (err) {
                                if (err)
                                    return res.status(500).json({ message: "Session error" });
                                res.json({ id: admin_1.id, name: admin_1.name, email: admin_1.email, role: "admin" });
                            });
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _b.sent();
                            res.status(500).json({ message: "Server error" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/auth/admin/logout", function (req, res) {
                req.session.destroy(function () { return res.json({ ok: true }); });
            });
            app.get("/api/auth/admin/me", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, admin;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getAdminByEmail("admin@notebeatkids.com")];
                        case 1:
                            admin = _a.sent();
                            if (!admin)
                                return [2 /*return*/, res.status(401).json({ message: "Not found" })];
                            res.json({ id: admin.id, name: admin.name, email: admin.email, role: "admin" });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher auth — ad + soyad + kurum kodu
            app.post("/api/auth/teacher/login", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, firstName, lastName, teacherCode, codeRecord, institution, fullName, existingTeacher, _1, safe_1, teacher, _, safeTeacher_1, e_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 7, , 8]);
                            _a = req.body, firstName = _a.firstName, lastName = _a.lastName, teacherCode = _a.teacherCode;
                            if (!(firstName === null || firstName === void 0 ? void 0 : firstName.trim()) || !(lastName === null || lastName === void 0 ? void 0 : lastName.trim()) || !(teacherCode === null || teacherCode === void 0 ? void 0 : teacherCode.trim())) {
                                return [2 /*return*/, res.status(400).json({ message: "Ad, soyad ve öğretmen kodu gereklidir." })];
                            }
                            return [4 /*yield*/, storage_1.storage.findTeacherCodeByValue(teacherCode.trim().toUpperCase())];
                        case 1:
                            codeRecord = _b.sent();
                            if (!codeRecord)
                                return [2 /*return*/, res.status(404).json({ message: "Geçersiz kod. Yöneticinizden aldığınız kodu kontrol edin." })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(codeRecord.institutionId)];
                        case 2:
                            institution = _b.sent();
                            if (!institution)
                                return [2 /*return*/, res.status(404).json({ message: "Kurum bulunamadı." })];
                            if (new Date(institution.licenseEnd) < new Date())
                                return [2 /*return*/, res.status(403).json({ message: "Kurumun abonelik süresi dolmuş. Yöneticinizle iletişime geçin." })];
                            fullName = "".concat(firstName.trim(), " ").concat(lastName.trim());
                            if (!codeRecord.teacherId) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage_1.storage.getTeacher(codeRecord.teacherId)];
                        case 3:
                            existingTeacher = _b.sent();
                            if (!existingTeacher)
                                return [2 /*return*/, res.status(500).json({ message: "Öğretmen kaydı bulunamadı." })];
                            if (existingTeacher.name.toLowerCase() !== fullName.toLowerCase()) {
                                return [2 /*return*/, res.status(403).json({ message: "Bu kod \"".concat(existingTeacher.name, "\" ad\u0131na kay\u0131tl\u0131d\u0131r. L\u00FCtfen kay\u0131t s\u0131ras\u0131nda girdi\u011Finiz ad\u0131 kullan\u0131n.") })];
                            }
                            req.session.teacherId = existingTeacher.id;
                            _1 = existingTeacher.password, safe_1 = __rest(existingTeacher, ["password"]);
                            return [2 /*return*/, req.session.save(function (err) {
                                    if (err)
                                        return res.status(500).json({ message: "Session error" });
                                    res.json(__assign(__assign({}, safe_1), { role: "teacher" }));
                                })];
                        case 4: return [4 /*yield*/, storage_1.storage.createTeacherByCode({ name: fullName, institutionId: institution.id })];
                        case 5:
                            teacher = _b.sent();
                            return [4 /*yield*/, storage_1.storage.linkTeacherToCode(codeRecord.id, teacher.id)];
                        case 6:
                            _b.sent();
                            req.session.teacherId = teacher.id;
                            _ = teacher.password, safeTeacher_1 = __rest(teacher, ["password"]);
                            req.session.save(function (err) {
                                if (err)
                                    return res.status(500).json({ message: "Session error" });
                                res.json(__assign(__assign({}, safeTeacher_1), { role: "teacher" }));
                            });
                            return [3 /*break*/, 8];
                        case 7:
                            e_2 = _b.sent();
                            res.status(500).json({ message: "Server error" });
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            // Public endpoint to verify an individual teacher code
            app.get("/api/institution/by-teacher-code/:code", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var codeRecord, inst, status;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.findTeacherCodeByValue(req.params.code.toUpperCase())];
                        case 1:
                            codeRecord = _a.sent();
                            if (!codeRecord)
                                return [2 /*return*/, res.status(404).json({ message: "Geçersiz kod" })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(codeRecord.institutionId)];
                        case 2:
                            inst = _a.sent();
                            if (!inst)
                                return [2 /*return*/, res.status(404).json({ message: "Kurum bulunamadı" })];
                            status = codeRecord.teacherId ? "used" : "available";
                            res.json({ id: inst.id, name: inst.name, isActive: inst.isActive, codeStatus: status });
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/auth/teacher/logout", function (req, res) {
                req.session.destroy(function () { return res.json({ ok: true }); });
            });
            app.get("/api/auth/teacher/me", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, teacher, _, safeTeacher;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getTeacher(teacherId)];
                        case 1:
                            teacher = _a.sent();
                            if (!teacher)
                                return [2 /*return*/, res.status(401).json({ message: "Not found" })];
                            _ = teacher.password, safeTeacher = __rest(teacher, ["password"]);
                            res.json(__assign(__assign({}, safeTeacher), { role: "teacher" }));
                            return [2 /*return*/];
                    }
                });
            }); });
            // Student login (no session, stored client-side)
            app.post("/api/auth/student/login", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, firstName, lastName, classCode, studentCode, cls, resolvedStudentCode, codeRecord, student, studentCount, e_3;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 12, , 13]);
                            _a = req.body, firstName = _a.firstName, lastName = _a.lastName, classCode = _a.classCode, studentCode = _a.studentCode;
                            cls = void 0;
                            resolvedStudentCode = null;
                            if (!studentCode) return [3 /*break*/, 3];
                            return [4 /*yield*/, storage_1.storage.findStudentCodeByValue(studentCode.trim().toUpperCase())];
                        case 1:
                            codeRecord = _b.sent();
                            if (!codeRecord)
                                return [2 /*return*/, res.status(404).json({ message: "Geçersiz öğrenci kodu. Öğretmeninizden aldığınız kodu kontrol edin." })];
                            return [4 /*yield*/, storage_1.storage.getClass(codeRecord.classId)];
                        case 2:
                            cls = _b.sent();
                            resolvedStudentCode = codeRecord.code;
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, storage_1.storage.getClassByCode(classCode)];
                        case 4:
                            // Legacy class code flow
                            cls = _b.sent();
                            _b.label = 5;
                        case 5:
                            if (!cls)
                                return [2 /*return*/, res.status(404).json({ message: "Sınıf bulunamadı. Kodu kontrol edin." })];
                            if (cls.expiresAt && new Date(cls.expiresAt) < new Date()) {
                                return [2 /*return*/, res.status(403).json({ message: "Bu sınıfın süresi dolmuş." })];
                            }
                            return [4 /*yield*/, storage_1.storage.findStudent(cls.id, firstName, lastName)];
                        case 6:
                            student = _b.sent();
                            if (!!student) return [3 /*break*/, 9];
                            return [4 /*yield*/, storage_1.storage.getStudentsByClass(cls.id)];
                        case 7:
                            studentCount = (_b.sent()).length;
                            if (studentCount >= cls.maxStudents) {
                                return [2 /*return*/, res.status(403).json({ message: "Sınıf kapasitesi dolu." })];
                            }
                            return [4 /*yield*/, storage_1.storage.createStudent({ classId: cls.id, firstName: firstName, lastName: lastName })];
                        case 8:
                            student = _b.sent();
                            _b.label = 9;
                        case 9:
                            if (!resolvedStudentCode) return [3 /*break*/, 11];
                            return [4 /*yield*/, storage_1.storage.linkStudentToStudentCode(resolvedStudentCode, student.id)];
                        case 10:
                            _b.sent();
                            _b.label = 11;
                        case 11:
                            res.json({ student: student, class: { id: cls.id, name: cls.name, classCode: cls.classCode } });
                            return [3 /*break*/, 13];
                        case 12:
                            e_3 = _b.sent();
                            res.status(500).json({ message: "Server error" });
                            return [3 /*break*/, 13];
                        case 13: return [2 /*return*/];
                    }
                });
            }); });
            // Student progress
            app.get("/api/student/:studentId/progress", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var progress;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getProgressByStudent(req.params.studentId)];
                        case 1:
                            progress = _a.sent();
                            res.json(progress);
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/student/:studentId/progress", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, appType, data, progress, e_4;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = req.body, appType = _a.appType, data = __rest(_a, ["appType"]);
                            return [4 /*yield*/, storage_1.storage.upsertProgress(req.params.studentId, appType, data)];
                        case 1:
                            progress = _b.sent();
                            res.json(progress);
                            return [3 /*break*/, 3];
                        case 2:
                            e_4 = _b.sent();
                            res.status(500).json({ message: "Server error" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Teacher institution info
            app.get("/api/teacher/institution", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, teacher, inst;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getTeacher(teacherId)];
                        case 1:
                            teacher = _a.sent();
                            if (!teacher || !teacher.institutionId)
                                return [2 /*return*/, res.status(404).json({ message: "Kurum bulunamadı" })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(teacher.institutionId)];
                        case 2:
                            inst = _a.sent();
                            if (!inst)
                                return [2 /*return*/, res.status(404).json({ message: "Kurum bulunamadı" })];
                            res.json({ id: inst.id, name: inst.name, maxStudents: inst.maxStudents, maxTeachers: inst.maxTeachers });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher classes
            app.get("/api/teacher/classes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, classList;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getClassesByTeacher(teacherId)];
                        case 1:
                            classList = _a.sent();
                            res.json(classList);
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/teacher/classes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, teacher, instMaxStudents, inst, requestedMax, body, parsed, classCode, attempts, cls, e_5;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 9, , 10]);
                            return [4 /*yield*/, storage_1.storage.getTeacher(teacherId)];
                        case 2:
                            teacher = _c.sent();
                            instMaxStudents = 10000000;
                            if (!(teacher === null || teacher === void 0 ? void 0 : teacher.institutionId)) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage_1.storage.getInstitution(teacher.institutionId)];
                        case 3:
                            inst = _c.sent();
                            if (inst === null || inst === void 0 ? void 0 : inst.maxStudents)
                                instMaxStudents = inst.maxStudents;
                            _c.label = 4;
                        case 4:
                            requestedMax = Number((_a = req.body.maxStudents) !== null && _a !== void 0 ? _a : 30);
                            if (requestedMax > instMaxStudents) {
                                return [2 /*return*/, res.status(400).json({ message: "Maksimum \u00F6\u011Frenci say\u0131s\u0131 kurumun izin verdi\u011Fi s\u0131n\u0131r\u0131 (".concat(instMaxStudents, ") a\u015Famaz.") })];
                            }
                            body = __assign(__assign({}, req.body), { teacherId: teacherId, maxStudents: requestedMax, expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null });
                            parsed = schema_1.insertClassSchema.parse(body);
                            classCode = generateClassCode();
                            attempts = 0;
                            _c.label = 5;
                        case 5: return [4 /*yield*/, storage_1.storage.getClassByCode(classCode)];
                        case 6:
                            if (!((_c.sent()) && attempts < 10)) return [3 /*break*/, 7];
                            classCode = generateClassCode();
                            attempts++;
                            return [3 /*break*/, 5];
                        case 7: return [4 /*yield*/, storage_1.storage.createClass(__assign(__assign({}, parsed), { classCode: classCode }))];
                        case 8:
                            cls = _c.sent();
                            res.json(cls);
                            return [3 /*break*/, 10];
                        case 9:
                            e_5 = _c.sent();
                            res.status(400).json({ message: (_b = e_5.message) !== null && _b !== void 0 ? _b : "Invalid data" });
                            return [3 /*break*/, 10];
                        case 10: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/teacher/classes/:classId", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, cls;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getClass(req.params.classId)];
                        case 1:
                            cls = _a.sent();
                            if (!cls || cls.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Forbidden" })];
                            return [4 /*yield*/, storage_1.storage.deleteClass(req.params.classId)];
                        case 2:
                            _a.sent();
                            res.json({ ok: true });
                            return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/teacher/classes/:classId/student-codes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, cls, codes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getClass(req.params.classId)];
                        case 1:
                            cls = _a.sent();
                            if (!cls || cls.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Forbidden" })];
                            return [4 /*yield*/, storage_1.storage.getStudentCodesByClass(req.params.classId)];
                        case 2:
                            codes = _a.sent();
                            res.json({ class: cls, codes: codes });
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/teacher/classes/:classId/student-codes/generate", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, cls, existing, teacher, instMaxStudents, inst, codes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getClass(req.params.classId)];
                        case 1:
                            cls = _a.sent();
                            if (!cls || cls.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Forbidden" })];
                            return [4 /*yield*/, storage_1.storage.getStudentCodesByClass(req.params.classId)];
                        case 2:
                            existing = _a.sent();
                            if (existing.length > 0)
                                return [2 /*return*/, res.json({ class: cls, codes: existing })];
                            return [4 /*yield*/, storage_1.storage.getTeacher(teacherId)];
                        case 3:
                            teacher = _a.sent();
                            instMaxStudents = cls.maxStudents;
                            if (!(teacher === null || teacher === void 0 ? void 0 : teacher.institutionId)) return [3 /*break*/, 5];
                            return [4 /*yield*/, storage_1.storage.getInstitution(teacher.institutionId)];
                        case 4:
                            inst = _a.sent();
                            if (inst === null || inst === void 0 ? void 0 : inst.maxStudents)
                                instMaxStudents = Math.min(cls.maxStudents, inst.maxStudents);
                            _a.label = 5;
                        case 5: return [4 /*yield*/, storage_1.storage.generateStudentCodesForClass(req.params.classId, instMaxStudents)];
                        case 6:
                            codes = _a.sent();
                            res.json({ class: cls, codes: codes });
                            return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/teacher/classes/:classId/students", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, cls, data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getClass(req.params.classId)];
                        case 1:
                            cls = _a.sent();
                            if (!cls || cls.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Forbidden" })];
                            return [4 /*yield*/, storage_1.storage.getClassProgress(req.params.classId)];
                        case 2:
                            data = _a.sent();
                            res.json({ class: cls, students: data });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Admin routes
            app.get("/api/admin/stats", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, stats;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getAdminStats()];
                        case 1:
                            stats = _a.sent();
                            res.json(stats);
                            return [2 /*return*/];
                    }
                });
            }); });
            isLicenseExpired = function (inst) {
                return new Date(inst.licenseEnd) < new Date();
            };
            app.get("/api/admin/institutions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, list;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getInstitutions()];
                        case 1:
                            list = _a.sent();
                            // Return institutions with computed isExpired flag; isActive is admin-controlled only
                            res.json(list.map(function (inst) { return (__assign(__assign({}, inst), { isExpired: isLicenseExpired(inst) })); }));
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/admin/institutions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, body, parsed, inst, e_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            body = __assign(__assign({}, req.body), { licenseStart: req.body.licenseStart ? new Date(req.body.licenseStart) : undefined, licenseEnd: req.body.licenseEnd ? new Date(req.body.licenseEnd) : undefined, maxTeachers: req.body.maxTeachers !== undefined ? Number(req.body.maxTeachers) : 10000, maxStudents: req.body.maxStudents !== undefined ? Number(req.body.maxStudents) : 10000000, isActive: true });
                            parsed = schema_1.insertInstitutionSchema.parse(body);
                            return [4 /*yield*/, storage_1.storage.createInstitution(parsed)];
                        case 2:
                            inst = _a.sent();
                            res.json(__assign(__assign({}, inst), { isExpired: isLicenseExpired(inst) }));
                            return [3 /*break*/, 4];
                        case 3:
                            e_6 = _a.sent();
                            res.status(400).json({ message: e_6.message });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.patch("/api/admin/institutions/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, current, wasExpired, newLicenseEnd, isRenewal, updates, inst;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(req.params.id)];
                        case 1:
                            current = _a.sent();
                            if (!current)
                                return [2 /*return*/, res.status(404).json({ message: "Institution not found" })];
                            wasExpired = isLicenseExpired(current);
                            newLicenseEnd = req.body.licenseEnd ? new Date(req.body.licenseEnd) : null;
                            isRenewal = wasExpired && newLicenseEnd && newLicenseEnd > new Date();
                            if (!isRenewal) return [3 /*break*/, 3];
                            return [4 /*yield*/, storage_1.storage.resetInstitutionQuota(req.params.id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            updates = __assign({}, req.body);
                            if (newLicenseEnd)
                                updates.licenseEnd = newLicenseEnd;
                            if (isRenewal && updates.isActive === undefined)
                                updates.isActive = true;
                            return [4 /*yield*/, storage_1.storage.updateInstitution(req.params.id, updates)];
                        case 4:
                            inst = _a.sent();
                            res.json(__assign(__assign({}, inst), { isExpired: isLicenseExpired(inst), quotaReset: isRenewal }));
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/admin/institutions/:id/reset-quota", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.resetInstitutionQuota(req.params.id)];
                        case 1:
                            _a.sent();
                            res.json({ ok: true });
                            return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/admin/institutions/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, inst;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(req.params.id)];
                        case 1:
                            inst = _a.sent();
                            if (!inst)
                                return [2 /*return*/, res.status(404).json({ message: "Institution not found" })];
                            return [4 /*yield*/, storage_1.storage.deleteInstitution(req.params.id)];
                        case 2:
                            _a.sent();
                            res.json({ ok: true });
                            return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/admin/institutions/:id/details", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, inst, details, effectiveInst;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(req.params.id)];
                        case 1:
                            inst = _a.sent();
                            if (!inst)
                                return [2 /*return*/, res.status(404).json({ message: "Institution not found" })];
                            return [4 /*yield*/, storage_1.storage.getInstitutionDetails(req.params.id)];
                        case 2:
                            details = _a.sent();
                            effectiveInst = __assign(__assign({}, inst), { isExpired: isLicenseExpired(inst) });
                            res.json(__assign({ institution: effectiveInst }, details));
                            return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/admin/institutions/:id/teacher-codes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, codes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getTeacherCodesByInstitution(req.params.id)];
                        case 1:
                            codes = _a.sent();
                            res.json(codes);
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/admin/institutions/:id/teacher-codes/generate", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, inst, count, existingCodes, maxSlot, newCodes;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getInstitution(req.params.id)];
                        case 1:
                            inst = _a.sent();
                            if (!inst)
                                return [2 /*return*/, res.status(404).json({ message: "Institution not found" })];
                            count = Math.min(Number(req.body.count) || 1, 100);
                            return [4 /*yield*/, storage_1.storage.getTeacherCodesByInstitution(req.params.id)];
                        case 2:
                            existingCodes = _a.sent();
                            maxSlot = existingCodes.reduce(function (m, c) { return Math.max(m, c.slotNumber); }, 0);
                            return [4 /*yield*/, storage_1.storage.generateTeacherCodesForInstitution(req.params.id, count, maxSlot + 1)];
                        case 3:
                            newCodes = _a.sent();
                            res.json(newCodes);
                            return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/admin/teachers", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, list;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getTeachers()];
                        case 1:
                            list = _a.sent();
                            res.json(list.map(function (_a) {
                                var _ = _a.password, t = __rest(_a, ["password"]);
                                return t;
                            }));
                            return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/admin/teachers", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, institution, existingTeachers, teacher, _, safe, e_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 6, , 7]);
                            if (!req.body.institutionId) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage_1.storage.getInstitution(req.body.institutionId)];
                        case 2:
                            institution = _a.sent();
                            if (!institution) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage_1.storage.getTeachersByInstitution(req.body.institutionId)];
                        case 3:
                            existingTeachers = _a.sent();
                            if (existingTeachers.length >= institution.maxTeachers) {
                                return [2 /*return*/, res.status(403).json({ message: "Bu kurum maksimum \u00F6\u011Fretmen s\u0131n\u0131r\u0131na (".concat(institution.maxTeachers, ") ula\u015Fm\u0131\u015F.") })];
                            }
                            _a.label = 4;
                        case 4: return [4 /*yield*/, storage_1.storage.createTeacher(req.body)];
                        case 5:
                            teacher = _a.sent();
                            _ = teacher.password, safe = __rest(teacher, ["password"]);
                            res.json(safe);
                            return [3 /*break*/, 7];
                        case 6:
                            e_7 = _a.sent();
                            res.status(400).json({ message: e_7.message });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Admin: list all classes
            app.get("/api/admin/classes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, list;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getAllClasses()];
                        case 1:
                            list = _a.sent();
                            res.json(list);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Admin: delete any class
            app.delete("/api/admin/classes/:classId", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var adminId, cls;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            adminId = req.session.adminId;
                            if (!adminId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getClass(req.params.classId)];
                        case 1:
                            cls = _a.sent();
                            if (!cls)
                                return [2 /*return*/, res.status(404).json({ message: "Class not found" })];
                            return [4 /*yield*/, storage_1.storage.deleteClass(req.params.classId)];
                        case 2:
                            _a.sent();
                            res.json({ ok: true });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Class public info (for students to verify)
            app.get("/api/class/:code", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var cls;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getClassByCode(req.params.code)];
                        case 1:
                            cls = _a.sent();
                            if (!cls)
                                return [2 /*return*/, res.status(404).json({ message: "Class not found" })];
                            res.json({ id: cls.id, name: cls.name, classCode: cls.classCode });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Serve uploaded audio files
            app.get("/api/orchestra/audio/:filename", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var song, buf;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getOrchestraSongByStoredFilename(req.params.filename)];
                        case 1:
                            song = _a.sent();
                            if (!song || !song.fileData)
                                return [2 /*return*/, res.status(404).json({ message: "File not found" })];
                            buf = Buffer.from(song.fileData, "base64");
                            res.set("Content-Type", getContentType(song.originalFilename));
                            res.set("Content-Length", String(buf.length));
                            res.send(buf);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: upload song
            app.post("/api/teacher/orchestra/songs", upload.single("audio"), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, count, name_1, bpm, patterns, song, err_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            if (!req.file)
                                return [2 /*return*/, res.status(400).json({ message: "No audio file provided" })];
                            return [4 /*yield*/, storage_1.storage.countOrchestraSongsByTeacher(teacherId)];
                        case 1:
                            count = _a.sent();
                            if (count >= 10) {
                                return [2 /*return*/, res.status(400).json({ message: "Song limit reached. Please delete an existing song to upload a new one." })];
                            }
                            name_1 = (req.body.name || req.file.originalname).trim();
                            bpm = parseInt(req.body.bpm) || 120;
                            patterns = generateRhythmPattern(bpm);
                            return [4 /*yield*/, storage_1.storage.createOrchestraSong({
                                    teacherId: teacherId,
                                    name: name_1,
                                    originalFilename: req.file.originalname,
                                    storedFilename: makeStoredFilename(),
                                    fileData: req.file.buffer.toString("base64"),
                                    bpm: bpm,
                                    durationSeconds: parseInt(req.body.durationSeconds) || 0,
                                    rhythmPatternOriginal: JSON.stringify(patterns.original),
                                    rhythmPatternKids: JSON.stringify(patterns.kids),
                                })];
                        case 2:
                            song = _a.sent();
                            res.json(song);
                            return [3 /*break*/, 4];
                        case 3:
                            err_1 = _a.sent();
                            res.status(500).json({ message: err_1.message });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: list songs
            app.get("/api/teacher/orchestra/songs", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, songs;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getOrchestraSongsByTeacher(teacherId)];
                        case 1:
                            songs = _a.sent();
                            res.json(songs);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: delete song
            app.delete("/api/teacher/orchestra/songs/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, song;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getOrchestraSong(req.params.id)];
                        case 1:
                            song = _a.sent();
                            if (!song)
                                return [2 /*return*/, res.status(404).json({ message: "Song not found" })];
                            if (song.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Not authorized" })];
                            return [4 /*yield*/, storage_1.storage.deleteOrchestraSong(req.params.id)];
                        case 2:
                            _a.sent();
                            res.json({ ok: true });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: update song BPM (regenerate rhythm)
            app.patch("/api/teacher/orchestra/songs/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, song, bpm, name, patterns, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getOrchestraSong(req.params.id)];
                        case 1:
                            song = _a.sent();
                            if (!song)
                                return [2 /*return*/, res.status(404).json({ message: "Song not found" })];
                            if (song.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Not authorized" })];
                            bpm = parseInt(req.body.bpm) || song.bpm;
                            name = req.body.name || song.name;
                            patterns = generateRhythmPattern(bpm);
                            return [4 /*yield*/, storage_1.storage.updateOrchestraSong(req.params.id, {
                                    bpm: bpm,
                                    name: name,
                                    rhythmPatternOriginal: JSON.stringify(patterns.original),
                                    rhythmPatternKids: JSON.stringify(patterns.kids),
                                })];
                        case 2:
                            updated = _a.sent();
                            res.json(updated);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: get orchestra performance data
            app.get("/api/teacher/orchestra/progress", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getOrchestraProgressByTeacher(teacherId)];
                        case 1:
                            data = _a.sent();
                            res.json(data);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Student: get songs available for their class (no server session — student passes their own ID)
            app.get("/api/student/:studentId/orchestra/songs", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var student, songs;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getStudent(req.params.studentId)];
                        case 1:
                            student = _a.sent();
                            if (!student)
                                return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                            return [4 /*yield*/, storage_1.storage.getOrchestraSongsByClass(student.classId)];
                        case 2:
                            songs = _a.sent();
                            res.json(songs);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Student: save orchestra game result
            app.post("/api/student/:studentId/orchestra/progress", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var student, _a, songId, mode, laneMode, accuracy, perfectCount, goodCount, missCount, prog;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getStudent(req.params.studentId)];
                        case 1:
                            student = _b.sent();
                            if (!student)
                                return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                            _a = req.body, songId = _a.songId, mode = _a.mode, laneMode = _a.laneMode, accuracy = _a.accuracy, perfectCount = _a.perfectCount, goodCount = _a.goodCount, missCount = _a.missCount;
                            if (!songId)
                                return [2 /*return*/, res.status(400).json({ message: "songId required" })];
                            return [4 /*yield*/, storage_1.storage.createOrchestraProgress({
                                    studentId: req.params.studentId,
                                    songId: songId,
                                    mode: mode || "original",
                                    laneMode: laneMode || "full",
                                    accuracy: Math.round(accuracy) || 0,
                                    perfectCount: perfectCount || 0,
                                    goodCount: goodCount || 0,
                                    missCount: missCount || 0,
                                })];
                        case 2:
                            prog = _b.sent();
                            res.json(prog);
                            return [2 /*return*/];
                    }
                });
            }); });
            // ── Maestro Routes ───────────────────────────────────────────────────────────
            // Serve Maestro files (video/photo) — with Range support for video streaming
            app.get("/api/maestro/file/:filename", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var resource, buf, contentType, total, rangeHeader, parts, start, end, chunkSize;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getMaestroResourceByStoredFilename(req.params.filename)];
                        case 1:
                            resource = _a.sent();
                            if (!resource || !resource.fileData)
                                return [2 /*return*/, res.status(404).json({ message: "File not found" })];
                            buf = Buffer.from(resource.fileData, "base64");
                            contentType = getContentType(resource.originalFilename);
                            total = buf.length;
                            rangeHeader = req.headers.range;
                            if (rangeHeader) {
                                parts = rangeHeader.replace(/bytes=/, "").split("-");
                                start = parseInt(parts[0], 10);
                                end = parts[1] ? parseInt(parts[1], 10) : total - 1;
                                chunkSize = end - start + 1;
                                res.status(206);
                                res.set("Content-Range", "bytes ".concat(start, "-").concat(end, "/").concat(total));
                                res.set("Accept-Ranges", "bytes");
                                res.set("Content-Length", String(chunkSize));
                                res.set("Content-Type", contentType);
                                res.send(buf.subarray(start, end + 1));
                            }
                            else {
                                res.set("Content-Type", contentType);
                                res.set("Content-Length", String(total));
                                res.set("Accept-Ranges", "bytes");
                                res.send(buf);
                            }
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: upload video (max 3, max 197s = 3m17s — duration validated client-side)
            app.post("/api/teacher/maestro/videos", maestroUpload.single("video"), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, count, durationSeconds, resource, err_2;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 3, , 4]);
                            teacherId = req.session.teacherId;
                            console.log("[video-upload] teacherId=".concat(teacherId, ", file=").concat((_a = req.file) === null || _a === void 0 ? void 0 : _a.originalname, ", size=").concat((_b = req.file) === null || _b === void 0 ? void 0 : _b.size));
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            if (!req.file)
                                return [2 /*return*/, res.status(400).json({ message: "No video file provided" })];
                            return [4 /*yield*/, storage_1.storage.countMaestroVideosByTeacher(teacherId)];
                        case 1:
                            count = _c.sent();
                            if (count >= 3) {
                                return [2 /*return*/, res.status(400).json({ message: "Video limiti doldu. Yeni video eklemek için mevcut bir videoyu silin." })];
                            }
                            durationSeconds = parseInt(req.body.durationSeconds) || 0;
                            if (durationSeconds > 197) {
                                return [2 /*return*/, res.status(400).json({ message: "Video süresi 3:17 (197 sn) sınırını aşıyor." })];
                            }
                            return [4 /*yield*/, storage_1.storage.createMaestroResource({
                                    teacherId: teacherId,
                                    type: "video",
                                    title: (req.body.title || req.file.originalname.replace(/\.[^.]+$/, "")).trim(),
                                    originalFilename: req.file.originalname,
                                    storedFilename: makeStoredFilename(),
                                    fileData: req.file.buffer.toString("base64"),
                                    durationSeconds: durationSeconds,
                                    fileSize: req.file.size,
                                })];
                        case 2:
                            resource = _c.sent();
                            res.json(resource);
                            return [3 /*break*/, 4];
                        case 3:
                            err_2 = _c.sent();
                            res.status(500).json({ message: err_2.message });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: upload photo (no limit on count)
            app.post("/api/teacher/maestro/photos", maestroUpload.single("photo"), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, resource, err_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            if (!req.file)
                                return [2 /*return*/, res.status(400).json({ message: "No photo file provided" })];
                            return [4 /*yield*/, storage_1.storage.createMaestroResource({
                                    teacherId: teacherId,
                                    type: "photo",
                                    title: (req.body.title || req.file.originalname.replace(/\.[^.]+$/, "")).trim(),
                                    originalFilename: req.file.originalname,
                                    storedFilename: makeStoredFilename(),
                                    fileData: req.file.buffer.toString("base64"),
                                    durationSeconds: 0,
                                    fileSize: req.file.size,
                                })];
                        case 1:
                            resource = _a.sent();
                            res.json(resource);
                            return [3 /*break*/, 3];
                        case 2:
                            err_3 = _a.sent();
                            res.status(500).json({ message: err_3.message });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: list all resources
            app.get("/api/teacher/maestro/resources", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, resources;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getMaestroResourcesByTeacher(teacherId)];
                        case 1:
                            resources = _a.sent();
                            res.json(resources);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: delete resource
            app.delete("/api/teacher/maestro/resources/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, resource;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getMaestroResource(req.params.id)];
                        case 1:
                            resource = _a.sent();
                            if (!resource)
                                return [2 /*return*/, res.status(404).json({ message: "Resource not found" })];
                            if (resource.teacherId !== teacherId)
                                return [2 /*return*/, res.status(403).json({ message: "Not authorized" })];
                            return [4 /*yield*/, storage_1.storage.deleteMaestroResource(req.params.id)];
                        case 2:
                            _a.sent();
                            res.json({ ok: true });
                            return [2 /*return*/];
                    }
                });
            }); });
            // Teacher: watch report
            app.get("/api/teacher/maestro/watch-report", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var teacherId, data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            teacherId = req.session.teacherId;
                            if (!teacherId)
                                return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                            return [4 /*yield*/, storage_1.storage.getMaestroViewProgressByTeacher(teacherId)];
                        case 1:
                            data = _a.sent();
                            res.json(data);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Student: get resources for their class
            app.get("/api/student/:studentId/maestro/resources", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var student, resources;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getStudent(req.params.studentId)];
                        case 1:
                            student = _a.sent();
                            if (!student)
                                return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                            return [4 /*yield*/, storage_1.storage.getMaestroResourcesByClass(student.classId)];
                        case 2:
                            resources = _a.sent();
                            res.json(resources);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Student: update watch progress
            app.post("/api/student/:studentId/maestro/progress", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var student, _a, resourceId, watchedSeconds, completed, prog;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getStudent(req.params.studentId)];
                        case 1:
                            student = _b.sent();
                            if (!student)
                                return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                            _a = req.body, resourceId = _a.resourceId, watchedSeconds = _a.watchedSeconds, completed = _a.completed;
                            if (!resourceId)
                                return [2 /*return*/, res.status(400).json({ message: "resourceId required" })];
                            return [4 /*yield*/, storage_1.storage.upsertMaestroViewProgress(req.params.studentId, resourceId, Math.round(watchedSeconds) || 0, !!completed)];
                        case 2:
                            prog = _b.sent();
                            res.json(prog);
                            return [2 /*return*/];
                    }
                });
            }); });
            // Student: get own watch progress
            app.get("/api/student/:studentId/maestro/progress", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var student, prog;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, storage_1.storage.getStudent(req.params.studentId)];
                        case 1:
                            student = _a.sent();
                            if (!student)
                                return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                            return [4 /*yield*/, storage_1.storage.getMaestroViewProgressByStudent(req.params.studentId)];
                        case 2:
                            prog = _a.sent();
                            res.json(prog);
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/, httpServer];
        });
    });
}
