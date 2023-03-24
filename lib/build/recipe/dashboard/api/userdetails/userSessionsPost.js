"use strict";
var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSessionsPost = void 0;
const error_1 = __importDefault(require("../../../../error"));
const session_1 = __importDefault(require("../../../session"));
const userSessionsPost = (_, options) =>
    __awaiter(void 0, void 0, void 0, function* () {
        const requestBody = yield options.req.getJSONBody();
        const sessionHandles = requestBody.sessionHandles;
        if (sessionHandles === undefined || !Array.isArray(sessionHandles)) {
            throw new error_1.default({
                message: "Required parameter 'sessionHandles' is missing or has an invalid type",
                type: error_1.default.BAD_INPUT_ERROR,
            });
        }
        yield session_1.default.revokeMultipleSessions(sessionHandles);
        return {
            status: "OK",
        };
    });
exports.userSessionsPost = userSessionsPost;