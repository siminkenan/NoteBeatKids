"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("./db");
var schema_1 = require("@shared/schema");
var bcryptjs_1 = require("bcryptjs");
var DatabaseStorage = /** @class */ (function () {
    function DatabaseStorage() {
    }
    DatabaseStorage.prototype.getAdminByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.admins).where((0, drizzle_orm_1.eq)(schema_1.admins.email, email)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getInstitutions = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.institutions).orderBy(schema_1.institutions.createdAt)];
            });
        });
    };
    DatabaseStorage.prototype.getInstitution = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.institutions).where((0, drizzle_orm_1.eq)(schema_1.institutions.id, id)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.generateCode = function (length) {
        if (length === void 0) { length = 8; }
        var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var code = "";
        for (var i = 0; i < length; i++)
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    };
    DatabaseStorage.prototype.uniqueTeacherCode = function () {
        return __awaiter(this, void 0, void 0, function () {
            var code, attempts, existing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        code = this.generateCode(8);
                        attempts = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempts < 20)) return [3 /*break*/, 3];
                        return [4 /*yield*/, db_1.db.select({ id: schema_1.teacherCodes.id }).from(schema_1.teacherCodes).where((0, drizzle_orm_1.eq)(schema_1.teacherCodes.code, code)).limit(1)];
                    case 2:
                        existing = _a.sent();
                        if (existing.length === 0)
                            return [2 /*return*/, code];
                        code = this.generateCode(8);
                        attempts++;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, code];
                }
            });
        });
    };
    DatabaseStorage.prototype.createInstitution = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var result, inst, count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.institutions).values(data).returning()];
                    case 1:
                        result = _a.sent();
                        inst = result[0];
                        count = Math.min(inst.maxTeachers, 500);
                        return [4 /*yield*/, this.generateTeacherCodesForInstitution(inst.id, count, 1)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, inst];
                }
            });
        });
    };
    DatabaseStorage.prototype.getInstitutionByTeacherCode = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.institutions).where((0, drizzle_orm_1.eq)(schema_1.institutions.teacherCode, code.toUpperCase())).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.generateTeacherCodesForInstitution = function (institutionId_1, count_1) {
        return __awaiter(this, arguments, void 0, function (institutionId, count, startSlot) {
            var rows, i, code, result;
            if (startSlot === void 0) { startSlot = 1; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rows = [];
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < count)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.uniqueTeacherCode()];
                    case 2:
                        code = _a.sent();
                        rows.push({ institutionId: institutionId, code: code, slotNumber: startSlot + i });
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (rows.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db.insert(schema_1.teacherCodes).values(rows).returning()];
                    case 5:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    DatabaseStorage.prototype.getTeacherCodesByInstitution = function (institutionId) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select({
                            id: schema_1.teacherCodes.id,
                            institutionId: schema_1.teacherCodes.institutionId,
                            code: schema_1.teacherCodes.code,
                            teacherId: schema_1.teacherCodes.teacherId,
                            slotNumber: schema_1.teacherCodes.slotNumber,
                            createdAt: schema_1.teacherCodes.createdAt,
                            teacherName: schema_1.teachers.name,
                        })
                            .from(schema_1.teacherCodes)
                            .leftJoin(schema_1.teachers, (0, drizzle_orm_1.eq)(schema_1.teacherCodes.teacherId, schema_1.teachers.id))
                            .where((0, drizzle_orm_1.eq)(schema_1.teacherCodes.institutionId, institutionId))
                            .orderBy(schema_1.teacherCodes.slotNumber)];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows.map(function (r) { var _a; return (__assign(__assign({}, r), { teacherName: (_a = r.teacherName) !== null && _a !== void 0 ? _a : null })); })];
                }
            });
        });
    };
    DatabaseStorage.prototype.findTeacherCodeByValue = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.teacherCodes).where((0, drizzle_orm_1.eq)(schema_1.teacherCodes.code, code.toUpperCase())).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.linkTeacherToCode = function (codeId, teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.update(schema_1.teacherCodes).set({ teacherId: teacherId }).where((0, drizzle_orm_1.eq)(schema_1.teacherCodes.id, codeId))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.uniqueStudentCode = function () {
        return __awaiter(this, void 0, void 0, function () {
            var code, attempts, existing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        code = this.generateCode(8);
                        attempts = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempts < 20)) return [3 /*break*/, 3];
                        return [4 /*yield*/, db_1.db.select({ id: schema_1.studentCodes.id }).from(schema_1.studentCodes).where((0, drizzle_orm_1.eq)(schema_1.studentCodes.code, code)).limit(1)];
                    case 2:
                        existing = _a.sent();
                        if (existing.length === 0)
                            return [2 /*return*/, code];
                        code = this.generateCode(8);
                        attempts++;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, code];
                }
            });
        });
    };
    DatabaseStorage.prototype.generateStudentCodesForClass = function (classId, count) {
        return __awaiter(this, void 0, void 0, function () {
            var rows, i, code, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rows = [];
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < count)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.uniqueStudentCode()];
                    case 2:
                        code = _a.sent();
                        rows.push({ classId: classId, code: code, slotNumber: i + 1 });
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (rows.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db.insert(schema_1.studentCodes).values(rows).returning()];
                    case 5:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    DatabaseStorage.prototype.getStudentCodesByClass = function (classId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.studentCodes).where((0, drizzle_orm_1.eq)(schema_1.studentCodes.classId, classId)).orderBy(schema_1.studentCodes.slotNumber)];
            });
        });
    };
    DatabaseStorage.prototype.findStudentCodeByValue = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.studentCodes).where((0, drizzle_orm_1.eq)(schema_1.studentCodes.code, code.toUpperCase())).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.linkStudentToStudentCode = function (code, studentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.update(schema_1.studentCodes)
                            .set({ studentId: studentId })
                            .where((0, drizzle_orm_1.eq)(schema_1.studentCodes.code, code.toUpperCase()))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.findStudentCodeByStudentId = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.studentCodes).where((0, drizzle_orm_1.eq)(schema_1.studentCodes.studentId, studentId)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateInstitution = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.update(schema_1.institutions).set(data).where((0, drizzle_orm_1.eq)(schema_1.institutions.id, id)).returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getTeachers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.teachers).orderBy(schema_1.teachers.createdAt)];
            });
        });
    };
    DatabaseStorage.prototype.getTeachersByInstitution = function (institutionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.teachers).where((0, drizzle_orm_1.eq)(schema_1.teachers.institutionId, institutionId))];
            });
        });
    };
    DatabaseStorage.prototype.getTeacherByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.teachers).where((0, drizzle_orm_1.eq)(schema_1.teachers.email, email)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getTeacher = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.teachers).where((0, drizzle_orm_1.eq)(schema_1.teachers.id, id)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.createTeacher = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var hashed, _a, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!data.password) return [3 /*break*/, 2];
                        return [4 /*yield*/, bcryptjs_1.default.hash(data.password, 10)];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = null;
                        _b.label = 3;
                    case 3:
                        hashed = _a;
                        return [4 /*yield*/, db_1.db.insert(schema_1.teachers).values(__assign(__assign({}, data), { password: hashed })).returning()];
                    case 4:
                        result = _b.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.findTeacherByNameAndInstitution = function (name, institutionId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.teachers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["LOWER(", ")"], ["LOWER(", ")"])), schema_1.teachers.name), name.toLowerCase()), (0, drizzle_orm_1.eq)(schema_1.teachers.institutionId, institutionId))).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.createTeacherByCode = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.teachers).values({ name: data.name, institutionId: data.institutionId }).returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getAllClasses = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rows, counts, countMap;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select({
                            id: schema_1.classes.id,
                            name: schema_1.classes.name,
                            teacherId: schema_1.classes.teacherId,
                            classCode: schema_1.classes.classCode,
                            maxStudents: schema_1.classes.maxStudents,
                            expiresAt: schema_1.classes.expiresAt,
                            createdAt: schema_1.classes.createdAt,
                            teacherName: schema_1.teachers.name,
                            teacherEmail: schema_1.teachers.email,
                            institutionName: schema_1.institutions.name,
                        })
                            .from(schema_1.classes)
                            .leftJoin(schema_1.teachers, (0, drizzle_orm_1.eq)(schema_1.classes.teacherId, schema_1.teachers.id))
                            .leftJoin(schema_1.institutions, (0, drizzle_orm_1.eq)(schema_1.teachers.institutionId, schema_1.institutions.id))
                            .orderBy(schema_1.classes.createdAt)];
                    case 1:
                        rows = _a.sent();
                        return [4 /*yield*/, db_1.db
                                .select({ classId: schema_1.students.classId, count: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["count(*)::int"], ["count(*)::int"]))) })
                                .from(schema_1.students)
                                .groupBy(schema_1.students.classId)];
                    case 2:
                        counts = _a.sent();
                        countMap = Object.fromEntries(counts.map(function (r) { return [r.classId, r.count]; }));
                        return [2 /*return*/, rows.map(function (r) {
                                var _a, _b, _c, _d;
                                return (__assign(__assign({}, r), { teacherName: (_a = r.teacherName) !== null && _a !== void 0 ? _a : "—", teacherEmail: (_b = r.teacherEmail) !== null && _b !== void 0 ? _b : "—", institutionName: (_c = r.institutionName) !== null && _c !== void 0 ? _c : null, studentCount: (_d = countMap[r.id]) !== null && _d !== void 0 ? _d : 0 }));
                            })];
                }
            });
        });
    };
    DatabaseStorage.prototype.getClassesByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.classes).where((0, drizzle_orm_1.eq)(schema_1.classes.teacherId, teacherId)).orderBy(schema_1.classes.createdAt)];
            });
        });
    };
    DatabaseStorage.prototype.getClass = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.classes).where((0, drizzle_orm_1.eq)(schema_1.classes.id, id)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getClassByCode = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.classes).where((0, drizzle_orm_1.eq)(schema_1.classes.classCode, code.toUpperCase())).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.createClass = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var result, cls, count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.classes).values(data).returning()];
                    case 1:
                        result = _a.sent();
                        cls = result[0];
                        count = Math.min(cls.maxStudents, 200);
                        return [4 /*yield*/, this.generateStudentCodesForClass(cls.id, count)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, cls];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteClass = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var studentList, _i, studentList_1, student;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getStudentsByClass(id)];
                    case 1:
                        studentList = _a.sent();
                        _i = 0, studentList_1 = studentList;
                        _a.label = 2;
                    case 2:
                        if (!(_i < studentList_1.length)) return [3 /*break*/, 7];
                        student = studentList_1[_i];
                        return [4 /*yield*/, db_1.db.delete(schema_1.studentProgress).where((0, drizzle_orm_1.eq)(schema_1.studentProgress.studentId, student.id))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, db_1.db.delete(schema_1.orchestraProgress).where((0, drizzle_orm_1.eq)(schema_1.orchestraProgress.studentId, student.id))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, db_1.db.delete(schema_1.maestroViewProgress).where((0, drizzle_orm_1.eq)(schema_1.maestroViewProgress.studentId, student.id))];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: 
                    // 2. Nullify studentId refs in student_codes BEFORE deleting students (FK: student_codes.studentId → students.id)
                    return [4 /*yield*/, db_1.db.update(schema_1.studentCodes).set({ studentId: null }).where((0, drizzle_orm_1.eq)(schema_1.studentCodes.classId, id))];
                    case 8:
                        // 2. Nullify studentId refs in student_codes BEFORE deleting students (FK: student_codes.studentId → students.id)
                        _a.sent();
                        // 3. Now safe to delete students
                        return [4 /*yield*/, db_1.db.delete(schema_1.students).where((0, drizzle_orm_1.eq)(schema_1.students.classId, id))];
                    case 9:
                        // 3. Now safe to delete students
                        _a.sent();
                        // 4. Delete student_codes for the class
                        return [4 /*yield*/, db_1.db.delete(schema_1.studentCodes).where((0, drizzle_orm_1.eq)(schema_1.studentCodes.classId, id))];
                    case 10:
                        // 4. Delete student_codes for the class
                        _a.sent();
                        // 5. Delete the class
                        return [4 /*yield*/, db_1.db.delete(schema_1.classes).where((0, drizzle_orm_1.eq)(schema_1.classes.id, id))];
                    case 11:
                        // 5. Delete the class
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.getStudentsByClass = function (classId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.students).where((0, drizzle_orm_1.eq)(schema_1.students.classId, classId)).orderBy(schema_1.students.firstName)];
            });
        });
    };
    DatabaseStorage.prototype.getStudent = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.students).where((0, drizzle_orm_1.eq)(schema_1.students.id, id)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.findStudent = function (classId, firstName, lastName) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.students).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.students.classId, classId), (0, drizzle_orm_1.eq)((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["LOWER(", ")"], ["LOWER(", ")"])), schema_1.students.firstName), firstName.toLowerCase()), (0, drizzle_orm_1.eq)((0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["LOWER(", ")"], ["LOWER(", ")"])), schema_1.students.lastName), lastName.toLowerCase()))).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.createStudent = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.students).values(data).returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.countStudents = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_1.students)];
                    case 1:
                        result = _c.sent();
                        return [2 /*return*/, Number((_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0)];
                }
            });
        });
    };
    DatabaseStorage.prototype.getProgressByStudent = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.studentProgress).where((0, drizzle_orm_1.eq)(schema_1.studentProgress.studentId, studentId))];
            });
        });
    };
    DatabaseStorage.prototype.getProgressByStudentAndType = function (studentId, appType) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.studentProgress).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.studentProgress.studentId, studentId), (0, drizzle_orm_1.eq)(schema_1.studentProgress.appType, appType))).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.upsertProgress = function (studentId, appType, data) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, updated, result;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.getProgressByStudentAndType(studentId, appType)];
                    case 1:
                        existing = _g.sent();
                        if (!existing) return [3 /*break*/, 3];
                        return [4 /*yield*/, db_1.db.update(schema_1.studentProgress)
                                .set(__assign(__assign({}, data), { updatedAt: new Date() }))
                                .where((0, drizzle_orm_1.eq)(schema_1.studentProgress.id, existing.id))
                                .returning()];
                    case 2:
                        updated = _g.sent();
                        return [2 /*return*/, updated[0]];
                    case 3: return [4 /*yield*/, db_1.db.insert(schema_1.studentProgress).values({
                            studentId: studentId,
                            appType: appType,
                            level: (_a = data.level) !== null && _a !== void 0 ? _a : 1,
                            starsEarned: (_b = data.starsEarned) !== null && _b !== void 0 ? _b : 0,
                            correctAnswers: (_c = data.correctAnswers) !== null && _c !== void 0 ? _c : 0,
                            wrongAnswers: (_d = data.wrongAnswers) !== null && _d !== void 0 ? _d : 0,
                            timeSpentSeconds: (_e = data.timeSpentSeconds) !== null && _e !== void 0 ? _e : 0,
                            notesBadge: (_f = data.notesBadge) !== null && _f !== void 0 ? _f : null,
                        }).returning()];
                    case 4:
                        result = _g.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getClassProgress = function (classId) {
        return __awaiter(this, void 0, void 0, function () {
            var studentList, result, _i, studentList_2, student, progress, rhythmProgress, notesProgress, drumProgress, melodyProgress;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getStudentsByClass(classId)];
                    case 1:
                        studentList = _a.sent();
                        result = [];
                        _i = 0, studentList_2 = studentList;
                        _a.label = 2;
                    case 2:
                        if (!(_i < studentList_2.length)) return [3 /*break*/, 5];
                        student = studentList_2[_i];
                        return [4 /*yield*/, this.getProgressByStudent(student.id)];
                    case 3:
                        progress = _a.sent();
                        rhythmProgress = progress.find(function (p) { return p.appType === 'rhythm'; });
                        notesProgress = progress.find(function (p) { return p.appType === 'notes'; });
                        drumProgress = progress.find(function (p) { return p.appType === 'drum_kit'; });
                        melodyProgress = progress.find(function (p) { return p.appType === 'melody'; });
                        result.push(__assign(__assign({}, student), { rhythmProgress: rhythmProgress, notesProgress: notesProgress, drumProgress: drumProgress, melodyProgress: melodyProgress }));
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, result];
                }
            });
        });
    };
    DatabaseStorage.prototype.resetInstitutionQuota = function (institutionId) {
        return __awaiter(this, void 0, void 0, function () {
            var institutionTeachers, _i, institutionTeachers_1, teacher, teacherClasses, _a, teacherClasses_1, cls;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getTeachersByInstitution(institutionId)];
                    case 1:
                        institutionTeachers = _b.sent();
                        _i = 0, institutionTeachers_1 = institutionTeachers;
                        _b.label = 2;
                    case 2:
                        if (!(_i < institutionTeachers_1.length)) return [3 /*break*/, 8];
                        teacher = institutionTeachers_1[_i];
                        return [4 /*yield*/, this.getClassesByTeacher(teacher.id)];
                    case 3:
                        teacherClasses = _b.sent();
                        _a = 0, teacherClasses_1 = teacherClasses;
                        _b.label = 4;
                    case 4:
                        if (!(_a < teacherClasses_1.length)) return [3 /*break*/, 7];
                        cls = teacherClasses_1[_a];
                        return [4 /*yield*/, this.deleteClass(cls.id)];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        _a++;
                        return [3 /*break*/, 4];
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteInstitution = function (institutionId) {
        return __awaiter(this, void 0, void 0, function () {
            var institutionTeachers, _i, institutionTeachers_2, teacher, teacherResources, _a, teacherResources_1, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.resetInstitutionQuota(institutionId)];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.getTeachersByInstitution(institutionId)];
                    case 2:
                        institutionTeachers = _b.sent();
                        _i = 0, institutionTeachers_2 = institutionTeachers;
                        _b.label = 3;
                    case 3:
                        if (!(_i < institutionTeachers_2.length)) return [3 /*break*/, 11];
                        teacher = institutionTeachers_2[_i];
                        return [4 /*yield*/, db_1.db
                                .select({ id: schema_1.maestroResources.id })
                                .from(schema_1.maestroResources)
                                .where((0, drizzle_orm_1.eq)(schema_1.maestroResources.teacherId, teacher.id))];
                    case 4:
                        teacherResources = _b.sent();
                        _a = 0, teacherResources_1 = teacherResources;
                        _b.label = 5;
                    case 5:
                        if (!(_a < teacherResources_1.length)) return [3 /*break*/, 8];
                        res = teacherResources_1[_a];
                        return [4 /*yield*/, db_1.db.delete(schema_1.maestroViewProgress).where((0, drizzle_orm_1.eq)(schema_1.maestroViewProgress.resourceId, res.id))];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        _a++;
                        return [3 /*break*/, 5];
                    case 8: return [4 /*yield*/, db_1.db.delete(schema_1.maestroResources).where((0, drizzle_orm_1.eq)(schema_1.maestroResources.teacherId, teacher.id))];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10:
                        _i++;
                        return [3 /*break*/, 3];
                    case 11: return [4 /*yield*/, db_1.db.delete(schema_1.teacherCodes).where((0, drizzle_orm_1.eq)(schema_1.teacherCodes.institutionId, institutionId))];
                    case 12:
                        _b.sent();
                        return [4 /*yield*/, db_1.db.delete(schema_1.teachers).where((0, drizzle_orm_1.eq)(schema_1.teachers.institutionId, institutionId))];
                    case 13:
                        _b.sent();
                        return [4 /*yield*/, db_1.db.delete(schema_1.institutions).where((0, drizzle_orm_1.eq)(schema_1.institutions.id, institutionId))];
                    case 14:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.getInstitutionDetails = function (institutionId) {
        return __awaiter(this, void 0, void 0, function () {
            var teacherList, result, _i, teacherList_1, teacher, classList, classResults, _a, classList_1, cls, progressList, studentRows;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getTeachersByInstitution(institutionId)];
                    case 1:
                        teacherList = _b.sent();
                        result = [];
                        _i = 0, teacherList_1 = teacherList;
                        _b.label = 2;
                    case 2:
                        if (!(_i < teacherList_1.length)) return [3 /*break*/, 9];
                        teacher = teacherList_1[_i];
                        return [4 /*yield*/, this.getClassesByTeacher(teacher.id)];
                    case 3:
                        classList = _b.sent();
                        classResults = [];
                        _a = 0, classList_1 = classList;
                        _b.label = 4;
                    case 4:
                        if (!(_a < classList_1.length)) return [3 /*break*/, 7];
                        cls = classList_1[_a];
                        return [4 /*yield*/, this.getClassProgress(cls.id)];
                    case 5:
                        progressList = _b.sent();
                        studentRows = progressList.map(function (s) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
                            return ({
                                id: s.id,
                                firstName: s.firstName,
                                lastName: s.lastName,
                                rhythmLevel: (_b = (_a = s.rhythmProgress) === null || _a === void 0 ? void 0 : _a.level) !== null && _b !== void 0 ? _b : 0,
                                rhythmStars: (_d = (_c = s.rhythmProgress) === null || _c === void 0 ? void 0 : _c.starsEarned) !== null && _d !== void 0 ? _d : 0,
                                rhythmCorrect: (_f = (_e = s.rhythmProgress) === null || _e === void 0 ? void 0 : _e.correctAnswers) !== null && _f !== void 0 ? _f : 0,
                                rhythmWrong: (_h = (_g = s.rhythmProgress) === null || _g === void 0 ? void 0 : _g.wrongAnswers) !== null && _h !== void 0 ? _h : 0,
                                notesLevel: (_k = (_j = s.notesProgress) === null || _j === void 0 ? void 0 : _j.level) !== null && _k !== void 0 ? _k : 0,
                                notesStars: (_m = (_l = s.notesProgress) === null || _l === void 0 ? void 0 : _l.starsEarned) !== null && _m !== void 0 ? _m : 0,
                                notesCorrect: (_p = (_o = s.notesProgress) === null || _o === void 0 ? void 0 : _o.correctAnswers) !== null && _p !== void 0 ? _p : 0,
                                notesWrong: (_r = (_q = s.notesProgress) === null || _q === void 0 ? void 0 : _q.wrongAnswers) !== null && _r !== void 0 ? _r : 0,
                                drumTimeSeconds: (_t = (_s = s.drumProgress) === null || _s === void 0 ? void 0 : _s.timeSpentSeconds) !== null && _t !== void 0 ? _t : 0,
                                melodyCorrect: (_v = (_u = s.melodyProgress) === null || _u === void 0 ? void 0 : _u.correctAnswers) !== null && _v !== void 0 ? _v : 0,
                                melodyWrong: (_x = (_w = s.melodyProgress) === null || _w === void 0 ? void 0 : _w.wrongAnswers) !== null && _x !== void 0 ? _x : 0,
                                melodyStars: (_z = (_y = s.melodyProgress) === null || _y === void 0 ? void 0 : _y.starsEarned) !== null && _z !== void 0 ? _z : 0,
                                totalCorrect: ((_1 = (_0 = s.rhythmProgress) === null || _0 === void 0 ? void 0 : _0.correctAnswers) !== null && _1 !== void 0 ? _1 : 0) + ((_3 = (_2 = s.notesProgress) === null || _2 === void 0 ? void 0 : _2.correctAnswers) !== null && _3 !== void 0 ? _3 : 0) + ((_5 = (_4 = s.melodyProgress) === null || _4 === void 0 ? void 0 : _4.correctAnswers) !== null && _5 !== void 0 ? _5 : 0),
                                totalTimeSeconds: ((_7 = (_6 = s.rhythmProgress) === null || _6 === void 0 ? void 0 : _6.timeSpentSeconds) !== null && _7 !== void 0 ? _7 : 0) + ((_9 = (_8 = s.notesProgress) === null || _8 === void 0 ? void 0 : _8.timeSpentSeconds) !== null && _9 !== void 0 ? _9 : 0) + ((_11 = (_10 = s.drumProgress) === null || _10 === void 0 ? void 0 : _10.timeSpentSeconds) !== null && _11 !== void 0 ? _11 : 0) + ((_13 = (_12 = s.melodyProgress) === null || _12 === void 0 ? void 0 : _12.timeSpentSeconds) !== null && _13 !== void 0 ? _13 : 0),
                            });
                        });
                        classResults.push({
                            id: cls.id,
                            name: cls.name,
                            classCode: cls.classCode,
                            maxStudents: cls.maxStudents,
                            expiresAt: cls.expiresAt ? cls.expiresAt.toISOString() : null,
                            students: studentRows,
                        });
                        _b.label = 6;
                    case 6:
                        _a++;
                        return [3 /*break*/, 4];
                    case 7:
                        result.push({ id: teacher.id, name: teacher.name, email: teacher.email, classes: classResults });
                        _b.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 2];
                    case 9: return [2 /*return*/, { teachers: result }];
                }
            });
        });
    };
    DatabaseStorage.prototype.getAdminStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, instCount, teacherCount, studentCount, progressStats;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            db_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_1.institutions),
                            db_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_1.teachers),
                            db_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_1.students),
                        ])];
                    case 1:
                        _a = _m.sent(), instCount = _a[0], teacherCount = _a[1], studentCount = _a[2];
                        return [4 /*yield*/, db_1.db.select({
                                totalCorrect: (0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["COALESCE(SUM(correct_answers), 0)"], ["COALESCE(SUM(correct_answers), 0)"]))),
                                totalTime: (0, drizzle_orm_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["COALESCE(SUM(time_spent_seconds), 0)"], ["COALESCE(SUM(time_spent_seconds), 0)"]))),
                            }).from(schema_1.studentProgress)];
                    case 2:
                        progressStats = _m.sent();
                        return [2 /*return*/, {
                                institutionCount: Number((_c = (_b = instCount[0]) === null || _b === void 0 ? void 0 : _b.count) !== null && _c !== void 0 ? _c : 0),
                                teacherCount: Number((_e = (_d = teacherCount[0]) === null || _d === void 0 ? void 0 : _d.count) !== null && _e !== void 0 ? _e : 0),
                                studentCount: Number((_g = (_f = studentCount[0]) === null || _f === void 0 ? void 0 : _f.count) !== null && _g !== void 0 ? _g : 0),
                                totalExercisesCompleted: Number((_j = (_h = progressStats[0]) === null || _h === void 0 ? void 0 : _h.totalCorrect) !== null && _j !== void 0 ? _j : 0),
                                totalTimeSpentSeconds: Number((_l = (_k = progressStats[0]) === null || _k === void 0 ? void 0 : _k.totalTime) !== null && _l !== void 0 ? _l : 0),
                            }];
                }
            });
        });
    };
    DatabaseStorage.prototype.seedData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ADMIN_EMAIL, ADMIN_PASSWORD, existingAdmin, ok, hashedPw_1, hashedPw, inst1, inst2, hashedTeacherPw, teacher1, teacher2, class1, class2, studentData, createdStudents, _i, createdStudents_1, student;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ADMIN_EMAIL = "admin@notebeatkids.com";
                        ADMIN_PASSWORD = "114344_Kenan";
                        return [4 /*yield*/, this.getAdminByEmail(ADMIN_EMAIL)];
                    case 1:
                        existingAdmin = _a.sent();
                        if (!existingAdmin) return [3 /*break*/, 6];
                        return [4 /*yield*/, bcryptjs_1.default.compare(ADMIN_PASSWORD, existingAdmin.password)];
                    case 2:
                        ok = _a.sent();
                        if (!!ok) return [3 /*break*/, 5];
                        return [4 /*yield*/, bcryptjs_1.default.hash(ADMIN_PASSWORD, 10)];
                    case 3:
                        hashedPw_1 = _a.sent();
                        return [4 /*yield*/, db_1.db.update(schema_1.admins).set({ password: hashedPw_1 }).where((0, drizzle_orm_1.eq)(schema_1.admins.email, ADMIN_EMAIL))];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                    case 6: return [4 /*yield*/, bcryptjs_1.default.hash(ADMIN_PASSWORD, 10)];
                    case 7:
                        hashedPw = _a.sent();
                        return [4 /*yield*/, db_1.db.insert(schema_1.admins).values({
                                email: ADMIN_EMAIL,
                                password: hashedPw,
                                name: "System Admin",
                            })];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, db_1.db.insert(schema_1.institutions).values({
                                name: "Sunshine Elementary School",
                                licenseStart: new Date("2025-01-01"),
                                licenseEnd: new Date("2026-12-31"),
                                isActive: true,
                            }).returning()];
                    case 9:
                        inst1 = (_a.sent())[0];
                        return [4 /*yield*/, db_1.db.insert(schema_1.institutions).values({
                                name: "Melody Primary Academy",
                                licenseStart: new Date("2025-06-01"),
                                licenseEnd: new Date("2027-05-31"),
                                isActive: true,
                            }).returning()];
                    case 10:
                        inst2 = (_a.sent())[0];
                        return [4 /*yield*/, bcryptjs_1.default.hash("teacher123", 10)];
                    case 11:
                        hashedTeacherPw = _a.sent();
                        return [4 /*yield*/, db_1.db.insert(schema_1.teachers).values({
                                institutionId: inst1.id,
                                name: "Ms. Sarah Johnson",
                                email: "sarah@sunshine.edu",
                                password: hashedTeacherPw,
                            }).returning()];
                    case 12:
                        teacher1 = (_a.sent())[0];
                        return [4 /*yield*/, db_1.db.insert(schema_1.teachers).values({
                                institutionId: inst2.id,
                                name: "Mr. David Park",
                                email: "david@melody.edu",
                                password: hashedTeacherPw,
                            }).returning()];
                    case 13:
                        teacher2 = (_a.sent())[0];
                        return [4 /*yield*/, db_1.db.insert(schema_1.classes).values({
                                teacherId: teacher1.id,
                                name: "Grade 2A Music",
                                classCode: "SUN2A1",
                                maxStudents: 25,
                                expiresAt: new Date("2026-06-30"),
                            }).returning()];
                    case 14:
                        class1 = (_a.sent())[0];
                        return [4 /*yield*/, db_1.db.insert(schema_1.classes).values({
                                teacherId: teacher1.id,
                                name: "Grade 3B Music",
                                classCode: "SUN3B1",
                                maxStudents: 20,
                                expiresAt: new Date("2026-06-30"),
                            }).returning()];
                    case 15:
                        class2 = (_a.sent())[0];
                        studentData = [
                            { classId: class1.id, firstName: "Emma", lastName: "Wilson" },
                            { classId: class1.id, firstName: "Liam", lastName: "Garcia" },
                            { classId: class1.id, firstName: "Olivia", lastName: "Chen" },
                            { classId: class1.id, firstName: "Noah", lastName: "Thompson" },
                            { classId: class1.id, firstName: "Ava", lastName: "Martinez" },
                            { classId: class2.id, firstName: "James", lastName: "Brown" },
                            { classId: class2.id, firstName: "Sophia", lastName: "Davis" },
                        ];
                        return [4 /*yield*/, db_1.db.insert(schema_1.students).values(studentData).returning()];
                    case 16:
                        createdStudents = _a.sent();
                        _i = 0, createdStudents_1 = createdStudents;
                        _a.label = 17;
                    case 17:
                        if (!(_i < createdStudents_1.length)) return [3 /*break*/, 20];
                        student = createdStudents_1[_i];
                        return [4 /*yield*/, db_1.db.insert(schema_1.studentProgress).values([
                                {
                                    studentId: student.id,
                                    appType: "rhythm",
                                    level: Math.floor(Math.random() * 4) + 1,
                                    starsEarned: Math.floor(Math.random() * 10),
                                    correctAnswers: Math.floor(Math.random() * 50) + 10,
                                    wrongAnswers: Math.floor(Math.random() * 15),
                                    timeSpentSeconds: Math.floor(Math.random() * 3600) + 300,
                                },
                                {
                                    studentId: student.id,
                                    appType: "notes",
                                    level: Math.floor(Math.random() * 3) + 1,
                                    starsEarned: Math.floor(Math.random() * 8),
                                    correctAnswers: Math.floor(Math.random() * 40) + 5,
                                    wrongAnswers: Math.floor(Math.random() * 10),
                                    timeSpentSeconds: Math.floor(Math.random() * 2400) + 200,
                                },
                            ])];
                    case 18:
                        _a.sent();
                        _a.label = 19;
                    case 19:
                        _i++;
                        return [3 /*break*/, 17];
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    // Orchestra Songs
    DatabaseStorage.prototype.getOrchestraSongsByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.orchestraSongs)
                        .where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.teacherId, teacherId))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.orchestraSongs.createdAt))];
            });
        });
    };
    DatabaseStorage.prototype.getOrchestraSong = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.orchestraSongs).where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.id, id)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.getOrchestraSongByStoredFilename = function (storedFilename) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.orchestraSongs).where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.storedFilename, storedFilename)).limit(1)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    DatabaseStorage.prototype.createOrchestraSong = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var song;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.orchestraSongs).values(data).returning()];
                    case 1:
                        song = (_a.sent())[0];
                        return [2 /*return*/, song];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateOrchestraSong = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var song;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.update(schema_1.orchestraSongs).set(data).where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.id, id)).returning()];
                    case 1:
                        song = (_a.sent())[0];
                        return [2 /*return*/, song];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteOrchestraSong = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.delete(schema_1.orchestraProgress).where((0, drizzle_orm_1.eq)(schema_1.orchestraProgress.songId, id))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, db_1.db.delete(schema_1.orchestraSongs).where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.id, id))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.countOrchestraSongsByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_1.orchestraSongs)
                            .where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.teacherId, teacherId))];
                    case 1:
                        result = _c.sent();
                        return [2 /*return*/, Number((_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0)];
                }
            });
        });
    };
    DatabaseStorage.prototype.getOrchestraSongsByClass = function (classId) {
        return __awaiter(this, void 0, void 0, function () {
            var cls;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.classes).where((0, drizzle_orm_1.eq)(schema_1.classes.id, classId)).limit(1)];
                    case 1:
                        cls = _a.sent();
                        if (!cls[0])
                            return [2 /*return*/, []];
                        return [2 /*return*/, this.getOrchestraSongsByTeacher(cls[0].teacherId)];
                }
            });
        });
    };
    // Orchestra Progress
    DatabaseStorage.prototype.createOrchestraProgress = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var progress;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.orchestraProgress).values(data).returning()];
                    case 1:
                        progress = (_a.sent())[0];
                        return [2 /*return*/, progress];
                }
            });
        });
    };
    DatabaseStorage.prototype.getOrchestraProgressByStudent = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.orchestraProgress)
                        .where((0, drizzle_orm_1.eq)(schema_1.orchestraProgress.studentId, studentId))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.orchestraProgress.completedAt))];
            });
        });
    };
    DatabaseStorage.prototype.getOrchestraProgressByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            var teacherSongs, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select({ id: schema_1.orchestraSongs.id }).from(schema_1.orchestraSongs)
                            .where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.teacherId, teacherId))];
                    case 1:
                        teacherSongs = _a.sent();
                        if (teacherSongs.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db
                                .select({
                                id: schema_1.orchestraProgress.id,
                                studentId: schema_1.orchestraProgress.studentId,
                                songId: schema_1.orchestraProgress.songId,
                                mode: schema_1.orchestraProgress.mode,
                                laneMode: schema_1.orchestraProgress.laneMode,
                                accuracy: schema_1.orchestraProgress.accuracy,
                                perfectCount: schema_1.orchestraProgress.perfectCount,
                                goodCount: schema_1.orchestraProgress.goodCount,
                                missCount: schema_1.orchestraProgress.missCount,
                                completedAt: schema_1.orchestraProgress.completedAt,
                                studentName: (0, drizzle_orm_1.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["concat(", ", ' ', ", ")"], ["concat(", ", ' ', ", ")"])), schema_1.students.firstName, schema_1.students.lastName),
                                songName: schema_1.orchestraSongs.name,
                            })
                                .from(schema_1.orchestraProgress)
                                .innerJoin(schema_1.students, (0, drizzle_orm_1.eq)(schema_1.orchestraProgress.studentId, schema_1.students.id))
                                .innerJoin(schema_1.orchestraSongs, (0, drizzle_orm_1.eq)(schema_1.orchestraProgress.songId, schema_1.orchestraSongs.id))
                                .where((0, drizzle_orm_1.eq)(schema_1.orchestraSongs.teacherId, teacherId))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.orchestraProgress.completedAt))];
                    case 2:
                        rows = _a.sent();
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    // ── Maestro Resources ──────────────────────────────────────────────────────
    DatabaseStorage.prototype.createMaestroResource = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var r;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.maestroResources).values(data).returning()];
                    case 1:
                        r = (_a.sent())[0];
                        return [2 /*return*/, r];
                }
            });
        });
    };
    DatabaseStorage.prototype.getMaestroResourcesByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select({
                            id: schema_1.maestroResources.id,
                            teacherId: schema_1.maestroResources.teacherId,
                            type: schema_1.maestroResources.type,
                            title: schema_1.maestroResources.title,
                            originalFilename: schema_1.maestroResources.originalFilename,
                            storedFilename: schema_1.maestroResources.storedFilename,
                            durationSeconds: schema_1.maestroResources.durationSeconds,
                            fileSize: schema_1.maestroResources.fileSize,
                            fileData: (0, drizzle_orm_1.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["null"], ["null"]))),
                            createdAt: schema_1.maestroResources.createdAt,
                        }).from(schema_1.maestroResources)
                            .where((0, drizzle_orm_1.eq)(schema_1.maestroResources.teacherId, teacherId))
                            .orderBy(schema_1.maestroResources.createdAt)];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    DatabaseStorage.prototype.getMaestroResourcesByClass = function (classId) {
        return __awaiter(this, void 0, void 0, function () {
            var cls;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.classes).where((0, drizzle_orm_1.eq)(schema_1.classes.id, classId)).limit(1)];
                    case 1:
                        cls = _a.sent();
                        if (!cls[0])
                            return [2 /*return*/, []];
                        return [2 /*return*/, this.getMaestroResourcesByTeacher(cls[0].teacherId)];
                }
            });
        });
    };
    DatabaseStorage.prototype.getMaestroResource = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var r;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.maestroResources).where((0, drizzle_orm_1.eq)(schema_1.maestroResources.id, id)).limit(1)];
                    case 1:
                        r = (_a.sent())[0];
                        return [2 /*return*/, r];
                }
            });
        });
    };
    DatabaseStorage.prototype.getMaestroResourceByStoredFilename = function (storedFilename) {
        return __awaiter(this, void 0, void 0, function () {
            var r;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.maestroResources).where((0, drizzle_orm_1.eq)(schema_1.maestroResources.storedFilename, storedFilename)).limit(1)];
                    case 1:
                        r = (_a.sent())[0];
                        return [2 /*return*/, r];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteMaestroResource = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.delete(schema_1.maestroViewProgress).where((0, drizzle_orm_1.eq)(schema_1.maestroViewProgress.resourceId, id))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, db_1.db.delete(schema_1.maestroResources).where((0, drizzle_orm_1.eq)(schema_1.maestroResources.id, id))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.countMaestroVideosByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            var row;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["count(*)"], ["count(*)"]))) })
                            .from(schema_1.maestroResources)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.maestroResources.teacherId, teacherId), (0, drizzle_orm_1.eq)(schema_1.maestroResources.type, "video")))];
                    case 1:
                        row = (_b.sent())[0];
                        return [2 /*return*/, Number((_a = row === null || row === void 0 ? void 0 : row.count) !== null && _a !== void 0 ? _a : 0)];
                }
            });
        });
    };
    // ── Maestro View Progress ──────────────────────────────────────────────────
    DatabaseStorage.prototype.upsertMaestroViewProgress = function (studentId, resourceId, watchedSeconds, completed) {
        return __awaiter(this, void 0, void 0, function () {
            var row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.maestroViewProgress)
                            .values({ studentId: studentId, resourceId: resourceId, watchedSeconds: watchedSeconds, completed: completed })
                            .onConflictDoUpdate({
                            target: [schema_1.maestroViewProgress.studentId, schema_1.maestroViewProgress.resourceId],
                            set: {
                                watchedSeconds: (0, drizzle_orm_1.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["greatest(excluded.watched_seconds, maestro_view_progress.watched_seconds)"], ["greatest(excluded.watched_seconds, maestro_view_progress.watched_seconds)"]))),
                                completed: (0, drizzle_orm_1.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["excluded.completed OR maestro_view_progress.completed"], ["excluded.completed OR maestro_view_progress.completed"]))),
                                updatedAt: new Date(),
                            },
                        })
                            .returning()];
                    case 1:
                        row = (_a.sent())[0];
                        return [2 /*return*/, row];
                }
            });
        });
    };
    DatabaseStorage.prototype.getMaestroViewProgressByTeacher = function (teacherId) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select({
                            resourceId: schema_1.maestroResources.id,
                            resourceTitle: schema_1.maestroResources.title,
                            durationSeconds: schema_1.maestroResources.durationSeconds,
                            studentId: schema_1.students.id,
                            studentName: (0, drizzle_orm_1.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["concat(", ", ' ', ", ")"], ["concat(", ", ' ', ", ")"])), schema_1.students.firstName, schema_1.students.lastName),
                            watchedSeconds: schema_1.maestroViewProgress.watchedSeconds,
                            completed: schema_1.maestroViewProgress.completed,
                        })
                            .from(schema_1.maestroViewProgress)
                            .innerJoin(schema_1.maestroResources, (0, drizzle_orm_1.eq)(schema_1.maestroViewProgress.resourceId, schema_1.maestroResources.id))
                            .innerJoin(schema_1.students, (0, drizzle_orm_1.eq)(schema_1.maestroViewProgress.studentId, schema_1.students.id))
                            .where((0, drizzle_orm_1.eq)(schema_1.maestroResources.teacherId, teacherId))
                            .orderBy(schema_1.maestroResources.createdAt, schema_1.students.firstName)];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    DatabaseStorage.prototype.getMaestroViewProgressByStudent = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.maestroViewProgress)
                        .where((0, drizzle_orm_1.eq)(schema_1.maestroViewProgress.studentId, studentId))];
            });
        });
    };
    return DatabaseStorage;
}());
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17;
