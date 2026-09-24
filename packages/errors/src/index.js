"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.validationError = validationError;
exports.unauthorized = unauthorized;
exports.forbidden = forbidden;
exports.notFound = notFound;
exports.conflict = conflict;
exports.versionConflict = versionConflict;
exports.internalError = internalError;
exports.toErrorResponse = toErrorResponse;
class AppError extends Error {
    code;
    statusCode;
    fields;
    isOperational;
    constructor(opts) {
        super(opts.message);
        this.name = 'AppError';
        this.code = opts.code;
        this.statusCode = opts.statusCode;
        this.fields = opts.fields;
        this.isOperational = true;
        if (opts.cause)
            this.cause = opts.cause;
    }
}
exports.AppError = AppError;
function validationError(message, fields) {
    return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}
function unauthorized(message = 'Unauthorized') {
    return new AppError({ code: 'UNAUTHORIZED', message, statusCode: 401 });
}
function forbidden(message = 'Forbidden') {
    return new AppError({ code: 'FORBIDDEN', message, statusCode: 403 });
}
function notFound(message = 'Not found') {
    return new AppError({ code: 'NOT_FOUND', message, statusCode: 404 });
}
function conflict(code = 'CONFLICT', message = 'Conflict') {
    return new AppError({ code, message, statusCode: 409 });
}
function versionConflict(currentVersion) {
    return new AppError({ code: 'VERSION_CONFLICT', message: `Version conflict. Current version is ${currentVersion}`, statusCode: 409, fields: { currentVersion } });
}
function internalError(message = 'Internal server error') {
    return new AppError({ code: 'INTERNAL_ERROR', message, statusCode: 500 });
}
function toErrorResponse(err, traceId) {
    return {
        success: false,
        error: { code: err.code, message: err.message, fields: err.fields ?? {} },
        traceId,
    };
}
//# sourceMappingURL=index.js.map